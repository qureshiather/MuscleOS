"""Pulling families: bent-over and supported rows, inverted rows, upright rows and shrugs,
pulldown and pull-up variants."""

import math

from mathutils import Vector

import mannequin as M
from anim import X, lerp, sgn, smootherstep
from equipment import along, place, qz, set_line
from moves import SIDES, STAND_Z, bar_grip, elbows, feet, hold_dumbbell, knees_out, shoulders, sit, stand
from registry import barbell, cam, dumbbells, spec

# ---------------------------------------------------------------------------------------------
# Bent-over rows


def bent_over(ctx, hinge=48, back=0.17, drop=0.07, width=0.04):
    ctx.root((0, back, STAND_Z - drop))
    ctx.bone('pelvis', (X, hinge))
    ctx.spine(flex=-2)
    ctx.head(flex=-30)
    feet(ctx, width=width)
    knees_out(ctx, 0.2)


def row_spec(id_, implement='bar', grip=0.26, hinge=48, target=(0, -0.15, 1.12), wide=False, from_floor=False,
             one_arm=False, camera=None, setup=None):
    camera = camera or cam((0, 0, 0.8), 64, 10, 3.9)
    if setup is None:
        setup = {'bar': barbell, 'dumbbells': dumbbells, 'kettlebells': lambda ctx: {'w': [ctx.eq.kettlebell('kbL'), ctx.eq.kettlebell('kbR')]}}[implement]

    def pose(ctx, st, u):
        t = smootherstep(u)
        if from_floor:  # Pendlay: torso near parallel, the bar returns to the floor every rep
            bent_over(ctx, hinge=hinge, back=0.25, drop=0.2)
        else:
            bent_over(ctx, hinge=hinge)
        sides = ['R'] if one_arm else SIDES
        if implement == 'bar':
            hang = [ctx.grip_hang(s, ctx.world('upperarm.' + s, 'head').y + 0.02, grip) for s in SIDES]
            low = (hang[0] + hang[1]) / 2
            if from_floor:
                low.z = 0.225
            pulled = ctx.attach_point('spine', target)
            bar = lerp(low, pulled, t)
            place(st['bar'], bar)
            bar_grip(ctx, bar, grip)
        else:
            for s, w in zip(sides, st.get('w') or st['db']):
                sh = ctx.world('upperarm.' + s, 'head')
                low = ctx.grip_hang(s, sh.y + 0.02, grip)
                hip = ctx.attach_point('spine', (sgn(s) * (grip + (0.12 if wide else 0.0)), -0.06 if not wide else -0.1,
                                                 target[2] + (0.15 if wide else 0)))
                p = lerp(low, hip, t)
                thumb = Vector((-sgn(s), 0, 0)) if wide else Vector((0, -1, 0))
                if implement == 'dumbbells':
                    hold_dumbbell(ctx, w, s, p, thumb)
                else:
                    ctx.grip(s, p, thumb)
                    place(w, p)
        if one_arm:
            ctx.arm_fk('L', flex=5)
        elbows(ctx, (1, 0.2, 0.6) if wide else (0.35, 0.6, 1))

    spec(id_, camera=camera, setup=setup, concentric='out')(pose)


row_spec('pendlay-row', hinge=78, from_floor=True, camera=cam((0, 0, 0.6), 64, 10, 3.9))
row_spec('barbell-rear-delt-row', grip=0.36, hinge=70, target=(0, -0.16, 1.32), wide=True)
row_spec('dumbbell-rear-delt-row', implement='dumbbells', grip=0.2, hinge=70, target=(0, -0.16, 1.2), wide=True)
row_spec('monkey-row', implement='dumbbells', grip=0.2, hinge=60)
row_spec('gorilla-row', implement='kettlebells', grip=0.22, hinge=62, camera=cam((0, 0, 0.6), 40, 12, 3.9))


