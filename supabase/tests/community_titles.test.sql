-- Community titles (migration 20261024007100_irly_community_titles): no
-- community IRLY lists is titled by a code, the fix keeps every community's
-- id, members, posts and chat, never touches a name a member chose, and an
-- account deleted straight from auth.users leaves no orphan behind. Runs after
-- irly_test.sql on the same database (scripts/test-db.sh); ids use the prefix
-- c7100000-…
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
    raise exception 'FAIL community_titles: %', label;
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

-- 0. The word rule (same cases as scripts/test-community-names.mts).
select pg_temp.check(bool_and(private.community_word_is_technical(w)), 'codes are codes')
from unnest(array['mvgq82y1', 'mv00tl2o', 'abc12345', '#12345', '123456', '3f2a91c0', '3f2a91c0-7d4e-4b1a-9c2d-0e5f6a7b8c9d']) w;
select pg_temp.check(not bool_or(private.community_word_is_technical(w)), 'words are words')
from unnest(array['Padel', '2026', '5K', '42km', 'bali2026', 'cafe2024', '4x4', 'Web3', '(0–1)', '(12+)', 'marathon', 'IRLY']) w;
select pg_temp.check(private.community_clean_name('Girls Padel mvgq82y1') = 'Girls Padel', 'clean: run stamp dropped');
select pg_temp.check(private.community_clean_name('Padel · 3f2a91c0') = 'Padel', 'clean: separator dropped with the code');
select pg_temp.check(private.community_clean_name('abc12345') is null, 'clean: nothing left is null');
select pg_temp.check(private.community_fallback_name('gym', null, 'dubai') = 'Gym & Fitness · Dubai', 'fallback: topic and city');
select pg_temp.check(private.community_fallback_name(null, 'sport', 'abudhabi') = 'Sport · Abu Dhabi', 'fallback: category and city');

-- 1. After every migration: nothing IRLY runs is titled by a code.
select pg_temp.check(not exists (
  select 1 from public.communities where deleted_at is null and (created_by is null or official) and private.community_name_is_technical(name)
), 'no IRLY or orphaned community has a code in its title');

-- The seeded names with numbers stay as they are.
-- Since 20261029900000 IRLY Mom Community's groups (the seeded names with numbers) are removed, kept as rows: still checked.
create temp table seeded_digits as select id, name from public.communities where official and parent_id is not null and name ~ '[0-9]';
select pg_temp.check((select count(*) from seeded_digits) > 0, 'seeded names with numbers exist (Bump & babies (0–1)…)');

-- 2. Leftovers as the live server has them: created by a test account since deleted.
insert into auth.users (id) values
  ('c7100000-0000-0000-0000-0000000000a1'), ('c7100000-0000-0000-0000-0000000000a2'), ('c7100000-0000-0000-0000-0000000000a3'),
  ('c7100000-0000-0000-0000-0000000000a4'), ('c7100000-0000-0000-0000-0000000000a5'), ('c7100000-0000-0000-0000-0000000000a6');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c7100000-0000-0000-0000-0000000000a1', 'Rae', '1992-02-02', 'woman', 'bali'),
  ('c7100000-0000-0000-0000-0000000000a2', 'Sol', '1991-01-01', 'man', 'dubai'),
  ('c7100000-0000-0000-0000-0000000000a3', 'Mia', '1995-04-04', 'woman', 'dubai'),
  ('c7100000-0000-0000-0000-0000000000a4', 'Lea', '1995-04-04', 'woman', 'dubai'),
  ('c7100000-0000-0000-0000-0000000000a5', 'Tom', '1990-06-06', 'man', 'dubai'),
  ('c7100000-0000-0000-0000-0000000000a6', 'Uma', '1994-07-07', 'woman', 'dubai');

