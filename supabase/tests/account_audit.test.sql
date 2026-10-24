-- Pre-App-Store audit of account deletion (Apple 5.1.1(v)) and of IRLY Maman
-- (20261029200000_irly_account_audit + what delete_my_account already does).
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed af000000-….
--
--   a1 Zoe   woman, Mom mode on, deletes her account
--   a2 Yan   man: goes to Zoe's plans, chats with her, harasses her (reported)
--   a3 Xia   woman: in Zoe's community and in IRLY Girl, reports Zoe's plan
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
-- The SQLSTATE of a refused statement (null when it went through).
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;
-- The message of a refused statement (null when it went through).
create or replace function pg_temp.refusal(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlerrm;
end $$;
-- Rows (in any table) that still point at this person, through any foreign key.
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
insert into auth.users (id) values
  ('af000000-0000-0000-0000-0000000000a1'), ('af000000-0000-0000-0000-0000000000a2'), ('af000000-0000-0000-0000-0000000000a3');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('af000000-0000-0000-0000-0000000000a1', 'Zoeaudit', '1991-02-02', 'woman', 'dubai'),
  ('af000000-0000-0000-0000-0000000000a2', 'Yanaudit', '1989-03-03', 'man', 'dubai'),
  ('af000000-0000-0000-0000-0000000000a3', 'Xiaaudit', '1993-04-04', 'woman', 'dubai');

-- Zoe in IRLY Maman: Mom mode on, one age group (never a name or a birthday).
insert into public.irly_match_onboarding (user_id) values ('af000000-0000-0000-0000-0000000000a1'), ('af000000-0000-0000-0000-0000000000a3');
insert into public.irly_match_profiles (user_id, visible, goals, destination, mom_mode, kids_age_groups) values
  ('af000000-0000-0000-0000-0000000000a1', true, '{new_friends}', 'dubai', true, '{toddler}'),
  ('af000000-0000-0000-0000-0000000000a3', true, '{new_friends}', 'dubai', false, '{}');
insert into public.pro_profiles (user_id, role, job_title, industries, city_id) values
  ('af000000-0000-0000-0000-0000000000a1', 'founder', 'Audit founder', '{tech}', 'dubai');
insert into public.push_tokens (user_id, token, platform) values ('af000000-0000-0000-0000-0000000000a1', 'ExponentPushToken[zoe-audit]', 'ios');
insert into public.follows (follower_id, followee_id) values
  ('af000000-0000-0000-0000-0000000000a2', 'af000000-0000-0000-0000-0000000000a1'),
  ('af000000-0000-0000-0000-0000000000a1', 'af000000-0000-0000-0000-0000000000a3');

-- A private chat Zoe / Yan: Yan's harassing message (reported by Zoe) and a plain one.
insert into public.conversations (id, kind) values ('af000000-0000-0000-0000-0000000000c1', 'direct');
insert into public.conversation_members (conversation_id, user_id, role) values
  ('af000000-0000-0000-0000-0000000000c1', 'af000000-0000-0000-0000-0000000000a1', 'member'),
  ('af000000-0000-0000-0000-0000000000c1', 'af000000-0000-0000-0000-0000000000a2', 'member');
insert into public.messages (id, conversation_id, sender_id, body) values
  ('af000000-0000-0000-0000-000000000101', 'af000000-0000-0000-0000-0000000000c1', 'af000000-0000-0000-0000-0000000000a2', 'Yan audit harassment'),
  ('af000000-0000-0000-0000-000000000102', 'af000000-0000-0000-0000-0000000000c1', 'af000000-0000-0000-0000-0000000000a2', 'Yan audit hello'),
  ('af000000-0000-0000-0000-000000000103', 'af000000-0000-0000-0000-0000000000c1', 'af000000-0000-0000-0000-0000000000a1', 'Zoe audit reply');

-- Two plans Zoe hosts: one upcoming (Yan going, with its chat), one past (Yan went).
insert into public.activities (id, creator_id, title, description, category_id, city_id, area_id, starts_at) values
  ('af000000-0000-0000-0000-0000000000e1', 'af000000-0000-0000-0000-0000000000a1', 'Zoe audit playdate', 'Bring snacks', 'sport', 'dubai', 'marina', now() + interval '2 days'),
  ('af000000-0000-0000-0000-0000000000e2', 'af000000-0000-0000-0000-0000000000a1', 'Zoe audit past brunch', null, 'sport', 'dubai', 'marina', now() + interval '1 hour');
insert into public.activity_participants (activity_id, user_id, status) values
  ('af000000-0000-0000-0000-0000000000e1', 'af000000-0000-0000-0000-0000000000a2', 'going'),
  ('af000000-0000-0000-0000-0000000000e2', 'af000000-0000-0000-0000-0000000000a2', 'going')
on conflict do nothing;
update public.activities set starts_at = now() - interval '3 days', ends_at = now() - interval '3 days' + interval '2 hours'
where id = 'af000000-0000-0000-0000-0000000000e2';
-- The plan's chat (opened when Yan joined).
select id as plan_chat from public.conversations where activity_id = 'af000000-0000-0000-0000-0000000000e1' \gset
insert into public.conversation_members (conversation_id, user_id, role) values
  (:'plan_chat', 'af000000-0000-0000-0000-0000000000a2', 'member')
on conflict do nothing;
insert into public.messages (id, conversation_id, sender_id, body) values
  ('af000000-0000-0000-0000-000000000104', :'plan_chat', 'af000000-0000-0000-0000-0000000000a2', 'Yan audit insult in the plan chat');

-- A community Zoe created and owns, with Xia in it.
insert into public.communities (id, city_id, name, created_by) values
  ('af000000-0000-0000-0000-0000000000f1', 'dubai', 'Zoe audit club', 'af000000-0000-0000-0000-0000000000a1');
insert into public.community_members (community_id, user_id, role) values
  ('af000000-0000-0000-0000-0000000000f1', 'af000000-0000-0000-0000-0000000000a1', 'owner'),
  ('af000000-0000-0000-0000-0000000000f1', 'af000000-0000-0000-0000-0000000000a3', 'member')
on conflict (community_id, user_id) do update set role = excluded.role;

-- Reports: Zoe reports Yan's two messages and his profile; Xia reports Zoe's upcoming plan.
insert into public.reports (id, reporter_id, target_user_id, target_kind, target_id, category) values
  ('af000000-0000-0000-0000-000000000301', 'af000000-0000-0000-0000-0000000000a1', 'af000000-0000-0000-0000-0000000000a2', 'message', 'af000000-0000-0000-0000-000000000101', 'harassment'),
  ('af000000-0000-0000-0000-000000000302', 'af000000-0000-0000-0000-0000000000a1', 'af000000-0000-0000-0000-0000000000a2', 'message', 'af000000-0000-0000-0000-000000000104', 'harassment'),
  ('af000000-0000-0000-0000-000000000303', 'af000000-0000-0000-0000-0000000000a1', 'af000000-0000-0000-0000-0000000000a2', 'profile', 'af000000-0000-0000-0000-0000000000a2', 'harassment'),
  ('af000000-0000-0000-0000-000000000304', 'af000000-0000-0000-0000-0000000000a3', 'af000000-0000-0000-0000-0000000000a1', 'activity', 'af000000-0000-0000-0000-0000000000e1', 'spam');

-- ───── Before: Zoe is findable ─────
select pg_temp.as_user('af000000-0000-0000-0000-0000000000a2');
select pg_temp.check(exists (select 1 from public.search_all('Zoeaudit') where kind = 'person' and id = 'af000000-0000-0000-0000-0000000000a1'),
  'before: Yan finds Zoe in search');
select pg_temp.as_user('af000000-0000-0000-0000-0000000000a3');
select pg_temp.check(exists (select 1 from public.girl_circle('dubai', null, true) where user_id = 'af000000-0000-0000-0000-0000000000a1' and kids_age_groups = '{toddler}'),
  'before: Xia sees Zoe among the moms (an age group only)');
select pg_temp.as_user('af000000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.fails($$select * from public.girl_circle('dubai', null, true)$$) is not null, 'Maman: a man gets no mom (girl_circle refused)');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.rows_of('af000000-0000-0000-0000-0000000000a1') > 10, 'before: Zoe has rows in many tables');

-- ───── Zoe deletes her account ─────
select pg_temp.as_user('af000000-0000-0000-0000-0000000000a1');
select public.delete_my_account();
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from auth.users where id = 'af000000-0000-0000-0000-0000000000a1'), 'delete: the sign-in account is gone (no new sign-in possible)');
select pg_temp.check(not exists (select 1 from public.profiles where id = 'af000000-0000-0000-0000-0000000000a1'), 'delete: the profile is gone, not hidden');
select pg_temp.check(pg_temp.rows_of('af000000-0000-0000-0000-0000000000a1') = 0, 'delete: no row anywhere points at her');
select pg_temp.check(not exists (select 1 from public.irly_match_profiles where user_id = 'af000000-0000-0000-0000-0000000000a1')
  and not exists (select 1 from public.pro_profiles where user_id = 'af000000-0000-0000-0000-0000000000a1')
  and not exists (select 1 from public.push_tokens where token = 'ExponentPushToken[zoe-audit]'),
  'delete: IRLY Girl / Maman profile (children''s age group included), pro profile and push token gone');
