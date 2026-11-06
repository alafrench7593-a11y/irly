-- Community governance (migration 20261107000000_irly_community_governance,
-- docs/COMMUNITIES-CONTRACT.md « Migration A »): ranks, co-admins and their
-- permissions, ownership, kick, ban, restriction, warning, moderation of
-- activities and chat messages, audit log, stats, IRLY Girl.
-- Every check fails before that migration, except those marked (guard).
-- Runs in one transaction rolled back at the end: later files see nothing of it.
-- Ids c6a00000-….
\set ON_ERROR_STOP 1

begin;

-- As the platform does (and as the other files do): table grants for the
-- API roles, row level security decides.
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
  if not coalesce(ok, false) then raise exception 'FAIL community_governance: %', label; end if;
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

select pg_temp.as_admin();

-- 01 Olga (owner), 02 Cora and 03 Cole (co-admins), 04 Mona (moderator),
-- 05 Mel, 07 Bob, 08 Rita, 09 Kim (members), 06 Ned (outsider),
-- 10 Gina (verified woman, owner of a women-only community), 11 Gus (man).
insert into auth.users (id) select ('c6a00000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid from generate_series(1, 11) g;
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c6a00000-0000-0000-0000-000000000001', 'Olga', '1990-01-01', 'woman', 'dubai'),
  ('c6a00000-0000-0000-0000-000000000002', 'Cora', '1990-01-01', 'woman', 'dubai'),
  ('c6a00000-0000-0000-0000-000000000003', 'Cole', '1990-01-01', 'man', 'dubai'),
  ('c6a00000-0000-0000-0000-000000000004', 'Mona', '1990-01-01', 'woman', 'dubai'),
  ('c6a00000-0000-0000-0000-000000000005', 'Mel', '1990-01-01', 'woman', 'dubai'),
  ('c6a00000-0000-0000-0000-000000000006', 'Ned', '1990-01-01', 'man', 'dubai'),
  ('c6a00000-0000-0000-0000-000000000007', 'Bob', '1990-01-01', 'man', 'dubai'),
  ('c6a00000-0000-0000-0000-000000000008', 'Rita', '1990-01-01', 'woman', 'dubai'),
  ('c6a00000-0000-0000-0000-000000000009', 'Kim', '1990-01-01', 'man', 'dubai'),
  ('c6a00000-0000-0000-0000-000000000010', 'Gina', '1990-01-01', 'woman', 'dubai'),
  ('c6a00000-0000-0000-0000-000000000011', 'Gus', '1990-01-01', 'man', 'dubai');
update public.profiles set created_at = now() - interval '90 days' where id::text like 'c6a00000-%';
update public.profiles set verified_at = now() where id = 'c6a00000-0000-0000-0000-000000000010';

insert into public.communities (id, city_id, name, created_by) values
  ('c6a00000-0000-0000-0000-0000000000c1', 'dubai', 'Gov Padel Club', 'c6a00000-0000-0000-0000-000000000001');
insert into public.communities (id, city_id, name, created_by, girl_only) values
  ('c6a00000-0000-0000-0000-0000000000c2', 'dubai', 'Gov Girls Run', 'c6a00000-0000-0000-0000-000000000010', true);
insert into public.community_members (community_id, user_id, role) values
  ('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000001', 'owner'),
  ('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000002', 'member'),
  ('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000003', 'member'),
  ('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000004', 'member'),
  ('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000005', 'member'),
  ('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000007', 'member'),
  ('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000008', 'member'),
  ('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000009', 'member'),
  ('c6a00000-0000-0000-0000-0000000000c2', 'c6a00000-0000-0000-0000-000000000010', 'owner')
  on conflict (community_id, user_id) do update set role = excluded.role;
select id as chat from public.conversations where community_id = 'c6a00000-0000-0000-0000-0000000000c1' \gset
select pg_temp.check((select count(*) from public.conversation_members where conversation_id = :'chat') = 8,
  'setup (guard): the eight members are in the community chat');

-- A direct chat Mel–Kim, for delete_message.
insert into public.conversations (id, kind, title) values ('c6a00000-0000-0000-0000-0000000000d0', 'direct', null);
insert into public.conversation_members (conversation_id, user_id, role) values
  ('c6a00000-0000-0000-0000-0000000000d0', 'c6a00000-0000-0000-0000-000000000005', 'member'),
  ('c6a00000-0000-0000-0000-0000000000d0', 'c6a00000-0000-0000-0000-000000000009', 'member');
insert into public.messages (id, conversation_id, sender_id, body) values
  ('c6a00000-0000-0000-0000-0000000000d1', 'c6a00000-0000-0000-0000-0000000000d0', 'c6a00000-0000-0000-0000-000000000005', 'gov private hello');

-- ───────── Roles: the owner names co-admins and a moderator ─────────
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000001');
select public.community_set_role('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000002', 'co_admin');
select public.community_set_role('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000003', 'co_admin');
select public.community_set_role('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000004', 'moderator');
select pg_temp.check((select (community_my_rights ->> 'role') = 'owner' and (community_my_rights ->> 'can_roles')::boolean
  and (community_my_rights ->> 'can_stats')::boolean from public.community_my_rights('c6a00000-0000-0000-0000-0000000000c1')),
  'rights: the owner has every right');
select pg_temp.as_admin();
select pg_temp.check((select string_agg(role, ',' order by user_id) from public.community_members
  where community_id = 'c6a00000-0000-0000-0000-0000000000c1' and user_id in ('c6a00000-0000-0000-0000-000000000002',
    'c6a00000-0000-0000-0000-000000000003', 'c6a00000-0000-0000-0000-000000000004')) = 'co_admin,co_admin,moderator',
  'roles: the owner named two co-admins and a moderator');
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'c6a00000-0000-0000-0000-000000000002'
  and kind = 'COMMUNITY_ROLE' and payload ->> 'role' = 'co_admin' and payload ->> 'community_id' = 'c6a00000-0000-0000-0000-0000000000c1'),
  'roles: the new co-admin is notified');

