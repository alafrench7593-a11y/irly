-- Community social space, wave 2 (migration 20261108000000_irly_community_space,
-- docs/COMMUNITY-SPACE-CONTRACT.md « Migration F »): who comments, likes and
-- votes, search, media gallery, paged feed, pin expiry, chat pins, mentions
-- on posts, the owner's info and rules, the fan-out cap, the storage queue
-- of removed posts, push texts.
-- Every check fails before that migration, except those marked (guard).
-- Runs in one transaction rolled back at the end: later files see nothing of it.
-- Ids f5a00000-….
\set ON_ERROR_STOP 1

begin;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
select private.restrict_profile_columns();

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL community_space: %', label; end if;
  raise notice 'ok  %', label;
end $$;

-- The SQLSTATE a statement fails with, or null when it runs.
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

select pg_temp.as_admin();

-- 01 Olga (owner), 02 Cora (co-admin with settings, no moderation),
-- 03 Cole (co-admin, default permissions), 04 Mona (moderator), 05 Mel
-- (member), 06 Ned (outsider), 07 Bob (banned), 08 Rita (restricted),
-- 09 Kim (member who blocked Olga), 10 Gina (verified woman, owner of a
-- women-only community), 11 Gus (man).
insert into auth.users (id) select ('f5a00000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid from generate_series(1, 11) g;
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('f5a00000-0000-0000-0000-000000000001', 'Olga', '1990-01-01', 'woman', 'dubai'),
  ('f5a00000-0000-0000-0000-000000000002', 'Cora', '1990-01-01', 'woman', 'dubai'),
  ('f5a00000-0000-0000-0000-000000000003', 'Cole', '1990-01-01', 'man', 'dubai'),
  ('f5a00000-0000-0000-0000-000000000004', 'Mona', '1990-01-01', 'woman', 'dubai'),
  ('f5a00000-0000-0000-0000-000000000005', 'Melody', '1990-01-01', 'woman', 'dubai'),
  ('f5a00000-0000-0000-0000-000000000006', 'Ned', '1990-01-01', 'man', 'dubai'),
  ('f5a00000-0000-0000-0000-000000000007', 'Bob', '1990-01-01', 'man', 'dubai'),
  ('f5a00000-0000-0000-0000-000000000008', 'Rita', '1990-01-01', 'woman', 'dubai'),
  ('f5a00000-0000-0000-0000-000000000009', 'Kim', '1990-01-01', 'man', 'dubai'),
  ('f5a00000-0000-0000-0000-000000000010', 'Gina', '1990-01-01', 'woman', 'dubai'),
  ('f5a00000-0000-0000-0000-000000000011', 'Gus', '1990-01-01', 'man', 'dubai');
update public.profiles set created_at = now() - interval '90 days' where id::text like 'f5a00000-%';
update public.profiles set verified_at = now() where id = 'f5a00000-0000-0000-0000-000000000010';
insert into public.blocks (blocker_id, blocked_id) values ('f5a00000-0000-0000-0000-000000000009', 'f5a00000-0000-0000-0000-000000000001');

insert into public.communities (id, city_id, name, created_by) values
  ('f5a00000-0000-0000-0000-0000000000c1', 'dubai', 'Space Padel Club', 'f5a00000-0000-0000-0000-000000000001');
insert into public.communities (id, city_id, name, created_by, girl_only) values
  ('f5a00000-0000-0000-0000-0000000000c2', 'dubai', 'Space Girls Run', 'f5a00000-0000-0000-0000-000000000010', true);
insert into public.community_members (community_id, user_id, role) values
  ('f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000001', 'owner'),
  ('f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000002', 'member'),
  ('f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000003', 'member'),
  ('f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000004', 'moderator'),
  ('f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000005', 'member'),
  ('f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000007', 'member'),
  ('f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000008', 'member'),
  ('f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000009', 'member'),
  ('f5a00000-0000-0000-0000-0000000000c2', 'f5a00000-0000-0000-0000-000000000010', 'owner')
  on conflict (community_id, user_id) do update set role = excluded.role;
select id as chat from public.conversations where community_id = 'f5a00000-0000-0000-0000-0000000000c1' \gset

-- Roles: Cora co-admin with settings only, Cole co-admin with the defaults.
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000001');
select public.community_set_role('f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000002', 'co_admin');
select public.community_set_role('f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000003', 'co_admin');
select public.community_set_permissions('f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000002', '{"settings": true}');

-- Posts of the Padel Club (by Olga, dated):
--   a1 pinned, a2 popular (older), a3 fresh, a4 pin expired, a5 announcement,
--   a6 poll, b1 three photos, b2 one video, b3 two photos.
select pg_temp.as_admin();
insert into public.community_posts (id, community_id, author_id, body, created_at, kind, media_paths, media_kind, thumb_path, media_seconds, poll) values
  ('f5a00000-0000-0000-0000-0000000000a1', 'f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000001', 'Welcome: padel rules of the club', now() - interval '5 hours', 'post', '{}', null, null, null, null),
  ('f5a00000-0000-0000-0000-0000000000a2', 'f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000001', 'Who wants a padel match tonight?', now() - interval '3 hours', 'post', '{}', null, null, null, null),
  ('f5a00000-0000-0000-0000-0000000000a3', 'f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000001', 'Fresh padel news', now() - interval '10 minutes', 'post', '{}', null, null, null, null),
  ('f5a00000-0000-0000-0000-0000000000a4', 'f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000001', 'Old padel pin', now() - interval '4 hours', 'post', '{}', null, null, null, null),
  ('f5a00000-0000-0000-0000-0000000000a5', 'f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000001', 'Padel announcement: courts closed', now() - interval '6 hours', 'announcement', '{}', null, null, null, null),
  ('f5a00000-0000-0000-0000-0000000000a6', 'f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000001', 'Poll: rackets?', now() - interval '7 hours', 'post', '{}', null, null, null, '{"options": ["Yes", "No"]}'),
  ('f5a00000-0000-0000-0000-0000000000b1', 'f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000001', 'Photos of the padel night', now() - interval '1 hour', 'post',
     '{f5a00000-0000-0000-0000-000000000001/b1-1.jpg,f5a00000-0000-0000-0000-000000000001/b1-2.jpg,f5a00000-0000-0000-0000-000000000001/b1-3.jpg}', 'photo', null, null, null),
  ('f5a00000-0000-0000-0000-0000000000b2', 'f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000001', 'Padel video', now() - interval '2 hours', 'post',
     '{f5a00000-0000-0000-0000-000000000001/b2.mp4}', 'video', 'f5a00000-0000-0000-0000-000000000001/b2-poster.jpg', 42, null),
  ('f5a00000-0000-0000-0000-0000000000b3', 'f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000001', 'More padel photos', now() - interval '150 minutes', 'post',
     '{f5a00000-0000-0000-0000-000000000001/b3-1.jpg,f5a00000-0000-0000-0000-000000000001/b3-2.jpg}', 'photo', null, null, null);
insert into public.community_pins (post_id, community_id, pinned_by) values
  ('f5a00000-0000-0000-0000-0000000000a1', 'f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000001');
insert into public.community_pins (post_id, community_id, pinned_by, pinned_at, expires_at) values
  ('f5a00000-0000-0000-0000-0000000000a4', 'f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000001', now() - interval '1 day', now() - interval '1 minute');

-- Plans of the club: one for members only, one public.
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000001');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, community_id, privacy) values
  ('f5a00000-0000-0000-0001-000000000001', auth.uid(), 'Members padel night', 'sport', 'dubai', 'jumeirah', now() + interval '2 days',
   'f5a00000-0000-0000-0000-0000000000c1', 'community'),
  ('f5a00000-0000-0000-0001-000000000002', auth.uid(), 'Public padel cup', 'sport', 'dubai', 'jumeirah', now() + interval '3 days',
   'f5a00000-0000-0000-0000-0000000000c1', 'public');

-- Sanctions: Bob banned, Rita restricted.
select public.community_ban('f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000007', 'spam');
select public.community_restrict('f5a00000-0000-0000-0000-0000000000c1', 'f5a00000-0000-0000-0000-000000000008', now() + interval '1 day', 'calm down');

-- ───────── 1. Comments, likes and votes: members in good standing ─────────
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000006');
select pg_temp.check(pg_temp.fails($q$insert into public.comments (target_type, target_id, author_id, body)
  values ('community_post', 'f5a00000-0000-0000-0000-0000000000a3', auth.uid(), 'outsider word')$q$) = '42501',
  'comments: a non-member cannot comment on a community post');
select pg_temp.check(pg_temp.fails($q$insert into public.likes (user_id, target_type, target_id)
  values (auth.uid(), 'community_post', 'f5a00000-0000-0000-0000-0000000000a3')$q$) = '42501',
  'likes: a non-member cannot like a community post');

select pg_temp.as_user('f5a00000-0000-0000-0000-000000000007');
select pg_temp.check(pg_temp.fails($q$insert into public.comments (target_type, target_id, author_id, body)
  values ('community_post', 'f5a00000-0000-0000-0000-0000000000a3', auth.uid(), 'banned word')$q$) = '42501',
  'comments: a banned member cannot comment');
select pg_temp.check(pg_temp.fails($q$insert into public.likes (user_id, target_type, target_id)
  values (auth.uid(), 'community_post', 'f5a00000-0000-0000-0000-0000000000a3')$q$) = '42501',
  'likes: a banned member cannot like');

select pg_temp.as_user('f5a00000-0000-0000-0000-000000000008');
select pg_temp.check(pg_temp.fails($q$insert into public.comments (target_type, target_id, author_id, body)
  values ('community_post', 'f5a00000-0000-0000-0000-0000000000a3', auth.uid(), 'restricted word')$q$) = '42501',
  'comments: a restricted member cannot comment');
select pg_temp.check(pg_temp.fails($q$insert into public.likes (user_id, target_type, target_id)
  values (auth.uid(), 'community_post', 'f5a00000-0000-0000-0000-0000000000a3')$q$) = '42501',
  'likes: a restricted member cannot like');
select pg_temp.check(pg_temp.fails($q$insert into public.community_poll_votes (post_id, user_id, option)
  values ('f5a00000-0000-0000-0000-0000000000a6', auth.uid(), 0)$q$) = '42501',
  'polls: a restricted member cannot vote');

-- Mel, in good standing: comments, likes, votes; her comment gets liked by Cole.
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.fails($q$insert into public.comments (id, target_type, target_id, author_id, body)
  values ('f5a00000-0000-0000-0000-0000000000e1', 'community_post', 'f5a00000-0000-0000-0000-0000000000a2', auth.uid(), 'count me in')$q$) is null,
  'comments (guard): a member in good standing comments');
