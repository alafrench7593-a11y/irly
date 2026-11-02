-- QA fixes, messaging (qa/messaging.md and the server simulation).
-- Additive and idempotent: triggers and policies are dropped and created again,
-- functions are created or replaced. The only rows removed are notifications
-- (and their push copies) for chats or messages that no longer exist (section 7).

-- ───────── 1. A sent message cannot be rewritten, its id included (MSG-01, MSG-08) ─────────
-- The guard froze some columns but not the id: after being reported, a sender
-- renamed the message's id, so the report (and the moderator) found nothing while
-- the other members still read it. reply_to, edited_at and media_path could be
-- forged the same way. Every column but deleted_at is now frozen: the only change
-- a member makes to a sent message is to delete it (delete_my_message, or
-- deleted_at directly, which the erase trigger then empties). Server code
-- (security definer triggers, admins, no signed-in user) is let through by
-- private.edit_guard as before.
drop trigger if exists messages_edit_guard on public.messages;
create trigger messages_edit_guard before update on public.messages
for each row execute function private.edit_guard(
  'id', 'conversation_id', 'sender_id', 'kind', 'created_at', 'ref_type', 'ref_id', 'body',
  'reply_to', 'edited_at', 'media_path');

-- ───────── 2. A quoted message is one of this chat (simulation R2) ─────────
-- reply_to could point at a message of a chat the sender is not in: a stored
-- cross-chat link, and an existence oracle (a random id failed with a foreign-key
-- error, a real one went through). The quoted message must be in the same chat;
-- an unknown id and another chat's message give the same answer.
create or replace function private.message_reply_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reply_to is not null and not exists (
    select 1 from public.messages q where q.id = new.reply_to and q.conversation_id = new.conversation_id
  ) then
    raise exception 'the quoted message is not in this chat' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.message_reply_guard() from public, anon, authenticated;
drop trigger if exists messages_reply_guard on public.messages;
create trigger messages_reply_guard before insert or update of reply_to on public.messages
for each row execute function private.message_reply_guard();

-- ───────── 2b. A photo message has its photo (MSG-07) ─────────
-- messages_media_shape only says a photo path belongs to a photo message; a
-- 'photo' message with no photo was accepted and drawn as an empty bubble.
-- Checked on new messages only: an old row, if any, can still be deleted.
create or replace function private.message_photo_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.kind = 'photo' and new.media_path is null then
    raise exception 'a photo message needs its photo' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.message_photo_guard() from public, anon, authenticated;
drop trigger if exists messages_photo_guard on public.messages;
create trigger messages_photo_guard before insert on public.messages
for each row execute function private.message_photo_guard();

-- ───────── 3. Deleted for everyone: its notification and push go too (MSG-02) ─────────
-- The message text was erased, but its MESSAGE_CREATED notifications stayed, and
-- with them the push copies in push_outbox (up to 120 characters of the text, kept
-- 7 days, and retried by push_housekeeping). Deleting the notifications drops
-- the push copies (notifications_drop_push). Whoever removes the message (the
-- sender, a moderator, an admin) goes through here.
-- The recipients are the chat's members (one indexed lookup each); members who
-- left had theirs removed when they left (section 5).
create or replace function private.message_removed_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    delete from public.notifications n
    where n.user_id in (select m.user_id from public.conversation_members m where m.conversation_id = new.conversation_id)
      and n.kind = 'MESSAGE_CREATED'
      and n.payload ->> 'message_id' = new.id::text;
  end if;
  return null;
end $$;
revoke all on function private.message_removed_notifications() from public, anon, authenticated;
drop trigger if exists messages_removed_notifications on public.messages;
create trigger messages_removed_notifications after update of deleted_at on public.messages
for each row execute function private.message_removed_notifications();

-- ───────── 4. "Delete for me" takes its notification with it (MSG-05) ─────────
create or replace function private.message_hidden_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications n
  where n.user_id = new.user_id and n.kind = 'MESSAGE_CREATED'
    and n.payload ->> 'message_id' = new.message_id::text;
  return null;
end $$;
revoke all on function private.message_hidden_notification() from public, anon, authenticated;
drop trigger if exists message_hides_notification on public.message_hides;
create trigger message_hides_notification after insert on public.message_hides
for each row execute function private.message_hidden_notification();

-- ───────── 5. Leaving a chat takes its message notifications with it (MSG-04) ─────────
-- After leave_group (or leaving a community or an activity) they stayed unread for
-- good: mark_conversation_read no longer reaches a chat you are not in, and a tap
-- on their push opened a chat you had left.
create or replace function private.member_left_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications n
  where n.user_id = old.user_id and n.kind = 'MESSAGE_CREATED'
    and n.payload ->> 'conversation_id' = old.conversation_id::text;
  return null;
end $$;
revoke all on function private.member_left_notifications() from public, anon, authenticated;
drop trigger if exists conversation_members_left_notifications on public.conversation_members;
create trigger conversation_members_left_notifications after delete on public.conversation_members
for each row execute function private.member_left_notifications();

-- ───────── 6. A deleted chat leaves no notification behind (simulation R1) ─────────
-- Deleting an activity (or anything that deletes its chat) left MESSAGE_CREATED
-- notifications, and their push copies, pointing at a chat that no longer exists.
-- Before the chat goes, while its members are still listed.
create or replace function private.conversation_gone_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications n
  where n.user_id in (select m.user_id from public.conversation_members m where m.conversation_id = old.id)
    and n.kind = 'MESSAGE_CREATED'
    and n.payload ->> 'conversation_id' = old.id::text;
  return old;
end $$;
revoke all on function private.conversation_gone_notifications() from public, anon, authenticated;
drop trigger if exists conversations_gone_notifications on public.conversations;
create trigger conversations_gone_notifications before delete on public.conversations
for each row execute function private.conversation_gone_notifications();

-- ───────── 7. One-off cleanup of what was already left behind ─────────
-- Only MESSAGE_CREATED notifications whose chat no longer exists (R1), or whose
-- message no longer exists or was deleted for everyone (MSG-02: they still carry
-- its text in their push copy). They point at nothing anyone can open; their push
-- copies go with them (notifications_drop_push). Nothing else is touched.
delete from public.notifications n
where n.kind = 'MESSAGE_CREATED'
  and (
    not exists (select 1 from public.conversations c where c.id = private.uuid_or_null(n.payload ->> 'conversation_id'))
    or (n.payload ? 'message_id' and not exists (
      select 1 from public.messages m where m.id = private.uuid_or_null(n.payload ->> 'message_id') and m.deleted_at is null))
  );

-- ───────── 8. Reactions follow the rules of writing (MSG-03) ─────────
-- A blocked member could still react in the direct (or match) chat with the
-- blocker, where writing is refused. A reaction now needs the same as a message:
-- a member of the chat, no block between the two people of a direct or match
-- chat, IRLY Girl access for a women-only chat, and a message not deleted.
-- Taking back one's own reaction stays possible (using clause unchanged).
drop policy if exists reactions_write on public.message_reactions;
create policy reactions_write on public.message_reactions for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and m.deleted_at is null
        and private.is_member(m.conversation_id)
        and ((select private.is_girl_eligible()) or not private.girl_chat(m.conversation_id))
        and not exists (
          select 1 from public.conversations c
          join public.conversation_members cm on cm.conversation_id = c.id
          where c.id = m.conversation_id and c.kind in ('direct', 'match') and cm.user_id <> auth.uid()
            and private.is_blocked(auth.uid(), cm.user_id)
        )
    )
  );
