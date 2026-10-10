"""Lunges and single-leg squats, jumps, Olympic lifts, kettlebell ballistics, muscle-ups and
medicine-ball work. Lifts that shouldn't play backwards (cleans, snatches, jerks, jumps) are
choreographed on loop time with their own lowering phase."""

import math

from mathutils import Vector

import mannequin as M
from anim import X, Z, lerp, sgn, smootherstep
from catalog_legs import back_rack, squat_body
from catalog_press import lockout_z
from equipment import place, qx, qz, set_line
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


# Ball of the foot relative to the ankle (rest pose): a raised heel pivots about this point.
BALL = Vector((0, -0.14, -0.07))


def on_toes(ankle, heel_up):
    """Ankle position and foot tilt for a foot whose heel is raised `heel_up` degrees while the
    ball of the foot stays on the floor where it was."""
    ball = Vector(ankle) + BALL
    q = qx(heel_up)  # qx(+) lifts the heel (docs: exercise-demos.md, feet)
    return ball + q @ -BALL, q


# A full lunge stance: front shin about vertical, back knee under the hip, ankles ~85 cm apart.
STRIDE = 0.85


def lunge_pose(ctx, k, lead='L', step=STRIDE, reverse=False, side=False, curtsy=False, depth=0.42, floor=0.0,
               lean=6, back_up=0.0, s=None, lift=0.0, y0=0.0):
    """k: 0 standing, 1 at the bottom. s: how far the stepping foot has travelled out (0 home, 1
    planted; defaults to k), lift: how high it is off the floor on the way. The lead foot steps
    out (forward, sideways or across); for reverse and curtsy lunges the other foot steps back.
    y0 shifts the whole lunge along Y (walking lunges)."""
    s = k if s is None else s
    other = 'R' if lead == 'L' else 'L'
    s_lead = sgn(lead)
    if side:
        lead_pos = Vector((s_lead * (0.1 + 0.55 * s), y0, 0.085 + lift))
        trail_pos = Vector((-s_lead * 0.1, y0, 0.085))
        ctx.root((s_lead * 0.3 * k, y0 + 0.12 * k, STAND_Z - depth * 0.75 * k))
        ctx.spine(flex=lean + 25 * k)
        ctx.bone('pelvis', (X, 15 * k))
        ctx.target('leg.' + lead, lead_pos)
        ctx.pole_dir('leg.' + lead, (s_lead * 0.15, -1, 0))
        ctx.target('leg.' + other, trail_pos)
        ctx.pole_dir('leg.' + other, (-s_lead * 0.2, -1, 0))
        return
    # Reverse and curtsy lunges keep the lead foot planted; the other foot steps back (across
    # behind it for a curtsy).
    lead_pos = Vector((s_lead * 0.11, y0 - (0 if reverse or curtsy else step * s), floor + 0.085))
    back_y = y0 + (step * s if reverse else 0.6 * s if curtsy else 0)
    trail_pos = Vector((-s_lead * 0.11 + (s_lead * 0.3 * s if curtsy else 0), back_y, back_up + 0.085))
    if reverse or curtsy:
        trail_pos.z += lift
    else:
        lead_pos.z += lift
    mid_y = (lead_pos.y + trail_pos.y) / 2
    ctx.root((0, mid_y + 0.05 * k, STAND_Z - depth * k))
    ctx.spine(flex=lean * k)
    ctx.target('leg.' + lead, lead_pos)
    ctx.pole_dir('leg.' + lead, (s_lead * 0.15, -1, 0))
    # The back foot rolls onto its toes as the back knee drops: the heel lifts, the ball of the
    # foot stays planted (rotating about the ankle would push the toes through the floor).
    heel = (12 + 50 * k) * s if trail_pos.z - back_up < 0.09 else 10 * s
    ankle, tilt = on_toes(trail_pos, heel)
    ctx.target('leg.' + other, ankle, tilt @ ctx.body.rest_quat('foot.' + other))
    ctx.pole_world('leg.' + other, (0, -0.3, -1))


def walking_lunge(ctx, t, step=STRIDE, depth=0.42):
    """Two walking lunges per loop. The back foot swings through to become the front foot, so the
    lifter travels two steps; returns the distance travelled for the camera to follow."""
    rep = 0 if t < 0.5 else 1
    local = (t % 0.5) / 0.5
    lead = 'R' if rep == 0 else 'L'  # the foot swinging through this rep
    planted = -rep * step  # y of the foot that stays down
    sw = phase(local, 0.0, 0.38)
    k = phase(local, 0.3, 0.6) - phase(local, 0.66, 0.94)
    lift = 0.09 * math.sin(math.pi * sw)
    # Treat the swing as a lunge on the planted foot's line: the swinging foot travels from one
    # step behind to one step in front of it.
    other = 'L' if lead == 'R' else 'R'
    s_lead = sgn(lead)
    front = Vector((s_lead * 0.11, lerp(planted + step, planted - step, sw), 0.085 + lift))
    back = Vector((-s_lead * 0.11, planted, 0.085))
    # Before the swing the planted foot was the front foot; once the other passes it, it is the back.
    mid_y = lerp(planted + step / 2, planted - step / 2, sw)
    ctx.root((0, mid_y + 0.05 * k, STAND_Z - depth * k - 0.03 * (1 - abs(2 * sw - 1))))
    ctx.spine(flex=6 * k)
    # The swinging foot starts as the back foot, on its toes: it peels off the floor, swings
    # through and lands flat in front. The planted foot is the front foot until the other passes
    # it, then rolls onto its toes as the back foot.
    heel_swing = (12 + 33 * phase(sw, 0.0, 0.2)) * (1 - phase(sw, 0.2, 0.6))
    ankle, tilt = on_toes(front, heel_swing)
    ctx.target('leg.' + lead, ankle, tilt @ ctx.body.rest_quat('foot.' + lead))
    ctx.pole_dir('leg.' + lead, (s_lead * 0.15, -1, 0))
    ankle, tilt = on_toes(back, (12 + 50 * k) * phase(sw, 0.5, 0.9))
    ctx.target('leg.' + other, ankle, tilt @ ctx.body.rest_quat('foot.' + other))
    ctx.pole_world('leg.' + other, (0, -0.3, -1))
    return 2 * step * t


