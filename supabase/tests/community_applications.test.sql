-- Private communities joined by application, and co-admins named by the
-- co-admins in charge of roles (migration 20261123000000_irly_community_applications).
-- Every check fails before that migration, except those marked (guard).
-- Runs in one transaction rolled back at the end: later files see nothing of it.
-- Ids ca900000-….
\set ON_ERROR_STOP 1

begin;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
revoke all on table public.community_applications from anon, authenticated;
grant select on table public.community_applications to authenticated;
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
  if not coalesce(ok, false) then raise exception 'FAIL community_applications: %', label; end if;
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

-- 01 Olga (owner), 02 Cora (co-admin, default permissions), 03 Rex (co-admin
-- in charge of roles), 04 Mel (member), 05 Ned and 06 Ann (outsiders),
-- 07 Gus (man), 08 Zed (owner of another community), 09 Mona (moderator),
-- 10 Gina (verified woman, owner of a women-only community), 11 Eve (verified woman),
-- 12 Kim (member).
insert into auth.users (id) select ('ca900000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid from generate_series(1, 12) g;
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('ca900000-0000-0000-0000-000000000001', 'Olga', '1990-01-01', 'woman', 'dubai'),
  ('ca900000-0000-0000-0000-000000000002', 'Cora', '1990-01-01', 'woman', 'dubai'),
  ('ca900000-0000-0000-0000-000000000003', 'Rex', '1990-01-01', 'man', 'dubai'),
  ('ca900000-0000-0000-0000-000000000004', 'Mel', '1990-01-01', 'woman', 'dubai'),
  ('ca900000-0000-0000-0000-000000000005', 'Ned', '1990-01-01', 'man', 'dubai'),
  ('ca900000-0000-0000-0000-000000000006', 'Ann', '1990-01-01', 'woman', 'dubai'),
  ('ca900000-0000-0000-0000-000000000007', 'Gus', '1990-01-01', 'man', 'dubai'),
  ('ca900000-0000-0000-0000-000000000008', 'Zed', '1990-01-01', 'man', 'dubai'),
  ('ca900000-0000-0000-0000-000000000009', 'Mona', '1990-01-01', 'woman', 'dubai'),
  ('ca900000-0000-0000-0000-000000000010', 'Gina', '1990-01-01', 'woman', 'dubai'),
  ('ca900000-0000-0000-0000-000000000011', 'Eve', '1990-01-01', 'woman', 'dubai'),
  ('ca900000-0000-0000-0000-000000000012', 'Kim', '1990-01-01', 'man', 'dubai');
update public.profiles set created_at = now() - interval '90 days' where id::text like 'ca900000-%';
update public.profiles set verified_at = now() where id in ('ca900000-0000-0000-0000-000000000010', 'ca900000-0000-0000-0000-000000000011');

insert into public.communities (id, city_id, name, created_by) values
  ('ca900000-0000-0000-0000-0000000000c1', 'dubai', 'Apply Supper Club', 'ca900000-0000-0000-0000-000000000001'),
  ('ca900000-0000-0000-0000-0000000000c3', 'dubai', 'Apply Other Club', 'ca900000-0000-0000-0000-000000000008');
insert into public.communities (id, city_id, name, created_by, girl_only) values
  ('ca900000-0000-0000-0000-0000000000c2', 'dubai', 'Apply Girls Circle', 'ca900000-0000-0000-0000-000000000010', true);
insert into public.community_members (community_id, user_id, role) values
  ('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000001', 'owner'),
  ('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000002', 'member'),
  ('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000003', 'member'),
  ('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000004', 'member'),
  ('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000009', 'member'),
  ('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000012', 'member'),
  ('ca900000-0000-0000-0000-0000000000c3', 'ca900000-0000-0000-0000-000000000008', 'owner'),
  ('ca900000-0000-0000-0000-0000000000c2', 'ca900000-0000-0000-0000-000000000010', 'owner')
  on conflict (community_id, user_id) do update set role = excluded.role;
insert into public.community_posts (id, community_id, author_id, body) values
  ('ca900000-0000-0000-0000-0000000000a1', 'ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000004', 'Supper on Friday, members only');
-- A game shared in the community (its card is read through game_share_cards).
insert into public.game_rooms (id, game, space, host_id, title, max_players, kind, status, visibility) values
  ('ca900000-0000-0000-0000-0000000000f1', 'werewolf', 'irly', 'ca900000-0000-0000-0000-000000000004', 'Supper wolves', 8, 'online', 'waiting', 'public');
insert into public.community_posts (id, community_id, author_id, body, game_room_id) values
  ('ca900000-0000-0000-0000-0000000000a3', 'ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000004', 'Join my game', 'ca900000-0000-0000-0000-0000000000f1');
insert into public.comments (id, target_type, target_id, author_id, body) values
  ('ca900000-0000-0000-0000-0000000000b1', 'community_post', 'ca900000-0000-0000-0000-0000000000a1', 'ca900000-0000-0000-0000-000000000012', 'I am in');
insert into public.likes (target_type, target_id, user_id) values
  ('community_post', 'ca900000-0000-0000-0000-0000000000a1', 'ca900000-0000-0000-0000-000000000012');
insert into public.community_channels (id, community_id, slug, name, created_by) values
  ('ca900000-0000-0000-0000-0000000000e1', 'ca900000-0000-0000-0000-0000000000c1', 'recipes', 'Recipes', 'ca900000-0000-0000-0000-000000000001');
-- A member's activity in the community, with the default privacy (public).
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, community_id) values
  ('ca900000-0000-0000-0000-0000000000d1', 'ca900000-0000-0000-0000-000000000004', 'Supper at the marina', 'food', 'dubai', 'marina', now() + interval '3 days', 'ca900000-0000-0000-0000-0000000000c1');
