# Feature Matrix & Gates

Single source for **what each tier includes** and **where Pro is enforced** in the app.

Feature labels for the paywall and gate keys are defined in [`apps/mobile/src/subscription/features.ts`](../../apps/mobile/src/subscription/features.ts).

## Basic (free)

| Feature | Included |
|---------|----------|
| 11 built-in templates (PPL, Upper/Lower, 5×5, Arnold) | Yes |
| Start workout from template | Yes |
| Set logging (reps, weight, complete sets) | Yes |
| Rest timers + workout sounds | Yes |
| Plate calculator | Yes |
| Exercise library (~50 built-ins, browse/filter) | Yes |
| Recovery tab + home snapshot | Yes |
| Workout history (list, detail, delete) | Yes |
| Profile, units, theme, export data | Yes |
| Resume in-progress workout | Yes |

## Pro

| Feature | Gate key | Included |
|---------|----------|----------|
| Custom templates (create, edit, folders, pin/favorite) | `custom_templates` | Yes |
| Save finished workout as template | `save_as_template` | Yes |
| Custom exercises | `custom_exercises` | Yes |
| Empty / ad-hoc workout | `empty_workout` | Yes |
| Add exercise mid-workout | `add_exercise_mid_workout` | Yes |
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
| `active-workout.tsx` | Add exercise | `add_exercise_mid_workout` |
| `active-workout.tsx` | Save as template / update template from session | `save_as_template` |
| `create-template.tsx` | Screen entry | `custom_templates` |
| `create-exercise.tsx` | Screen entry | `custom_exercises` |
| `(tabs)/exercises.tsx` | + button → create exercise | `custom_exercises` |
| `(tabs)/history.tsx` | PR + calendar header buttons | `personal_records`, `monthly_calendar` |
| `personal-records.tsx` | Screen entry | `personal_records` |
| `exercise-progression.tsx` | Screen entry | `exercise_progression` |
| `history-monthly.tsx` | Screen entry | `monthly_calendar` |

## Paywall UX

Locked actions navigate to `/subscription?feature=<gate_key>`. The subscription screen highlights the relevant Pro feature when a query param is present.

## Helpers

- `useProGate()` — `{ isPro, gatePro(feature?) }` for inline actions
- `useRequirePro(feature)` — redirect to paywall on screen mount

Both live in [`apps/mobile/src/hooks/useProGate.ts`](../../apps/mobile/src/hooks/useProGate.ts).

## Grandfathering note

Basic users who previously created custom templates (e.g. during testing) may still **run** existing custom templates; **creating and editing** requires Pro.
