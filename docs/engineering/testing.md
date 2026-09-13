# Testing

Where test coverage stands, what's missing, and the order in which to close the gaps.

**Goal:** every behavioural rule stated in a [feature spec](../features/README.md) is eventually
backed by a test. We're a long way from that — this doc tracks the distance honestly so the gaps
are a known quantity rather than a surprise.

## Running tests

```bash
pnpm test      # Vitest across all packages, via Turbo
pnpm check     # Biome + tsc + tests — the same pipeline CI runs
```

Tests live next to the code they cover as `*.test.ts`, primarily under
`apps/mobile/src/utils/` and `packages/types/src/`.

## Current state

**12 test files.** All are pure-function unit tests. There are **no component tests, no store
tests, and no integration tests** — the testing setup has no React Native renderer or
AsyncStorage mock, so anything touching a store, a screen, or persistence is currently untestable
without new infrastructure.

| Test file | Covers |
|-----------|--------|
| `apps/mobile/src/utils/homeStats.test.ts` | Monday-week counting, streaks, all headline branches |
| `apps/mobile/src/utils/oneRepMax.test.ts` | Epley formula, `buildExercisePRs` best-set selection |
| `apps/mobile/src/utils/recommendTemplates.test.ts` | Skipping unrecovered templates, diversification |
| `apps/mobile/src/utils/relativeTime.test.ts` | `formatRelative` and `formatRecoveryReady` basics |
| `apps/mobile/src/utils/weightUnits.test.ts` | kg/lb and cm/in conversion round-trips |
| `apps/mobile/src/utils/exerciseSearch.test.ts` | Normalization, alias ranking, typo tolerance |
| `apps/mobile/src/utils/exerciseNormalize.test.ts` | Category inference, invalid-value stripping |
| `apps/mobile/src/data/builtInTemplates.test.ts` | Folder integrity, **all built-in exercise ids exist** |
| `apps/mobile/src/subscription/features.test.ts` | `requiresProToStart`, paywall path parsing |
| `packages/types/src/recovery.test.ts` | Per-muscle hours, not-natty halving, `getRecoveryUntil` |
| `packages/types/src/muscles.test.ts` | 17 muscle groups, label formatting |
| `packages/types/src/exercise.test.ts` | Category enum completeness, equipment labels |

## Coverage by feature

| Feature | Coverage | Notes |
|---------|----------|-------|
| [Workout logging](../features/workout-logging.md) | **None** | The core of the app, most state, most edge cases, zero tests |
| [Accounts & sync](../features/accounts-and-data.md) | **Minimal** | Unit conversion only. Merge policy and auth untested |
| [Subscriptions](../features/subscriptions.md) | Partial | The predicate is tested; **gate enforcement is not** |
| [Recovery](../features/recovery.md) | Partial | Constants and timing tested; `recoveryFromSessions` untested |
| [Templates](../features/templates.md) | Partial | Built-in integrity good; store CRUD and validation untested |
| [Exercise library](../features/exercise-library.md) | Partial | Search and normalization good; store and sync untested |
| [History & analytics](../features/history-analytics.md) | Partial | 1RM and home stats good; strength standards and volume untested |

## Priority gaps

Ordered by risk — how likely a regression is, multiplied by how much it would hurt.

### P0 — silent data loss or corruption

Bugs here lose a user's workout or their history, which is unrecoverable and unforgivable.

1. **`activeWorkoutStore` lifecycle** — start, finish, discard, and the persist/hydrate round-trip.
   A regression here loses an in-progress workout.
2. **Rest-key remapping on structural edits** — reordering, removing, or replacing an exercise
   remaps `restDurationsBetweenSets` and `restAfter` by index. Index remapping is exactly the kind
   of code that breaks quietly.
3. **Replace-exercise preserves sets** — the documented contract is that all logged sets, warm-ups,
   and rest carry over.
4. **Sync merge policy** — all five branches in `mergePolicy.ts`, especially local-wins-when-dirty
   and last-write-wins ties. A merge bug can overwrite real training history.
5. **`deleteSession` side effects** — recovery recompute and previous-map rebuild.

### P1 — revenue and correctness

6. **Gate enforcement** — assert that a Basic user hitting each entry in the
   [gate map](../features/subscriptions.md#gate-map) is redirected to the paywall. Particularly the
   `active-workout` start-from-params path, which is the deep-link and notification-tap hole.
7. **`recoveryFromSessions()`** — the derivation behind the signature feature: skipping
   incomplete sessions, requiring a completed set, latest-per-muscle, catalog fallback.
8. **`strengthStandards.ts`** — band selection, sex tables, next-level targets, and the
   unsupported-exercise path. Currently zero coverage on user-facing numbers.
9. **Set completion and prefill rules** — `reps > 0` to complete, warm-ups not starting rest,
   weight carrying to the next set only within the same set kind.

### P2 — behavioural polish

10. **`templatesStore` CRUD** — including the folder-delete cascade and the documented
    folder-not-cleared-on-edit quirk (write the test for the intended behaviour and fix it).
11. **`exercisesStore`** — seed application, cache merge, delta watermark advancement.
12. **Volume calculation** — and a decision on whether warm-up sets should count
    (see [history-analytics.md](../features/history-analytics.md#volume)).
13. **Export payload** — assert its documented contents *and* its documented omissions.
14. **Search ranking** — metadata matching, multi-token ordering, score tie-breaks.
15. **`formatRelative`** — the day/week branches and absolute-date fallback.

## What would unblock most of this

The P0 and P1 lists are mostly blocked on test infrastructure rather than on effort:

- **An AsyncStorage mock** would make every Zustand store testable. This alone unblocks items
  1, 2, 3, 5, 10, and 11 — the majority of the highest-risk gaps, and the single highest-leverage
  investment available.
- **A React Native test renderer** (`@testing-library/react-native`) would allow component and gate
  tests, unblocking item 6.
- Items 7, 8, 12, and 15 are **pure functions and need no new infrastructure** — they can be written
  today. Start there.

## Conventions

**Co-locate:** `foo.test.ts` next to `foo.ts`.

**Test the documented rule, not the implementation.** Specs state exact constants and formulas;
assert against those. If a test and a spec disagree, one is wrong — resolve it rather than
adjusting the test to match current behaviour.

**Inject time.** Functions that depend on the current time (`computeHomeStats`, `homeHeadline`,
`formatRecoveryReady`, `getRecoveryUntil`) all accept an explicit `now`. Use it; never assert
against the real clock.

**Cover the boundaries that matter here:** Monday week boundaries, local-midnight day boundaries,
the exact recovery expiry instant, zero and one-rep sets, and empty session lists.

**When you fix a bug, add the test that would have caught it** — and if the bug contradicted a
spec, fix the spec too.

## Adding a feature

Per [docs/README.md](../README.md#keeping-docs-in-sync), a feature change updates its spec in the
same change. For tests:

1. Add tests for any new pure logic — there is no infrastructure excuse for these.
2. If the feature adds a Pro gate, add it to the
   [gate map](../features/subscriptions.md#gate-map).
3. Update the [status table](../features/README.md#spec-and-test-status) and this doc's gap list.
4. If the logic isn't testable with the current setup, say so in the relevant spec's **Tests**
   section rather than leaving it silently uncovered.