select id as chat from public.conversations where community_id = 'ca900000-0000-0000-0000-0000000000c1' \gset
insert into public.messages (conversation_id, sender_id, body) values (:'chat', 'ca900000-0000-0000-0000-000000000004', 'apply private chat line');

-- ───────── 1. Co-admins ─────────
select pg_temp.as_user('ca900000-0000-0000-0000-000000000001');
select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000002', 'co_admin');
select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000003', 'co_admin');
select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000009', 'moderator');
select public.community_set_permissions('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000003',
  '{"roles": true, "members": true, "moderation": true}');
select pg_temp.as_admin();
select pg_temp.check((select permissions ->> 'roles' = 'false' and permissions ->> 'members' = 'true' and permissions ->> 'moderation' = 'true'
  from public.community_members where community_id = 'ca900000-0000-0000-0000-0000000000c1' and user_id = 'ca900000-0000-0000-0000-000000000002'),
  'roles (guard): a co-admin named by the owner manages members and moderates, without the roles permission');

-- A co-admin in charge of roles names a co-admin.
select pg_temp.as_user('ca900000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000004', 'co_admin')$q$) is null,
  'roles: a co-admin in charge of roles names a member co-admin');
select pg_temp.as_admin();
select pg_temp.check((select role = 'co_admin' and permissions ->> 'roles' = 'false' from public.community_members
  where community_id = 'ca900000-0000-0000-0000-0000000000c1' and user_id = 'ca900000-0000-0000-0000-000000000004'),
  'roles: the new co-admin does not receive the roles permission');
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'ca900000-0000-0000-0000-000000000004'
  and kind = 'COMMUNITY_ROLE' and payload ->> 'role' = 'co_admin'), 'roles: the new co-admin is notified');
select pg_temp.check(exists (select 1 from public.community_audit where community_id = 'ca900000-0000-0000-0000-0000000000c1'
  and action = 'role.set' and target_user = 'ca900000-0000-0000-0000-000000000004' and actor = 'ca900000-0000-0000-0000-000000000003'),
  'roles: the journal names who did it');

-- No chain: the co-admin just named names nobody.
select pg_temp.as_user('ca900000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000012', 'co_admin')$q$) = '42501',
  'roles: a co-admin without the roles permission names no co-admin');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000012', 'moderator')$q$) = '42501',
  'roles: nor a moderator');
select pg_temp.check(pg_temp.fails($q$select public.community_set_permissions('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000004', '{"roles": true}')$q$) = '42501',
  'roles: and cannot give herself the permission');
select pg_temp.check((select (community_my_rights ->> 'can_moderate')::boolean and (community_my_rights ->> 'can_manage_members')::boolean
  from public.community_my_rights('ca900000-0000-0000-0000-0000000000c1')), 'roles: the new co-admin moderates and manages members');

-- Who else may not: a moderator, a member, the owner of another community, an outsider.
select pg_temp.as_user('ca900000-0000-0000-0000-000000000009');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000012', 'co_admin')$q$) = '42501',
  'roles (guard): a moderator names no co-admin');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000012');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000009', 'co_admin')$q$) = '42501',
  'roles (guard): a member names no co-admin');
select pg_temp.check(pg_temp.fails($q$update public.community_members set role = 'co_admin' where community_id = 'ca900000-0000-0000-0000-0000000000c1' and user_id = 'ca900000-0000-0000-0000-000000000012'$q$) is not null
  or (select role from public.community_members where community_id = 'ca900000-0000-0000-0000-0000000000c1' and user_id = 'ca900000-0000-0000-0000-000000000012') = 'member',
  'roles (guard): nor by writing to the table');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000008');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000012', 'co_admin')$q$) = '42501',
  'roles (guard): the owner of another community names nobody here');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000012', 'co_admin')$q$) = '42501',
  'roles (guard): an outsider names nobody');

-- The co-admin in charge of roles: not herself, not the owner, not a peer in charge of roles.
select pg_temp.as_user('ca900000-0000-0000-0000-000000000001');
select public.community_set_permissions('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000002',
  '{"roles": true, "members": true, "moderation": true}');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000003', 'member')$q$) = '22023',
  'roles: not on herself');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000001', 'member')$q$) = '42501',
  'roles (guard): not on the owner');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000002', 'member')$q$) = '42501',
  'roles: not on a co-admin who is in charge of roles too');
select pg_temp.check(pg_temp.fails($q$select public.community_transfer_ownership('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000003')$q$) = '42501',
  'roles (guard): ownership is the owner''s to transfer');
