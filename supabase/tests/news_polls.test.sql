-- IRLY news polls (migration 20261101000000_irly_news_polls): the team
-- attaches a poll to a news item; members who may read the item vote once
-- and may change their answer; the poll is checked when written and can no
-- longer change once someone voted. TEST accounts only, ids c0c51000-….
--
--   01 Cleo   content staff              04 Rae   woman, IRLY Girl suspended
--   02 Mark   man, member                05 Sana  woman, suspended account
--   03 Wendy  woman, member (IRLY Girl)
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
revoke all on public.irly_news, public.irly_news_poll_votes from anon, authenticated;

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL news_polls: %', label; end if;
  raise notice 'ok  %', label;
end $$;
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;
create or replace function pg_temp.why(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlerrm;
end $$;

select pg_temp.as_admin();
insert into auth.users (id) values
  ('c0c51000-0000-0000-0000-000000000001'), ('c0c51000-0000-0000-0000-000000000002'), ('c0c51000-0000-0000-0000-000000000003'),
  ('c0c51000-0000-0000-0000-000000000004'), ('c0c51000-0000-0000-0000-000000000005');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c0c51000-0000-0000-0000-000000000001', 'Cleo', '1990-02-02', 'woman', 'dubai'),
  ('c0c51000-0000-0000-0000-000000000002', 'Mark', '1992-05-05', 'man', 'dubai'),
  ('c0c51000-0000-0000-0000-000000000003', 'Wendy', '1994-04-04', 'woman', 'dubai'),
  ('c0c51000-0000-0000-0000-000000000004', 'Rae', '1993-06-06', 'woman', 'dubai'),
  ('c0c51000-0000-0000-0000-000000000005', 'Sana', '1996-08-08', 'woman', 'dubai');
insert into public.staff_roles (user_id, role) values ('c0c51000-0000-0000-0000-000000000001', 'content');
insert into public.girl_suspensions (user_id, reason) values ('c0c51000-0000-0000-0000-000000000004', 'polls test');
insert into public.sanctions (user_id, kind, reason) values ('c0c51000-0000-0000-0000-000000000005', 'suspension', 'polls test');

create temp table ids (name text primary key, id uuid);
grant select, insert on ids to anon, authenticated;

-- ───────── The team writes a poll, checked ─────────
select pg_temp.as_user('c0c51000-0000-0000-0000-000000000001');
insert into ids values ('poll', public.admin_news_save(null,
  '{"title": "Your next IRLY night", "body": "Tell us which evening suits you.", "poll": {"question": " Which evening suits you? ", "options": ["Friday", " Saturday ", "", "Sunday"]}}'));
select pg_temp.check((public.admin_news_get((select id from ids where name = 'poll')) -> 'poll' -> 'question') = '"Which evening suits you?"',
  'the question is kept, trimmed');
select pg_temp.check((public.admin_news_get((select id from ids where name = 'poll')) -> 'poll' -> 'options') = '["Friday", "Saturday", "Sunday"]',
  'answers are trimmed, empty ones dropped');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "Bad poll", "poll": {"question": "Only one?", "options": ["Yes"]}}')$q$)
  = 'a poll needs 2 to 6 different answers', 'one answer: refused');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "Bad poll", "poll": {"question": "Twice?", "options": ["Yes", "yes"]}}')$q$)
  = 'a poll needs 2 to 6 different answers', 'the same answer twice: refused');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "Bad poll", "poll": {"question": "Seven?", "options": ["1","2","3","4","5","6","7"]}}')$q$)
  = 'a poll needs 2 to 6 different answers', 'seven answers: refused');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "Bad poll", "poll": {"question": "No", "options": ["A", "B"]}}')$q$)
  = 'a poll needs a question of 3 to 140 characters', 'a question too short: refused');
select pg_temp.check(pg_temp.fails($q$select public.admin_news_save(null, '{"title": "Bad poll", "poll": {"question": "Extra?", "options": ["A", "B"], "multi": true}}')$q$)
  = '22023', 'an unknown key in the poll: refused');
select pg_temp.check(pg_temp.fails($q$select public.admin_news_save(null, '{"title": "Bad poll", "poll": "Friday or Saturday?"}')$q$)
  = '22023', 'a poll that is not an object: refused');
select pg_temp.as_user('c0c51000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.fails($q$select public.admin_news_save(null, '{"title": "Hacked poll", "poll": {"question": "Hack?", "options": ["A", "B"]}}')$q$)
  = '42501', 'a member cannot write a news poll');

-- ───────── Votes only on a visible item, through the function ─────────
select pg_temp.check(pg_temp.fails(format('select public.news_poll_vote(%L, 0)', (select id from ids where name = 'poll'))) = 'P0002',
  'a draft''s poll takes no vote');
select pg_temp.as_user('c0c51000-0000-0000-0000-000000000001');
select public.admin_news_publish((select id from ids where name = 'poll'));
select pg_temp.as_user('c0c51000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.fails(format('insert into public.irly_news_poll_votes (news_id, user_id, option) values (%L, %L, 0)',
  (select id from ids where name = 'poll'), 'c0c51000-0000-0000-0000-000000000002')) = '42501', 'no direct write to the votes');
select pg_temp.check(pg_temp.fails('select count(*) from public.irly_news_poll_votes') = '42501', 'no direct read of who voted what');
select pg_temp.check((public.news_poll_vote((select id from ids where name = 'poll'), 0) -> 'counts') = '[1, 0, 0]', 'Mark votes Friday');
select pg_temp.check(pg_temp.fails(format('select public.news_poll_vote(%L, 3)', (select id from ids where name = 'poll'))) = '22023',
  'an answer that does not exist: refused');
