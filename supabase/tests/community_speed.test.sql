-- Community speed (migration 20261108100000_irly_community_speed): the
-- rewritten community_posts_page (« recent »), community_members_list and
-- community_search answer as before: pins first on the first page only, an
-- expired pin is no pin, later pages skip pinned posts, blocked people stay
-- out both ways, someone outside the community sees only the profiles she
-- may see (and the page is filled from the visible ones), members first by
-- role. And the RPCs run without JIT compilation.
-- Runs in one transaction rolled back at the end. Ids 5bee0000-….
\set ON_ERROR_STOP 1

begin;

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
  if not coalesce(ok, false) then raise exception 'FAIL community_speed: %', label; end if;
  raise notice 'ok  %', label;
end $$;

create or replace function pg_temp.u(n int) returns uuid language sql immutable as
  $$ select ('5bee0000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.p(n int) returns uuid language sql immutable as
  $$ select ('5bee0001-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

-- Fixtures written as they would be stored (triggers that need a signed-in author are off).
set local session_replication_role = replica;
insert into auth.users (id) select pg_temp.u(n) from generate_series(1, 6) n;
-- 1 owner Zoe, 2 member Anna, 3 member Bea (profile: nobody), 4 member Cleo (blocks 2),
-- 5 outsider Dana, 6 member Emma.
insert into public.profiles (id, first_name, birthdate, gender, city_id)
values (pg_temp.u(1), 'Zoe', '1990-01-01', 'woman', 'dubai'), (pg_temp.u(2), 'Anna', '1990-01-01', 'woman', 'dubai'),
  (pg_temp.u(3), 'Bea', '1990-01-01', 'woman', 'dubai'), (pg_temp.u(4), 'Cleo', '1990-01-01', 'woman', 'dubai'),
  (pg_temp.u(5), 'Dana', '1990-01-01', 'woman', 'dubai'), (pg_temp.u(6), 'Emma', '1990-01-01', 'woman', 'dubai');
insert into public.safety_settings (user_id, profile_visibility) values (pg_temp.u(3), 'nobody');
insert into public.communities (id, city_id, name, created_by) values ('5bee0002-0000-4000-8000-000000000001', 'dubai', 'Speed test club', pg_temp.u(1));
insert into public.community_members (community_id, user_id, role)
values ('5bee0002-0000-4000-8000-000000000001', pg_temp.u(1), 'owner'), ('5bee0002-0000-4000-8000-000000000001', pg_temp.u(2), 'member'),
  ('5bee0002-0000-4000-8000-000000000001', pg_temp.u(3), 'member'), ('5bee0002-0000-4000-8000-000000000001', pg_temp.u(4), 'moderator'),
  ('5bee0002-0000-4000-8000-000000000001', pg_temp.u(6), 'member');
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.u(4), pg_temp.u(2));
-- Posts 1 (newest) … 8; 9 by Cleo (blocked for Anna); 10 removed.
insert into public.community_posts (id, community_id, author_id, body, created_at, deleted_at)
select pg_temp.p(n), '5bee0002-0000-4000-8000-000000000001', case when n = 9 then pg_temp.u(4) else pg_temp.u(1 + n % 2) end,
  'speed post ' || n, now() - (n || ' hours')::interval, case when n = 10 then now() end
from generate_series(1, 10) n;
-- Post 5 pinned (running), post 3 pinned earlier with an end passed, post 7 pinned last.
insert into public.community_pins (post_id, community_id, pinned_by, pinned_at, expires_at)
values (pg_temp.p(5), '5bee0002-0000-4000-8000-000000000001', pg_temp.u(1), now() - interval '2 hours', null),
  (pg_temp.p(3), '5bee0002-0000-4000-8000-000000000001', pg_temp.u(1), now() - interval '3 hours', now() - interval '1 minute'),
  (pg_temp.p(7), '5bee0002-0000-4000-8000-000000000001', pg_temp.u(1), now() - interval '1 hour', now() + interval '1 day');
set local session_replication_role = origin;

create temp table got (label text, ids uuid[]);
grant all on got to authenticated;

-- ───────── community_posts_page, recent ─────────
select pg_temp.as_user(pg_temp.u(2));
insert into got select 'p1', array_agg(id order by n) from (
  select id, row_number() over () n from public.community_posts_page('5bee0002-0000-4000-8000-000000000001', 'recent', null, 0, 5)) x;
insert into got select 'p2', array_agg(id order by n) from (
  select id, row_number() over () n from public.community_posts_page('5bee0002-0000-4000-8000-000000000001', 'recent',
    now() - interval '4 hours' + interval '1 second', 0, 5)) x;
insert into got select 'all', array_agg(id order by n) from (
  select id, row_number() over () n from public.community_posts_page('5bee0002-0000-4000-8000-000000000001', 'recent', null, 0, 50)) x;
select pg_temp.as_admin();

select pg_temp.check((select ids from got where label = 'p1') = array[pg_temp.p(7), pg_temp.p(5), pg_temp.p(1), pg_temp.p(2), pg_temp.p(3)],
  'first page: running pins first (last pinned first), then the newest; an expired pin is no pin');
select pg_temp.check((select ids from got where label = 'p2') = array[pg_temp.p(4), pg_temp.p(6), pg_temp.p(8)],
  'a later page: older posts only, pinned ones skipped, a blocked author and a removed post left out');
select pg_temp.check((select ids from got where label = 'all') = array[pg_temp.p(7), pg_temp.p(5), pg_temp.p(1), pg_temp.p(2), pg_temp.p(3), pg_temp.p(4), pg_temp.p(6), pg_temp.p(8)],
  'every post once: no blocked author (either way), no removed post');

-- ───────── community_members_list ─────────
select pg_temp.as_user(pg_temp.u(2));
insert into got select 'm-member', array_agg(user_id order by n) from (
  select user_id, row_number() over () n from public.community_members_list('5bee0002-0000-4000-8000-000000000001')) x;
select pg_temp.as_user(pg_temp.u(5));
insert into got select 'm-outsider', array_agg(user_id order by n) from (
  select user_id, row_number() over () n from public.community_members_list('5bee0002-0000-4000-8000-000000000001')) x;
insert into got select 'm-outsider-page', array_agg(user_id order by n) from (
  select user_id, row_number() over () n from public.community_members_list('5bee0002-0000-4000-8000-000000000001', null, 2, 1)) x;
select pg_temp.as_admin();

select pg_temp.check((select ids from got where label = 'm-member') = array[pg_temp.u(1), pg_temp.u(2), pg_temp.u(3), pg_temp.u(6)],
  'a member: owner first, then members by name; the person who blocked her is left out (her moderator rank aside)');
select pg_temp.check((select ids from got where label = 'm-outsider') = array[pg_temp.u(1), pg_temp.u(4), pg_temp.u(2), pg_temp.u(6)],
  'someone outside: owner, moderator, members, without the profile she may not see');
select pg_temp.check((select ids from got where label = 'm-outsider-page') = array[pg_temp.u(4), pg_temp.u(2)],
  'someone outside, a page further: counted among the visible ones only');

-- ───────── community_search, members ─────────
select pg_temp.as_user(pg_temp.u(5));
insert into got select 's-outsider', array_agg(id order by id) from public.community_search('5bee0002-0000-4000-8000-000000000001', 'ea', 'members');
select pg_temp.as_user(pg_temp.u(6));
insert into got select 's-member', array_agg(id order by id) from public.community_search('5bee0002-0000-4000-8000-000000000001', 'ea', 'members');
select pg_temp.as_admin();
select pg_temp.check((select ids from got where label = 's-outsider') is null,
  'search by someone outside: a hidden profile is not found (Bea)');
select pg_temp.check((select ids from got where label = 's-member') = array[pg_temp.u(3)],
  'search by a member: every member matching');

-- ───────── No JIT ─────────
select pg_temp.check(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('community_posts_page', 'community_members_list', 'community_search')
     and 'jit=off' = any (p.proconfig)) = 3,
  'the community RPCs run without JIT compilation');
select pg_temp.check(exists (select 1 from pg_indexes where indexname = 'community_posts_live_idx'), 'the live posts index exists');

rollback;
