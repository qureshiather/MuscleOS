"""Core family: planks, crunches and sit-ups, leg raises, hollow holds, anti-rotation and
rotation work, wood chops, and floor-to-standing movements."""

import math

from mathutils import Vector

import mannequin as M
import scene as S
from anim import X, Y, Z, lerp, sgn, smootherstep
from equipment import along, place, qx, qz, set_line
from moves import SIDES, STAND_Z, elbows, grip_point, hold_dumbbell, knees_out, shoulders, stand
from registry import cam, nothing, spec


def wave(ctx, cycles=1.0):
    """-1..1 alternating with loop time, for left/right alternating moves."""
    return math.sin(2 * math.pi * cycles * getattr(ctx, 't', 0.0))


def orbit(ctx, target, start=40, end=80, el=14, dist=3.8, u=0.0):
    S.place_camera(ctx.cam, target, lerp(start, end, u), el, dist)


HOLD = dict(timing=dict(hold_start=0.0, out=0.5, hold_end=0.0), pulse_floor=0.82, concentric='out')


# ---------------------------------------------------------------------------------------------
# Planks


def forearm_plank(ctx, knees=False, side=None):
    """Prone on the forearms (elbows under the shoulders), or on the knees, or on one side."""
    if side:
        # Side plank on the left forearm: body faces -Y, rolled onto its left side.
        ctx.root((0.0, 0.0, 0.33), (0, 78 if not knees else 70, 0))
        ctx.head(flex=0)
        for s in SIDES:
            if knees:
                ctx.leg_fk(s, knee=90, hip_flex=-10)
            else:
                ctx.leg_fk(s, ankle=-5)  # straight line from head to heels
        sh = ctx.world('upperarm.L', 'head')
        ctx.target('arm.L', (sh.x + 0.0, sh.y - 0.26, 0.045))
        ctx.pole_world('arm.L', (0, 0, -1))
        ctx.arm_fk('R', abd=-10, flex=0)
        return
    pitch = 79.6 if not knees else 62
    z = 0.255 if not knees else 0.3
    ctx.root((0, 0.0, z), (pitch, 0, 0))
    ctx.head(flex=-60)
    for s in SIDES:
        ctx.leg_fk(s, ankle=-5, knee=0 if not knees else 95, hip_flex=0 if not knees else -8)
    down = ctx.arm.matrix_world.to_quaternion().inverted() @ Vector((0, 0, -1))
    for s in SIDES:
        sh = ctx.world('upperarm.' + s, 'head')
        ctx.target('arm.' + s, (sh.x, sh.y - 0.25, 0.045))
        ctx.pole_dir('arm.' + s, down)


def high_plank(ctx, lift=0.0):
    """Straight-arm plank: hands under the shoulders, body in one line."""
    ctx.root((0, 0.0, 0.62 + lift), (68, 0, 0))
    ctx.head(flex=-50)
    for s in SIDES:
        ctx.target('leg.' + s, (sgn(s) * 0.12, 0.95, 0.06))
        ctx.pole_world('leg.' + s, (0, 0, 1))
    for s in SIDES:
        sh = ctx.world('upperarm.' + s, 'head')
        ctx.target('arm.' + s, (sh.x, sh.y - 0.02, 0.08))
        ctx.pole_world('arm.' + s, (0, 1, 0))


@spec('side-plank', camera=cam((0, 0.0, 0.3), 0, 12, 3.8), setup=nothing, **HOLD)
def side_plank(ctx, st, u):
    forearm_plank(ctx, side='L')
    orbit(ctx, (0, 0.0, 0.35), -20, 20, 12, 3.8, u)


@spec('kneeling-side-plank', camera=cam((0, 0.0, 0.3), 0, 12, 3.6), setup=nothing, **HOLD)
def kneeling_side_plank(ctx, st, u):
    forearm_plank(ctx, knees=True, side='L')
    orbit(ctx, (0, 0.0, 0.3), -20, 20, 12, 3.6, u)


@spec('kneeling-plank', camera=cam((0, 0.05, 0.25), 60, 14, 3.6), setup=nothing, **HOLD)
def kneeling_plank(ctx, st, u):
    forearm_plank(ctx, knees=True)
    orbit(ctx, (0, 0.05, 0.25), 50, 90, 14, 3.6, u)


@spec('weighted-plank', camera=cam((0, 0.05, 0.25), 60, 14, 3.8), setup=lambda ctx: {'plate': ctx.eq.plate()}, **HOLD)
def weighted_plank(ctx, st, u):
    forearm_plank(ctx)
    ctx.follow(st['plate'], 'spine', (0, 0.16, 1.15))  # lying flat on the back
    orbit(ctx, (0, 0.05, 0.25), 40, 80, 14, 3.8, u)