def _bench_row_setup(implement):
    def setup(ctx):
        ctx.eq.flat_bench((0.0, 0.05), length=1.15, height=0.44)
        return {'w': [ctx.eq.kettlebell('kb')] if implement == 'kb' else [ctx.eq.dumbbell('db')]}

    return setup


def one_arm_bench_row(id_, implement='db', kroc=False):
    def pose(ctx, st, u):
        # Left knee and hand on the bench, right foot planted; the right arm rows to the hip.
        t = smootherstep(u)
        ctx.root((-0.05, 0.25, 0.83 if not kroc else 0.9), (78 if not kroc else 60, 0, 0))
        ctx.head(flex=-20)
        ctx.target('leg.L', (0.04, 0.48, 0.52), qz(0) @ ctx.body.rest_quat('foot.L'))
        ctx.pole_world('leg.L', (0, -0.3, -1))
        ctx.target('leg.R', (-0.32, 0.35, 0.085))
        ctx.pole_dir('leg.R', (-0.3, -1, 0))
        ctx.grip('L', (0.04, -0.42, 0.47), (0, -1, 0))
        ctx.pole_world('arm.L', (0.3, 0.3, 1))
        sh = ctx.world('upperarm.R', 'head')
        low = ctx.grip_hang('R', sh.y + 0.02, abs(sh.x) - 0.02)
        hip = ctx.attach_point('spine', (-0.2, -0.04, 1.1))
        p = lerp(low, hip, t)
        if implement == 'kb':
            ctx.grip('R', p, (0, -1, 0))
            place(st['w'][0], p)
        else:
            hold_dumbbell(ctx, st['w'][0], 'R', p, Vector((0, -1, 0)))
        ctx.pole_world('arm.R', (-0.2, 0.4, 1))

    spec(id_, camera=cam((0, 0.0, 0.75), 300, 14, 3.8), setup=_bench_row_setup(implement), concentric='out')(pose)


one_arm_bench_row('dumbbell-row')
one_arm_bench_row('kettlebell-row', implement='kb')
one_arm_bench_row('kroc-row', kroc=True)


def _smith_row(ctx):
    bar = ctx.eq.smith_machine(bar_y=0.0)
    frame = ctx.eq.objects[-2]
    place(frame, (-0.25, 0.1, 0), qz(90))  # rails front and back: the bar runs beside the lifter
    return {'bar': bar}


@spec('smith-machine-one-handed-row', camera=cam((0, 0.0, 0.8), 300, 12, 3.9), setup=_smith_row, concentric='out')
def smith_one_arm_row(ctx, st, u):
    # Bent over beside the bar, left hand braced on the knee; the right hand rows the bar to the hip.
    t = smootherstep(u)
    bent_over(ctx, hinge=50, width=0.08)
    sh = ctx.world('upperarm.R', 'head')
    low = ctx.grip_hang('R', sh.y + 0.02, abs(sh.x) + 0.03)
    hip = ctx.attach_point('spine', (-0.23, -0.04, 1.1))
    p = lerp(low, hip, t)
    ctx.grip('R', p, (0, -1, 0))
    place(st['bar'], Vector((p.x, 0.1, p.z)), along((0, 1, 0)))
    ctx.grip('L', ctx.attach_point('thigh.L', (0.1, -0.1, 0.62)), (0, -1, 0))
    ctx.pole_world('arm.R', (-0.2, 0.4, 1))
    ctx.pole_world('arm.L', (0.5, 0.3, 0.2))


def _incline_prone_setup(ctx):
    ctx.eq.incline_bench(40)
    return {'db': ctx.eq.dumbbells()}


@spec('chest-supported-dumbbell-row', camera=cam((0, 0.0, 0.8), 70, 12, 3.9), setup=_incline_prone_setup,
      concentric='out')
