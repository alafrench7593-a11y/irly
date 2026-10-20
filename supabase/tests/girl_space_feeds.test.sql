-- IRLY Girl space feeds (20261024004000_irly_girl_space_feeds.sql): in the
-- IRLY Girl space the IRL feed shows women's posts only and the
-- recommendations women-only plans only; a man is refused; the calls the
-- installed apps make (irl_feed, recommend_activities) are unchanged.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed c5f00000-….
--
--   a1 Lea  woman, IRLY Girl access (the viewer)
--   a2 Ada  woman, posts and hosts plans
--   a3 Tom  man, posts and hosts an open plan
--   a4 Zoe  woman whose IRLY Girl access was withdrawn (girl_suspensions)
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
    raise exception 'FAIL girl_space_feeds: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;
-- The SQLSTATE a statement fails with, or null when it succeeds.
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

-- ───────── Accounts, posts and plans (set up by the server role) ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('c5f00000-0000-0000-0000-0000000000a1'), ('c5f00000-0000-0000-0000-0000000000a2'),
  ('c5f00000-0000-0000-0000-0000000000a3'), ('c5f00000-0000-0000-0000-0000000000a4');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c5f00000-0000-0000-0000-0000000000a1', 'Lea', '1994-03-03', 'woman', 'dubai'),
  ('c5f00000-0000-0000-0000-0000000000a2', 'Ada', '1993-05-05', 'woman', 'dubai'),
  ('c5f00000-0000-0000-0000-0000000000a3', 'Tom', '1992-07-07', 'man', 'dubai'),
  ('c5f00000-0000-0000-0000-0000000000a4', 'Zoe', '1991-09-09', 'woman', 'dubai');
-- Lea loves food: the food plans score high enough to make the list.
update public.profiles set interests = array['food'] where id = 'c5f00000-0000-0000-0000-0000000000a1';
insert into public.girl_suspensions (user_id, reason, created_by) values
  ('c5f00000-0000-0000-0000-0000000000a4', 'test', 'c5f00000-0000-0000-0000-0000000000a2');

-- Each Live is posted in one space (20261024009300_irly_girl_spaces): Ada's and Zoe's in IRLY Girl, Tom's
-- in IRLY, plus a post forced into IRLY Girl for a man (only the server role could write it) and one Ada
-- posted in IRLY.
insert into public.irl_posts (id, author_id, city_id, area_id, body, visibility, created_at, expires_at, app_scope) values
  ('c5f00000-0000-0000-0000-0000000000c1', 'c5f00000-0000-0000-0000-0000000000a2', 'dubai', 'marina', 'c5f Ada at the beach', 'everyone', now() - interval '1 minute', now() + interval '3 hours', 'irly_girl'),
  ('c5f00000-0000-0000-0000-0000000000c2', 'c5f00000-0000-0000-0000-0000000000a3', 'dubai', 'marina', 'c5f Tom at the gym', 'everyone', now() - interval '2 minutes', now() + interval '3 hours', 'irly'),
  ('c5f00000-0000-0000-0000-0000000000c3', 'c5f00000-0000-0000-0000-0000000000a4', 'dubai', 'marina', 'c5f Zoe suspended', 'everyone', now() - interval '3 minutes', now() + interval '3 hours', 'irly_girl'),
  ('c5f00000-0000-0000-0000-0000000000c4', 'c5f00000-0000-0000-0000-0000000000a3', 'dubai', 'marina', 'c5f Tom forced into Girl', 'everyone', now() - interval '4 minutes', now() + interval '3 hours', 'irly_girl'),
  ('c5f00000-0000-0000-0000-0000000000c5', 'c5f00000-0000-0000-0000-0000000000a2', 'dubai', 'marina', 'c5f Ada in IRLY', 'everyone', now() - interval '5 minutes', now() + interval '3 hours', 'irly');

insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience) values
  ('c5f00000-0000-0000-0000-0000000000b1', 'c5f00000-0000-0000-0000-0000000000a2', 'c5f girls brunch', 'food', 'dubai', 'marina', now() + interval '1 day', true, 'girls'),
  ('c5f00000-0000-0000-0000-0000000000b2', 'c5f00000-0000-0000-0000-0000000000a3', 'c5f open dinner', 'food', 'dubai', 'marina', now() + interval '1 day', false, 'all');

-- ───────── Lea, a woman in the IRLY Girl space ─────────
select pg_temp.as_user('c5f00000-0000-0000-0000-0000000000a1');
select pg_temp.check(exists (select 1 from public.irl_feed_girl('dubai') f where f.id = 'c5f00000-0000-0000-0000-0000000000c1'),
  'Lea, IRLY Girl: sees a woman''s IRL post');
select pg_temp.check(not exists (select 1 from public.irl_feed_girl('dubai') f where f.id = 'c5f00000-0000-0000-0000-0000000000c2'),
  'Lea, IRLY Girl: does not see a man''s IRL post');
