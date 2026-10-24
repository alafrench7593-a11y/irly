-- Messaging, posts, Lives and sync, as two (or three) people on two phones
-- (final messaging / sync audit): what the app relies on when it retries,
-- pages, reconnects or opens something by id.
--   · a retry of a message or a post (same id, made on the phone) is one row;
--   · history pages (created_at, id) never repeat or skip a message, even
--     when several share the same instant;
--   · nobody reads or touches a chat they are not in by changing an id, and
--     nothing that Realtime would send (messages, removals, signals,
--     notifications, push tokens) reaches anyone else;
--   · a Live ends for everyone but its author when it expires, and an IRLY
--     Girl Live stays with IRLY Girl members.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed d2740000-….
--
--   a1 Mia   woman (IRLY Girl access), friends with Noah
--   a2 Noah  man, friends with Mia
--   a3 Omar  man, a stranger who tries every id he can get
--   a4 Pia   woman (IRLY Girl access), a stranger to the others
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
select private.restrict_profile_columns();

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('request.jwt.claims', '', false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
end $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL msgsync: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;
-- The SQLSTATE a statement fails with, or null when it succeeds.
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;
-- Rows a statement touches (0 when RLS hides them all, -1 when it fails).
create or replace function pg_temp.touched(stmt text) returns integer language plpgsql as $$
declare n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when others then
  return -1;
end $$;
-- Rows a query returns as the current role (-1 when it is refused).
create or replace function pg_temp.rows(q text) returns integer language plpgsql as $$
declare n integer;
begin
  execute format('select count(*) from (%s) x', q) into n;
  return n;
exception when others then
  return -1;
end $$;

select pg_temp.as_admin();
insert into auth.users (id) select ('d2740000-0000-0000-0000-0000000000a' || n)::uuid from generate_series(1, 4) n;
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('d2740000-0000-0000-0000-0000000000a1', 'Mia', '1995-02-02', 'woman', 'dubai'),
  ('d2740000-0000-0000-0000-0000000000a2', 'Noah', '1993-04-04', 'man', 'dubai'),
  ('d2740000-0000-0000-0000-0000000000a3', 'Omar', '1990-06-06', 'man', 'dubai'),
  ('d2740000-0000-0000-0000-0000000000a4', 'Pia', '1996-08-08', 'woman', 'dubai');
insert into public.friendships (user_a, user_b, status, requested_by) values
  ('d2740000-0000-0000-0000-0000000000a1', 'd2740000-0000-0000-0000-0000000000a2', 'accepted', 'd2740000-0000-0000-0000-0000000000a1');

-- ───────── 1. One chat for the pair, and a retried message is one message ─────────
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a1');
select public.open_direct('d2740000-0000-0000-0000-0000000000a2') as conv \gset
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a2');
select pg_temp.check(public.open_direct('d2740000-0000-0000-0000-0000000000a1') = :'conv', 'Noah opens the chat from Mia''s profile: the one Mia opened');

select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a1');
insert into public.messages (id, conversation_id, sender_id, body)
values ('d2740000-0000-0000-0000-0000000000e1', :'conv', 'd2740000-0000-0000-0000-0000000000a1', 'msgsync hello Noah');
-- The answer was lost: the phone sends the same message (same id) again.
select pg_temp.check(pg_temp.fails($$insert into public.messages (id, conversation_id, sender_id, body)
  values ('d2740000-0000-0000-0000-0000000000e1', '$$ || :'conv' || $$', 'd2740000-0000-0000-0000-0000000000a1', 'msgsync hello Noah')$$) = '23505',
  'a resend of the same message is refused as a duplicate (the app reads it back as sent)');
select pg_temp.check((select count(*) = 1 from public.messages where id = 'd2740000-0000-0000-0000-0000000000e1'), '… and the sender reads it back, once');
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.rows($$select 1 from public.messages where conversation_id = '$$ || :'conv' || $$'$$) = 1, 'Noah has exactly one copy');
select pg_temp.check((select unread = 1 from public.my_conversations() where conversation_id = :'conv'), 'and one unread, not two');
-- Another member cannot take over the id of a message (it stays Mia's).
select pg_temp.check(pg_temp.fails($$insert into public.messages (id, conversation_id, sender_id, body)
  values ('d2740000-0000-0000-0000-0000000000e1', '$$ || :'conv' || $$', 'd2740000-0000-0000-0000-0000000000a2', 'not mine')$$) is not null
  and (select body = 'msgsync hello Noah' and sender_id = 'd2740000-0000-0000-0000-0000000000a1' from public.messages where id = 'd2740000-0000-0000-0000-0000000000e1'),
  'an id already used cannot be overwritten by the other member');

-- ───────── 2. History pages never repeat nor skip a message ─────────
-- Six messages in the same instant (one transaction), then older and newer ones.
select pg_temp.as_admin();
insert into public.messages (id, conversation_id, sender_id, body, created_at)
select ('d2740000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid, :'conv',
  case when n % 2 = 0 then 'd2740000-0000-0000-0000-0000000000a1'::uuid else 'd2740000-0000-0000-0000-0000000000a2'::uuid end,
  'msgsync page ' || n,
  case when n <= 3 then now() - interval '2 hours' + n * interval '1 second'
       when n <= 9 then now() - interval '1 hour'
       else now() - interval '30 minutes' + n * interval '1 second' end
from generate_series(1, 12) n;
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a2');
-- The thread's pages as the app asks them (newest first, then "older than the first one shown").
create temp table pages_seen (id uuid, page int);
grant all on pages_seen to authenticated;
do $$
declare
  n int := 0;
  first_at timestamptz;
  first_id uuid;
  got int;
  conv uuid := (select conversation_id from public.messages where id = 'd2740000-0000-0000-0000-0000000000e1');
begin
  loop
    n := n + 1;
    insert into pages_seen
    select m.id, n from public.messages m
    where m.conversation_id = conv and m.deleted_at is null
      and (first_at is null or m.created_at < first_at or (m.created_at = first_at and m.id < first_id))
    order by m.created_at desc, m.id desc
    limit 4;
    get diagnostics got = row_count;
    exit when got < 4 or n > 10;
    select m.created_at, m.id into first_at, first_id
    from public.messages m join pages_seen s on s.id = m.id and s.page = n
    order by m.created_at, m.id limit 1;
  end loop;
end $$;
select pg_temp.check((select count(*) = count(distinct id) from pages_seen), 'paging the history: no message shown twice');
select pg_temp.check((select count(*) from pages_seen) = (select count(*) from public.messages where conversation_id = :'conv'), 'paging the history: no message skipped (six share one instant)');

-- ───────── 3. A stranger with the chat's id and a message's id ─────────
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.rows($$select 1 from public.messages where conversation_id = '$$ || :'conv' || $$'$$) = 0, 'Omar reads no message of their chat by its id');
select pg_temp.check(pg_temp.rows($$select 1 from public.messages where id = 'd2740000-0000-0000-0000-0000000000e1'$$) = 0, '… nor one message by its id');
select pg_temp.check(pg_temp.rows($$select 1 from public.conversations where id = '$$ || :'conv' || $$'$$) = 0, '… nor the chat itself (the app says it is not available)');
select pg_temp.check(pg_temp.rows($$select 1 from public.conversation_members where conversation_id = '$$ || :'conv' || $$'$$) = 0, '… nor who is in it');
select pg_temp.check(coalesce(pg_temp.rows($$select * from public.chat_members('$$ || :'conv' || $$')$$), 0) <= 0, '… nor its member list (chat_members)');
select pg_temp.check(not exists (select 1 from public.my_conversations() where conversation_id = :'conv'), '… and it is not in his inbox');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, body)
  values ('$$ || :'conv' || $$', 'd2740000-0000-0000-0000-0000000000a3', 'msgsync intruder')$$) is not null, 'he cannot write in it');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, body)
  values ('$$ || :'conv' || $$', 'd2740000-0000-0000-0000-0000000000a1', 'msgsync as Mia')$$) is not null, '… nor write as Mia');
