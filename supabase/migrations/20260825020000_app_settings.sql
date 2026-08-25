-- App settings + biodata (units, workout sounds, profile)
-- Snapshot entity synced as app_settings / entity_id = 'default'

alter table public.sync_records
  drop constraint if exists sync_records_entity_type_check;

alter table public.sync_records
  add constraint sync_records_entity_type_check
  check (
    entity_type in (
      'session',
      'template',
      'template_folder',
      'custom_exercise',
      'recovery',
      'exercise_previous',
      'exercise_note',
      'app_settings'
    )
  );
