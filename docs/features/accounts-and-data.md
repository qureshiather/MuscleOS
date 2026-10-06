# Accounts & Data

App infrastructure: navigation, boot sequence, authentication, profile, settings, storage, cloud
sync, and export.

The governing rule is **local-first**. Every feature works offline against AsyncStorage. An
account is optional and adds backup plus multi-device sync; it is never required to log a workout.

| | |
|--|--|
| Root layout | `apps/mobile/app/_layout.tsx` |
| Auth | `apps/mobile/src/store/authStore.ts`, `src/auth/`, `src/lib/supabase.ts`, `app/auth.tsx`, `app/auth-email.tsx`, `app/auth-new-password.tsx`, `app/auth-callback.tsx` |
| Profile / settings | `app/(tabs)/profile.tsx`, `app/account.tsx`, `app/settings.tsx`, `app/acknowledgements.tsx`, `app/biodata.tsx`, `app/data.tsx`, `src/store/settingsStore.ts` |
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

**Pushed screens:** `/auth`, `/auth-email`, `/auth-new-password`, `/auth-callback`, `/account`, `/settings`, `/acknowledgements`, `/biodata`, `/data`, `/create-template`,
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

1. `hydrateActiveWorkout()` — restore any in-progress session; a workout idle for 3 h or more is
   closed instead (see [workout-logging.md](workout-logging.md)). The same stale check runs on
   every foreground.
