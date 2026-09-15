# Workout Logging

The core of the app: the screen where you log sets and rest between them. Training history,
recovery, and analytics are views over the sessions this screen produces.

| | |
|--|--|
| Screen | `apps/mobile/app/active-workout.tsx` |
| Store | `apps/mobile/src/store/activeWorkoutStore.ts` |
| Number pad | `apps/mobile/src/components/NumericKeypad.tsx`, `src/utils/keypadInput.ts` |
| Finished sessions | `apps/mobile/src/store/sessionsStore.ts` |
| Notifications | `apps/mobile/src/hooks/useWorkoutNotification.ts`, `src/components/WorkoutNotificationHandler.tsx` |
| Sounds | `apps/mobile/src/utils/workoutSounds.ts` |
| Types | `packages/types/src/session.ts` |

The whole screen is implemented in `active-workout.tsx`, save the in-app number pad
(`NumericKeypad`) — `src/components/workouts/` holds home screen template cards, not set-logging UI.

## Data model

```ts
interface SetRecord {
  reps?: number;
  weightKg?: number;      // always kg in storage
  completed: boolean;
  isWarmUp?: boolean;
  note?: string;          // in the type, unused by the UI
}

interface SessionExercise {
  exerciseId: string;
  sets: SetRecord[];
  restBetweenSetsSeconds?: number;  // omitted → 120
}

interface WorkoutSession {
  id: string;              // session_<timestamp>
  templateId: string;      // '_empty' for ad-hoc
  startedAt: string;       // ISO
  completedAt?: string;    // ISO; absent while in progress
  exercises: SessionExercise[];
}
```

**Not modelled:** drop sets, sets to failure, RPE, per-set notes (the field exists but no UI
writes it), rest-pause, tempo, or duration/distance-based work. Every set is weight × reps.

## Session lifecycle

### Starting

| Entry point | Route params |
|-------------|--------------|
| Template (built-in or custom) | Home → preview → `/active-workout` with `templateId`, `exerciseIds`, optional `defaultSets` |
| Empty / ad-hoc workout (Pro) | Home → `/active-workout` with `templateId: '_empty'`, no exercises |
| Resume | Tab-bar pill, notification tap, or the "Workout in progress" alert — no params |
| Deep link | `muscleos:///active-workout`, and notifications carrying `screen: 'active-workout'` |

A new session creates `defaultSets ?? 3` blank sets per exercise.

**Pro gates are enforced here, not only on the home screen**, because `/active-workout` is
reachable directly by deep link and notification tap: starting `_empty` needs `empty_workout`
and starting a custom template needs `custom_templates`. The check applies only to *starting* —
a session already in flight when a subscription lapses can still be finished.

**Only one workout at a time.** `startWorkout` no-ops if a session exists, and the home screen
blocks a second start with a "Workout in progress — Finish or cancel" alert.

### Persisting and resuming

State lives in `activeWorkoutStore` (session, rest timer state, recorded rest durations) and is
mirrored to AsyncStorage under `muscleos_active_workout`, **debounced 400 ms**, plus an immediate
write when the app backgrounds. `hydrateActiveWorkout()` restores it during app boot, discarding
an already-expired rest timer.

While a session exists, a **Resume workout** pill replaces part of the tab bar showing elapsed
time. Its **X** discards the workout **with no confirmation**. Inside the workout, the
chevron-down minimises back to the tabs without ending anything.

### Discarding and finishing

| Action | Behaviour |
|--------|-----------|
| **Cancel workout** (footer) | Themed confirm dialog: "This workout will not be saved." If any sets are completed, also shows elapsed time and set count. **Keep workout** (or tap the overlay) dismisses; **Discard workout** discards. |
| **Discard** (finish modal) | Discard without saving |
| **Resume pill X** | Discard immediately, no confirmation |
| **Finish** | Enabled only once at least one set is completed |

`finishWorkout()` sets `completedAt`, appends the session to `muscleos_sessions`, updates the
per-exercise "previous" snapshots, recomputes recovery from all sessions, clears the active
session, and queues a cloud sync.

## Set logging

Columns: **SET · PREVIOUS · KG/LB · REPS · Done**.

- Working sets are numbered `1, 2, 3…`; warm-ups are `W1, W2…` and are excluded from that count.
- The first incomplete set is the **current** set: primary row tint, a 3px primary bar on the left, the set number in a filled primary mark, and a primary-ringed Done control. Later incomplete sets render muted with an outlined number.
- Completed rows tint green (success), with a matching left bar and a filled green set mark. Warm-ups have their own tint.
- After a set is completed, the actual rest taken is displayed under its number.
- A fixed rest slot sits under the current working set (and under the resting set while the timer runs) so completing a set does not shove the rows below. The slot is empty until rest starts; the countdown fills that same space. Warm-ups do not reserve a slot.

### Previous values and prefill

**PREVIOUS** shows the same value for every set of an exercise: the highest-weight completed set
(then highest reps as a tie-break) from the **most recent qualifying session** for that exercise,
formatted `weight unit × reps`, or `—`. It is not an all-time best and does not preserve
set-by-set values.