-- A moderator names no co-admin (nor any role).
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
select pg_temp.check((select (community_my_rights ->> 'role') = 'moderator' and (community_my_rights ->> 'can_moderate')::boolean
  and not (community_my_rights ->> 'can_roles')::boolean from public.community_my_rights('c6a00000-0000-0000-0000-0000000000c1')),
  'rights: a moderator moderates, without roles');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000005', 'co_admin')$q$) = '42501',
  'roles: a moderator cannot name a co-admin');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000005', 'moderator')$q$) = '42501',
  'roles: nor a moderator');

-- The owner sets Cora's permissions (roles, members; no stats).
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000001');
select pg_temp.check((select public.community_set_permissions('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000002',
  '{"roles": true, "members": true, "moderation": true, "stats": false, "bogus": true, "settings": "yes"}'))
  = '{"roles": true, "members": true, "moderation": true, "announcements": false, "activities": false, "settings": false, "stats": false}'::jsonb,
  'permissions: the owner sets them (only the seven keys, booleans only)');
select pg_temp.check(pg_temp.fails($q$select public.community_set_permissions('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000004', '{"stats": true}')$q$) = '22023',
  'permissions: only for co-admins');
select pg_temp.as_admin();
select pg_temp.check((select permissions ->> 'roles' = 'true' and permissions ->> 'stats' = 'false' from public.community_members
  where community_id = 'c6a00000-0000-0000-0000-0000000000c1' and user_id = 'c6a00000-0000-0000-0000-000000000002'), 'permissions: stored');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000001');
select pg_temp.check((public.community_permissions('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000002') ->> 'roles')::boolean,
  'permissions: the owner reads them');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.fails($q$select public.community_permissions('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000002')$q$) = '42501',
  'permissions: a co-admin does not read another''s');

-- ───────── A co-admin stays below the owner and other co-admins ─────────
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000002');
select pg_temp.check((select (community_my_rights ->> 'role') = 'co_admin' and (community_my_rights ->> 'can_roles')::boolean
  and not (community_my_rights ->> 'can_stats')::boolean from public.community_my_rights('c6a00000-0000-0000-0000-0000000000c1')),
  'rights: a co-admin has the permissions the owner gave');
