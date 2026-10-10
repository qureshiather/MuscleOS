"""Glutes, hamstrings and lower-leg families: bridges and hip thrusts, quadruped and side-lying
work, kickbacks, abduction and adduction, hinges over benches, Nordics, leg-machine variants,
calf raises and tibialis work."""

import math

from mathutils import Quaternion, Vector

import mannequin as M
from anim import X, lerp, sgn, smootherstep
from catalog_legs import back_rack
from equipment import along, place, qx, qz, set_line
from moves import SIDES, STAND_Z, bar_grip, elbows, feet, grip_point, knees_out, sit, stand
from registry import cam, nothing, spec


def wave(ctx, cycles=1.0):
    return math.sin(2 * math.pi * cycles * getattr(ctx, 't', 0.0))


ALTERNATE = dict(hold_start=0.0, out=0.5, hold_end=0.0)

# ---------------------------------------------------------------------------------------------
# Bridges and hip thrusts


def bridge_pose(ctx, h, feet_x=0.13, feet_y=-0.3, frog=False, shoulders_on=(0, 0.55, 0.1), lift=30):
    """Shoulders on the floor, feet planted; the hips rise `h` (0–1) of the way to a straight line."""
    ctx.pin_root(Vector((0, 0.0, M.joint('shoulder').z)), Vector(shoulders_on), (-90 - lift * h, 0, 0))
    ctx.head(flex=20)
    for s in SIDES:
        if frog:
            # Soles pressed together near the midline, knees falling out wide.
            soles_in = Quaternion((0, 1, 0), math.radians(sgn(s) * 80))
            ctx.target('leg.' + s, (sgn(s) * 0.06, feet_y - 0.04, 0.07), soles_in @ ctx.body.rest_quat('foot.' + s))
            ctx.pole_world('leg.' + s, (sgn(s) * 1, 0, 0.15))
        else:
            ctx.target('leg.' + s, (sgn(s) * feet_x, feet_y, 0.085))
            ctx.pole_world('leg.' + s, (sgn(s) * 0.2, -0.3, 1))
    for s in SIDES:
        ctx.arm_fk(s, abd=14, rot=-70)


def bridge_spec(id_, one_leg=False, frog=False, weight=False):
    def setup(ctx):
        return {'w': ctx.eq.dumbbell('db')} if weight else {}

    def pose(ctx, st, u):
        t = smootherstep(u)
        bridge_pose(ctx, t, frog=frog)
        if one_leg:
            ctx.leg_fk('L', hip_flex=lerp(60, 25, t), knee=10, ankle=-15)
        if weight:
            hips = ctx.attach_point('pelvis', (0, -0.15, 0.92))
            place(st['w'], hips, along((1, 0, 0)))
            for s in SIDES:
                ctx.grip(s, hips + Vector((sgn(s) * 0.12, 0, 0)), (-sgn(s), 0, 0))
            elbows(ctx, (0.6, 0.3, 0.6))

    camera = cam((0, 0.1, 0.2), 0, 45, 3.4) if frog else cam((0, 0.1, 0.3), 70, 14, 3.4)
    spec(id_, camera=camera, setup=setup, concentric='out')(pose)


bridge_spec('glute-bridge')
bridge_spec('one-legged-glute-bridge', one_leg=True)
bridge_spec('frog-pumps', frog=True)
bridge_spec('dumbbell-frog-pumps', frog=True, weight=True)


# The bench pad's front edge is at y = 0.11; the shoulder blades rest on it, so the pinned back
# point sits behind the edge and the feet keep the same distance from it.
THRUST_BACK_Y = 0.16


def thrust_spec(id_, implement='bar', band=False, smith=False, one_leg=False, machine=False):
    def setup(ctx):
        ctx.eq.flat_bench((0, 0.25), length=1.2, height=0.42, yaw=90)
        st = {}
        if smith:
            st['bar'] = ctx.eq.smith_machine(bar_y=-0.45)
        elif implement == 'bar':
            st['bar'] = ctx.eq.barbell(plate_radius=0.2)
        elif implement == 'db':
            st['w'] = ctx.eq.dumbbell('db')
        if band:
            st['band'] = ctx.eq.line('band', accent=True, radius=0.012)
        if machine:
            st['pad'] = ctx.eq.group('hip_pad', [ctx.eq.pad('hp', (0.5, 0.14, 0.08), (0, 0, 0))])
            ctx.eq.group('thrust_frame', [ctx.eq.frame('armL', (0.06, 0.06, 0.5), (0.36, -0.4, 0.25)),
                                          ctx.eq.frame('armR', (0.06, 0.06, 0.5), (-0.36, -0.4, 0.25))])
        return st

    def pose(ctx, st, u):
        ctx.pin_root((0, 0.11, 1.3), (0, THRUST_BACK_Y, 0.47), (lerp(-38, -92, u), 0, 0))
        ctx.spine(flex=lerp(10, -2, u))
        ctx.head(flex=lerp(30, 70, u))
        for s in SIDES:
            ctx.target('leg.' + s, (sgn(s) * 0.17, THRUST_BACK_Y - 0.78, 0.085))
        knees_out(ctx, 0.2)
        if one_leg:
            # The free leg stays up all rep: hip flexion is relative to the tipped pelvis, so it
            # has to start high for the foot to stay clear of the floor at the bottom.
            ctx.leg_fk('L', hip_flex=lerp(125, 90, u), knee=lerp(100, 90, u), ankle=-10)
        hips = ctx.attach_point('pelvis', (0, -0.18, 0.88))
        if 'bar' in st:
            place(st['bar'], hips)
            bar_grip(ctx, hips, 0.36)
        elif 'w' in st:
            place(st['w'], hips, along((1, 0, 0)))
            for s in SIDES:
                ctx.grip(s, hips + Vector((sgn(s) * 0.12, 0, 0)), (-sgn(s), 0, 0))
        elif 'pad' in st:
            place(st['pad'], hips)
            for s in SIDES:
                ctx.grip(s, (sgn(s) * 0.36, -0.4, 0.5), (0, 0, 1))
        elbows(ctx, (1, 0.3, 0.6))
        if band:
            knees = [ctx.world('shin.' + s, 'head') for s in SIDES]
            set_line(st['band'], knees[0] + Vector((0.05, 0, 0)), knees[1] - Vector((0.05, 0, 0)))

    spec(id_, camera=cam((0, -0.3, 0.45), 72, 12, 4.0), setup=setup, concentric='out')(pose)