def chest_supported_row(ctx, st, u):
    # Chest on an incline bench (facing it), arms hanging; row to the hips.
    t = smootherstep(u)
    ctx.root((0, -0.12, 0.88), (52, 0, 180))
    ctx.head(flex=-10)
    for s in SIDES:
        ctx.target('leg.' + s, (sgn(s) * 0.15, -0.55, 0.085), qz(180) @ ctx.body.rest_quat('foot.' + s))
        ctx.pole_world('leg.' + s, (0, 1, 0.3))
    for s, w in zip(SIDES, st['db']):
        sh = ctx.world('upperarm.' + s, 'head')
        low = Vector((sh.x * 1.05, sh.y, sh.z - M.grip_reach() * 0.97))
        hip = ctx.attach_point('spine', (sgn(s) * 0.2, -0.05, 1.12))
        hold_dumbbell(ctx, w, s, lerp(low, hip, t), Vector((0, 1, 0)))
    elbows(ctx, (0.35, 0.6, 1))


def _seal_setup(ctx):
    ctx.eq.flat_bench((0, 0.2), length=1.3, height=0.78)
    return barbell(ctx)


@spec('seal-row', camera=cam((0, 0.2, 0.7), 70, 10, 4.0), setup=_seal_setup, concentric='out')
def seal_row(ctx, st, u):
    # Face down on a high bench; the bar is pulled up to the underside of the bench.
    t = smootherstep(u)
    ctx.root((0, 0.38, 0.9), (90, 0, 0))
    ctx.head(flex=-20)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=-2, knee=12, ankle=-30)
    sh = shoulders(ctx)
    low = Vector((0, sh.y, max(sh.z - M.grip_reach() * 0.97, 0.235)))
    top = Vector((0, sh.y + 0.05, 0.7))
    bar = lerp(low, top, t)
    place(st['bar'], bar)
    bar_grip(ctx, bar, 0.27)
    elbows(ctx, (0.4, 1, 0.3))


def _tbar_setup(ctx):
    anchor, line = ctx.eq.landmine((0, 1.2, 0.04))
    plates = ctx.eq.group('tbar_plates', [ctx.eq.cyl('tp', 0.2, 0.05, (0, 0, 0), (math.pi / 2, 0, 0), ctx.eq.m_equip, 48)])
    handle = ctx.eq.group('tbar_handle', [
        ctx.eq.cyl('thL', 0.015, 0.12, (0.06, 0, 0), (math.pi / 2, 0, 0), ctx.eq.m_metal, 16),
        ctx.eq.cyl('thR', 0.015, 0.12, (-0.06, 0, 0), (math.pi / 2, 0, 0), ctx.eq.m_metal, 16),
    ])
    return {'anchor': anchor, 'bar': line, 'plates': plates, 'handle': handle}


@spec('t-bar-row', camera=cam((0, 0.1, 0.75), 70, 12, 4.2), setup=_tbar_setup, concentric='out')
def t_bar_row(ctx, st, u):
    # Straddling a landmine bar, a V-handle under its end; row the end to the chest.
    t = smootherstep(u)
    bent_over(ctx, hinge=52, width=0.1)
    sh = shoulders(ctx)
    low = Vector((0, sh.y + 0.03, sh.z - M.grip_reach() * 0.95))
    top = ctx.attach_point('spine', (0, -0.18, 1.18))
    end = lerp(low, top, t)
    place(st['handle'], end)
    for s in SIDES:
        ctx.grip(s, end + Vector((sgn(s) * 0.06, 0, 0)), (0, -1, 0))
    tip = end + Vector((0, -0.25, -0.04))
    set_line(st['bar'], st['anchor'], tip)
    place(st['plates'], tip + (tip - st['anchor']).normalized() * -0.05, along((0, 1, 0)) @ qz(0))
    elbows(ctx, (0.3, 0.6, 1))


def _renegade_setup(ctx):
    return {'db': ctx.eq.dumbbells()}


