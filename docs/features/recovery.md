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
| Tier | Basic — ungated |

## Muscle taxonomy

17 muscle groups, defined in `packages/types/src/muscles.ts`. `MuscleId` is a closed union;
every exercise maps to one or more of these.

| Region | Muscles |
|--------|---------|
| `upper_front` | `chest`, `front_delts`, `side_delts`, `abs`, `obliques` |
| `upper_back` | `rear_delts`, `traps`, `lats`, `rhomboids`, `lower_back` |
| `arms` | `biceps`, `triceps`, `forearms` |
| `lower_front` | `quads` |
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

`recoveryUntil` is **not** stored — it is derived at read time so that changing the "not natty"
setting immediately re-times every muscle.

## Recovery durations

From `packages/types/src/recovery.ts`:

| Bucket | Hours | Muscles |
|--------|------:|---------|
| Small | **36** | `abs`, `obliques`, `biceps`, `triceps`, `forearms` |
| Medium | **48** | `front_delts`, `side_delts`, `rear_delts`, `calves` |
| Large | **72** | `chest`, `traps`, `lats`, `rhomboids`, `lower_back`, `quads`, `hamstrings`, `glutes` |

`DEFAULT_RECOVERY_HOURS = 72` is the fallback for any muscle not in the table.

**"Not natty" halves everything.** `NOT_NATTY_RECOVERY_FACTOR = 0.5`, applied when the user
enables the toggle on the Profile screen ("Halves recovery time"). Biceps go 36h → 18h, chest
72h → 36h.

```ts
hours = RECOVERY_HOURS_BY_MUSCLE[muscleId] ?? DEFAULT_RECOVERY_HOURS
if (options.notNatty) hours *= NOT_NATTY_RECOVERY_FACTOR
```

`getRecoveryUntil(record)` returns `trainedAt + hours` as an ISO string.
`apps/mobile/src/utils/recoveryUntil.ts` is a thin mobile wrapper that injects the live
`notNatty` setting so callers don't have to.

A muscle is **active** (still recovering) when `getRecoveryUntil(r) > now`, compared as ISO
strings in `recoveryStore.activeRecovery()`. Once past that instant the muscle drops out of the
list entirely — there is no intermediate state.

## When recovery is recomputed

Recovery is a **derived cache**, always rebuilt from all sessions rather than incrementally
updated. `recoveryStore.load()` reads sessions, runs `recoveryFromSessions`, writes the result
to storage (`muscleos_recovery`), and sets it in memory.

| Trigger | Where |
|---------|-------|
| Recovery tab focus | `app/(tabs)/recovery.tsx` |
| Workouts tab focus | `app/(tabs)/index.tsx` |
| Finishing a workout | `src/store/activeWorkoutStore.ts` |
| Deleting a session | `src/store/sessionsStore.ts` + History screen reload |
| Cloud sync merge | `src/sync/merge.ts` |
| Settings → Sync now / Clear data | `app/settings.tsx` |

Because it is always derived, deleting a session correctly reverses its recovery impact, and
recovery is **never synced** from the server — the merge step recomputes it locally from the
merged sessions instead. The persisted copy is currently read for export; `recoveryStore.load()`
recomputes from sessions rather than using it for first paint.

Recovery is deliberately **not** loaded during app boot; the tabs that need it load it on focus.

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

`MuscleDiagram` wraps `react-native-body-highlighter` and renders **front and back views
side by side** — always both, with no toggle. The figure is male by default and female when
`profile.sex === 'female'`. It scales to the container width. There are **no tap interactions**.

### Muscle id → SVG region

17 muscle ids map onto **14** diagram regions, so some ids share a region and cannot be
distinguished visually:

| Diagram region | Muscle ids |
|----------------|------------|
| `deltoids` | `front_delts`, `side_delts`, `rear_delts` |
| `upper-back` | `lats`, `rhomboids` |
| `chest` | `chest` |
| `trapezius` | `traps` |
| `biceps` / `triceps` / `forearm` | `biceps` / `triceps` / `forearms` |
| `abs` / `obliques` / `lower-back` | `abs` / `obliques` / `lower_back` |
| `quadriceps` / `hamstring` / `gluteal` / `calves` | `quads` / `hamstrings` / `glutes` / `calves` |