def hands_on_hips(ctx):
    for s in SIDES:
        ctx.target('arm.' + s, ctx.body_point((sgn(s) * 0.215, 0.03, 1.0)))
        ctx.pole_dir('arm.' + s, (sgn(s) * 1, 0.35, 0))


def lunge_spec(id_, load='none', reverse=False, side=False, curtsy=False, walking=False, depth=0.42, shallow=False,
               smith=False, jump=False, bulgarian=False):
    def setup(ctx):
        st = {'cam0': ctx.cam.location.copy()}
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
        if bulgarian:
            lead = 'L'
            k = smootherstep(u)
            ctx.root((0, 0.08 + 0.02 * k, 0.9 - 0.36 * k))
            ctx.spine(flex=6 + 8 * k)
            ctx.target('leg.L', (0.11, -0.42, 0.085))
            ctx.pole_dir('leg.L', (0.1, -1, 0.2))
            ctx.target('leg.R', (-0.11, 0.6, 0.52), qx(115) @ ctx.body.rest_quat('foot.R'))
            ctx.pole_dir('leg.R', (0, -0.4, -1))
        elif walking:
            travelled = walking_lunge(ctx, t, depth=depth)
            # Follow the lifter so the walk stays in frame (the floor is plain, so only the feet
            # show the travel).
            ctx.cam.location = st['cam0'] + Vector((0, -travelled + STRIDE / 2, 0))
        elif jump:
            k = 0.85 + 0.15 * math.cos(2 * math.pi * local)
            lunge_pose(ctx, k, lead)
            if 0.42 < local < 0.58:
                air = math.sin(math.pi * (local - 0.42) / 0.16) * 0.16
                ctx.arm.location.z += air
                for s in SIDES:
                    ctx.body.targets['leg.' + s].location.z += air
        else:
            # Step out (the foot lifts and lands), lower, rise, then step back to standing.
            out = phase(local, 0.0, 0.26)
            back = phase(local, 0.76, 1.0)
            s = out - back
            k = phase(local, 0.2, 0.48) - phase(local, 0.54, 0.82)
            moving = math.sin(math.pi * out) if local < 0.5 else math.sin(math.pi * back)
            lunge_pose(ctx, k, lead, reverse=reverse, side=side, curtsy=curtsy,
                       depth=depth * (0.5 if shallow else 1.0), s=s, lift=0.07 * moving)
        if load == 'bar' or smith:
            back_rack(ctx, st['bar'])
        elif load == 'dumbbells':
            for s, db in zip(SIDES, st['db']):
                sh = ctx.world('upperarm.' + s, 'head')
                hold_dumbbell(ctx, db, s, ctx.grip_hang(s, sh.y, 0.25), Vector((0, -1, 0)))
            elbows(ctx, (0.3, 1, 0))
        elif side:
            for s in SIDES:
                ctx.arm_fk(s, flex=60, elbow=60)
        else:
            hands_on_hips(ctx)

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
    ctx.spine(flex=14 + 26 * t)
    ctx.bone('pelvis', (X, 12 * t))
    ctx.target('leg.L', (0.1, 0.01, 0.085))
    ctx.pole_dir('leg.L', (0.2, -1, 0))
    # The free leg is out in front from the start (foot ~0.3 m up), not hanging beside the other.
    ctx.leg_fk('R', hip_flex=lerp(45, 85, t) + 12 * t, knee=4, ankle=-10)
    for s in SIDES:
        ctx.arm_fk(s, flex=lerp(60, 70, t), abd=4)


def step_up_spec(id_, poliquin=False):
    def setup(ctx):
        if poliquin:
            # A narrow low step under the working (left) foot, a wedge under its heel; the free
            # foot hangs beside the step so it can reach toward the floor.
            ctx.eq.plyo_box((0.1, -0.33), height=PQ_H, size=(0.22, 0.3))
            ctx.eq.pad('wedge', (0.12, 0.08, 0.035), (0.1, -0.24, PQ_H + 0.0175))
            return {}
        ctx.eq.plyo_box((0, -0.32), height=0.45, size=(0.5, 0.4))
        return dumbbells(ctx)

    def pose(ctx, st, u):
        t = smootherstep(u)
        if poliquin:
            h = PQ_H
            # Heel raised on the wedge, the knee travels far forward over the toes as the hips sit
            # straight down; the free heel lowers to just above the floor in front of the step.
            ctx.root((0, -0.3 + 0.08 * (1 - t), STAND_Z + h - 0.22 * (1 - t)))
            ctx.spine(flex=4 + 6 * (1 - t))
            ankle, tilt = on_toes((0.1, -0.33, h + 0.085), 12)
            ctx.target('leg.L', ankle, tilt @ ctx.body.rest_quat('foot.L'))
            ctx.pole_dir('leg.L', (0, -1, 0))
            free = Vector((-0.11, -0.5, 0.085 + 0.03)).lerp(Vector((-0.11, -0.4, h + 0.05)), t)
            ctx.target('leg.R', free, qx(-15 * (1 - t)) @ ctx.body.rest_quat('foot.R'))
            ctx.pole_dir('leg.R', (0, -1, 0))
            for s in SIDES:
                ctx.arm_fk(s, flex=lerp(55, 25, t), abd=6)
            return
        h = 0.45
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

    # Standing on the 45 cm box puts the head at ~2.2 m.
    camera = cam((0, -0.3, 0.95), 70, 8, 4.0) if poliquin else cam((0, -0.2, 1.1), 70, 10, 4.5)
    spec(id_, camera=camera, setup=setup, concentric='out')(pose)