select pg_temp.check(pg_temp.fails($q$select public.community_ban('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000001', 'coup')$q$) = '42501',
  'co-admin: cannot ban the owner');
select pg_temp.check(pg_temp.fails($q$select public.community_kick('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000001', 'coup')$q$) = '42501',
  'co-admin: cannot kick the owner');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000001', 'member')$q$) = '42501',
  'co-admin: cannot demote the owner');
select pg_temp.check(pg_temp.fails($q$select public.community_ban('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000003', 'rival')$q$) = '42501',
  'co-admin: cannot ban another co-admin');
select pg_temp.check(pg_temp.fails($q$select public.community_kick('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000003', 'rival')$q$) = '42501',
  'co-admin: cannot kick another co-admin');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000003', 'member')$q$) = '42501',
  'co-admin: cannot demote another co-admin');
select pg_temp.check(pg_temp.fails($q$select public.community_restrict('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000003', now() + interval '1 day', 'rival')$q$) = '42501',
  'co-admin: cannot restrict another co-admin');
select pg_temp.check(pg_temp.fails($q$select public.community_set_permissions('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000002', '{"stats": true}')$q$) = '42501',
  'co-admin: cannot change her own permissions');
select pg_temp.check(pg_temp.fails($q$select public.community_set_permissions('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000003', '{"stats": true}')$q$) = '42501',
  'co-admin: nor another co-admin''s');
select pg_temp.check(pg_temp.fails($q$select public.community_transfer_ownership('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000002')$q$) = '42501',
  'co-admin: cannot transfer ownership');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000009', 'co_admin')$q$) = '42501',
  'co-admin: cannot name a co-admin');
-- What her roles permission does allow: moderators.
select public.community_set_role('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000009', 'moderator');
select public.community_set_role('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000009', 'member');
select pg_temp.as_admin();
select pg_temp.check((select role from public.community_members where community_id = 'c6a00000-0000-0000-0000-0000000000c1'
  and user_id = 'c6a00000-0000-0000-0000-000000000009') = 'member', 'co-admin (guard): names and removes a moderator');
select pg_temp.check((select role from public.community_members where community_id = 'c6a00000-0000-0000-0000-0000000000c1'
  and user_id = 'c6a00000-0000-0000-0000-000000000001') = 'owner', 'co-admin (guard): the owner is still the owner');

-- The owner removes a co-admin and a moderator.
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000001');
select public.community_set_role('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000003', 'member');
select public.community_set_role('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000009', 'moderator');
select public.community_set_role('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000009', 'member');
select pg_temp.as_admin();
select pg_temp.check((select role = 'member' and permissions = '{}' from public.community_members where community_id = 'c6a00000-0000-0000-0000-0000000000c1'
  and user_id = 'c6a00000-0000-0000-0000-000000000003'), 'roles: the owner removes a co-admin (and her permissions)');
select pg_temp.check((select role from public.community_members where community_id = 'c6a00000-0000-0000-0000-0000000000c1'
  and user_id = 'c6a00000-0000-0000-0000-000000000009') = 'member', 'roles: the owner removes a moderator');
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'c6a00000-0000-0000-0000-000000000003'
  and kind = 'COMMUNITY_ROLE' and payload ->> 'role' = 'member' and payload ->> 'previous' = 'co_admin'), 'roles: the former co-admin is told');

-- ───────── Any member creates an activity in her community ─────────
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, community_id, privacy)
  values ('c6a00000-0000-0000-0000-0000000000a1', auth.uid(), 'Gov members padel', 'sport', 'dubai', 'jumeirah', now() + interval '2 days',
  'c6a00000-0000-0000-0000-0000000000c1', 'community')$q$) is null,
  'activities (guard): a member with no role creates a community activity, published at once');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, community_id)
  values ('c6a00000-0000-0000-0000-0000000000a2', auth.uid(), 'Gov open padel', 'sport', 'dubai', 'jumeirah', now() + interval '3 days',
  'c6a00000-0000-0000-0000-0000000000c1')$q$) is null,
  'activities (guard): and a public one in the community');
