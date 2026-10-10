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
    pitch = 79.6 if not knees else 72
    z = 0.255
    ctx.root((0, 0.0, z), (pitch, 0, 0))
    ctx.head(flex=-60)
    for s in SIDES:
        ctx.leg_fk(s, ankle=-5, knee=0 if not knees else 95)
    if knees:
        # Straight from knees to head: drop the body until the kneecaps rest on the floor, which
        # leaves the shoulders at forearm height so the elbows sit under them.
        ctx.arm.location.z += 0.07 - ctx.world('shin.L', 'head').z
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


def _ramp(t, a, b):
    """0 before a, 1 after b, smooth in between."""
    return smootherstep(min(max((t - a) / (b - a), 0.0), 1.0))


P2P_LOW = ((0, 0.0, 0.255), (79.6, 0, 0))  # forearm plank
P2P_HIGH = ((0, 0.0, 0.6), (68, 0, 0))  # straight-arm plank


@spec('plank-to-push-up', camera=cam((0, 0.05, 0.3), 70, 12, 3.8), setup=nothing,
      timing=dict(hold_start=0.0, out=1.0, hold_end=0.0), concentric='out')
def plank_to_push_up(ctx, st, u):
    # Forearm plank up to a straight-arm plank one hand at a time, then down one arm at a time.
    # Two reps per loop so the lead arm alternates: right leads the first, left the second.
    t = getattr(ctx, 't', 0.0)
    h = (t * 2) % 1.0
    lead, other = ('R', 'L') if t < 0.5 else ('L', 'R')
    k = {lead: _ramp(h, 0.03, 0.19) - _ramp(h, 0.53, 0.69),
         other: _ramp(h, 0.24, 0.40) - _ramp(h, 0.74, 0.90)}
    # Hands land at fixed spots on the floor: the forearm spot under the low plank's shoulders and
    # the palm spot under the high plank's.
    spots = {}
    for name, (loc, rot) in (('low', P2P_LOW), ('high', P2P_HIGH)):
        ctx.root(loc, rot)
        spots[name] = {s: ctx.world('upperarm.' + s, 'head') for s in SIDES}
    # The torso climbs as each hand plants.
    m = (k['L'] + k['R']) / 2
    ctx.root(lerp(P2P_LOW[0], P2P_HIGH[0], m), lerp(P2P_LOW[1], P2P_HIGH[1], m))
    ctx.head(flex=-55)
    for s in SIDES:
        ctx.leg_fk(s, ankle=lerp(-5, -15, m))
        lo, hi = spots['low'][s], spots['high'][s]
        forearm = Vector((lo.x, lo.y - 0.25, 0.045))
        hand = Vector((hi.x, hi.y - 0.02, 0.08))
        p = forearm.lerp(hand, k[s]) + Vector((0, 0, 0.08 * math.sin(math.pi * k[s])))
        ctx.target('arm.' + s, p)
        ctx.pole_world('arm.' + s, Vector((0, 0, -1)).lerp(Vector((0, 1, 0)), k[s]))


@spec('copenhagen-plank', camera=cam((0, 0.0, 0.35), 0, 12, 4.0),
      setup=lambda ctx: (ctx.eq.flat_bench((-0.9, 0.0), length=0.5, height=0.32, yaw=90), {})[1], **HOLD)
def copenhagen_plank(ctx, st, u):
    # Side plank on the forearm with the top leg resting on a low bench; the bottom leg hangs
    # free. The shoulder sits at forearm height so the elbow lands under it.
    ctx.root((-0.05, 0.0, 0.34), (0, 82, 0))
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
    # The forearm and feet stay planted: roll the trunk about the support shoulder so the hips
    # sag, and abduct the legs back the same amount so the feet stay on the floor.
    d = smootherstep(1 - u)
    sh = ctx.world('upperarm.L', 'head')
    ctx.pin_root(M.joint('shoulder'), sh, (0, 78 - 14 * d, 0))
    for s in SIDES:
        ctx.leg_fk(s, hip_abd=-sgn(s) * 14 * d, ankle=-5)


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


