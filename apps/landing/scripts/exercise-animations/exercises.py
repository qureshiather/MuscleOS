"""Choreography for each animated exercise, keyed by catalog id.

An exercise is only its movement: `setup(ctx)` builds equipment from equipment.py and returns
state; `pose(ctx, state, u)` places the body for movement phase u (0 = start, 1 = far end)
using the shared positions and grips in moves.py. The body, grip solver, look and timing are
shared, so improving any of them improves every exercise.

`concentric` says which direction is the lifting (working) phase, for the highlight pulse.
"""

import math

from mathutils import Vector

import mannequin as M
import scene as S
from anim import X, lerp, sgn, smootherstep
from equipment import place, qx, set_line
from registry import SPECS, barbell, cam, dumbbells, nothing, spec  # noqa: F401
from moves import (
    SIDES,
    STAND_Z,
    bar_grip,
    carry_dumbbells,
    elbows,
    feet,
    fk_hand_midpoint,
    grip_point,
    hang_bar,
    knees_out,
    lie_on_bench,
    shoulders,
    sit,
    stand,
)


# ---------------------------------------------------------------------------------------------
# Legs


@spec('squat', camera=cam((0, 0.05, 0.8), 50, 12, 3.7), setup=barbell)
def squat(ctx, st, u):
    ctx.root((0, 0.17 * u, STAND_Z - 0.43 * u))
    ctx.spine(flex=8 + 30 * u)
    ctx.bone('pelvis', (X, 14 * u))
    ctx.head(flex=-10 * u)
    feet(ctx, width=0.06, toe_out=12)
    knees_out(ctx, 0.35)
    # Bar on the upper back, behind the neck; hands just outside the shoulders.
    bar = ctx.world('neck', 'head') + ctx.body_dir((0, 1, 0)) * 0.075 - ctx.body_dir((0, 0, 1)) * 0.01
    place(st['bar'], bar, ctx.bone_delta('chest'))
    bar_grip(ctx, bar, 0.27, ctx.body_dir((1, 0, 0)))
    # Elbows pulled down toward the hips, so the upper arms follow the angle of the back.
    chest = ctx.bone_delta('chest')
    for s in SIDES:
        ctx.pole_world('arm.' + s, chest @ Vector((sgn(s) * 0.2, 0.55, -1)))


# Hanging bar line for the RDL: in front of the thighs, over the middle of the feet.
BAR_Y = -0.11


def _sagittal_hips(ankle, shin_lean, knee_bend, hinge):
    """Pelvis position (world) for planted feet: shins lean `shin_lean`° forward of vertical,
    knees bend `knee_bend`°, torso hinges `hinge`° forward. Lets a lift be choreographed in
    joint angles while the feet stay put."""
    shin = (M.joint('knee') - M.joint('ankle')).length
    thigh = (M.joint('hip') - M.joint('knee')).length
    a, t = math.radians(shin_lean), math.radians(knee_bend - shin_lean)
    knee = ankle + Vector((0, -shin * math.sin(a), shin * math.cos(a)))
    hip = knee + Vector((0, thigh * math.sin(t), thigh * math.cos(t)))
    drop = M.joint('pelvis').z - M.joint('hip').z  # hip joints sit below the pelvis centre
    h = math.radians(hinge)
    return hip + Vector((0, -drop * math.sin(h), drop * math.cos(h)))


DL_BAR_Y = -0.065  # over mid-foot; shins and thighs brush it