thrust_spec('hip-thrust-with-band-around-knees', band=True)
thrust_spec('smith-machine-hip-thrust', smith=True)
thrust_spec('one-legged-hip-thrust', implement='db', one_leg=True)
thrust_spec('hip-thrust-machine', implement='none', machine=True)


# ---------------------------------------------------------------------------------------------
# Quadruped and side-lying


def quadruped(ctx):
    """Hands under the shoulders, knees under the hips."""
    ctx.root((0, 0.12, 0.56), (88, 0, 0))
    ctx.head(flex=-60)
    for s in SIDES:
        ctx.target('leg.' + s, (sgn(s) * 0.11, 0.55, 0.06), qx(-80) @ ctx.body.rest_quat('foot.' + s))
        ctx.pole_world('leg.' + s, (0, -0.2, -1))
        sh = ctx.world('upperarm.' + s, 'head')
        ctx.target('arm.' + s, (sh.x, sh.y - 0.02, 0.08))
        ctx.pole_world('arm.' + s, (0, 1, 0))


@spec('donkey-kicks', camera=cam((0, 0.1, 0.5), 80, 10, 3.6), setup=nothing, concentric='out')
def donkey_kicks(ctx, st, u):
    quadruped(ctx)
    t = smootherstep(u)
    ctx.leg_fk('R', hip_flex=lerp(90, -10, t), knee=90, ankle=10)


@spec('fire-hydrants', camera=cam((0, 0.2, 0.5), 160, 14, 3.6), setup=nothing, concentric='out')
def fire_hydrants(ctx, st, u):
    quadruped(ctx)
    t = smootherstep(u)
    ctx.leg_fk('R', hip_flex=90, hip_abd=lerp(0, 55, t), knee=90, ankle=10, hip_rot=20 * t)


@spec('clamshells', camera=cam((0, 0.0, 0.2), -15, 25, 2.8), setup=nothing, concentric='out')
def clamshells(ctx, st, u):
    # Lying on the left side, hips and knees bent; the top knee opens like a clamshell.
    t = smootherstep(u)
    ctx.root((0, 0.0, 0.16), (0, 90, 0))  # on the left side: the right knee is on top
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=45, knee=90, hip_abd=(lerp(0, 20, t) if s == 'R' else 0), hip_rot=(40 * t if s == 'R' else 0))
    ctx.arm_fk('L', flex=170, elbow=100)
    ctx.arm_fk('R', flex=20, abd=-10, elbow=40)
    ctx.head(flex=0)


def _band_ankles(ctx):
    return {'band': ctx.eq.line('band', accent=True, radius=0.012)}


SUPPORT = Vector((0.45, -0.1, 1.05))  # top of a post on the figure's left, held for balance


def _band_ankles_post(ctx):
    ctx.eq.group('support', [ctx.eq.frame('post', (0.05, 0.05, 1.1), (SUPPORT.x, SUPPORT.y, 0.55))])
    return _band_ankles(ctx)


@spec('banded-side-kick', camera=cam((0, 0, 0.8), 5, 8, 3.8), setup=_band_ankles_post, concentric='out')
def banded_side_kick(ctx, st, u):
    stand(ctx, width=0.05)
    t = smootherstep(u)
    ctx.leg_fk('R', hip_abd=lerp(0, 35, t), ankle=0)
    ctx.spine(side=6 * t)
    ctx.arm_fk('R', abd=10)
    ctx.grip('L', SUPPORT, (0, 0, 1))
    ankles = [ctx.world('foot.' + s, 'head') for s in SIDES]
    set_line(st['band'], ankles[0] + Vector((0, 0, 0.04)), ankles[1] + Vector((0, 0, 0.04)))


@spec('standing-hip-abduction-against-band', camera=cam((0, 0, 0.8), 5, 8, 3.8), setup=_band_ankles_post,
      concentric='out')
def standing_hip_abduction_band(ctx, st, u):
    stand(ctx, width=0.04)
    t = smootherstep(u)
    ctx.leg_fk('R', hip_abd=lerp(0, 40, t), ankle=0)
    ctx.arm_fk('R', abd=10)
    ctx.grip('L', SUPPORT, (0, 0, 1))
    ankles = [ctx.world('foot.' + s, 'head') for s in SIDES]
    set_line(st['band'], ankles[0] + Vector((0, 0, 0.04)), ankles[1] + Vector((0, 0, 0.04)))


LATERAL_STEP = 0.25


@spec('lateral-walk-with-band', camera=cam((0.12, 0, 0.75), 15, 8, 3.8), setup=_band_ankles,
      timing=dict(hold_start=0.0, out=1.0, hold_end=0.0))
def lateral_walk(ctx, st, u):
    # Quarter squat, band at the ankles. Two steps to the left (the left foot steps out, the right
    # follows), then two back to the right, so the loop ends where it began. Each foot stays
    # planted except while it's lifted.
    q = min(int(ctx.t * 4), 3)
    s_ = smootherstep(ctx.t * 4 - q)
    d = LATERAL_STEP
    # Foot positions (L, R) at the start of each quarter, and which foot moves in it.
    keys = [(0.17, -0.17), (0.17 + d, -0.17), (0.17 + d, -0.17 + d), (0.17 + d, -0.17), (0.17, -0.17)]
    mover = ('L', 'R', 'R', 'L')[q]
    a, b = keys[q], keys[q + 1]
    pos = {'L': lerp(a[0], b[0], s_), 'R': lerp(a[1], b[1], s_)}
    shift = (pos['L'] + pos['R']) / 2
    ctx.root((shift, 0.08, STAND_Z - 0.12))
    ctx.spine(flex=18)
    for s in SIDES:
        lift = 0.08 * math.sin(math.pi * s_) if s == mover else 0.0
        ctx.target('leg.' + s, (pos[s], 0.01, 0.085 + lift))
    knees_out(ctx, 0.4)
    for s in SIDES:
        ctx.arm_fk(s, flex=30, elbow=80)
    ankles = [ctx.world('foot.' + s, 'head') for s in SIDES]
    set_line(st['band'], ankles[0] + Vector((0, 0, 0.04)), ankles[1] + Vector((0, 0, 0.04)))


def _seat_band(ctx):
    ctx.eq.group('seat', [ctx.eq.pad('seat_pad', (0.42, 0.42, 0.45), (0, 0.12, 0.225))])
    return _band_ankles(ctx)


