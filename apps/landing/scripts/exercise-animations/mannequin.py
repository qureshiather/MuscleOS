"""The MuscleOS mannequin: one smoothly skinned metaball body on a rigged armature, plus rigid
gripping hands and a head. Muscle regions are baked into per-vertex attributes so a render can
highlight the muscles an exercise uses.

The body is built once and cached as a .blend (see `load_or_build`); every exercise render
appends that file instead of rebuilding it.

Coordinates (rest space, metres): +X is the figure's left, -Y is the way it faces, +Z is up,
feet stand on z = 0. The armature object's origin is the pelvis, so moving or rotating the
armature object moves the whole body.

The rest pose holds the arms out in an A-pose (ARM_REST_ABD) so skin weights separate the arms
from the torso. Arm poses are still written as if the rest pose had the arms hanging at the
sides: `pose_bone` converts.
"""

import math
import os

import bpy
from mathutils import Matrix, Quaternion, Vector

# Surface radius of an isolated metaball element is ~0.575 × its `radius`.
MB_K = 0.5748

PELVIS_Z = 0.94
ARM_REST_ABD = 40.0

BODY_RES = 0.0085
DETAIL_RES = 0.0045


def _j(x, y, z):
    return Vector((x, y, z))


# Joint positions with the arms hanging at the sides (left side; the right mirrors x).
JOINTS_DOWN = {
    'pelvis': _j(0, 0, PELVIS_Z),
    'spine': _j(0, 0, 1.03),
    'chest': _j(0, 0, 1.21),
    'neck': _j(0, 0.005, 1.45),
    'head': _j(0, 0.0, 1.54),
    'head_top': _j(0, 0.0, 1.77),
    'clavicle': _j(0.03, 0.0, 1.415),
    'shoulder': _j(0.2, 0.0, 1.415),
    'elbow': _j(0.235, 0.03, 1.12),
    'wrist': _j(0.255, 0.0, 0.86),
    'hand_end': _j(0.262, -0.004, 0.77),
    'hip': _j(0.092, 0.0, 0.90),
    'knee': _j(0.098, -0.015, 0.49),
    'ankle': _j(0.1, 0.01, 0.085),
    'toe': _j(0.104, -0.15, 0.02),
}
ARM_JOINTS = ('elbow', 'wrist', 'hand_end')
ARM_BONES = ('upperarm', 'forearm', 'hand')


def sgn(side):
    return 1 if side == 'L' else -1


def arm_rest_rot(side):
    """Rotation taking an arms-down arm to the A-pose rest arm (about the shoulder)."""
    return Quaternion((0, 1, 0), math.radians(-sgn(side) * ARM_REST_ABD))


def to_rest(side, p_down):
    """Map an arms-down point on the arm into the A-pose rest."""
    S = joint_down('shoulder', side)
    return S + arm_rest_rot(side) @ (Vector(p_down) - S)


def joint_down(name, side='L'):
    p = JOINTS_DOWN[name].copy()
    if side == 'R':
        p.x = -p.x
    return p


def joint(name, side='L'):
    """Rest-pose (A-pose) joint position."""
    if name in ARM_JOINTS:
        return to_rest(side, joint_down(name, side))
    return joint_down(name, side)


# Hand frame in the arms-down pose: fingers point down the arm, the palm faces the thigh,
# the thumb is forward.
def _hand_frame_down(side):
    d = (joint_down('hand_end', side) - joint_down('wrist', side)).normalized()
    n = Vector((-sgn(side), 0, 0))  # palm normal (out of the palm)
    f = Vector((0, -1, 0))  # thumb side
    return d, n, f


def hand_frame_rest(side):
    """(d, n, f) of the rest-pose hand: finger direction, palm normal, thumb side."""
    q = arm_rest_rot(side)
    return tuple(q @ v for v in _hand_frame_down(side))


