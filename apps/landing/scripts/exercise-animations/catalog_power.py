"""Lunges and single-leg squats, jumps, Olympic lifts, kettlebell ballistics, muscle-ups and
medicine-ball work. Lifts that shouldn't play backwards (cleans, snatches, jerks, jumps) are
choreographed on loop time with their own lowering phase."""

import math

from mathutils import Vector

import mannequin as M
from anim import X, Z, lerp, sgn, smootherstep
from catalog_legs import back_rack, squat_body
from catalog_press import lockout_z
from equipment import along, place, qx, set_line
from exercises import DL_BAR_Y, _sagittal_hips
from moves import SIDES, STAND_Z, bar_grip, elbows, feet, hold_dumbbell, knees_out, shoulders, stand
from registry import barbell, cam, dumbbells, nothing, spec  # noqa: F401

LOOP = dict(hold_start=0.0, out=1.0, hold_end=0.0)  # pose reads ctx.t; u is unused


def phase(t, a, b):
    """0 before a, 1 after b, smooth in between."""
    return smootherstep(min(max((t - a) / (b - a), 0.0), 1.0))


def wave(ctx, cycles=1.0):
    return math.sin(2 * math.pi * cycles * getattr(ctx, 't', 0.0))


# ---------------------------------------------------------------------------------------------
# Lunges


def lunge_pose(ctx, k, lead='L', step=0.62, reverse=False, side=False, curtsy=False, depth=0.42, floor=0.0,
               lean=6, back_up=0.0):
    """k: 0 standing, 1 at the bottom. The lead foot steps out (forward, back, sideways or across)."""
    other = 'R' if lead == 'L' else 'L'
    s_lead = sgn(lead)
    if side:
        lead_pos = Vector((s_lead * (0.1 + 0.55 * k), 0.0, 0.085))
        trail_pos = Vector((-s_lead * 0.1, 0.0, 0.085))
        ctx.root((s_lead * 0.3 * k, 0.12 * k, STAND_Z - depth * 0.75 * k))
        ctx.spine(flex=lean + 25 * k)
        ctx.bone('pelvis', (X, 15 * k))
    else:
        d = -step if not reverse else step
        lead_pos = Vector((s_lead * 0.11, d * k * (0 if reverse else 1), floor + 0.085))
        trail_pos = Vector((-s_lead * 0.11 + (s_lead * 0.25 * k if curtsy else 0), (step * k if reverse else 0) + (0.35 * k if curtsy else 0), back_up + 0.085))
        if reverse:
            lead_pos = Vector((s_lead * 0.11, 0.0, 0.085))
        mid_y = (lead_pos.y + trail_pos.y) / 2
        ctx.root((0, mid_y + 0.05 * k, STAND_Z + floor * 0.0 - depth * k))
        ctx.spine(flex=lean * k)
    ctx.target('leg.' + lead, lead_pos)
    ctx.pole_dir('leg.' + lead, (s_lead * 0.15, -1, 0))
    toe_rot = qx(-35 * k) if not side else None
    if toe_rot is not None:
        ctx.target('leg.' + other, trail_pos, toe_rot @ ctx.body.rest_quat('foot.' + other))
        ctx.pole_world('leg.' + other, (0, -0.3, -1) if not side else (0, -1, 0))
    else:
        ctx.target('leg.' + other, trail_pos)
        ctx.pole_dir('leg.' + other, (-s_lead * 0.2, -1, 0))


