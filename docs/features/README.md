# Feature Specs

One doc per feature area. Each documents the data model, exact behavioural rules, product
assumptions, and tier gating for that area.

New to the codebase? Read [product/overview.md](../product/overview.md) first.

## Index

| Spec | Covers | Primary code |
|------|--------|--------------|
| [templates.md](templates.md) | Built-in programs, custom templates, folders, hide, suggestions, workout preview | `app/(tabs)/index.tsx`, `app/create-template.tsx`, `src/store/templatesStore.ts`, `src/data/builtInTemplates.ts` |
| [workout-logging.md](workout-logging.md) | Session lifecycle, set logging, rest timers, sounds, notifications, mid-workout edits, finish | `app/active-workout.tsx`, `src/store/activeWorkoutStore.ts`, `src/hooks/useWorkoutNotification.ts` |
| [recovery.md](recovery.md) | Muscle taxonomy, recovery timings, body diagram, Recovery tab | `src/utils/recovery.ts`, `packages/types/src/recovery.ts`, `src/components/MuscleDiagram.tsx` |
| [exercise-library.md](exercise-library.md) | Catalog and its sync, custom exercises, search, filters, exercise notes | `app/(tabs)/exercises.tsx`, `src/store/exercisesStore.ts`, `src/utils/exerciseSearch.ts` |
| [history-analytics.md](history-analytics.md) | History list, monthly calendar, PRs, 1RM, strength standards, progression charts, home stats | `app/(tabs)/history.tsx`, `src/utils/oneRepMax.ts`, `src/data/strengthStandards.ts` |
| [subscriptions.md](subscriptions.md) | Basic/Pro tiers, complete gate map, paywall UX, downgrade behaviour | `src/subscription/features.ts`, `src/hooks/useProGate.ts` |
| [accounts-and-data.md](accounts-and-data.md) | Navigation, app boot, auth, profile, settings, storage keys, cloud sync, export | `app/_layout.tsx`, `src/store/authStore.ts`, `src/sync/`, `src/storage/` |

## Tier matrix

Full detail, including where each gate is enforced: [subscriptions.md](subscriptions.md).

| Capability | Basic | Pro |
|------------|:-----:|:---:|
| 9 built-in templates (PPL, Upper/Lower, Strong Lifts 5×5) | ● | ● |
| Set logging, warm-up sets, rest timers, sounds | ● | ● |
| Exercise catalog browse, search, notes | ● | ● |
| Recovery map | ● | ● |
| History list, session delete, JSON export and import | ● | ● |
| Resume an in-progress workout | ● | ● |
| Reorder exercises and edit rest mid-workout | ● | ● |
| Rename, pin, archive, delete existing folders | ● | ● |
| Hide built-in templates and folders | ● | ● |
| Run a **custom** template | ○ | ● |
| Create / edit custom templates; create folders | ○ | ● |
| Create custom exercises | ○ | ● |
| Empty / ad-hoc workout | ○ | ● |
| Add, replace or remove an exercise mid-workout | ○ | ● |
| Save a finished workout as a template | ○ | ● |
| Personal records and 1RM | ○ | ● |
| Exercise progression charts | ○ | ● |
| Monthly training calendar | ○ | ● |

## Spec and test status

Current test coverage detail: [engineering/testing.md](../engineering/testing.md).

| Area | Spec | Unit (Vitest) | UI (Jest) |
|------|------|---------------|-----------|
| Templates | Complete | ✓ every rule — grouping, menus, folder delete, draft save, suggestions, start decision, store persistence | ✓ Home sections and menus, create/edit template, workout preview. Not covered: drag-reorder gesture, muscle-art pixels |
| Workout logging | Complete | ✓ every rule — prefill, set view, keypad keys, rest timer maths, finish matrix, notification copy, store persist/AppState/hydrate | ✓ Logging, Done, rest timer, deletes, finish modal, Good work, picker, resume. Not covered: the exercise ⋯ menu (positions via `measureInWindow`; its actions are unit-tested), sounds, notification scheduling |
| Recovery | Complete | ✓ every rule — all 18 muscles, expiry, store load/cache, recompute triggers | ✓ Recovery tab states, list, explainer, diagram modes |
| Exercise library | Complete | ✓ every rule — catalog counts, seed reconcile/watermark, search tiers, filters, normalization, custom CRUD + sync, notes | ✓ Exercises tab, create/edit exercise |
| History & analytics | Complete | ✓ every rule — calendar grid, PR card model, e1RM display, aliases, session card summary, export filename | ✓ History list/delete/refresh, monthly calendar, PRs, progression |
| Subscriptions | Complete | ✓ every rule — start decision, redirect wait, mid-workout gates, state resolution, paywall labels, store, RevenueCat wrapper | ✓ Every gate-map row, deep-link starts, `useRequirePro` screens, paywall |
| Accounts & data | Complete | ✓ every rule — outbox, push/pull engine, account switch, guest upload, auth session, settings/migrations, import/export, clear data | ✓ Profile, Account, Data, Biodata, Settings, auth screens, `/auth-callback`. Not covered: native Apple/Google sign-in SDKs |