def grip_reach(side='L'):
    """Shoulder-to-grip distance with the arm straight."""
    return (grip_point(side) - joint('shoulder', side)).length


GRIP_D = 0.1  # grip axis distance from the wrist, along the fingers
GRIP_N = 0.028  # and out of the palm
GRIP_RADIUS = 0.025  # finger centreline radius around it (a 28 mm bar plus finger thickness)


def grip_point(side):
    """Rest-pose point in the closed hand where a bar or handle sits."""
    d, n, _ = _hand_frame_down(side)
    W = joint_down('wrist', side)
    return to_rest(side, W + d * GRIP_D + n * GRIP_N)


# ---------------------------------------------------------------------------------------------
# Metaball helpers


def _basis_quat(x, y, z):
    return Matrix((x, y, z)).transposed().to_quaternion()


def _quat_from_z(direction):
    return Vector((0, 0, 1)).rotation_difference(direction.normalized())


class MB:
    """Collects metaball elements for one mesh, then bakes them. `xf` maps points (and `xq`
    rotations) from the coordinates the element was written in to rest space."""

    def __init__(self, name, resolution=BODY_RES):
        self.name = name
        self.resolution = resolution
        self.elements = []
        self.xf = lambda p: Vector(p)
        self.xq = Quaternion()

    def _add(self, kind, c, radius, size, q, stiffness):
        self.elements.append((kind, self.xf(c), radius, size, self.xq @ q, stiffness))

    def ball(self, c, r, stiffness=2.0):
        self._add('BALL', c, r / MB_K, (0, 0, 0), Quaternion(), stiffness)
        return self

    def ell(self, c, size, along=None, basis=None, stiffness=2.0):
        """Ellipsoid with semi-axes `size`; `along` aims its z axis, `basis` gives (x, y, z)."""
        if basis is not None:
            q = _basis_quat(*basis)
        elif along is not None:
            q = _quat_from_z(Vector(along))
        else:
            q = Quaternion()
        self._add('ELLIPSOID', c, 1 / MB_K, size, q, stiffness)
        return self

    def cap(self, p0, p1, r, stiffness=2.0):
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        q = Vector((1, 0, 0)).rotation_difference(d.normalized())
        self._add('CAPSULE', (p0 + p1) / 2, r / MB_K, (d.length / 2, 0, 0), q, stiffness)
        return self

    def taper(self, p0, p1, r0, r1, steps=4, stiffness=2.0):
        p0, p1 = Vector(p0), Vector(p1)
        for i in range(steps):
            a, b = i / steps, (i + 1) / steps
            self.cap(p0.lerp(p1, a), p0.lerp(p1, b), r0 + (r1 - r0) * (a + b) / 2, stiffness)
        return self

    def on_arm(self, side):
        """Following elements are written in arms-down coordinates for this arm."""
        self.xf = lambda p, s=side: to_rest(s, p)
        self.xq = arm_rest_rot(side)
        return self

    def on_rest(self):
        self.xf = lambda p: Vector(p)
        self.xq = Quaternion()
        return self

    def bake(self):
        mb = bpy.data.metaballs.new(self.name + '_mb')
        mb.resolution = self.resolution
        mb.render_resolution = self.resolution
        mb.threshold = 0.6
        obj = bpy.data.objects.new(self.name + '_mb', mb)
        bpy.context.scene.collection.objects.link(obj)
        for kind, c, radius, size, q, stiffness in self.elements:
            e = mb.elements.new()
            e.type = kind
            e.co = c
            e.radius = radius
            e.stiffness = stiffness
            e.rotation = q
            if kind == 'ELLIPSOID':
                e.size_x, e.size_y, e.size_z = size
            elif kind == 'CAPSULE':
                e.size_x = size[0]
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
        me.name = self.name
        bpy.data.objects.remove(obj)
        bpy.data.metaballs.remove(mb)
        for p in me.polygons:
            p.use_smooth = True
        out = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(out)
        return out


