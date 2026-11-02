-- QA fixes for moderation, communities and IRLY Girl access (migration
-- 20261103100000_irly_qa_fix_moderation; QA reports communities.md and
-- spaces.md). One section per bug id. Ids b0b00000-….
-- Every check fails before that migration, except those marked (guard):
-- behaviour that already held and must keep holding with the fix.
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
  if not coalesce(ok, false) then raise exception 'FAIL moderation_qa_fixes: %', label; end if;
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

-- Rows a statement changed (-1 when it fails).
create or replace function pg_temp.changed(stmt text) returns integer language plpgsql as $$
declare n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when others then
  return -1;
end $$;

select pg_temp.as_admin();

-- 01 owner, 02 admin, 03 moderator Mo, 04 moderator Modi, 05 content Cleo,
-- 06 Marc, 07 Mia (verified woman), 08 Max, 09 Wendy (community owner), 10 Hal.
insert into auth.users (id) values
  ('b0b00000-0000-0000-0000-000000000001'), ('b0b00000-0000-0000-0000-000000000002'), ('b0b00000-0000-0000-0000-000000000003'),
  ('b0b00000-0000-0000-0000-000000000004'), ('b0b00000-0000-0000-0000-000000000005'), ('b0b00000-0000-0000-0000-000000000006'),
  ('b0b00000-0000-0000-0000-000000000007'), ('b0b00000-0000-0000-0000-000000000008'), ('b0b00000-0000-0000-0000-000000000009'),
  ('b0b00000-0000-0000-0000-000000000010');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('b0b00000-0000-0000-0000-000000000001', 'Sam', '1990-01-01', 'man', 'dubai'),
  ('b0b00000-0000-0000-0000-000000000002', 'Ada', '1990-01-01', 'woman', 'dubai'),
  ('b0b00000-0000-0000-0000-000000000003', 'Mo', '1990-01-01', 'man', 'dubai'),
  ('b0b00000-0000-0000-0000-000000000004', 'Modi', '1990-01-01', 'man', 'dubai'),
  ('b0b00000-0000-0000-0000-000000000005', 'Cleo', '1990-01-01', 'man', 'dubai'),
  ('b0b00000-0000-0000-0000-000000000006', 'Marc', '1990-01-01', 'man', 'dubai'),
  ('b0b00000-0000-0000-0000-000000000007', 'Mia', '1990-01-01', 'woman', 'dubai'),
  ('b0b00000-0000-0000-0000-000000000008', 'Max', '1990-01-01', 'man', 'dubai'),
  ('b0b00000-0000-0000-0000-000000000009', 'Wendy', '1990-01-01', 'woman', 'dubai'),
  ('b0b00000-0000-0000-0000-000000000010', 'Hal', '1990-01-01', 'man', 'dubai');
update public.profiles set created_at = now() - interval '90 days' where id::text like 'b0b00000-%';
update public.profiles set verified_at = now() where id = 'b0b00000-0000-0000-0000-000000000007';
insert into public.staff_roles (user_id, role) values
  ('b0b00000-0000-0000-0000-000000000001', 'owner'), ('b0b00000-0000-0000-0000-000000000002', 'admin'),
  ('b0b00000-0000-0000-0000-000000000003', 'moderator'), ('b0b00000-0000-0000-0000-000000000004', 'moderator'),
  ('b0b00000-0000-0000-0000-000000000005', 'content');

-- Wendy's community « QA Foodies » (c1) with its chat, and a women-only one (c2).
insert into public.communities (id, city_id, name, created_by) values
  ('b0b00000-0000-0000-0000-0000000000c1', 'dubai', 'QA Foodies', 'b0b00000-0000-0000-0000-000000000009');
insert into public.communities (id, city_id, name, created_by, girl_only) values
  ('b0b00000-0000-0000-0000-0000000000c2', 'dubai', 'QA Girls Brunch', 'b0b00000-0000-0000-0000-000000000009', true);