select pg_temp.check(pg_temp.fails($$select public.delete_my_message('d2740000-0000-0000-0000-0000000000e1')$$) is not null, 'he cannot delete Mia''s message for everyone');
select pg_temp.check(pg_temp.fails($$select public.hide_message_for_me('d2740000-0000-0000-0000-0000000000e1')$$) is not null, '… nor hide it (it is not his to see)');
select pg_temp.check(pg_temp.fails($$select public.set_conversation_archived('$$ || :'conv' || $$', true)$$) is not null, '… nor archive their chat');
select pg_temp.check(pg_temp.fails($$select public.remove_conversation_for_me('$$ || :'conv' || $$')$$) is not null, '… nor remove it');
select pg_temp.check(pg_temp.fails($$select public.share_to_chat('$$ || :'conv' || $$', 'profile', 'd2740000-0000-0000-0000-0000000000a3', 'me')$$) is not null, '… nor share something into it');
select pg_temp.check(pg_temp.touched($$update public.messages set body = 'changed' where id = 'd2740000-0000-0000-0000-0000000000e1'$$) <= 0, '… nor edit a message');
select pg_temp.check(pg_temp.touched($$update public.conversation_members set last_read_at = now() where conversation_id = '$$ || :'conv' || $$'$$) <= 0, '… nor change anyone''s read state');
select pg_temp.check(pg_temp.touched($$insert into public.conversation_members (conversation_id, user_id) values ('$$ || :'conv' || $$', 'd2740000-0000-0000-0000-0000000000a3')$$) <= 0, '… nor add himself to the chat');
select pg_temp.as_admin();
select pg_temp.check((select count(*) = 2 from public.conversation_members where conversation_id = :'conv')
  and (select body = 'msgsync hello Noah' and deleted_at is null from public.messages where id = 'd2740000-0000-0000-0000-0000000000e1'),
  'after all that, the chat and its message are untouched');

