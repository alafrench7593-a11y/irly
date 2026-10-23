-- Global administration (migration 20261029700000_irly_admin_global): the
-- Admin badge (owner and admin only, read from the server), the last owner
-- (an account deletion or a role change cannot leave IRLY without one; the
-- hand-over), the official communities' order and texts (strict checks, kept
-- after ensure_official_communities, no duplicate), spaces (Mixte / Girl /
-- Maman) and who may call what. Runs in a transaction that is rolled back:
-- the other test files' owners are set aside for the last-owner checks.
-- TEST accounts only, ids d0a00000-….
--
--   01 Olivia owner      04 Cleo content staff    07 Tara  member (gets ownership)
--   02 Adam   admin      05 Mark man, member
--   03 Mona   moderator  06 Wendy woman, member
\set ON_ERROR_STOP 1
begin;

-- Supabase grants the API roles table access; RLS and the role checks decide.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
revoke all on public.staff_roles from anon, authenticated;

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
  if not coalesce(ok, false) then raise exception 'FAIL admin_global: %', label; end if;
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
-- Only this file's owner counts for the last-owner checks (rolled back at the end).
update public.staff_roles set role = 'admin' where role = 'owner';

insert into auth.users (id) values
  ('d0a00000-0000-0000-0000-000000000001'), ('d0a00000-0000-0000-0000-000000000002'), ('d0a00000-0000-0000-0000-000000000003'),
  ('d0a00000-0000-0000-0000-000000000004'), ('d0a00000-0000-0000-0000-000000000005'), ('d0a00000-0000-0000-0000-000000000006'),
  ('d0a00000-0000-0000-0000-000000000007');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('d0a00000-0000-0000-0000-000000000001', 'Olivia', '1990-01-01', 'woman', 'dubai'),
  ('d0a00000-0000-0000-0000-000000000002', 'Adam', '1990-01-01', 'man', 'dubai'),
  ('d0a00000-0000-0000-0000-000000000003', 'Mona', '1990-01-01', 'woman', 'dubai'),
  ('d0a00000-0000-0000-0000-000000000004', 'Cleo', '1990-01-01', 'woman', 'dubai'),
  ('d0a00000-0000-0000-0000-000000000005', 'Mark', '1990-01-01', 'man', 'dubai'),
  ('d0a00000-0000-0000-0000-000000000006', 'Wendy', '1990-01-01', 'woman', 'dubai'),
  ('d0a00000-0000-0000-0000-000000000007', 'Tara', '1990-01-01', 'woman', 'dubai');
insert into public.staff_roles (user_id, role) values
  ('d0a00000-0000-0000-0000-000000000001', 'owner'), ('d0a00000-0000-0000-0000-000000000002', 'admin'),
  ('d0a00000-0000-0000-0000-000000000003', 'moderator'), ('d0a00000-0000-0000-0000-000000000004', 'content');

insert into public.communities (id, city_id, name, created_by) values
  ('d0a00000-0000-0000-0000-0000000000c1', 'dubai', 'Global test runners', 'd0a00000-0000-0000-0000-000000000005');
insert into public.communities (id, city_id, name, created_by, girl_only) values
  ('d0a00000-0000-0000-0000-0000000000c2', 'dubai', 'Global test girls', 'd0a00000-0000-0000-0000-000000000006', true);
insert into public.activities (id, title, category_id, city_id, area_id, starts_at, capacity, creator_id) values
  ('d0a00000-0000-0000-0000-0000000000a1', 'Global run', 'sport', 'dubai', 'marina', now() + interval '2 days', 8, 'd0a00000-0000-0000-0000-000000000005');
insert into public.activities (id, title, category_id, city_id, area_id, starts_at, capacity, creator_id, girl_only) values
  ('d0a00000-0000-0000-0000-0000000000a2', 'Global girls coffee', 'food', 'dubai', 'marina', now() + interval '2 days', 8, 'd0a00000-0000-0000-0000-000000000006', true);
insert into public.activities (id, title, category_id, city_id, area_id, starts_at, capacity, creator_id, girl_only, audience) values
  ('d0a00000-0000-0000-0000-0000000000a3', 'Global moms picnic', 'food', 'dubai', 'marina', now() + interval '2 days', 8, 'd0a00000-0000-0000-0000-000000000006', true, 'moms');
