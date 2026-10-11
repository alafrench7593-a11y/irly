-- Help & Questions: members ask and answer about life in the city.
--
-- Built on communities v2 (no new system): one official community per city,
-- "IRLY Help & Questions", with eight groups (visa, schools, housing, jobs,
-- health, good addresses, services, general). A question or a
-- recommendation is a post of kind 'question' / 'recommendation' in a
-- group; answers are comments; saving, likes ("useful"), reports (scam is
-- a report category) and moderation are the existing ones.
-- help_feed() lists and searches them by category and keywords.

insert into public.community_topics (topic, name, tagline, emoji, match_tags, cities, girl_only, intro_first, sort) values
  ('help', 'IRLY Help & Questions', 'Ask, answer and recommend: life in the city, from people who live it.', '🙋',
    '{}', '{dubai,abudhabi}', false, false, 3)
on conflict (topic) do nothing;
select private.ensure_official_communities();

insert into public.community_subtopics (parent_topic, subtopic, name, tagline, emoji, sort) values
  ('help', 'visa', 'Visa & paperwork', 'Residence, Emirates ID, permits: members'' experience, with official links.', '🛂', 1),
  ('help', 'schools', 'Schools & nurseries', 'Schools, nurseries and education.', '🎒', 2),
  ('help', 'housing', 'Housing & areas', 'Where to live, renting, moving in.', '🏠', 3),
  ('help', 'jobs', 'Jobs & careers', 'Finding work, hiring, career questions.', '💼', 4),
  ('help', 'health', 'Health & wellbeing', 'Doctors, clinics, insurance, wellbeing.', '🩺', 5),
  ('help', 'addresses', 'Restaurants & good addresses', 'Places and professionals members trust.', '🍽️', 6),
  ('help', 'services', 'Services & daily life', 'Phone, bank, transport, home services.', '🧰', 7),
  ('help', 'general', 'General questions', 'Anything else about life here.', '💬', 8)
on conflict (parent_topic, subtopic) do update set name = excluded.name, tagline = excluded.tagline, emoji = excluded.emoji, sort = excluded.sort;
select private.ensure_official_subgroups();

-- Questions and recommendations of a city's Help community, newest first
-- (pinned first), filtered by group and searched by keywords (every word).
create or replace function public.help_feed(p_city text, p_category text default null, p_query text default null,
  p_kind text default null, p_limit integer default 40, p_before timestamptz default null)
returns table (id uuid, community_id uuid, category text, category_name text, author_id uuid, first_name text, body text, kind text,
  media_paths text[], media_kind text, thumb_path text, created_at timestamptz, edited_at timestamptz,
  answers integer, likes integer, liked boolean, saved boolean, pinned boolean, mine boolean)
language sql stable security invoker set search_path = public as $$
  with words as (
    select w from regexp_split_to_table(lower(btrim(coalesce(p_query, ''))), '\s+') w where char_length(w) >= 2
  )
  select p.id, g.id, g.subtopic, g.name, p.author_id, a.first_name, p.body, p.kind,
    p.media_paths, p.media_kind, p.thumb_path, p.created_at, p.edited_at,
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    (select count(*)::int from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    exists (select 1 from public.saves s where s.target_type = 'community_post' and s.target_id = p.id::text and s.user_id = auth.uid()),
    exists (select 1 from public.community_pins x where x.post_id = p.id),
    p.author_id = auth.uid()
  from public.communities h
  join public.communities g on g.parent_id = h.id and g.deleted_at is null
  join public.community_posts p on p.community_id = g.id and p.deleted_at is null
  left join public.profiles_public a on a.id = p.author_id
  where h.official and h.topic = 'help' and h.deleted_at is null
    and h.city_id = any (private.city_scope(p_city))
    and (p_category is null or g.subtopic = p_category)
    and (p_kind is null or p.kind = p_kind)
    and (p_before is null or p.created_at < p_before)
    and not exists (select 1 from words where position(words.w in lower(p.body)) = 0)
    and not exists (select 1 from public.hidden_items hi where hi.user_id = auth.uid() and hi.target_type = 'community_post' and hi.target_id = p.id::text)
  order by (p_query is null and exists (select 1 from public.community_pins x where x.post_id = p.id)) desc, p.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;
revoke all on function public.help_feed(text, text, text, text, integer, timestamptz) from public, anon;
grant execute on function public.help_feed(text, text, text, text, integer, timestamptz) to authenticated;

-- The city's Help groups (to ask in the right one).
create or replace function public.help_groups(p_city text)
returns table (id uuid, category text, name text, tagline text, emoji text, is_member boolean, questions integer)
language sql stable security invoker set search_path = public as $$
  select g.id, g.subtopic, g.name, g.tagline, g.emoji, private.i_belong(g.id),
    (select count(*)::int from public.community_posts p where p.community_id = g.id and p.deleted_at is null)
  from public.communities h
  join public.communities g on g.parent_id = h.id and g.deleted_at is null
  left join public.community_subtopics s on s.parent_topic = 'help' and s.subtopic = g.subtopic
  where h.official and h.topic = 'help' and h.deleted_at is null and h.city_id = p_city
  order by coalesce(s.sort, 100), g.name
$$;
revoke all on function public.help_groups(text) from public, anon;
grant execute on function public.help_groups(text) to authenticated;