insert into public.community_members (community_id, user_id, role) values
  ('b0b00000-0000-0000-0000-0000000000c1', 'b0b00000-0000-0000-0000-000000000009', 'owner'),
  ('b0b00000-0000-0000-0000-0000000000c1', 'b0b00000-0000-0000-0000-000000000006', 'member'),
  ('b0b00000-0000-0000-0000-0000000000c1', 'b0b00000-0000-0000-0000-000000000007', 'moderator'),
  ('b0b00000-0000-0000-0000-0000000000c1', 'b0b00000-0000-0000-0000-000000000008', 'member'),
  ('b0b00000-0000-0000-0000-0000000000c1', 'b0b00000-0000-0000-0000-000000000010', 'moderator'),
  ('b0b00000-0000-0000-0000-0000000000c2', 'b0b00000-0000-0000-0000-000000000007', 'member')
  on conflict do nothing;
create temp table qa_conv as
  select id from public.conversations where community_id = 'b0b00000-0000-0000-0000-0000000000c1';
grant select on qa_conv to authenticated;
select pg_temp.check((select count(*) from public.conversation_members where conversation_id = (select id from qa_conv)) = 5,
  'setup: the five members are in QA Foodies'' chat');

-- ───────── COMMUNITIES-02: suspended staff lose their powers ─────────
do $$
declare s uuid;
begin
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000002');
  s := public.mod_sanction('b0b00000-0000-0000-0000-000000000003', 'suspension', 'admin suspends mod', 60);
  perform set_config('qa.mo_sanction', s::text, false);

  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000003');
  perform pg_temp.check(public.my_staff_role() is null, '02: a suspended moderator has no usable staff role');
  perform pg_temp.check(pg_temp.fails($q$select * from public.mod_cases()$q$) = '42501', '02: a suspended moderator cannot list cases');
  perform pg_temp.check(pg_temp.fails($q$select public.mod_sanction('b0b00000-0000-0000-0000-000000000006', 'warning', 'from suspended mod')$q$) = '42501',
    '02: a suspended moderator cannot sanction');
  perform pg_temp.check(pg_temp.fails($q$select * from public.admin_content('activity')$q$) = '42501', '02: a suspended moderator cannot browse content');

  -- Still protected as a moderator: another moderator cannot pile on.
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000004');
  perform pg_temp.check(pg_temp.fails($q$select public.mod_sanction('b0b00000-0000-0000-0000-000000000003', 'warning', 'kick him while down')$q$) = '42501',
    '02 (guard): a suspended moderator stays out of another moderator''s reach');

  -- A suspended admin loses admin rights too; the owner restores them.
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000001');
  s := public.mod_sanction('b0b00000-0000-0000-0000-000000000002', 'suspension', 'owner suspends admin', 3);
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000002');
  perform pg_temp.check(public.my_staff_role() is null and not public.am_i_admin(), '02: a suspended admin is no admin');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_moderate('community', 'b0b00000-0000-0000-0000-0000000000c1', 'hide', 'suspended admin')$q$) = '42501',
    '02: a suspended admin cannot hide content');
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000001');
  perform public.mod_lift_sanction(s, 'owner lifts it');
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000002');
  perform pg_temp.check(public.my_staff_role() = 'admin', '02 (guard): lifted, the admin is an admin again');
end $$;

-- The owner keeps her powers even under a sanction (someone must be able to recover).
select pg_temp.as_admin();
insert into public.sanctions (id, user_id, kind, reason, created_by, ends_at)
values ('b0b00000-0000-0000-0000-0000000000f1', 'b0b00000-0000-0000-0000-000000000001', 'suspension', 'server-side test', null, now() + interval '1 day');
select pg_temp.as_user('b0b00000-0000-0000-0000-000000000001');
select pg_temp.check(public.my_staff_role() = 'owner' and pg_temp.fails($q$select * from public.mod_cases()$q$) is null,
  '02 (guard): an owner keeps the back office');
select pg_temp.as_admin();
update public.sanctions set lifted_at = now() where id = 'b0b00000-0000-0000-0000-0000000000f1';