def crunch_spec(id_, depth=32, situp=False, hands='head', twist=0.0, cable=False, machine=False, knees_down=0.0,
                alternate=False, anchor=False):
    """knees_down: both knees dropped this far (degrees) to one side, shoulders still crunching
    straight up. alternate: twist to one side then the other within the loop. anchor: a pad
    over the insteps."""

    def setup(ctx):
        st = {}
        if anchor:
            # A roller just above the insteps, on short legs, holding the feet down.
            ctx.eq.group('foot_anchor', [
                ctx.eq.cyl('foot_roller', 0.05, 0.42, (0, -0.63, 0.16), (0, math.pi / 2, 0), ctx.eq.m_pad, 24),
                ctx.eq.frame('anchor_leg', (0.04, 0.04, 0.16), (0.23, -0.63, 0.08)),
                ctx.eq.frame('anchor_leg', (0.04, 0.04, 0.16), (-0.23, -0.63, 0.08)),
            ])
        if cable:
            ctx.eq.cable_column(0, 0.6, 2.1)
            st['pulley'] = Vector((0, 0.51, 1.9))
            st['cable'] = ctx.eq.line('cable')
            st['ropes'] = [ctx.eq.line('rL', radius=0.012), ctx.eq.line('rR', radius=0.012)]
        if machine:
            ctx.eq.group('crunch_machine', [
                ctx.eq.pad('seat', (0.42, 0.42, 0.08), (0, 0.05, 0.45)),
                ctx.eq.frame('post', (0.1, 0.1, 0.45), (0, 0.1, 0.22)),
                ctx.eq.frame('column', (0.08, 0.08, 1.6), (0, 0.35, 0.8)),
                # Footrest and a roller over the shins secure the feet.
                ctx.eq.frame('foot_rail', (0.06, 0.5, 0.04), (0, -0.15, 0.06)),
                ctx.eq.pad('foot_plate', (0.36, 0.2, 0.04), (0, -0.38, 0.06)),
                ctx.eq.cyl('foot_roller', 0.045, 0.4, (0, -0.47, 0.3), (0, math.pi / 2, 0), ctx.eq.m_pad, 24),
                ctx.eq.frame('roller_post', (0.04, 0.04, 0.26), (0, -0.47, 0.15)),
            ])
            # The chest pad and handles ride on the machine's arm, so they move with the chest
            # (rest-pose positions: pad on the sternum, handles beside the head).
            parts = [ctx.eq.pad('chest_pad', (0.36, 0.06, 0.24), (0, -0.2, 1.3))]
            for x in (0.17, -0.17):
                parts.append(ctx.eq.cyl('handle', 0.016, 0.14, (x, -0.1, 1.58), (math.pi / 2, 0, 0), ctx.eq.m_metal, 16))
                parts.append(ctx.eq.frame('handle_arm', (0.03, 0.03, 0.34), (x, -0.1, 1.42)))
            st['pad'] = ctx.eq.group('crunch_arm', parts)
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
            # The pad stays on the chest and the hands hold the handles beside the head.
            ctx.follow(st['pad'], 'chest', (0, 0, 0))
            fwd = ctx.bone_delta('chest') @ Vector((0, -1, 0))
            for s in SIDES:
                ctx.grip(s, ctx.attach_point('chest', (sgn(s) * 0.17, -0.1, 1.58)), fwd)
            elbows(ctx, (0.3, -0.2, -1))
            return
        tw = twist
        if alternate:
            # One rep to each side per loop: u is unused, the twist sign follows loop time.
            w = wave(ctx)
            t = smootherstep(abs(w))
            tw = twist if w >= 0 else -twist
        if knees_down:
            # Knees fall to one side with the hips; the spine untwists so the shoulders face up.
            supine(ctx, knees=False, z=0.14)  # the hips on their side sit higher
            ctx.bone('pelvis', (Z, knees_down))
            for s in SIDES:
                ctx.leg_fk(s, hip_flex=75, knee=100, ankle=-10)
        else:
            supine(ctx)
        if situp:
            ctx.bone('pelvis', (X, 62 * t))
            ctx.spine(flex=25 * t, twist=tw * t)
        elif knees_down:
            ctx.spine(flex=depth * t, twist=-knees_down)
        else:
            ctx.spine(flex=depth * t, twist=tw * t)
        ctx.head(flex=15 * t)
        if hands == 'head':
            hands_behind_head(ctx)
        elif hands == 'cross':
            arms_crossed(ctx)
        elif hands == 'reach':
            for s in SIDES:
                ctx.arm_fk(s, flex=lerp(30, 70, t), abd=6)

    cam_ = cam((0, 0.2, 0.3), 75, 14, 3.4) if not (cable or machine) else cam((0, 0.0, 0.8), 70, 10, 3.6)
    timing = dict(hold_start=0.0, out=0.5, hold_end=0.0) if alternate else {}
    spec(id_, camera=cam_, setup=setup, concentric='out', timing=timing)(pose)


