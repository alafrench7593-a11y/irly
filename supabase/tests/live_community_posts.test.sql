-- Live ↔ community, one record (20261110400000_irly_live_community_posts.sql):
-- a post published from the Live with a community is a community post
-- flagged in_live. It shows in the community AND in the Live of the
-- community's universe only, with the same likes and comments; removing it
-- (author or moderator) removes it from both; nobody sees it through the
-- Live who could not read it in its community.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed c4400000-….
--
--   a1 Mia  woman, IRLY Girl access, member of every community
--   a2 Sam  man, member of the Mixte and mixed Network communities
--   a3 Nia  woman, IRLY Girl access, member of nothing
--   a4 Lea  woman, moderator of the Girl community
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
select private.restrict_profile_columns();

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
    raise exception 'FAIL live_community_posts: %', label;
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
create or replace function pg_temp.in_live(space text, pid uuid) returns boolean language sql as $$
  select exists (select 1 from public.live_feed('dubai', space) f where f.id = pid)
$$;

select pg_temp.as_admin();
insert into auth.users (id) values ('c4400000-0000-0000-0000-0000000000a1'), ('c4400000-0000-0000-0000-0000000000a2'),
  ('c4400000-0000-0000-0000-0000000000a3'), ('c4400000-0000-0000-0000-0000000000a4');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c4400000-0000-0000-0000-0000000000a1', 'Mia', '1995-02-02', 'woman', 'dubai'),
  ('c4400000-0000-0000-0000-0000000000a2', 'Sam', '1993-04-04', 'man', 'dubai'),
  ('c4400000-0000-0000-0000-0000000000a3', 'Nia', '1996-06-06', 'woman', 'dubai'),
  ('c4400000-0000-0000-0000-0000000000a4', 'Lea', '1994-03-03', 'woman', 'dubai');
-- One community per universe: Mixte, Girl, Mom, Network (mixed) and Network (women-only).
insert into public.communities (id, city_id, name, girl_only, category_id, topic) values
  ('c4400000-0000-0000-0000-0000000000b1', 'dubai', 'c44 Mixte padel', false, 'sport', null),
  ('c4400000-0000-0000-0000-0000000000b2', 'dubai', 'c44 Girl brunch', true, 'food', null),
  ('c4400000-0000-0000-0000-0000000000b3', 'dubai', 'c44 Mom circle', true, null, 'mom_expat'),
  ('c4400000-0000-0000-0000-0000000000b4', 'dubai', 'c44 Founders', false, 'networking', null),
  ('c4400000-0000-0000-0000-0000000000b5', 'dubai', 'c44 Girl CEO', true, 'networking', null);
insert into public.community_members (community_id, user_id, role) values
  ('c4400000-0000-0000-0000-0000000000b1', 'c4400000-0000-0000-0000-0000000000a1', 'member'),
  ('c4400000-0000-0000-0000-0000000000b2', 'c4400000-0000-0000-0000-0000000000a1', 'member'),
  ('c4400000-0000-0000-0000-0000000000b3', 'c4400000-0000-0000-0000-0000000000a1', 'member'),
  ('c4400000-0000-0000-0000-0000000000b4', 'c4400000-0000-0000-0000-0000000000a1', 'member'),
  ('c4400000-0000-0000-0000-0000000000b5', 'c4400000-0000-0000-0000-0000000000a1', 'member'),
  ('c4400000-0000-0000-0000-0000000000b1', 'c4400000-0000-0000-0000-0000000000a2', 'member'),
  ('c4400000-0000-0000-0000-0000000000b4', 'c4400000-0000-0000-0000-0000000000a2', 'member'),
  ('c4400000-0000-0000-0000-0000000000b2', 'c4400000-0000-0000-0000-0000000000a4', 'moderator');