-- ───────── COMMUNITIES-01: lifting a sanction ─────────
do $$
declare s uuid; s2 uuid; s3 uuid;
begin
  -- Mo cannot lift his own suspension (by mod_lift_sanction or admin_reactivate).
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000003');
  perform pg_temp.check(pg_temp.fails(format('select public.mod_lift_sanction(%L, %L)', current_setting('qa.mo_sanction'), 'lifting myself')) = '42501',
    '01: a moderator cannot lift his own suspension');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_reactivate('b0b00000-0000-0000-0000-000000000003', 'reactivating myself')$q$) = '42501',
    '01: nor reactivate himself');
  -- Modi cannot lift a fellow moderator's suspension.
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000004');
  perform pg_temp.check(pg_temp.fails(format('select public.mod_lift_sanction(%L, %L)', current_setting('qa.mo_sanction'), 'helping a colleague')) = '42501',
    '01: a moderator cannot lift a moderator''s suspension');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_reactivate('b0b00000-0000-0000-0000-000000000003', 'helping a colleague')$q$) = '42501',
    '01: nor reactivate a moderator');
  perform pg_temp.as_admin();
  perform pg_temp.check((select lifted_at is null from public.sanctions where id = current_setting('qa.mo_sanction')::uuid), '01: Mo is still suspended');

  -- An admin's year-long suspension of a member is the admins' to lift.
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000002');
  s := public.mod_sanction('b0b00000-0000-0000-0000-000000000010', 'suspension', 'serious: 1 year', 365);
  s2 := public.mod_sanction('b0b00000-0000-0000-0000-000000000008', 'suspension', 'admin: three days', 3);
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000004');
  perform pg_temp.check(pg_temp.fails(format('select public.mod_lift_sanction(%L, %L)', s, 'moderator overrides admin')) = '42501',
    '01: a moderator cannot lift an admin''s 365-day suspension');
  perform pg_temp.check(pg_temp.fails(format('select public.mod_lift_sanction(%L, %L)', s2, 'moderator overrides admin')) = '42501',
    '01: nor an admin''s short one');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_reactivate('b0b00000-0000-0000-0000-000000000010', 'moderator overrides admin')$q$) = '42501',
    '01: nor through reactivation');
  -- What a moderator set, a moderator lifts.
  s3 := public.mod_sanction('b0b00000-0000-0000-0000-000000000006', 'suspension', 'moderator: five days', 5);
  perform public.mod_lift_sanction(s3, 'appeal accepted');
  perform pg_temp.as_admin();
  perform pg_temp.check((select lifted_at is not null and lifted_by = 'b0b00000-0000-0000-0000-000000000004' from public.sanctions where id = s3),
    '01 (guard): a moderator lifts a moderator''s week-long suspension of a member');
  perform pg_temp.check((select count(*) from public.sanctions where id in (s, s2) and lifted_at is null) = 2, '01: the admin''s suspensions stand');
  -- The admin lifts them, and Mo's.
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000002');
  perform public.mod_lift_sanction(s, 'admin decides');
  perform public.mod_lift_sanction(s2, 'admin decides');
  perform pg_temp.check(public.admin_reactivate('b0b00000-0000-0000-0000-000000000003', 'admin reinstates Mo') = 1, '01: an admin reactivates a moderator');
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000003');
  perform pg_temp.check(public.my_staff_role() = 'moderator', '02 (guard): reactivated, Mo moderates again');
end $$;