crunch_spec('crunch')
crunch_spec('sit-up', situp=True, hands='cross')
crunch_spec('oblique-crunch', knees_down=-80)
crunch_spec('oblique-sit-up', situp=True, twist=30, hands='head', alternate=True, anchor=True)
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


@spec('hollow-hold', camera=cam((0, 0.25, 0.25), 75, 12, 4.4), setup=nothing, **HOLD)
def hollow_hold(ctx, st, u):
    supine(ctx, knees=False)
    ctx.spine(flex=22)
    ctx.head(flex=12)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=22, ankle=-25)
        ctx.arm_fk(s, flex=165, abd=-4)
    orbit(ctx, (0, 0.25, 0.25), 60, 100, 12, 4.4, u)


@spec('hollow-body-crunch', camera=cam((0, 0.25, 0.25), 75, 12, 4.4), setup=nothing, concentric='out')
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


def hang_raise(id_, chair=False, knees=False, wiper=False):
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
        tuck = knees
        if wiper:
            # Straight legs raised up toward the bar (pelvis tucked), then swept side to side.
            w = wave(ctx)
            ctx.bone('pelvis', (X, -30), (Z, 50 * w))
            ctx.spine(flex=20, twist=-45 * w)
            for s in SIDES:
                ctx.leg_fk(s, hip_flex=130, ankle=-20)
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
hang_raise('hanging-windshield-wiper', wiper=True)
hang_raise('captains-chair-knee-raise', chair=True, knees=True)
hang_raise('captains-chair-leg-raise', chair=True)


@spec('hanging-sit-up', camera=cam((0, 0, 1.4), 70, 6, 4.6), setup=lambda ctx: {'bar': ctx.eq.pullup_bar()},
      concentric='out')
def hanging_sit_up(ctx, st, u):
    # Hanging upside down with the knees hooked over the bar, arms crossed on the chest; the torso
    # curls up toward the knees while the thighs stay vertical.
    bar = st['bar']
    t = smootherstep(u)
    a = lerp(0, 55, t)
    # Back of the knee over the bar: the thigh hangs straight down from it, the shin folds over.
    knee = Vector((0, bar.y + 0.06, bar.z + 0.02))
    hip = knee - Vector((0, 0, M.joint('hip').z - M.joint('knee').z))
    ctx.pin_root(Vector((0, 0, M.joint('hip').z)), hip, (180 + a, 0, 0))
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=a, knee=105, ankle=-20)
    ctx.spine(flex=lerp(0, 55, t))
    ctx.head(flex=lerp(0, 20, t))
    arms_crossed(ctx)


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


@spec('pallof-press', camera=cam((0, -0.1, 1.05), 55, 22, 4.0), setup=_side_cable(1.15), concentric='out')
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


