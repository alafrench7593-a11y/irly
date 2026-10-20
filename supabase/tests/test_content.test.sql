-- End-to-end test text hidden (migration 20261024009100_irly_test_content):
-- what a test account (e2e-…@irly.test) wrote, and the scripts' own texts
-- with a run stamp left with no author, are hidden the way the app hides
-- them; members' own texts are never touched, even one that reads like a
-- script text; nothing is erased but the notices. Ids use the prefix c9100000-…
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL test_content: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', false);

-- 0. The text rule.
select pg_temp.check(bool_and(private.e2e_text(t)), 'the scripts'' texts with any stamp are test texts')
from unnest(array['Who plays Saturday? mvdxpmvc', 'Hello from Mia mncukilg', 'Open coffee mvgq82y1', 'Padel crew mkuka8mf',
  'E2E mvdxpmvc: how long is the Emirates ID renewal?', 'E2E poll mvdxpmvc?',
  'Très bien, et toi ? mbonodxa', 'Photo club mjehuz5h Bali', 'Angel investor · Vera Capital mvdxpmvc']) t;
select pg_temp.check(not bool_or(private.e2e_text(t)), 'members'' texts are not, even close ones')
from unnest(array['Who plays Saturday?', 'Who plays Saturday? Me!', 'Hello from Mia', 'Open coffee at 9', 'Reply', 'Comment',
  'Morning marathon', 'marathon', 'mvdxpmvc', 'marathon renewal', 'Hello from Mia marathon tomorrow', 'Sync check please', '']) t;

-- The local auth.users shim has no email column; the live one has.
alter table auth.users add column if not exists email text;
insert into auth.users (id, email) values
  ('c9100000-0000-0000-0000-0000000000a1', 'rae@example.com'),
  ('c9100000-0000-0000-0000-0000000000a2', 'e2e-girl-mvdxpmvc-lea@irly.test');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c9100000-0000-0000-0000-0000000000a1', 'Rae', '1992-02-02', 'woman', 'dubai'),
  ('c9100000-0000-0000-0000-0000000000a2', 'Lea', '1995-04-04', 'woman', 'dubai');
insert into public.communities (id, city_id, name, created_by) values
  ('c9100000-0000-0000-0000-0000000000c1', 'dubai', 'Padel Marina', 'c9100000-0000-0000-0000-0000000000a1');
insert into public.community_members (community_id, user_id, role) values
  ('c9100000-0000-0000-0000-0000000000c1', 'c9100000-0000-0000-0000-0000000000a1', 'owner'),
  ('c9100000-0000-0000-0000-0000000000c1', 'c9100000-0000-0000-0000-0000000000a2', 'member');

insert into public.community_posts (id, community_id, author_id, body) values
  ('c9100000-0000-0000-0000-0000000000d1', 'c9100000-0000-0000-0000-0000000000c1', 'c9100000-0000-0000-0000-0000000000a1', 'Who plays Saturday?'),
  ('c9100000-0000-0000-0000-0000000000d2', 'c9100000-0000-0000-0000-0000000000c1', 'c9100000-0000-0000-0000-0000000000a2', 'Anything a test account wrote'),
  ('c9100000-0000-0000-0000-0000000000d3', 'c9100000-0000-0000-0000-0000000000c1', 'c9100000-0000-0000-0000-0000000000a1', 'Who plays Saturday? mvdxpmvc');
insert into public.comments (target_type, target_id, author_id, body) values
  ('community_post', 'c9100000-0000-0000-0000-0000000000d1', 'c9100000-0000-0000-0000-0000000000a1', 'Me! Reply'),
  ('community_post', 'c9100000-0000-0000-0000-0000000000d1', 'c9100000-0000-0000-0000-0000000000a2', 'Comment mvdxpmvc');
insert into public.conversations (id, kind, title) values
  ('c9100000-0000-0000-0000-0000000000e1', 'group', 'Padel crew mvdxpmvc'),
  ('c9100000-0000-0000-0000-0000000000e2', 'group', 'Padel crew'),
  ('c9100000-0000-0000-0000-0000000000e3', 'group', 'Padel crew marathon');
insert into public.conversation_members (conversation_id, user_id) values
  ('c9100000-0000-0000-0000-0000000000e1', 'c9100000-0000-0000-0000-0000000000a2'),
  ('c9100000-0000-0000-0000-0000000000e3', 'c9100000-0000-0000-0000-0000000000a1');
insert into public.messages (conversation_id, sender_id, body) values
  ('c9100000-0000-0000-0000-0000000000e1', null, 'Hello from Mia mncukilg'),
  ('c9100000-0000-0000-0000-0000000000e1', null, 'Hello from Mia'),
  ('c9100000-0000-0000-0000-0000000000e1', 'c9100000-0000-0000-0000-0000000000a1', 'Hello from Mia marathon tomorrow'),
  ('c9100000-0000-0000-0000-0000000000e1', 'c9100000-0000-0000-0000-0000000000a1', 'Open coffee marathon'),
  ('c9100000-0000-0000-0000-0000000000e1', 'c9100000-0000-0000-0000-0000000000a2', 'hi');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at) values
  ('c9100000-0000-0000-0000-0000000000f1', 'c9100000-0000-0000-0000-0000000000a1', 'Open coffee', 'food', 'dubai', 'marina', now() + interval '3 days'),
  ('c9100000-0000-0000-0000-0000000000f2', 'c9100000-0000-0000-0000-0000000000a2', 'Sunset walk', 'food', 'dubai', 'marina', now() + interval '3 days');