@spec('plank-with-shoulder-taps', camera=cam((0, 0.1, 0.35), 40, 14, 3.8), setup=nothing,
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0))
def plank_shoulder_taps(ctx, st, u):
    high_plank(ctx)
    w = wave(ctx)
    side, other = ('R', 'L') if w > 0 else ('L', 'R')
    a = abs(w)
    sh = ctx.world('upperarm.' + other, 'head')
    floor = Vector((ctx.world('upperarm.' + side, 'head').x, sh.y - 0.02, 0.08))
    tap = sh + Vector((0, -0.05, 0.02))
    ctx.target('arm.' + side, floor.lerp(tap, smootherstep(a)))
    ctx.pole_world('arm.' + side, (sgn(side) * 0.5, 0, 0.5))


@spec('plank-with-leg-lifts', camera=cam((0, 0.05, 0.25), 70, 12, 3.8), setup=nothing,
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0))
def plank_leg_lifts(ctx, st, u):
    forearm_plank(ctx)
    w = wave(ctx)
    for s in SIDES:
        lift = max(0.0, w if s == 'L' else -w)
        ctx.leg_fk(s, hip_flex=-25 * smootherstep(lift), ankle=-5)


@spec('plank-to-push-up', camera=cam((0, 0.05, 0.3), 70, 12, 3.8), setup=nothing, concentric='out')
def plank_to_push_up(ctx, st, u):
    # Forearm plank up to a straight-arm plank one hand at a time, then back down.
    t = smootherstep(u)
    ctx.root((0, 0.0, lerp(0.255, 0.6, t)), (lerp(79.6, 68, t), 0, 0))
    ctx.head(flex=-55)
    for s in SIDES:
        ctx.leg_fk(s, ankle=lerp(-5, -15, t))
    for i, s in enumerate(SIDES):
        k = smootherstep(min(max((u - 0.5 * i) / 0.5, 0.0), 1.0))
        sh = ctx.world('upperarm.' + s, 'head')
        forearm = Vector((sh.x, sh.y - 0.25, 0.045))
        hand = Vector((sh.x, sh.y - 0.02, 0.08))
        ctx.target('arm.' + s, forearm.lerp(hand, k))
        ctx.pole_world('arm.' + s, Vector((0, 0, -1)).lerp(Vector((0, 1, 0)), k))


@spec('copenhagen-plank', camera=cam((0, 0.0, 0.35), 0, 12, 4.0),
      setup=lambda ctx: (ctx.eq.flat_bench((-0.9, 0.0), length=0.5, height=0.44, yaw=90), {})[1], **HOLD)
def copenhagen_plank(ctx, st, u):
    # Side plank with the top leg resting on a bench; the bottom leg hangs free.
    ctx.root((-0.05, 0.0, 0.42), (0, 84, 0))
    sh = ctx.world('upperarm.L', 'head')
    ctx.target('arm.L', (sh.x, sh.y - 0.26, 0.045))
    ctx.pole_world('arm.L', (0, 0, -1))
    ctx.arm_fk('R', abd=-10)
    ctx.leg_fk('R', ankle=10)
    ctx.leg_fk('L', hip_flex=25, knee=40)
    orbit(ctx, (-0.2, 0.0, 0.4), -20, 20, 12, 4.0, u)


@spec('dynamic-side-plank', camera=cam((0, 0.0, 0.3), 0, 12, 3.8), setup=nothing, concentric='out')
def dynamic_side_plank(ctx, st, u):
    # Hip dips: the hips lower toward the floor and lift back into a straight side plank.
    forearm_plank(ctx, side='L')
    ctx.arm.location.z -= 0.14 * smootherstep(1 - u)
    ctx.bone('pelvis', (Y, 12 * smootherstep(1 - u)))


# ---------------------------------------------------------------------------------------------
# Supine trunk flexion


def supine(ctx, knees=True, z=0.11):
    ctx.root((0, 0.0, z), (-90, 0, 0))
    if knees:
        for s in SIDES:
            ctx.target('leg.' + s, (sgn(s) * 0.14, -0.55, 0.085))
            ctx.pole_world('leg.' + s, (sgn(s) * 0.2, 0, 1))


def hands_behind_head(ctx):
    for s in SIDES:
        ctx.arm_fk(s, flex=150, abd=55, elbow=140, rot=40)


def arms_crossed(ctx):
    for s in SIDES:
        ctx.arm_fk(s, flex=40, abd=-20, elbow=120, rot=60)


