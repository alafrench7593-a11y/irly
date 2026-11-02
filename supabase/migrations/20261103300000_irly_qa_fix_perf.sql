-- IRLY QA fixes: performance (qa/perf.md PERF-01, 02, 03, 04, 07, 08 and the
-- server-simulation hotspots). Additive and idempotent: functions are
-- replaced with the same signatures, outputs, ordering and privacy rules;
-- new indexes only. No data is changed.
--
--  PERF-01  community_feed, community_space_feed, comment_thread, girl_feed,
--           for_you_feed, today_activities and help_feed joined the
--           security_barrier view profiles_public. The join condition cannot
--           enter the view, so every call scanned every profile and ran
--           private.profile_visible() on each one, once per post. The author's
--           first name is now read by id with a scalar subquery: the uuid
--           equality is leakproof, so it goes into the view and only that one
--           profile goes through the view's own filter (deleted, blocked,
--           profile_visible). Who is hidden is unchanged: the name is null
--           exactly when the left join found no visible row.
--  PERF-02  ensure_conversation looked the chat up with INSERT … ON CONFLICT
--           DO NOTHING, which waits for every open transaction that updated
--           the chat row (each message does). It now reads first and only
--           inserts when the chat does not exist yet. The members_count
--           trigger of community_members runs at commit (deferred), so a join
--           holds the community row for the commit only.
--  PERF-03  on_message_created updated conversations.last_message_at first
--           and kept that row locked during the whole fan-out. The fan-out is
--           one set-based insert (blocks as an anti-join instead of a plpgsql
--           call per member) and the row is updated last.
--  PERF-07  last_message_at never goes backwards (a send that waited commits
--           with an older created_at).
--  PERF-04  map_activities / people_match / recommend_activities / my_calendar
--           do their cheap set-based filters first and the per-row checks on
--           what is left; indexes for the repeated scans.
--  PERF-08  indexes for the rate-limit counts on likes and comments.

-- ───────── PERF-01: author names by id through profiles_public ─────────

-- Like counts in these feeds (PERF-05 for them): counting under the likes_read
-- rule ran private.can_see(target) once per like row, although every like of
-- one target shares that target. The count the caller could read is: every
-- like of the target when she can see it, else only her own. can_see runs once,
-- as the caller (it reads through her rules); only the total is counted with
-- the definer's rights (like private.save_counts for saves).
create or replace function private.likes_total(p_type text, p_id text)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.likes where target_type = p_type and target_id = p_id
$$;
revoke all on function private.likes_total(text, text) from public, anon;
grant execute on function private.likes_total(text, text) to authenticated;

-- = (select count(*) from public.likes where target_type = p_type and target_id = p_id)
-- read as the caller, under likes_read (user_id = auth.uid() or can_see(target)).
create or replace function private.like_count(p_type text, p_id text)
returns integer language sql stable as $$
  select case when private.can_see(p_type, p_id) then private.likes_total(p_type, p_id)
    else (select count(*)::int from public.likes l
          where l.target_type = p_type and l.target_id = p_id and l.user_id = auth.uid()) end
$$;
revoke all on function private.like_count(text, text) from public, anon;
grant execute on function private.like_count(text, text) to authenticated;

create or replace function public.comment_thread(p_type text, p_id text)
returns table (id uuid, parent_id uuid, author_id uuid, first_name text, body text, created_at timestamptz,
  deleted boolean, likes integer, liked boolean)
language sql stable set search_path = public as $$
  with roots as (
    select c.id from public.comments c
    where c.target_type = p_type and c.target_id = p_id and c.parent_id is null
    order by c.created_at desc
    limit 200
  )
  select c.id, c.parent_id, c.author_id,
    -- By id through the view (its filter applies to this one profile).
    (select pp.first_name from public.profiles_public pp where pp.id = c.author_id),
    case when c.deleted_at is null then c.body else '' end,
    c.created_at, c.deleted_at is not null,
    private.like_count('comment', c.id::text),
    exists (select 1 from public.likes l where l.target_type = 'comment' and l.target_id = c.id::text and l.user_id = auth.uid())
  from public.comments c
  where c.target_type = p_type and c.target_id = p_id
    and (c.id in (select r.id from roots r) or c.parent_id in (select r.id from roots r))
  order by coalesce(c.parent_id, c.id) = c.id desc, c.created_at
  limit 1000
$$;