select pg_temp.check(pg_temp.fails($q$insert into public.likes (user_id, target_type, target_id)
  values (auth.uid(), 'community_post', 'f5a00000-0000-0000-0000-0000000000a2')$q$) is null,
  'likes (guard): a member in good standing likes');
select pg_temp.check(pg_temp.fails($q$insert into public.community_poll_votes (post_id, user_id, option)
  values ('f5a00000-0000-0000-0000-0000000000a6', auth.uid(), 1)$q$) is null,
  'polls (guard): a member in good standing votes');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000006');
select pg_temp.check(pg_temp.fails($q$insert into public.likes (user_id, target_type, target_id)
  values (auth.uid(), 'comment', 'f5a00000-0000-0000-0000-0000000000e1')$q$) = '42501',
  'likes: a non-member cannot like a comment under a community post');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.fails($q$insert into public.likes (user_id, target_type, target_id)
  values (auth.uid(), 'comment', 'f5a00000-0000-0000-0000-0000000000e1')$q$) is null,
  'likes (guard): a member likes a comment');

-- Engagement for the popular order: a2 gets three more likes.
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000002');
insert into public.likes (user_id, target_type, target_id) values (auth.uid(), 'community_post', 'f5a00000-0000-0000-0000-0000000000a2');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000003');
insert into public.likes (user_id, target_type, target_id) values (auth.uid(), 'community_post', 'f5a00000-0000-0000-0000-0000000000a2');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000004');
insert into public.likes (user_id, target_type, target_id) values (auth.uid(), 'community_post', 'f5a00000-0000-0000-0000-0000000000a2');

