"""Squat and hinge families: variants of the squat, deadlift and Romanian deadlift built from
shared body positions and holds."""

import math

from mathutils import Vector

import mannequin as M
from anim import X, lerp, sgn, smootherstep
from equipment import along, place, set_line
from exercises import DL_BAR_Y, _sagittal_hips
from moves import (
    SIDES,
    STAND_Z,
    bar_grip,
    elbows,
    feet,
    hang_bar,
    hang_dumbbells,
    knees_out,
    shoulders,
)
from registry import barbell, cam, dumbbells, nothing, spec

# ---------------------------------------------------------------------------------------------
# Squat: one body motion, many ways to hold the load


def squat_body(ctx, u, depth=0.43, back=0.17, lean=30, width=0.06, toe_out=12, floor=0.0, y=0.0):
    """Hips sit down and back between the knees; torso leans `lean`° more at the bottom."""
    ctx.root((0, y + back * u, STAND_Z + floor - depth * u))
    ctx.spine(flex=8 * lean / 30 + lean * u)
    ctx.bone('pelvis', (X, 14 * u * lean / 30))
    ctx.head(flex=-10 * u)
    feet(ctx, width=width, toe_out=toe_out, y=y, floor=floor)
    knees_out(ctx, 0.35)


def chest_flex(lean, u):
    """How far the chest has tipped forward in squat_body (spine flex reaching the chest + pelvis)."""
    return 0.75 * (8 * lean / 30 + lean * u) + 14 * u * lean / 30


def back_rack(ctx, bar, grip=0.27):
    """Bar across the upper back, hands just outside the shoulders, elbows down toward the hips."""
    point = ctx.world('neck', 'head') + ctx.body_dir((0, 1, 0)) * 0.075 - ctx.body_dir((0, 0, 1)) * 0.01
    place(bar, point, ctx.bone_delta('chest'))
    bar_grip(ctx, point, grip, ctx.body_dir((1, 0, 0)))
    chest = ctx.bone_delta('chest')
    for s in SIDES:
        ctx.pole_world('arm.' + s, chest @ Vector((sgn(s) * 0.2, 0.55, -1)))
    return point


def front_rack(ctx, bar, grip=0.24, hands=True):
    """Bar resting on the front delts; elbows high and forward."""
    point = ctx.attach_point('chest', (0, -0.135, 1.43))
    place(bar, point, ctx.bone_delta('chest'))
    chest = ctx.bone_delta('chest')
    if hands:
        bar_grip(ctx, point, grip, chest @ Vector((1, 0, 0)))
        for s in SIDES:
            ctx.pole_world('arm.' + s, chest @ Vector((sgn(s) * 0.25, -1, 0.5)))
    return point


def arms_forward(ctx, lean, u, extra=0):
    """Arms reaching straight ahead, level with the floor (counterbalance in bodyweight squats)."""
    for s in SIDES:
        ctx.arm_fk(s, flex=90 - chest_flex(lean, u) + extra, abd=6)


def chest_hold(ctx, obj, kind='dumbbell'):
    """Goblet hold: a dumbbell upright or a kettlebell by the horns, hugged at the chest."""
    chest = ctx.bone_delta('chest')
    at = ctx.attach_point('chest', (0, -0.22, 1.3))
    up = chest @ Vector((0, 0, 1))
    if kind == 'dumbbell':
        place(obj, at, chest @ along((0, 0, 1)))
        top = at + up * 0.1
        for s in SIDES:
            ctx.grip(s, top + chest @ Vector((sgn(s) * 0.065, 0.0, 0.0)), up)
    else:
        # Held by the horns, bell down against the chest.
        place(obj, at + up * 0.12, chest)
        for s in SIDES:
            ctx.grip(s, at + up * 0.07 + chest @ Vector((sgn(s) * 0.06, 0, 0)), up)
    for s in SIDES:
        ctx.pole_world('arm.' + s, chest @ Vector((sgn(s) * 0.25, 0.1, -1)))


def jump(ctx, height=0.2):
    """Airborne offset for the launch phase of a jump (loop time 0.72–0.9)."""
    t = getattr(ctx, 't', 0.0)
    if 0.72 < t < 0.9:
        return height * math.sin(math.pi * (t - 0.72) / 0.18)
    return 0.0


