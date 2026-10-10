"""Upper-body accessories: push-up variants, front and lateral raises, flys and reverse flys,
rotator-cuff rotations, cable and machine rows, wrist, grip and neck work."""

import math

from mathutils import Matrix, Vector

import mannequin as M
from anim import X, lerp, sgn, smootherstep
from catalog_pull import shrug_spec
from equipment import along, place, qx, qz, set_line
from moves import SIDES, STAND_Z, carry_dumbbells, elbows, feet, grip_point, held, hold_dumbbell, knees_out, shoulders, sit, stand
from registry import barbell, cam, dumbbells, nothing, spec  # noqa: F401

shrug_spec('shrug')


def wave(ctx, cycles=1.0):
    return math.sin(2 * math.pi * cycles * getattr(ctx, 't', 0.0))


# ---------------------------------------------------------------------------------------------
# Push-ups: a rigid body pivoting on the feet (or knees), hands planted


def push_up_spec(id_, hands_z=0.0, hands_y=-0.22, feet_z=0.0, width=0.27, knees=False, wall=False, clap=False,
                 cobra=False, rings=False, tuck=0.35, bottom=None, setup=None, camera=None):
    def seg(ctx, a, b):
        return smootherstep(min(max((ctx.t - a) / (b - a), 0.0), 1.0))

    def pose(ctx, st, u):
        t = smootherstep(u)
        if cobra:
            # From lying face down, press the chest up into a cobra with the hips on the floor.
            ctx.root((0, 0.0, 0.11), (90, 0, 0))
            ctx.spine(flex=-55 * t)
            ctx.head(flex=-25 * t)
            for s in SIDES:
                ctx.leg_fk(s, ankle=-30)
                sh = ctx.world('upperarm.' + s, 'head')
                ctx.target('arm.' + s, (sgn(s) * 0.25, -0.15, 0.08))
                ctx.pole_world('arm.' + s, (sgn(s) * 0.2, 1, 0.3))
            return
        pivot_rest = M.joint('knee') if knees else M.joint('toe') + Vector((0, 0.03, 0))
        # Feet (or knees) a body length behind the hands, so the shoulders can stack over them.
        pivot = Vector((0, hands_y + (1.3 if not knees else 0.72), (feet_z + 0.03) if not knees else 0.06))
        if wall:
            pivot = Vector((0, 0.35, 0.03))
        reach = M.grip_reach() * 0.985
        low = bottom if bottom is not None else (0.2 if not wall else 0.25)
        target = lerp(reach, low, t)
        air = 0.0
        if clap:
            # Loop time: lower, explode past arm's length so the hands leave the floor and clap,
            # land on soft elbows and settle back to the top.
            target = lerp(reach, low, seg(ctx, 0.06, 0.36))
            target = lerp(target, reach + 0.14, seg(ctx, 0.36, 0.5))
            target = lerp(target, reach, seg(ctx, 0.55, 0.66))
            target = lerp(target, reach - 0.1, seg(ctx, 0.66, 0.76))
            target = lerp(target, reach, seg(ctx, 0.76, 0.94))
            air = seg(ctx, 0.43, 0.51) * (1 - seg(ctx, 0.57, 0.65))
        hand = Vector((0, hands_y, hands_z + 0.08))

        def place_body(pitch):
            ctx.pin_root(pivot_rest, pivot, (pitch, 0, 0))
            sh = shoulders(ctx)
            return (Vector((0, hand.y, hand.z)) - sh).length

        lo, hi = (5.0, 40.0) if wall else (10.0, 89.0)
        if feet_z > 0.1:
            # Raised feet need the body pitched past horizontal (head below the feet) at the
            # bottom. Search up to the pitch where the shoulders pass closest to the hands, so
            # the distance still shrinks monotonically over [lo, hi].
            a, b = 80.0, 130.0
            for _ in range(20):
                m1, m2 = a + (b - a) / 3, b - (b - a) / 3
                a, b = (a, m2) if place_body(m1) < place_body(m2) else (m1, b)
            hi = (a + b) / 2
        for _ in range(16):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if place_body(mid) > target else (lo, mid)
        place_body((lo + hi) / 2)
        # Upright against a wall the neck stays neutral; prone it extends to keep the gaze ahead.
        ctx.head(flex=-5 if wall else -45)
        for s in SIDES:
            if knees:
                ctx.leg_fk(s, knee=100, ankle=-20)
            elif rings:
                ctx.leg_fk(s, ankle=-30)
            else:
                ctx.leg_fk(s, ankle=-10)
        for s in SIDES:
            p = Vector((sgn(s) * width, hand.y, hand.z))
            if air:
                p = p.lerp(Vector((sgn(s) * 0.03, hand.y - 0.02, hand.z + 0.18)), air)
            ctx.target('arm.' + s, p)
            ctx.pole_world('arm.' + s, (sgn(s) * (1 - tuck), 1, 0.5))
        if rings and st:
            for s, (ring, strap) in zip(SIDES, zip(st['rings'], st['straps'])):
                f = ctx.world('foot.' + s, 'head')
                place(ring, f + Vector((0, 0.02, -0.02)), along((0, 1, 0)))
                set_line(strap, Vector((sgn(s) * 0.12, f.y, 1.8)), f)

    loop = dict(timing=dict(hold_start=0.0, out=1.0, hold_end=0.0), concentric='out') if clap else {}
    spec(id_, camera=camera or cam((0, 0.15, 0.35 + hands_z * 0.5), 72, 10, 3.9), setup=setup or nothing, **loop)(pose)