create or replace function public.community_feed(p_community uuid, p_limit integer default 30, p_before timestamptz default null)
returns table (id uuid, author_id uuid, first_name text, body text, activity_id uuid, activity_title text,
  activity_starts_at timestamptz, poll jsonb, poll_counts integer[], my_vote smallint, likes integer, comments integer,
  liked boolean, created_at timestamptz, mine boolean, media_paths text[], media_kind text, thumb_path text,
  media_seconds integer, edited_at timestamptz, kind text, category text, pinned_at timestamptz)
language sql stable set search_path = public as $$
  select p.id, p.author_id,
    (select pp.first_name from public.profiles_public pp where pp.id = p.author_id),
    p.body, p.activity_id, act.title, act.starts_at, p.poll,
    case when p.poll is null then null else array(
      select (select count(*)::int from public.community_poll_votes v where v.post_id = p.id and v.option = o.i)
      from generate_series(0, jsonb_array_length(p.poll -> 'options') - 1) o (i)
    ) end,
    (select v.option from public.community_poll_votes v where v.post_id = p.id and v.user_id = auth.uid()),
    private.like_count('community_post', p.id::text),
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    p.created_at, p.author_id = auth.uid(),
    p.media_paths, p.media_kind, p.thumb_path, p.media_seconds, p.edited_at,
    p.kind, p.category, pin.pinned_at
  from public.community_posts p
  left join public.activities act on act.id = p.activity_id
  left join public.community_pins pin on pin.post_id = p.id
  where p.community_id = p_community and p.deleted_at is null
    and (p_before is null or p.created_at < p_before)
    -- Pinned posts come first on the first page only.
    and (p_before is null or pin.post_id is null)
  order by (pin.post_id is not null and p_before is null) desc, pin.pinned_at desc nulls last, p.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

create or replace function public.community_space_feed(p_community uuid, p_category text default null, p_limit integer default 30,
  p_before timestamptz default null)
returns table (id uuid, author_id uuid, first_name text, body text, activity_id uuid, activity_title text,
  activity_starts_at timestamptz, poll jsonb, poll_counts integer[], my_vote smallint, likes integer, comments integer,
  liked boolean, created_at timestamptz, mine boolean, media_paths text[], media_kind text, thumb_path text,
  media_seconds integer, edited_at timestamptz, kind text, category text, pinned_at timestamptz)
language sql stable set search_path = public as $$
  select p.id, p.author_id,
    (select pp.first_name from public.profiles_public pp where pp.id = p.author_id),
    p.body, p.activity_id, act.title, act.starts_at, p.poll,
    case when p.poll is null then null else array(
      select (select count(*)::int from public.community_poll_votes v where v.post_id = p.id and v.option = o.i)
      from generate_series(0, jsonb_array_length(p.poll -> 'options') - 1) o (i)
    ) end,
    (select v.option from public.community_poll_votes v where v.post_id = p.id and v.user_id = auth.uid()),
    private.like_count('community_post', p.id::text),
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    p.created_at, p.author_id = auth.uid(),
    p.media_paths, p.media_kind, p.thumb_path, p.media_seconds, p.edited_at,
    p.kind, p.category, pin.pinned_at
  from public.community_posts p
  left join public.activities act on act.id = p.activity_id
  left join public.community_pins pin on pin.post_id = p.id
  where p.community_id = p_community and p.deleted_at is null
    and p.category is not distinct from p_category
    and (p_before is null or p.created_at < p_before)
    and (p_before is null or pin.post_id is null)
  order by (pin.post_id is not null and p_before is null) desc, pin.pinned_at desc nulls last, p.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

create or replace function public.girl_feed(p_city text, p_moms boolean default false, p_limit integer default 30,
  p_before timestamptz default null)
returns table (id uuid, community_id uuid, community_name text, author_id uuid, first_name text, body text,
  activity_id uuid, activity_title text, activity_starts_at timestamptz, likes integer, comments integer, liked boolean,
  created_at timestamptz, mine boolean, is_member boolean, media_paths text[], media_kind text, thumb_path text,
  media_seconds integer)
