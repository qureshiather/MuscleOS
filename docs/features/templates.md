# Workout Templates

A template is an **ordered list of exercises** with a name, plus how many working and warm-up
sets each exercise should start with and how long to rest after them. Templates do not carry
target weights or reps — they prescribe structure, not load.

| | |
|--|--|
| Home screen | `apps/mobile/app/(tabs)/index.tsx` (tab title **Workouts**) |
| Create / edit | `apps/mobile/app/create-template.tsx` |
| Programs | `apps/mobile/app/programs.tsx`, `apps/mobile/app/program.tsx`, `src/utils/programs.ts` |
| Preview | `apps/mobile/app/workout-preview.tsx` |
| Store | `apps/mobile/src/store/templatesStore.ts`, `src/store/templatesLogic.ts`, `src/utils/templateExercises.ts`; the chosen program is `activeProgramId` in `src/store/settingsStore.ts` |
| Built-in content | `apps/mobile/src/data/builtInTemplates.ts` (templates, folders, `BUILT_IN_PROGRAMS`) |
| Suggestions | `apps/mobile/src/utils/recommendTemplates.ts`, `src/utils/workoutsHome.ts` |
| Template cards | `apps/mobile/src/components/workouts/TemplateCard.tsx`, `src/utils/templateCard.ts` |
| Home headline | `apps/mobile/src/utils/homeStats.ts` |

`/templates` is a legacy route that redirects to the Workouts tab.

## Data model

`packages/types/src/workout.ts`:

```ts
interface TemplateExercise {
  exerciseId: string;
  sets?: number;         // working sets; omitted → 3
  warmUpSets?: number;   // omitted → 0
  restBetweenSetsSeconds?: number; // omitted → your Default rest (Settings, 2:00 unless changed); 0 → no timer
  warmUpRestSeconds?: number;      // omitted or 0 → warm-ups start no timer
}

interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  exerciseIds: string[];          // ordered; kept in sync with exercises
  exercises?: TemplateExercise[]; // per-exercise set structure
  defaultSets?: number;           // legacy template-wide default; unused once exercises is present
  isBuiltIn?: boolean;
  folderId?: string;
  hidden?: boolean;               // custom templates only; ignored on built-ins
}

interface TemplateFolder {
  id: string;
  name: string;
  favorite?: boolean;  // pinned above normal folders
  archived?: boolean;  // moved to an Archived group
}
```