-- ───────── COMMUNITIES-03: a hidden community's chat ─────────
do $$
begin
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000002');
  perform public.admin_moderate('community', 'b0b00000-0000-0000-0000-0000000000c1', 'hide', 'test community hide');
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000006');
  perform pg_temp.check(pg_temp.fails(format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'chatting in hidden community')$q$,
    (select id from qa_conv))) is not null, '03: no message in the chat of a hidden community');
  perform pg_temp.check(not exists (select 1 from public.conversation_members where user_id = auth.uid() and conversation_id = (select id from qa_conv)),
    '03: the chat left the member''s inbox');
  perform pg_temp.as_admin();
  perform pg_temp.check((select count(*) from public.conversation_members where conversation_id = (select id from qa_conv)) = 0, '03: nobody is left in it');
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000002');
  perform public.admin_moderate('community', 'b0b00000-0000-0000-0000-0000000000c1', 'restore', 'restored after review');
  perform pg_temp.as_admin();
  perform pg_temp.check((select count(*) from public.conversation_members where conversation_id = (select id from qa_conv)) = 5,
    '03 (guard): restored, the five members are back in the chat');
  perform pg_temp.check((select role from public.conversation_members where conversation_id = (select id from qa_conv)
    and user_id = 'b0b00000-0000-0000-0000-000000000009') = 'admin', '03 (guard): with their chat role');
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000006');
  insert into public.messages (conversation_id, sender_id, body) values ((select id from qa_conv), auth.uid(), 'back again');
end $$;

-- ───────── COMMUNITIES-04: pins of removed posts ─────────
select pg_temp.as_admin();
insert into public.community_posts (id, community_id, author_id, body, created_at)
select ('b0b00000-0000-0000-0000-0000000001' || lpad(g::text, 2, '0'))::uuid, 'b0b00000-0000-0000-0000-0000000000c1',
  'b0b00000-0000-0000-0000-000000000008', 'QA post ' || g, now() - make_interval(mins => 30 - g)
from generate_series(1, 12) g;
do $$
declare g integer;
begin
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000009');
  for g in 1..10 loop
    perform public.pin_post(('b0b00000-0000-0000-0000-0000000001' || lpad(g::text, 2, '0'))::uuid);
  end loop;
  -- The author removes a pinned post.
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000008');
  update public.community_posts set deleted_at = now() where id = 'b0b00000-0000-0000-0000-000000000101';
  perform pg_temp.as_admin();
  perform pg_temp.check(not exists (select 1 from public.community_pins where post_id = 'b0b00000-0000-0000-0000-000000000101'), '04: a removed post loses its pin');
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000009');
  perform pg_temp.check(pg_temp.fails($q$select public.pin_post('b0b00000-0000-0000-0000-000000000111')$q$) is null, '04: the freed place can be used');
  perform pg_temp.check(pg_temp.fails($q$select public.pin_post('b0b00000-0000-0000-0000-000000000101', false)$q$) is null, '04: unpinning a removed post works');
  perform pg_temp.check(pg_temp.fails($q$select public.pin_post('b0b00000-0000-0000-0000-000000000101')$q$) = 'P0002', '04 (guard): a removed post cannot be pinned');
  perform pg_temp.check(pg_temp.fails($q$select public.pin_post('b0b00000-0000-0000-0000-000000000112')$q$) = 'P0001', '04 (guard): still 10 at most');
  -- The IRLY team hides a pinned post: unpinned while hidden, pinned again on restore.
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000002');
  perform public.admin_moderate('community_post', 'b0b00000-0000-0000-0000-000000000102', 'hide', 'hidden for review');
  perform pg_temp.check(not exists (select 1 from public.community_pins where post_id = 'b0b00000-0000-0000-0000-000000000102'), '04: a hidden post is not pinned');
  perform public.admin_moderate('community_post', 'b0b00000-0000-0000-0000-000000000102', 'restore', 'fine after all');
  perform pg_temp.check(exists (select 1 from public.community_pins where post_id = 'b0b00000-0000-0000-0000-000000000102'), '04 (guard): restored, pinned again');
end $$;