select pg_temp.as_user('c0c51000-0000-0000-0000-000000000003');
select public.news_poll_vote((select id from ids where name = 'poll'), 1);
select pg_temp.as_user('c0c51000-0000-0000-0000-000000000002');
select pg_temp.check((public.news_poll_vote((select id from ids where name = 'poll'), 1) -> 'counts') = '[0, 2, 0]', 'Mark changes his answer: one vote each');
select pg_temp.check((public.news_item((select id from ids where name = 'poll')) -> 'poll' ->> 'my_vote') = '1'
  and (public.news_item((select id from ids where name = 'poll')) -> 'poll' ->> 'total') = '2', 'the article shows the counts and Mark''s answer');
select pg_temp.check(exists (select 1 from jsonb_array_elements(public.home_feed('mixte') -> 'news') x
  where x ->> 'id' = (select id::text from ids where name = 'poll') and (x ->> 'has_poll')::boolean and not x ? 'poll'),
  'the Home card says there is a poll, without the votes');
select pg_temp.as_anon();
select pg_temp.check(pg_temp.fails(format('select public.news_poll_vote(%L, 0)', (select id from ids where name = 'poll'))) = '42501',
  'signed out: no vote');
select pg_temp.check((public.news_item((select id from ids where name = 'poll')) -> 'poll' ->> 'my_vote') is null
  and (public.news_item((select id from ids where name = 'poll')) -> 'poll' ->> 'total') = '2', 'signed out: the counts, no answer of one''s own');
select pg_temp.as_user('c0c51000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.why(format('select public.news_poll_vote(%L, 0)', (select id from ids where name = 'poll'))) = 'your account is suspended',
  'a suspended account cannot vote');

-- ───────── Once people voted, the poll is fixed ─────────
select pg_temp.as_user('c0c51000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.why(format($q$select public.admin_news_save(%L, '{"poll": {"question": "Which evening suits you?", "options": ["Friday", "Saturday"]}}')$q$,
  (select id from ids where name = 'poll'))) = 'a poll cannot change once people voted', 'changing the answers after votes: refused');
select pg_temp.check(pg_temp.why(format($q$select public.admin_news_save(%L, '{"poll": null}')$q$, (select id from ids where name = 'poll')))
  = 'a poll cannot change once people voted', 'removing a voted poll: refused');
select pg_temp.check(pg_temp.fails(format($q$select public.admin_news_save(%L, '{"title": "Your next IRLY night out", "poll": {"question": "Which evening suits you?", "options": ["Friday", "Saturday", "Sunday"]}}')$q$,
  (select id from ids where name = 'poll'))) is null, 'the same poll sent again with another title: saved');
select pg_temp.check((public.admin_news_get((select id from ids where name = 'poll')) -> 'poll' ->> 'total') = '2', 'the team sees the total');

-- A poll without votes can still change or go.
insert into ids values ('fresh', public.admin_news_save(null, '{"title": "Draft with a poll", "poll": {"question": "Brunch or dinner?", "options": ["Brunch", "Dinner"]}}'));
select public.admin_news_save((select id from ids where name = 'fresh'), '{"poll": {"question": "Brunch, lunch or dinner?", "options": ["Brunch", "Lunch", "Dinner"]}}');
select pg_temp.check(jsonb_array_length(public.admin_news_get((select id from ids where name = 'fresh')) -> 'poll' -> 'options') = 3, 'no vote yet: the answers change');
select public.admin_news_save((select id from ids where name = 'fresh'), '{"poll": null}');
select pg_temp.check((public.admin_news_get((select id from ids where name = 'fresh')) -> 'poll') = 'null', 'no vote yet: the poll can be removed');

-- ───────── IRLY Girl items: only IRLY Girl members vote ─────────
insert into ids values ('girl', public.admin_news_save(null, '{"title": "Girls brunch", "body": "Pick the Saturday.", "audience": "girl", "poll": {"question": "Which Saturday?", "options": ["This one", "Next one"]}}'));
select public.admin_news_publish((select id from ids where name = 'girl'));
select pg_temp.as_user('c0c51000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.fails(format('select public.news_poll_vote(%L, 0)', (select id from ids where name = 'girl'))) = 'P0002', 'a man cannot vote on an IRLY Girl poll');
select pg_temp.as_user('c0c51000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails(format('select public.news_poll_vote(%L, 0)', (select id from ids where name = 'girl'))) = 'P0002', 'a suspended IRLY Girl member cannot vote');
select pg_temp.as_user('c0c51000-0000-0000-0000-000000000003');
select pg_temp.check((public.news_poll_vote((select id from ids where name = 'girl'), 0) -> 'counts') = '[1, 0]', 'an IRLY Girl member votes');

-- ───────── Unpublished: no more votes; deleting an account removes its votes ─────────
select pg_temp.as_user('c0c51000-0000-0000-0000-000000000001');
select public.admin_news_unpublish((select id from ids where name = 'poll'));
select pg_temp.as_user('c0c51000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.fails(format('select public.news_poll_vote(%L, 0)', (select id from ids where name = 'poll'))) = 'P0002', 'an unpublished item takes no vote');
select pg_temp.as_admin();
delete from auth.users where id = 'c0c51000-0000-0000-0000-000000000002';
select pg_temp.check((select count(*) from public.irly_news_poll_votes where news_id = (select id from ids where name = 'poll')) = 1,
  'a deleted account''s vote is gone, the others stay');
