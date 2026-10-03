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
  restBetweenSetsSeconds?: number;  // omitted → 120; 0 → no rest
  warmUpRestSeconds?: number;       // omitted or 0 → warm-ups do not start a timer
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
| Template (built-in or custom) | Home → preview → `/active-workout` with `templateId`, `exerciseIds`, optional parallel `sets` / `warmUpSets` (legacy `defaultSets` still accepted) |
| Empty / ad-hoc workout (Pro) | Home → `/active-workout` with `templateId: '_empty'`, no exercises |
| Resume | Tab-bar pill, notification tap, or the "Workout in progress" themed dialog — no params |
| Deep link | `muscleos:///active-workout`, and notifications carrying `screen: 'active-workout'` |

A new session creates each exercise's template plan: `warmUpSets` (default 0) blank warm-up
rows, then `sets` (default 3) blank working rows. Strong Lifts slots ship with 5 working sets.
`startWorkout` then loads the per-exercise "previous" snapshots and applies the session-start
prefill (below) **once** — reopening or remounting the screen never prefills again, so a value
you cleared stays cleared.

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
mirrored to AsyncStorage under `muscleos_active_workout`, **debounced 400 ms** (a burst of edits —
one per keypad digit — coalesces into one write), plus an immediate write when the app
backgrounds. Nothing is written until boot hydration has finished. `hydrateActiveWorkout()`
restores it during app boot. A rest timer that expired while the app was dead is dropped, but
first its full duration is recorded against the set it followed, exactly as if the app had seen
it end.

### Stale workouts

The store tracks `lastActivityAt`: stamped at start and on every edit to the session (logging,
completing, adding/removing sets or exercises, rest presets). Rest-timer ticks don't count.
Snapshots from before this field existed count from `startedAt`.

After boot hydration and whenever the app returns to the foreground, a workout idle for
**3 hours or more** is closed **silently**, with no prompt:

| Stale workout has… | Result |
|--------------------|--------|
| At least one completed set | Finished with `completedAt = lastActivityAt`, so history duration, recovery, and "trained today" reflect when the lifting happened, not when the app was next opened |
| No completed sets | Discarded |

There's no cap on total duration — a workout still being edited stays open however long it runs.

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

Columns: **SET · PREVIOUS · KG/LB · REPS · Done**. The set table runs the full width of the exercise card with no inner frame, and the weight and reps cells are large filled wells (every editable cell looks the same; only the focused one gets the accent ring) so they're easy to hit mid-set.

- Working sets are numbered `1, 2, 3…`; warm-ups are `W1, W2…` and are excluded from that count.
- Exactly **one** set is the **current** set across the whole workout: the first incomplete set of the first exercise that still has unlogged sets. It gets a primary row tint, a 3px primary bar on the left, the set number in a filled primary mark, and a primary-ringed Done control. Every other incomplete set — including the first set of later exercises — is "upcoming": it renders muted with an outlined number; there is never more than one highlighted set at a time. The set number's accessibility label reads `Set <n>, current | upcoming | completed`.
- Completed rows tint green (success), with a matching left bar and a filled green set mark. Warm-ups have their own tint. A rest row between two completed sets carries the same tint and bar (no divider line), so a run of completed sets reads as one unbroken green column.
- When every set in an exercise is completed, the card is marked done: a green border and a green check icon before the exercise name.
- After a set is completed, the actual rest taken is displayed under its number. Until that duration is shown, the set number stays vertically centered on the row.
- A rest row sits on the divider after a set when that set's rest duration is greater than 0 (and after the last such set, above Add set). It shows that duration, or the countdown while a timer is running for that set. While counting down, the divider itself becomes the progress track: it thickens and fills with the primary colour edge to edge across the row as the rest elapses, gliding between the one-second ticks. Tapping the row opens the same dialogue as the header timer: rest controls while a countdown is running, otherwise the manual start-rest picker.

### Previous values and prefill

**PREVIOUS** shows the same value for every set of an exercise: the highest-weight completed set
(then highest reps as a tie-break) from the **most recent qualifying session** for that exercise,
formatted `weight × reps` in the display unit (`56.25 × 8`; the KG / LB column header beside it
carries the unit), `60 kg` when the snapshot has no reps, or `—`. The label shrinks to fit rather
than truncating. It is not an all-time best and does not preserve set-by-set values.

Prefill rules:

| When | Behaviour |
|------|-----------|
| Session starts (once, in `startWorkout`) | For any **working** set with **both** weight and reps empty, copy the previous snapshot's weight and reps. Warm-up rows are left empty. Partially filled sets (including anything typed while the snapshot loads) are left alone. |
| Add or replace exercise | Same as session start, for the **new** exercise's snapshot. A replace discards the old movement's set values first — they are not carried over. |
| Completing a set | Copy that set's weight (not reps) into the next set if the next set's weight is empty — only when both are the same kind (warm-up vs working). |
| Adding a set | Copy the last set's weight and reps if present. |

Template targets are never used for weight or reps — only the number of warm-up and working
rows comes from the template.

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

- **Whole numbers only** — no decimal key. A typed digit never extends a fraction: if −/+ has
  left a plate increment in the field, the next digit replaces it with a new whole number.
  Backspace on a fraction snaps to that whole number first (97.5 → 97, 0.25 → empty), then
  deletes digits. Weight is displayed in the user's unit and converted back to kg on write;
  a pounds value keeps 1 decimal and kg is stored to 2dp after conversion. Entry is capped at
  **4 digits for weight, 3 for reps**.
- **− / +** nudge the focused field by a plate step — **0.25 kg / 2.5 lb** for weight, **1** for
  reps — clamping to empty at zero. Those keys are the only way to enter a fraction.
- The **action key adapts to the field**, because logging a weight and finishing a set are
  different intents:
  - **Weight** shows a primary **Next** that jumps to the same set's reps. A reserved **Plates**
    slot (a plate calculator, later) sits to the right of **0**.
  - **Reps** shows a success **Done** (check) that **completes the set** — starting that set's
    rest — and then dismisses the pad, since a rest usually follows rather than the next
    set. Done is disabled until reps > 0. A reserved **RPE** slot for logging effort later (to
    inform recovery windows) sits to the right of **0**.
  - **Time** is only the rest-duration boxes on **Update rest timers**. −/+, Plates, and RPE
    are hidden. Digits shift into `m:ss` from the right (the first digit replaces the current
    time); a seconds value above 59 or a total past 15:00 is ignored, and 0:00 is allowed.
    **Next** moves from Work set to Warm up; **Done** hides the pad.
- **Backspace** is in the right-hand column, above Next/Done — the same place delete lives on a
  normal keyboard. The chevron key hides the pad. Neither reserved slot (Plates / RPE) is wired
  to anything yet.

The pure entry maths (append, backspace, ± clamping, digit caps, `m:ss` clock entry) and what each
key does (`applyKeypadKey` for set cells, `applyRestTimeKey` for the time boxes) live in
`src/utils/keypadInput.ts`; the screen only applies the outcome.

### Completing, adding, removing

- **Done** requires `reps > 0` (the control is disabled until then); weight is optional.
  Completing a set **auto-starts the rest timer** for that set's duration: the work-set rest
  after a working set (default 120 s; an explicit 0:00 starts nothing), and the warm-up rest
  after a warm-up (only when that duration is greater than 0). Both the row's Done and the pad's
  Done go through the store's `toggleSetComplete`.
- **Tapping Done on a completed set un-completes it.** It only flips `completed` back: the
  weight and reps stay, a countdown running for *that* set is cancelled, and nothing else is
  undone — the weight already carried into the next set stays, prefill flags aren't restored, and
  a recorded rest duration is kept (hidden until the set is completed again). The pad's Done on an
  already-completed set just hides the pad.
- **+ ADD SET** appends a set; the button label shows the current rest preset. The control is a full-width footer of the set table, separated from the last row by the same divider as the set rows, and shares the table’s edges.
- **Swipe left** deletes a set immediately. **Long-press a set number** asks first, with the
  themed confirm dialog ("Remove set — Delete this set from the exercise?", **Cancel** /
  **Remove**). Deleting a set cancels a countdown running for it. Minimum **1 set** per exercise
  (neither gesture is offered on the last one); no maximum.
- **Add warm-up** inserts a warm-up set at position 0.

## Rest timer

| Setting | Value |
|---------|------:|
| App default (`DEFAULT_REST_SECONDS`) | **120 s** (working sets, when omitted) |
| Running timer step | ±30 s, not snapped to a 30 s grid |
| Running timer floor / ceiling | 30 s total / 15:00 (900 s) total; −30 never leaves less than 1 s |
| Typed preset | any `m:ss` from 0:00 to 15:00, not snapped to 30 s |
| Manual picker (header) | 60 / 120 / 180 s |