2. `loadTemplates()` — needed to name that session
3. `loadCustomExercises()` — customs, seed, and cache; kicks off a background catalog refresh
4. `removeLegacyStorageKeys()` — drops keys from the removed Pro subscription (see
   [pricing.md](pricing.md#upgrading-from-a-build-that-had-pro))

**Main init:** auth loads first; the remaining loads are then started without awaiting one another.

5. `initAuth()` — existing Supabase session, or anonymous sign-in (`resolveLaunchUser`,
   `src/auth/authSession.ts`). Each call gives up after **10 s** (`AUTH_INIT_TIMEOUT_MS`); a timeout
   or error leaves the app an unauthenticated, device-only guest for this launch
6. Start `loadSettings()` — units, theme, biodata, sounds
7. Start `loadExerciseNotes()`
8. Start `loadStatus()` and `syncNow()` — cloud sync if an account is linked

**Email links** (`EmailAuthLinks`): the initial URL and every later `url` event are checked once
each; confirm/recovery links are completed and routed (see [Authentication](#authentication)).

**Notifications** load last, skipped in Expo Go, after an 800 ms delay that works around an Android
native module registry timing issue.

**On foreground:** refresh the exercise catalog, and sync.

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
| **Email** | All | `signUp` / `signInWithPassword`, minimum 6-character password. Create account asks for the password twice and each field can be revealed. Create account with an address that already has an account signs into it with the entered password instead. Signup and password reset emails link to `https://muscleos.app/auth/confirm` with a `token_hash` (not `{{ .ConfirmationURL }}`), which opens `muscleos://auth-callback`. An expired link stays on that page. In the app, `/auth-callback` shows a spinner (“Opening your link…”) while the root layout's `EmailAuthLinks` verifies the link; `emailLinkDestination()` then opens **New password** for a recovery link and the tabs for a confirmed sign-in. A failed link alerts “Could not open link” with friendly copy and goes to the tabs. If nothing navigates within 15 s (a link without tokens, or one already handled), the route goes to the tabs itself. The “check your email” notice is a themed `ConfirmDialog`, including when sign-in is blocked because the address is not confirmed yet. Forgot password is on the email sign-in screen and says a link is sent only if the email exists. A missing address shows no dialog. A sent request shows a themed dialog that does not claim the address is registered. A recovery link opens **New password**, which also requires a matching pair. Signed-in email users can also use **Change password** on the Account screen (the same screen with `mode=change`): it asks for the current password, re-verifies it with `signInWithPassword` (`updateUser` alone doesn't check it), then sets the new one. |

On a **first device**, Apple and Google `linkIdentity` so the anonymous guest upgrades in place and
keeps its id (and any workouts already logged). On a **new device**, that identity is already on the
original user, so link fails with "already linked" and the app signs into that user instead. The same
fallback runs when the link fails because the provider's email already has an account (for example
Apple first, then Google with the same address): `signInWithIdToken` attaches the new identity to that
account by verified email. Apple **Hide My Email** relay addresses don't match the user's Google email,
so those stay separate accounts. What happens to this device's data on that sign-in is under
[Changing accounts](#changing-accounts).

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
**On signing into an existing account** (new device, or email password), the app `syncNow()`; see
[Changing accounts](#changing-accounts).

**Sign out** (`signOutToGuest`, `src/auth/authSession.ts`) signs out of Google and Supabase,
immediately creates a **new anonymous session** and resets the sync
transport (outbox emptied, sync meta handed to the new guest). The Account screen asks with a themed
`ConfirmDialog` first. **Local workout data is not cleared** — you keep your history on the device.
Changes not yet pushed are
still in local storage; signing into an account again uploads them as local data.

### Changing accounts

The sync outbox and watermark belong to one account: sync meta records its `userId`. Before every
push, pull or sync, `ensureSyncOwner()` compares it with the signed-in user:

| Meta owner | Action |
|------------|--------|
| None (written before owners were tracked) | Adopt the current user; keep the outbox and watermark |
| Same user | Nothing |
| A different user | Drop the outbox (the old account's queued changes never reach the new one), clear the watermark so the next pull is full, and set `pendingLocalUpload` |

With `pendingLocalUpload` set, the next sync pulls **everything**, merges it with the normal
[conflict rules](#conflict-resolution), and then queues every local row the account didn't have —
sessions, templates, folders, custom exercises, and the notes / previous / settings snapshots only
if the account has none. So signing into an **existing** account with guest data **merges** the two:
the guest's workouts, templates, folders and customs are uploaded, and the account's notes,
previous, settings and biodata win over the guest's. A brand-new account (email sign-up) receives
everything, snapshots included. If the sync fails, the flag stays and the next sync retries.

This applies to whatever is on the device: after signing out of account A, the device's data
(including A's history) is local guest data, and signing into account B merges it into B.

**Delete account** (linked accounts only) lives on the Account screen, opened from Profile. Two themed confirms
(`ConfirmDialog`, not the system alert). Copy says this email's Apple, Google, and password sign-in
are the same account. It calls the `delete-account` Edge Function, which revokes
a Sign in with Apple token when present and hard-deletes the Supabase user (`sync_records` and
`user_exercises` cascade). Then this device is wiped — `clearAllData` plus the in-progress workout
and sync transport — a **new anonymous session** starts, same as first launch, and every store is
reloaded from the empty device. A failure says “Could not delete account” with
plain copy (`friendlyDeleteAccountError`): network, timeout and rate-limit messages as elsewhere, an
expired session asks you to sign out and back in, and anything else is “Couldn't delete your
account. Try again in a moment.” Raw function or Supabase text is never shown; the “deploy the
delete-account Edge Function” hint appears only in `__DEV__` builds.
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
on Android). Each is read from `Constants.expoConfig.extra` first (set by `app.config.js` at build
time), then from the Metro-inlined `process.env` value.

## Profile

The tab is three headed cards, in order: **Account**, **Settings**, then **Biodata**. Each card is one row that pushes a screen.

**Account** on this tab shows the linked identity without opening `/account`: the provider icon, **Apple ID**, **Google**, or **Email** (resolved from Supabase identities), the display name when set, and the email. A chevron still opens `/account`. Guests see **Sign in or create an account** and “Back up your workouts and use them on any device.”

`/account` is identity plus the account-owned destinations. Linked accounts show the provider, display name, and email, then a tap-to-sync row and Sign out. The sync row (`syncStatusLabel`) reads “Syncing…”, “Sync failed — tap to retry” (in the danger colour) when the last sync failed, “Last synced 5 min ago” after a success, or “Not synced yet — tap to sync”; tapping it runs `syncNow()`. Guests see “Sign in to back up your workouts and use them on any device.” and a Sign in CTA. The method picker says linking an account backs up your workouts so you can use them on any device. An account unlocks nothing else — every feature is free ([pricing.md](pricing.md)). Sign out does not wipe local workouts.

Rows on the Account screen: Data (`/data`), Link Google (linked accounts without a Google identity), Change password (linked accounts with an email identity, via `hasPasswordSignIn`), Delete account (linked only), Privacy Policy, Terms of Service. Legal lives only here — Settings does not repeat it.

**Reaching an account from another platform.** Apple sign-in is iOS-only, and Apple's **Hide My Email** gives the account an `@privaterelay.appleid.com` address that nothing else shares, so Google or email sign-in on Android would create a second account. Apps can't turn Hide My Email off, so **Link Google** on Account calls `linkIdentity` on the signed-in user, which attaches Google whatever the account's email is. It never switches accounts: if that Google login or its email already belongs to another MuscleOS account, a dialog says to choose another Google account. When the email is a relay address and Google isn't linked yet, the identity block says to link Google before signing in on Android. Apple accounts can't add a password.

**Settings** on this tab is a single row into `/settings` (“Appearance, units, sounds”).

**Biodata** on this tab is a single row into `/biodata` (“Height, weight, age, gender”). The hint (`biodataSummary`) is “Used for strength standards” until a value is saved, then a compact summary of the saved fields in display units (“180 cm · 176.4 lb · 30 · Male”).

**Biodata** (`/biodata`, subtitle “Used for strength standards”) shows `UserAppProfile` read-only — stored locally and synced as app settings. **Edit** opens a modal for height, weight, age, and gender (each field labelled with its unit, so a filled field still says what it is); Save writes them together (`buildProfileFromInputs`), converting from the display units to cm/kg. A value that fails validation, or a blank field, **clears** that field. Gender has no “unset” choice: once saved it can be switched but not cleared.

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

Of the biodata fields, only `sex` touches the Recovery tab, and only to pick the diagram figure.
`weightKg` (with `sex`) drives strength standards, which is why the copy says so; `age` and
`heightCm` aren't used by any feature users can see.

## Settings

| Setting | Values | Default | Effect |
|---------|--------|---------|--------|
| Theme | `auto` / `dark` / `light` | `auto` | Follows the device in auto |
| Height unit | `cm` / `in` | `cm` | Display only |
| Body weight unit | `kg` / `lb` | `kg` | Display only |
| Exercise weight unit | `kg` / `lb` | `kg` | Display only — set logging, PRs, volume |
| Workout sounds | on / off | **on** | Rest tick, rest end, set complete, workout complete, and the rest notification sound |

The three unit settings are **independent**, so you can weigh yourself in pounds and lift in kilos.
A legacy migration promotes older single-unit preferences to `unit_system: imperial`. Unset units
default from `unit_system` (imperial → in / lb), exercise weight falls back to the legacy single
weight unit, and body weight falls back to exercise weight (`parseStoredAppSettings`). Each change
is written and offered to sync immediately. Every settings write — units, sounds, biodata and the
theme picker — goes through one queue (`persistAndNotify` in `settingsStore`), so quick taps or a
theme change at the same moment as a unit change never drop one.

Settings is **Appearance**, **Units**, **Sounds**, and an **About** card whose one row opens
**Acknowledgements**.

### Acknowledgements

`/acknowledgements` (Settings → About) shows the open-source notices that the MIT License and SIL
Open Font License require to ship with the app. It has two cards. **Libraries — MIT License** lists
each runtime dependency with its copyright line, followed by the MIT text. **Fonts — SIL Open Font
License 1.1** lists DM Sans and DM Mono, followed by the OFL text. The entries are in
`src/data/acknowledgements.ts` and the license texts in `src/data/licenseTexts.ts`. Every package in
`apps/mobile/package.json` `dependencies` must have an entry; workspace `@muscleos/*` packages are
exempt (`missingAcknowledgements`). Adding a dependency without one fails the unit test.

**Data** (`/data`, from Profile → Account): Sync now (linked accounts only), Export my data, Import
data, Clear all data.

- **Sync now** runs `syncNow()` and then reads the sync store: “Synced — Your workout data is up to
  date.” only when it succeeded, otherwise “Sync failed — Couldn't sync right now. Check your
  internet connection and try again.” (`manualSyncResult`). Raw errors stay in dev logs.
- **Clear all data** is **device-only**: it removes `CLEAR_ALL_DATA_KEYS` (all app data and
  settings, which resets the theme to Auto) and pushes nothing, so the linked account's cloud copy —
  settings and biodata included — is untouched and comes back on the next full pull. It **keeps
  the auth session** and the keys in `CLEAR_ALL_DATA_KEPT_KEYS`: the active workout, sync outbox,
  sync meta, exact-alarm prompt flag, and Apple authorization code. Afterwards every store
  (sessions, exercises, notes, templates, recovery, settings) is reloaded so no
  screen shows cleared data; the in-progress workout is kept as-is.

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
device-only until they link: every `notify*` call is a no-op for them, and a guest's import queues
nothing.

### What syncs

Via `sync_records` and the `upsert_sync_records` RPC:

`session` · `template` · `template_folder` · `exercise_previous` · `exercise_note` · `app_settings`

`app_settings` is one snapshot: height, exercise-weight and body-weight units, workout sounds,
theme, and biodata (`SyncedAppSettings`). `muscleos_unit_system` and the legacy single weight unit
are **not** in it — they only seed defaults on the device that has them.

Custom exercises use their own table and RPC (`user_exercises` / `upsert_user_exercises`). The
exercise catalog is a separate **pull-only** delta available to all users, including anonymous ones.

### Outbox, push and pull

Every local change is queued in the **outbox** (`muscleos_sync_outbox`), one entry per entity
(`entityType:entityId`): a newer change to the same row replaces the queued one. Sessions carry
their own clock (`completedAt`, else `startedAt`); everything else is stamped when queued; deletes
are tombstones. Outbox writes are serialized, so concurrent enqueues, merges, imports and pushes
never drop an entry.

- **Push** (`pushNow`): drops any queued `recovery` entries, sends custom exercises to
  `upsert_user_exercises` and everything else to `upsert_sync_records`, then removes **only the
  entries it sent** — anything queued during the request stays for the next push. Local mutations
  schedule a push **2 s** after the last one (`PUSH_DEBOUNCE_MS`). If the `upsert_sync_records`
  RPC is missing (projects without that migration, `PGRST202`), it silently falls back to a plain
  table upsert without the server-side clock check.
- **Pull** (`pullNow`): rows from `sync_records` and `user_exercises` whose **`server_updated_at`**
  is past the pull watermark (all rows the first time). `server_updated_at` is stamped by the
  database on every write that lands (trigger, `clock_timestamp()`), so the watermark is on the
  server's clock: a session finished offline and uploaded later, an import, a linked guest's
  history, or a device whose clock is wrong can't hide a row. The watermark is the newest stamp
  applied (`pullCursor` in sync meta, `src/sync/pullWatermark.ts`). Each pull starts **10 s**
  (`PULL_OVERLAP_MS`) before it to catch writes that committed late; rows already applied in that
  window (same key and stamp) are skipped, so the overlap never re-applies or reloads stores.
  `lastPulledAt` is device time and only feeds the status line. A meta without a cursor (older
  installs) does one full pull. If the database doesn't have `server_updated_at` yet (migration
  `20261003010000` not applied, `42703`), the pull falls back to a full pull by `updated_at` and
  leaves the cursor empty. A missing `user_exercises` table (`PGRST205`) is treated as no rows.
- **Sync** (`syncNow`): pull, then push, then record `lastSyncedAt`. Overlapping calls share one
  run. It never throws: a failure is stored as `lastError` in `useSyncStore` (cleared when the next
  sync starts), which the Account sync row and Data → Sync now read.
- **After a workout** (`syncAfterWorkout`): push immediately; on failure, retry via the scheduler.

`updated_at` is still the writer's clock and still decides last-write-wins on the server and in
the merge; only the pull watermark uses `server_updated_at`.

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
   - Pending local changes → keep local and union keys, filling empty local slots from remote.
     For settings, the pending local units, sounds and theme win as a whole; biodata merges field
     by field (a local blank takes the remote value)
   - No pending changes, or an empty local map → the remote snapshot replaces local
6. Remote deletes (`deleted_at`) follow the same rules: applied unless the local row is pending. A
   remote delete of a snapshot resets it locally (empty notes / previous, default settings)
7. `recovery` records are ignored, queued recovery pushes are dropped, and recovery is recomputed
   from the merged sessions

### Triggers

App launch, app foreground, account link (full snapshot upload), signing into an account,
finishing a workout, pull-to-refresh on History, the Account screen's sync row, Data → Sync now, and
a 2-second debounced push after any local mutation.

### What is NOT backed up

Worth being precise about, because users will assume an account means everything is safe:

| Data | Storage key |
|------|-------------|
| Recovery state | `muscleos_recovery` — derived; recomputed after merge |
| Health / macros | `muscleos_health` — never synced |
| In-progress workout | `muscleos_active_workout` — device session state |
| Hidden built-in template / folder ids | `muscleos_hidden_builtin_*` — **UI preference lost on a new device** |
| Catalog cache and watermark | `muscleos_catalog_*` — re-pulled |
| Sync outbox and meta | `muscleos_sync_outbox`, `muscleos_sync_meta` |
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
| `muscleos_retired_custom_exercises` | Deleted custom exercises, kept so past sessions still resolve them | ○ |
| `muscleos_profile`, `muscleos_theme`, `muscleos_height_unit`, `muscleos_exercise_weight_unit`, `muscleos_body_weight_unit`, `muscleos_workout_sounds` | Biodata and settings | ● (as `app_settings`) |
| `muscleos_unit_system`, `muscleos_weight_unit` (legacy) | Default unit system; older single weight unit | ○ |
| `muscleos_hidden_builtin_template_ids`, `..._folder_ids` | Hidden built-ins | ○ |
| `muscleos_recovery` | Derived recovery cache | ○ |
| `muscleos_active_workout` | In-progress session + rest state + `lastActivityAt` | ○ |
| `muscleos_health` | Macro targets, metabolism | ○ |
| `muscleos_catalog_exercises`, `muscleos_catalog_watermark`, `muscleos_catalog_seed_applied_at` | Catalog cache | ○ |
| `muscleos_sync_outbox`, `muscleos_sync_meta` | Sync transport (meta: owning `userId`, server-clock `pullCursor`, last pull/push/sync times, `pendingLocalUpload`) | ○ |
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
| Legacy lb/in preference → `unit_system: imperial` (only if `unit_system` was never written) | `legacyUnitMigration()` in `settingsStore.load`; `parseStoredAppSettings()` also reads the legacy weight unit |
| Unset unit keys → resolved values written back | `settingsNeedPersist()` in `settingsStore.load` |
| Sync meta without an owner → adopted by the next signed-in sync | `syncOwnerAction()` |
| Remote `app_settings` missing `themePreference` | `normalizeAppSettings()` |
| `muscleos_subscription` and `muscleos_dev_pro_override` (removed Pro tier) → deleted on launch | `removeLegacyStorageKeys()` in `localStorage.ts` |

Export carries an explicit `version: 1`.

## Notifications and permissions

| Permission | Platform | When | Why |
|------------|----------|------|-----|
| Notifications | iOS + Android | First workout notification | Ongoing workout status, rest-over alerts |
| `POST_NOTIFICATIONS` | Android 13+ | Runtime, via expo-notifications | As above |
| `SCHEDULE_EXACT_ALARM` | Android 13+ | Prompted once on first rest timer | On-time rest alerts; otherwise up to a minute late |

`RECORD_AUDIO` is **explicitly removed** from the Android manifest — the app plays audio but never
records. `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` (added by `expo-audio` for its
lock-screen media controls service) are removed too: sounds are short in-app cues with background
playback off, so that service never starts, and keeping the permissions would require a Play
foreground-service declaration. iOS declares the time-sensitive notification entitlement so rest alerts break through
Focus modes.

Channels: `workout_fallback_v1` (low importance, ongoing) and `rest_complete_fallback_v1` (high
importance, custom sound), plus the native module's own channels on Android. Deep link scheme is
`muscleos`.

Behaviour detail: [workout-logging.md](workout-logging.md#notifications).

## Theming

Modes `auto` / `dark` / `light`, default `auto`. Palette hex values live in **one place**:
`paletteConfig` in `src/theme/palette.ts`. `buildThemeColors(mode)` derives the translucent and
tinted tokens from those base values. `withAlpha(hex, a)` makes a translucent rgba; `blendOver(hex,
a, base)` makes the opaque equivalent over a known background, for fills that tile edge to edge
(translucent neighbours seam where their edges round to different pixels).

**Screens must use `useTheme().colors`** — no hardcoded hex or rgba in components.

Base roles: `background`, `surface`, `surfaceElevated`, `border`, `text`, `textSecondary`,
`textMuted`, `primary`, `primaryDim`, `primaryOn`, `accent`, `accentDim`, `danger`, `warning`,
`success`, `successOn`, `muscleHighlight`, `muscleRecovering`, `recoveryHot`, `recoveryWarm`,
`recoveryReady`, `bodyDiagramBorder`, `bodyDiagramFill`.

Derived: `primarySurface`, `primaryBorder`, `successSurface`, `tableHeader`, `rowWarmUp`,
`rowFuture`, `inputBorder`, `overlay`.

## Export

Profile → Account → Data → **Export my data**. Writes pretty-printed JSON to the cache as
`muscleos-export-YYYY-MM-DD.json` and opens the share sheet (`expo-sharing`,
`application/json`).

**Included:** `version: 1`, `exportedAt`, account profile (if linked), templates,
template folders, the stored finished-session list, recovery, exercise notes, custom exercises,
and health.

**Not included:** app settings (units, theme, sounds), biodata (`UserAppProfile`), hidden built-in
ids, the exercise-previous map, the active in-progress workout, and the catalog cache.

> The export is therefore **not a complete backup** — it omits settings, biodata, and the previous
> map. Account sync is the backup; the file is for portability and for **Import data** below.

## Import

Profile → Account → Data → **Import data**. Opens the document picker for a JSON file
made by Export, then:

1. **Parse** (`parseExportFile`, `src/storage/importPlan.ts`). Anything that isn't JSON with
   `sessions` and `templates` arrays says “Choose a file made with Export my data”. A `version` other
   than `1` says to update the app. Rows without a string `id` and blank notes are dropped, and
   built-in templates are skipped because they ship with the app.
2. **Plan** (`planImport`). Import only **adds**: sessions, templates, folders and custom exercises
   whose id isn't on this device, and notes for exercises with no note here. Nothing local is changed
   or removed, so importing the same file twice is a no-op (“Nothing to import”).
3. **Confirm.** A dialog names what will be added (“Add 12 workouts, 2 templates and 1 custom
   exercise to this device?”) and, when signed in, that it backs up to the account.
4. **Apply** (`applyImport`, `src/storage/importData.ts`). Writes the rows, reloads exercises,
   recomputes recovery and rebuilds the previous map from all sessions (both derived), reloads the
   synced stores, and pushes. When an account is linked, every imported row plus the new
   previous/notes snapshots go in the sync outbox in one write (`importOutboxEntries`). A guest's
   import queues **nothing**; it uploads when they link or sign in, like any local data. A cancelled
   picker shows nothing; “Imported — Added …” confirms success, and a read or write failure says
   “Import failed”.

Not imported: profile, recovery (recomputed), health, settings and biodata (not exported), and the
`subscription` field older exports carry. Imported custom templates are ready to run.

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
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google sign-in |

Injected via `app.config.js` into `Constants.expoConfig.extra`.

## Assumptions

| Assumption | Note |
|------------|------|
| Local-first; an account is optional | Everything works offline |
| Anonymous session on first launch | No signup wall |
| Sign-out keeps local data | You don't lose history by signing out |
| Delete account wipes this device | Stronger than sign-out; you continue as a guest |
| Local wins on sync conflict when dirty | The device you're holding is the one you just used |
| Recovery is never synced | Derived from sessions; recomputed after merge |
| kg and cm canonical in storage | Units are a display concern only |
| No storage schema version | Migrations are opportunistic on read |
| Export is portability, not backup | Omits settings and biodata; Import only adds rows |
| Clear all data is device-only | Nothing is pushed; the account's cloud copy is untouched |
| Signing into another account merges this device into it | Old account's queued changes are dropped, never pushed to the new one |
| Hidden built-in ids are device-local | The only user intent lost on a new device |

## Not implemented

- SecureStore-backed auth (uses AsyncStorage)
- Email account **linking** (uses sign-up/sign-in, unlike Apple/Google)
- HealthKit / Google Fit, and any UI for `healthStore`
- Haptics setting
- A rest-timer default in Settings

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
  sync transport/biodata/Apple auth code are gone, and a fresh anonymous guest starts.
- `src/auth/authErrors.test.ts` — known Supabase errors map to plain copy; unknown backend or provider
  messages never leak (no "supabase", never the raw text) in any flow
- `src/auth/accountProvider.test.ts`, `attachAccount.test.ts`, `emailCallback.test.ts`,
  `edgeFunctionError.test.ts` — linked-provider resolution, already-linked identity vs in-place
  upgrade, confirm/recovery link parsing, and Edge Function error messages
- `src/storage/importPlan.test.ts` — export parsing (bad JSON, wrong version, rows without ids,
  built-ins skipped), add-only planning with local notes kept, re-import is empty, and the summary
- `src/sync/mergePolicy.test.ts` — every `decideEntityApply` branch, the outbox clock bump, map and
  settings merges, and what counts as empty
- `src/sync/merge.test.ts` — `applyRemoteRecords` against the storage harness: missing rows taken,
  dirty local kept with its clock bumped, session last-write-wins both ways, clean templates take
  remote, remote deletes, dirty vs clean map snapshots, remote recovery ignored and recomputed; an
  enqueue during a merge survives; `snapshotItems` (account-link upload: clocks, empty maps skipped)
- `src/sync/outbox.test.ts` — one entry per entity (replace by key), serialized mutations under
  concurrent enqueues, removing only the pushed entries, keeping entries re-queued since a read
- `src/sync/pullWatermark.test.ts` — overlap start, watermark only moves forward and keeps the
  server's stamp, overlap-window memory, skipping applied rows, missing-column detection
- `src/sync/syncEngine.test.ts` (in-memory Supabase, `src/test/mocks/fakeSupabase.ts`) — sync
  enabled only for a linked user; `notify*` no-ops for guests and queues for linked users; the 2 s
  push debounce; push partitions (recovery dropped, customs to `user_exercises`), tombstones, the
  missing-RPC fallback, failure keeps the outbox, an enqueue during a push survives; the server-clock
  pull watermark (late uploads, device clock skew, overlap re-reads skipped, late commits inside the
  overlap, pre-MUS-91 metas, missing-column fallback) and the missing `user_exercises` table; `syncNow` pulls before pushing, records `lastSyncedAt`,
  sets `lastError` without throwing, shares overlapping runs; `syncAfterWorkout`; changing accounts
  (old outbox dropped and never pushed, owner adopted for old metas, sign-out reset); signing into
  an existing account with guest data (two-way merge, remote snapshots win, brand-new account gets
  snapshots, retry after a failed first sync); `onAccountLinked` full snapshot; `useSyncStore`
- `src/data/acknowledgements.test.ts` — every runtime dependency has a license notice, workspace
  packages exempt, no duplicates
- `src/sync/syncStatus.test.ts` — Account sync-row copy and the Sync now result alert
- `src/auth/authSession.test.ts` — launch: existing session reused, anonymous sign-in, unconfigured,
  10 s timeouts and failures; sign-out order (Google, Supabase, new guest, sync reset)
- `src/auth/authCopy.test.ts` — `emailLinkDestination`, Delete account error copy (no raw text,
  dev-only deploy hint), Google client id lookup order
- `src/storage/localStorage.settings.test.ts` — settings defaults, unit fallbacks and
  independence, persistence round-trip, theme listeners; migrations (legacy units, write-back,
  `normalizeAppSettings`, template `days[]` and `defaultSets`); legacy subscription keys removed;
  `clearAllData` removed vs kept keys; export payload contents and omissions (never `subscription`)
- `src/storage/importCopy.test.ts`, `importData.test.ts` — import dialog copy,
  `importOutboxEntries`, and `applyImport` writes, previous/recovery rebuild, and outbox (guest vs
  linked)
- `src/store/settingsStore.test.ts` — load (defaults written back, lb/in → imperial), setters
  persist and notify sync, a theme change racing unit/sounds changes keeps all of them
- `src/store/healthStore.test.ts` — BMR, TDEE multipliers, macros and floors, local persistence
- `src/utils/biodata.test.ts` — editor validation and unit conversion, gender can't be cleared,
  Profile hint summary
- Screen tests (Jest, `src/test/ui/accounts/`): `profile.test.tsx` (Account card guest/linked,
  rows, biodata hint), `account.test.tsx` (guest vs linked rows, Change password only with an
  email identity, Hide My Email notice, legal links, sync row incl. failure, Sign out confirm,
  Delete account two confirms and friendly failure), `data.test.tsx` (rows, Sync now success and
  failure, Export, Import confirm/failure copy, Clear all data keeps kept keys, reloads stores and
  pushes nothing), `biodataSettings.test.tsx` (Biodata validation, units, save; Settings units,
  sounds, theme; Acknowledgements lists notices and licenses), `auth.test.tsx` (method picker, email sign-in/create/reset copy and outcomes,
  New password and Change password, `/auth-callback` spinner and fallback)

Not covered:

- Linking each provider end to end (`src/auth/signIn.ts` — Apple / Google SDKs and Supabase
  `linkIdentity`); the screens are tested with `useSignIn` mocked
- The root layout's boot sequence and `EmailAuthLinks` wiring (the destination rule is covered)
- `ThemeProvider` following the device scheme in Auto (theme persistence is covered)
- Notification permission gating and scheduling