insert into public.communities (id, city_id, name, category_id, created_by) values
  ('c7100000-0000-0000-0000-0000000000c1', 'dubai', 'Girls Padel mvgq82y1', null, null),
  ('c7100000-0000-0000-0000-0000000000c2', 'bali', 'Sync club mv00tl2o', null, null),
  ('c7100000-0000-0000-0000-0000000000c3', 'bali', 'Photo club Bali', null, null),
  ('c7100000-0000-0000-0000-0000000000c4', 'bali', 'Photo club mvgq82y1 Bali', null, null),
  ('c7100000-0000-0000-0000-0000000000c5', 'dubai', 'abc12345', 'sport', null),
  ('c7100000-0000-0000-0000-0000000000c6', 'dubai', '#12345', null, null),
  ('c7100000-0000-0000-0000-0000000000c7', 'dubai', 'Padel abc12345', null, 'c7100000-0000-0000-0000-0000000000a2'),
  ('c7100000-0000-0000-0000-0000000000c8', 'bali', 'Sync club', null, null),
  ('c7100000-0000-0000-0000-0000000000c9', 'bali', 'Sync club mvgq82y9', null, null);
-- Real members in all but the first (an empty leftover).
insert into public.community_members (community_id, user_id, role)
select c, 'c7100000-0000-0000-0000-0000000000a1', 'member'
from unnest(array['c7100000-0000-0000-0000-0000000000c2', 'c7100000-0000-0000-0000-0000000000c3', 'c7100000-0000-0000-0000-0000000000c4',
                  'c7100000-0000-0000-0000-0000000000c5', 'c7100000-0000-0000-0000-0000000000c6', 'c7100000-0000-0000-0000-0000000000c8',
                  'c7100000-0000-0000-0000-0000000000c9']::uuid[]) c;
insert into public.community_members (community_id, user_id, role) values ('c7100000-0000-0000-0000-0000000000c7', 'c7100000-0000-0000-0000-0000000000a2', 'owner');
insert into public.community_posts (id, community_id, author_id, body) values
  ('c7100000-0000-0000-0000-0000000000d2', 'c7100000-0000-0000-0000-0000000000c2', 'c7100000-0000-0000-0000-0000000000a1', 'Before the rename');
select pg_temp.check((select title from public.conversations where community_id = 'c7100000-0000-0000-0000-0000000000c2') = 'Sync club mv00tl2o', 'the leftover chat carries the code');
create temp table chat_before as select community_id, id from public.conversations where community_id::text like 'c7100000-%';

select pg_temp.check(private.irly_community_titles() = 6, 'six titles fixed (clean names and the member''s own name are not)');

select pg_temp.check((select deleted_at is not null from public.communities where id = 'c7100000-0000-0000-0000-0000000000c1'), 'an empty leftover leaves the lists');
select pg_temp.check((select count(*) from public.communities where id = 'c7100000-0000-0000-0000-0000000000c1') = 1, '… its row is kept (moderation history)');
select pg_temp.check((select name from public.communities where id = 'c7100000-0000-0000-0000-0000000000c2') = 'Sync club · Bali', 'a duplicate gets its city, not a code');
select pg_temp.check((select name from public.communities where id = 'c7100000-0000-0000-0000-0000000000c9') = 'Sync club · Bali (2)', 'a second duplicate is counted readably');
select pg_temp.check((select name from public.communities where id = 'c7100000-0000-0000-0000-0000000000c4') = 'Photo club Bali (2)', 'a name with the city already gets a count');
select pg_temp.check((select name from public.communities where id = 'c7100000-0000-0000-0000-0000000000c5') = 'Sport · Dubai', 'a code alone becomes its category and city');
select pg_temp.check((select name from public.communities where id = 'c7100000-0000-0000-0000-0000000000c6') = 'Community · Dubai', 'a code with nothing else becomes Community and its city');
select pg_temp.check((select name from public.communities where id = 'c7100000-0000-0000-0000-0000000000c7') = 'Padel abc12345', 'a name a member chose is never touched');
select pg_temp.check((select name from public.communities where id = 'c7100000-0000-0000-0000-0000000000c3') = 'Photo club Bali', 'a clean name is never touched');
select pg_temp.check((select count(*) from public.communities where id::text like 'c7100000-%' and deleted_at is null and id <> 'c7100000-0000-0000-0000-0000000000c1') = 8, 'renamed in place: no community deleted or created');
select pg_temp.check((select count(*) from public.community_members where community_id::text like 'c7100000-%') = 8, 'members kept');
select pg_temp.check(exists (select 1 from public.community_posts where id = 'c7100000-0000-0000-0000-0000000000d2' and community_id = 'c7100000-0000-0000-0000-0000000000c2' and deleted_at is null), 'posts kept');
select pg_temp.check((select v.id from public.conversations v where v.community_id = 'c7100000-0000-0000-0000-0000000000c2') = (select id from chat_before where community_id = 'c7100000-0000-0000-0000-0000000000c2'), 'same chat');
select pg_temp.check((select title from public.conversations where community_id = 'c7100000-0000-0000-0000-0000000000c2') = 'Sync club · Bali', 'the chat follows the new title');
select pg_temp.check(exists (select 1 from public.conversation_members cm join public.conversations v on v.id = cm.conversation_id
  where v.community_id = 'c7100000-0000-0000-0000-0000000000c2' and cm.user_id = 'c7100000-0000-0000-0000-0000000000a1'), 'members still in the chat');
