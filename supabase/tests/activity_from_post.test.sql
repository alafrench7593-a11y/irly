-- Activities made from a post, moving an activity, reminders
-- (20261110300000_irly_activity_from_post.sql).
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed fa000000-….
--
--   w1 Nadia  woman, IRLY Girl access: owns the club and the women-only circle, posts in both
--   w2 Ines   woman, IRLY Girl access, not in the club: blocks Bruno
--   m1 Marc   man, member of the club: makes a plan from Nadia's club post
--   m2 Omar   man, outsider (no community)
--   m3 Bruno  man, blocked by Ines, member of the club
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
    raise exception 'FAIL activity_from_post: %', label;
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
create or replace function pg_temp.seen(p_post uuid) returns text[] language sql as $$
  select coalesce(array_agg(title order by title), '{}') from public.post_activities(p_post)
$$;

-- ───────── Accounts, communities, posts (server role) ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('fa000000-0000-0000-0000-0000000000a1'), ('fa000000-0000-0000-0000-0000000000a2'),
  ('fa000000-0000-0000-0000-0000000000a3'), ('fa000000-0000-0000-0000-0000000000a4'),
  ('fa000000-0000-0000-0000-0000000000a5');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('fa000000-0000-0000-0000-0000000000a1', 'Nadia', '1993-03-03', 'woman', 'dubai'),
  ('fa000000-0000-0000-0000-0000000000a2', 'Ines', '1994-04-04', 'woman', 'dubai'),
  ('fa000000-0000-0000-0000-0000000000a3', 'Marc', '1991-05-05', 'man', 'dubai'),
  ('fa000000-0000-0000-0000-0000000000a4', 'Omar', '1990-06-06', 'man', 'dubai'),
  ('fa000000-0000-0000-0000-0000000000a5', 'Bruno', '1989-07-07', 'man', 'dubai');
update public.profiles set verified_at = now()
where id in ('fa000000-0000-0000-0000-0000000000a1', 'fa000000-0000-0000-0000-0000000000a2');
insert into public.communities (id, city_id, name, category_id, girl_only, created_by) values
  ('fa000000-0000-0000-0000-0000000000c1', 'dubai', 'Post Plan Club', 'sport', false, 'fa000000-0000-0000-0000-0000000000a1'),
  ('fa000000-0000-0000-0000-0000000000c2', 'dubai', 'Post Plan Circle', 'girl', true, 'fa000000-0000-0000-0000-0000000000a1');
insert into public.community_members (community_id, user_id, role) values
  ('fa000000-0000-0000-0000-0000000000c1', 'fa000000-0000-0000-0000-0000000000a1', 'owner'),
  ('fa000000-0000-0000-0000-0000000000c1', 'fa000000-0000-0000-0000-0000000000a3', 'member'),
  ('fa000000-0000-0000-0000-0000000000c1', 'fa000000-0000-0000-0000-0000000000a5', 'member'),
  ('fa000000-0000-0000-0000-0000000000c2', 'fa000000-0000-0000-0000-0000000000a1', 'owner')
on conflict do nothing;
insert into public.blocks (blocker_id, blocked_id) values ('fa000000-0000-0000-0000-0000000000a2', 'fa000000-0000-0000-0000-0000000000a5');

-- Nadia posts in the club, in the circle, and a post she then removes.
select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a1');
insert into public.community_posts (id, community_id, author_id, body) values
  ('fa000000-0000-0000-0000-0000000000d1', 'fa000000-0000-0000-0000-0000000000c1', 'fa000000-0000-0000-0000-0000000000a1', 'Padel on Friday, who is in?'),
  ('fa000000-0000-0000-0000-0000000000d2', 'fa000000-0000-0000-0000-0000000000c2', 'fa000000-0000-0000-0000-0000000000a1', 'Brunch, ladies?'),
  ('fa000000-0000-0000-0000-0000000000d3', 'fa000000-0000-0000-0000-0000000000c1', 'fa000000-0000-0000-0000-0000000000a1', 'Removed later');
update public.community_posts set deleted_at = now() where id = 'fa000000-0000-0000-0000-0000000000d3';

-- ═════════════════════════ CREATE FROM A POST ═════════════════════════

select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a3');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy, community_id, source_post_id) values
  ('fa000000-0000-0000-0000-0000000000b1', 'fa000000-0000-0000-0000-0000000000a3', 'PP padel with Marc', 'sport', 'dubai', 'difc',
   now() + interval '2 days', 'public', 'fa000000-0000-0000-0000-0000000000c1', 'fa000000-0000-0000-0000-0000000000d1');
