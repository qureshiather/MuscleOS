"""Render one exercise loop to PNG frames.

blender -b --factory-startup -P render_exercise.py -- \
    --id squat --theme dark --muscles quads,glutes --out /tmp/frames [--size 640] [--frames 72]
    [--stills 0,30]   # render only these frames (preview)

blender -b --factory-startup -P render_exercise.py -- --build-mannequin
    builds the cached mannequin (.cache/mannequin.blend) and exits
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import anim  # noqa: E402
import equipment as E  # noqa: E402
import catalog  # noqa: E402
import mannequin as M  # noqa: E402
import scene as S  # noqa: E402

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.cache', 'mannequin.blend')


def main():
    argv = sys.argv[sys.argv.index('--') + 1 :] if '--' in sys.argv else []
    if argv == ['--list']:
        print('SPECS ' + ' '.join(sorted(catalog.SPECS)))
        return
    if argv == ['--build-mannequin']:
        S.reset_scene()
        M.build()
        M.save(CACHE)
        return
    ap = argparse.ArgumentParser()
    ap.add_argument('--id', required=True)
    ap.add_argument('--theme', default='dark', choices=sorted(S.THEMES))
    ap.add_argument('--muscles', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--size', type=int, default=640)
    ap.add_argument('--frames', type=int, default=72)
    ap.add_argument('--fps', type=int, default=24)
    ap.add_argument('--stills', default='')
    ap.add_argument('--camera', default='', help='target_x,y,z,azimuth,elevation,distance override (preview)')
    args = ap.parse_args(argv)

    spec = catalog.SPECS[args.id]
    S.reset_scene()
    S.setup_render(args.size, args.frames, args.fps)
    S.setup_world(args.theme)
    S.setup_lights()
    S.floor(args.theme)

    body_mat = S.body_material(args.theme)
    body = M.load_or_build(CACHE, body_mat)
    M.paint_muscles(body.meshes, args.muscles.split(','))
    eq = E.Equipment(args.theme)
    cam = S.camera(**spec.camera)
    ctx = anim.Ctx(body, eq, cam)
    state = spec.setup(ctx)

    timeline = anim.Timeline(args.frames, **spec.timing)
    baker = anim.Baker(ctx, eq.objects)
    # Warm the IK up on the first pose so frame 0 solves like every frame after it.
    ctx.t = 0.0
    for _ in range(4):
        ctx.begin_frame()
        spec.pose(ctx, state, timeline.u(0))
        ctx.end_frame()
    for f in range(args.frames):
        u = timeline.u(f)
        ctx.t = f / args.frames  # loop time, for moves that aren't a plain there-and-back
        ctx.begin_frame()
        spec.pose(ctx, state, u)
        ctx.end_frame()
        w_out, w_back = timeline.outbound(f)
        effort = w_out if spec.concentric == 'out' else w_back
        baker.snapshot(spec.pulse_floor + (1 - spec.pulse_floor) * effort)
    baker.write(body_mat)

    if args.camera:
        x, y, z, az, el, dist = (float(v) for v in args.camera.split(','))
        cam.animation_data_clear()
        S.place_camera(cam, (x, y, z), az, el, dist)
    os.makedirs(args.out, exist_ok=True)
    sc = bpy.context.scene
    frames = [int(x) for x in args.stills.split(',')] if args.stills else range(args.frames)
    for f in frames:
        sc.frame_set(f)
        sc.render.filepath = os.path.join(args.out, f'{f:04d}.png')
        bpy.ops.render.render(write_still=True)


main()
