-- IRLY before launch: three holes found by the security audit, closed.
--
-- 1. A private profile ("nobody" / friends) opened up to anyone who put
--    its owner in a chat: a stranger could create a group with her (or join
--    a community she is in) and then read her bio and photos. Sharing a chat
--    now unlocks the profile only when its owner has written in that chat,
--    or it is a Match chat (both said yes).
-- 2. Group invitations had no limit: one account could add the same woman
--    to 200 groups and send her 200 notifications. At most 5 a day from one
--    member to the same person, 300 an hour from one member.
-- 3. Analytics accepted unlimited anonymous inserts (40 MB in seconds).
--    Past 300 a minute for visitors and 60 a minute per member, events are
--    dropped without an error (they are only statistics).

-- ───────── 1. A chat someone else opened does not unlock a private profile ─────────
create or replace function private.shares_private_chat(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_members x
    join public.conversation_members y on y.conversation_id = x.conversation_id
    join public.conversations c on c.id = x.conversation_id
    where x.user_id = a and y.user_id = b and c.kind in ('direct', 'match', 'group')
      and (c.kind = 'match' or exists (select 1 from public.messages m
           where m.conversation_id = c.id and m.sender_id = b and m.deleted_at is null))
  )
$$;

-- ───────── 2. Group invitations are limited ─────────
create index if not exists notifications_group_added_from_idx on public.notifications ((payload ->> 'from'), created_at)
  where kind = 'GROUP_ADDED';
create or replace function private.group_added_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'GROUP_ADDED' and auth.uid() is not null and new.payload ->> 'from' = auth.uid()::text then
    if (select count(*) from public.notifications n where n.kind = 'GROUP_ADDED' and n.user_id = new.user_id
          and n.payload ->> 'from' = auth.uid()::text and n.created_at > now() - interval '1 day') >= 5
       or (select count(*) from public.notifications n where n.kind = 'GROUP_ADDED'
          and n.payload ->> 'from' = auth.uid()::text and n.created_at > now() - interval '1 hour') >= 300 then
      raise exception 'slow down: too many in a short time' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.group_added_rate() from public, anon, authenticated;
drop trigger if exists notifications_group_rate on public.notifications;
create trigger notifications_group_rate before insert on public.notifications
  for each row execute function private.group_added_rate();

-- ───────── 3. Analytics are capped ─────────
create index if not exists analytics_events_user_recent_idx on public.analytics_events (user_id, created_at);
create or replace function private.analytics_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then
    if (select count(*) from public.analytics_events e where e.user_id is null and e.created_at > now() - interval '1 minute') >= 300 then
      return null;
    end if;
  elsif (select count(*) from public.analytics_events e where e.user_id = new.user_id and e.created_at > now() - interval '1 minute') >= 60 then
    return null;
  end if;
  return new;
end $$;
revoke all on function private.analytics_rate() from public, anon, authenticated;
drop trigger if exists analytics_events_rate on public.analytics_events;
create trigger analytics_events_rate before insert on public.analytics_events
  for each row execute function private.analytics_rate();
