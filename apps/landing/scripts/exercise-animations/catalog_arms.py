"""Arm families: curls (free weights, preacher, incline, cable, band) and triceps extensions,
pushdowns, presses and dips."""

import math

from mathutils import Vector

import mannequin as M
from anim import lerp, sgn, smootherstep
from catalog_press import incline_setup, lie, lockout_z
from catalog_pull import inverted_row_spec, _with_bar_at, _row_bar
from equipment import along, place, qx, qz, set_line
from moves import (
    SIDES,
    carry_dumbbells,
    elbows,
    fk_hand_midpoint,
    grip_point,
    held,
    hold_dumbbell,
    knees_out,
    shoulders,
    sit,
    stand,
)
from registry import cam, spec


def follow_hands(ctx, obj):
    """A bar held in both FK hands."""
    bar = fk_hand_midpoint(ctx)
    hands = [ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES]
    place(obj, bar, along(hands[0] - hands[1]))
    return bar


# ---------------------------------------------------------------------------------------------
# Standing curls


def curl_spec(id_, implement='dumbbells', twist=(90, 90), flex=(2, 14), drag=False, zottman=False, band=False,
              cable=None, hammer=False, camera=None):
    def setup(ctx):
        st = {}
        if implement == 'dumbbells':
            st['w'] = ctx.eq.dumbbells()
        elif implement == 'kettlebells':
            st['w'] = [ctx.eq.kettlebell('kbL'), ctx.eq.kettlebell('kbR')]
        elif implement == 'ez':
            st['bar'] = ctx.eq.ez_bar()
        elif implement in ('bar', 'cable-bar'):
            st['bar'] = ctx.eq.barbell(plates=1) if implement == 'bar' else ctx.eq.straight_bar('cbar', 0.5)
        elif implement == 'rope':
            st['ends'] = [ctx.eq.group(f'r{s}', [ctx.eq.cyl(f'rc{s}', 0.016, 0.1, (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_pad, 16)]) for s in SIDES]
            st['ropes'] = [ctx.eq.line('ropeL', radius=0.012), ctx.eq.line('ropeR', radius=0.012)]
        if band:
            st['bands'] = [ctx.eq.line('bandL', accent=True, radius=0.01), ctx.eq.line('bandR', accent=True, radius=0.01)]
            st['w'] = [ctx.eq.group(f'bh{s}', [ctx.eq.cyl(f'bhc{s}', 0.016, 0.11, (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_pad, 16)]) for s in SIDES]
        if cable:
            st['pulley'] = ctx.eq.cable_column(0, -0.62, 1.2)
            st['pulley'] = Vector((0, -0.71, 0.12))
            st['cable'] = ctx.eq.line('cable')
        return st

    def pose(ctx, st, u):
        stand(ctx, width=0.04, y=0.05 if cable else 0.0)
        t = smootherstep(u)
        tw = lerp(twist[0], twist[1], t)
        if zottman:  # palms up on the way up, turned over at the top, palms down on the way down
            going_up = getattr(ctx, 't', 0.0) < 0.55
            tw = 90 if going_up else -80
        for s in SIDES:
            ctx.arm_fk(s, flex=lerp(flex[0], flex[1], t) - (35 * t if drag else 0), abd=3 + (6 * t if drag else 0),
                       elbow=lerp(4, 138 if not drag else 112, t), twist=tw)
        if implement in ('bar', 'ez', 'cable-bar'):
            bar = follow_hands(ctx, st['bar'])
            if cable:
                set_line(st['cable'], st['pulley'], bar)
        elif implement == 'rope':
            hands = [ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES]
            knot = (hands[0] + hands[1]) / 2 - Vector((0, 0, 0.12))
            for s, end, rope, h in zip(SIDES, st['ends'], st['ropes'], hands):
                place(end, h, along((0, 0, 1)))
                set_line(rope, knot, h)
            set_line(st['cable'], st['pulley'], knot)
        elif implement == 'kettlebells':
            for s, w in zip(SIDES, st['w']):
                place(w, ctx.attach_point('hand.' + s, grip_point(s)))  # the bell hangs from the handle
        else:
            carry_dumbbells(ctx, st['w'], neutral=True)
        if band:
            for s, b in zip(SIDES, st['bands']):
                set_line(b, Vector((sgn(s) * 0.1, 0.0, 0.02)), ctx.attach_point('hand.' + s, grip_point(s)))

    spec(id_, camera=camera or cam((0, 0, 1.05), 40, 8, 3.8), setup=setup, concentric='out')(pose)


curl_spec('dumbbell-curl', twist=(0, 90))
curl_spec('ez-curl', implement='ez', twist=(60, 60))
curl_spec('reverse-barbell-curl', implement='bar', twist=(-85, -85))
curl_spec('reverse-dumbbell-curl', twist=(-85, -85))
curl_spec('drag-curl', implement='bar', twist=(90, 90), drag=True, camera=cam((0, 0, 1.05), 70, 8, 3.8))
curl_spec('zottman-curl', zottman=True)
curl_spec('kettlebell-curl', implement='kettlebells', twist=(60, 70))
curl_spec('resistance-band-curl', implement='band', twist=(90, 90), band=True)
curl_spec('cable-curl-with-bar', implement='cable-bar', twist=(90, 90), cable=True, camera=cam((0, -0.2, 1.0), 60, 8, 4.0))
curl_spec('cable-curl-with-rope', implement='rope', twist=(0, 0), cable=True, camera=cam((0, -0.2, 1.0), 60, 8, 4.0))


# Concentration curl: the back of the upper arm braces on the inner thigh just above the knee.
CONC_TILT = 28
CONC_LEAN = 38
CONC_CURL = Vector((0.6, -0.8, 0)).normalized()  # forearm swings up toward the chest, palm leading
UPPER_ARM = (M.joint('elbow') - M.joint('shoulder')).length
FOREARM_GRIP = (M.grip_point('L') - M.joint('elbow')).length


def concentration_pose(ctx, st, t):
    # Hinge forward from the hips (pelvis tilt) and round the back so the shoulder comes down over
    # the knee: the upper arm then hangs from it onto the thigh.
    ctx.root((0, 0.2, 0.45 + 0.16), (CONC_TILT, 0, 0))
    ctx.spine(flex=CONC_LEAN)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=80 + CONC_TILT, hip_abd=20, knee=82)
    sh = ctx.world('upperarm.R', 'head')
    knee = ctx.world('shin.R', 'head')
    brace = knee + Vector((0.07, 0.07, 0.08))  # inside of the thigh, just above the knee
    elbow = sh + (brace - sh).normalized() * UPPER_ARM
    a = math.radians(lerp(8, 132, t))
    hand = elbow + (Vector((0, 0, -1)) * math.cos(a) + CONC_CURL * math.sin(a)) * FOREARM_GRIP
    thumb = Vector((0, 0, -1)).cross(CONC_CURL)  # handle square to the curl plane
    hold_dumbbell(ctx, st['w'][1], 'R', hand, thumb)
    ctx.pole_world('arm.R', elbow - (sh + hand) / 2)
    # The free hand rests on the other knee.
    ctx.grip('L', ctx.world('shin.L', 'head') + Vector((0.0, 0.05, 0.07)), (0, -1, 0))
    ctx.pole_world('arm.L', (1, 0.3, -0.3))


def seated_curl(id_, mode, implement='bar'):
    """Preacher, concentration, incline and spider curls: the upper arm is fixed by the setup."""

    def setup(ctx):
        st = {}
        if mode == 'preacher':
            ctx.eq.preacher_bench()
        elif mode == 'concentration':
            ctx.eq.flat_bench((0, 0.2), length=0.5, height=0.45, yaw=90)
        elif mode == 'incline':
            ctx.eq.incline_bench(45)
        elif mode == 'spider':
            ctx.eq.incline_bench()  # the angle lie(ctx, 'incline') reclines to
        elif mode == 'machine':
            ctx.eq.preacher_bench()
            st['levers'] = [ctx.eq.line('lvL', radius=0.02), ctx.eq.line('lvR', radius=0.02)]
        if implement == 'bar':
            st['bar'] = ctx.eq.ez_bar()
        elif implement in ('dumbbells', 'dumbbell'):
            st['w'] = ctx.eq.dumbbells()
        return st

    def pose(ctx, st, u):
        t = smootherstep(u)
        sides = ['R'] if implement == 'dumbbell' or mode == 'concentration' else SIDES
        if mode in ('preacher', 'machine'):
            sit(ctx, 0.66, y=0.2, knee=95, lean=12)
            for s in sides:
                ctx.arm_fk(s, flex=52, abd=6, elbow=lerp(12, 125, t), twist=90)
            if 'L' not in sides:  # the free arm rests on the pad
                ctx.arm_fk('L', flex=50, abd=8, elbow=35, twist=60)
        elif mode == 'concentration':
            concentration_pose(ctx, st, t)
        elif mode == 'incline':
            ctx.root((0, 0.06, 0.57), (-45, 0, 0))
            ctx.head(flex=20)
            for s in SIDES:
                ctx.target('leg.' + s, (sgn(s) * 0.22, -0.55, 0.085))
            knees_out(ctx, 0.3)
            for s in SIDES:
                ctx.arm_fk(s, flex=-45, abd=4, elbow=lerp(4, 135, t), twist=lerp(60, 90, t))
        elif mode == 'spider':
            ctx.root((0, -0.12, 0.88), (52, 0, 180))
            ctx.head(flex=-10)
            for s in SIDES:
                ctx.target('leg.' + s, (sgn(s) * 0.15, -0.55, 0.085), qz(180) @ ctx.body.rest_quat('foot.' + s))
                ctx.pole_world('leg.' + s, (0, 1, 0.3))
            for s in SIDES:
                ctx.arm_fk(s, flex=52, abd=3, elbow=lerp(4, 135, t), twist=90)
        if 'bar' in st:
            follow_hands(ctx, st['bar'])
        elif 'w' in st:
            for s, w in zip(SIDES, st['w']):
                if mode == 'concentration' and s == 'R':
                    continue  # held by concentration_pose
                if s in sides:
                    ctx.follow(w, 'hand.' + s, grip_point(s), held(s, qz(90)))
                else:
                    w.hide_render = True
                    for c in w.children:
                        c.hide_render = True
        if mode == 'machine':
            for s, lever in zip(SIDES, st['levers']):
                set_line(lever, ctx.world('forearm.' + s, 'head') + Vector((sgn(s) * 0.12, 0, -0.03)),
                         ctx.attach_point('hand.' + s, grip_point(s)) + Vector((sgn(s) * 0.07, 0, 0)))

    cams = {'preacher': cam((0, 0.0, 0.95), 75, 10, 3.6), 'machine': cam((0, 0.0, 0.95), 75, 10, 3.6),
            'concentration': cam((0, 0.0, 0.8), 25, 12, 3.4), 'incline': cam((0, 0.15, 0.85), 62, 14, 3.9),
            'spider': cam((0, -0.2, 0.75), 250, 10, 3.6)}
    spec(id_, camera=cams[mode], setup=setup, concentric='out')(pose)


seated_curl('preacher-curl', 'preacher', 'bar')
seated_curl('dumbbell-preacher-curl', 'preacher', 'dumbbell')
seated_curl('machine-bicep-curl', 'machine', 'none')
seated_curl('concentration-curl', 'concentration', 'dumbbells')
seated_curl('incline-dumbbell-curl', 'incline', 'dumbbells')
seated_curl('spider-curl', 'spider', 'dumbbells')


def _cable_pair_high(ctx):
    for x in (0.95, -0.95):
        ctx.eq.cable_column(x, 0.0, 2.0)
    return {'pulleys': [Vector((0.86, -0.09, 1.75)), Vector((-0.86, -0.09, 1.75))],
            'cables': [ctx.eq.line('cL'), ctx.eq.line('cR')],
            'h': [ctx.eq.group(f'd{s}', [ctx.eq.cyl(f'dc{s}', 0.016, 0.11, (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_metal, 16)]) for s in SIDES]}


def high_cable_curl(id_):
    def pose(ctx, st, u):
        # Arms out to the sides at shoulder height, curling the handles toward the ears.
        stand(ctx, width=0.06)
        t = smootherstep(u)
        for s, c, h, p in zip(SIDES, st['cables'], st['h'], st['pulleys']):
            ctx.arm_fk(s, abd=82, flex=8, elbow=lerp(5, 120, t), twist=90, rot=-60)
            g = ctx.attach_point('hand.' + s, grip_point(s))
            place(h, g, along((0, -1, 0)))
            set_line(c, p, g)

    spec(id_, camera=cam((0, 0, 1.2), 10, 8, 4.2), setup=_cable_pair_high, concentric='out')(pose)


high_cable_curl('cable-crossover-bicep-curl')
high_cable_curl('overhead-cable-curl')


def _low_cable_behind(ctx):
    ctx.eq.cable_column(0, 0.75, 1.2)
    return {'pulley': Vector((-0.2, 0.66, 0.12)), 'cable': ctx.eq.line('cable'),
            'h': ctx.eq.group('dh', [ctx.eq.cyl('dhc', 0.016, 0.11, (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_metal, 16)])}


@spec('bayesian-curl', camera=cam((0, 0.1, 1.0), 290, 8, 3.9), setup=_low_cable_behind, concentric='out')
def bayesian_curl(ctx, st, u):
    # Facing away from a low pulley, the working arm starts drawn back behind the body.
    stand(ctx, width=0.04, y=-0.1)
    ctx.leg_fk('L', hip_flex=12, knee=10)
    t = smootherstep(u)
    ctx.arm_fk('R', flex=-25, abd=4, elbow=lerp(4, 130, t), twist=90)
    ctx.arm_fk('L', abd=6)
    g = ctx.attach_point('hand.R', grip_point('R'))
    place(st['h'], g, along((1, 0, 0)))
    set_line(st['cable'], st['pulley'], g)


def _lying_cable(on_bench):
    def setup(ctx):
        if on_bench:
            # Pulley at bench height, so the cable runs over the thighs rather than through the hips.
            ctx.eq.flat_bench((0, 0.33))
            pulley = ctx.eq.cable_column(0, -1.35, 0.55)
        else:
            ctx.eq.cable_column(0, -1.35, 1.2)
            pulley = Vector((0, -1.26, 0.12))
        return {'pulley': pulley, 'cable': ctx.eq.line('cable'), 'bar': ctx.eq.straight_bar('lb', 0.5)}

    return setup


def lying_cable_curl(id_, on_bench):
    def pose(ctx, st, u):
        # Supine with the feet toward a low pulley; upper arms stay down by the sides.
        lie(ctx, 'flat' if on_bench else 'floor')
        t = smootherstep(u)
        for s in SIDES:
            ctx.arm_fk(s, flex=8, abd=6, elbow=lerp(4, 128, t), twist=90)
        bar = follow_hands(ctx, st['bar'])
        set_line(st['cable'], st['pulley'], bar)

    spec(id_, camera=cam((0, -0.35, 0.5 if on_bench else 0.35), 65, 18, 4.5), setup=_lying_cable(on_bench),
         concentric='out')(pose)


lying_cable_curl('lying-bicep-cable-curl-on-bench', True)
lying_cable_curl('lying-bicep-cable-curl-on-floor', False)

inverted_row_spec('bodyweight-curl', _with_bar_at(_row_bar), grip=0.18, underhand=True)


# ---------------------------------------------------------------------------------------------
# Triceps


def _pushdown_bar(ctx):
    return {'pulley': ctx.eq.cable_column(0, -0.55, 2.2), 'cable': ctx.eq.line('cable'), 'bar': ctx.eq.straight_bar('pb', 0.45)}


@spec('tricep-pushdown-with-bar', camera=cam((0, -0.1, 1.15), 68, 8, 3.9), setup=_pushdown_bar, concentric='out')
def tricep_pushdown_bar(ctx, st, u):
    stand(ctx, width=0.04, y=0.05)
    ctx.spine(flex=12)
    ctx.head(flex=-6)
    t = smootherstep(u)
    for s in SIDES:
        ctx.arm_fk(s, flex=-6, abd=-8, elbow=lerp(100, 4, t), rot=10, twist=-85)
    bar = follow_hands(ctx, st['bar'])
    set_line(st['cable'], st['pulley'], bar)


def overhead_ext_spec(id_, implement, setup, seated=False, incline=False, low_pulley=False, camera=None):
    def pose(ctx, st, u):
        t = smootherstep(u)
        if seated:
            sit(ctx, 0.47, y=0.0, knee=88, lean=-2)
        elif implement == 'cable' and not low_pulley:  # high pulley: lean away from it
            stand(ctx, width=0.06)
            ctx.leg_fk('L', hip_flex=20, knee=15)
            ctx.spine(flex=28)
        else:
            stand(ctx, width=0.06, toe_out=6)
            for s in SIDES:
                ctx.pole_dir('leg.' + s, (sgn(s) * 0.1, -1, 0))
            ctx.arm.location.z -= 0.012  # soft knees
            ctx.spine(flex=-3)  # ribs down, braced
        # Upper arms stay up by the head; the elbows straighten to press the weight overhead.
        # With the weight low behind the head the elbows drift forward and out a little, as they
        # do in a real rep, rather than staying locked to the ears.
        top = 170 if implement != 'cable' or low_pulley else 150
        for s in SIDES:
            ctx.arm_fk(s, flex=lerp(top - 18, top, t), abd=lerp(10, 0, t), elbow=lerp(130, 4, t),
                       twist=60 if implement != 'dumbbell' else 90)
        ctx.head(flex=lerp(6, 0, t))
        if implement == 'dumbbell':
            mid = fk_hand_midpoint(ctx)
            place(st['w'], mid + ctx.bone_delta('forearm.L') @ Vector((0, 0, 0.0)), ctx.bone_delta('forearm.L') @ along((0, 0, 1)))
        elif implement in ('bar', 'ez'):
            follow_hands(ctx, st['bar'])
        elif implement == 'cable':
            hands = [ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES]
            # The rope hangs from the hands toward the pulley: up and back to a high one, down to a low one.
            knot = (hands[0] + hands[1]) / 2 + (Vector((0, 0.03, -0.1)) if low_pulley else Vector((0, 0.1, -0.05)))
            for rope, h in zip(st['ropes'], hands):
                set_line(rope, knot, h)
            set_line(st['cable'], st['pulley'], knot)
        elif implement == 'machine':
            hands = [ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES]
            for s, lever, h in zip(SIDES, st['levers'], hands):
                set_line(lever, Vector((sgn(s) * 0.3, 0.3, 1.25)), h)

    spec(id_, camera=camera or cam((0, 0, 1.15 if not seated else 0.95), 60, 8, 4.0), setup=setup,
         concentric='out')(pose)


def _overhead_cable(ctx):
    ctx.eq.cable_column(0, 0.8, 2.1)
    return {'pulley': Vector((0, 0.71, 1.9)), 'cable': ctx.eq.line('cable'),
            'ropes': [ctx.eq.line('rL', radius=0.012), ctx.eq.line('rR', radius=0.012)]}


def _overhead_cable_low(ctx):
    # Low pulley just behind the heels: the rope runs up the back to the hands behind the head.
    ctx.eq.cable_column(0, 0.5, 1.2)
    return {'pulley': Vector((0, 0.41, 0.15)), 'cable': ctx.eq.line('cable'),
            'ropes': [ctx.eq.line('rL', radius=0.012), ctx.eq.line('rR', radius=0.012)]}


def _overhead_machine(ctx):
    ctx.eq.group('ext_machine', [
        ctx.eq.pad('seat', (0.4, 0.4, 0.07), (0, 0.0, 0.43)),
        ctx.eq.pad('back', (0.4, 0.07, 0.6), (0, 0.22, 0.85)),
        ctx.eq.frame('post', (0.07, 0.07, 1.3), (0, 0.32, 0.65)),
    ])
    return {'levers': [ctx.eq.line('lvL', radius=0.02), ctx.eq.line('lvR', radius=0.02)]}


overhead_ext_spec('dumbbell-standing-triceps-extension', 'dumbbell', lambda ctx: {'w': ctx.eq.dumbbell('db')})
overhead_ext_spec('barbell-standing-triceps-extension', 'ez', lambda ctx: {'bar': ctx.eq.ez_bar()})
overhead_ext_spec('overhead-cable-triceps-extension', 'cable', _overhead_cable_low, low_pulley=True,
                  camera=cam((0, 0.1, 1.15), 75, 8, 4.2))
overhead_ext_spec('overhead-cable-triceps-extension-upper-position', 'cable', _overhead_cable,
                  camera=cam((0, 0.1, 1.1), 75, 8, 4.0))
overhead_ext_spec('machine-overhead-triceps-extension', 'machine', _overhead_machine, seated=True)


def _crossbody_setup(ctx):
    # Two high pulleys either side; each hand takes the cable from the opposite side.
    for x in (0.95, -0.95):
        ctx.eq.cable_column(x, 0.0, 2.0)
    return {'pulleys': [Vector((0.86, -0.09, 1.95)), Vector((-0.86, -0.09, 1.95))],
            'cables': [ctx.eq.line('cL'), ctx.eq.line('cR')],
            'h': [ctx.eq.group(f'd{s}', [ctx.eq.cyl(f'dc{s}', 0.016, 0.11, (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_metal, 16)]) for s in SIDES]}


@spec('crossbody-cable-triceps-extension', camera=cam((0, 0, 1.2), 15, 8, 4.4), setup=_crossbody_setup,
      concentric='out')
def crossbody_triceps(ctx, st, u):
    # Handles crossed in front of the chest with the elbows bent; both arms extend out and down
    # to the sides. The right hand holds the left cable and the left hand the right one.
    stand(ctx, width=0.05)
    t = smootherstep(u)
    for s in SIDES:
        # The right forearm crosses over the left one.
        ctx.arm_fk(s, flex=lerp(50 if s == 'R' else 44, 30, t), abd=lerp(-38, 45, t), elbow=lerp(95, 8, t),
                   twist=-80)
    for s, c, h in zip(SIDES, st['cables'], st['h']):
        g = ctx.attach_point('hand.' + s, grip_point(s))
        place(h, g, along((0, 0, 1)))
        set_line(c, st['pulleys'][1 if s == 'L' else 0], g)


def lying_ext_spec(id_, kind='flat', implement='ez', smith=False):
    def setup(ctx):
        if kind == 'flat':
            ctx.eq.flat_bench((0, 0.33))
        else:
            incline_setup(ctx)  # the bench lie(ctx, 'incline') rests on
        if smith:
            return {'bar': ctx.eq.smith_machine(bar_y=0.6)}
        return {'bar': ctx.eq.ez_bar()} if implement == 'ez' else {'w': ctx.eq.dumbbells()}

    def pose(ctx, st, u):
        lie(ctx, 'flat' if kind == 'flat' else 'incline')
        t = smootherstep(u)
        base = 90 if kind == 'flat' else 140
        for s in SIDES:
            ctx.arm_fk(s, flex=lerp(base - 6, base, t), abd=-4 if implement != 'dumbbells' else 2,
                       elbow=lerp(2, 100, t), twist=-85 if implement != 'dumbbells' else 0)
        if implement == 'dumbbells':
            carry_dumbbells(ctx, st['w'], neutral=True)
        else:
            follow_hands(ctx, st['bar'])

    spec(id_, camera=cam((0, 0.3, 0.75), 70, 14, 3.5) if kind == 'flat' else cam((0, 0.15, 0.95), 62, 14, 3.9),
         setup=setup)(pose)


lying_ext_spec('lying-triceps-extension-ez-bar')
lying_ext_spec('dumbbell-lying-triceps-extension', implement='dumbbells')
lying_ext_spec('barbell-incline-triceps-extension', kind='incline')
lying_ext_spec('smith-machine-skull-crushers', smith=True)


@spec('tate-press', camera=cam((0, 0.25, 0.7), 20, 18, 3.6),
      setup=lambda ctx: (ctx.eq.flat_bench((0, 0.33)), {'w': ctx.eq.dumbbells()})[1])
def tate_press(ctx, st, u):
    # Elbows flare out and bend so the dumbbells tip in to touch the chest, then press back up.
    lie(ctx, 'flat')
    t = smootherstep(u)
    sh = shoulders(ctx)
    for s, w in zip(SIDES, st['w']):
        top = Vector((sgn(s) * 0.17, sh.y + 0.02, sh.z + lockout_z(ctx, 0.17)))
        low = ctx.attach_point('chest', (sgn(s) * 0.06, -0.2, 1.31))
        hold_dumbbell(ctx, w, s, top.lerp(low, t), Vector((-sgn(s), 0, 0)))
    elbows(ctx, (1, 0.0, 0.1))


# -- dips -------------------------------------------------------------------------------------


def dip_spec(id_, kind='bars'):
    def setup(ctx):
        st = {}
        if kind in ('bars', 'assisted'):
            ctx.eq.dip_bars(1.25)
        if kind == 'assisted':
            st['pad'] = ctx.eq.group('assist', [ctx.eq.pad('knee_pad', (0.42, 0.3, 0.06), (0, 0.06, 0.0))])
        if kind == 'rings':
            st['rings'] = [ctx.eq.group(f'rg{s}', [ctx.eq.cyl(f'rgc{s}', 0.09, 0.03, (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_pad, 32)]) for s in SIDES]
            st['straps'] = [ctx.eq.line('sL', radius=0.008), ctx.eq.line('sR', radius=0.008)]
        return st

    def pose(ctx, st, u):
        t = smootherstep(u)
        hand_z = 1.25
        x = 0.27 if kind != 'rings' else 0.23
        # Locked out on straight arms (shoulders a full arm above the hands), then lower until
        # the upper arms are about parallel to the floor.
        ctx.root((0, 0.04 * t, hand_z + 0.12 - 0.34 * t))
        ctx.spine(flex=10 + 12 * t)
        for s in SIDES:
            ctx.leg_fk(s, hip_flex=8, knee=70, ankle=-25)
        for s in SIDES:
            p = Vector((sgn(s) * x, -0.04, hand_z))
            ctx.grip(s, p, (0, -1, 0))
            if kind == 'rings':
                place(st['rings'][0 if s == 'L' else 1], p, along((0, 1, 0)))
                set_line(st['straps'][0 if s == 'L' else 1], Vector((sgn(s) * x, -0.04, 2.4)), p + Vector((0, 0, 0.07)))
        if kind == 'assisted':
            knee = (ctx.world('shin.L', 'head') + ctx.world('shin.R', 'head')) / 2
            place(st['pad'], Vector((0, knee.y + 0.08, knee.z - 0.05)))
        elbows(ctx, (0.25, 1, 0))

    spec(id_, camera=cam((0, 0, 1.0), 60, 8, 4.0), setup=setup)(pose)


dip_spec('tricep-dips')
dip_spec('ring-dip', 'rings')
dip_spec('assisted-dips', 'assisted')


@spec('bench-dip', camera=cam((0, 0.0, 0.5), 70, 10, 3.6),
      setup=lambda ctx: (ctx.eq.flat_bench((0, 0.45), length=0.5, height=0.45, yaw=90), {})[1])
def bench_dip(ctx, st, u):
    # Hands on a bench behind, heels out in front; the elbows bend straight back to lower the hips.
    t = smootherstep(u)
    ctx.root((0, 0.22, 0.6 - 0.26 * t))
    ctx.spine(flex=6)
    for s in SIDES:
        # Heels on the floor with the toes up, the feet roughly square to the straight legs.
        ctx.target('leg.' + s, (sgn(s) * 0.12, -0.7, 0.09), qx(-55) @ ctx.body.rest_quat('foot.' + s))
        ctx.pole_world('leg.' + s, (0, -0.3, 1))
        ctx.grip(s, (sgn(s) * 0.2, 0.42, 0.46), (0, -1, 0))
        ctx.pole_world('arm.' + s, (sgn(s) * 0.2, 1, 0))


def _press_machine(ctx):
    ctx.eq.group('dip_machine', [
        ctx.eq.pad('seat', (0.42, 0.42, 0.08), (0, 0.05, 0.45)),
        ctx.eq.pad('back', (0.42, 0.08, 0.65), (0, 0.3, 0.85)),
        ctx.eq.frame('post', (0.1, 0.1, 0.45), (0, 0.1, 0.22)),
    ])
    return {'levers': [ctx.eq.line('lvL', radius=0.02), ctx.eq.line('lvR', radius=0.02)]}


@spec('tricep-press', camera=cam((0, 0.0, 0.9), 50, 8, 3.7), setup=_press_machine, concentric='out')
def tricep_press(ctx, st, u):
    # Seated dip machine: handles beside the ribs press down to straight arms by the hips.
    sit(ctx, 0.45, y=0.08, knee=88)
    t = smootherstep(u)
    sh = shoulders(ctx)
    for s, lever in zip(SIDES, st['levers']):
        hi = Vector((sgn(s) * 0.26, sh.y + 0.0, sh.z - 0.3))
        lo = Vector((sgn(s) * 0.27, sh.y + 0.02, sh.z - M.grip_reach() * 0.97))
        p = hi.lerp(lo, t)
        ctx.grip(s, p, (0, -1, 0))
        set_line(lever, Vector((sgn(s) * 0.3, 0.45, 0.7)), p)
    elbows(ctx, (0.15, 1, 0))


def _ext_bar(ctx):
    ctx.eq.rack_pins(0.95, y=-0.75)
    place(ctx.eq.straight_bar('ext_bar', 1.3), (0, -0.75, 0.95))  # resting across the pins
    return {}


@spec('triceps-bodyweight-extension', camera=cam((0, -0.3, 0.8), 70, 10, 4.0), setup=_ext_bar)
def triceps_bodyweight_extension(ctx, st, u):
    # Leaning into a bar at hip height on straight arms; the elbows bend to drop the head under it.
    t = smootherstep(u)
    bar = Vector((0, -0.75, 0.95))
    theta = lerp(48, 36, t)
    ctx.pin_root(M.joint('ankle'), Vector((0, 0.45, 0.085)), (theta, 0, 0))
    ctx.head(flex=-20)
    for s in SIDES:
        ctx.leg_fk(s)
    for s in SIDES:
        ctx.grip(s, bar + Vector((sgn(s) * 0.14, 0, 0)), (-sgn(s), 0, 0))
        ctx.pole_world('arm.' + s, (sgn(s) * 0.1, -0.3, -1))