def squat_spec(id_, setup, hold, camera=None, depth=0.43, back=0.17, lean=30, width=0.06, toe_out=12,
               floor=0.0, timing=None, pre=None, after=None):
    camera = camera or cam((0, 0.05, 0.8 + floor), 50, 12, 3.7)

    def pose(ctx, st, u):
        if pre:
            pre(ctx, st, u)
        squat_body(ctx, u, depth, back, lean, width, toe_out, floor)
        hold(ctx, st, u, lean)
        if after:
            after(ctx, st, u)

    spec(id_, camera=camera, setup=setup, timing=timing or {})(pose)


def _with(*builders):
    def setup(ctx):
        st = {}
        for b in builders:
            st.update(b(ctx) or {})
        return st

    return setup


def _back(ctx, st, u, lean):
    back_rack(ctx, st['bar'])


def _front(ctx, st, u, lean):
    front_rack(ctx, st['bar'])


def _zombie(ctx, st, u, lean):
    front_rack(ctx, st['bar'], hands=False)
    arms_forward(ctx, lean, u)


def _goblet_db(ctx, st, u, lean):
    chest_hold(ctx, st['db'], 'dumbbell')


def _goblet_kb(ctx, st, u, lean):
    chest_hold(ctx, st['kb'], 'kettlebell')


def _bodyweight(ctx, st, u, lean):
    arms_forward(ctx, lean, u * 1.0)


def _dumbbells_sides(ctx, st, u, lean):
    hang_dumbbells(ctx, st['db'], x=0.25)


def _sumo_db(ctx, st, u, lean):
    # One dumbbell hanging upright between the legs, both hands on the top bell.
    sh = shoulders(ctx)
    for s in SIDES:
        p = ctx.grip_hang(s, sh.y + 0.02, 0.05)
        ctx.grip(s, p, Vector((0, 0, 1)))
    hands = (ctx.body.targets['arm.L'].location + ctx.body.targets['arm.R'].location) / 2
    grip = ctx.grip_hang('L', sh.y + 0.02, 0.05)
    place(st['db'], grip - Vector((0, 0, 0.12)), along((0, 0, 1)))
    del hands
    elbows(ctx, (0.4, 1, 0))


def _zercher(ctx, st, u, lean):
    for s in SIDES:
        ctx.arm_fk(s, flex=55 - chest_flex(lean, u) * 0.6, abd=12, elbow=128, twist=60)
    crooks = [ctx.world('forearm.' + s, 'head') for s in SIDES]
    mid = (crooks[0] + crooks[1]) / 2
    place(st['bar'], mid + ctx.body_dir((0, -0.4, 1)).normalized() * 0.03, ctx.bone_delta('chest'))


def _safety_bar(ctx, st, u, lean):
    chest = ctx.bone_delta('chest')
    back_point = ctx.world('neck', 'head') + ctx.body_dir((0, 1, 0)) * 0.075 - ctx.body_dir((0, 0, 1)) * 0.01
    place(st['bar'], back_point, chest)
    for s in SIDES:
        ctx.grip(s, ctx.attach_point('chest', (sgn(s) * 0.17, -0.3, 1.3)), chest @ Vector((0, 0, 1)))
        ctx.pole_world('arm.' + s, chest @ Vector((sgn(s) * 0.6, 0.2, -1)))
    for s, handle in zip(SIDES, st['handles']):
        set_line(handle, back_point + chest @ Vector((sgn(s) * 0.22, 0, 0)), ctx.attach_point('chest', (sgn(s) * 0.17, -0.3, 1.3)))


def _landmine_hold(ctx, st, u, lean):
    chest = ctx.bone_delta('chest')
    end = ctx.attach_point('chest', (0, -0.24, 1.27))
    for s in SIDES:
        ctx.grip(s, end + chest @ Vector((sgn(s) * 0.045, 0, 0)), chest @ Vector((0, 0, 1)))
        ctx.pole_world('arm.' + s, chest @ Vector((sgn(s) * 0.3, 0.1, -1)))
    set_line(st['bar'], st['anchor'], end + chest @ Vector((0, 0, 0.06)))


