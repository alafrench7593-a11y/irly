-- QA fixes, messaging: a sent message is frozen (its id included), a quote stays in
-- its chat, a removed message, a hidden one, a chat left or deleted take their
-- notifications with them, reactions follow the block rules, a photo message has its photo.
\set ON_ERROR_STOP 1

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

-- Message notifications of one user for one message (read as admin, no RLS).
create or replace function pg_temp.msg_notifs(uid uuid, msg uuid) returns int language sql as $$
  select count(*)::int from public.notifications
  where user_id = uid and kind = 'MESSAGE_CREATED' and payload ->> 'message_id' = msg::text
$$;

select pg_temp.as_admin();

-- a1 Mia (sender), a2 Ava, a3 Zoe, a4 Lea (outsider).
insert into auth.users (id) values
  ('7f100000-0000-0000-0000-0000000000a1'), ('7f100000-0000-0000-0000-0000000000a2'),
  ('7f100000-0000-0000-0000-0000000000a3'), ('7f100000-0000-0000-0000-0000000000a4');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('7f100000-0000-0000-0000-0000000000a1', 'Mia', '1994-03-03', 'woman', 'dubai'),
  ('7f100000-0000-0000-0000-0000000000a2', 'Ava', '1993-05-05', 'woman', 'dubai'),
  ('7f100000-0000-0000-0000-0000000000a3', 'Zoe', '1992-07-07', 'woman', 'dubai'),
  ('7f100000-0000-0000-0000-0000000000a4', 'Lea', '1991-09-09', 'woman', 'dubai');
-- c1: group Mia, Ava, Zoe. c2: direct Mia–Ava. c3: group Lea, Zoe (another chat).
insert into public.conversations (id, kind, title) values
  ('7f100000-0000-0000-0000-0000000000c1', 'group', 'QA fixes group'),
  ('7f100000-0000-0000-0000-0000000000c2', 'direct', null),
  ('7f100000-0000-0000-0000-0000000000c3', 'group', 'Other chat');
insert into public.conversation_members (conversation_id, user_id, role) values
  ('7f100000-0000-0000-0000-0000000000c1', '7f100000-0000-0000-0000-0000000000a1', 'admin'),
  ('7f100000-0000-0000-0000-0000000000c1', '7f100000-0000-0000-0000-0000000000a2', 'member'),
  ('7f100000-0000-0000-0000-0000000000c1', '7f100000-0000-0000-0000-0000000000a3', 'member'),
  ('7f100000-0000-0000-0000-0000000000c2', '7f100000-0000-0000-0000-0000000000a1', 'member'),
  ('7f100000-0000-0000-0000-0000000000c2', '7f100000-0000-0000-0000-0000000000a2', 'member'),
  ('7f100000-0000-0000-0000-0000000000c3', '7f100000-0000-0000-0000-0000000000a4', 'admin'),
  ('7f100000-0000-0000-0000-0000000000c3', '7f100000-0000-0000-0000-0000000000a3', 'member');
insert into public.messages (id, conversation_id, sender_id, body) values
  ('7f100000-0000-0000-0000-0000000000d1', '7f100000-0000-0000-0000-0000000000c1', '7f100000-0000-0000-0000-0000000000a1', 'abusive text'),
  ('7f100000-0000-0000-0000-0000000000d2', '7f100000-0000-0000-0000-0000000000c1', '7f100000-0000-0000-0000-0000000000a1', 'oops wrong chat secret'),
  ('7f100000-0000-0000-0000-0000000000d3', '7f100000-0000-0000-0000-0000000000c1', '7f100000-0000-0000-0000-0000000000a2', 'hide me'),
  ('7f100000-0000-0000-0000-0000000000d4', '7f100000-0000-0000-0000-0000000000c2', '7f100000-0000-0000-0000-0000000000a1', 'hi Ava'),
  ('7f100000-0000-0000-0000-0000000000d5', '7f100000-0000-0000-0000-0000000000c3', '7f100000-0000-0000-0000-0000000000a4', 'secret between Lea and Zoe');

-- ───────── MSG-01 / MSG-08: every column but deleted_at is frozen for the sender ─────────
do $$
declare
  frozen text[];
  missing text[];