PQ_H = 0.15  # Poliquin step height


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


BOX_H, BOX_Y = 0.5, -0.55  # box height and centre; its front edge is at y = -0.325


def box_jump(ctx, t):
    """Load, jump, tuck the feet up over the box edge, land soft on top, stand tall, then step
    down backwards one foot at a time (so the loop returns to standing on the floor)."""
    load = phase(t, 0.06, 0.24) * (1 - phase(t, 0.24, 0.32))
    fly = phase(t, 0.3, 0.5)  # 0 at take-off, 1 on the box
    airborne = 0.3 < t < 0.5
    # Feet clear the box edge with room to spare: high by the time they are over it.
    h = BOX_H * fly + 0.32 * math.sin(math.pi * fly) if airborne else (BOX_H if t >= 0.5 else 0.0)
    y = BOX_Y * fly
    tuck = 0.45 * math.sin(math.pi * fly) if airborne else 0.0
    land = phase(t, 0.5, 0.56) * (1 - phase(t, 0.6, 0.72))
    if t < 0.78:
        squat_body(ctx, max(load * 0.6, tuck, land * 0.55), depth=0.4, back=0.15, lean=30, width=0.08,
                   floor=h, y=y)
        swing = (math.sin(math.pi * fly) if airborne else 0.0)
        for s in SIDES:
            ctx.arm_fk(s, flex=-40 * load + 110 * swing + 40 * land, abd=6, elbow=10 + 20 * swing)
        return
    # Step down: the right foot reaches back to the floor, then the left follows.
    a = phase(t, 0.78, 0.89)
    b = phase(t, 0.89, 1.0)
    r = Vector((-0.11, lerp(BOX_Y, -0.02, a), 0.085 + BOX_H * (1 - a) + 0.08 * math.sin(math.pi * a)))
    l = Vector((0.11, lerp(BOX_Y, 0.0, b), 0.085 + BOX_H * (1 - b) + 0.08 * math.sin(math.pi * b)))
    # The standing leg bends as the other reaches down, then the hips come back over both feet.
    ctx.root((0, lerp(BOX_Y, -0.2, a) + 0.2 * b, STAND_Z + BOX_H - 0.3 * a + (0.3 - BOX_H) * b
              - 0.06 * math.sin(math.pi * b)))
    ctx.spine(flex=10 * math.sin(math.pi * a) + 8 * math.sin(math.pi * b))
    for s, p_ in (('R', r), ('L', l)):
        ctx.target('leg.' + s, p_)
        ctx.pole_dir('leg.' + s, (sgn(s) * 0.15, -1, 0))
    for s in SIDES:
        ctx.arm_fk(s, flex=8, abd=8, elbow=12)


DEPTH_Y = 0.45  # depth-jump box centre, behind the lifter; its front edge is at y = 0.225
BOUND = 1.0  # lateral bound distance


def depth_jump(ctx, t):
    """Step off the box, land and immediately jump as high as possible, land soft, then step
    back up onto the box backwards one foot at a time (so the loop returns to the box top)."""
    if t < 0.72:
        fwd = phase(t, 0.06, 0.14)  # forward off the box, the feet clearing its front edge
        fall = phase(t, 0.12, 0.19)
        y = DEPTH_Y * (1 - fwd)
        floor = BOX_H * (1 - fall) + 0.05 * math.sin(math.pi * fwd)
        absorb = phase(t, 0.17, 0.23) * (1 - phase(t, 0.23, 0.3))
        air = math.sin(math.pi * phase(t, 0.28, 0.5)) if 0.28 < t < 0.5 else 0.0
        land = phase(t, 0.48, 0.54) * (1 - phase(t, 0.58, 0.7))
        squat_body(ctx, max(absorb * 0.6, land * 0.55, 0.2 * air), depth=0.4, back=0.15, lean=30, width=0.08,
                   floor=floor, y=y)
        lift = 0.38 * air
        ctx.arm.location.z += lift
        for s in SIDES:
            ctx.body.targets['leg.' + s].location.z += lift * 0.85
        for s in SIDES:
            ctx.arm_fk(s, flex=-40 * absorb + 150 * air + 40 * land, abd=6, elbow=10 + 20 * air)
        return
    # Step back up: the right foot reaches back and up onto the box, the hips rise over it, then
    # the left follows. Feet go up before they go back, clearing the box's front edge.
    a = phase(t, 0.72, 0.84)
    b = phase(t, 0.82, 0.95)
    c = phase(t, 0.86, 0.98)

    def foot(s, k):
        p_ = Vector((sgn(s) * 0.178, lerp(0.01, DEPTH_Y + 0.01, phase(k, 0.3, 1.0)),
                     0.085 + BOX_H * phase(k, 0.0, 0.65) + 0.06 * math.sin(math.pi * k)))
        ctx.target('leg.' + s, p_, qz(sgn(s) * 12) @ ctx.body.rest_quat('foot.' + s))
        ctx.pole_dir('leg.' + s, (sgn(s) * 0.35, -1, 0))

    ctx.root((0, lerp(0.0, 0.18, a) + (DEPTH_Y - 0.18) * b, STAND_Z - 0.06 * math.sin(math.pi * a) + BOX_H * b))
    ctx.spine(flex=8 + 14 * math.sin(math.pi * b))
    foot('R', a)
    foot('L', c)
    for s in SIDES:
        ctx.arm_fk(s, flex=10 * math.sin(math.pi * (a + b) / 2), abd=6, elbow=10)


