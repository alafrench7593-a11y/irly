-- Opening a chat faster (additive: same signatures, same access rules).
--
-- Opening any chat ran mark_conversation_read, which rewrote my membership
-- row every time, even with nothing new to read. Each write is a realtime
-- UPDATE on conversation_members, which made every open screen reload the
-- whole inbox (my_conversations, the heaviest read in the app) right while
-- the chat was loading. The inbox itself counted every unread message one by
-- one, with a function call per message for the block check.

-- ───────── 1. Reading a chat writes only when there is something to read ─────────
-- Same row, same rule (only my own membership): skipped when no message from
-- someone else came after my last read and no message notification of this
-- chat is still unread, i.e. exactly when the write would change nothing the
-- inbox, the badge or the bell show.
create or replace function public.mark_conversation_read(p_conversation uuid) returns void
language sql security definer set search_path = public as $$
  update public.conversation_members m set last_read_at = now()
  where m.conversation_id = p_conversation and m.user_id = auth.uid()
    and (
      m.last_read_at is null
      or exists (
        select 1 from public.messages x
        where x.conversation_id = m.conversation_id
          and x.created_at > m.last_read_at
          and x.sender_id is distinct from auth.uid()
      )
      or exists (
        select 1 from public.notifications n
        where n.user_id = auth.uid() and n.kind = 'MESSAGE_CREATED' and n.read_at is null
          and n.payload ->> 'conversation_id' = p_conversation::text
      )
    )
$$;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ───────── 2. The inbox counts unread up to 100 per chat ─────────
-- The list shows "99+" past 99, so counting further was work for nothing.
-- The block check is the same rule as private.blocked_unchecked (blocked
-- either way), read once per inbox instead of one function call per message.
create or replace function public.my_conversations()
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
  order by coalesce(lm.created_at, c.created_at) desc
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;