select pg_temp.check((select source_post_id = 'fa000000-0000-0000-0000-0000000000d1' from public.activities where id = 'fa000000-0000-0000-0000-0000000000b1'),
  'create: the source post is stored with the plan');
-- A double tap (new request id, same post) right after: refused, the first one stays the only one.
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, community_id, source_post_id, client_ref)
  values ('fa000000-0000-0000-0000-0000000000a3', 'PP padel again', 'sport', 'dubai', 'difc', now() + interval '2 days', 'fa000000-0000-0000-0000-0000000000c1', 'fa000000-0000-0000-0000-0000000000d1', gen_random_uuid())$$) = '23505',
  'double tap: a second plan from the same post within 2 minutes is refused (23505)');
select pg_temp.check((select count(*) = 1 from public.activities where source_post_id = 'fa000000-0000-0000-0000-0000000000d1'), 'double tap: one row only');
-- The same request id sent again is also caught by client_ref (unique).
-- A post he cannot see (women-only circle) or a removed one: refused.
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, source_post_id)
  values ('fa000000-0000-0000-0000-0000000000a3', 'PP circle by Marc', 'sport', 'dubai', 'difc', now() + interval '1 day', 'fa000000-0000-0000-0000-0000000000d2')$$) = '42501',
  'create: a man cannot link a post of a women-only circle he cannot see');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, source_post_id)
  values ('fa000000-0000-0000-0000-0000000000a3', 'PP removed', 'sport', 'dubai', 'difc', now() + interval '1 day', 'fa000000-0000-0000-0000-0000000000d3')$$) = '42501',
  'create: a removed post cannot be linked');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, source_post_id)
  values ('fa000000-0000-0000-0000-0000000000a3', 'PP nothing', 'sport', 'dubai', 'difc', now() + interval '1 day', 'fa000000-0000-0000-0000-0000000000ff')$$) in ('42501', '23503'),
  'create: an unknown post is refused');

-- A plan from a community's post stays in that community (same universe): none or another one is refused.
select pg_temp.as_admin();
update public.activities set created_at = now() - interval '3 minutes' where id = 'fa000000-0000-0000-0000-0000000000b1';
select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, source_post_id)
  values ('fa000000-0000-0000-0000-0000000000a3', 'PP outside', 'sport', 'dubai', 'difc', now() + interval '1 day', 'fa000000-0000-0000-0000-0000000000d1')$$) = '42501',
  'create: a plan from a club post cannot leave the club (no community)');
select pg_temp.as_admin();
insert into public.communities (id, city_id, name, category_id, girl_only, created_by) values
  ('fa000000-0000-0000-0000-0000000000c3', 'dubai', 'Post Plan Other', 'sport', false, 'fa000000-0000-0000-0000-0000000000a3');
insert into public.community_members (community_id, user_id, role) values ('fa000000-0000-0000-0000-0000000000c3', 'fa000000-0000-0000-0000-0000000000a3', 'owner') on conflict do nothing;
select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, community_id, source_post_id)
  values ('fa000000-0000-0000-0000-0000000000a3', 'PP elsewhere', 'sport', 'dubai', 'difc', now() + interval '1 day', 'fa000000-0000-0000-0000-0000000000c3', 'fa000000-0000-0000-0000-0000000000d1')$$) = '42501',
  'create: a plan from a club post cannot go to another community');
select pg_temp.check(pg_temp.fails($$update public.activities set community_id = 'fa000000-0000-0000-0000-0000000000c3' where id = 'fa000000-0000-0000-0000-0000000000b1'$$) = '42501',
  'host: a plan made from a post never moves to another community');
-- A profile post (no community): the plan may be anywhere.
select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a4');
insert into public.community_posts (id, community_id, author_id, body) values ('fa000000-0000-0000-0000-0000000000d4', null, 'fa000000-0000-0000-0000-0000000000a4', 'Anyone for a run?');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, source_post_id) values
  ('fa000000-0000-0000-0000-0000000000b6', 'fa000000-0000-0000-0000-0000000000a4', 'PP run with Omar', 'sport', 'dubai', 'difc', now() + interval '1 day', 'fa000000-0000-0000-0000-0000000000d4');
select pg_temp.check(exists (select 1 from public.activities where id = 'fa000000-0000-0000-0000-0000000000b6'), 'create: from a profile post, no community needed');

-- After the double-tap window, the same member may plan again from the post (a second session).
select pg_temp.as_admin();
update public.activities set created_at = now() - interval '3 minutes' where id = 'fa000000-0000-0000-0000-0000000000b1';
select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a3');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy, community_id, source_post_id) values
  ('fa000000-0000-0000-0000-0000000000b2', 'fa000000-0000-0000-0000-0000000000a3', 'PP padel next week', 'sport', 'dubai', 'difc',
   now() + interval '7 days', 'friends', 'fa000000-0000-0000-0000-0000000000c1', 'fa000000-0000-0000-0000-0000000000d1');
