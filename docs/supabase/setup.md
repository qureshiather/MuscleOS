# Supabase setup

First-time wiring of the Supabase project: schema rules, migrations, Edge Functions, and auth
providers. What syncs, the merge rules and when sync runs are app behaviour and live in
[accounts-and-data.md → Cloud sync](../features/accounts-and-data.md#cloud-sync). Day-to-day
operation is in [operations/live-services.md](../operations/live-services.md).

## Schema

### Exercise catalog vs user exercises

| Table | Who sees it | How it updates |
|-------|-------------|----------------|
| `catalog_exercises` | Everyone (anon + authenticated read) | You upsert in SQL. Apps pull `updated_at > watermark`. |
| `user_exercises` | That account only | App create/edit/delete. Local-first, then `upsert_user_exercises`. |

`sync_records` and `user_exercises` carry `server_updated_at`, stamped by a trigger on every write
(`20261003010000_sync_server_updated_at.sql`). Apps pull by it, not by the writer's `updated_at`,
so late uploads and wrong device clocks can't hide rows. Against a database without this migration
the app falls back to full pulls.

Both exercise tables have a `tracking_type` column (default `weight_reps`). The app neither reads
nor sends it; keep the default so older clients and the RPC keep working.

Do **not** put catalog rows in `sync_records`. Custom exercises used to live there as JSONB; they migrate into `user_exercises` and new writes go to that table.

**Content change** (new exercise, category fix, instruction copy): `UPDATE`/`INSERT` with `updated_at = now()`. Never delete a catalog id — set `is_published = false`. Seed scripts upsert by id and never write `user_exercises`.

**Schema change:** add the same column to **both** tables in one migration, always with a `DEFAULT`. Do not rename or drop columns in the same release as the app change. The client mapper ignores unknown keys and fills missing fields. Widen `exercise_category` by adding values; old apps that see an unknown category infer one from the row's equipment (cable → machine → bodyweight → free weight).

How catalog content is authored, generated into the app's seed and shipped as migrations:
[exercise-library.md → Pipeline](../features/exercise-library.md#pipeline).

`upsert_sync_records` only overwrites the server when the incoming `updated_at` is **≥** the stored
value (equal timestamps → incoming wins). The client side — push, pull, the fallbacks when this RPC
or `user_exercises` is missing, and the merge rules — is in
[accounts-and-data.md → Cloud sync](../features/accounts-and-data.md#outbox-push-and-pull).

## Setup

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

### 2. Anonymous sign-in

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

Deploy from the repo root (or `supabase/`), and again after any change to `supabase/functions/`:

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
2. Create an OAuth **Android** client: package `app.muscleos`, SHA-1 of every signing cert you use.

Debug SHA-1 (from `apps/mobile`):

```bash
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android
```

EAS / Play SHA-1: Play Console → App integrity (upload key and **app signing** key), or `eas credentials -p android`.

Rebuild the Android native app after adding the plugin (`pnpm --filter mobile android`). Expo Go cannot load this module.

Authorized redirect in the Web client / Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`.

### 6. Email confirmation and password reset

Signup and **Forgot password** send the user to `https://muscleos.app/auth/confirm`. The message links to that page with `token_hash` and `type` (`signup` or `recovery`). The page opens `muscleos://auth-callback`, and the app calls `verifyOtp` only then, so a mail scanner that opens the link does not use up the one-time token. An expired or already-used link stays on the page and says to request a new one. A recovery link then shows **New password**.

Auth email templates (Authentication → Emails) — subjects, links and the code-only Magic link
template — are listed in [live-services.md → Resend](../operations/live-services.md#resend). Never
use `{{ .ConfirmationURL }}`: it verifies the token as soon as anything fetches it.

In the hosted project → Authentication → URL configuration:

- Site URL: `https://muscleos.app`
- Additional redirect URLs: `https://muscleos.app/auth/confirm` and `muscleos://**`

Authentication → Providers → Email: **Confirm email** is on. Signup does not create a session until the address is confirmed. The app blocks sign-in and shows a themed dialog when Supabase says the email is not confirmed.

Day-to-day changes for mail, Google, and Apple are in [operations/live-services.md](../operations/live-services.md).