def _hack_behind(ctx, st, u, lean):
    sh = shoulders(ctx)
    hang_bar(ctx, st['bar'], 0.26, sh.y + 0.11)
    for s in SIDES:
        ctx.pole_dir('arm.' + s, (sgn(s) * 0.3, 1, 0))


def _belt(ctx, st, u, lean):
    for s in SIDES:
        ctx.grip(s, (sgn(s) * 0.32, -0.45, 1.0), (0, -1, 0))
    elbows(ctx, (0.3, 1, -0.5))
    hips = ctx.attach_point('pelvis', (0, -0.02, 0.9))
    set_line(st['strap'], (0, -0.02, 0.06), hips)


def _smith_back(ctx, st, u, lean):
    back_rack(ctx, st['bar'])


def _jump_pre(ctx, st, u):
    st['air'] = jump(ctx, 0.18)


def _jump_after(ctx, st, u):
    h = st.get('air', 0.0)
    if h > 0:
        ctx.arm.location.z += h
        for s in SIDES:
            t = ctx.body.targets['leg.' + s]
            t.location.z += h * 0.7
        for s in SIDES:
            ctx.arm_fk(s, flex=-20, abd=8)


def _box_seat(ctx):
    ctx.eq.plyo_box((0, 0.36), height=0.42, size=(0.42, 0.36))
    return {}


def _chair(ctx):
    ctx.eq.flat_bench((0, 0.36), length=0.42, height=0.45, yaw=90)
    return {}


def _smith(ctx):
    return {'bar': ctx.eq.smith_machine(bar_y=0.07)}


def _landmine_setup(ctx):
    anchor, line = ctx.eq.landmine((0, -1.45, 0.04))
    return {'anchor': anchor, 'bar': line}


def _safety_setup(ctx):
    st = barbell(ctx)
    st['handles'] = [ctx.eq.line('handleL', radius=0.014), ctx.eq.line('handleR', radius=0.014)]
    return st


def _belt_setup(ctx):
    ctx.eq.plyo_box((0.42, 0), height=0.06, size=(0.3, 0.5), name='platformL')
    ctx.eq.plyo_box((-0.42, 0), height=0.06, size=(0.3, 0.5), name='platformR')
    ctx.eq.group('belt_rails', [
        ctx.eq.frame('railL', (0.05, 0.05, 1.0), (0.32, -0.45, 0.5)),
        ctx.eq.frame('railR', (0.05, 0.05, 1.0), (-0.32, -0.45, 0.5)),
    ])
    return {'strap': ctx.eq.line('belt', accent=True, radius=0.012)}


def _kb(ctx):
    return {'kb': ctx.eq.kettlebell()}


def _one_db(ctx):
    return {'db': ctx.eq.dumbbell('db')}


def _hack_machine(ctx):
    # Rails and footplate stay put; the sled (back pad, shoulder pads, handles) rides with the back.
    ctx.eq.group('hack_frame', [
        ctx.eq.frame('railL', (0.06, 0.06, 2.0), (0.3, 0.42, 1.0), (math.radians(-22), 0, 0)),
        ctx.eq.frame('railR', (0.06, 0.06, 2.0), (-0.3, 0.42, 1.0), (math.radians(-22), 0, 0)),
        ctx.eq.frame('platform', (0.7, 0.55, 0.06), (0, -0.02, 0.03)),
    ])
    sled = ctx.eq.group('sled', [
        ctx.eq.pad('back', (0.4, 0.08, 0.75), (0, 0.19, 1.15)),
        ctx.eq.pad('shoulderL', (0.12, 0.2, 0.07), (0.14, 0.07, 1.5)),
        ctx.eq.pad('shoulderR', (0.12, 0.2, 0.07), (-0.14, 0.07, 1.5)),
        ctx.eq.cyl('handleL', 0.016, 0.14, (0.3, -0.05, 1.42), (math.pi / 2, 0, 0), ctx.eq.m_metal, 16),
        ctx.eq.cyl('handleR', 0.016, 0.14, (-0.3, -0.05, 1.42), (math.pi / 2, 0, 0), ctx.eq.m_metal, 16),
    ])
    return {'sled': sled}