select pg_temp.check(not exists (select 1 from public.activities where id in ('af000000-0000-0000-0000-0000000000e1', 'af000000-0000-0000-0000-0000000000e2')),
  'delete: the plans she created are gone');
select pg_temp.check((select count(*) from public.notifications where user_id = 'af000000-0000-0000-0000-0000000000a2' and kind = 'ACTIVITY_UPDATED'
  and payload ->> 'change' = 'deleted' and payload ->> 'activity_id' = 'af000000-0000-0000-0000-0000000000e1') = 1,
  'delete: Yan, going to her upcoming plan, is told once');
select pg_temp.check(not exists (select 1 from public.notifications where user_id = 'af000000-0000-0000-0000-0000000000a2'
  and payload ->> 'activity_id' = 'af000000-0000-0000-0000-0000000000e2'), 'delete: nobody is told about a plan already past');

-- Reported words survive, whoever wrote them; nothing else is kept.
select pg_temp.check((select body from private.removed_content where source = 'messages' and id = 'af000000-0000-0000-0000-000000000101') = 'Yan audit harassment',
  'kept for moderators: Yan''s reported message from the deleted private chat');
select pg_temp.check((select body from private.removed_content where source = 'messages' and id = 'af000000-0000-0000-0000-000000000104') = 'Yan audit insult in the plan chat',
  'kept for moderators: Yan''s reported message from the deleted plan''s chat');
