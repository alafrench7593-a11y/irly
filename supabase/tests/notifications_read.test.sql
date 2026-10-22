-- Notifications read state and the push that opens one
-- (migration 20261025000200_irly_notifications_open, and the read rules the
-- app relies on: features/server/social.ts markNotificationsRead / markAllRead).
-- Runs after irly_test.sql on the same database (scripts/test-db.sh); ids use
-- the prefix f2502000-…. Each block raises if a rule does not hold.
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

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL notifications_read: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

select pg_temp.as_admin();

-- Ana (reader, two phones), Ben (another member).
insert into auth.users (id) values
  ('f2502000-0000-0000-0000-0000000000a1'), ('f2502000-0000-0000-0000-0000000000a2');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('f2502000-0000-0000-0000-0000000000a1', 'Ana', '1994-03-03', 'woman', 'dubai'),
  ('f2502000-0000-0000-0000-0000000000a2', 'Ben', '1993-05-05', 'man', 'dubai');

insert into public.notifications (id, user_id, kind, payload) values
  ('f2502000-0000-0000-0000-0000000000b1', 'f2502000-0000-0000-0000-0000000000a1', 'NEW_FOLLOWER', '{"from": "f2502000-0000-0000-0000-0000000000a2"}'),
  ('f2502000-0000-0000-0000-0000000000b2', 'f2502000-0000-0000-0000-0000000000a1', 'NEW_FOLLOWER', '{"from": "f2502000-0000-0000-0000-0000000000a2"}'),
  ('f2502000-0000-0000-0000-0000000000b3', 'f2502000-0000-0000-0000-0000000000a1', 'NEW_FOLLOWER', '{"from": "f2502000-0000-0000-0000-0000000000a2"}'),
  ('f2502000-0000-0000-0000-0000000000b4', 'f2502000-0000-0000-0000-0000000000a1', 'MESSAGE_CREATED', '{}'),
  ('f2502000-0000-0000-0000-0000000000c1', 'f2502000-0000-0000-0000-0000000000a2', 'NEW_FOLLOWER', '{"from": "f2502000-0000-0000-0000-0000000000a1"}');

do $$
begin
  perform pg_temp.check((select count(*) from public.notifications where id::text like 'f2502000-%') = 5,
    'setup: the five notifications are stored');
end $$;