@spec('renegade-row', camera=cam((0, 0.1, 0.3), 60, 14, 3.9), setup=_renegade_setup, concentric='out')
def renegade_row(ctx, st, u):
    # High plank on two dumbbells; the right arm rows while the left holds the plank.
    t = smootherstep(u)
    ctx.root((0, 0.0, 0.62), (68, 0, 0))
    ctx.head(flex=-50)
    for s in SIDES:
        ctx.target('leg.' + s, (sgn(s) * 0.17, 0.95, 0.06))
        ctx.pole_world('leg.' + s, (0, 0, 1))
    for s, w in zip(SIDES, st['db']):
        sh = ctx.world('upperarm.' + s, 'head')
        floor = Vector((sh.x, sh.y - 0.02, 0.1))
        p = floor if s == 'L' else lerp(floor, ctx.attach_point('spine', (-0.2, -0.04, 1.12)), t)
        hold_dumbbell(ctx, w, s, p, Vector((0, -1, 0)))
    ctx.pole_world('arm.L', (0, 1, 0))
    ctx.pole_world('arm.R', (-0.3, 0.6, 1))


# ---------------------------------------------------------------------------------------------
# Inverted rows: a rigid body pivoting on the heels, chest to the bar


def inverted_row_spec(id_, setup, grip=0.3, underhand=False, straps=False, camera=None):
    def pose(ctx, st, u):
        t = smootherstep(u)
        bar = st['bar_point']
        heel = Vector((0, -1.05, 0.06))
        target = lerp(M.grip_reach() * 0.985, 0.33, t)

        def place_body(theta):
            q = ctx.root_rot_quat((-90 + theta, 0, 0))
            ctx.pin_root(M.joint('ankle'), heel + Vector((0, 0, 0.02)), (-90 + theta, 0, 0))
            del q
            sh = shoulders(ctx)
            return (Vector((0, bar.y, bar.z)) - sh).length

        lo, hi = 5.0, 70.0
        for _ in range(16):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if place_body(mid) > target else (lo, mid)
        place_body((lo + hi) / 2)
        ctx.head(flex=8)
        for s in SIDES:
            ctx.leg_fk(s)
        if straps:
            for s, (ring, strap) in zip(SIDES, zip(st['handles'], st['straps'])):
                hand = Vector((sgn(s) * grip, bar.y, bar.z))
                ctx.grip(s, hand, (0, -1, 0))
                place(ring, hand, along((0, 1, 0)))
                set_line(strap, Vector((sgn(s) * grip, bar.y, 2.3)), hand)
        else:
            bar_grip(ctx, bar, grip, underhand=underhand)
        elbows(ctx, (0.5, -0.2, -1) if not underhand else (0.2, -0.4, -1))

    spec(id_, camera=camera or cam((0, -0.4, 0.6), 70, 10, 4.0), setup=setup, concentric='out')(pose)


def _row_bar(ctx):
    ctx.eq.rack_pins(1.0, y=0.25)
    return {'bar_point': Vector((0, 0.25, 1.0)), 'bar': ctx.eq.barbell(plates=1)}


def _with_bar_at(setup):
    def s(ctx):
        st = setup(ctx)
        place(st['bar'], st['bar_point'])
        return st

    return s