language plpgsql stable set search_path = public as $$
begin
  if not private.is_girl_eligible(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return query
  select p.id, c.id, c.name, p.author_id,
    (select pp.first_name from public.profiles_public pp where pp.id = p.author_id),
    p.body, p.activity_id, act.title, act.starts_at,
    private.like_count('community_post', p.id::text),
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    p.created_at, p.author_id = auth.uid(),
    exists (select 1 from public.community_members m where m.community_id = c.id and m.user_id = auth.uid()),
    p.media_paths, p.media_kind, p.thumb_path, p.media_seconds
  from public.community_posts p
  join public.communities c on c.id = p.community_id and c.deleted_at is null and c.girl_only
  left join public.activities act on act.id = p.activity_id
  where p.deleted_at is null
    and c.city_id = any (private.city_scope(p_city))
    and (not p_moms or c.category_id = 'family'
      or coalesce(c.topic, (select t.topic from public.communities t where t.id = c.parent_id)) = 'moms')
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 60);
end $$;

create or replace function public.for_you_feed(p_limit integer default 20)
returns table (id uuid, community_id uuid, community_name text, author_id uuid, first_name text, body text, kind text,
  media_paths text[], media_kind text, created_at timestamptz, comments integer, likes integer, liked boolean, why text)
language sql stable set search_path = public as $$
  with mine as (
    select community_id from public.community_members where user_id = auth.uid()
  ), people as (
    select followee_id as uid from public.follows where follower_id = auth.uid()
    union select case when f.user_a = auth.uid() then f.user_b else f.user_a end from public.friendships f
      where f.status = 'accepted' and auth.uid() in (f.user_a, f.user_b)
  )
  select p.id, p.community_id, c.name, p.author_id,
    (select pp.first_name from public.profiles_public pp where pp.id = p.author_id),
    p.body, p.kind, p.media_paths, p.media_kind, p.created_at,
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    private.like_count('community_post', p.id::text),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    case when p.community_id in (select community_id from mine) then 'community' else 'people' end
  from public.community_posts p
  left join public.communities c on c.id = p.community_id
  where p.deleted_at is null and p.author_id <> auth.uid()
    and p.created_at > now() - interval '7 days'
    and (p.community_id in (select community_id from mine) or p.author_id in (select uid from people))
    and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid() and h.target_type = 'community_post' and h.target_id = p.id::text)
  order by (select count(*) from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null) * 2
    + private.like_count('community_post', p.id::text)
    - extract(epoch from now() - p.created_at) / 21600 desc
  limit least(greatest(p_limit, 1), 50)
$$;

create or replace function public.today_activities(p_city text, p_limit integer default 20)
returns table (id uuid, title text, category_id text, starts_at timestamptz, ends_at timestamptz, area_id text,
  place_name text, organizer_id uuid, organizer_name text, going integer, capacity integer, spots_left integer,
  cover_path text, i_go boolean)
language sql stable set search_path = public as $$
  select a.id, a.title, a.category_id, a.starts_at, a.ends_at, a.area_id, a.place_name,
    a.creator_id,
    (select pp.first_name from public.profiles_public pp where pp.id = a.creator_id),
    private.going_count(a.id), a.capacity,
    case when a.capacity is null then null else greatest(a.capacity - private.going_count(a.id), 0) end,
    a.cover_path,
    exists (select 1 from public.activity_participants x where x.activity_id = a.id and x.user_id = auth.uid() and x.status = 'going')
  from public.activities a
  where a.cancelled_at is null
    and a.city_id = any (private.city_scope(p_city))
    and a.starts_at > now() - interval '2 hours'
    -- (Implied by "today in the city's time zone"; bounds the index scan so
    -- only about a day of plans goes through the read rules.)
    and a.starts_at < now() + interval '26 hours'
    and (a.starts_at at time zone private.city_tz(a.city_id))::date = (now() at time zone private.city_tz(a.city_id))::date
  order by a.starts_at
  limit least(greatest(p_limit, 1), 50)
$$;

create or replace function public.help_feed(p_city text, p_category text default null, p_query text default null,
  p_kind text default null, p_limit integer default 40, p_before timestamptz default null)
returns table (id uuid, community_id uuid, category text, category_name text, author_id uuid, first_name text, body text,
  kind text, media_paths text[], media_kind text, thumb_path text, created_at timestamptz, edited_at timestamptz,
  answers integer, likes integer, liked boolean, saved boolean, pinned boolean, mine boolean)
