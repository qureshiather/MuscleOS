# Feature Specs

One doc per feature area. Each documents the data model, exact behavioural rules, product
and assumptions for that area.

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

## Pricing

Everything is free for everyone, with or without an account — custom templates and exercises,
empty workouts, mid-workout edits, save as template, PRs, progression charts and the monthly
calendar included. See [pricing.md](pricing.md).

## Spec and test status

Current test coverage detail: [engineering/testing.md](../engineering/testing.md).

| Area | Spec | Unit (Vitest) | UI (Jest) |
|------|------|---------------|-----------|
| Templates | Complete | ✓ every rule — grouping, menus, folder delete, draft save, suggestions, start decision, store persistence | ✓ Home sections and menus, create/edit template, workout preview. Not covered: drag-reorder gesture, muscle-art pixels |
| Workout logging | Complete | ✓ every rule — prefill, set view, keypad keys, rest timer maths, finish matrix, notification copy, store persist/AppState/hydrate | ✓ Logging, Done, rest timer, deletes, finish modal, Good work, picker, resume. Not covered: the exercise ⋯ menu (positions via `measureInWindow`; its actions are unit-tested), sounds, notification scheduling |
| Recovery | Complete | ✓ every rule — all 18 muscles, expiry, store load/cache, recompute triggers | ✓ Recovery tab states, list, explainer, diagram modes |
| Exercise library | Complete | ✓ every rule — catalog counts, seed reconcile/watermark, search tiers, filters, normalization, custom CRUD + sync, notes | ✓ Exercises tab, create/edit exercise |
| Exercise demos | Complete | ✓ website data — catalog, demo sources, search, related, type line; app page link | ✓ Detail sheet demo link. Not covered: rendered animations (reviewed by eye with `--check`) |
| History & analytics | Complete | ✓ every rule — calendar grid, PR card model, e1RM display, aliases, session card summary, export filename | ✓ History list/delete/refresh, monthly calendar, PRs, progression |
| Pricing | Complete | ✓ start-from-params decision and plan, legacy subscription keys removed, export without subscription | ✓ Deep-link starts for every template kind, built-in mid-workout edits, no lock or Pro copy on Workouts / Account |
| Accounts & data | Complete | ✓ every rule — outbox, push/pull engine, account switch, guest upload, auth session, settings/migrations, import/export, clear data | ✓ Profile, Account, Data, Biodata, Settings, auth screens, `/auth-callback`. Not covered: native Apple/Google sign-in SDKs |