def crunch_spec(id_, depth=32, situp=False, hands='head', twist=0.0, cable=False, machine=False):
    def setup(ctx):
        st = {}
        if cable:
            ctx.eq.cable_column(0, 0.6, 2.1)
            st['pulley'] = Vector((0, 0.51, 1.9))
            st['cable'] = ctx.eq.line('cable')
            st['ropes'] = [ctx.eq.line('rL', radius=0.012), ctx.eq.line('rR', radius=0.012)]
        if machine:
            ctx.eq.group('crunch_machine', [
                ctx.eq.pad('seat', (0.42, 0.42, 0.08), (0, 0.05, 0.45)),
                ctx.eq.pad('chest_pad', (0.42, 0.08, 0.3), (0, -0.15, 1.35)),
                ctx.eq.frame('post', (0.1, 0.1, 0.45), (0, 0.1, 0.22)),
                ctx.eq.frame('column', (0.08, 0.08, 1.6), (0, 0.35, 0.8)),
            ])
        return st

    def pose(ctx, st, u):
        t = smootherstep(u)
        if cable:
            # Kneeling under a high pulley, rope by the head; crunch the ribs toward the hips.
            ctx.root((0, 0.0, 0.62))
            for s in SIDES:
                ctx.target('leg.' + s, (sgn(s) * 0.12, 0.42, 0.08), qx(-90) @ ctx.body.rest_quat('foot.' + s))
                ctx.pole_world('leg.' + s, (0, -1, -0.5))
            ctx.bone('pelvis', (X, 15 + 10 * t))
            ctx.spine(flex=10 + 55 * t)
            for s in SIDES:
                ctx.arm_fk(s, flex=150, abd=20, elbow=130)
            pts = [ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES]
            knot = (pts[0] + pts[1]) / 2 + Vector((0, 0.06, 0.08))
            for rope, h in zip(st['ropes'], pts):
                set_line(rope, knot, h)
            set_line(st['cable'], st['pulley'], knot)
            return
        if machine:
            ctx.root((0, 0.08, 0.61))
            for s in SIDES:
                ctx.leg_fk(s, hip_flex=88, knee=90)
            ctx.spine(flex=-2 + 45 * t)
            for s in SIDES:
                ctx.arm_fk(s, flex=60, abd=-5, elbow=110)
            return
        supine(ctx)
        if situp:
            ctx.bone('pelvis', (X, 62 * t))
            ctx.spine(flex=25 * t, twist=twist * t)
        else:
            ctx.spine(flex=depth * t, twist=twist * t)
        ctx.head(flex=15 * t)
        if hands == 'head':
            hands_behind_head(ctx)
        elif hands == 'cross':
            arms_crossed(ctx)
        elif hands == 'reach':
            for s in SIDES:
                ctx.arm_fk(s, flex=lerp(30, 70, t), abd=6)

    cam_ = cam((0, 0.2, 0.3), 75, 14, 3.4) if not (cable or machine) else cam((0, 0.0, 0.8), 70, 10, 3.6)
    spec(id_, camera=cam_, setup=setup, concentric='out')(pose)


crunch_spec('crunch')
crunch_spec('sit-up', situp=True, hands='cross')
crunch_spec('oblique-crunch', twist=28)
crunch_spec('oblique-sit-up', situp=True, twist=30, hands='head')
crunch_spec('cable-crunch', cable=True)
crunch_spec('machine-crunch', machine=True)


@spec('bicycle-crunch', camera=cam((0, -0.1, 0.12), 70, 16, 3.7), setup=nothing,
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0))
def bicycle_crunch(ctx, st, u):
    # Shoulders up, legs off the floor; elbow to the opposite knee, left then right.
    supine(ctx, knees=False)
    w = wave(ctx)
    ctx.spine(flex=28, twist=32 * w)
    ctx.head(flex=15)
    hands_behind_head(ctx)
    for s in SIDES:
        k = (1 + (w if s == 'R' else -w)) / 2
        ctx.leg_fk(s, hip_flex=lerp(25, 90, k), knee=lerp(10, 95, k))


@spec('hollow-hold', camera=cam((0, 0.2, 0.25), 75, 12, 3.6), setup=nothing, **HOLD)
def hollow_hold(ctx, st, u):
    supine(ctx, knees=False)
    ctx.spine(flex=22)
    ctx.head(flex=12)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=22, ankle=-25)
        ctx.arm_fk(s, flex=165, abd=-4)
    orbit(ctx, (0, 0.2, 0.25), 60, 100, 12, 3.6, u)


@spec('hollow-body-crunch', camera=cam((0, 0.2, 0.25), 75, 12, 3.6), setup=nothing, concentric='out')
def hollow_body_crunch(ctx, st, u):
    supine(ctx, knees=False)
    t = smootherstep(u)
    ctx.spine(flex=lerp(20, 45, t))
    ctx.head(flex=12)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=lerp(18, 85, t), knee=lerp(0, 100, t), ankle=-25)
        ctx.arm_fk(s, flex=lerp(165, 40, t), abd=-4)


