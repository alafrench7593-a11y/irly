-- IRLY: the categories members discover activities by, on the server too.
--
-- The app's catalog (src/data/catalog/categories.ts) now lists Going out,
-- Cafés and Games & social and Experiences next to the existing ones (Beach
-- and Communities were already here): the server search finds them by name
-- like the others. Additive only: no category, activity or label already
-- stored is changed.

insert into public.categories (id, label, color, sort) values
  ('outings', 'Going out', '#FF7A59', 22),
  ('cafes', 'Cafés', '#A0662D', 23),
  ('games', 'Games & social', '#7B61FF', 24),
  ('experiences', 'Experiences', '#D99A00', 25)
on conflict (id) do nothing;