def chop_spec(id_, start_el, end_el, setup):
    def pose(ctx, st, u):
        # Both hands on the handle sweep across the body at arm's length, the torso and hips turning
        # with it. The handle is aimed from the shoulders along the chest's heading, at an elevation
        # going from start_el to end_el (degrees), so the arms stay long and the hands can always
        # reach it: low ends sit at hip height, high ends above the shoulder.
        stand(ctx, width=0.14, toe_out=10)
        t = smootherstep(u)
        turn = lerp(50, -50, t)
        el = lerp(start_el, end_el, t)
        low = max(0.0, -math.sin(math.radians(el)))
        ctx.arm.location.z -= 0.05 * low  # soft knees as the hands come down to the hip
        knees_out(ctx, 0.2)
        ctx.spine(twist=turn * 0.9, flex=6 + 14 * low)
        ctx.bone('pelvis', (Z, turn * 0.35))
        sh = shoulders(ctx)
        a, e = math.radians(turn), math.radians(el)
        reach = 0.54
        p = sh + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * reach
        for s in SIDES:
            ctx.grip(s, p + Vector((0, 0, 0.04 * sgn(s))), (0, 0, 1))
        place(st['h'], p, along((0, 0, 1)))
        set_line(st['cable'], st['pulley'], p)
        elbows(ctx, (0.4, 0.4, -1))

    spec(id_, camera=cam((0, 0.0, 1.1), 15, 8, 4.0), setup=setup, concentric='out')(pose)


chop_spec('cable-machine-wood-chop-high-to-low', 35, -55, _side_cable(1.9))
chop_spec('cable-machine-wood-chop-low-to-high', -55, 35, _side_cable(0.2))
chop_spec('horizontal-wood-chop-with-cable', -15, -15, _side_cable(1.25))
chop_spec('high-to-low-wood-chop-with-band', 35, -55, _side_band(1.9))
chop_spec('band-wood-chop-low-to-high', -55, 35, _side_band(0.2))
chop_spec('horizontal-wood-chop-with-band', -15, -15, _side_band(1.25))


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
    # Ball held low in front of the chest; a little side bend with the twist brings it to each hip.
    ctx.spine(flex=-10, twist=50 * w, side=10 * w)
    hands = []
    for s in SIDES:
        ctx.arm_fk(s, flex=30, abd=-15, elbow=40, rot=35)
        hands.append(ctx.attach_point('hand.' + s, grip_point(s)))
    place(st['ball'], (hands[0] + hands[1]) / 2 + Vector((0, -0.04, 0)))


def _landmine_rot(ctx):
    anchor, line = ctx.eq.landmine((0, -1.45, 0.04))
    return {'anchor': anchor, 'bar': line}


def _heel_up(ctx, side, ankle, deg, yaw=0.0):
    """Foot target with the heel raised `deg` on the ball of the foot, turned `yaw` about it."""
    from catalog_power import BALL, on_toes

    ball = Vector(ankle) + BALL
    lifted, tilt = on_toes(ankle, deg)
    q = qz(yaw)
    ctx.target('leg.' + side, ball + q @ (lifted - ball), q @ tilt @ ctx.body.rest_quat('foot.' + side))


@spec('landmine-rotation', camera=cam((0, -0.6, 0.8), 20, 12, 4.8), setup=_landmine_rot,
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0))
def landmine_rotation(ctx, st, u):
    # Arms long, the bar end sweeps in an arc from one hip, up past the face, down to the other,
    # the hips turning with it and the back heel pivoting.
    stand(ctx, width=0.12)
    w = wave(ctx)
    ctx.spine(twist=-55 * w)
    ctx.bone('pelvis', (Z, -25 * w))
    a = math.radians(70 * w)
    end = Vector((math.sin(a) * 0.55, -0.55 + 0.1 * abs(w), 1.5 - 0.55 * abs(w)))
    for s in SIDES:
        ctx.grip(s, end + Vector((0, 0, 0.04 * sgn(s))), (0, -0.4, 1))
    # The foot away from the bar end rolls onto its toes and turns in as the hips rotate.
    for s in SIDES:
        k = max(0.0, -sgn(s) * w)
        if k > 0.02:
            ankle = Vector((sgn(s) * (0.098 + 0.12), 0.01, 0.085))
            _heel_up(ctx, s, ankle, 35 * smootherstep(k), -sgn(s) * 20 * smootherstep(k))
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
            # The knee drives under the chest with the foot hovering beneath the hips (a plank is
            # already pitched ~70°, so the thigh needs well past 90° of hip flexion to come forward).
            ctx.leg_fk(s, hip_flex=lerp(0, 125, k), knee=lerp(0, 85, k), ankle=lerp(-20, 10, k))


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