def dead_bug_spec(id_, weights=False):
    def pose(ctx, st, u):
        # Arms to the ceiling, hips and knees at 90°; opposite arm and leg reach out, alternating.
        supine(ctx, knees=False)
        w = wave(ctx)
        for s in SIDES:
            reach_leg = max(0.0, w if s == 'L' else -w)
            reach_arm = max(0.0, -w if s == 'L' else w)
            ctx.leg_fk(s, hip_flex=lerp(90, 15, reach_leg), knee=lerp(90, 0, reach_leg))
            ctx.arm_fk(s, flex=lerp(90, 170, reach_arm), abd=4)
        if weights:
            for s, db in zip(SIDES, st['w']):
                ctx.follow(db, 'hand.' + s, grip_point(s), M.arm_rest_rot(s) @ qz(90))

    spec(id_, camera=cam((0, 0.2, 0.3), 70, 18, 3.4),
         setup=(lambda ctx: {'w': ctx.eq.dumbbells()}) if weights else nothing,
         timing=dict(hold_start=0.0, out=0.5, hold_end=0.0))(pose)


dead_bug_spec('dead-bugs')
dead_bug_spec('dead-bugs-with-dumbbells', weights=True)


@spec('lying-leg-raise', camera=cam((0, 0.0, 0.3), 75, 14, 3.6), setup=nothing, concentric='out')
def lying_leg_raise(ctx, st, u):
    supine(ctx, knees=False)
    t = smootherstep(u)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=lerp(8, 88, t), ankle=-20)
        ctx.arm_fk(s, abd=12, rot=-80)


@spec('jackknife-sit-up', camera=cam((0, 0.0, 0.3), 75, 14, 3.6), setup=nothing, concentric='out')
def jackknife(ctx, st, u):
    # Arms overhead and legs long, then fold into a V with the hands reaching the shins.
    supine(ctx, knees=False)
    t = smootherstep(u)
    ctx.bone('pelvis', (X, 25 * t))
    ctx.spine(flex=45 * t)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=lerp(4, 55, t), ankle=-20)
        ctx.arm_fk(s, flex=lerp(170, 60, t), abd=4)


def lying_wiper(id_, bent):
    def pose(ctx, st, u):
        # Legs up, arms out on the floor; the legs sweep side to side while the shoulders stay down.
        supine(ctx, knees=False)
        w = wave(ctx)
        ctx.bone('pelvis', (Z, 60 * w))
        ctx.spine(twist=-55 * w)
        for s in SIDES:
            ctx.leg_fk(s, hip_flex=88, knee=90 if bent else 0, ankle=-15)
            ctx.arm_fk(s, abd=80)

    spec(id_, camera=cam((0, 0.0, 0.35), 0, 35, 3.6), setup=nothing,
         timing=dict(hold_start=0.0, out=0.5, hold_end=0.0))(pose)


lying_wiper('lying-windshield-wiper', False)
lying_wiper('lying-windshield-wiper-with-bent-knees', True)


@spec('dragon-flag', camera=cam((0, 0.3, 0.8), 75, 12, 4.0),
      setup=lambda ctx: (ctx.eq.flat_bench((0, 0.2)), {})[1])
def dragon_flag(ctx, st, u):
    # Lying on a bench gripping it behind the head; the rigid body lowers from vertical on the shoulders.
    t = smootherstep(u)
    theta = lerp(70, 8, t)
    ctx.pin_root(M.joint('shoulder') - Vector((M.joint('shoulder').x, 0, 0)), Vector((0, 0.68, 0.55)), (-90 - theta, 0, 0))
    ctx.head(flex=30)
    for s in SIDES:
        ctx.leg_fk(s, ankle=-25)
        ctx.grip(s, (sgn(s) * 0.12, 0.82, 0.44), (-sgn(s), 0, 0))
        ctx.pole_world('arm.' + s, (sgn(s) * 0.4, 0, 1))


# ---------------------------------------------------------------------------------------------
# Hanging and supported leg raises


