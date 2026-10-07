"""Shared choreography building blocks: stances, grips and body positions that more than one
exercise uses. Exercises compose these, so fixing a stance or grip here fixes it everywhere.

World axes match the rig: the figure faces -Y when standing, +X is its left, z = 0 is the floor.
"""

from mathutils import Vector

import mannequin as M
from anim import sgn
from equipment import qz

SIDES = ('L', 'R')
STAND_Z = M.PELVIS_Z


# -- limbs -------------------------------------------------------------------------------------


def feet(ctx, width=0.0, toe_out=0.0, y=0.0, floor=0.0):
    """Both feet flat on a surface `floor` m up, `width` wider than hip width, toes turned out."""
    for s in SIDES:
        x = sgn(s) * (0.098 + width)
        ctx.target('leg.' + s, (x, y + 0.01, floor + 0.085), qz(sgn(s) * toe_out) @ ctx.body.rest_quat('foot.' + s))


def knees_out(ctx, amount=0.3):
    """Knees point forward, `amount` out over the toes."""
    for s in SIDES:
        ctx.pole_dir('leg.' + s, (sgn(s) * amount, -1, 0))


def elbows(ctx, v):
    """Elbow direction in the body frame, given for the left arm (mirrored for the right)."""
    for s in SIDES:
        ctx.pole_dir('arm.' + s, (sgn(s) * v[0], v[1], v[2]))


def shoulders(ctx):
    """Midpoint of the shoulder joints, world space."""
    return (ctx.world('upperarm.L', 'head') + ctx.world('upperarm.R', 'head')) / 2


# -- grips -------------------------------------------------------------------------------------


def grip_point(side):
    """Rest-space point inside the closed hand where a held bar or handle sits."""
    return M.grip_point(side)


def held(side, q):
    """Rest orientation for a prop held in the hand, given how it sits with the arm hanging."""
    return M.arm_rest_rot(side) @ q


def bar_grip(ctx, center, half_width, axis=(1, 0, 0), underhand=False):
    """Both hands on a bar through `center` along `axis`. Overhand puts the thumbs toward the
    middle; underhand turns them out."""
    axis = Vector(axis).normalized()
    for s in SIDES:
        thumb = axis * sgn(s) * (1 if underhand else -1)
        ctx.grip(s, Vector(center) + axis * sgn(s) * half_width, thumb)


def carry_dumbbells(ctx, dumbbells, neutral=True):
    """Dumbbells follow the hands (FK arms); neutral grip runs the handle front to back."""
    for s, db in zip(SIDES, dumbbells):
        ctx.follow(db, 'hand.' + s, grip_point(s), held(s, qz(90 if neutral else 0)))


def fk_hand_midpoint(ctx):
    """Where a bar held in both FK hands sits."""
    return sum((ctx.attach_point('hand.' + s, grip_point(s)) for s in SIDES), Vector()) / 2


def hang_bar(ctx, bar, grip, bar_y, bar_z=None):
    """Hang a bar from straight arms at depth bar_y. With bar_z, the body shifts vertically so
    the straight arms reach it (deadlifts start from the floor this way)."""
    w = [ctx.grip_hang(s, bar_y, grip) for s in SIDES]
    natural = (w[0].z + w[1].z) / 2
    if bar_z is not None:
        ctx.arm.location.z += bar_z - natural
        natural = bar_z
    center = Vector((0, bar_y, natural))
    bar.location = center
    bar_grip(ctx, center, grip)
    elbows(ctx, (0.3, 1, 0))
    return center


# -- positions ---------------------------------------------------------------------------------


def stand(ctx, width=0.03, toe_out=0.0, y=0.0, floor=0.0):
    ctx.root((0, y, STAND_Z + floor))
    feet(ctx, width=width, toe_out=toe_out, y=y, floor=floor)


def lie_on_bench(ctx, bench_height=0.44, feet_y=-0.48):
    """Supine on a flat bench running along Y, head toward +Y, feet planted either side."""
    ctx.root((0, 0.0, bench_height + 0.1), (-90, 0, 0))
    ctx.head(flex=6)
    for s in SIDES:
        ctx.target('leg.' + s, (sgn(s) * 0.26, feet_y, 0.085))
    knees_out(ctx, 0.35)


def sit(ctx, seat_height, y=0.1, hip_flex=88, knee=92, ankle=0, hip_abd=0, lean=0):
    """Seated upright on a seat of `seat_height`, thighs forward, FK legs."""
    ctx.root((0, y, seat_height + 0.16))
    ctx.spine(flex=lean)
    for s in SIDES:
        ctx.leg_fk(s, hip_flex=hip_flex, knee=knee, ankle=ankle, hip_abd=hip_abd)


def hang_dumbbells(ctx, dumbbells, x=0.25, y=None, neutral=True, z=None):
    """Dumbbells hanging from straight arms (IK) at the sides; neutral grip runs the handles front
    to back. With z, the body is not moved: arms bend as needed to reach."""
    from equipment import along

    for s, db in zip(SIDES, dumbbells):
        sh = ctx.world('upperarm.' + s, 'head')
        p = ctx.grip_hang(s, sh.y if y is None else y, x)
        if z is not None:
            p.z = z
        thumb = Vector((0, -1, 0)) if neutral else Vector((-sgn(s), 0, 0))
        ctx.grip(s, p, thumb)
        db.location = p
        db.rotation_quaternion = along(thumb)
    elbows(ctx, (0.3, 1, 0))


def hold_dumbbell(ctx, db, side, point, thumb):
    """One hand closes on a dumbbell handle at `point`, handle along `thumb`."""
    from equipment import along

    ctx.grip(side, point, thumb)
    db.location = Vector(point)
    db.rotation_quaternion = along(thumb)
