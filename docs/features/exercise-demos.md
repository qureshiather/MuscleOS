# Exercise demos

Short looping animations of an exercise, with the muscles it works highlighted, published on the
website's exercise pages, which the app links to. The clips live on **muscleos.app only**; the
mobile app bundles no media and no list of which exercises have a demo.

| Area | Code |
|------|------|
| Website library and exercise pages | `apps/landing/app/exercises/page.tsx`, `apps/landing/app/exercises/[id]/page.tsx` |
| Website data and search | `apps/landing/app/data/exercises.ts`, `exerciseText.ts` |
| Demo player | `apps/landing/app/components/ExerciseDemo.tsx` |
| Rendering pipeline | `apps/landing/scripts/build-exercise-animations.mjs`, `apps/landing/scripts/exercise-animations/` |
| App link | `apps/mobile/src/utils/exerciseDemo.ts`, `src/components/ExerciseDetailSheet.tsx` |

## Website

**`/exercises`** shows **Staple lifts** first (a grid of demos for a fixed set of core lifts,
`FEATURED_DEMOS`), then **All exercises**: every
published catalog row A–Z with a search box. Search is case-insensitive and every word must match
the name, muscle labels or equipment labels (`filterExercises`).

**`/exercises/<id>`** exists for every published catalog exercise (static export; the id is the
catalog id, so app links and history ids line up). It shows:

- the demo, or a "Demo coming soon" panel for an exercise added to the catalog before its demo
  is rendered;
- a type line: library type and equipment (`Free Weight · Barbell`), or just the type when the
  two say the same thing (`Bodyweight`, `Machine`);
- **Muscles worked**, the first (main) muscle emphasised;
- **How to do it**: the catalog instruction copy as a numbered list of steps (the meta description joins them into one line);
- a "Log it in MuscleOS" panel with the store buttons;
- the reuse licence and light/dark MP4 download links (demo pages only);
- **Also works your <main muscle>**: up to six other exercises sharing the main muscle
  (`relatedExercises`).

The page data is the published catalog. `generate-exercise-catalog.mjs` writes it to
`apps/landing/app/data/exerciseCatalog.json` alongside the app's seed, so the website and app
always describe the same rows. Labels come from `@muscleos/types`, which the landing reads from
source through a path alias, so it never depends on that package's build output.

### The player

- Each demo is rendered twice, once per site theme, on that theme's card colour (`#1C1F2A` dark,
  `#FFFFFF` light). The player follows the site theme (toggle or OS setting) and swaps clips when
  it changes. Before hydration both posters are in the page behind the theme CSS classes, so the
  first paint is right.
- Clips autoplay muted and loop inline. In the library grid they load and play only while on
  screen.
- **Reduced motion:** nothing autoplays. Exercise pages show the poster with a **Play demo**
  button; the library grid shows posters only (its cards are links).

## Licence

The animation files (`*.mp4`, `*.webp` in the Blob store) are MuscleOS originals dedicated
to the public domain under **CC0 1.0**: anyone may use them for anything, without credit.
`LICENSE.txt` next to them in the store says so, and every demo page states it. The instruction copy,
name, logo, app and the rest of the site are not covered.

## App link

The exercise detail sheet shows **See how it's done** directly under the body diagram for every
published catalog exercise (`exercisePageUrl`). It opens `https://muscleos.app/exercises/<id>` in
the in-app browser over the sheet, so it is offered everywhere the sheet is, mid-workout included.
Custom exercises and unpublished catalog rows have no page and show no row.

Because every published exercise has a page, the app needs no list of which demos exist: a new
demo appears behind the existing link as soon as the website deploys. Until an exercise has one,
its page shows "Demo coming soon" with the same how-to as the app.

## Hosting

Clips are **not in git**. They live in a public **Vercel Blob** store connected to the
`muscle-os-landing` project, under `exercise-demos/<id>-<theme>.{mp4,webp}`. The site builds clip
URLs from `apps/landing/app/data/exerciseDemoStore.json` (the store's public base URL, written by
the upload script). Blob responses are cached for a day, so a re-render reaches viewers within a
day. Download links use Blob's `?download=1`.

Uploading needs the store credentials locally: `npx vercel env pull` in `apps/landing` writes
`VERCEL_PUBLIC_EXERCISE_DEMO_BLOB_STORE_ID` and `VERCEL_OIDC_TOKEN` to `.env.local` (the store connection
must include the Development environment). The free Hobby tier allows 2,000 writes a month; a full
re-upload is about 1,600 (792 clips + posters), so upload only the exercises you re-rendered.

## Rendering pipeline

Demos are rendered with headless Blender from code, not hand-animated:

```
node apps/landing/scripts/build-exercise-animations.mjs            # every exercise with choreography
node apps/landing/scripts/build-exercise-animations.mjs --missing  # only those without clips yet
node apps/landing/scripts/build-exercise-animations.mjs squat ...  # just these
node apps/landing/scripts/build-exercise-animations.mjs --check    # key-frame contact sheet of all
node apps/landing/scripts/build-exercise-animations.mjs --manifest # only rewrite the id list
```