@spec('hip-abduction-against-band', camera=cam((0, 0.0, 0.7), 10, 12, 3.4), setup=_seat_band, concentric='out')
def seated_abduction_band(ctx, st, u):
    # On a box, band above the knees; the feet stay together on the floor while the knees press out.
    sit(ctx, 0.45, y=0.1, knee=90)
    t = smootherstep(u)
    for s in SIDES:
        ctx.target('leg.' + s, (sgn(s) * 0.07, -0.3, 0.085))
        ctx.pole_world('leg.' + s, (sgn(s) * lerp(0.1, 1.6, t), -1, 0))
        ctx.arm_fk(s, abd=10, flex=20, elbow=30)
    knees = [ctx.world('shin.' + s, 'head') for s in SIDES]
    set_line(st['band'], knees[0] + Vector((0.04, 0, 0)), knees[1] - Vector((0.04, 0, 0)))


@spec('hip-adduction-against-band', camera=cam((0, 0.0, 0.8), 5, 8, 3.8),
      setup=lambda ctx: (ctx.eq.group('anchor', [ctx.eq.frame('post', (0.1, 0.1, 1.0), (-0.9, 0.0, 0.5))]),
                         _band_ankles(ctx))[1], concentric='out')
def band_adduction(ctx, st, u):
    # Band from a low post on the right; the right leg sweeps in across the body.
    stand(ctx, width=0.04)
    t = smootherstep(u)
    ctx.leg_fk('R', hip_abd=lerp(30, -12, t), ankle=0)
    for s in SIDES:
        ctx.arm_fk(s, abd=10)
    ankle = ctx.world('foot.R', 'head')
    set_line(st['band'], Vector((-0.85, 0.0, 0.12)), ankle + Vector((0, 0, 0.04)))


def side_cable_leg(id_, abduct):
    # The column stands on the figure's left (+X), its left hand on a grab handle. Abduction
    # straps the outside (right) leg, which lifts away from the machine with the cable crossing in
    # front of the standing foot; adduction straps the inside (left) leg, which starts out toward
    # the machine and sweeps across in front of the standing leg.
    handle = Vector((0.75, -0.1, 1.05))
    x0 = 0.25  # stance centre, far enough from the stack for the inside leg to swing out

    def setup(ctx):
        ctx.eq.cable_column(0.9, 0.0, 2.0)
        ctx.eq.group('grab', [ctx.eq.cyl('grab_bar', 0.016, 0.24, tuple(handle), mat=ctx.eq.m_metal, verts=16),
                              ctx.eq.frame('grab_arm', (0.13, 0.03, 0.03), (handle.x + 0.06, handle.y, handle.z + 0.1)),
                              ctx.eq.frame('grab_arm2', (0.13, 0.03, 0.03), (handle.x + 0.06, handle.y, handle.z - 0.1))])
        return {'pulley': Vector((0.81, -0.09, 0.12)), 'cable': ctx.eq.line('cable')}

    def pose(ctx, st, u):
        t = smootherstep(u)
        ctx.root((x0, 0.0, STAND_Z))
        for s in SIDES:
            ctx.target('leg.' + s, (x0 + sgn(s) * 0.138, 0.01, 0.085))
        side = 'R' if abduct else 'L'
        ctx.leg_fk(side, hip_abd=lerp(0, 35, t) if abduct else lerp(25, -12, t), ankle=0)
        ctx.grip('L', handle, (0, 0, 1))
        ctx.arm_fk('R', abd=10)
        ankle = ctx.world('foot.' + side, 'head')
        set_line(st['cable'], st['pulley'], ankle + Vector((0, 0, 0.04)))

    spec(id_, camera=cam((0.3, 0, 0.8), 5, 8, 3.9), setup=setup, concentric='out')(pose)


side_cable_leg('cable-machine-hip-abduction', True)
side_cable_leg('cable-machine-hip-adduction', False)


def hip_machine(id_, abduct):
    def setup(ctx):
        ctx.eq.group('hip_machine', [
            ctx.eq.pad('seat', (0.42, 0.42, 0.08), (0, 0.05, 0.45)),
            ctx.eq.pad('back', (0.42, 0.08, 0.7), (0, 0.3, 0.85), (math.radians(-15), 0, 0)),
            ctx.eq.frame('post', (0.1, 0.1, 0.45), (0, 0.1, 0.22)),
        ])
        return {'pads': [ctx.eq.group(f'kp{s}', [ctx.eq.pad(f'kpp{s}', (0.06, 0.2, 0.25), (0, 0, 0))]) for s in SIDES]}

    def pose(ctx, st, u):
        sit(ctx, 0.45, y=0.08, knee=90, lean=-10)
        t = smootherstep(u)
        for s, pad in zip(SIDES, st['pads']):
            ctx.leg_fk(s, hip_flex=80, knee=90, hip_abd=lerp(3, 35, t) if abduct else lerp(35, 3, t))
            ctx.grip(s, (sgn(s) * 0.27, 0.0, 0.5), (0, -1, 0))
            knee = ctx.world('shin.' + s, 'head')
            place(pad, knee + Vector((sgn(s) * (0.07 if abduct else -0.07), 0.05, -0.08)))

    spec(id_, camera=cam((0, 0.0, 0.7), 10, 14, 3.4), setup=setup, concentric='out')(pose)


hip_machine('hip-abductor', True)
hip_machine('hip-adductor', False)


# ---------------------------------------------------------------------------------------------
# Kickbacks


