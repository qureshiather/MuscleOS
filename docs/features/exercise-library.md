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
  equipment: Equipment[];     // may be empty
  category: ExerciseCategory;
  instructions?: string;
  aliases?: string[];         // catalog only — legacy slug redirects
  trackingType?: ExerciseTrackingType;  // defaults to 'weight_reps'
  isPublished?: boolean;      // catalog only; false hides from the list
  mediaUrl?: string;          // deprecated, unused
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

By category: 206 free weight, 93 bodyweight, 54 machine, 46 cable.

### Pipeline

```
src/data/exercises.ts          scraped source, with instructions + media
        │  generate-exercise-catalog.mjs
        ├──► src/data/catalogSeed.ts               bundled seed (no instructions)
        └──► supabase/migrations/*_seed.sql        catalog_exercises rows
                        │
                        ▼  fetchCatalogDelta(watermark)
              AsyncStorage catalog cache
```

`catalogSeed.ts` is **generated — do not hand-edit**. Regenerate with
`node apps/mobile/scripts/generate-exercise-catalog.mjs`.

The generator deliberately **omits instructions** from the bundled seed to keep the app binary
small; instructions live server-side and arrive via delta sync. Regenerating does not clobber
server-side instructions.

### Reconciliation and sync

On load the store reads custom exercises and the catalog cache in parallel, applies the bundled
seed if the cache is empty or the seed is newer, and sets state **without waiting on the network**.
A catalog refresh then runs in the background.

The delta pull queries `catalog_exercises` for rows with `updated_at >` the stored watermark,
merges them by id (later row wins), and advances the watermark. Catalog sync is pull-only and
runs for **all users including anonymous ones** — it's shared content, not user data.

Refresh triggers: app launch, app foreground, and Settings → Sync now.

**Offline:** the library is fully usable from the bundled seed plus cache; no network needed.

**Ids are never deleted, only unpublished** (`is_published = false`). This is what guarantees a
two-year-old session still resolves its exercise names.

### Legacy id resolution

37 catalog rows carry `aliases`, mapping old slugs to the canonical id. `getExercise(id)` resolves
aliases against the catalog before looking up, so renamed exercises don't orphan session data.

## Custom exercises

**Pro** (`custom_exercises`), gated at the screen level so deep links can't bypass it.

| Field | Required | Notes |
|-------|:--------:|-------|
| Name | ● | Non-empty after trim; no maximum length |
| Type (category) | ● | One of the 4 categories |
| Muscles | ● | At least one; any of the 17 |
| Equipment | ○ | May be empty |
| Instructions | ○ | Free text |

Ids are assigned as `custom_<n>` where n is the highest existing suffix + 1.

**Editing** is only possible for `custom_*` ids; catalog exercises cannot be edited. The detail
sheet on the Exercises tab offers Edit and Delete for customs.

### Normalization

`normalizeExercise()` runs on add, update, and on read from storage, making the store tolerant of
corrupt or older rows: invalid equipment values are stripped, a missing category is inferred from
equipment (cable → machine → bodyweight → free_weight), a missing name falls back to the id, and
missing muscles default to `['chest']`. The last two aren't reachable from the create UI, which
requires both.

**There is no deduplication.** Nothing stops you creating a second "Cable Row" that already
exists in the catalog, or two customs with the same name. Names aren't unique keys — ids are.

### Storage and privacy

Local: AsyncStorage `muscleos_custom_exercises`. With a linked account they also sync to the
`user_exercises` table via `upsert_user_exercises`, scoped by row-level security so they are
**private to your account**. Deletes are soft (`deleted_at`) so tombstones propagate. Anonymous
users keep customs on-device only.

### Deleting a custom exercise

The confirmation reads *"Past workouts keep the name if you logged it."* **This is inaccurate.**
Sessions store only `exerciseId`, never a name snapshot, so after deletion history renders the raw
id (e.g. `custom_3`). Either the copy or the behaviour should change; the copy describes the
intended design.

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