def _ring_row(ctx):
    return {'bar_point': Vector((0, 0.25, 1.05)), 'handles': [ctx.eq.group(f'ring{s}', [ctx.eq.cyl(f'rg{s}', 0.09, 0.03, (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_pad, 32)]) for s in SIDES],
            'straps': [ctx.eq.line('strapL', radius=0.008), ctx.eq.line('strapR', radius=0.008)]}


def _towel_row(ctx):
    return {'bar_point': Vector((0, 0.25, 1.05)), 'handles': [ctx.eq.group(f'tw{s}', [ctx.eq.box(f'twb{s}', (0.06, 0.03, 0.14), (0, 0, 0), ctx.eq.m_accent, 0.01)]) for s in SIDES],
            'straps': [ctx.eq.line('towelL', accent=True, radius=0.02), ctx.eq.line('towelR', accent=True, radius=0.02)]}


inverted_row_spec('inverted-row', _with_bar_at(_row_bar))
inverted_row_spec('inverted-row-with-underhand-grip', _with_bar_at(_row_bar), grip=0.24, underhand=True)
inverted_row_spec('ring-row', _ring_row, grip=0.24, straps=True)
inverted_row_spec('towel-row', _towel_row, grip=0.14, straps=True)


# ---------------------------------------------------------------------------------------------
# Upright row and shrugs


@spec('upright-row', camera=cam((0, 0, 1.1), 30, 8, 3.9), setup=barbell, concentric='out')
def upright_row(ctx, st, u):
    # Bar travels up the body to the lower chest, elbows leading and finishing above the hands.
    stand(ctx, width=0.03)
    t = smootherstep(u)
    sh = shoulders(ctx)
    low = Vector((0, -0.11, sh.z - M.grip_reach() * 0.985))
    top = Vector((0, -0.13, sh.z - 0.1))
    bar = lerp(low, top, t)
    place(st['bar'], bar)
    bar_grip(ctx, bar, 0.16)
    elbows(ctx, (1, 0.1, lerp(0, 0.8, t)))


def shrug_spec(id_, implement='bar', smith=False):
    def setup(ctx):
        if smith:
            return {'bar': ctx.eq.smith_machine(bar_y=-0.11)}
        return barbell(ctx) if implement == 'bar' else dumbbells(ctx)

    def pose(ctx, st, u):
        stand(ctx, width=0.03)
        t = smootherstep(u)
        for s in SIDES:
            ctx.shoulder_girdle(s, shrug=38 * t)
        if implement == 'bar':
            sh = shoulders(ctx)
            z = sh.z - M.grip_reach() * 0.985
            place(st['bar'], (0, -0.11, z))
            bar_grip(ctx, (0, -0.11, z), 0.25)
        else:
            for s, w in zip(SIDES, st['db']):
                sh = ctx.world('upperarm.' + s, 'head')
                hold_dumbbell(ctx, w, s, ctx.grip_hang(s, sh.y, 0.25), Vector((0, -1, 0)))
        elbows(ctx, (0.3, 1, 0))

    spec(id_, camera=cam((0, 0, 1.05), 30, 8, 3.8), setup=setup, concentric='out')(pose)


shrug_spec('dumbbell-shrug', implement='dumbbells')
shrug_spec('smith-machine-shrug', smith=True)


# ---------------------------------------------------------------------------------------------
# Pulldowns


def pulldown_spec(id_, grip=0.38, handle='bar', underhand=False, one_arm=False, machine=False):
    def setup(ctx):
        st = ctx.eq.lat_pulldown()
        if handle != 'bar':
            st['bar'].hide_render = True
            for c in st['bar'].children:
                c.hide_render = True
            st['ends'] = [ctx.eq.group(f'h{s}', [ctx.eq.cyl(f'hd{s}', 0.016, 0.12, (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_metal, 16)]) for s in SIDES]
            if handle == 'rope':
                st['ropes'] = [ctx.eq.line('ropeL', radius=0.012), ctx.eq.line('ropeR', radius=0.012)]
        if machine:
            st['cable'].hide_render = True
            st['levers'] = [ctx.eq.line('leverL', radius=0.02), ctx.eq.line('leverR', radius=0.02)]
        return st

    def pose(ctx, st, u):
        t = smootherstep(u)
        sit(ctx, 0.44, y=0.1, knee=95, hip_flex=90, hip_abd=6, lean=-10 - 6 * t)
        ctx.head(flex=-12 * t)
        sh = shoulders(ctx)
        top = Vector((0, st['pulley'].y, sh.z + 0.62))
        bottom = ctx.attach_point('chest', (0, -0.15, 1.42))
        center = lerp(top, bottom, t)
        sides = ['R'] if one_arm else SIDES
        if handle == 'bar':
            place(st['bar'], center)
            bar_grip(ctx, center, grip, underhand=underhand)
        else:
            for s, end in zip(SIDES, st['ends']):
                if s not in sides:
                    end.hide_render = True
                    continue
                spread = grip if handle != 'single' else 0.0
                x = sgn(s) * spread if not one_arm else -0.18
                p = center + Vector((x, 0, 0))
                ctx.grip(s, p, (0, -1, 0))
                place(end, p, along((0, -1, 0)))
                if handle == 'rope':
                    set_line(st['ropes'][0 if s == 'L' else 1], center + Vector((0, 0, 0.12)), p)
        if machine:
            for s, lever in zip(SIDES, st['levers']):
                set_line(lever, Vector((sgn(s) * 0.5, -0.5, 2.2)), center + Vector((sgn(s) * grip, 0, 0)))
        else:
            set_line(st['cable'], st['pulley'], center + (Vector((-0.18, 0, 0)) if one_arm else Vector()))
        if one_arm:
            ctx.arm_fk('L', abd=10)
        elbows(ctx, (0.9 if not (underhand or handle in ('single', 'rope')) else 0.4, 0.15 if not underhand else -0.3, -1))

    spec(id_, camera=cam((0, 0.0, 1.3), 205, 10, 4.2), setup=setup, concentric='out')(pose)


pulldown_spec('lat-pulldown-with-neutral-grip', grip=0.27, handle='parallel')
pulldown_spec('lat-pulldown-with-supinated-grip', grip=0.28, underhand=True)
pulldown_spec('close-grip-lat-pulldown', grip=0.05, handle='parallel')
pulldown_spec('neutral-close-grip-lat-pulldown', grip=0.05, handle='parallel')
pulldown_spec('rope-lat-pulldown', grip=0.12, handle='rope')
pulldown_spec('one-handed-lat-pulldown', handle='single', one_arm=True)
pulldown_spec('machine-lat-pulldown', grip=0.36, machine=True)


def _straight_arm_setup(ctx):
    pulley = ctx.eq.cable_column(0, -0.75, 2.2)
    return {'pulley': pulley, 'bar': ctx.eq.straight_bar('sa_bar', 0.6), 'cable': ctx.eq.line('cable')}


@spec('straight-arm-lat-pulldown', camera=cam((0, -0.2, 1.1), 70, 8, 4.0), setup=_straight_arm_setup,
      concentric='out')
def straight_arm_pulldown(ctx, st, u):
    # Arms stay straight and sweep the bar from eye level down to the thighs; slight hip hinge.
    stand(ctx, width=0.05, y=0.05)
    ctx.bone('pelvis', (X, 22))
    ctx.spine(flex=4)
    t = smootherstep(u)
    for s in SIDES:
        ctx.arm_fk(s, flex=lerp(118, 22, t), abd=4, elbow=6)
    hands = [ctx.attach_point('hand.' + s, M.grip_point(s)) for s in SIDES]
    bar = (hands[0] + hands[1]) / 2
    place(st['bar'], bar)
    bar_grip(ctx, bar, abs(hands[0].x - hands[1].x) / 2)
    set_line(st['cable'], st['pulley'], bar)
    elbows(ctx, (0.3, 1, 0))


# ---------------------------------------------------------------------------------------------
# Pull-ups and hangs


def pullup_spec(id_, grip=0.31, underhand=False, neutral=False, chest=False, towel=False, rings=False,
                assisted=False, scap=False, hang=False, one_arm=False):
    def setup(ctx):
        st = {'bar': ctx.eq.pullup_bar()}
        if towel or rings:
            st['handles'] = [ctx.eq.group(f'g{s}', [ctx.eq.cyl(f'gc{s}', 0.016 if towel else 0.09, 0.14 if towel else 0.03,
                                                               (0, 0, 0), (0, math.pi / 2, 0), ctx.eq.m_accent if towel else ctx.eq.m_pad, 24)]) for s in SIDES]
            st['straps'] = [ctx.eq.line('sL', accent=towel, radius=0.02 if towel else 0.008), ctx.eq.line('sR', accent=towel, radius=0.02 if towel else 0.008)]
        if assisted:
            ctx.eq.group('assist', [
                ctx.eq.pad('knee_pad', (0.42, 0.3, 0.06), (0, 0.06, 0.0)),
            ])
            st['pad'] = ctx.eq.objects[-1]
        return st

    def pose(ctx, st, u):
        bar = st['bar']
        t = smootherstep(u)
        if hang or scap:
            t = 0.12 * t if scap else 0.0
        hand_z = bar.z - (0.32 if towel else 0.0) - (0.4 if rings else 0.0)
        lift = (0.44 if not chest else 0.56) * t
        ctx.root((0, 0.03 + (0.06 * t if chest else 0), hand_z - 1.06 + lift + (0.07 * smootherstep(u) if scap else 0)))
        ctx.spine(flex=-8 * t - (10 * t if chest else 0))
        ctx.head(flex=-12 * t)
        if scap:
            # Arms stay straight; the shoulder blades pull down, lifting the body a few centimetres.
            for s in SIDES:
                ctx.shoulder_girdle(s, shrug=lerp(25, -20, smootherstep(u)))
        if assisted:
            for s in SIDES:
                ctx.leg_fk(s, hip_flex=0, knee=92, ankle=-20)
            knee = (ctx.world('shin.L', 'head') + ctx.world('shin.R', 'head')) / 2
            place(st['pad'], Vector((0, knee.y + 0.08, knee.z - 0.05)))
        else:
            for s in SIDES:
                ctx.leg_fk(s, hip_flex=12, knee=28, ankle=-25)
        sides = ['R'] if one_arm else SIDES
        if towel or rings:
            for s, g, strap in zip(SIDES, st['handles'], st['straps']):
                p = Vector((sgn(s) * grip, bar.y, hand_z))
                ctx.grip(s, p, (0, -1, 0))
                place(g, p, along((0, 1, 0)) if towel else along((0, 0, 1)))
                set_line(strap, Vector((sgn(s) * grip, bar.y, bar.z)), p + Vector((0, 0, 0.07)))
        else:
            for s in sides:
                thumb = Vector((0, -1, 0)) if neutral else Vector((sgn(s) * (1 if underhand else -1), 0, 0))
                ctx.grip(s, Vector((sgn(s) * grip, bar.y, bar.z)), thumb)
        if one_arm:
            ctx.arm_fk('L', abd=25)
            ctx.arm.location.x += 0.05
        elbows(ctx, (0.7, -0.05, -1) if not (underhand or neutral) else (0.3, -0.35, -1))

    concentric = 'out'
    timing = dict(hold_start=0.0, out=0.5, hold_end=0.0) if hang else {}
    spec(id_, camera=cam((0, 0, 1.45), 32, 6, 4.6), setup=setup, concentric=concentric, timing=timing,
         pulse_floor=0.82 if hang else 0.72)(pose)


pullup_spec('chinups', grip=0.2, underhand=True)
pullup_spec('close-grip-chin-up', grip=0.12, underhand=True)
pullup_spec('pull-ups-with-a-neutral-grip', grip=0.25, neutral=True)
pullup_spec('chest-to-bar', chest=True)
pullup_spec('towel-pull-up', grip=0.22, towel=True)
pullup_spec('ring-pull-up', grip=0.24, rings=True)
pullup_spec('assisted-pull-up', assisted=True)
pullup_spec('assisted-chin-up', grip=0.2, underhand=True, assisted=True)
pullup_spec('scap-pull-up', scap=True)
pullup_spec('bar-hang', hang=True)
pullup_spec('one-handed-bar-hang', hang=True, one_arm=True, grip=0.05)