def kickback_spec(id_, kind='cable'):
    def setup(ctx):
        st = {}
        if kind == 'cable':
            ctx.eq.cable_column(0, -0.7, 2.0)
            st['pulley'] = Vector((0, -0.79, 0.12))
            st['cable'] = ctx.eq.line('cable')
        else:
            ctx.eq.group('kick_machine', [
                ctx.eq.pad('chest', (0.35, 0.3, 0.08), (0, -0.25, 1.05), (math.radians(30), 0, 0)),
                ctx.eq.frame('post', (0.08, 0.08, 1.0), (0, -0.4, 0.5)),
                ctx.eq.frame('base', (0.5, 0.8, 0.04), (0, 0.0, 0.02)),
            ])
            st['lever'] = ctx.eq.line('lever', radius=0.02)
            st['leg_pad'] = ctx.eq.group('leg_pad', [ctx.eq.pad('lp', (0.14, 0.08, 0.2), (0, 0, 0))])
        return st

    def pose(ctx, st, u):
        t = smootherstep(u)
        stand(ctx, width=0.04)
        ctx.bone('pelvis', (X, 28 if kind != 'cable' else 18))
        ctx.spine(flex=10)
        ctx.leg_fk('R', hip_flex=lerp(15, -30, t), knee=lerp(15, 5, t), ankle=10)
        for s in SIDES:
            ctx.grip(s, (sgn(s) * 0.15, -0.55, 1.1 if kind == 'cable' else 1.05), (0, 0, 1))
        elbows(ctx, (0.4, 0.4, -1))
        if kind == 'cable':
            set_line(st['cable'], st['pulley'], ctx.world('foot.R', 'head') + Vector((0, 0, 0.04)))
        else:
            # Pad on the back of the calf, on a lever that pivots beside the hip and swings with
            # the leg; the lever runs down the outside of the working leg.
            ctx.follow(st['leg_pad'], 'shin.R', (-0.098, 0.085, 0.33))
            set_line(st['lever'], ctx.world('thigh.R', 'head') + Vector((-0.17, 0, 0)),
                     ctx.attach_point('shin.R', (-0.2, 0.085, 0.33)))

    spec(id_, camera=cam((0, -0.1, 0.8), 75, 10, 3.9), setup=setup, concentric='out')(pose)


kickback_spec('cable-glute-kickback', 'cable')
kickback_spec('machine-glute-kickbacks', 'machine')
kickback_spec('standing-glute-kickback-in-machine', 'machine')
PUSH_STEP = 0.35  # step height of the assisted dip machine


def _push_down_setup(ctx):
    h = PUSH_STEP
    ctx.eq.group('assist_machine', [
        ctx.eq.pad('step', (0.24, 0.4, h), (0.14, 0.05, h / 2)),  # under the standing (left) foot
        *[ctx.eq.frame('upright' + s, (0.06, 0.06, h + 1.25), (sgn(s) * 0.36, 0.15, (h + 1.25) / 2)) for s in SIDES],
        *[ctx.eq.frame('handle' + s, (0.04, 0.4, 0.04), (sgn(s) * 0.3, -0.03, h + 0.85)) for s in SIDES],
        ctx.eq.frame('lever_post', (0.06, 0.06, 0.55), (-0.1, -0.6, 0.275)),
    ])
    return {'knee_pad': ctx.eq.group('knee_pad', [ctx.eq.pad('kp', (0.22, 0.3, 0.07), (0, 0, 0))]),
            'lever': ctx.eq.line('lever', radius=0.02)}


@spec('standing-glute-push-down', camera=cam((0, -0.1, 1.0), -70, 10, 4.2), setup=_push_down_setup, concentric='out')
def standing_glute_push_down(ctx, st, u):
    # Standing tall on the step of an assisted dip machine, hands on the handles, the right foot
    # on the knee pad; the hip extends to push the pad down until the leg is straight beside the
    # step.
    t = smootherstep(u)
    h = PUSH_STEP
    stand(ctx, width=0.04, floor=h)
    ctx.bone('pelvis', (X, 6))
    ctx.leg_fk('R', hip_flex=lerp(85, 0, t), knee=lerp(90, 10, t), ankle=lerp(0, 8, t))
    for s in SIDES:
        ctx.grip(s, (sgn(s) * 0.3, -0.08, h + 0.85), (0, -1, 0))
    elbows(ctx, (0.2, 1, 0))
    sole = ctx.attach_point('foot.R', (-0.104, -0.05, -0.015))
    pad = sole - Vector((0, 0, 0.035))
    place(st['knee_pad'], pad)
    set_line(st['lever'], Vector((-0.1, -0.6, 0.55)), pad)


# ---------------------------------------------------------------------------------------------
# Hinges over benches, Nordics


def _pull_through_setup(ctx):
    ctx.eq.cable_column(0, 0.9, 2.0)
    return {'pulley': Vector((0, 0.81, 0.12)), 'cable': ctx.eq.line('cable'),
            'ropes': [ctx.eq.line('rL', radius=0.012), ctx.eq.line('rR', radius=0.012)]}


@spec('cable-pull-through', camera=cam((0, 0.2, 0.8), 70, 10, 3.9), setup=_pull_through_setup, concentric='back')
def cable_pull_through(ctx, st, u):
    # Facing away from a low pulley, rope between the legs; hinge back, then drive the hips through.
    t = smootherstep(u)
    ctx.root((0, 0.25 * t - 0.15, STAND_Z - 0.05 * t))
    ctx.bone('pelvis', (X, 70 * t))
    ctx.head(flex=-20 * t)
    feet(ctx, width=0.14, toe_out=10, y=-0.15)
    knees_out(ctx, 0.3)
    for s in SIDES:
        ctx.arm_fk(s, flex=-5 + 15 * t, abd=-10)
    hands = [ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES]
    knot = (hands[0] + hands[1]) / 2 + Vector((0, 0.08, -0.04))
    for rope, h in zip(st['ropes'], hands):
        set_line(rope, knot, h)
    set_line(st['cable'], st['pulley'], knot)


@spec('back-extension', camera=cam((0, 0.0, 0.8), 80, 8, 4.0), setup=lambda ctx: (ctx.eq.back_extension_bench(), {})[1],
      concentric='back')
def back_extension(ctx, st, u):
    # Hips on the pad of a 45° bench; hinge down over it, then rise until the body is straight.
    t = smootherstep(u)
    ctx.pin_root(M.joint('hip') - Vector((M.joint('hip').x, 0, 0)), Vector((0, -0.04, 0.95)), (45, 0, 0))
    ctx.bone('pelvis', (X, 85 * t))
    ctx.spine(flex=10 * t)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=85 * t, ankle=0)
        ctx.arm_fk(s, flex=40, abd=-30, elbow=120, rot=60)


@spec('floor-back-extension', camera=cam((0, 0.0, 0.25), 75, 14, 3.6), setup=nothing, concentric='out')
def floor_back_extension(ctx, st, u):
    t = smootherstep(u)
    ctx.root((0, 0.0, 0.11), (90, 0, 0))
    ctx.spine(flex=-32 * t)
    ctx.head(flex=-15 * t)
    for s in SIDES:
        ctx.leg_fk(s, ankle=-30)
        ctx.arm_fk(s, flex=150, abd=55, elbow=140, rot=40)


