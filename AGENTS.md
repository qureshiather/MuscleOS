# MuscleOS — Agent Guide

This document helps AI agents and future prompts work effectively with the MuscleOS codebase.

## Project Overview

**MuscleOS** is a fitness/workout tracking mobile app built with Expo (React Native), plus a Next.js landing page. It supports workout templates, session logging, exercise tracking, muscle recovery visualization, and health/settings.

---

## Monorepo Structure

```
MuscleOS/
├── apps/
│   ├── mobile/      # Expo React Native app (main product)
│   └── landing/     # Next.js marketing site (privacy, terms)
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
| `pnpm lint` | Lint all packages |
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
| Mobile storage | AsyncStorage + Expo SecureStore (auth) |
| Types | Shared `@muscleos/types` package |
| Landing | Next.js 15, React 19, Tailwind CSS |

---

## Conventions & Patterns

### 1. Shared Types (`packages/types`)

- All domain models live in `@muscleos/types`: `Exercise`, `WorkoutTemplate`, `WorkoutSession`, `MuscleRecovery`, `MuscleId`, etc.
- **Always import types from `@muscleos/types`** — do not duplicate type definitions in the mobile app.
- Build: `tsup` produces `dist/` with CJS + `.d.ts`.

### 2. Mobile App Structure (`apps/mobile`)

```
apps/mobile/
├── app/                    # expo-router file-based routing
│   ├── _layout.tsx         # Root layout (providers, global load)
│   ├── (tabs)/             # Tab navigator (index, recovery, exercises, history, settings)
│   ├── active-workout.tsx  # In-progress workout screen
│   ├── auth*.tsx           # Auth flows
│   ├── create-template.tsx
│   ├── workout-preview.tsx
│   └── ...
├── src/
│   ├── components/         # Reusable UI (MuscleDiagram, PlateCalculator, etc.)
│   ├── data/               # Static data (exercises, builtInTemplates)
│   ├── storage/            # AsyncStorage/SecureStore wrappers + keys
│   ├── store/              # Zustand stores (authStore, templatesStore, etc.)
│   ├── theme/              # ThemeProvider, useTheme, colors
│   └── utils/              # Helpers (weightUnits, relativeTime, plateCalculator)
└── assets/
```

### 3. Path Aliases

- `@/*` → `./src/*` (configured in `tsconfig.json`)
- Use `@/store/authStore`, `@/components/MuscleDiagram`, `@/theme/ThemeContext`, etc.

### 4. State Management (Zustand)

- Stores live in `src/store/`.
- Pattern: `create<State>((set, get) => ({ ... }))` with async actions that call storage and then `set()`.
- Load data in root layout `useEffect` (e.g. `loadProfile`, `loadSubscription`, `loadSettings`).

### 5. Storage

- Keys defined in `src/storage/keys.ts` (e.g. `muscleos_templates`).
- `src/storage/localStorage.ts` — AsyncStorage for most data (templates, sessions, recovery, etc.).
- **SecureStore** for auth/profile only (`authStore.ts`).

### 6. Theming

- `ThemeProvider` + `useTheme()` — provides `colors` and `isDark`.
- Color palette: `background`, `surface`, `surfaceElevated`, `border`, `text`, `textSecondary`, `textMuted`, `primary`, `accent`, `danger`, `warning`, `muscleHighlight`, `muscleRecovering`.
- Use `useTheme().colors` for styles; avoid hardcoded hex values.

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

---

## When Editing

1. **Types**: Change domain types in `packages/types`, then `pnpm build` from root so mobile picks up updates.
2. **New storage**: Add key to `STORAGE_KEYS`, add get/set in `localStorage.ts`, create or extend a store.
3. **New store**: Follow `authStore`/`templatesStore` pattern — load on app init from layout if needed.
4. **New screen**: Add file under `app/`; use `Stack`/`Tabs` screen options for layout.
5. **New component**: Place in `src/components/`, use `@/` imports and `useTheme()` for colors.

---

## Useful References

- Expo router: https://docs.expo.dev/router/introduction/
- Zustand: https://github.com/pmndrs/zustand
- `@muscleos/types` exports: `packages/types/src/index.ts` re-exports all domain modules.
