-- Back office (migration 20261023000000_irly_admin_moderation): roles, the
-- moderation inbox, sanctions enforced by the server, the audit log, and
-- scoped reads of reported private messages. Ids are prefixed a0d00000-….
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
  if not coalesce(ok, false) then raise exception 'FAIL admin_moderation: %', label; end if;
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

-- Olga owner, Adam admin (historic flag), Mia moderator, Ugo and Vic members,
-- Wen and Xan in a private chat nobody reported.
insert into auth.users (id) values
  ('a0d00000-0000-0000-0000-0000000000a1'), ('a0d00000-0000-0000-0000-0000000000a2'),
  ('a0d00000-0000-0000-0000-0000000000a3'), ('a0d00000-0000-0000-0000-0000000000a4'),
  ('a0d00000-0000-0000-0000-0000000000a5'), ('a0d00000-0000-0000-0000-0000000000a6'),
  ('a0d00000-0000-0000-0000-0000000000a7');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('a0d00000-0000-0000-0000-0000000000a1', 'Olga', '1990-01-01', 'woman', 'dubai'),
  ('a0d00000-0000-0000-0000-0000000000a2', 'Adam', '1990-01-01', 'man', 'dubai'),
  ('a0d00000-0000-0000-0000-0000000000a3', 'Mia', '1990-01-01', 'woman', 'dubai'),
  ('a0d00000-0000-0000-0000-0000000000a4', 'Ugo', '1990-01-01', 'man', 'dubai'),
  ('a0d00000-0000-0000-0000-0000000000a5', 'Vic', '1990-01-01', 'man', 'dubai'),
  ('a0d00000-0000-0000-0000-0000000000a6', 'Wen', '1990-01-01', 'woman', 'dubai'),
  ('a0d00000-0000-0000-0000-0000000000a7', 'Xan', '1990-01-01', 'man', 'dubai');
alter table public.profiles disable trigger profiles_guard;
update public.profiles set is_admin = true where id = 'a0d00000-0000-0000-0000-0000000000a2';
alter table public.profiles enable trigger profiles_guard;
insert into public.staff_roles (user_id, role) values ('a0d00000-0000-0000-0000-0000000000a1', 'owner');

-- Ugo and Vic chat; Wen and Xan chat (never reported).
insert into public.conversations (id, kind, title) values
  ('a0d00000-0000-0000-0000-0000000000c1', 'group', 'Reported chat'),
  ('a0d00000-0000-0000-0000-0000000000c2', 'group', 'Private chat');
insert into public.conversation_members (conversation_id, user_id) values
  ('a0d00000-0000-0000-0000-0000000000c1', 'a0d00000-0000-0000-0000-0000000000a4'),
  ('a0d00000-0000-0000-0000-0000000000c1', 'a0d00000-0000-0000-0000-0000000000a5'),
  ('a0d00000-0000-0000-0000-0000000000c2', 'a0d00000-0000-0000-0000-0000000000a6'),
  ('a0d00000-0000-0000-0000-0000000000c2', 'a0d00000-0000-0000-0000-0000000000a7');