# ---------------------------------------------------------------------------------------------
# Body shapes


def _body():
    m = MB('body')
    V = Vector
    # Torso
    m.ell((0, 0.005, 0.955), (0.15, 0.1, 0.1))  # pelvis
    m.ell((0, -0.01, 1.1), (0.125, 0.092, 0.13))  # abdomen
    m.ell((0, 0.005, 1.29), (0.158, 0.104, 0.155))  # ribcage
    m.ell((0, 0.03, 1.425), (0.125, 0.06, 0.07))  # upper back / traps
    m.cap((-0.165, 0.005, 1.41), (0.165, 0.005, 1.41), 0.055)  # shoulder girdle
    m.taper((0, 0.012, 1.39), (0, 0.0, 1.585), 0.058, 0.047, steps=3)  # neck
    for s in (1, -1):
        m.ell((s * 0.072, 0.052, 0.9), (0.085, 0.075, 0.095))  # glutes
        m.ell((s * 0.078, -0.06, 1.335), (0.095, 0.05, 0.07))  # pecs
        m.ell((s * 0.115, 0.03, 1.27), (0.07, 0.07, 0.13))  # lats
        m.ell((s * 0.075, 0.03, 1.45), (0.07, 0.045, 0.035), along=(s * 0.85, 0, -0.5))  # trap slope

    for side in ('L', 'R'):
        sx = sgn(side)
        S, E, W = joint_down('shoulder', side), joint_down('elbow', side), joint_down('wrist', side)
        ua, fa = E - S, W - E
        m.on_arm(side)
        # Deltoid: a cap draped over the joint, tapering into the outside of the upper arm.
        m.ell(S + V((sx * 0.018, 0, -0.045)), (0.064, 0.07, 0.095), along=ua)
        m.ell(S + V((sx * 0.01, -0.035, -0.03)), (0.045, 0.04, 0.07), along=ua)  # front head
        m.taper(S, E, 0.05, 0.04, steps=6)
        m.ell(S.lerp(E, 0.56) + V((0, -0.024, 0)), (0.039, 0.039, 0.088), along=ua)  # biceps
        m.ell(S.lerp(E, 0.42) + V((sx * 0.006, 0.024, 0)), (0.041, 0.04, 0.11), along=ua)  # triceps
        m.ball(E, 0.039)
        m.taper(E, W, 0.042, 0.027, steps=6)
        m.ell(E.lerp(W, 0.27) + V((sx * 0.006, -0.006, 0)), (0.045, 0.041, 0.09), along=fa)  # forearm
        m.ball(W, 0.026)
        m.on_rest()

        H, K, A = joint('hip', side), joint('knee', side), joint('ankle', side)
        th, sh = K - H, A - K
        m.ball(H + V((sx * 0.012, 0, 0.012)), 0.082)
        m.taper(H, K, 0.082, 0.053, steps=7)
        m.ell(H.lerp(K, 0.45) + V((sx * 0.016, -0.03, 0)), (0.065, 0.058, 0.17), along=th)  # quads
        m.ell(H.lerp(K, 0.78) + V((-sx * 0.022, -0.032, 0)), (0.04, 0.04, 0.06), along=th)  # VMO
        m.ell(H.lerp(K, 0.42) + V((0, 0.03, 0)), (0.064, 0.056, 0.16), along=th)  # hamstrings
        m.ell(H.lerp(K, 0.25) + V((-sx * 0.035, -0.005, 0)), (0.045, 0.05, 0.11), along=th)  # adductors
        m.ball(K, 0.05)
        m.ball(K + V((0, -0.042, 0.01)), 0.026)  # kneecap
        m.taper(K, A, 0.046, 0.03, steps=7)
        m.ell(K.lerp(A, 0.28) + V((sx * 0.012, 0.028, 0)), (0.034, 0.04, 0.095), along=sh)  # calf, outer
        m.ell(K.lerp(A, 0.3) + V((-sx * 0.014, 0.026, 0)), (0.036, 0.042, 0.1), along=sh)  # calf, inner
        m.ell(K.lerp(A, 0.3) + V((sx * 0.012, -0.03, 0)), (0.02, 0.02, 0.09), along=sh)  # shin muscle
        m.ball(A + V((0, 0, 0.004)), 0.027)  # ankle; the foot mesh carries the rest
    return m.bake()