select pg_temp.check((select (community_my_rights ->> 'role') = 'member' and not (community_my_rights ->> 'can_moderate')::boolean
  and not (community_my_rights ->> 'banned')::boolean and community_my_rights -> 'restricted_until' = 'null'::jsonb
  from public.community_my_rights('c6a00000-0000-0000-0000-0000000000c1')), 'rights: a member in good standing');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000006');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, community_id)
  values (auth.uid(), 'Gov outsider padel', 'sport', 'dubai', 'jumeirah', now() + interval '2 days', 'c6a00000-0000-0000-0000-0000000000c1')$q$) = '42501',
  'activities (guard): an outsider cannot');
select pg_temp.check(pg_temp.fails($q$select public.community_kick('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000005', 'x')$q$) = '42501',
  'kick: an outsider cannot');

-- ───────── Ban ─────────
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$select public.community_ban('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000007', 'spam')$q$) = '42501',
  'ban: a moderator does not ban (members permission)');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000002');
select public.community_ban('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000007', 'spam in the chat');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000007');
select pg_temp.check(not exists (select 1 from public.community_members where community_id = 'c6a00000-0000-0000-0000-0000000000c1' and user_id = auth.uid()),
  'ban: the membership is gone');
select pg_temp.check((select (community_my_rights ->> 'banned')::boolean and community_my_rights -> 'banned_until' = 'null'::jsonb
  from public.community_my_rights('c6a00000-0000-0000-0000-0000000000c1')), 'ban: her rights say banned, for good');
select pg_temp.check(pg_temp.fails($q$select public.join_community('c6a00000-0000-0000-0000-0000000000c1')$q$) = '42501',
  'ban: cannot rejoin');
select pg_temp.check(public.join_communities(array['c6a00000-0000-0000-0000-0000000000c1'::uuid]) = 0, 'ban: nor through join_communities (skipped)');
select pg_temp.check(not exists (select 1 from public.community_members where community_id = 'c6a00000-0000-0000-0000-0000000000c1' and user_id = auth.uid()),
  'ban: still out');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, community_id)
  values (auth.uid(), 'Gov banned padel', 'sport', 'dubai', 'jumeirah', now() + interval '2 days', 'c6a00000-0000-0000-0000-0000000000c1')$q$) = '42501',
  'ban: cannot create an activity in it');
select pg_temp.check(pg_temp.fails(format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'gov banned hello')$q$, :'chat')) is not null,
  'ban: cannot chat in it');
select pg_temp.check(exists (select 1 from public.notifications where user_id = auth.uid() and kind = 'COMMUNITY_BAN'
  and payload ->> 'community_id' = 'c6a00000-0000-0000-0000-0000000000c1' and payload ->> 'reason' = 'spam in the chat'), 'ban: she is notified');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.fails($q$insert into public.community_members (community_id, user_id) values ('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000007')$q$) = '42501',
  'ban: no way back in, whatever the path');
select pg_temp.check(not exists (select 1 from public.conversation_members where conversation_id = :'chat' and user_id = 'c6a00000-0000-0000-0000-000000000007'),
  'ban: out of the chat');
-- i_belong is false even if a row is forced in.
set local session_replication_role = replica;
insert into public.community_members (community_id, user_id) values ('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000007');
set local session_replication_role = origin;
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000007');
select pg_temp.check(not private.i_belong('c6a00000-0000-0000-0000-0000000000c1'), 'ban: i_belong is false');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, community_id)
  values (auth.uid(), 'Gov banned padel', 'sport', 'dubai', 'jumeirah', now() + interval '2 days', 'c6a00000-0000-0000-0000-0000000000c1')$q$) = '42501',
  'ban: still no activity');
select pg_temp.as_admin();
delete from public.community_members where community_id = 'c6a00000-0000-0000-0000-0000000000c1' and user_id = 'c6a00000-0000-0000-0000-000000000007';
-- Unban: she may join again.
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$select public.community_unban('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000007')$q$) = '42501',
  'unban: not a moderator''s');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000001');
select public.community_unban('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000007');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000007');
select pg_temp.check(pg_temp.fails($q$select public.join_community('c6a00000-0000-0000-0000-0000000000c1')$q$) is null, 'unban (guard): she joins again');