select pg_temp.check(pg_temp.fails($q$select public.delete_community('ca900000-0000-0000-0000-0000000000c1')$q$) is not null,
  'roles (guard): deleting the community is the owner''s');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000001');
select public.community_set_permissions('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000002',
  '{"roles": false, "members": true, "moderation": true}');

-- An active member only: a restricted member is not named.
select public.community_restrict('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000012', now() + interval '1 day', 'apply test');
select pg_temp.check(pg_temp.fails($q$select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000012', 'co_admin')$q$) = '22023',
  'roles: a restricted member is not named co-admin');
select public.community_unrestrict('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000012');

-- Removing the role: a member again, without any of the rights, at once.
select pg_temp.as_user('ca900000-0000-0000-0000-000000000003');
select public.community_set_role('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000004', 'member');
select pg_temp.as_admin();
select pg_temp.check((select role = 'member' and permissions = '{}'::jsonb from public.community_members
  where community_id = 'ca900000-0000-0000-0000-0000000000c1' and user_id = 'ca900000-0000-0000-0000-000000000004'),
  'roles: a co-admin in charge of roles removes the role; the permissions go with it');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000004');
select pg_temp.check((select not (community_my_rights ->> 'can_moderate')::boolean and not (community_my_rights ->> 'can_manage_members')::boolean
  from public.community_my_rights('ca900000-0000-0000-0000-0000000000c1')), 'roles: the former co-admin has no right left');
select pg_temp.check(pg_temp.fails($q$select public.community_kick('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000012', 'former')$q$) = '42501',
  'roles: the former co-admin removes nobody');
select pg_temp.check(pg_temp.fails($q$select * from public.community_applications('ca900000-0000-0000-0000-0000000000c1')$q$) = '42501',
  'roles: the former co-admin reads no application');

-- ───────── 2. A community becomes private ─────────
select pg_temp.as_user('ca900000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$select public.community_set_access('ca900000-0000-0000-0000-0000000000c1', 'application')$q$) = '42501',
  'access: a member does not change it');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.fails($q$select public.community_set_access('ca900000-0000-0000-0000-0000000000c1', 'application')$q$) = '42501',
  'access: nor a co-admin without the settings permission');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails($q$select public.community_set_access('ca900000-0000-0000-0000-0000000000c1', 'secret')$q$) = '22023',
  'access: open or application only');
select pg_temp.check(pg_temp.fails($q$select public.community_set_access('ca900000-0000-0000-0000-0000000000c1', 'application', '["a","b","c","d"]')$q$) = '22023',
  'access: three questions at most');
select pg_temp.check((select public.community_set_access('ca900000-0000-0000-0000-0000000000c1', 'application', '["  Why do you want to join?  ", ""]'))
  = '{"access": "application", "questions": ["Why do you want to join?"]}'::jsonb, 'access: the owner makes it private, with one question (trimmed, blanks dropped)');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.community_members where community_id = 'ca900000-0000-0000-0000-0000000000c1') = 6,
  'access: the six members stay');
select pg_temp.check(exists (select 1 from public.community_audit where community_id = 'ca900000-0000-0000-0000-0000000000c1' and action = 'community.access'),
  'access: the change is in the journal');
update public.communities set official = true where id = 'ca900000-0000-0000-0000-0000000000c3';
select pg_temp.check(pg_temp.fails($q$update public.communities set access = 'application' where id = 'ca900000-0000-0000-0000-0000000000c3'$q$) = '22023',
  'access: an official community stays open');
update public.communities set official = false where id = 'ca900000-0000-0000-0000-0000000000c3';

-- A member reads as before.
select pg_temp.as_user('ca900000-0000-0000-0000-000000000004');
select pg_temp.check(public.game_share_cards(array['ca900000-0000-0000-0000-0000000000a3']::uuid[]) ? 'ca900000-0000-0000-0000-0000000000a3',
  'private (guard): a member reads the card of a game shared there');
select pg_temp.check((select count(*) from public.community_posts where community_id = 'ca900000-0000-0000-0000-0000000000c1') = 2,
  'private (guard): a member reads the posts');
select pg_temp.check((select count(*) from public.community_posts_page('ca900000-0000-0000-0000-0000000000c1')) = 2,
  'private (guard): and the posts page');
select pg_temp.check((select count(*) from public.community_members_list('ca900000-0000-0000-0000-0000000000c1')) = 6,
  'private (guard): and the members');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000012');
select pg_temp.check((select count(*) from public.activities where id = 'ca900000-0000-0000-0000-0000000000d1') = 1
  and (select count(*) from public.member_communities('ca900000-0000-0000-0000-000000000004') where id = 'ca900000-0000-0000-0000-0000000000c1') = 1,
  'private (guard): a member sees the community''s activity, and the community on another member''s profile');
-- The access changes through community_set_access only (rights and journal), even for who may edit the settings.
select pg_temp.as_user('ca900000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails($q$update public.communities set access = 'open' where id = 'ca900000-0000-0000-0000-0000000000c1'$q$) = '42501',
  'access: a direct write to the table is refused, even to the owner');