language sql stable set search_path = public as $$
  with words as (
    select w from regexp_split_to_table(lower(btrim(coalesce(p_query, ''))), '\s+') w where char_length(w) >= 2
  )
  select p.id, g.id, g.subtopic, g.name, p.author_id,
    (select pp.first_name from public.profiles_public pp where pp.id = p.author_id),
    p.body, p.kind,
    p.media_paths, p.media_kind, p.thumb_path, p.created_at, p.edited_at,
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    private.like_count('community_post', p.id::text),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    exists (select 1 from public.saves s where s.target_type = 'community_post' and s.target_id = p.id::text and s.user_id = auth.uid()),
    exists (select 1 from public.community_pins x where x.post_id = p.id),
    p.author_id = auth.uid()
  from public.communities h
  join public.communities g on g.parent_id = h.id and g.deleted_at is null
  join public.community_posts p on p.community_id = g.id and p.deleted_at is null
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

-- ───────── PERF-02: joins no longer queue behind the chat's messages ─────────

-- Read first: a plain read never waits on the chat row that a message being
-- sent has just updated, while INSERT … ON CONFLICT waited for that sender to
-- commit. The insert only runs for a chat that does not exist yet (two first
-- joins at once still end with one chat: ON CONFLICT, then read again).
-- An existing chat answers the same as before for a suspended account: the
-- insert's conversations_block_sanctioned trigger refused it, so does this.
create or replace function private.ensure_conversation(p_kind text, p_ref uuid, p_title text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  conv uuid;
begin
  if p_kind = 'activity' then
    select id into conv from public.conversations where activity_id = p_ref;
    if conv is null then
      insert into public.conversations (kind, activity_id, title) values ('activity', p_ref, p_title)
      on conflict (activity_id) do nothing;
      select id into conv from public.conversations where activity_id = p_ref;
      return conv;
    end if;
  elsif p_kind = 'community' then
    select id into conv from public.conversations where community_id = p_ref;
    if conv is null then
      insert into public.conversations (kind, community_id, title) values ('community', p_ref, p_title)
      on conflict (community_id) do nothing;
      select id into conv from public.conversations where community_id = p_ref;
      return conv;
    end if;
  elsif p_kind = 'match' then
    select id into conv from public.conversations where match_id = p_ref;
    if conv is null then
      insert into public.conversations (kind, match_id, title) values ('match', p_ref, p_title)
      on conflict (match_id) do nothing;
      select id into conv from public.conversations where match_id = p_ref;
      return conv;
    end if;
  else
    raise exception 'unsupported conversation kind %', p_kind;
  end if;
  -- (What the skipped insert's conversations_block_sanctioned trigger did.)
  if auth.uid() is not null and private.is_sanctioned(auth.uid()) then
    raise exception 'your account is suspended' using errcode = '42501';
  end if;
  return conv;
end $$;
revoke all on function private.ensure_conversation(text, uuid, text) from public, anon, authenticated;

-- join_activity (latest: 20261027300000_irly_communities_activities.sql), with
-- ACT-05 (qa/activities.md): a leftover 'maybe' / 'not going' row no longer
-- skips the privacy check; only someone already going is let through without it.
create or replace function public.join_activity(p_activity uuid, p_status text default 'going')
returns text language plpgsql security definer set search_path = public as $$
declare
  a public.activities;
  going integer;
  conv uuid;
  me uuid := auth.uid();
  before text;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  perform private.require_profile(me);
  select * into a from public.activities where id = p_activity and cancelled_at is null for update;
  if not found then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  if coalesce(a.ends_at, a.starts_at + interval '2 hours') < now() then
    raise exception 'This activity is over' using errcode = '22023';
  end if;
  if a.girl_only and not private.is_girl_eligible(me) then
    raise exception 'this activity is reserved for IRLY Girl' using errcode = '42501';
  end if;
  if private.is_blocked(me, a.creator_id) then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  select status into before from public.activity_participants where activity_id = p_activity and user_id = me;
  -- Who may join: anyone (public), the creator's friends, the community's
  -- members, or (invite) people it was shared with in a chat they are in.
  -- (ACT-05: a stale 'maybe' or 'not going' row goes through the check too.)
  if a.creator_id <> me and before is distinct from 'going' and not (
    a.privacy = 'public'
    or (a.privacy = 'friends' and private.friends_unchecked(me, a.creator_id))
    -- A member of the community, while it exists (a deleted community has no members to plan for).
    or (a.privacy = 'community' and a.community_id is not null and private.i_belong(a.community_id))
    -- Invite: shared in one of your chats BY the creator or someone going
    -- (anyone can write a message pointing at an id; that is not an invite).
    or (a.privacy = 'invite' and exists (
        select 1 from public.messages msg
        join public.conversation_members cm on cm.conversation_id = msg.conversation_id and cm.user_id = me
        where msg.kind = 'share' and msg.ref_type = 'activity' and msg.ref_id = p_activity and msg.deleted_at is null
          and (msg.sender_id = a.creator_id or exists (
            select 1 from public.activity_participants ap where ap.activity_id = a.id and ap.user_id = msg.sender_id and ap.status = 'going'))))
  ) then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  if p_status = 'going' and a.capacity is not null then
    select count(*) into going from public.activity_participants
    where activity_id = p_activity and status = 'going' and user_id <> me;
    if going >= a.capacity then
      return 'full';
    end if;
  end if;
  insert into public.activity_participants (activity_id, user_id, status) values (p_activity, me, p_status)
  on conflict (activity_id, user_id) do update set status = excluded.status;
  -- (ensure_conversation above: no longer waits for the chat's messages.)
  conv := private.ensure_conversation('activity', p_activity, a.title);
  if p_status = 'going' then
    insert into public.conversation_members (conversation_id, user_id) values (conv, me) on conflict do nothing;
    -- Once per person and activity, however often they switch going/maybe.
    if a.creator_id <> me and not exists (
      select 1 from public.notifications n
      where n.user_id = a.creator_id and n.kind = 'ACTIVITY_JOINED'
        and n.payload ->> 'activity_id' = p_activity::text and n.payload ->> 'user_id' = me::text
    ) then
      perform private.notify(a.creator_id, 'ACTIVITY_JOINED', jsonb_build_object('activity_id', p_activity, 'user_id', me));
    end if;
  else
    delete from public.conversation_members where conversation_id = conv and user_id = me and user_id <> a.creator_id;
  end if;
  return p_status;
end $$;

-- members_count is kept by the same trigger, at commit: a join (or a leave)
-- holds the community row for the commit only, not for the rest of its
-- transaction (chat, official greeting, subgroups, notification).
drop trigger if exists community_members_count on public.community_members;
create constraint trigger community_members_count
  after insert or delete on public.community_members
  deferrable initially deferred
  for each row execute function private.community_members_count();

-- ───────── PERF-03 / PERF-07: message fan-out ─────────

-- The same recipients as before (members of the chat but the sender, not
-- muted, no block either way; the notification triggers still apply each
-- member's preferences and IRLY Girl access), in one set-based insert. The
-- chat row is updated last, so it is locked for the commit only, and
-- last_message_at only moves forward.
create or replace function private.on_message_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sender_id is not null then
    insert into public.notifications (user_id, kind, payload)
    select m.user_id, 'MESSAGE_CREATED', jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id)
    from public.conversation_members m
    where m.conversation_id = new.conversation_id
      and m.user_id <> new.sender_id
      and not m.muted
      -- = private.is_blocked(m.user_id, new.sender_id), as one anti-join.
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = m.user_id and b.blocked_id = new.sender_id)
           or (b.blocker_id = new.sender_id and b.blocked_id = m.user_id));
  end if;
  update public.conversations set last_message_at = new.created_at
  where id = new.conversation_id and (last_message_at is null or last_message_at < new.created_at);
  return new;
end $$;
revoke all on function private.on_message_created() from public, anon, authenticated;

-- ───────── PERF-04: the read rules of plans, posts and comments ─────────

-- The caller's blocks (either way), read once per query instead of once per
-- row: x = any (my_block_ids()) ⇔ private.is_blocked(auth.uid(), x).
-- (Only about the caller, like is_blocked itself.)
create or replace function private.my_block_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(case when b.blocker_id = auth.uid() then b.blocked_id else b.blocker_id end), '{}')
  from public.blocks b
  where b.blocker_id = auth.uid() or b.blocked_id = auth.uid()
