-- Global exercise catalog + account-private user exercises.
-- Catalog is public read (anon + authenticated). Writes are SQL/dashboard only.
-- user_exercises stays in lockstep with catalog columns (minus ownership / publish).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'exercise_category') then
    create type public.exercise_category as enum (
      'free_weight',
      'machine',
      'cable',
      'bodyweight'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'exercise_tracking_type') then
    create type public.exercise_tracking_type as enum (
      'weight_reps',
      'bodyweight_reps',
      'duration'
    );
  end if;
end
$$;

create table if not exists public.catalog_exercises (
  id text primary key,
  name text not null,
  instructions text,
  category public.exercise_category not null,
  muscles text[] not null,
  equipment text[] not null default '{}',
  aliases text[] not null default '{}',
  tracking_type public.exercise_tracking_type not null default 'weight_reps',
  is_published boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint catalog_muscles_not_empty check (cardinality(muscles) >= 1)
);

create index if not exists catalog_exercises_updated_idx
  on public.catalog_exercises (updated_at desc);

create table if not exists public.user_exercises (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  instructions text,
  category public.exercise_category not null,
  muscles text[] not null,
  equipment text[] not null default '{}',
  tracking_type public.exercise_tracking_type not null default 'weight_reps',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  constraint user_muscles_not_empty check (cardinality(muscles) >= 1)
);

create index if not exists user_exercises_user_updated_idx
  on public.user_exercises (user_id, updated_at desc);

alter table public.catalog_exercises enable row level security;
alter table public.user_exercises enable row level security;

drop policy if exists catalog_exercises_select_all on public.catalog_exercises;
create policy catalog_exercises_select_all
  on public.catalog_exercises for select
  to anon, authenticated
  using (true);

drop policy if exists user_exercises_select_own on public.user_exercises;
create policy user_exercises_select_own
  on public.user_exercises for select
  using (auth.uid() = user_id);

drop policy if exists user_exercises_insert_own on public.user_exercises;
create policy user_exercises_insert_own
  on public.user_exercises for insert
  with check (auth.uid() = user_id);

drop policy if exists user_exercises_update_own on public.user_exercises;
create policy user_exercises_update_own
  on public.user_exercises for update
  using (auth.uid() = user_id);

drop policy if exists user_exercises_delete_own on public.user_exercises;
create policy user_exercises_delete_own
  on public.user_exercises for delete
  using (auth.uid() = user_id);

create or replace function public.upsert_user_exercises(records jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  r jsonb;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  for r in select * from jsonb_array_elements(records)
  loop
    insert into public.user_exercises as ue (
      user_id,
      id,
      name,
      instructions,
      category,
      muscles,
      equipment,
      tracking_type,
      updated_at,
      deleted_at
    )
    values (
      uid,
      r->>'id',
      coalesce(r->>'name', r->>'id'),
      r->>'instructions',
      coalesce(r->>'category', 'free_weight')::public.exercise_category,
      case
        when jsonb_typeof(r->'muscles') = 'array' and jsonb_array_length(r->'muscles') > 0
        then array(select jsonb_array_elements_text(r->'muscles'))
        else array['chest']::text[]
      end,
      coalesce(array(select jsonb_array_elements_text(r->'equipment')), '{}'::text[]),
      coalesce(r->>'tracking_type', 'weight_reps')::public.exercise_tracking_type,
      (r->>'updated_at')::timestamptz,
      case
        when r->>'deleted_at' is null or r->>'deleted_at' = 'null' then null
        else (r->>'deleted_at')::timestamptz
      end
    )
    on conflict (user_id, id) do update
    set
      name = excluded.name,
      instructions = excluded.instructions,
      category = excluded.category,
      muscles = excluded.muscles,
      equipment = excluded.equipment,
      tracking_type = excluded.tracking_type,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at
    where ue.updated_at <= excluded.updated_at;
  end loop;
end;
$$;

revoke all on function public.upsert_user_exercises(jsonb) from public;
grant execute on function public.upsert_user_exercises(jsonb) to authenticated;

grant select on public.catalog_exercises to anon, authenticated;
grant select, insert, update, delete on public.user_exercises to authenticated;

-- Copy existing custom_exercise JSONB blobs onto the structured table.
insert into public.user_exercises (
  user_id,
  id,
  name,
  instructions,
  category,
  muscles,
  equipment,
  tracking_type,
  updated_at,
  deleted_at
)
select
  sr.user_id,
  sr.entity_id,
  coalesce(sr.payload->>'name', sr.entity_id),
  sr.payload->>'instructions',
  coalesce(
    sr.payload->>'category',
    case
      when sr.payload->'equipment' ? 'cable' then 'cable'
      when sr.payload->'equipment' ? 'machine' then 'machine'
      when sr.payload->'equipment' ? 'bodyweight' then 'bodyweight'
      else 'free_weight'
    end
  )::public.exercise_category,
  case
    when jsonb_typeof(sr.payload->'muscles') = 'array' and jsonb_array_length(sr.payload->'muscles') > 0
    then array(select jsonb_array_elements_text(sr.payload->'muscles'))
    else array['chest']::text[]
  end,
  coalesce(array(select jsonb_array_elements_text(sr.payload->'equipment')), '{}'::text[]),
  coalesce(sr.payload->>'trackingType', sr.payload->>'tracking_type', 'weight_reps')::public.exercise_tracking_type,
  sr.updated_at,
  sr.deleted_at
from public.sync_records sr
where sr.entity_type = 'custom_exercise'
on conflict (user_id, id) do nothing;