-- ───────── 2. Search ─────────
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from public.community_search('f5a00000-0000-0000-0000-0000000000c1', 'padel') where kind in ('post', 'announcement')) >= 5
  and exists (select 1 from public.community_search('f5a00000-0000-0000-0000-0000000000c1', 'padel') where kind = 'activity')
  and exists (select 1 from public.community_search('f5a00000-0000-0000-0000-0000000000c1', 'padel') where kind = 'announcement'
              and id = 'f5a00000-0000-0000-0000-0000000000a5'),
  'search all: posts, the announcement and activities');
select pg_temp.check((select bool_and(kind in ('post', 'announcement')) and count(*) = 8
  and array_agg(created_at order by ord) = array_agg(created_at order by created_at desc)
  from (select s.*, row_number() over () as ord from public.community_search('f5a00000-0000-0000-0000-0000000000c1', 'padel', 'recent', 60) s) x),
  'search recent: posts only, newest first');
select pg_temp.check((select bool_and(created_at < now() - interval '3 hours') and count(*) > 0
  from public.community_search('f5a00000-0000-0000-0000-0000000000c1', 'padel', 'recent', 60, now() - interval '3 hours')),
  'search: p_before keeps older rows only');
select pg_temp.check((select id from public.community_search('f5a00000-0000-0000-0000-0000000000c1', 'padel', 'popular') limit 1)
  = 'f5a00000-0000-0000-0000-0000000000a2', 'search popular: the most liked and commented first');
select pg_temp.check((select bool_and(kind = 'media' and media_kind is not null and thumb_path is not null) and count(*) = 3
  from public.community_search('f5a00000-0000-0000-0000-0000000000c1', 'padel', 'media')),
  'search media: posts with media only');
select pg_temp.check((select bool_and(kind = 'activity' and going >= 1 and starts_at > now()) and count(*) = 2
  from public.community_search('f5a00000-0000-0000-0000-0000000000c1', 'padel', 'activities')),
  'search activities: both plans for a member, with their going count');
select pg_temp.check((select string_agg(title, ',') from public.community_search('f5a00000-0000-0000-0000-0000000000c1', 'mel', 'members'))
  = 'Melody', 'search members: by first name');
select pg_temp.check((select array_agg(id) from public.community_search('f5a00000-0000-0000-0000-0000000000c1', 'padel', 'pinned'))
  = array['f5a00000-0000-0000-0000-0000000000a1'::uuid], 'search pinned: running pins only (an expired one is not pinned)');