def lunge_spec(id_, load='none', reverse=False, side=False, curtsy=False, walking=False, depth=0.42, shallow=False,
               smith=False, jump=False, bulgarian=False):
    def setup(ctx):
        st = {}
        if load == 'bar':
            st.update(barbell(ctx))
        elif load == 'dumbbells':
            st.update(dumbbells(ctx))
        if smith:
            st['bar'] = ctx.eq.smith_machine(bar_y=0.07)
        if bulgarian:
            ctx.eq.flat_bench((0, 0.62), length=0.5, height=0.45, yaw=90)
        return st

    def pose(ctx, st, u):
        t = getattr(ctx, 't', 0.0)
        # Two reps per loop, leading with the left then the right leg.
        lead = 'L' if t < 0.5 else 'R'
        local = (t % 0.5) / 0.5
        k = math.sin(math.pi * local) ** 1.5
        if jump:
            k = 0.85 + 0.15 * math.cos(2 * math.pi * local)
        if bulgarian:
            lead = 'L'
            k = smootherstep(u)
            ctx.root((0, 0.08 + 0.02 * k, 0.9 - 0.36 * k))
            ctx.spine(flex=6 + 8 * k)
            ctx.target('leg.L', (0.11, -0.42, 0.085))
            ctx.pole_dir('leg.L', (0.1, -1, 0.2))
            ctx.target('leg.R', (-0.11, 0.6, 0.52), qx(115) @ ctx.body.rest_quat('foot.R'))
            ctx.pole_dir('leg.R', (0, -0.4, -1))
        else:
            lunge_pose(ctx, k, lead, reverse=reverse, side=side, curtsy=curtsy,
                       depth=depth * (0.5 if shallow else 1.0))
        if jump and 0.42 < local < 0.58:
            air = math.sin(math.pi * (local - 0.42) / 0.16) * 0.16
            ctx.arm.location.z += air
            for s in SIDES:
                ctx.body.targets['leg.' + s].location.z += air
        if load == 'bar' or smith:
            back_rack(ctx, st['bar'])
        elif load == 'dumbbells':
            for s, db in zip(SIDES, st['db']):
                sh = ctx.world('upperarm.' + s, 'head')
                hold_dumbbell(ctx, db, s, ctx.grip_hang(s, sh.y, 0.25), Vector((0, -1, 0)))
            elbows(ctx, (0.3, 1, 0))
        else:
            for s in SIDES:
                ctx.arm_fk(s, flex=150, abd=55, elbow=140, rot=40) if not side else ctx.arm_fk(s, flex=60, elbow=60)

    timing = LOOP if not bulgarian else {}
    spec(id_, camera=cam((0, -0.1, 0.8), 70 if not side else 15, 10, 4.0), setup=setup, timing=timing)(pose)


lunge_spec('barbell-lunge', load='bar')
lunge_spec('barbell-walking-lunges', load='bar', walking=True)
lunge_spec('body-weight-lunge')
lunge_spec('lunges', load='dumbbells')
lunge_spec('dumbbell-walking-lunge', load='dumbbells', walking=True)
lunge_spec('death-march-with-dumbbells', load='dumbbells', walking=True, depth=0.46)
lunge_spec('reverse-barbell-lunge', load='bar', reverse=True)
lunge_spec('reverse-body-weight-lunges', reverse=True)
lunge_spec('reverse-dumbbell-lunge', load='dumbbells', reverse=True)
lunge_spec('curtsy-lunge', curtsy=True)
lunge_spec('side-lunges-bodyweight', side=True)
lunge_spec('shallow-lunges-bodyweight', shallow=True)
lunge_spec('smith-machine-lunge', smith=True)
lunge_spec('smith-machine-bulgarian-split-squat', smith=True, bulgarian=True)
lunge_spec('jumping-lunges', jump=True)


@spec('cossack-squat', camera=cam((0, 0, 0.75), 10, 10, 3.9), setup=nothing, timing=LOOP)
def cossack_squat(ctx, st, u):
    # Wide stance; sit deep onto one leg with the other straight and its toes up, then shift across.
    w = wave(ctx)
    lead = 'L' if w > 0 else 'R'
    other = 'R' if lead == 'L' else 'L'
    k = abs(w)
    ctx.root((sgn(lead) * 0.32 * k, 0.12 * k, STAND_Z - 0.06 - 0.5 * k))
    ctx.spine(flex=8 + 25 * k)
    ctx.bone('pelvis', (X, 15 * k))
    ctx.target('leg.' + lead, (sgn(lead) * 0.42, 0.0, 0.085))
    ctx.pole_dir('leg.' + lead, (sgn(lead) * 0.4, -1, 0))
    ctx.target('leg.' + other, (sgn(other) * 0.42, 0.0, 0.085 + 0.02 * k), qx(40 * k) @ ctx.body.rest_quat('foot.' + other))
    ctx.pole_dir('leg.' + other, (0, -1, 1))
    for s in SIDES:
        ctx.arm_fk(s, flex=80, abd=0)