@spec('superman-raise', camera=cam((0, -0.1, 0.25), 75, 14, 4.5), setup=nothing, concentric='out')
def superman_raise(ctx, st, u):
    # Face down, arms overhead; chest, arms and legs lift off the floor together.
    t = smootherstep(u)
    ctx.root((0, 0.0, 0.11), (90, 0, 0))
    ctx.spine(flex=-28 * t)
    ctx.head(flex=-10 * t)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=-18 * t, ankle=-30)
        ctx.arm_fk(s, flex=170 + 15 * t, abd=8)


@spec('banded-hip-march', camera=cam((0, 0, 0.9), 60, 8, 3.8),
      setup=lambda ctx: {'band': ctx.eq.line('band', accent=True, radius=0.008)},
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0))
def banded_hip_march(ctx, st, u):
    # Standing tall with a mini band round the middle of both feet: one knee drives up to hip
    # height against the band, then the other, without leaning back.
    stand(ctx, width=0.05)
    w = wave(ctx)
    for s in SIDES:
        k = smootherstep(max(0.0, w if s == 'L' else -w))
        if k > 0.02:
            ctx.leg_fk(s, hip_flex=90 * k, knee=90 * k, ankle=-10 * k)
        ctx.arm_fk(s, flex=10, abd=8, elbow=15)
    mid = [ctx.attach_point('foot.' + s, (sgn(s) * 0.1, -0.05, 0.04)) for s in SIDES]
    set_line(st['band'], mid[0], mid[1])


STEP_H = 0.15


def _hip_flexor_setup(ctx):
    # A low step under the standing (left) foot and a cuff weight on the right ankle.
    ctx.eq.plyo_box((0.13, -0.03), height=STEP_H, size=(0.26, 0.4), name='step')
    cuff = ctx.eq.group('cuff', [ctx.eq.cyl('cuff', 0.055, 0.08, (0, 0, 0), mat=ctx.eq.m_pad, verts=24)])
    return {'cuff': cuff}


@spec('standing-hip-flexor-raise', camera=cam((0, 0, 1.0), 60, 8, 3.9), setup=_hip_flexor_setup,
      concentric='out')
def standing_hip_flexor_raise(ctx, st, u):
    # On the step on the left leg, the weighted right foot hangs free below it; raise that knee
    # toward the chest and lower it slowly.
    stand(ctx, width=0.03, floor=STEP_H)
    t = smootherstep(u)
    ctx.leg_fk('R', hip_flex=lerp(-3, 100, t), knee=lerp(5, 90, t), ankle=lerp(-5, -10, t))
    ctx.follow(st['cuff'], 'shin.R', (-0.1, 0.01, 0.15))
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


@spec('prisoner-get-up', camera=cam((0, -0.2, 0.7), 70, 8, 3.9), setup=nothing,
      timing=dict(hold_start=0.0, out=1.0, hold_end=0.0), concentric='out')