select pg_temp.check((select pinned from public.community_search('f5a00000-0000-0000-0000-0000000000c1', 'welcome', 'recent') limit 1),
  'search: a pinned post says so');
select pg_temp.check(pg_temp.fails($q$select * from public.community_search('f5a00000-0000-0000-0000-0000000000c1', 'p')$q$) = '22023',
  'search: 2 characters at least');
select pg_temp.check(pg_temp.fails($q$select * from public.community_search('f5a00000-0000-0000-0000-0000000000c1', 'padel', 'bogus')$q$) = '22023',
  'search: a known filter only');
-- Ned, outside: public content only.
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000006');
select pg_temp.check((select array_agg(title) from public.community_search('f5a00000-0000-0000-0000-0000000000c1', 'padel', 'activities'))
  = array['Public padel cup'], 'search: a non-member never reads a members-only plan');
-- A women-only community: invisible to a man, open to an eligible woman.
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000010');
insert into public.community_posts (community_id, author_id, body) values ('f5a00000-0000-0000-0000-0000000000c2', auth.uid(), 'Girls run at dawn');
select pg_temp.check((select count(*) from public.community_search('f5a00000-0000-0000-0000-0000000000c2', 'dawn')) = 1,
  'search (guard): an eligible woman searches her women-only community');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000011');
select pg_temp.check(pg_temp.fails($q$select * from public.community_search('f5a00000-0000-0000-0000-0000000000c2', 'dawn')$q$) = '42501',
  'search: a women-only community is invisible to a non-eligible user');
select pg_temp.check(pg_temp.fails($q$select * from public.community_media('f5a00000-0000-0000-0000-0000000000c2')$q$) = '42501',
  'media: same rule');
select pg_temp.check(pg_temp.fails($q$select * from public.community_posts_page('f5a00000-0000-0000-0000-0000000000c2')$q$) = '42501',
  'page: same rule');

-- ───────── 3. Media gallery ─────────
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) = 6 and count(distinct post_id) = 3 from public.community_media('f5a00000-0000-0000-0000-0000000000c1')),
  'media: one row per file');
select pg_temp.check((select string_agg(path, ',' order by created_at desc, "position")
  from public.community_media('f5a00000-0000-0000-0000-0000000000c1', null, 2))
  = 'f5a00000-0000-0000-0000-000000000001/b1-1.jpg,f5a00000-0000-0000-0000-000000000001/b1-2.jpg,f5a00000-0000-0000-0000-000000000001/b1-3.jpg',
  'media: a page holds whole posts, newest first');
select pg_temp.check((select string_agg(path || ':' || kind || ':' || coalesce(thumb_path, '-') || ':' || coalesce(seconds::text, '-'), ',' order by created_at desc, "position")
  from public.community_media('f5a00000-0000-0000-0000-0000000000c1', now() - interval '1 hour', 2))
  = 'f5a00000-0000-0000-0000-000000000001/b2.mp4:video:f5a00000-0000-0000-0000-000000000001/b2-poster.jpg:42,'
    || 'f5a00000-0000-0000-0000-000000000001/b3-1.jpg:photo:-:-,f5a00000-0000-0000-0000-000000000001/b3-2.jpg:photo:-:-',
  'media: the next page from the cursor (video with its poster and length)');

-- ───────── 4. Paged feed ─────────
select pg_temp.check((select array_agg(id order by ord) from (select p.id, row_number() over () as ord
  from public.community_posts_page('f5a00000-0000-0000-0000-0000000000c1', 'recent', null, 0, 3) p) x)
  = array['f5a00000-0000-0000-0000-0000000000a1', 'f5a00000-0000-0000-0000-0000000000a3', 'f5a00000-0000-0000-0000-0000000000b1']::uuid[],
  'page recent: the running pin first, then newest first (an expired pin is not first)');
select pg_temp.check((select array_agg(id order by ord) from (select p.id, row_number() over () as ord
  from public.community_posts_page('f5a00000-0000-0000-0000-0000000000c1', 'recent', now() - interval '1 hour', 0, 3) p) x)
  = array['f5a00000-0000-0000-0000-0000000000b2', 'f5a00000-0000-0000-0000-0000000000b3', 'f5a00000-0000-0000-0000-0000000000a2']::uuid[],
  'page recent: the next page from the cursor');
select pg_temp.check((select pinned_at is null from public.community_posts_page('f5a00000-0000-0000-0000-0000000000c1', 'recent', now() - interval '3 hours', 0, 50)
  where id = 'f5a00000-0000-0000-0000-0000000000a4'), 'page: an expired pin reads as not pinned');
select pg_temp.check((select id from public.community_posts_page('f5a00000-0000-0000-0000-0000000000c1', 'popular') limit 1)
  = 'f5a00000-0000-0000-0000-0000000000a2', 'page popular: likes and comments first');
select pg_temp.check((select likes = 4 and comments = 1 and liked and not mine from public.community_posts_page('f5a00000-0000-0000-0000-0000000000c1', 'popular')
  where id = 'f5a00000-0000-0000-0000-0000000000a2'), 'page: likes, comments and liked as the feed counts them');
