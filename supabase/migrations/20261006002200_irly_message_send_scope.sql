-- Sending a message: the block / "who can message me" check must look at the
-- conversation being written to. Unqualified, `conversation_id` inside the
-- sub-query bound to conversation_members.conversation_id, so the check ran
-- over every direct and match chat in the database: one block or one
-- "friends only" setting anywhere stopped a member from writing in any chat,
-- session and community chats included.
drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and kind in ('text', 'activity', 'location', 'photo', 'share')
    and private.is_member(messages.conversation_id)
    and not exists (
      select 1 from public.conversations c
      join public.conversation_members m on m.conversation_id = c.id
      where c.id = messages.conversation_id and m.user_id <> auth.uid()
        and ((c.kind in ('direct', 'match') and private.is_blocked(auth.uid(), m.user_id))
          or (c.kind = 'direct' and not private.may_message(m.user_id, c.id)))
    )
  );