-- ───────── Restriction ─────────
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.fails($q$select public.community_restrict('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000008', now() + interval '1 day', 'x')$q$) = '42501',
  'restrict: a member cannot');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$select public.community_restrict('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000008', now() - interval '1 day', 'x')$q$) = '22023',
  'restrict: the end is in the future');
select public.community_restrict('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000008', now() + interval '1 day', 'cool down');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000008');
select pg_temp.check((select (community_my_rights ->> 'restricted_until')::timestamptz > now() from public.community_my_rights('c6a00000-0000-0000-0000-0000000000c1')),
  'restrict: her rights say until when');
select pg_temp.check(private.i_belong('c6a00000-0000-0000-0000-0000000000c1'), 'restrict (guard): she still belongs (and reads)');
select pg_temp.check(pg_temp.fails($q$insert into public.community_posts (community_id, author_id, body) values ('c6a00000-0000-0000-0000-0000000000c1', auth.uid(), 'gov restricted post')$q$) = '42501',
  'restrict: no post');
select pg_temp.check(pg_temp.fails(format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'gov restricted chat')$q$, :'chat')) = '42501',
  'restrict: no chat message');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, community_id)
  values (auth.uid(), 'Gov restricted padel', 'sport', 'dubai', 'jumeirah', now() + interval '2 days', 'c6a00000-0000-0000-0000-0000000000c1')$q$) = '42501',
  'restrict: no activity in the community');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at)
  values (auth.uid(), 'Gov restricted own padel', 'sport', 'dubai', 'jumeirah', now() + interval '2 days')$q$) is null,
  'restrict (guard): her own plans outside the community are untouched');
select pg_temp.check(exists (select 1 from public.notifications where user_id = auth.uid() and kind = 'COMMUNITY_RESTRICTION'), 'restrict: she is notified');
-- The end date passes.
select pg_temp.as_admin();
update public.community_restrictions set until = now() - interval '1 second'
where community_id = 'c6a00000-0000-0000-0000-0000000000c1' and user_id = 'c6a00000-0000-0000-0000-000000000008';
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000008');
select pg_temp.check(pg_temp.fails($q$insert into public.community_posts (community_id, author_id, body) values ('c6a00000-0000-0000-0000-0000000000c1', auth.uid(), 'gov post after')$q$) is null
  and pg_temp.fails(format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'gov chat after')$q$, :'chat')) is null
  and pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, community_id)
    values (auth.uid(), 'Gov padel after', 'sport', 'dubai', 'jumeirah', now() + interval '2 days', 'c6a00000-0000-0000-0000-0000000000c1')$q$) is null,
  'restrict: once the date has passed she posts, chats and creates again');
-- Restricted again, then lifted early.
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
select public.community_restrict('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000008', now() + interval '7 days', 'again');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000008');
select pg_temp.check(pg_temp.fails($q$insert into public.community_posts (community_id, author_id, body) values ('c6a00000-0000-0000-0000-0000000000c1', auth.uid(), 'gov post again')$q$) = '42501',
  'restrict: restricted again');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
select public.community_unrestrict('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000008');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000008');
select pg_temp.check(pg_temp.fails($q$insert into public.community_posts (community_id, author_id, body) values ('c6a00000-0000-0000-0000-0000000000c1', auth.uid(), 'gov post unrestricted')$q$) is null,
  'unrestrict: she posts again');

-- ───────── Warning, sanctions list ─────────
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$select public.community_warn('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000001', 'be nice')$q$) = '42501',
  'warn: a moderator does not warn the owner');
select public.community_warn('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000009', 'be nice in the chat');
select pg_temp.check((select count(*) from public.community_sanctions('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000009')
  where kind = 'warning' and name = 'Kim' and reason = 'be nice in the chat') = 1, 'sanctions: the warning is listed');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000009');
select pg_temp.check(exists (select 1 from public.notifications where user_id = auth.uid() and kind = 'COMMUNITY_WARNING'), 'warn: he is notified');
select pg_temp.check(exists (select 1 from public.community_warnings where user_id = auth.uid()), 'warn: he reads his own warning');
select pg_temp.check(pg_temp.fails($q$select * from public.community_sanctions('c6a00000-0000-0000-0000-0000000000c1')$q$) = '42501',
  'sanctions: a member cannot list them');