def prisoner_get_up(ctx, st, u):
    # Hands behind the head, kneeling tall: step one foot forward, stand up over it, then kneel
    # back down one leg at a time. Two reps per loop so the lead leg alternates.
    t = getattr(ctx, 't', 0.0)
    h = (t * 2) % 1.0
    lead = 'L' if t < 0.5 else 'R'
    tucked = lambda y: (Vector((0, y + 0.40, 0.12)), 75)  # toes tucked under, knee on the floor
    flat = lambda y: (Vector((0, y, 0.085)), 0)
    # (root, lead foot, trail foot): kneeling tall, half-kneeling, standing over the lead foot.
    kneel = (Vector((0, 0, 0.52)), tucked(0), tucked(0))
    half = (Vector((0, 0, 0.52)), flat(-0.45), tucked(0))
    up = (Vector((0, -0.44, STAND_Z)), flat(-0.44), flat(-0.44))
    keys = [(0.06, kneel), (0.22, half), (0.28, half), (0.48, up), (0.56, up), (0.74, half), (0.80, half),
            (0.96, kneel)]
    a, b, k = keys[0][1], keys[0][1], 0.0
    for (h0, k0), (h1, k1) in zip(keys, keys[1:]):
        if h0 <= h < h1:
            a, b, k = k0, k1, smootherstep((h - h0) / (h1 - h0))
            break
    else:
        a = b = keys[-1][1] if h >= keys[-1][0] else keys[0][1]
    ctx.root(a[0].lerp(b[0], k))
    for s, i in ((lead, 1), ('R' if lead == 'L' else 'L', 2)):
        (p0, tilt0), (p1, tilt1) = a[i], b[i]
        p = p0.lerp(p1, k)
        if (p1 - p0).length > 0.1:
            p.z += 0.12 * math.sin(math.pi * k)  # the stepping foot clears the floor
        p.x = sgn(s) * 0.1
        tilt = lerp(tilt0, tilt1, k)
        ctx.target('leg.' + s, p, qx(tilt) @ ctx.body.rest_quat('foot.' + s))
        ctx.pole_world('leg.' + s, (0, -1, -0.3 * tilt / 75))
    hands_behind_head(ctx)


# Turkish get-up keyframes, right hand on the bell throughout (the rep reversed lies back down).
# Each: (u, root loc, root rot, spine side bend, left hand, left foot (ankle, tilt), right foot,
# left knee pole, right knee pole). Left hand: 'rest' on the floor beside the lying body, 'post'
# planted on the floor, 'hang' by the hip. Tilt: qx(+) lifts the heel, qx(-) the toes.
_TGU_POST = Vector((0.5, 0.05, 0.06))
_TGU_KEYS = [
    (0.0, (0, 0, 0.11), (-90, 0, 0), 0, 'rest', ((0.37, -0.8, 0.085), -70), ((-0.18, -0.5, 0.085), 0), (0, 0, 1), (-0.2, 0, 1)),
    (0.2, (0.06, 0, 0.21), (-35, 15, 0), 0, 'post', ((0.37, -0.8, 0.085), -70), ((-0.18, -0.5, 0.085), 0), (0, 0, 1), (-0.2, 0, 1)),
    # High bridge: hips up between the posted hand, the right foot and the left heel.
    (0.38, (0.05, -0.08, 0.42), (-70, 35, 0), 0, 'post', ((0.37, -0.8, 0.085), -70), ((-0.18, -0.5, 0.085), 0), (0, 0, 1), (-0.2, -0.3, 1)),
    # Leg swept back under: left knee down under the hips, toes tucked, trunk leaning onto the hand.
    (0.6, (0.05, 0.0, 0.52), (0, 50, 0), 20, 'post', ((0.12, 0.40, 0.12), 75), ((-0.18, -0.5, 0.085), 0), (0, -1, -0.3), (0, -1, 0.3)),
    # Half-kneel, trunk upright, hand off the floor.
    (0.78, (0.0, 0.0, 0.52), (0, 0, 0), 0, 'hang', ((0.12, 0.40, 0.12), 75), ((-0.15, -0.45, 0.085), 0), (0, -1, -0.3), (0, -1, 0.3)),
    # Stand up over the front foot.
    (1.0, (0.0, -0.44, STAND_Z), (0, 0, 0), 0, 'hang', ((0.1, -0.44, 0.085), 0), ((-0.1, -0.44, 0.085), 0), (0, -1, 0), (0, -1, 0)),
]


@spec('turkish-get-up', camera=cam((0, -0.1, 1.0), 60, 12, 5.2), setup=lambda ctx: {'kb': ctx.eq.kettlebell()},
      timing=dict(hold_start=0.03, out=0.44, hold_end=0.06), concentric='out')
