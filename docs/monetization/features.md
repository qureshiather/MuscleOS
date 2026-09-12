# Feature Matrix & Gates

Single source for **what each tier includes** and **where Pro is enforced** in the app.

Feature labels for the paywall and gate keys are defined in [`apps/mobile/src/subscription/features.ts`](../../apps/mobile/src/subscription/features.ts).

## Basic (free)

| Feature | Included |
|---------|----------|
| 5 built-in templates (PPL, Strong Lifts 5×5) | Yes |
| Start workout from a **built-in** template | Yes |
| Start workout from a **custom** template | No — Pro, see [Downgrade behaviour](#downgrade-behaviour-pro--basic) |
| Set logging (reps, weight, complete sets) | Yes |
| Rest timers + workout sounds | Yes |
| Plate calculator | Yes |
| Exercise library (~399 catalog, browse/filter by category) | Yes |
| Recovery tab + home snapshot | Yes |
| Workout history (list, detail, delete) | Yes |
| Profile, units, theme, export data | Yes |
| Resume in-progress workout | Yes |

## Pro

| Feature | Gate key | Included |
|---------|----------|----------|
| Custom templates (create, edit, **run**, folders, pin/favorite) | `custom_templates` | Yes |
| Save finished workout as template | `save_as_template` | Yes |
| Custom exercises | `custom_exercises` | Yes |
| Empty / ad-hoc workout | `empty_workout` | Yes |
| Add exercise mid-workout | `add_exercise_mid_workout` | Yes |
| Replace exercise mid-workout (sets transfer) | `replace_exercise_mid_workout` | Yes |
| Personal records & 1RM tracking | `personal_records` | Yes |
| Exercise progression charts | `exercise_progression` | Yes |
| Monthly training calendar | `monthly_calendar` | Yes |
| Strength level comparison (profile weight/gender) | (within PR/progression screens) | Yes |

## Not gated (either tier)

- Built-in templates and logging
- Recovery visualization
- Data export

## Gate map (screens)

| Location | Action | Gate |
|----------|--------|------|
| `(tabs)/index.tsx` | Empty workout | `empty_workout` |
| `(tabs)/index.tsx` | Create template, folders, rename/move/edit custom template | `custom_templates` |
| `(tabs)/index.tsx` | **Start** a custom template | `custom_templates` |
| `workout-preview.tsx` | Screen entry for a custom template | `custom_templates` |
| `active-workout.tsx` | Start from params (custom template or `_empty`) | `custom_templates`, `empty_workout` |
| `active-workout.tsx` | Add / replace / remove on a built-in workout | Pro: edit session, then save as **new** template only. Basic: “can’t edit a built-in workout.” |
| `active-workout.tsx` | Add exercise (custom / empty) | `add_exercise_mid_workout` |
| `active-workout.tsx` | Replace exercise (ellipsis menu) | `replace_exercise_mid_workout` |
| `active-workout.tsx` | Save as template / update custom template from session | `save_as_template` |
| `create-template.tsx` | Screen entry | `custom_templates` |
| `create-exercise.tsx` | Screen entry | `custom_exercises` |
| `(tabs)/exercises.tsx` | + button → create exercise | `custom_exercises` |
| `(tabs)/history.tsx` | PR + calendar header buttons | `personal_records`, `monthly_calendar` |
| `personal-records.tsx` | Screen entry | `personal_records` |
| `exercise-progression.tsx` | Screen entry | `exercise_progression` |
| `history-monthly.tsx` | Screen entry | `monthly_calendar` |

## Paywall UX

Locked actions navigate to `/subscription?feature=<gate_key>`. The subscription screen highlights the relevant Pro feature when a query param is present.

Paywall comparison lists (`BASIC_FEATURES_LIST` / `PRO_FEATURES_LIST`) each have **5 items** so Basic and Pro stay visually balanced.

## Helpers

- `useProGate()` — `{ isPro, gatePro(feature?) }` for inline actions
- `useRequirePro(feature)` — redirect to paywall on screen mount

Both live in [`apps/mobile/src/hooks/useProGate.ts`](../../apps/mobile/src/hooks/useProGate.ts).

## Downgrade behaviour (Pro → Basic)

There is **no grandfathering**. Custom templates are Pro content to *run*, not only to create.

When a subscription lapses:

| Concern | Behaviour |
|---------|-----------|
| Custom templates & folders | **Kept, never deleted.** Still visible under the **Mine** tab on home, rendered locked (lock icon + `PRO` chip). |
| Starting a custom template | **Blocked.** Tapping the card opens `/subscription?feature=custom_templates`. |
| Suggested / Recent on home | Custom templates are **excluded** — Basic is never recommended a workout it cannot start. |
| Built-in templates | Unaffected; all 5 remain fully runnable. |
| Workout already in progress | **May be finished.** The gate blocks *starting*, so a session in flight when the subscription lapses is not destroyed. |
| Resubscribing | Templates become runnable again immediately; nothing to restore. |

Templates are deliberately kept **visible but locked** rather than hidden, so a lapsed
subscriber does not think their data was deleted, and so the lock is a conversion surface.

### Where this is enforced

`requiresProToStart(template)` in [`features.ts`](../../apps/mobile/src/subscription/features.ts)
is the single predicate. It is checked at every entry point into a workout:

| Entry point | Enforcement |
|-------------|-------------|
| `(tabs)/index.tsx` → `handleStartTemplate` | Gates to paywall before navigating |
| `(tabs)/index.tsx` → Suggested / Recent | Custom templates filtered out via `startableTemplates` |
| `workout-preview.tsx` | Redirects to paywall on mount when the template is locked |
| `active-workout.tsx` | Blocks the start-from-params effect (covers deep links and notification taps) |

Adding a new way to launch a workout means adding a check here too — the home screen
gate alone is not sufficient, because `active-workout` is reachable directly.