select pg_temp.check(exists (select 1 from public.activities where id = 'fa000000-0000-0000-0000-0000000000b2'), 'after the window: a second plan from the same post is allowed');

-- Bruno (club member) makes one too: another creator is never blocked by Marc's.
select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a5');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, community_id, source_post_id) values
  ('fa000000-0000-0000-0000-0000000000b3', 'fa000000-0000-0000-0000-0000000000a5', 'PP padel with Bruno', 'sport', 'dubai', 'difc',
   now() + interval '2 days', 'fa000000-0000-0000-0000-0000000000c1', 'fa000000-0000-0000-0000-0000000000d1');
select pg_temp.check(exists (select 1 from public.activities where id = 'fa000000-0000-0000-0000-0000000000b3'), 'another member plans from the same post at once');

-- Nadia: a women-only plan from her circle post, and a members-only plan from her club post.
select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience, community_id, source_post_id) values
  ('fa000000-0000-0000-0000-0000000000b4', 'fa000000-0000-0000-0000-0000000000a1', 'PP brunch circle', 'food', 'dubai', 'difc',
   now() + interval '2 days', true, 'girls', 'fa000000-0000-0000-0000-0000000000c2', 'fa000000-0000-0000-0000-0000000000d2');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy, community_id, source_post_id) values
  ('fa000000-0000-0000-0000-0000000000b5', 'fa000000-0000-0000-0000-0000000000a1', 'PP club members', 'sport', 'dubai', 'difc',
   now() + interval '3 days', 'community', 'fa000000-0000-0000-0000-0000000000c1', 'fa000000-0000-0000-0000-0000000000d1');

-- ═════════════════════════ READ (post_activities) ═════════════════════════

select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.seen('fa000000-0000-0000-0000-0000000000d1') = array['PP club members', 'PP padel with Bruno', 'PP padel with Marc'],
  'Nadia: public and members-only plans of her post; never Marc''s friends-only one');
select pg_temp.check(pg_temp.seen('fa000000-0000-0000-0000-0000000000d2') = array['PP brunch circle'], 'Nadia: the women-only plan of her circle post');
select pg_temp.check((select going = 1 and creator_name = 'Marc' and my_status is null
  from public.post_activities('fa000000-0000-0000-0000-0000000000d1') where id = 'fa000000-0000-0000-0000-0000000000b1'), 'card: count, host, my status');

select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.seen('fa000000-0000-0000-0000-0000000000d1') = array['PP club members', 'PP padel next week', 'PP padel with Bruno', 'PP padel with Marc'],
  'Marc: his own friends-only plan too, and the members-only one of his club');
select pg_temp.check(pg_temp.seen('fa000000-0000-0000-0000-0000000000d2') = '{}', 'Marc: nothing of a post he cannot see');

select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.seen('fa000000-0000-0000-0000-0000000000d1') = array['PP padel with Marc'],
  'Ines (outside the club, blocked Bruno): the public plan only, never the blocked man''s');

select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a4');
select pg_temp.check(pg_temp.seen('fa000000-0000-0000-0000-0000000000d3') = '{}', 'a removed post: nothing');

-- Cancelled or removed by the team: off the post.
select pg_temp.as_admin();
update public.activities set moderated_at = now() where id = 'fa000000-0000-0000-0000-0000000000b3';
select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a3');
update public.activities set cancelled_at = now() where id = 'fa000000-0000-0000-0000-0000000000b2';
select pg_temp.check(pg_temp.seen('fa000000-0000-0000-0000-0000000000d1') = array['PP club members', 'PP padel with Marc'],
  'cancelled and removed plans leave the post');

-- ═════════════════════════ LINK GUARDS ═════════════════════════

select pg_temp.check(pg_temp.fails($$update public.activities set source_post_id = 'fa000000-0000-0000-0000-0000000000d3' where id = 'fa000000-0000-0000-0000-0000000000b1'$$) = '42501',
  'host: a plan cannot move to another post');
update public.activities set source_post_id = null where id = 'fa000000-0000-0000-0000-0000000000b1';
select pg_temp.check((select source_post_id is null from public.activities where id = 'fa000000-0000-0000-0000-0000000000b1'), 'host: the link can be removed');
select pg_temp.check(pg_temp.fails($$update public.activities set source_post_id = 'fa000000-0000-0000-0000-0000000000d1' where id = 'fa000000-0000-0000-0000-0000000000b1'$$) = '42501',
  'host: an unlinked plan cannot be linked again afterwards');