$$;
revoke all on function private.my_block_ids() from public, anon;
grant execute on function private.my_block_ids() to authenticated;

-- The plans the caller has a participation row in (any status), read once per
-- query: x in (select my_participations()) ⇔ private.i_participate(x).
create or replace function private.my_participations()
returns setof uuid language sql stable security definer set search_path = public as $$
  select activity_id from public.activity_participants where user_id = auth.uid()
$$;
revoke all on function private.my_participations() from public, anon;
grant execute on function private.my_participations() to authenticated;

-- The rules themselves are kept as they are now (whatever migration last
-- wrote them): only these per-row calls are swapped for their once-per-query
-- equivalents, in the policy's own text. Run again, nothing is left to swap.
do $$
declare
  r record;
  q text;
  n text;
begin
  for r in
    select * from (values
      ('public.activities', 'activities_read'),
      ('public.community_posts', 'community_posts_read'),
      ('public.comments', 'comments_read')) v (tbl, pol)
  loop
    select pg_get_expr(p.polqual, p.polrelid) into q
    from pg_policy p where p.polrelid = r.tbl::regclass and p.polname = r.pol;
    if q is null then
      raise notice 'policy % on % not found: left as is', r.pol, r.tbl;
      continue;
    end if;
    n := q;
    n := replace(n, 'private.is_blocked(auth.uid(), creator_id)',
                    'COALESCE((creator_id = ANY ((SELECT private.my_block_ids() AS my_block_ids)::uuid[])), false)');
    n := replace(n, 'private.is_blocked(auth.uid(), author_id)',
                    'COALESCE((author_id = ANY ((SELECT private.my_block_ids() AS my_block_ids)::uuid[])), false)');
    n := replace(n, 'private.i_participate(id)', '(id IN ( SELECT private.my_participations() AS my_participations))');
    n := replace(n, 'OR private.is_girl_eligible())', 'OR ( SELECT private.is_girl_eligible() AS is_girl_eligible))');
    n := replace(n, '(creator_id = auth.uid())', '(creator_id = ( SELECT auth.uid() AS uid))');
    if n <> q then
      execute format('alter policy %I on %s using (%s)', r.pol, r.tbl, n);
    end if;
  end loop;
