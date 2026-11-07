-- « 0 latence » (migration 20261110600000_irly_latency): community_list
-- counts « posts this week » without the posts' read rule row by row, for
-- the same answer as that read rule gives: removed posts, posts older than a
-- week and posts of someone blocked (either way) are not counted; IRLY Girl
-- communities stay out of a man's list, and the count helper answers 0 for
-- a community the reader may not see.
-- Runs after irly_test.sql on the same database. TEST accounts only, ids 1a7e0000-….
--   …a1 Wren   woman (owner)     …a2 Nora woman (blocked by Milo)     …b1 Milo man
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
  if not coalesce(ok, false) then raise exception 'FAIL latency_community_list: %', label; end if;
  raise notice 'ok  %', label;
end $$;
-- What the posts' read rule lets the reader count (the earlier body of posts_week).
create or replace function pg_temp.by_rule(cid uuid) returns integer language sql as $$
  select count(*)::int from public.community_posts p where p.community_id = cid and p.deleted_at is null and p.created_at > now() - interval '7 days'
$$;
create or replace function pg_temp.listed(cid uuid) returns integer language sql as $$
  select l.posts_week from public.community_list('dubai') l where l.id = cid
$$;

select pg_temp.as_admin();
insert into auth.users (id) values
  ('1a7e0000-0000-0000-0000-0000000000a1'), ('1a7e0000-0000-0000-0000-0000000000a2'), ('1a7e0000-0000-0000-0000-0000000000b1');
insert into public.profiles (id, first_name, birthdate, gender, city_id, area_id) values
  ('1a7e0000-0000-0000-0000-0000000000a1', 'Wren', '1994-01-01', 'woman', 'dubai', 'marina'),
  ('1a7e0000-0000-0000-0000-0000000000a2', 'Nora', '1992-01-01', 'woman', 'dubai', 'marina'),
  ('1a7e0000-0000-0000-0000-0000000000b1', 'Milo', '1993-01-01', 'man', 'dubai', 'marina');
insert into public.communities (id, city_id, name, category_id, girl_only, created_by) values
  ('1a7e0000-0000-0000-0002-000000000001', 'dubai', 'Latx open circle', 'social', false, '1a7e0000-0000-0000-0000-0000000000a1'),
  ('1a7e0000-0000-0000-0002-000000000002', 'dubai', 'Latx girls circle', 'social', true, '1a7e0000-0000-0000-0000-0000000000a1');
insert into public.community_members (community_id, user_id, role) values
  ('1a7e0000-0000-0000-0002-000000000001', '1a7e0000-0000-0000-0000-0000000000a1', 'owner'),
  ('1a7e0000-0000-0000-0002-000000000001', '1a7e0000-0000-0000-0000-0000000000a2', 'member'),
  ('1a7e0000-0000-0000-0002-000000000001', '1a7e0000-0000-0000-0000-0000000000b1', 'member'),
  ('1a7e0000-0000-0000-0002-000000000002', '1a7e0000-0000-0000-0000-0000000000a1', 'owner'),
  ('1a7e0000-0000-0000-0002-000000000002', '1a7e0000-0000-0000-0000-0000000000a2', 'member')
