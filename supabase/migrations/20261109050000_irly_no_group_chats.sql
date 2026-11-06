-- Group chats in Messages are removed (owner decision, 2026-11-06).
--
-- A group chat (conversations.kind = 'group': a few friends' chat outside
-- any community or activity) is no longer part of IRLY. Data-preserving and
-- reversible: no row is deleted. Community chats, activity chats, private
-- messages and IRLY Match chats are untouched.
-- 1. Every group chat that exists is listed in private.removed_group_chats
--    and leaves every list: the inbox and its unread counts
--    (my_conversations) and every direct read (conversations, their members
--    and messages: restrictive read rules), so an old link finds nothing
--    (« not available » in the app). Rows, members and history are kept;
--    deleting a row of private.removed_group_chats brings that chat back.
-- 2. They take no new message (so no message notification or push either).
-- 3. A group chat can no longer be created, joined, renamed, re-photographed
--    or left from the app: create_group, add_group_members, rename_group and
--    leave_group refuse, and so does any insert or update of a group
--    conversation by a member. Deleting an account still leaves them as
--    before (private.leave_group_as), with the rest of the account.
-- Idempotent.

-- ───────── 0. Which conversations are group chats (kept) ─────────
create table if not exists private.removed_group_chats (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  removed_at timestamptz not null default now(),
  members integer not null default 0,
  messages integer not null default 0
);
comment on table private.removed_group_chats is
  'Group chats removed on 2026-11-06 (owner decision): kept, hidden by the read rules of 20261109050000.';
revoke all on table private.removed_group_chats from public, anon, authenticated;

insert into private.removed_group_chats (conversation_id, members, messages)
select c.id,
  (select count(*)::int from public.conversation_members m where m.conversation_id = c.id),
  (select count(*)::int from public.messages x where x.conversation_id = c.id and x.deleted_at is null)
from public.conversations c where c.kind = 'group'
on conflict (conversation_id) do nothing;

/** A group chat removed on 2026-11-06 (kept, hidden). */
create or replace function private.is_removed_group_chat(p_conversation uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from private.removed_group_chats where conversation_id = p_conversation)
$$;
revoke all on function private.is_removed_group_chat(uuid) from public, anon;
grant execute on function private.is_removed_group_chat(uuid) to authenticated;

/** A group chat at all (removed or not): nobody may create, join or change one from the app. */
create or replace function private.is_group_chat(p_conversation uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversations where id = p_conversation and kind = 'group')
$$;
revoke all on function private.is_group_chat(uuid) from public, anon, authenticated;

-- ───────── 1. Out of every read ─────────
drop policy if exists conversations_no_group_chat on public.conversations;
create policy conversations_no_group_chat on public.conversations as restrictive for select to authenticated, anon
  using (not private.is_removed_group_chat(id));
drop policy if exists conversation_members_no_group_chat on public.conversation_members;
create policy conversation_members_no_group_chat on public.conversation_members as restrictive for select to authenticated, anon
  using (not private.is_removed_group_chat(conversation_id));
drop policy if exists messages_no_group_chat on public.messages;
create policy messages_no_group_chat on public.messages as restrictive for select to authenticated, anon
  using (not private.is_removed_group_chat(conversation_id));