insert into public.messages (id, conversation_id, sender_id, body, created_at) values
  ('a0d00000-0000-0000-0000-0000000000d1', 'a0d00000-0000-0000-0000-0000000000c1', 'a0d00000-0000-0000-0000-0000000000a4', 'one', now() - interval '9 min'),
  ('a0d00000-0000-0000-0000-0000000000d2', 'a0d00000-0000-0000-0000-0000000000c1', 'a0d00000-0000-0000-0000-0000000000a5', 'two', now() - interval '8 min'),
  ('a0d00000-0000-0000-0000-0000000000d3', 'a0d00000-0000-0000-0000-0000000000c1', 'a0d00000-0000-0000-0000-0000000000a4', 'three', now() - interval '7 min'),
  ('a0d00000-0000-0000-0000-0000000000d4', 'a0d00000-0000-0000-0000-0000000000c1', 'a0d00000-0000-0000-0000-0000000000a4', 'four', now() - interval '6 min'),
  ('a0d00000-0000-0000-0000-0000000000d5', 'a0d00000-0000-0000-0000-0000000000c1', 'a0d00000-0000-0000-0000-0000000000a5', 'THE THREAT', now() - interval '5 min'),
  ('a0d00000-0000-0000-0000-0000000000d6', 'a0d00000-0000-0000-0000-0000000000c1', 'a0d00000-0000-0000-0000-0000000000a4', 'six', now() - interval '4 min'),
  ('a0d00000-0000-0000-0000-0000000000d7', 'a0d00000-0000-0000-0000-0000000000c1', 'a0d00000-0000-0000-0000-0000000000a5', 'seven', now() - interval '3 min'),
  ('a0d00000-0000-0000-0000-0000000000d8', 'a0d00000-0000-0000-0000-0000000000c1', 'a0d00000-0000-0000-0000-0000000000a4', 'eight', now() - interval '2 min'),
  ('a0d00000-0000-0000-0000-0000000000d9', 'a0d00000-0000-0000-0000-0000000000c1', 'a0d00000-0000-0000-0000-0000000000a5', 'nine', now() - interval '1 min'),
  ('a0d00000-0000-0000-0000-0000000000e1', 'a0d00000-0000-0000-0000-0000000000c2', 'a0d00000-0000-0000-0000-0000000000a6', 'secret', now());

-- ───────── Roles ─────────
do $$
begin
  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a4');
  perform pg_temp.check(public.my_staff_role() is null, 'a member has no staff role');
  perform pg_temp.check(pg_temp.fails($q$select public.mod_dashboard()$q$) = '42501', 'a member cannot open the inbox');
  perform pg_temp.check(pg_temp.fails($q$select * from public.mod_cases()$q$) = '42501', 'a member cannot list cases');
  perform pg_temp.check(pg_temp.fails($q$select * from public.mod_users('a')$q$) = '42501', 'a member cannot search members');
  perform pg_temp.check(pg_temp.fails($q$select public.staff_set_role('a0d00000-0000-0000-0000-0000000000a4', 'admin')$q$) = '42501', 'a member cannot make herself admin');
  perform pg_temp.check(not exists (select 1 from public.staff_roles), 'a member cannot read staff roles');
  perform pg_temp.check(pg_temp.fails($q$insert into public.staff_roles (user_id, role) values ('a0d00000-0000-0000-0000-0000000000a4', 'owner')$q$) is not null, 'a member cannot write a staff role');
  perform pg_temp.check(pg_temp.fails($q$insert into public.sanctions (user_id, kind, reason) values ('a0d00000-0000-0000-0000-0000000000a5', 'ban', 'mine')$q$) is not null, 'a member cannot write a sanction');
  perform pg_temp.check(pg_temp.fails($q$update public.profiles set is_admin = true where id = 'a0d00000-0000-0000-0000-0000000000a4'$q$) is not null, 'a member cannot set her own admin flag');
  perform pg_temp.check(pg_temp.fails($q$select private.grant_owner('x@y.z')$q$) = '42501', 'grant_owner is closed to clients');

  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a2');
  perform pg_temp.check(public.my_staff_role() = 'admin', 'the historic is_admin flag reads as admin');
  perform pg_temp.check(pg_temp.fails($q$select public.staff_set_role('a0d00000-0000-0000-0000-0000000000a3', 'moderator')$q$) = '42501', 'an admin cannot grant roles');
  perform pg_temp.fails($q$update public.profiles set is_admin = true where id = 'a0d00000-0000-0000-0000-0000000000a4'$q$);
  perform pg_temp.as_admin();
  perform pg_temp.check(not (select is_admin from public.profiles where id = 'a0d00000-0000-0000-0000-0000000000a4'), 'an admin cannot make someone admin through the flag');
  alter table public.profiles disable trigger profiles_guard;
  perform pg_temp.check(pg_temp.fails($q$select set_config('request.jwt.claim.sub', 'a0d00000-0000-0000-0000-0000000000a2', false); update public.profiles set is_admin = true where id = 'a0d00000-0000-0000-0000-0000000000a4'$q$) = '42501', 'the owner-only lock holds even past the profile guard');
  perform set_config('request.jwt.claim.sub', '', false);
  alter table public.profiles enable trigger profiles_guard;

  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a1');
  perform pg_temp.check(public.my_staff_role() = 'owner', 'the owner reads as owner');
  perform public.staff_set_role('a0d00000-0000-0000-0000-0000000000a3', 'moderator');
  perform pg_temp.check(pg_temp.fails($q$select public.staff_set_role('a0d00000-0000-0000-0000-0000000000a3', 'owner')$q$) = '22023', 'nobody is made owner from the app');
  perform pg_temp.check(pg_temp.fails($q$select public.staff_set_role('a0d00000-0000-0000-0000-0000000000a1', null)$q$) = '22023', 'the owner cannot change her own role');

  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a3');
  perform pg_temp.check(public.my_staff_role() = 'moderator', 'the moderator role is granted');
  perform pg_temp.check(pg_temp.fails($q$select public.staff_set_role('a0d00000-0000-0000-0000-0000000000a3', 'admin')$q$) = '42501', 'a moderator cannot promote herself');
  perform pg_temp.check(pg_temp.fails($q$select * from public.mod_audit()$q$) = '42501', 'a moderator cannot read the audit log');
  perform pg_temp.check((select email from public.mod_users('Ugo') limit 1) is null, 'a moderator does not see emails');