insert into public.community_posts (id, community_id, author_id, body) values
  ('d0a00000-0000-0000-0000-0000000000b1', 'd0a00000-0000-0000-0000-0000000000c2', 'd0a00000-0000-0000-0000-000000000006', 'Global girls post');

-- ───────── A. A member: no badge, no back office ─────────
do $$
declare stmt text;
begin
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000005');
  perform pg_temp.check(public.my_staff_role() is null, 'A: a member has no staff role');
  perform pg_temp.check(not exists (select 1 from public.staff_badges(array['d0a00000-0000-0000-0000-000000000005']::uuid[])), 'A: a member has no Admin badge');
  foreach stmt in array array[
    $q$select * from public.admin_official_topics()$q$,
    $q$select public.admin_official_reorder('mixte', array['expats'], 'Test reason')$q$,
    $q$select public.admin_official_texts('expats', null, 'A long enough description here', 'Test reason')$q$,
    $q$select * from public.admin_item_spaces('activity', array['d0a00000-0000-0000-0000-0000000000a1']::uuid[])$q$,
    $q$select * from public.admin_space_overview()$q$,
    $q$select public.admin_overview_more()$q$,
    $q$select public.admin_overview()$q$,
    $q$select public.staff_transfer_owner('d0a00000-0000-0000-0000-000000000005', false, 'OWNER', 'Take it')$q$,
    $q$select public.mod_case_update(gen_random_uuid(), 'dismissed', null)$q$] loop
    perform pg_temp.check(pg_temp.fails(stmt) = '42501', 'A: a member is refused: ' || left(stmt, 60));
  end loop;
  -- Direct table access: the role tables are out of reach.
  perform pg_temp.check(pg_temp.fails($q$insert into public.staff_roles (user_id, role) values ('d0a00000-0000-0000-0000-000000000005', 'admin')$q$) is not null, 'D: a member cannot insert herself as admin');
  perform pg_temp.check(pg_temp.fails($q$select * from public.staff_roles$q$) is not null, 'D: a member cannot read the role table');
  perform pg_temp.check(pg_temp.fails($q$update public.profiles set is_admin = true where id = 'd0a00000-0000-0000-0000-000000000005'$q$) is not null
    or not (select is_admin from public.profiles where id = 'd0a00000-0000-0000-0000-000000000005'), 'D: a member cannot set the admin flag');
  perform pg_temp.check(public.my_staff_role() is null
    and not exists (select 1 from public.staff_badges(array['d0a00000-0000-0000-0000-000000000005']::uuid[])), 'D: still no role and no badge after the attempts');
  perform pg_temp.check(pg_temp.fails($q$select private.grant_owner('x@example.org')$q$) is not null, 'D: grant_owner is out of reach');
end $$;
select pg_temp.as_admin();

-- ───────── B. The Admin badge ─────────
do $$
declare got uuid[];
begin
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000005');
  select coalesce(array_agg(user_id order by user_id), '{}') into got from public.staff_badges(array[
    'd0a00000-0000-0000-0000-000000000001', 'd0a00000-0000-0000-0000-000000000002', 'd0a00000-0000-0000-0000-000000000003',
    'd0a00000-0000-0000-0000-000000000004', 'd0a00000-0000-0000-0000-000000000005']::uuid[]);
  perform pg_temp.check(got = array['d0a00000-0000-0000-0000-000000000001', 'd0a00000-0000-0000-0000-000000000002']::uuid[],
    'B: owner and admin carry the badge, moderator, content staff and members do not');
  -- Removing the role removes the badge at once.
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000001');
  perform public.staff_set_role('d0a00000-0000-0000-0000-000000000002', null);
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000005');
  perform pg_temp.check(not exists (select 1 from public.staff_badges(array['d0a00000-0000-0000-0000-000000000002']::uuid[])), 'B: a revoked admin loses the badge');
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000001');
  perform public.staff_set_role('d0a00000-0000-0000-0000-000000000002', 'admin');
  -- An admin keeps a normal profile she can edit.
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000002');
  update public.profiles set bio = 'I run IRLY' where id = 'd0a00000-0000-0000-0000-000000000002';
  perform pg_temp.check((select bio from public.profiles where id = 'd0a00000-0000-0000-0000-000000000002') = 'I run IRLY', 'B: an admin edits her own profile as usual');
  perform pg_temp.check(public.admin_overview() ? 'users' and public.admin_overview_more() ? 'reports_closed_7d', 'B: an admin reads the dashboard');