begin
  perform pg_temp.as_user('7f100000-0000-0000-0000-0000000000a1');
  begin
    update public.messages set id = gen_random_uuid() where id = '7f100000-0000-0000-0000-0000000000d1';
    raise exception 'FAIL msg qa: the sender renamed a message id';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.messages set edited_at = now() - interval '1 day' where id = '7f100000-0000-0000-0000-0000000000d1';
    raise exception 'FAIL msg qa: the sender forged edited_at';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.messages set reply_to = '7f100000-0000-0000-0000-0000000000d3' where id = '7f100000-0000-0000-0000-0000000000d1';
    raise exception 'FAIL msg qa: the sender changed reply_to after sending';
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.as_admin();
  -- No column but deleted_at is left out (a column added later is frozen too, or listed here).
  select string_to_array(rtrim(encode(t.tgargs, 'escape'), E'\\000'), E'\\000') into frozen
  from pg_trigger t where t.tgrelid = 'public.messages'::regclass and t.tgname = 'messages_edit_guard';
  select array_agg(c.column_name::text) into missing
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'messages' and c.column_name <> 'deleted_at'
    and not (c.column_name = any (coalesce(frozen, '{}')));
  if missing is not null then
    raise exception 'FAIL msg qa: columns a sender can still change: %', missing;
  end if;
  -- The report still finds the message, as it was sent.
  if not exists (select 1 from public.messages where id = '7f100000-0000-0000-0000-0000000000d1' and body = 'abusive text') then
    raise exception 'FAIL msg qa: the reported message moved or changed';
  end if;
end $$;

-- ───────── R2: a quote is a message of the same chat ─────────
do $$
begin
  perform pg_temp.as_user('7f100000-0000-0000-0000-0000000000a1');
  begin
    insert into public.messages (conversation_id, sender_id, body, reply_to)
    values ('7f100000-0000-0000-0000-0000000000c1', auth.uid(), 'quoting', '7f100000-0000-0000-0000-0000000000d5');
    raise exception 'FAIL msg qa: a quote of another chat''s message was stored';
  exception when check_violation then null;
  end;
  -- An unknown id answers the same (no existence oracle).
  begin
    insert into public.messages (conversation_id, sender_id, body, reply_to)
    values ('7f100000-0000-0000-0000-0000000000c1', auth.uid(), 'quoting', gen_random_uuid());
    raise exception 'FAIL msg qa: a quote of an unknown message was stored';
  exception when check_violation then null;
  end;
  -- A quote in the same chat works.
  insert into public.messages (id, conversation_id, sender_id, body, reply_to)
  values ('7f100000-0000-0000-0000-0000000000d6', '7f100000-0000-0000-0000-0000000000c1', auth.uid(), 'quoting Ava', '7f100000-0000-0000-0000-0000000000d3');
  perform pg_temp.as_admin();
  if exists (select 1 from public.messages m join public.messages q on q.id = m.reply_to where q.conversation_id <> m.conversation_id
             and m.conversation_id in ('7f100000-0000-0000-0000-0000000000c1', '7f100000-0000-0000-0000-0000000000c3')) then
    raise exception 'FAIL msg qa: a cross-chat quote is stored';
  end if;
end $$;

-- ───────── MSG-07: a photo message has its photo ─────────
do $$
begin
  perform pg_temp.as_user('7f100000-0000-0000-0000-0000000000a1');
  begin
    insert into public.messages (conversation_id, sender_id, kind, body)
    values ('7f100000-0000-0000-0000-0000000000c1', auth.uid(), 'photo', 'Photo');
    raise exception 'FAIL msg qa: a photo message without a photo was stored';
  exception when check_violation then null;
  end;
  perform pg_temp.as_admin();
end $$;

-- ───────── MSG-02: deleted for everyone, its notification and push copy go ─────────
do $$
declare
  ava uuid := '7f100000-0000-0000-0000-0000000000a2';
  zoe uuid := '7f100000-0000-0000-0000-0000000000a3';
  msg uuid := '7f100000-0000-0000-0000-0000000000d2';
