-- Friends are members who follow each other (migration
-- 20261110500000_irly_follow_mutual): follow, follow back, unfollow, block,
-- unblock, account deletion, counters, and everything that says « friends »
-- (friends-only activities, messages, profiles). Also member_activities'
-- universe. Runs after irly_test.sql on the same database
-- (scripts/test-db.sh). TEST accounts only, ids prefixed f0110000-….
--
--   a1 Alma   woman (persona A)
--   a2 Bilal  man   (persona B): only friends may message him
--   a3 Chloe  woman: her profile is for friends only
--   a4 Dina   woman: asks for friendship the old way (an older app)
--   a5 Emil   man: deletes his account
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
    raise exception 'FAIL follow_mutual: %', label;
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
-- Server truth, read as the server.
create or replace function pg_temp.friends(a uuid, b uuid) returns boolean language sql as $$
  select private.friends_unchecked(a, b)
$$;
create or replace function pg_temp.follows(a uuid, b uuid) returns boolean language sql as $$
  select exists (select 1 from public.follows where follower_id = a and followee_id = b)
$$;

select pg_temp.as_admin();
insert into auth.users (id) values
  ('f0110000-0000-0000-0000-0000000000a1'), ('f0110000-0000-0000-0000-0000000000a2'),
  ('f0110000-0000-0000-0000-0000000000a3'), ('f0110000-0000-0000-0000-0000000000a4'),
  ('f0110000-0000-0000-0000-0000000000a5');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('f0110000-0000-0000-0000-0000000000a1', 'Alma', '1994-02-02', 'woman', 'dubai'),
  ('f0110000-0000-0000-0000-0000000000a2', 'Bilal', '1992-03-03', 'man', 'dubai'),
  ('f0110000-0000-0000-0000-0000000000a3', 'Chloe', '1996-04-04', 'woman', 'dubai'),
  ('f0110000-0000-0000-0000-0000000000a4', 'Dina', '1995-05-05', 'woman', 'dubai'),
  ('f0110000-0000-0000-0000-0000000000a5', 'Emil', '1990-06-06', 'man', 'dubai');
insert into public.safety_settings (user_id, who_can_message) values ('f0110000-0000-0000-0000-0000000000a2', 'friends')
on conflict (user_id) do update set who_can_message = excluded.who_can_message;
insert into public.safety_settings (user_id, profile_visibility) values ('f0110000-0000-0000-0000-0000000000a3', 'friends')
on conflict (user_id) do update set profile_visibility = excluded.profile_visibility;
-- Bilal's plan for friends only.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, place_name, starts_at, capacity, privacy, client_ref)
values ('f0110000-0000-0000-0000-0000000000b1', 'f0110000-0000-0000-0000-0000000000a2', 'Friends padel', 'sport', 'dubai', 'jumeirah', 'Padel Club',
  now() + interval '3 days', 4, 'friends', 'f0110000-0000-0000-0000-0000000000e1');

create temp table counts (who text primary key, followers integer, following integer, status text);
grant all on counts to authenticated;

-- ───── A follows B: a follow, not a friendship ─────
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
select public.follow_user('f0110000-0000-0000-0000-0000000000a2');
select public.follow_user('f0110000-0000-0000-0000-0000000000a2'); -- a double tap is one row
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.follows where follower_id = 'f0110000-0000-0000-0000-0000000000a1' and followee_id = 'f0110000-0000-0000-0000-0000000000a2') = 1, 'follow: one row, even tapped twice');
select pg_temp.check(not pg_temp.friends('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a2'), 'follow alone: not friends');
select pg_temp.check(not exists (select 1 from public.friendships where user_a = 'f0110000-0000-0000-0000-0000000000a1' and user_b = 'f0110000-0000-0000-0000-0000000000a2'), 'follow alone: no friendship row, no request');
select pg_temp.check(not exists (select 1 from public.notifications where user_id = 'f0110000-0000-0000-0000-0000000000a2' and kind = 'FRIEND_REQUEST'), 'follow alone: no friend request sent');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.check(not exists (select 1 from public.activities where id = 'f0110000-0000-0000-0000-0000000000b1'), 'follow alone: B''s friends-only plan stays hidden from A');
select pg_temp.check(not private.may_message('f0110000-0000-0000-0000-0000000000a2'), 'follow alone: A may not message B (friends only)');