@spec('pistol-squat', camera=cam((0, 0, 0.7), 70, 10, 3.9), setup=nothing)
def pistol_squat(ctx, st, u):
    # Down on one leg with the other held straight out in front, arms forward to balance.
    t = smootherstep(u)
    ctx.root((0.09, 0.15 * t, STAND_Z - 0.55 * t))
    ctx.spine(flex=10 + 30 * t)
    ctx.bone('pelvis', (X, 12 * t))
    ctx.target('leg.L', (0.1, 0.01, 0.085))
    ctx.pole_dir('leg.L', (0.2, -1, 0))
    ctx.leg_fk('R', hip_flex=lerp(15, 85, t) + 12 * t, knee=4, ankle=-10)
    for s in SIDES:
        ctx.arm_fk(s, flex=lerp(60, 70, t), abd=4)


def step_up_spec(id_, poliquin=False):
    def setup(ctx):
        ctx.eq.plyo_box((0, -0.32), height=0.45 if not poliquin else 0.12, size=(0.5, 0.4))
        return dumbbells(ctx) if not poliquin else {}

    def pose(ctx, st, u):
        h = 0.45 if not poliquin else 0.12
        t = smootherstep(u)
        if poliquin:
            # Heel-elevated, narrow step: the front knee travels far over the toes.
            ctx.root((0, -0.32 + 0.0 * t, STAND_Z + h - 0.38 * (1 - t)))
            ctx.target('leg.L', (0.1, -0.3, h + 0.085), qx(10) @ ctx.body.rest_quat('foot.L'))
            ctx.pole_dir('leg.L', (0, -1, 0))
            ctx.leg_fk('R', hip_flex=5, knee=lerp(40, 10, t), ankle=-20)
            for s in SIDES:
                ctx.arm_fk(s, flex=40, abd=6)
            return
        # Lead foot on the box; drive up to stand on it, the trail leg following.
        ctx.root((0, lerp(0.0, -0.3, t), lerp(STAND_Z - 0.05, STAND_Z + h, t)))
        ctx.spine(flex=lerp(15, 2, t))
        ctx.target('leg.L', (0.1, -0.3, h + 0.085))
        ctx.pole_dir('leg.L', (0.1, -1, 0))
        trail = Vector((-0.1, 0.12, 0.085)).lerp(Vector((-0.1, -0.28, h + 0.085)), phase(u, 0.6, 1.0))
        ctx.target('leg.R', trail)
        ctx.pole_dir('leg.R', (0, -1, 0))
        for s, db in zip(SIDES, st['db']):
            sh = ctx.world('upperarm.' + s, 'head')
            hold_dumbbell(ctx, db, s, ctx.grip_hang(s, sh.y, 0.25), Vector((0, -1, 0)))
        elbows(ctx, (0.3, 1, 0))

    spec(id_, camera=cam((0, -0.2, 0.9), 70, 10, 4.0), setup=setup, concentric='out')(pose)


step_up_spec('step-up')
step_up_spec('poliquin-step-up', poliquin=True)


@spec('landmine-hack-squat', camera=cam((0, 0.4, 0.8), 70, 12, 4.1),
      setup=lambda ctx: dict(zip(('anchor', 'bar'), ctx.eq.landmine((0, 1.4, 0.04)))))
def landmine_hack_squat(ctx, st, u):
    # Facing away from the anchor, the bar end rests on the shoulders; squat with the torso upright.
    squat_body(ctx, u, depth=0.42, back=0.1, lean=10, width=0.08)
    end = ctx.attach_point('chest', (0, 0.07, 1.47))
    for s in SIDES:
        ctx.grip(s, end + Vector((sgn(s) * 0.17, -0.05, 0)), (0, 0, 1))
    elbows(ctx, (0.6, 0.3, -1))
    set_line(st['bar'], st['anchor'], end + Vector((0, 0.03, 0.02)))


# ---------------------------------------------------------------------------------------------
# Jumps


