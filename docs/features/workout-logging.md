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
  weightPrefilled?: boolean;  // weightKg is an auto-suggestion, not user input (see prefill)
  repsPrefilled?: boolean;    // reps is an auto-suggestion, not user input
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
| Resume | Tab-bar pill, notification tap, or the "Workout in progress" themed dialog — no params |
| Deep link | `muscleos:///active-workout`, and notifications carrying `screen: 'active-workout'` |

A new session creates `defaultSets ?? 3` blank sets per exercise.

**Pro gates are enforced here, not only on the home screen**, because `/active-workout` is
reachable directly by deep link and notification tap: starting `_empty` needs `empty_workout`
and starting a custom template needs `custom_templates`. The check applies only to *starting* —
a session already in flight when a subscription lapses can still be finished.

**Only one workout at a time.** `startWorkout` no-ops if a session exists, and the home screen
blocks a second start with a themed confirm dialog: "Workout in progress — Finish or cancel
your current workout before starting another." **Cancel workout** discards the in-progress
session (no extra confirm) and continues the start that was blocked; **Resume workout** opens
it; tap the overlay to dismiss and keep it.

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
| **Cancel workout** (in-progress start dialog) | Discard immediately, then continue the blocked start |
| **Discard** (finish modal) | Discard without saving |
| **Resume pill X** | Discard immediately, no confirmation |
| **Finish** | Enabled only once at least one set is completed |

`finishWorkout()` sets `completedAt`, appends the session to `muscleos_sessions`, updates the
per-exercise "previous" snapshots, recomputes recovery from all sessions, clears the active
session, and queues a cloud sync.

## Set logging

Columns: **SET · PREVIOUS · KG/LB · REPS · Done**.

- Working sets are numbered `1, 2, 3…`; warm-ups are `W1, W2…` and are excluded from that count.
- Exactly **one** set is the **current** set across the whole workout: the first incomplete set of the first exercise that still has unlogged sets. It gets a primary row tint, a 3px primary bar on the left, the set number in a filled primary mark, and a primary-ringed Done control. Every other incomplete set — including those in later exercises — renders muted with an outlined number; there is never more than one highlighted set at a time.
- Completed rows tint green (success), with a matching left bar and a filled green set mark. Warm-ups have their own tint.
- When every set in an exercise is completed, the card is marked done: a green border and a **Done** badge in its header.
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
| Add or replace exercise | Same as session start, for the **new** exercise's snapshot. A replace discards the old movement's set values first — they are not carried over. |
| Completing a set | Copy that set's weight (not reps) into the next set if the next set's weight is empty — only when both are the same kind (warm-up vs working). |
| Adding a set | Copy the last set's weight and reps if present. |

Template targets are never used, because templates don't store any.

**Prefilled values are suggestions, not typed input.** Each prefilled field is flagged
(`weightPrefilled` / `repsPrefilled`) and rendered as muted ghost text. On the number pad the
suggestion behaves as if selected: the **first digit overwrites** it instead of appending, so a
fresh workout never needs a backspace before typing. Any edit to the field (a digit, backspace, or
±) or completing the set clears the flag, so re-opening a value you entered or logged edits it
normally (backspace to change). The flags are transient editing state — they are **stripped when
the session is saved on finish**, so stored and synced sessions never carry them.

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
  - **Weight** shows a primary **Next** that jumps to the same set's reps. A reserved **Plates**
    slot (a plate calculator, later) sits to the right of **0**.
  - **Reps** shows a success **Done** (check) that **completes the set** — starting rest for a
    working set — and then dismisses the pad, since a rest usually follows rather than the next
    set. Done is disabled until reps > 0. A reserved **RPE** slot for logging effort later (to
    inform recovery windows) sits to the right of **0**.
- **Backspace** is in the right-hand column, above Next/Done — the same place delete lives on a
  normal keyboard. The chevron key hides the pad. Neither reserved slot (Plates / RPE) is wired
  to anything yet.

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
The slot shows the countdown and a progress bar in full — time label and track are not clipped.
Tapping it opens rest controls with the remaining time, ±30 s, and Skip rest.

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
| **Add exercise** | Pro `add_exercise_mid_workout` | Adds with 3 empty sets, prefilled from that exercise's previous snapshot when one exists |
| **Replace exercise** | Pro `replace_exercise_mid_workout` | Swaps `exerciseId`. **Logged sets, warm-ups, and per-set rest of the old exercise are discarded** (they belong to a different movement). The slot keeps its rest preset and starts with 3 empty sets prefilled from the **new** exercise's previous snapshot. PREVIOUS follows the new id. |
| **Remove exercise** | No direct gate | Blocked only for a Basic user editing a built-in workout; otherwise a themed confirm ("Remove {name} from this workout?") removes it and remaps recorded rest. **Cancel** (or tap the overlay) dismisses; **Remove** removes. |