-- ───── B follows A back: friends, automatically ─────
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a2');
select public.follow_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.friends('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a2'), 'follow back: friends');
select pg_temp.check((select requested_by from public.friendships where user_a = 'f0110000-0000-0000-0000-0000000000a1' and user_b = 'f0110000-0000-0000-0000-0000000000a2') = 'f0110000-0000-0000-0000-0000000000a1', 'follow back: the first to follow is the one who « asked »');
select pg_temp.check(not exists (select 1 from public.notifications where user_id in ('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a2') and kind in ('FRIEND_REQUEST', 'FRIEND_ACCEPTED')), 'follow back: no request or acceptance step');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.check(private.are_friends('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a2'), 'follow back: A sees B as a friend');
select pg_temp.check(exists (select 1 from public.activities where id = 'f0110000-0000-0000-0000-0000000000b1'), 'follow back: B''s friends-only plan is visible to A');
select pg_temp.check(private.may_message('f0110000-0000-0000-0000-0000000000a2'), 'follow back: A may message B (friends only)');
insert into counts select 'B seen by A', followers, following, friend_status from public.public_profile('f0110000-0000-0000-0000-0000000000a2');
insert into counts select 'A seen by A', followers, following, friend_status from public.public_profile('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.check((select followers = 1 and following = 1 and status = 'friends' from counts where who = 'B seen by A'), 'counters: B has 1 follower, follows 1; friend_status friends');
select pg_temp.check((select followers = 1 and following = 1 from counts where who = 'A seen by A'), 'counters: A has 1 follower, follows 1');
select pg_temp.check(exists (select 1 from public.friend_list('f0110000-0000-0000-0000-0000000000a1') where id = 'f0110000-0000-0000-0000-0000000000a2'), 'friend_list: B is in A''s friends');

-- ───── A unfollows B: the friendship ends, B''s follow of A stays ─────
select public.unfollow_user('f0110000-0000-0000-0000-0000000000a2');
select pg_temp.as_admin();
select pg_temp.check(not pg_temp.friends('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a2'), 'unfollow: no longer friends');
select pg_temp.check(pg_temp.follows('f0110000-0000-0000-0000-0000000000a2', 'f0110000-0000-0000-0000-0000000000a1'), 'unfollow: B still follows A');
select pg_temp.check(not exists (select 1 from public.friendships where user_a = 'f0110000-0000-0000-0000-0000000000a1' and user_b = 'f0110000-0000-0000-0000-0000000000a2'), 'unfollow: the friendship row is gone');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
delete from counts;
insert into counts select 'B', followers, following, friend_status from public.public_profile('f0110000-0000-0000-0000-0000000000a2');
insert into counts select 'A', followers, following, friend_status from public.public_profile('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.check((select followers = 0 and following = 1 and status = 'none' from counts where who = 'B'), 'counters after unfollow: B 0 followers, still follows 1');
select pg_temp.check((select followers = 1 and following = 0 from counts where who = 'A'), 'counters after unfollow: A keeps B as follower, follows nobody');
select pg_temp.check(not exists (select 1 from public.activities where id = 'f0110000-0000-0000-0000-0000000000b1'), 'unfollow: B''s friends-only plan is hidden again');
select pg_temp.check(not private.may_message('f0110000-0000-0000-0000-0000000000a2'), 'unfollow: A may no longer message B');

-- Following again: friends again (B still follows A).
select public.follow_user('f0110000-0000-0000-0000-0000000000a2');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.friends('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a2'), 'follow again: friends again');

-- ───── A friends-only profile: following back is always possible ─────
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($$select public.follow_user('f0110000-0000-0000-0000-0000000000a3')$$) = '42501', 'friends-only profile: a stranger cannot follow it');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a3');
select public.follow_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($$select public.follow_user('f0110000-0000-0000-0000-0000000000a3')$$) is null, 'friends-only profile: you can follow back someone who follows you');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.friends('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a3'), 'friends-only profile: friends after the follow back');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.check((select visible from public.public_profile('f0110000-0000-0000-0000-0000000000a3')), 'friends-only profile: visible to the new friend');

-- ───── An older app''s friend request: accepted means both follows ─────
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a4');
select pg_temp.check(public.add_friend('f0110000-0000-0000-0000-0000000000a1') = 'pending', 'old request: still recorded (kept for older apps)');
select pg_temp.as_admin();
select pg_temp.check(not pg_temp.follows('f0110000-0000-0000-0000-0000000000a4', 'f0110000-0000-0000-0000-0000000000a1') and not pg_temp.friends('f0110000-0000-0000-0000-0000000000a4', 'f0110000-0000-0000-0000-0000000000a1'), 'old request: a pending request is not a follow nor a friendship');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.check(public.add_friend('f0110000-0000-0000-0000-0000000000a4') = 'accepted', 'old request: accepted');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.follows('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a4') and pg_temp.follows('f0110000-0000-0000-0000-0000000000a4', 'f0110000-0000-0000-0000-0000000000a1'), 'old request accepted: they follow each other');
-- remove_friend (older app): the member who removes unfollows; the other''s follow stays.
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
select public.remove_friend('f0110000-0000-0000-0000-0000000000a4');
select pg_temp.as_admin();
select pg_temp.check(not pg_temp.follows('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a4'), 'remove_friend: the one who removes unfollows');
select pg_temp.check(pg_temp.follows('f0110000-0000-0000-0000-0000000000a4', 'f0110000-0000-0000-0000-0000000000a1'), 'remove_friend: the other one''s follow stays');
select pg_temp.check(not pg_temp.friends('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a4'), 'remove_friend: not friends');