select pg_temp.check((select body from private.removed_content where source = 'activities' and id = 'af000000-0000-0000-0000-0000000000e1') = E'Zoe audit playdate\nBring snacks',
  'kept for moderators: Zoe''s reported plan');
select pg_temp.check(not exists (select 1 from private.removed_content where id in ('af000000-0000-0000-0000-000000000102', 'af000000-0000-0000-0000-000000000103', 'af000000-0000-0000-0000-0000000000e2')),
  'not kept: messages and plans nobody reported');
select pg_temp.check((select count(*) from public.reports where id::text like 'af000000-0000-0000-0000-00000000030%' and (reporter_id is null or reporter_id = 'af000000-0000-0000-0000-0000000000a3')) = 4
  and (select reporter_id from public.reports where id = 'af000000-0000-0000-0000-000000000303') is null,
  'reports kept, the ones she filed without her id');

-- Other members' data is intact.
select pg_temp.check((select count(*) from public.profiles where id in ('af000000-0000-0000-0000-0000000000a2', 'af000000-0000-0000-0000-0000000000a3')) = 2
  and (select count(*) from auth.users where id in ('af000000-0000-0000-0000-0000000000a2', 'af000000-0000-0000-0000-0000000000a3')) = 2, 'kept: the other members');
select pg_temp.check(exists (select 1 from public.communities where id = 'af000000-0000-0000-0000-0000000000f1' and deleted_at is null and created_by is null),
  'kept: her community lives on, without her id');
select pg_temp.check((select role from public.community_members where community_id = 'af000000-0000-0000-0000-0000000000f1' and user_id = 'af000000-0000-0000-0000-0000000000a3') = 'owner',
  'kept: Xia now owns it');
