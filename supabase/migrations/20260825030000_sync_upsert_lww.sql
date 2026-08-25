-- Conditional upsert for sync_records: only apply when incoming updated_at is
-- newer or equal (equal → local/incoming wins on conflict).

create or replace function public.upsert_sync_records(records jsonb)
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
    insert into public.sync_records as sr (
      user_id,
      entity_type,
      entity_id,
      payload,
      updated_at,
      deleted_at
    )
    values (
      uid,
      r->>'entity_type',
      r->>'entity_id',
      case when r->'payload' = 'null'::jsonb then null else r->'payload' end,
      (r->>'updated_at')::timestamptz,
      case
        when r->>'deleted_at' is null or r->>'deleted_at' = 'null' then null
        else (r->>'deleted_at')::timestamptz
      end
    )
    on conflict (user_id, entity_type, entity_id) do update
    set
      payload = excluded.payload,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at
    where sr.updated_at <= excluded.updated_at;
  end loop;
end;
$$;

revoke all on function public.upsert_sync_records(jsonb) from public;
grant execute on function public.upsert_sync_records(jsonb) to authenticated;