Each run renders a 3 s loop (72 frames, 24 fps) per theme, encodes a 480 px H.264 MP4 (about
10–40 KB) and a WebP poster at the far end of the rep into the gitignored
`apps/landing/.exercise-demos/`, adds the ids to the website's list
(`apps/landing/app/data/exerciseDemos.json`), then uploads the clips to Blob
(`scripts/upload-exercise-demos.mjs`; skip with `--no-upload`).

Everything an exercise doesn't define is shared, so a fix to any of it reaches every demo:

| Shared piece | File |
|--------------|------|
| Body, gripping hands, feet, muscle regions; built once and cached as `.cache/mannequin.blend` | `mannequin.py` |
| Rig control, grip solver, timing, baking | `anim.py` |
| Look: themes, lighting, floor, camera | `scene.py` |
| Equipment: barbell, dumbbells, benches, cable stations, machines | `equipment.py` |
| Positions and grips: stand, lie on a bench, sit, bar grip, hang a bar, carry dumbbells | `moves.py` |

An exercise is only its movement: equipment setup plus a pose for each point of the rep. Each one
registers a spec by catalog id (`registry.py`); `catalog.py` imports every module, so the build
renders whatever is registered:

| Module | Exercises |
|--------|-----------|
| `exercises.py` | The built-in template exercises |
| `catalog_legs.py` | Squat and deadlift/hinge variants |
| `catalog_press.py` | Bench, incline, decline, floor, Smith, dumbbell and overhead presses |
| `catalog_pull.py` | Rows, inverted rows, shrugs, pulldowns, pull-ups and hangs |
| `catalog_arms.py` | Curls, triceps extensions, pushdowns and dips |
| `catalog_glutes.py` | Bridges, hip thrusts, kickbacks, abduction/adduction, Nordics, leg machines, calves |
| `catalog_core.py` | Planks, crunches, leg raises, rotation and anti-rotation |
| `catalog_upper.py` | Push-ups, raises, flys, rotator cuff, cable rows, wrist, grip and neck |
| `catalog_power.py` | Lunges, jumps, Olympic lifts, kettlebell ballistics, muscle-ups |

Moves that shouldn't play backwards (Olympic lifts, jumps, alternating or walking moves) read loop
time (`ctx.t`) and choreograph their own return instead of reversing the rep.

**Look rules.** Colours mirror the app's Pulse palette. The body is the neutral diagram fill; the
exercise's catalog muscles are drawn in `muscleHighlight` and brighten during the lifting phase.
No other muscle is outlined, matching the app's muscle diagram highlight mode.

**Rig rules that are easy to break:**

- The rest pose holds the arms in an A-pose so the skin weights separate arm from torso; arm
  angles are still written as if the arms hang at the sides (`pose_bone` converts).
- IK pole angles are calibrated per limb when the body is built. Bone roll isn't mirrored, so
  one angle can't serve both sides.
- The right hand's frame is the left's mirror image; the grip solver builds its target frame with
  the matching handedness, or the right hand twists off the bar.
- Solved joint angles are baked into keyframes and constraints are switched off for playback.
  Blender's IK starts from the previous pose, so re-solving at render time can differ.
- Hanging bars (deadlift, RDL) travel in front of the legs; the deadlift's hips are placed from
  joint angles with the feet planted so the bar never passes through the shins or thighs.

## Updating demos

A runbook for changing, adding or re-rendering demos. Commands run from `apps/landing`.

### Before you start

- **Tools:** Blender 5.x (`blender` on `PATH`, or set `BLENDER=`) and ffmpeg. Rendering is local; nothing renders in CI or on Vercel.
- **Upload credentials:** `npx vercel env pull` (linked to `conveybridge/muscle-os-landing`). The OIDC token it writes lasts about 12 hours. If an upload fails with an auth or `OIDC ... not for the "development" environment` error, pull again.
- **Write budget:** the Blob store's free tier allows 2,000 writes a month. One exercise costs 4 (two clips, two posters) and a full re-upload about 1,600, so do at most one full re-upload a month. Prefer re-rendering only what changed.

### Fix or tweak one exercise