end $$;
select pg_temp.as_admin();
select pg_temp.check(pg_temp.fails($q$set role anon; select * from public.staff_badges(array['d0a00000-0000-0000-0000-000000000001']::uuid[])$q$) is not null, 'B: signed out, no badge lookup');
reset role;

-- ───────── C. A report, handled ─────────
do $$
declare rid uuid; again uuid; cid uuid; sp record;
begin
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000007');
  rid := public.report('activity', null, 'd0a00000-0000-0000-0000-0000000000a3', 'unsafe', 'Strange meeting point');
  again := public.report('activity', null, 'd0a00000-0000-0000-0000-0000000000a3', 'unsafe', 'Strange meeting point');
  perform pg_temp.check(rid = again, 'C/G: a repeated tap files one report');
  perform pg_temp.as_admin();
  select m.id into cid from public.moderation_cases m where m.report_id = rid;
  perform pg_temp.check(cid is not null, 'C: the report opened a case');
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000003');
  perform pg_temp.check(exists (select 1 from public.mod_cases('open', null, null, null, 50, 0) x where x.case_id = cid), 'C: the moderator sees it in the open reports');
  select * into sp from public.admin_space_overview() where space = 'mom';
  perform pg_temp.check(sp.reports_open >= 1, 'C/F: the case shows in IRLY Maman''s open reports');
  perform pg_temp.check((select space from public.admin_item_spaces('activity', array['d0a00000-0000-0000-0000-0000000000a3']::uuid[])) = 'mom', 'F: the moms picnic is in IRLY Maman');
  perform public.mod_case_update(cid, 'reviewing', null);
  perform public.mod_case_update(cid, 'dismissed', 'Meeting point is a public park');
  perform pg_temp.as_admin();
  perform pg_temp.check((select status from public.moderation_cases where id = cid) = 'dismissed'
    and (select decision from public.moderation_cases where id = cid) = 'Meeting point is a public park', 'C: the decision and its reason are saved');
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000002');
  perform pg_temp.check((public.admin_overview_more() ->> 'reports_dismissed_7d')::int >= 1, 'C: the dashboard counts it as handled');
end $$;
select pg_temp.as_admin();
select pg_temp.check((select count(*) from private.admin_audit where action = 'case.status' and actor = 'd0a00000-0000-0000-0000-000000000003') = 2,
  'C: both status changes are in the journal, with the moderator''s id');

-- ───────── D. Limited roles ─────────
do $$
declare stmt text;
begin
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000003');
  foreach stmt in array array[
    $q$select * from public.admin_official_topics()$q$,
    $q$select public.admin_official_texts('expats', null, 'A long enough description here', 'Test reason')$q$,
    $q$select public.admin_overview_more()$q$,
    $q$select public.staff_transfer_owner('d0a00000-0000-0000-0000-000000000003', false, 'OWNER', 'Take it')$q$,
    $q$select public.staff_set_role('d0a00000-0000-0000-0000-000000000005', 'moderator')$q$] loop
    perform pg_temp.check(pg_temp.fails(stmt) = '42501', 'D: a moderator is refused: ' || left(stmt, 60));
  end loop;
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000002');
  perform pg_temp.check(pg_temp.fails($q$select public.staff_transfer_owner('d0a00000-0000-0000-0000-000000000002', false, 'OWNER', 'Take it')$q$) = '42501', 'D: an admin cannot make herself owner');
  perform pg_temp.check(pg_temp.fails($q$select public.staff_set_role('d0a00000-0000-0000-0000-000000000005', 'admin')$q$) = '42501', 'D: an admin cannot grant roles');
end $$;
select pg_temp.as_admin();
select pg_temp.check((select role from public.staff_roles where user_id = 'd0a00000-0000-0000-0000-000000000001') = 'owner'
  and not exists (select 1 from public.staff_roles where user_id = 'd0a00000-0000-0000-0000-000000000005'), 'D: the roles never moved');

