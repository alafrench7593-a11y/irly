-- The social graph with three members (A, B, C): follows and friend requests
-- are idempotent, a request both ways is one friendship (accepted), cancel /
-- decline / unfriend / block leave no contradictory state, and every counter
-- on a profile (followers, following, friends) agrees with the lists the app
-- shows for it, after an unfollow, a block, a closed account and a deleted one.
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

-- Acting as a member: the RPCs read auth.uid() (they are security definer).
create or replace function pg_temp.act(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
end $$;

-- What a profile header says, and what its lists show, as `viewer` sees them.
create or replace function pg_temp.counts_agree(viewer uuid, target uuid, label text) returns void language plpgsql as $$
declare
  p record;
begin
  perform pg_temp.act(viewer);
  select * into p from public.public_profile(target);
  perform pg_temp.check(p.followers = (select count(*) from public.follow_list(target, 'followers')), label || ': followers count = followers list');
  perform pg_temp.check(p.following = (select count(*) from public.follow_list(target, 'following')), label || ': following count = following list');
  perform pg_temp.check(p.friends = (select count(*) from public.friend_list(target)), label || ': friends count = friends list');
end $$;

reset role;
select pg_temp.act(null);
-- As on Supabase: table rights for members, row-level security decides.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

insert into auth.users (id) values
  ('c9800000-0000-0000-0000-0000000000a1'), ('c9800000-0000-0000-0000-0000000000a2'),
  ('c9800000-0000-0000-0000-0000000000a3'), ('c9800000-0000-0000-0000-0000000000a4');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c9800000-0000-0000-0000-0000000000a1', 'Ava', '1994-03-03', 'woman', 'dubai'),
  ('c9800000-0000-0000-0000-0000000000a2', 'Ben', '1993-05-05', 'man', 'dubai'),
  ('c9800000-0000-0000-0000-0000000000a3', 'Cam', '1992-07-07', 'man', 'dubai'),
  ('c9800000-0000-0000-0000-0000000000a4', 'Dee', '1991-08-08', 'woman', 'dubai');

do $$
declare
  a constant uuid := 'c9800000-0000-0000-0000-0000000000a1';
  b constant uuid := 'c9800000-0000-0000-0000-0000000000a2';
  c constant uuid := 'c9800000-0000-0000-0000-0000000000a3';
  p record;
  r text;
  base bigint := coalesce((select max(id) from public.sync_signals), 0);
begin
  /* ───── Follows ───── */
  perform pg_temp.act(a);
  perform public.follow_user(b);
  perform public.follow_user(b); -- double tap
  perform pg_temp.check((select count(*) from public.follows where follower_id = a and followee_id = b) = 1, 'follow twice: one row');
  perform pg_temp.check((select count(*) from public.notifications where user_id = b and kind = 'NEW_FOLLOWER' and payload ->> 'from' = a::text) = 1, 'follow twice: one notification');
  perform public.follow_user(c);
  perform pg_temp.act(c);
  perform public.follow_user(a);
  perform pg_temp.act(a);
  select * into p from public.public_profile(a);
  perform pg_temp.check(p.followers = 1 and p.following = 2, 'own profile: 1 follower, 2 following');
  select * into p from public.public_profile(b);
  perform pg_temp.check(p.followers = 1 and p.i_follow and not p.follows_me, 'B''s profile: 1 follower, I follow, not followed back');
  begin
    perform public.follow_user(a);
    perform pg_temp.check(false, 'following yourself is refused');
  exception when sqlstate '22023' then
    perform pg_temp.check(true, 'following yourself is refused');
  end;

  -- Unfollow: idempotent, both people told (Realtime cannot hear the DELETE).
  perform public.unfollow_user(b);
  perform public.unfollow_user(b);
  perform pg_temp.check(not exists (select 1 from public.follows where follower_id = a and followee_id = b), 'unfollow twice: no row');
  perform pg_temp.check((select count(*) from public.sync_signals where id > base and kind = 'follows' and user_id = a) = 1
    and (select count(*) from public.sync_signals where id > base and kind = 'follows' and user_id = b) = 1, 'unfollow: one signal each for both');
  select * into p from public.public_profile(b);
  perform pg_temp.check(p.followers = 0 and not p.i_follow, 'after unfollow: B has 0 followers');
  -- Follow again the same day: no second notification.
  perform public.follow_user(b);
  perform pg_temp.check((select count(*) from public.notifications where user_id = b and kind = 'NEW_FOLLOWER' and payload ->> 'from' = a::text) = 1, 'refollow the same day: still one notification');

  /* ───── Friend requests ───── */
  r := public.add_friend(b);
  perform pg_temp.check(r = 'pending', 'request: pending');
  r := public.add_friend(b);
  perform pg_temp.check(r = 'pending' and (select count(*) from public.friendships where requested_by = a) = 1, 'request twice: one pending row');
  perform pg_temp.check((select count(*) from public.notifications where user_id = b and kind = 'FRIEND_REQUEST' and payload ->> 'from' = a::text) = 1, 'request twice: one notification');
  select * into p from public.public_profile(b);
  perform pg_temp.check(p.friend_status = 'outgoing' and p.friends = 0, 'requester sees outgoing, 0 friends');
  perform pg_temp.act(b);
  select * into p from public.public_profile(a);
  perform pg_temp.check(p.friend_status = 'incoming', 'recipient sees incoming');

  -- Decline (the recipient removes it): row and the request notification go.
  perform public.remove_friend(a);
  perform pg_temp.check(not exists (select 1 from public.friendships where least(a, b) = user_a and greatest(a, b) = user_b), 'decline: no row');
  perform pg_temp.check(not exists (select 1 from public.notifications where user_id = b and kind = 'FRIEND_REQUEST' and payload ->> 'from' = a::text), 'decline: request notification gone');
  perform pg_temp.check((select count(*) from public.sync_signals where id > base and kind = 'friends' and user_id in (a, b)) = 2, 'decline: both told');

  -- Cancel (the requester withdraws).
  perform pg_temp.act(a);
  perform public.add_friend(b);
  perform public.remove_friend(b);
  perform public.remove_friend(b); -- twice: nothing left to do, no error
  perform pg_temp.check(not exists (select 1 from public.friendships where user_a = least(a, b) and user_b = greatest(a, b)), 'cancel twice: no row');
  perform pg_temp.act(b);
  select * into p from public.public_profile(a);
  perform pg_temp.check(p.friend_status = 'none', 'after cancel: none for the recipient');

  -- A request both ways is one friendship, accepted (one row per pair).
  perform pg_temp.act(a);
  r := public.add_friend(b);
  perform pg_temp.act(b);
  r := public.add_friend(a);
  perform pg_temp.check(r = 'accepted', 'request both ways: accepted');
  perform pg_temp.check((select count(*) from public.friendships where user_a = least(a, b) and user_b = greatest(a, b)) = 1
    and (select status from public.friendships where user_a = least(a, b) and user_b = greatest(a, b)) = 'accepted', 'request both ways: one accepted row');
  perform pg_temp.check((select requested_by from public.friendships where user_a = least(a, b) and user_b = greatest(a, b)) = a, 'accepted row keeps who asked');
  perform pg_temp.check((select count(*) from public.notifications where user_id = a and kind = 'FRIEND_ACCEPTED' and payload ->> 'from' = b::text) = 1, 'acceptance notifies the requester once');
  perform pg_temp.check(not exists (select 1 from public.notifications where user_id = b and kind = 'FRIEND_REQUEST' and payload ->> 'from' = a::text and read_at is null), 'acceptance leaves no unread request');
  r := public.add_friend(a); -- tapped again
  perform pg_temp.check(r = 'accepted' and (select count(*) from public.notifications where user_id = a and kind = 'FRIEND_ACCEPTED') = 1, 'accept twice: idempotent, one notification');
  select * into p from public.public_profile(a);
  perform pg_temp.check(p.friend_status = 'friends' and p.friends = 1, 'both see friends, 1 friend');
  perform pg_temp.act(a);
  select * into p from public.public_profile(b);
  perform pg_temp.check(p.friend_status = 'friends' and p.friends = 1, 'friends from the other side');

  -- C asks A, A asks C: one row (the advisory lock makes this safe when concurrent too).
  perform pg_temp.act(c);
  perform public.add_friend(a);
  perform pg_temp.act(a);
  r := public.add_friend(c);
  perform pg_temp.check(r = 'accepted' and (select count(*) from public.friendships where a in (user_a, user_b)) = 2, 'cross requests with C: accepted, one row');

  perform pg_temp.counts_agree(a, a, 'A by A');
  perform pg_temp.counts_agree(b, a, 'A by B');
  perform pg_temp.counts_agree(a, c, 'C by A');

  /* ───── Block: every tie ends both ways, nothing can be re-made ───── */
  perform public.block_user(c);
  perform pg_temp.check(not exists (select 1 from public.follows where (follower_id = a and followee_id = c) or (follower_id = c and followee_id = a)), 'block: follows both ways gone');
  perform pg_temp.check(not exists (select 1 from public.friendships where user_a = least(a, c) and user_b = greatest(a, c)), 'block: friendship gone');
  perform pg_temp.act(c);
  begin
    perform public.follow_user(a);
    perform pg_temp.check(false, 'blocked: cannot follow');
  exception when sqlstate 'P0002' then
    perform pg_temp.check(true, 'blocked: cannot follow');
  end;
  begin
    perform public.add_friend(a);
    perform pg_temp.check(false, 'blocked: cannot ask');
  exception when sqlstate 'P0002' then
    perform pg_temp.check(true, 'blocked: cannot ask');
  end;
  perform pg_temp.counts_agree(a, a, 'A after block');
  perform pg_temp.counts_agree(b, a, 'A by B after block');
  perform pg_temp.act(a);
  select * into p from public.public_profile(a);
  perform pg_temp.check(p.followers = 0 and p.following = 1 and p.friends = 1, 'A after block: 0 followers, 1 following, 1 friend');
  -- C follows B: A (who blocked C) sees B's counter without C, as B's list.
  perform pg_temp.act(c);
  perform public.follow_user(b);
  perform pg_temp.counts_agree(a, b, 'B by A, a follower A blocked');
  perform pg_temp.counts_agree(b, b, 'B by B');
  select * into p from public.public_profile(b);
  perform pg_temp.check(p.followers = 2, 'B by B: both followers counted');
end $$;

/* ───── Accounts that go ───── */
do $$
declare
  a constant uuid := 'c9800000-0000-0000-0000-0000000000a1';
  b constant uuid := 'c9800000-0000-0000-0000-0000000000a2';
  d constant uuid := 'c9800000-0000-0000-0000-0000000000a4';
  p record;
begin
  -- D follows A, A follows D, D befriends A; then D's profile is closed (deleted_at).
  perform pg_temp.act(d);
  perform public.follow_user(a);
  perform pg_temp.act(a);
  perform public.follow_user(d);
  perform pg_temp.counts_agree(b, a, 'A by B with D');
  perform pg_temp.act(null);
  update public.profiles set deleted_at = now() where id = d;
  perform pg_temp.counts_agree(b, a, 'A by B, D closed');
  perform pg_temp.counts_agree(a, a, 'A by A, D closed');
  perform pg_temp.act(a);
  select * into p from public.public_profile(d);
  perform pg_temp.check(p is null or p.id is null, 'a closed profile is not shown');
  begin
    perform public.follow_user(d);
    perform pg_temp.check(false, 'a closed profile cannot be followed');
  exception when sqlstate 'P0002' then
    perform pg_temp.check(true, 'a closed profile cannot be followed');
  end;

  -- B's account deleted for good: every tie goes, A's counters follow.
  perform pg_temp.act(null);
  delete from auth.users where id = b;
  perform pg_temp.check(not exists (select 1 from public.follows where b in (follower_id, followee_id))
    and not exists (select 1 from public.friendships where b in (user_a, user_b)), 'deleted account: no follow or friendship left');
  perform pg_temp.counts_agree(a, a, 'A after B deleted');
  perform pg_temp.act(a);
  select * into p from public.public_profile(a);
  perform pg_temp.check(p.followers = 0 and p.following = 0 and p.friends = 0, 'A after B deleted and D closed: 0 / 0 / 0');
end $$;

/* ───── What a member can read of the graph (Realtime uses the same rule) ───── */
reset role;
select set_config('request.jwt.claim.sub', 'c9800000-0000-0000-0000-0000000000a3', false);
set role authenticated;
do $$
begin
  -- C is blocked by A: C reads no follow or friendship of A's.
  perform pg_temp.check(not exists (select 1 from public.follows where 'c9800000-0000-0000-0000-0000000000a1' in (follower_id, followee_id)), 'others'' follows are not readable');
  perform pg_temp.check(not exists (select 1 from public.friendships where 'c9800000-0000-0000-0000-0000000000a1' in (user_a, user_b)), 'others'' friendships are not readable');
  begin
    insert into public.follows (follower_id, followee_id) values ('c9800000-0000-0000-0000-0000000000a3', 'c9800000-0000-0000-0000-0000000000a1');
    perform pg_temp.check(false, 'no direct follow insert (only follow_user)');
  exception when insufficient_privilege then
    perform pg_temp.check(true, 'no direct follow insert (only follow_user)');
  end;
  begin
    insert into public.friendships (user_a, user_b, requested_by, status) values ('c9800000-0000-0000-0000-0000000000a1', 'c9800000-0000-0000-0000-0000000000a3', 'c9800000-0000-0000-0000-0000000000a3', 'accepted');
    perform pg_temp.check(false, 'no direct friendship insert (only add_friend)');
  exception when insufficient_privilege then
    perform pg_temp.check(true, 'no direct friendship insert (only add_friend)');
  end;
end $$;
reset role;