@spec('deadlift', camera=cam((0, 0, 0.75), 55, 10, 3.9), setup=barbell, concentric='out')
def deadlift(ctx, st, u):
    # Knees extend first (shins go vertical, clearing the bar's path), then the hips come
    # through to lockout. The hinge at the floor is solved so straight arms reach the bar.
    knees = smootherstep(min(u / 0.55, 1.0))
    hips = smootherstep(max((u - 0.2) / 0.8, 0.0))
    ankle = Vector((0, 0.06, 0.085))

    def pose_at(hinge):
        ctx.root(_sagittal_hips(ankle, lerp(13, 0, knees), lerp(92, 0, knees), hinge))
        ctx.bone('pelvis', (X, hinge))
        return sum((ctx.grip_hang(s, DL_BAR_Y, 0.24).z for s in SIDES)) / 2

    if 'h0' not in st:  # the hinge that puts the bar on the floor at the start
        lo, hi = 10.0, 85.0
        for _ in range(18):
            mid = (lo + hi) / 2
            lo, hi = (lo, mid) if pose_at(mid) < 0.225 else (mid, hi)
        st['h0'] = (lo + hi) / 2
    hinge = lerp(st['h0'], 0, hips)
    pose_at(hinge)
    ctx.spine(flex=-3 * u)
    ctx.head(flex=-18 * (1 - u))
    feet(ctx, width=0.02, toe_out=6, y=0.05)
    knees_out(ctx, 0.25)
    hang_bar(ctx, st['bar'], 0.24, DL_BAR_Y)


@spec('romanian-deadlift', camera=cam((0, 0, 0.8), 62, 10, 3.9), setup=barbell)
def romanian_deadlift(ctx, st, u):
    ctx.root((0, 0.27 * u, STAND_Z - 0.07 * u))
    ctx.bone('pelvis', (X, 78 * u))
    ctx.spine(flex=-2 * u)
    ctx.head(flex=-25 * u)
    feet(ctx, width=0.02, y=0.05)
    knees_out(ctx, 0.1)
    hang_bar(ctx, st['bar'], 0.24, BAR_Y)


@spec('leg-press', camera=cam((0, -0.3, 0.85), 70, 10, 3.3), setup=lambda ctx: ctx.eq.leg_press())
def leg_press(ctx, st, u):
    # Hips in the seat, back on the pad; the sled slides along the 45° rail.
    ctx.root((0, 0.12, 0.56), (-48, 0, 0))
    ctx.spine(flex=8)
    ctx.head(flex=20)
    rail = st['rail']
    up_rail = Vector((0, rail.z, -rail.y))  # perpendicular to the rail, toward the chest
    hip = (ctx.world('thigh.L', 'head') + ctx.world('thigh.R', 'head')) / 2
    # Extended to ~10° short of lockout, down to ~85° of knee bend.
    ankles = hip + rail * lerp(0.74, 0.44, u) + up_rail * 0.1
    sole = qx(-135)  # the rest foot's sole turned to face down the rail
    for s in SIDES:
        ctx.target('leg.' + s, ankles + Vector((sgn(s) * 0.14, 0, 0)), sole @ ctx.body.rest_quat('foot.' + s))
        ctx.pole_world('leg.' + s, up_rail + Vector((sgn(s) * 0.25, 0, 0)))
    place(st['platform'], ankles + rail * 0.08 + up_rail * 0.06, qx(45))
    for s in SIDES:
        ctx.grip(s, ctx.body_point((sgn(s) * 0.3, -0.16, 0.86)), (0, 0, 1))
    elbows(ctx, (0.6, 1, 0))


@spec('leg-curl', camera=cam((0, 0.0, 0.55), 75, 18, 4.1), setup=lambda ctx: ctx.eq.leg_curl(), concentric='out')
def leg_curl(ctx, st, u):
    ctx.root((0, -0.05, 0.645), (90, 0, 0))  # face down on the pad
    ctx.head(flex=-25)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=-4, knee=8 + 112 * u, ankle=-10)
        ctx.grip(s, (sgn(s) * 0.2, -0.72, 0.42), (-sgn(s), 0, 0))
    elbows(ctx, (0.8, 0, -1))
    knee = ctx.world('shin.L', 'head')
    place(st['lever'], (0, knee.y, knee.z), ctx.bone_delta('shin.L'))


@spec('leg-extension', camera=cam((0, -0.1, 0.7), 72, 10, 3.6), setup=lambda ctx: ctx.eq.leg_extension(),
      concentric='out')
