# Testing

Test infrastructure and conventions. **What is covered lives in each feature spec's Tests
section** — this doc doesn't repeat it.

**Goal:** every behavioural rule stated in a [feature spec](../features/README.md) is backed by a
test — the rule itself as a unit test, and its wiring (what renders, what a tap does, where it
navigates) as a UI test.

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

`src/test/vitestSetup.ts` (`setupFiles`) installs the [console guard](#conventions).
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

- `src/test/ui/setup.ts` (`setupFilesAfterEnv`) — global stand-ins for native modules the renderer
  can't load: AsyncStorage (official mock), Reanimated, gesture handler, safe-area context,
  expo-notifications, expo-audio — and the [console guard](#conventions).
- `jest.config.js` resolves two packages the way Metro does: `react-native-draggable-flatlist` from
  its TS source (the prebuilt build triggers React's "outdated JSX transform" warning) and
  `punycode` to the npm package expo's URL polyfill depends on (not Node's deprecated core module).
  `watchman: false` keeps local watchman warnings out of the output.
- `src/test/ui/render.tsx`:
  - `renderApp(routes, initialUrl)` mounts real screens from `app/` through expo-router
    (`expo-router/testing-library`) inside the app's providers (safe area + theme), without the root
    layout's side effects. Pass a deep-link URL to test cold-start entry.
  - `routeStub(name)` stands in for routes a test navigates to but doesn't render; assert
    navigation with `getPathname()` / `getSearchParams()`.
  - `resetAppState()` clears storage and marks templates loaded (starting from route params waits
    on templates).
- Area helpers in `src/test/ui/<area>/helpers.tsx` seed stores for that area.
- `src/test/ui/harness.test.tsx` checks the harness itself: a real screen renders through the
  router inside the app's providers.
- `renderRouter` switches Jest to fake timers set to the real clock. Time-dependent screen tests
  pin the clock after mounting — see `renderAt()` in `src/test/ui/history/helpers.tsx` and
  `renderAtNow()` in `src/test/ui/templates/helpers.tsx`.
- Network modules (`@/sync`, `@/lib/supabase`, sign-in) are mocked per test file.

## Convention guards

`src/theme/noHardcodedColors.test.ts` fails on any hex or rgba literal in `app/` or
`src/components/`; colours come from `useTheme().colors`
([theming](../features/accounts-and-data.md#theming)).

## Known gaps

Things the current setup can't reach; each spec's **Tests** section has the detail.

- The active workout's exercise ⋯ menu positions itself with `measureInWindow`, which never calls
  back under the test renderer. Its actions are unit-tested and store-tested.
- Native integrations: Apple/Google sign-in SDKs, sound playback,
  notification scheduling, drag-to-reorder and swipe physics.
- The root layout's boot sequence runs only in the app; its pieces are tested individually.
- Rendered exercise demos (Blender output) aren't asserted on; review them with
  `build-exercise-animations.mjs --check` and by watching the clips.

## Conventions

**Tests run without console noise.** `src/test/consoleGuard.ts`, installed by both runners' setup,
fails a test that writes an unexpected `console.error` or `console.warn` — React `act(...)`
warnings, app `__DEV__` logging, library deprecations. Fix the cause: wrap updates in `act` (including
`Alert` button handlers a test calls directly), `await` `findBy*`/`waitFor`, unmount before
restoring state a mounted screen subscribes to. When a test deliberately drives a path that logs
(a failed sync, export, or delete), spy on the console in that test —
`jest.spyOn(console, 'warn').mockImplementation(() => undefined)` / `vi.spyOn(...)` — assert the
call, and restore it. Never silence the console globally; the guard's allowlist is only for
unavoidable third-party lines, each documented where it's added (it is empty today).

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

1. Unit-test any new pure logic, and UI-test any new screen.
2. List the new test files in the spec's **Tests** section.
3. If something genuinely can't be tested with this setup, say so in the spec's **Tests** section
   and under Known gaps above.