-- Signed out and anon.
select pg_temp.as_admin();
set role authenticated;
select pg_temp.check(pg_temp.fails($$select * from public.post_activities('fa000000-0000-0000-0000-0000000000d1')$$) = '42501', 'signed out: refused');
reset role;
set role anon;
select pg_temp.check(pg_temp.fails($$select * from public.post_activities('fa000000-0000-0000-0000-0000000000d1')$$) = '42501', 'anon: no access');
reset role;
-- Removing the post keeps the plan (link set to null).
select pg_temp.as_admin();
delete from public.community_posts where id = 'fa000000-0000-0000-0000-0000000000d2';
select pg_temp.check((select source_post_id is null from public.activities where id = 'fa000000-0000-0000-0000-0000000000b4'), 'a deleted post leaves its plans in place');

-- ═════════════════════════ MOVING AN ACTIVITY ═════════════════════════

select pg_temp.as_user('fa000000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails($$update public.activities set starts_at = now() - interval '1 hour' where id = 'fa000000-0000-0000-0000-0000000000b1'$$) = '22023',
  'host: an activity cannot be moved into the past');
update public.activities set starts_at = now() + interval '3 days', ends_at = now() + interval '3 days 2 hours' where id = 'fa000000-0000-0000-0000-0000000000b1';
select pg_temp.check((select starts_at > now() + interval '2 days 23 hours' from public.activities where id = 'fa000000-0000-0000-0000-0000000000b1'), 'host: moved to a later time');
update public.activities set title = 'PP padel with Marc!' where id = 'fa000000-0000-0000-0000-0000000000b1';
select pg_temp.check((select title = 'PP padel with Marc!' from public.activities where id = 'fa000000-0000-0000-0000-0000000000b1'), 'host: other edits never touch the time');

-- ═════════════════════════ REMINDERS FOLLOW THE TIME ═════════════════════════

select pg_temp.as_admin();
update public.activities set starts_at = now() + interval '110 minutes', ends_at = null where id = 'fa000000-0000-0000-0000-0000000000b1';
insert into public.activity_participants (activity_id, user_id, status) values ('fa000000-0000-0000-0000-0000000000b1', 'fa000000-0000-0000-0000-0000000000a4', 'going')
on conflict (activity_id, user_id) do update set status = 'going';
select private.send_activity_reminders();
select pg_temp.check((select count(*) = 1 from public.notifications where user_id = 'fa000000-0000-0000-0000-0000000000a4' and kind = 'ACTIVITY_REMINDER'
  and payload ->> 'activity_id' = 'fa000000-0000-0000-0000-0000000000b1' and (payload ->> 'starts_at')::timestamptz = (select starts_at from public.activities where id = 'fa000000-0000-0000-0000-0000000000b1')),
  'reminder: sent 110 minutes before, with the start it is for');
select private.send_activity_reminders();
select pg_temp.check((select count(*) = 1 from public.notifications where user_id = 'fa000000-0000-0000-0000-0000000000a4' and kind = 'ACTIVITY_REMINDER'
  and payload ->> 'activity_id' = 'fa000000-0000-0000-0000-0000000000b1'), 'reminder: never twice for the same start');
update public.activities set starts_at = now() + interval '118 minutes' where id = 'fa000000-0000-0000-0000-0000000000b1';
select private.send_activity_reminders();
select pg_temp.check((select count(*) = 2 from public.notifications where user_id = 'fa000000-0000-0000-0000-0000000000a4' and kind = 'ACTIVITY_REMINDER'
  and payload ->> 'activity_id' = 'fa000000-0000-0000-0000-0000000000b1'), 'reminder: moved to another time, reminded again for the new start');
update public.activities set starts_at = now() + interval '5 hours' where id = 'fa000000-0000-0000-0000-0000000000b1';
select pg_temp.check(private.send_activity_reminders() = 0, 'reminder: nothing outside the 105–120 minute window');

-- ───────── Clean up ─────────
select pg_temp.as_admin();
delete from public.notifications where user_id::text like 'fa000000-%';
delete from public.activities where creator_id in (select id from auth.users where id::text like 'fa000000-%');
delete from public.community_posts where author_id::text like 'fa000000-%';
delete from public.communities where id in ('fa000000-0000-0000-0000-0000000000c1', 'fa000000-0000-0000-0000-0000000000c2', 'fa000000-0000-0000-0000-0000000000c3');
delete from public.blocks where blocker_id = 'fa000000-0000-0000-0000-0000000000a2';
delete from public.profiles where id::text like 'fa000000-%';
delete from auth.users where id::text like 'fa000000-%';