Prefill rules:

| When | Behaviour |
|------|-----------|
| Session starts | For any set with **both** weight and reps empty, copy the previous snapshot's weight and reps. Partially filled sets are left alone. |
| Completing a set | Copy that set's weight (not reps) into the next set if it's empty — only when both are the same kind (warm-up vs working). |
| Adding a set | Copy the last set's weight and reps if present. |

Template targets are never used, because templates don't store any.

### Entering values

Tapping a weight or reps cell opens the **in-app number pad** (`NumericKeypad`), not the OS
keyboard — so it never covers the sets above it, and a set completes on the **first** tap (the old
OS keyboard stole that tap, which is why completing used to need a double tap). The focused cell is
highlighted with an accent ring — there is no text caret, since the pad owns editing. The pad's
context bar names the exercise and field and echoes the running value, and the focused exercise is
scrolled up so the pad never hides the row being edited.

- **Whole numbers only** — no decimal key. Weight is displayed in the user's unit and converted
  back to kg on write; lb users get exact integers and kg is stored to 2dp after conversion. Entry
  is capped at **4 digits for weight, 3 for reps**.
- **− / +** nudge the focused field by a plate step — **2.5 kg / 5 lb** for weight, **1** for reps —
  clamping to empty at zero.
- The **action key adapts to the field**, because logging a weight and finishing a set are
  different intents:
  - **Weight** shows a primary **Next** that jumps to the same set's reps, plus a reserved
    **Plates** slot (a plate calculator, later).
  - **Reps** shows a success **Done** (check) that **completes the set** — starting rest for a
    working set — and then dismisses the pad, since a rest usually follows rather than the next
    set. Done is disabled until reps > 0. It sits beside a reserved **RPE** slot for logging effort
    later, to inform recovery windows.
- The chevron key hides the pad. Neither reserved slot (Plates / RPE) is wired to anything yet.

The pure entry maths (append, backspace, ± clamping, digit caps) lives in `src/utils/keypadInput.ts`
and is unit-tested.

### Completing, adding, removing

- **Done** requires `reps > 0`; weight is optional. Completing a non-warm-up set **auto-starts
  the rest timer**; warm-ups do not.
- **+ ADD SET** appends a set; the button label shows the current rest preset.
- **Swipe right** or long-press a set number to delete. Minimum **1 set** per exercise; no maximum.
- **Add warm-up** inserts a warm-up set at position 0.

## Rest timer

| Setting | Value |
|---------|------:|
| App default (`DEFAULT_REST_SECONDS`) | **120 s** |
| Per-exercise choices | 90 / 120 / 180 s |
| Manual picker (header) | 60 / 120 / 180 s |
| Adjust step | ±30 s (floor 30 s) |

There is **no rest-duration setting in Settings** — the default is a code constant, overridable
per exercise within a session. Per-exercise rest applies after **every** set including the last.

The timer is derived from an absolute `restEndTime`, so it stays correct across backgrounding
and app restarts. **Skip rest** records the elapsed time and clears the timer; recorded durations
are kept per set and shown in the set row.

A **fixed-height slot** under the current working set (and under the resting set while the timer
runs) is reserved even before rest starts, so the rows below do not jump when a set is completed.

### Sounds

Gated by the `workoutSoundsEnabled` setting (default **on**), and configured to play in silent
mode.

| Sound | Trigger |
|-------|---------|
| `restTick` | Rest countdown at 3, 2, 1 seconds |
| `restEnd` | Rest reaches zero while the app is in the foreground |
| `setComplete` | A set is marked complete |
| `workoutComplete` | Workout finished |

There are **no haptics** in the app and no haptics setting. The Android rest-over notification
vibrates via its channel.

### Notifications

Two delivery paths:

- **Android dev/production builds** use a native module (`modules/workout-live-notification`)
  for an ongoing notification with a platform chronometer, plus an **exact alarm** for rest-over.
- **iOS and any build without the native module** use `expo-notifications`: a silent ongoing
  tray entry (`active-workout`) and a scheduled `rest-complete` alert at `restEndTime`, sent with
  iOS time-sensitive interruption level.

Notification bodies name the upcoming work — `Next: <exercise>`, `Continue to <exercise>`, or
`Finish your workout` — derived from the first exercise with incomplete sets. Tapping any of them
opens the active workout.

When rest completes while the app is backgrounded, the OS notification fires and the handler
records the rest duration and clears the timer on return, so the two paths don't double up. The
in-app sound is suppressed in that case.

**Exact alarms (Android 13+).** On the first rest timer of a launch, if exact alarms aren't
permitted, the app prompts once ("Let rest alerts fire on time"), explaining that alerts may
otherwise be up to a minute late. The prompt-shown flag persists in
`muscleos_exact_alarm_prompt_shown`. Without permission an inexact alarm is used.

Notifications are skipped entirely in Expo Go, which can't load the native modules.

## Mid-workout edits

