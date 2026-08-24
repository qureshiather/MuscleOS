# Supabase setup

## Cloud sync (Strong-style)

MuscleOS syncs workout history, templates, custom exercises, and derived data to Supabase for **linked accounts only**. Reads are always local-first (AsyncStorage); sync runs in the background.

### 1. Run the migration

In the [Supabase SQL editor](https://supabase.com/dashboard), run:

`supabase/migrations/001_sync_records.sql`

This creates the `sync_records` table with row-level security.

### 2. App behavior

| Trigger | Action |
|---------|--------|
| App launch (linked account) | Background pull + push |
| App foreground | Background pull + push |
| Finish workout | Immediate push |
| Link account (Apple/Google/email) | Upload local data, then sync |
| History pull-to-refresh | Force sync |
| Settings → Sync now | Force sync |

Anonymous users stay device-only until they link an account.

### 3. Env vars

Already required for auth:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```