`exerciseIds` stays the ordered list every reader already uses. `exercises` is the per-exercise
plan written on every custom-template save. Omitted `sets` means 3 working sets; omitted
`warmUpSets` means 0. The two rests use the same meaning as on a session exercise
([workout-logging](workout-logging.md#rest-timer)), clamped to 0:00–15:00. An omitted work rest
follows your **Default rest** (Settings, 2:00 unless changed), so changing the default changes
every slot that doesn't set its own; an explicit value, 2:00 included, is kept. The editor stores a
rest equal to the current default as omitted (`editorRestPatch()`), and a 0:00 warm-up rest is
omitted too. `defaultSets` is only a read fallback for templates stored before this
field existed — Strong Lifts used to set `defaultSets: 5` for the whole workout; it now stores
`sets: 5` on each slot instead.

Notably absent: target weight/reps, supersets, and any notion of a program week or day
sequence. The set counts only change how many blank warm-up and working rows are created when
the workout starts, and the rests are copied onto the session's exercises at start (carried in the
start params as `rest` / `warmUpRest`, parallel lists where a blank entry means the default).
Built-in templates set no rests.

## Built-in vs custom

The core distinction, and the reason for most of the behaviour on this screen. See also
[product/overview.md](../product/overview.md#the-central-assumption-built-in-vs-custom).

| | **Built-in** | **Custom** |
|--|--------------|------------|
| Source | `BUILT_IN_TEMPLATES` constant, compiled in | AsyncStorage `muscleos_templates` |
| Ids | Fixed and stable (`ppl-push`, `sl-a`) | `tpl_<timestamp>_<random>` |
| `isBuiltIn` | `true` | `false` |
| On the Workouts tab | Only as the days of the **one program** you chose ([Your workouts](#your-workouts)) | Always (hidden ones under **Hidden**) |
| Rename / edit / move / delete / hide | **Not possible** — no menu; the program is added or removed as a whole | Yes — hiding sets `hidden: true` on the record (synced with it) |
| Cloud sync | N/A (shipped code); the chosen program id syncs in app settings | Yes, when an account is linked — the whole record, including `hidden` and `folderId` |

`allTemplates()` returns `[...BUILT_IN_TEMPLATES, ...userTemplates]` — built-ins always first.

**Attempting to edit a built-in.** There is no rename/edit/move/delete in the built-in context
menu at all, and `/create-template?templateId=<built-in id>` shows **Template not found**. A
built-in *workout* can still be changed freely while it runs (add, replace, remove, reorder
exercises) — that changes the session, never the template.

That is the intended escape hatch: run the built-in, change the session as you go, then save the
result as a **new** custom template. There is no "duplicate template" action; saving from a
finished session is the way to fork one.

**Removed from the list, never deleted.** Built-ins can't be deleted because their ids are
referenced by past sessions and by the shipped constant. Removing or switching a program only
changes which one Your workouts shows; every built-in id keeps resolving (History, the
preview). Built-ins can't be hidden one by one. A custom template's `hidden` flag is part of its
record and syncs with it.

## Shipped built-in templates

Four folders, thirteen templates (asserted, and validated against the exercise catalog, in
`src/data/builtInTemplates.test.ts`). Each folder is a **program** (`BUILT_IN_PROGRAMS`), which adds
what the Programs screen shows: a one-line summary, days per week and a level. The Programs screen
lists them in this order: Strong Lifts 5x5 (3 days/wk, Beginner), Push Pull Legs (3–6, Beginner),
Upper Lower Splits (4, Intermediate), PHUL (4, Intermediate).

| Folder | Templates | Exercises each |
|--------|-----------|---------------:|
| **Push Pull Legs** (`builtin_ppl`) | Push, Pull, Legs | 6 |
| **Upper Lower Splits** (`builtin_ul`) | Upper A, Lower A, Upper B, Lower B | 6 |
| **Strong Lifts 5x5** (`builtin_sl`) | Workout A, Workout B | 3 (5 working sets each) |
| **PHUL** (`builtin_phul`) | Upper Power, Lower Power, Upper Hypertrophy, Lower Hypertrophy | 5–7 (3–4 working sets each) |

PHUL (Power Hypertrophy Upper Lower) runs four days a week. Templates carry set counts but not
reps, so each day's description gives its rep ranges: 3–5 on the power compounds, 6–15 elsewhere.

Every `exerciseId` in a built-in template is asserted to exist in `CATALOG_SEED`, so a shipped
template can never reference a missing exercise.

## Home screen

Renders top to bottom:

**1. Header.** Title "Workouts" and a one-line status headline (see
[Home headline](#home-headline)) — not a stats ticker.

**2. Empty workout hero.** A full-width primary banner, **Empty workout** / "Add exercises as you
go", starts a session with no exercises. It skips the preview screen and goes straight to `/active-workout` with
`templateId: '_empty'`. If a session is already in progress, the "Workout in progress" dialog is
shown instead ([workout-logging](workout-logging.md#starting)).

**3. Suggested** (only when non-empty). Up to **2** templates in a 2-column grid, chosen by
[recommendTemplates](#suggested-templates) over [Your workouts](#your-workouts) only — the chosen
program's templates and your visible custom ones (`yourWorkoutTemplates()` in
`src/store/templatesLogic.ts`, fed to `suggestHomeTemplates()` in `src/utils/workoutsHome.ts`).
Recovery decides what to target next; a program only adds its days to the pool, so a program day
whose muscles are still recovering isn't suggested. It never suggests a hidden template or a
program you aren't following. Each is a [muscle art card](#muscle-art-cards) with the name and
exercise count.

There is no Recent row: with a program chosen by default, Suggested and the program's own
workouts already cover what to do next, and History lists what was done.

### Muscle art cards

Suggested cards have no description or reason text. Behind the name, the template's
muscles are drawn as a **zoomed body figure** that bleeds off the card's right edge and fades into
the card under the label (`MuscleZoomArt` in `src/components/workouts/`).

- **Muscles:** every muscle of every exercise in the template, mapped onto the Recovery diagram's
  regions (`MUSCLE_ID_TO_DIAGRAM_REGION`).
- **Colours:** each region uses the Recovery tab's colours for its current state: ready, recovering,
  or just trained (`regionStatesByView()`). A region shared by several muscles (delts, upper
  back) takes the least-recovered state. Delts are split by view as on the Recovery diagram: the
  front figure's deltoids are front + side delts, the back figure's are side + rear delts.
- **Focus:** the crop frames only the regions the template is mostly about: regions trained by
  **two or more** of its exercises (`focusRegions()`). A region only one accessory exercise trains
  stays coloured but out of frame, so Plank on leg day doesn't zoom out to the abs. When no region
  repeats, every region counts.
- **Side:** front or back, whichever shows more of the focus regions by summed bounding-box area;
  ties go to the front (`pickFigureSide()` in `src/utils/bodyCrop.ts`).
- **Crop:** the union of the focus regions' boxes, padded by 12% of its larger side, at least 360
  figure units tall, then widened or heightened around its centre to the art's aspect
  (`cropToRegions()`). With no resolvable muscles it falls back to a front shoulders-to-waist crop.
- **Figure:** the same male or female figure as the Recovery tab, from the profile's sex.

**5. Your workouts.** Header **Your workouts** with a new-folder button and a **New** button, then
the [Your workouts](#your-workouts) list.

### Template cards

Cards share the History card's look: the card surface with a border (and a soft shadow in light
mode). Top to bottom (`templateCardModel()` in `src/utils/templateCard.ts`):

- The name, with its size in mono on the right — `3 exercises · 15 sets` (working sets) — and the
  menu for custom templates.
- The optional description.
- The exercise lineup: every exercise name in order, joined with `·`, up to two lines.
- Below a hairline: up to **3** muscle pills (the first-listed muscle of each exercise, once each,
  in order), `Last done: <relative>` when a completed session exists for it (the most recent one —
  `lastDoneByTemplate()`), and a chevron.

Tapping a card opens **`/workout-preview`**, not the workout directly, passing the template id and
its set plan. Cards in the program section have no menu. The routing decision is `decideTemplateStart()` in `src/utils/workoutsHome.ts`: an
in-progress session → the "Workout in progress" dialog
([workout-logging](workout-logging.md#starting)); otherwise preview (built-in and custom templates
alike) or `/active-workout` (empty).

### Context menus

Items come from `templateMenuActions()` in `src/store/templatesLogic.ts`. Only custom templates
have a menu: **Rename**, **Move**, **Edit**, **Hide** / **Unhide**, **Delete** (themed confirm).
Program templates have none — a program joins and leaves Your workouts as a whole.

- **Rename** opens "Rename template" with the current name; **Save** stores the trimmed name and
  is disabled while blank.
- **Move** opens `Move "{name}" to` listing **No folder** (clears the folder; offered only when the
  template is in one), every other folder (the current one isn't offered), and **New folder…**, which swaps in a name field with **Back**
  and **Create & move** (creates the folder and moves the template into it).
- **Edit** opens `/create-template?templateId=<id>` (also reachable from the
  [workout preview](#workout-preview)).
- **Delete** shows a themed confirm: **Delete "{name}"? This cannot be undone.** **Cancel** (or
  tap the overlay) dismisses; **Delete** removes it.

**Folder menus.** Custom folders: **Rename** ("Rename folder"), **Pin to top** / **Unpin from
top**, **Archive** / **Unarchive**, and **Delete**. The program section has no folder menu, only
**Change**.

Deleting a custom folder (`folderDeletePlan()`) counts every template filed in it, **hidden ones
included**, and asks in the themed dialog (title **Delete folder**; tapping the overlay cancels):

| Templates in folder | Message | Buttons |
|---|---|---|
| 0 | `Delete "{name}"?` | Cancel · Delete |
| 1 | `"{name}" has 1 template. Keep it outside the folder, or delete it too?` | Cancel · Keep template · Delete folder and templates |
| 2+ | `"{name}" has N templates. Keep them outside the folder, or delete them too?` | Cancel · Keep templates · Delete folder and templates |

**Keep template(s)** deletes the folder and clears `folderId` on its templates (only those
templates are re-synced). **Delete folder and templates** deletes the folder and every template
in it, hidden ones included.

## Your workouts

The Workouts tab lists one set of templates: **your custom templates plus at most one built-in
program**. A fresh install starts on **Strong Lifts 5x5** (`DEFAULT_PROGRAM_ID`), so the tab opens with a plan; removing it leaves no program. It's the same set Suggested picks from. The rules
are `groupYourWorkouts()` / `yourWorkoutTemplates()` in `src/store/templatesLogic.ts`.

Top to bottom, below the header:

1. **The program**, depending on whether one is chosen and whether you have custom templates:

   | Program chosen? | Custom templates or folders? | Shows |
   |---|---|---|
   | Yes | either | A section headed with a collapse chevron, the program's name (tap → its overview at `/program?id=`) and a **Change** link (→ `/programs`), listing its templates in shipped order. It starts open; collapsing hides the templates for this visit, like a folder. Program cards have no menu. |
   | No | Yes | Nothing here; a quiet **Want a plan? Browse programs ›** link sits under My templates (→ `/programs`) |
   | No | No | An empty state: **No workouts yet** — "Make a template to start working out." — with a **Build a template** button (→ `/create-template`), and the quiet **Browse programs** link below it. No program grid |

2. **My templates** (only when you have any custom template or folder, hidden or empty ones
   included). Contents in order: uncategorized templates → favourite (pinned) folders → normal
   folders → an **Archived** group (archived folders, pinned or not) → a **Hidden (N)** group
   (every hidden custom template, in a folder or not). An empty folder still shows, with
   "No templates in this folder." With no custom templates or folders and a program chosen, a quiet
   "Prefer your own? **Build a template** ›" link (→ `/create-template`) takes its place; with no
   program either, the empty state above covers it. Nothing on this tab uses
   dashed or outlined placeholder boxes.

Folders whose every template is hidden are omitted (their templates show under Hidden). Real
folders default to expanded; Archived and Hidden default to collapsed (`defaultFolderExpanded()`).

## Programs

`/programs` lists every built-in program, the chosen one first and then the rest in shipped order
(`orderPrograms()`), and **No program** last. A program is also dropped with **Remove from your
workouts** on its overview.

- **No program:** "Skip the plan and train from your own templates." Tapping it clears the
  program and stays on Programs; while nothing is chosen it's marked **Selected**. It has no
  template or empty-workout shortcuts.

- **Program cards:** name, a level chip (or **In your workouts** with a check on the chosen one),
  the summary, and `N days/wk · N workouts` (`programMeta()`). A card opens
  `/program?id=<folder id>`.

`/program` is the program's overview (`programOverview()` in `src/utils/programs.ts`). A **Back**
link sits above a header with a **PROGRAM** eyebrow, the level tag (plus **In your workouts** with a
check when it's the chosen program), the name and the summary. Three fact chips follow: `N days/wk`,
`N workouts` and `N sets/cycle`, the working sets in one pass through every workout (30 for Strong
Lifts, 85 for PHUL). Under **Workouts**, one card per workout in shipped order shows `DAY n`, its
name, `N exercises · N sets` (`programDayMeta()`), its description, and a small front/back
diagram of every muscle it trains. Below a divider, each exercise gets a row with its name, a pill
for the first muscle it lists, and its working sets as `3×`. Tapping a workout opens its
[workout preview](#workout-preview), so a day can be tried without choosing the
program. The footer button depends on Your workouts
(`programAction()` / `programActionHint()` in `src/utils/programs.ts`):

| Situation | Button | Hint |
|---|---|---|
| No program chosen | **Add to your workouts** | Its workouts join your templates on the Workouts tab. |
| Another program chosen | **Switch to {name}** | Replaces {other} in Your workouts. Your templates and history stay. |
| This program chosen | **Remove from your workouts** (outline) | Your templates and history stay. |

The button sets or clears `activeProgramId` (`setActiveProgram()` in `settingsStore`, persisted as
`muscleos_active_program` and synced with app settings) and returns to the Workouts tab. An unknown
id shows **Program not found**.

## Creating and editing

`/create-template` handles both create (title **New template**, button **Save
template**) and edit (`?templateId=`; title **Edit template**, button **Save changes**; **Saving…**
while saving, and a second tap can't save twice).

Flow:

1. **Template name** — required text input, placeholder "e.g. Push A".
2. **Folder** — chips (**None** plus each folder), shown only if folders exist.
3. **Exercises** — a header with the plan's size in mono (`3 exercises · 15 sets`,
   `planSizeLabel()`) and, once there is an exercise, a **Rest for all** button. Below it, one card
   per exercise ("No exercises yet" when empty), styled like the workout screen's cards (border, and
   a soft shadow in light mode). With more than one, the hint "Hold and drag to rearrange" shows and
   a long-press on a card's header (with its handle) drag-reorders. Each card's header has the
   exercise name, a pill for its first-listed muscle, and a remove button; below a hairline,
   **Sets** (default 3, min 1) and **Warm-ups** (default 0, min 0) steppers with no maximum, and a
   **Rest** button. Those counts become the blank rows created when the workout starts — warm-ups
   first, then working sets. **Rest** shows the work-set rest (your Default rest when the slot has
   none, `Off` for 0:00, plus `· warm-up 0:45` when warm-ups have one —
   `formatTemplateRestLabel()`) and opens the same **Update rest timers** dialogue as the workout
   (`RestTimersDialog`), with the hint "Starts after every set of this exercise when you work out
   from this template. 0:00 means no timer."

   **Rest for all** opens the same dialogue titled **Rest for all exercises** (button **Apply to
   all**), prefilled with the rests every exercise shares, or your default and no warm-up rest when
   they differ (`sharedRest()`). Applying sets that work and warm-up rest on every exercise
   (`applyRestToAll()`); one exercise can still be changed afterwards.
4. **Add exercises** — "Add exercise" bottom sheet with search (**Done** closes it). Exercises
   already in the template are left out of the list. If the search has no match, offers
   **Create "<query>"** which routes to `/create-exercise`; with no search and nothing left to add
   it reads "No matching exercises". New exercises start at 3 working sets and 0 warm-ups.
5. **Muscles used** — body diagram and labels derived from the selected exercises, shown once at
   least one muscle resolves.
6. **Save** — creates `tpl_<timestamp>_<random>` with `isBuiltIn: false`, or updates the template
   in place, then goes back (`buildTemplateSave()` in `src/utils/templateDraft.ts`).

### Validation

`validateTemplateDraft()`; errors appear on Save and clear when the name is edited.

| Rule | Message |
|------|---------|
| Name must be non-empty after trim | `Name is required` |
| At least one exercise | `Add at least one exercise` |

There is no maximum name length and no cap on exercise count. The name is saved trimmed.

### Editing

- The form prefills from the stored template, including its folder and per-exercise set plan and rests.
- The chosen folder is always written: picking **None** clears an existing folder.
- An id that isn't one of your custom templates — unknown, deleted, or a built-in — shows
  **Template not found** ("It may have been deleted. Built-in templates can't be edited.") with no
  form and no save, so an edit link never silently creates a new template.

## Workout preview

`/workout-preview` sits between tapping a template and starting the workout, so you can check
what you're in for and what you lifted last time.

The header shows the template name (or "Workout" for an id it can't resolve) with a **Start**
button and, for your own templates only, an **Edit** button (`canEditFromPreview()`) that opens
`/create-template?templateId=<id>`. Saving there returns to the preview, which now shows the edited
template. Built-ins (and unresolved ids) have no Edit button. Under the title, a built-in template shows
**Part of {program} ›**, linking to `/program?id=` (`programForTemplate()` in
`src/utils/programs.ts`), whether or not that program is in Your workouts. Below: a **Muscles used** diagram, `<N> exercises · review, then start`, and one card per
exercise with its two-digit index, name, muscle labels, the template's set prescription
(`3 sets` or `2 warm-ups · 5 sets`), **Previous** (`Previous: <weight> × <reps>` in the display
unit, from the best weighted set in the most recent qualifying session; reps are dropped when
unknown, and the line is **omitted** when there is no previous), and a rest badge with the
exercise's rest from the template — `2:00 rest between sets` by default, `No rest timer` for 0:00,
plus `· 0:45 after warm-ups` when warm-ups have a rest (`formatPrevious()` / `formatPreviewRest()`
in `src/utils/workoutPreview.ts`).

Guards on entry: missing template id or exercises → "Missing workout details"; an in-progress
session → redirect to `/active-workout` (`previewEntryState()`). The previewed plan is the one the
link encodes, falling back to the template's own; once **Edit** has been opened from the preview,
the resolved template's current plan wins, so the saved edit isn't masked by the plan the link was
opened with (`previewPlan()` in `src/utils/workoutPreview.ts`).

**Start workout** (footer) and **Start** (header) both replace the route with `/active-workout`,
passing the template id and the same set plan.

## Suggested templates

`recommendTemplates()` picks up to 2 templates for the home screen. Inputs: currently recovering
muscles, muscles worked in the last **7 days** (`recentlyWorkedMuscleIds()` — like recovery, only
exercises with a completed set count), [Your workouts](#your-workouts) (the chosen program's
templates and visible custom ones), and when each template was last done.

Constants:

| Constant | Value | Effect |
|----------|------:|--------|
| `MIN_READY_FRACTION` | 0.5 | Skip the template if under 50% of its muscles are recovered |
| `VARIETY_WEIGHT` | 28 | Multiplier on the fraction of muscles not worked recently |
| `RECENT_WINDOW_DAYS` | 30 | +5 if done within 30 days (familiarity bonus) |
| `JUST_DONE_DAYS` | 2 | −20 if done within the last 2 days |
| `OVERLAP_PENALTY` | 8 | Per muscle overlapping an already-picked suggestion |

Scoring, per template:

1. Skip if no muscles resolve, or if `readyFraction < 0.5`.
2. `score = readyFraction × 100 + varietyFraction × 28`
3. `+5` if last done within 30 days; `−20` if last done within 2 days; `+3` if never done and
   at least 75% ready.

Results sort by descending score, tie-broken by template name. Picks are then **greedily
diversified**: each subsequent slot subtracts `8 × overlapping muscles` against what's already
been picked, so two suggestions rarely hit the same muscles.

## Home headline

`computeHomeStats()` + `homeHeadline()` in `src/utils/homeStats.ts` produce the one-line
subtitle under "Workouts". Derived from session history; nothing is persisted.

**Weeks start Monday at 00:00 local time.** `weekStreak` counts consecutive Monday-start weeks
with at least one completed session, walking backwards. If the current week has no session yet
it starts counting from the **previous** week, so a streak survives the first few days of a new
week rather than appearing to break every Monday.

Copy, in priority order:

| Condition | Copy |
|-----------|------|
| Streak > 1, none yet this week | `You're streaking. Week's still open.` |
| Streak > 1, trained this week | `You're streaking. N weeks in.` |
| Trained today, 1 session this week | `Already in today.` |
| ≥1 session this week | `One this week.` / `Two this week.` / `N this week.` |
| Last session 1 day ago | `Last one was yesterday.` |
| Last session 2–6 days ago | `Last one was N days ago.` |
| Otherwise (incl. ≥7-day gap) | `Pick a template or start from scratch` |

## Assumptions

| Assumption | Note |
|------------|------|
| A template is an ordered exercise list **plus set structure and rests** | Working sets default to 3, warm-ups to 0, work rest to your Default rest (Settings) and warm-up rest to none; no target weight, reps, or supersets |
| Default **3 working sets** per exercise (`DEFAULT_SETS_PER_EXERCISE`) | Overridden per exercise; Strong Lifts ships `sets: 5` on each slot, PHUL 3–4 |
| Built-in templates are **immutable**; never deleted or hidden | Keeps ids stable for historical sessions; a program leaves Your workouts as a whole |
| At most **one** program in Your workouts, **Strong Lifts 5x5** on a fresh install | A new user opens to a plan; No program is one tap away on Programs, and custom templates are always there |
| Every template is free to create and run | No tiers; see [pricing.md](pricing.md) |
| Templates are single-day | A program is a folder of days you can start in any order; no week/phase structure or "next day" |
| No search or manual sort on the home template list | Ordering is folder structure + storage insertion order |
| The chosen program syncs | `activeProgramId` is part of the `app_settings` snapshot; a custom template's `hidden` flag syncs with the record |
| Suggested is capped at 2 | Home is a launcher, not a browser |

## Tests

Covered:

- `src/data/builtInTemplates.test.ts` — folder ids, every template in a folder, every folder
  described as a program (names match, shipped order, id lookup rejecting unknown ids),
  **every built-in `exerciseId` exists in the catalog**, Strong Lifts
  resolves to 5 working sets / 0 warm-ups per exercise, and PHUL ships its four days in order
  with 3–4 working sets per exercise
- `src/utils/templateExercises.test.ts` — resolve (defaults, legacy `defaultSets`, per-exercise
  override, leftover-`defaultSets` ignored once `exercises` exists), serialize compact form,
  normalize dropping `defaultSets`, session-to-template set counts and rests, set-label copy; rests
  resolved and clamped, defaults stored as omitted, explicit 0:00 kept, rest-pill label
- `src/utils/homeStats.test.ts` — Monday-week counting, streak surviving a fresh week, streak
  breaking on a missed week, all headline branches
- `src/utils/recommendTemplates.test.ts` — the scoring arithmetic (ready × 100 + variety × 28,
  +3 novelty, +5 within 30 days, −20 within 2 days), the 50% cut-off boundary, unresolved templates
  skipped, name tie-break, the limit, and the −8-per-overlap diversification
- `src/utils/bodyCrop.test.ts` — muscle art side choice (front for push, back for pull and
  posterior chain), crop aspect and containment, minimum height, empty fallback, leg crops sit low
- `src/utils/muscleDiagramRegions.test.ts` — region recovery states, least-recovered wins on shared
  regions, delts split by view; focus regions drop single-exercise regions, keep chest on Push, count shared regions once per
  exercise, and fall back to all regions when none repeats
- `src/utils/recovery.test.ts` — the 7-day "recently worked" set counts only completed exercises
- `src/store/templatesLogic.test.ts` — `allTemplates` lists built-ins first; only a custom's own
  flag hides it, never a built-in; deleting a folder keeps every template inside it, clearing only
  their `folderId`; `folderDeletePlan` counts and deletes hidden templates, with the 0 / 1 / N
  prompt copy; `templateMenuActions` items and order, Unhide for hidden customs, no menu on
  program templates; `groupYourWorkouts` ordering (uncategorized → pinned → normal → archived →
  hidden), all-hidden folders left out, empty folders kept, no built-in with no program, the chosen
  program's templates in order, unknown ids ignored; `yourWorkoutTemplates` adds only the chosen
  program
- `src/store/templatesStore.test.ts` — on the AsyncStorage harness: load, legacy `defaultSets` and
  `days[]` migrations persisted, corrupt-storage fallback, normalize-on-write, update/delete
  persistence, `folderId` cleared by an `undefined` patch, a built-in can't be hidden (nothing
  stored or synced), custom hide synced on the record, folder CRUD, and folder delete
  re-syncing only the affected templates; delete-with-templates removing hidden ones too
- `src/utils/workoutsHome.test.ts` — `defaultFolderExpanded`, `lastDoneByTemplate`,
  `suggestHomeTemplates` (cap 2, customs suggested like built-ins, only Your workouts — no hidden
  template, no program you aren't following), and every
  `decideTemplateStart` branch
- `src/utils/templateExercises.test.ts` (MUS-169 part) — `editorRestPatch` leaves a rest equal to
  the default unset, `applyRestToAll`, `sharedRest` (shared rests or the default), and an unset rest
  labelled with the user's default
- `src/utils/templateCard.test.ts` — card lineup, main muscles once each (max 3), size line,
  unknown exercise by id
- `src/utils/templateDraft.test.ts` — validation copy, no name/exercise caps, create id format and
  payload, edit patch, **None clears the folder**, not-found for unknown and built-in ids
- `src/utils/workoutPreview.test.ts` — `m:ss` rest formatting, `formatPreviewRest` (the default rest,
  template rest, No rest timer, warm-up rest), Previous in
  kg/lb, reps dropped when unknown, omitted when absent, `previewEntryState`, `previewPlan`
  (link plan, template fallback, template wins after Edit), `canEditFromPreview`
- `src/test/ui/templates/home.test.tsx` (Jest) — header and headline, Suggested ≤ 2 and only from
  the chosen program, no Recent row, customs in Suggested;
  a fresh install on Strong Lifts with both days suggested; with no program (no built-in listed
  or suggested, the empty state's Build a template → `/create-template`, Browse programs →
  `/programs`), the
  program section (its templates, no menus, collapses and reopens, name → `/program`, Change → `/programs`); My templates ordering /
  default-closed Archived and Hidden, sections keep their rows (and border) across a light → dark
  switch, card size, lineup, muscle pills and Last done, custom cards unlocked and opening the preview, no Pro or
  upgrade copy, program template → preview params, the Empty workout hero → `/active-workout?templateId=_empty`,
  "Workout in progress" Resume / Cancel, every context-menu action (hide into Hidden (N) and out of
  Suggested, unhide, rename, move incl. Create & move and No folder, edit, delete confirm), folder menu (pin, archive, rename), all three folder-delete prompts and outcomes,
  `/templates` redirect
- `src/utils/programs.test.ts` — the Add / Switch to / Remove button and hint for each
  situation, an unknown chosen id treated as none, list order (the chosen program first),
  `N days/wk · N workouts`, and the overview (each workout's exercises, working sets and
  first-listed muscle, unknown exercises by id with no muscle, each workout's muscles collected
  once, sets per workout and per cycle) and `N exercises · N sets`
- `src/test/ui/templates/programs.test.tsx` (Jest) — Programs order, levels and sizes, the chosen
  program first and marked, No program last with no template / empty-workout shortcuts and
  choosing it clears the program and stays; card → `/program?id=`;
  program detail level tag, In your workouts on the chosen one, fact chips, each workout's day number, size, description, exercises with muscle pills and `N×`, a workout → preview params, Add / Switch / Remove updating and persisting `activeProgramId` and returning to Workouts,
  Program not found
- `src/storage/localStorage.settings.test.ts`, `src/sync/mergePolicy.test.ts` — the program setting (a
  fresh install starts on Strong Lifts; a removed program is stored as `none` and stays removed)
  defaults to none, round-trips, rejects blank/unknown ids, survives an older build's payload, and a
  pending local choice (none included) wins the merge
- `src/test/ui/templates/createTemplate.test.tsx` (Jest) — form copy, validation messages, add at 3 / 0 with the picker hiding added exercises, header + New routing to the exercise builder, Create
  "<query>", stepper minimums and no maximum, remove, reorder hint, save creating `tpl_*` with
  folder and plan, the plan size line, Rest button (2:00 default, set with the time pad, saved on
  the slot; Off prefilled on edit), Rest for all (an unset rest shows the user's default, applied
  to every exercise, a rest equal to the default saved as unset), edit prefill and save, None clearing the folder, Template not found for unknown
  and built-in ids, double-tap saving once
- `src/test/ui/templates/workoutPreview.test.tsx` (Jest) — missing params, in-progress redirect,
  the Part of {program} link for program templates (none for customs),
  title / count line / cards, set prescription copy, 2:00 rest badge, Previous formatting and
  omission, lb conversion, footer and header Start params, no Edit for built-ins or unknown ids,
  Edit → `/create-template` → save returns to the updated preview and starts the edited plan

Not covered:

- Drag-to-reorder gestures on create-template (the drag library is mocked in Jest; the resulting
  order is just the list `serializeTemplateExercises` stores)
- Muscle art rendering (the crop and colour rules are covered as pure functions)