@spec('reverse-hyperextension', camera=cam((0, 0.2, 0.7), 80, 10, 4.0),
      setup=lambda ctx: (ctx.eq.flat_bench((0, -0.2), length=0.9, height=0.85), {})[1], concentric='out')
def reverse_hyper(ctx, st, u):
    # Face down on a high bench with the hips at the edge; the straight legs swing up to horizontal.
    t = smootherstep(u)
    ctx.root((0, 0.32, 0.97), (90, 0, 0))
    ctx.head(flex=-20)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=lerp(80, -5, t), ankle=-20)
        ctx.grip(s, (sgn(s) * 0.16, -0.62, 0.84), (0, -1, 0))
    elbows(ctx, (0.3, 0, -1))


def nordic_spec(id_, reverse=False, machine=False):
    def setup(ctx):
        if machine:
            ctx.eq.group('ghd', [ctx.eq.pad('knee_pad', (0.4, 0.3, 0.12), (0, 0.0, 0.62)),
                                 ctx.eq.pad('ankle_pad', (0.4, 0.1, 0.1), (0, 0.45, 0.75)),
                                 ctx.eq.frame('rail', (0.08, 1.1, 0.08), (0, 0.15, 0.4)),
                                 ctx.eq.frame('post', (0.08, 0.08, 0.6), (0, 0.15, 0.3))])
        else:
            ctx.eq.group('anchor', [ctx.eq.pad('ankle_hold', (0.45, 0.1, 0.1), (0, 0.48, 0.16))])
        return {}

    def pose(ctx, st, u):
        t = smootherstep(u)
        knee_z = 0.06 if not machine else 0.68
        # Kneeling, ankles held; the body hinges at the knees as one rigid line.
        lean = lerp(0, -40 if reverse else 70, t)
        ctx.pin_root(M.joint('knee'), Vector((0, 0.0, knee_z)), (lean, 0, 0))
        for s in SIDES:
            # The knee angle opens as the body leans so the shins stay put under the anchor.
            ctx.leg_fk(s, knee=90 - lean, ankle=-60)
        ctx.head(flex=-10)
        for s in SIDES:
            ctx.arm_fk(s, flex=lerp(20, 70, t) if not reverse else 20, abd=10, elbow=60)

    if machine:
        camera = cam((0, 0.0, 0.95), 80, 10, 4.4)
    elif reverse:
        camera = cam((0, 0.1, 0.5), 80, 10, 3.8)
    else:
        camera = cam((0, -0.3, 0.5), 80, 10, 4.0)
    spec(id_, camera=camera, setup=setup, concentric='back')(pose)


nordic_spec('nordic-hamstring-eccentric')
nordic_spec('reverse-nordic', reverse=True)
nordic_spec('glute-ham-raise', machine=True)


def floor_curl_spec(id_, ball=False):
    def setup(ctx):
        return {'ball': ctx.eq.medicine_ball(radius=0.32)} if ball else {}

    def pose(ctx, st, u):
        # Hips up in a bridge; the heels pull in toward the glutes and slide back out.
        t = smootherstep(u)
        ctx.pin_root(Vector((0, 0.0, M.joint('shoulder').z)), Vector((0, 0.55, 0.1)), (-90 - 18, 0, 0))
        ctx.head(flex=20)
        heel_y = lerp(-0.6, -0.25, t)
        # Resting on the heels with the toes pointing up (qx(-) lifts the toes), so the feet stay
        # on top of the floor or ball rather than pointing into it.
        heel_z = 0.09 if not ball else 0.4
        for s in SIDES:
            ctx.target('leg.' + s, (sgn(s) * 0.1, heel_y, heel_z), qx(-35) @ ctx.body.rest_quat('foot.' + s))
            ctx.pole_world('leg.' + s, (0, -0.2, 1))
            ctx.arm_fk(s, abd=14, rot=-70)
        if ball:
            place(st['ball'], Vector((0, heel_y - 0.05, 0.32)))

    spec(id_, camera=cam((0, 0.0, 0.3), 75, 14, 3.6), setup=setup, concentric='out')(pose)


floor_curl_spec('bodyweight-leg-curl')
floor_curl_spec('leg-curl-on-ball', ball=True)


# ---------------------------------------------------------------------------------------------
# Leg machines, one leg at a time and otherwise


def _ext_machine(ctx):
    return ctx.eq.leg_extension()


@spec('one-legged-leg-extension', camera=cam((0, -0.1, 0.7), 72, 10, 3.6), setup=_ext_machine, concentric='out')
def one_leg_extension(ctx, st, u):
    sit(ctx, 0.44, y=0.13, knee=92, lean=-6)
    ctx.leg_fk('R', hip_flex=88, knee=lerp(92, 6, u), ankle=6)
    ctx.leg_fk('L', hip_flex=88, knee=92, ankle=6)
    for s in SIDES:
        ctx.grip(s, ctx.body_point((sgn(s) * 0.27, -0.12, 0.8)), (0, -1, 0))
    elbows(ctx, (0.6, 1, 0))
    knee = ctx.world('shin.R', 'head')
    place(st['lever'], (0, knee.y, knee.z), ctx.bone_delta('shin.R'))


@spec('one-legged-lying-leg-curl', camera=cam((0, 0.0, 0.55), 75, 18, 4.1), setup=lambda ctx: ctx.eq.leg_curl(),
      concentric='out')
def one_leg_lying_curl(ctx, st, u):
    ctx.root((0, -0.05, 0.645), (90, 0, 0))
    ctx.head(flex=-25)
    ctx.leg_fk('R', hip_flex=-4, knee=8 + 112 * u, ankle=-10)
    ctx.leg_fk('L', hip_flex=-4, knee=8, ankle=-10)
    for s in SIDES:
        ctx.grip(s, (sgn(s) * 0.2, -0.72, 0.42), (-sgn(s), 0, 0))
    elbows(ctx, (0.8, 0, -1))
    knee = ctx.world('shin.R', 'head')
    place(st['lever'], (0, knee.y, knee.z), ctx.bone_delta('shin.R'))


