-- Smith machine catalog additions and search aliases.
-- Safe to re-run: upserts by id and does not overwrite reviewed instructions.

insert into public.catalog_exercises (
  id, name, instructions, category, muscles, equipment, aliases, tracking_type, is_published, updated_at
) values
  ('smith-machine-bench-press', 'Smith Machine Bench Press', NULL, 'machine', ARRAY['chest', 'front_delts', 'triceps']::text[], ARRAY['machine']::text[], ARRAY['smith-bench', 'smith-bench-press', 'smith-machine-bench']::text[], 'weight_reps', true, timestamptz '2026-09-04T00:00:00.000Z'),
  ('smith-machine-calf-raise', 'Smith Machine Calf Raise', NULL, 'machine', ARRAY['calves']::text[], ARRAY['machine']::text[], ARRAY['smith-calf-raise']::text[], 'weight_reps', true, timestamptz '2026-09-04T00:00:00.000Z'),
  ('smith-machine-close-grip-bench-press', 'Smith Machine Close-Grip Bench Press', NULL, 'machine', ARRAY['triceps', 'chest', 'front_delts']::text[], ARRAY['machine']::text[], ARRAY['smith-close-grip', 'smith-close-grip-bench']::text[], 'weight_reps', true, timestamptz '2026-09-04T00:00:00.000Z'),
  ('smith-machine-decline-bench-press', 'Smith Machine Decline Bench Press', NULL, 'machine', ARRAY['chest', 'triceps', 'front_delts']::text[], ARRAY['machine']::text[], ARRAY['decline-smith', 'decline-smith-machine', 'smith-decline', 'smith-decline-bench']::text[], 'weight_reps', true, timestamptz '2026-09-04T00:00:00.000Z'),
  ('smith-machine-incline-bench-press', 'Smith Machine Incline Bench Press', NULL, 'machine', ARRAY['chest', 'front_delts', 'triceps']::text[], ARRAY['machine']::text[], ARRAY['incline-smith', 'incline-smith-machine', 'incline-smith-machine-bench-press', 'smith-incline', 'smith-incline-bench', 'smith-machine-incline']::text[], 'weight_reps', true, timestamptz '2026-09-04T00:00:00.000Z'),
  ('smith-machine-shrug', 'Smith Machine Shrug', NULL, 'machine', ARRAY['traps', 'forearms']::text[], ARRAY['machine']::text[], ARRAY['smith-shrug']::text[], 'weight_reps', true, timestamptz '2026-09-04T00:00:00.000Z'),
  ('seated-smith-machine-shoulder-press', 'Smith Machine Shoulder Press', NULL, 'machine', ARRAY['front_delts', 'triceps', 'side_delts']::text[], ARRAY['machine']::text[], ARRAY['smith-shoulder-press', 'smith-machine-ohp']::text[], 'weight_reps', true, timestamptz '2026-09-04T00:00:00.000Z'),
  ('smith-machine-squat', 'Smith Machine Squat', NULL, 'machine', ARRAY['quads', 'glutes', 'lower_back', 'calves']::text[], ARRAY['machine']::text[], ARRAY['smith-squat', 'smith-machine-back-squat']::text[], 'weight_reps', true, timestamptz '2026-09-04T00:00:00.000Z')
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