-- 1. Seen on screen: the rows shown are marked read in one request (the app's exact query), and
--    the read state is the server's, so it is the same after a restart and on every phone.
do $$
declare n integer;
begin
  perform pg_temp.as_user('f2502000-0000-0000-0000-0000000000a1');
  update public.notifications set read_at = now()
    where id in ('f2502000-0000-0000-0000-0000000000b1', 'f2502000-0000-0000-0000-0000000000b2') and read_at is null;
  get diagnostics n = row_count;
  perform pg_temp.check(n = 2, 'seen: both notifications shown are marked read in one update');
  perform pg_temp.check((select count(*) from public.notifications where user_id = 'f2502000-0000-0000-0000-0000000000a1'
      and read_at is null and kind <> 'MESSAGE_CREATED') = 1,
    'seen: the bell (unread, messages aside) now counts only the one not shown');
  perform pg_temp.as_admin();
  perform pg_temp.check((select read_at is not null from public.notifications where id = 'f2502000-0000-0000-0000-0000000000b1'),
    'seen: read_at is stored on the server (survives a restart, read by every phone)');
end $$;

-- 2. Marking again (a double tap, two phones, a retry) changes nothing: the first read time stays.
do $$
declare before timestamptz; n integer;
begin
  select read_at into before from public.notifications where id = 'f2502000-0000-0000-0000-0000000000b1';
  perform pg_temp.as_user('f2502000-0000-0000-0000-0000000000a1');
  update public.notifications set read_at = now() + interval '1 minute'
    where id in ('f2502000-0000-0000-0000-0000000000b1') and read_at is null;
  get diagnostics n = row_count;
  perform pg_temp.as_admin();
  perform pg_temp.check(n = 0 and (select read_at from public.notifications where id = 'f2502000-0000-0000-0000-0000000000b1') = before,
    'twice: an already read notification is not touched again');
end $$;

-- 3. Only your own: another member's notification cannot be read, marked or changed.
do $$
declare n integer;
begin
  perform pg_temp.as_user('f2502000-0000-0000-0000-0000000000a1');
  perform pg_temp.check(not exists (select 1 from public.notifications where id = 'f2502000-0000-0000-0000-0000000000c1'),
    'own: Ana cannot read Ben''s notification');
  update public.notifications set read_at = now() where id = 'f2502000-0000-0000-0000-0000000000c1' and read_at is null;
  get diagnostics n = row_count;
  perform pg_temp.as_admin();
  perform pg_temp.check(n = 0 and (select read_at is null from public.notifications where id = 'f2502000-0000-0000-0000-0000000000c1'),
    'own: Ana cannot mark Ben''s notification read');
end $$;

-- 4. Marking read touches read_at only: what a notification says cannot be rewritten.
do $$
begin
  perform pg_temp.as_user('f2502000-0000-0000-0000-0000000000a1');
  perform pg_temp.check(pg_temp.fails($q$update public.notifications set payload = '{"from": "x"}', read_at = now()
      where id = 'f2502000-0000-0000-0000-0000000000b3'$q$) = '42501',
    'frozen: the payload cannot be changed with the read time');
  perform pg_temp.check(pg_temp.fails($q$update public.notifications set kind = 'LIKE' where id = 'f2502000-0000-0000-0000-0000000000b3'$q$) = '42501',
    'frozen: the kind cannot be changed');
  perform pg_temp.as_admin();
  perform pg_temp.check((select read_at is null from public.notifications where id = 'f2502000-0000-0000-0000-0000000000b3'),
    'frozen: a refused update leaves it unread');
end $$;

-- 5. "Mark all as read" (the app's query): every bell notification, never a chat's message notices
--    (those are read by reading the chat).
do $$
begin
  perform pg_temp.as_user('f2502000-0000-0000-0000-0000000000a1');
  update public.notifications set read_at = now() where read_at is null and kind <> 'MESSAGE_CREATED';
  perform pg_temp.as_admin();
  perform pg_temp.check((select read_at is not null from public.notifications where id = 'f2502000-0000-0000-0000-0000000000b3'),
    'all: the remaining bell notification is read');
  perform pg_temp.check((select read_at is null from public.notifications where id = 'f2502000-0000-0000-0000-0000000000b4'),
    'all: a chat''s message notice stays for its chat');
  perform pg_temp.check((select read_at is null from public.notifications where id = 'f2502000-0000-0000-0000-0000000000c1'),
    'all: another member''s notifications are untouched');
end $$;

-- 6. Read is not deleted: marking read keeps the notification. Removing one is
--    a separate, explicit action of its owner (owner's decision of 2026-10-22:
--    opening it from the bell clears it; notifications_dismiss.test.sql checks
--    that only the owner can).
do $$
begin
  perform pg_temp.as_user('f2502000-0000-0000-0000-0000000000a1');
  perform pg_temp.check(exists (select 1 from public.notifications where id = 'f2502000-0000-0000-0000-0000000000b1' and read_at is not null),
    'history: a read notification is still listed (marking read deletes nothing)');
  perform pg_temp.as_admin();
end $$;

-- 7. The push of a notification carries its id (to mark it read and open its own page) and its screen.
do $$
declare m jsonb;
begin
  insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[ana-notif-open]', 'f2502000-0000-0000-0000-0000000000a1', 'ios')
    on conflict (token) do nothing;
  insert into public.push_outbox (notification_id, user_id, token, title, body, url)
  values ('f2502000-0000-0000-0000-0000000000b2', 'f2502000-0000-0000-0000-0000000000a1', 'ExponentPushToken[ana-notif-open]', 'IRLY', 'Ben started following you',
    '/person/f2502000-0000-0000-0000-0000000000a2');
  select private.push_message(o) into m from public.push_outbox o
    where o.notification_id = 'f2502000-0000-0000-0000-0000000000b2' order by o.id desc limit 1;
  perform pg_temp.check(m -> 'data' ->> 'notification_id' = 'f2502000-0000-0000-0000-0000000000b2',
    'push: the message carries its notification id');
  perform pg_temp.check(m -> 'data' ->> 'url' = '/person/f2502000-0000-0000-0000-0000000000a2'
      and m ->> 'to' = 'ExponentPushToken[ana-notif-open]' and m ->> 'title' = 'IRLY' and m ->> 'body' = 'Ben started following you'
      and m ->> 'channelId' = 'default' and m ->> 'priority' = 'high' and m ->> 'sound' = 'default',
    'push: the rest of the message is unchanged (screen, phone, text, channel)');
  -- Without pg_net (tests, local): sending is a no-op, never an error.
  perform private.push_send(array(select id from public.push_outbox where notification_id = 'f2502000-0000-0000-0000-0000000000b2'));
  perform pg_temp.check(true, 'push: push_send still runs');
end $$;

-- 8. Nobody calls the message builder from the app.
do $$
begin
  perform pg_temp.as_user('f2502000-0000-0000-0000-0000000000a1');
  perform pg_temp.check(pg_temp.fails($q$select private.push_message(o) from public.push_outbox o limit 1$q$) is not null,
    'push: members cannot build push messages');
  perform pg_temp.as_admin();
end $$;