select pg_temp.check(pg_temp.fails($q$update public.communities set application_questions = '[]' where id = 'ca900000-0000-0000-0000-0000000000c1'$q$) = '42501',
  'access: the questions too');
select pg_temp.check(pg_temp.fails($q$update public.communities set tagline = 'Suppers, twice a month' where id = 'ca900000-0000-0000-0000-0000000000c1'$q$) is null,
  'access (guard): the owner still edits the other fields');

-- A non-member sees the page, and nothing of what members share.
select pg_temp.as_user('ca900000-0000-0000-0000-000000000005');
select pg_temp.check((select name from public.communities where id = 'ca900000-0000-0000-0000-0000000000c1') = 'Apply Supper Club',
  'private (guard): the community''s page stays readable');
select pg_temp.check((select members = 6 and not is_member and conversation_id is null from public.community_detail('ca900000-0000-0000-0000-0000000000c1')),
  'private (guard): its detail too, without the chat');
select pg_temp.check((select (h ->> 'members')::int = 6 and h -> 'faces' = '[]'::jsonb from public.community_header('ca900000-0000-0000-0000-0000000000c1') h),
  'private: the header counts the members and shows no face');
select pg_temp.check((select count(*) from public.community_posts where community_id = 'ca900000-0000-0000-0000-0000000000c1') = 0,
  'private: a non-member reads no post');
select pg_temp.check((select count(*) from public.community_posts where id = 'ca900000-0000-0000-0000-0000000000a1') = 0,
  'private: nor one post by its id (a direct link)');
select pg_temp.check((select count(*) from public.comments where target_id = 'ca900000-0000-0000-0000-0000000000a1') = 0,
  'private: nor its comments');
select pg_temp.check((select count(*) from public.likes where target_id = 'ca900000-0000-0000-0000-0000000000a1') = 0,
  'private: nor its likes');
select pg_temp.check((select count(*) from public.community_channels where community_id = 'ca900000-0000-0000-0000-0000000000c1') = 0,
  'private: nor its categories');
select pg_temp.check((select count(*) from public.community_members where community_id = 'ca900000-0000-0000-0000-0000000000c1') = 0,
  'private (guard): nor the member rows');
select pg_temp.check((select count(*) from public.messages where conversation_id = :'chat') = 0,
  'private (guard): nor the chat');
select pg_temp.check((select count(*) from public.community_feed('ca900000-0000-0000-0000-0000000000c1')) = 0,
  'private: the feed is empty for her');
select pg_temp.check(pg_temp.fails($q$select * from public.community_posts_page('ca900000-0000-0000-0000-0000000000c1')$q$) = '42501',
  'private: the posts page is refused');
select pg_temp.check(pg_temp.fails($q$select * from public.community_members_list('ca900000-0000-0000-0000-0000000000c1')$q$) = '42501',
  'private: the member list is refused');
select pg_temp.check(pg_temp.fails($q$select * from public.community_search('ca900000-0000-0000-0000-0000000000c1', 'supper')$q$) = '42501',
  'private: the search in the community is refused');
select pg_temp.check(pg_temp.fails($q$select * from public.community_media('ca900000-0000-0000-0000-0000000000c1')$q$) = '42501',
  'private: the media are refused');
select pg_temp.check(public.game_share_cards(array['ca900000-0000-0000-0000-0000000000a3']::uuid[]) = '{}'::jsonb,
  'private: nor the card of a game shared there');
select pg_temp.check(pg_temp.fails($q$insert into public.comments (target_type, target_id, author_id, body) values ('community_post', 'ca900000-0000-0000-0000-0000000000a1', 'ca900000-0000-0000-0000-000000000005', 'let me in')$q$) is not null,
  'private: she cannot comment a post she cannot read');
select pg_temp.check(pg_temp.fails($q$select public.join_community('ca900000-0000-0000-0000-0000000000c1')$q$) = '42501',
  'private: joining directly is refused');
select pg_temp.check((select count(*) from public.activities where community_id = 'ca900000-0000-0000-0000-0000000000c1') = 0,
  'private: an activity of the community (public by default) is not shown to a non-member');
select pg_temp.check((select count(*) from public.community_activities('ca900000-0000-0000-0000-0000000000c1')) = 0,
  'private: nor in the community''s agenda');
select pg_temp.check(pg_temp.fails($q$select public.join_activity('ca900000-0000-0000-0000-0000000000d1')$q$) is not null,
  'private: nor joined by its id');
select pg_temp.check((select count(*) from public.member_communities('ca900000-0000-0000-0000-000000000004') where id = 'ca900000-0000-0000-0000-0000000000c1') = 0,
  'private: a member''s profile does not show the private community to a non-member');
select pg_temp.check((select count(*) from public.member_communities('ca900000-0000-0000-0000-000000000005')) >= 0,
  'private (guard): her own list still reads');
select pg_temp.check((select public.join_communities(array['ca900000-0000-0000-0000-0000000000c1']::uuid[])) = 0,
  'private: the bulk join skips it');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.community_members where community_id = 'ca900000-0000-0000-0000-0000000000c1' and user_id = 'ca900000-0000-0000-0000-000000000005'),
  'private: she is not a member');

