-- Back-office reads of IRLY Girl content are journaled (migration
-- 20261109500000_irly_girl_admin_reads_journal): admin_content,
-- admin_content_item, admin_community, and an IRLY admin's community_sanctions,
-- community_stats and community_audit_log on a women-only community each
-- write one 'girl.view' line in private.admin_audit (who, what, when), like
-- the IRLY Girl safety moderator's view. Mixte reads write nothing; what the
-- functions return and refuse does not change.
-- Runs in one transaction rolled back at the end: later files see nothing of it.
-- Ids b5d00000-….
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
  if not coalesce(ok, false) then raise exception 'FAIL girl_admin_reads_journal: %', label; end if;
  raise notice 'ok  %', label;
end $$;

create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

-- 'girl.view' lines of a staff member written by one function ('via').
create or replace function pg_temp.lines(p_actor uuid, p_via text) returns integer language plpgsql security definer as $$
declare n integer;
begin
  select count(*) into n from private.admin_audit where actor = p_actor and action = 'girl.view' and details ->> 'via' = p_via;
  return n;
end $$;

select pg_temp.as_admin();

-- 01 Owen (admin, a man), 02 Mo (moderator, a man), 03 Nina (verified
-- woman, member and author in IRLY Girl), 04 Max (a man, member of the
-- mixte community), 05 Ola (verified woman, owner of her own women-only
-- community, not staff).
insert into auth.users (id) select ('b5d00000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid from generate_series(1, 5) g;
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('b5d00000-0000-0000-0000-000000000001', 'Owen', '1985-01-01', 'man', 'dubai'),
  ('b5d00000-0000-0000-0000-000000000002', 'Mo', '1985-01-01', 'man', 'dubai'),
  ('b5d00000-0000-0000-0000-000000000003', 'Nina', '1992-01-01', 'woman', 'dubai'),
  ('b5d00000-0000-0000-0000-000000000004', 'Max', '1990-01-01', 'man', 'dubai'),
  ('b5d00000-0000-0000-0000-000000000005', 'Ola', '1991-01-01', 'woman', 'dubai');
update public.profiles set created_at = now() - interval '90 days' where id::text like 'b5d00000-%';
update public.profiles set verified_at = now() where gender = 'woman' and id::text like 'b5d00000-%';
insert into public.staff_roles (user_id, role) values
  ('b5d00000-0000-0000-0000-000000000001', 'admin'),
  ('b5d00000-0000-0000-0000-000000000002', 'moderator');

-- M mixte, G women-only (Ola's own).
insert into public.communities (id, city_id, name, created_by) values
  ('b5d00000-0000-0000-0000-0000000000c1', 'dubai', 'Journal mixte runners', 'b5d00000-0000-0000-0000-000000000004');
insert into public.communities (id, city_id, name, girl_only, created_by) values
  ('b5d00000-0000-0000-0000-0000000000c2', 'dubai', 'Journal girls brunch', true, 'b5d00000-0000-0000-0000-000000000005');
insert into public.community_members (community_id, user_id, role) values
  ('b5d00000-0000-0000-0000-0000000000c1', 'b5d00000-0000-0000-0000-000000000004', 'owner'),
  ('b5d00000-0000-0000-0000-0000000000c2', 'b5d00000-0000-0000-0000-000000000005', 'owner'),
  ('b5d00000-0000-0000-0000-0000000000c2', 'b5d00000-0000-0000-0000-000000000003', 'member')
  on conflict (community_id, user_id) do update set role = excluded.role;
insert into public.community_posts (id, community_id, author_id, body) values
  ('b5d00000-0000-0000-0000-0000000000a1', 'b5d00000-0000-0000-0000-0000000000c2', 'b5d00000-0000-0000-0000-000000000003', 'Journal girls: brunch Friday?'),
  ('b5d00000-0000-0000-0000-0000000000a2', 'b5d00000-0000-0000-0000-0000000000c1', 'b5d00000-0000-0000-0000-000000000004', 'Journal mixte: run tonight');
insert into public.activities (id, title, category_id, city_id, area_id, starts_at, capacity, creator_id) values
  ('b5d00000-0000-0000-0000-0000000000b1', 'Journal mixte padel', 'sport', 'dubai', 'marina', now() + interval '2 days', 8, 'b5d00000-0000-0000-0000-000000000004');
insert into public.activities (id, title, category_id, city_id, area_id, starts_at, capacity, creator_id, girl_only) values
  ('b5d00000-0000-0000-0000-0000000000b2', 'Journal girls padel', 'sport', 'dubai', 'marina', now() + interval '2 days', 8, 'b5d00000-0000-0000-0000-000000000003', true);

-- ───────── 1. The content list ─────────
select pg_temp.as_user('b5d00000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.admin_content('activity', 'Journal mixte')) = 1, 'a moderator lists mixte activities, as before');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.lines('b5d00000-0000-0000-0000-000000000002', 'admin_content') = 0, 'a list with no IRLY Girl item writes nothing');

select pg_temp.as_user('b5d00000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.admin_content('activity', 'Journal')) = 2
  and exists (select 1 from public.admin_content('activity', 'Journal girls') where girl_only),
  'IRLY Girl activities are still listed to moderators (same results)');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.lines('b5d00000-0000-0000-0000-000000000002', 'admin_content') = 2, 'each list showing an IRLY Girl item wrote one line');
select pg_temp.check(exists (select 1 from private.admin_audit where actor = 'b5d00000-0000-0000-0000-000000000002' and action = 'girl.view'
  and details ->> 'via' = 'admin_content' and details ->> 'kind' = 'activity' and details -> 'ids' ? 'b5d00000-0000-0000-0000-0000000000b2'
  and not (details -> 'ids' ? 'b5d00000-0000-0000-0000-0000000000b1') and at <= now()),
  'naming the IRLY Girl items read (never the mixte ones), with when');

select pg_temp.as_user('b5d00000-0000-0000-0000-000000000002');
select pg_temp.check(exists (select 1 from public.admin_content('community_post', 'Journal girls')), 'a moderator searches IRLY Girl posts');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from private.admin_audit where actor = 'b5d00000-0000-0000-0000-000000000002' and action = 'girl.view'
  and details ->> 'kind' = 'community_post' and details -> 'ids' ? 'b5d00000-0000-0000-0000-0000000000a1'), 'that read is journaled too');

