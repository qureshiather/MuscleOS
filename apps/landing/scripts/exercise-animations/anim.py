"""Choreography helpers: an exercise is a `pose(ctx, u)` function over the movement phase u
(0 = start position, 1 = the other end of the rep). The baker samples it every frame, then
writes linear keyframes, so poses can depend on evaluated positions (e.g. a bar that hangs
under the shoulders) without fighting the animation system."""

import math

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

import mannequin as M
import scene as S

# Body-frame axes: +X is the figure's left, +Y its back, +Z up.
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)


def sgn(side):
    return 1 if side == 'L' else -1


def smootherstep(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * t * (t * (t * 6 - 15) + 10)


def lerp(a, b, t):
    if isinstance(a, (tuple, list, Vector)):
        return Vector(a).lerp(Vector(b), t)
    return a + (b - a) * t


class Timeline:
    """Hold start → move → hold end → move back, as fractions of the loop."""

    def __init__(self, frames, hold_start=0.12, out=0.36, hold_end=0.1):
        self.frames = frames
        self.a = hold_start
        self.b = self.a + out
        self.c = self.b + hold_end

    def u(self, frame):
        t = frame / self.frames
        if t < self.a:
            return 0.0
        if t < self.b:
            return smootherstep((t - self.a) / (self.b - self.a))
        if t < self.c:
            return 1.0
        return 1.0 - smootherstep((t - self.c) / (1.0 - self.c))

    def outbound(self, frame):
        """1 while moving 0→1, 0 while moving 1→0 (smoothed), for the highlight pulse."""
        t = frame / self.frames
        mid_out = (self.a + self.b) / 2
        mid_back = (self.c + 1) / 2
        w_out = math.exp(-(((t - mid_out) / ((self.b - self.a) * 0.55)) ** 2))
        w_back = math.exp(-(((t - mid_back) / ((1 - self.c) * 0.55)) ** 2))
        return w_out, w_back


class Ctx:
    def __init__(self, body, equipment, cam):
        self.body = body
        self.eq = equipment
        self.cam = cam
        self.arm = body.arm
        self._targets_set = set()
        self._rot_set = set()
        self._grips = {}
        self.pole_dirs = {}
        self.fk_limbs = set()
        self.reset_pose_defaults()

    # -- whole body ------------------------------------------------------------------------

    def reset_pose_defaults(self):
        self.pole_dirs = {
            'arm.L': Vector((0.4, 1, -0.2)),
            'arm.R': Vector((-0.4, 1, -0.2)),
            'leg.L': Vector((0.1, -1, 0)),
            'leg.R': Vector((-0.1, -1, 0)),
        }

    def root(self, loc, rot=(0, 0, 0)):
        """Pelvis world position and body rotation (XYZ euler, degrees)."""
        self.arm.location = Vector(loc)
        self.arm.rotation_euler = Euler([math.radians(a) for a in rot], 'XYZ')

    def body_dir(self, v):
        bpy.context.view_layer.update()
        return self.arm.matrix_world.to_quaternion() @ Vector(v)

    def body_point(self, p):
        """World position of a point given in rest space (feet on z = 0)."""
        bpy.context.view_layer.update()
        return self.arm.matrix_world @ (Vector(p) - self.body.origin)

    def bone(self, name, *rotations):
        self.body.pose_bone(name, rotations)

    def spine(self, flex=0, side=0, twist=0, split=(0.35, 0.4, 0.25)):
        """Distribute spine flexion (+ forward), side bend (+ to the left) and twist over the
        pelvis→spine→chest chain."""
        for bone, f in zip(('spine', 'chest', 'neck'), split):
            self.bone(bone, (X, flex * f), (Y, -side * f), (Z, twist * f))

    def head(self, flex=0, turn=0):
        self.bone('head', (X, flex), (Z, turn))

    def leg_fk(self, side, hip_flex=0, hip_abd=0, knee=0, ankle=0, hip_rot=0):
        s = sgn(side)
        self._fk('leg.' + side)
        self.bone('thigh.' + side, (Z, s * hip_rot), (Y, -s * hip_abd), (X, -hip_flex))
        self.bone('shin.' + side, (X, knee))
        self.bone('foot.' + side, (X, -ankle))

    def arm_fk(self, side, flex=0, abd=0, elbow=0, rot=0, wrist=0, shrug=0, protract=0, twist=0):
        """flex: shoulder flexion (arm forward/up). abd: abduction (arm out to the side).
        elbow: elbow flexion. rot: upper-arm internal rotation. wrist: wrist flexion."""
        s = sgn(side)
        self._fk('arm.' + side)
        self.bone('shoulder.' + side, (Y, -s * shrug), (Z, s * protract))
        self.bone('upperarm.' + side, (Z, -s * rot), (Y, -s * abd), (X, -flex))
        # twist: forearm supination (+ turns the palm forward from facing the thigh).
        self.bone('forearm.' + side, (Z, s * twist), (X, -elbow))
        self.bone('hand.' + side, (X, -wrist))

    def _fk(self, key):
        # Switch IK off now, so positions read later in this pose (props following a hand,
        # bars between the hands) see the FK pose rather than last frame's IK.
        self.fk_limbs.add(key)
        self.body.set_ik(key, False, False)

    def shoulder_girdle(self, side, shrug=0, protract=0):
        s = sgn(side)
        self.bone('shoulder.' + side, (Y, -s * shrug), (Z, s * protract))

    # -- IK --------------------------------------------------------------------------------

    def target(self, key, loc, rot=None):
        """Place an IK target (wrist for arms, ankle for legs) in world space. `rot` is a world
        quaternion for the hand/foot; default keeps it aligned with the body frame."""
        t = self.body.targets[key]
        t.location = Vector(loc)
        if rot is None and key.startswith('leg'):
            # Feet default to flat on the floor, turned with the body's heading.
            yaw = Quaternion((0, 0, 1), self.arm.rotation_euler.z)
            rot = yaw @ self.body.rest_quat('foot.' + key[-1])
        if rot is not None:
            t.rotation_quaternion = rot
            self._rot_set.add(key)
        self._targets_set.add(key)

    def hand_rot(self, side, *rotations):
        """World quaternion for a hand: rest orientation rotated by body-frame rotations."""
        return self.arm.matrix_world.to_quaternion() @ (
            self.body.local_rotation_world(rotations) @ self.body.rest_quat('hand.' + side)
        )

    def foot_rot(self, side, *rotations):
        return self.arm.matrix_world.to_quaternion() @ (
            self.body.local_rotation_world(rotations) @ self.body.rest_quat('foot.' + side)
        )

    def pole_dir(self, key, v):
        """Direction (body frame) the elbow/knee points toward."""
        self.pole_dirs[key] = Vector(v)

    def pole_world(self, key, v):
        """Direction (world frame) the elbow/knee points toward."""
        bpy.context.view_layer.update()
        self.pole_dirs[key] = self.arm.matrix_world.to_quaternion().inverted() @ Vector(v)

    def world(self, bone, where='head'):
        return self.body.world_point(bone, where)

    def bone_delta(self, bone):
        """World rotation that takes the bone from its rest orientation to its current one."""
        m = self.body.world_bone_matrix(bone)
        return m.to_quaternion() @ self.body.rest_quat(bone).inverted()

    def attach_point(self, bone, rest_point):
        """Where a rest-space point rigidly attached to `bone` is now."""
        m = self.body.world_bone_matrix(bone)
        b = self.arm.data.bones[bone]
        local = b.matrix_local.inverted() @ (Vector(rest_point) - self.body.origin)
        return m @ local

    def follow(self, obj, bone, rest_point, rest_rot=None):
        """Move a prop with a bone: rest_point/rest_rot are where it sits in the rest pose."""
        obj.location = self.attach_point(bone, rest_point)
        obj.rotation_quaternion = self.bone_delta(bone) @ (rest_rot or Quaternion())

    def root_rot_quat(self, rot):
        return Euler([math.radians(a) for a in rot], 'XYZ').to_quaternion()

    def pin_root(self, rest_point, world_point, rot=(0, 0, 0)):
        """Rotate the body by `rot` and place it so a rest-space point (on the pelvis frame,
        ignoring spine bends) lands on world_point."""
        q = self.root_rot_quat(rot)
        off = q @ (Vector(rest_point) - self.body.origin)
        self.root(Vector(world_point) - off, rot)

    def grip(self, side, point, thumb):
        """Close the hand around a handle at `point` whose axis runs along `thumb` (world, pointing
        out of the thumb side of the fist). The wrist stays as straight as the arm allows."""
        self._grips[side] = (Vector(point), Vector(thumb).normalized())
        self._targets_set.add('arm.' + side)
        self._rot_set.add('arm.' + side)

    def _solve_grip(self, side, point, thumb, forearm):
        d = (forearm - thumb * forearm.dot(thumb)).normalized()
        # The right hand is the left's mirror image, so its (d, n, f) frame has the opposite
        # handedness; build the target frame the same way or the "rotation" is a reflection.
        n = d.cross(thumb) * sgn(side)
        rd, rn, rf = M.hand_frame_rest(side)
        R = (Matrix((d, n, thumb)).transposed() @ Matrix((rd, rn, rf))).to_quaternion()
        offset = Vector(M.grip_point(side)) - M.joint('wrist', side)
        t = self.body.targets['arm.' + side]
        t.location = point - R @ offset
        t.rotation_quaternion = R @ self.body.rest_quat('hand.' + side)

    def grip_hang(self, side, bar_y, grip_x, straight=0.985):
        """Grip point for a straight arm hanging from the shoulder to a bar at bar_y, x."""
        reach = M.grip_reach(side) * straight
        sh = self.world('upperarm.' + side, 'head')
        dx = sgn(side) * grip_x - sh.x
        dy = bar_y - sh.y
        dz = math.sqrt(max(reach**2 - dx * dx - dy * dy, 0.0))
        return Vector((sgn(side) * grip_x, bar_y, sh.z - dz))

    # -- per-frame finalisation -----------------------------------------------------------

    def begin_frame(self):
        self._targets_set.clear()
        self._rot_set.clear()
        self._grips.clear()
        self.fk_limbs.clear()
        for pb in self.arm.pose.bones:
            pb.rotation_quaternion = Quaternion()
            pb.location = (0, 0, 0)
        for s in ('L', 'R'):
            self.bone('upperarm.' + s)  # arms hang at the sides, not in the rest A-pose
        for key in self.body.ik:
            self.body.set_ik(key, True, False)
        self.reset_pose_defaults()

    def end_frame(self):
        # Grips: aim the wrist from the shoulder first, then refine from the solved forearm.
        for side, (point, thumb) in self._grips.items():
            self._solve_grip(side, point, thumb, point - self.world('upperarm.' + side, 'head'))
        for _ in range(3):
            self._place_poles()
            for side, (point, thumb) in self._grips.items():
                fwd = self.world('forearm.' + side, 'tail') - self.world('forearm.' + side, 'head')
                self._solve_grip(side, point, thumb, fwd)
        self._place_poles()

    def _place_poles(self):
        bpy.context.view_layer.update()
        q = self.arm.matrix_world.to_quaternion()
        for key in ('arm.L', 'arm.R', 'leg.L', 'leg.R'):
            fk = key in self.fk_limbs and key not in self._targets_set
            self.body.set_ik(key, not fk, (not fk) and key in self._rot_set)
            side = key[-1]
            if key.startswith('arm'):
                root, end = 'upperarm.' + side, 'forearm.' + side
            else:
                root, end = 'thigh.' + side, 'shin.' + side
            if fk or key not in self._targets_set:
                # Park the target on the FK pose so nothing jumps if IK switches on.
                bpy.context.view_layer.update()
                self.body.targets[key].location = self.world(end, 'tail')
            a = self.world(root, 'head')
            b = self.body.targets[key].location
            self.body.poles[key].location = (a + b) / 2 + q @ self.pole_dirs[key].normalized() * 0.9


class Baker:
    """Records transforms per frame (pass 1), then keys them all (pass 2).

    Bones are recorded as their solved (visual) rotations with IK applied, and constraints are
    switched off for playback. Blender's IK starts from the previous pose, so re-solving at
    render time could differ from what was recorded; baking makes every frame deterministic."""

    def __init__(self, ctx, extra_objects=()):
        self.ctx = ctx
        self.objects = [ctx.arm, *ctx.body.targets.values(), *ctx.body.poles.values(), ctx.cam]
        self.objects += list(extra_objects)
        self.snapshots = []

    def snapshot(self, pulse):
        snap = {'pulse': pulse, 'obj': {}, 'bones': {}}
        for o in self.objects:
            rot = o.rotation_quaternion.copy() if o.rotation_mode == 'QUATERNION' else o.rotation_euler.copy()
            snap['obj'][o.name] = (o.location.copy(), rot, o.scale.copy())
        bpy.context.view_layer.update()
        arm = self.ctx.arm
        for pb in arm.pose.bones:
            local = arm.convert_space(pose_bone=pb, matrix=pb.matrix, from_space='POSE', to_space='LOCAL')
            snap['bones'][pb.name] = (local.to_translation(), local.to_quaternion())
        self.snapshots.append(snap)

    def write(self, body_material):
        prev_q = {}
        pulse_node = body_material.node_tree.nodes['pulse'].outputs[0]
        for f, snap in enumerate(self.snapshots):
            for o in self.objects:
                loc, rot, scale = snap['obj'][o.name]
                o.location = loc
                o.scale = scale
                o.keyframe_insert('location', frame=f)
                o.keyframe_insert('scale', frame=f)
                if o.rotation_mode == 'QUATERNION':
                    k = 'o:' + o.name
                    if k in prev_q and prev_q[k].dot(rot) < 0:
                        rot = -rot
                    prev_q[k] = rot
                    o.rotation_quaternion = rot
                    o.keyframe_insert('rotation_quaternion', frame=f)
                else:
                    o.rotation_euler = rot
                    o.keyframe_insert('rotation_euler', frame=f)
            for pb in self.ctx.arm.pose.bones:
                loc, rot = snap['bones'][pb.name]
                k = 'b:' + pb.name
                if k in prev_q and prev_q[k].dot(rot) < 0:
                    rot = -rot
                prev_q[k] = rot
                pb.location = loc
                pb.rotation_quaternion = rot
                pb.keyframe_insert('location', frame=f)
                pb.keyframe_insert('rotation_quaternion', frame=f)
            pulse_node.default_value = snap['pulse']
            pulse_node.keyframe_insert('default_value', frame=f)
        for c, cr in self.ctx.body.ik.values():
            c.influence = cr.influence = 0.0
        for action in bpy.data.actions:
            for fc in _fcurves(action):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'


def _fcurves(action):
    if hasattr(action, 'fcurves') and len(getattr(action, 'fcurves', [])):
        return list(action.fcurves)
    out = []
    for layer in getattr(action, 'layers', []):
        for strip in layer.strips:
            for bag in getattr(strip, 'channelbags', []):
                out += list(bag.fcurves)
    return out


__all__ = ['Ctx', 'Baker', 'Timeline', 'X', 'Y', 'Z', 'sgn', 'lerp', 'smootherstep', 'M', 'S']