-- ───────── 3. Applying ─────────
select pg_temp.as_user('ca900000-0000-0000-0000-000000000005');
select pg_temp.check((select a ->> 'access' = 'application' and (a ->> 'private')::boolean and not (a ->> 'can_read')::boolean
  and a -> 'application' = 'null'::jsonb and a -> 'questions' = '["Why do you want to join?"]'::jsonb and not (a ->> 'can_review')::boolean and a -> 'pending' = 'null'::jsonb
  from public.community_access('ca900000-0000-0000-0000-0000000000c1') a), 'apply: the page knows it is private, with its question');
select pg_temp.check(pg_temp.fails($q$select public.community_apply('ca900000-0000-0000-0000-0000000000c1', 'Too short', '["Because"]')$q$) = '22023',
  'apply: a message has ten characters at least');
select pg_temp.check(pg_temp.fails($q$select public.community_apply('ca900000-0000-0000-0000-0000000000c1', 'I cook every weekend and would love to join.', '[]')$q$) = '22023',
  'apply: every question is answered');
select pg_temp.check(pg_temp.fails($q$select public.community_apply('ca900000-0000-0000-0000-0000000000c3', 'I cook every weekend and would love to join.', '[]')$q$) = '22023',
  'apply: not to an open community');
select pg_temp.check((select (r ->> 'status') = 'pending' and not (r ->> 'already')::boolean
  from public.community_apply('ca900000-0000-0000-0000-0000000000c1', 'I cook every weekend and would love to join.', '["To meet people who cook"]') r),
  'apply: the request is sent');
select pg_temp.check((select (r ->> 'already')::boolean
  from public.community_apply('ca900000-0000-0000-0000-0000000000c1', 'I cook every weekend and would love to join.', '["To meet people who cook"]') r),
  'apply: a second tap gets the first request');
select pg_temp.check(pg_temp.fails($q$insert into public.community_applications (community_id, user_id, message) values ('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000005', 'written straight to the table')$q$) = '42501',
  'apply: nothing is written straight to the table');
select pg_temp.check(pg_temp.fails($q$update public.community_applications set status = 'accepted' where user_id = 'ca900000-0000-0000-0000-000000000005'$q$) = '42501',
  'apply: nobody accepts herself');
select pg_temp.check((select count(*) = 1 and bool_and(answers = '[{"q": "Why do you want to join?", "a": "To meet people who cook"}]'::jsonb)
  from public.community_applications where community_id = 'ca900000-0000-0000-0000-0000000000c1'), 'apply: she reads her own request, once, with her answer');
select pg_temp.check((select a #>> '{application,status}' = 'pending' from public.community_access('ca900000-0000-0000-0000-0000000000c1') a),
  'apply: the page shows it pending');
select pg_temp.check((select count(*) from public.community_posts where community_id = 'ca900000-0000-0000-0000-0000000000c1') = 0,
  'apply: a pending request opens nothing');
select pg_temp.as_admin();
select pg_temp.check((select array_agg(user_id order by user_id) from public.notifications where kind = 'COMMUNITY_APPLICATION'
  and payload ->> 'community_id' = 'ca900000-0000-0000-0000-0000000000c1')
  = array['ca900000-0000-0000-0000-000000000001', 'ca900000-0000-0000-0000-000000000002', 'ca900000-0000-0000-0000-000000000003']::uuid[],
  'apply: the owner and the co-admins in charge are told, once each (not the moderator, not the members)');

-- Who reads it.
select pg_temp.as_user('ca900000-0000-0000-0000-000000000006');
select pg_temp.check((select count(*) from public.community_applications) = 0, 'apply: another outsider reads no request');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000012');
select pg_temp.check((select count(*) from public.community_applications) = 0, 'apply: nor a member');
select pg_temp.check(pg_temp.fails($q$select * from public.community_applications('ca900000-0000-0000-0000-0000000000c1')$q$) = '42501', 'apply: the list is refused to a member');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000009');
select pg_temp.check(pg_temp.fails($q$select * from public.community_applications('ca900000-0000-0000-0000-0000000000c1')$q$) = '42501', 'apply: and to a moderator');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000008');
select pg_temp.check(pg_temp.fails($q$select * from public.community_applications('ca900000-0000-0000-0000-0000000000c1')$q$) = '42501', 'apply: and to the owner of another community');
select pg_temp.check((select count(*) from public.community_applications) = 0, 'apply: who reads none in the table either');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) = 1 and bool_and(name = 'Ned' and message like 'I cook%' and answers -> 0 ->> 'a' = 'To meet people who cook')
  from public.community_applications('ca900000-0000-0000-0000-0000000000c1')), 'apply: a co-admin in charge reads it, with the name, the message and the answers');
select pg_temp.check((select (a ->> 'can_review')::boolean and (a ->> 'pending')::int = 1 from public.community_access('ca900000-0000-0000-0000-0000000000c1') a),
  'apply: and sees one waiting');