-- The inbox and its unread counts (same as 20261109000000 otherwise).
create or replace function public.my_conversations()
returns table (conversation_id uuid, kind text, title text, other_user_id uuid, other_name text, last_body text, last_sender uuid,
  last_at timestamptz, unread integer, ref_id uuid, other_photo text, photo_path text, photo_bucket text, members integer,
  last_kind text, last_sender_name text, archived boolean)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.kind,
    coalesce(com.name, act.title, c.title, other.first_name, 'IRLY'),
    other.id,
    other.first_name,
    lm.body,
    lm.sender_id,
    coalesce(lm.created_at, c.created_at),
    (select count(*)::int from (
       select 1 from public.messages x
       where x.conversation_id = c.id and x.deleted_at is null
         and x.sender_id is distinct from auth.uid()
         and x.created_at > greatest(coalesce(me.last_read_at, 'epoch'::timestamptz), coalesce(me.cleared_at, 'epoch'::timestamptz))
         and (x.sender_id is null or x.sender_id <> all (array(
           select b.blocked_id from public.blocks b where b.blocker_id = auth.uid()
           union all select b.blocker_id from public.blocks b where b.blocked_id = auth.uid())))
         and not exists (select 1 from public.message_hides h where h.user_id = auth.uid() and h.message_id = x.id)
       limit 100
     ) u),
    coalesce(c.activity_id, c.community_id, c.match_id),
    other.photo,
    coalesce(com.cover_path, c.photo_path, act.cover_path),
    case when coalesce(com.cover_path, c.photo_path, act.cover_path) is null then null else 'activity-photos' end,
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
    lm.kind,
    lm.first_name,
    me.archived_at is not null
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join public.communities com on com.id = c.community_id
  left join public.activities act on act.id = c.activity_id
  left join lateral (
    select p.id, p.first_name, p.photo_paths[1] as photo from public.conversation_members o
    join public.profiles p on p.id = o.user_id
    where o.conversation_id = c.id and o.user_id <> auth.uid() and c.kind in ('direct', 'match')
    limit 1
  ) other on true
  left join lateral (
    select m.body, m.sender_id, m.created_at, m.kind, sp.first_name from public.messages m
    left join public.profiles sp on sp.id = m.sender_id
    where m.conversation_id = c.id and m.deleted_at is null
      and (m.sender_id is null or not private.blocked_unchecked(auth.uid(), m.sender_id))
      and m.created_at > coalesce(me.cleared_at, '-infinity'::timestamptz)
      and not exists (select 1 from public.message_hides h where h.user_id = auth.uid() and h.message_id = m.id)
    order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
    and not (c.kind in ('direct', 'match') and other.id is not null and private.blocked_unchecked(auth.uid(), other.id))
    and (me.cleared_at is null or lm.created_at is not null)
    -- IRLY Girl chats (Match, girls-only community or activity) only with IRLY Girl access.
    and ((select private.is_girl_eligible())
         or not (c.kind = 'match' or coalesce(com.girl_only, false) or coalesce(act.girl_only, false)))
    -- A removed group's chat (groups were removed on 2026-11-06).
    and not (com.parent_id is not null and com.deleted_at is not null)
    -- Group chats were removed on 2026-11-06 (kept, never listed).
    and not exists (select 1 from private.removed_group_chats g where g.conversation_id = c.id)
  order by coalesce(lm.created_at, c.created_at) desc
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

-- ───────── 2. No new message, no new group chat ─────────
create or replace function private.no_group_chat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'messages' then
    if new.sender_id is not null and private.is_removed_group_chat(new.conversation_id) then
      raise exception 'group chats are no longer available' using errcode = '42501';
    end if;
  elsif tg_table_name = 'conversation_members' then
    if auth.uid() is not null and private.is_group_chat(new.conversation_id) then
      raise exception 'group chats are no longer available' using errcode = '42501';
    end if;
  elsif auth.uid() is not null and (
      (tg_op = 'INSERT' and new.kind = 'group')
      or (tg_op = 'UPDATE' and (new.kind = 'group') <> (old.kind = 'group'))
      or (tg_op = 'UPDATE' and old.kind = 'group' and (new.title is distinct from old.title
        or (new.photo_path is distinct from old.photo_path and new.photo_path is not null)))) then
    -- No new group chat, none renamed or given a photo (the server's own bookkeeping goes on: the last
    -- message time, a deleted account's photo cleared).
    raise exception 'group chats are no longer available' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.no_group_chat_guard() from public, anon, authenticated;
drop trigger if exists messages_no_group_chat on public.messages;
create trigger messages_no_group_chat before insert on public.messages
for each row execute function private.no_group_chat_guard();
drop trigger if exists conversations_no_group_chat on public.conversations;
create trigger conversations_no_group_chat before insert or update on public.conversations
for each row execute function private.no_group_chat_guard();
drop trigger if exists conversation_members_no_group_chat on public.conversation_members;
create trigger conversation_members_no_group_chat before insert on public.conversation_members
for each row execute function private.no_group_chat_guard();

create or replace function public.create_group(p_title text, p_members uuid[], p_photo text default null) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'group chats are no longer available' using errcode = '42501';
end $$;
revoke all on function public.create_group(text, uuid[], text) from public, anon;
grant execute on function public.create_group(text, uuid[], text) to authenticated;

create or replace function public.add_group_members(p_conversation uuid, p_members uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'group chats are no longer available' using errcode = '42501';
end $$;
revoke all on function public.add_group_members(uuid, uuid[]) from public, anon;
grant execute on function public.add_group_members(uuid, uuid[]) to authenticated;

create or replace function public.rename_group(p_conversation uuid, p_title text) returns void
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'group chats are no longer available' using errcode = '42501';
end $$;
revoke all on function public.rename_group(uuid, text) from public, anon;
grant execute on function public.rename_group(uuid, text) to authenticated;

create or replace function public.leave_group(p_conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'group chats are no longer available' using errcode = '42501';
end $$;
revoke all on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;

-- ───────── 3. For the record (deploy log) ─────────
do $$
declare r record;
begin
  select count(*) as chats, coalesce(sum(members), 0) as members, coalesce(sum(messages), 0) as messages into r from private.removed_group_chats;
  raise notice 'group chats hidden: % chats, % memberships, % messages (all kept, private.removed_group_chats)', r.chats, r.members, r.messages;
end $$;