end $$;

-- map_activities: the same rows in the same order (starts_at), read a time
-- window at a time and stopped once the page is full, instead of every
-- upcoming plan of the country going through the read rule before the sort.
-- Windows split on starts_at, so putting them one after the other keeps the
-- order.
create or replace function public.map_activities(p_city text, p_from timestamptz default null, p_to timestamptz default null,
  p_category text default null, p_community uuid default null, p_lat double precision default null,
  p_lng double precision default null, p_km double precision default null, p_limit integer default 300,
  p_girl_only boolean default null)
returns table (id uuid, title text, description text, starts_at timestamptz, ends_at timestamptz, place_name text,
  address text, lat double precision, lng double precision, category_id text, community_id uuid, community_name text,
  status text, going integer, capacity integer, distance_km double precision)
language plpgsql stable set search_path = public as $$
declare
  t constant timestamptz := greatest(now(), coalesce(p_from, now()));
  want integer := least(greatest(p_limit, 1), 500);
  lo timestamptz := '-infinity';
  hi timestamptz := t - interval '2 hours';
  step interval := interval '2 days';
  got integer;
begin
  -- The IRLY Girl map: women with IRLY Girl access only (the read rule of
  -- activities already hides every women-only plan from anyone else).
  if p_girl_only and not private.is_girl_eligible() then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  -- First window: started 2 hours ago or more, so only those still running
  -- (ends_at > t, which the shared condition implies for them) can be listed.
  loop
    return query
    select * from (
      select a.id, a.title, a.description, a.starts_at, a.ends_at, a.place_name, coalesce(a.formatted_address, a.address),
        a.lat::double precision, a.lng::double precision, a.category_id, a.community_id, g.name,
        public.activity_status(a.starts_at, a.ends_at, a.cancelled_at),
        -- Exact (security definer count): participants who hide their plans still count, as on the page and in the lists.
        private.going_count(a.id),
        a.capacity,
        case when p_lat is null or p_lng is null then null else
          6371 * 2 * asin(sqrt(power(sin(radians(a.lat::double precision - p_lat) / 2), 2)
            + cos(radians(p_lat)) * cos(radians(a.lat::double precision)) * power(sin(radians(a.lng::double precision - p_lng) / 2), 2))) end as d
      from public.activities a
      left join public.communities g on g.id = a.community_id and g.deleted_at is null
      where a.lat is not null and a.cancelled_at is null
        and a.city_id = any (private.city_scope(p_city))
        and a.starts_at > lo and a.starts_at <= hi
        and (hi > t - interval '2 hours' or a.ends_at > t)
        -- (The same "not over yet" condition as before; t is greatest(now(), coalesce(p_from, now())).)
        and coalesce(a.ends_at, a.starts_at + interval '2 hours') > greatest(now(), coalesce(p_from, now())) and (a.starts_at > greatest(now(), coalesce(p_from, now())) - interval '2 hours' or a.ends_at > greatest(now(), coalesce(p_from, now())))
        and (p_to is null or a.starts_at <= p_to)
        and (p_category is null or a.category_id = p_category)
        and (p_community is null or a.community_id = p_community or g.parent_id = p_community)
        and (p_girl_only is null or a.girl_only = p_girl_only)
    ) x (id, title, description, starts_at, ends_at, place_name, address, lat, lng, category_id, community_id, community_name, status, going, capacity, distance_km)
    where p_km is null or x.distance_km is null or x.distance_km <= p_km
    order by x.starts_at
    limit want;
    get diagnostics got = row_count;
    want := want - got;
    exit when want <= 0 or hi = 'infinity' or (p_to is not null and hi >= p_to);
    lo := hi;
    if hi < t then
      hi := t + step;
    elsif step >= interval '120 days' then
      hi := 'infinity';
    else
      step := step * 4;
      hi := hi + step;
    end if;
  end loop;