def _machine_hold(ctx, st, u, lean):
    ctx.follow(st['sled'], 'chest', (0, 0, 0))
    for s in SIDES:
        ctx.grip(s, ctx.attach_point('chest', (sgn(s) * 0.3, -0.05, 1.42)), ctx.bone_delta('chest') @ Vector((0, -1, 0)))
    elbows(ctx, (0.6, 0.3, -1))


squat_spec('front-squat', barbell, _front, lean=14, back=0.1)
squat_spec('box-squat', _with(barbell, _box_seat), _back, depth=0.4, back=0.24, lean=34, width=0.12)
squat_spec('pause-squat', barbell, _back, timing=dict(hold_start=0.08, out=0.3, hold_end=0.24))
squat_spec('pin-squat', _with(barbell, lambda ctx: ctx.eq.rack_pins(1.0, y=0.12) or {}), _back,
           timing=dict(hold_start=0.08, out=0.3, hold_end=0.2))
squat_spec('safety-bar-squat', _safety_setup, _safety_bar, lean=24)
squat_spec('zombie-squat', barbell, _zombie, lean=12, back=0.1)
squat_spec('zercher-squat', barbell, _zercher, lean=18, back=0.12)
squat_spec('smith-machine-squat', _smith, _smith_back, lean=20, back=0.12)
squat_spec('smith-machine-front-squat', _smith, _front, lean=12, back=0.08)
squat_spec('landmine-squat', _landmine_setup, _landmine_hold, lean=16, back=0.12,
           camera=cam((0, -0.4, 0.8), 60, 12, 4.0))
squat_spec('goblet-squat', _one_db, _goblet_db, lean=16, back=0.12, width=0.1, toe_out=18)
squat_spec('kettlebell-front-squat', _kb, _goblet_kb, lean=16, back=0.12, width=0.08, toe_out=15)
squat_spec('dumbbell-squat', dumbbells, _dumbbells_sides, lean=22, back=0.14, depth=0.4)
squat_spec('sumo-squat', _one_db, _sumo_db, lean=10, back=0.06, width=0.24, toe_out=35, depth=0.36,
           camera=cam((0, 0, 0.8), 25, 10, 3.7))
squat_spec('air-squat', nothing, _bodyweight, lean=26, depth=0.43)
squat_spec('half-body-weight-squats', nothing, _bodyweight, lean=16, depth=0.24, back=0.1)
squat_spec('chair-squats', _chair, _bodyweight, lean=26, depth=0.42, back=0.2, width=0.1)
squat_spec('jump-squat', nothing, _bodyweight, lean=26, depth=0.4, pre=_jump_pre, after=_jump_after,
           timing=dict(hold_start=0.04, out=0.4, hold_end=0.06))
squat_spec('barbell-hack-squat', barbell, _hack_behind, lean=26, depth=0.4, back=0.14,
           camera=cam((0, 0, 0.75), 120, 10, 3.8))
squat_spec('belt-squats', _belt_setup, _belt, lean=18, depth=0.42, width=0.32, toe_out=18,
           camera=cam((0, -0.1, 0.8), 40, 12, 3.8))
squat_spec('hack-squat', _hack_machine, _machine_hold, lean=-12, depth=0.42, back=0.22, width=0.06,
           camera=cam((0, 0.1, 0.9), 72, 10, 3.8))
squat_spec('pendulum-squat', _hack_machine, _machine_hold, lean=-6, depth=0.45, back=0.16, width=0.06,
           camera=cam((0, 0.1, 0.9), 72, 10, 3.8))


# ---------------------------------------------------------------------------------------------
# Deadlift family: planted feet, hips placed from joint angles so the bar clears the legs