def _hand(side):
    """A closed, gripping hand (most lifts hold something), built in arms-down coordinates."""
    m = MB('hand.' + side, DETAIL_RES)
    m.on_arm(side)
    d, n, f = _hand_frame_down(side)
    x = d.cross(n).normalized()  # completes a right-handed (n, x, d) frame; ±f
    W = joint_down('wrist', side)
    m.ball(W, 0.024)
    m.ell(W + d * 0.045, (0.017, 0.042, 0.048), basis=(n, x, d))  # palm
    # Fingers and thumb wrap a circle (radius GRIP_RADIUS) around the grip axis, which runs
    # across the hand at GRIP_D along the fingers and GRIP_N out of the palm.
    c = W + d * GRIP_D + n * GRIP_N

    def around(angle_deg, along_f=0.0):
        """Point on the wrap circle; 0° is the knuckles, increasing toward the fingertips."""
        a = math.radians(angle_deg)
        return c + (-n * math.cos(a) + d * math.sin(a)) * GRIP_RADIUS + f * along_f

    for i, off in enumerate((0.03, 0.01, -0.01, -0.029)):
        r = 0.0098 if i < 3 else 0.0085
        k = W + d * (0.09 - 0.004 * abs(i - 1.5)) + f * off
        p1, p2, p3 = around(40, off), around(110, off), around(175, off)
        m.cap(k, p1, r)
        m.cap(p1, p2, r * 0.95)
        m.cap(p2, p3, r * 0.9)
    # Thumb: from the heel of the hand, across the front of the bar toward the fingertips.
    t0 = W + d * 0.025 + f * 0.03 + n * 0.008
    t1 = c + f * 0.036 + n * 0.006 - d * 0.018
    t2 = c + f * 0.024 + n * 0.022 + d * 0.004
    m.cap(t0, t1, 0.013)
    m.cap(t1, t2, 0.0105)
    return m.bake()


def _foot(side):
    """A bare foot: heel, arch, ball and five toes, built in rest coordinates."""
    sx = sgn(side)
    m = MB('foot.' + side, DETAIL_RES)
    V = lambda x, y, z: Vector((sx * x, y, z))  # noqa: E731
    A = joint('ankle', side)
    m.ball(A, 0.026)
    m.ball(A + Vector((sx * 0.02, 0.0, -0.006)), 0.013)  # outer ankle bone
    m.ball(A + Vector((-sx * 0.018, -0.004, 0.0)), 0.013)  # inner ankle bone
    m.ell(V(0.1, 0.028, 0.034), (0.03, 0.036, 0.033))  # heel
    m.ell(V(0.102, -0.03, 0.042), (0.034, 0.03, 0.075), along=(0, -1, -0.42))  # instep, sloping to the toes
    m.ell(V(0.106, -0.045, 0.017), (0.036, 0.075, 0.016))  # sole
    m.ell(V(0.105, -0.11, 0.019), (0.044, 0.028, 0.018))  # ball of the foot
    m.cap(V(0.086, -0.12, 0.016), V(0.084, -0.168, 0.013), 0.0125)  # big toe
    for x, length, r in ((0.103, 0.036, 0.0085), (0.115, 0.032, 0.008), (0.125, 0.027, 0.0075), (0.134, 0.021, 0.007)):
        y0 = -0.12 + (x - 0.103) * 0.6
        m.cap(V(x, y0, 0.014), V(x + 0.002, y0 - length, 0.011), r)
    return m.bake()


