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
`FEATURED_DEMOS`, with the count of animated exercises), then **All exercises**: every
published catalog row A–Z with a search box. Search is case-insensitive and every word must match
the name, muscle labels or equipment labels (`filterExercises`).

**`/exercises/<id>`** exists for every published catalog exercise (static export; the id is the
catalog id, so app links and history ids line up). It shows:

- the demo, or a "Demo coming soon" panel for an exercise added to the catalog before its demo
  is rendered;
- a type line: library type and equipment (`Free Weight · Barbell`), or just the type when the
  two say the same thing (`Bodyweight`, `Machine`);
- **Muscles worked**, the first (main) muscle emphasised;
- **How to do it**: the catalog instruction copy;
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

The animation files (`public/exercise-demos/*.mp4`, `*.webp`) are MuscleOS originals dedicated
to the public domain under **CC0 1.0**: anyone may use them for anything, without credit.
`public/exercise-demos/LICENSE.txt` says so, and every demo page states it. The instruction copy,
name, logo, app and the rest of the site are not covered.

## App link

The exercise detail sheet shows **See how it's done** directly under the body diagram for every
published catalog exercise (`exercisePageUrl`). It opens `https://muscleos.app/exercises/<id>` in
the in-app browser over the sheet, so it is offered everywhere the sheet is, mid-workout included.
Custom exercises and unpublished catalog rows have no page and show no row.

Because every published exercise has a page, the app needs no list of which demos exist: a new
demo appears behind the existing link as soon as the website deploys. Until an exercise has one,
its page shows "Demo coming soon" with the same how-to as the app.

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
10–40 KB) and a WebP poster at the far end of the rep, then rewrites the website's id list (`apps/landing/app/data/exerciseDemos.json`) from the files
on disk.

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

## Tests

- `apps/landing/app/data/exercises.test.ts`: catalog order and uniqueness, demo ids are published
  rows, per-theme sources, paths, muscle labels, search, related exercises, type line.
- `apps/mobile/src/utils/exerciseDemo.test.ts`: a page link for every published catalog
  exercise, none for customs or unpublished rows.
- `apps/mobile/src/test/ui/exercises/exercisesTab.test.tsx`: the detail sheet row opens the
  website page in the in-app browser and is absent for a custom exercise.
- Not covered by automated tests: the rendered animations themselves. Review them with `--check`
  and by watching the clips.