select pg_temp.check((select id from public.community_posts_page('f5a00000-0000-0000-0000-0000000000c1', 'popular', null, 1, 1))
  = (select id from (select p.id, row_number() over () as n from public.community_posts_page('f5a00000-0000-0000-0000-0000000000c1', 'popular', null, 0, 5) p) x where n = 2),
  'page popular: paged by offset');
select pg_temp.check((select poll_counts = array[0, 1] and my_vote = 1 from public.community_posts_page('f5a00000-0000-0000-0000-0000000000c1', 'recent', null, 0, 50)
  where id = 'f5a00000-0000-0000-0000-0000000000a6'), 'page: poll counts and my vote');
select pg_temp.check(pg_temp.fails($q$select * from public.community_posts_page('f5a00000-0000-0000-0000-0000000000c1', 'bogus')$q$) = '22023',
  'page: recent or popular only');
-- community_feed, untouched, reads the expired pin as no pin through the read rule.
select pg_temp.check((select pinned_at is null from public.community_feed('f5a00000-0000-0000-0000-0000000000c1', 100)
  where id = 'f5a00000-0000-0000-0000-0000000000a4')
  and (select pinned_at is not null from public.community_feed('f5a00000-0000-0000-0000-0000000000c1', 100)
  where id = 'f5a00000-0000-0000-0000-0000000000a1'), 'feed: an expired pin is not pinned, a running one is');

-- ───────── 5. Pin expiry ─────────
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000004');
select pg_temp.check(public.pin_post('f5a00000-0000-0000-0000-0000000000a3', true, now() + interval '1 day'),
  'pins: a moderator pins until tomorrow');
select pg_temp.check((select expires_at > now() from public.community_pins where post_id = 'f5a00000-0000-0000-0000-0000000000a3'),
  'pins: the end is stored');
select pg_temp.check(pg_temp.fails($q$select public.pin_post('f5a00000-0000-0000-0000-0000000000a3', true, now() - interval '1 hour')$q$) = '22023',
  'pins: the end is in the future');
select pg_temp.check(public.pin_post('f5a00000-0000-0000-0000-0000000000a4'), 'pins (guard): the one-argument call still pins');
select pg_temp.check((select expires_at is null from public.community_pins where post_id = 'f5a00000-0000-0000-0000-0000000000a4'),
  'pins: pinning again without an end clears the old end');
select pg_temp.check(not public.pin_post('f5a00000-0000-0000-0000-0000000000a4', false), 'pins (guard): the two-argument call unpins');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.fails($q$select public.pin_post('f5a00000-0000-0000-0000-0000000000a3', true, now() + interval '1 day')$q$) = '42501',
  'pins (guard): a member does not pin');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.community_audit where community_id = 'f5a00000-0000-0000-0000-0000000000c1'
  and action = 'post.pin' and target_id = 'f5a00000-0000-0000-0000-0000000000a3'), 'pins: journaled');

-- ───────── 6. Chat pins ─────────
insert into public.messages (id, conversation_id, sender_id, body)
select ('f5a00000-0000-0000-0002-0000000000' || lpad(g::text, 2, '0'))::uuid, :'chat', 'f5a00000-0000-0000-0000-000000000005', 'chat line ' || g
from generate_series(1, 7) g;
insert into public.conversations (id, kind, title) values ('f5a00000-0000-0000-0000-0000000000d0', 'direct', null);
insert into public.conversation_members (conversation_id, user_id, role) values
  ('f5a00000-0000-0000-0000-0000000000d0', 'f5a00000-0000-0000-0000-000000000004', 'member'),
  ('f5a00000-0000-0000-0000-0000000000d0', 'f5a00000-0000-0000-0000-000000000005', 'member');
insert into public.messages (id, conversation_id, sender_id, body) values
  ('f5a00000-0000-0000-0002-0000000000d1', 'f5a00000-0000-0000-0000-0000000000d0', 'f5a00000-0000-0000-0000-000000000005', 'private hello');

select pg_temp.as_user('f5a00000-0000-0000-0000-000000000004');
select public.pin_message(('f5a00000-0000-0000-0002-0000000000' || lpad(g::text, 2, '0'))::uuid, true) from generate_series(1, 4) g;
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000003');
select pg_temp.check(public.pin_message('f5a00000-0000-0000-0002-000000000005', true, now() + interval '1 day'),
  'chat pins: a co-admin with moderation pins (with an end)');
select pg_temp.check(pg_temp.fails($q$select public.pin_message('f5a00000-0000-0000-0002-000000000006', true)$q$) = 'P0001',
  'chat pins: 5 at most per chat');
