-- Spaces: IRLY Mom, IRLY Family, IRLY Only Girls.
--
-- No new system: each space is its official community (moms and girls are
-- women-only, families is open to all) with topic groups (communities v2),
-- so posts with photos or video, comments, pins, announcements, search and
-- reports work as everywhere. Adds the groups, and fixes the Moms feed:
-- IRLY Moms (an official community without a category) now shows there.

insert into public.community_subtopics (parent_topic, subtopic, name, tagline, emoji, sort) values
  ('moms', 'bump', 'Bump & babies (0–1)', 'Pregnancy, newborns and the first year.', '🤰', 1),
  ('moms', 'toddlers', 'Toddlers (1–3)', 'Little ones, playgrounds and nurseries.', '🧸', 2),
  ('moms', 'kids', 'Kids (4–11)', 'School years, clubs and birthdays.', '🎨', 3),
  ('moms', 'teens', 'Teens (12+)', 'Big kids, big questions.', '🎧', 4),
  ('moms', 'brunch', 'Coffee & brunch', 'Mums meeting mums, with or without the kids.', '☕', 5),
  ('moms', 'playdates', 'Playdates & outings', 'Parks, play areas and spontaneous plans.', '🛝', 6),
  ('moms', 'recommend', 'Schools, nurseries & doctors', 'Recommendations: schools, nurseries, paediatricians.', '🎒', 7),
  ('moms', 'advice', 'Questions & advice', 'Ask other mums, share what worked.', '💬', 8),
  ('families', 'weekend', 'Weekend outings', 'Picnics, parks, visits and day trips.', '🌳', 1),
  ('families', 'kids', 'Kids activities', 'Classes, sports and things to do with children.', '⚽', 2),
  ('families', 'schools', 'Schools, nurseries & clubs', 'Recommendations from other parents.', '🎒', 3),
  ('families', 'deals', 'Family deals & events', 'Good deals and family events.', '🎟️', 4),
  ('families', 'neighbours', 'Families nearby', 'Meet families from your neighbourhood.', '🏘️', 5),
  ('families', 'parents', 'Parents'' circle', 'Parents helping parents.', '👨‍👩‍👧', 6),
  ('families', 'practical', 'Family life here', 'Health, paperwork and practical tips.', '🧭', 7),
  ('girls', 'brunch', 'Coffee, brunch & dinners', 'Girls'' plans around good food.', '☕', 1),
  ('girls', 'fitness', 'Padel & fitness', 'Courts, classes and workout buddies.', '🎾', 2),
  ('girls', 'wellness', 'Yoga & wellness', 'Yoga, spa days and feeling good.', '🧘', 3),
  ('girls', 'beach', 'Beach clubs & restaurants', 'Sun, pools and favourite tables.', '🏝️', 4),
  ('girls', 'nights', 'Nights out', 'Going out together, safely.', '🥂', 5),
  ('girls', 'trips', 'Trips & weekends', 'Excursions and weekends away.', '✈️', 6),
  ('girls', 'business', 'Women in business', 'A professional and friendly network.', '💼', 7),
  ('girls', 'advice', 'Tips for life here', 'Recommendations and advice between women.', '💬', 8)
on conflict (parent_topic, subtopic) do update set name = excluded.name, tagline = excluded.tagline, emoji = excluded.emoji, sort = excluded.sort;
select private.ensure_official_subgroups();

-- The Moms feed: family communities, and IRLY Moms with its groups.
create or replace function public.girl_feed(p_city text, p_moms boolean default false, p_limit integer default 30, p_before timestamptz default null)
returns table (id uuid, community_id uuid, community_name text, author_id uuid, first_name text, body text,
  activity_id uuid, activity_title text, activity_starts_at timestamptz, likes integer, comments integer, liked boolean,
  created_at timestamptz, mine boolean, is_member boolean)
language plpgsql stable security invoker set search_path = public as $$
begin
  if not private.is_girl_eligible(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return query
  select p.id, c.id, c.name, p.author_id, a.first_name, p.body, p.activity_id, act.title, act.starts_at,
    (select count(*)::int from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text),
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    p.created_at, p.author_id = auth.uid(),
    exists (select 1 from public.community_members m where m.community_id = c.id and m.user_id = auth.uid())
  from public.community_posts p
  join public.communities c on c.id = p.community_id and c.deleted_at is null and c.girl_only
  left join public.profiles_public a on a.id = p.author_id
  left join public.activities act on act.id = p.activity_id
  where p.deleted_at is null
    and c.city_id = any (private.city_scope(p_city))
    and (not p_moms or c.category_id = 'family'
      or coalesce(c.topic, (select t.topic from public.communities t where t.id = c.parent_id)) = 'moms')
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 60);
end $$;
revoke all on function public.girl_feed(text, boolean, integer, timestamptz) from public, anon;
grant execute on function public.girl_feed(text, boolean, integer, timestamptz) to authenticated;

-- A space's official community in a city (null when it is not open there,
-- or when the member may not see it: women-only spaces stay hidden).
create or replace function public.space_community(p_topic text, p_city text)
returns table (id uuid, name text, tagline text, girl_only boolean, members integer, is_member boolean, city_id text)
language sql stable security invoker set search_path = public as $$
  select c.id, c.name, c.tagline, c.girl_only,
    (select count(*)::int from public.community_members m where m.community_id = c.id),
    private.i_belong(c.id), c.city_id
  from public.communities c
  where c.official and c.topic = p_topic and c.parent_id is null and c.deleted_at is null
    and c.city_id = any (private.city_scope(p_city))
  order by (c.city_id = p_city) desc
  limit 1
$$;
revoke all on function public.space_community(text, text) from public, anon;
grant execute on function public.space_community(text, text) to authenticated;
