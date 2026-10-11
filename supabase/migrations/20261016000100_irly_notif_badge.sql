-- Phantom bell badge: every chat message also creates a MESSAGE_CREATED
-- notification (it carries the push). Reading the chat moved last_read_at
-- but left that notification unread, so the bell kept counting messages
-- already read. Now reading a conversation (or deleting it from my list)
-- marks its message notifications read, up to that moment. Nothing is
-- deleted: read_at is set, as the bell screen itself does.

create or replace function private.read_message_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.last_read_at is not null and new.last_read_at is distinct from old.last_read_at then
    update public.notifications n set read_at = new.last_read_at
    where n.user_id = new.user_id and n.kind = 'MESSAGE_CREATED' and n.read_at is null
      and n.payload ->> 'conversation_id' = new.conversation_id::text
      and n.created_at <= new.last_read_at;
  end if;
  return null;
end $$;
revoke all on function private.read_message_notifications() from public, anon, authenticated;

drop trigger if exists conversation_members_read_notifications on public.conversation_members;
create trigger conversation_members_read_notifications after update of last_read_at on public.conversation_members
for each row execute function private.read_message_notifications();

-- Once, for what is already there: message notifications of chats read since.
update public.notifications n set read_at = cm.last_read_at
from public.conversation_members cm
where n.kind = 'MESSAGE_CREATED' and n.read_at is null
  and cm.user_id = n.user_id and cm.conversation_id::text = n.payload ->> 'conversation_id'
  and cm.last_read_at is not null and n.created_at <= cm.last_read_at;
