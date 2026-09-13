# MuscleOS — Agent Guide

This document helps AI agents and future prompts work effectively with the MuscleOS codebase.

## Project Overview

**MuscleOS** is a strength-training log built with Expo (React Native), plus a Next.js landing page. Pick a workout, log sets with a rest timer, and the app shows what you lifted last time and which muscles are still recovering. Everything else — recovery map, history, PRs, progression — is a view over the sessions that loop produces.

## Read the specs first

[`docs/`](docs/) is the **source of truth for what the app does**. Before changing behaviour in a feature area, read its spec — it documents the exact rules, constants, and product assumptions, which are frequently non-obvious and easy to break.

| Start with | For |
|------------|-----|
| [`docs/README.md`](docs/README.md) | Doc index and the rules for keeping specs in sync |
| [`docs/product/overview.md`](docs/product/overview.md) | What the app is, design principles, screen map, cross-cutting assumptions |
| [`docs/features/README.md`](docs/features/README.md) | Feature index, Basic/Pro tier matrix, spec + test status |
| [`docs/engineering/testing.md`](docs/engineering/testing.md) | Test coverage, gaps, and priority order |

**Feature specs:** [templates](docs/features/templates.md) · [workout-logging](docs/features/workout-logging.md) · [recovery](docs/features/recovery.md) · [exercise-library](docs/features/exercise-library.md) · [history-analytics](docs/features/history-analytics.md) · [subscriptions](docs/features/subscriptions.md) · [accounts-and-data](docs/features/accounts-and-data.md)

### Keep the spec matching the feature set

Docs rot silently, so treat them as part of the change rather than follow-up work.