def hang_raise(id_, chair=False, knees=False, situp=False, wiper=False):
    def setup(ctx):
        if chair:
            ctx.eq.captains_chair()
            return {}
        return {'bar': ctx.eq.pullup_bar()}

    def pose(ctx, st, u):
        t = smootherstep(u)
        if chair:
            # Forearms on the pads, back against the pad, legs hanging.
            ctx.root((0, 0.06, 1.27))
            for s in SIDES:
                ctx.arm_fk(s, flex=0, abd=4, elbow=88, twist=0)
        else:
            bar = st['bar']
            ctx.root((0, 0.03, bar.z - 1.06))
            for s in SIDES:
                ctx.grip(s, Vector((sgn(s) * 0.3, bar.y, bar.z)), (-sgn(s), 0, 0))
            elbows(ctx, (0.7, -0.05, -1))
        tuck = knees or situp  # a hanging sit-up is shown as a full knees-to-chest tuck
        if wiper:
            w = wave(ctx)
            ctx.bone('pelvis', (Z, 50 * w))
            ctx.spine(twist=-45 * w)
            for s in SIDES:
                ctx.leg_fk(s, hip_flex=88, ankle=-20)
            return
        ctx.bone('pelvis', (X, -12 * t))
        ctx.spine(flex=22 * t)
        for s in SIDES:
            if tuck:
                ctx.leg_fk(s, hip_flex=lerp(5, 110, t), knee=lerp(10, 110, t), ankle=-20)
            else:
                ctx.leg_fk(s, hip_flex=lerp(5, 95, t), knee=4, ankle=-20)

    timing = dict(hold_start=0.0, out=0.5, hold_end=0.0) if wiper else {}
    spec(id_, camera=cam((0, 0, 1.3 if not chair else 1.1), 62, 6, 4.6), setup=setup, concentric='out',
         timing=timing)(pose)


hang_raise('hanging-leg-raise')
hang_raise('hanging-knee-raise', knees=True)
hang_raise('hanging-sit-up', situp=True)
hang_raise('hanging-windshield-wiper', wiper=True)
hang_raise('captains-chair-knee-raise', chair=True, knees=True)
hang_raise('captains-chair-leg-raise', chair=True)


@spec('l-sit', camera=cam((0, 0.0, 0.35), 60, 10, 3.6), setup=lambda ctx: _parallettes(ctx), **HOLD)
def l_sit(ctx, st, u):
    # Pressed up on straight arms, legs straight out level with the hips.
    ctx.root((0, 0.03, 0.4))
    ctx.spine(flex=12)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=88, ankle=-25)
        ctx.grip(s, (sgn(s) * 0.27, 0.0, 0.2), (0, -1, 0))
    elbows(ctx, (0.2, 1, 0))
    orbit(ctx, (0, 0.0, 0.4), 50, 90, 10, 3.6, u)


def _parallettes(ctx):
    parts = []
    for s in (1, -1):
        parts.append(ctx.eq.cyl('pb', 0.02, 0.4, (s * 0.27, 0, 0.2), (math.pi / 2, 0, 0), ctx.eq.m_metal, 16))
        for e in (1, -1):
            parts.append(ctx.eq.frame('pl', (0.04, 0.04, 0.2), (s * 0.27, e * 0.17, 0.1)))
    ctx.eq.group('parallettes', parts)
    return {}