def jump_spec(id_, kind):
    def setup(ctx):
        if kind in ('box', 'depth'):
            ctx.eq.plyo_box((0, -0.55) if kind == 'box' else (0, 0.45), height=0.5, size=(0.55, 0.45))
        return {}

    def pose(ctx, st, u):
        t = getattr(ctx, 't', 0.0)
        # Load (0–.3), launch and fly (.3–.55), land and absorb (.55–.75), reset (.75–1).
        load = phase(t, 0.05, 0.3) * (1 - phase(t, 0.3, 0.38))
        land = phase(t, 0.55, 0.62) * (1 - phase(t, 0.68, 0.85))
        air = math.sin(math.pi * phase(t, 0.32, 0.56)) if 0.3 < t < 0.58 else 0.0
        x_shift = 0.0
        y = 0.0
        floor = 0.0
        if kind == 'box':
            prog = phase(t, 0.32, 0.56) * (1 - phase(t, 0.85, 1.0))
            y = -0.55 * prog
            floor = 0.5 * phase(t, 0.5, 0.56) * (1 - phase(t, 0.85, 1.0))
        elif kind == 'depth':
            prog = 1 - phase(t, 0.32, 0.56)
            y = 0.45 * prog + 0.0
            floor = 0.5 * (1 - phase(t, 0.4, 0.55)) * (1 - 0) if t < 0.85 else 0.5 * phase(t, 0.85, 1.0)
            y = 0.45 * (1 - phase(t, 0.32, 0.5)) if t < 0.85 else 0.45 * phase(t, 0.85, 1.0)
        elif kind == 'bound':
            x_shift = 0.5 * (phase(t, 0.32, 0.56) - phase(t, 0.85, 1.0))
        k = max(load, land)
        squat_body(ctx, k * 0.6, depth=0.4, back=0.15, lean=30, width=0.08 if kind != 'bound' else 0.05,
                   floor=floor, y=y)
        ctx.arm.location.x += x_shift
        lift = 0.35 * air if kind != 'bound' else 0.25 * air
        ctx.arm.location.z += lift
        for s in SIDES:
            tg = ctx.body.targets['leg.' + s]
            tg.location.x += x_shift
            tg.location.z += lift * 0.8
        for s in SIDES:
            ctx.arm_fk(s, flex=lerp(-30, 100, air) if air > 0 else -30 * load + 60 * land, abd=6)

    spec(id_, camera=cam((0, -0.2, 0.9), 70 if kind != 'bound' else 10, 10, 4.4), setup=setup, timing=LOOP,
         concentric='out')(pose)


jump_spec('box-jump', 'box')
jump_spec('depth-jump', 'depth')
jump_spec('lateral-bound', 'bound')


# ---------------------------------------------------------------------------------------------
# Olympic lifts: key poses blended on loop time


def _floor_setup_hinge(ctx, st, grip, bar_y):
    """Deadlift start: solve the hinge that puts the hands on the bar at the floor."""
    ankle = Vector((0, bar_y + 0.125, 0.085))
    if 'h0' not in st:
        lo, hi = 0.0, 88.0
        for _ in range(16):
            mid = (lo + hi) / 2
            ctx.root(_sagittal_hips(ankle, 13, 92, mid))
            ctx.bone('pelvis', (X, mid))
            z = sum(ctx.grip_hang(s, bar_y, grip).z for s in SIDES) / 2
            lo, hi = (lo, mid) if z < 0.225 else (mid, hi)
        st['h0'] = (lo + hi) / 2
    return ankle


