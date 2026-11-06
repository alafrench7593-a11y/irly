-- QA fixes for the communities (migration 20261108400000_irly_community_qa_fixes):
-- owner succession on account deletion, official texts stay IRLY's.
-- TEST accounts only, ids prefixed d0c10000-…. Everything is rolled back.
\set ON_ERROR_STOP 1

begin;

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
    raise exception 'FAIL community_qa_fixes: %', label;
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
insert into auth.users (id) values
  ('d0c10000-0000-0000-0000-0000000000a1'), ('d0c10000-0000-0000-0000-0000000000a2'),
  ('d0c10000-0000-0000-0000-0000000000a3'), ('d0c10000-0000-0000-0000-0000000000a4');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('d0c10000-0000-0000-0000-0000000000a1', 'Del', '1990-01-01', 'man', 'dubai'),
  ('d0c10000-0000-0000-0000-0000000000a2', 'Kev', '1991-01-01', 'man', 'dubai'),
  ('d0c10000-0000-0000-0000-0000000000a3', 'Cleo', '1992-01-01', 'woman', 'dubai'),
  ('d0c10000-0000-0000-0000-0000000000a4', 'Max', '1993-01-01', 'man', 'dubai');

-- ───────── 1. Owner succession: the co-admin, not the older moderator ─────────
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a1');
select public.create_community('d0c Chess Club', 'dubai', 'Chess on Fridays', null, 'culture', false) as club \gset
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a2');
select public.join_community(:'club');
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a3');
select public.join_community(:'club');
select pg_temp.as_admin();
update public.community_members set role = 'moderator', joined_at = now() - interval '30 days' where community_id = :'club' and user_id = 'd0c10000-0000-0000-0000-0000000000a2';
update public.community_members set role = 'co_admin', permissions = '{"members": true}', joined_at = now() - interval '1 day'
  where community_id = :'club' and user_id = 'd0c10000-0000-0000-0000-0000000000a3';
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a1');
select public.delete_my_account();
select pg_temp.as_admin();
select pg_temp.check((select role from public.community_members where community_id = :'club' and user_id = 'd0c10000-0000-0000-0000-0000000000a3') = 'owner',
  'the co-admin becomes owner, before an older moderator');
select pg_temp.check((select role from public.community_members where community_id = :'club' and user_id = 'd0c10000-0000-0000-0000-0000000000a2') = 'moderator',
  'the moderator stays moderator');
select pg_temp.check((select permissions from public.community_members where community_id = :'club' and user_id = 'd0c10000-0000-0000-0000-0000000000a3') = '{}',
  'the new owner keeps no co-admin limits');
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'd0c10000-0000-0000-0000-0000000000a3' and kind = 'COMMUNITY_OWNERSHIP'
    and payload ->> 'community_id' = :'club'), 'the new owner is told');
select pg_temp.check(exists (select 1 from public.community_audit where community_id = :'club' and action = 'ownership.succession'
    and target_user = 'd0c10000-0000-0000-0000-0000000000a3' and actor is null), 'the journal records the succession, with no actor');
select pg_temp.check(not exists (select 1 from public.profiles where id = 'd0c10000-0000-0000-0000-0000000000a1'), 'the account is gone');
select pg_temp.check(exists (select 1 from public.conversation_members cvm join public.conversations v on v.id = cvm.conversation_id
    where v.community_id = :'club' and cvm.user_id = 'd0c10000-0000-0000-0000-0000000000a3' and cvm.role = 'admin'), 'the new owner runs the chat');

-- ───────── 2. Official texts: refused to a co-admin writing the row ─────────
select id as sport from public.communities where official and topic = 'sport' and city_id = 'dubai' and parent_id is null \gset
insert into public.community_members (community_id, user_id, role, permissions)
values (:'sport', 'd0c10000-0000-0000-0000-0000000000a4', 'co_admin', '{"settings": true}');
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a4');
select pg_temp.check(pg_temp.fails(format('update public.communities set tagline = %L where id = %L', 'direct', :'sport')) = '42501',
  'a co-admin cannot rewrite an official tagline directly');
select pg_temp.check(pg_temp.fails(format('update public.communities set description = %L where id = %L', 'direct text here', :'sport')) = '42501',
  '… nor its description');
select pg_temp.as_admin();
select pg_temp.check((select tagline from public.communities where id = :'sport') <> 'direct', 'the official tagline is unchanged');
-- A member's own community: its owner still edits it.
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails(format('select public.community_update_info(%L, null, %L, null, null)', :'club', 'Chess and coffee on Fridays')) is null,
  'an owner still edits their own community');
select pg_temp.as_admin();
select pg_temp.check((select tagline from public.communities where id = :'club') = 'Chess and coffee on Fridays', '… and the text is saved');
-- The official sync still runs.
select pg_temp.check(private.ensure_official_communities() >= 0, 'the official sync is not blocked');

rollback;
