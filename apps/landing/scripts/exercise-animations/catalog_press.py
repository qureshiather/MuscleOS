"""Bench and overhead press families: barbell, dumbbell, kettlebell, Smith and machine variants
of lying, inclined, seated and standing presses."""

import math

from mathutils import Quaternion, Vector

import mannequin as M
from anim import lerp, sgn, smootherstep
from equipment import place, qx, set_line
from moves import SIDES, bar_grip, elbows, hold_dumbbell, knees_out, lie_on_bench, shoulders, sit, stand
from registry import cam, spec


def lockout_z(ctx, grip, up=Vector((0, 0, 1))):
    """Height above the shoulders where straight arms reach a grip `grip` m either side."""
    reach = M.grip_reach() * 0.995
    dx = max(grip - abs(M.joint('shoulder').x), 0.0)
    return math.sqrt(reach**2 - dx**2)


def lerp_path(a, b, t):
    return Vector(a).lerp(Vector(b), smootherstep(t))


# ---------------------------------------------------------------------------------------------
# Lying presses: bar or dumbbells from the chest to over the shoulders


def bench_setup(kind='flat', implement='bar', pins=None, board=False, bands=False, smith=False, floor=False):
    def setup(ctx):
        st = {}
        if kind == 'flat' and not floor:
            ctx.eq.flat_bench((0, 0.33))
        elif kind == 'decline':
            ctx.eq.decline_bench((0, 0.33), 15)
        elif kind == 'incline':
            ctx.eq.incline_bench(55)
        if smith:
            st['bar'] = ctx.eq.smith_machine(bar_y=0.42 if kind != 'incline' else 0.2)
        elif implement == 'bar':
            st['bar'] = ctx.eq.barbell()
        elif implement == 'dumbbells':
            st['w'] = ctx.eq.dumbbells()
        elif implement == 'kettlebells':
            st['w'] = [ctx.eq.kettlebell('kbL'), ctx.eq.kettlebell('kbR')]
        if pins is not None:
            ctx.eq.rack_pins(pins, y=0.4)
        if board:
            st['board'] = ctx.eq.group('board', [ctx.eq.pad('board_block', (0.14, 0.09, 0.3), (0, 0, 0))])
        if bands:
            ctx.eq.rack_pins(2.05, y=0.42)
            st['bands'] = [ctx.eq.line('bandL', accent=True, radius=0.009), ctx.eq.line('bandR', accent=True, radius=0.009)]
        return st

    return setup


def lie(ctx, kind, legs='planted'):
    """Supine on a flat, decline or incline bench, or on the floor."""
    if kind == 'flat':
        lie_on_bench(ctx)
    elif kind == 'floor':
        ctx.root((0, 0.0, 0.11), (-90, 0, 0))
        ctx.head(flex=6)
        for s in SIDES:
            ctx.target('leg.' + s, (sgn(s) * 0.2, -0.55, 0.085))
            ctx.pole_world('leg.' + s, (sgn(s) * 0.3, 0, 1))
    elif kind == 'decline':
        ctx.root((0, 0.06, 0.6), (-105, 0, 0))
        ctx.head(flex=6)
        for s in SIDES:
            ctx.leg_fk(s, hip_flex=55, knee=95, ankle=10)
    elif kind == 'incline':
        ctx.root((0, 0.06, 0.57), (-55, 0, 0))
        ctx.head(flex=20)
        for s in SIDES:
            ctx.target('leg.' + s, (sgn(s) * 0.24, -0.55, 0.085))
        knees_out(ctx, 0.35)
    if legs == 'up':
        for s in SIDES:
            ctx.leg_fk(s, hip_flex=88, knee=90, ankle=5)