def turkish_get_up(ctx, st, u):
    # Lying with the bell pressed up and the right knee bent: roll to the left elbow, then the hand,
    # bridge the hips, sweep the left leg under into a half-kneel, lift the trunk and stand. The
    # bell stays straight over the right shoulder all the way.
    for a, b in zip(_TGU_KEYS, _TGU_KEYS[1:]):
        if u <= b[0]:
            break
    k = smootherstep((u - a[0]) / (b[0] - a[0]))
    ctx.root(lerp(a[1], b[1], k), lerp(a[2], b[2], k))
    ctx.spine(side=lerp(a[3], b[3], k))
    ctx.head(flex=lerp(20, 0, smootherstep(min(u / 0.4, 1.0))))
    for side, i, pole in (('L', 5, 7), ('R', 6, 8)):
        (p0, t0), (p1, t1) = a[i], b[i]
        p = Vector(p0).lerp(Vector(p1), k)
        if (Vector(p1) - Vector(p0)).length > 0.1:
            p.z += 0.1 * math.sin(math.pi * k)  # the sweeping foot clears the floor
        ctx.target('leg.' + side, p, qx(lerp(t0, t1, k)) @ ctx.body.rest_quat('foot.' + side))
        ctx.pole_world('leg.' + side, Vector(a[pole]).lerp(Vector(b[pole]), k))
    sh = ctx.world('upperarm.R', 'head')
    up = Vector((sh.x, sh.y, sh.z + M.grip_reach() * 0.98))
    ctx.grip('R', up, (1, 0, 0))
    place(st['kb'], up, qx(180))
    shl = ctx.world('upperarm.L', 'head')
    spots = {'rest': Vector((shl.x + 0.25, shl.y - 0.1, 0.06)), 'post': _TGU_POST,
             'hang': shl + Vector((0.06, 0.0, -0.55))}
    ctx.target('arm.L', spots[a[4]].lerp(spots[b[4]], k))
    ctx.pole_world('arm.L', (1, 0.3, 0.2))


def _stair(x, n, offset):
    """0..1 in n steps: each step is a quick smooth move followed by a pause, shifted by
    `offset` (a fraction of a step) so limbs take turns."""
    y = x * n - offset
    i = math.floor(y)
    return min(max((i + smootherstep(min((y - i) / 0.4, 1.0))) / n, 0.0), 1.0)


def _wall_body(p):
    """Body pitch and pelvis for climb progress p: a straight body with the ankles at the wall
    and the shoulders held at straight-arm height, from a high plank to near vertical."""
    th = math.radians(lerp(68, 165, p))
    pelvis = Vector((0, 1.30 - 0.88 * math.sin(th), 0.78 - 0.475 * math.cos(th)))
    return th, pelvis


@spec('wall-walk', camera=cam((0, 0.5, 1.05), 75, 10, 4.9),
      setup=lambda ctx: (ctx.eq.group('wall', [ctx.eq.pad('w', (2.0, 0.1, 2.4), (0, 1.45, 1.2))]), {})[1],
      timing=dict(hold_start=0.05, out=0.42, hold_end=0.08), concentric='out')
def wall_walk(ctx, st, u):
    # High plank with the feet against the wall; the feet walk up the wall and the hands walk back
    # toward it in four steps (feet, then hands, one at a time) to a near-vertical handstand with
    # the belly to the wall, then walk back down the same way.
    limbs = {'leg.L': _stair(u, 4, 0.0), 'leg.R': _stair(u, 4, 0.15),
             'arm.L': _stair(u, 4, 0.3), 'arm.R': _stair(u, 4, 0.45)}
    th, pelvis = _wall_body(sum(limbs.values()) / 4)
    ctx.root(pelvis, (math.degrees(th), 0, 0))
    ctx.head(flex=-30)
    for s in SIDES:
        # Each foot sits where a straight body at its own step would put it, on the wall.
        fth, fp = _wall_body(limbs['leg.' + s])
        ctx.target('leg.' + s, (sgn(s) * 0.1, 1.30, fp.z - 0.88 * math.cos(fth)), ctx.foot_rot(s, (X, 30)))
        # Each hand sits under where the shoulders are at its own step.
        hth, hp = _wall_body(limbs['arm.' + s])
        ctx.target('arm.' + s, (sgn(s) * 0.2, hp.y - 0.475 * math.sin(hth), 0.08))
        ctx.pole_world('arm.' + s, (0, 1, 0))