-- ───────── Kick ─────────
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
select public.community_kick('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000009', 'off topic');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.community_members where community_id = 'c6a00000-0000-0000-0000-0000000000c1'
  and user_id = 'c6a00000-0000-0000-0000-000000000009'), 'kick: the membership is gone');
select pg_temp.check(exists (select 1 from public.profiles where id = 'c6a00000-0000-0000-0000-000000000009' and deleted_at is null)
  and exists (select 1 from auth.users where id = 'c6a00000-0000-0000-0000-000000000009'), 'kick: the account is untouched');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000009');
select pg_temp.check(pg_temp.fails($q$select public.join_community('c6a00000-0000-0000-0000-0000000000c1')$q$) is null, 'kick (guard): he may join again');
-- The old entry point still works, through the new rules.
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$select public.remove_community_member('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000002')$q$) = '42501',
  'remove_community_member: a moderator cannot remove a co-admin');
select public.remove_community_member('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000009');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.community_members where community_id = 'c6a00000-0000-0000-0000-0000000000c1'
  and user_id = 'c6a00000-0000-0000-0000-000000000009'), 'remove_community_member (guard): still removes a member');

-- ───────── moderate_activity ─────────
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000008');
select pg_temp.check(pg_temp.fails($q$select public.community_moderate_activity('c6a00000-0000-0000-0000-0000000000a1', 'mine now')$q$) = '42501',
  'moderate_activity: a member cannot');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
select public.community_moderate_activity('c6a00000-0000-0000-0000-0000000000a1', 'off topic');
select public.community_moderate_activity('c6a00000-0000-0000-0000-0000000000a2', 'off topic');
select pg_temp.as_admin();
select pg_temp.check((select community_id is null and cancelled_at is not null and title = 'Gov members padel' from public.activities
  where id = 'c6a00000-0000-0000-0000-0000000000a1'), 'moderate_activity: unlinked, members-only one cancelled, content kept');
select pg_temp.check((select community_id is null and cancelled_at is null and title = 'Gov open padel' from public.activities
  where id = 'c6a00000-0000-0000-0000-0000000000a2'), 'moderate_activity: a public one is only unlinked');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$select public.community_moderate_activity('c6a00000-0000-0000-0000-0000000000a2', 'again')$q$) = '22023',
  'moderate_activity: an activity no longer in the community');

-- ───────── delete_message ─────────
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000005');
insert into public.messages (id, conversation_id, sender_id, body) values ('c6a00000-0000-0000-0000-0000000000e1', :'chat', auth.uid(), 'gov rude message');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$select public.community_delete_message('c6a00000-0000-0000-0000-0000000000d1', 'peek')$q$) = '42501',
  'delete_message: never a direct message');
select public.community_delete_message('c6a00000-0000-0000-0000-0000000000e1', 'rude');
select pg_temp.as_admin();
select pg_temp.check((select deleted_at is not null and body = '—' from public.messages where id = 'c6a00000-0000-0000-0000-0000000000e1')
  and exists (select 1 from public.message_removals where message_id = 'c6a00000-0000-0000-0000-0000000000e1'),
  'delete_message: removed from the community chat, for everyone');
select pg_temp.check((select deleted_at is null and body = 'gov private hello' from public.messages where id = 'c6a00000-0000-0000-0000-0000000000d1'),
  'delete_message (guard): the direct message is untouched');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
insert into public.messages (id, conversation_id, sender_id, body) values ('c6a00000-0000-0000-0000-0000000000e2', :'chat', auth.uid(), 'gov mod message');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.fails($q$select public.community_delete_message('c6a00000-0000-0000-0000-0000000000e2', 'revenge')$q$) = '42501',
  'delete_message: a member cannot');

-- ───────── Ownership ─────────
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails($q$select public.community_transfer_ownership('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000006')$q$) = 'P0002',
  'ownership: only to a member');
select public.community_transfer_ownership('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000005');
select pg_temp.as_admin();
select pg_temp.check((select role from public.community_members where community_id = 'c6a00000-0000-0000-0000-0000000000c1'
  and user_id = 'c6a00000-0000-0000-0000-000000000005') = 'owner', 'ownership: Mel is the owner');
