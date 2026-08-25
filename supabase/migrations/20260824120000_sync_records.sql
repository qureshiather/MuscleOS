-- MuscleOS cloud sync (Strong-style: local-first, account-backed backup)
-- Apply in Supabase SQL editor or via CLI: supabase db push

create table if not exists public.sync_records (
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null check (
    entity_type in (
      'session',
      'template',
      'template_folder',
      'custom_exercise',
      'recovery',
      'exercise_previous',
      'exercise_note'
    )
  ),
  entity_id text not null,
  payload jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, entity_type, entity_id)
);

create index if not exists sync_records_user_updated_idx
  on public.sync_records (user_id, updated_at desc);

alter table public.sync_records enable row level security;

create policy "sync_records_select_own"
  on public.sync_records for select
  using (auth.uid() = user_id);

create policy "sync_records_insert_own"
  on public.sync_records for insert
  with check (auth.uid() = user_id);

create policy "sync_records_update_own"
  on public.sync_records for update
  using (auth.uid() = user_id);

create policy "sync_records_delete_own"
  on public.sync_records for delete
  using (auth.uid() = user_id);
