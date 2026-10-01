# Accounts & Data

App infrastructure: navigation, boot sequence, authentication, profile, settings, storage, cloud
sync, and export.

The governing rule is **local-first**. Every feature works offline against AsyncStorage. An
account is optional and adds backup plus multi-device sync; it is never required to log a workout.

| | |
|--|--|
| Root layout | `apps/mobile/app/_layout.tsx` |
| Auth | `apps/mobile/src/store/authStore.ts`, `src/lib/supabase.ts`, `app/auth.tsx`, `app/auth-email.tsx` |
| Profile / settings | `app/(tabs)/profile.tsx`, `app/account.tsx`, `app/settings.tsx`, `app/biodata.tsx`, `app/data.tsx`, `src/store/settingsStore.ts` |
| Storage | `apps/mobile/src/storage/keys.ts`, `src/storage/localStorage.ts` |
| Sync | `apps/mobile/src/sync/` |
| Theme | `apps/mobile/src/theme/` |
| Supabase schema | [supabase/setup.md](../supabase/setup.md) |

## Navigation and app boot

### Route tree

The root is a **Stack** with `headerShown: false` and `slide_from_right` by default; `(tabs)` is a
nested Tabs navigator. `/` redirects to `/(tabs)`.

**Tab bar order:** Exercises · Recovery · Workouts · History · Profile — with icons
`list-outline`, `pulse-outline`, `barbell-outline`, `time-outline`, `person-outline`. The tab bar is
custom (`TabBarWithResumePill`) so it can host the resume-workout pill. It is sized from its content
(`computeTabBarLayout`): icon and label sit centred between equal top and bottom padding, and a larger
system bottom inset (home indicator, Android nav bar) replaces the bottom padding rather than adding to it.

**Pushed screens:** `/auth`, `/auth-email`, `/account`, `/settings`, `/biodata`, `/data`, `/subscription`, `/create-template`,
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
| **Apple** | iOS only (button hidden on Android) | `expo-apple-authentication` + `linkIdentity`, falling back to `signInWithIdToken` when that Apple identity already belongs to another user. Production IPAs include `ios.usesAppleSignIn`. |
| **Google** | iOS + Android | **Android:** `@react-native-google-signin/google-signin` (Play Services, id token). **iOS:** `expo-auth-session` OAuth until a native iOS client is added. Both use the same `linkIdentity` / `signInWithIdToken` fallback as Apple. Needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Google Cloud **Web** OAuth client) plus an Android OAuth client (`app.muscleos` + SHA-1). |
| **Email** | All | `signUp` / `signInWithPassword`, minimum 6-character password. Create account asks for the password twice and each field can be revealed. Signup and password reset emails link to `https://muscleos.app/auth/confirm` with a `token_hash` (not `{{ .ConfirmationURL }}`), which opens `muscleos://auth-callback`. An expired link stays on that page. The “check your email” notice is a themed `ConfirmDialog`, including when sign-in is blocked because the address is not confirmed yet. Forgot password is on the email sign-in screen and says a link is sent only if the email exists. A missing address shows no dialog. A sent request shows a themed dialog that does not claim the address is registered. A recovery link opens **New password**, which also requires a matching pair. Signed-in email users can also use **Change password** on the Account screen (the same screen with `mode=change`): it asks for the current password, re-verifies it with `signInWithPassword` (`updateUser` alone doesn't check it), then sets the new one. |

On a **first device**, Apple and Google `linkIdentity` so the anonymous guest upgrades in place and
keeps its id (and any workouts already logged). On a **new device**, that identity is already on the
original user, so link fails with "already linked" and the app signs into that user instead. The same
fallback runs when the link fails because the provider's email already has an account (for example
Apple first, then Google with the same address): `signInWithIdToken` attaches the new identity to that
account by verified email. Apple **Hide My Email** relay addresses don't match the user's Google email,
so those stay separate accounts. Empty
local then takes remote on sync — sessions, templates, customs, notes, previous, biodata.

