-- Messages and conversations, each member's own way of tidying them:
--
--  1. "Delete for me": a message disappears from MY view only (message_hides).
--     The others keep it. "Delete for everyone" stays delete_my_message()
--     (the author only).
--  2. "Archive": the conversation leaves my main list for my Archived list
--     (conversation_members.archived_at). Mine only; the others see nothing.
--     New messages keep it archived, with its unread count, until I unarchive.
--  3. "Delete conversation": the conversation and its history leave MY list
--     (conversation_members.cleared_at): I no longer see the messages sent
--     before that moment. The others keep everything. If someone writes
--     again, the conversation comes back with the new messages only.
--
-- The rules live in the database (a restrictive read policy on messages), so
-- a reconnection, another phone or a realtime event can never bring back
-- what a member removed. Nothing is deleted for anyone else. Reversible: drop
-- the policy, the table and the two columns.

alter table public.conversation_members add column if not exists archived_at timestamptz;
alter table public.conversation_members add column if not exists cleared_at timestamptz;

create table if not exists public.message_hides (
  user_id uuid not null references public.profiles (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
alter table public.message_hides enable row level security;
drop policy if exists message_hides_own on public.message_hides;
create policy message_hides_own on public.message_hides for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.message_hides from anon, authenticated;

-- What a member removed for themself is never read back (screens, realtime, refetches).
drop policy if exists messages_not_removed_for_me on public.messages;
create policy messages_not_removed_for_me on public.messages as restrictive for select to authenticated
using (
  not exists (select 1 from public.message_hides h where h.user_id = auth.uid() and h.message_id = messages.id)
  and messages.created_at > coalesce(
    (select cm.cleared_at from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()),
    '-infinity'::timestamptz)
);

create or replace function public.hide_message_for_me(p_message uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  conv uuid;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select m.conversation_id into conv from public.messages m where m.id = p_message;
  if conv is null or not exists (select 1 from public.conversation_members where conversation_id = conv and user_id = auth.uid()) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.message_hides (user_id, message_id) values (auth.uid(), p_message) on conflict do nothing;
end $$;
revoke all on function public.hide_message_for_me(uuid) from public, anon;
grant execute on function public.hide_message_for_me(uuid) to authenticated;

create or replace function public.set_conversation_archived(p_conversation uuid, p_archived boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  update public.conversation_members set archived_at = case when p_archived then now() end
  where conversation_id = p_conversation and user_id = auth.uid();
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.set_conversation_archived(uuid, boolean) from public, anon;
grant execute on function public.set_conversation_archived(uuid, boolean) to authenticated;

create or replace function public.remove_conversation_for_me(p_conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  update public.conversation_members set cleared_at = now(), last_read_at = now(), archived_at = null
  where conversation_id = p_conversation and user_id = auth.uid();
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.remove_conversation_for_me(uuid) from public, anon;
grant execute on function public.remove_conversation_for_me(uuid) to authenticated;

-- The inbox follows the same rules: last message, unread count, archived flag;
-- a removed conversation is listed again only once a newer message exists.
drop function if exists public.my_conversations();
create function public.my_conversations()
returns table (conversation_id uuid, kind text, title text, other_user_id uuid, other_name text, last_body text,
  last_sender uuid, last_at timestamptz, unread integer, ref_id uuid,
  other_photo text, photo_path text, photo_bucket text, members integer, last_kind text, last_sender_name text, archived boolean)
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
    (select count(*)::int from public.messages x
       where x.conversation_id = c.id and x.deleted_at is null
         and x.sender_id is distinct from auth.uid()
         and (x.sender_id is null or not private.blocked_unchecked(auth.uid(), x.sender_id))
         and x.created_at > greatest(coalesce(me.last_read_at, 'epoch'::timestamptz), coalesce(me.cleared_at, 'epoch'::timestamptz))
         and not exists (select 1 from public.message_hides h where h.user_id = auth.uid() and h.message_id = x.id)),
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
  order by coalesce(lm.created_at, c.created_at) desc
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;
