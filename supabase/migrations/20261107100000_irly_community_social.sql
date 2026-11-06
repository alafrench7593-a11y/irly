-- Communities: discovery, members and activity fan-out (2026-11-07).
-- Additive and idempotent: one new table, one new column, new functions, two
-- new triggers, share_to_chat replaced with the same signature. No data is
-- changed or removed; RLS stays on everywhere. Contract:
-- docs/COMMUNITIES-CONTRACT.md, « Migration B ».
--
-- ───────── For the app ─────────
--
--  * public.community_members_list(p_community uuid, p_search text default null,
--      p_limit int default 200, p_offset int default 0)
--      returns table (user_id uuid, name text, role text, joined_at timestamptz)
--    Any member, and anyone who may see the community (not deleted; IRLY Girl
--    access for a girls-only one). Ordered owner, co_admin, moderator,
--    member, then name. Nobody blocked either way, no closed account; a
--    non-member only sees the people whose profile she may see.
--    Errors: 'community not found' (P0002), 'this community is reserved for
--    IRLY Girl' (42501).
--  * public.community_header(p_community uuid) returns jsonb
--      { members, upcoming_activities, faces: [{ user_id, name }] (5 at most), new_members_7d }
--    Same access as the members list; faces follow the same rules.
--  * public.community_directory(p_city text, p_sort text default 'members',
--      p_search text default null, p_limit int default 100)
--      returns table (id, name, tagline, description, emoji, category_id, topic, official, girl_only,
--        members_count, upcoming_count, posts_week, created_at, is_member, is_favorite)
--    Top-level communities of the city's country (p_city null: everywhere).
--    Sorts: 'members' (real member count), 'active' (posts and chat messages
--    of the last 7 days), 'recent' (newest first), 'activities' (upcoming
--    plans). Search: name, tagline, description, category and topic.
--    community_list is unchanged.
--  * public.community_favorites (user_id, community_id, created_at): one's
--    own rows only. public.toggle_community_favorite(p_community uuid)
--    returns boolean (true = now a favourite).
--  * community_notification_prefs.activities (default true): new plans of
--    that community.
--  * A new plan of a community (public or members-only, not cancelled):
--      - its members are told, kind 'ACTIVITY_CREATED', payload { from,
--        activity_id, community_id, community, title, starts_at } (not the
--        organiser, not with activities turned off, nobody blocked either
--        way, IRLY Girl access for a women-only plan, 500 people at most);
--      - ONE activity card is posted in the community chat, by the
--        organiser, as share_to_chat writes it (kind 'share', ref_type
--        'activity'). The chat does not also send « new message » for it.
--    share_to_chat of a plan into a community chat that already has its card
--    answers that card's id (no second card).
--
-- Tests: supabase/tests/community_social.test.sql.

-- ───────── 1. Notification preference for new plans ─────────
alter table public.community_notification_prefs add column if not exists activities boolean not null default true;

-- ───────── 2. Shared helpers ─────────

-- Rank of a community role (owner first). Unknown roles last.
create or replace function private.community_role_order(p_role text) returns integer
language sql immutable set search_path = public as $$
  select case p_role when 'owner' then 0 when 'co_admin' then 1 when 'moderator' then 2 when 'member' then 3 else 4 end
$$;
revoke all on function private.community_role_order(text) from public, anon, authenticated;