def seated_curl_spec(id_, one_leg=False):
    def setup(ctx):
        st = ctx.eq.leg_extension()
        # The locked-down thigh pad across the lower thighs, on short posts from the seat sides.
        st['thigh_pad'] = ctx.eq.group('thigh_pad', [
            ctx.eq.pad('tp', (0.42, 0.12, 0.08), (0, 0, 0)),
            *[ctx.eq.frame('tp_post' + s, (0.03, 0.03, 0.2), (sgn(s) * 0.23, 0, -0.1)) for s in SIDES]])
        return st

    def pose(ctx, st, u):
        # Seated, legs out on a roller; the heels pull down and back under the seat.
        sit(ctx, 0.44, y=0.13, knee=10, lean=-12)
        t = smootherstep(u)
        for s in SIDES:
            work = (s == 'R') or not one_leg
            ctx.leg_fk(s, hip_flex=88, knee=lerp(8, 100, t) if work else 8, ankle=6)
            ctx.grip(s, ctx.body_point((sgn(s) * 0.27, -0.12, 0.8)), (0, -1, 0))
        elbows(ctx, (0.6, 1, 0))
        knee = ctx.world('shin.R', 'head')
        place(st['lever'], (0, knee.y, knee.z), ctx.bone_delta('shin.R') @ qz(180))
        place(st['thigh_pad'], (0, knee.y + 0.1, knee.z + 0.11))

    spec(id_, camera=cam((0, -0.1, 0.7), 72, 10, 3.6), setup=setup, concentric='out')(pose)


seated_curl_spec('seated-leg-curl')
seated_curl_spec('one-legged-seated-leg-curl', one_leg=True)