def _head():
    m = MB('head', DETAIL_RES)
    m.ell((0, 0.006, 1.666), (0.077, 0.092, 0.1))  # cranium
    m.ell((0, -0.03, 1.6), (0.06, 0.062, 0.055))  # jaw
    m.ball((0, -0.066, 1.56), 0.022)  # chin
    m.ell((0, -0.083, 1.632), (0.011, 0.016, 0.022), along=(0, -0.4, 1))  # nose
    for s in (1, -1):
        m.ell((s * 0.077, 0.006, 1.64), (0.012, 0.021, 0.031))  # ear
    return m.bake()


# ---------------------------------------------------------------------------------------------
# Muscle regions: soft ellipsoids. Arm regions are written arms-down and tested in that frame.


def _side_regions(side):
    sx = sgn(side)
    v = Vector
    Sd, Ed, Wd = joint_down('shoulder', side), joint_down('elbow', side), joint_down('wrist', side)
    H, K, A = joint('hip', side), joint('knee', side), joint('ankle', side)
    torso = [
        ('chest', v((sx * 0.085, -0.1, 1.335)), (0.11, 0.08, 0.088)),
        ('lats', v((sx * 0.13, 0.07, 1.255)), (0.08, 0.085, 0.14)),
        ('obliques', v((sx * 0.112, -0.05, 1.1)), (0.045, 0.07, 0.1)),
        ('glutes', v((sx * 0.075, 0.09, 0.9)), (0.085, 0.075, 0.1)),
        ('lower_back', v((sx * 0.035, 0.095, 1.07)), (0.04, 0.06, 0.11)),
        ('rhomboids', v((sx * 0.06, 0.11, 1.33)), (0.035, 0.05, 0.07)),
        ('quads', H.lerp(K, 0.47) + v((sx * 0.05, -0.04, 0)), (0.05, 0.07, 0.21)),  # outer
        ('quads', H.lerp(K, 0.45) + v((sx * 0.0, -0.075, 0)), (0.042, 0.06, 0.21)),  # middle
        ('quads', H.lerp(K, 0.78) + v((-sx * 0.035, -0.05, 0)), (0.045, 0.06, 0.08)),  # teardrop
        ('hamstrings', H.lerp(K, 0.5) + v((sx * 0.032, 0.065, 0)), (0.035, 0.05, 0.2)),
        ('hamstrings', H.lerp(K, 0.5) + v((-sx * 0.028, 0.065, 0)), (0.035, 0.05, 0.2)),
        ('adductors', H.lerp(K, 0.3) + v((-sx * 0.055, -0.015, 0)), (0.035, 0.05, 0.13)),
        ('calves', K.lerp(A, 0.3) + v((sx * 0.025, 0.05, 0)), (0.028, 0.04, 0.11)),
        ('calves', K.lerp(A, 0.32) + v((-sx * 0.022, 0.05, 0)), (0.028, 0.04, 0.12)),
    ]
    arm = [
        ('front_delts', Sd + v((sx * 0.005, -0.06, -0.035)), (0.05, 0.045, 0.08)),
        ('side_delts', Sd + v((sx * 0.07, 0, -0.035)), (0.04, 0.05, 0.085)),
        ('rear_delts', Sd + v((sx * 0.005, 0.06, -0.035)), (0.05, 0.045, 0.08)),
        ('biceps', Sd.lerp(Ed, 0.58) + v((0, -0.048, 0)), (0.045, 0.04, 0.11)),
        ('triceps', Sd.lerp(Ed, 0.48) + v((sx * 0.01, 0.05, 0)), (0.05, 0.045, 0.14)),
        ('forearms', Ed.lerp(Wd, 0.42), (0.065, 0.065, 0.12)),
    ]
    return [(n, c, r, None) for n, c, r in torso] + [(n, c, r, side) for n, c, r in arm]


