-- IRLY community speed: the community page, its tabs and its search answer
-- fast on a big community (measured on 20k members, 50k posts, 480k likes,
-- 150k comments, 5k activities, 70k chat messages; numbers in the commit).
-- Additive and idempotent: functions are replaced with the same signatures,
-- outputs, ordering and privacy rules; one new partial index. No data is
-- changed. Every sign-in, IRLY Girl, block, ban and visibility check is
-- kept as it was, in the same place.
--
--  SPEED-01 community_posts_page (last defined in 20261108000000), sort
--           « recent »: the ids were picked by numbering every post of the
--           community (a sort of the whole community, 40k rows, 50 ms) to keep
--           20. The running pins (10 at most) and the newest unpinned posts
--           are now read apart, the latter straight from a partial index in
--           (created_at desc, id) order, and merged in the same order as
--           before: pins first on the first page only (pinned_at desc,
--           created_at desc, id), then created_at desc, id. Later pages
--           still skip pinned posts.
--  SPEED-02 The RPCs below run with jit = off. Their plans are tiny but the
--           planner's default guess of 1000 rows for set-returning helpers
--           (the poll counts' generate_series) pushes the estimated cost past
--           jit_above_cost, and compiling the query took 400 to 800 ms on
--           every call for 20 rows.
--  SPEED-03 community_members_list (last defined in 20261107100000): the
--           sort key called private.community_role_order() (a function with
--           its own search_path is never inlined) on every member, and the
--           block check was a sub-query per member. The same rank is now an
--           inline CASE and the blocks are read once (private.my_block_ids(),
--           both directions, as before). For someone outside the community,
--           private.profile_visible_unchecked() ran on every member before
--           the sort (20k calls, 2.7 s); the members are now sorted first and
--           the check runs on them in that order until the page is full.
--           community_header reads its faces through it, so it gains too.
--  SPEED-04 community_search (last defined in 20261108000000): the author's
--           name (profiles_public, one visibility check each), the snippet,
--           the pin flag and the going count were computed for every hit,
--           up to 500 posts for « popular » and every matching activity,
--           then 30 were kept. They are now computed for the 30 results
--           only. Activities and, for someone outside the community,
--           members are sorted first and the per-row checks
--           (private.activity_readable, private.profile_visible_unchecked)
--           run in that order until the page is full.

-- ───────── Index ─────────
-- Live posts of a community, newest first, ties by id (community_posts_page,
-- community_search, community_feed).
create index if not exists community_posts_live_idx on public.community_posts (community_id, created_at desc, id)
  where deleted_at is null;

-- ───────── SPEED-01, SPEED-02: community_posts_page ─────────
create or replace function public.community_posts_page(p_community uuid, p_sort text default 'recent',
  p_before timestamptz default null, p_offset integer default 0, p_limit integer default 20)
returns table (id uuid, author_id uuid, first_name text, body text, activity_id uuid, activity_title text,
  activity_starts_at timestamptz, poll jsonb, poll_counts integer[], my_vote smallint, likes integer, comments integer,
  liked boolean, created_at timestamptz, mine boolean, media_paths text[], media_kind text, thumb_path text,
  media_seconds integer, edited_at timestamptz, kind text, category text, pinned_at timestamptz,
  mentions uuid[], pin_expires_at timestamptz)
language plpgsql stable security definer set search_path = public set jit = off as $$
declare
  me uuid := auth.uid();
  srt text := coalesce(nullif(btrim(p_sort), ''), 'recent');
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  off integer := least(greatest(coalesce(p_offset, 0), 0), 1000);
  blocked uuid[];
  ids uuid[];
begin
  perform private.community_open_to_me(p_community);
  if srt not in ('recent', 'popular') then
    raise exception 'sort: recent or popular' using errcode = '22023';
  end if;
  blocked := private.my_block_ids();

  if srt = 'recent' then
    -- Running pins first on the first page only, then the newest posts that
    -- are not pinned (later pages skip pinned posts, as before).
    select array_agg(x.id order by x.grp, x.pinned_at desc nulls last, x.created_at desc, x.id) into ids from (
      select y.id, y.grp, y.pinned_at, y.created_at from (
        select p.id, 0 as grp, pin.pinned_at, p.created_at
        from public.community_pins pin
        join public.community_posts p on p.id = pin.post_id
        where p_before is null
          and pin.community_id = p_community and (pin.expires_at is null or pin.expires_at > now())
          and p.community_id = p_community and p.deleted_at is null
          and not (p.author_id = any (blocked))
        union all
        (select p.id, 1, null::timestamptz, p.created_at
         from public.community_posts p
         where p.community_id = p_community and p.deleted_at is null
           and not (p.author_id = any (blocked))
           and (p_before is null or p.created_at < p_before)
           and not exists (select 1 from public.community_pins pin where pin.post_id = p.id
                           and (pin.expires_at is null or pin.expires_at > now()))
         order by p.created_at desc, p.id
         limit lim)
      ) y
      order by y.grp, y.pinned_at desc nulls last, y.created_at desc, y.id
      limit lim
    ) x;
  else
    -- Likes + 2 × comments (+ 1, so a quiet post still ranks by age), decayed
    -- by age, among the newest 1000 posts; counted once per page, set-based.
    with cand as (
      select p.id, p.created_at from public.community_posts p
      where p.community_id = p_community and p.deleted_at is null and not (p.author_id = any (blocked))
      order by p.created_at desc
      limit 1000
    ), lk as (
      select l.target_id, count(*)::int as n from public.likes l
      where l.target_type = 'community_post' and l.target_id in (select c.id::text from cand c)
      group by l.target_id
    ), cm as (
      select k.target_id, count(*)::int as n from public.comments k
      where k.target_type = 'community_post' and k.deleted_at is null and k.target_id in (select c.id::text from cand c)
      group by k.target_id
    )
    select array_agg(x.id order by x.n) into ids from (
      select c.id, row_number() over (order by
        (coalesce(lk.n, 0) + 2 * coalesce(cm.n, 0) + 1)::float8
          / power(greatest(extract(epoch from now() - c.created_at), 0) / 3600 + 2, 1.5) desc,
        c.created_at desc, c.id) as n
      from cand c
      left join lk on lk.target_id = c.id::text
      left join cm on cm.target_id = c.id::text
      order by 2
      offset off
      limit lim
    ) x;
  end if;

  return query
  select p.id, p.author_id,
    (select pp.first_name from public.profiles_public pp where pp.id = p.author_id),
    p.body, p.activity_id,
    case when private.activity_readable(act.id) then act.title end,
    case when private.activity_readable(act.id) then act.starts_at end,
    p.poll,
    case when p.poll is null then null else array(
      select (select count(*)::int from public.community_poll_votes v where v.post_id = p.id and v.option = o.i)
      from generate_series(0, jsonb_array_length(p.poll -> 'options') - 1) o (i)
    ) end,
    (select v.option from public.community_poll_votes v where v.post_id = p.id and v.user_id = me),
    (select count(*)::int from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text),
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text
       and k.deleted_at is null and not (k.author_id = any (blocked))),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = me),
    p.created_at, p.author_id = me,
    p.media_paths, p.media_kind, p.thumb_path, p.media_seconds, p.edited_at,
    p.kind, p.category, pin.pinned_at, p.mentions, pin.expires_at
  from unnest(coalesce(ids, '{}'::uuid[])) with ordinality o (pid, n)
  join public.community_posts p on p.id = o.pid
  left join public.activities act on act.id = p.activity_id
  left join public.community_pins pin on pin.post_id = p.id and (pin.expires_at is null or pin.expires_at > now())
  order by o.n;
