-- Account lifecycle: deleting an account removes the sign-in user and every
-- row of theirs, keeps other people's data, is all-or-nothing and safe to
-- retry; "Download my data" returns only the member's own data.
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
    raise exception 'FAIL %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

create or replace function pg_temp.fails(stmt text) returns boolean language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    return true;
  end;
  return false;
end $$;

-- Rows (in any table) that still point at this person: every foreign key to
-- the profile or the sign-in user, whatever its on-delete rule.
create or replace function pg_temp.rows_of(uid uuid) returns bigint language plpgsql as $$
declare
  fk record;
  n bigint;
  total bigint := 0;
begin
  for fk in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f' and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
  loop
    execute format('select count(*) from %s where %I = $1', fk.tbl, fk.col) into n using uid;
    total := total + n;
  end loop;
  return total;
end $$;

select pg_temp.as_admin();

-- Lea deletes her account; Omar and Nour stay.
insert into auth.users (id) values
  ('ac000000-0000-0000-0000-0000000000a1'), ('ac000000-0000-0000-0000-0000000000a2'),
  ('ac000000-0000-0000-0000-0000000000a3');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('ac000000-0000-0000-0000-0000000000a1', 'Lealife', '1994-03-03', 'woman', 'dubai'),
  ('ac000000-0000-0000-0000-0000000000a2', 'Omarlife', '1990-05-05', 'man', 'dubai'),
  ('ac000000-0000-0000-0000-0000000000a3', 'Nourlife', '1992-07-07', 'woman', 'dubai');

-- Relationships both ways.
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('ac000000-0000-0000-0000-0000000000a1', 'ac000000-0000-0000-0000-0000000000a2', 'ac000000-0000-0000-0000-0000000000a1', 'accepted', now()),
  ('ac000000-0000-0000-0000-0000000000a2', 'ac000000-0000-0000-0000-0000000000a3', 'ac000000-0000-0000-0000-0000000000a2', 'accepted', now());
insert into public.follows (follower_id, followee_id) values
  ('ac000000-0000-0000-0000-0000000000a1', 'ac000000-0000-0000-0000-0000000000a2'),
  ('ac000000-0000-0000-0000-0000000000a2', 'ac000000-0000-0000-0000-0000000000a1'),
  ('ac000000-0000-0000-0000-0000000000a2', 'ac000000-0000-0000-0000-0000000000a3');
insert into public.blocks (blocker_id, blocked_id) values ('ac000000-0000-0000-0000-0000000000a3', 'ac000000-0000-0000-0000-0000000000a1');

-- A direct chat Lea / Omar, and a group Lea created with Omar and Nour.
insert into public.conversations (id, kind) values ('ac000000-0000-0000-0000-0000000000c1', 'direct');
insert into public.conversations (id, kind, title) values ('ac000000-0000-0000-0000-0000000000c2', 'group', 'Lifecycle group');
insert into public.conversation_members (conversation_id, user_id, role) values
  ('ac000000-0000-0000-0000-0000000000c1', 'ac000000-0000-0000-0000-0000000000a1', 'member'),
  ('ac000000-0000-0000-0000-0000000000c1', 'ac000000-0000-0000-0000-0000000000a2', 'member'),
  ('ac000000-0000-0000-0000-0000000000c2', 'ac000000-0000-0000-0000-0000000000a1', 'admin'),
  ('ac000000-0000-0000-0000-0000000000c2', 'ac000000-0000-0000-0000-0000000000a2', 'member'),
  ('ac000000-0000-0000-0000-0000000000c2', 'ac000000-0000-0000-0000-0000000000a3', 'member');
insert into public.messages (conversation_id, sender_id, body) values
  ('ac000000-0000-0000-0000-0000000000c1', 'ac000000-0000-0000-0000-0000000000a1', 'Lea private note to Omar'),
  ('ac000000-0000-0000-0000-0000000000c1', 'ac000000-0000-0000-0000-0000000000a2', 'Omar answer to Lea'),
  ('ac000000-0000-0000-0000-0000000000c2', 'ac000000-0000-0000-0000-0000000000a1', 'Lea in the group'),
  ('ac000000-0000-0000-0000-0000000000c2', 'ac000000-0000-0000-0000-0000000000a3', 'Nour secret in the group');