begin
  perform pg_temp.as_admin();
  if pg_temp.msg_notifs(ava, msg) <> 1 or pg_temp.msg_notifs(zoe, msg) <> 1 then
    raise exception 'FAIL msg qa: setup, the message should notify Ava and Zoe once';
  end if;
  -- A push waiting with the text (as push_send would leave it after a failed try).
  insert into public.push_outbox (notification_id, user_id, token, title, body, url)
  select n.id, n.user_id, 'ExponentPushToken[qa-fix-a]', 'Mia', 'oops wrong chat secret', '/messages/x'
  from public.notifications n where n.user_id = ava and n.kind = 'MESSAGE_CREATED' and n.payload ->> 'message_id' = msg::text;

  perform pg_temp.as_user('7f100000-0000-0000-0000-0000000000a1');
  perform public.delete_my_message(msg);

  perform pg_temp.as_admin();
  if pg_temp.msg_notifs(ava, msg) <> 0 or pg_temp.msg_notifs(zoe, msg) <> 0 then
    raise exception 'FAIL msg qa: the deleted message''s notifications are still there';
  end if;
  if exists (select 1 from public.push_outbox where body like '%oops wrong chat%') then
    raise exception 'FAIL msg qa: the deleted message''s text is still in push_outbox';
  end if;
  -- The sender can still remove her own message by itself (deleted_at only).
  perform pg_temp.as_user('7f100000-0000-0000-0000-0000000000a1');
  update public.messages set deleted_at = now() where id = '7f100000-0000-0000-0000-0000000000d1';
  perform pg_temp.as_admin();
  if not exists (select 1 from public.messages where id = '7f100000-0000-0000-0000-0000000000d1' and deleted_at is not null and body = '—') then
    raise exception 'FAIL msg qa: the sender could not delete her message';
  end if;
  if pg_temp.msg_notifs(ava, '7f100000-0000-0000-0000-0000000000d1') <> 0 then
    raise exception 'FAIL msg qa: a message deleted through deleted_at kept its notification';
  end if;
end $$;

-- ───────── MSG-05: "delete for me" takes its notification ─────────
do $$
declare
  mia uuid := '7f100000-0000-0000-0000-0000000000a1';
  msg uuid := '7f100000-0000-0000-0000-0000000000d3';
begin
  perform pg_temp.as_admin();
  if pg_temp.msg_notifs(mia, msg) <> 1 then
    raise exception 'FAIL msg qa: setup, Ava''s message should notify Mia';
  end if;
  perform pg_temp.as_user(mia);
  perform public.hide_message_for_me(msg);
  perform pg_temp.as_admin();
  if pg_temp.msg_notifs(mia, msg) <> 0 then
    raise exception 'FAIL msg qa: a message hidden for me kept my notification';
  end if;
  -- Only mine: Zoe's stays.
  if pg_temp.msg_notifs('7f100000-0000-0000-0000-0000000000a3', msg) <> 1 then
    raise exception 'FAIL msg qa: hiding for me removed someone else''s notification';
  end if;
end $$;

-- ───────── MSG-04: leaving a group takes its message notifications ─────────
do $$
declare
  zoe uuid := '7f100000-0000-0000-0000-0000000000a3';
begin
  perform pg_temp.as_admin();
  if not exists (select 1 from public.notifications where user_id = zoe and kind = 'MESSAGE_CREATED'
                 and payload ->> 'conversation_id' = '7f100000-0000-0000-0000-0000000000c1' and read_at is null) then
    raise exception 'FAIL msg qa: setup, Zoe should have unread message notifications in the group';
  end if;
  perform pg_temp.as_user(zoe);
  -- Group chats were removed (20261109050000): leave_group refuses; a group chat is still left
  -- when an account is deleted, and that path must take its notifications too.
  begin
    perform public.leave_group('7f100000-0000-0000-0000-0000000000c1');
    raise exception 'FAIL msg qa: a group chat can still be left from the app';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.as_admin();
  perform private.leave_group_as(zoe, '7f100000-0000-0000-0000-0000000000c1');
  if exists (select 1 from public.notifications where user_id = zoe and kind = 'MESSAGE_CREATED'
             and payload ->> 'conversation_id' = '7f100000-0000-0000-0000-0000000000c1') then
    raise exception 'FAIL msg qa: a group left kept its message notifications';
  end if;
  -- Her other chat keeps its own.
  if not exists (select 1 from public.notifications where user_id = zoe and kind = 'MESSAGE_CREATED'
                 and payload ->> 'conversation_id' = '7f100000-0000-0000-0000-0000000000c3') then
    raise exception 'FAIL msg qa: leaving one group removed another chat''s notifications';
  end if;
