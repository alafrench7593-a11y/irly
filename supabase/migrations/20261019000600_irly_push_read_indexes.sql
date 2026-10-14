-- Two lookups that run inside a trigger on every chat message had no index of their own.
--
-- 1. on_notification_push (one per recipient of each message) checks whether this
--    member already got a push for this chat in the last minute. It filtered
--    push_outbox by user and time through the global created_at index, so it read
--    every push sent by everyone in that minute.
-- 2. read_message_notifications (each time a chat is read, which happens on every
--    message received in an open chat) marks that chat's message notifications read.
--    It read every notification the member ever received to find the unread ones.
--
-- Indexes only: no row, rule or function changes.

create index if not exists push_outbox_user_time_idx on public.push_outbox (user_id, created_at desc);

create index if not exists notifications_unread_message_idx on public.notifications (user_id, (payload ->> 'conversation_id'))
  where kind = 'MESSAGE_CREATED' and read_at is null;