-- A plan Lea hosts that Omar goes to; a plan Omar hosts that Lea goes to.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at) values
  ('ac000000-0000-0000-0000-0000000000e1', 'ac000000-0000-0000-0000-0000000000a1', 'Lea sunset run', 'sport', 'dubai', 'marina', now() + interval '2 days'),
  ('ac000000-0000-0000-0000-0000000000e2', 'ac000000-0000-0000-0000-0000000000a2', 'Omar padel', 'sport', 'dubai', 'marina', now() + interval '3 days');
insert into public.activity_participants (activity_id, user_id, status) values
  ('ac000000-0000-0000-0000-0000000000e1', 'ac000000-0000-0000-0000-0000000000a2', 'going'),
  ('ac000000-0000-0000-0000-0000000000e2', 'ac000000-0000-0000-0000-0000000000a1', 'going')
on conflict do nothing;

-- A community Lea owns with Omar in it; a comment and a like from each.
insert into public.communities (id, city_id, name) values ('ac000000-0000-0000-0000-0000000000f1', 'dubai', 'Lea lifecycle club');
insert into public.community_members (community_id, user_id, role) values
  ('ac000000-0000-0000-0000-0000000000f1', 'ac000000-0000-0000-0000-0000000000a1', 'owner'),
  ('ac000000-0000-0000-0000-0000000000f1', 'ac000000-0000-0000-0000-0000000000a2', 'member')
on conflict (community_id, user_id) do update set role = excluded.role;
insert into public.comments (target_type, target_id, author_id, body) values
  ('activity', 'ac000000-0000-0000-0000-0000000000e2', 'ac000000-0000-0000-0000-0000000000a1', 'Lea comment on padel'),
  ('activity', 'ac000000-0000-0000-0000-0000000000e2', 'ac000000-0000-0000-0000-0000000000a2', 'Omar comment on padel');
insert into public.saves (user_id, target_type, target_id) values
  ('ac000000-0000-0000-0000-0000000000a1', 'activity', 'ac000000-0000-0000-0000-0000000000e2'),
  ('ac000000-0000-0000-0000-0000000000a2', 'activity', 'ac000000-0000-0000-0000-0000000000e2');
insert into public.push_tokens (user_id, token, platform) values
  ('ac000000-0000-0000-0000-0000000000a1', 'ExponentPushToken[lea-lifecycle]', 'ios'),
  ('ac000000-0000-0000-0000-0000000000a2', 'ExponentPushToken[omar-lifecycle]', 'android');

-- ───── Download my data: own data only ─────
select pg_temp.as_user('ac000000-0000-0000-0000-0000000000a1');
create temp table lea_export as select public.export_my_data() as j;
select pg_temp.check((select j -> 'profile' ->> 'first_name' from lea_export) = 'Lealife', 'export: my profile');
select pg_temp.check((select (j -> 'account' ->> 'id')::uuid from lea_export) = 'ac000000-0000-0000-0000-0000000000a1', 'export: my account');
select pg_temp.check((select j::text from lea_export) like '%Lea private note to Omar%', 'export: my messages');
select pg_temp.check((select j::text from lea_export) like '%Lea comment on padel%', 'export: my comments');
select pg_temp.check((select jsonb_array_length(j -> 'activities_created') from lea_export) = 1, 'export: the plans I host');
select pg_temp.check((select j ? 'verification_requests' and j ? 'messages_hidden_for_me' and j ? 'people_skipped' and j ? 'community_notification_settings' from lea_export), 'export: newer tables included');
select pg_temp.check((select j::text not like '%Omar answer to Lea%' from lea_export), 'export: not the other person''s messages, even in my chat');
select pg_temp.check((select j::text not like '%Nour secret in the group%' from lea_export), 'export: not other members'' group messages');
select pg_temp.check((select j::text not like '%Omar comment on padel%' from lea_export), 'export: not other people''s comments');
select pg_temp.check((select j::text not like '%Omarlife%' and j::text not like '%Nourlife%' from lea_export), 'export: not other people''s profiles');
select pg_temp.check((select j::text not like '%omar-lifecycle%' and j::text not like '%lea-lifecycle%' from lea_export), 'export: no push tokens');
select pg_temp.check((select j -> 'profile' ->> 'is_admin' is null from lea_export), 'export: no internal flags');
select pg_temp.as_user('ac000000-0000-0000-0000-0000000000a2');
select pg_temp.check(public.export_my_data()::text not like '%Lea private note to Omar%', 'export: Omar''s export has none of Lea''s messages');
select pg_temp.check(public.export_my_data() -> 'profile' ->> 'first_name' = 'Omarlife', 'export: each member gets their own');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.fails($$select public.export_my_data()$$), 'export: refused without a signed-in member');
select pg_temp.check(not has_function_privilege('anon', 'public.export_my_data()', 'execute'), 'export: not callable by anon');
select pg_temp.check(not has_function_privilege('anon', 'public.delete_my_account()', 'execute') and not has_function_privilege('anon', 'public.my_account_exists()', 'execute'), 'delete / exists: not callable by anon');

