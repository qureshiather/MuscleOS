-- MUS-112: add Military Press (strict, heels-together barbell press) to the catalog.
-- Mirrors its row in apps/mobile/src/data/exercises.ts. updated_at = now() so existing clients
-- pull it via the catalog delta. Safe to re-run: an existing row is left alone.

insert into public.catalog_exercises (
  id, instructions, name, category, muscles, equipment, aliases, tracking_type, is_published, updated_at
)
select v.id, v.instructions, 'Military Press', 'free_weight'::public.exercise_category,
  ARRAY['front_delts', 'triceps', 'side_delts', 'abs']::text[], ARRAY['barbell']::text[], ARRAY[]::text[],
  'weight_reps'::public.exercise_tracking_type, true, now()
from (values
  ('military-press', 'Stand tall with your heels together and the bar at your front shoulders, hands just outside shoulder width. Squeeze your glutes and brace, then press the bar straight up without leaning back or bending your knees. Lock out overhead and lower under control to your shoulders.')
) as v(id, instructions)
on conflict (id) do nothing;