def leg_extension(ctx, st, u):
    sit(ctx, 0.44, y=0.13, knee=lerp(92, 6, u), ankle=6, lean=-6)
    for s in SIDES:
        ctx.grip(s, ctx.body_point((sgn(s) * 0.27, -0.12, 0.8)), (0, -1, 0))
    elbows(ctx, (0.6, 1, 0))
    knee = ctx.world('shin.L', 'head')
    place(st['lever'], (0, knee.y, knee.z), ctx.bone_delta('shin.L'))


@spec('calf-raise', camera=cam((0, 0, 0.7), 78, 6, 3.6), setup=lambda ctx: ctx.eq.calf_raise(), concentric='out',
      timing=dict(hold_start=0.12, out=0.3, hold_end=0.16))
def calf_raise(ctx, st, u):
    ctx.root((0, 0.0, STAND_Z))
    for s in SIDES:
        ctx.leg_fk(s, ankle=lerp(-14, 32, u))  # stretched below the step → up on the toes
    # Keep the balls of the feet on the step edge.
    ball = ctx.attach_point('foot.L', (0.1, -0.1, 0.02))
    ctx.arm.location += Vector((ball.x, *st['step_edge'].yz)) - ball
    for s in SIDES:
        ctx.grip(s, ctx.attach_point('chest', (sgn(s) * 0.27, -0.12, 1.42)), (0, 0, 1))
    elbows(ctx, (0.6, 0.2, -1))
    ctx.follow(st['yoke'], 'chest', (0, 0.0, 1.5))


def _split_setup(ctx):
    ctx.eq.flat_bench((0, 0.62), length=0.5, height=0.45, yaw=90)
    return dumbbells(ctx)


@spec('bulgarian-split', camera=cam((0, 0.1, 0.75), 80, 10, 3.9), setup=_split_setup)
def bulgarian_split(ctx, st, u):
    ctx.root((0, 0.08 + 0.02 * u, 0.9 - 0.36 * u))
    ctx.spine(flex=6 + 8 * u)
    ctx.target('leg.L', (0.11, -0.42, 0.085))
    ctx.pole_dir('leg.L', (0.1, -1, 0.2))
    # Rear foot laces-down on the bench.
    ctx.target('leg.R', (-0.11, 0.6, 0.52), qx(115) @ ctx.body.rest_quat('foot.R'))
    ctx.pole_dir('leg.R', (0, -0.4, -1))
    for s in SIDES:
        ctx.arm_fk(s, flex=4, abd=5)
    carry_dumbbells(ctx, st['db'])


def _thrust_setup(ctx):
    ctx.eq.flat_bench((0, 0.25), length=1.2, height=0.42, yaw=90)
    return barbell(ctx, plate_radius=0.2)


@spec('hip-thrust', camera=cam((0, -0.3, 0.45), 72, 12, 4.0), setup=_thrust_setup, concentric='out')
def hip_thrust(ctx, st, u):
    # Upper back stays pinned on the bench edge while the hips rise.
    ctx.pin_root((0, 0.11, 1.3), (0, 0.04, 0.47), (lerp(-38, -92, u), 0, 0))
    ctx.spine(flex=lerp(10, -2, u))
    ctx.head(flex=lerp(30, 70, u))
    for s in SIDES:
        ctx.target('leg.' + s, (sgn(s) * 0.17, -0.74, 0.085))
    knees_out(ctx, 0.2)
    bar = ctx.attach_point('pelvis', (0, -0.18, 0.88))
    place(st['bar'], bar)
    bar_grip(ctx, bar, 0.36)
    elbows(ctx, (1, 0.3, 0.6))