**Error copy.** Auth, link, sync and export failures never show raw Supabase, Google or Apple
messages. `friendlyAuthError()` (`src/auth/authErrors.ts`) maps known cases (wrong password, weak
password, invalid email, rate limits, email send failures, expired links, network and timeouts) to
plain MuscleOS wording, and anything else to a per-flow fallback. Setup hints such as "Supabase is
not configured" and the Android emulator DNS tip appear only in `__DEV__` builds; raw errors go to
`console.warn` in dev.

**Email does not** upgrade the current guest in place — `signUp`/`signInWithPassword` is always a
different user id unless that email already belongs to an Apple or Google account. Cloud backup is
**per email**: Apple, Google, or a password with the same address is the same MuscleOS account. That
is stated on the email sign-in and create-account screen, and again on Delete account. Profile and
the method picker only say why to sign in. Privacy and Terms state the rule in full.

**On an in-place link**, `onAccountLinked()` uploads a full snapshot of local data and then syncs.
**On signing into an existing account** (new device, or email password), the app `syncNow()` —
pull first — so an empty phone fills from the cloud. Any signed-in user also gets
`revenueCatLogIn(user.id)` so the entitlement follows the identity.

**Sign out** signs out of Supabase, immediately creates a **new anonymous session**, and re-points
RevenueCat at it. The Account screen asks with a themed `ConfirmDialog` first. **Local workout data is not cleared** — you keep your history on the device, and
the subscription stays attached to the account you signed out of.

**Delete account** (linked accounts only) lives on the Account screen, opened from Profile. Two themed confirms
(`ConfirmDialog`, not the system alert). Copy says this email's Apple, Google, and password sign-in
are the same account. It calls the `delete-account` Edge Function, which revokes
a Sign in with Apple token when present and hard-deletes the Supabase user (`sync_records` and
`user_exercises` cascade). Then this device is wiped — `clearAllData` plus the in-progress workout
and sync transport — and a **new anonymous session** starts, same as first launch. An App Store or
Google Play subscription is **not** cancelled; the confirm copy says to cancel it in store settings.
Anonymous users have no account to delete; they still have Profile → Account → Data → Clear all data.

**Web deletion** (`https://muscleos.app/delete-account`) is the no-app path Google Play requires.
The page sends a one-time email code with `signInWithOtp({ shouldCreateUser: false })`, verifies it
with `verifyOtp({ type: 'email' })`, and after a confirm checkbox calls the same `delete-account`
function with that session. The session is memory-only (`persistSession: false`). The page:

- never creates a user, anonymous or otherwise
- says "if an account exists" whether or not it does, so it can't be used to test addresses
- waits 60s before sending another code and asks for a new code after 5 wrong ones
- refuses to render inside a frame; the site also sends `frame-ancestors 'none'`

