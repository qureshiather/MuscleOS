-- MUS-91: pull against a server-assigned clock.
--
-- `updated_at` is the pushing device's clock (sessions use completedAt) and drives last-write-wins.
-- Pulling with `updated_at > <this device's last pull time>` misses rows uploaded late (a session
-- finished offline, an import, a linked guest's history) or from a device whose clock runs behind.
-- `server_updated_at` is stamped by the database on every write that lands, so a device's pull
-- watermark only ever compares server times with server times.
--
-- Existing rows are backfilled to the migration time, so each client does one catch-up pull of
-- everything; merges are idempotent. Older app versions keep pulling by `updated_at` unaffected.

alter table public.sync_records
  add column if not exists server_updated_at timestamptz not null default now();

alter table public.user_exercises
  add column if not exists server_updated_at timestamptz not null default now();

create index if not exists sync_records_user_server_updated_idx
  on public.sync_records (user_id, server_updated_at);

create index if not exists user_exercises_user_server_updated_idx
  on public.user_exercises (user_id, server_updated_at);

-- clock_timestamp(), not now(): now() is the transaction start, which can be earlier than rows a
-- concurrent transaction already committed. Clients also re-read a short overlap window.
create or replace function public.stamp_server_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists sync_records_stamp_server_updated_at on public.sync_records;
create trigger sync_records_stamp_server_updated_at
  before insert or update on public.sync_records
  for each row execute function public.stamp_server_updated_at();

drop trigger if exists user_exercises_stamp_server_updated_at on public.user_exercises;
create trigger user_exercises_stamp_server_updated_at
  before insert or update on public.user_exercises
  for each row execute function public.stamp_server_updated_at();
