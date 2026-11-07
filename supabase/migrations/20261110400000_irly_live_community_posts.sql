-- A post published from the Live with a community chosen is ONE record: a
-- community post (community_posts) flagged in_live. It shows in the
-- community's posts and, for 24 hours, in the Live of the community's
-- universe. Reactions, comments, saves, reports, removal and moderation are
-- those of the community post: there is never a second copy.
--
-- 1. community_posts.in_live: set when the post is published (only with a
--    community); never switched on later, so an old post cannot be pushed
--    into the Live. The author or a moderator may take it off the Live
--    (in_live = false): the post stays in the community.
-- 2. live_feed(p_city, p_space): the Live of one app space, as one list:
--    - the space's own Lives (irl_posts of that app_scope, as irl_feed and
--      irl_feed_girl list them);
--    - the community posts flagged in_live in the last 24 hours whose
--      community belongs to that space, by the universe rule
--      (private.community_universe, migration 20261110000000):
--        Mixte app ('irly'):      Mixte, and Network communities not women-only;
--        IRLY Girl ('irly_girl'): Girl, Mom, and Network communities women-only.
--      A Girl or Mom post never reaches the Mixte Live, a Mixte post never
--      reaches IRLY Girl's.
--    The function is security invoker: every row goes through the caller's
--    own read rules (community_posts_read, communities_read, irl_posts_read,
--    blocks), so the Live never shows a post the caller could not open in
--    its community. A removed post (deleted_at, by its author or a
--    moderator) is gone from both at once. The IRLY Girl Live is refused to
--    anyone without IRLY Girl access, as irl_feed_girl is.
--    irl_feed and irl_feed_girl stay as they are for installed apps.

-- ───────── 1. The flag ─────────
alter table public.community_posts add column if not exists in_live boolean not null default false;
do $$ begin
  alter table public.community_posts add constraint community_posts_in_live_community check (not in_live or community_id is not null);
exception when duplicate_object then null; end $$;
create index if not exists community_posts_in_live_idx on public.community_posts (created_at desc) where in_live and deleted_at is null;

create or replace function private.community_post_in_live_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.in_live and not old.in_live then
    raise exception 'a post joins the Live only when it is published' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists community_posts_in_live_guard on public.community_posts;
create trigger community_posts_in_live_guard before update of in_live on public.community_posts
for each row execute function private.community_post_in_live_guard();

-- ───────── 2. The space a community's posts go to ─────────
-- 'irly' (the Mixte app) or 'irly_girl' (the IRLY Girl app), from the one
-- universe rule. Says nothing the caller's read rules would hide: the feed
-- below only asks it about rows the caller can already read.
create or replace function private.community_live_space(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select case private.community_universe(c.id)
    when 'mixte' then 'irly'
    when 'girl' then 'irly_girl'
    when 'mom' then 'irly_girl'
    when 'network' then case when c.girl_only then 'irly_girl' else 'irly' end
    end
  from public.communities c
  where c.id = p_id
$$;
revoke all on function private.community_live_space(uuid) from public, anon;
grant execute on function private.community_live_space(uuid) to authenticated;

-- ───────── 3. The Live of one space ─────────
create or replace function public.live_feed(p_city text, p_space text default 'irly')
returns table (id uuid, source text, author_id uuid, first_name text, area_id text, place_name text, body text,
  media_path text, media_paths text[], visibility text, created_at timestamptz, friend boolean, activity_id uuid,
  activity_title text, city_id text, media_kind text, thumb_path text, media_seconds integer, media_ratio real,
  community_id uuid, community_name text, community_cover_path text, community_topic text, community_category_id text,
  as_irly boolean)
language plpgsql stable security invoker set search_path = public as $$
#variable_conflict use_column
declare
  scope constant text := case when p_space in ('girl', 'irly_girl') then 'irly_girl' else 'irly' end;
begin
  if auth.uid() is null then
    raise exception 'sign in to see the Live' using errcode = '42501';
  end if;
  if scope = 'irly_girl' and not private.is_girl_eligible(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return query
  select f.* from (
    -- The space's own Lives, as irl_feed / irl_feed_girl list them.
    select i.id as id, 'irl'::text as source, i.author_id as author_id, p.first_name as first_name, i.area_id as area_id,
      i.place_name as place_name, i.body as body, i.media_path as media_path,
      case when i.media_path is null then '{}'::text[] else array[i.media_path] end as media_paths,
      i.visibility as visibility, i.created_at as created_at, private.are_friends(auth.uid(), i.author_id) as friend,
      a.id as activity_id, a.title as activity_title, i.city_id as city_id,
      case when i.media_path is null then null else i.media_kind end as media_kind, i.thumb_path as thumb_path,
      i.media_seconds as media_seconds, i.media_ratio as media_ratio,
      null::uuid as community_id, null::text as community_name, null::text as community_cover_path,
      null::text as community_topic, null::text as community_category_id, false as as_irly
    from (
      select x.* from public.irl_posts x
      where x.app_scope = scope and x.city_id = any (private.city_scope(p_city)) and x.expires_at > now()
        and (scope = 'irly' or private.girl_eligible_unchecked(x.author_id))
        and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid() and h.target_type = 'irl_post' and h.target_id = x.id::text)
      order by x.created_at desc, x.id desc
      limit 100
    ) i
    cross join lateral (select pp.first_name from public.profiles_public pp where pp.id = i.author_id offset 0) p
    left join public.activities a on a.id = i.activity_id
    union all
    -- Community posts published to the Live, in a community of this space,
    -- the 24 hours after they were posted. Read through the caller's rules.
    select cp.id, 'community'::text, cp.author_id,
      case when cp.as_irly then 'IRLY' else (select pp.first_name from public.profiles_public pp where pp.id = cp.author_id) end,
      null::text, null::text, cp.body,
      cp.media_paths[1], cp.media_paths, 'community'::text, cp.created_at,
      case when cp.as_irly then false else private.are_friends(auth.uid(), cp.author_id) end,
      act.id, act.title, c.city_id, cp.media_kind, cp.thumb_path, cp.media_seconds, null::real,
      c.id, c.name, c.cover_path, c.topic, c.category_id, cp.as_irly
    from (
      select y.* from public.community_posts y
      where y.in_live and y.deleted_at is null and y.created_at > now() - interval '24 hours'
        and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid() and h.target_type = 'community_post' and h.target_id = y.id::text)
      order by y.created_at desc, y.id desc
      limit 200
    ) cp
    join public.communities c on c.id = cp.community_id
    left join public.activities act on act.id = cp.activity_id
    where c.deleted_at is null
      and c.city_id = any (private.city_scope(p_city))
      and private.community_live_space(c.id) = scope
  ) f
  order by f.created_at desc, f.id desc
  limit 100;
end $$;
revoke all on function public.live_feed(text, text) from public, anon;
grant execute on function public.live_feed(text, text) to authenticated;
