"""Exercise registry: every animated exercise registers a Spec here by catalog id.

`pose(ctx, state, u)` sets the whole scene for movement phase u (0 = start, 1 = far end).
`concentric` says which direction is the lifting (working) phase, for the highlight pulse.
"""

from dataclasses import dataclass, field

@dataclass
class Spec:
    camera: dict
    setup: callable
    pose: callable = None
    concentric: str = 'back'  # 'out': 0→1 is the lift. 'back': 1→0 is the lift.
    timing: dict = field(default_factory=dict)
    pulse_floor: float = 0.72


SPECS = {}


def spec(id_, **kw):
    def deco(pose):
        SPECS[id_] = Spec(pose=pose, **kw)
        return pose

    return deco


def cam(target, azimuth, elevation=10, distance=3.8, lens=60):
    """azimuth 0 looks at the figure's front; 90 is its left side."""
    return dict(target=target, azimuth=azimuth, elevation=elevation, distance=distance, lens=lens)


def nothing(ctx):
    return {}


def barbell(ctx, **kw):
    return {'bar': ctx.eq.barbell(**kw)}


def dumbbells(ctx):
    return {'db': ctx.eq.dumbbells()}
