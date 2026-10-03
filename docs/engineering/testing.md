# Testing

Where test coverage stands and what infrastructure exists.

**Goal:** every behavioural rule stated in a [feature spec](../features/README.md) is backed by a
test — the rule itself as a unit test, and its wiring (what renders, what a tap does, where it
navigates) as a UI test. Each spec's **Tests** section lists what is covered and the few things that
are not.

## Running tests

```bash
pnpm test                          # Vitest then Jest in every package, via Turbo
pnpm check                         # Biome + tsc + tests — the same pipeline CI runs
pnpm --filter mobile test:unit     # Vitest only
pnpm --filter mobile test:ui       # Jest only
```

CI (`.github/workflows/ci.yml`) runs `pnpm check` on every pull request and push to `main`, so both
runners gate merges.

## Two runners

| Runner | Picks up | For |
|--------|----------|-----|
| **Vitest** (`apps/mobile/vitest.config.mts`) | `src/**/*.test.ts` | Pure logic, and stores running on the storage harness |
| **Jest** (`apps/mobile/jest.config.js`, `jest-expo/ios` preset + `@testing-library/react-native`) | `src/**/*.test.tsx` | Components and screens rendered through React Native |

**Never put a test under `app/`** — expo-router would treat it as a route. Screen tests live in
`apps/mobile/src/test/ui/<area>/`; component tests sit next to the component.

### Vitest harness

`src/test/mocks/` is wired in through `vitest.config.mts` aliases:

- `asyncStorage.ts` — in-memory AsyncStorage; `__resetAsyncStorage()` between tests.
- `reactNative.ts` — minimal `AppState`/`Platform`; `__emitAppStateChange()` delivers
  foreground/background events.
- `fakeSupabase.ts` — in-memory Supabase client (tables, RPC upsert, auth) for the sync engine and
  auth session tests.

**Store tests** run the real Zustand store on this harness. `activeWorkoutStore.test.ts` is the
pattern: `vi.mock` `@/sync` and `@/sync/catalogPull`, fake only `Date` (or use fake timers for
debounces), and re-import the store per test with `vi.resetModules()` when it holds module-level
state.

### Jest harness

- `src/test/ui/setup.ts` — global stand-ins for native modules the renderer can't load: AsyncStorage
  (official mock), Reanimated, gesture handler, safe-area context, RevenueCat, expo-notifications,
  expo-audio.
- `src/test/ui/render.tsx`:
  - `renderApp(routes, initialUrl)` mounts real screens from `app/` through expo-router
    (`expo-router/testing-library`) inside the app's providers (safe area + theme), without the root
    layout's side effects. Pass a deep-link URL to test cold-start entry.
  - `routeStub(name)` stands in for routes a test navigates to but doesn't render; assert
    navigation with `getPathname()` / `getSearchParams()`.
  - `setPro(bool)` sets the tier; `resetAppState()` clears storage, sets Basic, and marks templates
    loaded (start gates wait on templates and the tier).
- Area helpers in `src/test/ui/<area>/helpers.tsx` seed stores for that area.
- `renderRouter` switches Jest to fake timers set to the real clock. Time-dependent screen tests
  pin the clock after mounting — see `renderAt()` in `src/test/ui/history/helpers.tsx` and
  `renderAtNow()` in `src/test/ui/templates/helpers.tsx`.
- Network modules (`@/sync`, `@/lib/supabase`, sign-in) are mocked per test file.

## Coverage by area

### Templates — [templates.md](../features/templates.md)

| File | Covers |
|------|--------|
| `src/data/builtInTemplates.test.ts` | Folder integrity, every built-in exercise id exists, Strong Lifts 5 working sets |
| `src/utils/templateExercises.test.ts` | Per-exercise set/warm-up resolve, serialize, legacy `defaultSets` migrate, session→template counts |
| `src/utils/recommendTemplates.test.ts` | Scoring arithmetic, 50% cut-off, tie-break, limit, −8 overlap diversification |
| `src/utils/recentTemplates.test.ts` | Recent row: newest first, one per template, excludes Suggested/hidden/unstartable, cap 6 |
| `src/store/templatesLogic.test.ts` | `allTemplates` ordering, soft-hide, folder-delete plan (hidden templates included), menu actions, home grouping |
| `src/store/templatesStore.test.ts` | Persistence, migrations saved back, normalize-on-write, built-in hides local vs custom hides synced, folder CRUD sync calls |
| `src/utils/workoutsHome.test.ts` | Section visibility, lapsed notice, folder defaults, last done, Suggested cap and filters, start decision |
| `src/utils/templateDraft.test.ts` | Validation copy, create id/payload, edit patch, None clears folder, not-found |
| `src/utils/workoutPreview.test.ts` | Rest `m:ss`, Previous formatting and omission, entry state |
| `src/test/ui/templates/*.test.tsx` (Jest) | Home sections and menus, folder flows, create/edit template, workout preview |