end $$;

-- people_match: the same candidates, score and order. Blocks, friendships
-- and skips are anti-joins, the score is computed and sorted first, and the
-- two per-member checks (match_ready, profile visibility) then run on the
-- sorted list only until the page is full; a filter does not change the order.
create or replace function public.people_match(p_city text, p_limit integer default 20, p_offset integer default 0)
returns table (id uuid, first_name text, photo_path text, username text, city_id text, score integer,
  shared_interests text[], shared_activities text[], shared_goals text[], shared_languages text[],
  friend_status text, i_follow boolean)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, p.city_id, p.interests, p.activity_prefs || p.sports as acts, p.intentions, p.languages
    from public.profiles p where p.id = auth.uid() and p.deleted_at is null and private.assert_match_ready()
  ),
  cand as (
    select o.id, o.first_name, o.photo_paths[1] as photo_path, o.username, o.city_id, me.id as me_id,
      array(select unnest(o.interests) intersect select unnest(me.interests)) as si,
      array(select unnest(o.activity_prefs || o.sports) intersect select unnest(me.acts)) as sa,
      array(select unnest(o.intentions) intersect select unnest(me.intentions)) as sg,
      array(select unnest(o.languages) intersect select unnest(me.languages)) as sl,
      o.city_id = me.city_id as same_city
    from public.profiles o, me
    where o.id <> me.id and o.deleted_at is null
      and o.city_id = any (private.city_scope(p_city))
      -- = not private.blocked_unchecked(me.id, o.id)
      and not exists (select 1 from public.blocks b
        where (b.blocker_id = me.id and b.blocked_id = o.id) or (b.blocker_id = o.id and b.blocked_id = me.id))
      -- = not private.friends_unchecked(me.id, o.id)
      and not exists (select 1 from public.friendships f
        where f.user_a = least(me.id, o.id) and f.user_b = greatest(me.id, o.id) and f.status = 'accepted')
      and not exists (select 1 from public.people_match_skips k where k.user_id = me.id and k.other_id = o.id and k.until > now())
  ),
  ranked as (
    select c.*,
      (3 * cardinality(c.si) + 2 * cardinality(c.sa) + 2 * cardinality(c.sg) + cardinality(c.sl) + case when c.same_city then 2 else 0 end)::int as score,
      md5(c.id::text || auth.uid()::text || current_date::text) as tie
    from cand c
    where cardinality(c.si) + cardinality(c.sa) + cardinality(c.sg) > 0
    order by score desc, tie
    offset 0
  )
  select r.id, r.first_name, r.photo_path, r.username, r.city_id, r.score,
    r.si, r.sa, r.sg, r.sl,
    private.friend_status(auth.uid(), r.id),
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = r.id)
  from ranked r
  where private.match_ready(r.id)
    and private.visible_to(r.me_id, r.id, (select s.profile_visibility from public.safety_settings s where s.user_id = r.id))
  order by r.score desc, r.tie
  limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0)
$$;

-- recommend_activities: "not one of mine" read once per query, and the going
-- count once per plan.
create or replace function public.recommend_activities(p_city text, p_limit integer default 20)
returns table (id uuid, title text, format text, category_id text, area_id text, starts_at timestamptz, going integer,
  friends_going integer, score integer, reason text, city_id text)
