-- Fix after 20261108200000_irly_official_communities_dubai (official
-- communities in Dubai only).
--
-- Until then a retired official community always had an inactive topic, so
-- community_recommend reading active topics was enough to leave it out. Now
-- IRLY Expat, IRLY Sport, IRLY Network… are active in Dubai and retired in
-- the other emirates and Bali: a member in Sharjah or Abu Dhabi was
-- recommended (onboarding, « For you ») the retired communities of their
-- emirate (their city first), with a working Join. A retired community
-- stays open to its members (page, feed, chat, « Mine »); recommendations
-- now leave it out. Same signature, same grants.

create or replace function public.community_recommend(p_city text, p_tags text[], p_limit integer default 6)
returns table (id uuid, topic text, name text, tagline text, emoji text, girl_only boolean, intro_first boolean, members integer, is_member boolean, score integer, city_id text)
language sql stable set search_path = public as $$
  with mine as (select distinct unnest(coalesce(p_tags, '{}')) as tag),
  cand as (
    select c.id, t.topic, c.name, c.tagline, t.emoji, c.girl_only, t.intro_first, c.city_id, t.sort,
      c.members_count as members,
      private.i_belong(c.id) as is_member,
      (select coalesce(sum(case
          when m.tag = 'newcomer' then 3
          when m.tag like 'interest:%' then 3
          when m.tag like 'activity:%' or m.tag like 'goal:%' then 2
          when m.tag like 'type:%' then 1
          when m.tag like 'lang:%' then 3
          else 0 end), 0)::int
        from mine m where m.tag = any (t.match_tags)) as base
    from public.communities c
    join public.community_topics t on t.topic = c.topic and t.active
    where c.official and c.deleted_at is null and c.retired_at is null
      and c.city_id = any (private.city_scope(p_city))
  ),
  best as (
    select distinct on (topic) * from cand where base > 0
    order by topic, (city_id = p_city) desc, members desc
  )
  select id, topic, name, tagline, emoji, girl_only, intro_first, members, is_member,
    base + (case when city_id = p_city then 2 else 0 end) + (case when members >= 10 then 1 else 0 end) as score, city_id
  from best
  order by score desc, sort, name
  limit greatest(1, least(coalesce(p_limit, 6), 20))
$$;

-- Les Français à Dubaï: recommended to members who speak French (the app
-- sends 'lang:fr' from the languages they gave at signup).
update public.community_topics set match_tags = '{lang:fr}' where topic = 'francais';

-- IRLY Padel Club: also for members who chose sport at signup, not only padel.
update public.community_topics set match_tags = '{activity:padel,goal:sport,interest:sports}' where topic = 'padel';