def olympic_spec(id_, start='floor', catch='squat', finish='rack', jerk=None, grip=0.25, kb=False):
    """start: floor | hang | block | rack. catch: squat | power. finish: rack | overhead."""

    def setup(ctx):
        st = {'bar': ctx.eq.barbell()}
        if start == 'block':
            for x in (0.7, -0.7):
                ctx.eq.plyo_box((x, DL_BAR_Y), height=0.3, size=(0.3, 0.4), name=f'block{x}')
        return st

    def pose(ctx, st, u):
        t = getattr(ctx, 't', 0.0)
        bar_y = DL_BAR_Y
        ankle = _floor_setup_hinge(ctx, st, grip, bar_y)
        overhead = finish == 'overhead' or jerk is not None
        # Timeline: pull 0–.25, extend .25–.33, catch .33–.45, stand .45–.6, (jerk .6–.78), lower .8–1.
        pull = phase(t, 0.04, 0.25)
        extend = phase(t, 0.25, 0.33)
        catch_k = phase(t, 0.33, 0.42) * (1 - phase(t, 0.45, 0.6))
        up = phase(t, 0.33, 0.42)
        lower = phase(t, 0.82, 1.0)
        jerk_k = phase(t, 0.6, 0.72) * (1 - phase(t, 0.74, 0.8)) if jerk else 0.0
        jerk_up = phase(t, 0.62, 0.7) if jerk else 0.0
        start_k = {'floor': 0.0, 'hang': 0.55, 'block': 0.4, 'rack': 1.0}[start]
        p = max(pull, start_k) * (1 - lower) + start_k * lower if start != 'rack' else 1.0
        if start == 'rack':
            pull = extend = up = 1.0
            catch_k = 0.0
        # Body: deadlift path while pulling, tall extension, then the catch squat.
        knees = phase(p, 0, 0.55)
        hips = phase(p, 0.2, 1.0)
        if up < 0.01 or start == 'rack':
            ctx.root(_sagittal_hips(ankle, lerp(13, 0, knees), lerp(92, 0, knees), lerp(st['h0'], 0, hips)))
            ctx.bone('pelvis', (X, lerp(st['h0'], 0, hips) - 6 * extend))
            ctx.root((0, ctx.arm.location.y, ctx.arm.location.z + 0.05 * extend * (1 - up)))
            feet(ctx, width=0.04, y=bar_y + 0.115)
            knees_out(ctx, 0.25)
        if up >= 0.01 and start != 'rack':
            depth = 0.45 if catch == 'squat' else 0.2
            squat_body(ctx, catch_k, depth=depth, back=0.1, lean=12 if not overhead else 18, width=0.12, toe_out=15,
                       y=bar_y + 0.115)
        if start == 'rack':
            stand(ctx, width=0.06, y=bar_y + 0.115)
        if jerk:
            dip = math.sin(math.pi * phase(t, 0.55, 0.64)) * 0.07
            ctx.arm.location.z -= dip
            if jerk == 'split':
                lunge_pose(ctx, jerk_k * 0.6, 'L', step=0.55, depth=0.25)
            elif jerk_k > 0:
                squat_body(ctx, jerk_k, depth=0.45 if jerk == 'squat' else 0.18, back=0.08, lean=14, width=0.12, y=bar_y + 0.115)
        sh = shoulders(ctx)
        hang_z = sum(ctx.grip_hang(s, bar_y, grip).z for s in SIDES) / 2
        floor_z = 0.225 if start != 'block' else 0.47
        bar_pull = Vector((0, bar_y, lerp(floor_z, hang_z, phase(p, 0, 1))))
        rack = ctx.attach_point('chest', (0, -0.135, 1.43))
        over = Vector((0, sh.y + 0.02, sh.z + lockout_z(ctx, grip)))
        target = rack if not (finish == 'overhead') else over
        bar = bar_pull.lerp(target, up)
        if jerk:
            bar = bar.lerp(over, jerk_up * (1 - lower))
        bar = bar.lerp(bar_pull, lower) if lower > 0 else bar
        place(st['bar'], bar)
        bar_grip(ctx, bar, grip)
        racked = up * (1 - jerk_up) * (finish == 'rack')
        elbows(ctx, (lerp(0.3, 0.3, racked), lerp(1, -1, racked), lerp(0, 0.5, racked)))

    spec(id_, camera=cam((0, 0, 0.95), 55, 10, 4.2), setup=setup, timing=LOOP, concentric='out')(pose)


olympic_spec('clean')
olympic_spec('power-clean', catch='power')
olympic_spec('hang-clean', start='hang')
olympic_spec('hang-power-clean', start='hang', catch='power')
olympic_spec('block-clean', start='block')
olympic_spec('snatch', finish='overhead', grip=0.43)
olympic_spec('power-snatch', finish='overhead', catch='power', grip=0.43)
olympic_spec('hang-snatch', start='hang', finish='overhead', grip=0.43)
olympic_spec('hang-power-snatch', start='hang', finish='overhead', catch='power', grip=0.43)
olympic_spec('block-snatch', start='block', finish='overhead', grip=0.43)
olympic_spec('clean-and-jerk', jerk='split')
olympic_spec('ground-to-overhead', jerk='power')
olympic_spec('jerk', start='rack', jerk='split')
olympic_spec('split-jerk', start='rack', jerk='split')
olympic_spec('power-jerk', start='rack', jerk='power')
olympic_spec('squat-jerk', start='rack', jerk='squat')


# ---------------------------------------------------------------------------------------------
# Kettlebell ballistics


