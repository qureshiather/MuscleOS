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

**15 test files.** All are pure-function unit tests. There are **no component tests, no store
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
| `apps/mobile/src/utils/keypadInput.test.ts` | In-app number pad: digit append/backspace, digit caps, ± plate-step clamping |
| `apps/mobile/src/utils/exerciseSearch.test.ts` | Normalization, alias ranking, typo tolerance |
| `apps/mobile/src/utils/exerciseNormalize.test.ts` | Category inference, invalid-value stripping |
| `apps/mobile/src/utils/exerciseTitleCase.test.ts` | Catalog name title case, including a full-seed check |
| `apps/mobile/src/sync/catalogMerge.test.ts` | Seed overlay vs cache; delta merge by id |
| `apps/mobile/src/data/builtInTemplates.test.ts` | Folder integrity, **all built-in exercise ids exist** |
| `apps/mobile/src/subscription/features.test.ts` | `requiresProToStart`, paywall path parsing |
| `packages/types/src/recovery.test.ts` | Per-muscle hours, not-natty halving, `getRecoveryUntil` |
| `packages/types/src/muscles.test.ts` | 17 muscle groups, label formatting |
| `packages/types/src/exercise.test.ts` | Category enum completeness, equipment labels |

## Coverage by feature

| Feature | Coverage | Notes |
|---------|----------|-------|
| [Workout logging](../features/workout-logging.md) | **Minimal** | Only the in-app number pad's entry logic (`keypadInput`) is covered; the store, screen, and set rules have zero tests |
| [Accounts & sync](../features/accounts-and-data.md) | **Minimal** | Unit conversion only. Merge policy and auth untested |
| [Subscriptions](../features/subscriptions.md) | Partial | The predicate is tested; **gate enforcement is not** |
| [Recovery](../features/recovery.md) | Partial | Constants and timing tested; `recoveryFromSessions` untested |
| [Templates](../features/templates.md) | Partial | Built-in integrity good; store CRUD and validation untested |
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