def deadlift_spec(id_, setup=barbell, grip=0.24, width=0.02, toe_out=6, bar_y=DL_BAR_Y, start_z=0.225,
                  top_z=None, floor=0.0, knee0=92, shin0=13, neutral=False, implement='bar', camera=None,
                  timing=None, feet_y=None, bar_lift=0.0):
    camera = camera or cam((0, 0, 0.75 + floor), 55, 10, 3.9)

    def pose(ctx, st, u):
        knees = smootherstep(min(u / 0.55, 1.0))
        hips = smootherstep(max((u - 0.2) / 0.8, 0.0))
        fy = bar_y + 0.115 if feet_y is None else feet_y
        ankle = Vector((0, fy + 0.01, 0.085 + floor))

        def grips_z():
            return sum(ctx.grip_hang(s, bar_y, grip).z for s in SIDES) / 2

        def pose_at(hinge):
            ctx.root(_sagittal_hips(ankle, lerp(shin0, 0, knees), lerp(knee0, 0, knees), hinge))
            ctx.bone('pelvis', (X, hinge))
            return grips_z()

        if 'h0' not in st:  # the hinge that puts the hands on the bar at the start height
            lo, hi = 0.0, 88.0
            for _ in range(18):
                mid = (lo + hi) / 2
                lo, hi = (lo, mid) if pose_at(mid) < start_z else (mid, hi)
            st['h0'] = (lo + hi) / 2
        pose_at(lerp(st['h0'], 0, hips))
        ctx.spine(flex=-3 * u)
        ctx.head(flex=-18 * (1 - u))
        feet(ctx, width=width, toe_out=toe_out, y=fy, floor=floor)
        knees_out(ctx, 0.25 + width)
        z = grips_z()
        if implement == 'bar':
            place(st['bar'], (0, bar_y, z - bar_lift))
            if implement == 'bar':
                bar_grip(ctx, (0, bar_y, z), grip)
        else:
            for s, db in zip(SIDES, st['db']):
                p = Vector((sgn(s) * grip, bar_y, z))
                ctx.grip(s, p, (0, -1, 0))
                place(db, p, along((0, -1, 0)))
        elbows(ctx, (0.3, 1, 0))

    spec(id_, camera=camera, setup=setup, concentric='out', timing=timing or {})(pose)


def _trap(handle_height):
    def setup(ctx):
        return {'bar': ctx.eq.trap_bar(handle_height=handle_height)}

    return setup


def _trap_pose_spec(id_, handle_height):
    # Hands on the handles beside the hips; the hex frame sits around the feet.
    deadlift_spec(id_, setup=_trap(handle_height), grip=0.29, bar_y=0.0, start_z=0.225 + handle_height,
                  knee0=100, shin0=12, feet_y=-0.02, bar_lift=handle_height,
                  camera=cam((0, 0, 0.75), 50, 14, 3.9))


deadlift_spec('sumo-deadlift', grip=0.17, width=0.24, toe_out=35, knee0=88, shin0=4,
              camera=cam((0, 0, 0.75), 28, 12, 3.9))
deadlift_spec('deficit-deadlift', setup=_with(barbell, lambda ctx: ctx.eq.plyo_box((0, 0.06), height=0.05, size=(0.6, 0.5)) or {}),
              floor=0.05, knee0=100)
deadlift_spec('pause-deadlift', timing=dict(hold_start=0.1, out=0.42, hold_end=0.08))
deadlift_spec('rack-pull', setup=_with(barbell, lambda ctx: ctx.eq.rack_pins(0.45, y=DL_BAR_Y) or {}),
              start_z=0.47, knee0=28, shin0=4)
deadlift_spec('snatch-grip-deadlift', grip=0.42, knee0=100, shin0=14)
deadlift_spec('fat-bar-deadlift')
deadlift_spec('smith-machine-deadlift', setup=lambda ctx: {'bar': ctx.eq.smith_machine(bar_y=DL_BAR_Y)})
deadlift_spec('dumbbell-deadlift', setup=dumbbells, grip=0.21, bar_y=0.0, start_z=0.14, knee0=100,
              shin0=12, implement='dumbbells')
_trap_pose_spec('trap-bar-deadlift-with-low-handles', 0.0)
_trap_pose_spec('trap-bar-deadlift-with-high-handles', 0.1)


