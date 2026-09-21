# Accounts & Data

App infrastructure: navigation, boot sequence, authentication, profile, settings, storage, cloud
sync, and export.

The governing rule is **local-first**. Every feature works offline against AsyncStorage. An
account is optional and adds backup plus multi-device sync; it is never required to log a workout.

| | |
|--|--|
| Root layout | `apps/mobile/app/_layout.tsx` |
| Auth | `apps/mobile/src/store/authStore.ts`, `src/lib/supabase.ts`, `app/auth.tsx`, `app/auth-email.tsx` |
| Profile / settings | `app/(tabs)/profile.tsx`, `app/settings.tsx`, `src/store/settingsStore.ts` |
| Storage | `apps/mobile/src/storage/keys.ts`, `src/storage/localStorage.ts` |
| Sync | `apps/mobile/src/sync/` |
| Theme | `apps/mobile/src/theme/` |
| Supabase schema | [supabase/setup.md](../supabase/setup.md) |

## Navigation and app boot

### Route tree

The root is a **Stack** with `headerShown: false` and `slide_from_right` by default; `(tabs)` is a
nested Tabs navigator. `/` redirects to `/(tabs)`.

**Tab bar order:** Workouts · Recovery · Exercises · History · Profile — with icons
`barbell-outline`, `pulse-outline`, `list-outline`, `time-outline`, `person-outline`. The tab bar is
custom (`TabBarWithResumePill`) so it can host the resume-workout pill.

**Pushed screens:** `/auth`, `/auth-email`, `/settings`, `/subscription`, `/create-template`,
`/create-exercise`, `/workout-preview`, `/active-workout`, `/history-monthly`,
`/exercise-progression`, `/personal-records`. `/templates` is a legacy redirect to the tabs.

`/active-workout` is the only screen with distinct presentation: **`slide_from_bottom`** with a
vertical gesture, so it reads as a modal you drop into and minimise out of.