end $$;
revoke all on function public.community_posts_page(uuid, text, timestamptz, integer, integer) from public, anon;
grant execute on function public.community_posts_page(uuid, text, timestamptz, integer, integer) to authenticated;

-- ───────── SPEED-03: community_members_list ─────────
create or replace function public.community_members_list(p_community uuid, p_search text default null,
  p_limit integer default 200, p_offset integer default 0)
returns table (user_id uuid, name text, role text, joined_at timestamptz)
language plpgsql stable security definer set search_path = public set jit = off as $$
declare
  me uuid := auth.uid();
  pat text := private.ilike_pattern(p_search);
  lim integer := least(greatest(coalesce(p_limit, 200), 1), 500);
  off integer := greatest(coalesce(p_offset, 0), 0);
  insider boolean;
  blocked uuid[];
begin
  perform private.community_open_to_me(p_community);
  -- Members (and IRLY staff) see every member; anyone else, the people whose
  -- profile she may see (profile visibility, as profiles_public).
  insider := private.i_belong(p_community) or private.is_moderator(me);
  -- Nobody she blocked or who blocked her (both directions, as before).
  blocked := private.my_block_ids();
  if insider then
    return query
      select m.user_id, p.first_name, m.role, m.joined_at
      from public.community_members m
      join public.profiles p on p.id = m.user_id and p.deleted_at is null
      where m.community_id = p_community
        and (pat is null or p.first_name ilike pat)
        and (m.user_id = me or not (m.user_id = any (blocked)))
      -- private.community_role_order, inline.
      order by case m.role when 'owner' then 0 when 'co_admin' then 1 when 'moderator' then 2 when 'member' then 3 else 4 end,
        p.first_name, m.user_id
      limit lim
      offset off;
    return;
  end if;
  -- Sorted first (offset 0 keeps the visibility check out of the sort), then
  -- checked in that order until the page is full.
  return query
    select x.user_id, x.first_name, x.role, x.joined_at
    from (
      select m.user_id, p.first_name, m.role, m.joined_at,
        case m.role when 'owner' then 0 when 'co_admin' then 1 when 'moderator' then 2 when 'member' then 3 else 4 end as rank
      from public.community_members m
      join public.profiles p on p.id = m.user_id and p.deleted_at is null
      where m.community_id = p_community
        and (pat is null or p.first_name ilike pat)
        and (m.user_id = me or not (m.user_id = any (blocked)))
      order by 5, 2, 1
      offset 0
    ) x
    where private.profile_visible_unchecked(me, x.user_id)
    order by x.rank, x.first_name, x.user_id
    limit lim
    offset off;
