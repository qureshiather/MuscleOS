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
| Hide | Yes — id added to a local hidden list | Yes — `hidden: true` on the record |
| Runnable on Basic | Yes | **No** — Pro required to *start*, not just to create |
| Cloud sync | N/A (shipped code) | Yes, when an account is linked |

`allTemplates()` returns `[...BUILT_IN_TEMPLATES, ...userTemplates]` — built-ins always first.

**Attempting to edit a built-in.** There is no rename/edit/move/delete in the built-in context
menu at all, so the only path that has to say no is mid-workout editing, which alerts:

> **Built-in workout** — You can't edit a built-in workout. Upgrade to Pro to customize it and
> save it as a new template.

That is the intended escape hatch: run the built-in, change the session as you go, then save the
result as a **new** custom template. There is no "duplicate template" action; saving from a
finished session is the way to fork one.

**Hidden, not deleted.** Built-ins can't be removed because their ids are referenced by past
sessions and by the shipped constant. Hiding removes them from the lists while keeping ids
resolvable. Hidden state is stored locally and is **not** synced.

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

**2. Empty workout hero.** Starts a session with no exercises, adding them as you go. Pro; on
Basic the subtitle reads "Included with Pro" with a lock icon and tapping opens the paywall.
Skips the preview screen and goes straight to `/active-workout` with `templateId: '_empty'`.
If a session is already in progress, the themed "Workout in progress" dialog is shown instead
(see [workout-logging](workout-logging.md#starting)).

**3. Suggested** (only when non-empty). Up to **2** templates in a 2-column grid, chosen by
[recommendTemplates](#suggested-templates).

**4. Recent** (only when non-empty). Horizontal row of up to **6** templates you've completed,
most recent first, deduplicated by template and **excluding anything already in Suggested**.
Shows relative completion time.

**5. "All templates" header.** Pro users also get a new-folder button and a **New** button.

**6. Custom section** (collapsible, **expanded** by default). Visible if you're Pro or have any
custom templates. Contents in order: uncategorized templates → favourite (pinned) folders →
normal folders → an **Archived** group → a **Hidden** group. Lapsed Pro users with existing
custom templates see a notice banner linking to the paywall.

**7. Built-in section** (collapsible, **collapsed** by default). On first expand, all built-in
subfolders open. Contents: visible folders, then a nested **Hidden** group.

### Template cards

Each card shows the name, optional description, `Last done: <relative>` when a session exists
for it, and the exercise count. A lock icon appears when the template requires Pro to start.

Tapping a card opens **`/workout-preview`**, not the workout directly. If a session is already
in progress, the same "Workout in progress" dialog as the empty-workout hero is shown instead.

### Context menus

| Action | Built-in | Custom | Gate |
|--------|:--------:|:------:|------|
| Rename | — | ● | `custom_templates` |
| Move to folder | — | ● | `custom_templates` |
| Edit | — | ● | `custom_templates` |
| Hide / Unhide | ● | ● | none |
| Delete | — | ● (themed confirm) | none |

Deleting a custom template shows a themed confirm: **Delete "{name}"? This cannot be undone.**
**Cancel** (or tap the overlay) dismisses; **Delete** removes it.

Folder menus: custom folders support rename, pin/unpin, archive/unarchive, and delete (with a
choice of keeping or deleting the templates inside). Built-in folders support hide/unhide only,
which hides every template in them.

Folders whose every template is hidden are themselves omitted from the lists. Real folders
default to expanded; the Archived and Hidden groups default to collapsed.

## Creating and editing

`/create-template`, **Pro-gated at the screen level** (`useRequirePro('custom_templates')`) so
deep links can't bypass it. Handles both create and edit (`?templateId=`).

Flow:

1. **Name** — required text input.
2. **Folder** — chips, shown only if folders exist.
3. **Exercises** — ordered list; long-press a handle to drag-reorder when there's more than one.
   Each row has **Sets** (default 3, min 1) and **Warm-up** (default 0) steppers. Those counts
   become the blank rows created when the workout starts — warm-ups first, then working sets.
4. **Add exercises** — bottom sheet with search. If the search has no match, offers
   **Create "<query>"** which routes to `/create-exercise`. New exercises start at 3 working sets
   and 0 warm-ups.
5. **Muscles used** — body diagram derived from the selected exercises.
6. **Save**.

### Validation

| Rule | Message |
|------|---------|
| Name must be non-empty after trim | `Name is required` |
| At least one exercise | `Add at least one exercise` |

There is no maximum name length and no cap on exercise count.

### Known edit quirk

On edit, the folder is only written when `folderId !== undefined` in local state, so **selecting
"None" does not clear an existing folder assignment**. Use "Move" from the home context menu to
remove a template from a folder.

## Workout preview

`/workout-preview` sits between tapping a template and starting the workout, so you can check
what you're in for and what you lifted last time.

Shows a **Muscles used** diagram, `<N> exercises · review, then start`, and one card per
exercise with its index, name, muscle labels, the template's set prescription
(`3 sets` or `2 warm-ups · 5 sets`), **Previous** (`weight × reps` from the best
weighted set in the most recent qualifying session, or `—`), and a rest badge.

> The rest badge always shows the app default of **2:00** — it is not template-specific, because
> templates don't store rest. Per-exercise rest is set during the workout.

Guards on entry: missing params → "Missing workout details"; an in-progress session → redirect
to `/active-workout`; a custom template without Pro → redirect to the paywall.

**Start workout** replaces the route with `/active-workout`.

## Suggested templates

`recommendTemplates()` picks up to 2 templates for the home screen. Inputs: currently recovering
muscles, muscles worked in the last **7 days**, when each template was last done, and (Basic
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
| Hidden state is local-only | Not synced across devices |
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
- `src/utils/recommendTemplates.test.ts` — skips mostly-recovering templates; diversifies away
  from recently worked muscles
- `src/subscription/features.test.ts` — `requiresProToStart` for built-in vs custom; 9 built-ins
- `src/store/templatesLogic.test.ts` — `allTemplates` lists built-ins first; soft-hide toggle
  de-dupes; built-in hides by id **or** folder while a custom hides only via its own flag; and
  deleting a folder keeps every template inside it, clearing only their `folderId`

Not covered:

- `templatesStore` persistence and sync notifications (the store wraps the tested pure reducers)
- `create-template.tsx` validation, create vs edit, and the folder-not-cleared quirk
- `workout-preview.tsx` entry guards
- Full `recommendTemplates` scoring arithmetic (only two behavioural cases are asserted)
- Home screen composition: Suggested/Recent dedupe, section visibility, collapsible defaults
- Pro gate behaviour on locked cards and the empty-workout hero