def kb_spec(id_, kind, one_hand=False):
    def setup(ctx):
        return {'kb': ctx.eq.kettlebell()}

    def pose(ctx, st, u):
        t = getattr(ctx, 't', 0.0)
        sides = ['R'] if one_hand or kind not in ('swing', 'thruster', 'windmill') else SIDES
        if kind == 'windmill':
            # Bell locked out overhead in the right hand; hinge sideways to reach the left hand to the foot.
            # Bell locked out overhead in the right hand, arm vertical, eyes on the bell. The hips push
            # back and out to the right while the torso hinges and turns; the left hand slides down
            # the left leg toward the foot.
            k = smootherstep(u)
            stand(ctx, width=0.16)
            ctx.arm.location.x -= 0.1 * k
            ctx.bone('pelvis', (X, 70 * k), (Z, 25 * k))
            ctx.spine(flex=10 * k, side=-15 * k, twist=35 * k)
            ctx.head(turn=-30 * k, flex=-20 * k)
            sh = ctx.world('upperarm.R', 'head')
            top = sh + Vector((0, 0, M.grip_reach() * 0.99))
            ctx.grip('R', top, (0, -1, 0))
            ctx.pole_world('arm.R', (-1, 0, 0))
            place(st['kb'], top)
            knee = ctx.world('shin.L', 'head')
            ankle = ctx.world('foot.L', 'head')
            ctx.target('arm.L', knee.lerp(ankle, k) + Vector((0.03, -0.06, 0.05)) if k > 0.05
                       else ctx.world('upperarm.L', 'head') + Vector((0.03, 0, -0.55)))
            ctx.pole_world('arm.L', (1, 0, 0))
            return
        if kind == 'swing':
            # Hinge back with the bell between the legs, then snap the hips to float it to chest height.
            k = math.sin(math.pi * t)  # 0 at the bottom of the hike, 1 at the float
            hinge = lerp(70, 0, k)
            ctx.root((0, lerp(0.18, 0.0, k), STAND_Z - lerp(0.12, 0.0, k)))
            ctx.bone('pelvis', (X, hinge))
            feet(ctx, width=0.12, toe_out=10)
            knees_out(ctx, 0.3)
            for s in sides:
                ctx.arm_fk(s, flex=lerp(-15 + hinge * 0.1, 90, k), abd=-6, twist=-80)
            if one_hand:
                ctx.arm_fk('L', abd=12)
            g = ctx.attach_point('hand.R', M.grip_point('R'))
            if not one_hand:
                g = (g + ctx.attach_point('hand.L', M.grip_point('L'))) / 2
            place(st['kb'], g, ctx.bone_delta('forearm.R'))
            return
        if kind == 'thruster':
            k = smootherstep(u)
            squat_body(ctx, 1 - phase(u, 0.0, 0.5), depth=0.42, back=0.12, lean=16, width=0.1)
            press = phase(u, 0.4, 1.0)
            sh = shoulders(ctx)
            rack = ctx.attach_point('chest', (0, -0.18, 1.38))
            over = Vector((0, sh.y, sh.z + lockout_z(ctx, 0.05)))
            g = rack.lerp(over, press)
            for s in SIDES:
                ctx.grip(s, g + Vector((sgn(s) * 0.05, 0, 0)), (0, 0, 1))
            place(st['kb'], g + Vector((0, 0, 0.06)), qx(180))
            elbows(ctx, (0.4, -0.8, -0.5))
            del k
            return
        # Clean / press / jerk / snatch / push press: one hand, bell from between the feet.
        stand(ctx, width=0.1)
        sh = ctx.world('upperarm.R', 'head')
        low = Vector((-0.04, 0.0, 0.2))
        rack = ctx.attach_point('chest', (-0.14, -0.16, 1.36))
        over = Vector((sh.x, sh.y, sh.z + lockout_z(ctx, abs(sh.x))))
        if kind == 'snatch':
            up = phase(t, 0.15, 0.4) * (1 - phase(t, 0.75, 1.0))
            dip = math.sin(math.pi * phase(t, 0.0, 0.3)) * 0.12
            ctx.arm.location.z -= dip
            ctx.bone('pelvis', (X, 40 * (1 - phase(t, 0.0, 0.25)) + 40 * phase(t, 0.85, 1.0)))
            g = low.lerp(over, up)
        else:
            clean = phase(t, 0.08, 0.3) * (1 - phase(t, 0.82, 1.0))
            press = (phase(t, 0.42, 0.6) * (1 - phase(t, 0.65, 0.8))) if kind in ('press', 'jerk', 'push') else 0.0
            if kind in ('jerk', 'push'):
                ctx.arm.location.z -= 0.07 * math.sin(math.pi * phase(t, 0.36, 0.46))
            ctx.bone('pelvis', (X, 40 * (1 - phase(t, 0.0, 0.2)) + 40 * phase(t, 0.88, 1.0)))
            g = low.lerp(rack, clean).lerp(over, press)
        ctx.grip('R', g, (1, 0, 0))
        place(st['kb'], g, qx(-15) if g.z > 1.0 else qx(0))
        ctx.arm_fk('L', abd=12)
        ctx.pole_world('arm.R', (-0.3, -0.6, -1))

    timing = {} if kind in ('windmill', 'thruster') else LOOP
    spec(id_, camera=cam((0, 0, 1.0), 40 if kind != 'windmill' else 10, 8, 4.0), setup=setup, timing=timing,
         concentric='out')(pose)