### Workout logging — [workout-logging.md](../features/workout-logging.md)

| File | Covers |
|------|--------|
| `src/store/activeWorkoutLogic.test.ts` | Prefill (start and on complete), add-set carry-over, previous snapshot, warm-up insert, rest-key remap, replace reset, `reps > 0`, running-rest ±30 maths, rest end/tick, hydrate (expired rest recorded), stale close |
| `src/store/activeWorkoutStore.test.ts` | Debounced persist and coalescing, immediate background write, no write before hydration, `lastActivityAt`, stale close, one workout at a time, 1-set minimum, toggle complete, duplicate-exercise guard, rest actions |
| `src/storage/localStorage.activeWorkout.test.ts` | Persist/resume round-trip, corrupt-payload guards |
| `src/utils/workoutSetView.test.ts` | Warm-up vs working numbering, single current set, muted future sets across exercises, rest rows |
| `src/utils/keypadInput.test.ts`, `keypadInput.keys.test.ts` | Number pad digits, caps, ± steps; key handling, prefill clearing, lb→kg, Next/Done, time mode |
| `src/utils/workoutFinish.test.ts` | Save-options matrix, structure/list change, finish summary, cancel dialog meta |
| `src/utils/workoutNotificationCopy.test.ts` | Next/Continue/Finish target, tray content and titles |
| `src/utils/exercisePicker.test.ts` | Picker search with already-added exclusion |
| `src/utils/formatClock.test.ts` | Shared `m:ss` formatting |
| `src/test/ui/workout/*.test.tsx` (Jest) | Logging, Done on first tap, rest timer, set styling, deletes, finish modal, Good work, picker, resume pill, Workout-in-progress dialog |

### Recovery — [recovery.md](../features/recovery.md)

| File | Covers |
|------|--------|
| `packages/types/src/recovery.test.ts` | Hours for all 18 muscles, `getRecoveryUntil` |
| `packages/types/src/muscles.test.ts` | 18 muscle groups, labels |
| `src/utils/recovery.test.ts` | `recoveryFromSessions`, expiry instant, just-trained, recently worked, session muscles, bucket copy |
| `src/utils/muscleDiagramRegions.test.ts` | 18 muscles onto 15 regions, region states, body data |
| `src/utils/bodyCrop.test.ts` | Muscle art side choice and crop box |
| `src/store/recoveryStore.test.ts` | Load/persist, unchanged reload skips write, `ensureLoaded` once, latest load wins, exercises-store recompute |
| `src/components/MuscleDiagram.test.tsx` (Jest) | Palette, diagram modes, neutral fill on Good work |
| `src/test/ui/recovery/recovery.test.tsx` (Jest) | Recovery tab states, list order, readiness copy, re-focus expiry, explainer |

### Exercise library — [exercise-library.md](../features/exercise-library.md)

| File | Covers |
|------|--------|
| `src/data/exercises.test.ts`, `catalogSeed.test.ts` | Catalog counts and invariants, instructions in the seed, no third-party content |
| `src/sync/catalogMerge.test.ts`, `catalogPull.test.ts` | Seed reconcile, watermark selection and advance, delta merge, error path |
| `src/sync/userExercises.test.ts` | Custom exercise sync rows, tombstones, remote merge |
| `src/store/exercisesStore.test.ts`, `exerciseNotesStore.test.ts` | Store load, custom CRUD + sync, notes trim/delete, note removed with its custom |
| `src/utils/exerciseSearch.test.ts`, `exerciseSearchScoring.test.ts` | Normalization, aliases, typo tolerance, every score tier and bonus |
| `src/utils/exerciseNormalize.test.ts`, `exerciseTitleCase.test.ts`, `exerciseIds.test.ts` | Category inference, invalid equipment/muscle stripping, title case, custom ids, aliases |
| `src/utils/exerciseLibraryFilter.test.ts`, `customExerciseForm.test.ts` | Tab filters and summary, create-form validation, edit target |
| `src/test/ui/exercises/*.test.tsx` (Jest) | Exercises tab, filters, empty states, gates, create/edit exercise |

### History & analytics — [history-analytics.md](../features/history-analytics.md)