-- ───────── E. Official communities: order and texts ─────────
select private.ensure_official_communities();
create temp table e_before as select count(*) as n from public.communities where official;
do $$
declare mixte text[]; rev text[]; got text[]; first_official text;
begin
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000004');
  select array_agg(topic order by sort, topic) into mixte from public.admin_official_topics() where space = 'mixte';
  perform pg_temp.check(mixte = array['expats', 'sport', 'network', 'lifestyle'], 'E: IRLY''s four, in the owner''s order');
  perform pg_temp.check((select array_agg(topic order by sort) from public.admin_official_topics() where space = 'girl')
    = array['girl_trip', 'girl_newcomers', 'girl_activity', 'girl_sport', 'girl_network'], 'E: IRLY Girl''s, Girl CEO last (inside IRLY Network)');
  perform pg_temp.check((select array_agg(topic) from public.admin_official_topics() where space = 'mom') = array['moms'], 'E: IRLY Maman');
  rev := array['lifestyle', 'network', 'sport', 'expats'];
  perform pg_temp.check(pg_temp.fails($q$select public.admin_official_reorder('mixte', array['lifestyle', 'lifestyle', 'sport', 'expats'], 'New order')$q$) = '22023', 'E: a duplicate is refused');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_official_reorder('mixte', array['lifestyle', 'sport', 'expats'], 'New order')$q$) = '22023', 'E: a missing community is refused');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_official_reorder('mixte', array['lifestyle', 'network', 'sport', 'expats', 'ghost'], 'New order')$q$) = '22023', 'E: an unknown one is refused');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_official_reorder('mixte', array['lifestyle', 'network', 'sport', 'girl_trip'], 'New order')$q$) = '22023', 'E: one from another space is refused');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_official_reorder('everything', array['expats'], 'New order')$q$) = '22023', 'E: an unknown space is refused');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_official_reorder('mixte', array['lifestyle', 'network', 'sport', 'expats'], '')$q$) = '22023', 'E: a reason is required');
  perform public.admin_official_reorder('mixte', rev, 'Activities first for the summer');
  perform public.admin_official_reorder('mixte', rev, 'Activities first for the summer');
  select array_agg(topic order by sort) into got from public.admin_official_topics() where space = 'mixte';
  perform pg_temp.check(got = rev, 'E: the new order is saved');
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000005');
  select topic into first_official from public.community_list('dubai') where official and not girl_only limit 1;
  perform pg_temp.check(first_official = 'lifestyle', 'E: the community list follows the new order');
  -- Texts.
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000004');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_official_texts('sport', 'Short', 'Too short', 'Fix texts')$q$) = '22023', 'E: an empty or too short description is refused');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_official_texts('ghost', 'Short', 'A long enough description for this', 'Fix texts')$q$) = '22023', 'E: an unknown official community is refused');
  perform public.admin_official_texts('sport', 'Train together in Dubai.', 'Find sports partners, plan sessions and train with people who share your goals.', 'Clearer text');
  perform pg_temp.check(pg_temp.fails(format($q$select public.admin_update_community(%L, 'Renamed Sport', null, 'Find sports partners, plan sessions and train together.', 'Rename')$q$,
    (select id from public.communities where official and topic = 'sport' and city_id = 'dubai' and parent_id is null))) = '22023', 'E: an official name stays as fixed');
end $$;
select pg_temp.as_admin();
select private.ensure_official_communities();
select pg_temp.check((select count(*) from public.communities where official) = (select n from e_before), 'E: no official community created twice');
select pg_temp.check(not exists (select 1 from public.communities where official and topic = 'sport' and parent_id is null and deleted_at is null
    and (description <> 'Find sports partners, plan sessions and train with people who share your goals.' or tagline <> 'Train together in Dubai.')),
  'E: the new texts reach every city and survive the official sync');
select pg_temp.check((select count(*) from private.admin_audit where action = 'official.reordered' and actor = 'd0a00000-0000-0000-0000-000000000004') = 1,
  'E: the reorder is journaled once (the repeat changed nothing)');
select pg_temp.check(exists (select 1 from private.admin_audit where action = 'official.texts_edited' and details ->> 'topic' = 'sport'), 'E: the text edit is journaled');
select pg_temp.check(exists (select 1 from public.communities where id = 'd0a00000-0000-0000-0000-0000000000c1' and deleted_at is null), 'E: members'' communities are untouched');