@spec('plank', camera=cam((0, 0.05, 0.25), 65, 12, 3.8), setup=nothing, concentric='out',
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0), pulse_floor=0.82)
def plank(ctx, st, u):
    # A static hold: the camera orbits so the straight body line reads from two angles.
    ctx.root((0, 0.0, 0.255), (79.6, 0, 0))
    ctx.head(flex=-60)
    for s in SIDES:
        ctx.leg_fk(s, ankle=-5)
    down = ctx.arm.matrix_world.to_quaternion().inverted() @ Vector((0, 0, -1))
    for s in SIDES:
        sh = ctx.world('upperarm.' + s, 'head')
        # Elbows under the shoulders, forearms parallel on the floor.
        ctx.target('arm.' + s, (sh.x, sh.y - 0.25, 0.045))
        ctx.pole_dir('arm.' + s, down)
    S.place_camera(ctx.cam, (0, 0.05, 0.25), lerp(65, 105, u), 12, 3.8)


# ---------------------------------------------------------------------------------------------
# Push


def _bench_setup(ctx):
    ctx.eq.flat_bench((0, 0.33))
    return barbell(ctx)


@spec('bench-press', camera=cam((0, 0.25, 0.7), 72, 14, 3.6), setup=_bench_setup)
def bench_press(ctx, st, u):
    lie_on_bench(ctx)
    bar = lerp(Vector((0, 0.47, 1.085)), Vector((0, 0.36, 0.685)), smootherstep(u))
    place(st['bar'], bar)
    bar_grip(ctx, bar, 0.4)
    elbows(ctx, (0.9, 1, -0.4))


def _incline_setup(ctx):
    ctx.eq.incline_bench(55)
    return barbell(ctx)


@spec('incline-bench', camera=cam((0, 0.15, 0.85), 62, 14, 3.9), setup=_incline_setup)
def incline_bench(ctx, st, u):
    ctx.root((0, 0.06, 0.57), (-55, 0, 0))
    ctx.head(flex=20)
    for s in SIDES:
        ctx.target('leg.' + s, (sgn(s) * 0.24, -0.55, 0.085))
    knees_out(ctx, 0.35)
    sh = shoulders(ctx)
    top = Vector((0, sh.y, sh.z + 0.56))
    bar = lerp(top, ctx.attach_point('chest', (0, -0.14, 1.35)), smootherstep(u))
    place(st['bar'], bar)
    bar_grip(ctx, bar, 0.39)
    elbows(ctx, (0.9, 1, -0.3))


@spec('overhead-press', camera=cam((0, 0, 1.05), 40, 8, 4.0), setup=barbell, concentric='out')
def overhead_press(ctx, st, u):
    stand(ctx, width=0.04)
    t = smootherstep(u)
    # The head moves back as the bar passes the face, then through once it's overhead.
    ctx.head(flex=-14 * math.sin(math.pi * min(t / 0.7, 1.0)))
    ctx.spine(flex=-4)
    grip = 0.26
    # Lockout: arms straight, bar stacked over the shoulders (and mid-foot).
    sh = shoulders(ctx)
    reach = M.grip_reach() * 0.995
    lockout = Vector((0, sh.y + 0.01, sh.z + math.sqrt(reach**2 - (grip - abs(M.joint('shoulder').x)) ** 2)))
    rack = Vector((0, -0.145, 1.44))  # front rack, on the front delts
    y = lerp(rack.y, lockout.y, smootherstep((t - 0.4) / 0.6))  # straight up past the face first
    bar = Vector((0, y, lerp(rack.z, lockout.z, t)))
    place(st['bar'], bar)
    bar_grip(ctx, bar, grip)
    # Elbows start under and slightly in front of the bar and stay forward of the body as they
    # straighten; they never swing out to the sides.
    elbows(ctx, (lerp(0.35, 0.45, t), lerp(-1.0, -0.6, t), lerp(-0.6, -0.15, t)))


@spec('lateral-raise', camera=cam((0, 0, 1.05), 18, 10, 3.9), setup=dumbbells, concentric='out')
def lateral_raise(ctx, st, u):
    stand(ctx, width=0.02)
    ctx.spine(flex=6)
    for s in SIDES:
        # Raise in the scapular plane to just under shoulder height, elbows soft and leading.
        ctx.arm_fk(s, flex=lerp(10, 22, u), abd=lerp(8, 72, u), elbow=lerp(12, 22, u), rot=lerp(0, 18, u))
    carry_dumbbells(ctx, st['db'])


