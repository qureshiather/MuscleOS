# Testing

Where test coverage stands and what infrastructure currently exists.

**Goal:** every behavioural rule stated in a [feature spec](../features/README.md) is eventually
backed by a test. Planned testing work and its priority live in Linear; this document records only
the current state.

## Running tests

```bash
pnpm test      # Vitest across all packages, via Turbo
pnpm check     # Biome + tsc + tests — the same pipeline CI runs
```

Tests live next to the code they cover as `*.test.ts`, primarily under
`apps/mobile/src/utils/` and `packages/types/src/`.

## Current state

**27 test files.** Mostly pure-function unit tests. There is still **no React Native renderer**, so
the screens themselves and a store's live wiring (debounced persist, `AppState` listener) aren't
exercised end-to-end. The workflow *rules* those layers enforce have been pulled out into pure
modules (`activeWorkoutLogic`, `workoutFinish`, `workoutSetView`, `templatesLogic`,
`workoutNotificationCopy`) that the store, screen, and notification hook import, so the documented
behaviour is covered without a renderer.

A **lightweight harness** (`src/test/mocks/`, wired via `vitest.config.mts` aliases) swaps
`@react-native-async-storage/async-storage` for an in-memory store and `react-native` for a minimal
`AppState`/`Platform` stub. This lets the storage layer be tested against real reads/writes — see
`localStorage.activeWorkout.test.ts` for the persist/resume round-trip.

| Test file | Covers |
|-----------|--------|
| `apps/mobile/src/utils/homeStats.test.ts` | Monday-week counting, streaks, all headline branches |
| `apps/mobile/src/utils/oneRepMax.test.ts` | Epley formula, `buildExercisePRs` best-set selection |
| `apps/mobile/src/utils/recommendTemplates.test.ts` | Skipping unrecovered templates, diversification |
| `apps/mobile/src/utils/relativeTime.test.ts` | `formatRelative` and `formatRecoveryReady` basics |
| `apps/mobile/src/utils/weightUnits.test.ts` | kg/lb and cm/in conversion round-trips |
| `apps/mobile/src/utils/keypadInput.test.ts` | In-app number pad: digit append/backspace, digit caps, ± plate-step clamping |
| `apps/mobile/src/utils/exerciseSearch.test.ts` | Normalization, alias ranking, typo tolerance, abductor/adductor stems |
| `apps/mobile/src/utils/exerciseNormalize.test.ts` | Category inference, invalid-value stripping |
| `apps/mobile/src/utils/exerciseTitleCase.test.ts` | Catalog name title case, including a full-seed check |
| `apps/mobile/src/sync/catalogMerge.test.ts` | Seed overlay vs cache; delta merge by id |
| `apps/mobile/src/data/builtInTemplates.test.ts` | Folder integrity, **all built-in exercise ids exist**, Strong Lifts 5 working sets |
| `apps/mobile/src/utils/templateExercises.test.ts` | Per-exercise set/warm-up resolve, serialize, legacy `defaultSets` migrate, session→template counts |
| `apps/mobile/src/subscription/features.test.ts` | `requiresProToStart`, paywall path parsing |
| `apps/mobile/src/store/activeWorkoutLogic.test.ts` | Set-complete prefill (working sets only), add-set carry-over, best-set/previous snapshot, warm-up insert, rest-key remap, replace-exercise reset + new-exercise prefill, `reps > 0` complete rule, warm-up-skips-rest, start prefill, per-exercise start params, hydrate expired-timer discard |
| `apps/mobile/src/storage/localStorage.activeWorkout.test.ts` | Persist/resume round-trip, null clear, corrupt/invalid-payload guards (via AsyncStorage harness) |
| `apps/mobile/src/auth/deleteAccount.test.ts` | Delete-account device wipe (sessions, templates, active workout, sync transport, Apple auth code) and anonymous RevenueCat rebootstrap |
| `apps/mobile/src/auth/accountProvider.test.ts` | Linked Apple / Google / email vs leftover anonymous identity |
| `apps/mobile/src/auth/attachAccount.test.ts` | Already-linked identity → sign into that user; in-place guest upgrade vs new-device pull |
| `apps/mobile/src/auth/edgeFunctionError.test.ts` | Prefers function JSON error body over the generic non-2xx client message |
| `apps/mobile/src/utils/workoutNotificationCopy.test.ts` | "Next:" / "Continue to" / "Finish your workout" selection from the first exercise with unlogged sets |
| `apps/mobile/src/utils/workoutFinish.test.ts` | Finish save-options matrix (empty/built-in/custom × list-or-set-structure-changed), `templateListChanged`, `templateStructureChanged`, built-in can't be overwritten |
| `apps/mobile/src/utils/workoutSetView.test.ts` | Warm-up (W1…) vs working (1,2,3…) numbering, single "current" set selection |
| `apps/mobile/src/store/templatesLogic.test.ts` | `allTemplates` ordering, soft-hide toggle, built-in vs custom hidden, folder-delete keeps templates |
| `apps/mobile/src/utils/recovery.test.ts` | `recoveryFromSessions`: completed-only, latest `completedAt` per muscle |
| `packages/types/src/recovery.test.ts` | Per-muscle hours, not-natty halving, `getRecoveryUntil` |
| `packages/types/src/muscles.test.ts` | 18 muscle groups, label formatting |
| `packages/types/src/exercise.test.ts` | Category enum completeness, equipment labels |

## Coverage by feature

| Feature | Coverage | Notes |
|---------|----------|-------|
| [Workout logging](../features/workout-logging.md) | Partial | Number pad, set-logging rules (prefill, warm-up numbering, current-set, `reps > 0`, warm-up-skips-rest), rest-key remapping, replace-exercise reset + new-exercise prefill, finish save-options, best-set/previous snapshot, persist/resume round-trip, hydrate expired-timer discard, and notification copy are covered; the screen's live rendering and the debounced-persist/`AppState` wiring are not |
| [Accounts & sync](../features/accounts-and-data.md) | Partial | Unit conversion, active-workout persist/resume, linked Apple/Google/email provider resolution, already-linked identity sign-in vs in-place guest upgrade, and the Delete account local wipe + anonymous RevenueCat rebootstrap. Merge policy and live auth/sync untested |
| [Subscriptions](../features/subscriptions.md) | Partial | `requiresProToStart` and the deep-link start guard (`blockedStartFeature`) are tested; the paywall UI itself is not |
| [Recovery](../features/recovery.md) | Partial | Constants, timing, and `recoveryFromSessions` covered |
| [Templates](../features/templates.md) | Partial | Built-in integrity, per-exercise set/warm-up resolve, recommendation, `allTemplates` ordering, soft-hide, and folder-delete cascade covered; screen validation untested |
| [Exercise library](../features/exercise-library.md) | Partial | Search, title-case names, catalog merge, and normalization good; store and sync untested |
| [History & analytics](../features/history-analytics.md) | Partial | 1RM and home stats good; strength standards and volume untested |

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
