-- Hip abduction/adduction catalog fix: abduction stays on glutes; adduction maps to
-- the new adductors group; Hip Abduction Machine is renamed for search.
-- Safe to re-run: upserts by id and does not overwrite reviewed instructions.

insert into public.catalog_exercises (
  id, name, instructions, category, muscles, equipment, aliases, tracking_type, is_published, updated_at
) values
  ('cable-machine-hip-adduction', 'Cable Machine Hip Adduction', NULL, 'cable', ARRAY['adductors']::text[], ARRAY['cable', 'machine']::text[], '{}'::text[], 'weight_reps', true, timestamptz '2026-09-18T00:00:00.000Z'),
  ('copenhagen-plank', 'Copenhagen Plank', NULL, 'bodyweight', ARRAY['abs', 'obliques', 'adductors']::text[], ARRAY['bodyweight']::text[], '{}'::text[], 'weight_reps', true, timestamptz '2026-09-18T00:00:00.000Z'),
  ('hip-abductor', 'Hip Abduction Machine', NULL, 'machine', ARRAY['glutes']::text[], ARRAY['machine']::text[], ARRAY['hip-abduction-machine', 'hip-abductor-machine', 'hip-abductors-machine']::text[], 'weight_reps', true, timestamptz '2026-09-18T00:00:00.000Z'),
  ('hip-adduction-against-band', 'Hip Adduction Against Band', NULL, 'free_weight', ARRAY['adductors']::text[], ARRAY['band']::text[], '{}'::text[], 'weight_reps', true, timestamptz '2026-09-18T00:00:00.000Z'),
  ('hip-adductor', 'Hip Adduction Machine', NULL, 'machine', ARRAY['adductors']::text[], ARRAY['machine']::text[], ARRAY['hip-adduction-machine', 'hip-adductor-machine', 'hip-adductors-machine']::text[], 'weight_reps', true, timestamptz '2026-09-18T00:00:00.000Z')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  muscles = excluded.muscles,
  equipment = excluded.equipment,
  aliases = excluded.aliases,
  tracking_type = excluded.tracking_type,
  is_published = excluded.is_published,
  updated_at = excluded.updated_at
  where public.catalog_exercises.updated_at <= excluded.updated_at;