-- ───────── COMMUNITIES-05: IRLY's names ─────────
select pg_temp.as_user('b0b00000-0000-0000-0000-000000000009');
do $$
declare n text;
begin
  foreach n in array array['IRLY Sport.', 'IRLY-Sport', 'IRLY' || chr(160) || 'Sport', 'IRLY' || chr(8203) || ' Sport',
                           'IRLY Sp' || chr(1086) || 'rt', 'IRLY Girl', 'IRLY Gym', 'IRLY Food', 'Girl Activite', 'Girl  Sport!',
                           'IRLY Sport Official', 'IRLY Team Official', chr(1030) || 'RLY Fun', 'ＩＲＬＹ Expat', 'lRLY Network'] loop
    perform pg_temp.check(pg_temp.fails(format('update public.communities set name = %L where id = %L', n, 'b0b00000-0000-0000-0000-0000000000c1')) = '23514',
      '05: refused: ' || n);
  end loop;
  perform pg_temp.check(pg_temp.fails($q$select public.create_community('IRLY Girl', 'dubai', null, null, null, false)$q$) = '23514',
    '05: a member cannot create a mixed « IRLY Girl »');
  foreach n in array array['Dubai Padel Friends', 'Girly brunch club', 'Early birds Marina', 'QA Foodies'] loop
    perform pg_temp.check(pg_temp.fails(format('update public.communities set name = %L where id = %L', n, 'b0b00000-0000-0000-0000-0000000000c1')) is null,
      '05 (guard): accepted: ' || n);
  end loop;
end $$;

-- ───────── COMMUNITIES-06: a community stays in its city ─────────
select pg_temp.as_user('b0b00000-0000-0000-0000-000000000009');
select pg_temp.check(pg_temp.fails($q$update public.communities set city_id = 'bali' where id = 'b0b00000-0000-0000-0000-0000000000c1'$q$) = '42501',
  '06: the owner cannot move her community to another city');
select pg_temp.as_admin();
select pg_temp.check((select city_id from public.communities where id = 'b0b00000-0000-0000-0000-0000000000c1') = 'dubai', '06: it is still in Dubai');

-- ───────── COMMUNITIES-07: removing a member ─────────
do $$
begin
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000006');
  perform pg_temp.check(pg_temp.fails($q$select public.remove_community_member('b0b00000-0000-0000-0000-0000000000c1', 'b0b00000-0000-0000-0000-000000000008')$q$) = '42501',
    '07: a member cannot remove a member');
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000007');
  perform pg_temp.check(pg_temp.fails($q$select public.remove_community_member('b0b00000-0000-0000-0000-0000000000c1', 'b0b00000-0000-0000-0000-000000000009')$q$) = '42501',
    '07: nobody removes the owner');
  perform pg_temp.check(pg_temp.fails($q$select public.remove_community_member('b0b00000-0000-0000-0000-0000000000c1', 'b0b00000-0000-0000-0000-000000000010')$q$) = '42501',
    '07: a moderator cannot remove a moderator');
  perform pg_temp.check(pg_temp.fails($q$select public.remove_community_member('b0b00000-0000-0000-0000-0000000000c1', 'b0b00000-0000-0000-0000-000000000006')$q$) is null,
    '07: a moderator removes a member');
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000009');
  perform pg_temp.check(pg_temp.fails($q$select public.remove_community_member('b0b00000-0000-0000-0000-0000000000c1', 'b0b00000-0000-0000-0000-000000000010')$q$) is null,
    '07: the owner removes a moderator');
  perform pg_temp.as_admin();
  perform pg_temp.check(not exists (select 1 from public.community_members where community_id = 'b0b00000-0000-0000-0000-0000000000c1'
    and user_id in ('b0b00000-0000-0000-0000-000000000006', 'b0b00000-0000-0000-0000-000000000010')), '07: they are out of the community');
  perform pg_temp.check(not exists (select 1 from public.conversation_members where conversation_id = (select id from qa_conv)
    and user_id in ('b0b00000-0000-0000-0000-000000000006', 'b0b00000-0000-0000-0000-000000000010')), '07: and out of its chat');
end $$;

-- ───────── COMMUNITIES-08: removing a comment ─────────
select pg_temp.as_user('b0b00000-0000-0000-0000-000000000008');
insert into public.comments (id, target_type, target_id, author_id, body) values
  ('b0b00000-0000-0000-0000-0000000000d1', 'community_post', 'b0b00000-0000-0000-0000-000000000103', auth.uid(), 'abusive comment'),
  ('b0b00000-0000-0000-0000-0000000000d2', 'community_post', 'b0b00000-0000-0000-0000-000000000103', auth.uid(), 'another one');