select pg_temp.check((select role = 'co_admin' and permissions = '{"members": true, "moderation": true, "announcements": true, "activities": true, "settings": true, "stats": true, "roles": true}'::jsonb
  from public.community_members where community_id = 'c6a00000-0000-0000-0000-0000000000c1' and user_id = 'c6a00000-0000-0000-0000-000000000001'),
  'ownership: Olga is a co-admin with every permission');
select pg_temp.check((select role from public.conversation_members where conversation_id = :'chat' and user_id = 'c6a00000-0000-0000-0000-000000000005') = 'admin',
  'ownership: Mel runs the chat');
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'c6a00000-0000-0000-0000-000000000005' and kind = 'COMMUNITY_OWNERSHIP'),
  'ownership: Mel is notified');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails($q$select public.community_kick('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000005', 'take it back')$q$) = '42501',
  'ownership: the former owner cannot act on the new one');
select pg_temp.check(pg_temp.fails($q$select public.leave_community('c6a00000-0000-0000-0000-0000000000c1')$q$) is null,
  'ownership (guard): no longer the owner, she may leave');
select pg_temp.check(not exists (select 1 from public.community_members where community_id = 'c6a00000-0000-0000-0000-0000000000c1' and user_id = auth.uid()),
  'ownership (guard): and she is out');

-- ───────── Settings: a co-admin with settings edits, never deletes ─────────
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000005');
select public.community_set_permissions('c6a00000-0000-0000-0000-0000000000c1', 'c6a00000-0000-0000-0000-000000000002', '{"settings": true, "stats": true}');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000002');
update public.communities set tagline = 'Gov tagline by the co-admin' where id = 'c6a00000-0000-0000-0000-0000000000c1';
select pg_temp.check(pg_temp.fails($q$update public.communities set deleted_at = now() where id = 'c6a00000-0000-0000-0000-0000000000c1'$q$) = '42501',
  'settings: a co-admin cannot delete the community');
select pg_temp.as_admin();
select pg_temp.check((select tagline = 'Gov tagline by the co-admin' and deleted_at is null from public.communities where id = 'c6a00000-0000-0000-0000-0000000000c1'),
  'settings: a co-admin with settings edits the community');

-- ───────── Stats ─────────
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$select public.community_stats('c6a00000-0000-0000-0000-0000000000c1')$q$) = '42501', 'stats: not for a moderator');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000002');
select public.community_stats('c6a00000-0000-0000-0000-0000000000c1') as stats \gset
select pg_temp.as_admin();
-- Members: Mel, Cora, Cole, Mona, Bob (back), Rita = 6. Upcoming: Rita's plan
-- after her restriction = 1. Messages this week: Rita's, Mona's = 2 (Mel's was removed).
select pg_temp.check((:'stats'::jsonb ->> 'members')::int = 6
  and (:'stats'::jsonb ->> 'members')::int = (select count(*) from public.community_members where community_id = 'c6a00000-0000-0000-0000-0000000000c1'),
  'stats: real member count');
select pg_temp.check((:'stats'::jsonb ->> 'new_7d')::int = (select count(*) from public.community_members where community_id = 'c6a00000-0000-0000-0000-0000000000c1' and joined_at > now() - interval '7 days'),
  'stats: new members this week');
select pg_temp.check((:'stats'::jsonb ->> 'upcoming_activities')::int = 1, 'stats: upcoming activities');
select pg_temp.check((:'stats'::jsonb ->> 'activities_30d')::int = 1, 'stats: activities this month (moderated ones left the community)');
select pg_temp.check((:'stats'::jsonb ->> 'participants_30d')::int = 1, 'stats: participants this month');
select pg_temp.check((:'stats'::jsonb ->> 'messages_7d')::int = 2, 'stats: messages this week');
select pg_temp.check((:'stats'::jsonb ->> 'open_reports')::int = 0, 'stats: no open report yet');
insert into public.reports (reporter_id, target_user_id, target_kind, target_id, category)
values ('c6a00000-0000-0000-0000-000000000004', 'c6a00000-0000-0000-0000-000000000008', 'community_post',
  (select id from public.community_posts where body = 'gov post unrestricted'), 'spam');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000005');
select pg_temp.check((public.community_stats('c6a00000-0000-0000-0000-0000000000c1') ->> 'open_reports')::int = 1, 'stats: the open report counts');

-- ───────── Audit log ─────────
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from public.community_audit_log('c6a00000-0000-0000-0000-0000000000c1')
  where action in ('role.set', 'permissions.set', 'member.ban', 'member.unban', 'member.restrict', 'member.unrestrict', 'member.warn',
                   'member.kick', 'activity.moderate', 'message.delete', 'ownership.transfer')) >= 16, 'audit: every sensitive action is logged');