select pg_temp.check(not exists (select 1 from public.irl_feed_girl('dubai') f where f.id = 'c5f00000-0000-0000-0000-0000000000c4'),
  'Lea, IRLY Girl: does not see a man''s post even if it reached the IRLY Girl space');
select pg_temp.check(not exists (select 1 from public.irl_feed_girl('dubai') f where f.id = 'c5f00000-0000-0000-0000-0000000000c5'),
  'Lea, IRLY Girl: does not see a woman''s post made in IRLY');
select pg_temp.check(not exists (select 1 from public.irl_feed_girl('dubai') f where f.id = 'c5f00000-0000-0000-0000-0000000000c3'),
  'Lea, IRLY Girl: does not see a post by a woman whose IRLY Girl access was withdrawn');
select pg_temp.check((select bool_and(private.girl_eligible_unchecked(f.author_id)) from public.irl_feed_girl('dubai') f),
  'Lea, IRLY Girl: every IRL post is by a woman with IRLY Girl access');
select pg_temp.check(exists (select 1 from public.recommend_activities_girl('dubai', 50) r where r.id = 'c5f00000-0000-0000-0000-0000000000b1'),
  'Lea, IRLY Girl: the women-only plan is recommended');
select pg_temp.check(not exists (select 1 from public.recommend_activities_girl('dubai', 50) r where r.id = 'c5f00000-0000-0000-0000-0000000000b2'),
  'Lea, IRLY Girl: the open plan is not recommended');
select pg_temp.check((select bool_and(a.girl_only) from public.recommend_activities_girl('dubai', 50) r join public.activities a on a.id = r.id),
  'Lea, IRLY Girl: every recommendation is women only');
select pg_temp.check((select r.reason from public.recommend_activities_girl('dubai', 50) r where r.id = 'c5f00000-0000-0000-0000-0000000000b1') = 'your_interests',
  'Lea, IRLY Girl: same scoring and reasons as the IRLY recommendations');

-- ───────── The calls the installed apps make: unchanged ─────────
select pg_temp.check(exists (select 1 from public.irl_feed('dubai') f where f.id = 'c5f00000-0000-0000-0000-0000000000c5')
  and exists (select 1 from public.irl_feed('dubai') f where f.id = 'c5f00000-0000-0000-0000-0000000000c2'),
  'Lea, IRLY: irl_feed still shows everyone''s IRLY posts');
select pg_temp.check(not exists (select 1 from public.irl_feed('dubai') f where f.id = 'c5f00000-0000-0000-0000-0000000000c1'),
  'Lea, IRLY: irl_feed does not show a post made in IRLY Girl');
select pg_temp.check(exists (select 1 from public.recommend_activities('dubai', 50) r where r.id = 'c5f00000-0000-0000-0000-0000000000b2'),
  'Lea, IRLY: recommend_activities still recommends the open plan');
select pg_temp.check(exists (select 1 from public.recommend_activities('dubai') r where r.id = 'c5f00000-0000-0000-0000-0000000000b1'),
  'Lea, IRLY: recommend_activities default limit still works');

-- ───────── Tom, a man: refused ─────────
select pg_temp.as_user('c5f00000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails($$select * from public.irl_feed_girl('dubai')$$) = '42501', 'Tom: irl_feed_girl is refused');
select pg_temp.check(pg_temp.fails($$select * from public.recommend_activities_girl('dubai', 20)$$) = '42501', 'Tom: recommend_activities_girl is refused');
select pg_temp.check(exists (select 1 from public.irl_feed('dubai') f where f.id = 'c5f00000-0000-0000-0000-0000000000c5'),
  'Tom, IRLY: irl_feed unchanged for IRLY posts');
select pg_temp.check(not exists (select 1 from public.recommend_activities('dubai', 50) r where r.id = 'c5f00000-0000-0000-0000-0000000000b1'),
  'Tom, IRLY: still never recommended a women-only plan');

-- ───────── Zoe, suspended: refused ─────────
select pg_temp.as_user('c5f00000-0000-0000-0000-0000000000a4');
select pg_temp.check(pg_temp.fails($$select * from public.irl_feed_girl('dubai')$$) = '42501', 'Zoe (access withdrawn): irl_feed_girl is refused');
select pg_temp.check(pg_temp.fails($$select * from public.recommend_activities_girl('dubai')$$) = '42501', 'Zoe (access withdrawn): recommend_activities_girl is refused');

-- ───────── Anonymous: no access ─────────
select pg_temp.as_admin();
set role anon;
select pg_temp.check(pg_temp.fails($$select * from public.irl_feed_girl('dubai')$$) = '42501', 'anon: irl_feed_girl not executable');
select pg_temp.check(pg_temp.fails($$select * from public.recommend_activities_girl('dubai')$$) = '42501', 'anon: recommend_activities_girl not executable');
reset role;
