-- Community social space, wave 2 (docs/COMMUNITY-SPACE-CONTRACT.md,
-- « Migration F »). Additive and idempotent: new columns, one new table, new
-- functions and triggers; functions replaced keep their outputs (pin_post
-- gains an optional third argument). No row is changed or removed; RLS stays
-- on everywhere.
--
-- ───────── For the app ─────────
--
--  * Comments, likes and poll votes on a community post (and likes on its
--    comments) need a member in good standing of that community: not banned,
--    not restricted. Errors: 'join the community to take part' (42501),
--    'you were banned from this community' (42501), 'you are restricted in
--    this community until …' (42501, hint community_restricted).
--  * public.community_search(p_community uuid, p_query text, p_filter text default 'all',
--      p_limit int default 30, p_before timestamptz default null)
--      returns table (kind text, id uuid, title text, snippet text, author_id uuid, author_name text,
--        created_at timestamptz, media_kind text, thumb_path text, pinned boolean, score real,
--        starts_at timestamptz, going integer)
--    kind: post, announcement, activity, member, media. Filters: all (posts,
--    activities, members, newest first), recent (posts), popular (posts, by
--    likes + 2 × comments), media, activities, members, pinned. p_before:
--    only rows created before it (a member's row: joined before it); the
--    cursor of every filter but popular. score: trigram similarity (popular:
--    the engagement score). thumb_path: post-media for posts and media,
--    activity-photos for activities. starts_at and going: activities only.
--    Errors: 'community not found', 'this community is reserved for IRLY
--    Girl', 'type 2 characters at least to search' (22023), 'filter: all,
--    recent, popular, media, activities, members or pinned' (22023).
--  * public.community_media(p_community uuid, p_before timestamptz default null, p_limit int default 60)
--      returns table (post_id uuid, path text, kind text, thumb_path text, seconds int, author_id uuid,
--        created_at timestamptz, position int)
--    One row per file (position: 1 based, in its post), newest post first. A
--    post is never split across pages: a page holds whole posts, so it can
--    hold up to 9 rows more than p_limit. Next page: p_before = the last
--    row's created_at.
--  * public.community_posts_page(p_community uuid, p_sort text default 'recent',
--      p_before timestamptz default null, p_offset int default 0, p_limit int default 20)
--      the columns of community_feed, then mentions uuid[], pin_expires_at timestamptz.
--    recent: pinned first on the first page (p_before null), then newest
--    first, cursor p_before. popular: (likes + 2 × comments + 1) decayed by
--    age, among the 1000 newest posts, paged by p_offset.
--  * community_pins.expires_at; public.pin_post(p_post uuid, p_on boolean default true,
--      p_until timestamptz default null). An expired pin reads as not pinned
--    everywhere (community_feed included, through the read rule).
--  * public.message_pins (conversation_id, message_id, pinned_by, pinned_at, expires_at),
--    5 at most per chat. public.pin_message(p_message uuid, p_on boolean,
--    p_until timestamptz default null) returns boolean: community chats only,
--    by whoever may moderate it (owner, moderators, co-admins with
--    moderation, IRLY). public.chat_pins(p_conversation uuid) returns table
--    (message_id uuid, body text, sender_id uuid, sender_name text, kind text,
--    pinned_at timestamptz, expires_at timestamptz): members of the chat.
--  * community_posts.mentions uuid[] (10 at most; anyone not a member of the
--    post's community is dropped). The mentioned members are told, kind
--    'MENTION', payload { from, post_id, community_id, community, body,
--    target_type 'community_post', target_id } (no comment_id: that is how a
--    post mention differs from a comment's).
--  * public.comment_mentions(p_ids uuid[]) returns table (comment_id uuid, mentions uuid[]):
--    the mentions of comments (500 ids at most), read under the comments'
--    own rules (comments_read and the IRLY Girl rule); removed ones left out.
--  * communities.rules text (4000 at most). public.community_update_info(p_community uuid,
--      p_name text default null, p_tagline text default null, p_description text default null,
--      p_rules text default null) returns jsonb { name, tagline, description, rules }:
--    null keeps a field, '' clears it (not the name). The owner, a co-admin
--    with settings, or IRLY. An official community keeps IRLY's name and texts.
--
-- Tests: supabase/tests/community_space.test.sql.

-- ───────── 0. Shared helpers ─────────

/** The community of a post, a comment under a post, or a like or vote on them (null: none). */
create or replace function private.engage_community(p_type text, p_id text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  t text := p_type;
  i text := p_id;
begin
  if not private.is_uuid(i) then return null; end if;
  if t = 'comment' then
    select k.target_type, k.target_id into t, i from public.comments k where k.id = i::uuid;
    if not found or not private.is_uuid(i) then return null; end if;
  end if;
  if t <> 'community_post' then return null; end if;
  return (select p.community_id from public.community_posts p where p.id = i::uuid);
end $$;
revoke all on function private.engage_community(text, text) from public, anon, authenticated;

/** The caller may read this activity (as activities_read and its restrictive rules decide). */
create or replace function private.activity_readable(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.activities a
    where a.id = aid and a.moderated_at is null
      and (not a.girl_only or a.creator_id = auth.uid() or private.girl_eligible_unchecked(auth.uid()))
      and (a.creator_id = auth.uid()
        or exists (select 1 from public.activity_participants ap where ap.activity_id = a.id and ap.user_id = auth.uid())
        or (a.cancelled_at is null
          and not private.blocked_unchecked(auth.uid(), a.creator_id)
          and (a.privacy = 'public'
            or (a.privacy = 'community' and a.community_id is not null and private.i_belong(a.community_id))
            or (a.privacy = 'friends' and private.friends_unchecked(auth.uid(), a.creator_id))
            or (a.privacy = 'invite' and private.invited_to(a.id)))))
  )
$$;
revoke all on function private.activity_readable(uuid) from public, anon, authenticated;

/** Up to 160 characters of a text, around the first match of a search. */
create or replace function private.search_snippet(p_body text, p_query text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_body is null then null
    when strpos(lower(p_body), lower(p_query)) <= 60 then left(p_body, 160)
    else '…' || substring(p_body from strpos(lower(p_body), lower(p_query)) - 40 for 160)
  end
$$;
revoke all on function private.search_snippet(text, text) from public, anon, authenticated;

-- ───────── 1. Comments, likes and votes: members in good standing ─────────
-- comments_write, likes_write and poll_votes_write (unchanged) only asked
-- that the post be visible: anyone who could read a community, banned or
-- restricted members included, commented and liked. This guard runs on top of
-- them (and of the IRLY Girl, block, sanction and rate rules, unchanged).
create or replace function private.community_engage_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid;
  cid uuid;
  until timestamptz;
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name = 'comments' then
    actor := new.author_id;
    cid := private.engage_community(new.target_type, new.target_id);
  elsif tg_table_name = 'likes' then
    actor := new.user_id;
    cid := private.engage_community(new.target_type, new.target_id);
  else
    actor := new.user_id;
    cid := (select p.community_id from public.community_posts p where p.id = new.post_id);
  end if;
  if cid is null or actor is null or private.is_admin(auth.uid()) then return new; end if;
  if private.community_banned(cid, actor) then
    raise exception 'you were banned from this community' using errcode = '42501';
  end if;
  if not exists (select 1 from public.community_members m where m.community_id = cid and m.user_id = actor) then
    raise exception 'join the community to take part' using errcode = '42501';
  end if;
  until := private.community_restricted_until(cid, actor);
  if until is not null then
    raise exception 'you are restricted in this community until %', to_char(until at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"')
      using errcode = '42501', hint = 'community_restricted';
  end if;
  return new;
end $$;
revoke all on function private.community_engage_guard() from public, anon, authenticated;
drop trigger if exists comments_community_guard on public.comments;
create trigger comments_community_guard before insert on public.comments
  for each row execute function private.community_engage_guard();
drop trigger if exists likes_community_guard on public.likes;
create trigger likes_community_guard before insert on public.likes
  for each row execute function private.community_engage_guard();
drop trigger if exists community_poll_votes_community_guard on public.community_poll_votes;
create trigger community_poll_votes_community_guard before insert or update on public.community_poll_votes
  for each row execute function private.community_engage_guard();

-- ───────── 2. Search ─────────
-- pg_trgm where Supabase keeps extensions (left where it is if already there).
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

do $$
declare s text;
begin
  select n.nspname into s from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';
  execute format('create index if not exists community_posts_body_trgm on public.community_posts using gin (body %I.gin_trgm_ops) where deleted_at is null', s);
  execute format('create index if not exists activities_title_trgm on public.activities using gin (title %I.gin_trgm_ops)', s);
end $$;

create or replace function public.community_search(p_community uuid, p_query text, p_filter text default 'all',
  p_limit integer default 30, p_before timestamptz default null)
returns table (kind text, id uuid, title text, snippet text, author_id uuid, author_name text, created_at timestamptz,
  media_kind text, thumb_path text, pinned boolean, score real, starts_at timestamptz, going integer)
language plpgsql stable security definer set search_path = public, extensions as $$
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
    select case when flt = 'media' then 'media' when h.post_kind = 'announcement' then 'announcement' else 'post' end as kind,
      h.id, null::text as title, private.search_snippet(h.body, q) as snippet, h.author_id,
      (select pp.first_name from public.profiles_public pp where pp.id = h.author_id) as author_name,
      h.created_at, h.media_kind, coalesce(h.thumb_path, h.media_paths[1]) as thumb_path,
      exists (select 1 from public.community_pins x where x.post_id = h.id and (x.expires_at is null or x.expires_at > now())) as pinned,
      case when flt = 'popular' then e.n else similarity(h.body, q) end::real as score,
      null::timestamptz as starts_at, null::integer as going
    from hits h join engaged e on e.id = h.id
  ), acts as (
    select 'activity'::text as kind, a.id, a.title, private.search_snippet(coalesce(a.description, a.place_name), q),
      a.creator_id, (select pp.first_name from public.profiles_public pp where pp.id = a.creator_id),
      a.created_at, null::text, a.cover_path,
      exists (select 1 from public.community_activity_pins x where x.community_id = p_community and x.activity_id = a.id),
      similarity(a.title, q)::real, a.starts_at, private.going_count(a.id)
    from public.activities a
    where flt in ('all', 'activities')
      and a.community_id in (select p_community union all
        select s.id from public.communities s where s.parent_id = p_community and s.deleted_at is null)
      and a.title ilike pat and a.cancelled_at is null and a.moderated_at is null
      and (p_before is null or a.created_at < p_before)
      and private.activity_readable(a.id)
    order by a.created_at desc
    limit lim
  ), people as (
    -- As community_members_list: nobody blocked either way, and outsiders
    -- only see the people whose profile they may see.
    select 'member'::text as kind, m.user_id, p.first_name, m.role, m.user_id, p.first_name,
      m.joined_at, null::text, null::text, false, similarity(p.first_name, q)::real, null::timestamptz, null::integer
    from public.community_members m
    join public.profiles p on p.id = m.user_id and p.deleted_at is null
    where flt in ('all', 'members')
      and m.community_id = p_community and p.first_name ilike pat
      and (m.user_id = me or not (m.user_id = any (blocked)))
      and (insider or private.profile_visible_unchecked(me, m.user_id))
      and (p_before is null or m.joined_at < p_before)
    order by m.joined_at desc
    limit lim
  )
  select r.* from (
    select * from posts union all select * from acts union all select * from people
  ) r
  order by case when flt = 'popular' then r.score end desc nulls last, r.created_at desc, r.id
  limit lim;
end $$;
revoke all on function public.community_search(uuid, text, text, integer, timestamptz) from public, anon;
grant execute on function public.community_search(uuid, text, text, integer, timestamptz) to authenticated;

-- ───────── 3. Media gallery ─────────
create index if not exists community_posts_media_idx on public.community_posts (community_id, created_at desc)
  where deleted_at is null and media_kind is not null;

create or replace function public.community_media(p_community uuid, p_before timestamptz default null, p_limit integer default 60)
returns table (post_id uuid, path text, kind text, thumb_path text, seconds integer, author_id uuid, created_at timestamptz,
  "position" integer)
language plpgsql stable security definer set search_path = public as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 60), 1), 200);
  blocked uuid[];
begin
  perform private.community_open_to_me(p_community);
  blocked := private.my_block_ids();
  return query
  with posts as (
    select p.id, p.media_paths, p.media_kind, p.thumb_path, p.media_seconds, p.author_id, p.created_at,
      sum(cardinality(p.media_paths)) over (order by p.created_at desc, p.id) as upto
    from (
      select x.* from public.community_posts x
      where x.community_id = p_community and x.deleted_at is null and x.media_kind is not null
        and cardinality(x.media_paths) > 0
        and not (x.author_id = any (blocked))
        and (p_before is null or x.created_at < p_before)
      order by x.created_at desc, x.id
      limit lim
    ) p
  )
  -- Whole posts only: the last one may go past the limit.
  select p.id, f.path, p.media_kind, case when p.media_kind = 'video' then p.thumb_path end,
    case when p.media_kind = 'video' then p.media_seconds end, p.author_id, p.created_at, f.n::int
  from posts p
  cross join lateral unnest(p.media_paths) with ordinality f (path, n)
  where p.upto - cardinality(p.media_paths) < lim
  order by p.created_at desc, p.id, f.n;
end $$;
revoke all on function public.community_media(uuid, timestamptz, integer) from public, anon;
grant execute on function public.community_media(uuid, timestamptz, integer) to authenticated;

-- ───────── 5. Pin expiry (before the page, which reads it) ─────────
alter table public.community_pins add column if not exists expires_at timestamptz;

-- An expired pin reads as no pin, in every feed that reads pins as the
-- caller (community_feed and community_space_feed, untouched).
drop policy if exists community_pins_live on public.community_pins;
create policy community_pins_live on public.community_pins as restrictive for select to authenticated
  using (expires_at is null or expires_at > now());

-- Last defined in 20261103100000_irly_qa_fix_moderation. Same rules, plus an
-- optional end (p_until), the limit counting running pins only, and the
-- community journal. Old calls (one or two arguments) work unchanged.
drop function if exists public.pin_post(uuid, boolean);
create or replace function public.pin_post(p_post uuid, p_on boolean default true, p_until timestamptz default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  gone timestamptz;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select community_id, deleted_at into cid, gone from public.community_posts where id = p_post;
  if cid is null then raise exception 'post not found' using errcode = 'P0002'; end if;
  if not private.moderates(cid) then raise exception 'only moderators can pin' using errcode = '42501'; end if;
  if not p_on then
    delete from public.community_pins where post_id = p_post;
    if found then perform private.community_log(cid, 'post.unpin', null, p_post, null); end if;
    return false;
  end if;
  if gone is not null then raise exception 'post not found' using errcode = 'P0002'; end if;
  if p_until is not null and p_until <= now() then
    raise exception 'the end of a pin is in the future' using errcode = '22023';
  end if;
  if not exists (select 1 from public.community_pins where post_id = p_post and (expires_at is null or expires_at > now()))
     and (select count(*) from public.community_pins x join public.community_posts y on y.id = x.post_id and y.deleted_at is null
          where x.community_id = cid and (x.expires_at is null or x.expires_at > now())) >= 10 then
    raise exception 'unpin a post first: 10 pinned at most' using errcode = 'P0001';
  end if;
  insert into public.community_pins (post_id, community_id, pinned_by, expires_at) values (p_post, cid, auth.uid(), p_until)
  on conflict (post_id) do update set pinned_at = now(), pinned_by = auth.uid(), expires_at = excluded.expires_at;
  perform private.community_log(cid, 'post.pin', null, p_post, null, jsonb_build_object('until', p_until));
  return true;
end $$;
revoke all on function public.pin_post(uuid, boolean, timestamptz) from public, anon;
grant execute on function public.pin_post(uuid, boolean, timestamptz) to authenticated;

-- ───────── 7. Mentions on posts (the column, before the page reads it) ─────────
alter table public.community_posts add column if not exists mentions uuid[] not null default '{}';
alter table public.community_posts drop constraint if exists community_posts_mentions_count;
alter table public.community_posts add constraint community_posts_mentions_count check (cardinality(mentions) <= 10);

-- ───────── 4. Paged and sorted feed ─────────
create or replace function public.community_posts_page(p_community uuid, p_sort text default 'recent',
  p_before timestamptz default null, p_offset integer default 0, p_limit integer default 20)
returns table (id uuid, author_id uuid, first_name text, body text, activity_id uuid, activity_title text,
  activity_starts_at timestamptz, poll jsonb, poll_counts integer[], my_vote smallint, likes integer, comments integer,
  liked boolean, created_at timestamptz, mine boolean, media_paths text[], media_kind text, thumb_path text,
  media_seconds integer, edited_at timestamptz, kind text, category text, pinned_at timestamptz,
  mentions uuid[], pin_expires_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
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
    -- As community_feed: running pins first on the first page only.
    select array_agg(x.id order by x.n) into ids from (
      select p.id, row_number() over (order by (pin.post_id is not null and p_before is null) desc,
        pin.pinned_at desc nulls last, p.created_at desc, p.id) as n
      from public.community_posts p
      left join public.community_pins pin on pin.post_id = p.id and (pin.expires_at is null or pin.expires_at > now())
      where p.community_id = p_community and p.deleted_at is null
        and not (p.author_id = any (blocked))
        and (p_before is null or p.created_at < p_before)
        and (p_before is null or pin.post_id is null)
      order by 2
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

-- ───────── 6. Chat pins ─────────
create table if not exists public.message_pins (
  message_id uuid primary key references public.messages (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  pinned_by uuid references public.profiles (id) on delete set null,
  pinned_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists message_pins_conversation_idx on public.message_pins (conversation_id, pinned_at desc);
alter table public.message_pins enable row level security;
revoke all on public.message_pins from public, anon, authenticated;
grant select on public.message_pins to authenticated;
-- Members of the chat read its running pins; writes go through pin_message.
drop policy if exists message_pins_read on public.message_pins;
create policy message_pins_read on public.message_pins for select to authenticated
  using (private.is_member(conversation_id) and (expires_at is null or expires_at > now()));

-- A suspended or banned moderator pins nothing (unpinning stays open).
drop trigger if exists message_pins_block_sanctioned on public.message_pins;
create trigger message_pins_block_sanctioned before insert on public.message_pins
  for each row execute function private.block_sanctioned();

create or replace function public.pin_message(p_message uuid, p_on boolean, p_until timestamptz default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  msg public.messages;
  cid uuid;
  r jsonb;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into msg from public.messages where id = p_message;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  select v.community_id into cid from public.conversations v where v.id = msg.conversation_id and v.kind = 'community';
  if cid is null then raise exception 'only messages of a community chat' using errcode = '42501'; end if;
  r := private.community_act(cid);
  if not coalesce((r ->> 'can_moderate')::boolean, false) then
    raise exception 'only the community''s moderators can do this' using errcode = '42501';
  end if;
  if not coalesce(p_on, false) then
    delete from public.message_pins where message_id = p_message;
    if found then
      perform private.community_log(cid, 'message.unpin', msg.sender_id, p_message, null,
        jsonb_build_object('conversation_id', msg.conversation_id));
    end if;
    return false;
  end if;
  if msg.deleted_at is not null then raise exception 'not found' using errcode = 'P0002'; end if;
  if p_until is not null and p_until <= now() then
    raise exception 'the end of a pin is in the future' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('message_pins:' || msg.conversation_id::text, 0));
  if not exists (select 1 from public.message_pins where message_id = p_message and (expires_at is null or expires_at > now()))
     and (select count(*) from public.message_pins x join public.messages y on y.id = x.message_id and y.deleted_at is null
          where x.conversation_id = msg.conversation_id and (x.expires_at is null or x.expires_at > now())) >= 5 then
    raise exception 'unpin a message first: 5 pinned at most' using errcode = 'P0001';
  end if;
  insert into public.message_pins (message_id, conversation_id, pinned_by, expires_at)
  values (p_message, msg.conversation_id, auth.uid(), p_until)
  on conflict (message_id) do update set pinned_at = now(), pinned_by = auth.uid(), expires_at = excluded.expires_at;
  perform private.community_log(cid, 'message.pin', msg.sender_id, p_message, null,
    jsonb_build_object('conversation_id', msg.conversation_id, 'until', p_until));
  return true;
end $$;
revoke all on function public.pin_message(uuid, boolean, timestamptz) from public, anon;
grant execute on function public.pin_message(uuid, boolean, timestamptz) to authenticated;

create or replace function public.chat_pins(p_conversation uuid)
returns table (message_id uuid, body text, sender_id uuid, sender_name text, kind text, pinned_at timestamptz,
  expires_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if not private.is_member(p_conversation, me) then raise exception 'not a member' using errcode = '42501'; end if;
  select v.community_id into cid from public.conversations v where v.id = p_conversation;
  if (private.girl_chat(p_conversation) and not private.girl_eligible_unchecked(me))
     or (cid is not null and private.community_banned(cid, me)) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  return query
    select x.message_id, m.body, m.sender_id,
      (select pp.first_name from public.profiles_public pp where pp.id = m.sender_id),
      m.kind, x.pinned_at, x.expires_at
    from public.message_pins x
    join public.messages m on m.id = x.message_id and m.deleted_at is null
    where x.conversation_id = p_conversation and (x.expires_at is null or x.expires_at > now())
      and (m.sender_id is null or not private.blocked_unchecked(me, m.sender_id))
    order by x.pinned_at desc
    limit 5;
end $$;
revoke all on function public.chat_pins(uuid) from public, anon;
grant execute on function public.chat_pins(uuid) to authenticated;

-- ───────── 7. Mentions on posts ─────────
-- Each person once, 10 at most; anyone not a member of the post's community
-- (or no community: a profile post) is dropped without a word.
create or replace function private.community_post_mentions_clean() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ids uuid[];
begin
  select coalesce(array_agg(distinct x), '{}') into ids from unnest(coalesce(new.mentions, '{}')) x where x is not null;
  if cardinality(ids) > 10 then
    raise exception 'mention 10 people at most' using errcode = '22023';
  end if;
  new.mentions := case when new.community_id is null then '{}'::uuid[] else array(
    select x from unnest(ids) x
    where exists (select 1 from public.community_members m join public.profiles p on p.id = m.user_id and p.deleted_at is null
                  where m.community_id = new.community_id and m.user_id = x)
    order by x) end;
  return new;
end $$;
revoke all on function private.community_post_mentions_clean() from public, anon, authenticated;
drop trigger if exists community_posts_mentions_clean on public.community_posts;
create trigger community_posts_mentions_clean before insert or update of mentions on public.community_posts
  for each row execute function private.community_post_mentions_clean();

-- The mentioned members hear it (new ones only on an edit): not the author,
-- nobody blocked either way, not banned, IRLY Girl access for a women-only
-- community.
create or replace function private.on_community_post_mention() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  added uuid[];
begin
  if new.community_id is null or new.deleted_at is not null or cardinality(new.mentions) = 0 then return null; end if;
  added := case when tg_op = 'INSERT' then new.mentions
    else array(select x from unnest(new.mentions) x where not x = any (old.mentions)) end;
  if cardinality(added) = 0 then return null; end if;
  insert into public.notifications (user_id, kind, payload)
  -- target_type and target_id: as a comment's mention (notification_visible reads them).
  select m.user_id, 'MENTION', jsonb_build_object('from', new.author_id, 'post_id', new.id, 'community_id', c.id,
    'community', c.name, 'body', left(new.body, 80), 'target_type', 'community_post', 'target_id', new.id::text)
  from public.community_members m
  join public.communities c on c.id = m.community_id and c.deleted_at is null
  join public.profiles p on p.id = m.user_id and p.deleted_at is null
  where m.community_id = new.community_id and m.user_id = any (added) and m.user_id <> new.author_id
    and not private.blocked_unchecked(m.user_id, new.author_id)
    and not private.community_banned(c.id, m.user_id)
    and (not c.girl_only or private.girl_eligible_unchecked(m.user_id));
  return null;
end $$;
revoke all on function private.on_community_post_mention() from public, anon, authenticated;
drop trigger if exists community_posts_mentioned on public.community_posts;
create trigger community_posts_mentioned after insert or update of mentions on public.community_posts
  for each row execute function private.on_community_post_mention();

-- The mentions of comments, for comment_thread (untouched), read as the caller.
create or replace function public.comment_mentions(p_ids uuid[])
returns table (comment_id uuid, mentions uuid[])
language sql stable security invoker set search_path = public as $$
  select c.id, c.mentions from public.comments c
  where c.id = any (p_ids[1:500]) and c.deleted_at is null
$$;
revoke all on function public.comment_mentions(uuid[]) from public, anon;
grant execute on function public.comment_mentions(uuid[]) to authenticated;

-- ───────── 8. Rules and the owner's info ─────────
alter table public.communities add column if not exists rules text;
alter table public.communities drop constraint if exists communities_rules_len;
alter table public.communities add constraint communities_rules_len check (rules is null or char_length(rules) <= 4000);

-- Same limits as 20261020001300_irly_push_and_security, plus the rules.
drop trigger if exists communities_text_limits on public.communities;
create trigger communities_text_limits before insert or update on public.communities
for each row execute function private.text_limits('tagline:160', 'description:2000', 'emoji:16', 'rules:4000');

-- Same columns as 20261027200000_irly_admin_console, plus the rules.
drop trigger if exists communities_block_sanctioned_edit on public.communities;
create trigger communities_block_sanctioned_edit before update of name, tagline, description, cover_path, rules on public.communities
  for each row execute function private.block_sanctioned_edit('name', 'tagline', 'description', 'cover_path', 'rules');

create or replace function public.community_update_info(p_community uuid, p_name text default null, p_tagline text default null,
  p_description text default null, p_rules text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  c public.communities;
  v_name text;
  v_tagline text;
  v_description text;
  v_rules text;
  changed text[] := '{}';
begin
  r := private.community_act(p_community);
  if not coalesce((r ->> 'can_settings')::boolean, false) then
    raise exception 'only the owner or a co-admin in charge of settings can edit the community' using errcode = '42501';
  end if;
  select * into c from public.communities where id = p_community for update;
  v_name := coalesce(btrim(p_name), c.name);
  v_tagline := case when p_tagline is null then c.tagline else nullif(btrim(p_tagline), '') end;
  v_description := case when p_description is null then c.description else nullif(btrim(p_description), '') end;
  v_rules := case when p_rules is null then c.rules else nullif(btrim(p_rules), '') end;
  if char_length(v_name) not between 3 and 60 then
    raise exception 'a name has 3 to 60 characters' using errcode = '22023';
  end if;
  if v_rules is not null and char_length(v_rules) > 4000 then
    raise exception 'rules have 4000 characters at most' using errcode = '22023';
  end if;
  -- IRLY's official communities: the name and texts are IRLY's (admin_official_texts).
  if c.official and c.topic is not null and c.parent_id is null then
    if v_name is distinct from c.name then
      raise exception 'the names of IRLY''s official communities are fixed' using errcode = '22023';
    end if;
    if v_tagline is distinct from c.tagline or v_description is distinct from c.description then
      raise exception 'the texts of IRLY''s official communities are set by IRLY' using errcode = '22023';
    end if;
  end if;
  if v_name is distinct from c.name then changed := array_append(changed, 'name'); end if;
  if v_tagline is distinct from c.tagline then changed := array_append(changed, 'tagline'); end if;
  if v_description is distinct from c.description then changed := array_append(changed, 'description'); end if;
  if v_rules is distinct from c.rules then changed := array_append(changed, 'rules'); end if;
  if cardinality(changed) > 0 then
    -- Through the table's own guards (reserved names, text limits, sanctions).
    update public.communities set name = v_name, tagline = v_tagline, description = v_description, rules = v_rules
    where id = p_community;
    perform private.community_log(p_community, 'community.edit', null, p_community, null,
      jsonb_build_object('fields', to_jsonb(changed)));
  end if;
  return jsonb_build_object('name', v_name, 'tagline', v_tagline, 'description', v_description, 'rules', v_rules);
end $$;
revoke all on function public.community_update_info(uuid, text, text, text, text) from public, anon;
grant execute on function public.community_update_info(uuid, text, text, text, text) to authenticated;

-- ───────── 9. Scale ─────────
-- Last defined in 20261018000100_irly_community_groups. The same notice, to
-- 500 members at most (as the activity fan-out), counted after what would
-- drop them anyway: posts turned off, blocks, IRLY Girl access, the people
-- the post mentions (they get MENTION instead).
create or replace function private.on_community_post() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c public.communities;
  cap constant integer := 500;
begin
  if new.community_id is null or new.kind = 'announcement' then return new; end if;
  select * into c from public.communities where id = new.community_id;
  if not found then return new; end if;
  insert into public.notifications (user_id, kind, payload)
  select r.user_id, 'COMMUNITY_POST',
    jsonb_build_object('from', new.author_id, 'community_id', new.community_id, 'post_id', new.id, 'community', c.name, 'body', left(new.body, 80))
  from (
    select m.user_id from public.community_members m
    join public.profiles p on p.id = m.user_id and p.deleted_at is null
    where m.community_id = new.community_id and m.user_id <> new.author_id
      and not (m.user_id = any (coalesce(new.mentions, '{}')))
      and not exists (select 1 from public.community_notification_prefs np
                      where np.user_id = m.user_id and np.community_id = c.id and not np.posts)
      and not exists (select 1 from public.blocks b
                      where (b.blocker_id = m.user_id and b.blocked_id = new.author_id)
                         or (b.blocker_id = new.author_id and b.blocked_id = m.user_id))
      and (not c.girl_only or private.girl_eligible_unchecked(m.user_id))
    order by m.joined_at desc
    limit cap
  ) r;
  return new;
end $$;

-- A removed post's files go to the storage purge (as a removed plan's,
-- 20261103400000), unless the post is reported or held by the IRLY team:
-- the team may need them, and a hold can be lifted.
create or replace function private.community_post_files_gone() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  p public.community_posts;
  f text;
begin
  if tg_op = 'DELETE' then
    p := old;
  elsif old.deleted_at is null and new.deleted_at is not null then
    p := new;
  else
    return null;
  end if;
  if exists (select 1 from public.reports r where r.target_kind = 'community_post' and r.target_id = p.id)
     or private.is_held('community_post', p.id) then
    return null;
  end if;
  foreach f in array p.media_paths || coalesce(p.thumb_path, '') loop
    perform private.queue_removed_file('post-media', nullif(f, ''));
  end loop;
  return null;
end $$;
revoke all on function private.community_post_files_gone() from public, anon, authenticated;
drop trigger if exists community_posts_queue_files on public.community_posts;
create trigger community_posts_queue_files after update of deleted_at or delete on public.community_posts
  for each row execute function private.community_post_files_gone();

create index if not exists community_posts_media_paths_gin on public.community_posts using gin (media_paths);
create index if not exists community_posts_thumb_path_idx on public.community_posts (thumb_path) where thumb_path is not null;

-- Last defined in 20261027700000_irly_admin_photos. A post-media file is in
-- use while a live post shows it, or a removed one the team may still need
-- (reported, or held: a hold the team set after the removal is seen when the
-- purge claims the file). Every other bucket is unchanged.
create or replace function private.photo_in_use(p_bucket text, p_name text) returns boolean
language plpgsql stable security definer set search_path = public, private as $$
begin
  if p_name is null then return false; end if;
  return case p_bucket
    when 'activity-photos' then
      exists (select 1 from public.communities where cover_path = p_name)
      or exists (select 1 from public.activities where cover_path = p_name)
      or exists (select 1 from public.conversations where photo_path = p_name)
    when 'app-photos' then exists (select 1 from public.app_photo_overrides where storage_path = p_name)
    when 'profile-photos' then
      exists (select 1 from public.profiles p, unnest(p.photo_paths) x where p_name in (x, private.photo_thumb(x)))
    when 'match-photos' then exists (select 1 from public.irly_match_profiles where p_name = any (photo_paths))
    when 'post-media' then exists (
      select 1 from public.community_posts p
      where (p.media_paths @> array[p_name] or p.thumb_path = p_name)
        and (p.deleted_at is null or private.is_held('community_post', p.id)
          or exists (select 1 from public.reports r where r.target_kind = 'community_post' and r.target_id = p.id)))
    when 'irl-media' then exists (select 1 from public.irl_posts where media_path = p_name or thumb_path = p_name)
    when 'chat-media' then exists (select 1 from public.messages where media_path = p_name)
    else true
  end;
end $$;
revoke all on function private.photo_in_use(text, text) from public, anon, authenticated;

-- ───────── 10. Push texts ─────────
-- Last defined in 20261107200000_irly_community_push_texts. A mention in a
-- community post opens that community, under its name; every other kind is
-- unchanged.
create or replace function private.push_text(n public.notifications, lang text, out title text, out body text, out url text)
language plpgsql stable security definer set search_path = public as $$
declare
  fr boolean := lang = 'fr';
  who text;
  someone text := case when lang = 'fr' then 'Quelqu’un' else 'Someone' end;
  msg record;
begin
  select first_name into who from public.profiles where id = private.uuid_or_null(coalesce(n.payload ->> 'from', n.payload ->> 'user_id'));
  url := '/notifications';
  case n.kind
    when 'MESSAGE_CREATED' then
      select m.body, m.kind, p.first_name, c.title as conv into msg
      from public.messages m left join public.profiles p on p.id = m.sender_id left join public.conversations c on c.id = m.conversation_id
      where m.id = private.uuid_or_null(n.payload ->> 'message_id');
      title := coalesce(nullif(msg.conv, ''), msg.first_name, 'IRLY');
      body := case
        when msg.kind = 'photo' then coalesce(msg.first_name || ': ', '') || case when fr then '📷 Photo' else '📷 Photo' end
        when msg.body is not null then coalesce(case when msg.conv is not null then msg.first_name || ': ' end, '') || left(msg.body, 120)
        else case when fr then 'Nouveau message' else 'New message' end end;
      url := '/messages/' || coalesce(n.payload ->> 'conversation_id', '');
    when 'PRO_CONNECT_REQUEST' then
      title := 'Networking';
      body := coalesce(who, someone) || case when fr then ' veut entrer en contact avec toi' else ' wants to connect with you' end;
      url := '/network/' || (n.payload ->> 'from');
    when 'PRO_CONNECT_ACCEPTED' then
      title := 'Networking';
      body := coalesce(who, someone) || case when fr then ' a accepté ta demande. Écris-lui !' else ' accepted your request. Say hi!' end;
      url := '/network/' || (n.payload ->> 'from');
    when 'FRIEND_REQUEST' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' veut être ton ami·e' else ' wants to be friends' end;
    when 'FRIEND_ACCEPTED' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' a accepté ta demande' else ' accepted your request' end;
    when 'PROFILE_UPDATED' then
      title := 'IRLY';
      body := case n.payload ->> 'type'
        when 'friend_request' then coalesce(who, someone) || case when fr then ' veut être ton ami·e' else ' wants to be friends' end
        when 'friend_accepted' then coalesce(who, someone) || case when fr then ' a accepté ta demande' else ' accepted your request' end
        when 'verified' then case when fr then 'Ton profil est vérifié ✓ Match est ouvert.' else 'Your profile is verified ✓ Match is open.' end
        when 'verification_rejected' then case when fr then 'Vérification refusée' else 'Verification declined' end
          || coalesce(': ' || (n.payload ->> 'reason'), case when fr then '. Tu peux réessayer.' else '. You can try again.' end)
        else case when fr then 'Ton profil a été mis à jour' else 'Your profile was updated' end end;
    when 'MATCH_CREATED' then
      title := 'IRLY Girl';
      body := case when fr then 'C’est un match ! Dis bonjour 👋' else 'It’s a match! Say hello 👋' end;
      url := case when n.payload ? 'conversation_id' then '/messages/' || (n.payload ->> 'conversation_id') else '/girl' end;
    when 'ACTIVITY_JOINED' then
      title := 'IRLY';
      body := case when fr then 'Quelqu’un a rejoint ton activité' else 'Someone joined your activity' end;
      url := case when n.payload ? 'activity_id' then '/a/' || (n.payload ->> 'activity_id') else '/notifications' end;
    when 'ACTIVITY_UPDATED' then
      title := 'IRLY';
      body := case when fr then 'Une activité de ton agenda a changé' else 'An activity in your calendar changed' end;
      url := case when n.payload ? 'activity_id' then '/a/' || (n.payload ->> 'activity_id') else '/calendar' end;
    when 'ACTIVITY_REMINDER' then
      title := 'IRLY';
      body := case when fr then 'Ton activité commence bientôt' else 'Your activity starts soon' end;
      url := case when n.payload ? 'activity_id' then '/a/' || (n.payload ->> 'activity_id') else '/calendar' end;
    when 'LIKE' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' a aimé ta publication' else ' liked your post' end;
    when 'COMMENT', 'COMMENT_REPLY', 'MENTION' then
      title := 'IRLY';
      body := coalesce(who, someone) || case n.kind
        when 'COMMENT' then case when fr then ' a commenté' else ' commented' end
        when 'COMMENT_REPLY' then case when fr then ' t’a répondu' else ' replied to you' end
        else case when fr then ' t’a mentionné·e' else ' mentioned you' end end
        || coalesce(': ' || left(n.payload ->> 'body', 100), '');
      -- A mention in a community post (not in a comment).
      if n.kind = 'MENTION' and n.payload ? 'post_id' and n.payload ? 'community_id' and not n.payload ? 'comment_id' then
        title := coalesce(nullif(n.payload ->> 'community', ''), 'IRLY');
        body := coalesce(who, someone) || case when fr then ' t’a mentionné·e dans une publication' else ' mentioned you in a post' end
          || coalesce(': ' || left(n.payload ->> 'body', 100), '');
        url := '/c/' || (n.payload ->> 'community_id');
      end if;
    when 'IRLY_POST_CREATED' then
      title := 'IRL';
      body := coalesce(who, case when fr then 'Un·e ami·e' else 'A friend' end) || case when fr then ' est en live' else ' is live' end;
      url := '/live';
    when 'COMMUNITY_JOINED' then
      title := 'IRLY';
      body := case when fr then 'Tu as rejoint une communauté. Son chat est dans Messages.' else 'You joined a community. Its chat is in Messages.' end;
      url := case when n.payload ? 'conversation_id' then '/messages/' || (n.payload ->> 'conversation_id') else '/messages' end;
    when 'ACTIVITY_CREATED' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := coalesce(who, someone) || case when fr then ' propose : ' else ' proposes: ' end || coalesce(left(n.payload ->> 'title', 100), case when fr then 'une activité' else 'an activity' end);
      url := case when n.payload ? 'activity_id' then '/a/' || (n.payload ->> 'activity_id') else '/notifications' end;
    when 'COMMUNITY_ROLE' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := case n.payload ->> 'role'
        when 'co_admin' then case when fr then 'Tu es maintenant co-administrateur·rice de cette communauté' else 'You are now a co-admin of this community' end
        when 'moderator' then case when fr then 'Tu es maintenant modérateur·rice de cette communauté' else 'You are now a moderator of this community' end
        else case when fr then 'Ton rôle dans cette communauté a changé' else 'Your role in this community changed' end end;
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    when 'COMMUNITY_OWNERSHIP' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := case when fr then 'Tu es maintenant le ou la propriétaire de cette communauté' else 'You are now the owner of this community' end;
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    when 'COMMUNITY_WARNING' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := case when fr then 'Avertissement de la modération' else 'A warning from the moderators' end || coalesce(': ' || left(n.payload ->> 'reason', 100), '');
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    when 'COMMUNITY_RESTRICTION' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := case when fr then 'Tu ne peux plus publier dans cette communauté pour le moment' else 'You cannot post in this community for now' end || coalesce(': ' || left(n.payload ->> 'reason', 100), '');
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    when 'COMMUNITY_BAN' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := case when fr then 'Tu as été exclu·e de cette communauté' else 'You were banned from this community' end || coalesce(': ' || left(n.payload ->> 'reason', 100), '');
      url := '/notifications';
    when 'NEW_FOLLOWER' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' s’est abonné·e à toi' else ' started following you' end;
      url := case when n.payload ? 'from' then '/person/' || (n.payload ->> 'from') else '/notifications' end;
    when 'GROUP_ADDED' then
      title := coalesce(nullif(n.payload ->> 'title', ''), 'IRLY');
      body := coalesce(who, someone) || case when fr then ' t’a ajouté·e au groupe' else ' added you to the group' end;
      url := case when n.payload ? 'conversation_id' then '/messages/' || (n.payload ->> 'conversation_id') else '/messages' end;
    when 'COMMUNITY_POST' then
      title := coalesce(nullif(n.payload ->> 'community', ''), 'IRLY');
      body := coalesce(who, someone) || ': ' || coalesce(left(n.payload ->> 'body', 100), case when fr then 'nouvelle publication' else 'new post' end);
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    when 'COMMUNITY_ANNOUNCEMENT' then
      title := '📣 ' || coalesce(nullif(n.payload ->> 'community', ''), 'IRLY');
      body := coalesce(left(n.payload ->> 'body', 140), case when fr then 'Nouvelle annonce' else 'New announcement' end);
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    else
      title := 'IRLY';
      body := case when fr then 'Tu as une nouvelle notification' else 'You have a new notification' end;
  end case;
end $$;
revoke all on function private.push_text(public.notifications, text) from public, anon, authenticated;