kb_spec('kettlebell-swing', 'swing')
kb_spec('one-handed-kettlebell-swing', 'swing', one_hand=True)
kb_spec('kettlebell-clean', 'clean')
kb_spec('kettlebell-clean-and-press', 'press')
kb_spec('kettlebell-clean-and-jerk', 'jerk')
kb_spec('kettlebell-push-press', 'push')
kb_spec('kettlebell-snatch', 'snatch')
kb_spec('kettlebell-thrusters', 'thruster')
kb_spec('kettlebell-windmill', 'windmill')


# ---------------------------------------------------------------------------------------------
# Muscle-ups, medicine ball, devil's press


def muscle_up_spec(id_, rings=False, band=False, jumping=False):
    def setup(ctx):
        st = {}
        if jumping:
            st['bar'] = Vector((0, -0.12, 1.75))
            ctx.eq.group('low_bar', [ctx.eq.cyl('lb', 0.016, 1.4, (0, -0.12, 1.75), (0, math.pi / 2, 0), ctx.eq.m_metal, 16),
                                     ctx.eq.frame('pL', (0.07, 0.07, 1.78), (0.68, -0.12, 0.89)),
                                     ctx.eq.frame('pR', (0.07, 0.07, 1.78), (-0.68, -0.12, 0.89))])
        else:
            st['bar'] = ctx.eq.pullup_bar()
        if band:
            st['band'] = ctx.eq.line('band', accent=True, radius=0.012)
        return st

    def pose(ctx, st, u):
        bar = st['bar']
        t = smootherstep(u)
        # Hang → chest to the bar → lean over it → press to straight-arm support above it.
        pull = phase(u, 0.0, 0.5)
        over = phase(u, 0.45, 0.65)
        press = phase(u, 0.6, 1.0)
        z_hang = bar.z - 1.06
        z_top_pull = bar.z - 0.6
        z_support = bar.z + 0.06
        z = lerp(z_hang, z_top_pull, pull) + (z_support - z_top_pull) * press * 1.0
        # In support the hips sit at the bar and the shoulders lean over the hands on straight arms.
        ctx.root((0, lerp(0.03, bar.y + 0.12, over), z + 0.04 * press))
        ctx.spine(flex=lerp(-8, 30, over) - 15 * press)
        ctx.head(flex=-10 + 20 * over)
        for s in SIDES:
            ctx.leg_fk(s, hip_flex=lerp(10, 40, over) - 25 * press, knee=lerp(20, 30, over), ankle=-25)
            ctx.grip(s, Vector((sgn(s) * (0.27 if not rings else 0.24), bar.y, bar.z)), (-sgn(s), 0, 0) if not rings else (0, -1, 0))
        elbows(ctx, (lerp(0.7, 0.3, over), lerp(-0.05, 1, over), lerp(-1, 0, over)))
        if jumping:
            for s in SIDES:
                ctx.body.targets['leg.' + s].location.z = max(0.085, ctx.body.targets['leg.' + s].location.z)
        if band:
            knees = (ctx.world('shin.L', 'head') + ctx.world('shin.R', 'head')) / 2
            set_line(st['band'], Vector((0, bar.y, bar.z)), knees)
        del t

    spec(id_, camera=cam((0, 0, 1.6), 55, 6, 4.8), setup=setup, concentric='out')(pose)


