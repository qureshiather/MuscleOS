# Supabase setup

## Cloud sync (Strong-style)

MuscleOS syncs workout history, templates, custom exercises, and derived data to Supabase for **linked accounts only**. Reads are always local-first (AsyncStorage); sync runs in the background.

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

Paste `supabase/migrations/20260824120000_sync_records.sql` into the [Supabase SQL editor](https://supabase.com/dashboard) and run it manually.

### 2. App behavior

| Trigger | Action |
|---------|--------|
| App launch (linked account) | Background pull + push |
| App foreground | Background pull + push |
| Finish workout | Immediate push |
| Link account (Apple/Google/email) | Upload local data, then sync |
| History pull-to-refresh | Force sync |
| Settings → Sync now | Force sync |
| Profile → sync row tap | Force sync |

Anonymous users stay device-only until they link an account.

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