select pg_temp.check(exists (select 1 from public.community_audit_log('c6a00000-0000-0000-0000-0000000000c1')
  where action = 'member.ban' and actor_name = 'Cora' and target_name = 'Bob' and reason = 'spam in the chat'), 'audit: who did what to whom, and why');
-- (Dividing by zero fails on the first row read: 22012 means a row was readable.)
select pg_temp.check(coalesce(pg_temp.fails($q$select 1 / (length(action) - length(action)) from public.community_audit$q$), 'none') <> '22012',
  'audit: not readable directly');
select pg_temp.fails($q$update public.community_audit set reason = 'edited'$q$);
select pg_temp.fails($q$delete from public.community_audit$q$);
select pg_temp.fails($q$insert into public.community_audit (community_id, action) values ('c6a00000-0000-0000-0000-0000000000c1', 'forged')$q$);
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.community_audit where community_id = 'c6a00000-0000-0000-0000-0000000000c1') >= 16
  and not exists (select 1 from public.community_audit where reason = 'edited' or action = 'forged'),
  'audit: a member neither edits, deletes nor forges a line');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$select * from public.community_audit_log('c6a00000-0000-0000-0000-0000000000c1')$q$) = '42501', 'audit: not for a moderator');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.fails($q$update public.community_audit set reason = 'edited'$q$) = '42501', 'audit: no update, even for the server');
select pg_temp.check(pg_temp.fails($q$delete from public.community_audit where community_id = 'c6a00000-0000-0000-0000-0000000000c1'$q$) = '42501', 'audit: no delete, even for the server');

-- ───────── IRLY Girl ─────────
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000011');
select pg_temp.check(pg_temp.fails($q$select public.join_community('c6a00000-0000-0000-0000-0000000000c2')$q$) = '42501', 'girl (guard): Gus cannot join');
select pg_temp.check(pg_temp.fails($q$select public.community_my_rights('c6a00000-0000-0000-0000-0000000000c2')$q$) = '42501', 'girl: nor read rights there');
select pg_temp.check(pg_temp.fails($q$select public.community_ban('c6a00000-0000-0000-0000-0000000000c2', 'c6a00000-0000-0000-0000-000000000010', 'x')$q$) = '42501', 'girl: nor ban');
select pg_temp.check(pg_temp.fails($q$select public.community_stats('c6a00000-0000-0000-0000-0000000000c2')$q$) = '42501', 'girl: nor read stats');
select pg_temp.check(pg_temp.fails($q$select * from public.community_audit_log('c6a00000-0000-0000-0000-0000000000c2')$q$) = '42501', 'girl: nor the log');
-- Even made a member by mistake, a man without IRLY Girl has no rights there.
select pg_temp.as_admin();
insert into public.community_members (community_id, user_id, role) values ('c6a00000-0000-0000-0000-0000000000c2', 'c6a00000-0000-0000-0000-000000000011', 'co_admin');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000011');
select pg_temp.check(pg_temp.fails($q$select public.community_kick('c6a00000-0000-0000-0000-0000000000c2', 'c6a00000-0000-0000-0000-000000000010', 'x')$q$) = '42501', 'girl: a stray row gives no power');
select pg_temp.as_user('c6a00000-0000-0000-0000-000000000010');
select pg_temp.check((select (community_my_rights ->> 'role') = 'owner' from public.community_my_rights('c6a00000-0000-0000-0000-0000000000c2')),
  'girl (guard): Gina owns her community');

rollback;