On a **built-in** template, add/replace/remove are blocked for Basic users with the built-in
alert rather than the paywall — the intended path is to edit the session and save it as a new
template (Pro). On Basic the button reads **"Pro: Add Exercise"**.

The exercise picker searches the full catalog plus your customs. Whenever the search box has text
the picker also offers **Create "<query>"** (gated on `custom_exercises`), so a missing movement can
be added even when the search has partial matches. It routes to `/create-exercise` pre-filled with
the query; saving returns to the workout and drops the new exercise straight in — added to the end
for the **Add** flow, or swapped in for the **Replace** flow.

## Finish flow

**Finish** is enabled once any set is completed. It opens a summary modal whose options depend on
what you started from and whether you changed the exercise list:

| Started from | Options |
|--------------|---------|
| Empty workout | Save as template (Pro) · Save values only · Discard |
| Built-in, list changed | Save as new template (Pro) · Save values only · Discard |
| Custom, list changed | Save values only · Overwrite this template (Pro) · Save as new template (Pro) · Discard |
| List unchanged | Save values · Discard |

"Overwrite" updates only the template's `exerciseIds` — names and folders are untouched.

Choosing **Save as template** / **Save as new template** swaps the summary to a name step
**within the same modal** (Save · Back) where you name the template before it's created. This is a
single native modal on purpose — stacking a second modal on top froze the app on physical iOS
devices.

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

The store's set-logging rules and the finish-flow decision are extracted into pure modules so
they can be unit-tested without a React Native renderer. The store (`activeWorkoutStore`) and the
screen (`active-workout.tsx`) import these, so the tests cover the real logic rather than a copy.

Covered:

- `src/store/activeWorkoutLogic.test.ts` — `createEmptySession` (default 3 / `defaultSets`),
  set-complete weight prefill (same warm-up/working kind only, never reps), add-set carry-over,
  `bestCompletedSet` / `buildPreviousSnapshot` (highest weight then reps; can move down; keeps a
  prior snapshot when nothing qualifies), warm-up insert bumping rest keys, rest-key remap on
  reorder / remove / replace, `canCompleteSet` (`reps > 0`), `shouldStartRestAfterComplete` (warm-ups don't),
  `startPrefillPatch` (empty sets only, flagged as suggestions), suggestion flags set on
  prefill/carry-over and cleared on complete, `stripPrefillFlags` (dropped before save),
  `buildReplacedExercise` (resets to default sets and prefills from the **new** exercise, not
  the one it replaced), `parseStartParams`, and `normalizeHydratedState` (an expired rest timer
  is dropped on boot)
- `src/utils/workoutSetView.test.ts` — warm-up (`W1…`) vs working (`1,2,3…`) numbering and the
  single "current" set rule (first incomplete set of the first unfinished exercise)
- `src/utils/workoutFinish.test.ts` — `templateListChanged`, the finish `variant` classifier, and
  the save-options matrix: a built-in is never offered "Overwrite"; a changed built-in only forks
  to a new template (Pro); a changed custom offers Overwrite + Save-as-new (both Pro)
- `src/storage/localStorage.activeWorkout.test.ts` — the persist/resume round-trip through the
  in-memory AsyncStorage harness, including null-clear and corrupt/invalid-payload guards
- `src/utils/workoutNotificationCopy.test.ts` — "Next:" / "Continue to" / "Finish your workout"
  selection, including wrap-around to an earlier unfinished exercise
- Deep-link Pro gate: `src/subscription/features.test.ts` (`blockedStartFeature`)
- Number pad entry maths: `src/utils/keypadInput.test.ts`. Indirectly: `weightUnits`, `oneRepMax`

Not currently covered (need a React Native renderer):

- The screen's live rendering, and the debounced-persist / `AppState`-backgrounding write wiring
  inside `activeWorkoutStore` (the pure pieces it delegates to are covered above)
- The notification *scheduling* side effects (channel setup, `scheduleNotificationAsync` timing)
  as opposed to the body copy