def _box_feet(ctx):
    ctx.eq.plyo_box((0, 0.75), height=0.45, size=(0.5, 0.4))
    return {}


def _bench_hands(ctx):
    ctx.eq.flat_bench((0, -0.22), length=0.45, height=0.44, yaw=90)
    return {}


def _wall(ctx):
    ctx.eq.group('wall', [ctx.eq.pad('w', (1.6, 0.1, 2.2), (0, -0.6, 1.1))])
    return {}


def _feet_rings(ctx):
    rings = [ctx.eq.group(f'rg{s}', [ctx.eq.cyl(f'rgc{s}', 0.09, 0.03, (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_pad, 32)]) for s in SIDES]
    return {'rings': rings, 'straps': [ctx.eq.line('sL', radius=0.008), ctx.eq.line('sR', radius=0.008)]}


push_up_spec('push-up')
push_up_spec('close-grip-push-up', width=0.14, tuck=0.85)
# The knee pivot is short, so a shallower bottom keeps the chest off the floor.
push_up_spec('kneeling-push-up', knees=True, bottom=0.27, camera=cam((0, -0.05, 0.3), 72, 10, 3.6))
push_up_spec('incline-push-up', hands_z=0.44, setup=_bench_hands)
push_up_spec('kneeling-incline-push-up', hands_z=0.44, knees=True, setup=_bench_hands)
push_up_spec('decline-push-up', feet_z=0.45, setup=_box_feet)
push_up_spec('push-up-against-wall', wall=True, hands_z=1.2, hands_y=-0.53, bottom=0.33, setup=_wall,
             camera=cam((0, -0.1, 1.0), 75, 8, 3.9))
push_up_spec('clap-push-up', clap=True)
push_up_spec('cobra-push-up', cobra=True, camera=cam((0, 0.1, 0.25), 70, 12, 3.6))
# Rings hang a few inches off the floor.
push_up_spec('push-ups-with-feet-in-rings', feet_z=0.15, rings=True, setup=_feet_rings)


@spec('handstand-push-up', camera=cam((0, 0.1, 1.1), 50, 6, 5.0),
      setup=lambda ctx: (ctx.eq.group('wall', [ctx.eq.pad('w', (1.6, 0.1, 2.4), (0, 0.42, 1.2))]), {})[1])
def handstand_push_up(ctx, st, u):
    # Kicked up with the back to the wall and the heels on it; the elbows bend to lower the
    # head toward the floor. Flipping about Y keeps the chest facing -Y, away from the wall,
    # and mirrors the figure's left to -X.
    t = smootherstep(u)
    arm = M.grip_reach() * lerp(0.98, 0.45, t)
    ctx.root((0, 0.2, 0.08 + arm + 0.47), (0, 180, 0))
    ctx.head(flex=-15)
    for s in SIDES:
        ctx.leg_fk(s, ankle=-30)
        ctx.target('arm.' + s, (-sgn(s) * 0.27, 0.15, 0.08))
        # Elbows track back toward the wall and ~45 degrees out, not straight to the sides.
        ctx.pole_world('arm.' + s, (-sgn(s) * 0.3, 1, 0))


# ---------------------------------------------------------------------------------------------
# Raises


def front_raise_spec(id_, implement='dumbbells', one_arm=False):
    def setup(ctx):
        if implement == 'dumbbells':
            return dumbbells(ctx)
        if implement == 'bar':
            return barbell(ctx, plates=1)
        if implement == 'plate':
            return {'plate': ctx.eq.plate()}
        # One handle in the right hand; the low pulley sits behind and to the right, so the
        # cable runs up beside the right leg.
        ctx.eq.cable_column(-0.1, 0.55, 2.0)
        return {'pulley': Vector((-0.1, 0.46, 0.12)), 'cable': ctx.eq.line('cable'), 'handle': ctx.eq.straight_bar('cb', 0.13)}

    def pose(ctx, st, u):
        stand(ctx, width=0.04)
        t = smootherstep(u)
        for s in (('R',) if implement == 'cable' else SIDES):
            ctx.arm_fk(s, flex=lerp(4, 88, t), abd=-6 if implement not in ('dumbbells', 'cable') else 4, elbow=8,
                       twist=-85 if implement == 'bar' else 0)
        if implement == 'cable':
            ctx.arm_fk('L', abd=6)
            ctx.follow(st['handle'], 'hand.R', grip_point('R'), held('R', qz(0)))
            set_line(st['cable'], st['pulley'], ctx.attach_point('hand.R', grip_point('R')))
        elif implement == 'dumbbells':
            carry_dumbbells(ctx, st['db'], neutral=False)
        elif implement == 'plate':
            hands = [ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES]
            place(st['plate'], (hands[0] + hands[1]) / 2)  # upright, gripped at 3 and 9 o'clock
        else:
            hands = [ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES]
            mid = (hands[0] + hands[1]) / 2
            place(st['bar'], mid)

    spec(id_, camera=cam((0, 0, 1.1), 55, 8, 3.8), setup=setup, concentric='out')(pose)


front_raise_spec('front-raise')
front_raise_spec('barbell-front-raise', 'bar')
front_raise_spec('cable-front-raise', 'cable')
front_raise_spec('plate-front-raise', 'plate')


@spec('cable-lateral-raise', camera=cam((0, 0, 1.1), 10, 8, 3.9),
      setup=lambda ctx: (ctx.eq.cable_column(0.6, 0.05, 2.0), {'pulley': Vector((0.51, -0.04, 0.12)), 'cable': ctx.eq.line('cable')})[1],
      concentric='out')
def cable_lateral_raise(ctx, st, u):
    # Low pulley on the left; the right hand reaches across and raises out to the side.
    stand(ctx, width=0.04)
    t = smootherstep(u)
    ctx.arm_fk('R', flex=12, abd=lerp(-12, 75, t), elbow=12, rot=lerp(0, 15, t))
    ctx.grip('L', (0.62, -0.05, 1.05), (0, 0, 1))
    set_line(st['cable'], st['pulley'], ctx.attach_point('hand.R', grip_point('R')))


def _lateral_machine(ctx):
    ctx.eq.group('lat_machine', [ctx.eq.pad('seat', (0.4, 0.4, 0.08), (0, 0.05, 0.45)),
                                 ctx.eq.pad('chest', (0.4, 0.08, 0.4), (0, -0.2, 0.95))])
    return {'pads': [ctx.eq.group(f'ep{s}', [ctx.eq.pad(f'epp{s}', (0.07, 0.2, 0.22), (0, 0, 0))]) for s in SIDES]}


@spec('machine-lateral-raise', camera=cam((0, 0, 1.0), 15, 8, 3.8), setup=_lateral_machine, concentric='out')
def machine_lateral_raise(ctx, st, u):
    sit(ctx, 0.45, y=0.1, knee=90)
    t = smootherstep(u)
    for s, pad in zip(SIDES, st['pads']):
        ctx.arm_fk(s, abd=lerp(10, 82, t), elbow=90, flex=20)
        ctx.follow(pad, 'upperarm.' + s, M.joint('elbow', s) + Vector((sgn(s) * 0.05, 0, 0.05)))


@spec('resistance-band-lateral-raise', camera=cam((0, 0, 1.0), 15, 8, 3.8),
      setup=lambda ctx: {'bands': [ctx.eq.line('bL', accent=True, radius=0.01), ctx.eq.line('bR', accent=True, radius=0.01)]},
      concentric='out')
def band_lateral_raise(ctx, st, u):
    stand(ctx, width=0.06)
    t = smootherstep(u)
    for s, b in zip(SIDES, st['bands']):
        ctx.arm_fk(s, flex=12, abd=lerp(8, 72, t), elbow=14, rot=lerp(0, 15, t))
        set_line(b, Vector((sgn(s) * 0.1, 0.0, 0.03)), ctx.attach_point('hand.' + s, grip_point(s)))


@spec('poliquin-raise', camera=cam((0, 0, 1.05), 15, 10, 3.9), setup=dumbbells, concentric='out')
def poliquin_raise(ctx, st, u):
    # Raise with the elbows bent to shoulder height, then straighten the arms at the top.
    stand(ctx, width=0.03)
    for s in SIDES:
        abd = lerp(8, 80, smootherstep(min(u / 0.6, 1)))
        elbow = lerp(90, 8, smootherstep(max((u - 0.6) / 0.4, 0)))
        ctx.arm_fk(s, flex=10, abd=abd, elbow=elbow, rot=-30)
    carry_dumbbells(ctx, st['db'])


@spec('cuban-press', camera=cam((0, 0, 1.1), 25, 8, 3.9), setup=dumbbells, concentric='out')
def cuban_press(ctx, st, u):
    # Upright row to elbows at shoulder height, rotate the forearms up, then press overhead.
    stand(ctx, width=0.03)
    a = smootherstep(min(u / 0.35, 1))
    b = smootherstep(min(max((u - 0.35) / 0.3, 0), 1))
    c = smootherstep(max((u - 0.65) / 0.35, 0))
    for s in SIDES:
        abd = lerp(10, 85, a) + 70 * c
        ctx.arm_fk(s, abd=abd, elbow=lerp(10, 90, a) - 80 * c, rot=lerp(40, 0, a) - 90 * b)
    carry_dumbbells(ctx, st['db'], neutral=False)


# ---------------------------------------------------------------------------------------------
# Flys and reverse flys


def _cable_pair(height, y=0.1):
    def setup(ctx):
        for x in (0.95, -0.95):
            ctx.eq.cable_column(x, y, 2.1)
        return {'pulleys': [Vector((0.86, y - 0.09, height)), Vector((-0.86, y - 0.09, height))],
                'cables': [ctx.eq.line('cL'), ctx.eq.line('cR')]}

    return setup


def fly_spec(id_, seated=False, height=1.7, machine=False, pec_deck=False, band=False, reverse=False):
    def setup(ctx):
        st = {}
        if seated and not machine:
            ctx.eq.flat_bench((0, 0.1), length=0.45, height=0.44, yaw=90)
        if band:
            # A band fly pulls against anchors behind the body, one on each upright of a rack, so
            # each band runs past the outside of its shoulder instead of through the torso.
            ctx.eq.group('anchor', [ctx.eq.frame('post' + s, (0.08, 0.08, 2.0), (sgn(s) * 0.72, 0.6, 1.0)) for s in SIDES])
            st['anchors'] = [Vector((sgn(s) * 0.67, 0.6, 1.32)) for s in SIDES]
            st['bands'] = [ctx.eq.line('bL', accent=True, radius=0.01), ctx.eq.line('bR', accent=True, radius=0.01)]
        elif machine or pec_deck:
            ctx.eq.group('fly_machine', [ctx.eq.pad('seat', (0.42, 0.42, 0.08), (0, 0.08, 0.45)),
                                         ctx.eq.pad('back', (0.42, 0.08, 0.7), (0, 0.32, 0.85)) if not reverse else
                                         ctx.eq.pad('chest', (0.42, 0.08, 0.5), (0, -0.2, 0.95)),
                                         ctx.eq.frame('post', (0.1, 0.1, 0.45), (0, 0.1, 0.22)),
                                         ctx.eq.frame('column', (0.08, 0.08, 1.8), (0, 0.45 if not reverse else -0.45, 0.9))])
            st['levers'] = [ctx.eq.line('lvL', radius=0.02), ctx.eq.line('lvR', radius=0.02)]
            if not reverse:
                st['handles'] = [ctx.eq.straight_bar('hd' + s, 0.13) for s in SIDES]
        else:
            st.update(_cable_pair(height)(ctx))
        return st

    def pose(ctx, st, u):
        t = smootherstep(u)
        if seated or machine or pec_deck:
            sit(ctx, 0.45, y=0.1 if not reverse else 0.0, knee=90, lean=-4 if not reverse else 10)
        else:
            stand(ctx, width=0.06)
            if not reverse:
                # Split stance: left foot forward, right foot back on the ball of the foot.
                ctx.root((0, 0.0, STAND_Z - 0.04))
                ctx.target('leg.L', (0.11, -0.3, 0.085))
                ctx.target('leg.R', (-0.11, 0.27, 0.15), qx(30) @ ctx.body.rest_quat('foot.R'))
                knees_out(ctx, 0.1)
                ctx.spine(flex=14)
        # Closing past parallel brings the hands together in front of the chest.
        open_abd, closed_abd = (80, -10) if not reverse else (10, 82)
        grips = None
        for s in SIDES:
            if pec_deck:
                # Upper arms stay at shoulder height and swing in horizontally, forearms upright,
                # until the elbows meet in front of the chest.
                sh = ctx.world('upperarm.' + s, 'head')
                a = math.radians(lerp(-5, 112, t))
                elbow = sh + Vector((sgn(s) * 0.29 * math.cos(a), -0.29 * math.sin(a), -0.03))
                g = elbow + Vector((0, 0, 0.31))
                ctx.grip(s, g, (0, 1, 0))
                ctx.pole_world('arm.' + s, (elbow - sh).normalized() + Vector((0, 0, -0.6)))
                grips = (grips or []) + [g]
            else:
                ctx.arm_fk(s, flex=lerp(55, 80, t) if not reverse else 85, abd=lerp(open_abd, closed_abd, t),
                           elbow=lerp(25, 15, t) if not reverse else 10, rot=-10, twist=-90 if reverse else 0)
        hands = grips or [ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES]
        if 'cables' in st:
            for c, p, h in zip(st['cables'], st['pulleys'] if not reverse else st['pulleys'][::-1], hands):
                set_line(c, p, h)
        elif 'bands' in st:
            for b, a, h in zip(st['bands'], st['anchors'], hands):
                set_line(b, a, h)
        elif 'levers' in st:
            for s, lv, h in zip(SIDES, st['levers'], hands):
                if reverse:
                    set_line(lv, Vector((sgn(s) * 0.12, -0.45, 1.4)), h)
                    continue
                # Each lever hangs from a pivot above and outside its shoulder down to a short
                # upright handle, so the rod clears the arm.
                hd = st['handles'][0 if s == 'L' else 1]
                if pec_deck:
                    place(hd, h, qz(90))
                    top = h + Vector((0, 0, 0.02))
                else:
                    ctx.follow(hd, 'hand.' + s, grip_point(s), held(s, qz(90)))
                    top = ctx.attach_point('hand.' + s, grip_point(s) + Vector((0, 0, 0.065)))
                set_line(lv, Vector((sgn(s) * 0.24, 0.15, 1.6)), top)

    az = 60 if band else (20 if not reverse else 200)
    spec(id_, camera=cam((0, 0, 1.1 if not (seated or machine or pec_deck) else 0.95), az, 10, 4.0),
         setup=setup, concentric='out')(pose)


fly_spec('cable-fly')
fly_spec('seated-cable-chest-fly', seated=True, height=1.1)  # pulleys at seated chest height
fly_spec('machine-chest-fly', machine=True)
fly_spec('pec-deck', pec_deck=True)
fly_spec('resistance-band-chest-fly', band=True)
fly_spec('standing-resistance-band-chest-fly', band=True)
fly_spec('reverse-cable-fly', reverse=True, height=1.5)
fly_spec('reverse-machine-fly', machine=True, reverse=True)


@spec('band-pull-apart', camera=cam((0, 0, 1.2), 20, 8, 3.8),
      setup=lambda ctx: {'band': ctx.eq.line('band', accent=True, radius=0.012)}, concentric='out')
def band_pull_apart(ctx, st, u):
    stand(ctx, width=0.04)
    t = smootherstep(u)
    for s in SIDES:
        ctx.arm_fk(s, flex=lerp(88, 85, t), abd=lerp(4, 70, t), elbow=6, twist=-80)  # hands shoulder-width at the start
    hands = [ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES]
    set_line(st['band'], hands[0], hands[1])


@spec('reverse-fly', camera=cam((0, 0, 0.95), 25, 14, 3.8), setup=dumbbells, concentric='out')
def reverse_fly(ctx, st, u):
    # Bent over with a flat back; the arms open out to the sides with soft elbows.
    ctx.root((0, 0.17, STAND_Z - 0.07))
    ctx.bone('pelvis', (X, 70))
    ctx.head(flex=-30)
    feet(ctx, width=0.04)
    knees_out(ctx, 0.2)
    t = smootherstep(u)
    for s in SIDES:
        ctx.arm_fk(s, flex=lerp(70, 70, t), abd=lerp(5, 80, t), elbow=15, twist=0)
    carry_dumbbells(ctx, st['db'])


@spec('reverse-dumbbell-flyes-on-incline-bench', camera=cam((0, 0.0, 0.8), 25, 14, 3.9),
      setup=lambda ctx: (ctx.eq.incline_bench(40), dumbbells(ctx))[1], concentric='out')
def reverse_fly_incline(ctx, st, u):
    # Chest flat on the 40 degree pad (body 50 degrees from vertical), feet planted behind.
    ctx.root((0, -0.02, 0.76), (50, 0, 180))
    ctx.head(flex=-10)
    for s in SIDES:
        ctx.target('leg.' + s, (sgn(s) * 0.15, -0.55, 0.085), qz(180) @ ctx.body.rest_quat('foot.' + s))
        ctx.pole_world('leg.' + s, (0, 1, 0.3))
    t = smootherstep(u)
    for s in SIDES:
        ctx.arm_fk(s, flex=52, abd=lerp(12, 80, t), elbow=15)  # start wide enough to clear the pad
    carry_dumbbells(ctx, st['db'])


@spec('dumbbell-pullover', camera=cam((0, 0.0, 0.6), 75, 12, 3.8),
      setup=lambda ctx: (ctx.eq.flat_bench((0, 0.1), length=0.45, height=0.44, yaw=90), {'db': ctx.eq.dumbbell('db')})[1],
      concentric='out')
def dumbbell_pullover(ctx, st, u):
    # Upper back across a bench, hips low; the dumbbell arcs from behind the head to over the chest.
    ctx.pin_root(Vector((0, 0.0, M.joint('shoulder').z - 0.1)), Vector((0, 0.1, 0.55)), (-80, 0, 0))
    ctx.bone('pelvis', (X, 20))
    for s in SIDES:
        ctx.target('leg.' + s, (sgn(s) * 0.2, -0.65, 0.085))
        ctx.pole_world('leg.' + s, (sgn(s) * 0.2, 0, 1))
    t = smootherstep(u)
    for s in SIDES:
        ctx.arm_fk(s, flex=lerp(175, 92, t), abd=-10, elbow=20)
    mid = (ctx.attach_point('hand.L', grip_point('L')) + ctx.attach_point('hand.R', grip_point('R'))) / 2
    place(st['db'], mid, ctx.bone_delta('forearm.L') @ along((0, 0, 1)))


# ---------------------------------------------------------------------------------------------
# Rotator cuff


def rotation_spec(id_, implement, external, position='side'):
    def setup(ctx):
        st = {}
        if implement in ('cable', 'band'):
            x = 0.85 if external else -0.85
            if implement == 'cable':
                ctx.eq.cable_column(x, 0.0, 2.0)
            else:
                ctx.eq.group('anchor', [ctx.eq.frame('post', (0.1, 0.1, 1.5), (x, 0.0, 0.75))])
            st['anchor'] = Vector((x - 0.09 * sgn(x), -0.09, 1.1))
            st['line'] = ctx.eq.line('line', accent=implement == 'band', radius=0.008)
        else:
            st['db'] = ctx.eq.dumbbell('db')
        if position == 'prone':
            ctx.eq.flat_bench((0, 0.0), length=1.5, height=0.44)
        elif position == 'side-bench':
            ctx.eq.flat_bench((0.15, 0.0), length=1.2, height=0.44, yaw=90)
        return st

    # With the upper arm abducted, rot 0 points the forearm along the body's front and -90 along
    # its long axis toward the head.
    def pose(ctx, st, u):
        t = smootherstep(u)
        side = 'R'
        if position == 'prone':
            # Face down on a bench, upper arm out at shoulder level over the edge: the forearm
            # rotates from hanging at the floor forward and up to level with the bench.
            ctx.root((0, 0.0, 0.56), (90, 0, 0))
            ctx.head(flex=-10)
            for s in SIDES:
                ctx.leg_fk(s, ankle=-30)
            ctx.arm_fk('R', abd=88, elbow=90, rot=lerp(0, -85, t))
            ctx.arm_fk('L', flex=80, abd=8, elbow=10)
        elif position == 'supine':
            # On the back on the floor, knees bent, upper arm out on the floor: the forearm
            # rotates from resting back toward the head up to pointing at the ceiling.
            ctx.root((0, 0.0, 0.11), (-90, 0, 0))
            for s in SIDES:
                ctx.target('leg.' + s, (sgn(s) * 0.14, -0.55, 0.085))
                ctx.pole_world('leg.' + s, (sgn(s) * 0.2, 0, 1))
            ctx.arm_fk('R', abd=88, elbow=90, rot=lerp(-85, 0, t))
            ctx.arm_fk('L', abd=12)
        elif position == 'side-bench':
            # On the left side on a bench, training the bottom arm: upper arm on the pad in front
            # of the chest, forearm rotating from hanging off the edge up toward the stomach.
            side = 'L'
            ctx.root((0, 0.0, 0.65), (0, 90, 0))
            for s in SIDES:
                ctx.leg_fk(s, hip_flex=30, knee=60)
            ctx.arm_fk('L', flex=45, elbow=90, rot=lerp(-80, 55, t))
            ctx.arm_fk('R', abd=-5, flex=10, elbow=20)
        elif position == 'abducted':
            stand(ctx, width=0.04)
            rot = lerp(0, -90, t) if external else lerp(-90, 0, t)
            ctx.arm_fk('R', abd=88, elbow=90, rot=rot)
            ctx.arm_fk('L', abd=6)
        else:
            stand(ctx, width=0.04)
            rot = lerp(50, -45, t) if external else lerp(-45, 50, t)
            ctx.arm_fk('R', abd=6, elbow=90, rot=rot, flex=4)
            ctx.arm_fk('L', abd=6)
        hand = ctx.attach_point('hand.' + side, grip_point(side))
        if 'db' in st:
            ctx.follow(st['db'], 'hand.' + side, grip_point(side), held(side, qz(90)))
        else:
            set_line(st['line'], st['anchor'], hand)

    cams = {'prone': cam((0, 0.0, 0.5), 60, 15, 3.6), 'supine': cam((0, 0.1, 0.3), 50, 25, 3.4),
            'side-bench': cam((0.1, 0, 0.6), 20, 15, 3.4)}
    spec(id_, camera=cams.get(position, cam((0, 0, 1.0), 20, 12, 3.6)), setup=setup, concentric='out')(pose)


rotation_spec('band-external-shoulder-rotation', 'band', True)
rotation_spec('band-internal-shoulder-rotation', 'band', False)
rotation_spec('cable-external-shoulder-rotation', 'cable', True)
rotation_spec('internal-shoulder-rotations', 'cable', False)
rotation_spec('lying-dumbbell-external-shoulder-rotation', 'db', True, 'prone')
rotation_spec('lying-dumbbell-internal-shoulder-rotation', 'db', False, 'side-bench')
rotation_spec('dumbbell-horizontal-external-shoulder-rotation', 'db', True, 'abducted')
rotation_spec('dumbbell-horizontal-internal-shoulder-rotation', 'db', False, 'supine')


# ---------------------------------------------------------------------------------------------
# Seated cable and machine rows


def seated_cable_row_spec(id_, grip=0.3, rope=False, one_arm=False, high=False, machine=False):
    def setup(ctx):
        st = ctx.eq.row_station()
        if machine or high or grip > 0.1 or rope or one_arm:
            st['handle'].hide_render = True
            for c in st['handle'].children:
                c.hide_render = True
        st['bar'] = ctx.eq.straight_bar('wide', 2 * grip + 0.2) if not (rope or one_arm or machine) else None
        if rope:
            st['ropes'] = [ctx.eq.line('rL', radius=0.012), ctx.eq.line('rR', radius=0.012)]
        if machine:
            st['cable'].hide_render = True
            ctx.eq.group('row_pad', [ctx.eq.pad('chest_pad', (0.4, 0.08, 0.4), (0, -0.25, 0.85))])
            st['levers'] = [ctx.eq.line('lvL', radius=0.02), ctx.eq.line('lvR', radius=0.02)]
        if high:
            # Raise the station's column so the pulley sits at seated shoulder height.
            ctx.eq.group('high_col', [ctx.eq.frame('col_hi', (0.16, 0.16, 1.2), (0, -1.15, 0.6)),
                                      ctx.eq.cyl('pulley_hi', 0.045, 0.03, (0, -1.06, 1.05), (0, math.pi / 2, 0), ctx.eq.m_metal, 24)])
            st['pulley'] = Vector((0, -1.06, 1.05))
        return st

    def pose(ctx, st, u):
        t = smootherstep(u)
        ctx.root((0, 0.05, 0.5))
        ctx.bone('pelvis', (X, lerp(14, -2, t) if not machine else 0))
        ctx.spine(flex=lerp(10, -6, t) if not machine else 0)
        for s in SIDES:
            ctx.target('leg.' + s, (sgn(s) * 0.12, -0.74, 0.3), qx(-70) @ ctx.body.rest_quat('foot.' + s))
            ctx.pole_world('leg.' + s, (sgn(s) * 0.15, -0.3, 1))
        sh = shoulders(ctx)
        reach = Vector((0, sh.y - 0.58, sh.z - (0.12 if not high else -0.05)))
        end = ctx.attach_point('chest', (0, -0.15, 1.42 if (high or rope) else 1.25)) if not one_arm else ctx.attach_point('spine', (-0.2, -0.12, 1.15))
        c = reach.lerp(end, t)
        sides = ['R'] if one_arm else SIDES
        for s in sides:
            if rope:
                p = c + Vector((sgn(s) * lerp(0.05, 0.2, t), 0, 0))
                ctx.grip(s, p, (0, 0, 1))
                set_line(st['ropes'][0 if s == 'L' else 1], c, p)
            elif one_arm:
                p = Vector((-0.2, reach.y, reach.z)).lerp(end, t)
                ctx.grip(s, p, (0, 0, 1))
                c = p
            else:
                ctx.grip(s, c + Vector((sgn(s) * grip, 0, 0)), (-sgn(s), 0, 0) if not machine else (0, 0, 1))
        if one_arm:
            ctx.arm_fk('L', abd=10)
        if st.get('bar') is not None:
            place(st['bar'], c)
        if machine:
            for s, lv in zip(SIDES, st['levers']):
                set_line(lv, Vector((sgn(s) * 0.25, -0.9, 0.5)), c + Vector((sgn(s) * grip, 0, 0)))
        else:
            set_line(st['cable'], st['pulley'], c)
        elbows(ctx, (1, 0.4, 0.6) if (high or rope or grip > 0.25) else (0.25, 1, -0.2))

    spec(id_, camera=cam((0, -0.3, 0.7), 70, 12, 4.0), setup=setup, concentric='out')(pose)


seated_cable_row_spec('cable-wide-grip-seated-row', grip=0.32)
seated_cable_row_spec('cable-rear-delt-row', grip=0.12, rope=True, high=True)
seated_cable_row_spec('one-handed-cable-row', one_arm=True)
seated_cable_row_spec('seated-machine-row', grip=0.22, machine=True)


# ---------------------------------------------------------------------------------------------
# Wrist, grip, neck


def wrist_spec(id_, implement='bar', extension=False, behind=False):
    def setup(ctx):
        if not behind:
            ctx.eq.flat_bench((0, 0.2), length=0.5, height=0.45, yaw=90)
        if implement == 'bar':
            # Light work: small plates, which also clear the thighs and knees.
            return barbell(ctx, plates=1, plate_radius=0.11, length=1.5)
        if implement == 'plate':
            return {'plate': ctx.eq.plate()}
        return dumbbells(ctx)

    def pose(ctx, st, u):
        t = smootherstep(u)
        # Full range: the bar sinks toward the fingers, then the wrist curls right up.
        wrist = lerp(-55, 55, t) * (-1 if extension else 1)
        if behind:
            stand(ctx, width=0.04)
            for s in SIDES:
                ctx.arm_fk(s, flex=-12, abd=4, twist=-90, wrist=-lerp(-10, 40, t))
        else:
            # Seated, forearms along the thighs, hands just past the knees.
            sit(ctx, 0.45, y=0.22, knee=90, lean=30)
            for s in SIDES:
                ctx.arm_fk(s, flex=20, abd=-6, elbow=75, twist=90 if not extension else -90, wrist=wrist)
        hands = [ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES]
        mid = (hands[0] + hands[1]) / 2
        if implement == 'bar':
            place(st['bar'], mid)
        elif implement == 'plate':
            place(st['plate'], hands[1], ctx.bone_delta('hand.R') @ qz(90))
        else:
            carry_dumbbells(ctx, st['db'])

    # Seated: close in on the hands, side-on, so the small wrist movement reads.
    camera = cam((0, -0.12, 0.68), 68, 14, 2.9) if not behind else cam((0, 0.0, 0.9), 200, 12, 3.4)
    spec(id_, camera=camera, setup=setup,
         concentric='out')(pose)


wrist_spec('wrist-curl')
wrist_spec('barbell-wrist-curl-behind-the-back', behind=True)
wrist_spec('barbell-wrist-extension', extension=True)
wrist_spec('dumbbell-wrist-curl', implement='db')
wrist_spec('reverse-wrist-curl', implement='db', extension=True)
wrist_spec('plate-wrist-curl', implement='plate')


@spec('wrist-roller', camera=cam((0, 0, 1.1), 50, 8, 3.8),
      setup=lambda ctx: {'roller': ctx.eq.straight_bar('roller', 0.4), 'rope': ctx.eq.line('rope', radius=0.006),
                         'plate': ctx.eq.group('wp', [ctx.eq.cyl('wpc', 0.12, 0.04, (0, 0, 0), (0, 0, 0), ctx.eq.m_equip, 32)])},
      concentric='out')
def wrist_roller(ctx, st, u):
    # Arms out in front, the hands roll the handle to wind the weight up.
    stand(ctx, width=0.05)
    w = wave(ctx, 2)
    for s in SIDES:
        ctx.arm_fk(s, flex=85, abd=-12, twist=-85, wrist=25 * (w if s == 'L' else -w))
    hands = [ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES]
    mid = (hands[0] + hands[1]) / 2
    place(st['roller'], mid)
    low = Vector((mid.x, mid.y, lerp(0.15, mid.z - 0.2, smootherstep(u))))
    set_line(st['rope'], mid, low)
    place(st['plate'], low)


def _gripper(ctx):
    # Two handles hinged at a coil on the thumb side of the fist. Each handle's local X runs
    # toward the coil; the palm handle carries the coil.
    eq = ctx.eq
    palm = eq.group('grip_palm', [eq.cyl('gpa', 0.012, 0.14, (-0.02, 0, 0), (0, math.pi / 2, 0), eq.m_pad, 16),
                                  eq.cyl('gcoil', 0.02, 0.02, (0.06, 0.0125, 0), (0, 0, 0), eq.m_metal, 24)])
    fingers = eq.group('grip_fingers', [eq.cyl('gfi', 0.012, 0.14, (-0.02, 0, 0), (0, math.pi / 2, 0), eq.m_pad, 16)])
    return {'palm': palm, 'fingers': fingers}


@spec('gripper', camera=cam((-0.1, -0.3, 1.35), 340, 6, 1.6), setup=_gripper, concentric='out')
def gripper(ctx, st, u):
    # Squeezing a hand gripper in front of the chest: the finger handle swings in about the coil
    # until it touches the palm handle.
    stand(ctx, width=0.04)
    ctx.arm_fk('R', flex=30, abd=10, elbow=95)
    ctx.arm_fk('L', abd=6)
    _, n, f = M.hand_frame_rest('R')  # palm normal, thumb side (rest space)
    g = grip_point('R')

    def frame(x, y):
        return Matrix((x, y, x.cross(y))).transposed().to_quaternion()

    palm_c = g - n * 0.012
    ctx.follow(st['palm'], 'hand.R', palm_c, frame(f, n))
    phi = math.radians(lerp(28, 0, smootherstep(u)))
    x = f * math.cos(phi) - n * math.sin(phi)
    y = n * math.cos(phi) + f * math.sin(phi)
    hinge = palm_c + f * 0.06 + n * 0.025
    ctx.follow(st['fingers'], 'hand.R', hinge - x * 0.06, frame(x, y))


@spec('plate-pinch', camera=cam((0, 0, 0.9), 20, 8, 3.8), setup=lambda ctx: {'plates': [ctx.eq.plate('pL', 0.15), ctx.eq.plate('pR', 0.15)]},
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0), pulse_floor=0.82, concentric='out')
def plate_pinch(ctx, st, u):
    stand(ctx, width=0.04)
    for s, p in zip(SIDES, st['plates']):
        ctx.arm_fk(s, abd=6)
        ctx.follow(p, 'hand.' + s, grip_point(s) + Vector((0, 0, -0.08)), held(s, qz(90)))
    S = __import__('scene')
    S.place_camera(ctx.cam, (0, 0, 0.9), lerp(10, 50, u), 8, 3.8)