def _standing_curl_setup(ctx):
    ctx.eq.group('slc', [ctx.eq.pad('thigh_pad', (0.3, 0.12, 0.3), (0, -0.2, 0.75)),
                         ctx.eq.frame('post', (0.08, 0.08, 1.2), (0, -0.35, 0.6))])
    roller = ctx.eq.group('ankle_roller', [ctx.eq.cyl('roller', 0.05, 0.25, (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_pad, 24)])
    return {'roller': roller, 'lever': ctx.eq.line('curl_lever', radius=0.02)}


@spec('standing-leg-curl', camera=cam((0, 0.0, 0.85), 80, 8, 3.8), setup=_standing_curl_setup, concentric='out')
def standing_leg_curl(ctx, st, u):
    stand(ctx, width=0.03)
    ctx.spine(flex=8)
    ctx.leg_fk('R', hip_flex=8, knee=lerp(5, 110, u), ankle=-5)
    for s in SIDES:
        ctx.grip(s, (sgn(s) * 0.22, -0.35, 1.15), (0, 0, 1))
    elbows(ctx, (0.4, 0.3, -1))
    # Roller behind the lower leg, on a lever pivoting beside the knee.
    ctx.follow(st['roller'], 'shin.R', (-0.098, 0.075, 0.15))
    set_line(st['lever'], ctx.world('shin.R', 'head') + Vector((-0.17, 0, 0)),
             ctx.attach_point('shin.R', (-0.23, 0.075, 0.15)))


def _cable_ext_setup(ctx):
    ctx.eq.cable_column(0, 0.75, 2.0)
    # A post on the far (right) side to hold for balance, clear of the working leg in the camera.
    ctx.eq.group('support', [ctx.eq.frame('post', (0.05, 0.05, 1.1), (-SUPPORT.x, SUPPORT.y, 0.55))])
    return {'cable': ctx.eq.line('cable'), 'pulley': Vector((0, 0.66, 0.12))}


@spec('standing-cable-leg-extension', camera=cam((0, 0.0, 0.8), 75, 8, 3.9), setup=_cable_ext_setup, concentric='out')
def standing_cable_leg_extension(ctx, st, u):
    # Facing away from a low pulley, the thigh held up; the knee straightens against the strap.
    stand(ctx, width=0.03)
    ctx.leg_fk('R', hip_flex=45, knee=lerp(85, 5, u), ankle=5)
    ctx.arm_fk('L', abd=15)
    ctx.grip('R', (-SUPPORT.x, SUPPORT.y, SUPPORT.z), (0, 0, 1))
    set_line(st['cable'], st['pulley'], ctx.world('foot.R', 'head'))


VLP_PAD = 0.08  # back pad under the lifter


def _vertical_press_setup(ctx):
    rail_y = 0.01  # under the feet, just past the hips
    ctx.eq.group('vlp_frame', [
        ctx.eq.pad('back_pad', (0.5, 0.85, VLP_PAD), (0, 0.45, VLP_PAD / 2)),
        *[ctx.eq.frame('rail' + s, (0.05, 0.05, 1.5), (sgn(s) * 0.38, rail_y, 0.85)) for s in SIDES],
        ctx.eq.frame('rail_top', (0.81, 0.05, 0.05), (0, rail_y, 1.6)),
        ctx.eq.frame('rail_base', (0.9, 0.3, 0.04), (0, rail_y, 0.02)),
    ])
    plat = ctx.eq.group('vlp', [
        ctx.eq.box('vp', (0.6, 0.45, 0.05), (0, 0, 0), ctx.eq.m_equip, 0.01),
        *[ctx.eq.frame('sleeve' + s, (0.09, 0.09, 0.14), (sgn(s) * 0.38, 0, 0)) for s in SIDES],
        *[ctx.eq.frame('arm' + s, (0.1, 0.04, 0.03), (sgn(s) * 0.31, 0, 0)) for s in SIDES],
    ])
    return {'plat': plat, 'rail_y': rail_y}


@spec('vertical-leg-press', camera=cam((0, 0.1, 0.65), 70, 12, 4.0), setup=_vertical_press_setup, concentric='back')
def vertical_leg_press(ctx, st, u):
    # Lying on the back pad under a platform on guide rails; the legs lower it toward the chest
    # and press it up.
    ctx.root((0, 0.1, 0.12 + VLP_PAD), (-90, 0, 0))
    hip = (ctx.world('thigh.L', 'head') + ctx.world('thigh.R', 'head')) / 2
    z = lerp(0.85, 0.5, smootherstep(u))
    for s in SIDES:
        ctx.target('leg.' + s, (sgn(s) * 0.14, hip.y - 0.05, hip.z + z), qx(-180) @ ctx.body.rest_quat('foot.' + s))
        ctx.pole_world('leg.' + s, (sgn(s) * 0.3, -1, 0))
        ctx.arm_fk(s, abd=14, rot=-70)
    place(st['plat'], Vector((0, hip.y - 0.05, hip.z + z + 0.09)))


# ---------------------------------------------------------------------------------------------
# Calves and shins


BALL_FROM_ANKLE = Vector((0, -0.11, -0.065))  # ball of the foot (sole) from the ankle, rest pose
SEATED_STEP_Y = -0.22  # balls of the feet on a seated calf raise: just under the knees


def calf_spec(id_,load='none', seated=False, donkey=False, single=False, leg_press=False, step=True,
              eccentric=False):
    def setup(ctx):
        st = {}
        if step:
            # Seated: the step sits under the shins, its back edge under the balls of the feet.
            ctx.eq.plyo_box((0, SEATED_STEP_Y - 0.1 if seated else -0.12), height=0.1, size=(0.5, 0.2))
        if load == 'bar':
            st['bar'] = ctx.eq.barbell()
        elif load == 'smith':
            st['bar'] = ctx.eq.smith_machine(bar_y=0.07)
        elif load == 'knee_bar':
            st['bar'] = ctx.eq.barbell(plate_radius=0.12)  # small plates keep the feet in view
        if seated:
            ctx.eq.flat_bench((0, 0.35), length=0.45, height=0.45, yaw=90)
            if load == 'none':
                # Seated calf machine: a pad across the lower thighs on a lever from a front column.
                ctx.eq.group('calf_column', [ctx.eq.frame('col', (0.08, 0.08, 0.75), (0, -0.55, 0.375)),
                                             ctx.eq.frame('col_base', (0.5, 0.08, 0.03), (0, -0.55, 0.015))])
                st['knee_pad'] = ctx.eq.group('knee_pad', [
                    ctx.eq.pad('kp', (0.42, 0.14, 0.08), (0, 0, 0)),
                    *[ctx.eq.cyl('kp_handle' + s, 0.016, 0.12, (sgn(s) * 0.26, 0, 0.04), mat=ctx.eq.m_metal, verts=16)
                      for s in SIDES]])
                st['lever'] = ctx.eq.line('calf_lever', radius=0.02)
        if donkey:
            ctx.eq.group('donkey', [ctx.eq.pad('support', (0.5, 0.2, 0.08), (0, -0.75, 1.0)),
                                    ctx.eq.frame('post', (0.08, 0.08, 1.0), (0, -0.75, 0.5)),
                                    ctx.eq.frame('rear_col', (0.08, 0.08, 1.25), (0, 0.6, 0.625))])
            st['hip_pad'] = ctx.eq.group('hip_pad', [ctx.eq.pad('hp', (0.4, 0.08, 0.25), (0, 0, 0))])
            st['lever'] = ctx.eq.line('donkey_lever', radius=0.02)
        if leg_press:
            st.update(ctx.eq.leg_press())
        return st

    def pose(ctx, st, u):
        t = smootherstep(u)
        ankle = lerp(-14 if step else 0, 32, t)
        if eccentric:
            ankle = lerp(32, -14, t)
        if leg_press:
            # Knees almost locked, ankles fixed on the 45° line like the leg press; the feet
            # plantarflex about the ankle and the balls of the feet push the sled up the rail.
            ctx.root((0, 0.12, 0.56), (-48, 0, 0))
            ctx.spine(flex=8)
            ctx.head(flex=20)
            rail = st['rail']
            up_rail = Vector((0, rail.z, -rail.y))  # perpendicular to the rail, toward the chest
            hip = (ctx.world('thigh.L', 'head') + ctx.world('thigh.R', 'head')) / 2
            ankles = hip + rail * 0.72 + up_rail * 0.1
            foot = qx(-135 + ankle)  # sole facing down the rail, then the calf raise
            for s in SIDES:
                ctx.target('leg.' + s, ankles + Vector((sgn(s) * 0.14, 0, 0)), foot @ ctx.body.rest_quat('foot.' + s))
                ctx.pole_world('leg.' + s, up_rail + Vector((sgn(s) * 0.25, 0, 0)))
                ctx.grip(s, ctx.body_point((sgn(s) * 0.3, -0.16, 0.86)), (0, 0, 1))
            elbows(ctx, (0.6, 1, 0))
            ball = ankles + foot @ BALL_FROM_ANKLE
            # The sled sits where the leg press puts it for these ankles, pushed along the rail as
            # far as the balls of the feet travel.
            push = (ball - (ankles + qx(-135) @ BALL_FROM_ANKLE)).dot(rail)
            place(st['platform'], ankles + rail * (0.08 + push) + up_rail * 0.06, qx(45))
            return
        if seated:
            # Hips stay on the bench; the balls of the feet are pinned on the step's back edge, so
            # the ankle angle raises the heels and lifts the knees (and the pad or bar on them).
            sit(ctx, 0.45, y=0.32, knee=90)
            for s in SIDES:
                foot = qx(ankle)  # qx(+) lifts the heel
                ball = Vector((sgn(s) * 0.1, SEATED_STEP_Y, 0.12))
                ctx.target('leg.' + s, ball - foot @ BALL_FROM_ANKLE, foot @ ctx.body.rest_quat('foot.' + s))
                ctx.pole_world('leg.' + s, (0, -1, 0.3))
            knees = [ctx.world('shin.' + s, 'head') for s in SIDES]
            mid = (knees[0] + knees[1]) / 2
            if 'bar' in st:
                mid += Vector((0, -0.02, 0.06))
                place(st['bar'], mid)
                bar_grip(ctx, mid, 0.18)
            else:
                pad = mid + Vector((0, 0.07, 0.1))  # across the thighs just behind the knees
                place(st['knee_pad'], pad)
                set_line(st['lever'], Vector((0, -0.55, 0.72)), pad + Vector((0, 0, -0.02)))
                for s in SIDES:
                    ctx.grip(s, pad + Vector((sgn(s) * 0.26, 0, 0.04)), (0, 0, 1))
                elbows(ctx, (1, 0.3, -0.5))
            return
        ctx.root((0, 0.0, STAND_Z))
        if donkey:
            ctx.bone('pelvis', (X, 85))
            for s in SIDES:
                ctx.grip(s, (sgn(s) * 0.2, -0.72, 1.05), (0, -1, 0))
        legs = ['R'] if single else SIDES
        for s in SIDES:
            if s in legs:
                ctx.leg_fk(s, ankle=ankle, hip_flex=85 if donkey else 0)
            else:
                ctx.leg_fk(s, knee=60, hip_flex=-10, ankle=-20)
        if donkey:
            for s in SIDES:
                ctx.leg_fk(s, hip_flex=85, ankle=ankle)  # legs vertical under the tipped pelvis
        ref = 'foot.R' if single else 'foot.L'
        ball = ctx.attach_point(ref, (0.1 if not single else -0.1, -0.1, 0.02))
        floor_z = 0.12 if step else 0.02
        ctx.arm.location += Vector((ball.x * 0, -0.1 - ball.y if step else 0, floor_z - ball.z))
        if load in ('bar', 'smith'):
            back_rack(ctx, st['bar'])
        elif not donkey:
            for s in SIDES:
                ctx.arm_fk(s, abd=10)
        if donkey:
            # Machine pad on the hips, on a lever from a column behind; it rides up with the heels.
            ctx.follow(st['hip_pad'], 'pelvis', (0, 0.17, 0.93))
            set_line(st['lever'], Vector((0, 0.6, 1.2)), ctx.attach_point('pelvis', (0, 0.2, 0.93)))

    # Standing raises (bar on the back, up on a step) need the taller frame.
    standing = not (seated or leg_press or donkey)
    if seated:
        camera = cam((0, -0.05, 0.45), 40, 12, 3.4)  # front-left, so the plates don't hide the feet
    elif leg_press:
        camera = cam((0, -0.3, 0.85), 55, 10, 3.4)  # front-left, so the feet show beside the sled
    elif standing:
        camera = cam((0, 0, 0.98), 78, 6, 4.2)
    else:
        camera = cam((0, 0, 0.7), 78, 6, 3.6)
    spec(id_, camera=camera, setup=setup, concentric='out' if not eccentric else 'back',
         timing=dict(hold_start=0.12, out=0.3, hold_end=0.16))(pose)


calf_spec('barbell-standing-calf-raise', load='bar')
calf_spec('smith-machine-calf-raise', load='smith')
calf_spec('heel-raise', step=False)
calf_spec('donkey-calf-raises', donkey=True)
calf_spec('seated-calf-raise', seated=True)
calf_spec('barbell-seated-calf-raise', seated=True, load='knee_bar')
calf_spec('calf-raise-in-leg-press', leg_press=True, step=False)
calf_spec('eccentric-heel-drop', single=True, eccentric=True)


# Ankle relative to the bottom of the heel, rest pose: toes-up foot targets pivot about the heel.
HEEL_TO_ANKLE = Vector((0, -0.02, 0.085))


def heel_target(ctx, side, heel, toes_up):
    """Foot target with the heel on `heel` and the toes lifted `toes_up` degrees (qx(-a) lifts the toes)."""
    r = qx(-toes_up)
    ctx.target('leg.' + side, Vector(heel) + r @ HEEL_TO_ANKLE, r @ ctx.body.rest_quat('foot.' + side))


@spec('tibialis-raise', camera=cam((0, -0.05, 0.9), 78, 6, 4.0),
      setup=lambda ctx: (ctx.eq.group('wall', [ctx.eq.pad('w', (1.2, 0.1, 2.0), (0, 0.3, 1.0))]), {})[1],
      concentric='out')
def tibialis_raise(ctx, st, u):
    # Back against a wall, heels a step out; the toes lift toward the shins.
    ctx.root((0, 0.12, STAND_Z - 0.02), (-8, 0, 0))
    for s in SIDES:
        heel_target(ctx, s, (sgn(s) * 0.1, -0.2, 0.0), lerp(0, 30, smootherstep(u)))
        ctx.pole_world('leg.' + s, (0, -1, 0))
        ctx.arm_fk(s, abd=8)


KB_BENCH = 0.8  # high enough that the feet hang well clear of the floor


@spec('kettlebell-tibialis-raise', camera=cam((0, 0.0, 0.75), 75, 8, 3.8),
      setup=lambda ctx: (ctx.eq.flat_bench((0, 0.2), length=0.5, height=KB_BENCH, yaw=90), {'kb': ctx.eq.kettlebell()})[1],
      concentric='out')
def kb_tibialis_raise(ctx, st, u):
    # Seated on a high bench, lower legs hanging, a kettlebell's handle hooked over the right
    # forefoot; the toes pull up toward the shin against it.
    sit(ctx, KB_BENCH, y=0.22, knee=90)
    t = smootherstep(u)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=88, knee=90, ankle=lerp(-30, 15, t))
        ctx.arm_fk(s, flex=20, abd=10, elbow=20)
    # The handle's top bar rests on the top of the forefoot and the bell hangs straight down below
    # the sole, so the foot sits inside the handle loop.
    top = ctx.attach_point('foot.R', (-0.105, -0.1, 0.05))
    place(st['kb'], top + Vector((0, 0, 0.012)))