select pg_temp.check((select count(*) from (select lower(name), city_id from public.communities where deleted_at is null group by 1, 2 having count(*) > 1) d
  where d.city_id = 'bali' and d.lower like 'sync club%') = 0, 'no two Bali communities share a fixed name');
select pg_temp.check(private.irly_community_titles() = 0, 'safe to run again');
select pg_temp.check((select count(*) from seeded_digits s join public.communities c on c.id = s.id and c.name = s.name) = (select count(*) from seeded_digits), 'seeded names with numbers unchanged');

-- 3. Members cannot run it, or the helpers.
select pg_temp.as_user('c7100000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails('select private.irly_community_titles()') = '42501', 'members cannot run the fix');
select pg_temp.check(pg_temp.fails('select private.community_clean_name(''x'')') = '42501', 'members cannot call the helpers');
select pg_temp.as_admin();

-- 4. The generator: an e2e run (Mia creates, Lea joins), its accounts deleted
-- straight from auth.users, in one statement: no orphan left in any order.
select pg_temp.as_user('c7100000-0000-0000-0000-0000000000a3');
create temp table run_club as select public.create_community('Girls Padel mvgq83z2', 'dubai') as id;
select pg_temp.as_user('c7100000-0000-0000-0000-0000000000a4');
select public.join_community((select id from run_club));
select pg_temp.as_user('c7100000-0000-0000-0000-0000000000a5');
create temp table lone_club as select public.create_community('Book & Matcha mvgq83z3', 'dubai') as id;
select pg_temp.as_admin();
-- Lea's account goes first here: Mia's community still has Mia.
delete from auth.users where id = 'c7100000-0000-0000-0000-0000000000a4';
select pg_temp.check((select deleted_at is null from public.communities where id = (select id from run_club)), 'a community with members left stays');
delete from auth.users where id in ('c7100000-0000-0000-0000-0000000000a3', 'c7100000-0000-0000-0000-0000000000a5');
select pg_temp.check((select deleted_at is not null from public.communities where id = (select id from run_club)), 'the creator deleted last: the community goes');
select pg_temp.check((select deleted_at is not null from public.communities where id = (select id from lone_club)), 'a lone creator deleted: the community goes');
select pg_temp.check(not exists (select 1 from public.conversation_members cm join public.conversations v on v.id = cm.conversation_id
  where v.community_id in (select id from run_club union select id from lone_club)), 'their chats left every inbox');

-- The other order: the creator first, then the last member (the orphan is remembered).
select pg_temp.as_user('c7100000-0000-0000-0000-0000000000a6');
create temp table orphan_club as select public.create_community('Sunset Yoga', 'dubai') as id;
select pg_temp.as_user('c7100000-0000-0000-0000-0000000000a1');
select public.join_community((select id from orphan_club));
select pg_temp.as_admin();
delete from auth.users where id = 'c7100000-0000-0000-0000-0000000000a6';
select pg_temp.check((select deleted_at is null and created_by is null and name = 'Sunset Yoga' from public.communities where id = (select id from orphan_club)), 'creator gone, a member left: the community stays with its name');
select pg_temp.check(exists (select 1 from public.community_members where community_id = (select id from orphan_club) and user_id = 'c7100000-0000-0000-0000-0000000000a1'), '… and its member');
-- A seeded IRLY community (no creator ever) whose only member leaves the same way is kept.
create temp table seeded as select id from public.communities where created_by is null and not official and deleted_at is null and parent_id is null
  and not exists (select 1 from public.community_members m where m.community_id = communities.id) limit 1;
insert into public.community_members (community_id, user_id, role) select id, 'c7100000-0000-0000-0000-0000000000a2', 'member' from seeded;
delete from auth.users where id = 'c7100000-0000-0000-0000-0000000000a1';
select pg_temp.check((select deleted_at is not null from public.communities where id = (select id from orphan_club)), 'its last member deleted too: the orphan goes');
delete from auth.users where id = 'c7100000-0000-0000-0000-0000000000a2';
select pg_temp.check((select count(*) from seeded) = 1 and (select deleted_at is null from public.communities where id = (select id from seeded)), 'a seeded IRLY community is never removed with a member');
select pg_temp.check((select deleted_at is not null from public.communities where id = 'c7100000-0000-0000-0000-0000000000c7'), 'a member''s own community goes with its owner when nobody else is in');

-- 5. Likes: one per member, counters that match the rows.
insert into auth.users (id) values ('c7100000-0000-0000-0000-0000000000b1'), ('c7100000-0000-0000-0000-0000000000b2'), ('c7100000-0000-0000-0000-0000000000b3');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c7100000-0000-0000-0000-0000000000b1', 'Ivy', '1992-02-02', 'woman', 'dubai'),
  ('c7100000-0000-0000-0000-0000000000b2', 'Jon', '1991-01-01', 'man', 'dubai'),
  ('c7100000-0000-0000-0000-0000000000b3', 'Kim', '1990-03-03', 'woman', 'dubai');
select pg_temp.as_user('c7100000-0000-0000-0000-0000000000b1');
create temp table like_club as select public.create_community('Like test club', 'dubai') as id;
insert into public.community_posts (id, community_id, author_id, body)
values ('c7100000-0000-0000-0000-0000000000e1', (select id from like_club), 'c7100000-0000-0000-0000-0000000000b1', 'Padel Saturday?');
select pg_temp.as_user('c7100000-0000-0000-0000-0000000000b2');
select public.join_community((select id from like_club));
select pg_temp.check(public.toggle_like('community_post', 'c7100000-0000-0000-0000-0000000000e1'), 'a member likes the post');
select pg_temp.check((select likes = 1 and liked from public.engagement('community_post', array['c7100000-0000-0000-0000-0000000000e1'])), 'counter 1, liked');
select pg_temp.check(pg_temp.fails($q$insert into public.likes (user_id, target_type, target_id) values ('c7100000-0000-0000-0000-0000000000b2', 'community_post', 'c7100000-0000-0000-0000-0000000000e1')$q$) is not null, 'no second like by the same member');
select pg_temp.check(pg_temp.fails($q$insert into public.likes (user_id, target_type, target_id) values ('c7100000-0000-0000-0000-0000000000b1', 'community_post', 'c7100000-0000-0000-0000-0000000000e1')$q$) is not null, 'nobody likes in someone else''s name');
select pg_temp.as_user('c7100000-0000-0000-0000-0000000000b1');
select pg_temp.check(public.toggle_like('community_post', 'c7100000-0000-0000-0000-0000000000e1'), 'the author likes it too');
select pg_temp.check((select likes = 2 from public.engagement('community_post', array['c7100000-0000-0000-0000-0000000000e1'])), 'counter 2');
select pg_temp.as_user('c7100000-0000-0000-0000-0000000000b2');
select pg_temp.check(not public.toggle_like('community_post', 'c7100000-0000-0000-0000-0000000000e1'), 'a second tap unlikes');
select pg_temp.check((select likes = 1 and not liked from public.engagement('community_post', array['c7100000-0000-0000-0000-0000000000e1'])), 'counter back to 1, not liked');
select pg_temp.check((select likes from public.community_feed((select id from like_club), 10) where id = 'c7100000-0000-0000-0000-0000000000e1') = 1, 'the feed counts the same');
select pg_temp.check(public.toggle_save('community_post', 'c7100000-0000-0000-0000-0000000000e1') and not public.toggle_save('community_post', 'c7100000-0000-0000-0000-0000000000e1'), 'save toggles');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.likes where target_id = 'c7100000-0000-0000-0000-0000000000e1') = 1, 'one like row left');
-- A like already there (the other toggle of a race got in first): the insert keeps it, no error.
select pg_temp.check(position('on conflict' in lower(pg_get_functiondef('public.toggle_like(text,text)'::regprocedure))) > 0, 'toggle_like tolerates a like already made');