CENTER_REGIONS = [
    ('traps', Vector((0, 0.05, 1.45)), (0.15, 0.08, 0.08), None),
    ('traps', Vector((0, 0.09, 1.33)), (0.05, 0.05, 0.11), None),
] + [
    # Six-pack: three rows of two segments.
    ('abs', Vector((sx * 0.036, -0.095, z)), (0.037, 0.07, 0.043), None)
    for sx in (1, -1)
    for z in (1.2, 1.125, 1.05)
]

REGIONS = CENTER_REGIONS + _side_regions('L') + _side_regions('R')


def _smoothstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def _membership(co, center, radii):
    d = co - center
    n = math.sqrt((d.x / radii[0]) ** 2 + (d.y / radii[1]) ** 2 + (d.z / radii[2]) ** 2)
    return _smoothstep(1.0, 0.8, n)


def paint_muscles(meshes, active):
    """Write the `act` point attribute (how much each vertex belongs to a muscle this exercise
    uses) from the rest-pose coordinates of each mesh."""
    active = set(active)
    to_down = {s: arm_rest_rot(s).inverted() for s in ('L', 'R')}
    shoulder = {s: joint_down('shoulder', s) for s in ('L', 'R')}
    for obj in meshes:
        me = obj.data
        if 'act' in me.attributes:
            me.attributes.remove(me.attributes['act'])
        act = me.attributes.new('act', 'FLOAT', 'POINT')
        regions = [r for r in REGIONS if r[0] in active]
        av = []
        for vert in me.vertices:
            co = vert.co  # every mannequin mesh is modelled in rest space
            down = {s: shoulder[s] + to_down[s] @ (co - shoulder[s]) for s in ('L', 'R')}
            a = 0.0
            for _, c, radii, arm_side in regions:
                a = max(a, _membership(down[arm_side] if arm_side else co, c, radii))
            av.append(a)
        act.data.foreach_set('value', av)


# ---------------------------------------------------------------------------------------------
# Armature


def _bone_specs():
    J = joint
    specs = [
        ('pelvis', J('pelvis'), J('spine'), None, False),
        ('spine', J('spine'), J('chest'), 'pelvis', True),
        ('chest', J('chest'), J('neck'), 'spine', True),
        ('neck', J('neck'), J('head'), 'chest', True),
        ('head', J('head'), J('head_top'), 'neck', True),
    ]
    for s in ('L', 'R'):
        specs += [
            ('shoulder.' + s, J('clavicle', s), J('shoulder', s), 'chest', False),
            ('upperarm.' + s, J('shoulder', s), J('elbow', s), 'shoulder.' + s, True),
            ('forearm.' + s, J('elbow', s), J('wrist', s), 'upperarm.' + s, True),
            ('hand.' + s, J('wrist', s), J('hand_end', s), 'forearm.' + s, True),
            ('thigh.' + s, J('hip', s), J('knee', s), 'pelvis', False),
            ('shin.' + s, J('knee', s), J('ankle', s), 'thigh.' + s, True),
            ('foot.' + s, J('ankle', s), J('toe', s), 'shin.' + s, True),
        ]
    return specs


def _empty(name, loc, size=0.05):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = size
    e.location = loc
    e.rotation_mode = 'QUATERNION'
    bpy.context.scene.collection.objects.link(e)
    return e


COLLECTION = 'mannequin'
LIMBS = ('arm.L', 'arm.R', 'leg.L', 'leg.R')