-- Withdrawing, then asking again.
select pg_temp.as_user('ca900000-0000-0000-0000-000000000005');
select pg_temp.check(public.community_withdraw_application('ca900000-0000-0000-0000-0000000000c1'), 'withdraw: she withdraws her request');
select pg_temp.check(not public.community_withdraw_application('ca900000-0000-0000-0000-0000000000c1'), 'withdraw: once');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.community_applications('ca900000-0000-0000-0000-0000000000c1')) = 0, 'withdraw: it leaves the queue');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000005');
select public.community_apply('ca900000-0000-0000-0000-0000000000c1', 'Second try: I really do cook every weekend.', '["To meet people who cook"]');
select id as ned_app from public.community_applications where user_id = 'ca900000-0000-0000-0000-000000000005' and status = 'pending' \gset
select pg_temp.check(:'ned_app' is not null, 'withdraw: she may ask again');

-- ───────── 4. Answering ─────────
select pg_temp.as_user('ca900000-0000-0000-0000-000000000012');
select pg_temp.check(pg_temp.fails(format('select public.community_decide_application(%L, true)', :'ned_app')) = '42501', 'decide: a member decides nothing');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.fails(format('select public.community_decide_application(%L, true)', :'ned_app')) = '42501', 'decide: the applicant does not accept herself');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000008');
select pg_temp.check(pg_temp.fails(format('select public.community_decide_application(%L, true)', :'ned_app')) = '42501', 'decide: nor the owner of another community');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails(format('select public.community_decide_application(%L, true)', :'ned_app')) = '42501', 'decide: nor a former co-admin');

select pg_temp.as_user('ca900000-0000-0000-0000-000000000002');
select pg_temp.check((select (r ->> 'decided')::boolean and r ->> 'status' = 'accepted' from public.community_decide_application(:'ned_app', true) r),
  'decide: a co-admin accepts');
-- The other admin, a moment later: one decision, and she is told which.
select pg_temp.as_user('ca900000-0000-0000-0000-000000000003');
select pg_temp.check((select not (r ->> 'decided')::boolean and r ->> 'status' = 'accepted' from public.community_decide_application(:'ned_app', false) r),
  'decide: a second answer changes nothing and gets the final status');
select pg_temp.as_admin();
select pg_temp.check((select status = 'accepted' and decided_by = 'ca900000-0000-0000-0000-000000000002' and decided_at is not null
  from public.community_applications where id = :'ned_app'), 'decide: the request is closed, by the first');
select pg_temp.check((select count(*) from public.community_members where community_id = 'ca900000-0000-0000-0000-0000000000c1' and user_id = 'ca900000-0000-0000-0000-000000000005' and role = 'member') = 1,
  'decide: the membership exists, once');
select pg_temp.check(exists (select 1 from public.conversation_members where conversation_id = :'chat' and user_id = 'ca900000-0000-0000-0000-000000000005'),
  'decide: she is in the chat');
select pg_temp.check((select count(*) from public.notifications where user_id = 'ca900000-0000-0000-0000-000000000005' and kind = 'COMMUNITY_APPLICATION_ACCEPTED') = 1
  and not exists (select 1 from public.notifications where user_id = 'ca900000-0000-0000-0000-000000000005' and kind = 'COMMUNITY_APPLICATION_REFUSED'),
  'decide: she is told once that she is accepted');
select pg_temp.check(exists (select 1 from public.community_audit where community_id = 'ca900000-0000-0000-0000-0000000000c1' and action = 'application.accept'
  and target_user = 'ca900000-0000-0000-0000-000000000005'), 'decide: the journal has it');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from public.community_posts where community_id = 'ca900000-0000-0000-0000-0000000000c1') = 2
  and (select count(*) from public.messages where conversation_id = :'chat') >= 1
  and (select (a ->> 'can_read')::boolean from public.community_access('ca900000-0000-0000-0000-0000000000c1') a),
  'decide: accepted, she reads the posts and the chat');
select pg_temp.check(pg_temp.fails($q$select public.community_apply('ca900000-0000-0000-0000-0000000000c1', 'I am already in, asking again anyway.', '["x"]')$q$) = '22023',
  'apply: a member does not apply');

-- Nobody answers her own request, an IRLY admin included.
select pg_temp.as_admin();
insert into public.staff_roles (user_id, role) values ('ca900000-0000-0000-0000-000000000007', 'admin');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000007');
select public.community_apply('ca900000-0000-0000-0000-0000000000c1', 'I am on the IRLY team and would like in.', '["Anything"]');
select id as gus_app from public.community_applications where user_id = 'ca900000-0000-0000-0000-000000000007' and status = 'pending' \gset
select pg_temp.check(pg_temp.fails(format('select public.community_decide_application(%L, true)', :'gus_app')) = '22023',
  'decide: an IRLY admin does not accept her own request');
select pg_temp.check(public.community_withdraw_application('ca900000-0000-0000-0000-0000000000c1'), 'decide (guard): she withdraws it');
select pg_temp.as_admin();
delete from public.staff_roles where user_id = 'ca900000-0000-0000-0000-000000000007';