def lateral_bound(ctx, t):
    """Bound sideways from one leg, land on the other with the knee bent, then bound back. The
    two halves of the loop mirror each other; the free foot stays tucked up behind."""
    m = 1 if t < 0.5 else -1  # +1: off the right leg, bounding toward +X onto the left
    lt = (t % 0.5) / 0.5
    push, catch = ('R', 'L') if m > 0 else ('L', 'R')
    k = phase(lt, 0.04, 0.24) * (1 - phase(lt, 0.24, 0.32))  # dip before the push
    f = phase(lt, 0.3, 0.6)  # flight
    airborne = 0.3 < lt < 0.6
    land = phase(lt, 0.57, 0.65) * (1 - phase(lt, 0.75, 1.0))
    x0, x1 = -m * BOUND / 2, m * BOUND / 2
    # The pelvis sits just inside the standing foot and travels across in the air.
    root_x = lerp(x0 + sgn(catch) * 0.06, x1 + sgn(push) * 0.06, f)
    root_y = 0.06 * (k + land)
    z = STAND_Z - 0.03 - 0.16 * k - 0.14 * land + (0.22 * math.sin(math.pi * f) if airborne else 0.0)
    ctx.root((root_x, root_y, z))
    ctx.spine(flex=8 + 20 * k + 18 * land, side=-m * 8 * math.sin(math.pi * f),
              twist=-m * 15 * math.cos(math.pi * f))
    ctx.bone('pelvis', (X, 10 * (k + land)))
    root = Vector((root_x, root_y, z))

    def tucked(side):
        return root + Vector((sgn(side) * 0.11, 0.3, -0.55))

    # The push foot stays on the floor until take-off, then folds up behind; the catching foot
    # comes out of its tuck and reaches across to land.
    pf = Vector((x0, 0.01, 0.085)).lerp(tucked(push), phase(f, 0.0, 0.45))
    cf = tucked(catch).lerp(Vector((x1, 0.01, 0.085)), phase(f, 0.25, 1.0))
    cf.z = max(cf.z, 0.085)
    for side, p_ in ((push, pf), (catch, cf)):
        ctx.target('leg.' + side, p_)
        ctx.pole_dir('leg.' + side, (sgn(side) * 0.2, -1, 0))
    # Arms swing across the body with the bound.
    sw = math.cos(math.pi * f)  # +1 before the push, -1 after
    for side in SIDES:
        ctx.arm_fk(side, flex=30 + 25 * k + 25 * land + 20 * math.sin(math.pi * f), abd=8, elbow=50,
                   rot=sgn(side) * m * 20 * sw)


JUMPS = {'box': box_jump, 'depth': depth_jump, 'bound': lateral_bound}
JUMP_CAMS = {'box': cam((0, -0.3, 1.12), 70, 10, 5.0), 'depth': cam((0, 0.1, 1.15), 70, 10, 5.2),
             'bound': cam((0, -0.2, 0.9), 10, 8, 5.5)}


def jump_spec(id_, kind):
    def setup(ctx):
        if kind in ('box', 'depth'):
            ctx.eq.plyo_box((0, BOX_Y) if kind == 'box' else (0, DEPTH_Y), height=BOX_H, size=(0.55, 0.45))
        return {}

    def pose(ctx, st, u):
        JUMPS[kind](ctx, getattr(ctx, 't', 0.0))

    spec(id_, camera=JUMP_CAMS[kind], setup=setup, timing=LOOP, concentric='out')(pose)


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


BLOCK_H = 0.3
BLOCK_BAR_Z = BLOCK_H + 0.225  # bar height with the plates resting on the blocks