It adds no endpoint of its own. The code email is a normal Supabase Auth send, rate limited the same
way as signup and password reset (see [live services](../operations/live-services.md#supabase)).
`delete-account` needs a valid user JWT, only deletes the caller, and rejects bodies over 4 KB.
Deleting from the web doesn't touch the phone; local data stays until Clear all data or uninstall.
Pure helpers (`apps/landing/app/delete-account/flow.ts`) are covered by `flow.test.ts`.

After a successful Apple link, the app stores the short-lived `authorizationCode` and invokes
`save-apple-token` so a refresh token can be kept for later revoke. Reviewers who delete
immediately can still send that code on delete.

### Token storage

Supabase sessions persist via **AsyncStorage**, not SecureStore, with auto-refresh on foreground.
`expo-secure-store` is installed as a plugin and referenced in Android backup rules, but **no app
code currently reads or writes SecureStore**. Older documentation and comments claiming auth
uses SecureStore were inaccurate.

### Required env vars

`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and optionally
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Google Cloud **Web** client ID — required for Google Sign-In
on Android).

## Profile

The tab is three headed cards, in order: **Account**, **Settings**, then **Biodata**. Each card is one row that pushes a screen.

**Account** on this tab shows the linked identity without opening `/account`: the provider icon, **Apple ID**, **Google**, or **Email** (resolved from Supabase identities), the display name when set, and the email. A chevron still opens `/account`. Guests see **Sign in or create an account** and “Back up your data and restore Pro on any device.”

`/account` is identity plus the account-owned destinations. Linked accounts show the provider, display name, and email, then a tap-to-sync row and Sign out. Guests see “Sign in to back up your data and restore Pro on any device.” and a Sign in CTA. The method picker says linking an account backs up your data and restores Pro on any device. Sign out does not wipe local workouts.

Rows on the Account screen: Subscription, Data (`/data`), Change password (linked accounts with an email identity, via `hasPasswordSignIn`), Delete account (linked only), Privacy Policy, Terms of Service. Legal lives only here — Settings does not repeat it.

**Settings** on this tab is a single row into `/settings` (“Appearance, units, sounds”).

**Biodata** on this tab is a single row into `/biodata` (“Height, weight, age, gender”). The hint is “Used for recovery estimates” until a value is saved, then a compact summary of the saved fields.

**Biodata** (`/biodata`) shows `UserAppProfile` read-only — stored locally and synced as app settings. **Edit** opens a modal for height, weight, age, and gender; Save writes them together.

| Biodata field | Validation | Used by |
|---------------|------------|---------|
| `heightCm` | > 0 | BMR/TDEE helpers only (no UI) |
| `weightKg` | > 0 | **Strength standards** on PR and progression screens |
| `age` | > 0 and < 150 | BMR/TDEE helpers only — **not** used by recovery or standards |
| `sex` | `male` \| `female` | Body diagram figure; strength standard tables |

Not collected: display name (set at sign-in), birthdate, experience level, training goals.

Older builds had a **Not natty** toggle (`notNatty`) that halved recovery. It has been removed.
`normalizeProfile()` drops the flag when a stored or synced profile is read, so it stops
round-tripping through the synced copy.

The Biodata screen says it is "Used for recovery estimates". Of the biodata fields, only `sex`
touches the Recovery tab, and only to pick the diagram figure. `weightKg` is used for strength
standards elsewhere, and `age` and `heightCm` aren't used by any feature users can see.

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

Settings is **Appearance**, **Units**, and **Sounds** only.

**Data** (`/data`, from Profile → Account): Sync now (linked accounts only), Export my data, Clear
all data. Clearing data resets the theme and wipes app keys but **keeps the auth session** — and
notably does *not* clear the active workout, sync outbox, sync meta, or the exact-alarm prompt
flag.

Privacy and Terms open `https://muscleos.app/privacy` and `https://muscleos.app/terms` from
Profile → Account.

**Not settings:** rest timer default (a 120 s code constant, overridable per exercise in a session),
haptics (none exist), and notification preferences beyond sounds.

### Unit conversion

`src/utils/weightUnits.ts`. kg and cm are canonical in storage.

| Direction | Rule |
|-----------|------|
| kg → display | lb: `round(kg × 2.20462 × 10) / 10` (1 decimal); kg: 2 decimals |
| display → kg | lb: `round((lb / 2.20462) × 100) / 100`; kg: as entered |
| cm → display | in: `round(cm / 2.54 × 10) / 10`; cm: 1 decimal |
| display → cm | in: `round((in × 2.54) × 100) / 100` |

Pounds display rounds to 1 decimal and kilograms to 2, so a 2.5 lb or 0.25 kg plate step survives
a round-trip. Storage of a pounds value is 2 decimal kilograms — enough that the round-trip
doesn't drift visibly.

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

Local-first. Rules in `src/sync/mergePolicy.ts`, applied by `applyRemoteRecords()` in
`src/sync/merge.ts`. "Pending" means the row has an entry in the sync outbox.

1. Missing locally → take the remote row
2. New locally → keep it and push
3. Conflict with pending local changes → **local wins**, bumping the outbox `updatedAt` if the
   remote is newer so the push isn't rejected
4. Conflict with no pending local changes:
   - **Sessions** → last write wins, comparing the remote `updated_at` with the local
     `completedAt` (or `startedAt`); ties go to local
   - **Templates, folders, custom exercises** → no local timestamp, so the remote copy is taken
5. Map-shaped snapshots (notes, previous, settings):
   - Pending local changes → keep local and union keys, filling empty local slots from remote
     (settings merge field by field; biodata fields likewise)
   - No pending changes, or an empty local map → the remote snapshot replaces local
6. Remote deletes (`deleted_at`) follow the same rules: applied unless the local row is pending
7. `recovery` records are ignored, queued recovery pushes are dropped, and recovery is recomputed
   from the merged sessions

### Triggers

App launch, app foreground, account link (full snapshot upload), finishing a workout,
pull-to-refresh on History, the Profile sync row, Data → Sync now, and a 2-second debounced
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
| Apple authorization code | `muscleos_apple_authorization_code` — used only to revoke Sign in with Apple on delete |

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
| `muscleos_active_workout` | In-progress session + rest state + `lastActivityAt` | ○ |
| `muscleos_health` | Macro targets, metabolism | ○ |
| `muscleos_subscription` | Cached tier | ○ |
| `muscleos_catalog_exercises`, `muscleos_catalog_watermark`, `muscleos_catalog_seed_applied_at` | Catalog cache | ○ |
| `muscleos_sync_outbox`, `muscleos_sync_meta` | Sync transport | ○ |
| `muscleos_dev_pro_override` | Dev testing (`__DEV__` builds only; cleared in release) | ○ |
| `muscleos_exact_alarm_prompt_shown` | Android prompt-once flag | ○ |
| `muscleos_apple_authorization_code` | Short-lived Apple auth code for Sign in with Apple revoke | ○ |

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

Profile → Account → Data → **Export my data**. Basic tier. Writes pretty-printed JSON to the cache as
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
`com.muscle-os.app` and Android application id `app.muscleos` — they differ on purpose
(`com.muscleos.app` was already taken on Google Play by another developer); see
[mobile/eas-build.md](../mobile/eas-build.md). The Android Kotlin namespace stays `com.muscleos.app`;
only the application id changed.

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

Injected via `app.config.js` into `Constants.expoConfig.extra`.

## Assumptions

| Assumption | Note |
|------------|------|
| Local-first; an account is optional | Everything works offline |
| Anonymous session on first launch | No signup wall |
| Sign-out keeps local data | You don't lose history by signing out |
| Delete account wipes this device | Stronger than sign-out; you continue as a guest. Store billing is separate |
| Local wins on sync conflict when dirty | The device you're holding is the one you just used |
| Recovery is never synced | Derived from sessions; recomputed after merge |
| kg and cm canonical in storage | Units are a display concern only |
| No storage schema version | Migrations are opportunistic on read |
| Export is portability, not backup | Omits settings and biodata; no import |
| Hidden built-in ids are device-local | The only user intent lost on a new device |

## Not implemented

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
- `src/storage/localStorage.profile.test.ts` — `normalizeProfile()` keeps the four biodata fields
  and drops `notNatty`, unknown keys, and malformed values, for both a stored profile and a synced
  `app_settings` payload
- `src/auth/deleteAccount.test.ts` — after Delete account, local sessions/templates/active workout/
  sync transport/biodata/Apple auth code are gone, and a fresh anonymous guest re-points RevenueCat.
- `src/auth/authErrors.test.ts` — known Supabase errors map to plain copy; unknown backend or provider
  messages never leak (no "supabase", never the raw text) in any flow
- `src/auth/accountProvider.test.ts`, `attachAccount.test.ts`, `emailCallback.test.ts`,
  `edgeFunctionError.test.ts` — linked-provider resolution, already-linked identity vs in-place
  upgrade, confirm/recovery link parsing, and Edge Function error messages
- `src/sync/mergePolicy.test.ts` — every `decideEntityApply` branch, the outbox clock bump, map and
  settings merges, and what counts as empty
- `src/sync/merge.test.ts` — `applyRemoteRecords` against the storage harness: missing rows taken,
  dirty local kept with its clock bumped, session last-write-wins both ways, clean templates take
  remote, remote deletes, dirty vs clean map snapshots, remote recovery ignored and recomputed

Not covered — the least-tested area of the codebase:

- **Sync**: outbox enqueue/flush, the push/pull engine, and the account-link snapshot upload
- **Auth**: anonymous bootstrap, linking each provider, sign-out creating a fresh anonymous session,
  RevenueCat identity handoff
- Settings and theme persistence, and each migration path
- `clearAllData` scope, including the keys it intentionally leaves behind
- Export payload assembly and its documented omissions
- `healthStore` BMR/TDEE math
- Notification permission gating and scheduling