-- Refusing.
select pg_temp.as_user('ca900000-0000-0000-0000-000000000006');
select public.community_apply('ca900000-0000-0000-0000-0000000000c1', 'Hello, I would like to join your suppers.', '["Curiosity"]');
select id as ann_app from public.community_applications where user_id = 'ca900000-0000-0000-0000-000000000006' and status = 'pending' \gset
select pg_temp.as_user('ca900000-0000-0000-0000-000000000003');
select pg_temp.check((select (r ->> 'decided')::boolean and r ->> 'status' = 'refused' from public.community_decide_application(:'ann_app', false) r),
  'decide: a co-admin refuses');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000001');
select pg_temp.check((select not (r ->> 'decided')::boolean and r ->> 'status' = 'refused' from public.community_decide_application(:'ann_app', true) r),
  'decide: accepting after a refusal changes nothing');
select pg_temp.check((select count(*) = 2 from public.community_applications('ca900000-0000-0000-0000-0000000000c1', 'answered')),
  'decide: the answered requests are listed apart');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.community_members where community_id = 'ca900000-0000-0000-0000-0000000000c1' and user_id = 'ca900000-0000-0000-0000-000000000006'),
  'decide: refused, she is not a member');
select pg_temp.check((select count(*) from public.notifications where user_id = 'ca900000-0000-0000-0000-000000000006' and kind = 'COMMUNITY_APPLICATION_REFUSED') = 1,
  'decide: she is told once');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000006');
select pg_temp.check((select count(*) from public.community_posts where community_id = 'ca900000-0000-0000-0000-0000000000c1') = 0,
  'decide: refused, she still reads nothing');
select pg_temp.check((select a #>> '{application,status}' = 'refused' from public.community_access('ca900000-0000-0000-0000-0000000000c1') a),
  'decide: her page says refused');

-- A ban between the request and the answer.
select public.community_apply('ca900000-0000-0000-0000-0000000000c1', 'Asking again after a while, with respect.', '["Curiosity"]');
select id as ann_app2 from public.community_applications where user_id = 'ca900000-0000-0000-0000-000000000006' and status = 'pending' \gset
select pg_temp.as_admin();
insert into public.community_bans (community_id, user_id, reason) values ('ca900000-0000-0000-0000-0000000000c1', 'ca900000-0000-0000-0000-000000000006', 'apply test');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails(format('select public.community_decide_application(%L, true)', :'ann_app2')) = '42501',
  'decide: a banned person is not accepted');
select pg_temp.as_admin();
select pg_temp.check((select status from public.community_applications where id = :'ann_app2') = 'pending'
  and not exists (select 1 from public.community_members where community_id = 'ca900000-0000-0000-0000-0000000000c1' and user_id = 'ca900000-0000-0000-0000-000000000006'),
  'decide: nothing was written by the refused acceptance');
delete from public.community_bans where community_id = 'ca900000-0000-0000-0000-0000000000c1' and user_id = 'ca900000-0000-0000-0000-000000000006';
-- A suspended account, as join_community refuses it: not accepted, and it cannot apply.
insert into public.sanctions (user_id, kind, reason) values ('ca900000-0000-0000-0000-000000000006', 'suspension', 'apply test');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails(format('select public.community_decide_application(%L, true)', :'ann_app2')) = '42501',
  'decide: a suspended account is not accepted');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.community_members where community_id = 'ca900000-0000-0000-0000-0000000000c1' and user_id = 'ca900000-0000-0000-0000-000000000006'),
  'decide: and is not a member');
insert into public.sanctions (user_id, kind, reason) values ('ca900000-0000-0000-0000-000000000007', 'suspension', 'apply test');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000007');
select pg_temp.check(pg_temp.fails($q$select public.community_apply('ca900000-0000-0000-0000-0000000000c1', 'Suspended, asking to join anyway.', '["x"]')$q$) = '42501',
  'apply: a suspended account does not apply');
select pg_temp.as_admin();
delete from public.sanctions where reason = 'apply test';
select pg_temp.as_user('ca900000-0000-0000-0000-000000000006');
select pg_temp.check(public.community_withdraw_application('ca900000-0000-0000-0000-0000000000c1'), 'withdraw (guard): she withdraws the second request');

-- ───────── 5. IRLY Girl ─────────
select pg_temp.as_user('ca900000-0000-0000-0000-000000000010');
select public.community_set_access('ca900000-0000-0000-0000-0000000000c2', 'application', '[]');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000007');
select pg_temp.check(pg_temp.fails($q$select public.community_apply('ca900000-0000-0000-0000-0000000000c2', 'I would like to join this circle please.', '[]')$q$) = '42501',
  'girl: an account without IRLY Girl access cannot apply');
select pg_temp.check(pg_temp.fails($q$select public.community_access('ca900000-0000-0000-0000-0000000000c2')$q$) = '42501',
  'girl: nor read how to join');
select pg_temp.check((select count(*) from public.communities where id = 'ca900000-0000-0000-0000-0000000000c2') = 0,
  'girl (guard): nor see the community');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000011');
select public.community_apply('ca900000-0000-0000-0000-0000000000c2', 'New in Dubai, I would love to meet the circle.', '[]');
select id as eve_app from public.community_applications where user_id = 'ca900000-0000-0000-0000-000000000011' and status = 'pending' \gset
-- She loses her access (suspended from IRLY Girl) while the request waits: the owner's approval does not bring her in.
select pg_temp.as_admin();
insert into public.girl_suspensions (user_id, reason) values ('ca900000-0000-0000-0000-000000000011', 'apply test');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000010');
select pg_temp.check(pg_temp.fails(format('select public.community_decide_application(%L, true)', :'eve_app')) = '42501',
  'girl: an approval does not pass the IRLY Girl rule');
