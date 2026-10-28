# Muscle Recovery

The signature feature: after you train a muscle it is marked unavailable for a fixed number of
hours, and the Recovery tab shows a body diagram of what is still recovering and when each
muscle is ready again.

**The model is a timer, not a physiological simulation.** Train a muscle and it is unavailable
for 36, 48, or 72 hours depending on the muscle, then it is fully ready. Nothing else — not
load, not sets, not sleep — changes that number. This is a deliberate simplification; see
[Assumptions](#assumptions).

| | |
|--|--|
| Screen | `apps/mobile/app/(tabs)/recovery.tsx` |
| Model & constants | `packages/types/src/recovery.ts`, `packages/types/src/muscles.ts` |
| Computation | `apps/mobile/src/utils/recovery.ts` |
| Store | `apps/mobile/src/store/recoveryStore.ts` |
| Diagram | `apps/mobile/src/components/MuscleDiagram.tsx` |
| Explainer | `apps/mobile/src/components/RecoveryInfoModal.tsx` |

## Muscle taxonomy

20 muscle groups, defined in `packages/types/src/muscles.ts`. `MuscleId` is a closed union;
every exercise maps to one or more of these.

| Region | Muscles |
|--------|---------|
| `upper_front` | `chest`, `front_delts`, `side_delts`, `abs`, `obliques` |
| `upper_back` | `rear_delts`, `neck`, `traps`, `lats`, `rhomboids`, `lower_back` |
| `arms` | `biceps`, `triceps`, `forearms` |
| `lower_front` | `quads`, `adductors`, `tibialis` |
| `lower_back` | `hamstrings`, `glutes`, `calves` |

`region` is layout metadata for the diagram only. There is **no** push/pull/legs taxonomy in
code — built-in templates are grouped by folder name, not by a muscle classification.

Display names come from `muscleLabel()` / `formatMuscleLabels()`; raw ids are never shown.

Exercises carry a **flat** `muscles: MuscleId[]` with no primary/secondary distinction. The
catalog generator merges the upstream source's primary and secondary muscles into one list at
build time, so at runtime every listed muscle is weighted equally.

## How fatigue is recorded

`recoveryFromSessions()` in `apps/mobile/src/utils/recovery.ts` derives the whole recovery
state from the session list:

1. Iterate all sessions; **skip any without `completedAt`** — an in-progress workout has no
   recovery effect.
2. For each exercise in the session, **skip it unless at least one set has `completed: true`**.
3. For each muscle in that exercise's `muscles[]`, record `trainedAt = session.completedAt`.
   Muscles come from the live exercise lookup (catalog + customs); if that returns nothing for an
   id, the bundled `CATALOG_SEED` (with alias resolution) is used instead.
4. Keep only the **most recent** `trainedAt` per muscle.

Not considered: reps, weight, set count, exercise order, warm-up vs working sets (any completed
set qualifies), or `startedAt`. The timestamp is always the session's completion time, not a
per-exercise time.

The result is one record per trained muscle:

```ts
interface MuscleRecovery {
  muscleId: MuscleId;
  trainedAt: string; // ISO
}
```

`recoveryUntil` is **not** stored. It is derived at read time, so changing the duration table
re-times every muscle without a migration.

## Recovery durations

From `packages/types/src/recovery.ts`:

| Bucket | Hours | Muscles |
|--------|------:|---------|
| Small | **36** | `abs`, `obliques`, `biceps`, `triceps`, `forearms`, `neck`, `tibialis` |
| Medium | **48** | `front_delts`, `side_delts`, `rear_delts`, `calves`, `adductors` |
| Large | **72** | `chest`, `traps`, `lats`, `rhomboids`, `lower_back`, `quads`, `hamstrings`, `glutes` |

`DEFAULT_RECOVERY_HOURS = 72` is the fallback for any muscle not in the table.

Durations are the same for every user; there is no user setting that changes them.

```ts
hours = RECOVERY_HOURS_BY_MUSCLE[muscleId] ?? DEFAULT_RECOVERY_HOURS
```

`getRecoveryUntil(record)` returns `trainedAt + hours` as an ISO string.

A muscle is **active** (still recovering) when `getRecoveryUntil(r) > now`, compared as ISO
strings by `activeRecoveryAt()` (called from `recoveryStore.activeRecovery()`). Once past that instant the muscle drops out of the
list entirely — there is no intermediate state.

## When recovery is recomputed

Recovery is a **derived cache**, always rebuilt from all sessions rather than incrementally
updated. `recoveryStore.load()` reads sessions, runs `recoveryFromSessions`, and sets the result
in memory, writing it to storage (`muscleos_recovery`) only when it differs from the stored copy
(`sameRecovery()`). Comparing with storage rather than memory means a copy a sync merge computed
from a partial exercise map is still corrected. Overlapping loads resolve to the latest one.

Recompute is driven by **whatever changes sessions or muscle mappings**, not by screen focus:

| Trigger | Where |
|---------|-------|
| Finishing a workout | `src/store/activeWorkoutStore.ts` |
| Deleting a session | `src/store/sessionsStore.ts` (`deleteSession`) |
| Saving an edit from History (Edit workout) | `src/store/sessionsStore.ts` (`saveSessionEdit`) |
| Cloud sync merge | `src/sync/merge.ts` |
| Data → Sync now / Clear data | `app/data.tsx` |
| Data → Import | `src/storage/importData.ts` (recomputes and persists from the merged sessions), then `app/data.tsx` reloads the store |
| Delete account | `app/account.tsx` (reloads every store after the device wipe) |
| Exercise catalog or custom exercises change | `src/store/recoveryStore.ts` (subscribes to `exercisesStore`) |

The Recovery and Workouts tabs call `ensureLoaded()` on focus, which computes only if nothing has
been computed yet in this app run. Focusing the Recovery tab also re-renders it, so muscles whose
window has passed since the last visit drop out without a recompute. The loading skeleton shows
only before the first load; later reloads keep the previous items on screen.

Because it is always derived, deleting a session correctly reverses its recovery impact, and
recovery is **never synced** from the server — the merge step recomputes it locally from the
merged sessions instead. The persisted copy is currently read for export; `recoveryStore.load()`
recomputes from sessions rather than using it for first paint.

Recovery is deliberately **not** loaded during app boot; the first tab that needs it loads it on focus.

## Readiness copy

`formatRecoveryReady()` in `apps/mobile/src/utils/relativeTime.ts` formats a recovery deadline
using **local calendar day differences**, not clock time:

| Day difference | Copy |
|---------------:|------|
| ≤ 0 | `Ready later today` |
| 1 | `Ready tomorrow` |
| 2–6 | `Ready Thu` (short weekday) |
| ≥ 7 | `Ready Mar 14` (short month + day) |

Day granularity is intentional: the underlying number is a coarse per-muscle constant, so
"ready in 7 hours" would imply precision the model does not have. There is no hour-level copy
anywhere in the recovery UI.

## Body diagram

`MuscleDiagram` renders **front and back views side by side** — always both, with no toggle —
through our own `BodyFigure` (`src/components/BodyFigure.tsx`). The artwork is ours to edit in
`src/data/bodyFigures/`: path data copied from react-native-body-highlighter 3.1.4 (MIT, credited
under Acknowledgements → Artwork), which the app no longer depends on. The figure is male by default and female when
`profile.sex === 'female'`. It scales to the container width. There are **no tap interactions**.

### Muscle id → SVG region

20 muscle ids map onto **18** diagram regions, so the delts share a region and cannot be
distinguished visually:

| Diagram region | Muscle ids |
|----------------|------------|
| `deltoids` | `front_delts`, `side_delts`, `rear_delts` |
| `lats` / `upper-back` | `lats` / `rhomboids` |
| `chest` | `chest` |
| `neck` / `trapezius` | `neck` / `traps` |
| `biceps` / `triceps` / `forearm` | `biceps` / `triceps` / `forearms` |
| `abs` / `obliques` / `lower-back` | `abs` / `obliques` / `lower_back` |
| `quadriceps` / `hamstring` / `gluteal` / `calves` | `quads` / `hamstrings` / `glutes` / `calves` |
| `adductors` | `adductors` |
| `tibialis` | `tibialis` |

The figure draws `deltoids` on both views, so the delts are split by view
(`MUSCLE_DIAGRAM_VIEW`): front delts shade only the front figure's deltoids, rear delts only the
back figure's, and side delts both. Each figure's deltoids take the least-recovered state of the
heads on that side, so a pull day lights the rear of the shoulders and leaves the front unlit.

Lats and rhomboids shade different parts of the back figure. `lats` is the large panel down each
side of the back. Rhomboids light `upper-back`, the shoulder-blade pieces, because the figure has no
region between the blades; that area is drawn as part of the traps. Hip abductors are
glute med/min, so they stay on `glutes` / `gluteal` — the figure has no separate
abductor region. Adductors (inner thigh) are their own region. Tibialis (front of the shin) is
drawn on the front figure only, and the neck on both; neither borrows a neighbour, so a tibialis
raise lights the shin rather than the calves and neck work lights the neck rather than the traps. The per-muscle list on the
Recovery tab is where shared-region distinction stays visible.

### Colours

Discrete states, not a percentage gradient. Palette from `getRecoveryPalette()`.

| State | Token | Dark | Light |
|-------|-------|------|-------|
| Just trained | `recoveryHot` | `#FF4757` | `#DC2626` |
| In recovery | `recoveryWarm` | `#FFB020` | `#D97706` |
| Ready | `recoveryReady` | `#3DD68C` | `#059669` |
| Untrained fill | `bodyDiagramFill` | `#5A6070` | `#C8CCD8` |

The diagram has three modes:

| Mode | Used by | Colouring |
|------|---------|-----------|
| Highlight | Recovery tab (all clear) | Every region in a gradient from `recoveryReady` to `muscleHighlight` |
| Recovery | Recovery tab (active) | Just trained / recovering / every other region Ready (`regionStatesForMuscles()` → `regionStatesToBodyData()`) |
| Session | Post-workout "Good work" | That session's muscles in the just-trained colour; **every other region keeps the neutral untrained fill**, not Ready |

The diagram shows no text labels.

`BodyFigure` styling, all from the theme:

- Lit regions fade top to bottom from the palette colour at full opacity to 75%, matching the
  template-card art (`MuscleZoomArt`).
- Every unlit part takes `bodyDiagramFill`. Hands, feet, knees, ankles and the head are drawn at
  55% opacity so the muscles read first; hair takes `bodyDiagramBorder`.
- The silhouette is outlined in `bodyDiagramBorder`.

## Recovery tab

Renders, in order:

1. **Header** — title "Recovery"; subtitle is `All clear — every muscle group is ready` when
   nothing is recovering, else `Muscles still recovering from recent training`. A `help-circle`
   icon button on the right opens the **How recovery works** explainer (`RecoveryInfoModal`) —
   a dismissible modal with three points: *Tracked per muscle group* (the per-muscle timer),
   *Some recover faster* (the duration buckets) and *Reading the map* (red just trained, amber
   recovering, green ready). The bucket paragraph is generated from the duration table
   (`recoveryBucketsCopy()`), so it always lists every muscle with its real hours:
   *"Smaller muscles bounce back quicker. Neck, biceps, triceps, forearms, abs, obliques and
   tibialis are ready after 36 hours; front delts, side delts, rear delts, adductors and calves after 48 hours;
   chest, traps, lats, rhomboids, lower back, quads, hamstrings and glutes after 72 hours."*
2. **Loading** — a 220×220 circular skeleton, only before the first load of the app run.
3. **All-clear state** — the diagram with every muscle highlighted green.
4. **Active state** — the diagram (no text labels under it) with a legend (Just trained / In
   recovery / Ready), then an "In recovery" card listing one row per recovering muscle: muscle
   name on the left, `formatRecoveryReady(...)` on the right.

**"Just trained"** (`justTrainedMuscleIds()`) is the muscles whose `trainedAt` equals the maximum
`trainedAt` among active records — effectively the most recent session. If two sessions finished
at the exact same timestamp, both count.

The muscle list is **unsorted**; order follows the insertion order of `recoveryFromSessions`,
which depends on session order in storage. Rows are not sorted by readiness or muscle name.

There are no training recommendations on this screen.

## Where else recovery appears

**Workouts tab.** Recovery appears on the home screen through the Suggested cards'
**muscle art**: each card's body figure colours the template's regions in the Recovery tab's
ready / recovering / just-trained colours (see
[templates.md](templates.md#muscle-art-cards)). It also drives which templates are suggested:
`recommendTemplates()` skips any template where fewer than 50% of its muscles are ready (see
[templates.md](templates.md#suggested-templates)).

**Post-workout summary.** The "Good work" screen after finishing shows the diagram in session
mode: every muscle trained in that session (`musclesTrainedInSession()` — exercises with a
completed set, resolved with the same catalog/alias fallback as recovery) in the just-trained
colour, and the rest of the body in the neutral untrained fill.

## Assumptions

| Assumption | Consequence if revisited |
|------------|--------------------------|
| Recovery is **time only** — no load, volume, or intensity input | A 1-set and a 10-set chest session produce identical recovery |
| **Binary** state per muscle: recovering, then fully ready | No "80% recovered" concept exists in state or UI |
| One `trainedAt` per muscle, always the latest | Training a muscle twice in a day doesn't accumulate; the second session just resets the clock |
| An exercise counts if **any** set is completed | Warm-ups alone are enough to trigger recovery |
| All muscles in `Exercise.muscles[]` weighted equally | No primary/secondary split; the data to support one was flattened at build time |
| Fixed 36/48/72-hour buckets | Not personalized, not adaptive |
| Ignores sleep, nutrition, age, sex, training age | `sex` affects only the diagram figure; `age` only adjusts strength standards |
| Day-grain readiness copy | Deliberate — see [Readiness copy](#readiness-copy) |
| Rhomboids shade the shoulder-blade pieces; delts split only by view (side delts show on both) | The figure has no rhomboid or per-head delt artwork |

## Tests

Vitest (`packages/types/src/recovery.test.ts`, `muscles.test.ts`, and under `apps/mobile/src/`
`utils/recovery.test.ts`, `relativeTime.test.ts`, `muscleDiagramRegions.test.ts`,
`store/recoveryStore.test.ts`, `store/sessionsStore.test.ts`):

- `getRecoveryHoursForMuscle` for **all 20 muscles**, the table covering every muscle, 72 h default
- `getRecoveryUntil` — adds the correct hours to `trainedAt`
- 20 muscle groups exist; label formatting
- `formatRecoveryReady` — every branch: later today (including a passed deadline), tomorrow,
  weekday, month + day
- `recoveryFromSessions()` — skips in-progress sessions, skips exercises with no completed set,
  keeps the latest `completedAt` per muscle, uses `completedAt` rather than `startedAt`, and falls
  back to the bundled catalog
- `musclesTrainedInSession()` — completed exercises only, de-duplicated, same alias fallback as recovery
- `activeRecoveryAt()` — still active 1 ms before expiry, ready at the exact instant
- `justTrainedMuscleIds()` — latest `trainedAt`, ties included
- `sameRecovery()` — equal records in order; added, removed or retrained records differ
- `recoveryBuckets()` / `recoveryBucketsCopy()` — the 36/48/72 buckets and the exact explainer copy
- Diagram regions — 20 ids onto 18 regions, delts shared, lats/rhomboids, adductors, tibialis
  and neck separate, every region drawn by the figures (lats and upper back on both back views);
  `musclesOnView()` / `regionStatesByView()` keep front delts to the front figure and rear delts to the back;
  `regionStatesToBodyData()` intensities, absent regions left neutral
- `recoveryStore` — load persists, unchanged reload skips the write, a stale stored copy is
  rewritten even when memory already matches, `ensureLoaded()` computes once
  and shares an in-flight first load, later reloads keep items (no skeleton), overlapping loads
  resolve to the latest, expiry drops muscles without a recompute, the exercises-store subscription
  recomputes only once loaded
- `recentlyWorkedMuscleIds()` uses the same bundled-catalog fallback as recovery
- Recompute on delete and on saving an edit (`sessionsStore.test.ts`), sync merge (`src/sync/merge.test.ts`) and finish
  (`activeWorkoutStore.test.ts`)

Jest UI (`src/components/MuscleDiagram.test.tsx`, `src/components/BodyFigure.test.tsx`,
`src/test/ui/recovery/recovery.test.tsx`):

- `BodyFigure`: lit regions take their palette gradient and unlit muscles the neutral fill, lats and
  shoulder blades light separately on both back figures, out-of-palette intensities stay neutral,
  muted hands/feet/joints/head, hair and outline in the border colour, 200 × 400 at scale 1

- `getRecoveryPalette` mapping and the documented hex values; front + back figures; male/female
  figure; three-state recovery (with or without a just-trained subset), all-clear and session
  (neutral rest) modes; deltoids lit per side
  (rear delts on the back only); lats and rhomboids light different regions; no "Targeted" label
- Recovery tab: all-clear vs active subtitle, legend, three-state diagram, loading skeleton before
  the first load, In recovery rows in insertion order with day-grain readiness copy, re-focus drops
  expired muscles without a recompute, the explainer opens with the generated copy and closes

Not covered:

- The delete-account recompute call site (`account.tsx`). Import's recompute is covered in
  `src/storage/importData.test.ts`.