-- ───────── 1. Mia publishes from the Live, one post per community ─────────
select pg_temp.as_user('c4400000-0000-0000-0000-0000000000a1');
insert into public.community_posts (id, community_id, author_id, body, in_live) values
  ('c4400000-0000-0000-0000-0000000000c1', 'c4400000-0000-0000-0000-0000000000b1', 'c4400000-0000-0000-0000-0000000000a1', 'c44 mixte live', true),
  ('c4400000-0000-0000-0000-0000000000c2', 'c4400000-0000-0000-0000-0000000000b2', 'c4400000-0000-0000-0000-0000000000a1', 'c44 girl live', true),
  ('c4400000-0000-0000-0000-0000000000c3', 'c4400000-0000-0000-0000-0000000000b3', 'c4400000-0000-0000-0000-0000000000a1', 'c44 mom live', true),
  ('c4400000-0000-0000-0000-0000000000c4', 'c4400000-0000-0000-0000-0000000000b4', 'c4400000-0000-0000-0000-0000000000a1', 'c44 network live', true),
  ('c4400000-0000-0000-0000-0000000000c5', 'c4400000-0000-0000-0000-0000000000b5', 'c4400000-0000-0000-0000-0000000000a1', 'c44 girl ceo live', true),
  -- A community post not published to the Live: never in the Live.
  ('c4400000-0000-0000-0000-0000000000c6', 'c4400000-0000-0000-0000-0000000000b1', 'c4400000-0000-0000-0000-0000000000a1', 'c44 community only', false);
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.community_posts where id::text like 'c4400000-%') = 6, 'one row per post: nothing is copied anywhere');
select pg_temp.check(not exists (select 1 from public.irl_posts where body like 'c44%'), 'no Live copy is made in irl_posts');