def _pushdown_setup(ctx):
    return {
        'pulley': ctx.eq.cable_column(0, -0.55, 2.2),
        'cable': ctx.eq.line('cable'),
        'ropeL': ctx.eq.line('ropeL', radius=0.012),
        'ropeR': ctx.eq.line('ropeR', radius=0.012),
    }


@spec('tricep-pushdown', camera=cam((0, -0.1, 1.15), 68, 8, 3.9), setup=_pushdown_setup, concentric='out')
def tricep_pushdown(ctx, st, u):
    stand(ctx, width=0.04, y=0.05)
    ctx.spine(flex=12)
    ctx.head(flex=-6)
    for s in SIDES:
        ctx.arm_fk(s, flex=-6, abd=-6, elbow=lerp(105, 4, u), rot=10)
    hands = [ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES]
    knot = (hands[0] + hands[1]) / 2 + Vector((0, 0, 0.1))
    set_line(st['cable'], st['pulley'], knot)
    set_line(st['ropeL'], knot, hands[0])
    set_line(st['ropeR'], knot, hands[1])


@spec('skull-crusher', camera=cam((0, 0.3, 0.75), 70, 14, 3.5), setup=_bench_setup)
def skull_crusher(ctx, st, u):
    lie_on_bench(ctx)
    for s in SIDES:
        # Upper arms stay near vertical and tucked; only the elbows bend, bar to the forehead.
        ctx.arm_fk(s, flex=lerp(82, 90, u), abd=-4, elbow=lerp(2, 100, u))
    bar = fk_hand_midpoint(ctx)
    place(st['bar'], bar)
    bar_grip(ctx, bar, 0.16)
    elbows(ctx, (0.12, -1, 0.15))  # elbows point at the ceiling (body-forward when lying)


# ---------------------------------------------------------------------------------------------
# Pull


@spec('barbell-row', camera=cam((0, 0, 0.8), 64, 10, 3.9), setup=barbell, concentric='out')
def barbell_row(ctx, st, u):
    ctx.root((0, 0.17, 0.87))
    ctx.bone('pelvis', (X, 48))
    ctx.spine(flex=-2)
    ctx.head(flex=-30)
    feet(ctx, width=0.04)
    knees_out(ctx, 0.2)
    hang = [ctx.grip_hang(s, ctx.world('upperarm.' + s, 'head').y + 0.02, 0.26) for s in SIDES]
    pulled = ctx.attach_point('spine', (0, -0.15, 1.12))
    bar = lerp((hang[0] + hang[1]) / 2, pulled, smootherstep(u))
    place(st['bar'], bar)
    bar_grip(ctx, bar, 0.26)
    elbows(ctx, (0.35, 0.6, 1))


@spec('pull-up', camera=cam((0, 0, 1.45), 32, 6, 4.6), setup=lambda ctx: {'bar': ctx.eq.pullup_bar()},
      concentric='out')
def pull_up(ctx, st, u):
    bar = st['bar']
    t = smootherstep(u)
    ctx.root((0, 0.03, lerp(bar.z - 1.06, bar.z - 0.62, t)))
    ctx.spine(flex=-8 * t)
    ctx.head(flex=-12 * t)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=12, knee=28, ankle=-25)
    bar_grip(ctx, bar, 0.31)
    # Elbows drive straight down to the sides, in line with the body.
    elbows(ctx, (0.7, -0.05, -1))


@spec('lat-pulldown', camera=cam((0, 0.0, 1.3), 205, 10, 4.2), setup=lambda ctx: ctx.eq.lat_pulldown(),
      concentric='out')
