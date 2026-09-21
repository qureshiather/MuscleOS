# Supabase setup

## Cloud sync (Strong-style)

MuscleOS syncs workout history, templates, custom exercises, exercise notes, settings (units,
sounds, theme, biodata), and the persisted exercise-previous snapshot to Supabase for
**linked accounts only**. Recovery is not synced; it is recomputed locally from sessions after a
merge. Reads are always local-first (AsyncStorage); sync runs in the background.

### Exercise catalog vs user exercises

| Table | Who sees it | How it updates |
|-------|-------------|----------------|
| `catalog_exercises` | Everyone (anon + authenticated read) | You upsert in SQL. Apps pull `updated_at > watermark`. |
| `user_exercises` | That account only | App create/edit/delete. Local-first, then `upsert_user_exercises`. |

The app ships a bundled `CATALOG_SEED` so first launch and airplane mode already have the library. The first paint does not wait on the network. A background pull merges any rows newer than the seed watermark.

Do **not** put catalog rows in `sync_records`. Custom exercises used to live there as JSONB; they migrate into `user_exercises` and new writes go to that table.

**Content change** (new exercise, category fix, instructions after review): `UPDATE`/`INSERT` with `updated_at = now()`. Never delete a catalog id — set `is_published = false`. Seed scripts upsert by id and never write `user_exercises`.

**Schema change:** add the same column to **both** tables in one migration, always with a `DEFAULT`. Do not rename or drop columns in the same release as the app change. The client mapper ignores unknown keys and fills missing fields. Widen `exercise_category` / `exercise_tracking_type` by adding values; old apps that see an unknown category treat it as `free_weight`.

Regenerate the bundled seed and SQL together:

```bash
node apps/mobile/scripts/generate-exercise-catalog.mjs
```

Instructions stay null until you review them. The generator does not overwrite a newer `instructions` value on the server.

### Merge policy

Sync is **entity-level** (sessions, templates, etc.), with field-aware merges for map/settings snapshots.

| Case | Result |
|------|--------|
| Missing locally | Take remote (server fills gaps) |
| Net-new locally | Keep local; push via outbox |
| Conflict, local dirty (pending outbox) | **Local wins**; outbox `updated_at` is bumped if remote is newer so push lands |
| Conflict, local clean | **Last-write-wins** by `updated_at`; ties keep local |
| Notes / previous / settings while keeping local | Union keys; empty local slots fill from remote; non-empty conflicts prefer local |

Push uses `upsert_sync_records`, which only overwrites the server when incoming `updated_at` is **≥** the stored value (equal timestamps → incoming/local wins).

### 1. Run migrations (Supabase CLI)

We use the [official Supabase CLI](https://supabase.com/docs/guides/cli) — it handles IPv4 pooler connections, migration history, and remote push.

**One-time setup**

```bash
pnpm install
cp supabase/.env.example supabase/.env
```

Fill in `supabase/.env`:

| Variable | Where to get it |
|----------|-----------------|
| `SUPABASE_ACCESS_TOKEN` | [Dashboard → Account → Access tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_REF` | Project URL: `https://<ref>.supabase.co` |
| `SUPABASE_DB_PASSWORD` | Dashboard → Project Settings → Database |

Link your local project to the remote database (once per machine):

```bash
pnpm supabase:link
```

**Apply migrations**

```bash
pnpm supabase:migrate
```

This runs `supabase db push`, applying any new files in `supabase/migrations/`.

**Other commands**

```bash
pnpm supabase migration list    # show applied vs pending
pnpm supabase migration new my_change   # scaffold a new migration
```

**Alternative — SQL editor**

Paste `supabase/migrations/*.sql` into the [Supabase SQL editor](https://supabase.com/dashboard) in order and run them manually.

### 2. App behavior

| Trigger | Action |
|---------|--------|
| App launch | Catalog delta pull (all users). Account sync if linked. |
| App foreground | Catalog delta pull. Account sync if linked. |
| Finish workout | Immediate push |
| Link account (Apple/Google/email) | Upload local data, then sync |
| History pull-to-refresh | Force sync |
| Data → Sync now | Force sync |
| Profile → sync row tap | Force sync |

Anonymous users stay device-only until they link an account.

**Hosted project:** Authentication → Providers → **Anonymous** must be on. The app signs in anonymously on first launch, then Apple/Google `linkIdentity` upgrades that same user. If anonymous is off, Apple sign-in has nobody to link to (`Linking requires a valid user access token`).

### 3. Env vars

**Mobile app** (`apps/mobile/.env`):

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

**Supabase CLI only** (`supabase/.env` — never commit):

```
SUPABASE_ACCESS_TOKEN=
SUPABASE_PROJECT_REF=
SUPABASE_DB_PASSWORD=
```

Do not put access tokens or database passwords in the mobile app or EAS env.

### 4. Account deletion functions

Linked accounts delete themselves from Profile → Account. The app calls two Edge Functions:

| Function | When | What it does |
|----------|------|----------------|
| `save-apple-token` | Right after Sign in with Apple succeeds | Exchanges the Apple `authorizationCode` for a refresh token and stores it on `auth.users.app_metadata` |
| `delete-account` | Profile → Account → Delete account | Revokes the Apple token if present, then `auth.admin.deleteUser`. `sync_records` and `user_exercises` cascade |

Anonymous users cannot call either function. Missing Apple secrets skip revoke but still delete the user.

Deploy from the repo root (or `supabase/`):

```bash
pnpm supabase functions deploy save-apple-token
pnpm supabase functions deploy delete-account
```

Apple revoke secrets (hosted project → Edge Functions → Secrets). Native Sign in with Apple uses the app's bundle id as `APPLE_CLIENT_ID`:

```
APPLE_CLIENT_ID=com.muscle-os.app
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### 5. Google Sign-In (Android)

Continue with Google on Android uses the native Play Sign-In SDK (`@react-native-google-signin/google-signin`) and sends the **id token** to Supabase. iOS still uses `expo-auth-session` until an iOS OAuth client is added.

**Google Cloud Console** (APIs & Services → Credentials):

1. Create an OAuth **Web** client. Copy its client ID into `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and into Supabase → Authentication → Providers → Google (client ID + secret).
2. Create an OAuth **Android** client: package `com.muscleos.app`, SHA-1 of every signing cert you use.

Debug SHA-1 (from `apps/mobile`):

```bash
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android
```

EAS / Play SHA-1: Play Console → App integrity (upload key and **app signing** key), or `eas credentials -p android`.

Rebuild the Android native app after adding the plugin (`pnpm --filter mobile android`). Expo Go cannot load this module.

Authorized redirect in the Web client / Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`.

### 6. Email confirmation and password reset

Signup and **Forgot password** send the user to `https://muscleos.app/auth/confirm`. That page opens `muscleos://auth-callback` with the Supabase tokens. A recovery link then shows **New password**.

In the hosted project → Authentication → URL configuration:

- Site URL: `https://muscleos.app`
- Additional redirect URLs: `https://muscleos.app/auth/confirm` and `muscleos://**`

Authentication → Providers → Email: turn **Confirm email** on before store review. Until that is on, signup still creates a session immediately. The app already blocks sign-in when Supabase says the email is not confirmed.