def build():
    """Build rig + meshes into the current scene, inside a 'mannequin' collection."""
    origin = JOINTS_DOWN['pelvis']
    arm_data = bpy.data.armatures.new('rig')
    arm = bpy.data.objects.new('rig', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    arm.location = origin
    arm.rotation_mode = 'XYZ'
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for name, head, tail, parent, connected in _bone_specs():
        b = arm_data.edit_bones.new(name)
        b.head = head - origin
        b.tail = tail - origin
        b.roll = 0
        if parent:
            b.parent = arm_data.edit_bones[parent]
            b.use_connect = connected
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'

    body = _body()
    _smooth_rest(body)
    _skin(body, arm)

    head = _head()
    _parent_rigid(head, arm, 'head')
    for s in ('L', 'R'):
        _parent_rigid(_foot(s), arm, 'foot.' + s)
    hands = []
    for s in ('L', 'R'):
        h = _hand(s)
        _parent_rigid(h, arm, 'hand.' + s)
        hands.append(h)

    # IK is added after skinning, so the bind happens in the plain rest pose.
    for s in ('L', 'R'):
        _limb_ik(arm, s, 'arm', 'forearm.' + s, 'hand.' + s, 'upperarm.' + s)
        _limb_ik(arm, s, 'leg', 'shin.' + s, 'foot.' + s, 'thigh.' + s)

    coll = bpy.data.collections.new(COLLECTION)
    bpy.context.scene.collection.children.link(coll)
    for o in list(bpy.context.scene.collection.objects):
        coll.objects.link(o)
        bpy.context.scene.collection.objects.unlink(o)


def _smooth_rest(obj, factor=0.6, iterations=6):
    """Relax the baked metaball surface so limb segments don't show as ridges."""
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('relax', 'SMOOTH')
    mod.factor = factor
    mod.iterations = iterations
    bpy.ops.object.modifier_apply(modifier=mod.name)


def _skin(body, arm):
    """Bone-heat weights; dual-quaternion deform keeps shoulders and elbows from collapsing."""
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    for b in arm.data.bones:
        b.use_deform = not b.name.startswith('hand.')
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    mod = next(m for m in body.modifiers if m.type == 'ARMATURE')
    mod.use_deform_preserve_volume = True
    # Corrective smooth irons out skinning creases at bent elbows and knees, relative to the
    # rest shape, so detail elsewhere is kept.
    cs = body.modifiers.new('joints', 'CORRECTIVE_SMOOTH')
    cs.rest_source = 'ORCO'
    cs.smooth_type = 'LENGTH_WEIGHTED'
    cs.iterations = 12
    cs.factor = 0.6
    cs.use_only_smooth = False
    missing = sum(1 for v in body.data.vertices if not v.groups)
    if missing:
        raise RuntimeError(f'bone heat left {missing} vertices unweighted')


def _parent_rigid(obj, arm, bone):
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    b = arm.data.bones[bone]
    obj.matrix_parent_inverse = (arm.matrix_world @ b.matrix_local @ Matrix.Translation((0, b.length, 0))).inverted()


def _limb_ik(arm, side, limb, chain_end, end_bone, chain_root):
    key = f'{limb}.{side}'
    root, mid, end = (arm.matrix_world @ arm.data.bones[b].head_local for b in (chain_root, chain_end, end_bone))
    tgt = _empty(f'ik_{key}', end)
    # The target's rest orientation is the end bone's, so copying it changes nothing at rest.
    tgt.rotation_quaternion = arm.data.bones[end_bone].matrix_local.to_quaternion()
    # Pole out along the rest bend (the way the elbow/knee already points).
    axis = (end - root).normalized()
    bend = (mid - root) - axis * (mid - root).dot(axis)
    pole = _empty(f'pole_{key}', (root + end) / 2 + bend.normalized() * 0.9)
    c = arm.pose.bones[chain_end].constraints.new('IK')
    c.name = 'IK'
    c.target = tgt
    c.pole_target = pole
    c.chain_count = 2
    c.use_stretch = False
    c.pole_angle = _calibrate_pole_angle(arm, c, chain_end, mid)
    cr = arm.pose.bones[end_bone].constraints.new('COPY_ROTATION')
    cr.name = 'CopyRot'
    cr.target = tgt


def _calibrate_pole_angle(arm, c, chain_end, rest_mid):
    """The pole angle that leaves the rest pose untouched. It depends on each bone's roll, which
    isn't mirrored between sides, so it's measured per limb rather than assumed."""

    def error(deg):
        c.pole_angle = math.radians(deg)
        bpy.context.view_layer.update()
        return ((arm.matrix_world @ arm.pose.bones[chain_end].head) - rest_mid).length

    best = min(range(-180, 180, 2), key=error)
    fine = min((best + i * 0.1 for i in range(-20, 21)), key=error)
    if error(fine) > 0.002:
        raise RuntimeError(f'{chain_end}: IK pole calibration off by {error(fine):.4f} m')
    return math.radians(fine)


def save(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    objs = set(bpy.data.collections[COLLECTION].all_objects)
    bpy.data.libraries.write(path, {bpy.data.collections[COLLECTION], *objs}, fake_user=True)


def cache_is_fresh(path):
    if not os.path.exists(path):
        return False
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.getmtime(path) >= os.path.getmtime(os.path.join(here, 'mannequin.py'))


def load_or_build(path, material):
    """Append the cached mannequin (building and caching it first if stale) and wrap it."""
    if not cache_is_fresh(path):
        build()
        save(path)
    else:
        with bpy.data.libraries.load(path, link=False) as (src, dst):
            dst.collections = [COLLECTION]
        bpy.context.scene.collection.children.link(bpy.data.collections[COLLECTION])
    return Mannequin(material)


class Mannequin:
    """Handle on the mannequin objects in the current scene."""

    def __init__(self, material):
        objs = bpy.data.objects
        self.arm = objs['rig']
        self.origin = JOINTS_DOWN['pelvis'].copy()
        self.meshes = [objs[n] for n in ('body', 'head', 'hand.L', 'hand.R', 'foot.L', 'foot.R')]
        for o in self.meshes:
            o.data.materials.clear()
            o.data.materials.append(material)
        self.targets = {k: objs['ik_' + k] for k in LIMBS}
        self.poles = {k: objs['pole_' + k] for k in LIMBS}
        self.ik = {}
        for k in LIMBS:
            side = k[-1]
            chain_end, end = ('forearm.', 'hand.') if k.startswith('arm') else ('shin.', 'foot.')
            pbs = self.arm.pose.bones
            self.ik[k] = (pbs[chain_end + side].constraints['IK'], pbs[end + side].constraints['CopyRot'])

    def set_ik(self, key, on, copy_rotation):
        c, cr = self.ik[key]
        c.influence = 1.0 if on else 0.0
        cr.influence = 1.0 if copy_rotation else 0.0

    def rest_quat(self, bone):
        return self.arm.data.bones[bone].matrix_local.to_quaternion()

    @staticmethod
    def local_rotation_world(rotations):
        q = Quaternion()
        for axis, deg in rotations:
            q = Quaternion(Vector(axis), math.radians(deg)) @ q
        return q

    def local_rotation(self, bone, rotations):
        """Bone-local quaternion for rotations about body-frame axes. Arm bones take their angles
        relative to an arms-down rest, matching how the choreography is written."""
        q = self.local_rotation_world(rotations)
        part, _, side = bone.partition('.')
        if part in ARM_BONES:
            A = arm_rest_rot(side)
            q = q @ A.inverted() if part == 'upperarm' else A @ q @ A.inverted()
        B = self.rest_quat(bone)
        return B.inverted() @ q @ B

    def pose_bone(self, bone, rotations):
        self.arm.pose.bones[bone].rotation_quaternion = self.local_rotation(bone, rotations)

    def world_point(self, bone, where='head'):
        """World position of a bone's head or tail in the current evaluated pose."""
        bpy.context.view_layer.update()
        pb = self.arm.pose.bones[bone]
        return self.arm.matrix_world @ (pb.head if where == 'head' else pb.tail)

    def world_bone_matrix(self, bone):
        bpy.context.view_layer.update()
        return self.arm.matrix_world @ self.arm.pose.bones[bone].matrix