def lat_pulldown(ctx, st, u):
    # Seen from behind so the lats read. Lean back ~15°, pull the bar to the collarbones with
    # the elbows driving down and in; the cable runs straight up to the pulley.
    t = smootherstep(u)
    sit(ctx, 0.44, y=0.1, knee=95, hip_flex=90, hip_abd=6, lean=-10 - 6 * t)
    ctx.head(flex=-12 * t)
    sh = shoulders(ctx)
    top = Vector((0, st['pulley'].y, sh.z + 0.62))
    bar = lerp(top, ctx.attach_point('chest', (0, -0.15, 1.42)), t)
    place(st['bar'], bar)
    set_line(st['cable'], st['pulley'], bar)
    bar_grip(ctx, bar, 0.38)
    elbows(ctx, (0.9, 0.15, -1))


@spec('seated-row', camera=cam((0, -0.3, 0.7), 70, 12, 4.0), setup=lambda ctx: ctx.eq.row_station(),
      concentric='out')
def seated_row(ctx, st, u):
    t = smootherstep(u)
    ctx.root((0, 0.05, 0.5))
    ctx.bone('pelvis', (X, lerp(14, -2, t)))
    ctx.spine(flex=lerp(10, -6, t))
    ctx.head(flex=lerp(-10, 2, t))
    for s in SIDES:
        ctx.target('leg.' + s, (sgn(s) * 0.12, -0.74, 0.3), qx(-70) @ ctx.body.rest_quat('foot.' + s))
        ctx.pole_dir('leg.' + s, (sgn(s) * 0.15, -0.3, 1))
    sh = shoulders(ctx)
    h = lerp(Vector((0, sh.y - 0.6, sh.z - 0.12)), ctx.attach_point('spine', (0, -0.15, 1.09)), t)
    place(st['handle'], h)
    set_line(st['cable'], st['pulley'], h)
    for s in SIDES:
        ctx.grip(s, h + Vector((sgn(s) * 0.045, 0, 0)), (0, 0, 1))
    elbows(ctx, (0.25, 1, -0.2))


def _face_pull_setup(ctx):
    return {
        'anchor': ctx.eq.band_anchor(),
        'bands': [ctx.eq.line('bandL', accent=True, radius=0.008), ctx.eq.line('bandR', accent=True, radius=0.008)],
    }


@spec('face-pull', camera=cam((0, -0.4, 1.25), 50, 14, 4.0), setup=_face_pull_setup, concentric='out')
def face_pull(ctx, st, u):
    t = smootherstep(u)
    stand(ctx, width=0.05, y=0.05)
    ctx.spine(flex=-3)
    sh = shoulders(ctx)
    for s, band in zip(SIDES, st['bands']):
        reach = Vector((sgn(s) * 0.07, sh.y - 0.6, 1.56))
        ear = Vector((sgn(s) * 0.22, -0.06, 1.62))
        hand = lerp(reach, ear, t)
        ctx.grip(s, hand, (0, 0, 1))
        set_line(band, st['anchor'], hand)
    elbows(ctx, (1, 0.3, 0.35))


@spec('barbell-curl', camera=cam((0, 0, 1.05), 50, 8, 3.8), setup=lambda ctx: barbell(ctx, plates=1),
      concentric='out')
def barbell_curl(ctx, st, u):
    # Strict curl: upper arms stay pinned at the sides; only the elbows bend.
    stand(ctx)
    t = smootherstep(u)
    for s in SIDES:
        ctx.arm_fk(s, flex=lerp(0, 6, t), abd=3, elbow=lerp(2, 140, t), twist=90)  # palms forward
    bar = fk_hand_midpoint(ctx)
    place(st['bar'], bar)


@spec('hammer-curl', camera=cam((0, 0, 1.05), 40, 8, 3.8), setup=dumbbells, concentric='out')
def hammer_curl(ctx, st, u):
    stand(ctx)
    t = smootherstep(u)
    for s in SIDES:
        ctx.arm_fk(s, flex=lerp(2, 12, t), abd=3, elbow=lerp(4, 135, t))
    carry_dumbbells(ctx, st['db'])
