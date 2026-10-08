# Feature Specs

One doc per feature area. Each documents the data model, exact behavioural rules, product
assumptions and test coverage for that area.

New to the codebase? Read [product/overview.md](../product/overview.md) first.

## Index

| Spec | Covers | Primary code |
|------|--------|--------------|
| [templates.md](templates.md) | Built-in programs, custom templates, folders, hide, suggestions, workout preview | `app/(tabs)/index.tsx`, `app/create-template.tsx`, `src/store/templatesStore.ts`, `src/data/builtInTemplates.ts` |
| [workout-logging.md](workout-logging.md) | Session lifecycle, set logging, rest timers, sounds, notifications, mid-workout edits, finish | `app/active-workout.tsx`, `src/store/activeWorkoutStore.ts`, `src/hooks/useWorkoutNotification.ts` |
| [recovery.md](recovery.md) | Muscle taxonomy, recovery timings, body diagram, Recovery tab | `src/utils/recovery.ts`, `packages/types/src/recovery.ts`, `src/components/MuscleDiagram.tsx` |
| [exercise-library.md](exercise-library.md) | Catalog and its sync, custom exercises, search, filters, exercise notes | `app/(tabs)/exercises.tsx`, `src/store/exercisesStore.ts`, `src/utils/exerciseSearch.ts` |
| [exercise-demos.md](exercise-demos.md) | Animated exercise demos: website library and exercise pages, CC0 reuse licence, render pipeline, the app's link | `apps/landing/app/exercises/`, `apps/landing/scripts/exercise-animations/`, `src/utils/exerciseDemo.ts` |
| [history-analytics.md](history-analytics.md) | History list, monthly calendar, PRs, 1RM, strength standards, progression charts, home stats | `app/(tabs)/history.tsx`, `src/utils/oneRepMax.ts`, `src/data/strengthStandards.ts` |
| [pricing.md](pricing.md) | Free forever — no tiers, paywall or purchases; Coaching as the future paid offering | `src/storage/keys.ts` (`LEGACY_STORAGE_KEYS`) |
| [accounts-and-data.md](accounts-and-data.md) | Navigation, app boot, auth, profile, settings, storage keys, cloud sync, export | `app/_layout.tsx`, `src/store/authStore.ts`, `src/sync/`, `src/storage/` |

## Tests

Each spec ends with a **Tests** section listing the test files that cover its rules and the few
things that aren't covered. Test infrastructure and conventions:
[engineering/testing.md](../engineering/testing.md).
