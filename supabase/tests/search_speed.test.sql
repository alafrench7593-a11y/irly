-- Search speed (migration 20261020000600): people are found by name first,
-- then blocks, hidden profiles and location settings apply as before; an
-- activity without an end time is over two hours after it starts, in search
-- and on profiles, as join_activity says. Runs after irly_test.sql on the
-- same database; every id here starts with 5ea00000-, every name with "Zyq",
-- so nothing depends on the other test files. Each block raises on failure.
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
  if not coalesce(ok, false) then
    raise exception 'FAIL search_speed: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

-- The people search_all finds for a query, as "first name / city".
create or replace function pg_temp.people(q text, lim integer default 30) returns text[] language sql as $$
  select coalesce(array_agg(title || ' / ' || coalesce(city_id, '-') order by title), '{}')
  from public.search_all(q, null, lim) where kind = 'person'
$$;

-- What the people branch returned before this migration (through the
-- profiles_public view), to compare with the new one row for row.
create or replace function pg_temp.people_before(q text) returns table (id uuid, first_name text, city_id text) language sql as $$
  select p.id, p.first_name, p.city_id
  from public.profiles_public p
  where p.id <> auth.uid() and char_length(lower(btrim(q))) >= 2 and p.first_name ilike lower(btrim(q)) || '%'
    and not private.is_blocked(auth.uid(), p.id) and private.discoverable(p.id)
$$;

select pg_temp.as_admin();

-- Viewer (a1); members named Zyqora: open (a2), nobody may see (a3), blocked
-- by the viewer (a4), blocking the viewer (a5), friends only and a friend of
-- the viewer (a6), deleted (a7), location hidden (a8), friends only and not a
-- friend (a9); a1 and a9 share nothing.
insert into auth.users (id) values
  ('5ea00000-0000-0000-0000-0000000000a1'), ('5ea00000-0000-0000-0000-0000000000a2'),
  ('5ea00000-0000-0000-0000-0000000000a3'), ('5ea00000-0000-0000-0000-0000000000a4'),
  ('5ea00000-0000-0000-0000-0000000000a5'), ('5ea00000-0000-0000-0000-0000000000a6'),
  ('5ea00000-0000-0000-0000-0000000000a7'), ('5ea00000-0000-0000-0000-0000000000a8'),
  ('5ea00000-0000-0000-0000-0000000000a9');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('5ea00000-0000-0000-0000-0000000000a1', 'Zyqview', '1990-01-01', 'woman', 'dubai'),
  ('5ea00000-0000-0000-0000-0000000000a2', 'Zyqora Open', '1990-01-01', 'woman', 'dubai'),
  ('5ea00000-0000-0000-0000-0000000000a3', 'Zyqora Hidden', '1990-01-01', 'woman', 'dubai'),
  ('5ea00000-0000-0000-0000-0000000000a4', 'Zyqora Blocked', '1990-01-01', 'man', 'dubai'),
  ('5ea00000-0000-0000-0000-0000000000a5', 'Zyqora Blocker', '1990-01-01', 'man', 'dubai'),
  ('5ea00000-0000-0000-0000-0000000000a6', 'Zyqora Friend', '1990-01-01', 'woman', 'dubai'),
  ('5ea00000-0000-0000-0000-0000000000a7', 'Zyqora Gone', '1990-01-01', 'woman', 'dubai'),
  ('5ea00000-0000-0000-0000-0000000000a8', 'Zyqora Nocity', '1990-01-01', 'woman', 'dubai'),
  ('5ea00000-0000-0000-0000-0000000000a9', 'Zyqora Stranger', '1990-01-01', 'woman', 'dubai');
insert into public.safety_settings (user_id, profile_visibility, location_precision) values
  ('5ea00000-0000-0000-0000-0000000000a2', 'everyone', 'area'),
  ('5ea00000-0000-0000-0000-0000000000a3', 'nobody', 'area'),
  ('5ea00000-0000-0000-0000-0000000000a6', 'friends', 'city'),
  ('5ea00000-0000-0000-0000-0000000000a8', 'everyone', 'hidden'),
  ('5ea00000-0000-0000-0000-0000000000a9', 'friends', 'area')
on conflict (user_id) do update set profile_visibility = excluded.profile_visibility, location_precision = excluded.location_precision;
insert into public.blocks (blocker_id, blocked_id) values
  ('5ea00000-0000-0000-0000-0000000000a1', '5ea00000-0000-0000-0000-0000000000a4'),
  ('5ea00000-0000-0000-0000-0000000000a5', '5ea00000-0000-0000-0000-0000000000a1');
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('5ea00000-0000-0000-0000-0000000000a1', '5ea00000-0000-0000-0000-0000000000a6', '5ea00000-0000-0000-0000-0000000000a1', 'accepted', now());
update public.profiles set deleted_at = now() where id = '5ea00000-0000-0000-0000-0000000000a7';

-- ───────── People: same rules as before ─────────
select pg_temp.as_user('5ea00000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.people('Zyqora') = array['Zyqora Friend / dubai', 'Zyqora Nocity / -', 'Zyqora Open / dubai'],
  'people: blocked (either way), hidden, deleted and friends-only strangers are not found; a hidden location shows no city');
