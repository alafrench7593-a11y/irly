-- Private messaging audit (supabase/tests/messaging_audit.test.sql).
--
-- A. open_direct: a member whose account is closed (or never existed) is "not
--    available" (as create_group already says), and when old data holds two
--    chats for the same pair the oldest is always the one opened.
-- B. One chat per pair, enforced by the database too: a private chat has at
--    most two members, and a second private chat for the same two people is
--    refused (same pair lock as open_direct, so simultaneous inserts wait).
-- C. A chat's context matches its kind: a community chat has its community, an
--    activity chat its activity, and no other kind carries either (a match id
--    only on a Match chat). Added NOT VALID (new rows are checked at once), then
--    validated when the existing rows allow it; otherwise the conflicts are
--    reported and nothing is deleted.
-- Additive only: no row is changed or removed.

-- ───────── A. open_direct ─────────
create or replace function public.open_direct(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_user is null or p_user = me or private.blocked_unchecked(me, p_user)
     or not exists (select 1 from public.profiles where id = p_user and deleted_at is null) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  -- one chat per pair, even when both open it at the same time
  perform pg_advisory_xact_lock(hashtextextended(least(me, p_user)::text || greatest(me, p_user)::text, 0));
  select c.id into conv from public.conversations c
  where c.kind = 'direct'
    and exists (select 1 from public.conversation_members where conversation_id = c.id and user_id = me)
    and exists (select 1 from public.conversation_members where conversation_id = c.id and user_id = p_user)
  order by c.created_at, c.id
  limit 1;
  if conv is null and not private.may_message(p_user) then
    raise exception 'this member does not accept new messages from you' using errcode = '42501';
  end if;
  if conv is null then
    insert into public.conversations (kind) values ('direct') returning id into conv;
    insert into public.conversation_members (conversation_id, user_id) values (conv, me), (conv, p_user);
  end if;
  return conv;
end $$;
revoke all on function public.open_direct(uuid) from public, anon;
grant execute on function public.open_direct(uuid) to authenticated;

-- ───────── B. One private chat per pair ─────────
create or replace function private.direct_pair_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  members uuid[];
begin
  if not exists (select 1 from public.conversations where id = new.conversation_id and kind = 'direct') then
    return null;
  end if;
  select array_agg(user_id order by user_id) into members from public.conversation_members where conversation_id = new.conversation_id;
  if cardinality(members) > 2 then
    raise exception 'a private chat has two members' using errcode = '23514';
  end if;
  if cardinality(members) < 2 then return null; end if;
  -- The same lock as open_direct: a second chat for this pair waits for the first to commit, then sees it.
  perform pg_advisory_xact_lock(hashtextextended(members[1]::text || members[2]::text, 0));
  if exists (
    select 1 from public.conversations c
    where c.kind = 'direct' and c.id <> new.conversation_id
      and exists (select 1 from public.conversation_members x where x.conversation_id = c.id and x.user_id = members[1])
      and exists (select 1 from public.conversation_members x where x.conversation_id = c.id and x.user_id = members[2])
  ) then
    raise exception 'these two members already have a private chat' using errcode = '23505';
  end if;
  return null;
end $$;
revoke all on function private.direct_pair_guard() from public, anon, authenticated;
drop trigger if exists conversation_members_direct_pair on public.conversation_members;
create trigger conversation_members_direct_pair after insert on public.conversation_members
  for each row execute function private.direct_pair_guard();

-- Pairs that already have more than one private chat: reported, never merged or deleted here.
do $$
declare
  n integer;
begin
  select count(*) into n from (
    select least(a.user_id, b.user_id), greatest(a.user_id, b.user_id)
    from public.conversations c
    join public.conversation_members a on a.conversation_id = c.id
    join public.conversation_members b on b.conversation_id = c.id and b.user_id > a.user_id
    where c.kind = 'direct'
    group by 1, 2 having count(distinct c.id) > 1
  ) d;
  if n > 0 then
    raise notice 'messaging audit: % pair(s) have more than one private chat (kept; open_direct opens the oldest)', n;
  end if;
end $$;

-- ───────── C. A chat's context matches its kind ─────────
alter table public.conversations drop constraint if exists conversations_context_shape;
alter table public.conversations add constraint conversations_context_shape check (
  (kind = 'community') = (community_id is not null)
  and (kind = 'activity') = (activity_id is not null)
  and (match_id is null or kind = 'match')
) not valid;
do $$
declare
  n integer;
begin
  select count(*) into n from public.conversations
  where not ((kind = 'community') = (community_id is not null)
    and (kind = 'activity') = (activity_id is not null)
    and (match_id is null or kind = 'match'));
  if n = 0 then
    alter table public.conversations validate constraint conversations_context_shape;
  else
    raise notice 'messaging audit: % conversation(s) do not match their kind (constraint kept NOT VALID; nothing deleted)', n;
  end if;
end $$;
