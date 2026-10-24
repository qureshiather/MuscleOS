-- MUS-171: tibialis and neck become their own muscles, so the shin and neck light up on the
-- diagram instead of the calves and traps. Retags the tibialis and neck exercises, and fixes
-- Scap Pull-Up, which only listed forearms. Mirrors apps/mobile/src/data/exercises.ts.
-- updated_at = now() so existing clients pull the change via the catalog delta. Safe to re-run.

update public.catalog_exercises as c
set muscles = v.muscles, updated_at = now()
from (values
  ('kettlebell-tibialis-raise', ARRAY['tibialis']::text[]),
  ('tibialis-band-pull', ARRAY['tibialis']::text[]),
  ('tibialis-raise', ARRAY['tibialis']::text[]),
  ('lying-neck-curl', ARRAY['neck']::text[]),
  ('lying-neck-extension', ARRAY['neck', 'traps']::text[]),
  ('prone-neck-bridge', ARRAY['neck']::text[]),
  ('supine-neck-bridge', ARRAY['neck', 'traps']::text[]),
  ('scap-pull-up', ARRAY['traps', 'lats', 'rhomboids', 'forearms']::text[])
) as v(id, muscles)
where c.id = v.id
  and c.muscles is distinct from v.muscles;