@spec('tibialis-band-pull', camera=cam((0, -0.15, 0.3), 75, 12, 3.6),
      setup=lambda ctx: (ctx.eq.group('anchor', [ctx.eq.frame('post', (0.1, 0.1, 0.5), (0, -1.0, 0.25))]),
                         {'band': ctx.eq.line('band', accent=True, radius=0.01)})[1], concentric='out')
def tibialis_band_pull(ctx, st, u):
    # Seated, legs out, band from a post in front looped over the foot; the toes pull back.
    ctx.root((0, 0.2, 0.16))
    ctx.spine(flex=10)
    t = smootherstep(u)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=88, knee=2, ankle=lerp(-30, 15, t) if s == 'R' else -10)
        ctx.target('arm.' + s, (sgn(s) * 0.2, 0.45, 0.05))
        ctx.pole_world('arm.' + s, (0, 1, 0))
    toes = ctx.attach_point('foot.R', (-0.1, -0.15, 0.04))
    set_line(st['band'], Vector((0, -0.95, 0.3)), toes)


@spec('heel-walks', camera=cam((0, 0, 0.8), 70, 8, 3.9), setup=nothing, timing=ALTERNATE)
def heel_walks(ctx, st, u):
    # Walking in place on the heels, toes held high, short stiff-kneed steps. The swinging foot
    # lifts while it moves forward; the planted heel slides back under the body.
    w = wave(ctx)
    swing = math.cos(2 * math.pi * ctx.t)
    ctx.root((0, 0.0, STAND_Z - 0.02))
    for s in SIDES:
        step = 0.13 * (w if s == 'L' else -w)
        lift = 0.05 * max(0.0, swing if s == 'L' else -swing)
        heel_target(ctx, s, (sgn(s) * 0.1, 0.03 - step, lift), 32)
        ctx.pole_world('leg.' + s, (0, -1, 0))
        ctx.arm_fk(s, flex=25 * (-w if s == 'L' else w), abd=6, elbow=25)