There is **no rest-duration setting in Settings** — the default is a code constant, overridable
per exercise within a session. Per-exercise rest applies after **every set of that kind**,
including the last. A working set uses `restBetweenSetsSeconds` (omitted means 120; explicit 0
means no timer). A warm-up uses `warmUpRestSeconds` (omitted or 0 means no timer).

The timer is derived from an absolute `restEndTime`, so it stays correct across backgrounding
and app restarts. **Skip rest** records the time actually rested (total minus the whole seconds
left) and clears the timer; recorded durations are kept per set and shown under the set number.
When a countdown reaches zero its **full duration** is recorded and the timer clears. A manual
rest (header picker) is not tied to a set, so nothing is recorded for it.

The header dialogue's ±30 (`adjustRunningRest`) moves the end time and the total by the same
amount, so the progress bar and the duration recorded at the end stay true:

- **+30** adds up to 30 s, capping the total at 15:00.
- **−30** removes up to 30 s, but never takes the total below 30 s or leaves less than 1 s on the
  clock. At a 30 s total it does nothing.

A rest row sits after a set when that set's duration is greater than 0, so completing the set
does not shove the rows below — the countdown replaces the preset in that same row. Tapping it
opens the header rest dialogue (running-timer controls, or the manual picker when nothing is
counting). It does not edit the row in place. The header dialogue's ±30 buttons change only the
countdown already running.

**Update rest timers** (exercise menu) sets the work-set and warm-up rests for the following sets
of that exercise, for the rest of this workout. They are stored on the session's exercise only —
not on the template, and not carried into later workouts. It does not change a countdown that is
already running. The dialogue's hint reads "A running timer is not affected. Applies to the next
sets of this exercise for the rest of this workout." Each duration is a time box. Tapping a box
opens the logging keypad in time mode (digits only, `m:ss`, 0:00–15:00). **Next** moves from
Work set to Warm up; **Done** hides the keypad. **Update rest timers** writes both durations
onto the exercise.

### Sounds

Gated by the `workoutSoundsEnabled` setting (default **on**), and configured to play in silent
mode.

| Sound | Trigger |
|-------|---------|
| `restTick` | Rest countdown at 3, 2, 1 seconds — once per second, only while counting down |
| `restEnd` | Rest reaches zero while the app is in the foreground (noticed within 1500 ms of the end) |
| `setComplete` | A set is marked complete |
| `workoutComplete` | Workout finished |

There are **no haptics** in the app and no haptics setting. The Android rest-over notification
vibrates via its channel.

### Notifications

Two delivery paths:

- **Android dev/production builds** use a native module (`modules/workout-live-notification`)
  for an ongoing notification with a platform chronometer, plus an **exact alarm** for rest-over.
- **iOS and any build without the native module** use `expo-notifications`: a silent ongoing
  tray entry (`active-workout`; on iOS posted at the **passive** interruption level, so it goes
  straight to Notification Center with no banner when the app is backgrounded or the entry
  updates) and a scheduled `rest-complete` alert at `restEndTime`, sent with iOS time-sensitive
  interruption level.

Notification bodies name the upcoming work — `Next: <exercise>`, `Continue to <exercise>`, or
`Finish your workout` — derived from the first exercise with incomplete sets. While resting, the
current exercise stays `Next:` if it has sets left; otherwise the copy advances (`Continue to`) to
the next unfinished exercise, wrapping round to earlier ones. Tapping any of them opens the
active workout (`data.screen: 'active-workout'`).

| Path | Title | Body |
|------|-------|------|
| expo-notifications tray, resting (iOS, or Android backgrounded) | `MuscleOS — Workout` | `Rest until <clock time> • <next>` — an absolute time, so the entry never goes stale and costs one write |
| expo-notifications tray, resting (Android foreground) | `MuscleOS — Workout` | `Rest m:ss • <next>`, rewritten every second |
| expo-notifications tray, not resting | `MuscleOS — Workout` | `<next>` |
| Native Android live notification | `Resting` / `Workout in progress` | `<next>`, with a platform chronometer while resting |
| Rest-over alert (both paths) | `Rest over` | `Time for <exercise>`, or `Time to finish your workout` |

The rest-over alert's sound follows `workoutSoundsEnabled`; with sounds off it still arrives,
silently. In the foreground the OS alert is suppressed (cancelled / `alertEnabled: false`) and the
in-app timer and sound handle it.

When rest completes while the app is backgrounded, the OS notification fires and the handler
records the rest duration and clears the timer on return, so the two paths don't double up. The
in-app sound is suppressed in that case.