end $$;

select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from private.admin_audit where action = 'role.set'
  and target_user = 'a0d00000-0000-0000-0000-0000000000a3' and actor = 'a0d00000-0000-0000-0000-0000000000a1'
  and details ->> 'to' = 'moderator'), 'a role change is logged with who, whom and what');

-- ───────── Reports, inbox, scoped message reads ─────────
select pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a4');
select public.report('message', null, 'a0d00000-0000-0000-0000-0000000000d5', 'threats', 'He threatened me') is not null as reported \gset
select pg_temp.as_admin();
select m.id as case_id from public.moderation_cases m join public.reports r on r.id = m.report_id
where r.target_id = 'a0d00000-0000-0000-0000-0000000000d5' \gset
select set_config('irly.case', :'case_id', false);

do $$
declare c uuid := current_setting('irly.case')::uuid; n integer; bodies text[];
begin
  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a3');
  perform pg_temp.check((public.mod_dashboard() ->> 'new')::int >= 1, 'the new report counts on the dashboard');
  perform pg_temp.check(exists (select 1 from public.mod_cases('open') where case_id = c and status = 'open'), 'the report is in the inbox as new');
  perform pg_temp.check((public.mod_case(c) -> 'target' ->> 'private') = 'true'
    and (public.mod_case(c)::text not like '%THE THREAT%'), 'the case page never carries the private message');

  -- No reason, no read.
  perform pg_temp.check(pg_temp.fails(format('select * from public.mod_reported_message(%L, %L)', c, '')) = '22023', 'reading a reported message needs a reason');

  select count(*), array_agg(body order by created_at) into n, bodies from public.mod_reported_message(c, 'Threat report, checking context');
  perform pg_temp.check(n = 7, 'the reported message comes with 3 before and 3 after');
  perform pg_temp.check(bodies[4] = 'THE THREAT' and not ('one' = any(bodies)) and not ('nine' = any(bodies)), 'nothing beyond the immediate context');
  perform pg_temp.check(not ('secret' = any(bodies)), 'another conversation never leaks in');

  -- The staff cannot read conversations directly.
  perform pg_temp.check(not exists (select 1 from public.messages where conversation_id = 'a0d00000-0000-0000-0000-0000000000c2'), 'a moderator cannot read an unreported conversation');
  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a2');
  perform pg_temp.check(not exists (select 1 from public.messages where conversation_id = 'a0d00000-0000-0000-0000-0000000000c2'), 'an admin cannot read an unreported conversation');
  perform pg_temp.check(not exists (select 1 from public.messages where conversation_id = 'a0d00000-0000-0000-0000-0000000000c1'), 'an admin cannot read the reported conversation directly either');