1. **Update the feature's spec in the same change** whenever you alter a user-visible behaviour or copy, a default/constant/threshold/formula, a domain type in `packages/types`, a tier or Pro gate, or a storage key or its sync status.
2. **New Pro gate → add it to the [gate map](docs/features/subscriptions.md#gate-map).** It's meant to be exhaustive; an unlisted gate is how customers find holes in the paywall.
3. **New feature → add it to the [feature index](docs/features/README.md#index)** and record its test status.
4. **Edit, don't append.** These are specs describing the current app, not a changelog. Git history is the changelog.
5. **If code and spec disagree, that's a bug.** Fix it rather than working around it, and say which one you treated as correct.
6. **Add tests for new pure logic.** No test infrastructure is required for pure functions, so there's no excuse for skipping them. If something genuinely isn't testable with the current setup, note it in that spec's **Tests** section instead of leaving it silently uncovered.

Do not add spec READMEs under `apps/` or other code directories — all specs live in `docs/`.

---

## Monorepo Structure

```
MuscleOS/
├── apps/
│   ├── mobile/      # Expo React Native app (main product)
│   └── landing/     # Next.js marketing site (privacy, terms)
├── docs/            # Product & engineering specs (source of truth)
├── packages/
│   └── types/       # @muscleos/types — shared TypeScript types & domain models
├── package.json     # Root: pnpm workspaces + Turbo
├── pnpm-workspace.yaml
└── turbo.json
```

- **Package manager**: pnpm (v9.14.2)
- **Build orchestration**: Turborepo
- **Node**: >=20

### Key Commands

| Command | Description |
|--------|-------------|
| `pnpm dev` | Start all dev servers (mobile + landing) |
| `pnpm dev:landing` | Start landing only on port 3001 |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint all packages with Biome |
| `pnpm test` | Run unit/regression tests |
| `pnpm check` | Lint + typecheck + test (CI) |
| `pnpm clean` | Clean build artifacts and node_modules |

### Mobile Dev (Expo)

- `cd apps/mobile && pnpm dev` — Expo dev server
- With MCP: `EXPO_UNSTABLE_MCP_SERVER=1 npx expo start`
- Login: `pnpx expo login` (see README for credentials)

---

## Tech Stack

| Area | Stack |
|------|-------|
| Mobile | Expo 54, React Native 0.81, expo-router, React 19 |
| Mobile state | Zustand |
| Mobile storage | AsyncStorage (all app data, and the Supabase auth session) |
| Types | Shared `@muscleos/types` package |
| Lint | Biome (ESLint replacement) |
| Tests | Vitest, run via Turbo |
| Landing | Next.js 15, React 19, Tailwind CSS |

---

## Conventions & Patterns

### 1. Shared Types (`packages/types`)

- All domain models live in `@muscleos/types`: `Exercise` (includes `category`), `WorkoutTemplate`, `WorkoutSession`, `MuscleRecovery`, `MuscleId`, etc.
- **Always import types from `@muscleos/types`** — do not duplicate type definitions in the mobile app.
- Build: `tsup` produces `dist/` with CJS + `.d.ts`.

### 2. Mobile App Structure (`apps/mobile`)

```
apps/mobile/
├── app/                    # expo-router file-based routing
│   ├── _layout.tsx         # Root layout (providers, global load)
│   ├── (tabs)/             # Tab navigator (index, recovery, exercises, history, profile)
│   ├── active-workout.tsx  # In-progress workout screen
│   ├── auth*.tsx           # Auth flows
│   ├── create-template.tsx
│   ├── workout-preview.tsx
│   └── ...
├── src/
│   ├── components/         # Reusable UI (MuscleDiagram, etc.)
│   ├── data/               # Static data (exercises, builtInTemplates)
│   ├── storage/            # AsyncStorage wrappers + keys
│   ├── store/              # Zustand stores (authStore, templatesStore, etc.)
│   ├── theme/              # ThemeProvider, useTheme, colors
│   └── utils/              # Helpers (weightUnits, relativeTime, etc.)
└── assets/
```

### 3. Path Aliases

- `@/*` → `./src/*` (configured in `tsconfig.json`)
- Use `@/store/authStore`, `@/components/MuscleDiagram`, `@/theme/ThemeContext`, etc.

### 4. State Management (Zustand)

- Stores live in `src/store/`.
- Pattern: `create<State>((set, get) => ({ ... }))` with async actions that call storage and then `set()`.
- Load app-wide data in root layout `useEffect` where needed (e.g. `loadSubscription`, `loadSettings`).

### 5. Storage

- Keys defined in `src/storage/keys.ts` (e.g. `muscleos_templates`).
- `src/storage/localStorage.ts` — AsyncStorage wrappers for all app data (templates, sessions, recovery, settings, etc.).
- The Supabase auth session also persists via AsyncStorage (`src/lib/supabase.ts`). `expo-secure-store` is installed but **no code currently uses it**.
- Full key inventory, and which keys are cloud-synced vs local-only: [`docs/features/accounts-and-data.md`](docs/features/accounts-and-data.md#storage).

### 6. Theming

- `ThemeProvider` + `useTheme()` — provides `colors` and `isDark`.
- **Palette config**: edit hex values in `apps/mobile/src/theme/palette.ts` (`paletteConfig`). Derived tokens (`primarySurface`, `primaryBorder`, `successSurface`, table/row tints, overlays) are built automatically via `buildThemeColors()`.
- **Use `useTheme().colors` in components** — do not hardcode hex/rgba in screens. Import theme utilities from `@/theme` when needed.
- Color roles: `primary` (CTAs/links), `success` (completed sets), `warning` (favorites), `danger` (delete/errors), `surface*` / `border` / `text*`, plus UI tokens (`tableHeader`, `rowWarmUp`, `overlay`, etc.).
- `getRecoveryPalette()` for muscle diagram heat colors.

### 7. Routing (expo-router)

- File-based; `(tabs)` is a group route.
- `Redirect` used for index → `/(tabs)`.
- Typed routes enabled; screens have `headerShown: false` by default, animations `slide_from_right`.

### 8. Icons

- `@expo/vector-icons` (Ionicons) — e.g. `Ionicons name="barbell-outline"`.

### 9. Components

- Functional components; React Native primitives (`View`, `Text`, `Pressable`, `FlatList`, `ScrollView`, etc.).
- Inline styles via `StyleSheet.create` or plain objects; theme colors from `useTheme()`.
- `SafeAreaView` / `useSafeAreaInsets` for safe areas.

### 10. Subscriptions & monetization

- **Specs:** [`docs/features/subscriptions.md`](docs/features/subscriptions.md) — tiers, the exhaustive gate map, paywall UX, downgrade behaviour. Billing plumbing in [`docs/monetization/`](docs/monetization/).
- **Tiers:** `basic` (free) and `pro`. UI labels: Basic / Pro.
- **Pricing (USD):** $2.99/mo · $19.99/yr — see `apps/mobile/src/subscription/pricing.ts`.
- **Billing:** RevenueCat SDK (`src/utils/revenueCat.ts`). Entitlement: **`MuscleOS Pro`**. Products: `muscleos_pro_monthly`, `muscleos_pro_annual`.
- **Identity:** Supabase `user.id` is RevenueCat `appUserID`. Purchases require a linked (non-anonymous) account.
- **State:** `subscriptionStore` + `SubscriptionState` in `@muscleos/types`. Use `useProGate()` / `useRequirePro()` from `src/hooks/useProGate.ts` for feature gates.
- **Feature list:** `src/subscription/features.ts` — single source for paywall copy and gate keys.
- **Pro gates:** custom templates/exercises, empty workout, add/replace exercise mid-workout, save-as-template, PRs, progression charts, monthly calendar. Custom templates require Pro to **run**, not just to create — enforce via `requiresProToStart()` at *every* workout entry point, including deep links.
- **Basic includes:** built-in templates, workout logging, recovery, history list, exercise library, export.
- **Exercise catalog:** `catalog_exercises` in Supabase + bundled `CATALOG_SEED`. User customs are `user_exercises` (account-private). See [`docs/supabase/setup.md`](docs/supabase/setup.md).
- **Setup:** See [`docs/monetization/revenuecat-setup.md`](docs/monetization/revenuecat-setup.md) for store + RevenueCat dashboard steps.

---

## When Editing

0. **Read the spec** for the feature area first — see [Read the specs first](#read-the-specs-first). Then update it alongside your change.
1. **Types**: Change domain types in `packages/types`, then `pnpm build` from root so mobile picks up updates.
2. **New storage**: Add key to `STORAGE_KEYS`, add get/set in `localStorage.ts`, create or extend a store, and add it to the [storage inventory](docs/features/accounts-and-data.md#storage) noting whether it syncs.
3. **New store**: Follow `authStore`/`templatesStore` pattern — load on app init from layout if needed.
4. **New screen**: Add file under `app/`; use `Stack`/`Tabs` screen options for layout. Add it to the [screen map](docs/product/overview.md#screen-map).
5. **New component**: Place in `src/components/`, use `@/` imports and `useTheme()` for colors.
6. **Tests**: Put `*.test.ts` next to domain helpers (`src/utils`, `@muscleos/types`). CI runs `pnpm check` (Biome + `tsc` + Vitest via Turbo). Coverage gaps and priorities: [`docs/engineering/testing.md`](docs/engineering/testing.md).

### Behaviours that are easy to break

Non-obvious invariants the specs cover in detail. Check the relevant spec before touching these.

- **Sessions are the source of truth** for recovery, PRs, and home stats. The "previous" value is a persisted, synced snapshot of the most recent qualifying session and must be rebuilt when a session is deleted.
- **Weight is stored in kg everywhere**; pounds exist only as a display conversion at the UI edge.
- **Built-in templates and catalog exercises are immutable** — hide or unpublish, never delete, so historical sessions keep resolving.
- **Recovery is never synced** — it's derived, and is recomputed locally after a sync merge.
- **Incomplete sets are persisted** with the session but excluded from every derived metric.
- **Every new workout entry point needs a Pro gate** — `/active-workout` is reachable by deep link and notification tap.

---

## Useful References

- Expo router: https://docs.expo.dev/router/introduction/
- Zustand: https://github.com/pmndrs/zustand
- `@muscleos/types` exports: `packages/types/src/index.ts` re-exports all domain modules.
- Full spec index: [`docs/README.md`](docs/README.md)