@spec('farmers-walk', camera=cam((0, 0, 0.95), 70, 8, 4.0), setup=dumbbells,
      timing=dict(hold_start=0.0, out=0.5, hold_end=0.0), concentric='out')
def farmers_walk(ctx, st, u):
    # Walking tall with heavy dumbbells at the sides (shown in place).
    w = wave(ctx)
    ctx.root((0, 0.0, STAND_Z - 0.01 - 0.015 * abs(w)))
    for s in SIDES:
        swing = 0.18 * (w if s == 'L' else -w)
        lift = 0.05 * max(0.0, swing / 0.18)
        ctx.target('leg.' + s, (sgn(s) * 0.11, -swing, 0.085 + lift))
        ctx.pole_world('leg.' + s, (0, -1, 0))
    for s, db in zip(SIDES, st['db']):
        sh = ctx.world('upperarm.' + s, 'head')
        hold_dumbbell(ctx, db, s, ctx.grip_hang(s, sh.y, 0.26), Vector((0, -1, 0)))
    elbows(ctx, (0.3, 1, 0))


def neck_spec(id_, kind):
    def setup(ctx):
        if kind in ('curl', 'extension'):
            ctx.eq.flat_bench((0, 0.0), length=1.0, height=0.44)
            return {'plate': ctx.eq.plate('np', 0.12)}
        if kind == 'supine-bridge':
            ctx.eq.group('head_pad', [ctx.eq.pad('hp', (0.3, 0.25, 0.04), (0, 0.66, 0.02))])
        return {}

    def pose(ctx, st, u):
        t = smootherstep(u)
        for s in SIDES:
            ctx.arm_fk(s, flex=40, abd=-20, elbow=120, rot=60)
        if kind == 'curl':
            ctx.root((0, 0.0, 0.54), (-90, 0, 0))
            ctx.head(flex=lerp(-40, 40, t))
            ctx.bone('neck', (X, lerp(-20, 20, t)))
            for s in SIDES:
                ctx.target('leg.' + s, (sgn(s) * 0.24, -0.55, 0.085))
        elif kind == 'extension':
            # Chest on the pad with only the head past the end; lift to in line with the spine.
            ctx.root((0, 0.1, 0.55), (90, 0, 0))
            ctx.head(flex=lerp(40, -5, t))
            ctx.bone('neck', (X, lerp(20, -5, t)))
            for s in SIDES:
                ctx.target('leg.' + s, (sgn(s) * 0.2, 0.7, 0.06), qx(-80) @ ctx.body.rest_quat('foot.' + s))
        elif kind == 'prone-bridge':
            # Kneeling with the forehead on the floor; roll forward and back over the head.
            ctx.root((0, 0.12, 0.5), (lerp(112, 128, t), 0, 0))
            ctx.head(flex=-20)
            for s in SIDES:
                ctx.target('leg.' + s, (sgn(s) * 0.11, 0.55, 0.07), qx(-80) @ ctx.body.rest_quat('foot.' + s))
                ctx.pole_world('leg.' + s, (0, -0.3, -1))
                ctx.target('arm.' + s, (sgn(s) * 0.3, -0.35, 0.08))
                ctx.pole_world('arm.' + s, (0, 1, 0))
        else:
            # On the back, knees bent, head on a pad: pressing the head into the pad lifts the
            # shoulders a few centimetres while the neck extends to keep the head down.
            ctx.root((0, 0.0, 0.12), (-90, 0, 0))
            ctx.bone('pelvis', (X, lerp(0, 6, t)))
            ctx.bone('neck', (X, lerp(0, -20, t)))
            ctx.head(flex=lerp(0, -18, t))
            for s in SIDES:
                ctx.target('leg.' + s, (sgn(s) * 0.15, -0.45, 0.085))
                ctx.pole_world('leg.' + s, (sgn(s) * 0.2, 0, 1))
                ctx.arm_fk(s, flex=0, abd=12, elbow=0)
        if 'plate' in st:
            ctx.follow(st['plate'], 'head', (0, -0.11 if kind == 'curl' else 0.09, 1.66), qx(90))
            # Both hands steady the plate at its rim, thumbs toward the top of the head.
            side_axis = ctx.bone_delta('head') @ Vector((1, 0, 0))
            up = ctx.bone_delta('head') @ Vector((0, 0, 1))
            for s in SIDES:
                ctx.grip(s, st['plate'].location + side_axis * sgn(s) * 0.1, up)
                ctx.pole_world('arm.' + s, side_axis * sgn(s) + Vector((0, 0, -0.5 if kind == 'curl' else 0.5)))

    cams = {'supine-bridge': cam((0, 0.3, 0.2), 80, 10, 2.8)}
    spec(id_, camera=cams.get(kind, cam((0, 0.2, 0.6), 75, 10, 3.8)), setup=setup, concentric='out')(pose)


neck_spec('lying-neck-curl', 'curl')
neck_spec('lying-neck-extension', 'extension')
neck_spec('prone-neck-bridge', 'prone-bridge')
neck_spec('supine-neck-bridge', 'supine-bridge')