end $$;

select pg_temp.as_admin();
select pg_temp.check((select count(*) from private.mod_access_log where case_id = current_setting('irly.case')::uuid
  and actor = 'a0d00000-0000-0000-0000-0000000000a3' and message_id = 'a0d00000-0000-0000-0000-0000000000d5') = 1, 'the read is logged with its reason');

-- A case about something else cannot open a message.
select pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a5');
select public.report('profile', 'a0d00000-0000-0000-0000-0000000000a4', null, 'spam', null) is not null as reported2 \gset
select pg_temp.as_admin();
select m.id as profile_case from public.moderation_cases m join public.reports r on r.id = m.report_id
where r.target_kind = 'profile' and r.target_id = 'a0d00000-0000-0000-0000-0000000000a4' \gset
select pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails(format('select * from public.mod_reported_message(%L, %L)', :'profile_case', 'just curious')) = '42501',
  'a profile case cannot be used to read messages');

-- Statuses and notes.
select public.mod_case_update(:'case_id', 'need_info', 'Asked the reporter for a screenshot');
select pg_temp.check((select status from public.mod_cases() where case_id = :'case_id') = 'need_info', 'a case moves to "more information needed"');
select public.mod_case_note(:'case_id', 'Screenshot received');
select pg_temp.check(jsonb_array_length(public.mod_case(:'case_id') -> 'notes') = 2, 'notes are kept on the case');
select pg_temp.check(pg_temp.fails(format('select public.mod_case_update(%L, %L)', :'case_id', 'banana')) = '22023', 'unknown statuses are refused');
select pg_temp.check(pg_temp.fails(format('select public.mod_remove_content(%L, %L)', :'case_id', 'Threat')) = '42501', 'a moderator cannot take content down');