What happens to the scheduled alert is `restAlertAction()`: resting in the background schedules
it; in the foreground it's cancelled (and a delivered one dismissed). When the rest ends while
the app is still backgrounded — JS can keep running briefly and end the rest at the same moment
the OS fires — the alert is **kept**: cancelling then would withdraw the alert just delivered, or
drop it before it fires. Returning to the app clears it.

**Exact alarms (Android 13+).** On the first rest timer of a launch, if exact alarms aren't
permitted, the app prompts once ("Let rest alerts fire on time"), explaining that alerts may
otherwise be up to a minute late. The prompt-shown flag persists in
`muscleos_exact_alarm_prompt_shown`. Without permission an inexact alarm is used.

Notifications are skipped entirely in Expo Go, which can't load the native modules.

## Mid-workout edits

| Action | Tier | Behaviour |
|--------|------|-----------|
| **Reorder exercises** | Basic | Long-press an exercise title to enter drag mode |
| **Edit rest for an exercise** | Basic | **Update rest timers**: work-set and warm-up rests, each any `m:ss` from 0:00 to 15:00, entered with the time keypad. Saved for the next sets of that kind; a running countdown is left alone. 0:00 means that kind does not start a timer |
| **Exercise note** | Basic | Stored per exercise id in `exerciseNotesStore`, not on the session — so it persists across workouts |
| **Add exercise** | Pro `add_exercise_mid_workout` | Adds with 3 empty sets, prefilled from that exercise's previous snapshot when one exists. An exercise already in the workout can't be added again |
| **Replace exercise** | Pro `replace_exercise_mid_workout` | Swaps `exerciseId`. **Logged sets, warm-ups, and per-set rest of the old exercise are discarded** (they belong to a different movement), and a countdown running for that slot is cancelled. The slot keeps its rest preset and starts with 3 empty sets prefilled from the **new** exercise's previous snapshot. PREVIOUS follows the new id. Replacing with an exercise already in the workout (including itself) does nothing |
| **Remove exercise** | No direct gate | Blocked only for a Basic user editing a built-in workout; otherwise a themed confirm ("Remove {name} from this workout?") removes it and remaps recorded rest. **Cancel** (or tap the overlay) dismisses; **Remove** removes. |

On a **built-in** template, add/replace/remove are blocked for Basic users with the built-in
alert rather than the paywall — the intended path is to edit the session and save it as a new
template (Pro). On Basic the button reads **"Pro: Add Exercise"**.

