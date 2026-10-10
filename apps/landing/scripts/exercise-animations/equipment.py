"""Shared gym equipment. Every exercise builds its props from here, so a change to the barbell,
bench or a machine shows up in every exercise that uses it.

Each builder returns a handle (an empty, or a dict of handles) whose origin is the natural
grip / pivot point. Handles are keyed every frame by the baker; anything static can be ignored.
Props are modelled with their long axis on X.
"""

import math

import bpy
from mathutils import Matrix, Quaternion, Vector

import scene as S

R90 = math.pi / 2


def qx(deg):
    return Quaternion((1, 0, 0), math.radians(deg))


def qz(deg):
    return Quaternion((0, 0, 1), math.radians(deg))


def place(obj, loc, rot=None):
    obj.location = Vector(loc)
    obj.rotation_quaternion = rot or Quaternion()


def set_line(o, p0, p1):
    """Stretch a line() between two points."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o.location = p0
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.scale = (1, 1, max(d.length, 1e-4))


class Equipment:
    def __init__(self, theme):
        t = S.THEMES[theme]
        self.m_equip = S.flat_material('equip', t['equip'], 0.5)
        self.m_pad = S.flat_material('pad', t['pad'], 0.7)
        self.m_metal = S.flat_material('metal', t['metal'], 0.35, 0.6)
        self.m_accent = S.flat_material('accent', t['accent'], 0.5)
        self.objects = []  # everything the baker keys each frame

    # -- primitives -------------------------------------------------------------------------

    def _finish(self, obj, mat, smooth=True):
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        obj.data.polygons.foreach_set('use_smooth', [smooth] * len(obj.data.polygons))
        return obj

    def cyl(self, name, radius, depth, loc, rot=(0, 0, 0), mat=None, verts=32):
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
        o = bpy.context.active_object
        o.name = name
        return self._finish(o, mat or self.m_equip)

    def box(self, name, size, loc, mat=None, bevel=0.015, rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
        o = bpy.context.active_object
        o.name = name
        o.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel:
            m = o.modifiers.new('bevel', 'BEVEL')
            m.width = bevel
            m.segments = 3
        return self._finish(o, mat or self.m_pad, smooth=False)

    def frame(self, name, size, loc, rot=(0, 0, 0)):
        """A steel frame member."""
        return self.box(name, size, loc, self.m_equip, 0.005, rot)

    def pad(self, name, size, loc, rot=(0, 0, 0)):
        """An upholstered pad."""
        return self.box(name, size, loc, self.m_pad, 0.025, rot)

    def group(self, name, parts, origin=(0, 0, 0)):
        """Parent parts to an empty at `origin` and return the empty (the prop's handle)."""
        root = bpy.data.objects.new(name, None)
        root.location = origin
        root.rotation_mode = 'QUATERNION'
        bpy.context.scene.collection.objects.link(root)
        bpy.context.view_layer.update()
        for p in parts:
            p.parent = root
            p.matrix_parent_inverse = root.matrix_world.inverted()
        self.objects.append(root)
        return root

    def line(self, name, accent=False, radius=0.005):
        """A cable or band; set_line() stretches it between two points each frame."""
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=1, location=(0, 0, 0))
        o = bpy.context.active_object
        o.name = name
        o.data.transform(Matrix.Translation((0, 0, 0.5)))  # origin at one end, extending +Z
        o.rotation_mode = 'QUATERNION'
        self._finish(o, self.m_accent if accent else self.m_metal)
        self.objects.append(o)
        return o

    # -- free weights -----------------------------------------------------------------------

    def barbell(self, name='barbell', plate_radius=0.225, plates=2, length=2.0):
        parts = [self.cyl(name + '_bar', 0.014, length, (0, 0, 0), (0, R90, 0), self.m_metal, 16)]
        for s in (1, -1):
            parts.append(self.cyl(name + '_sleeve', 0.025, 0.4, (s * 0.8, 0, 0), (0, R90, 0), self.m_metal, 16))
            parts.append(self.cyl(name + '_collar', 0.04, 0.03, (s * 0.6, 0, 0), (0, R90, 0), self.m_metal, 16))
            for i in range(plates):
                r = plate_radius * (1 - 0.18 * i)
                parts.append(self.cyl(name + '_plate', r, 0.05, (s * (0.66 + 0.055 * i), 0, 0), (0, R90, 0), self.m_equip, 48))
        return self.group(name, parts)

    def dumbbell(self, name):
        parts = [self.cyl(name + '_handle', 0.016, 0.2, (0, 0, 0), (0, R90, 0), self.m_metal, 16)]
        for s in (1, -1):
            parts.append(self.cyl(name + '_head', 0.055, 0.07, (s * 0.12, 0, 0), (0, R90, 0), self.m_equip, 6))
        return self.group(name, parts)

    def dumbbells(self):
        return [self.dumbbell('dbL'), self.dumbbell('dbR')]

    def straight_bar(self, name='handle_bar', length=1.15):
        """A bare cable bar (lat bar, straight handle)."""
        return self.group(name, [self.cyl(name, 0.014, length, (0, 0, 0), (0, R90, 0), self.m_metal, 16)])

    # -- benches ----------------------------------------------------------------------------

    def flat_bench(self, center=(0, 0), length=1.15, height=0.44, yaw=0.0, name='bench'):
        parts = [self.pad(name + '_pad', (0.28, length, 0.07), (0, 0, height - 0.035))]
        for s in (1, -1):
            y = s * (length / 2 - 0.12)
            parts.append(self.frame(name + '_leg', (0.05, 0.05, height - 0.07), (0, y, (height - 0.07) / 2)))
            parts.append(self.frame(name + '_foot', (0.4, 0.06, 0.03), (0, y, 0.015)))
        b = self.group(name, parts, (0, 0, height))
        place(b, (center[0], center[1], height), qz(yaw))
        return b

    def incline_bench(self, back_angle=55):
        a = math.radians(-back_angle)
        self.group('incline', [
            self.pad('seat', (0.3, 0.36, 0.07), (0, -0.02, 0.43)),
            self.pad('back', (0.3, 0.07, 0.85), (0, 0.33, 0.78), (a, 0, 0)),
            self.frame('post', (0.07, 0.07, 0.4), (0, 0.0, 0.2)),
            self.frame('strut', (0.07, 0.07, 0.6), (0, 0.42, 0.33), (a, 0, 0)),
            self.frame('base', (0.4, 1.0, 0.03), (0, 0.25, 0.015)),
        ])

    # -- racks and cable stations -----------------------------------------------------------

    def pullup_bar(self, height=2.3, bar_y=-0.12):
        self.group('pullup_rig', [
            self.frame('postL', (0.08, 0.08, height + 0.05), (0.75, 0.0, (height + 0.05) / 2)),
            self.frame('postR', (0.08, 0.08, height + 0.05), (-0.75, 0.0, (height + 0.05) / 2)),
            self.cyl('bar', 0.016, 1.6, (0, bar_y, height), (0, R90, 0), self.m_metal, 16),
            self.frame('armL', (0.06, 0.18, 0.05), (0.75, bar_y / 2, height)),
            self.frame('armR', (0.06, 0.18, 0.05), (-0.75, bar_y / 2, height)),
        ])
        return Vector((0, bar_y, height))

    def cable_column(self, x, y, height):
        """Upright stack with a pulley at the top; returns the pulley point."""
        self.group('column', [
            self.frame('col', (0.16, 0.12, height), (x, y, height / 2)),
            self.box('stack', (0.22, 0.1, 0.5), (x, y + 0.08, 0.35), self.m_pad, 0.01),
            self.cyl('pulley', 0.045, 0.03, (x, y - 0.09, height - 0.05), (0, R90, 0), self.m_metal, 24),
        ], (x, y, 0))
        return Vector((x, y - 0.09, height - 0.05))

    def lat_pulldown(self):
        self.group('pulldown', [
            self.pad('seat', (0.42, 0.4, 0.07), (0, 0.05, 0.47)),
            self.frame('post', (0.1, 0.1, 0.45), (0, 0.05, 0.22)),
            self.frame('col', (0.14, 0.14, 2.5), (0, -0.62, 1.25)),
            self.frame('beam', (0.1, 0.7, 0.1), (0, -0.3, 2.45)),
            self.pad('kneepad', (0.42, 0.12, 0.1), (0, -0.33, 0.7)),
            self.frame('kneepost', (0.06, 0.06, 0.3), (0, -0.45, 0.55)),
            self.frame('base', (0.5, 1.1, 0.03), (0, -0.3, 0.015)),
        ])
        return {'bar': self.straight_bar('lat_bar'), 'cable': self.line('cable'), 'pulley': Vector((0, 0.0, 2.4))}

    def row_station(self):
        self.group('row_station', [
            self.box('seat', (0.36, 0.5, 0.06), (0, 0.05, 0.38), self.m_pad, 0.02),
            self.frame('rail', (0.12, 1.7, 0.08), (0, -0.4, 0.17)),
            self.frame('post', (0.08, 0.08, 0.3), (0, 0.05, 0.2)),
            self.frame('footplate', (0.46, 0.06, 0.3), (0, -0.84, 0.2), (math.radians(-20), 0, 0)),
            self.frame('col', (0.16, 0.16, 0.7), (0, -1.15, 0.35)),
        ])
        # V-handle: two upright grips, palms facing each other.
        handle = self.group('v_handle', [
            self.cyl('hL', 0.015, 0.11, (0.045, 0, 0), (0, 0, 0), self.m_metal, 16),
            self.cyl('hR', 0.015, 0.11, (-0.045, 0, 0), (0, 0, 0), self.m_metal, 16),
            self.box('hv', (0.12, 0.03, 0.03), (0, -0.03, 0.05), self.m_metal, 0.01),
        ])
        return {'handle': handle, 'cable': self.line('cable'), 'pulley': Vector((0, -1.05, 0.55))}

    def band_anchor(self, anchor=(0, -1.0, 1.6)):
        self.group('band_anchor', [self.frame('post', (0.1, 0.1, 1.9), (anchor[0], anchor[1] - 0.05, 0.95))])
        return Vector(anchor)

    # -- machines ---------------------------------------------------------------------------

    def leg_press(self):
        r45 = math.radians(-45)
        self.group('leg_press', [
            self.box('seat', (0.42, 0.42, 0.08), (0, 0.05, 0.42), self.m_pad, 0.02),
            self.box('back', (0.42, 0.08, 0.7), (0, 0.42, 0.68), self.m_pad, 0.02, (math.radians(-50), 0, 0)),
            self.box('base', (0.5, 1.9, 0.08), (0, -0.4, 0.04), self.m_equip, 0.01),
            self.box('frame', (0.12, 0.5, 0.36), (0, 0.15, 0.2), self.m_equip, 0.01),
            self.frame('railL', (0.06, 0.06, 1.7), (0.36, -0.75, 0.75), (r45, 0, 0)),
            self.frame('railR', (0.06, 0.06, 1.7), (-0.36, -0.75, 0.75), (r45, 0, 0)),
        ])
        platform = self.group('sled', [
            self.box('plate', (0.75, 0.05, 0.55), (0, 0, 0), self.m_equip, 0.01),
            self.box('sled', (0.8, 0.25, 0.12), (0, -0.14, -0.2), self.m_pad, 0.01),
        ])
        rail = Vector((0, -math.cos(math.radians(45)), math.sin(math.radians(45))))
        return {'platform': platform, 'rail': rail}

    def _roller_lever(self, name, arm_x, roller_y, length):
        """Lever pivoting at its origin (line it up with the knee) with a roller pad at the end."""
        return self.group(name, [
            self.frame(name + '_arm', (0.04, 0.04, length), (arm_x, 0, -length / 2)),
            self.cyl(name + '_roller', 0.045, 0.36, (0, roller_y, -length + 0.04), (0, R90, 0), self.m_pad, 24),
        ])

    def leg_curl(self):
        self.group('leg_curl', [
            self.pad('pad', (0.34, 1.15, 0.08), (0, -0.2, 0.5)),
            self.frame('leg1', (0.08, 0.08, 0.46), (0, -0.6, 0.23)),
            self.frame('leg2', (0.08, 0.08, 0.46), (0, 0.32, 0.23)),
            self.frame('base', (0.4, 1.3, 0.04), (0, -0.15, 0.02)),
            self.box('grip', (0.5, 0.04, 0.04), (0, -0.72, 0.42), self.m_metal, 0.01),
        ])
        return {'lever': self._roller_lever('curl_lever', 0.2, 0.06, 0.44)}

    def leg_extension(self):
        self.group('leg_extension', [
            self.box('seat', (0.42, 0.5, 0.08), (0, 0.02, 0.44), self.m_pad, 0.02),
            self.box('back', (0.42, 0.08, 0.62), (0, 0.3, 0.8), self.m_pad, 0.02, (math.radians(-8), 0, 0)),
            self.frame('post', (0.1, 0.1, 0.4), (0, 0.05, 0.2)),
            self.frame('base', (0.5, 0.8, 0.04), (0, 0.0, 0.02)),
        ])
        return {'lever': self._roller_lever('ext_lever', 0.24, -0.07, 0.4)}

    def calf_raise(self):
        self.group('calf_raise', [
            self.box('step', (0.5, 0.2, 0.1), (0, -0.12, 0.05), self.m_equip, 0.01),
            self.frame('post', (0.1, 0.1, 2.0), (0, 0.38, 1.0)),
            self.frame('base', (0.6, 0.9, 0.03), (0, 0.05, 0.015)),
        ])
        yoke = self.group('yoke', [
            self.pad('padL', (0.13, 0.16, 0.07), (0.13, 0, 0)),
            self.pad('padR', (0.13, 0.16, 0.07), (-0.13, 0, 0)),
            self.frame('beam', (0.06, 0.4, 0.06), (0, 0.24, 0.04)),
        ])
        return {'yoke': yoke, 'step_edge': Vector((0, -0.1, 0.12))}

    # -- more free weights ------------------------------------------------------------------

    def kettlebell(self, name='kb'):
        """Origin on the top bar of the handle, where the hand closes; the bell hangs below."""
        bpy.ops.mesh.primitive_torus_add(major_radius=0.06, minor_radius=0.011, location=(0, 0, -0.06), rotation=(R90, 0, 0))
        handle = bpy.context.active_object
        handle.name = name + '_handle'
        self._finish(handle, self.m_metal)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.085, location=(0, 0, -0.19), segments=32, ring_count=16)
        bell = bpy.context.active_object
        bell.name = name + '_bell'
        self._finish(bell, self.m_equip)
        return self.group(name, [handle, bell])

    def ez_bar(self, name='ez_bar'):
        return self.barbell(name, plate_radius=0.17, plates=1, length=1.25)

    def plate(self, name='plate', radius=0.225):
        """A loose weight plate, faces along Y (held in front of the body)."""
        return self.group(name, [self.cyl(name, radius, 0.05, (0, 0, 0), (R90, 0, 0), self.m_equip, 48)])

    def medicine_ball(self, name='ball', radius=0.12):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=(0, 0, 0), segments=32, ring_count=16)
        o = bpy.context.active_object
        o.name = name
        self._finish(o, self.m_pad)
        return self.group(name, [o])

    def trap_bar(self, name='trap_bar', handle_height=0.0):
        """Hexagonal bar around the lifter; origin between the handles at handle height."""
        parts = []
        hx, hy = 0.29, 0.0
        for s in (1, -1):
            parts.append(self.cyl(name + '_handle', 0.016, 0.16, (s * hx, hy, handle_height), (R90, 0, 0), self.m_metal, 16))
            parts.append(self.cyl(name + '_side', 0.016, 0.62, (s * 0.36, 0, 0), (R90, 0, 0), self.m_metal, 16))
            parts.append(self.cyl(name + '_sleeve', 0.025, 0.38, (s * 0.6, 0, 0), (0, R90, 0), self.m_metal, 16))
            for i in range(2):
                parts.append(self.cyl(name + '_plate', 0.225 * (1 - 0.18 * i), 0.05, (s * (0.68 + 0.055 * i), 0, 0), (0, R90, 0), self.m_equip, 48))
            for e in (1, -1):
                parts.append(self.cyl(name + '_end', 0.016, 0.24, (s * 0.25, e * 0.31, 0), (0, R90, 0), self.m_metal, 16))
        return self.group(name, parts)

    # -- stations ---------------------------------------------------------------------------

    def plyo_box(self, center=(0, 0), height=0.5, size=(0.5, 0.45), name='plyo_box'):
        self.group(name, [self.pad(name, (size[0], size[1], height), (center[0], center[1], height / 2))])

    def smith_machine(self, bar_y=0.0, name='smith'):
        """Two guide rails either side; returns the bar handle (keyed by the exercise)."""
        parts = []
        for s in (1, -1):
            parts.append(self.frame(name + '_rail', (0.07, 0.07, 2.2), (s * 0.62, bar_y, 1.1)))
            parts.append(self.frame(name + '_base', (0.12, 0.9, 0.04), (s * 0.62, bar_y, 0.02)))
        parts.append(self.frame(name + '_top', (1.34, 0.07, 0.07), (0, bar_y, 2.2)))
        self.group(name, parts)
        return self.barbell(name + '_bar', plates=1)

    def rack_pins(self, height, name='pins', y=0.0):
        """Safety pins either side at `height` (pin squats, pin presses, rack pulls)."""
        parts = []
        for s in (1, -1):
            parts.append(self.frame(name + '_post', (0.07, 0.07, 1.9), (s * 0.6, y + 0.3, 0.95)))
            parts.append(self.frame(name + '_post2', (0.07, 0.07, 1.9), (s * 0.6, y - 0.3, 0.95)))
            parts.append(self.cyl(name + '_pin', 0.02, 0.7, (s * 0.6, y, height), (R90, 0, 0), self.m_metal, 16))
        self.group(name, parts)

    def dip_bars(self, height=1.25, width=0.27, name='dips'):
        parts = []
        for s in (1, -1):
            parts.append(self.cyl(name + '_bar', 0.02, 0.6, (s * width, -0.05, height), (R90, 0, 0), self.m_metal, 16))
            parts.append(self.frame(name + '_post', (0.05, 0.05, height), (s * width, 0.25, height / 2)))
            parts.append(self.frame(name + '_post2', (0.05, 0.05, height), (s * width, -0.35, height / 2)))
        self.group(name, parts)

    def rings(self, height=2.3, width=0.25, hand_z=1.9, name='rings'):
        """Gymnastic rings hanging from straps; returns ring handles (move them with the hands)."""
        out = []
        for s in (1, -1):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.09, minor_radius=0.014, location=(0, 0, 0), rotation=(0, R90, 0))
            ring = bpy.context.active_object
            ring.name = f'{name}_{s}'
            self._finish(ring, self.m_pad)
            out.append(self.group(f'{name}_ring{s}', [ring]))
        out.append(self.line(name + '_strapL', accent=False, radius=0.008))
        out.append(self.line(name + '_strapR', accent=False, radius=0.008))
        return out

    def preacher_bench(self, name='preacher'):
        a = math.radians(-40)
        self.group(name, [
            self.pad(name + '_seat', (0.36, 0.34, 0.07), (0, 0.18, 0.62)),
            self.pad(name + '_pad', (0.42, 0.06, 0.38), (0, -0.2, 1.05), (a, 0, 0)),
            self.frame(name + '_post', (0.07, 0.07, 0.62), (0, 0.18, 0.31)),
            self.frame(name + '_arm', (0.07, 0.07, 0.55), (0, -0.08, 0.75), (math.radians(-25), 0, 0)),
            self.frame(name + '_base', (0.5, 0.8, 0.03), (0, 0.05, 0.015)),
        ])

    def captains_chair(self, name='captain'):
        self.group(name, [
            self.pad(name + '_back', (0.42, 0.07, 0.75), (0, 0.15, 1.35)),
            self.pad(name + '_armL', (0.1, 0.45, 0.08), (0.27, -0.05, 1.42)),
            self.pad(name + '_armR', (0.1, 0.45, 0.08), (-0.27, -0.05, 1.42)),
            self.frame(name + '_postL', (0.06, 0.06, 1.4), (0.27, 0.15, 0.7)),
            self.frame(name + '_postR', (0.06, 0.06, 1.4), (-0.27, 0.15, 0.7)),
            self.frame(name + '_step', (0.65, 0.2, 0.04), (0, 0.05, 0.25)),
            self.frame(name + '_base', (0.7, 0.8, 0.03), (0, 0.1, 0.015)),
        ])

    def back_extension_bench(self, name='hyper', angle=45):
        """45° hyperextension bench for a lifter whose hip joints sit at (0, -0.04, 0.95): the hip
        pad's top edge is just below the hip crease (so the torso folds over it, not through it)
        and the ankle roller sits on the back of the ankles."""
        a = math.radians(angle)
        self.group(name, [
            self.pad(name + '_hip', (0.4, 0.12, 0.3), (0, 0.0, 0.7), (a, 0, 0)),
            self.pad(name + '_ankle', (0.4, 0.09, 0.09), (0, 0.6, 0.44)),
            self.frame(name + '_rail', (0.08, 0.08, 1.1), (0, 0.15, 0.55), (a, 0, 0)),
            self.frame(name + '_foot', (0.4, 0.3, 0.04), (0, 0.5, 0.22), (a, 0, 0)),
            self.frame(name + '_base', (0.5, 1.0, 0.03), (0, 0.1, 0.015)),
        ])

    def landmine(self, anchor=(0, -1.3, 0.04), name='landmine'):
        """Bar pivoting in a floor anchor; returns (anchor point, bar line). set_line the bar from
        the anchor to the hands each frame."""
        self.group(name, [self.frame(name + '_base', (0.3, 0.3, 0.06), (anchor[0], anchor[1], 0.03))])
        return Vector(anchor), self.line(name + '_bar', radius=0.016)

    def decline_bench(self, center=(0, 0.33), angle=15, name='decline'):
        """Pad tilted head-down by `angle`; leg hooks at the high end."""
        a = math.radians(-angle)
        self.group(name, [
            self.pad(name + '_pad', (0.28, 1.15, 0.07), (center[0], center[1], 0.48), (a, 0, 0)),
            self.frame(name + '_leg1', (0.05, 0.05, 0.4), (center[0], center[1] + 0.4, 0.2)),
            self.frame(name + '_leg2', (0.05, 0.05, 0.6), (center[0], center[1] - 0.4, 0.3)),
            self.cyl(name + '_hook', 0.04, 0.34, (center[0], center[1] - 0.72, 0.55), (0, R90, 0), self.m_pad, 24),
            self.frame(name + '_base', (0.4, 1.2, 0.03), (center[0], center[1], 0.015)),
        ])


def along(axis):
    """Rotation taking +X (how bars and handles are modelled) onto `axis`."""
    return Vector((1, 0, 0)).rotation_difference(Vector(axis).normalized())