select pg_temp.check(pg_temp.people('  zYQORA o ') = array['Zyqora Open / dubai'], 'people: the query is trimmed and case does not matter');
select pg_temp.check(pg_temp.people('Zyqview') = '{}', 'people: you do not find yourself');
select pg_temp.check(pg_temp.people('Z') = '{}', 'people: one letter finds nobody');
select pg_temp.check(pg_temp.people('zyq_ra o') = array['Zyqora Open / dubai'], 'people: a query with LIKE wildcards keeps its old meaning');
select pg_temp.check(cardinality(pg_temp.people('Zyqora', 2)) = 2, 'people: the result limit still applies');
select pg_temp.check(not exists (select 1 from private.search_people('zyqora', 100) s
    where s.id in ('5ea00000-0000-0000-0000-0000000000a3', '5ea00000-0000-0000-0000-0000000000a4', '5ea00000-0000-0000-0000-0000000000a5',
      '5ea00000-0000-0000-0000-0000000000a7', '5ea00000-0000-0000-0000-0000000000a9')),
  'people: the helper itself never returns a blocked, hidden or deleted member');

-- Same rows as the old view-based branch, for several queries and viewers.
do $$
declare u text; q text; d integer;
begin
  foreach u in array array['5ea00000-0000-0000-0000-0000000000a1', '5ea00000-0000-0000-0000-0000000000a4',
    '5ea00000-0000-0000-0000-0000000000a5', '5ea00000-0000-0000-0000-0000000000a6', '5ea00000-0000-0000-0000-0000000000a9'] loop
    perform set_config('request.jwt.claim.sub', u, false);
    foreach q in array array['zyqora', 'Zyq', 'zyqora f', 'zyqv', 'zy%n', 'zyqora_', 'z', 'nobody-here'] loop
      select count(*) into d from (
        (select * from pg_temp.people_before(q) except all select * from private.search_people(lower(btrim(q)), 100))
        union all
        (select * from private.search_people(lower(btrim(q)), 100) except all select * from pg_temp.people_before(q))) x;
      if d <> 0 then
        raise exception 'FAIL search_speed: people for % as % differ from before (% rows)', q, u, d;
      end if;
    end loop;
  end loop;
  raise notice 'ok  people: the same rows as the old branch for every viewer and query';
end $$;

-- The others' view: the blocked member finds nobody who blocked them or whom they blocked.
select pg_temp.as_user('5ea00000-0000-0000-0000-0000000000a4');
select pg_temp.check(pg_temp.people('Zyqview') = '{}', 'people: a blocked member does not find the one who blocked them');
select pg_temp.as_user('5ea00000-0000-0000-0000-0000000000a5');
select pg_temp.check(pg_temp.people('Zyqview') = '{}', 'people: a blocker does not find the one they blocked');
select pg_temp.as_user('5ea00000-0000-0000-0000-0000000000a9');
select pg_temp.check(not ('Zyqora Friend / dubai' = any (pg_temp.people('Zyqora'))), 'people: a friends-only member is hidden from a stranger');

-- Signed out: still nothing callable.
select pg_temp.as_admin();
set role anon;
do $$ begin
  perform private.search_people('zyqora', 30);
  raise exception 'FAIL search_speed: anon can call search_people';
exception when insufficient_privilege then
  raise notice 'ok  people: the helper is not callable signed out';
end $$;
reset role;

-- The name index is there and usable for a prefix.
select pg_temp.check(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'profiles_first_name_prefix_idx'),
  'people: the name index exists');

-- ───────── Activities: over two hours after the start ─────────
select pg_temp.as_admin();
set session_replication_role = replica;
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, ends_at) values
  ('5ea00000-0000-0000-0000-0000000000b1', '5ea00000-0000-0000-0000-0000000000a2', 'Zyqact recent', 'sport', 'dubai', 'marina', now() - interval '90 minutes', null),
  ('5ea00000-0000-0000-0000-0000000000b2', '5ea00000-0000-0000-0000-0000000000a2', 'Zyqact stale', 'sport', 'dubai', 'marina', now() - interval '150 minutes', null),
  ('5ea00000-0000-0000-0000-0000000000b3', '5ea00000-0000-0000-0000-0000000000a2', 'Zyqact long', 'sport', 'dubai', 'marina', now() - interval '150 minutes', now() + interval '1 hour'),
  ('5ea00000-0000-0000-0000-0000000000b4', '5ea00000-0000-0000-0000-0000000000a2', 'Zyqact ended', 'sport', 'dubai', 'marina', now() - interval '60 minutes', now() - interval '5 minutes');
set session_replication_role = origin;

select pg_temp.as_user('5ea00000-0000-0000-0000-0000000000a1');
select pg_temp.check((select array_agg(title order by title) from public.search_all('Zyqact', 'dubai', 30) where kind = 'activity')
    = array['Zyqact long', 'Zyqact recent'],
  'activities: search keeps one until it is over (its end, or two hours after the start), not three hours');
select pg_temp.check((select array_agg(title || '=' || state order by title) from public.member_activities('5ea00000-0000-0000-0000-0000000000a2'))
    = array['Zyqact ended=past', 'Zyqact long=live', 'Zyqact recent=live', 'Zyqact stale=past'],
  'activities: a profile shows one live for two hours after the start (or until its end), then past');
-- Search and join agree: what search shows can be joined, what it hides is over.
select pg_temp.check((select bool_and(
      exists (select 1 from public.search_all('Zyqact', 'dubai', 30) s where s.kind = 'activity' and s.id = a.id::text)
      = (coalesce(a.ends_at, a.starts_at + interval '2 hours') >= now()))
    from public.activities a where a.id::text like '5ea00000-%'),
  'activities: search uses the same cutoff as join_activity');

select pg_temp.as_admin();
\echo 'search_speed: ALL PASSED'