def rdl_spec(id_, setup=barbell, hinge=78, knee=0.07, back=0.27, implement='bar', bar_y=-0.11, camera=None,
             floor=0.0, rack=False):
    camera = camera or cam((0, 0, 0.8 + floor), 62, 10, 3.9)

    def pose(ctx, st, u):
        ctx.root((0, back * u + 0.0, STAND_Z + floor - knee * u))
        ctx.bone('pelvis', (X, hinge * u))
        ctx.spine(flex=-2 * u)
        ctx.head(flex=-25 * u)
        feet(ctx, width=0.02, y=0.05, floor=floor)
        knees_out(ctx, 0.1)
        if implement == 'bar':
            hang_bar(ctx, st['bar'], 0.24, bar_y)
        elif implement == 'back':
            back_rack(ctx, st['bar'])
        else:
            hang_dumbbells(ctx, st['db'], x=0.2, y=None, neutral=False)

    spec(id_, camera=camera, setup=setup)(pose)


rdl_spec('stiff-legged-deadlift', hinge=88, knee=0.04, back=0.3)
rdl_spec('dumbbell-romanian-deadlift', setup=dumbbells, implement='dumbbells')
rdl_spec('smith-machine-romanian-deadlift', setup=lambda ctx: {'bar': ctx.eq.smith_machine(bar_y=-0.11)})
rdl_spec('good-morning', hinge=80, knee=0.06, back=0.22, implement='back')


def single_leg_rdl(id_, implement):
    def setup(ctx):
        return {'w': ctx.eq.kettlebell() if implement == 'kb' else ctx.eq.dumbbell('db')}

    def pose(ctx, st, u):
        h = 82 * u
        ctx.root((0.09 * u, 0.05 + 0.22 * u, STAND_Z - 0.04 * u))
        ctx.bone('pelvis', (X, h))
        ctx.head(flex=-25 * u)
        ctx.target('leg.L', (0.1, 0.06, 0.085), ctx.body.rest_quat('foot.L'))
        ctx.pole_dir('leg.L', (0.1, -1, 0))
        ctx.leg_fk('R', hip_flex=0, knee=6 + 10 * (1 - u), ankle=-10)  # floats up behind, in line with the torso
        sh = ctx.world('upperarm.R', 'head')
        p = ctx.grip_hang('R', sh.y, abs(sh.x) - 0.02)
        if implement == 'kb':
            ctx.grip('R', p, (-1, 0, 0))
            place(st['w'], p)
        else:
            ctx.grip('R', p, (0, -1, 0))
            place(st['w'], p, along((0, -1, 0)))
        ctx.arm_fk('L', abd=10 + 20 * u)
        elbows(ctx, (0.3, 1, 0))

    spec(id_, camera=cam((0, 0.1, 0.8), 75, 10, 3.9), setup=setup)(pose)


single_leg_rdl('single-leg-romanian-deadlift', 'db')
single_leg_rdl('single-leg-deadlift-with-kettlebell', 'kb')


def _jefferson_setup(ctx):
    ctx.eq.plyo_box((0, 0.02), height=0.4, size=(0.5, 0.4))
    return {'db': ctx.eq.dumbbell('db')}


@spec('jefferson-curl', camera=cam((0, 0, 0.9), 75, 10, 4.1), setup=_jefferson_setup)
def jefferson_curl(ctx, st, u):
    # Roll down one vertebra at a time with soft knees, a dumbbell hanging from both hands.
    t = smootherstep(u)
    ctx.root((0, 0.06 * t, STAND_Z + 0.4 - 0.03 * t))
    ctx.bone('pelvis', (X, 40 * t))
    ctx.spine(flex=95 * t, split=(0.35, 0.4, 0.25))
    ctx.head(flex=30 * t)
    feet(ctx, width=0.0, floor=0.4)
    knees_out(ctx, 0.1)
    sh = shoulders(ctx)
    for s in SIDES:
        ctx.grip(s, ctx.grip_hang(s, sh.y, 0.05), (0, 0, 1))
    p = ctx.grip_hang('L', sh.y, 0.05)
    place(st['db'], Vector((0, p.y, p.z - 0.11)), along((0, 0, 1)))
    elbows(ctx, (0.3, 1, 0))