end $$;
revoke all on function public.community_members_list(uuid, text, integer, integer) from public, anon;
grant execute on function public.community_members_list(uuid, text, integer, integer) to authenticated;

-- ───────── SPEED-04: community_search ─────────
create or replace function public.community_search(p_community uuid, p_query text, p_filter text default 'all',
  p_limit integer default 30, p_before timestamptz default null)
returns table (kind text, id uuid, title text, snippet text, author_id uuid, author_name text, created_at timestamptz,
  media_kind text, thumb_path text, pinned boolean, score real, starts_at timestamptz, going integer)
language plpgsql stable security definer set search_path = public, extensions set jit = off as $$
declare
  me uuid := auth.uid();
  q text := left(btrim(coalesce(p_query, '')), 60);
  pat text;
  flt text := coalesce(nullif(btrim(p_filter), ''), 'all');
  lim integer := least(greatest(coalesce(p_limit, 30), 1), 60);
  blocked uuid[];
  insider boolean;
begin
  perform private.community_open_to_me(p_community);
  if flt not in ('all', 'recent', 'popular', 'media', 'activities', 'members', 'pinned') then
    raise exception 'filter: all, recent, popular, media, activities, members or pinned' using errcode = '22023';
  end if;
  if char_length(q) < 2 then
    raise exception 'type 2 characters at least to search' using errcode = '22023';
  end if;
  pat := private.ilike_pattern(q);
  blocked := private.my_block_ids();
  insider := private.i_belong(p_community) or private.is_moderator(me);

  return query
  with hits as (
    -- Posts: live, of this community, by nobody blocked either way.
    select p.id, p.author_id, p.body, p.kind as post_kind, p.created_at, p.media_kind, p.media_paths, p.thumb_path
    from public.community_posts p
    where flt in ('all', 'recent', 'popular', 'media', 'pinned')
      and p.community_id = p_community and p.deleted_at is null and p.body ilike pat
      and not (p.author_id = any (blocked))
      and (p_before is null or flt = 'popular' or p.created_at < p_before)
      and (flt <> 'media' or p.media_kind is not null)
      and (flt <> 'pinned' or exists (select 1 from public.community_pins x where x.post_id = p.id
                                      and (x.expires_at is null or x.expires_at > now())))
    order by p.created_at desc
    limit case when flt = 'popular' then 500 else lim end
  ), engaged as (
    select h.id,
      (coalesce(lk.n, 0) + 2 * coalesce(cm.n, 0))::real as n
    from hits h
    left join (select l.target_id, count(*)::int as n from public.likes l
               where flt = 'popular' and l.target_type = 'community_post' and l.target_id in (select h2.id::text from hits h2)
               group by l.target_id) lk on lk.target_id = h.id::text
    left join (select k.target_id, count(*)::int as n from public.comments k
               where flt = 'popular' and k.target_type = 'community_post' and k.deleted_at is null
                 and k.target_id in (select h2.id::text from hits h2)
               group by k.target_id) cm on cm.target_id = h.id::text
  ), posts as (
    -- src: the text the snippet is cut from (the snippet itself comes last).
    select case when flt = 'media' then 'media' when h.post_kind = 'announcement' then 'announcement' else 'post' end as kind,
      h.id, null::text as title, h.body as src, h.author_id,
      h.created_at, h.media_kind, coalesce(h.thumb_path, h.media_paths[1]) as thumb_path,
      case when flt = 'popular' then e.n else similarity(h.body, q) end::real as score,
      null::timestamptz as starts_at
    from hits h join engaged e on e.id = h.id
  ), acts as (
    -- Cheap filters and the sort first; private.activity_readable() then
    -- runs in that order until the page is full.
    select 'activity'::text as kind, a.id, a.title, coalesce(a.description, a.place_name) as src,
      a.creator_id as author_id, a.created_at, null::text as media_kind, a.cover_path as thumb_path,
      similarity(a.title, q)::real as score, a.starts_at
    from (
      select a.id, a.title, a.description, a.place_name, a.creator_id, a.created_at, a.cover_path, a.starts_at
      from public.activities a
      where flt in ('all', 'activities')
        and a.community_id in (select p_community union all
          select s.id from public.communities s where s.parent_id = p_community and s.deleted_at is null)
        and a.title ilike pat and a.cancelled_at is null and a.moderated_at is null
        and (p_before is null or a.created_at < p_before)
      order by a.created_at desc
      offset 0
    ) a
    where private.activity_readable(a.id)
    order by a.created_at desc
    limit lim
  ), people as (
    -- As community_members_list: nobody blocked either way, and outsiders
    -- only see the people whose profile they may see (checked in order,
    -- after the sort, until the page is full).
    select 'member'::text as kind, x.user_id as id, x.first_name as title, x.role as src, x.user_id as author_id,
      x.joined_at as created_at, null::text as media_kind, null::text as thumb_path,
      similarity(x.first_name, q)::real as score, null::timestamptz as starts_at
    from (
      select m.user_id, p.first_name, m.role, m.joined_at
      from public.community_members m
      join public.profiles p on p.id = m.user_id and p.deleted_at is null
      where flt in ('all', 'members')
        and m.community_id = p_community and p.first_name ilike pat
        and (m.user_id = me or not (m.user_id = any (blocked)))
        and (p_before is null or m.joined_at < p_before)
      order by m.joined_at desc
      offset 0
    ) x
    where insider or private.profile_visible_unchecked(me, x.user_id)
    order by x.joined_at desc
    limit lim
  ), page as (
    select r.* from (
      select * from posts union all select * from acts union all select * from people
    ) r
    order by case when flt = 'popular' then r.score end desc nulls last, r.created_at desc, r.id
    limit lim
  )
  -- The names, snippets, pins and going counts of the page only.
  select g.kind, g.id, g.title,
    case when g.kind = 'member' then g.src else private.search_snippet(g.src, q) end,
    g.author_id,
    case when g.kind = 'member' then g.title
      else (select pp.first_name from public.profiles_public pp where pp.id = g.author_id) end,
    g.created_at, g.media_kind, g.thumb_path,
    case g.kind
      when 'member' then false
      when 'activity' then exists (select 1 from public.community_activity_pins x
                                   where x.community_id = p_community and x.activity_id = g.id)
      else exists (select 1 from public.community_pins x where x.post_id = g.id and (x.expires_at is null or x.expires_at > now()))
    end,
    g.score, g.starts_at,
    case when g.kind = 'activity' then private.going_count(g.id) end
  from page g
  order by case when flt = 'popular' then g.score end desc nulls last, g.created_at desc, g.id;
end $$;
revoke all on function public.community_search(uuid, text, text, integer, timestamptz) from public, anon;
grant execute on function public.community_search(uuid, text, text, integer, timestamptz) to authenticated;
