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
| History list, session delete, JSON export | ● | ● |
| Resume an in-progress workout | ● | ● |
| Reorder exercises and edit rest mid-workout | ● | ● |
| Hide built-in templates and folders | ● | ● |
| Run a **custom** template | ○ | ● |
| Create / edit custom templates and folders | ○ | ● |
| Create custom exercises | ○ | ● |
| Empty / ad-hoc workout | ○ | ● |
| Add or replace an exercise mid-workout | ○ | ● |
| Save a finished workout as a template | ○ | ● |
| Personal records and 1RM | ○ | ● |
| Exercise progression charts | ○ | ● |
| Monthly training calendar | ○ | ● |

## Spec and test status

Current test coverage detail: [engineering/testing.md](../engineering/testing.md).

| Area | Spec | Automated tests |
|------|------|-----------------|
| Templates | Complete | Partial — built-in integrity, recommendation, home stats, `allTemplates` ordering, soft-hide, folder-delete cascade |
| Workout logging | Complete | Partial — set-logging rules, prefill, warm-up numbering, current-set, rest-key remap, finish save-options, persist/resume round-trip, hydrate expired-timer discard, and notification copy covered; only the screen's live rendering and debounced-persist wiring remain |
| Recovery | Complete | Partial — per-muscle hours, `getRecoveryUntil`, and `recoveryFromSessions` covered |
| Exercise library | Complete | Partial — search ranking, title-case names, catalog merge, and normalization covered; store and sync untested |
| History & analytics | Complete | Partial — 1RM and home stats covered; strength standards and volume untested |
| Subscriptions | Complete | Partial — `requiresProToStart`, paywall paths, and the deep-link start guard (`blockedStartFeature`) covered; UI gate wiring untested |
| Accounts & data | Complete | Minimal — unit conversion + active-workout persist/resume round-trip; auth, sync, and merge untested |