end $$;

-- ───────── MSG-03: no reaction across a block ─────────
do $$
begin
  perform pg_temp.as_user('7f100000-0000-0000-0000-0000000000a2');
  -- Allowed before the block.
  insert into public.message_reactions (message_id, user_id, emoji)
  values ('7f100000-0000-0000-0000-0000000000d4', auth.uid(), '👍');
  perform public.block_user('7f100000-0000-0000-0000-0000000000a1');

  -- Mia, blocked by Ava, cannot react in their direct chat.
  perform pg_temp.as_user('7f100000-0000-0000-0000-0000000000a1');
  begin
    insert into public.message_reactions (message_id, user_id, emoji)
    values ('7f100000-0000-0000-0000-0000000000d4', auth.uid(), '😡');
    raise exception 'FAIL msg qa: a blocked member reacted in the direct chat';
  exception when insufficient_privilege then null;
  end;
  -- Nor can Ava (a block silences both sides), but she can take hers back.
  perform pg_temp.as_user('7f100000-0000-0000-0000-0000000000a2');
  begin
    insert into public.message_reactions (message_id, user_id, emoji)
    values ('7f100000-0000-0000-0000-0000000000d4', auth.uid(), '❤️');
    raise exception 'FAIL msg qa: the blocker reacted in the direct chat';
  exception when insufficient_privilege then null;
  end;
  delete from public.message_reactions where message_id = '7f100000-0000-0000-0000-0000000000d4' and user_id = auth.uid();
  perform pg_temp.as_admin();
  if exists (select 1 from public.message_reactions where message_id = '7f100000-0000-0000-0000-0000000000d4') then
    raise exception 'FAIL msg qa: a reaction could not be taken back';
  end if;

  -- A message deleted for everyone takes no reaction.
  perform pg_temp.as_user('7f100000-0000-0000-0000-0000000000a1');
  begin
    insert into public.message_reactions (message_id, user_id, emoji)
    values ('7f100000-0000-0000-0000-0000000000d2', auth.uid(), '👍');
    raise exception 'FAIL msg qa: reacted to a deleted message';
  exception when insufficient_privilege then null;
  end;
  -- Reacting in a group still works (a block applies to direct and match chats, as for messages).
  perform pg_temp.as_user('7f100000-0000-0000-0000-0000000000a2');
  insert into public.message_reactions (message_id, user_id, emoji)
  values ('7f100000-0000-0000-0000-0000000000d6', auth.uid(), '👍');
  perform pg_temp.as_admin();
end $$;

-- ───────── R1: deleting an activity leaves no notification for its chat ─────────
do $$
declare
  conv uuid;
  ana uuid := '7f100000-0000-0000-0000-0000000000a4';
begin
  perform pg_temp.as_user(ana);
  insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at)
  values ('7f100000-0000-0000-0000-0000000000e1', auth.uid(), 'Padel tonight', 'sport', 'dubai', 'marina', now() + interval '1 day');
  perform pg_temp.as_user('7f100000-0000-0000-0000-0000000000a3');
  perform public.join_activity('7f100000-0000-0000-0000-0000000000e1');
  select id into conv from public.conversations where activity_id = '7f100000-0000-0000-0000-0000000000e1';
  insert into public.messages (conversation_id, sender_id, body) values (conv, auth.uid(), 'I bring the balls');

  perform pg_temp.as_admin();
  if not exists (select 1 from public.notifications where user_id = ana and kind = 'MESSAGE_CREATED' and payload ->> 'conversation_id' = conv::text) then
    raise exception 'FAIL msg qa: setup, the creator should be notified of the message';
  end if;
  perform pg_temp.as_user(ana);
  perform public.delete_activity('7f100000-0000-0000-0000-0000000000e1');

  perform pg_temp.as_admin();
  if exists (select 1 from public.notifications where kind = 'MESSAGE_CREATED' and payload ->> 'conversation_id' = conv::text) then
    raise exception 'FAIL msg qa: notifications point at a deleted chat';
  end if;
end $$;

select pg_temp.as_admin();
\echo 'ok messaging_qa_fixes'
