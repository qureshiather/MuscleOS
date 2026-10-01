# History & Analytics

Everything derived from finished sessions: the history list, the monthly calendar, personal
records, and progression charts.

**Nothing here is cached.** Every metric — volume, PRs, estimated 1RM, streaks — is recomputed
from the session list on read. That's why deleting a session correctly and immediately reverses
its effect everywhere, and why there is no cache to invalidate.

| | |
|--|--|
| History | `apps/mobile/app/(tabs)/history.tsx` |
| Monthly calendar | `apps/mobile/app/history-monthly.tsx` (**Pro**) |
| Personal records | `apps/mobile/app/personal-records.tsx` (**Pro**) |
| Progression | `apps/mobile/app/exercise-progression.tsx` (**Pro**) |
| 1RM & PRs | `apps/mobile/src/utils/oneRepMax.ts` |
| Strength standards | `apps/mobile/src/data/strengthStandards.ts` |
| Home stats | `apps/mobile/src/utils/homeStats.ts` |
| Volume, duration & set lines | `apps/mobile/src/utils/sessionStats.ts` |
| History card PRs, volume change, weeks | `apps/mobile/src/utils/historyCards.ts` |
| History card | `apps/mobile/src/components/history/SessionCard.tsx` |
| Store | `apps/mobile/src/store/sessionsStore.ts` |

## History list

Sessions with a `completedAt`, **newest first**, grouped under **Monday-start local week**
headers (`groupSessionsByWeek()`). **No pagination or limit**: the entire history renders in one
scroll view.

Each week header shows a label and a summary:

| Element | Detail |
|---------|--------|
| Label | `This week`, `Last week`, otherwise `Week of Sep 7` (`Week of Dec 1, 2025` for an earlier year) |
| Summary | `N sessions · <volume>`. Volume is the week's total in the user's unit, whole numbers below 10,000 (`8,240 kg`) and one decimal in thousands above (`12.1k kg`, `formatCompactVolume`). Omitted when the week has no volume |

### Session cards

Cards are **compact and expand on tap**. The newest session starts expanded; every other card
starts collapsed. Expansion is per-visit UI state and isn't persisted.

Collapsed, a card shows:

| Element | Detail |
|---------|--------|
| Date | Short weekday, short month, day: `Sun, Sep 27` |
| Trash button | Deletes the session after confirmation (see [Deleting a session](#deleting-a-session)) |
| Template name | Resolved from `templateId`; falls back to "Workout" |
| Duration · volume | `59m · 5,518 kg`. Duration is `completedAt − startedAt` to the nearest minute (`45m`, `1h 15m`, `2h`); volume is Σ `weightKg × reps` over completed sets, whole numbers in the user's unit (`formatVolume`). Either part is dropped when missing or zero |
| Volume change | `↑4%` (success colour) or `↓3%` (danger colour) against the **previous completed session of the same template** (`buildVolumeDeltas()`), rounded to a whole percent. Hidden at 0%, for the first session of a template, when either volume is zero, and for empty workouts (`_empty`) |
| Summary line | `6 exercises · 18 sets`, counting only exercises with a completed set and only completed sets, plus `· 2 PRs` when there are PRs (Pro only) |

Expanded, it adds one row per exercise with at least one completed set: the exercise name, a
**PR** badge when that exercise set a PR in this session (Pro only), and its completed sets as one
line (`formatSetGroups`):

| Sets | Line |
|------|------|
| Same weight, same reps | `3 × 8 @ 70 kg` |
| Same weight, reps differ | `10 / 10 / 9 @ 60 kg` |
| Weight changes | `8 @ 70 · 8 @ 80 · 6 @ 85 kg`, `2 × 5 @ 100 · 3 @ 110 kg` |
| Bodyweight only | `10 / 8 / 7`, `2 × 12` |
| Bodyweight and weighted | `12 BW · 2 × 8 @ 10 kg` |
| Missing reps | `? @ 60 kg` |

Only **consecutive** sets at the same displayed weight merge, so the line reads in the order the
sets were done; returning to an earlier weight starts a new group. The unit appears once, at the
end, and only when the line has a weighted set. Weights are grouped on the displayed value:
kilograms keep up to 2 decimals (`20.25`), pounds 1, and trailing zeros drop (`60`, not `60.0`).
Long lines wrap under the exercise name.

**PRs on the card** (`buildSessionPRs()`): an exercise is a PR in a session when its best
estimated 1RM there is **strictly greater** than its best in every earlier completed session. It
uses the same qualifying sets as [Personal records](#personal-records) (completed, weight > 0,
reps ≥ 1). The first session to log an exercise sets a baseline, not a PR. PR badges and counts are
part of the `personal_records` Pro feature and are hidden on Basic.

**There is no session detail screen.** All detail is inline on the card.

**Pull to refresh** reloads sessions; with a linked account it runs a cloud sync first.

The header has two Pro shortcuts: a trophy to Personal Records and a calendar to the monthly view.

### Deleting a session

The card's trash button opens the app's themed confirm dialog, **Delete workout**: *"Removes this session from history and its recovery impact. This cannot be undone."*

`deleteSession` then:

1. Removes it from stored sessions.
2. **Recomputes recovery** from the remaining sessions.
3. **Rebuilds the per-exercise "previous" map** from the remaining completed sessions — for each
   exercise, the best weighted set from the most recent qualifying session
   (`rebuildPreviousSnapshot()` in `activeWorkoutLogic.ts`).
4. Queues sync notifications for the delete and the rebuilt previous map.

PRs need no explicit step because they're derived on read.

## Monthly calendar

**Pro** (`monthly_calendar`). A 7-column month grid with `S M T W T F S` headers.

A day is marked with a filled primary-colour circle when any session's `completedAt` falls on that
**local calendar date**. Month navigation is unbounded in both directions.

Tapping a day toggles a detail card below the grid listing that day's sessions with **template
name and duration only** — no volume, sets, or exercises. Empty selection shows "No workouts this
day".

## Personal records

**Pro** (`personal_records`). Per exercise, across **all** completed sessions with no time window.

A set qualifies when the session is completed, the set is completed, `weightKg > 0`, and
`reps >= 1`.

| Metric | Definition |
|--------|------------|
| Best estimated 1RM | Highest Epley e1RM across all qualifying sets |
| Best set | The set that produced it |
| History | Every qualifying set with its e1RM, newest first |

**Only estimated 1RM is tracked as a record.** There are no separate records for heaviest weight,
best volume, or per-rep-count bests (no "best 5RM"), and no cross-exercise or global PRs.

Exercises are listed by descending best e1RM, with a name search. Each card shows the exercise,
estimated 1RM, best set, an optional strength level chip, and up to **10** bars from the most
recent qualifying sets. Tapping a card opens the progression chart.

**PRs are not detected live during a workout** — nothing announces a new record mid-session. The
active workout's PREVIOUS column shows the best weighted set from the most recent qualifying
session, not an all-time best or e1RM.

`ExercisePR` is defined locally in `oneRepMax.ts`, not in `packages/types`.

## Estimated 1RM

**Epley only.** No Brzycki, no formula setting.

```ts
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0) return 0;
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
```

| Rule | Behaviour |
|------|-----------|
| 1 rep | Returns the weight exactly |
| 0 reps or non-positive weight | Returns 0 (excluded from PRs) |
| High-rep ceiling | **None** — a 30-rep set produces a 2× estimate and is treated as valid |
| Rounding | None in the calculation; display rounds to 1 decimal |
| Units | Computed in kg; converted for display only |

The missing rep ceiling is a known weakness: a high-rep set can produce an implausible estimate
that then becomes the displayed PR.

## Strength standards

Compares your estimated 1RM to bodyweight-ratio bands. Source, per the code comment: ExRx.net and
common powerlifting/weightlifting classifications, for adult lifters over 18 with **no age
adjustment**.

Levels: `untrained` · `novice` · `intermediate` · `advanced` · `elite` (there is no "beginner").

Your level is the highest band whose ratio threshold `e1RM / bodyweightKg` meets or exceeds,
scanning from elite down. The next level's target is `bodyweightKg × nextRatio`.

**Requires both `weightKg` and `sex` on the profile.** Without them the PR screen shows a hint
linking to Biodata. Female tables are roughly 60–70% of the male values.

Supported exercises: `bench-press`, `close-grip-bench`, `squat`, `deadlift`,
`romanian-deadlift`, `overhead-press`, `barbell-row`. Anything else reports `hasStandards: false`
and no level. `pull-up` has a table but all its ratios are `0.0`, so it is effectively disabled —
bodyweight ratio isn't a meaningful measure for it.

## Exercise progression

**Pro** (`exercise_progression`). Plots **estimated 1RM per qualifying set** over time, oldest to
newest, as custom `View` bars (no chart library). Bar height is the ratio to the best e1RM.

**One bar per qualifying set, not per session** — several sets on one day give several adjacent
bars, and days without qualifying sets simply have no bar rather than a zero or a gap. There is
**no time-range selector**; the full history is always shown.

Below the chart, "All recorded sets" lists date, `weight × reps`, and `~e1RM`, newest first.

> `src/components/WorkoutHistoryChart.tsx` is an SVG chart of workout count per day that is **not
> imported anywhere** — dead code.

## Home stats

`computeHomeStats()` powers the Workouts tab headline. Full copy table:
[templates.md](templates.md#home-headline).

| Field | Rule |
|-------|------|
| `sessionsThisWeek` | Completed sessions in the current **Monday-start local** week |
| `weekStreak` | Consecutive Monday-start weeks with ≥1 session, counting back from the current week if it has one, else from the previous week |
| `trainedToday` | Any session completed on today's local date |
| `lastCompletedAt` | Most recent completion |

The streak is **week-based, not consecutive-day**, and starting from the previous week when the
current one is empty is what stops a streak appearing to break every Monday.

No weekly volume, rep count, or duration is computed here.

## Volume

Volume is computed only on the History tab (session cards, week headers, and the volume change),
always via `sessionVolumeKg()`:

```ts
for (const se of session.exercises)
  for (const set of se.sets) {
    if (!set.completed) continue;
    total += (set.weightKg ?? 0) * (set.reps ?? 0);
  }
```

Completed sets only. **`isWarmUp` is not checked**, so completed warm-up sets count toward volume.
That is the implemented behaviour; whether it is desirable remains an open product question.
Warm-ups are excluded from nothing else except the rest timer.

Sets with no reps contribute zero.

## Relative time

`formatRelative()` in `src/utils/relativeTime.ts`:

| Age | Output |
|-----|--------|
| < 1 min | `Just now` |
| < 1 hour | `N min ago` |
| < 1 day | `1 hour ago` / `N hours ago` |
| < 7 days | `1 day ago` / `N days ago` |
| < 4 weeks | `1 week ago` / `N weeks ago` |
| Older | Locale date string |

Used for template "last done", the Recent row, and sync status. `formatRecoveryReady()` lives in
the same file but belongs to [recovery.md](recovery.md#readiness-copy).

## Export

Reached from **Profile → Account → Data → Export my data** (not from these screens). Basic tier. Writes
pretty-printed JSON named `muscleos-export-YYYY-MM-DD.json` and hands it to the share sheet.

Contents and known omissions: [accounts-and-data.md](accounts-and-data.md#export).

## Pro gates

| Screen / action | Gate key |
|-----------------|----------|
| Personal records (trophy button, screen) | `personal_records` |
| PR badges and PR counts on history cards | `personal_records` (hidden, not paywalled) |
| Monthly calendar (calendar button, screen) | `monthly_calendar` |
| Exercise progression (PR card tap, screen) | `exercise_progression` |

Basic keeps the history list, inline session detail, delete, pull-to-refresh, and JSON export.

## Assumptions

| Assumption | Note |
|------------|------|
| All metrics derived on read | No PR or volume cache anywhere |
| Epley is the only 1RM formula | Not configurable |
| No high-rep ceiling on 1RM estimates | Known weakness; high-rep sets can produce inflated PRs |
| PR = best estimated 1RM | Not heaviest weight, not volume, not per-rep bests |
| Strength standards use **estimated**, not tested, 1RM | And assume adult, no age bands |
| Warm-up sets count toward volume | Open question |
| Local calendar days for history and calendar bucketing | Same as the rest of the app |
| ISO date strings sort correctly for ordering | Relies on UTC ISO from `toISOString()` |
| Unbounded history list | No pagination; assumes hobbyist-scale history |

## Tests

Covered:

- `src/utils/oneRepMax.test.ts` — Epley at 1 rep and 5 reps, zero cases; `buildExercisePRs` picks
  the best e1RM set (85×5 over 90×1) and returns history newest-first
- `src/utils/homeStats.test.ts` — Monday-week counting, `trainedToday`, `lastCompletedAt`, streak
  surviving an empty current week, streak breaking on a missed week, every headline branch
- `src/utils/relativeTime.test.ts` — every `formatRelative` branch, including the absolute-date
  fallback at 4 weeks
- `src/subscription/features.test.ts` — paywall param parsing including `personal_records`
- `src/data/strengthStandards.test.ts` — band selection from elite down, next-level target,
  elite has no next level, female vs male tables, unsupported exercises, the disabled pull-up table,
  zero bodyweight
- `src/utils/sessionStats.test.ts` — volume over completed sets with warm-ups included and missing
  weight/reps as zero; duration formatting and rounding; `formatSetGroups` (collapsing, weight
  changes, consecutive-only merging, bodyweight and `BW`, pounds, missing reps); `formatVolume` and
  `formatCompactVolume` in kg and lb
- `src/utils/historyCards.test.ts` — card PRs (strictly greater e1RM than all earlier sessions,
  first session is a baseline, ties aren't PRs, bodyweight/incomplete/in-progress ignored); volume
  change vs the previous session of the same template, skipping empty workouts and zero volume;
  Monday-start week buckets, labels, and week volume
- `src/store/activeWorkoutLogic.test.ts` — `rebuildPreviousSnapshot`: most recent qualifying
  session, not the all-time best; skips sessions with no completed weighted set and in-progress ones

Not covered:

- `deleteSession` store wiring (storage writes and sync notifications around the tested rebuild)
- Monthly calendar grid construction, day marking, month navigation
- PR and progression screen rendering, e1RM tie-breaking, the 10-bar window
- Export payload assembly