The exercise picker (`pickerResults`) searches the full catalog plus your customs, **leaving out
every exercise already in the workout** — in both Add and Replace mode — so a workout never holds
the same exercise twice (the store's `addExercise` / `replaceExercise` refuse a duplicate too).
Whenever the search box has text the picker also offers **Create "<query>"** (gated on
`custom_exercises`), so a missing movement can be added even when the search has partial matches.
When a search with text finds nothing, "No matching exercises" shows above the Create row; an
empty search shows neither. It routes to `/create-exercise` pre-filled with
the query; saving returns to the workout and drops the new exercise straight in — added to the end
for the **Add** flow, or swapped in for the **Replace** flow.

## Finish flow

**Finish** is enabled once any set is completed. It opens a summary modal whose options depend on
what you started from and whether you changed the template — the exercise list *or* per-exercise
working/warm-up row counts (incomplete rows still count):

| Started from | Options |
|--------------|---------|
| Empty workout | Save as template (Pro) · Save values only · Discard workout |
| Built-in, list or set structure changed | Save as new template (Pro) · Save values only · Discard workout |
| Custom, list or set structure changed | Save values only · Overwrite this template (Pro) · Save as new template (Pro) · Discard workout |
| Unchanged (built-in or custom) | Save values · Discard workout |

The first option is the filled primary button, other saves are outlined, and **Discard workout**
is a muted text button. On Basic the Pro options carry a lock icon; tapping one closes the summary
before opening the paywall (`save_as_template`) — a native modal left open would cover the pushed
paywall — and the workout keeps running. A changed custom template also shows the hint "You changed the exercises
in this workout." A **Back** button under the options closes the modal and returns to the workout,
as does tapping outside the card.

The summary lists duration and each exercise with completed sets (`<n> set(s) · 60 × 5 reps, …`).
The list scrolls inside the modal so the actions stay on screen, and its bottom edge fades out
while more exercises sit below.

"Overwrite" updates the template's `exerciseIds` and per-exercise set structure from the
session (working vs warm-up row counts, including incomplete rows) — names and folders are
untouched. **Save as template** writes the same structure onto a new custom template.

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
- Confetti plays, and a **"Good work"** screen shows the template name ("Empty workout" for an
  ad-hoc session, "Workout" if the template is gone), three stats — **Duration**, **Exercises**
  (with at least one completed set) and **Sets** (completed) — a diagram of the muscles trained,
  and a summary of each exercise's completed sets (`60 kg × 5 reps  ·  …`). **Done** returns to
  the tabs.

Incomplete sets are excluded from the summary, from "previous", and from recovery — but they are
still in the stored session.

**Volume and PRs are not computed at finish.** Both are derived on read by the screens that show
them, so there is no cached value to invalidate. See
[history-analytics.md](history-analytics.md).

## Constants

| Constant | Value |
|----------|------:|
| Default working sets per exercise | 3 |
| Default rest | 120 s |
| Rest adjust step / floor / ceiling | 30 s / 30 s total / 900 s total (−30 leaves ≥ 1 s) |
| Persist debounce | 400 ms |
| Stale workout idle threshold | 3 h |
| Timer tick | 1000 ms |
| Rest-end sound grace window | 1500 ms |
| Minimum sets per exercise | 1 (no maximum) |
| kg ↔ lb factor | 2.20462 |
| Number pad ± step (weight) | 0.25 kg / 2.5 lb |
| Number pad ± step (reps) | 1 |
| Number pad digit cap | 4 weight / 3 reps |
| Confetti pieces | 48 |

## Assumptions

| Assumption | Note |
|------------|------|
| One workout at a time | Enforced in the store and at every entry point |
| Weight × reps is the only logging mode | `Exercise.trackingType` is ignored by this screen |
| Whole-number typed input | The in-app number pad has no decimal key. −/+ is the only way to enter a fraction, stepping by 0.25 kg / 2.5 lb. A digit typed onto a fraction replaces it; backspace snaps the fraction off first. lb→kg conversion rounds to 2dp |
| Sets are logged on a custom in-app pad | The OS keyboard is never raised for set entry, which is what makes Done single-tap and keeps rows visible |
| Rest runs after the last set of an exercise too | Simpler than special-casing; skip it if unwanted |
| Warm-ups rest only when a warm-up duration is set | 0:00 (the default) does not start a timer. Warm-ups still count as "completed" for recovery and volume |
| "Previous" is one snapshot per exercise | Best weighted set within the most recent qualifying session, not an all-time best or set-by-set history |
| Incomplete sets are stored, not discarded | They're excluded from every derived metric instead |
| A lapsed subscription can't block finishing | Gates apply to starting only |
| Exercise notes are per exercise, not per session | Intended for setup cues (seat height, pin position) |

## Tests

The set-logging, rest, keypad and finish rules are extracted into pure modules that the store
(`activeWorkoutStore`) and the screen (`active-workout.tsx`) import, so the unit tests cover the
real logic rather than a copy. The screen itself is covered by Jest UI tests that mount it through
the real router.

**Vitest (pure logic and store):**

- `src/store/activeWorkoutLogic.test.ts` — `createEmptySession` (default 3 working / optional
  warm-ups / per-exercise counts), set-complete weight prefill (same warm-up/working kind only,
  never reps), add-set carry-over, `bestCompletedSet` / `buildPreviousSnapshot` (highest weight
  then reps; can move down; keeps a prior snapshot when nothing qualifies), warm-up insert bumping
  rest keys, rest-key remap on reorder / remove / replace, `canCompleteSet`,
  `restDurationAfterComplete`, `storedRestSeconds`, `startPrefillPatch` and `prefillSession`
  (empty working sets only, flagged; warm-ups and partial sets skipped), `stripPrefillFlags`,
  `adjustRunningRest` (+30 cap at 15:00, −30 floors the total at 30 s and leaves ≥ 1 s, no-op at
  30 s, total and end move together), `restTakenSeconds` / `restSecondsLeft`, `resolveRestEnd`
  (full duration recorded, manual rest records nothing, 1500 ms sound grace), `shouldPlayRestTick`
  (3, 2, 1 only while counting down), `sessionHasExercise`, `buildReplacedExercise`,
  `parseStartParams` / `encodeStartParams`, `normalizeHydratedState` (expired rest dropped after
  recording its duration; legacy `lastActivityAt`), and `resolveStaleWorkout`
- `src/store/activeWorkoutStore.test.ts` — `lastActivityAt` stamping and the stale close after
  hydration and on foreground (overlapping closes save once); one workout at a time; 1-set
  minimum; finish saving the whole session; the **debounced persist** (writes after 400 ms,
  coalesces a burst, nothing before hydration) and the immediate **background** write; start
  prefill applied once and never re-applied, keeping edits made while it loads; hydrate recording
  an expired rest; `toggleSetComplete` (reps gate, work/warm-up rest, un-complete cancels only its
  own countdown, carried weight not taken back); `skipRest`, `endRestIfDue`, ±30; `addWarmUpSet`,
  `addSet`, `removeSet` / `removeExercise` / `replaceExercise` clearing an active rest; duplicate
  add/replace guards
- `src/utils/keypadInput.test.ts`, `src/utils/keypadInput.keys.test.ts` — entry maths, and
  `applyKeypadKey` (first digit overwrites a suggestion, any edit clears the flag, digit caps,
  lb→kg on write, ± steps, Next → reps, Done disabled until reps > 0 / completes and closes /
  only closes on a completed set) and `applyRestTimeKey` (time mode)
- `src/utils/workoutSetView.test.ts` — `W1`/`1,2,3` numbering, the single current set,
  `setRowView` (upcoming across exercises, rest row presence and countdown, green join) and
  `previousLabel` (`weight × reps` with no unit, unit kept without reps)
- `src/utils/workoutFinish.test.ts` — change detection, the finish variant and option matrix,
  `cancelDialogMeta`, `buildFinishSummary`, `formatSummarySet`
- `src/utils/workoutNotificationCopy.test.ts` — body selection (Next / Continue to / Finish, with
  wrap-around), alert copy, titles, `trayNotificationContent` (`Rest until <clock> • …` vs
  `Rest m:ss • …`), and `restAlertAction` (schedule / cancel / keep after a background rest end)
- `src/utils/exercisePicker.test.ts` — `pickerResults` exclusion and `pickerFooter`
- `src/utils/formatClock.test.ts` — the shared `m:ss` formatter
- `src/storage/localStorage.activeWorkout.test.ts` — persist/resume round-trip and guards
- Deep-link Pro gate: `src/subscription/features.test.ts` (`startFromParamsDecision`)

**Jest UI (`src/test/ui/workout/`):**

- `logging.test.tsx` — starting a built-in from route params (Pro and Basic), prefill ghost values
  and PREVIOUS, W1/1/2/3 numbering, number-pad entry (kg and lb, suggestion overwrite, ±,
  Next → reps), Done completing on the first tap from the pad and the row, un-complete, Done
  disabled without reps, current/upcoming/completed labels across exercises and the done card,
  the header rest dialog (±30, Skip, recorded rest), the rest row opening the manual picker, a
  countdown ending, + ADD SET, add warm-up, long-press delete with the themed confirm, swipe
  delete, and the 1-set minimum
- `finish.test.tsx` — Finish disabled until a set is completed, the option matrix (unchanged
  built-in / changed built-in incl. set count / empty / changed and unchanged custom), the
  custom-changed hint, Back, the save-as-template name step and its Back, summary contents,
  Discard workout, the Good-work screen (Exercises and Sets counts, set detail, saved session
  keeping incomplete sets, Done), and the cancel dialog (no fact line vs `m:ss · N sets`, Keep,
  Discard)
- `picker.test.tsx` — exclusion of exercises already in the workout, adding a row, Create row with
  and without matches, "No matching exercises", routing to `/create-exercise`
- `resume.test.tsx` — the resume pill (hidden / elapsed / opens the workout / X discards with no
  confirm) and the home screen's "Workout in progress" dialog (Resume, Cancel continues the
  blocked start, overlay keeps)

Not currently covered:

- The exercise ⋯ menu (Update rest timers, Replace, Remove, Add warm-up) in UI tests: it is
  positioned with `measureInWindow`, which never calls back under the test renderer, so the menu
  never opens there. The rules behind it are unit-tested (`applyRestTimeKey`,
  `storedRestSeconds`, `buildReplacedExercise`, store add/replace/remove tests).
- Drag-to-reorder gestures, swipe *gesture* physics (the test presses the swipe action), sounds
  actually playing, confetti, and the muscle diagram's rendering.
- The notification *scheduling* side effects (channel setup, `scheduleNotificationAsync` timing,
  the Android native module) as opposed to the copy, which is pure and tested.