Per-screen purposes: [product/overview.md](../product/overview.md#screen-map).

### Boot sequence

Fonts (DM Sans, DM Mono) gate the first render behind a spinner; a font load error proceeds anyway.
The native splash background is `#0a0a0b`.

Then, in `_layout.tsx`:

**Immediately, independent of auth** — so a workout in progress is never lost to a slow network:

1. `hydrateActiveWorkout()` — restore any in-progress session
2. `loadTemplates()` — needed to name that session

**Main init:** auth and subscription load sequentially; the remaining loads are then started
without awaiting one another.

3. `initAuth()` — existing Supabase session, or anonymous sign-in
4. `loadSubscription(userId)` — RevenueCat plus the cached tier
5. Start `loadSettings()` — units, theme, biodata, sounds
6. Start `loadCustomExercises()` — customs, seed, and cache; kicks off a background catalog refresh
7. Start `loadExerciseNotes()`
8. Start `loadStatus()` and `syncNow()` — cloud sync if an account is linked

**Notifications** load last, skipped in Expo Go, after an 800 ms delay that works around an Android
native module registry timing issue.

**On foreground:** refresh the subscription, refresh the exercise catalog, and sync.

Recovery is deliberately **not** loaded at boot — the tabs that need it load it on focus.
`healthStore.load()` is never called at all.

## Authentication

**Anonymous-first.** On first launch with Supabase configured, the app calls
`signInAnonymously()`; if Supabase isn't configured it simply stays unauthenticated. Either way the
app is fully usable. Anonymous users have `profile: null` and `isAnonymous: true`.

| Provider | Platforms | Implementation |
|----------|-----------|----------------|
| **Apple** | iOS only (button hidden on Android) | `expo-apple-authentication` + `linkIdentity` |
| **Google** | iOS + Android | `expo-auth-session` OAuth + `linkIdentity`; needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |
| **Email** | All | `signUp` / `signInWithPassword`, minimum 6-character password |

Apple and Google use `linkIdentity` so an anonymous account upgrades in place, preserving its id.
**Email does not** — it uses `signUp`/`signInWithPassword`, which is an inconsistency worth knowing
about when reasoning about data migration on link.

**On linking**, an anonymous session triggers `onAccountLinked()`, which uploads a full snapshot of
local data and then syncs. Any signed-in user also gets `revenueCatLogIn(user.id)` so the
entitlement follows the identity.

**Sign out** signs out of Supabase, immediately creates a **new anonymous session**, and re-points
RevenueCat at it. **Local workout data is not cleared** — you keep your history on the device, and
the subscription stays attached to the account you signed out of.

**Account deletion is not implemented.**

### Token storage

Supabase sessions persist via **AsyncStorage**, not SecureStore, with auto-refresh on foreground.
`expo-secure-store` is installed as a plugin and referenced in Android backup rules, but **no app
code currently reads or writes SecureStore**. Older documentation and comments claiming auth
uses SecureStore were inaccurate.

### Required env vars

`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and optionally
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

## Profile

Two distinct things share the Profile screen: the **account** (read-only, from Supabase) and
**biodata** (`UserAppProfile`, editable, stored locally and synced as app settings).

| Biodata field | Validation | Used by |
|---------------|------------|---------|
| `heightCm` | > 0 | BMR/TDEE helpers only (no UI) |
| `weightKg` | > 0 | **Strength standards** on PR and progression screens |
| `age` | > 0 and < 150 | BMR/TDEE helpers only — **not** used by recovery or standards |
| `sex` | `male` \| `female` | Body diagram figure; strength standard tables |
| `notNatty` | toggle | **Halves all recovery durations** |

Not collected: display name (set at sign-in), birthdate, experience level, training goals.

The screen's subtitle says biodata is "Used for recovery estimates", which is true of `notNatty` and
`sex`; `weightKg` is used for strength standards elsewhere, and `age`/`heightCm` are currently
unused by any surfaced feature.

## Settings

| Setting | Values | Default | Effect |
|---------|--------|---------|--------|
| Theme | `auto` / `dark` / `light` | `auto` | Follows the device in auto |
| Height unit | `cm` / `in` | `cm` | Display only |
| Body weight unit | `kg` / `lb` | `kg` | Display only |
| Exercise weight unit | `kg` / `lb` | `kg` | Display only — set logging, PRs, volume |
| Workout sounds | on / off | **on** | Rest tick, rest end, set complete, workout complete, and the rest notification sound |

The three unit settings are **independent**, so you can weigh yourself in pounds and lift in kilos.
A legacy migration promotes older single-unit preferences to `unit_system: imperial`.

**Actions:** Sync now (linked accounts only), Export my data, Clear all data. Clearing data resets
the theme and wipes app keys but **keeps the auth session** — and notably does *not* clear the
active workout, sync outbox, sync meta, or the exact-alarm prompt flag.

**Not settings:** rest timer default (a 120 s code constant, overridable per exercise in a session),
haptics (none exist), and notification preferences beyond sounds.

### Unit conversion

`src/utils/weightUnits.ts`. kg and cm are canonical in storage.

| Direction | Rule |
|-----------|------|
| kg → display | lb: `round(kg × 2.20462 × 10) / 10`; kg: 1 decimal |
| display → kg | lb: `round((lb / 2.20462) × 100) / 100`; kg: as entered |
| cm → display | in: `round(cm / 2.54 × 10) / 10`; cm: 1 decimal |
| display → cm | in: `round((in × 2.54) × 100) / 100` |

Display rounds to 1 decimal, storage to 2 — enough that a round-trip through pounds doesn't drift
visibly.

## Health

`healthStore` persists macro targets and metabolism figures and exposes `computeBMR`,
`computeTDEE`, and `computeMacros` (Mifflin-St Jeor plus activity multipliers).

**It has no UI.** No screen imports it, `load()` is never called, and it is not synced. The data is
included in the export payload if it somehow exists. There is **no HealthKit or Google Fit
integration** anywhere in the app.

Treat this as scaffolding for a nutrition feature that was never built.

## Cloud sync

**Enabled only for a linked, non-anonymous account with Supabase configured.** Anonymous users are
device-only until they link.

### What syncs

Via `sync_records` and the `upsert_sync_records` RPC:

`session` · `template` · `template_folder` · `exercise_previous` · `exercise_note` · `app_settings`

Custom exercises use their own table and RPC (`user_exercises` / `upsert_user_exercises`). The
exercise catalog is a separate **pull-only** delta available to all users, including anonymous ones.

A `recovery` entity type exists but is **explicitly excluded from push and never applied from
remote** — after a merge, recovery is recomputed locally from the merged sessions. This avoids
syncing derived state that could contradict its own inputs.

### Conflict resolution

Local-first, in `src/sync/mergePolicy.ts`:

1. Missing locally → take the remote row
2. New locally → keep it and push
3. Conflict with pending local changes → **local wins**, bumping `updatedAt` if the remote is newer
4. Conflict with no pending local changes → **last write wins** by `updated_at`; ties go to local
5. Map-shaped snapshots (notes, previous, settings) → union keys; an empty local map takes remote,
   a non-empty local map wins

### Triggers

App launch, app foreground, account link (full snapshot upload), finishing a workout,
pull-to-refresh on History, the Profile sync row, Settings → Sync now, and a 2-second debounced
push after any local mutation.

### What is NOT backed up

Worth being precise about, because users will assume an account means everything is safe:

| Data | Storage key |
|------|-------------|
| Recovery state | `muscleos_recovery` — derived; recomputed after merge |
| Health / macros | `muscleos_health` — never synced |
| Subscription cache | `muscleos_subscription` — RevenueCat is the truth |
| In-progress workout | `muscleos_active_workout` — device session state |
| Hidden built-in template / folder ids | `muscleos_hidden_builtin_*` — **UI preference lost on a new device** |
| Catalog cache and watermark | `muscleos_catalog_*` — re-pulled |
| Sync outbox and meta | `muscleos_sync_outbox`, `muscleos_sync_meta` |
| Dev Pro override | `muscleos_dev_pro_override` |
| Exact-alarm prompt flag | `muscleos_exact_alarm_prompt_shown` |

Of these, hidden built-in ids are the only genuine user intent that doesn't survive a device change.

## Storage

All app data is in **AsyncStorage**; see [Token storage](#token-storage) regarding SecureStore.

| Key | Contents | Synced |
|-----|----------|:------:|
| `muscleos_templates` | Custom templates | ● |
| `muscleos_template_folders` | Custom folders | ● |
| `muscleos_sessions` | Completed sessions | ● |
| `muscleos_exercise_previous` | Best weighted set from the most recent qualifying session, per exercise | ● |
| `muscleos_exercise_notes` | Per-exercise notes | ● |
| `muscleos_custom_exercises` | Custom exercises | ● (`user_exercises`) |
| `muscleos_profile`, `muscleos_theme`, `muscleos_unit_system`, `muscleos_*_unit`, `muscleos_workout_sounds` | Biodata and settings | ● (as `app_settings`) |
| `muscleos_hidden_builtin_template_ids`, `..._folder_ids` | Hidden built-ins | ○ |
| `muscleos_recovery` | Derived recovery cache | ○ |
| `muscleos_active_workout` | In-progress session + rest state | ○ |
| `muscleos_health` | Macro targets, metabolism | ○ |
| `muscleos_subscription` | Cached tier | ○ |
| `muscleos_catalog_exercises`, `muscleos_catalog_watermark`, `muscleos_catalog_seed_applied_at` | Catalog cache | ○ |
| `muscleos_sync_outbox`, `muscleos_sync_meta` | Sync transport | ○ |
| `muscleos_dev_pro_override` | Dev testing | ○ |
| `muscleos_exact_alarm_prompt_shown` | Android prompt-once flag | ○ |

### Migrations

There is **no numeric schema version** on the AsyncStorage blobs. Migrations run opportunistically
on read:

| Migration | Where |
|-----------|-------|
| Template `days[]` → flat `exerciseIds` | `migrateTemplateFromDays()` on read |
| Template `defaultSets` → per-exercise `exercises` | `normalizeWorkoutTemplate()` on read (and on every custom-template write) |
| Legacy lb/in preference → `unit_system: imperial` | `getAppSettings` / `settingsStore.load` |
| Remote `app_settings` missing `themePreference` | `normalizeAppSettings()` |
| Any persisted subscription tier other than `'pro'` → `'basic'` | `getSubscription()` in `localStorage.ts` |

Export carries an explicit `version: 1`.

## Notifications and permissions

| Permission | Platform | When | Why |
|------------|----------|------|-----|
| Notifications | iOS + Android | First workout notification | Ongoing workout status, rest-over alerts |
| `POST_NOTIFICATIONS` | Android 13+ | Runtime, via expo-notifications | As above |
| `SCHEDULE_EXACT_ALARM` | Android 13+ | Prompted once on first rest timer | On-time rest alerts; otherwise up to a minute late |

`RECORD_AUDIO` is **explicitly removed** from the Android manifest — the app plays audio but never
records. iOS declares the time-sensitive notification entitlement so rest alerts break through
Focus modes.

Channels: `workout_fallback_v1` (low importance, ongoing) and `rest_complete_fallback_v1` (high
importance, custom sound), plus the native module's own channels on Android. Deep link scheme is
`muscleos`.

Behaviour detail: [workout-logging.md](workout-logging.md#notifications).

## Theming

Modes `auto` / `dark` / `light`, default `auto`. Palette hex values live in **one place**:
`paletteConfig` in `src/theme/palette.ts`. `buildThemeColors(mode)` derives the translucent and
tinted tokens from those base values.

**Screens must use `useTheme().colors`** — no hardcoded hex or rgba in components.

Base roles: `background`, `surface`, `surfaceElevated`, `border`, `text`, `textSecondary`,
`textMuted`, `primary`, `primaryDim`, `primaryOn`, `accent`, `accentDim`, `danger`, `warning`,
`success`, `successOn`, `muscleHighlight`, `muscleRecovering`, `recoveryHot`, `recoveryWarm`,
`recoveryReady`, `bodyDiagramBorder`, `bodyDiagramFill`.

Derived: `primarySurface`, `primaryBorder`, `successSurface`, `tableHeader`, `rowWarmUp`,
`rowFuture`, `inputBorder`, `overlay`.

## Export

Settings → **Export my data**. Basic tier. Writes pretty-printed JSON to the cache as
`muscleos-export-YYYY-MM-DD.json` and opens the share sheet (`expo-sharing`,
`application/json`).

**Included:** `version: 1`, `exportedAt`, account profile (if linked), subscription, templates,
template folders, the stored finished-session list, recovery, exercise notes, custom exercises,
and health.

**Not included:** app settings (units, theme, sounds), biodata (`UserAppProfile`), hidden built-in
ids, the exercise-previous map, the active in-progress workout, and the catalog cache.

> The export is therefore **not a complete backup** — it omits settings, biodata, and the previous
> map. It is a data-portability artifact for reading your own history, not a restore file. There is
> **no import**.

## Build and release

App name MuscleOS, version 1.0.0, portrait only, scheme `muscleos`. iOS bundle id
`com.muscle-os.app` and Android package `com.muscleos.app` — the mismatch is intentional and
documented in [mobile/eas-build.md](../mobile/eas-build.md).

| EAS profile | Purpose |
|-------------|---------|
| `development` | Dev client, internal distribution |
| `preview` | Internal APK / ad-hoc IPA, standalone (no Metro) |
| `production` | Store builds, `autoIncrement: true` |

Base image: Node 20.18.0, pnpm 9.14.2, Expo SDK 54.

| Env var | Needed for |
|---------|-----------|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **Required** — accounts and sync |
| `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` / `_ANDROID` | In-app purchases |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google sign-in |
| `EXPO_PUBLIC_ENABLE_GRANT_PRO_TESTING` | Dev Pro override — **defaults to on**; set `false` for production |

Injected via `app.config.js` into `Constants.expoConfig.extra`.

## Assumptions

| Assumption | Note |
|------------|------|
| Local-first; an account is optional | Everything works offline |
| Anonymous session on first launch | No signup wall |
| Sign-out keeps local data | You don't lose history by signing out |
| Local wins on sync conflict when dirty | The device you're holding is the one you just used |
| Recovery is never synced | Derived from sessions; recomputed after merge |
| kg and cm canonical in storage | Units are a display concern only |
| No storage schema version | Migrations are opportunistic on read |
| Export is portability, not backup | Omits settings and biodata; no import |
| Hidden built-in ids are device-local | The only user intent lost on a new device |

## Not implemented

- Account deletion
- Data import
- SecureStore-backed auth (uses AsyncStorage)
- Email account **linking** (uses sign-up/sign-in, unlike Apple/Google)
- HealthKit / Google Fit, and any UI for `healthStore`
- Haptics setting
- A rest-timer default in Settings
- Server-side subscription mirror (see [subscriptions.md](subscriptions.md#not-implemented))

## Tests

Covered:

- `src/utils/weightUnits.test.ts` — kg/lb and cm/in conversion and formatting round-trips
- `src/storage/localStorage.activeWorkout.test.ts` — the `muscleos_active_workout` persist/resume
  round-trip through an in-memory AsyncStorage harness (`src/test/mocks/`, aliased in
  `vitest.config.mts`), including null-clear and the corrupt / missing-`exercises` guards. This is
  the first storage-layer test; the harness is reusable for other keys.

Not covered — the least-tested area of the codebase:

- **Sync**: outbox behaviour, the merge policy's five branches, last-write-wins, the account-link
  snapshot upload, tombstones
- **Auth**: anonymous bootstrap, linking each provider, sign-out creating a fresh anonymous session,
  RevenueCat identity handoff
- Settings and theme persistence, and each migration path
- `clearAllData` scope, including the keys it intentionally leaves behind
- Export payload assembly and its documented omissions
- `healthStore` BMR/TDEE math
- Notification permission gating and scheduling