select pg_temp.as_admin();
select pg_temp.check((select status from public.community_applications where id = :'eve_app') = 'pending'
  and not exists (select 1 from public.community_members where community_id = 'ca900000-0000-0000-0000-0000000000c2' and user_id = 'ca900000-0000-0000-0000-000000000011'),
  'girl: she is not a member, the request still waits');
delete from public.girl_suspensions where user_id = 'ca900000-0000-0000-0000-000000000011';
select pg_temp.as_user('ca900000-0000-0000-0000-000000000010');
select pg_temp.check((select r ->> 'status' = 'accepted' from public.community_decide_application(:'eve_app', true) r),
  'girl: eligible again, she is accepted');
-- An IRLY admin who is a man gets no right in a women-only community.
select pg_temp.as_user('ca900000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.fails($q$select * from public.community_applications('ca900000-0000-0000-0000-0000000000c2')$q$) = '42501',
  'girl: a man who runs another community reads no application there');

-- ───────── 6. Groups, reopening, texts ─────────
select pg_temp.as_admin();
insert into public.communities (id, city_id, name, created_by, parent_id) values
  ('ca900000-0000-0000-0000-0000000000c4', 'dubai', 'Apply Supper Bakers', 'ca900000-0000-0000-0000-000000000001', 'ca900000-0000-0000-0000-0000000000c1');
insert into public.community_posts (id, community_id, author_id, body) values
  ('ca900000-0000-0000-0000-0000000000a2', 'ca900000-0000-0000-0000-0000000000c4', 'ca900000-0000-0000-0000-000000000001', 'Bakers, sourdough on Sunday');
select pg_temp.check(pg_temp.fails($q$update public.communities set access = 'application' where id = 'ca900000-0000-0000-0000-0000000000c4'$q$) = '22023',
  'groups: a group has no access of its own');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000006');
select pg_temp.check((select count(*) from public.community_posts where community_id = 'ca900000-0000-0000-0000-0000000000c4') = 0,
  'groups: the group of a private community is closed to a non-member');
select pg_temp.check(pg_temp.fails($q$select public.join_community('ca900000-0000-0000-0000-0000000000c4')$q$) = '42501',
  'groups: and is not a way in');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000012');
select pg_temp.check((select count(*) from public.community_posts where community_id = 'ca900000-0000-0000-0000-0000000000c4') = 1,
  'groups: a member of the community reads its group');
select pg_temp.check(pg_temp.fails($q$select public.join_community('ca900000-0000-0000-0000-0000000000c4')$q$) is null,
  'groups: and joins it');

-- The community opens again: the request waiting is no longer needed.
select pg_temp.as_user('ca900000-0000-0000-0000-000000000006');
select public.community_apply('ca900000-0000-0000-0000-0000000000c1', 'Third time lucky, I hope. Thank you.', '["Curiosity"]');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000001');
select public.community_set_access('ca900000-0000-0000-0000-0000000000c1', 'open');
select pg_temp.as_user('ca900000-0000-0000-0000-000000000006');
select pg_temp.check((select count(*) from public.community_posts where community_id = 'ca900000-0000-0000-0000-0000000000c1') = 2,
  'reopen: an open community is read by everyone again');
select pg_temp.check(pg_temp.fails($q$select public.join_community('ca900000-0000-0000-0000-0000000000c1')$q$) is null, 'reopen: and joined directly');
select pg_temp.check((select count(*) from public.community_applications where user_id = 'ca900000-0000-0000-0000-000000000006' and status = 'pending') = 0,
  'reopen: joining closes the request that waited');

-- The push texts of the three notifications (never the fallback).
select pg_temp.as_admin();
select pg_temp.check((select (private.push_text(n, 'fr')).body like 'Ned demande à rejoindre%' and (private.push_text(n, 'en')).url like '/community/manage/%'
  from public.notifications n where kind = 'COMMUNITY_APPLICATION' and user_id = 'ca900000-0000-0000-0000-000000000001'
    and payload ->> 'from' = 'ca900000-0000-0000-0000-000000000005' order by created_at limit 1),
  'push: the team reads who asks, and lands on the applications');
select pg_temp.check((select (private.push_text(n, 'fr')).body like 'Ta candidature est acceptée%' and (private.push_text(n, 'en')).url = '/c/ca900000-0000-0000-0000-0000000000c1'
  from public.notifications n where kind = 'COMMUNITY_APPLICATION_ACCEPTED' and user_id = 'ca900000-0000-0000-0000-000000000005' limit 1),
  'push: the accepted applicant lands on the community');
select pg_temp.check((select (private.push_text(n, 'en')).body = 'Your application was not accepted'
  from public.notifications n where kind = 'COMMUNITY_APPLICATION_REFUSED' and user_id = 'ca900000-0000-0000-0000-000000000006' limit 1),
  'push: the refused applicant is told');

rollback;