on conflict do nothing;
-- Open circle: 3 by Wren this week, 2 by Nora this week, 1 removed, 1 older than a week.
insert into public.community_posts (community_id, author_id, body, created_at, deleted_at) values
  ('1a7e0000-0000-0000-0002-000000000001', '1a7e0000-0000-0000-0000-0000000000a1', 'w1', now() - interval '1 hour', null),
  ('1a7e0000-0000-0000-0002-000000000001', '1a7e0000-0000-0000-0000-0000000000a1', 'w2', now() - interval '2 days', null),
  ('1a7e0000-0000-0000-0002-000000000001', '1a7e0000-0000-0000-0000-0000000000a1', 'w3', now() - interval '6 days', null),
  ('1a7e0000-0000-0000-0002-000000000001', '1a7e0000-0000-0000-0000-0000000000a2', 'n1', now() - interval '3 hours', null),
  ('1a7e0000-0000-0000-0002-000000000001', '1a7e0000-0000-0000-0000-0000000000a2', 'n2', now() - interval '3 days', null),
  ('1a7e0000-0000-0000-0002-000000000001', '1a7e0000-0000-0000-0000-0000000000a1', 'gone', now() - interval '1 day', now()),
  ('1a7e0000-0000-0000-0002-000000000001', '1a7e0000-0000-0000-0000-0000000000a1', 'old', now() - interval '9 days', null),
  ('1a7e0000-0000-0000-0002-000000000002', '1a7e0000-0000-0000-0000-0000000000a2', 'g1', now() - interval '1 hour', null);
insert into public.blocks (blocker_id, blocked_id) values ('1a7e0000-0000-0000-0000-0000000000b1', '1a7e0000-0000-0000-0000-0000000000a2');

select pg_temp.as_user('1a7e0000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.listed('1a7e0000-0000-0000-0002-000000000001') = 5, 'Wren: 5 posts this week (removed and older ones not counted)');
select pg_temp.check(pg_temp.listed('1a7e0000-0000-0000-0002-000000000001') = pg_temp.by_rule('1a7e0000-0000-0000-0002-000000000001'), 'Wren: the same count as the read rule gives');
select pg_temp.check(pg_temp.listed('1a7e0000-0000-0000-0002-000000000002') = 1 and pg_temp.by_rule('1a7e0000-0000-0000-0002-000000000002') = 1, 'Wren: her IRLY Girl circle counts too');

select pg_temp.as_user('1a7e0000-0000-0000-0000-0000000000b1');
select pg_temp.check(pg_temp.listed('1a7e0000-0000-0000-0002-000000000001') = 3, 'Milo blocked Nora: her posts are not counted for him');
select pg_temp.check(pg_temp.listed('1a7e0000-0000-0000-0002-000000000001') = pg_temp.by_rule('1a7e0000-0000-0000-0002-000000000001'), 'Milo: the same count as the read rule gives');
select pg_temp.check(not exists (select 1 from public.community_list('dubai') where id = '1a7e0000-0000-0000-0002-000000000002'), 'Milo never sees the IRLY Girl circle in the list');
select pg_temp.check(private.community_posts_week('1a7e0000-0000-0000-0002-000000000002') = 0, 'asked directly, the count of a community he may not see is 0');

select pg_temp.as_user('1a7e0000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.listed('1a7e0000-0000-0000-0002-000000000001') = 5 and pg_temp.by_rule('1a7e0000-0000-0000-0002-000000000001') = 5, 'Nora (blocked by Milo, blocking no one) counts the 5, Milo wrote nothing');

select pg_temp.as_admin();
update public.communities set deleted_at = now() where id = '1a7e0000-0000-0000-0002-000000000001';
select pg_temp.as_user('1a7e0000-0000-0000-0000-0000000000a1');
select pg_temp.check(private.community_posts_week('1a7e0000-0000-0000-0002-000000000001') = 0, 'a removed community counts nothing');

reset role;
set role anon;
do $$
begin
  perform private.community_posts_week('1a7e0000-0000-0000-0002-000000000002');
  raise exception 'FAIL latency_community_list: a visitor could count posts';
exception when insufficient_privilege then
  raise notice 'ok  a visitor cannot count posts';
end $$;

-- ───────── Clean up ─────────
select pg_temp.as_admin();
delete from public.blocks where blocker_id::text like '1a7e0000-%';
delete from public.community_posts where community_id::text like '1a7e0000-%';
delete from public.community_members where community_id::text like '1a7e0000-%';
delete from public.communities where id::text like '1a7e0000-%';
delete from public.profiles where id::text like '1a7e0000-%';
delete from auth.users where id::text like '1a7e0000-%';
