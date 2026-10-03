# Workout Templates

A template is an **ordered list of exercises** with a name, plus how many working and warm-up
sets each exercise should start with. Templates still do not carry target weights, reps, or
per-exercise rest — they prescribe structure, not load.

| | |
|--|--|
| Home screen | `apps/mobile/app/(tabs)/index.tsx` (tab title **Workouts**) |
| Create / edit | `apps/mobile/app/create-template.tsx` |
| Preview | `apps/mobile/app/workout-preview.tsx` |
| Store | `apps/mobile/src/store/templatesStore.ts`, `src/utils/templateExercises.ts` |
| Built-in content | `apps/mobile/src/data/builtInTemplates.ts` |
| Suggestions | `apps/mobile/src/utils/recommendTemplates.ts` |
| Home headline | `apps/mobile/src/utils/homeStats.ts` |

`/templates` is a legacy route that redirects to the Workouts tab.

## Data model

`packages/types/src/workout.ts`:

```ts
interface TemplateExercise {
  exerciseId: string;
  sets?: number;         // working sets; omitted → 3
  warmUpSets?: number;   // omitted → 0
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
  hidden?: boolean;               // custom templates only
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
`warmUpSets` means 0. `defaultSets` is only a read fallback for templates stored before this
field existed — Strong Lifts used to set `defaultSets: 5` for the whole workout; it now stores
`sets: 5` on each slot instead.

Notably absent: target weight/reps, rest, supersets, and any notion of a program week or day
sequence. The set counts only change how many blank warm-up and working rows are created when
the workout starts.

## Built-in vs custom

The core distinction, and the reason for most of the behaviour on this screen. See also
[product/overview.md](../product/overview.md#the-central-assumption-built-in-vs-custom).

| | **Built-in** | **Custom** |
|--|--------------|------------|
| Source | `BUILT_IN_TEMPLATES` constant, compiled in | AsyncStorage `muscleos_templates` |
| Ids | Fixed and stable (`ppl-push`, `sl-a`) | `tpl_<timestamp>_<random>` |
| `isBuiltIn` | `true` | `false` |
| Rename / edit / move / delete | **Not possible** — no UI path exists | Yes (Pro) |
| Hide | Yes — id added to a local hidden list (local-only, not synced) | Yes — `hidden: true` on the record (synced with it) |
| Runnable on Basic | Yes | **No** — Pro required to *start*, not just to create |
| Cloud sync | N/A (shipped code) | Yes, when an account is linked — the whole record, including `hidden` and `folderId` |

`allTemplates()` returns `[...BUILT_IN_TEMPLATES, ...userTemplates]` — built-ins always first.

**Attempting to edit a built-in.** There is no rename/edit/move/delete in the built-in context
menu at all, and `/create-template?templateId=<built-in id>` shows **Template not found**. The
only path that has to say no is mid-workout editing on **Basic**: adding, replacing, or removing an
exercise in a built-in workout alerts (Pro users can change the session freely):

> **Built-in workout** — You can't edit a built-in workout. Upgrade to Pro to customize it and
> save it as a new template.

That is the intended escape hatch: run the built-in, change the session as you go, then save the
result as a **new** custom template. There is no "duplicate template" action; saving from a
finished session is the way to fork one.

**Hidden, not deleted.** Built-ins can't be removed because their ids are referenced by past
sessions and by the shipped constant. Hiding removes them from the lists while keeping ids
resolvable. Built-in hidden state (hidden template ids and hidden folder ids) is stored locally
and is **not** synced; a custom template's `hidden` flag is part of its record and syncs with it.

## Shipped built-in templates

Three folders, nine templates (asserted in `src/subscription/features.test.ts` and validated
against the exercise catalog in `src/data/builtInTemplates.test.ts`).

| Folder | Templates | Exercises each |
|--------|-----------|---------------:|
| **Push Pull Legs** (`builtin_ppl`) | Push, Pull, Legs | 6 |
| **Upper Lower Splits** (`builtin_ul`) | Upper A, Lower A, Upper B, Lower B | 6 |
| **Strong Lifts 5x5** (`builtin_sl`) | Workout A, Workout B | 3 (5 working sets each) |

Every `exerciseId` in a built-in template is asserted to exist in `CATALOG_SEED`, so a shipped
template can never reference a missing exercise.

## Home screen

Renders top to bottom:

**1. Header.** Title "Workouts" and a one-line status headline (see
[Home headline](#home-headline)) — not a stats ticker.

**2. Empty workout hero.** Starts a session with no exercises, adding them as you go. Pro (subtitle
"Add exercises as you go"); on Basic the subtitle reads "Included with Pro" with a lock icon and
tapping opens the paywall. Skips the preview screen and goes straight to `/active-workout` with
`templateId: '_empty'`. If a session is already in progress, the themed "Workout in progress"
dialog is shown instead (see [workout-logging](workout-logging.md#starting)).

**3. Suggested** (only when non-empty). Up to **2** templates in a 2-column grid, chosen by
[recommendTemplates](#suggested-templates) over the visible templates your tier can start
(`suggestHomeTemplates()` in `src/utils/workoutsHome.ts`). Each is a
[muscle art card](#muscle-art-cards) with the name and exercise count.

**4. Recent** (only when non-empty). Horizontal row of up to **6** templates you've completed,
most recent first, deduplicated by template and **excluding anything already in Suggested**, hidden
templates, and templates your tier can't start (`pickRecentTemplates()` in
`src/utils/recentTemplates.ts`). Each is a [muscle art card](#muscle-art-cards) with the name and
relative completion time.

### Muscle art cards

Suggested and Recent cards have no description or reason text. Behind the name, the template's
muscles are drawn as a **zoomed body figure** that bleeds off the card's right edge and fades into
the card under the label (`MuscleZoomArt` in `src/components/workouts/`).

- **Muscles:** every muscle of every exercise in the template, mapped onto the Recovery diagram's
  regions (`MUSCLE_ID_TO_DIAGRAM_REGION`).
- **Colours:** each region uses the Recovery tab's colours for its current state: ready, recovering,
  or just trained (`regionStatesForMuscles()`). A region shared by several muscles (delts, upper
  back) takes the least-recovered state.
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

**5. "All templates" header.** Pro users also get a new-folder button and a **New** button.

**6. Custom section** (collapsible, **expanded** by default). Visible if you're Pro or own any
custom template, hidden ones included (`customSectionVisible()`). Contents in order
(`groupHomeTemplates()` in `src/store/templatesLogic.ts`): uncategorized templates → favourite
(pinned) folders → normal folders → an **Archived** group (archived folders, pinned or not) → a
**Hidden** group (every hidden custom template, in a folder or not). An empty folder still shows,
with "No templates in this folder."

- **Empty state** (Pro with no custom templates): "No templates yet." and a **Create template**
  link to `/create-template`.
- **Lapsed Pro** (Basic with any custom template, hidden ones included — `showLapsedNotice()`):
  a banner reading "Your templates are saved. Resubscribe to Pro to run them." that opens the
  paywall (`custom_templates`). The templates stay listed, locked.

**7. Built-in section** (collapsible, **collapsed** by default). On first expand, all built-in
subfolders open. Contents: folders with at least one visible template, then a nested **Hidden**
group holding hidden built-in folders (with every template in them) and individually hidden
built-ins.

Folders whose every template is hidden are themselves omitted from the lists. Real folders
default to expanded; the Archived and both Hidden groups default to collapsed
(`defaultFolderExpanded()`).

### Template cards

Each card shows the name, optional description, `Last done: <relative>` when a completed session
exists for it (the most recent one — `lastDoneByTemplate()`), and `<N> exercises`. A lock icon
appears when the template requires Pro to start.

Tapping a card opens **`/workout-preview`**, not the workout directly, passing the template id and
its set plan. If a session is already in progress, the same "Workout in progress" dialog as the
empty-workout hero is shown instead. Tapping a **locked** card (Basic + custom) goes straight to
the paywall (`custom_templates`), not the preview. The routing decision is `decideTemplateStart()`
in `src/utils/workoutsHome.ts`: Basic + `requiresProToStart` → paywall `custom_templates`; Basic +
empty workout → paywall `empty_workout`; then an in-progress session → the dialog; otherwise
preview (templates) or `/active-workout` (empty).

The "Workout in progress" dialog — "Finish or cancel your current workout before starting
another." — offers **Resume workout** (go to `/active-workout`) and **Cancel workout** (discard the
in-progress session, then continue to what was tapped).

### Context menus

Items come from `templateMenuActions()` in `src/store/templatesLogic.ts`.

| Action | Built-in | Custom | Gate |
|--------|:--------:|:------:|------|
| Rename | — | ● | `custom_templates` |
| Move | — | ● | `custom_templates` |
| Edit | — | ● | `custom_templates` |
| Hide / Unhide | ● | ● | none |
| Delete | — | ● (themed confirm) | none |

On Basic, the gated items stay in the menu and open the paywall. A built-in that is hidden
because its **whole folder** is hidden shows **Unhide folder** instead of Unhide — it unhides the
folder (unhiding the single template would leave it hidden by the folder).

- **Rename** opens "Rename template" with the current name; **Save** stores the trimmed name and
  is disabled while blank.
- **Move** opens `Move "{name}" to` listing **No folder** (clears the folder; offered only when the
  template is in one), every other folder (the current one isn't offered), and **New folder…**, which swaps in a name field with **Back**
  and **Create & move** (creates the folder and moves the template into it).
- **Edit** opens `/create-template?templateId=<id>`.
- **Delete** shows a themed confirm: **Delete "{name}"? This cannot be undone.** **Cancel** (or
  tap the overlay) dismisses; **Delete** removes it.

**Folder menus.** Custom folders: **Rename** ("Rename folder"), **Pin to top** / **Unpin from
top**, **Archive** / **Unarchive**, and **Delete**. Built-in folders: **Hide** / **Unhide** only,
which hides every template in them.

Deleting a custom folder (`folderDeletePlan()`) counts every template filed in it, **hidden ones
included**:

| Templates in folder | Prompt (title **Delete folder**) | Buttons |
|---|---|---|
| 0 | `Delete "{name}"?` | Cancel · Delete |
| 1+ | `"{name}" has N template(s). Remove them from the folder or delete them?` | Cancel · Remove from folder · Delete folder and templates |

**Remove from folder** deletes the folder and clears `folderId` on its templates (only those
templates are re-synced). **Delete folder and templates** deletes the folder and every template
in it, hidden ones included.

## Creating and editing

`/create-template`, **Pro-gated at the screen level** (`useRequirePro('custom_templates')`) so
deep links can't bypass it. Handles both create (title **New template**, button **Save
template**) and edit (`?templateId=`; title **Edit template**, button **Save changes**; **Saving…**
while saving, and a second tap can't save twice).

Flow:

1. **Template name** — required text input, placeholder "e.g. Push A".
2. **Folder** — chips (**None** plus each folder), shown only if folders exist.
3. **Exercises · N** — ordered list ("No exercises yet" when empty). With more than one, the hint
   "Hold and drag to rearrange" shows and a long-press on a row's handle drag-reorders. Each row
   has **Sets** (default 3, min 1) and **Warm-up** (default 0, min 0) steppers with no maximum,
   and a remove button. Those counts become the blank rows created when the workout starts —
   warm-ups first, then working sets.
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

- The form prefills from the stored template, including its folder and per-exercise set plan.
- The chosen folder is always written: picking **None** clears an existing folder.
- An id that isn't one of your custom templates — unknown, deleted, or a built-in — shows
  **Template not found** ("It may have been deleted. Built-in templates can't be edited.") with no
  form and no save, so an edit link never silently creates a new template.

## Workout preview

`/workout-preview` sits between tapping a template and starting the workout, so you can check
what you're in for and what you lifted last time.

The header shows the template name (or "Workout" for an id it can't resolve) with a **Start**
button. Below: a **Muscles used** diagram, `<N> exercises · review, then start`, and one card per
exercise with its two-digit index, name, muscle labels, the template's set prescription
(`3 sets` or `2 warm-ups · 5 sets`), **Previous** (`Previous: <weight> × <reps>` in the display
unit, from the best weighted set in the most recent qualifying session; reps are dropped when
unknown, and the line is **omitted** when there is no previous), and a rest badge reading
`2:00 rest between sets` (`formatPrevious()` / `formatRestDuration()` in
`src/utils/workoutPreview.ts`).

> The rest badge always shows the app default of **2:00** — it is not template-specific, because
> templates don't store rest. Per-exercise rest is set during the workout.

Guards on entry: missing template id or exercises → "Missing workout details"; an in-progress
session → redirect to `/active-workout`; a custom template without Pro → redirect to the paywall
(`previewEntryState()` covers the first two).

**Start workout** (footer) and **Start** (header) both replace the route with `/active-workout`,
passing the template id and the same set plan.

## Suggested templates

`recommendTemplates()` picks up to 2 templates for the home screen. Inputs: currently recovering
muscles, muscles worked in the last **7 days** (`recentlyWorkedMuscleIds()` — like recovery, only
exercises with a completed set count), the visible templates, when each template was last done, and (Basic
only) a filter to startable templates so Basic users are never suggested something they can't run.

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

## Pro gates

| Action | Gate key |
|--------|----------|
| Empty workout | `empty_workout` |
| Start a custom template | `custom_templates` |
| Create / rename / move / edit a custom template; create a folder | `custom_templates` |
| Save a finished workout as a template | `save_as_template` |

`requiresProToStart(template)` is `template.isBuiltIn !== true` — the single predicate,
enforced at every entry point into a workout. See
[subscriptions.md](subscriptions.md#gate-map).

## Assumptions

| Assumption | Note |
|------------|------|
| A template is an ordered exercise list **plus set structure** | Working sets default to 3, warm-ups to 0; no target weight, reps, rest, or supersets |
| Default **3 working sets** per exercise (`DEFAULT_SETS_PER_EXERCISE`) | Overridden per exercise; Strong Lifts ships `sets: 5` on each slot |
| Built-in templates are **immutable**; hide, don't delete | Keeps ids stable for historical sessions |
| Custom templates require Pro to **run**, not only to create | Lapsed subscribers keep the data, visible but locked |
| Templates are single-day | No program/week/phase structure |
| No search or manual sort on the home template list | Ordering is folder structure + storage insertion order |
| Built-in hidden state is local-only | Hidden built-in ids/folders aren't synced; a custom template's `hidden` flag syncs with the record |
| Suggested is capped at 2, Recent at 6 | Home is a launcher, not a browser |

## Tests

Covered:

- `src/data/builtInTemplates.test.ts` — folder ids, every template in a folder, hide-by-folder
  vs hide-by-template, **every built-in `exerciseId` exists in the catalog**, and Strong Lifts
  resolves to 5 working sets / 0 warm-ups per exercise
- `src/utils/templateExercises.test.ts` — resolve (defaults, legacy `defaultSets`, per-exercise
  override, leftover-`defaultSets` ignored once `exercises` exists), serialize compact form,
  normalize dropping `defaultSets`, session-to-template set counts, and set-label copy
- `src/utils/homeStats.test.ts` — Monday-week counting, streak surviving a fresh week, streak
  breaking on a missed week, all headline branches
- `src/utils/recommendTemplates.test.ts` — the scoring arithmetic (ready × 100 + variety × 28,
  +3 novelty, +5 within 30 days, −20 within 2 days), the 50% cut-off boundary, unresolved templates
  skipped, name tie-break, the limit, and the −8-per-overlap diversification
- `src/utils/recentTemplates.test.ts` — Recent: newest first, one per template, excludes
  Suggested / hidden / unstartable, capped at 6
- `src/utils/bodyCrop.test.ts` — muscle art side choice (front for push, back for pull and
  posterior chain), crop aspect and containment, minimum height, empty fallback, leg crops sit low
- `src/utils/muscleDiagramRegions.test.ts` — region recovery states, least-recovered wins on shared
  regions; focus regions drop single-exercise regions, keep chest on Push, count shared regions once per
  exercise, and fall back to all regions when none repeats
- `src/utils/recovery.test.ts` — the 7-day "recently worked" set counts only completed exercises
- `src/subscription/features.test.ts` — `requiresProToStart` for built-in vs custom; 9 built-ins
- `src/store/templatesLogic.test.ts` — `allTemplates` lists built-ins first; soft-hide toggle
  de-dupes; built-in hides by id **or** folder while a custom hides only via its own flag;
  deleting a folder keeps every template inside it, clearing only their `folderId`;
  `folderDeletePlan` counts and deletes hidden templates, with the 0 / 1 / N prompt copy;
  `templateMenuActions` items, order, gates, and Basic locking, including **Unhide folder** for a
  built-in hidden by its folder; `groupHomeTemplates` ordering (uncategorized → pinned → normal →
  archived → hidden), all-hidden folders left out, empty folders kept, hidden built-in folders vs
  loose hidden built-ins
- `src/store/templatesStore.test.ts` — on the AsyncStorage harness: load, legacy `defaultSets` and
  `days[]` migrations persisted, corrupt-storage fallback, normalize-on-write, update/delete
  persistence, `folderId` cleared by an `undefined` patch, built-in hide (template and folder)
  local-only with no sync, custom hide synced on the record, folder CRUD, and folder delete
  re-syncing only the affected templates; delete-with-templates removing hidden ones too
- `src/utils/workoutsHome.test.ts` — `defaultFolderExpanded`, `customSectionVisible` /
  `showLapsedNotice` (hidden customs count), `lastDoneByTemplate`, `startableTemplates`,
  `suggestHomeTemplates` (cap 2, no hidden, no customs on Basic), and every `decideTemplateStart`
  branch
- `src/utils/templateDraft.test.ts` — validation copy, no name/exercise caps, create id format and
  payload, edit patch, **None clears the folder**, not-found for unknown and built-in ids
- `src/utils/workoutPreview.test.ts` — `m:ss` rest formatting and the 2:00 default, Previous in
  kg/lb, reps dropped when unknown, omitted when absent, `previewEntryState`
- `src/test/ui/templates/home.test.tsx` (Jest) — header and headline, Suggested ≤ 2, Recent newest
  first without Suggested picks, no customs in either on Basic, Built-in collapsed with every
  subfolder opened on first expand, Custom visibility / empty state / ordering / default-closed
  Archived and Hidden, card Last done and count, lapsed notice (including all-hidden), locked
  card → paywall, built-in → preview params, empty workout → `/active-workout?templateId=_empty`
  or paywall, "Workout in progress" Resume / Cancel, every context-menu action (hide/unhide,
  Unhide folder, rename, move incl. Create & move and No folder, edit, delete confirm, Basic
  paywall), folder menu (pin, archive, rename), all three folder-delete prompts and outcomes,
  `/templates` redirect
- `src/test/ui/templates/createTemplate.test.tsx` (Jest) — Basic redirected to the paywall, form
  copy, validation messages, add at 3 / 0 with the picker hiding added exercises, Create
  "<query>", stepper minimums and no maximum, remove, reorder hint, save creating `tpl_*` with
  folder and plan, edit prefill and save, None clearing the folder, Template not found for unknown
  and built-in ids, double-tap saving once
- `src/test/ui/templates/workoutPreview.test.tsx` (Jest) — missing params, in-progress redirect,
  title / count line / cards, set prescription copy, 2:00 rest badge, Previous formatting and
  omission, lb conversion, footer and header Start params

Not covered:

- Drag-to-reorder gestures on create-template (the drag library is mocked in Jest; the resulting
  order is just the list `serializeTemplateExercises` stores)
- Muscle art rendering (the crop and colour rules are covered as pure functions)
- The mid-workout **Built-in workout** alert (lives in `active-workout.tsx`, see workout-logging)