-- ───────── 2. Each post in its universe's Live only ─────────
select pg_temp.as_user('c4400000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.in_live('irly', 'c4400000-0000-0000-0000-0000000000c1'), 'Mixte post: in the Mixte Live');
select pg_temp.check(not pg_temp.in_live('girl', 'c4400000-0000-0000-0000-0000000000c1'), 'Mixte post: never automatically in the IRLY Girl Live');
select pg_temp.check(pg_temp.in_live('girl', 'c4400000-0000-0000-0000-0000000000c2'), 'Girl post: in the IRLY Girl Live');
select pg_temp.check(not pg_temp.in_live('irly', 'c4400000-0000-0000-0000-0000000000c2'), 'Girl post: never in the Mixte Live');
select pg_temp.check(pg_temp.in_live('girl', 'c4400000-0000-0000-0000-0000000000c3'), 'Mom post: in the IRLY Girl Live');
select pg_temp.check(not pg_temp.in_live('irly', 'c4400000-0000-0000-0000-0000000000c3'), 'Mom post: never in the Mixte Live');
select pg_temp.check(pg_temp.in_live('irly', 'c4400000-0000-0000-0000-0000000000c4') and not pg_temp.in_live('girl', 'c4400000-0000-0000-0000-0000000000c4'),
  'mixed Network post: Mixte Live only');
select pg_temp.check(pg_temp.in_live('girl', 'c4400000-0000-0000-0000-0000000000c5') and not pg_temp.in_live('irly', 'c4400000-0000-0000-0000-0000000000c5'),
  'women-only Network post: IRLY Girl Live only');
select pg_temp.check(not pg_temp.in_live('irly', 'c4400000-0000-0000-0000-0000000000c6'), 'a community post not published to the Live stays out of it');
select pg_temp.check((select f.source = 'community' and f.community_id = 'c4400000-0000-0000-0000-0000000000b1' and f.community_name = 'c44 Mixte padel'
  from public.live_feed('dubai', 'irly') f where f.id = 'c4400000-0000-0000-0000-0000000000c1'), 'the Live row is the community post itself (same id, its community named)');
select pg_temp.check(exists (select 1 from public.community_feed('c4400000-0000-0000-0000-0000000000b1') f where f.id = 'c4400000-0000-0000-0000-0000000000c1'),
  '… and the same record is in the community''s posts');

-- ───────── 3. By gender: Sam never reaches the IRLY Girl side ─────────
select pg_temp.as_user('c4400000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.fails($$select * from public.live_feed('dubai', 'girl')$$) = '42501', 'Sam: the IRLY Girl Live is refused');
select pg_temp.check(pg_temp.in_live('irly', 'c4400000-0000-0000-0000-0000000000c1'), 'Sam sees the Mixte post in the Mixte Live');
select pg_temp.check(not exists (select 1 from public.live_feed('dubai', 'irly') f where f.community_id in ('c4400000-0000-0000-0000-0000000000b2', 'c4400000-0000-0000-0000-0000000000b3', 'c4400000-0000-0000-0000-0000000000b5')),
  'Sam: no Girl, Mom or women-only Network post in his Live');
select pg_temp.check(not exists (select 1 from public.community_posts where id = 'c4400000-0000-0000-0000-0000000000c2'), 'Sam: nor by reading the table');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.fails($$select * from public.live_feed('dubai', 'irly')$$) = '42501', 'signed out: no Live');

-- ───────── 4. A non-member sees through the Live exactly what the community lets her read ─────────
-- Communities have no members-only reading today: a community's posts are
-- read by whoever may see the community (women-only ones by women with IRLY
-- Girl access). The Live never widens that.
select pg_temp.as_user('c4400000-0000-0000-0000-0000000000a3');
select pg_temp.check(
  (select coalesce(array_agg(f.id order by f.id), '{}') from public.live_feed('dubai', 'girl') f where f.source = 'community' and f.body like 'c44%')
  = (select coalesce(array_agg(p.id order by p.id), '{}') from public.community_posts p where p.in_live and p.body like 'c44%'
       and private.community_live_space(p.community_id) = 'irly_girl'),
  'Nia (not a member): the IRLY Girl Live shows only the in-Live posts her own read rules give her');
select pg_temp.check(pg_temp.in_live('girl', 'c4400000-0000-0000-0000-0000000000c2')
  and exists (select 1 from public.community_feed('c4400000-0000-0000-0000-0000000000b2') f where f.id = 'c4400000-0000-0000-0000-0000000000c2'),
  '… the Girl community''s post, which she can open in the community too (communities are open to read)');
select pg_temp.check(pg_temp.fails($$insert into public.community_posts (community_id, author_id, body, in_live) values ('c4400000-0000-0000-0000-0000000000b2', 'c4400000-0000-0000-0000-0000000000a3', 'c44 not a member', true)$$) = '42501',
  'Nia cannot publish to the Live in a community she is not in');
select pg_temp.as_admin();
update public.communities set deleted_at = now() where id = 'c4400000-0000-0000-0000-0000000000b4';
select pg_temp.as_user('c4400000-0000-0000-0000-0000000000a2');
select pg_temp.check(not pg_temp.in_live('irly', 'c4400000-0000-0000-0000-0000000000c4'), 'a removed community: its posts leave the Live');
select pg_temp.as_admin();
update public.communities set deleted_at = null where id = 'c4400000-0000-0000-0000-0000000000b4';
-- Blocked: Sam blocks Mia, her posts leave his Live.
insert into public.blocks (blocker_id, blocked_id) values ('c4400000-0000-0000-0000-0000000000a2', 'c4400000-0000-0000-0000-0000000000a1');
select pg_temp.as_user('c4400000-0000-0000-0000-0000000000a2');
select pg_temp.check(not pg_temp.in_live('irly', 'c4400000-0000-0000-0000-0000000000c1'), 'blocked: her post leaves his Live');
select pg_temp.as_admin();
delete from public.blocks where blocker_id = 'c4400000-0000-0000-0000-0000000000a2';

-- ───────── 5. Likes and comments are the community post's: shared ─────────
select pg_temp.as_user('c4400000-0000-0000-0000-0000000000a2');
insert into public.likes (user_id, target_type, target_id) values ('c4400000-0000-0000-0000-0000000000a2', 'community_post', 'c4400000-0000-0000-0000-0000000000c1');
insert into public.comments (target_type, target_id, author_id, body) values ('community_post', 'c4400000-0000-0000-0000-0000000000c1', 'c4400000-0000-0000-0000-0000000000a2', 'c44 seen it in the Live');
select pg_temp.as_user('c4400000-0000-0000-0000-0000000000a1');
select pg_temp.check((select f.likes = 1 and f.comments = 1 from public.community_feed('c4400000-0000-0000-0000-0000000000b1') f where f.id = 'c4400000-0000-0000-0000-0000000000c1'),
  'a like and a comment made from the Live are counted on the community post');
select pg_temp.check(exists (select 1 from public.comment_thread('community_post', 'c4400000-0000-0000-0000-0000000000c1') k where k.body = 'c44 seen it in the Live'),
  '… one comment thread for both');

-- ───────── 6. The flag: set at publication only ─────────
select pg_temp.check(pg_temp.fails($$update public.community_posts set in_live = true where id = 'c4400000-0000-0000-0000-0000000000c6'$$) = '42501',
  'an existing post cannot be pushed into the Live later');
select pg_temp.check(pg_temp.fails($$insert into public.community_posts (author_id, body, in_live) values ('c4400000-0000-0000-0000-0000000000a1', 'c44 profile live', true)$$) is not null,
  'a post without a community cannot be flagged in_live');
update public.community_posts set in_live = false where id = 'c4400000-0000-0000-0000-0000000000c4';
select pg_temp.check(not pg_temp.in_live('irly', 'c4400000-0000-0000-0000-0000000000c4')
  and exists (select 1 from public.community_feed('c4400000-0000-0000-0000-0000000000b4') f where f.id = 'c4400000-0000-0000-0000-0000000000c4'),
  'the author takes it off the Live: it stays in the community');

-- ───────── 7. Deletion and moderation remove it from both ─────────
update public.community_posts set deleted_at = now() where id = 'c4400000-0000-0000-0000-0000000000c1';
select pg_temp.check(not pg_temp.in_live('irly', 'c4400000-0000-0000-0000-0000000000c1')
  and not exists (select 1 from public.community_feed('c4400000-0000-0000-0000-0000000000b1') f where f.id = 'c4400000-0000-0000-0000-0000000000c1'),
  'the author removes it: gone from the Live and the community');
select pg_temp.as_user('c4400000-0000-0000-0000-0000000000a2');
select pg_temp.check(not pg_temp.in_live('irly', 'c4400000-0000-0000-0000-0000000000c1'), '… for everyone');
select pg_temp.as_user('c4400000-0000-0000-0000-0000000000a4');
update public.community_posts set deleted_at = now() where id = 'c4400000-0000-0000-0000-0000000000c2';
select pg_temp.as_user('c4400000-0000-0000-0000-0000000000a1');
select pg_temp.check(not pg_temp.in_live('girl', 'c4400000-0000-0000-0000-0000000000c2')
  and not exists (select 1 from public.community_feed('c4400000-0000-0000-0000-0000000000b2') f where f.id = 'c4400000-0000-0000-0000-0000000000c2'),
  'a moderator removes it from the community: gone from the Live too');
select pg_temp.check(pg_temp.in_live('girl', 'c4400000-0000-0000-0000-0000000000c3'), 'the other posts stay');

-- ───────── 8. 24 hours in the Live, for ever in the community ─────────
select pg_temp.as_admin();
alter table public.community_posts disable trigger community_posts_edit_guard;
update public.community_posts set created_at = now() - interval '25 hours' where id = 'c4400000-0000-0000-0000-0000000000c3';
alter table public.community_posts enable trigger community_posts_edit_guard;
select pg_temp.as_user('c4400000-0000-0000-0000-0000000000a1');
select pg_temp.check(not pg_temp.in_live('girl', 'c4400000-0000-0000-0000-0000000000c3')
  and exists (select 1 from public.community_feed('c4400000-0000-0000-0000-0000000000b3') f where f.id = 'c4400000-0000-0000-0000-0000000000c3'),
  'after 24 hours it leaves the Live and stays in the community');

-- ───────── 9. The space's own Lives are still there ─────────
select public.post_live('{"id":"c4400000-0000-0000-0000-0000000000d1","city_id":"dubai","area_id":"marina","body":"c44 plain live","visibility":"everyone"}'::jsonb);
select pg_temp.check((select f.source from public.live_feed('dubai', 'irly') f where f.id = 'c4400000-0000-0000-0000-0000000000d1') = 'irl', 'a Live without community is still an IRL post');
select pg_temp.check(not pg_temp.in_live('girl', 'c4400000-0000-0000-0000-0000000000d1'), '… in its own space only');

select pg_temp.as_admin();