select pg_temp.check(pg_temp.fails($q$select public.pin_message('f5a00000-0000-0000-0002-000000000006', true, now() - interval '1 minute')$q$) = '22023',
  'chat pins: the end is in the future');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.fails($q$select public.pin_message('f5a00000-0000-0000-0002-000000000006', true)$q$) = '42501',
  'chat pins: a co-admin without moderation does not pin');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.fails($q$select public.pin_message('f5a00000-0000-0000-0002-000000000006', true)$q$) = '42501',
  'chat pins: a member does not pin');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$select public.pin_message('f5a00000-0000-0000-0002-0000000000d1', true)$q$) = '42501',
  'chat pins: community chats only');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) = 5 and bool_and(sender_name = 'Melody' and kind = 'text')
  and count(expires_at) = 1 from public.chat_pins(:'chat')), 'chat pins: the chat''s members read them');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000006');
select pg_temp.check(pg_temp.fails(format('select * from public.chat_pins(%L)', :'chat')) = '42501',
  'chat pins: members of the chat only');
select pg_temp.check((select count(*) from public.message_pins) = 0, 'chat pins: not readable from the table either');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000004');
select pg_temp.check(not public.pin_message('f5a00000-0000-0000-0002-000000000001', false), 'chat pins: unpin');
select pg_temp.check(public.pin_message('f5a00000-0000-0000-0002-000000000006', true), 'chat pins: room again after an unpin');
select pg_temp.as_admin();
update public.message_pins set expires_at = now() - interval '1 second' where message_id = 'f5a00000-0000-0000-0002-000000000005';
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from public.chat_pins(:'chat')) = 4, 'chat pins: an expired pin is not listed');
select pg_temp.check(public.pin_message('f5a00000-0000-0000-0002-000000000007', true), 'chat pins: and does not count toward the 5');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.community_audit where community_id = 'f5a00000-0000-0000-0000-0000000000c1'
  and action in ('message.pin', 'message.unpin')) = 8, 'chat pins: every pin and unpin journaled');

-- ───────── 7. Mentions on posts ─────────
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000001');
insert into public.community_posts (id, community_id, author_id, body, mentions) values
  ('f5a00000-0000-0000-0000-0000000000a7', 'f5a00000-0000-0000-0000-0000000000c1', auth.uid(), 'Padel tonight, who comes?',
   array['f5a00000-0000-0000-0000-000000000005', 'f5a00000-0000-0000-0000-000000000005', 'f5a00000-0000-0000-0000-000000000006',
         'f5a00000-0000-0000-0000-000000000009', 'f5a00000-0000-0000-0000-000000000007']::uuid[]);
select pg_temp.as_admin();
select pg_temp.check((select mentions from public.community_posts where id = 'f5a00000-0000-0000-0000-0000000000a7')
  = array['f5a00000-0000-0000-0000-000000000005', 'f5a00000-0000-0000-0000-000000000009']::uuid[],
  'mentions: stored once each, members only (an outsider and a banned person dropped)');
select pg_temp.check((select count(*) from public.notifications where user_id = 'f5a00000-0000-0000-0000-000000000005' and kind = 'MENTION'
  and payload ->> 'post_id' = 'f5a00000-0000-0000-0000-0000000000a7' and payload ->> 'community_id' = 'f5a00000-0000-0000-0000-0000000000c1'
  and payload ->> 'from' = 'f5a00000-0000-0000-0000-000000000001') = 1, 'mentions: a mentioned member is told once');
select pg_temp.check(not exists (select 1 from public.notifications where user_id = 'f5a00000-0000-0000-0000-000000000005'
  and kind = 'COMMUNITY_POST' and payload ->> 'post_id' = 'f5a00000-0000-0000-0000-0000000000a7'),
  'mentions: and not twice (no « new post » on top)');
select pg_temp.check(not exists (select 1 from public.notifications where user_id = 'f5a00000-0000-0000-0000-000000000006'
  and kind = 'MENTION'), 'mentions: a non-member is not told');
select pg_temp.check(not exists (select 1 from public.notifications where user_id = 'f5a00000-0000-0000-0000-000000000009'
  and kind = 'MENTION'), 'mentions: a member who blocked the author is not told');
select pg_temp.check(not exists (select 1 from public.notifications where user_id = 'f5a00000-0000-0000-0000-000000000007'
  and kind = 'MENTION'), 'mentions: a banned person is not told');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000001');
update public.community_posts set mentions = mentions || 'f5a00000-0000-0000-0000-000000000004'::uuid
where id = 'f5a00000-0000-0000-0000-0000000000a7';
select pg_temp.check(pg_temp.fails($q$insert into public.community_posts (community_id, author_id, body, mentions)
  select 'f5a00000-0000-0000-0000-0000000000c1', auth.uid(), 'too many', array_agg(gen_random_uuid()) from generate_series(1, 11)$q$) = '22023',
  'mentions: 10 at most');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.notifications where user_id = 'f5a00000-0000-0000-0000-000000000004' and kind = 'MENTION'
  and payload ->> 'post_id' = 'f5a00000-0000-0000-0000-0000000000a7') = 1, 'mentions: an edit that adds someone tells her');