muscle_up_spec('bar-muscle-up')
muscle_up_spec('ring-muscle-up', rings=True)
muscle_up_spec('banded-muscle-up', band=True)
muscle_up_spec('jumping-muscle-up', jumping=True)


@spec('ball-slams', camera=cam((0, -0.2, 1.0), 60, 8, 4.2), setup=lambda ctx: {'ball': ctx.eq.medicine_ball()},
      timing=LOOP, concentric='out')
def ball_slams(ctx, st, u):
    # Ball overhead on the toes, then slam it into the floor with a hip hinge; pick it up and repeat.
    t = getattr(ctx, 't', 0.0)
    up = phase(t, 0.0, 0.3) * (1 - phase(t, 0.35, 0.5))
    hinge = phase(t, 0.35, 0.5) * (1 - phase(t, 0.8, 1.0))
    stand(ctx, width=0.12)
    ctx.root((0, 0.15 * hinge, STAND_Z - 0.12 * hinge + 0.03 * up))
    ctx.bone('pelvis', (X, 55 * hinge))
    for s in SIDES:
        ctx.arm_fk(s, flex=lerp(lerp(40, 175, up), 70, hinge), abd=-15, elbow=20)
    hands = [ctx.attach_point('hand.' + s, M.grip_point(s)) for s in SIDES]
    mid = (hands[0] + hands[1]) / 2
    on_floor = phase(t, 0.48, 0.52) * (1 - phase(t, 0.8, 0.85))
    floor = Vector((0, -0.35, 0.12))
    place(st['ball'], mid.lerp(floor, on_floor) + Vector((0, -0.05, 0)))


@spec('medicine-ball-chest-pass', camera=cam((0, -0.4, 1.1), 70, 8, 4.4), setup=lambda ctx: {'ball': ctx.eq.medicine_ball()},
      timing=LOOP, concentric='out')
def chest_pass(ctx, st, u):
    # From the chest, step and push the ball away; it travels out and comes back.
    t = getattr(ctx, 't', 0.0)
    push = phase(t, 0.1, 0.25) * (1 - phase(t, 0.6, 0.8))
    stand(ctx, width=0.08)
    for s in SIDES:
        ctx.arm_fk(s, flex=lerp(55, 88, push), abd=-25 + 20 * push, elbow=lerp(110, 5, push), rot=50 * (1 - push))
    hands = [ctx.attach_point('hand.' + s, M.grip_point(s)) for s in SIDES]
    mid = (hands[0] + hands[1]) / 2 + Vector((0, -0.08, 0))
    flight = math.sin(math.pi * phase(t, 0.22, 0.65)) if 0.22 < t < 0.65 else 0.0
    place(st['ball'], mid + Vector((0, -1.6 * flight, 0.1 * flight)))


@spec('devils-press', camera=cam((0, -0.1, 0.8), 60, 10, 4.2), setup=dumbbells, timing=LOOP, concentric='out')
def devils_press(ctx, st, u):
    # Hands on the dumbbells in a plank, chest to the floor, jump the feet in, then swing both
    # bells from the floor to overhead in one motion.
    t = getattr(ctx, 't', 0.0)
    plank = 1 - phase(t, 0.25, 0.35)
    swing = phase(t, 0.35, 0.6) * (1 - phase(t, 0.75, 0.95))
    if plank > 0.5:
        from catalog_core import high_plank

        high_plank(ctx, lift=-0.2 * math.sin(math.pi * phase(t, 0.0, 0.2)))
        for s, db in zip(SIDES, st['db']):
            sh = ctx.world('upperarm.' + s, 'head')
            hold_dumbbell(ctx, db, s, Vector((sh.x, sh.y - 0.02, 0.1)), Vector((0, -1, 0)))
        return
    hinge = 1 - swing
    ctx.root((0, 0.2 * hinge, STAND_Z - 0.2 * hinge))
    ctx.bone('pelvis', (X, 70 * hinge))
    feet(ctx, width=0.12)
    knees_out(ctx, 0.3)
    for s, db in zip(SIDES, st['db']):
        ctx.arm_fk(s, flex=lerp(20, 178, swing), abd=6)
        g = ctx.attach_point('hand.' + s, M.grip_point(s))
        place(db, g, along((0, -1, 0)))