@spec('kneeling-ab-wheel-roll-out', camera=cam((0, -0.3, 0.35), 75, 12, 3.8),
      setup=lambda ctx: {'wheel': ctx.eq.group('wheel', [ctx.eq.cyl('wh', 0.09, 0.06, (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_pad, 32),
                                                          ctx.eq.cyl('ax', 0.014, 0.34, (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_metal, 16)])},
      concentric='back')
def ab_wheel(ctx, st, u):
    # Kneeling with straight arms on the wheel; roll out until the body is nearly flat, then pull back.
    t = smootherstep(u)
    knee = Vector((0, 0.3, 0.06))
    theta = lerp(30, 75, t)
    hip_ext = lerp(70, 10, t)
    ctx.pin_root(M.joint('knee'), knee + Vector((0, 0, 0.0)), (theta, 0, 0))
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=hip_ext, knee=90, ankle=-30)
    ctx.pin_root(M.joint('pelvis'), ctx.world('pelvis', 'head'), (theta, 0, 0))
    ctx.head(flex=-20)
    sh = shoulders(ctx)
    wheel = Vector((0, sh.y - lerp(0.25, 0.55, t), 0.09))
    place(st['wheel'], wheel)
    for s in SIDES:
        ctx.grip(s, wheel + Vector((sgn(s) * 0.13, 0, 0)), (-sgn(s), 0, 0))
    elbows(ctx, (0.1, 1, 0))


# ---------------------------------------------------------------------------------------------
# Rotation and anti-rotation


def _side_cable(height):
    def setup(ctx):
        ctx.eq.cable_column(0.95, 0.0, 2.1)
        return {'pulley': Vector((0.86, -0.09, height)), 'cable': ctx.eq.line('cable'),
                'h': ctx.eq.group('dh', [ctx.eq.cyl('dhc', 0.016, 0.12, (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_metal, 16)])}

    return setup


def _side_band(height):
    def setup(ctx):
        ctx.eq.group('anchor', [ctx.eq.frame('post', (0.1, 0.1, 2.0), (1.0, 0.0, 1.0))])
        return {'pulley': Vector((0.95, 0.0, height)), 'cable': ctx.eq.line('band', accent=True, radius=0.009),
                'h': ctx.eq.group('dh', [ctx.eq.cyl('dhc', 0.016, 0.12, (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_pad, 16)])}

    return setup


@spec('pallof-press', camera=cam((0, 0.0, 1.1), 20, 8, 4.0), setup=_side_cable(1.15), concentric='out')
def pallof_press(ctx, st, u):
    # Side-on to the cable, hands at the sternum press straight out and resist the twist.
    stand(ctx, width=0.08)
    knees_out(ctx, 0.2)
    ctx.arm.location.z -= 0.04
    t = smootherstep(u)
    sh = shoulders(ctx)
    p = Vector((0, sh.y - lerp(0.18, 0.5, t), sh.z - 0.22))
    for s in SIDES:
        ctx.grip(s, p + Vector((sgn(s) * 0.03, 0, 0)), (0, 0, 1))
    place(st['h'], p, along((0, 0, 1)))
    set_line(st['cable'], st['pulley'], p)
    elbows(ctx, (0.5, 0.3, -1))


def chop_spec(id_, start_z, end_z, setup):
    def pose(ctx, st, u):
        # Both hands on the handle sweep diagonally across the body, the torso and hips turning with it.
        stand(ctx, width=0.14, toe_out=10)
        t = smootherstep(u)
        turn = lerp(45, -45, t)
        ctx.spine(twist=turn * 0.9, flex=8 + 10 * abs(end_z - start_z) * t)
        ctx.bone('pelvis', (Z, turn * 0.35))
        sh = shoulders(ctx)
        a = math.radians(turn)
        reach = 0.52
        p = Vector((math.sin(a) * reach, sh.y - math.cos(a) * reach * 0.8, lerp(start_z, end_z, t)))
        for s in SIDES:
            ctx.grip(s, p + Vector((0, 0, 0.04 * sgn(s))), (0, 0, 1))
        place(st['h'], p, along((0, 0, 1)))
        set_line(st['cable'], st['pulley'], p)
        elbows(ctx, (0.4, 0.4, -1))

    spec(id_, camera=cam((0, 0.0, 1.1), 15, 8, 4.0), setup=setup, concentric='out')(pose)


chop_spec('cable-machine-wood-chop-high-to-low', 1.75, 0.65, _side_cable(1.9))
chop_spec('cable-machine-wood-chop-low-to-high', 0.6, 1.7, _side_cable(0.2))
chop_spec('horizontal-wood-chop-with-cable', 1.25, 1.2, _side_cable(1.25))
chop_spec('high-to-low-wood-chop-with-band', 1.75, 0.65, _side_band(1.9))
chop_spec('band-wood-chop-low-to-high', 0.6, 1.7, _side_band(0.2))
chop_spec('horizontal-wood-chop-with-band', 1.25, 1.2, _side_band(1.25))


@spec('side-bend', camera=cam((0, 0, 1.0), 5, 8, 3.8), setup=lambda ctx: {'w': ctx.eq.dumbbell('db')}, concentric='back')
def side_bend(ctx, st, u):
    # A dumbbell in the right hand; bend sideways toward it, then stand tall.
    stand(ctx, width=0.06)
    t = smootherstep(u)
    ctx.spine(side=-28 * t)
    sh = ctx.world('upperarm.R', 'head')
    hold_dumbbell(ctx, st['w'], 'R', ctx.grip_hang('R', sh.y, abs(sh.x) + 0.03), Vector((0, -1, 0)))
    hands_behind_head_one(ctx, 'L')


def hands_behind_head_one(ctx, side):
    ctx.arm_fk(side, flex=150, abd=55, elbow=140, rot=40)


@spec('core-twist', camera=cam((0, 0.0, 0.5), 20, 14, 3.4), setup=lambda ctx: {'ball': ctx.eq.medicine_ball()},
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0))
def core_twist(ctx, st, u):
    # Seated V with the feet up; the ball swings side to side as the torso rotates.
    ctx.root((0, 0.0, 0.16), (-35, 0, 0))
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=95, knee=80, ankle=-20)
    w = wave(ctx)
    ctx.spine(flex=-10, twist=50 * w)
    hands = []
    for s in SIDES:
        ctx.arm_fk(s, flex=60, abd=-25, elbow=70, rot=50)
        hands.append(ctx.attach_point('hand.' + s, grip_point(s)))
    place(st['ball'], (hands[0] + hands[1]) / 2 + Vector((0, -0.04, 0)))


def _landmine_rot(ctx):
    anchor, line = ctx.eq.landmine((0, -1.45, 0.04))
    return {'anchor': anchor, 'bar': line}


@spec('landmine-rotation', camera=cam((0, -0.4, 1.0), 20, 10, 4.2), setup=_landmine_rot,
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0))
def landmine_rotation(ctx, st, u):
    # Arms long, the bar end sweeps in an arc from one hip to the other, the torso turning with it.
    stand(ctx, width=0.12)
    w = wave(ctx)
    ctx.spine(twist=-40 * w)
    ctx.bone('pelvis', (Z, -15 * w))
    a = math.radians(55 * w)
    end = Vector((math.sin(a) * 0.5, -0.45 + 0.1 * abs(w), 1.45 - 0.35 * abs(w)))
    for s in SIDES:
        ctx.grip(s, end + Vector((0, 0, 0.04 * sgn(s))), (0, -0.4, 1))
    set_line(st['bar'], st['anchor'], end + Vector((0, -0.05, 0.02)))
    elbows(ctx, (0.3, 0.3, -1))