| Action | Tier | Behaviour |
|--------|------|-----------|
| **Reorder exercises** | Basic | Long-press an exercise title to enter drag mode |
| **Edit rest for an exercise** | Basic | 90/120/180 s |
| **Exercise note** | Basic | Stored per exercise id in `exerciseNotesStore`, not on the session — so it persists across workouts |
| **Add exercise** | Pro `add_exercise_mid_workout` | Adds with 3 empty sets |
| **Replace exercise** | Pro `replace_exercise_mid_workout` | **All logged sets, warm-ups, and rest carry over**; only `exerciseId` changes |
| **Remove exercise** | No direct gate | Blocked only for a Basic user editing a built-in workout; otherwise removes it and remaps recorded rest |

On a **built-in** template, add/replace/remove are blocked for Basic users with the built-in
alert rather than the paywall — the intended path is to edit the session and save it as a new
template (Pro). On Basic the button reads **"Pro: Add Exercise"**.

The exercise picker searches the full catalog plus your customs. A search with no match offers
**Create "<query>"**, gated on `custom_exercises`.

## Finish flow

**Finish** is enabled once any set is completed. It opens a summary modal whose options depend on
what you started from and whether you changed the exercise list:

| Started from | Options |
|--------------|---------|
| Empty workout | Save as template (Pro) · Save values only · Discard |
| Built-in, list changed | Save as new template (Pro) · Save values only · Discard |
| Custom, list changed | Overwrite this template (Pro) · Save as new template (Pro) · Save values only · Discard |
| List unchanged | Save values · Discard |

"Overwrite" updates only the template's `exerciseIds` — names and folders are untouched.

On finish:

- `completedAt` is set and the **entire session is saved, including incomplete sets**
  (`completed: false`), so nothing is silently dropped from your record.
- Per-exercise "previous" is overwritten from this session's best completed weighted set
  (highest weight, then reps). It can therefore move down after a lighter workout.
- Recovery is recomputed from all sessions.
- Confetti plays, and a **"Good work"** screen shows duration, the exercises with at least one
  completed set, and a diagram of the muscles trained.

Incomplete sets are excluded from the summary, from "previous", and from recovery — but they are
still in the stored session.

**Volume and PRs are not computed at finish.** Both are derived on read by the screens that show
them, so there is no cached value to invalidate. See
[history-analytics.md](history-analytics.md).

## Constants

| Constant | Value |
|----------|------:|
| Default sets per exercise | 3 |
| Default rest | 120 s |
| Rest adjust step / floor | 30 s / 30 s |
| Persist debounce | 400 ms |
| Timer tick | 1000 ms |
| Rest-end sound grace window | 1500 ms |
| Minimum sets per exercise | 1 (no maximum) |
| kg ↔ lb factor | 2.20462 |
| Number pad ± step (weight) | 2.5 kg / 5 lb |
| Number pad ± step (reps) | 1 |
| Number pad digit cap | 4 weight / 3 reps |
| Confetti pieces | 48 |

## Assumptions

| Assumption | Note |
|------------|------|
| One workout at a time | Enforced in the store and at every entry point |
| Weight × reps is the only logging mode | `Exercise.trackingType` is ignored by this screen |
| Whole-number typed input | The in-app number pad has no decimal key; its −/+ keys still step by 2.5 kg / 5 lb, so a kg field can hold 2.5. lb→kg conversion rounds to 2dp |
| Sets are logged on a custom in-app pad | The OS keyboard is never raised for set entry, which is what makes Done single-tap and keeps rows visible |
| Rest runs after the last set of an exercise too | Simpler than special-casing; skip it if unwanted |
| Warm-ups don't trigger rest | But they *do* count as "completed" for recovery and volume |
| "Previous" is one snapshot per exercise | Best weighted set within the most recent qualifying session, not an all-time best or set-by-set history |
| Incomplete sets are stored, not discarded | They're excluded from every derived metric instead |
| A lapsed subscription can't block finishing | Gates apply to starting only |
| Exercise notes are per exercise, not per session | Intended for setup cues (seat height, pin position) |

## Tests

The **screen and its store still have no tests** — the largest coverage gap in the codebase,
covering the feature with the most state and the most edge cases.

Directly covered: `src/utils/keypadInput.test.ts` (the in-app number pad's entry maths).
Indirectly covered: `src/utils/weightUnits.test.ts` (unit conversion),
`src/utils/oneRepMax.test.ts` (the 1RM used by analytics, not by this screen).

Not currently covered:

- `activeWorkoutStore`: start / finish / discard, persist and hydrate round-trip, rest-key
  remapping when exercises are reordered or removed, prefill on complete and on add-set
- Set completion rules (`reps > 0`), warm-up numbering, warm-up not starting rest
- Replace-exercise preserving sets; add/remove remapping recorded rest
- Finish flow branches and the built-in vs custom save options
- Pro gate enforcement on the start-from-params path (the deep-link hole)
- Incomplete sets persisted but excluded from previous/recovery/summary
- Notification copy selection and schedule/cancel paths