def press_spec(id_, kind='flat', implement='bar', grip=0.4, tuck=0.9, depth=0.0, legs='planted', pins=None,
               board=False, bands=False, smith=False, underhand=False, concentric='back', camera=None):
    floor = kind == 'floor'
    camera = camera or cam((0, 0.25 if kind != 'incline' else 0.15, 0.7 if not floor else 0.35),
                           68 if kind != 'incline' else 62, 14, 3.7)
    setup = bench_setup('flat' if floor else kind, implement, pins, board, bands, smith, floor)

    def pose(ctx, st, u):
        lie(ctx, kind, legs)
        sh = shoulders(ctx)
        chest = ctx.attach_point('chest', (0, -0.135, 1.3 if kind != 'incline' else 1.35))
        if floor:
            chest.z = max(chest.z, sh.z + 0.17)  # the elbows meet the floor first
        chest += Vector((0, 0, depth))
        top = Vector((0, sh.y + (0.08 if kind != 'incline' else 0.0), sh.z + lockout_z(ctx, grip)))
        t = u if concentric == 'back' else 1 - u
        if implement == 'bar':
            bar = lerp_path(top, chest + Vector((0, 0, 0.015)), t)
            place(st['bar'], bar)
            bar_grip(ctx, bar, grip, underhand=underhand)
            if 'board' in st:
                # Boards lie flat on the chest, long side along the torso; the bar touches the top.
                place(st['board'], ctx.attach_point('chest', (0, -0.18, 1.3)), ctx.bone_delta('chest'))
            if 'bands' in st:
                for s, band in zip(SIDES, st['bands']):
                    set_line(band, bar + Vector((sgn(s) * 0.58, 0, 0)), Vector((sgn(s) * 0.58, 0.42, 2.05)))
        else:
            for s, w in zip(SIDES, st['w']):
                hi = Vector((sgn(s) * 0.17, sh.y + 0.05, sh.z + lockout_z(ctx, 0.17)))
                lo = Vector((sgn(s) * 0.3, chest.y, chest.z + 0.06))
                p = lerp_path(hi, lo, t)
                if implement == 'dumbbells':
                    hold_dumbbell(ctx, w, s, p, Vector((-sgn(s), 0, 0)))
                else:
                    ctx.grip(s, p, Vector((-sgn(s), 0, 0)))
                    place(w, p, Quaternion((1, 0, 0), math.radians(-15)))  # bell rests on the back of the forearm
        elbows(ctx, (tuck, 1, -0.4))

    spec(id_, camera=camera, setup=setup, concentric='back' if concentric == 'back' else 'out')(pose)


press_spec('close-grip-bench', grip=0.25, tuck=0.45)
press_spec('board-press', board=True, depth=0.09)
press_spec('pin-bench-press', pins=0.78, depth=0.04, concentric='out')
press_spec('feet-up-bench-press', legs='up')
press_spec('close-grip-feet-up-bench-press', grip=0.25, tuck=0.45, legs='up')
press_spec('band-assisted-bench-press', bands=True)
press_spec('decline-bench-press', kind='decline')
press_spec('floor-press', kind='floor', camera=cam((0, 0.2, 0.3), 60, 18, 3.6))
press_spec('dumbbell-chest-press', implement='dumbbells')
press_spec('dumbbell-floor-press', kind='floor', implement='dumbbells', camera=cam((0, 0.2, 0.3), 60, 18, 3.6))
press_spec('dumbbell-decline-chest-press', kind='decline', implement='dumbbells')
press_spec('dumbbell-incline-press', kind='incline', implement='dumbbells')
press_spec('kettlebell-floor-press', kind='floor', implement='kettlebells', camera=cam((0, 0.2, 0.3), 60, 18, 3.6))
press_spec('smith-machine-bench-press', smith=True)
press_spec('smith-machine-close-grip-bench-press', smith=True, grip=0.25, tuck=0.45)
press_spec('smith-machine-decline-bench-press', kind='decline', smith=True)
press_spec('smith-machine-incline-bench-press', kind='incline', smith=True)
press_spec('smith-machine-reverse-grip-bench-press', smith=True, grip=0.3, tuck=0.35, underhand=True)


