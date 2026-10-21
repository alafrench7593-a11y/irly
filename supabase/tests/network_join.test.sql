-- IRLY Network › Communities › Join, on the server: what the Network page lists
-- (community_list, the official business topics, IRLY Girl Networking) is what
-- join_community accepts, for the member it is listed to; the join gives the
-- chat and the detail says member at once.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed 0e700000-….
--   b1 Rania  woman, Dubai
--   b2 Omar   man, Dubai
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
    raise exception 'FAIL network_join: %', label;
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

select pg_temp.as_admin();
insert into auth.users (id) values ('0e700000-0000-0000-0000-0000000000b1'), ('0e700000-0000-0000-0000-0000000000b2');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('0e700000-0000-0000-0000-0000000000b1', 'Rania', '1992-02-02', 'woman', 'dubai'),
  ('0e700000-0000-0000-0000-0000000000b2', 'Omar', '1990-04-04', 'man', 'dubai');
create temp table net (k text primary key, v uuid);
grant all on net to authenticated;
insert into net select 'network', id from public.communities where official and topic = 'network' and city_id = 'dubai' and parent_id is null and deleted_at is null limit 1;
insert into net select 'girl_network', id from public.communities where official and topic = 'girl_network' and girl_only and parent_id is null and deleted_at is null order by city_id = 'dubai' desc limit 1;
select pg_temp.check((select count(*) from net) = 2, 'IRLY Network (Dubai) and IRLY Girl Networking exist');

-- ───────── A woman: both listed, both joined ─────────
select pg_temp.as_user('0e700000-0000-0000-0000-0000000000b1');
select pg_temp.check(exists (select 1 from public.community_list('dubai') where id = (select v from net where k = 'girl_network') and girl_only and official and topic = 'girl_network'),
  'woman: IRLY Girl Networking is in community_list (what Network lists in IRLY Girl)');
select pg_temp.check(public.join_community((select v from net where k = 'girl_network')) is not null, 'woman: joins IRLY Girl Networking, gets its chat');
select pg_temp.check((select is_member and conversation_id is not null from public.community_detail((select v from net where k = 'girl_network'))), 'woman: its page says member, with the chat');
select pg_temp.check(public.join_community((select v from net where k = 'network')) is not null, 'woman: joins IRLY Network (Mixte)');
select pg_temp.check((select is_member from public.community_list('dubai') where id = (select v from net where k = 'network')), 'woman: listed as a member afterwards');

-- ───────── A man: IRLY Network yes, IRLY Girl Networking neither listed nor joinable ─────────
select pg_temp.as_user('0e700000-0000-0000-0000-0000000000b2');
select pg_temp.check(not exists (select 1 from public.community_list('dubai') where id = (select v from net where k = 'girl_network')), 'man: IRLY Girl Networking is not listed');
select pg_temp.check(pg_temp.fails($$select public.join_community((select v from net where k = 'girl_network'))$$) = '42501', 'man: its join is refused');
select pg_temp.check(public.join_community((select v from net where k = 'network')) is not null, 'man: joins IRLY Network');

select pg_temp.as_admin();