@spec('mountain-climbers', camera=cam((0, 0.1, 0.35), 70, 12, 3.8), setup=nothing,
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0))
def mountain_climbers(ctx, st, u):
    high_plank(ctx)
    w = wave(ctx, 2)
    for s in SIDES:
        k = max(0.0, w if s == 'L' else -w)
        if k > 0.05:
            ctx.leg_fk(s, hip_flex=lerp(0, 95, k), knee=lerp(0, 110, k), ankle=-20)


@spec('kettlebell-halo', camera=cam((0, 0, 1.3), 30, 10, 3.6), setup=lambda ctx: {'kb': ctx.eq.kettlebell()},
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0))
def kettlebell_halo(ctx, st, u):
    # Bell upside down by the horns, circled around the head.
    stand(ctx, width=0.05)
    a = 2 * math.pi * getattr(ctx, 't', 0.0)
    head = ctx.world('head', 'head') + Vector((0, 0, 0.08))
    p = head + Vector((math.sin(a) * 0.2, -math.cos(a) * 0.2, 0))
    for s in SIDES:
        ctx.grip(s, p + Vector((sgn(s) * 0.05, 0, -0.02)), (0, 0, 1))
    place(st['kb'], p + Vector((0, 0, 0.05)), qx(180))
    elbows(ctx, (0.6, 0.2, -1))


@spec('superman-raise', camera=cam((0, 0.0, 0.25), 75, 14, 3.6), setup=nothing, concentric='out')
def superman_raise(ctx, st, u):
    # Face down, arms overhead; chest, arms and legs lift off the floor together.
    t = smootherstep(u)
    ctx.root((0, 0.0, 0.11), (90, 0, 0))
    ctx.spine(flex=-28 * t)
    ctx.head(flex=-10 * t)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=-18 * t, ankle=-30)
        ctx.arm_fk(s, flex=170 + 15 * t, abd=8)


@spec('banded-hip-march', camera=cam((0, 0.0, 0.3), 70, 14, 3.6), setup=nothing,
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0))
def banded_hip_march(ctx, st, u):
    # Hold a glute bridge and march: one knee drives up, then the other.
    from catalog_glutes import bridge_pose

    bridge_pose(ctx, 1.0)
    w = wave(ctx)
    for s in SIDES:
        k = max(0.0, w if s == 'L' else -w)
        if k > 0.05:
            # The foot lifts and the knee draws toward the chest, knee still bent ~90°.
            foot = ctx.body.targets['leg.' + s].location.copy()
            ctx.target('leg.' + s, foot + Vector((0, 0.18 * k, 0.3 * k)))


@spec('standing-hip-flexor-raise', camera=cam((0, 0, 0.9), 70, 8, 3.8), setup=nothing,
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0))
def standing_hip_flexor_raise(ctx, st, u):
    stand(ctx, width=0.03)
    w = wave(ctx)
    for s in SIDES:
        k = max(0.0, w if s == 'L' else -w)
        if k > 0.05:
            ctx.leg_fk(s, hip_flex=95 * k, knee=95 * k)
    for s in SIDES:
        ctx.arm_fk(s, abd=10)


@spec('front-hold', camera=cam((0, 0, 1.1), 50, 8, 3.8), setup=lambda ctx: {'plate': ctx.eq.plate()}, **HOLD)
def front_hold(ctx, st, u):
    # A plate held out at shoulder height on straight arms.
    stand(ctx, width=0.04)
    for s in SIDES:
        ctx.arm_fk(s, flex=88, abd=-8, twist=0)
    hands = [ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES]
    place(st['plate'], (hands[0] + hands[1]) / 2)
    orbit(ctx, (0, 0, 1.1), 30, 70, 8, 3.8, u)


