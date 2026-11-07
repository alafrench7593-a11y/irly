-- A profile's communities (migration 20261109400000_irly_profile_communities):
-- member_communities shows what the viewer may see, with what the app needs
-- for the photo. A man never sees a woman's IRLY Girl or Mom communities; a
-- block or a hidden profile shows none; your own profile shows all of yours,
-- the retired ones included; a community the member is banned from is not
-- hers any more.
-- Runs in one transaction rolled back at the end: later files see nothing of it.
-- Ids b4c00000-….
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
  if not coalesce(ok, false) then raise exception 'FAIL profile_communities: %', label; end if;
  raise notice 'ok  %', label;
end $$;

-- The communities a viewer sees on a profile, by name, in order.
create or replace function pg_temp.seen(viewer uuid, target uuid) returns text[] language plpgsql as $$
declare r text[];
begin
  perform pg_temp.as_user(viewer);
  select coalesce(array_agg(x.name order by x.name), '{}') into r from public.member_communities(target) x;
  perform pg_temp.as_admin();
  return r;
end $$;

select pg_temp.as_admin();

-- 01 Nina (verified woman: IRLY Girl access), 02 Max (a man), 03 Ada
-- (verified woman), 04 Bea (verified woman who blocked Max), 05 Hugo (a man
-- whose profile is visible to nobody), 06 Zoe (woman, account deleted).
insert into auth.users (id) select ('b4c00000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid from generate_series(1, 6) g;
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('b4c00000-0000-0000-0000-000000000001', 'Nina', '1992-01-01', 'woman', 'dubai'),
  ('b4c00000-0000-0000-0000-000000000002', 'Max', '1990-01-01', 'man', 'dubai'),
  ('b4c00000-0000-0000-0000-000000000003', 'Ada', '1991-01-01', 'woman', 'dubai'),
  ('b4c00000-0000-0000-0000-000000000004', 'Bea', '1993-01-01', 'woman', 'dubai'),
  ('b4c00000-0000-0000-0000-000000000005', 'Hugo', '1989-01-01', 'man', 'dubai'),
  ('b4c00000-0000-0000-0000-000000000006', 'Zoe', '1994-01-01', 'woman', 'dubai');
update public.profiles set created_at = now() - interval '90 days' where id::text like 'b4c00000-%';
update public.profiles set verified_at = now() where gender = 'woman' and id::text like 'b4c00000-%';

-- c1 mixte (cover, category), c2 IRLY Girl official (topic), c3 Mom (women
-- only), c4 retired official mixte, c5 mixte created by Nina, c6 mixte Nina
-- is banned from, c7 deleted.
insert into public.communities (id, city_id, name, category_id, cover_path, created_by) values
  ('b4c00000-0000-0000-0000-0000000000c1', 'dubai', 'Padel Marina', 'sport', 'b4c00000-0000-0000-0000-000000000003/cover.jpg', 'b4c00000-0000-0000-0000-000000000003');
insert into public.communities (id, city_id, name, official, girl_only, created_by) values
  ('b4c00000-0000-0000-0000-0000000000c2', 'dubai', 'Girl Sport test', true, true, null),
  ('b4c00000-0000-0000-0000-0000000000c3', 'dubai', 'Mom Sport test', true, true, null);
insert into public.communities (id, city_id, name, official, retired_at, created_by) values
  ('b4c00000-0000-0000-0000-0000000000c4', 'dubai', 'Retired official test', true, now() - interval '1 day', null);
insert into public.communities (id, city_id, name, created_by) values
  ('b4c00000-0000-0000-0000-0000000000c5', 'dubai', 'Nina brunch club', 'b4c00000-0000-0000-0000-000000000001'),
  ('b4c00000-0000-0000-0000-0000000000c6', 'dubai', 'Banned from test', 'b4c00000-0000-0000-0000-000000000003'),
  ('b4c00000-0000-0000-0000-0000000000c7', 'dubai', 'Deleted test', 'b4c00000-0000-0000-0000-000000000003');
insert into public.community_members (community_id, user_id, role) values
  ('b4c00000-0000-0000-0000-0000000000c1', 'b4c00000-0000-0000-0000-000000000001', 'member'),
  ('b4c00000-0000-0000-0000-0000000000c2', 'b4c00000-0000-0000-0000-000000000001', 'member'),
  ('b4c00000-0000-0000-0000-0000000000c3', 'b4c00000-0000-0000-0000-000000000001', 'member'),
  ('b4c00000-0000-0000-0000-0000000000c4', 'b4c00000-0000-0000-0000-000000000001', 'member'),
  ('b4c00000-0000-0000-0000-0000000000c5', 'b4c00000-0000-0000-0000-000000000001', 'owner'),
  ('b4c00000-0000-0000-0000-0000000000c6', 'b4c00000-0000-0000-0000-000000000001', 'member'),
  ('b4c00000-0000-0000-0000-0000000000c7', 'b4c00000-0000-0000-0000-000000000001', 'member'),
  ('b4c00000-0000-0000-0000-0000000000c1', 'b4c00000-0000-0000-0000-000000000004', 'member'),
  ('b4c00000-0000-0000-0000-0000000000c2', 'b4c00000-0000-0000-0000-000000000004', 'member'),
  ('b4c00000-0000-0000-0000-0000000000c1', 'b4c00000-0000-0000-0000-000000000005', 'member'),
  ('b4c00000-0000-0000-0000-0000000000c1', 'b4c00000-0000-0000-0000-000000000006', 'member')
  on conflict (community_id, user_id) do update set role = excluded.role;
update public.communities set deleted_at = now() where id = 'b4c00000-0000-0000-0000-0000000000c7';
insert into public.community_bans (community_id, user_id, reason) values
  ('b4c00000-0000-0000-0000-0000000000c6', 'b4c00000-0000-0000-0000-000000000001', 'test');
-- A ban written behind the membership (as an old row could be): the profile must not show it.
set local session_replication_role = replica;
insert into public.community_members (community_id, user_id, role) values
  ('b4c00000-0000-0000-0000-0000000000c6', 'b4c00000-0000-0000-0000-000000000001', 'member')
  on conflict (community_id, user_id) do nothing;
set local session_replication_role = origin;
insert into public.blocks (blocker_id, blocked_id) values ('b4c00000-0000-0000-0000-000000000004', 'b4c00000-0000-0000-0000-000000000002');
insert into public.safety_settings (user_id, profile_visibility) values ('b4c00000-0000-0000-0000-000000000005', 'nobody')
  on conflict (user_id) do update set profile_visibility = 'nobody';
update public.profiles set deleted_at = now() where id = 'b4c00000-0000-0000-0000-000000000006';

-- ───────── Own profile ─────────
select pg_temp.check(pg_temp.seen('b4c00000-0000-0000-0000-000000000001', 'b4c00000-0000-0000-0000-000000000001')
  = array['Girl Sport test', 'Mom Sport test', 'Nina brunch club', 'Padel Marina', 'Retired official test'],
  'own profile: every community she belongs to, women-only and retired ones included; never a deleted one or one she is banned from');
select pg_temp.as_user('b4c00000-0000-0000-0000-000000000001');
select pg_temp.check((select role from public.member_communities('b4c00000-0000-0000-0000-000000000001') where name = 'Nina brunch club') = 'created'
  and (select role from public.member_communities('b4c00000-0000-0000-0000-000000000001') where name = 'Padel Marina') = 'joined',
  'created or joined, nothing more about her role');
select pg_temp.check((select name from public.member_communities('b4c00000-0000-0000-0000-000000000001') limit 1) = 'Nina brunch club',
  'the ones she created first (never an official one, which has no creator)');
select pg_temp.check((select retired from public.member_communities('b4c00000-0000-0000-0000-000000000001') where name = 'Retired official test')
  and (select official and girl_only and not retired from public.member_communities('b4c00000-0000-0000-0000-000000000001') where name = 'Girl Sport test'),
  'the app is told which ones are retired, official and women-only');
select pg_temp.check((select (cover_path, category_id) = ('b4c00000-0000-0000-0000-000000000003/cover.jpg'::text, 'sport'::text)
    and members = (select c.members_count from public.communities c where c.id = 'b4c00000-0000-0000-0000-0000000000c1')
  from public.member_communities('b4c00000-0000-0000-0000-000000000001') where name = 'Padel Marina'),
  'with the photo, the category (the app''s photo without one) and the member count');
select pg_temp.as_admin();

-- ───────── A man viewer ─────────
select pg_temp.check(pg_temp.seen('b4c00000-0000-0000-0000-000000000002', 'b4c00000-0000-0000-0000-000000000001')
  = array['Nina brunch club', 'Padel Marina'],
  'a man never sees a woman''s IRLY Girl or Mom communities, nor her retired ones');
select pg_temp.check(not exists (select 1 from unnest(pg_temp.seen('b4c00000-0000-0000-0000-000000000002', 'b4c00000-0000-0000-0000-000000000001')) n
  where n in ('Girl Sport test', 'Mom Sport test')), 'no women-only community, by name or otherwise');

-- ───────── A woman viewer with IRLY Girl access ─────────
select pg_temp.check(pg_temp.seen('b4c00000-0000-0000-0000-000000000003', 'b4c00000-0000-0000-0000-000000000001')
  = array['Girl Sport test', 'Mom Sport test', 'Nina brunch club', 'Padel Marina'],
  'a woman with IRLY Girl access sees the women-only ones too (never the retired one)');

-- ───────── Blocks, hidden and deleted profiles ─────────
select pg_temp.check(pg_temp.seen('b4c00000-0000-0000-0000-000000000002', 'b4c00000-0000-0000-0000-000000000004') = '{}',
  'blocked by her: none of her communities');
select pg_temp.check(pg_temp.seen('b4c00000-0000-0000-0000-000000000004', 'b4c00000-0000-0000-0000-000000000002') = '{}',
  'and none of his for her (a block works both ways)');
select pg_temp.check(pg_temp.seen('b4c00000-0000-0000-0000-000000000003', 'b4c00000-0000-0000-0000-000000000004')
  = array['Girl Sport test', 'Padel Marina'], 'someone she did not block still sees them');
select pg_temp.check(pg_temp.seen('b4c00000-0000-0000-0000-000000000001', 'b4c00000-0000-0000-0000-000000000005') = '{}',
  'a profile visible to nobody shows no community');
select pg_temp.check(pg_temp.seen('b4c00000-0000-0000-0000-000000000005', 'b4c00000-0000-0000-0000-000000000005') = array['Padel Marina'],
  'its owner still sees them');
select pg_temp.check(pg_temp.seen('b4c00000-0000-0000-0000-000000000001', 'b4c00000-0000-0000-0000-000000000006') = '{}',
  'a deleted account shows no community');

-- ───────── Signed out ─────────
select pg_temp.check((select count(*) from public.member_communities('b4c00000-0000-0000-0000-000000000001')) = 0,
  'signed out (as the server itself, no member): nothing');
select pg_temp.check(not has_function_privilege('anon', 'public.member_communities(uuid, text)', 'execute'),
  'visitors without an account cannot call it');

rollback;