-- ───────── 4. Deleted for everyone: the other member hears it, nobody else ─────────
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a1');
select public.delete_my_message('d2740000-0000-0000-0000-0000000000e1');
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.rows($$select 1 from public.messages where id = 'd2740000-0000-0000-0000-0000000000e1'$$) = 0, 'deleted by Mia: gone for Noah (a refresh or catch-up drops it)');
select pg_temp.check(pg_temp.rows($$select 1 from public.message_removals where message_id = 'd2740000-0000-0000-0000-0000000000e1'$$) = 1, '… and the removal row (what Realtime sends him) is his to read');
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.rows($$select 1 from public.message_removals where conversation_id = '$$ || :'conv' || $$'$$) = 0, 'Omar hears no removal of a chat he is not in');

-- ───────── 5. What Realtime would send: each person's own rows only ─────────
select pg_temp.as_admin();
insert into public.notifications (id, user_id, kind, payload) values
  ('d2740000-0000-0000-0000-0000000000f1', 'd2740000-0000-0000-0000-0000000000a1', 'MESSAGE_CREATED',
   jsonb_build_object('conversation_id', :'conv', 'from', 'd2740000-0000-0000-0000-0000000000a2'));
insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[msgsync-mia-0001]', 'd2740000-0000-0000-0000-0000000000a1', 'ios');
insert into public.sync_signals (user_id, kind, ref) values ('d2740000-0000-0000-0000-0000000000a1', 'inbox', :'conv');
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.rows($$select 1 from public.notifications where id = 'd2740000-0000-0000-0000-0000000000f1'$$) = 0,
  'a phone notification tapped on Omar''s phone with Mia''s notification id opens nothing of hers');
select pg_temp.check(pg_temp.touched($$update public.notifications set read_at = now() where id = 'd2740000-0000-0000-0000-0000000000f1'$$) <= 0, '… and cannot mark it read');
select pg_temp.check(pg_temp.rows($$select 1 from public.push_tokens where user_id = 'd2740000-0000-0000-0000-0000000000a1'$$) = 0, 'nobody reads Mia''s push tokens');
select pg_temp.check(pg_temp.rows($$select 1 from public.sync_signals where user_id = 'd2740000-0000-0000-0000-0000000000a1'$$) = 0, 'nobody reads Mia''s sync signals');
select pg_temp.check(pg_temp.touched($$insert into public.sync_signals (user_id, kind) values ('d2740000-0000-0000-0000-0000000000a1', 'inbox')$$) <= 0, '… nor sends her one');
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.rows($$select 1 from public.notifications where id = 'd2740000-0000-0000-0000-0000000000f1'$$) = 1, 'Mia opens her own notification by its id (cold start from a push)');
select pg_temp.check(pg_temp.touched($$update public.notifications set read_at = now() where id = 'd2740000-0000-0000-0000-0000000000f1' and read_at is null$$) = 1, '… and marks it read once');
select pg_temp.check(pg_temp.touched($$update public.notifications set read_at = now() where id = 'd2740000-0000-0000-0000-0000000000f1' and read_at is null$$) = 0, '… a second tap (or the same push heard twice) changes nothing');

-- ───────── 6. A post sent twice (lost answer) is one post ─────────
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a1');
insert into public.community_posts (id, community_id, author_id, body)
values ('d2740000-0000-0000-0000-0000000000b1', null, 'd2740000-0000-0000-0000-0000000000a1', 'msgsync my first post');
select pg_temp.check(pg_temp.fails($$insert into public.community_posts (id, community_id, author_id, body)
  values ('d2740000-0000-0000-0000-0000000000b1', null, 'd2740000-0000-0000-0000-0000000000a1', 'msgsync my first post')$$) = '23505',
  'Post tapped again with the same id: refused as a duplicate (the app takes it as posted)');