-- ───── Block: ends following and friendship both ways; unblock restores nothing ─────
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a2');
select public.block_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.as_admin();
select pg_temp.check(not pg_temp.follows('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a2') and not pg_temp.follows('f0110000-0000-0000-0000-0000000000a2', 'f0110000-0000-0000-0000-0000000000a1'), 'block: no follow either way');
select pg_temp.check(not exists (select 1 from public.friendships where user_a = 'f0110000-0000-0000-0000-0000000000a1' and user_b = 'f0110000-0000-0000-0000-0000000000a2'), 'block: friendship gone');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($$select public.follow_user('f0110000-0000-0000-0000-0000000000a2')$$) = 'P0002', 'block: A cannot follow B');
select pg_temp.check((select following from public.public_profile('f0110000-0000-0000-0000-0000000000a1')) = 1, 'block: A''s following count drops to Chloe only');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a2');
select public.unblock_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.as_admin();
select pg_temp.check(not pg_temp.friends('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a2') and not pg_temp.follows('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a2'), 'unblock: nothing comes back by itself');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
select public.follow_user('f0110000-0000-0000-0000-0000000000a2');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a2');
select public.follow_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.friends('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a2'), 'unblock: following each other again makes them friends again');

-- ───── Account deletion: the rows go, the counters follow ─────
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a5');
select public.follow_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
select public.follow_user('f0110000-0000-0000-0000-0000000000a5');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.friends('f0110000-0000-0000-0000-0000000000a1', 'f0110000-0000-0000-0000-0000000000a5'), 'deletion: Emil and Alma were friends');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
delete from counts;
insert into counts select 'A', followers, following, friend_status from public.public_profile('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a5');
select public.delete_my_account();
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.follows where 'f0110000-0000-0000-0000-0000000000a5' in (follower_id, followee_id)), 'deletion: no follow left');
select pg_temp.check(not exists (select 1 from public.friendships where 'f0110000-0000-0000-0000-0000000000a5' in (user_a, user_b)), 'deletion: no friendship left');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.check((select p.followers = c.followers - 1 and p.following = c.following - 1 from public.public_profile('f0110000-0000-0000-0000-0000000000a1') p, counts c where c.who = 'A'), 'deletion: A''s counters drop by one each');

-- ───── The rule holds everywhere: friendship ⇔ mutual follow ─────
select pg_temp.as_admin();
select pg_temp.check(not exists (
  select 1 from public.friendships f
  where f.status = 'accepted'
    and not private.blocked_unchecked(f.user_a, f.user_b)
    and exists (select 1 from public.profiles p where p.id = f.user_a and p.deleted_at is null)
    and exists (select 1 from public.profiles p where p.id = f.user_b and p.deleted_at is null)
    and not (pg_temp.follows(f.user_a, f.user_b) and pg_temp.follows(f.user_b, f.user_a))), 'invariant: every friendship is a mutual follow');
select pg_temp.check(not exists (
  select 1 from public.follows f
  join public.follows r on r.follower_id = f.followee_id and r.followee_id = f.follower_id
  where not private.friends_unchecked(f.follower_id, f.followee_id)), 'invariant: every mutual follow is a friendship');

-- ───── member_activities: each activity says its universe ─────
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a2');
select pg_temp.check((select universe = 'mixte' and not girl_only from public.member_activities('f0110000-0000-0000-0000-0000000000a2') where id = 'f0110000-0000-0000-0000-0000000000b1'), 'member_activities: a plan without community is Mixte');
select pg_temp.check(not has_function_privilege('anon', 'public.member_activities(uuid)', 'execute'), 'member_activities: not for anon');
select pg_temp.as_admin();
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, place_name, starts_at, capacity, privacy, girl_only, client_ref)
values ('f0110000-0000-0000-0000-0000000000b2', 'f0110000-0000-0000-0000-0000000000a1', 'Girls brunch', 'food', 'dubai', 'jumeirah', 'Cafe',
  now() + interval '4 days', 6, 'public', true, 'f0110000-0000-0000-0000-0000000000e2');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a1');
select pg_temp.check((select universe = 'girl' and girl_only from public.member_activities('f0110000-0000-0000-0000-0000000000a1') where id = 'f0110000-0000-0000-0000-0000000000b2'), 'member_activities: a women-only plan is Girl');
select pg_temp.as_user('f0110000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.member_activities('f0110000-0000-0000-0000-0000000000a1') where id = 'f0110000-0000-0000-0000-0000000000b2'), 'member_activities: a women-only plan stays hidden from a man (RLS kept)');
select pg_temp.as_admin();