@spec('dumbbell-fly', camera=cam((0, 0.25, 0.7), 40, 25, 3.7), setup=bench_setup('flat', 'dumbbells'))
def dumbbell_fly(ctx, st, u):
    # Arms open in a wide arc with a fixed soft bend; palms face each other.
    lie(ctx, 'flat')
    t = smootherstep(u)
    for s in SIDES:
        ctx.arm_fk(s, flex=lerp(88, 70, t), abd=lerp(4, 72, t), elbow=lerp(10, 22, t), rot=-15 * t, twist=-90)
    for s, w in zip(SIDES, st['w']):
        ctx.follow(w, 'hand.' + s, M.grip_point(s), M.arm_rest_rot(s) @ Quaternion((0, 0, 1), math.radians(90)))


# ---------------------------------------------------------------------------------------------
# Overhead presses


def ohp_setup(implement='bar', seat=None, smith=False, machine=False, floor_sit=False, landmine=False):
    def setup(ctx):
        st = {}
        if seat == 'bench':
            ctx.eq.group('upright_bench', [
                ctx.eq.pad('seat', (0.3, 0.32, 0.07), (0, 0.0, 0.43)),
                ctx.eq.pad('back', (0.3, 0.07, 0.75), (0, 0.2, 0.86), (math.radians(-8), 0, 0)),
                ctx.eq.frame('post', (0.07, 0.07, 0.4), (0, 0.05, 0.2)),
                ctx.eq.frame('base', (0.4, 0.7, 0.03), (0, 0.1, 0.015)),
            ])
        if smith:
            st['bar'] = ctx.eq.smith_machine(bar_y=-0.06)
        elif machine:
            ctx.eq.group('press_machine', [
                ctx.eq.frame('columnL', (0.07, 0.07, 2.0), (0.42, 0.25, 1.0)),
                ctx.eq.frame('columnR', (0.07, 0.07, 2.0), (-0.42, 0.25, 1.0)),
            ])
            st['arms'] = [ctx.eq.line('leverL', radius=0.02), ctx.eq.line('leverR', radius=0.02)]
        elif landmine:
            anchor, line = ctx.eq.landmine((0, -1.45, 0.04))
            st['anchor'], st['bar'] = anchor, line
        elif implement == 'bar':
            st['bar'] = ctx.eq.barbell()
        elif implement == 'dumbbells':
            st['w'] = ctx.eq.dumbbells()
        elif implement == 'kettlebell':
            st['w'] = [ctx.eq.kettlebell('kb')]
        return st

    return setup


def seat_pose(ctx, seat):
    if seat == 'bench':
        sit(ctx, 0.47, y=0.0, knee=88, lean=-2)
    elif seat == 'floor':
        ctx.root((0, 0.0, 0.16))
        ctx.spine(flex=4)
        for s in SIDES:
            ctx.leg_fk(s, hip_flex=88, knee=2, ankle=10, hip_abd=8)
    else:
        stand(ctx, width=0.04)