-- ───────── 2. One item ─────────
select pg_temp.as_user('b5d00000-0000-0000-0000-000000000002');
select pg_temp.check((public.admin_content_item('activity', 'b5d00000-0000-0000-0000-0000000000b1') ->> 'title') = 'Journal mixte padel', 'a mixte item opens');
select pg_temp.check((public.admin_content_item('community_post', 'b5d00000-0000-0000-0000-0000000000a1') ->> 'body') = 'Journal girls: brunch Friday?', 'an IRLY Girl post opens, as before');
select pg_temp.check((public.admin_content_item('activity', 'b5d00000-0000-0000-0000-0000000000b2') ->> 'girl_only')::boolean, 'an IRLY Girl activity opens');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.lines('b5d00000-0000-0000-0000-000000000002', 'admin_content_item') = 2, 'the two IRLY Girl items wrote a line each, the mixte one none');
select pg_temp.check(exists (select 1 from private.admin_audit where actor = 'b5d00000-0000-0000-0000-000000000002' and action = 'girl.view'
  and details ->> 'via' = 'admin_content_item' and details ->> 'kind' = 'community_post' and details ->> 'id' = 'b5d00000-0000-0000-0000-0000000000a1'
  and target_user = 'b5d00000-0000-0000-0000-000000000003'), 'what was read, and whose words they are');

-- ───────── 3. The community sheet ─────────
select pg_temp.as_user('b5d00000-0000-0000-0000-000000000001');
select pg_temp.check((public.admin_community('b5d00000-0000-0000-0000-0000000000c1') ->> 'name') = 'Journal mixte runners', 'the sheet of a mixte community');
select pg_temp.check((public.admin_community('b5d00000-0000-0000-0000-0000000000c2') ->> 'girl_only')::boolean, 'the sheet of a women-only one');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.lines('b5d00000-0000-0000-0000-000000000001', 'admin_community') = 1, 'only the women-only sheet is journaled');