select pg_temp.check((select count(*) = 1 from public.community_posts where id = 'd2740000-0000-0000-0000-0000000000b1'), '… one post, readable by its author at once');
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails($$insert into public.community_posts (id, community_id, author_id, body)
  values ('d2740000-0000-0000-0000-0000000000b1', null, 'd2740000-0000-0000-0000-0000000000a3', 'msgsync taken over')$$) is not null, 'Omar cannot reuse the id of Mia''s post');
select pg_temp.check(pg_temp.fails($$insert into public.community_posts (community_id, author_id, body)
  values (null, 'd2740000-0000-0000-0000-0000000000a1', 'msgsync as Mia')$$) is not null, '… nor post as Mia');
select pg_temp.check(pg_temp.touched($$update public.community_posts set body = 'msgsync edited by Omar' where id = 'd2740000-0000-0000-0000-0000000000b1'$$) <= 0, '… nor edit her post');
select pg_temp.check(pg_temp.touched($$update public.community_posts set deleted_at = now() where id = 'd2740000-0000-0000-0000-0000000000b1'$$) <= 0, '… nor remove it');
select pg_temp.as_admin();
select pg_temp.check((select body = 'msgsync my first post' and author_id = 'd2740000-0000-0000-0000-0000000000a1' and deleted_at is null
  from public.community_posts where id = 'd2740000-0000-0000-0000-0000000000b1'), 'her post is unchanged');

-- ───────── 7. Lives: up for 24 hours, then only its author keeps it ─────────
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a1');
insert into public.irl_posts (id, author_id, city_id, area_id, body, visibility)
values ('d2740000-0000-0000-0000-0000000000c1', 'd2740000-0000-0000-0000-0000000000a1', 'dubai', 'marina', 'msgsync coffee at the marina?', 'everyone');
select pg_temp.check(pg_temp.fails($$insert into public.irl_posts (author_id, city_id, area_id, body, visibility, expires_at)
  values ('d2740000-0000-0000-0000-0000000000a1', 'dubai', 'marina', 'msgsync forever', 'everyone', now() + interval '2 days')$$) is not null,
  'a Live cannot be made to last more than 24 hours');
select pg_temp.check(pg_temp.fails($$insert into public.irl_posts (author_id, city_id, area_id, body, visibility, expires_at)
  values ('d2740000-0000-0000-0000-0000000000a1', 'dubai', 'dubai', 'msgsync all day, no neighbourhood', 'everyone', now() + interval '20 hours')$$) is null,
  'a Live can last 20 hours, with the city instead of a neighbourhood');
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.rows($$select 1 from public.irl_posts where id = 'd2740000-0000-0000-0000-0000000000c1'$$) = 1, 'Noah sees Mia''s Live while it is up');
select pg_temp.as_admin();
update public.irl_posts set created_at = now() - interval '5 hours', expires_at = now() - interval '1 hour' where id = 'd2740000-0000-0000-0000-0000000000c1';
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.rows($$select 1 from public.irl_posts where id = 'd2740000-0000-0000-0000-0000000000c1'$$) = 0, 'ended: Noah no longer reads it, even by its id');
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.rows($$select 1 from public.irl_posts where id = 'd2740000-0000-0000-0000-0000000000c1'$$) = 1, '… Mia still has it (her profile''s past Lives)');

-- An IRLY Girl Live: Pia (IRLY Girl) sees it, Omar and Noah never do.
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a1');
insert into public.irl_posts (id, author_id, city_id, area_id, body, visibility, app_scope)
values ('d2740000-0000-0000-0000-0000000000c2', 'd2740000-0000-0000-0000-0000000000a1', 'dubai', 'marina', 'msgsync girls brunch', 'everyone', 'irly_girl');
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a4');
select pg_temp.check(pg_temp.rows($$select 1 from public.irl_posts where id = 'd2740000-0000-0000-0000-0000000000c2'$$) = 1, 'an IRLY Girl Live is seen by an IRLY Girl member');
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.rows($$select 1 from public.irl_posts where id = 'd2740000-0000-0000-0000-0000000000c2'$$) = 0, '… never by a man, even by its id');
select pg_temp.check(pg_temp.fails($$insert into public.irl_posts (author_id, city_id, area_id, body, visibility, app_scope)
  values ('d2740000-0000-0000-0000-0000000000a3', 'dubai', 'marina', 'msgsync not allowed', 'everyone', 'irly_girl')$$) is not null, '… who cannot post one either');
select pg_temp.as_user('d2740000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.rows($$select 1 from public.irl_posts where id = 'd2740000-0000-0000-0000-0000000000c2'$$) = 0, '… nor by Mia''s friend Noah');

select pg_temp.as_admin();
drop table pages_seen;
