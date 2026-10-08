# History & Analytics

Everything derived from finished sessions: the history list, the monthly calendar, personal
records, and progression charts.

**Nothing here is cached.** Every metric — volume, PRs, estimated 1RM, streaks — is recomputed
from the session list on read. That's why deleting a session correctly and immediately reverses
its effect everywhere, and why there is no cache to invalidate.

| | |
|--|--|
| History | `apps/mobile/app/(tabs)/history.tsx` |
| Monthly calendar | `apps/mobile/app/history-monthly.tsx` |
| Personal records | `apps/mobile/app/personal-records.tsx` |
| Progression | `apps/mobile/app/exercise-progression.tsx` |
| 1RM & PRs | `apps/mobile/src/utils/oneRepMax.ts` |
| Strength standards | `apps/mobile/src/data/strengthStandards.ts`, `src/data/ageCoefficients.ts` |
| Volume, duration & set lines | `apps/mobile/src/utils/sessionStats.ts` |
| History card summary, PRs, volume change, weeks, names | `apps/mobile/src/utils/historyCards.ts` |
| Calendar grid & day keys | `apps/mobile/src/utils/calendar.ts` |
| PR card & progression models | `apps/mobile/src/utils/personalRecords.ts` |
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
| Summary | `N sessions · <volume>` (`1 session` in the singular, `weekSummary()`). Volume is the week's total in the user's unit, whole numbers below 10,000 (`8,240 kg`) and one decimal in thousands above (`12.1k kg`, `formatCompactVolume`). Omitted when the week has no volume |

### Session cards

Cards are **compact and expand on tap**. The newest session starts expanded; every other card
starts collapsed. Expansion is per-visit UI state and isn't persisted.

Collapsed, a card shows:

| Element | Detail |
|---------|--------|
| Date | Short weekday, short month, day: `Sun, Sep 27` |
| Trash button | Deletes the session after confirmation (see [Deleting a session](#deleting-a-session)) |
| Template name | Resolved from `templateId`; `Empty workout` for ad-hoc sessions (`_empty`); falls back to "Workout" when the template no longer exists (`templateDisplayName()`, also used by the calendar and the post-workout screen) |
| Duration · volume | `59m · 5,518 kg`. Duration is `completedAt − startedAt` to the nearest minute (`45m`, `1h 15m`, `2h`); volume is Σ `weightKg × reps` over completed sets, whole numbers in the user's unit (`formatVolume`). Either part is dropped when missing or zero; a session under one minute has no duration (never `0m`) |
| Volume change | `↑4%` (success colour) or `↓3%` (danger colour) against the **previous completed session of the same template** (`buildVolumeDeltas()`), rounded to a whole percent. Hidden at 0%, for the first session of a template, when either volume is zero, and for empty workouts (`_empty`) |
| Summary line | `6 exercises · 18 sets`, counting only exercises with a completed set and only completed sets, plus `· 2 PRs` when there are PRs |

Expanded, it adds one row per exercise with at least one completed set: the exercise name, a
**PR** badge when that exercise set a PR in this session, and its completed sets as one
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
reps ≥ 1). The first session to log an exercise sets a baseline, not a PR. Exercises are compared
by **canonical id**: a session logged under a legacy catalog alias competes with the current
exercise.

**There is no session detail screen.** All detail is inline on the card.

**Empty state.** With no completed sessions the list shows **No sessions yet** — *"Finish a
workout and it will show up here with duration, volume, and sets."*

**Pull to refresh** reloads sessions, including from the empty state; with a linked account it
runs a cloud sync first.

The header has two shortcuts: a trophy to Personal Records and a calendar to the monthly view.

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

A 7-column month grid, weeks starting **Monday** like the History
week groups: `M T W T F S S` headers, blanks before the 1st and after the last day so every row
is full (`monthGrid()`). It opens on the current month.

A day is marked with a filled primary-colour circle when any session's `completedAt` falls on that
**local calendar date**. Month navigation is unbounded in both directions.

Tapping a day toggles a detail card below the grid listing that day's sessions with **template
name and duration only** — no volume, sets, or exercises. Names follow the History list
(including `Empty workout`); duration uses the same formatting and is omitted under a minute.
Empty selection shows "No workouts this day". Changing month clears the selection.

## Personal records

Per exercise, across **all** completed sessions with no time window.

A set qualifies when the session is completed, the set is completed, `weightKg > 0`, and
`reps >= 1`. Warm-ups qualify like any other set.

| Metric | Definition |
|--------|------------|
| Best estimated 1RM | Highest Epley e1RM across all qualifying sets |
| Best set | The set that produced it |
| History | Every qualifying set with its e1RM, newest first |

**Only estimated 1RM is tracked as a record.** There are no separate records for heaviest weight,
best volume, or per-rep-count bests (no "best 5RM"), and no cross-exercise or global PRs.

Exercises are keyed by **canonical id**, so sets logged under a legacy catalog alias merge into
the current exercise. On an e1RM tie the best set is the most recent one.

Exercises are listed by descending best e1RM, with a name search (*"No exercises match
“…”"* when nothing matches). Each card (`prCardModel()`) shows:

| Element | Detail |
|---------|--------|
| Est. 1RM | Best e1RM, one decimal in the user's unit (`116.7 kg`, `formatE1RM()`) |
| Best set | `100 kg × 5` |
| Strength chip | `Novice → Intermediate @ 140 kg` — only with bodyweight **and** sex on the profile and only for exercises with standards |
| Progress bars | The **10 most recent** qualifying sets, **oldest → newest** left to right like the progression chart, each bar's height its ratio to the best e1RM. Shown only with **2 or more** qualifying sets |

Without bodyweight or sex a hint above the list — *"Add weight & gender in Biodata for strength
level comparison"* — opens Biodata. With no records at all the screen shows **No records yet** —
*"Log weight and reps in a workout to see estimated 1RM and best sets here."* Tapping a card
opens the progression chart.

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
common powerlifting/weightlifting classifications. The tables describe a lifter in their prime
(23–40); with an age on the profile they're [age-adjusted](#age-adjustment).

Levels: `untrained` · `novice` · `intermediate` · `advanced` · `elite` (there is no "beginner").

Your level is the highest band whose ratio threshold `e1RM / bodyweightKg` meets or exceeds,
scanning from elite down. The next level's target is `bodyweightKg × nextRatio`.

**Requires both `weightKg` and `sex` on the profile; `age` is optional.** Without weight or sex the
PR screen shows a hint linking to Biodata. Female tables are roughly 60–70% of the male values.

Supported exercises: `bench-press`, `close-grip-bench`, `squat`, `deadlift`,
`romanian-deadlift`, `overhead-press`, `barbell-row`. Anything else — including `pull-up`, where a
bodyweight ratio isn't a meaningful measure — reports `hasStandards: false`: no level, no chip,
no strength card.

### Age adjustment

With an `age` on the profile, every threshold is divided by that age's powerlifting coefficient
(`ageCoefficient()` in `src/data/ageCoefficients.ts`), so the e1RM needed for each level — and the
next-level target — drops for teens and masters lifters. Without an age the tables apply unchanged.

| Age | Coefficient | Source |
|-----|-------------|--------|
| Under 14 | — | No published standard: **no strength level is shown** |
| 14–22 | 1.23 at 14, down to 1.01 at 22 | Foster |
| 23–40 | 1 (no change) | — |
| 41–80 | 1.01 at 41, rising to 2.05 at 80 (e.g. 1.13 at 50, 1.34 at 60) | McCulloch, corrected against the WPC Glossbrenner masters table |
| 81–90 | 2.096 at 81 to 2.549 at 90 | USAPL |
| Over 90 | 2.549 (the age-90 value) | — |

Ages are whole years. The values were compiled from OpenPowerlifting's coefficient table, which
cites each source; the full per-year table is in the code. When the thresholds were adjusted, the
progression screen's strength card adds **Adjusted for age N** (`strengthAgeNote()`); the PR
card's chip just uses the adjusted level and target.

## Exercise progression

Opened from a Personal Records card, or from **View history** in the
[exercise detail sheet](exercise-library.md) (shown only when the exercise has history). Plots **estimated 1RM per qualifying set** over time, oldest to
newest, as custom `View` bars (no chart library). Bar height is the ratio to the best e1RM.

**One bar per qualifying set, not per session** — several sets on one day give several adjacent
bars, and days without qualifying sets simply have no bar rather than a zero or a gap. There is
**no time-range selector**; the full history is always shown. Bars share the width equally, so a
long history narrows them rather than overflowing. A single date axis under the chart shows the
first and last dates (one date when they're the same day); each bar's accessibility label carries
its date and e1RM.

Above the chart, a card shows the best e1RM (one decimal) and best set, and — with bodyweight and
sex on the profile, for an exercise with standards — a strength card: **Strength level: Novice**
and *Next (Intermediate): 140 kg*, plus *Adjusted for age 60* when age changed the thresholds. Below the chart, "All recorded sets" lists date,
`weight × reps`, and `~e1RM` (one decimal), newest first. The screen resolves its `exerciseId`
through aliases, so an alias link shows the canonical exercise with every set logged under either
id; an unknown id shows *"No progression data for this exercise."*

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

Completed sets only, warm-ups included
([overview](../product/overview.md#cross-cutting-assumptions)). Sets with no reps contribute zero.

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

## Assumptions

| Assumption | Note |
|------------|------|
| All metrics derived on read | No PR or volume cache anywhere |
| Epley is the only 1RM formula | Not configurable |
| No high-rep ceiling on 1RM estimates | Known weakness; high-rep sets can produce inflated PRs |
| PR = best estimated 1RM | Not heaviest weight, not volume, not per-rep bests |
| Strength standards use **estimated**, not tested, 1RM | Age-adjusted by powerlifting coefficients, which were built for competition totals, not single lifts |
| Warm-up sets count toward volume and PRs | Like every derived metric; see [overview](../product/overview.md#cross-cutting-assumptions) |
| Local calendar days for history and calendar bucketing | Same as the rest of the app |
| ISO date strings sort correctly for ordering | Relies on UTC ISO from `toISOString()` |
| Unbounded history list | No pagination; assumes hobbyist-scale history |

## Tests

Vitest (`apps/mobile/src/…`):

- `utils/oneRepMax.test.ts` — Epley at 1 and 5 reps, zero/negative cases, no high-rep ceiling, no
  rounding; `formatE1RM` one decimal in kg and lb; `buildExercisePRs` qualifying sets, best set
  (85×5 over 90×1), descending order, tie → newest, alias merge, history newest first
- `utils/personalRecords.test.ts` — `progressionPoints` oldest-first with capped ratios;
  `prCardModel` last-10 bars oldest→newest, no bars under 2 sets, strength chip gated on
  bodyweight + sex and standards (none for pull-up), age-adjusted level and `strengthAgeNote`,
  none under 14, elite has no next level; `filterPRsByName`;
  `exerciseHasHistory` qualifying sets only, completed sessions only, aliases
- `utils/calendar.test.ts` — Monday-first headers, leading/trailing blanks, month lengths incl.
  leap February, four-row month, local-midnight day keys, marked days, sessions on a day
- `utils/historyCards.test.ts` — card PRs (strictly greater, baseline, ties, ignored sets, alias
  canonicalisation); volume change vs the same template; Monday-start weeks and labels;
  `templateDisplayName`; `isCardExpanded`; `sessionCardSummary` (counts, singulars, PR label,
  stats line dropping zero volume and sub-minute duration, pounds); `volumeDeltaLabel` hidden at
  0%; `weekSummary` singular and compact volume
- `utils/sessionStats.test.ts` — volume, duration (incl. null under a minute), set lines, volume labels
- `utils/relativeTime.test.ts` — every `formatRelative` branch (home stats are tested under
  [templates](templates.md#tests))
- `data/strengthStandards.test.ts` — band selection, next-level target, sex tables, unsupported
  exercises and pull-up reporting `hasStandards: false`; age adjustment (unchanged without an age
  or at 23–40, thresholds ÷ coefficient for teens and masters, exact boundary, none under 14)
- `data/ageCoefficients.test.ts` — none under 14, Foster 14–22, 1 for 23–40, McCulloch 41–80,
  USAPL 81–90 then held, monotonic, whole years
- `store/sessionsStore.test.ts` — `completedSessions()` filter and order; `deleteSession` storage
  removal, recovery recompute, previous-map rebuild, sync notifications, unknown id no-op
- `store/activeWorkoutLogic.test.ts` — `rebuildPreviousSnapshot`

Jest UI (`apps/mobile/src/test/ui/history/`):

- `history.test.tsx` — week headers and summaries, card names (incl. Empty workout), date, stats
  line and volume change, newest expanded + toggling, PR badges/counts,
  alias PRs, header shortcuts to Personal Records and the calendar, delete flow (cancel,
  confirm, storage, recovery, sync), empty-state copy, pull to refresh from empty (guest reload,
  linked sync first), pounds
- `monthly.test.tsx` — Monday-first grid, local-date day marking, day detail
  toggle with name + duration only, No workouts this day, month navigation
- `records.test.tsx` — empty state, e1RM order with 1-dp values, 10-bar window and the
  2-set condition, search and no-match copy, Biodata hint, strength chips (none for pull-up), card
  → progression; progression per-set bars oldest→newest, sets list, strength card (and its
  age-adjusted level, target and note), alias id, unknown id