-- ───────── 4. A women-only community's management, read by an IRLY admin ─────────
select pg_temp.as_user('b5d00000-0000-0000-0000-000000000001');
select pg_temp.check((public.community_stats('b5d00000-0000-0000-0000-0000000000c2') ->> 'members')::int = 2, 'an IRLY admin reads its stats (as before)');
select pg_temp.check((select count(*) from public.community_sanctions('b5d00000-0000-0000-0000-0000000000c2')) = 0, 'its sanctions');
select pg_temp.check((select count(*) from public.community_audit_log('b5d00000-0000-0000-0000-0000000000c2')) >= 0, 'its log');
select public.community_stats('b5d00000-0000-0000-0000-0000000000c1');
select count(*) from public.community_sanctions('b5d00000-0000-0000-0000-0000000000c1');
select count(*) from public.community_audit_log('b5d00000-0000-0000-0000-0000000000c1');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.lines('b5d00000-0000-0000-0000-000000000001', 'community_stats') = 1
  and pg_temp.lines('b5d00000-0000-0000-0000-000000000001', 'community_sanctions') = 1
  and pg_temp.lines('b5d00000-0000-0000-0000-000000000001', 'community_audit_log') = 1,
  'each of the three women-only reads wrote one line; the mixte ones none');
select pg_temp.check(exists (select 1 from private.admin_audit where actor = 'b5d00000-0000-0000-0000-000000000001' and action = 'girl.view'
  and details ->> 'via' = 'community_stats' and details ->> 'kind' = 'community' and details ->> 'id' = 'b5d00000-0000-0000-0000-0000000000c2'),
  'naming the community');

-- Her own community, read by its owner (a member, not staff): not a back-office read.
select pg_temp.as_user('b5d00000-0000-0000-0000-000000000005');
select pg_temp.check((public.community_stats('b5d00000-0000-0000-0000-0000000000c2') ->> 'members')::int = 2, 'the owner reads her stats');
select count(*) from public.community_audit_log('b5d00000-0000-0000-0000-0000000000c2');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from private.admin_audit where actor = 'b5d00000-0000-0000-0000-000000000005' and action = 'girl.view'),
  'the community''s own owner writes nothing in the staff journal');

-- ───────── 5. Refusals are unchanged and write nothing ─────────
select pg_temp.as_user('b5d00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$select * from public.admin_content('activity')$q$) = '42501', 'a member cannot browse content');
select pg_temp.check(pg_temp.fails($q$select public.admin_content_item('activity', 'b5d00000-0000-0000-0000-0000000000b2')$q$) = '42501', 'nor open an item');
select pg_temp.check(pg_temp.fails($q$select public.admin_community('b5d00000-0000-0000-0000-0000000000c2')$q$) = '42501', 'nor a community sheet');
select pg_temp.check(pg_temp.fails($q$select public.community_stats('b5d00000-0000-0000-0000-0000000000c2')$q$) = '42501', 'a man member cannot read a women-only community''s stats');
select pg_temp.check(pg_temp.fails($q$select * from public.community_audit_log('b5d00000-0000-0000-0000-0000000000c2')$q$) = '42501', 'nor its log');
select pg_temp.check(pg_temp.fails($q$select * from public.community_sanctions('b5d00000-0000-0000-0000-0000000000c2')$q$) = '42501', 'nor its sanctions');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from private.admin_audit where actor = 'b5d00000-0000-0000-0000-000000000004' and action = 'girl.view'),
  'refused reads write nothing');

-- ───────── 6. The bodies are out of reach; the wrappers write (never run read-only) ─────────
select pg_temp.check(not has_function_privilege('authenticated', 'private.admin_content_read(text, text, text, integer)', 'execute')
  and not has_function_privilege('authenticated', 'private.community_stats_read(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.girl_read_journal(text, text, uuid, uuid, jsonb)', 'execute'),
  'nobody calls the previous bodies or the journal directly');
select pg_temp.check((select bool_and(p.provolatile = 'v') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('admin_content', 'admin_content_item', 'admin_community', 'community_sanctions', 'community_stats', 'community_audit_log'))
  and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('admin_content', 'admin_content_item', 'admin_community', 'community_sanctions', 'community_stats', 'community_audit_log')) = 6,
  'the six public reads are volatile (a GET could not skip the journal)');
select pg_temp.check(not has_function_privilege('anon', 'public.admin_content(text, text, text, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.community_stats(uuid)', 'execute'), 'grants as before');

rollback;