Field weighting on top of the tier: name +80, id +40, alias +20. Matches found **only** in
metadata (category label, equipment, muscle labels) are capped at 350 so a name match always
outranks an equipment match.

> **There is no abbreviation dictionary.** `"ohp"` will not find Overhead Press — it isn't a
> substring or within fuzzy distance. Aliases are legacy *slug* redirects for id resolution, and
> only help search if you happen to type the slug.

## Exercises tab

Header shows `<count> movements · tap for muscle map` and a **+** button (Pro) to create one.

**Filters** are in a collapsible panel; when collapsed it summarises as `<Type> · <Muscle>`.
Tapping an active chip clears that filter.

- **Type** — All plus the 4 categories
- **Muscle** — All, 4 coarse groups (legs, back, chest, shoulders), or any of the 17 individual muscles

Filters AND together with the search query. Despite the placeholder "Search by name, muscle,
equipment…", **there is no equipment filter** in the UI — equipment is only reachable through
search text.

Default order with no query is catalog array order with customs appended — **not alphabetical**.

**List item:** name plus a "Custom" badge where applicable, muscle labels, then category and
equipment labels.

**Detail sheet** (tap a row): name, body diagram, muscle labels, type and equipment, Edit/Delete
for customs, instructions when present, and **Your notes** — a free-text field ("Seat height,
lever settings…") keyed by exercise id and synced to your account. Notes save on close, on overlay
tap, and on end-editing. Content below the title scrolls when it exceeds the sheet max height.

There are **no favourites** on this tab, and no links to the PR or progression screens (those are
reached from History).

## Exercise pickers

Three separate inline implementations rather than one shared component: the template builder, and
the add and replace flows in the active workout. All use the same `searchExercises` over the
catalog plus customs, and all exclude already-selected exercises.

There is **no recently-used or most-used ordering** in any picker.

## Pro gates

| Action | Gate key |
|--------|----------|
| Create or edit a custom exercise (screen, + button, create-from-search) | `custom_exercises` |
| Add an exercise mid-workout | `add_exercise_mid_workout` |
| Replace an exercise mid-workout | `replace_exercise_mid_workout` |

Browsing, searching, filtering, viewing instructions, and writing notes are all **Basic**.

## Assumptions

| Assumption | Note |
|------------|------|
| Category and equipment lists are **closed enums** | Adding a value is a type + migration change |
| Catalog ids are permanent | Unpublish, never delete |
| Instructions are server-owned | Bundled seed ships without them |
| Custom exercises always track `weight_reps` | The field isn't editable |
| No dedupe against the catalog or between customs | Names are not unique |
| Sessions reference exercises by id only | No name snapshot — deleting a custom breaks history display |
| Custom exercises are account-private | Enforced by RLS |
| The catalog is shared and pulled by anonymous users too | It isn't user data |
| Default list order is catalog order | Not alphabetical, not by usage |

## Tests

Covered:

- `src/utils/exerciseSearch.test.ts` — diacritic/punctuation normalization; alias ranking; typo
  tolerance (`bnch` → Barbell Bench Press) and a negative case
- `src/utils/exerciseNormalize.test.ts` — equipment-based category inference, invalid equipment
  stripped, default muscles, snake_case tracking type, `is_published: false` mapping
- `packages/types/src/exercise.test.ts` — category enum completeness, equipment labels
- `src/data/builtInTemplates.test.ts` — every built-in template exercise id exists in the catalog

Not covered:

- `exercisesStore` load, seed application, cache merge, and background refresh
- Custom exercise CRUD and its sync notifications
- Delta pull and watermark advancement
- Search: metadata matching, multi-token ordering, score tie-breaks, empty-query passthrough
- The three pickers and the Exercises tab filters
- Exercise notes store
- Display behaviour after deleting a custom exercise referenced by history