-- ───────── Sanctions ─────────
do $$
declare s uuid;
begin
  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a3');
  perform pg_temp.check(pg_temp.fails($q$select public.mod_sanction('a0d00000-0000-0000-0000-0000000000a5', 'ban', 'Threats')$q$) = '42501', 'a moderator cannot ban');
  perform pg_temp.check(pg_temp.fails($q$select public.mod_sanction('a0d00000-0000-0000-0000-0000000000a5', 'suspension', 'Threats', 30)$q$) = '42501', 'a moderator cannot suspend for a month');
  perform pg_temp.check(pg_temp.fails($q$select public.mod_sanction('a0d00000-0000-0000-0000-0000000000a2', 'warning', 'Testing')$q$) = '42501', 'a moderator cannot sanction an admin');
  perform pg_temp.check(pg_temp.fails($q$select public.mod_sanction('a0d00000-0000-0000-0000-0000000000a3', 'warning', 'Testing')$q$) = '22023', 'nobody sanctions herself');
  perform pg_temp.check(pg_temp.fails($q$select public.mod_sanction('a0d00000-0000-0000-0000-0000000000a5', 'warning', '')$q$) = '22023', 'a sanction needs a reason');
  perform public.mod_sanction('a0d00000-0000-0000-0000-0000000000a5', 'warning', 'First warning: threats', null, current_setting('irly.case')::uuid);

  -- A warning does not block anything.
  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a5');
  insert into public.messages (conversation_id, sender_id, body) values ('a0d00000-0000-0000-0000-0000000000c1', 'a0d00000-0000-0000-0000-0000000000a5', 'sorry');

  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a2');
  s := public.mod_sanction('a0d00000-0000-0000-0000-0000000000a5', 'ban', 'Repeated threats', null, current_setting('irly.case')::uuid);
  perform pg_temp.check(pg_temp.fails($q$select public.mod_sanction('a0d00000-0000-0000-0000-0000000000a1', 'ban', 'Coup')$q$) = '42501', 'an admin cannot ban the owner');

  -- The ban holds server-side, on direct writes as on RPCs.
  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a5');
  perform pg_temp.check(pg_temp.fails($q$insert into public.messages (conversation_id, sender_id, body) values ('a0d00000-0000-0000-0000-0000000000c1', 'a0d00000-0000-0000-0000-0000000000a5', 'again')$q$) = '42501', 'a banned member cannot send a message');
  perform pg_temp.check((select kind from public.my_sanction()) = 'ban', 'a banned member is told why');
  perform pg_temp.check((select count(*) from public.sanctions) = 2, 'a member sees her own sanctions');
  perform pg_temp.check(public.report('profile', 'a0d00000-0000-0000-0000-0000000000a4', null, 'harassment', 'him too') is not null, 'a banned member can still report');

  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a4');
  perform pg_temp.check(not exists (select 1 from public.sanctions), 'nobody sees someone else''s sanctions');

  -- Only an admin lifts a ban, with a reason; history stays.
  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a3');
  perform pg_temp.check(pg_temp.fails(format('select public.mod_lift_sanction(%L, %L)', s, 'Appeal accepted')) = '42501', 'a moderator cannot lift a ban');
  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a2');
  perform public.mod_lift_sanction(s, 'Appeal accepted');
  perform pg_temp.check((select count(*) from public.mod_user_sanctions('a0d00000-0000-0000-0000-0000000000a5')) = 2, 'a lifted sanction stays in the history');

  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a5');
  insert into public.messages (conversation_id, sender_id, body) values ('a0d00000-0000-0000-0000-0000000000c1', 'a0d00000-0000-0000-0000-0000000000a5', 'back');

  -- Admins take the reported content down.
  perform pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a2');
  perform public.mod_remove_content(current_setting('irly.case')::uuid, 'Threat removed');
  perform pg_temp.check((select status from public.mod_cases() where case_id = current_setting('irly.case')::uuid) = 'actioned', 'taking content down marks the case actioned');
  perform pg_temp.check(exists (select 1 from public.mod_audit() where action = 'sanction.ban')
    and exists (select 1 from public.mod_audit() where action = 'sanction.lifted')
    and exists (select 1 from public.mod_audit() where action = 'content.removed')
    and exists (select 1 from public.mod_audit() where action = 'message.read'), 'every staff action is in the audit log');
end $$;

select pg_temp.as_admin();
select pg_temp.check((select deleted_at is not null from public.messages where id = 'a0d00000-0000-0000-0000-0000000000d5'), 'the threat is removed');

-- An expired suspension stops blocking by itself.
insert into public.sanctions (user_id, kind, reason, ends_at) values ('a0d00000-0000-0000-0000-0000000000a7', 'suspension', 'Old', now() - interval '1 day');
select pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a7');
insert into public.messages (conversation_id, sender_id, body) values ('a0d00000-0000-0000-0000-0000000000c2', 'a0d00000-0000-0000-0000-0000000000a7', 'free again');
select pg_temp.as_admin();
select pg_temp.check(true, 'an expired suspension no longer blocks');

-- Removing a role also clears the historic flag.
select pg_temp.as_user('a0d00000-0000-0000-0000-0000000000a1');
select public.staff_set_role('a0d00000-0000-0000-0000-0000000000a2', null);
select pg_temp.as_admin();
select pg_temp.check(private.staff_role('a0d00000-0000-0000-0000-0000000000a2') is null, 'removing a role removes admin rights for good');