-- ───────── F. Spaces; IRLY Girl stays closed to others ─────────
do $$
begin
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000003');
  perform pg_temp.check((select array_agg(space order by id) from public.admin_item_spaces('activity', array[
      'd0a00000-0000-0000-0000-0000000000a1', 'd0a00000-0000-0000-0000-0000000000a2', 'd0a00000-0000-0000-0000-0000000000a3']::uuid[]))
    = array['mixte', 'girl', 'mom'], 'F: activities by space');
  perform pg_temp.check((select space from public.admin_item_spaces('community_post', array['d0a00000-0000-0000-0000-0000000000b1']::uuid[])) = 'girl', 'F: a post in an IRLY Girl community');
  perform pg_temp.check((select count(*) from public.admin_space_overview()) = 3, 'F: three spaces on the dashboard');
  perform pg_temp.check(exists (select 1 from public.admin_content('activity', 'Global girls', null, 10) where id = 'd0a00000-0000-0000-0000-0000000000a2'), 'F: the team sees IRLY Girl content to moderate');
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000005');
  perform pg_temp.check(not exists (select 1 from public.activities where id = 'd0a00000-0000-0000-0000-0000000000a2'), 'F: a man still cannot read an IRLY Girl activity');
  perform pg_temp.check(not exists (select 1 from public.community_posts where id = 'd0a00000-0000-0000-0000-0000000000b1'), 'F: nor an IRLY Girl post by its id');
end $$;
select pg_temp.as_admin();

-- ───────── G. The last owner ─────────
do $$
declare msg text;
begin
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000001');
  perform pg_temp.check(public.i_am_last_owner(), 'G: the app knows she is the only owner');
  msg := pg_temp.why($q$select public.delete_my_account()$q$);
  perform pg_temp.check(msg like 'last owner%', 'G: the only owner cannot delete her account before handing over');
  perform pg_temp.check(exists (select 1 from public.profiles where id = 'd0a00000-0000-0000-0000-000000000001'), 'G: her account is intact');
  perform pg_temp.check(pg_temp.fails($q$select public.staff_transfer_owner('d0a00000-0000-0000-0000-000000000007', false, 'owner', 'Leaving IRLY')$q$) = '22023', 'G: OWNER typed exactly');
  perform pg_temp.check(pg_temp.fails($q$select public.staff_transfer_owner('d0a00000-0000-0000-0000-000000000001', false, 'OWNER', 'Leaving IRLY')$q$) = '22023', 'G: not to herself');
  perform pg_temp.check(pg_temp.fails($q$select public.staff_transfer_owner('d0a00000-0000-0000-0000-000000000007', false, 'OWNER', '')$q$) = '22023', 'G: a reason is required');
  perform public.staff_transfer_owner('d0a00000-0000-0000-0000-000000000007', false, 'OWNER', 'Leaving IRLY');
  perform pg_temp.check(pg_temp.fails($q$select public.staff_transfer_owner('d0a00000-0000-0000-0000-000000000007', false, 'OWNER', 'Leaving IRLY')$q$) = '42501', 'G: a second tap does nothing more');
  perform pg_temp.check(public.my_staff_role() = 'admin' and not public.i_am_last_owner(), 'G: the former owner is now an admin');
  perform public.delete_my_account();
  perform pg_temp.as_user('d0a00000-0000-0000-0000-000000000007');
  perform pg_temp.check(public.my_staff_role() = 'owner' and public.i_am_last_owner(), 'G: Tara is the owner');
  perform pg_temp.check(pg_temp.why($q$select public.delete_my_account()$q$) like 'last owner%', 'G: and cannot leave without handing over in turn');
end $$;
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.profiles where id = 'd0a00000-0000-0000-0000-000000000001')
  and not exists (select 1 from public.staff_roles where user_id = 'd0a00000-0000-0000-0000-000000000001'), 'G: the former owner''s account, role and badge are gone');
select pg_temp.check((select count(*) from private.admin_audit where action = 'role.owner_transferred'
  and actor = 'd0a00000-0000-0000-0000-000000000001' and target_user = 'd0a00000-0000-0000-0000-000000000007') = 1, 'G: the hand-over is journaled once');
select pg_temp.check(not exists (select 1 from private.admin_audit where details::text ~* 'password|token|secret'), 'G: no secret in the journal');

rollback;