Front, side, and rear delts always shade together; so do lats and rhomboids. The per-muscle
list on the Recovery tab is where that distinction stays visible.

### Colours

Discrete states, not a percentage gradient. Palette from `getRecoveryPalette()`.

| State | Token | Dark | Light |
|-------|-------|------|-------|
| Just trained | `recoveryHot` | `#FF4757` | `#DC2626` |
| In recovery | `recoveryWarm` | `#FFB020` | `#D97706` |
| Ready | `recoveryReady` | `#3DD68C` | `#059669` |
| Untrained fill | `bodyDiagramFill` | `#5A6070` | `#C8CCD8` |

The diagram uses three states when a "just trained" subset is supplied, otherwise two
(recovering / ready).

## Recovery tab

Renders, in order:

1. **Header** — title "Recovery"; subtitle is `All clear — every muscle group is ready` when
   nothing is recovering, else `Muscles still recovering from recent training`.
2. **Loading** — a 220×220 circular skeleton.
3. **All-clear state** — the diagram with every muscle highlighted green.
4. **Active state** — the diagram with a legend (Just trained / In recovery / Ready), then an
   "In recovery" card listing one row per recovering muscle: muscle name on the left,
   `formatRecoveryReady(...)` on the right.

**"Just trained"** is derived on this screen as the muscles whose `trainedAt` equals the maximum
`trainedAt` among active records — effectively the most recent session. If two sessions finished
at the exact same timestamp, both count.

The muscle list is **unsorted**; order follows the insertion order of `recoveryFromSessions`,
which depends on session order in storage. Rows are not sorted by readiness or muscle name.

There are no training recommendations on this screen.

## Where else recovery appears

**Workouts tab — "Suggested".** Recovery does not appear as a diagram or list on the home
screen, but it drives which templates are suggested: `recommendTemplates()` skips any template
where fewer than 50% of its muscles are ready. See
[templates.md](templates.md#suggested-templates).

**Post-workout summary.** The "Good work" screen after finishing shows the diagram with all
muscles trained in that session in the just-trained colour.

## Assumptions

| Assumption | Consequence if revisited |
|------------|--------------------------|
| Recovery is **time only** — no load, volume, or intensity input | A 1-set and a 10-set chest session produce identical recovery |
| **Binary** state per muscle: recovering, then fully ready | No "80% recovered" concept exists in state or UI |
| One `trainedAt` per muscle, always the latest | Training a muscle twice in a day doesn't accumulate; the second session just resets the clock |
| An exercise counts if **any** set is completed | Warm-ups alone are enough to trigger recovery |
| All muscles in `Exercise.muscles[]` weighted equally | No primary/secondary split; the data to support one was flattened at build time |
| Fixed 36/48/72-hour buckets | Not personalized, not adaptive |
| "Not natty" simply halves all durations | A single blunt multiplier rather than per-muscle modelling |
| Ignores sleep, nutrition, age, sex, training age | `sex` affects only the diagram figure; `age` is collected but unused here |
| Day-grain readiness copy | Deliberate — see [Readiness copy](#readiness-copy) |
| Delts and lats/rhomboids collapse on the diagram | A limitation of the diagram library's regions |

## Tests

Covered (`packages/types/src/recovery.test.ts`, `muscles.test.ts`,
`apps/mobile/src/utils/relativeTime.test.ts`):

- `getRecoveryHoursForMuscle` — 36/48/72 buckets, 72 default, not-natty halving
- `getRecoveryUntil` — adds the correct hours to `trainedAt`
- 17 muscle groups exist; label formatting
- `formatRecoveryReady` — "later today" and "tomorrow" branches

Not covered:

- **`recoveryFromSessions()`** — the core derivation. No test for skipping incomplete sessions,
  skipping exercises with no completed set, latest-per-muscle selection, or catalog fallback
  lookup. This is the most valuable missing test in the feature.
- `recoveryStore` load/persist round-trip, and recompute-on-delete
- `formatRecoveryReady` weekday and far-future branches
- `MuscleDiagram` state derivation and shared-region behaviour