-- A search text as an ilike pattern (wildcards typed by the member are
-- literal), or null for no search.
create or replace function private.ilike_pattern(p_search text) returns text
language sql immutable set search_path = public as $$
  select case when nullif(btrim(coalesce(p_search, '')), '') is null then null
    else '%' || replace(replace(replace(left(btrim(p_search), 60), '\', '\\'), '%', '\%'), '_', '\_') || '%' end
$$;
revoke all on function private.ilike_pattern(text) from public, anon, authenticated;

-- Upcoming plans of a community that its page lists: public or members-only,
-- not cancelled, not removed by the team, not started yet.
create or replace function private.community_upcoming_count(cid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.activities a
  where a.community_id = cid and a.cancelled_at is null and a.moderated_at is null
    and a.starts_at > now() and a.privacy in ('public', 'community')
$$;
revoke all on function private.community_upcoming_count(uuid) from public, anon, authenticated;

-- The caller may see this community (as communities_read decides): it
-- exists and, when girls-only, she has IRLY Girl access. Raises otherwise.
create or replace function private.community_open_to_me(cid uuid) returns public.communities
language plpgsql stable security definer set search_path = public as $$
declare
  c public.communities;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into c from public.communities where id = cid and deleted_at is null;
  if not found then raise exception 'community not found' using errcode = 'P0002'; end if;
  if c.girl_only and not private.girl_eligible_unchecked(auth.uid()) then
    raise exception 'this community is reserved for IRLY Girl' using errcode = '42501';
  end if;
  return c;
end $$;
revoke all on function private.community_open_to_me(uuid) from public, anon, authenticated;

-- ───────── 3. Members list ─────────
create or replace function public.community_members_list(p_community uuid, p_search text default null,
  p_limit integer default 200, p_offset integer default 0)
returns table (user_id uuid, name text, role text, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  pat text := private.ilike_pattern(p_search);
  insider boolean;
begin
  perform private.community_open_to_me(p_community);
  -- Members (and IRLY staff) see every member; anyone else, the people whose
  -- profile she may see (profile visibility, as profiles_public).
  insider := private.i_belong(p_community) or private.is_moderator(me);
  return query
    select m.user_id, p.first_name, m.role, m.joined_at
    from public.community_members m
    join public.profiles p on p.id = m.user_id and p.deleted_at is null
    where m.community_id = p_community
      and (pat is null or p.first_name ilike pat)
      and (m.user_id = me or not exists (
        select 1 from public.blocks b
        where (b.blocker_id = me and b.blocked_id = m.user_id) or (b.blocker_id = m.user_id and b.blocked_id = me)))
      and (insider or private.profile_visible_unchecked(me, m.user_id))
    order by private.community_role_order(m.role), p.first_name, m.user_id
    limit least(greatest(coalesce(p_limit, 200), 1), 500)
    offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke all on function public.community_members_list(uuid, text, integer, integer) from public, anon;
grant execute on function public.community_members_list(uuid, text, integer, integer) to authenticated;

-- ───────── 4. Header ─────────
create or replace function public.community_header(p_community uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  faces jsonb;
begin
  perform private.community_open_to_me(p_community);
  select coalesce(jsonb_agg(jsonb_build_object('user_id', f.user_id, 'name', f.name)), '[]'::jsonb) into faces
  from public.community_members_list(p_community, null, 5, 0) f;
  return jsonb_build_object(
    'members', private.community_member_count(p_community),
    'upcoming_activities', private.community_upcoming_count(p_community),
    'faces', faces,
    'new_members_7d', private.community_member_count(p_community, now() - interval '7 days'));
end $$;
revoke all on function public.community_header(uuid) from public, anon;
grant execute on function public.community_header(uuid) to authenticated;

-- ───────── 5. Favourites ─────────
create table if not exists public.community_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, community_id)
);
create index if not exists community_favorites_community_idx on public.community_favorites (community_id);
alter table public.community_favorites enable row level security;
revoke all on public.community_favorites from public, anon;
grant select, insert, delete on public.community_favorites to authenticated;

drop policy if exists community_favorites_read on public.community_favorites;
create policy community_favorites_read on public.community_favorites for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists community_favorites_add on public.community_favorites;
create policy community_favorites_add on public.community_favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.communities c where c.id = community_id and c.deleted_at is null
      and (not c.girl_only or (select private.is_girl_eligible()))));
drop policy if exists community_favorites_remove on public.community_favorites;
create policy community_favorites_remove on public.community_favorites for delete to authenticated
  using (user_id = (select auth.uid()));

-- A suspended or banned member adds none (removing stays open).
drop trigger if exists community_favorites_block_sanctioned on public.community_favorites;
create trigger community_favorites_block_sanctioned before insert on public.community_favorites
  for each row execute function private.block_sanctioned();

create or replace function public.toggle_community_favorite(p_community uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  perform private.community_open_to_me(p_community);
  delete from public.community_favorites where user_id = me and community_id = p_community;
  if found then return false; end if;
  insert into public.community_favorites (user_id, community_id) values (me, p_community) on conflict do nothing;
  return true;
end $$;
revoke all on function public.toggle_community_favorite(uuid) from public, anon;
grant execute on function public.toggle_community_favorite(uuid) to authenticated;

-- ───────── 6. Directory ─────────
create or replace function public.community_directory(p_city text, p_sort text default 'members',
  p_search text default null, p_limit integer default 100)
returns table (id uuid, name text, tagline text, description text, emoji text, category_id text, topic text, official boolean,
  girl_only boolean, members_count integer, upcoming_count integer, posts_week integer, created_at timestamptz,
  is_member boolean, is_favorite boolean)
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
      exists (select 1 from public.community_favorites f where f.community_id = k.id and f.user_id = me)
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

-- ───────── 7. One activity card per plan in a community chat ─────────

-- The card of a plan already in a chat (not deleted), under a lock on that
-- pair so two writers never both post it.
create or replace function private.activity_card_in(conv uuid, aid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  mid uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('activity_card:' || conv::text || ':' || aid::text, 0));
  select m.id into mid from public.messages m
  where m.ref_id = aid and m.conversation_id = conv and m.kind = 'share' and m.ref_type = 'activity' and m.deleted_at is null
  order by m.created_at limit 1;
  return mid;
end $$;
revoke all on function private.activity_card_in(uuid, uuid) from public, anon, authenticated;

-- share_to_chat (last defined in 20261005000600_irly_engage): the same, but a
-- plan shared into a community chat that already shows it gives back that
-- card instead of a second one.
create or replace function public.share_to_chat(p_conversation uuid, p_type text, p_id text, p_title text) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  mid uuid;
begin
  if not private.can_see(p_type, p_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  -- (Read with the caller's own rules: a member of that chat only.)
  if p_type = 'activity' and private.is_uuid(p_id) and private.is_member(p_conversation)
     and exists (select 1 from public.conversations v where v.id = p_conversation and v.community_id is not null) then
    perform pg_advisory_xact_lock(hashtextextended('activity_card:' || p_conversation::text || ':' || p_id::uuid::text, 0));
    select m.id into mid from public.messages m
    where m.ref_id = p_id::uuid and m.conversation_id = p_conversation and m.kind = 'share' and m.ref_type = 'activity'
      and m.deleted_at is null
    order by m.created_at limit 1;
    if mid is not null then return mid; end if;
  end if;
  insert into public.messages (conversation_id, sender_id, kind, body, ref_type, ref_id)
  values (p_conversation, auth.uid(), 'share', left(coalesce(nullif(btrim(p_title), ''), 'Shared with you'), 200), p_type,
    case when private.is_uuid(p_id) then p_id::uuid end)
  returning id into mid;
  insert into public.shares (user_id, target_type, target_id, channel, conversation_id)
  values (auth.uid(), p_type, p_id, 'chat', p_conversation);
  return mid;
end $$;

-- The card the fan-out posts already tells its members (ACTIVITY_CREATED):
-- its « new message » notices are not stored. Only the message named for
-- this transaction is concerned.
create or replace function private.activity_card_quiet() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'MESSAGE_CREATED'
     and new.payload ->> 'message_id' = nullif(current_setting('irly.activity_card', true), '') then
    return null;
  end if;
  return new;
end $$;
revoke all on function private.activity_card_quiet() from public, anon, authenticated;
drop trigger if exists notifications_activity_card on public.notifications;
create trigger notifications_activity_card before insert on public.notifications
  for each row execute function private.activity_card_quiet();

-- ───────── 8. A new plan of a community: its members are told ─────────
create or replace function private.on_community_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c public.communities;
  conv uuid;
  mid uuid;
  cap constant integer := 500;
begin
  -- Plans for everyone or for the community only; friends-only and
  -- invite-only plans stay with their audience.
  if new.community_id is null or new.cancelled_at is not null or new.moderated_at is not null
     or new.privacy not in ('public', 'community')
     or coalesce(new.ends_at, new.starts_at + interval '2 hours') < now() then
    return new;
  end if;
  select * into c from public.communities where id = new.community_id and deleted_at is null;
  if not found then return new; end if;

  -- The notices (muted kinds and blocks are checked again by notifications_filter).
  insert into public.notifications (user_id, kind, payload)
  select r.user_id, 'ACTIVITY_CREATED', jsonb_build_object('from', new.creator_id, 'activity_id', new.id,
    'community_id', c.id, 'community', c.name, 'title', left(new.title, 80), 'starts_at', new.starts_at)
  from (
    select m.user_id from public.community_members m
    join public.profiles p on p.id = m.user_id and p.deleted_at is null
    where m.community_id = c.id and m.user_id <> new.creator_id
      and not exists (select 1 from public.community_notification_prefs np
                      where np.user_id = m.user_id and np.community_id = c.id and not np.activities)
      and not exists (select 1 from public.blocks b
                      where (b.blocker_id = m.user_id and b.blocked_id = new.creator_id)
                         or (b.blocker_id = new.creator_id and b.blocked_id = m.user_id))
      and (not (new.girl_only or c.girl_only) or private.girl_eligible_unchecked(m.user_id))
    order by m.joined_at desc
    limit cap
  ) r;

  -- The card, once, by the organiser when she is in the chat.
  select v.id into conv from public.conversations v where v.community_id = c.id;
  if conv is null
     or not exists (select 1 from public.conversation_members cm where cm.conversation_id = conv and cm.user_id = new.creator_id)
     or (new.girl_only and not private.girl_chat(conv))
     or private.activity_card_in(conv, new.id) is not null then
    return new;
  end if;
  mid := gen_random_uuid();
  begin
    perform set_config('irly.activity_card', mid::text, true);
    insert into public.messages (id, conversation_id, sender_id, kind, body, ref_type, ref_id)
    values (mid, conv, new.creator_id, 'share', left(coalesce(nullif(btrim(new.title), ''), 'Shared with you'), 200), 'activity', new.id);
    perform set_config('irly.activity_card', '', true);
  exception when others then
    -- The plan is published whatever happens to its card (rate limit, guard).
    perform set_config('irly.activity_card', '', true);
  end;
  return new;
end $$;
revoke all on function private.on_community_activity() from public, anon, authenticated;
drop trigger if exists activities_community_fanout on public.activities;
create trigger activities_community_fanout after insert on public.activities
  for each row when (new.community_id is not null) execute function private.on_community_activity();
