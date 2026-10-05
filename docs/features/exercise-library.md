# Exercise Library

A bundled catalog of ~399 exercises, extendable with your own. The catalog is shared by every
user and syncs down from Supabase; custom exercises are private to your account.

| | |
|--|--|
| Screen | `apps/mobile/app/(tabs)/exercises.tsx` |
| Create / edit | `apps/mobile/app/create-exercise.tsx` |
| Store | `apps/mobile/src/store/exercisesStore.ts` |
| Bundled catalog | `apps/mobile/src/data/catalogSeed.ts` (generated) |
| Search | `apps/mobile/src/utils/exerciseSearch.ts` |
| Library filters | `apps/mobile/src/utils/exerciseLibraryFilter.ts` |
| Create/edit form rules | `apps/mobile/src/utils/customExerciseForm.ts` |
| Seed reconcile + delta merge | `apps/mobile/src/sync/catalogMerge.ts`, `catalogPull.ts` |
| Normalization | `apps/mobile/src/utils/exerciseNormalize.ts` |
| Notes | `apps/mobile/src/store/exerciseNotesStore.ts` |
| Schema | `supabase/migrations/20260830010000_exercise_catalog.sql` |

## Data model

`packages/types/src/exercise.ts`:

```ts
interface Exercise {
  id: string;
  name: string;
  muscles: MuscleId[];        // flat; no primary/secondary
  equipment: Equipment[];     // catalog: exactly one; customs: may be empty
  category: ExerciseCategory;
  instructions?: string;
  aliases?: string[];         // catalog only — legacy slug redirects
  trackingType?: ExerciseTrackingType;  // defaults to 'weight_reps'
  isPublished?: boolean;      // catalog only; false hides from the list
  mediaUrl?: string;          // deprecated; never set for catalog rows
}
```

There is **no `isCustom` field** — custom exercises are identified by an `id` starting with
`custom_`.

**`ExerciseCategory`** (closed, 4 values, the "Type" filter):
`free_weight` · `machine` · `cable` · `bodyweight`

**`Equipment`** (closed, 9 values):
`barbell` · `dumbbell` · `kettlebell` · `cable` · `machine` · `bodyweight` · `band` · `ez_bar` · `other`

**`ExerciseTrackingType`**: `weight_reps` | `bodyweight_reps` | `duration`. Present in the type
but **not exposed in the UI and ignored by the logging screen** — everything is logged as
weight × reps.