def ohp_spec(id_, implement='bar', seat=None, grip=0.26, start='front', smith=False, machine=False,
             dip=False, arnold=False, one_arm=False, landmine=False, heels=False, camera=None):
    setup = ohp_setup(implement, seat, smith, machine, seat == 'floor', landmine)
    floor = seat == 'floor'
    camera = camera or cam((0, 0, 1.05 if not seat else 0.85 if not floor else 0.75), 40, 8, 4.0)

    def pose(ctx, st, u):
        t = smootherstep(u)
        if heels:  # military stance: heels together, toes turned slightly out
            stand(ctx, width=-0.06, toe_out=12)
        else:
            seat_pose(ctx, seat)
        if dip:  # dip and drive: knees bend, then the legs launch the bar
            d = math.sin(math.pi * min(u / 0.3, 1.0)) * (u < 0.3)
            ctx.arm.location.z -= 0.08 * d
            t = smootherstep(max((u - 0.15) / 0.85, 0.0))
        ctx.head(flex=-14 * math.sin(math.pi * min(t / 0.7, 1.0)) if start == 'front' else 10 * (1 - t))
        ctx.spine(flex=-4 + (4 if seat else 0))
        sh = shoulders(ctx)
        top_z = sh.z + lockout_z(ctx, grip)
        if landmine:
            # Press the end of a landmine bar up and forward from the chest.
            chest = ctx.attach_point('chest', (0, -0.2, 1.32))
            # The bar runs down to an anchor in front; the end travels up and forward along an arc.
            end = lerp_path(chest, Vector((0, -0.5, sh.z + 0.38)), t)
            sides = ['R'] if one_arm else SIDES
            for s in sides:
                off = Vector((0, 0, 0)) if one_arm else Vector((sgn(s) * 0.045, 0, 0))
                ctx.grip(s, end + off, (0, 0.55, 1))
            if one_arm:
                ctx.arm_fk('L', abd=8)
            set_line(st['bar'], st['anchor'], end + Vector((0, -0.04, 0.02)))
            elbows(ctx, (0.4, -0.4, -1))
            return
        if (implement == 'bar' or smith) and not machine:
            rack = Vector((0, -0.145, sh.z + 0.025)) if start == 'front' else ctx.world('neck', 'head') + Vector((0, 0.08, -0.01))
            lock = Vector((0, sh.y + 0.01, top_z))
            y = lerp(rack.y, lock.y, smootherstep((t - 0.4) / 0.6)) if start == 'front' else lerp(rack.y, lock.y, t)
            bar = Vector((0, y, lerp(rack.z, lock.z, t)))
            place(st['bar'], bar)
            bar_grip(ctx, bar, grip)
            if start == 'front':
                elbows(ctx, (lerp(0.35, 0.45, t), lerp(-1.0, -0.6, t), lerp(-0.6, -0.15, t)))
            else:  # bar on the traps: forearms vertical, elbows under the hands and slightly back
                elbows(ctx, (lerp(0.5, 0.9, t), 0.25, -1))
        elif machine:
            for s, lever in zip(SIDES, st['arms']):
                lo = Vector((sgn(s) * 0.3, sh.y - 0.02, sh.z + 0.06))
                hi = Vector((sgn(s) * 0.22, sh.y - 0.02, sh.z + lockout_z(ctx, 0.22)))
                p = lerp_path(lo, hi, t)
                ctx.grip(s, p, (0, -1, 0))
                set_line(lever, Vector((sgn(s) * 0.42, 0.25, 0.6)), p)
            elbows(ctx, (1, -0.2, -0.5))
        else:
            sides = ['R'] if one_arm else SIDES
            for s, w in zip(sides, st['w']):
                lo = Vector((sgn(s) * (0.14 if arnold else 0.3), sh.y - (0.1 if arnold else 0.02), sh.z + 0.07))
                hi = Vector((sgn(s) * 0.2, sh.y, sh.z + lockout_z(ctx, 0.2)))
                p = lerp_path(lo, hi, t)
                if arnold:
                    # Palms face you at the bottom (thumbs out), turn through neutral (thumbs back)
                    # and face forward at lockout (thumbs in).
                    a = math.pi * smootherstep(min(t / 0.8, 1.0))
                    thumb = Vector((sgn(s) * math.cos(a), math.sin(a), 0))
                else:
                    thumb = Vector((-sgn(s), 0, 0))
                if implement == 'kettlebell':
                    ctx.grip(s, p, thumb)
                    place(w, p, Quaternion((1, 0, 0), math.radians(-15)))  # bell rests on the back of the forearm
                else:
                    hold_dumbbell(ctx, w, s, p, thumb)
            if one_arm:
                ctx.arm_fk('L', abd=8)
            if arnold:  # elbows start in front of the chest and sweep out to the sides
                elbows(ctx, (lerp(0.15, 1, t), lerp(-1, -0.1, t), lerp(-0.7, -0.4, t)))
            else:
                elbows(ctx, (1, -0.1, -0.4))

    spec(id_, camera=camera, setup=setup, concentric='out')(pose)


