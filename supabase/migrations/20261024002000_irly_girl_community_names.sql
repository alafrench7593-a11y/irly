-- IRLY Girl community names: one spelling, one name on every page.
--
-- Renames in place (same row, same id): members, posts, activities, groups
-- and the community chat stay exactly as they are; the chat title follows
-- the new name (communities_chat_title trigger). Nothing is deleted or
-- recreated. A name a host changed since is left alone (only the old seeded
-- or official text is replaced), and a rename never makes two communities
-- of the same city share a name.
--
--   IRLY Girls                   -> IRLY Girl            (official, every city: the IRLY Girl brand)
--   IRLY Families                -> IRLY Family          (official, every city: the IRLY Family space)
--   IRLY Moms tagline "Mums …"   -> "Moms …"             (IRLY Moms says Moms, never Mums)
--   Moms groups "Mums" taglines  -> "Moms"
--   Girls Surf Bali              -> Bali Surf Girls      (Bali's girls communities read "Bali … Girls")
--   Girls Padel Bali             -> Bali Padel Girls
--   French Girls Bali            -> Bali French Girls
--   Women Entrepreneurs Bali     -> Bali Women Entrepreneurs
--   Girls Moving To Bali         -> Girls Moving to Bali (title case: "to")
--   New Moms Dubai               -> Dubai New Moms       (like Dubai Moms, Dubai Hills Moms)
--
-- Every "Moms" community keeps "Moms" in its name: IRLY Moms lists
-- communities by that word.

-- The official catalog first, so ensure_official_communities() / subgroups keep the new names.
update public.community_topics set name = 'IRLY Girl' where topic = 'girls' and name = 'IRLY Girls';
update public.community_topics set name = 'IRLY Family' where topic = 'families' and name = 'IRLY Families';
update public.community_topics set tagline = 'Moms meeting moms, with or without the kids.'
where topic = 'moms' and tagline = 'Mums meeting mums, with or without the kids.';
update public.community_subtopics set tagline = 'Moms meeting moms, with or without the kids.'
where parent_topic = 'moms' and subtopic = 'brunch' and tagline = 'Mums meeting mums, with or without the kids.';
update public.community_subtopics set tagline = 'Ask other moms, share what worked.'
where parent_topic = 'moms' and subtopic = 'advice' and tagline = 'Ask other mums, share what worked.';

-- Existing communities, by their stable keys (official topic and city, or
-- group subtopic under its official parent, or the seeded city + name).
-- Safe to run again: it only touches rows still carrying an old text.
create or replace function private.irly_girl_community_names() returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
  k integer;
  r record;
begin
  -- Official top communities (one per topic and city).
  for r in select * from (values
    ('girls', 'IRLY Girls', 'IRLY Girl'),
    ('families', 'IRLY Families', 'IRLY Family')
  ) v (topic, old_name, new_name) loop
    update public.communities set name = r.new_name
    where official and topic = r.topic and parent_id is null and deleted_at is null and name = r.old_name;
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  update public.communities set tagline = 'Moms meeting moms, with or without the kids.'
  where official and topic = 'moms' and parent_id is null and tagline = 'Mums meeting mums, with or without the kids.';
  get diagnostics k = row_count;
  n := n + k;

  -- IRLY Moms groups (subtopic under the official parent).
  for r in select * from (values
    ('brunch', 'Mums meeting mums, with or without the kids.', 'Moms meeting moms, with or without the kids.'),
    ('advice', 'Ask other mums, share what worked.', 'Ask other moms, share what worked.')
  ) v (subtopic, old_tagline, new_tagline) loop
    update public.communities c set tagline = r.new_tagline
    from public.communities p
    where c.parent_id = p.id and p.official and p.topic = 'moms'
      and c.subtopic = r.subtopic and c.tagline = r.old_tagline;
    get diagnostics k = row_count;
    n := n + k;
  end loop;

  -- Seeded IRLY Girl / IRLY Moms communities (created by IRLY, no owner).
  for r in select * from (values
    ('bali', 'Girls Surf Bali', 'Bali Surf Girls'),
    ('bali', 'Girls Padel Bali', 'Bali Padel Girls'),
    ('bali', 'French Girls Bali', 'Bali French Girls'),
    ('bali', 'Women Entrepreneurs Bali', 'Bali Women Entrepreneurs'),
    ('bali', 'Girls Moving To Bali', 'Girls Moving to Bali'),
    ('dubai', 'New Moms Dubai', 'Dubai New Moms')
  ) v (city_id, old_name, new_name) loop
    update public.communities c set name = r.new_name
    where c.city_id = r.city_id and c.name = r.old_name and c.girl_only and c.created_by is null
      and c.parent_id is null and c.deleted_at is null
      and not exists (
        select 1 from public.communities o
        where o.city_id = r.city_id and o.name = r.new_name and o.deleted_at is null and o.id <> c.id
      );
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  return n;
end $$;
revoke all on function private.irly_girl_community_names() from public, anon, authenticated;

select private.irly_girl_community_names();