-- ───── my_account_exists: own account only, signed in only ─────
select pg_temp.as_user('ac000000-0000-0000-0000-0000000000a1');
select pg_temp.check(public.my_account_exists(), 'my_account_exists: true while the account exists');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.fails($$select public.my_account_exists()$$), 'my_account_exists: refused without a signed-in member');

-- ───── Partial failure: all or nothing, then a retry finishes ─────
-- The last step (removing the sign-in user) fails: nothing at all may be deleted.
create or replace function pg_temp.refuse_delete() returns trigger language plpgsql as $$
begin
  raise exception 'simulated auth outage';
end $$;
create trigger lifecycle_refuse before delete on auth.users for each row execute function pg_temp.refuse_delete();
select pg_temp.as_user('ac000000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($$select public.delete_my_account()$$), 'delete: a failure is reported to the app');
select pg_temp.as_admin();
drop trigger lifecycle_refuse on auth.users;
select pg_temp.check(exists (select 1 from auth.users where id = 'ac000000-0000-0000-0000-0000000000a1'), 'delete failed: the sign-in user is still there');
select pg_temp.check(exists (select 1 from public.profiles where id = 'ac000000-0000-0000-0000-0000000000a1'), 'delete failed: nothing half-deleted (profile kept)');
select pg_temp.check(exists (select 1 from public.messages where body = 'Lea private note to Omar'), 'delete failed: nothing half-deleted (messages kept)');
select pg_temp.check((select role from public.conversation_members where conversation_id = 'ac000000-0000-0000-0000-0000000000c2' and user_id = 'ac000000-0000-0000-0000-0000000000a1') = 'admin', 'delete failed: nothing half-deleted (still in the group)');

-- ───── Storage files left behind are queued for cleanup (own folder only) ─────
-- Run in a transaction that is rolled back: plain PostgreSQL has no storage schema.
begin;
create schema if not exists storage;
create table storage.objects (bucket_id text, name text);
insert into storage.objects values
  ('profile-photos', 'ac000000-0000-0000-0000-0000000000a1/avatar.jpg'),
  ('verifications', 'ac000000-0000-0000-0000-0000000000a1/req.jpg'),
  ('profile-photos', 'ac000000-0000-0000-0000-0000000000a2/avatar.jpg');
select pg_temp.as_user('ac000000-0000-0000-0000-0000000000a1');
select public.delete_my_account();
select pg_temp.as_admin();
select pg_temp.check((select count(*) from private.storage_cleanup where user_id = 'ac000000-0000-0000-0000-0000000000a1') = 2, 'delete: my leftover files are queued for cleanup');
select pg_temp.check(not exists (select 1 from private.storage_cleanup where name like 'ac000000-0000-0000-0000-0000000000a2/%'), 'delete: nobody else''s files are queued');
rollback;
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from auth.users where id = 'ac000000-0000-0000-0000-0000000000a1'), 'storage check rolled back');