ohp_spec('push-press', dip=True)
ohp_spec('military-press', heels=True)
ohp_spec('behind-the-neck-press', start='back', grip=0.37)
ohp_spec('snatch-grip-behind-the-neck-press', start='back', grip=0.42)
ohp_spec('seated-barbell-overhead-press', seat='bench')
ohp_spec('z-press', seat='floor', camera=cam((0, -0.2, 0.75), 45, 10, 3.9))
ohp_spec('seated-smith-machine-shoulder-press', seat='bench', smith=True)
ohp_spec('dumbbell-shoulder-press', implement='dumbbells')
ohp_spec('dumbbell-ohp', implement='dumbbells', seat='bench')
ohp_spec('arnold-press', implement='dumbbells', seat='bench', arnold=True)
ohp_spec('kettlebell-press', implement='kettlebell', one_arm=True, camera=cam((0, 0, 1.05), 25, 8, 4.0))
ohp_spec('seated-kettlebell-press', implement='kettlebell', seat='bench', one_arm=True,
         camera=cam((0, 0, 0.85), 25, 8, 4.0))
ohp_spec('machine-shoulder-press', seat='bench', machine=True)
ohp_spec('landmine-press', landmine=True, camera=cam((0, -0.4, 1.0), 70, 10, 4.1))
ohp_spec('one-arm-landmine-press', landmine=True, one_arm=True, camera=cam((0, -0.4, 1.0), 70, 10, 4.1))
ohp_spec('smith-machine-landmine-press', landmine=True, camera=cam((0, -0.4, 1.0), 70, 10, 4.1))


# ---------------------------------------------------------------------------------------------
# Seated and standing chest presses with handles


@spec('machine-chest-press', camera=cam((0, -0.1, 0.95), 55, 10, 3.8), setup=lambda ctx: _chest_machine(ctx))
def machine_chest_press(ctx, st, u):
    sit(ctx, 0.45, y=0.12, knee=88, lean=-4)
    t = smootherstep(u)
    for s, lever in zip(SIDES, st['arms']):
        near = ctx.attach_point('chest', (sgn(s) * 0.26, -0.1, 1.3))
        far = ctx.attach_point('chest', (sgn(s) * 0.17, -0.62, 1.3))
        p = lerp_path(near, far, 1 - t)
        ctx.grip(s, p, (0, 0, 1))
        set_line(lever, Vector((sgn(s) * 0.42, 0.35, 1.5)), p)
    elbows(ctx, (1, 0.4, -0.3))


def _chest_machine(ctx):
    ctx.eq.group('chest_machine', [
        ctx.eq.pad('seat', (0.42, 0.42, 0.08), (0, 0.12, 0.43)),
        ctx.eq.pad('back', (0.42, 0.08, 0.7), (0, 0.38, 0.85), (math.radians(-6), 0, 0)),
        ctx.eq.frame('post', (0.1, 0.1, 0.4), (0, 0.15, 0.2)),
        ctx.eq.frame('columnL', (0.07, 0.07, 1.6), (0.42, 0.35, 0.8)),
        ctx.eq.frame('columnR', (0.07, 0.07, 1.6), (-0.42, 0.35, 0.8)),
        ctx.eq.frame('base', (0.9, 0.8, 0.03), (0, 0.2, 0.015)),
    ])
    return {'arms': [ctx.eq.line('leverL', radius=0.02), ctx.eq.line('leverR', radius=0.02)]}


@spec('cable-chest-press', camera=cam((0, 0.0, 1.1), 40, 10, 4.2), setup=lambda ctx: _cable_pair(ctx, 1.3))
def cable_chest_press(ctx, st, u):
    stand(ctx, width=0.04, y=0.0)
    ctx.spine(flex=8)
    t = smootherstep(u)
    for s, c in zip(SIDES, st['cables']):
        near = ctx.attach_point('chest', (sgn(s) * 0.26, -0.08, 1.32))
        far = ctx.attach_point('chest', (sgn(s) * 0.12, -0.6, 1.3))
        p = lerp_path(near, far, 1 - t)
        ctx.grip(s, p, (0, 0, 1))
        set_line(c, st['pulleys'][0 if s == 'L' else 1], p)
    elbows(ctx, (1, 0.5, -0.3))


def _cable_pair(ctx, height):
    for x in (0.9, -0.9):
        ctx.eq.cable_column(x, 0.45, 2.1)
    pulleys = [Vector((0.82, 0.36, height)), Vector((-0.82, 0.36, height))]
    return {'pulleys': pulleys, 'cables': [ctx.eq.line('cableL'), ctx.eq.line('cableR')]}