select pg_temp.as_user('b0b00000-0000-0000-0000-000000000006');
select pg_temp.check(pg_temp.changed($q$update public.comments set deleted_at = now() where id = 'b0b00000-0000-0000-0000-0000000000d1'$q$) <= 0,
  '08 (guard): someone outside the community cannot remove a comment');
select pg_temp.as_user('b0b00000-0000-0000-0000-000000000007');
select pg_temp.check(pg_temp.changed($q$update public.comments set body = 'rewritten by a moderator' where id = 'b0b00000-0000-0000-0000-0000000000d1'$q$) <= 0,
  '08 (guard): a moderator cannot rewrite a comment');
select pg_temp.check(pg_temp.changed($q$update public.comments set deleted_at = now() where id = 'b0b00000-0000-0000-0000-0000000000d1'$q$) = 1,
  '08: a community moderator removes a comment');
select pg_temp.as_user('b0b00000-0000-0000-0000-000000000009');
select pg_temp.check(pg_temp.changed($q$update public.comments set deleted_at = now() where id = 'b0b00000-0000-0000-0000-0000000000d2'$q$) = 1,
  '08: the owner removes a comment');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.comments where id in ('b0b00000-0000-0000-0000-0000000000d1', 'b0b00000-0000-0000-0000-0000000000d2')
  and deleted_at is not null and body = '—') = 2, '08: removed, their words gone');

-- ───────── COMMUNITIES-09: closing a case needs a note ─────────
select pg_temp.as_user('b0b00000-0000-0000-0000-000000000006');
select public.report('profile', 'b0b00000-0000-0000-0000-000000000008', null, 'harassment', 'qa case') is not null as reported \gset
do $$
declare c uuid;
begin
  perform pg_temp.as_admin();
  select m.id into c from public.moderation_cases m join public.reports r on r.id = m.report_id
  where r.target_user_id = 'b0b00000-0000-0000-0000-000000000008' order by m.created_at desc limit 1;
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000004');
  perform pg_temp.check(pg_temp.fails(format('select public.mod_case_update(%L, %L)', c, 'closed')) = '22023', '09: closing needs a note');
  perform pg_temp.check(pg_temp.fails(format('select public.mod_case_update(%L, %L)', c, 'dismissed')) = '22023', '09: dismissing needs a note');
  perform pg_temp.check(pg_temp.fails(format('select public.mod_case_update(%L, %L, %L)', c, 'actioned', 'ok')) = '22023', '09: a note of 3 characters at least');
  perform pg_temp.check(pg_temp.fails(format('select public.mod_case_update(%L, %L)', c, 'reviewing')) is null, '09 (guard): reviewing needs no note');
  perform pg_temp.check(pg_temp.fails(format('select public.mod_case_update(%L, %L, %L)', c, 'closed', 'Talked to both, settled')) is null, '09 (guard): closed with a note');
end $$;

-- ───────── COMMUNITIES-10: what the content role reads ─────────
select pg_temp.as_admin();
insert into public.community_posts (id, community_id, author_id, body) values
  ('b0b00000-0000-0000-0000-0000000002a1', 'b0b00000-0000-0000-0000-0000000000c2', 'b0b00000-0000-0000-0000-000000000009', 'girl secret for staff test');
insert into public.activities (id, title, category_id, city_id, area_id, starts_at, capacity, creator_id, girl_only) values
  ('b0b00000-0000-0000-0000-0000000003a1', 'QA girls sunset walk', 'sport', 'dubai', 'marina', now() + interval '2 days', 8, 'b0b00000-0000-0000-0000-000000000007', true),
  ('b0b00000-0000-0000-0000-0000000003a2', 'QA mixed sunset walk', 'sport', 'dubai', 'marina', now() + interval '2 days', 8, 'b0b00000-0000-0000-0000-000000000007', false);