select pg_temp.check((select count(*) from public.notifications where user_id = 'f5a00000-0000-0000-0000-000000000005' and kind = 'MENTION'
  and payload ->> 'post_id' = 'f5a00000-0000-0000-0000-0000000000a7') = 1, 'mentions: the edit does not tell the others again');
-- Comment mentions, read as the comments are.
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000005');
insert into public.comments (id, target_type, target_id, author_id, body, mentions)
values ('f5a00000-0000-0000-0000-0000000000e2', 'community_post', 'f5a00000-0000-0000-0000-0000000000a2', auth.uid(), 'ask Mona',
  array['f5a00000-0000-0000-0000-000000000004']::uuid[]);
select pg_temp.check((select mentions from public.comment_mentions(array['f5a00000-0000-0000-0000-0000000000e2']::uuid[]))
  = array['f5a00000-0000-0000-0000-000000000004']::uuid[], 'comment mentions: a reader gets them');
select pg_temp.as_admin();
-- A women-only community: a member without IRLY Girl access is not told.
update public.profiles set verified_at = now() where id = 'f5a00000-0000-0000-0000-000000000008';
insert into public.community_members (community_id, user_id) values
  ('f5a00000-0000-0000-0000-0000000000c2', 'f5a00000-0000-0000-0000-000000000011'),
  ('f5a00000-0000-0000-0000-0000000000c2', 'f5a00000-0000-0000-0000-000000000008');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000010');
insert into public.community_posts (id, community_id, author_id, body, mentions) values
  ('f5a00000-0000-0000-0000-0000000000a8', 'f5a00000-0000-0000-0000-0000000000c2', auth.uid(), 'Run with me',
   array['f5a00000-0000-0000-0000-000000000011', 'f5a00000-0000-0000-0000-000000000008']::uuid[]);
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.notifications where user_id = 'f5a00000-0000-0000-0000-000000000011' and kind = 'MENTION'
  and payload ->> 'post_id' = 'f5a00000-0000-0000-0000-0000000000a8'), 'mentions: IRLY Girl access is needed in a women-only community');
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'f5a00000-0000-0000-0000-000000000008' and kind = 'MENTION'
  and payload ->> 'post_id' = 'f5a00000-0000-0000-0000-0000000000a8'), 'mentions (guard): an eligible member there is told');

-- ───────── 10. Push text of a post mention ─────────
select pg_temp.check((select (private.push_text(n, 'en')).url = '/c/f5a00000-0000-0000-0000-0000000000c1'
  and (private.push_text(n, 'en')).title = 'Space Padel Club'
  and (private.push_text(n, 'en')).body like 'Olga mentioned you in a post: Padel tonight%'
  and (private.push_text(n, 'fr')).body like 'Olga t’a mentionné·e dans une publication%'
  from public.notifications n where n.user_id = 'f5a00000-0000-0000-0000-000000000005' and n.kind = 'MENTION'
    and n.payload ->> 'post_id' = 'f5a00000-0000-0000-0000-0000000000a7'), 'push: a post mention opens the community');
select pg_temp.check((select (private.push_text(jsonb_populate_record(null::public.notifications, jsonb_build_object(
  'user_id', 'f5a00000-0000-0000-0000-000000000005', 'kind', 'MENTION', 'payload', jsonb_build_object('from', 'f5a00000-0000-0000-0000-000000000001',
    'target_type', 'community_post', 'target_id', 'f5a00000-0000-0000-0000-0000000000a2', 'comment_id', gen_random_uuid(), 'body', 'hi'))), 'en')).url
  = '/notifications'),
  'push (guard): a comment mention is unchanged');

-- ───────── 8. The owner's info and rules ─────────
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000001');
select pg_temp.check((select public.community_update_info('f5a00000-0000-0000-0000-0000000000c1', p_tagline => 'Padel every week',
  p_rules => 'Be kind. No spam.')) = jsonb_build_object('name', 'Space Padel Club', 'tagline', 'Padel every week', 'description', null,
  'rules', 'Be kind. No spam.'), 'info: the owner sets the tagline and the rules');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000002');
select public.community_update_info('f5a00000-0000-0000-0000-0000000000c1', 'Space Padel Crew', p_description => '');
select pg_temp.as_admin();
select pg_temp.check((select name = 'Space Padel Crew' and tagline = 'Padel every week' and rules = 'Be kind. No spam.' and description is null
  from public.communities where id = 'f5a00000-0000-0000-0000-0000000000c1'), 'info: a co-admin with settings renames it (null keeps a field)');
select pg_temp.check((select count(*) from public.community_audit where community_id = 'f5a00000-0000-0000-0000-0000000000c1'
  and action = 'community.edit') = 2, 'info: journaled');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.fails($q$select public.community_update_info('f5a00000-0000-0000-0000-0000000000c1', p_rules => 'mine')$q$) = '42501',
  'info: a co-admin without settings cannot');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$select public.community_update_info('f5a00000-0000-0000-0000-0000000000c1', p_rules => 'mine')$q$) = '42501',
  'info: nor a moderator');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000006');