| File | Covers |
|------|--------|
| `src/utils/homeStats.test.ts` | Monday weeks, streaks, headline branches |
| `src/utils/oneRepMax.test.ts` | Epley, PR selection, alias canonicalisation, 1-dp display |
| `src/data/strengthStandards.test.ts` | Bands, next level, sex tables, unsupported exercises (pull-up has none) |
| `src/utils/sessionStats.test.ts`, `historyCards.test.ts` | Volume, duration (none under a minute), card summary, PR badges, volume deltas, week grouping, display name |
| `src/utils/calendar.test.ts` | Monday-first month grid, blanks, local day keys |
| `src/utils/personalRecords.test.ts` | PR card model, strength chip gating, progression points, search |
| `src/utils/relativeTime.test.ts` | Every `formatRelative` / `formatRecoveryReady` branch |
| `src/store/sessionsStore.test.ts` | Completed order, delete: storage, recovery recompute, previous rebuild, sync |
| `src/storage/exportData.test.ts` | Local-date export filename |
| `src/test/ui/history/*.test.tsx` (Jest) | History list/delete/refresh, monthly calendar, PRs, progression |

### Subscriptions — [subscriptions.md](../features/subscriptions.md)

| File | Covers |
|------|--------|
| `src/subscription/features.test.ts` | `requiresProToStart`, `startFromParamsDecision`, `shouldRedirectToPaywall`, `midWorkoutEditDecision`, paywall params, labels, list parity |
| `src/subscription/startPlan.test.ts` | Basic built-in plan from the template; Pro URL plan |
| `src/subscription/state.test.ts` | Expiry, legacy `free`, guest paint, `resolveSubscriptionState` branches |
| `src/subscription/paywall.test.ts`, `pricing.test.ts`, `plan.test.ts` | Price labels, savings, current-plan lines, purchase button, plans |
| `src/store/subscriptionStore.test.ts`, `src/utils/revenueCat.test.ts` | Hydrate, load paths, guest refusal, purchase/restore, restore fallback |
| `src/test/ui/subscriptions/*.test.tsx` (Jest) | Every gate-map row, deep-link starts, `useRequirePro` screens, paywall |

### Accounts & data — [accounts-and-data.md](../features/accounts-and-data.md)

| File | Covers |
|------|--------|
| `src/sync/outbox.test.ts`, `syncEngine.test.ts`, `syncStatus.test.ts` | Serialized outbox, push/pull, account switch, guest upload, debounce, status copy |
| `src/sync/merge.test.ts`, `mergePolicy.test.ts` | Conflict rules, `applyRemoteRecords`, snapshot items |
| `src/auth/*.test.ts` | Session launch and sign-out, provider resolution, attach, delete wipe, error copy, email links |
| `src/storage/localStorage.*.test.ts`, `src/store/settingsStore.test.ts` | Settings parsing and migrations, profile, serialized writes, clear-data key lists |
| `src/storage/importPlan.test.ts`, `importData.test.ts`, `importCopy.test.ts` | Parse, plan, apply, outbox only with sync on, copy |
| `src/utils/weightUnits.test.ts`, `biodata.test.ts`, `src/store/healthStore.test.ts` | Unit conversion, biodata validation and summary, BMR/TDEE |
| `src/theme/tabBarLayout.test.ts` | Tab bar sizing |
| `src/test/ui/accounts/*.test.tsx` (Jest) | Profile, Account, Data, Biodata, Settings, auth screens, `/auth-callback` |

## Known gaps

Things the current setup can't reach; each spec's **Tests** section has the detail.

- The active workout's exercise ⋯ menu positions itself with `measureInWindow`, which never calls
  back under the test renderer. Its actions are unit-tested and store-tested.
- Native integrations: Apple/Google sign-in SDKs, real store purchase sheets, sound playback,
  notification scheduling, drag-to-reorder and swipe physics.
- The root layout's boot sequence runs only in the app; its pieces are tested individually.

## Conventions

**Co-locate:** `foo.test.ts` next to `foo.ts`; screen tests under `src/test/ui/<area>/`.

**Pull rules out of screens.** If a screen decides something (a gate, a label, a grouping), put
the decision in a pure function the screen imports, unit-test it, and keep the UI test for wiring.

**Test the documented rule, not the implementation.** Specs state exact constants and formulas;
assert against those. If a test and a spec disagree, one is wrong — resolve it rather than
adjusting the test to match current behaviour.

**Inject time.** Functions that depend on the current time accept an explicit `now`; screen tests
pin the clock. Never assert against the real clock.

**Cover the boundaries that matter here:** Monday week boundaries, local-midnight day boundaries,
the exact recovery expiry instant, zero and one-rep sets, and empty session lists.

**When you fix a bug, add the test that would have caught it** — and if the bug contradicted a
spec, fix the spec too.

## Adding a feature

Per [docs/README.md](../README.md#keeping-docs-in-sync), a feature change updates its spec in the
same change. For tests:

1. Unit-test any new pure logic, and UI-test any new screen or gate.
2. If the feature adds a Pro gate, add it to the
   [gate map](../features/subscriptions.md#gate-map) and a UI test in `src/test/ui/subscriptions/`.
3. Update the [status table](../features/README.md#spec-and-test-status) and this doc.
4. If something genuinely can't be tested with this setup, say so in the spec's **Tests** section
   and under Known gaps above.