`muscles` is flat by design; see [recovery.md](recovery.md#muscle-taxonomy) for why the upstream
primary/secondary split was flattened at build time.

## The catalog

**399 exercises**, of which **396 are published** and visible in the library. Three are
unpublished (`powerlifting-exercises`, `rowing-machine`, `stationary-bike`) — still resolvable by
id so old sessions render, just hidden from browsing.

By category: 177 free weight, 102 bodyweight, 60 machine, 60 cable.

### Equipment and Type rules

Every catalog row lists **exactly one equipment value** — the primary piece the movement is
usually done with (Hammer Curl is `dumbbell`, Good Morning is `barbell`), not every option. The
active-workout card shows only the first value, so a single value keeps it right.

The library **Type is derived from that equipment** by the generator:

| Equipment | Type |
|-----------|------|
| barbell, dumbbell, kettlebell, EZ bar, other | Free Weight |
| machine | Machine |
| cable, **band** | Cable |
| bodyweight | Bodyweight |

Bands count as Cable: both are anchored, variable-resistance pulls. Three rows are exceptions,
listed in `CATEGORY_OVERRIDE`: Banded Muscle-Up (the band assists, it doesn't resist) and Kneeling
Ab Wheel Roll-Out / Leg Curl on Ball (the prop isn't the load) are Bodyweight.

Classification conventions:

- **Specialty bars** — landmine, T-bar, trap bar, safety squat bar, fat bar — are `barbell`.
- **Smith machine** movements are `machine`. Lat pulldowns, pushdowns and straight-arm pulldowns
  are `cable`; the selectorized/plate-loaded Machine Lat Pulldown is `machine`.
- **Stations** — hyperextension bench, GHR, reverse hyper, assisted pull-up/dip, belt squat,
  donkey calf raise — are `machine`. A captain's chair, pull-up bar, rings, box or bench used only
  for support is `bodyweight`.
- **Optionally loaded movements** follow how they're usually done in a gym: Bulgarian Split
  Squat, Step-Up and Single-Leg Hip Thrust are `dumbbell`; Glute Bridge, Cossack Squat, Nordic and
  Poliquin Step-Up are `bodyweight`.
- **`other`** is for loads that fit no enum value: plates, slam/medicine balls, grippers, wrist
  rollers, ankle weights.
- A band that only adds a cue to a barbell lift (Band-Assisted Bench Press, Hip Thrust with Band
  Around Knees) doesn't make it a band exercise — those are `barbell`.

**Names are title case.** Content words are capitalized; `a` / `an` / `the` / `and` / `but` /
`or` / `nor` / `for` / `on` / `at` / `to` / `from` / `by` / `in` / `of` / `with` / `vs` stay
lowercase unless they are the first or last word. Hyphenated
segments are capitalized (`Push-Up`, `T-Bar`). Short acronyms stay uppercase (`EZ`, `L-Sit`).
Custom exercise names are not rewritten.

### Pipeline

```
src/data/exercises.ts          hand-maintained source: ids, names, muscles, equipment, instructions
        │  generate-exercise-catalog.mjs
        ├──► src/data/catalogSeed.ts               bundled seed, instructions included
        └──► supabase/migrations/<new>.sql         instruction copy (--instructions-migration)

supabase/migrations/<new>.sql (hand-written)   other server-side field changes
                        │
                        ▼  fetchCatalogDelta(watermark)
              AsyncStorage catalog cache
```

`exercises.ts` is the source of truth for the catalog. It is edited by hand — nothing scrapes
or imports it from a third party. Every row carries **original MuscleOS instruction copy**: a
short, second-person cue sheet (setup → movement → key cue, 2–4 sentences, sentence case, no
medical claims). Rows carry no media URLs; the app shows no exercise images or GIFs.

`catalogSeed.ts` is **generated — do not hand-edit**. Regenerate with
`node apps/mobile/scripts/generate-exercise-catalog.mjs` (or `pnpm generate:catalog` in
`apps/mobile`).

The bundled seed **includes instructions**, so a fresh install shows every row's copy without
a delta pull. (The seed's date is later than the server's instruction rows, so a fresh install's
watermark would skip them; bundling is what guarantees the copy is there.) Bump
`SEED_UPDATED_AT` in the generator when seed content changes so existing installs re-apply it.

The generator **never writes an applied migration**: the original
`20260830020000_catalog_exercises_seed.sql` is history, and server rows change only through new
migrations. To ship changed copy, run the generator with
`--instructions-migration=<timestamp>_<name>`: it writes a new migration (refusing to overwrite an
existing file) that updates `instructions` for every catalog row whose text differs and sets
`updated_at = now()` on those rows, so existing clients pick it up on their next delta pull.
Other field changes are hand-written migrations that mirror the edit in `exercises.ts`.

### Reconciliation and sync

The store loads at app start **independently of auth** (alongside templates), so
custom exercises and the catalog are ready before sign-in finishes. It reads custom exercises and
the catalog cache in parallel, reconciles the cache with the bundled seed
(`reconcileCatalogCache()`), and sets state **without waiting on the network**. A catalog refresh
then runs in the background.

The seed is applied when the cache is empty, has never had a seed applied (`seedAppliedAt`
missing), or was seeded from an older binary (`seedAppliedAt` < the seed date). Applying it:

- **Seed fields replace cached rows** (name, muscles, equipment, category, instructions) so fixes
  ship in the app binary. A cached instruction is kept only for a row where the seed has none.
- Cache-only ids (from a later delta) stay, after the seed rows.
- The watermark becomes the later of the stored watermark and the seed date (seed date when
  none is stored); it never moves backwards. The merged cache, watermark and `seedAppliedAt` are
  persisted.

Otherwise the cache is used as-is and nothing is written.

The delta pull queries `catalog_exercises` for rows with `updated_at >` the stored watermark
(oldest first), merges them by id (later row wins; new ids append), and advances the watermark to
the highest `updated_at` received (`advanceWatermark()`). On an error, when Supabase isn't
configured, or when nothing is newer, nothing is written and the watermark stays. Concurrent
refreshes share one in-flight pull. Catalog sync is pull-only and runs for **all users including
anonymous ones** — it's shared content, not user data.

Refresh triggers: app launch, app foreground, and any sync that reloads the stores (including
Data → Sync now).

**Offline:** the library is fully usable from the bundled seed plus cache; no network needed.

**Ids are never deleted, only unpublished** (`is_published = false`). This is what guarantees a
two-year-old session still resolves its exercise names.

### Legacy id resolution

37 catalog rows carry `aliases`, mapping old slugs to the canonical id. `getExercise(id)`
(`resolveExerciseById()`) resolves aliases against the catalog before looking up, so renamed
exercises don't orphan session data. No alias may equal a real catalog id.

## Custom exercises

Anyone can create, edit and delete their own exercises.

| Field | Required | Notes |
|-------|:--------:|-------|
| Name | ● | Non-empty after trim; no maximum length |
| Type (category) | ● | One of the 4 categories |
| Muscles | ● | At least one; any of the 18 |
| Equipment | ○ | May be empty |
| Instructions | ○ | Free text |

Validation (`buildCustomExerciseDraft()`): the name is trimmed, and Save stays disabled until
there is a name, a Type and at least one muscle. Blank instructions are saved as none, so editing
them to empty clears them. Custom exercises always track `weight_reps`.

Ids are assigned as `custom_<n>` where n is the highest suffix + 1 across live **and retired**
customs (`nextCustomExerciseId()` in `src/utils/exerciseIds.ts`). Gaps are never filled and a
deleted custom's number is never reused: sessions, PRs and the previous map key on the id, so a
reused id would hand the old exercise's history to the new one.

**Editing** is only possible for `custom_*` ids; catalog exercises cannot be edited.
`/create-exercise?id=<id>` edits only when the id is a custom that exists
(`resolveExerciseEditTarget()`); any other id, including a catalog id, opens an empty **New
exercise** form rather than prefilling a copy of that row. The detail sheet on the Exercises tab
offers Edit and Delete for customs. `?name=` prefills the name (used by Create "<query>").

**Created from the active-workout picker** (`origin=active-workout`), saving drops the new
exercise straight into the live workout: appended in add mode, or swapped in for the exercise at
`workoutExIdx` in replace mode. Then the form closes back to the workout.

### Normalization

`normalizeExercise()` runs on add, update, and on read from storage, making the store tolerant of
corrupt or older rows: invalid equipment values are stripped, a missing category is inferred from
equipment (cable → machine → bodyweight → free_weight), a missing name falls back to the id,
unknown muscle ids are stripped (like equipment), and if no valid muscle is left the row falls
back to `['chest']` so it always has at least one. Blank instructions are dropped and present ones
trimmed; an unknown tracking type becomes `weight_reps`. The name and muscle fallbacks aren't
reachable from the create UI, which requires both.

**There is no deduplication.** Nothing stops you creating a second "Cable Row" that already
exists in the catalog, or two customs with the same name. Names aren't unique keys — ids are.

### Storage and privacy

Local: AsyncStorage `muscleos_custom_exercises`. With a linked account they also sync to the
`user_exercises` table via `upsert_user_exercises`, scoped by row-level security so they are
**private to your account**. Deletes are soft (`deleted_at`) so tombstones propagate. Anonymous
users keep customs on-device only.

### Deleting a custom exercise

Delete asks for confirmation (*"Past workouts keep the name if you logged it."* — Cancel /
Delete), removes the exercise, queues the soft delete, and also deletes that exercise's note.

Sessions store only `exerciseId`, never a name snapshot, so the deleted definition is **retired**
rather than dropped: it moves to a local list (`muscleos_retired_custom_exercises`) that
`getExercise()` falls back to after the catalog and live customs. History, PRs, progression and
recovery keep resolving its name and muscles; the library, pickers and `getAllExercises()` never
show it. A delete arriving from another device by sync (a tombstone) retires the local copy the
same way. The retired list is device-local and is cleared by Clear all data.

## Search

`searchExercises()` scores each exercise and returns matches sorted by descending score,
tie-broken by name. An empty query returns the input unchanged.

Text is normalized first: Unicode decomposed, diacritics stripped, lowercased, non-alphanumerics
collapsed to spaces (so `Développé-couché` → `developpe couche`).

Score tiers:

| Match | Score |
|-------|------:|
| Exact (normalized or with spaces removed) | 1000 |
| Exact ignoring a trailing plural `s` | 960 |
| Prefix | 800 |
| Substring | 700 |
| Stem substring (≥4 chars) | 640 |
| All tokens present, in order | 520 |
| All tokens present, any order | 400 |
| Whole-string fuzzy (query ≥5 chars) | 280 / 260 |

Fuzzy tolerance by length: ≤3 chars none, 4–6 chars one edit, 7+ chars two edits — so short
queries stay precise and long ones survive typos.

Field weighting on top of the tier: name +80, id +40, alias +20; the best field wins. Metadata
(category label, equipment, muscle labels) is only scored when no name, id or alias matches, and
is capped at 350. That keeps a metadata-only hit below any name match from the any-order tier up
(400 + 80), but a whole-string fuzzy name match scores 360 / 340 and so can land either side of an
exact metadata hit.

Query tokens also stem `abductor(s)` ↔ `abduction` and `adductor(s)` ↔ `adduction`, so
"hip adductors machine" finds Hip Adduction Machine.

> **There is no abbreviation dictionary.** `"ohp"` will not find Overhead Press — it isn't a
> substring or within fuzzy distance. Aliases are legacy *slug* redirects for id resolution, and
> only help search if you happen to type the slug.

## Exercises tab

Header shows `<count> movements · tap for muscle map` (published catalog plus customs) and a
**+** button to create one.

**Filters** are in a collapsible panel (collapsed by default); when collapsed it summarises as
`<Type> · <Muscle>` (`All · All` with no filter). Tapping an active chip clears that filter.

- **Type** — All plus the 4 categories
- **Muscle** — All, 3 coarse groups (Legs, Back, Shoulders), or any of the 18 individual muscles.
  There is no coarse Chest group — chest is a single muscle, so one Chest chip covers it.

Filters AND together with the search query (`filterLibraryExercises()`). Above the list a count
line reads `<n> exercises` (`1 exercise` when singular) for the filtered result. Despite the placeholder "Search by name, muscle,
equipment…", **there is no equipment filter** in the UI — equipment is only reachable through
search text.

Default order with no query is catalog array order with customs appended — **not alphabetical**.

**List item:** name plus a "Custom" badge where applicable, muscle labels, then the type line
(`exerciseTypeLine()`): the category, then any equipment whose label differs from it —
`Free Weight · Barbell`, `Cable · Band`, but just `Machine` or `Bodyweight` rather than repeating
the word, and the category alone when a custom has no equipment. The detail sheet's Type row uses
the same line.

**Empty states:** with a search query and no results, a **Create "<query>"** row offers to save
it as a custom ("Save it as your own exercise."); tapping it opens the create form with the name
prefilled. With no query, the list reads "No exercises match these filters."

**Detail sheet** (tap a row): name, body diagram, muscle labels, type and equipment, Edit/Delete
for customs, instructions when present, and **Your notes** — a free-text field ("Seat height,
lever settings…") keyed by exercise id and synced to your account. Notes save on close, on overlay
tap, and on end-editing. They are trimmed; saving an empty note deletes the entry. Every change
persists locally and, with cloud sync on, queues the whole notes map as one snapshot. Content below the title scrolls when it exceeds the sheet max height.

There are **no favourites** on this tab, and no links to the PR or progression screens (those are
reached from History).

## Exercise pickers

Three separate inline implementations rather than one shared component: the template builder, and
the add and replace flows in the active workout. All use the same `searchExercises` over the
catalog plus customs, and all exclude already-selected exercises.

There is **no recently-used or most-used ordering** in any picker.

## Assumptions

| Assumption | Note |
|------------|------|
| Category and equipment lists are **closed enums** | Adding a value is a type + migration change |
| Catalog ids are permanent | Unpublish, never delete |
| Instructions ship in the binary and from the server | Bundled seed includes them; later copy changes arrive by delta |
| Custom exercises always track `weight_reps` | The field isn't editable |
| No dedupe against the catalog or between customs | Names are not unique |
| Sessions reference exercises by id only | No name snapshot — deleted customs are retired, not dropped, so history still resolves them |
| Custom exercises are account-private | Enforced by RLS |
| The catalog is shared and pulled by anonymous users too | It isn't user data |
| Default list order is catalog order | Not alphabetical, not by usage |

## Tests

Covered (Vitest):

- `src/data/catalogSeed.test.ts` — 399 rows / 396 published, the 3 unpublished ids, 177 / 102 /
  60 / 60 by Type, 37 alias rows, every row bundles the source instruction copy, no media URLs
- `src/data/exercises.test.ts` — source ids match the bundled seed; every exercise has
  instructions; no third-party URLs or attribution; current copy is present in a migration;
  one equipment per row, Type follows equipment (with the listed exceptions), and equipment
  agrees with the equipment named in the exercise (Barbell/Dumbbell/Cable/Smith Machine…)
- `src/sync/catalogMerge.test.ts` — seed overlay (seed fields and instructions win, cached
  instructions kept when the seed has none, cache-only ids kept); `reconcileCatalogCache` (empty
  cache, missing `seedAppliedAt`, newer seed, current cache untouched, watermark never moves back);
  `advanceWatermark`; delta merge by id (replace, append, later row wins)
- `src/sync/catalogPull.test.ts` — delta query (`updated_at >` watermark, ascending), row mapping,
  watermark advance, error / unconfigured keep the watermark
- `src/store/exercisesStore.test.ts` — load on the AsyncStorage harness: seed applied when the
  cache is empty / lacks `seedAppliedAt` / is older, current cache used as-is, refresh from the
  stored watermark, state set without waiting on the network; refresh merge + persist + watermark,
  empty delta writes nothing, single in-flight pull; `getAllExercises` hides unpublished rows and
  lists catalog then customs; custom add / update / remove (ids, normalization, instructions
  cleared, catalog ids not updatable, sync notifications, note deleted with the custom); a removed
  custom is retired (still resolvable, never listed, persisted) and its id never reused
- `src/store/exerciseNotesStore.test.ts` — load, trim, delete on empty, snapshot notification
- `src/sync/userExercises.test.ts` — custom-exercise notifications skipped when sync is off,
  queued when on (delete replaces a pending upsert); outbox → `user_exercises` rows and soft
  tombstones; `applyRemoteUserExercises` (add, take remote, tombstone removes and retires, dirty local wins)
- `src/utils/exerciseSearch.test.ts`, `exerciseSearchScoring.test.ts` — normalization, every
  score tier (1000 / 960 / 800 / 700 / 640 / 520 / 400 / 280 / 260), the 5-char floor for
  whole-string fuzzy, fuzzy limits by length, field bonuses, the 350 metadata cap, tie-break by
  name, empty query passthrough, abductor/adductor stems, no abbreviations
- `src/utils/exerciseNormalize.test.ts` — category inference order, invalid equipment and muscles
  stripped, `['chest']` fallback only when nothing valid is left, name → id fallback,
  `weight_reps` default, instructions trimmed/dropped, snake_case mapping
- `src/utils/exerciseLibraryFilter.test.ts` — Muscle groups (single Chest), Type / Muscle / query
  AND, order kept with no query, the `<Type> · <Muscle>` summary, and the type line (equipment
  matching the category isn't repeated)
- `src/utils/customExerciseForm.test.ts` — edit target only for existing customs; validation
  (trimmed name, Type, ≥1 muscle, no max length, blank instructions → none)
- `src/utils/exerciseTitleCase.test.ts` — title-case helper including every lowercase word;
  every catalog name matches it
- `src/utils/exerciseIds.test.ts` — custom id numbering; retired customs resolve after live ones; alias resolution, unpublished rows still
  resolving, unknown ids; catalog invariants
- `packages/types/src/exercise.test.ts` — category enum completeness, equipment labels
- `src/data/builtInTemplates.test.ts` — every built-in template exercise id exists in the catalog

Covered (Jest UI, `src/test/ui/exercises/`):

- `exercisesTab.test.tsx` — header count, list order, Custom badge and meta lines, count line
  (plural/singular), search, Type and Muscle chips (AND with the query, tapping an active chip
  clears it, collapsed summary, single Chest chip), empty-state copy, Create "<query>" opening the
  prefilled form, + button, detail sheet content, notes (save on Close / end-editing / backdrop,
  trim, delete on empty), Edit opening the prefilled form, Delete with confirm and cancel, list
  updates after a delete
- `createExercise.test.tsx` — validation, save → `custom_<n>` and
  back, a catalog id opens an empty create form (no clone), editing in place and clearing
  instructions, auto-add / swap when created from the active-workout picker

Not covered:

- The template-builder and active-workout exercise pickers (covered with their screens' specs)
- The generator script itself (its output is checked through `catalogSeed.ts`)