select pg_temp.check(exists (select 1 from public.irly_match_profiles where user_id = 'af000000-0000-0000-0000-0000000000a3'), 'kept: Xia''s IRLY Girl profile');

-- Nobody finds her any more.
select pg_temp.as_user('af000000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.search_all('Zoeaudit') where kind = 'person'), 'after: search no longer finds her');
select pg_temp.check(not exists (select 1 from public.profiles where id = 'af000000-0000-0000-0000-0000000000a1'), 'after: her profile cannot be read');
select pg_temp.check(not exists (select 1 from public.map_people('dubai') where user_id = 'af000000-0000-0000-0000-0000000000a1'), 'after: not on the people map');
select pg_temp.as_user('af000000-0000-0000-0000-0000000000a3');
select pg_temp.check(not exists (select 1 from public.girl_circle('dubai', null, true) where user_id = 'af000000-0000-0000-0000-0000000000a1'), 'after: not among the moms');

-- Her old session (a token issued before the deletion): every protected call fails.
select pg_temp.as_user('af000000-0000-0000-0000-0000000000a1');
select pg_temp.check(not public.my_account_exists(), 'old session: the server says the account no longer exists');
select pg_temp.check(pg_temp.fails($$select public.create_community('Zoe audit comeback', 'dubai')$$) is not null, 'old session: cannot create a community');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at)
  values ('af000000-0000-0000-0000-0000000000a1', 'Zoe audit ghost plan', 'sport', 'dubai', 'marina', now() + interval '1 day')$$) is not null, 'old session: cannot create a plan');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, body)
  values ('af000000-0000-0000-0000-0000000000c1', 'af000000-0000-0000-0000-0000000000a1', 'ghost')$$) is not null, 'old session: cannot write a message');
select pg_temp.check(pg_temp.fails($$insert into public.profiles (id, first_name, birthdate, gender, city_id)
  values ('af000000-0000-0000-0000-0000000000a1', 'Zoeaudit', '1991-02-02', 'woman', 'dubai')$$) is not null, 'old session: cannot bring the profile back');
select pg_temp.check(pg_temp.fails($$select * from public.girl_circle('dubai')$$) is not null, 'old session: IRLY Girl is closed');
select pg_temp.as_admin();

-- ───── IRLY Mom Community: the only « IRLY Mom Community » is IRLY's own ─────
select pg_temp.check((select array_agg(distinct name) from public.communities where official and topic = 'moms' and parent_id is null) = array['IRLY Mom Community'],
  'IRLY Mom Community: the official community is named exactly « IRLY Mom Community »');
select pg_temp.as_user('af000000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.refusal($$select public.create_community('IRLY Mom Community', 'dubai', null, null, null, true)$$) = 'this name is reserved for an IRLY community',
  'a member cannot create another « IRLY Mom Community »');
select pg_temp.check(pg_temp.refusal($$select public.create_community('  irly   mom  COMMUNITY ', 'dubai', null, null, null, true)$$) = 'this name is reserved for an IRLY community',
  'not with other capitals or spaces either');
select pg_temp.check(pg_temp.refusal($$update public.communities set name = 'IRLY Sport' where id = 'af000000-0000-0000-0000-0000000000f1'$$) = 'this name is reserved for an IRLY community',
  'nor rename hers to an official name');
select pg_temp.check(pg_temp.fails($$select public.create_community('Mamans de la Marina audit', 'dubai', null, null, null, true)$$) is null,
  'a mom community with its own name is created as before');
select pg_temp.check(pg_temp.fails($$update public.communities set tagline = 'Still ours' where id = 'af000000-0000-0000-0000-0000000000f1'$$) is null,
  'editing a community without touching its name works as before');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.communities where official and topic = 'moms' and city_id = 'dubai' and parent_id is null) = 1,
  'IRLY Mom Community: still one in Dubai (nothing made by itself)');
select pg_temp.check((select count(*) from public.communities where private.community_name_key(name) = 'irly mom community' and not official) = 0,
  'no member community is called « IRLY Mom Community »');