-- ───── The real deletion (the retry) ─────
select pg_temp.check(pg_temp.rows_of('ac000000-0000-0000-0000-0000000000a1') > 10, 'before: Lea has rows in many tables');
select pg_temp.as_user('ac000000-0000-0000-0000-0000000000a1');
select public.delete_my_account();
select pg_temp.check(not public.my_account_exists(), 'my_account_exists: false once deleted (the app''s confirmation)');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from auth.users where id = 'ac000000-0000-0000-0000-0000000000a1'), 'delete: the sign-in user is gone');
select pg_temp.check(not exists (select 1 from public.profiles where id = 'ac000000-0000-0000-0000-0000000000a1'), 'delete: the profile is gone');
select pg_temp.check(pg_temp.rows_of('ac000000-0000-0000-0000-0000000000a1') = 0, 'delete: no row anywhere still points at her');
select pg_temp.check(not exists (select 1 from public.messages where body in ('Lea private note to Omar', 'Lea in the group')), 'delete: her messages are gone');
select pg_temp.check(not exists (select 1 from public.comments where body = 'Lea comment on padel'), 'delete: her comments are gone');
select pg_temp.check(not exists (select 1 from public.activities where id = 'ac000000-0000-0000-0000-0000000000e1'), 'delete: the plan she hosted is gone');
select pg_temp.check(not exists (select 1 from public.push_tokens where token = 'ExponentPushToken[lea-lifecycle]'), 'delete: her phone no longer gets notifications');
-- Other people's data stays.
select pg_temp.check((select count(*) from public.profiles where id in ('ac000000-0000-0000-0000-0000000000a2', 'ac000000-0000-0000-0000-0000000000a3')) = 2, 'kept: the other members');
select pg_temp.check(exists (select 1 from auth.users where id = 'ac000000-0000-0000-0000-0000000000a2'), 'kept: their sign-in accounts');
select pg_temp.check(exists (select 1 from public.messages where body = 'Nour secret in the group'), 'kept: other members'' group messages');
select pg_temp.check(exists (select 1 from public.conversations where id = 'ac000000-0000-0000-0000-0000000000c2'), 'kept: the group (others are still in it)');
select pg_temp.check(exists (select 1 from public.conversation_members where conversation_id = 'ac000000-0000-0000-0000-0000000000c2' and role = 'admin'), 'kept: the group still has an admin');
select pg_temp.check(exists (select 1 from public.activities where id = 'ac000000-0000-0000-0000-0000000000e2'), 'kept: Omar''s plan');
select pg_temp.check(exists (select 1 from public.comments where body = 'Omar comment on padel'), 'kept: Omar''s comment');
select pg_temp.check(exists (select 1 from public.saves where user_id = 'ac000000-0000-0000-0000-0000000000a2'), 'kept: Omar''s saves');
select pg_temp.check(exists (select 1 from public.friendships where user_a = 'ac000000-0000-0000-0000-0000000000a2' and user_b = 'ac000000-0000-0000-0000-0000000000a3'), 'kept: friendships between others');
select pg_temp.check(exists (select 1 from public.follows where follower_id = 'ac000000-0000-0000-0000-0000000000a2' and followee_id = 'ac000000-0000-0000-0000-0000000000a3'), 'kept: follows between others');
select pg_temp.check(exists (select 1 from public.push_tokens where token = 'ExponentPushToken[omar-lifecycle]'), 'kept: Omar''s phone');
select pg_temp.check((select role from public.community_members where community_id = 'ac000000-0000-0000-0000-0000000000f1' and user_id = 'ac000000-0000-0000-0000-0000000000a2') = 'owner', 'kept: her community passes to Omar');

-- ───── Retry after success: safe, changes nothing ─────
select pg_temp.as_user('ac000000-0000-0000-0000-0000000000a1');
select public.delete_my_account();
select pg_temp.check(not public.my_account_exists(), 'retry: still reported deleted');
select pg_temp.check(public.export_my_data() -> 'profile' = 'null'::jsonb and public.export_my_data() -> 'account' = 'null'::jsonb, 'a deleted account exports nothing');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.profiles where id in ('ac000000-0000-0000-0000-0000000000a2', 'ac000000-0000-0000-0000-0000000000a3')) = 2, 'retry: other members untouched');
select pg_temp.check(exists (select 1 from public.messages where body = 'Omar answer to Lea') or not exists (select 1 from public.conversations where id = 'ac000000-0000-0000-0000-0000000000c1'), 'retry: nothing else removed');

do $$ begin raise notice 'ok  account lifecycle: delete verified, all-or-nothing, retry-safe; export own data only'; end $$;