language sql stable set search_path = public as $$
  with me as (
    select coalesce(p.interests, '{}') || coalesce(p.sports, '{}') || coalesce(p.activity_prefs, '{}') as tastes
    from public.profiles p where p.id = auth.uid()
  ),
  liked_cats as (
    select distinct a.category_id from public.activities a
    join (select target_id from public.likes where user_id = auth.uid() and target_type = 'activity'
          union select target_id from public.saves where user_id = auth.uid() and target_type = 'activity') t
      on t.target_id = a.id::text
  ),
  -- My accepted friends, read once (are_friends(me, x) for each participant before).
  friends as materialized (
    select case when f.user_a = auth.uid() then f.user_b else f.user_a end as id
    from public.friendships f
    where f.status = 'accepted' and (f.user_a = auth.uid() or f.user_b = auth.uid())
  ),
  -- Friends going, per activity: only my friends' participation rows, through their read rule as before.
  friends_in as materialized (
    select x.activity_id, count(*)::int as n
    from public.activity_participants x
    where x.status = 'going' and x.user_id in (select f.id from friends f)
    group by x.activity_id
  ),
  scored as (
    select a.id, a.title, a.format, a.category_id, a.area_id, a.starts_at, a.city_id,
      g.n as going,
      coalesce((select fi.n from friends_in fi where fi.activity_id = a.id), 0) as friends_going,
      (a.category_id = any (coalesce((select tastes from me), '{}'))
        or coalesce(a.sub_id, '') = any (coalesce((select tastes from me), '{}'))
        or coalesce(a.catalog_activity_id, '') = any (coalesce((select tastes from me), '{}'))) as taste,
      a.category_id in (select category_id from liked_cats) as liked_before
    from public.activities a
    cross join lateral (select private.going_count(a.id) as n offset 0) g
    where a.city_id = any (private.city_scope(p_city)) and a.cancelled_at is null
      and a.starts_at between now() and now() + interval '21 days'
      and a.creator_id <> auth.uid()
      -- = not private.i_participate(a.id)
      and a.id not in (select private.my_participations())
      and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid()
        and h.target_type = 'activity' and h.target_id = a.id::text)
      and (a.capacity is null or g.n < a.capacity)
  )
  select s.id, s.title, s.format, s.category_id, s.area_id, s.starts_at, s.going, s.friends_going,
    (case when s.taste then 40 else 0 end + least(s.friends_going, 3) * 15 + case when s.liked_before then 15 else 0 end
      + case when s.starts_at < now() + interval '2 days' then 10 else 0 end + least(s.going, 10)
      + case when s.city_id = p_city then 12 else 0 end)::int,
    case when s.friends_going > 0 then 'friends_going' when s.taste then 'your_interests'
      when s.liked_before then 'you_liked_similar' when s.starts_at < now() + interval '2 days' then 'soon' else 'popular' end,
    s.city_id
  from scored s
  -- (Ties: by id, so the order is the same on every call.)
  order by 9 desc, s.starts_at, s.id
  limit least(greatest(p_limit, 1), 50)
$$;

-- my_calendar: from the caller's own participation rows (a handful), not from
-- every plan in the date range.
create or replace function public.my_calendar(p_from timestamptz default now() - interval '1 day',
  p_to timestamptz default now() + interval '60 days')
returns table (id uuid, title text, format text, category_id text, city_id text, area_id text, place_name text,
  starts_at timestamptz, ends_at timestamptz, timezone text, hosting boolean, conversation_id uuid)
language sql stable set search_path = public as $$
  select a.id, a.title, a.format, a.category_id, a.city_id, a.area_id, a.place_name, a.starts_at, a.ends_at, a.timezone,
    a.creator_id = auth.uid(),
    (select c.id from public.conversations c where c.activity_id = a.id)
  from (select x.activity_id from public.activity_participants x
        where x.user_id = auth.uid() and x.status = 'going' offset 0) x
  join public.activities a on a.id = x.activity_id
  where a.cancelled_at is null and a.starts_at between p_from and p_to
  order by a.starts_at
$$;

-- ───────── Indexes ─────────

-- Newest posts first across communities (girl_feed, for_you_feed).
create index if not exists community_posts_recent_idx on public.community_posts (created_at desc) where deleted_at is null;
-- Discover (activities list, girls-only or not, by start time) can stop at its page.
create index if not exists activities_girl_starts_idx on public.activities (girl_only, starts_at) where cancelled_at is null;
-- PERF-08: rate limits count the last minutes of one member's likes / comments.
create index if not exists likes_user_recent_idx on public.likes (user_id, created_at);
create index if not exists comments_author_recent_idx on public.comments (author_id, created_at);
