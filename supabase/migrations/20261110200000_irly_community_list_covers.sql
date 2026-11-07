-- Community lists carry each community's own photo (cover_path), so every
-- list shows the real photo at once instead of asking for it by id: the
-- Communities page (Mine, For you, Discover), Home, Profile and the IRLY
-- Network tiles.
--
--   community_list(p_city)                           + cover_path
--   community_directory(p_city, p_sort, p_search, p_limit) + cover_path
--   community_recommend(p_city, p_tags, p_limit)     + cover_path
--
-- member_communities, girl_official_communities and mom_official_communities
-- already return it. Same rows, same order, same rules as before (bodies of
-- 20261029700000_irly_admin_global, 20261107100000_irly_community_social and
-- 20261109000000_irly_official_girl_mom_no_groups): only a column is added,
-- at the end, so an installed app that does not read it is unchanged. Row
-- security is untouched: community_list and community_recommend still run
-- as the caller (communities_read: IRLY Girl, Mom and women-only Network
-- communities only for women with IRLY Girl access); community_directory
-- keeps its own women-only filter. The photo file itself stays behind the
-- activity-photos read rule (readable by whoever may see the community).
-- Idempotent: dropped and created again with the same grants.

-- ───────── community_list ─────────
drop function if exists public.community_list(text);
create function public.community_list(p_city text)
returns table (id uuid, name text, tagline text, category_id text, girl_only boolean, members integer, is_member boolean,
  posts_week integer, city_id text, official boolean, topic text, emoji text, created_at timestamptz, cover_path text)
language sql stable set search_path = public as $$
  select c.id, c.name, c.tagline, c.category_id, c.girl_only, c.members_count,
    private.i_belong(c.id),
    (select count(*)::int from public.community_posts p where p.community_id = c.id and p.deleted_at is null and p.created_at > now() - interval '7 days'),
    c.city_id, c.official, c.topic, t.emoji, c.created_at, c.cover_path
  from public.communities c
  left join public.community_topics t on t.topic = c.topic
  where c.city_id = any (private.city_scope(p_city)) and c.deleted_at is null and c.parent_id is null
    and c.retired_at is null
  order by (c.city_id = p_city) desc, c.official desc, case when c.official then t.sort end nulls last,
    c.members_count desc, c.created_at, c.id
  limit 200
$$;
revoke all on function public.community_list(text) from public, anon;
grant execute on function public.community_list(text) to authenticated;

-- ───────── community_directory ─────────
drop function if exists public.community_directory(text, text, text, integer);
create function public.community_directory(p_city text, p_sort text default 'members',
  p_search text default null, p_limit integer default 100)
returns table (id uuid, name text, tagline text, description text, emoji text, category_id text, topic text, official boolean,
  girl_only boolean, members_count integer, upcoming_count integer, posts_week integer, created_at timestamptz,
  is_member boolean, is_favorite boolean, cover_path text)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  srt text := coalesce(nullif(btrim(p_sort), ''), 'members');
  pat text := private.ilike_pattern(p_search);
  girl boolean;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if srt not in ('members', 'active', 'recent', 'activities') then
    raise exception 'sort: members, active, recent or activities' using errcode = '22023';
  end if;
  girl := private.girl_eligible_unchecked(me);
  return query
    with base as (
      select c.*, t.emoji as topic_emoji
      from public.communities c
      left join public.community_topics t on t.topic = c.topic
      where c.deleted_at is null and c.parent_id is null and c.retired_at is null
        and (not c.girl_only or girl)
        and (p_city is null or c.city_id = any (private.city_scope(p_city)))
        and (pat is null or c.name ilike pat or c.tagline ilike pat or c.description ilike pat
             or c.category_id ilike pat or c.topic ilike pat or t.name ilike pat)
    ), counted as (
      select b.*,
        private.community_member_count(b.id) as n_members,
        private.community_upcoming_count(b.id) as n_upcoming,
        (select count(*)::int from public.community_posts x
          where x.community_id = b.id and x.deleted_at is null and x.created_at > now() - interval '7 days') as n_posts,
        -- Chat messages are read only for the « active » sort.
        case when srt = 'active' then
          (select count(*)::int from public.conversations v
            join public.messages msg on msg.conversation_id = v.id
            where v.community_id = b.id and msg.deleted_at is null and msg.sender_id is not null
              and msg.created_at > now() - interval '7 days')
        else 0 end as n_messages
      from base b
    )
    select k.id, k.name, k.tagline, k.description, coalesce(k.emoji, k.topic_emoji), k.category_id, k.topic, k.official,
      k.girl_only, k.n_members, k.n_upcoming, k.n_posts, k.created_at,
      exists (select 1 from public.community_members m where m.community_id = k.id and m.user_id = me),
      exists (select 1 from public.community_favorites f where f.community_id = k.id and f.user_id = me),
      k.cover_path
    from counted k
    order by
      case srt when 'members' then k.n_members when 'active' then k.n_posts + k.n_messages
        when 'activities' then k.n_upcoming else 0 end desc,
      case when srt = 'recent' then k.created_at end desc nulls last,
      k.n_members desc, k.created_at desc, k.id
    limit least(greatest(coalesce(p_limit, 100), 1), 200);
end $$;
revoke all on function public.community_directory(text, text, text, integer) from public, anon;
grant execute on function public.community_directory(text, text, text, integer) to authenticated;

-- ───────── community_recommend ─────────
drop function if exists public.community_recommend(text, text[], integer);
create function public.community_recommend(p_city text, p_tags text[], p_limit integer default 6)
returns table (id uuid, topic text, name text, tagline text, emoji text, girl_only boolean, intro_first boolean, members integer,
  is_member boolean, score integer, city_id text, cover_path text)
language sql stable set search_path = public as $$
  with mine as (select distinct unnest(coalesce(p_tags, '{}')) as tag),
  cand as (
    select c.id, t.topic, c.name, c.tagline, t.emoji, c.girl_only, t.intro_first, c.city_id, t.sort, c.cover_path,
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
    where c.official and c.deleted_at is null and c.retired_at is null and c.parent_id is null
      and c.city_id = any (private.city_scope(p_city))
      and (t.require_tags is null or coalesce(p_tags, '{}') && t.require_tags)
  ),
  best as (
    select distinct on (topic) * from cand where base > 0
    order by topic, (city_id = p_city) desc, members desc
  )
  select id, topic, name, tagline, emoji, girl_only, intro_first, members, is_member,
    base + (case when city_id = p_city then 2 else 0 end) + (case when members >= 10 then 1 else 0 end) as score, city_id,
    cover_path
  from best
  -- A tie between an IRLY community and its Girl or Mom twin: IRLY's first (the twin follows).
  order by score desc, sort, girl_only, name
  limit greatest(1, least(coalesce(p_limit, 6), 20))
$$;
revoke all on function public.community_recommend(text, text[], integer) from public, anon;
grant execute on function public.community_recommend(text, text[], integer) to authenticated;