def olympic_spec(id_, start='floor', catch='squat', finish='rack', jerk=None, grip=0.25, kb=False):
    """start: floor | hang | block | rack. catch: squat | power. finish: rack | overhead."""

    def setup(ctx):
        st = {'bar': ctx.eq.barbell()}
        if start == 'block':
            for x in (0.7, -0.7):
                ctx.eq.plyo_box((x, DL_BAR_Y), height=BLOCK_H, size=(0.3, 0.4), name=f'block{x}')
        return st

    def pose(ctx, st, u):
        t = getattr(ctx, 't', 0.0)
        bar_y = DL_BAR_Y
        ankle = _floor_setup_hinge(ctx, st, grip, bar_y)
        overhead = finish == 'overhead' or jerk is not None
        # Timeline: pull 0–.25, extend .25–.33, catch .33–.45, stand .45–.6, (jerk .6–.78),
        # bring the bar down to the hips .8–.88, then hinge back to the start position .88–1.
        pull = phase(t, 0.04, 0.25)
        extend = phase(t, 0.25, 0.33)
        catch_k = phase(t, 0.33, 0.42) * (1 - phase(t, 0.45, 0.6))
        up = phase(t, 0.33, 0.42)
        drop = phase(t, 0.8, 0.88)
        lower = phase(t, 0.88, 1.0)
        jerk_k = phase(t, 0.6, 0.72) * (1 - phase(t, 0.74, 0.8)) if jerk else 0.0
        jerk_up = phase(t, 0.62, 0.7) if jerk else 0.0
        start_k = {'floor': 0.0, 'hang': 0.55, 'block': 0.3, 'rack': 1.0}[start]
        p = max(pull, start_k) if t < 0.8 else lerp(1.0, start_k, lower)
        if start == 'rack':
            pull = extend = up = 1.0
            catch_k = 0.0

        def pull_body(p):
            # Deadlift path: knees extend first, then the hips come through. From the blocks the
            # hinge starts where straight arms put the bar on the blocks.
            knees = phase(p, 0, 0.55)
            shin, knee = lerp(13, 0, knees), lerp(92, 0, knees)
            if start == 'block':
                hinge = lerp(st['hb'], 0, phase(p, start_k, 1.0))
            else:
                hinge = lerp(st['h0'], 0, phase(p, 0.2, 1.0))
            ctx.root(_sagittal_hips(ankle, shin, knee, hinge))
            ctx.bone('pelvis', (X, hinge - 6 * extend * (1 - up)))

        if start == 'block' and 'hb' not in st:
            lo, hi = 0.0, 88.0
            for _ in range(18):
                st['hb'] = (lo + hi) / 2
                pull_body(start_k)
                z = sum(ctx.grip_hang(s, bar_y, grip).z for s in SIDES) / 2
                lo, hi = (lo, st['hb']) if z < BLOCK_BAR_Z else (st['hb'], hi)
            st['hb'] = (lo + hi) / 2

        on_path = start != 'rack' and (up < 0.01 or t >= 0.8)
        if on_path:
            pull_body(p)
            ctx.root((0, ctx.arm.location.y, ctx.arm.location.z + 0.05 * extend * (1 - up)))
            settle = drop if t >= 0.8 else 0.0  # feet come back in from the catch stance
            feet(ctx, width=lerp(0.12, 0.04, settle) if t >= 0.8 else 0.04, toe_out=lerp(15, 0, settle) if t >= 0.8 else 0,
                 y=bar_y + 0.115)
            knees_out(ctx, 0.25)
        elif start != 'rack':
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
        # While pulling and lowering the bar hangs from straight arms, so it is always in the hands.
        hang_z = sum(ctx.grip_hang(s, bar_y, grip).z for s in SIDES) / 2
        bar_pull = Vector((0, bar_y, hang_z))
        rack = ctx.attach_point('chest', (0, -0.135, 1.43))
        over = Vector((0, sh.y + 0.02, sh.z + lockout_z(ctx, grip)))
        target = rack if not (finish == 'overhead') else over
        bar = bar_pull.lerp(target, up)
        if jerk:
            bar = bar.lerp(over, jerk_up * (1 - drop))
        if start != 'rack':
            bar = bar.lerp(bar_pull, drop) if t >= 0.8 else bar
        place(st['bar'], bar)
        bar_grip(ctx, bar, grip)
        racked = up * (1 - jerk_up) * (finish == 'rack') * (1 - drop if start != 'rack' else 1)
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


KB_FLOOR = Vector((-0.03, -0.12, 0.275))  # handle of a bell standing between the feet


def kb_body(ctx, st, h, dip=0.0, heels=0.0):
    """Kettlebell stance: h = 0 standing tall, 1 hinged down with the hand on the bell on the
    floor (hips back and down, knees bent and out). dip lowers the hips for a jerk or push press;
    heels raises both heels (onto the balls of the feet) at the drive."""
    if 'h0' not in st:
        # Solve the hinge that puts the straight arm's grip on the handle on the floor.
        lo, hi = 20.0, 95.0
        for _ in range(16):
            mid = (lo + hi) / 2
            kb_body_pose(ctx, mid, 1.0, 0.0, 0.0)
            far = (ctx.world('upperarm.R', 'head') - KB_FLOOR).length > M.grip_reach('R') * 0.97
            lo, hi = (mid, hi) if far else (lo, mid)
        st['h0'] = (lo + hi) / 2
    kb_body_pose(ctx, st['h0'], h, dip, heels)
    st['lean'] = st['h0'] * h  # torso pitch, for the free arm to hang straight down


def kb_body_pose(ctx, hinge, h, dip, heels):
    ctx.root((0, 0.2 * h, STAND_Z - 0.24 * h - dip))
    ctx.bone('pelvis', (X, hinge * h * 0.8))
    ctx.spine(flex=hinge * h * 0.2)
    ctx.head(flex=-25 * h)
    for s in SIDES:
        ankle, tilt = on_toes((sgn(s) * 0.218, 0.01, 0.085), heels)
        ctx.target('leg.' + s, ankle, qz(sgn(s) * 10) @ tilt @ ctx.body.rest_quat('foot.' + s))
    knees_out(ctx, 0.35)


def reach_clamp(ctx, side, g):
    """Pull a hand target in to what the straight arm reaches, so a held bell never floats."""
    sh = ctx.world('upperarm.' + side, 'head')
    d = g - sh
    r = M.grip_reach(side) * 0.99
    return sh + d.normalized() * r if d.length > r else g