1. Find its spec: `grep -rn "'<id>'" scripts/exercise-animations/` (the id is the catalog id).
2. Edit its `pose()` (or the shared helper it calls).
3. Review before rendering clips (see [Reviewing](#reviewing)).
4. `node scripts/build-exercise-animations.mjs <id>` renders both themes, uploads them over the old clips (same URLs) and updates `app/data/exerciseDemos.json` if it's new.
5. Commit the code change only; the clips aren't in git. Viewers get the new clip within a day (Blob cache).

### Change something shared (body, look, equipment, a common stance)

1. Edit `mannequin.py`, `scene.py`, `equipment.py` or `moves.py`. Body edits rebuild the cached mannequin automatically on the next run.
2. `node scripts/build-exercise-animations.mjs --check` and review the contact sheet for **every** exercise. Shared changes routinely break exercises nobody touched.
3. Re-render everything with `node scripts/build-exercise-animations.mjs` (about 2.5 hours, 6 parallel jobs: `JOBS=6`), watching the write budget. To render now and upload later, add `--no-upload`, then run `node scripts/upload-exercise-demos.mjs`.

### Add an exercise

1. It must exist in the catalog first so it has an id, muscles and a page ([exercise-library.md → Adding a catalog exercise](exercise-library.md#adding-a-catalog-exercise)).
2. Add a spec to the matching `catalog_*.py` module. Most are a few lines built from the shared helpers or a flag on a family helper (Military Press is `ohp_spec('military-press', heels=True)`) (`stand`, `sit`, `lie_on_bench`, `bar_grip`, `hang_bar`, `carry_dumbbells`, the family helpers such as `squat_spec`, `press_spec`, `row_spec`, `curl_spec`). New equipment goes in `equipment.py`.
3. Review, then `node scripts/build-exercise-animations.mjs <id>`. The site picks it up from `exerciseDemos.json`, and the app already links every catalog exercise.

### Writing choreography

- `pose(ctx, st, u)` sets the whole scene for rep phase `u` (0 = start, 1 = far end). The timeline eases `u` there and back, and `concentric` names the lifting direction for the highlight pulse. For moves that shouldn't reverse (Olympic lifts, jumps, alternating or walking moves), set `timing=dict(hold_start=0.0, out=1.0, hold_end=0.0)` (`LOOP` in `catalog_power.py`) and read loop time `ctx.t`.
- World axes: the figure faces **−Y**, **+X** is its left, **z = 0** is the floor, and `ctx.root(loc, rot)` places and rotates the pelvis.
- Limbs are either IK (`ctx.target`, `ctx.grip`, then `ctx.pole_dir`/`elbows`/`knees_out` to aim the elbow or knee) or FK (`ctx.arm_fk`, `ctx.leg_fk`). A later FK call overrides an earlier target on the same limb.
- FK arm angles are **relative to the torso**. When the body hinges, an arm that should hang toward the floor needs `flex ≈ hinge` (the kettlebell-swing bug: arms swinging through the thighs).
- Hands hold things through `ctx.grip(side, point, thumb_direction)` so the fist closes around the handle. Don't place props beside a hand.
- Feet: `qx(-a)` on a foot target tilts the toes up (heels down, e.g. legs out straight); `qx(+a)` lifts the heel. A raised heel pivots about the ball of the foot (`on_toes()` in `catalog_power.py`), not the ankle, or the toes sink into the floor.
- Put the body on the equipment: feet on a platform need the platform height as `floor`, a lie on an incline needs the bench angle `lie()` reclines to, and pads go where the body touches them (a back-extension pad sits below the hip crease so the torso folds over it).
- Bars held in the hands hang from straight arms while pulling or lowering (Olympic lifts, deadlifts); interpolating the bar between fixed heights leaves it floating below the hands. Loop-time moves must end in their start pose.
- Lunges use a full stride (`STRIDE`, ~85 cm): front shin about vertical, back knee under the hip. A shorter stance forces the back knee through the floor.
- Get the facts from a form reference (bar path, joint angles, setup), not memory. Every bad demo so far was a plausible-looking guess.

### Reviewing

- `node scripts/build-exercise-animations.mjs --check <ids...>` writes start, mid, far-end and return frames of each exercise to `scripts/exercise-animations/.cache/check.png`. Review it before rendering final clips.
- For one exercise from any angle: `blender -b --factory-startup -P scripts/exercise-animations/render_exercise.py -- --id <id> --theme dark --muscles <a,b> --out /tmp/f --size 480 --stills 0,22,40 --camera x,y,z,azimuth,elevation,distance` (azimuth 0 is the front, 90 the figure's left).
- **Check a second angle before believing a problem, or a fix.** Several "wrong" demos were only foreshortened by the camera, and several real bugs looked fine from the default view: lying-down and side-lying moves, bars passing through legs, arms crossing the body.
- When a fix touches shared code, re-run `--check` on everything.

## Tests

- `apps/landing/app/data/exercises.test.ts`: catalog order and uniqueness, demo ids are published
  rows, per-theme sources, paths, muscle labels, search, related exercises, type line, at least
  two instruction steps per row, and the one-line instructions summary for the meta description.
- `apps/mobile/src/utils/exerciseDemo.test.ts`: a page link for every published catalog
  exercise, none for customs or unpublished rows.
- `apps/mobile/src/test/ui/exercises/exercisesTab.test.tsx`: the detail sheet row opens the
  website page in the in-app browser and is absent for a custom exercise.
- Not covered by automated tests: the rendered animations themselves. Review them with `--check`
  and by watching the clips.