do $$
begin
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000005');
  perform pg_temp.check(pg_temp.fails($q$select * from public.admin_content('community_post', 'girl secret')$q$) = '42501', '10: the content role cannot search post bodies');
  perform pg_temp.check(pg_temp.fails($q$select * from public.admin_content('comment')$q$) = '42501', '10: nor comments');
  perform pg_temp.check(pg_temp.fails($q$select * from public.admin_content('irl_post')$q$) = '42501', '10: nor lives');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_content_item('community_post', 'b0b00000-0000-0000-0000-0000000002a1')$q$) = '42501', '10: nor open one');
  perform pg_temp.check(exists (select 1 from public.admin_content('activity', 'QA mixed sunset')), '10 (guard): the content role lists activities');
  perform pg_temp.check(not exists (select 1 from public.admin_content('activity', 'QA girls sunset')), '10: but not IRLY Girl ones (a man in the content role)');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_content_item('activity', 'b0b00000-0000-0000-0000-0000000003a1')$q$) = '42501', '10: nor opens one');
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000004');
  perform pg_temp.check(exists (select 1 from public.admin_content('community_post', 'girl secret')), '10 (guard): moderators still read reported content');
end $$;

-- ───────── COMMUNITIES-11: group names ─────────
select pg_temp.as_user('b0b00000-0000-0000-0000-000000000009');
select pg_temp.check(pg_temp.fails($q$select public.create_subgroup('b0b00000-0000-0000-0000-0000000000c1', 'ab')$q$) = '22023',
  '11: a 2-character group name is refused with a clear error');
select pg_temp.check(pg_temp.fails($q$select public.create_subgroup('b0b00000-0000-0000-0000-0000000000c1', 'abc')$q$) is null, '11 (guard): 3 characters are fine');

-- ───────── COMMUNITIES-12: the owner does not leave ─────────
select pg_temp.check(pg_temp.fails($q$select public.leave_community('b0b00000-0000-0000-0000-0000000000c1')$q$) = '22023',
  '12: the owner is told to hand over or delete');
select pg_temp.as_admin();
select pg_temp.check((select role from public.community_members where community_id = 'b0b00000-0000-0000-0000-0000000000c1'
  and user_id = 'b0b00000-0000-0000-0000-000000000009') = 'owner', '12 (guard): she is still the owner');

-- ───────── spaces.md: a platform suspension closes IRLY Girl ─────────
do $$
declare s uuid;
begin
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000007');
  perform pg_temp.check(public.my_girl_access() and exists (select 1 from public.communities where id = 'b0b00000-0000-0000-0000-0000000000c2'),
    'spaces (guard): Mia, verified, is in IRLY Girl');
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000002');
  s := public.mod_sanction('b0b00000-0000-0000-0000-000000000007', 'suspension', 'platform suspension', 3);
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000007');
  perform pg_temp.check(not public.my_girl_access(), 'spaces: suspended, IRLY Girl is closed');
  perform pg_temp.check(public.my_girl_status() = 'suspended', 'spaces: and she is told she is suspended');
  perform pg_temp.check(not exists (select 1 from public.communities where id = 'b0b00000-0000-0000-0000-0000000000c2'), 'spaces: the girl community is not readable');
  perform pg_temp.check(not exists (select 1 from public.community_posts where id = 'b0b00000-0000-0000-0000-0000000002a1'), 'spaces: nor its posts');
  perform pg_temp.check(pg_temp.fails($q$select * from public.girl_feed('dubai')$q$) is not null, 'spaces: nor the IRLY Girl feed');
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000002');
  perform public.mod_lift_sanction(s, 'appeal accepted');
  perform pg_temp.as_user('b0b00000-0000-0000-0000-000000000007');
  perform pg_temp.check(public.my_girl_access() and public.my_girl_status() = 'open'
    and exists (select 1 from public.communities where id = 'b0b00000-0000-0000-0000-0000000000c2'), 'spaces (guard): lifted, IRLY Girl opens again');
end $$;

-- This file's plans go: later files count Dubai's recommended plans.
select pg_temp.as_admin();
delete from public.activities where id in ('b0b00000-0000-0000-0000-0000000003a1', 'b0b00000-0000-0000-0000-0000000003a2');