insert into public.irl_posts (author_id, city_id, area_id, body) values
  ('c9100000-0000-0000-0000-0000000000a1', 'dubai', 'marina', 'Live from the beach'),
  ('c9100000-0000-0000-0000-0000000000a2', 'dubai', 'marina', 'Live from Vera mvdxpmvc');
insert into public.pro_profiles (user_id, role, job_title, industries, city_id) values
  ('c9100000-0000-0000-0000-0000000000a1', 'founder', 'Founder', '{tech}', 'dubai'),
  ('c9100000-0000-0000-0000-0000000000a2', 'investor', 'Angel investor · Vera Capital mvdxpmvc', '{fintech}', 'dubai');
insert into public.community_broadcasts (community_id, body) values
  ('c9100000-0000-0000-0000-0000000000c1', 'E2E community brunch mvdxpmvc'),
  ('c9100000-0000-0000-0000-0000000000c1', 'Brunch on Sunday');

create temp table hidden as select private.irly_hide_test_content() as r;

select pg_temp.check((select deleted_at is null from public.community_posts where id = 'c9100000-0000-0000-0000-0000000000d1'), 'a member''s post is kept');
select pg_temp.check((select deleted_at is not null from public.community_posts where id = 'c9100000-0000-0000-0000-0000000000d2'), 'a test account''s post is hidden');
select pg_temp.check((select deleted_at is null from public.community_posts where id = 'c9100000-0000-0000-0000-0000000000d3'), 'a member''s post is kept even when it reads like a script text');
select pg_temp.check((select count(*) from public.community_posts where id::text like 'c9100000-%') = 3, '… posts kept as rows');
select pg_temp.check((select deleted_at is null from public.comments where body = 'Me! Reply'), 'a member''s comment is kept');
select pg_temp.check((select bool_and(deleted_at is not null) from public.comments where author_id = 'c9100000-0000-0000-0000-0000000000a2'), 'a test comment is hidden');
select pg_temp.check((select count(*) from public.messages where conversation_id = 'c9100000-0000-0000-0000-0000000000e1' and sender_id is null and deleted_at is not null) = 1, 'a message left with no sender is hidden');
select pg_temp.check(exists (select 1 from private.removed_content where source = 'messages' and body = 'Hello from Mia mncukilg'), '… its text kept for moderation');
select pg_temp.check((select deleted_at is null from public.messages where body = 'Hello from Mia'), 'the same words without a stamp are kept');
select pg_temp.check((select deleted_at is null from public.messages where body = 'Hello from Mia marathon tomorrow'), 'a member''s close message is kept');
select pg_temp.check((select deleted_at is null from public.messages where body = 'Open coffee marathon'), 'a member''s message that reads like a script text is kept');
select pg_temp.check((select deleted_at is not null from public.messages where sender_id = 'c9100000-0000-0000-0000-0000000000a2'), 'a test account''s message is hidden');
select pg_temp.check((select title from public.conversations where id = 'c9100000-0000-0000-0000-0000000000e1') = 'Padel crew', 'a group chat loses the stamp from its title');
select pg_temp.check((select title from public.conversations where id = 'c9100000-0000-0000-0000-0000000000e2') = 'Padel crew', 'a clean title is kept');
select pg_temp.check((select title from public.conversations where id = 'c9100000-0000-0000-0000-0000000000e3') = 'Padel crew marathon', 'a chat a real member is in keeps its title');
select pg_temp.check((select cancelled_at is null from public.activities where id = 'c9100000-0000-0000-0000-0000000000f1'), 'a member''s activity is kept');
select pg_temp.check((select cancelled_at is not null from public.activities where id = 'c9100000-0000-0000-0000-0000000000f2'), 'a test account''s activity is cancelled');
select pg_temp.check((select expires_at > now() or expires_at is null from public.irl_posts where body = 'Live from the beach'), 'a member''s live post is kept');
select pg_temp.check((select expires_at <= now() from public.irl_posts where body = 'Live from Vera mvdxpmvc'), 'a test live post has expired');
select pg_temp.check((select visible from public.pro_profiles where user_id = 'c9100000-0000-0000-0000-0000000000a1'), 'a member''s professional profile stays in Networking');
select pg_temp.check((select not visible from public.pro_profiles where user_id = 'c9100000-0000-0000-0000-0000000000a2'), 'a test professional profile leaves Networking');
select pg_temp.check((select count(*) from public.community_broadcasts where community_id = 'c9100000-0000-0000-0000-0000000000c1') = 1, 'only the test notice is removed');
select pg_temp.check(exists (select 1 from public.profiles where id = 'c9100000-0000-0000-0000-0000000000a2'), 'the test account itself is not deleted');
select pg_temp.check((select (r ->> 'messages')::int from hidden) = 2, 'two messages hidden, reported');
select pg_temp.check((select r from private.irly_hide_test_content() r) = '{"pro": 0, "live": 0, "chats": 0, "posts": 0, "notices": 0, "comments": 0, "messages": 0, "activities": 0}'::jsonb, 'running it again changes nothing');