@spec('kettlebell-plank-pull-through', camera=cam((0, 0.1, 0.35), 20, 18, 3.8), setup=lambda ctx: {'kb': ctx.eq.kettlebell()},
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0))
def kb_pull_through(ctx, st, u):
    # High plank; one hand reaches under the body and drags the bell across to the other side.
    high_plank(ctx)
    w = wave(ctx)
    side = 'R' if w > 0 else 'L'
    k = abs(w)
    sh = ctx.world('upperarm.' + side, 'head')
    far = Vector((-sgn(side) * 0.3, sh.y + 0.15, 0.05))
    near = Vector((sgn(side) * 0.3, sh.y + 0.15, 0.05))
    p = far.lerp(near, smootherstep(k))
    ctx.grip(side, p + Vector((0, 0, 0.17)), (1, 0, 0))
    ctx.pole_world('arm.' + side, (sgn(side), 0.3, 0.6))
    place(st['kb'], p + Vector((0, 0, 0.17)))


# ---------------------------------------------------------------------------------------------
# Floor to standing


@spec('prisoner-get-up', camera=cam((0, 0.0, 0.7), 70, 8, 3.9), setup=nothing, concentric='back')
def prisoner_get_up(ctx, st, u):
    # Hands behind the head: kneel down one knee at a time, then step back up.
    t = smootherstep(u)
    ctx.root((0, 0.0, lerp(STAND_Z, 0.62, t)))
    for i, s in enumerate(SIDES):
        k = smootherstep(min(max((u - 0.45 * i) / 0.55, 0.0), 1.0))
        stand_foot = Vector((sgn(s) * 0.1, 0.01, 0.085))
        kneel_ankle = Vector((sgn(s) * 0.1, 0.43, 0.08))
        ctx.target('leg.' + s, stand_foot.lerp(kneel_ankle, k), qx(-80 * k) @ ctx.body.rest_quat('foot.' + s))
        ctx.pole_world('leg.' + s, (0, -1, -0.3 * k))
    hands_behind_head(ctx)


@spec('turkish-get-up', camera=cam((0, 0.0, 0.5), 60, 14, 4.0), setup=lambda ctx: {'kb': ctx.eq.kettlebell()},
      concentric='out')
def turkish_get_up(ctx, st, u):
    # First half of the get-up: lying with the bell pressed up, roll to the left elbow, then the hand.
    t = smootherstep(u)
    sit_up = lerp(0, 55, t)
    ctx.root((0.06 * t, 0.0, 0.11 + 0.1 * t), (-90 + sit_up, 15 * t, 0))
    ctx.target('leg.R', (-0.18, -0.5, 0.085))
    ctx.pole_world('leg.R', (-0.2, 0, 1))
    ctx.leg_fk('L', hip_flex=5, hip_abd=20)
    sh = ctx.world('upperarm.R', 'head')
    up = Vector((sh.x, sh.y, sh.z + M.grip_reach() * 0.98))
    ctx.grip('R', up, (1, 0, 0))
    place(st['kb'], up, qx(180))
    shl = ctx.world('upperarm.L', 'head')
    ctx.target('arm.L', (shl.x + 0.25, shl.y - 0.1, 0.06))
    ctx.pole_world('arm.L', (1, 0.3, 0.2))


@spec('wall-walk', camera=cam((0, 0.3, 0.9), 75, 10, 4.4),
      setup=lambda ctx: (ctx.eq.group('wall', [ctx.eq.pad('w', (2.0, 0.1, 2.4), (0, 1.45, 1.2))]), {})[1], concentric='out')
def wall_walk(ctx, st, u):
    # Start lying chest-down with the feet against the wall; press up, walk the feet up the wall
    # and the hands in, finishing in a handstand with the belly to the wall and arms locked.
    t = smootherstep(u)
    theta = lerp(90, 178, t)
    pelvis = Vector((0, 0.44, 0.13)).lerp(Vector((0, 1.17, 1.1)), t)
    pelvis.z += 0.35 * math.sin(math.pi * t) * 0.6
    ctx.root(pelvis, (theta, 0, 0))
    ctx.head(flex=-30)
    press = smootherstep(min(u / 0.25, 1.0))
    for s in SIDES:
        ctx.leg_fk(s, ankle=-30)
        sh_y = pelvis.y - 0.47 * math.sin(math.radians(theta))
        ctx.target('arm.' + s, (sgn(s) * 0.2, lerp(sh_y, 1.15, t), 0.08))
        ctx.pole_world('arm.' + s, (0, 1, 0))
    ctx.arm.location.z += 0.25 * press * (1 - t)