select pg_temp.check(pg_temp.fails($q$select public.community_update_info('f5a00000-0000-0000-0000-0000000000c1', p_rules => 'mine')$q$) = '42501',
  'info: nor an outsider');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000011');
select pg_temp.check(pg_temp.fails($q$select public.community_update_info('f5a00000-0000-0000-0000-0000000000c2', p_rules => 'mine')$q$) = '42501',
  'info: nor anyone without IRLY Girl access');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails($q$select public.community_update_info('f5a00000-0000-0000-0000-0000000000c1', p_rules => repeat('x', 4001))$q$) = '22023',
  'info: rules have 4000 characters at most');
select pg_temp.check(pg_temp.fails($q$select public.community_update_info('f5a00000-0000-0000-0000-0000000000c1', 'IRLY Padel')$q$) = '23514',
  'info (guard): a reserved name is still refused');
-- An official community keeps its name.
select pg_temp.as_admin();
select id as official from public.communities where official and topic = 'gym' and city_id = 'dubai' and parent_id is null and deleted_at is null \gset
insert into public.community_members (community_id, user_id, role) values (:'official', 'f5a00000-0000-0000-0000-000000000001', 'owner')
  on conflict (community_id, user_id) do update set role = 'owner';
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails(format('select public.community_update_info(%L, %L)', :'official', 'My Gym')) = '22023',
  'info: an official community keeps its name');
select pg_temp.check(pg_temp.fails(format('select public.community_update_info(%L, p_rules => %L)', :'official', 'Rack your weights')) is null,
  'info (guard): its rules can be set');

-- ───────── 9. Fan-out cap ─────────
select pg_temp.as_admin();
insert into auth.users (id) select ('f5a00000-0000-0000-0003-' || lpad(g::text, 12, '0'))::uuid from generate_series(1, 520) g;
insert into public.profiles (id, first_name, birthdate, gender, city_id)
select ('f5a00000-0000-0000-0003-' || lpad(g::text, 12, '0'))::uuid, 'Fan' || g, '1990-01-01', 'man', 'dubai' from generate_series(1, 520) g;
insert into public.communities (id, city_id, name, created_by) values
  ('f5a00000-0000-0000-0000-0000000000c4', 'dubai', 'Space Big Club', 'f5a00000-0000-0000-0000-000000000001');
insert into public.community_members (community_id, user_id, role) values
  ('f5a00000-0000-0000-0000-0000000000c4', 'f5a00000-0000-0000-0000-000000000001', 'owner') on conflict do nothing;
insert into public.community_members (community_id, user_id)
select 'f5a00000-0000-0000-0000-0000000000c4', ('f5a00000-0000-0000-0003-' || lpad(g::text, 12, '0'))::uuid from generate_series(1, 520) g;
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000001');
insert into public.community_posts (id, community_id, author_id, body) values
  ('f5a00000-0000-0000-0000-0000000000a9', 'f5a00000-0000-0000-0000-0000000000c4', auth.uid(), 'Hello big club');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.notifications where kind = 'COMMUNITY_POST'
  and payload ->> 'post_id' = 'f5a00000-0000-0000-0000-0000000000a9') = 500, 'fan-out: 500 people at most per post');

-- ───────── 9. Storage queue of a removed post ─────────
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000005');
select public.report('community_post', 'f5a00000-0000-0000-0000-000000000001', 'f5a00000-0000-0000-0000-0000000000b2', 'spam');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000001');
update public.community_posts set deleted_at = now()
where id in ('f5a00000-0000-0000-0000-0000000000b3', 'f5a00000-0000-0000-0000-0000000000b2');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from private.storage_cleanup where bucket_id = 'post-media' and reason = 'orphan'
  and name in ('f5a00000-0000-0000-0000-000000000001/b3-1.jpg', 'f5a00000-0000-0000-0000-000000000001/b3-2.jpg')
  and user_id = 'f5a00000-0000-0000-0000-000000000001' and done_at is null) = 2, 'storage: a removed post''s files are queued');
select pg_temp.check(not private.photo_in_use('post-media', 'f5a00000-0000-0000-0000-000000000001/b3-1.jpg'),
  'storage: and the purge may take them (no live post shows them)');
select pg_temp.check(private.photo_in_use('post-media', 'f5a00000-0000-0000-0000-000000000001/b1-1.jpg'),
  'storage (guard): a live post''s file is in use');
select pg_temp.check(not exists (select 1 from private.storage_cleanup where bucket_id = 'post-media' and name like 'f5a00000-0000-0000-0000-000000000001/b2%'),
  'storage: a reported post''s files are kept for the team');
select pg_temp.check(private.photo_in_use('post-media', 'f5a00000-0000-0000-0000-000000000001/b2.mp4'),
  'storage: and stay in use');
select pg_temp.as_user('f5a00000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from public.community_media('f5a00000-0000-0000-0000-0000000000c1')) = 3,
  'media: a removed post leaves the gallery');

rollback;