def kb_one_hand(ctx, st, t, kind):
    """Right-hand clean, press, jerk, push press and snatch on loop time. The bell is always
    in the hand: its path runs through a hike behind the knees and close up the front of the
    body (the clean rolls it round the wrist into the rack), never in a straight line."""

    def path(points):
        # Waypoints with smooth arrival windows: [(point, a, b), ...] after a start point.
        g = points[0]
        for pt, a, b in points[1:]:
            g = g.lerp(pt, phase(t, a, b))
        return g

    def body_points():
        sh = ctx.world('upperarm.R', 'head')
        hike = Vector((-0.06, 0.2, 0.5))  # back between the legs, behind the knees
        hip = Vector((-0.07, min(ctx.arm.location.y, 0.0) - 0.27, 0.92))  # in front of the hips, clear of the thigh
        rack = ctx.attach_point('chest', (-0.14, -0.16, 1.36))
        over = Vector((sh.x, sh.y, sh.z + lockout_z(ctx, abs(sh.x))))
        return hike, hip, rack, over

    dip = heels = 0.0
    if kind == 'snatch':
        # Loop starts in the hike: snap the hips, pull high and punch through to overhead (.08–.38),
        # hold, then let it drop in front, down past the hips and back into the next hike.
        h = (1 - phase(t, 0.06, 0.24)) + phase(t, 0.78, 1.0)
        kb_body(ctx, st, 0.75 * h)
        hike, hip, rack, over = body_points()
        high = Vector((-0.12, ctx.arm.location.y - 0.22, 1.3))  # elbow high, bell close to the body
        front = Vector((-0.12, -0.5, 1.15))
        g = path([hike, (hip, 0.06, 0.2), (high, 0.18, 0.3), (over, 0.28, 0.38),
                  (front, 0.6, 0.7), (hip, 0.68, 0.8), (hike, 0.8, 1.0)])
    elif kind == 'push':
        # Bell in the rack throughout: dip, drive (the bell leaves as the legs straighten), lock
        # out with the arm, hold, lower to the rack.
        dip = 0.08 * phase(t, 0.2, 0.35) * (1 - phase(t, 0.35, 0.45))
        heels = 18 * math.sin(math.pi * phase(t, 0.36, 0.5))
        kb_body(ctx, st, 0.0, dip, heels)
        hike, hip, rack, over = body_points()
        g = path([rack, (rack.lerp(over, 0.6), 0.35, 0.45), (over, 0.45, 0.55), (rack, 0.7, 0.9)])
    else:
        # Clean: hand on the bell on the floor, hike it back, snap the hips and guide it up close
        # to the body into the rack; then (press / jerk) overhead and back; lower the same way.
        h = (1 - phase(t, 0.1, 0.26)) + phase(t, 0.84, 1.0)
        if kind == 'jerk':
            # Dip, drive (heels up, bell launched ~60%), re-dip under the locked arm, stand.
            dip = 0.08 * phase(t, 0.36, 0.42) * (1 - phase(t, 0.42, 0.46)) \
                + 0.1 * phase(t, 0.46, 0.5) * (1 - phase(t, 0.52, 0.6))
            heels = 18 * math.sin(math.pi * phase(t, 0.42, 0.48))
        kb_body(ctx, st, h, dip, heels)
        hike, hip, rack, over = body_points()
        pts = [KB_FLOOR, (hike, 0.06, 0.16), (hip, 0.16, 0.24), (rack, 0.22, 0.32)]
        if kind == 'press':
            pts += [(over, 0.38, 0.52), (rack, 0.64, 0.76)]
        elif kind == 'jerk':
            pts += [(rack.lerp(over, 0.6), 0.42, 0.46), (over, 0.46, 0.5), (rack, 0.66, 0.76)]
        # Lower the same way: down the front of the body, a short swing back, onto the floor.
        pts += [(hip, 0.76, 0.84), (hike, 0.82, 0.9), (KB_FLOOR, 0.9, 1.0)]
        g = path(pts)
    g = reach_clamp(ctx, 'R', g)
    ctx.grip('R', g, (1, 0, 0))
    # Low, the bell hangs under the handle; racked and overhead it rests on the back of the forearm.
    place(st['kb'], g, qx(-25 * phase(g.z, 1.0, 1.3)))
    ctx.arm_fk('L', flex=st['lean'], abd=12 + 20 * phase(g.z, 1.2, 1.6))
    ctx.pole_world('arm.R', (-0.3, -0.6, -1))


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
                # Arm angle is relative to the torso: at the hike the arms point back between the
                # thighs (hinge - 20° from the torso line), at the float they're level with the chest.
                ctx.arm_fk(s, flex=lerp(hinge - 20, 90, k), abd=-8 if not one_hand else lerp(-18, -6, k), twist=-80)
            if one_hand:
                ctx.arm_fk('L', abd=12)
            g = ctx.attach_point('hand.R', M.grip_point('R'))
            if not one_hand:
                g = (g + ctx.attach_point('hand.L', M.grip_point('L'))) / 2
            place(st['kb'], g, ctx.bone_delta('forearm.R'))
            return
        if kind == 'thruster':
            squat_body(ctx, 1 - phase(u, 0.0, 0.5), depth=0.42, back=0.12, lean=16, width=0.1)
            press = phase(u, 0.4, 1.0)
            sh = shoulders(ctx)
            # Held by the horns, bell down against the upper chest (as in a goblet squat), so the
            # face stays clear; pressed overhead with the bell hanging just above the head.
            rack = ctx.attach_point('chest', (0, -0.22, 1.42))
            over = Vector((0, sh.y - 0.04, sh.z + lockout_z(ctx, 0.06)))
            g = rack.lerp(over, press)
            for s in SIDES:
                ctx.grip(s, g + Vector((sgn(s) * 0.06, 0, 0)), (0, 0, 1))
            place(st['kb'], g + Vector((0, 0, 0.06)))
            elbows(ctx, (0.4, -0.8, -0.5))
            return
        kb_one_hand(ctx, st, t, kind)

    timing = {} if kind in ('windmill', 'thruster') else LOOP
    camera = cam((0, 0, 1.15), 40, 8, 4.7) if kind in ('thruster', 'press', 'jerk', 'push', 'snatch') else \
        cam((0, 0, 1.0), 40 if kind != 'windmill' else 10, 8, 4.0)
    spec(id_, camera=camera, setup=setup, timing=timing,
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


RING_ANCHOR_Z = 3.4


def muscle_up_spec(id_, rings=False, band=False, jumping=False):
    def setup(ctx):
        st = {}
        if jumping:
            st['bar'] = Vector((0, -0.12, 1.75))
            ctx.eq.group('low_bar', [ctx.eq.cyl('lb', 0.016, 1.4, (0, -0.12, 1.75), (0, math.pi / 2, 0), ctx.eq.m_metal, 16),
                                     ctx.eq.frame('pL', (0.07, 0.07, 1.78), (0.68, -0.12, 0.89)),
                                     ctx.eq.frame('pR', (0.07, 0.07, 1.78), (-0.68, -0.12, 0.89))])
        elif rings:
            # Rings on straps from a high beam; the hands hold them at bar height in the hang.
            st['bar'] = Vector((0, -0.12, 2.3))
            ctx.eq.group('ring_rig', [ctx.eq.frame('beam', (1.7, 0.08, 0.08), (0, -0.12, RING_ANCHOR_Z)),
                                      ctx.eq.frame('pL', (0.08, 0.08, RING_ANCHOR_Z), (0.85, -0.12, RING_ANCHOR_Z / 2)),
                                      ctx.eq.frame('pR', (0.08, 0.08, RING_ANCHOR_Z), (-0.85, -0.12, RING_ANCHOR_Z / 2))])
            st['rings'] = ctx.eq.rings()
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
            if rings:
                # False grip, thumbs forward; the rings come in to the hips in support.
                p = Vector((sgn(s) * lerp(0.24, 0.2, press), bar.y, bar.z))
                ctx.grip(s, p, (0, -1, 0))
                ring, strap = st['rings'][0 if s == 'L' else 1], st['rings'][2 if s == 'L' else 3]
                # The hand closes on the bottom of the ring (modelled upright, its axis on X).
                place(ring, p + Vector((0, 0, 0.09)))
                set_line(strap, Vector((sgn(s) * 0.24, bar.y, RING_ANCHOR_Z)), p + Vector((0, 0, 0.18)))
            else:
                ctx.grip(s, Vector((sgn(s) * 0.27, bar.y, bar.z)), (-sgn(s), 0, 0))
        elbows(ctx, (lerp(0.7, 0.3, over), lerp(-0.05, 1, over), lerp(-1, 0, over)))
        if jumping:
            # Low bar: start squatting under it with the feet flat, then the legs drive the first
            # part of the pull until they straighten and the feet leave the floor.
            for s in SIDES:
                a = ctx.world('foot.' + s, 'head')
                if a.z < 0.1:
                    ctx.target('leg.' + s, (a.x, lerp(a.y, 0.05, 0.6), 0.085))
                    ctx.pole_dir('leg.' + s, (sgn(s) * 0.2, -1, 0))
        if band:
            knees = (ctx.world('shin.L', 'head') + ctx.world('shin.R', 'head')) / 2
            set_line(st['band'], Vector((0, bar.y, bar.z)), knees)
        del t

    # Frame from the hanging feet to the head in support (about bar height + 0.9 m).
    camera = cam((0, 0, 1.3), 55, 6, 5.5) if jumping else cam((0, 0, 1.95), 55, 6, 5.8)
    spec(id_, camera=camera, setup=setup, concentric='out')(pose)


muscle_up_spec('bar-muscle-up')
muscle_up_spec('ring-muscle-up', rings=True)
muscle_up_spec('banded-muscle-up', band=True)
muscle_up_spec('jumping-muscle-up', jumping=True)


@spec('ball-slams', camera=cam((0, -0.2, 1.15), 60, 8, 4.7), setup=lambda ctx: {'ball': ctx.eq.medicine_ball()},
      timing=LOOP, concentric='out')
def ball_slams(ctx, st, u):
    # Ball overhead on the toes, then slam it into the floor with a hip hinge and knee bend; squat
    # down to pick it up off the floor and lift it back overhead.
    t = getattr(ctx, 't', 0.0)
    up = phase(t, 0.0, 0.3) * (1 - phase(t, 0.35, 0.5))
    k = phase(t, 0.35, 0.52) * (1 - phase(t, 0.78, 1.0))
    # Slam the arms down to the knees; at the pickup (t .55-.78) the hands reach the floor.
    reach = phase(t, 0.5, 0.6) * (1 - phase(t, 0.72, 0.82))

    def body(k, up, reach):
        hinge = 45 * k + 20 * reach
        ctx.root((0, 0.12 * k + 0.08 * reach, STAND_Z - 0.18 * k - 0.14 * reach + 0.03 * up))
        ctx.bone('pelvis', (X, hinge))
        ctx.spine(flex=10 * k + 10 * reach)
        heel = 25 * up  # up onto the toes at the overhead reach
        for s in SIDES:
            ankle, tilt = on_toes((sgn(s) * 0.218, 0.01, 0.085), heel)
            ctx.target('leg.' + s, ankle, tilt @ ctx.body.rest_quat('foot.' + s))
        knees_out(ctx, 0.3)
        for s in SIDES:
            # Arm angles are relative to the torso: flex ≈ hinge + spine hangs them to the floor.
            ctx.arm_fk(s, flex=lerp(lerp(40, 175, up), hinge + 10 * k + 10 * reach + 8, k), abd=-15, elbow=20 - 10 * reach)
        hands = [ctx.attach_point('hand.' + s, M.grip_point(s)) for s in SIDES]
        return (hands[0] + hands[1]) / 2 + Vector((0, -0.05, 0))

    if 'floor' not in st:
        # The ball lands where the hands reach at the bottom of the pickup.
        p = body(1.0, 0.0, 1.0)
        st['floor'] = Vector((p.x, p.y, 0.12))
    mid = body(k, up, reach)
    # Released at the bottom of the slam, it drops onto the floor ahead of the hands, sits there,
    # and is in the hands again from the pickup on.
    drop = phase(t, 0.44, 0.5)
    pick = phase(t, 0.62, 0.68)
    on_floor = drop * (1 - pick)
    place(st['ball'], mid.lerp(st['floor'], on_floor))


@spec('medicine-ball-chest-pass', camera=cam((0, -0.85, 1.0), 70, 8, 5.2), setup=lambda ctx: {'ball': ctx.eq.medicine_ball()},
      timing=LOOP, concentric='out')
def chest_pass(ctx, st, u):
    # From the chest, step forward and push the ball away; it travels out and comes back, and the
    # front foot steps back in.
    t = getattr(ctx, 't', 0.0)
    push = phase(t, 0.1, 0.25) * (1 - phase(t, 0.6, 0.8))
    step = phase(t, 0.06, 0.22) * (1 - phase(t, 0.7, 0.95))
    moving = math.sin(math.pi * phase(t, 0.06, 0.22)) if t < 0.5 else math.sin(math.pi * phase(t, 0.7, 0.95))
    stand(ctx, width=0.08)
    ctx.arm.location.y -= 0.12 * step
    # The right foot steps 30 cm forward; the left stays put and its heel peels up.
    ankle, tilt = on_toes((0.178, 0.01, 0.085), 20 * step)
    ctx.target('leg.L', ankle, tilt @ ctx.body.rest_quat('foot.L'))
    ctx.target('leg.R', (-0.178, 0.01 - 0.3 * step, 0.085 + 0.05 * moving))
    for s in SIDES:
        ctx.arm_fk(s, flex=lerp(42, 88, push), abd=-25 + 20 * push, elbow=lerp(118, 5, push), rot=50 * (1 - push))
    hands = [ctx.attach_point('hand.' + s, M.grip_point(s)) for s in SIDES]
    mid = (hands[0] + hands[1]) / 2 + Vector((0, -0.08, 0))
    flight = math.sin(math.pi * phase(t, 0.22, 0.65)) if 0.22 < t < 0.65 else 0.0
    place(st['ball'], mid + Vector((0, -1.1 * flight, 0.1 * flight)))


@spec('devils-press', camera=cam((0, -0.1, 0.85), 60, 10, 4.6), setup=dumbbells, timing=LOOP, concentric='out')
def devils_press(ctx, st, u):
    # Hands on the dumbbells in a plank, chest to the floor, jump the feet in beside the bells,
    # then swing both bells from the floor to overhead in one motion; lower them back to the floor
    # and jump the feet back out. The pose blends continuously (root pitch + IK limbs) so the
    # plank, crouch and stand flow into each other.
    t = getattr(ctx, 't', 0.0)
    if 'bells' not in st:
        from catalog_core import high_plank

        high_plank(ctx)
        st['bells'] = [Vector((ctx.world('upperarm.' + s, 'head').x, ctx.world('upperarm.' + s, 'head').y - 0.02, 0.1))
                       for s in SIDES]
    bells = st['bells']
    bell_y = bells[0].y
    foot_y = bell_y + 0.36  # feet land just behind the bells, wider than them

    dip = -0.3 * math.sin(math.pi * phase(t, 0.0, 0.18))  # chest to the floor
    jin = phase(t, 0.18, 0.3) if t < 0.6 else 1 - phase(t, 0.88, 1.0)  # 0 plank, 1 feet in
    hop = math.sin(math.pi * (phase(t, 0.18, 0.3) if t < 0.6 else phase(t, 0.88, 1.0)))
    rise = phase(t, 0.42, 0.54) * (1 - phase(t, 0.68, 0.8))  # crouch to standing
    plank_root = Vector((0, 0.0, 0.62 + dip))
    crouch_root = Vector((0, foot_y + 0.16, 0.6))
    stand_root = Vector((0, foot_y, STAND_Z))
    root = plank_root.lerp(crouch_root, jin).lerp(stand_root, rise) + Vector((0, 0, 0.1 * hop))
    ctx.root(root, (lerp(lerp(68, 72, jin), 0, rise), 0, 0))
    ctx.spine(flex=12 * jin * (1 - rise))
    ctx.head(flex=lerp(lerp(-50, -35, jin), 0, rise))
    for s in SIDES:
        plank_foot = Vector((sgn(s) * 0.12, 0.95, 0.06))
        crouch_foot = Vector((sgn(s) * 0.3, foot_y, 0.085))
        ctx.target('leg.' + s, plank_foot.lerp(crouch_foot, jin) + Vector((0, 0, 0.08 * hop)))
        ctx.pole_world('leg.' + s, Vector((0, 0, 1)).lerp(Vector((sgn(s) * 0.4, -1, 0)), jin))

    # Hands: on the bells on the floor, then a straight-arm arc from the floor (a short swing back
    # between the legs) to overhead, and the same arc back down.
    up = phase(t, 0.36, 0.42) * 0.25 + phase(t, 0.42, 0.56) * 0.75
    down = phase(t, 0.68, 0.84)
    k = up * (1 - down)
    reach = M.grip_reach() * 0.97
    for s, db, bell in zip(SIDES, st['db'], bells):
        sh = ctx.world('upperarm.' + s, 'head')
        d = bell - sh
        th0 = math.degrees(math.atan2(-d.y, -d.z))  # world angle from straight down toward the front
        lift = phase(t, 0.36, 0.42) if t < 0.6 else 1 - phase(t, 0.68, 0.84)
        th = lerp(th0, -20, phase(t, 0.36, 0.42)) if t < 0.42 else lerp(-20, 180, phase(t, 0.42, 0.56))
        if t >= 0.6:
            th = lerp(180, th0, down)
        r = lerp(d.length, reach, lift)
        g = sh + Vector((0, -math.sin(math.radians(th)), -math.cos(math.radians(th)))) * r
        if k == 0.0:
            g = bell
        g.x = bell.x
        hold_dumbbell(ctx, db, s, g, Vector((0, -1, 0)))
        ctx.pole_world('arm.' + s, Vector((sgn(s) * 0.5, 1, 0)).lerp(Vector((sgn(s) * 1, 0.3, 0)), rise))
