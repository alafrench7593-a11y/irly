-- QA fixes for sign-in and the account lifecycle (migration
-- 20261103200000_irly_qa_fix_auth): flags follow an e-mail change and the
-- deletion (auth-02), a suspension survives a deletion until it ends
-- (auth-08), a deleted account's ban can be lifted (auth-03), IRLY Girl
-- reinstatement holds after another deletion (auth-04), support requests
-- are anonymised (auth-05), first names (auth-06), stale selfie gestures
-- (auth-09) and the Sign in with Apple revoke queue (IOS-01).
-- Runs after irly_test.sql on the same database (scripts/test-db.sh); ids
-- use the prefix ac100000-….
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
    raise exception 'FAIL auth_qa_fixes: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

-- The error message of a statement (null when it succeeds).
create or replace function pg_temp.error_of(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlerrm;
end $$;

-- Signs `uid` up (profile created as that member): the error, or null.
create or replace function pg_temp.signup(uid uuid, name text, gender text default 'man') returns text language plpgsql as $$
declare e text;
begin
  perform pg_temp.as_user(uid);
  e := pg_temp.error_of(format($q$insert into public.profiles (id, first_name, birthdate, gender, city_id) values (%L, %L, '1990-01-01', %L, 'dubai')$q$, uid, name, gender));
  perform pg_temp.as_admin();
  return e;
end $$;

select pg_temp.as_admin();
-- The local auth shim has no e-mail or phone columns; Supabase has both.
alter table auth.users add column if not exists email text;
alter table auth.users add column if not exists phone text;
set irly_test.unverified = 'on';

-- An admin for the back-office calls.
insert into auth.users (id, email) values ('ac100000-0000-0000-0000-0000000000a9', 'qa.admin@example.com');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values ('ac100000-0000-0000-0000-0000000000a9', 'Adah', '1985-01-01', 'woman', 'dubai');
insert into public.staff_roles (user_id, role) values ('ac100000-0000-0000-0000-0000000000a9', 'admin');

-- ───────── auth-02: e-mail changed after the ban, then deleted ─────────
insert into auth.users (id, email) values ('ac100000-0000-0000-0000-000000000001', 'evader@example.com');
select pg_temp.check(pg_temp.signup('ac100000-0000-0000-0000-000000000001', 'Evan') is null, 'auth-02: the member signs up');
insert into public.sanctions (user_id, kind, reason) values ('ac100000-0000-0000-0000-000000000001', 'ban', 'qa ban');
update auth.users set email = 'evader.new@example.com' where id = 'ac100000-0000-0000-0000-000000000001';
select pg_temp.check(exists (select 1 from private.flagged_identities where source_user = 'ac100000-0000-0000-0000-000000000001'
    and flag = 'ban' and lifted_at is null and hash = encode(sha256(convert_to('evader.new@example.com', 'UTF8')), 'hex')),
  'auth-02: the new e-mail is flagged as soon as it changes');
select pg_temp.as_user('ac100000-0000-0000-0000-000000000001');
select public.delete_my_account();
select pg_temp.as_admin();
insert into auth.users (id, email) values
  ('ac100000-0000-0000-0000-000000000002', 'evader.new@example.com'),
  ('ac100000-0000-0000-0000-000000000003', 'evader@example.com');
select pg_temp.check(pg_temp.signup('ac100000-0000-0000-0000-000000000002', 'Evan') = 'your account is suspended',
  'auth-02: the e-mail used at deletion cannot sign up again');
select pg_temp.check(pg_temp.signup('ac100000-0000-0000-0000-000000000003', 'Evan') = 'your account is suspended',
  'auth-02: nor the e-mail the ban was given to');

-- Flagged at deletion even when the e-mail changed without the trigger (an older row, a direct write).
insert into auth.users (id, email) values ('ac100000-0000-0000-0000-000000000004', 'quiet@example.com');
select pg_temp.check(pg_temp.signup('ac100000-0000-0000-0000-000000000004', 'Quinn') is null, 'auth-02: a second member signs up');
insert into public.sanctions (user_id, kind, reason) values ('ac100000-0000-0000-0000-000000000004', 'ban', 'qa ban');
alter table auth.users disable trigger irly_identity_changed;
update auth.users set email = 'quiet.new@example.com' where id = 'ac100000-0000-0000-0000-000000000004';
alter table auth.users enable trigger irly_identity_changed;
delete from auth.users where id = 'ac100000-0000-0000-0000-000000000004';
insert into auth.users (id, email) values ('ac100000-0000-0000-0000-000000000005', 'quiet.new@example.com');
select pg_temp.check(pg_temp.signup('ac100000-0000-0000-0000-000000000005', 'Quinn') = 'your account is suspended',
  'auth-02: the identity at the moment of deletion is flagged');

-- ───────── auth-03: lifting the ban of a deleted account ─────────
select pg_temp.as_user('ac100000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.error_of($q$select public.identity_lift('evader.new@example.com', null, 'ban', 'appeal accepted')$q$) is not null,
  'auth-03: a member cannot lift a flag');
select pg_temp.as_user('ac100000-0000-0000-0000-0000000000a9');
select pg_temp.check(pg_temp.error_of($q$select public.identity_lift('evader.new@example.com', null, 'ban', '')$q$) is not null,
  'auth-03: an admin gives a reason');
select pg_temp.check(public.identity_lift('Evader.New@example.com', null, 'ban', 'appeal accepted') > 0,
  'auth-03: an admin lifts the ban of the deleted account by its e-mail');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from private.flagged_identities where source_user = 'ac100000-0000-0000-0000-000000000001' and lifted_at is null),
  'auth-03: every flag of that account is lifted (the older e-mail too)');
select pg_temp.check(exists (select 1 from private.admin_audit where action = 'identity.lifted' and details::text !~* 'example'),
  'auth-03: journaled, without the address');
select pg_temp.check(pg_temp.signup('ac100000-0000-0000-0000-000000000003', 'Evan') is null,
  'auth-03: the address may sign up again');
select pg_temp.check(pg_temp.signup('ac100000-0000-0000-0000-000000000005', 'Quinn') = 'your account is suspended',
  'auth-03: another banned identity is untouched');

-- ───────── auth-08: a suspension outlives the deletion until it ends ─────────
insert into auth.users (id, email) values
  ('ac100000-0000-0000-0000-000000000011', 'paused@example.com'),
  ('ac100000-0000-0000-0000-000000000013', 'was.paused@example.com'),
  ('ac100000-0000-0000-0000-000000000015', 'pardoned@example.com');
select pg_temp.signup('ac100000-0000-0000-0000-000000000011', 'Sue');
select pg_temp.signup('ac100000-0000-0000-0000-000000000013', 'Sam');
select pg_temp.signup('ac100000-0000-0000-0000-000000000015', 'Pam');
insert into public.sanctions (user_id, kind, reason, ends_at) values
  ('ac100000-0000-0000-0000-000000000011', 'suspension', 'qa suspension', now() + interval '30 days'),
  ('ac100000-0000-0000-0000-000000000013', 'suspension', 'qa suspension', now() + interval '30 days'),
  ('ac100000-0000-0000-0000-000000000015', 'suspension', 'qa suspension', now() + interval '30 days');
-- One ends early (it passed), one is lifted by a moderator.
update public.sanctions set ends_at = now() - interval '1 minute' where user_id = 'ac100000-0000-0000-0000-000000000013';
update public.sanctions set lifted_at = now(), lift_reason = 'qa lift' where user_id = 'ac100000-0000-0000-0000-000000000015';
select pg_temp.as_user('ac100000-0000-0000-0000-000000000011');
select public.delete_my_account();
select pg_temp.as_admin();
delete from auth.users where id in ('ac100000-0000-0000-0000-000000000013', 'ac100000-0000-0000-0000-000000000015');
insert into auth.users (id, email) values
  ('ac100000-0000-0000-0000-000000000012', 'paused@example.com'),
  ('ac100000-0000-0000-0000-000000000014', 'was.paused@example.com'),
  ('ac100000-0000-0000-0000-000000000016', 'pardoned@example.com');
select pg_temp.check(pg_temp.signup('ac100000-0000-0000-0000-000000000012', 'Sue') = 'your account is suspended',
  'auth-08: a suspended member who deletes the account cannot sign up again while it lasts');
select pg_temp.check(pg_temp.signup('ac100000-0000-0000-0000-000000000014', 'Sam') is null,
  'auth-08: once the suspension has ended, the address signs up');
select pg_temp.check(pg_temp.signup('ac100000-0000-0000-0000-000000000016', 'Pam') is null,
  'auth-08: a lifted suspension does not follow the address');
-- The end date is kept: after it, the address is free.
update private.flagged_identities set until = now() - interval '1 second'
where source_user = 'ac100000-0000-0000-0000-000000000011' and flag = 'suspension';
select pg_temp.check(pg_temp.signup('ac100000-0000-0000-0000-000000000012', 'Sue') is null,
  'auth-08: after the end of the suspension, the address signs up');

-- ───────── auth-04: IRLY Girl reinstatement holds ─────────
insert into auth.users (id, email) values ('ac100000-0000-0000-0000-000000000021', 'wren@example.com');
select pg_temp.signup('ac100000-0000-0000-0000-000000000021', 'Wren', 'woman');
insert into public.girl_suspensions (user_id, reason) values ('ac100000-0000-0000-0000-000000000021', 'qa girl suspension');
delete from auth.users where id = 'ac100000-0000-0000-0000-000000000021';
insert into auth.users (id, email) values ('ac100000-0000-0000-0000-000000000022', 'wren@example.com');
select pg_temp.signup('ac100000-0000-0000-0000-000000000022', 'Wren', 'woman');
select pg_temp.check(exists (select 1 from public.girl_suspensions where user_id = 'ac100000-0000-0000-0000-000000000022'),
  'auth-04: the withdrawal is carried to the new account');
select pg_temp.as_user('ac100000-0000-0000-0000-0000000000a9');
select public.girl_reinstate('ac100000-0000-0000-0000-000000000022');
select pg_temp.as_admin();
delete from auth.users where id = 'ac100000-0000-0000-0000-000000000022';
insert into auth.users (id, email) values ('ac100000-0000-0000-0000-000000000023', 'wren@example.com');
select pg_temp.signup('ac100000-0000-0000-0000-000000000023', 'Wren', 'woman');
select pg_temp.as_user('ac100000-0000-0000-0000-000000000023');
select pg_temp.check(public.my_girl_status() <> 'suspended', 'auth-04: reinstated, she is not suspended again after another deletion');
select pg_temp.as_admin();

-- ───────── auth-05: support requests lose the address and the text ─────────
insert into auth.users (id, email) values ('ac100000-0000-0000-0000-000000000031', 'Helpme@example.com');
select pg_temp.signup('ac100000-0000-0000-0000-000000000031', 'Hana');
select pg_temp.as_user('ac100000-0000-0000-0000-000000000031');
insert into public.support_requests (user_id, kind, body, contact) values (auth.uid(), 'problem', 'my private problem text', 'helpme@example.com');
select pg_temp.as_admin();
insert into public.support_requests (user_id, kind, body, contact) values (null, 'question', 'sent from the website form', 'helpme@example.com');
insert into public.support_requests (user_id, kind, body, contact) values (null, 'question', 'someone else entirely', 'other.person@example.com');
select pg_temp.as_user('ac100000-0000-0000-0000-000000000031');
select public.delete_my_account();
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.support_requests where contact ilike 'helpme@example.com' or body in ('my private problem text', 'sent from the website form')),
  'auth-05: the deleted member''s requests keep neither address nor text');
select pg_temp.check(exists (select 1 from public.support_requests where contact = 'other.person@example.com' and body = 'someone else entirely'),
  'auth-05: other people''s requests are untouched');

-- ───────── auth-06: first names ─────────
insert into auth.users (id) values ('ac100000-0000-0000-0000-000000000041');
select pg_temp.check(pg_temp.signup('ac100000-0000-0000-0000-000000000041', 'IRLY Team') = 'choose another first name',
  'auth-06: a signup cannot be called IRLY Team');
select pg_temp.check(pg_temp.signup('ac100000-0000-0000-0000-000000000041', 'Nour') is null, 'auth-06: a plain name signs up');
select pg_temp.as_user('ac100000-0000-0000-0000-000000000041');
select pg_temp.check(pg_temp.error_of($q$update public.profiles set first_name = '   ' where id = auth.uid()$q$) is not null, 'auth-06: blank name refused');
select pg_temp.check(pg_temp.error_of(format($q$update public.profiles set first_name = %L where id = auth.uid()$q$, U&'\200B')) is not null, 'auth-06: zero-width name refused');
select pg_temp.check(pg_temp.error_of(format($q$update public.profiles set first_name = %L where id = auth.uid()$q$, E'Wen\nAdmin')) is not null, 'auth-06: a line break refused');
select pg_temp.check(pg_temp.error_of(format($q$update public.profiles set first_name = %L where id = auth.uid()$q$, U&'\202Enimda IRLY')) is not null, 'auth-06: a bidi override refused');
select pg_temp.check(pg_temp.error_of($q$update public.profiles set first_name = 'IRLY Team' where id = auth.uid()$q$) is not null, 'auth-06: IRLY Team refused');
select pg_temp.check(pg_temp.error_of($q$update public.profiles set first_name = 'admin' where id = auth.uid()$q$) is not null, 'auth-06: Admin refused');
select pg_temp.check(pg_temp.error_of(format($q$update public.profiles set first_name = %L where id = auth.uid()$q$, U&'Zo\00EB \+01F600')) is null, 'auth-06: accents and emoji accepted');
select pg_temp.check(pg_temp.error_of(format($q$update public.profiles set first_name = %L where id = auth.uid()$q$, U&'\0645\0647\0631\200C\0646\0627\0632')) is null, 'auth-06: a ZWNJ inside a Persian name accepted');
select pg_temp.check(pg_temp.error_of($q$update public.profiles set first_name = 'IRLY member' where id = auth.uid()$q$) is null, 'auth-06: the app default IRLY member accepted');
update public.profiles set first_name = '  Nour  ' where id = auth.uid();
select pg_temp.check((select first_name from public.profiles where id = auth.uid()) = 'Nour', 'auth-06: spaces around the name are trimmed');
select pg_temp.as_user('ac100000-0000-0000-0000-0000000000a9');
select pg_temp.check(pg_temp.error_of($q$update public.profiles set first_name = 'IRLY Team' where id = auth.uid()$q$) is null, 'auth-06: IRLY staff may use the team name');
update public.profiles set first_name = 'Adah' where id = auth.uid();
select pg_temp.as_admin();

-- ───────── auth-09: only the current gesture ─────────
insert into auth.users (id) values ('ac100000-0000-0000-0000-000000000051');
select pg_temp.signup('ac100000-0000-0000-0000-000000000051', 'Vera', 'woman');
insert into public.verification_requests (id, user_id, gesture, created_at) values
  ('ac100000-0000-0000-0000-0000000000e1', 'ac100000-0000-0000-0000-000000000051', 'peace', now() - interval '3 days'),
  ('ac100000-0000-0000-0000-0000000000e2', 'ac100000-0000-0000-0000-000000000051', 'thumb', now() - interval '20 minutes'),
  ('ac100000-0000-0000-0000-0000000000e3', 'ac100000-0000-0000-0000-000000000051', 'nose', now() - interval '2 minutes');
select pg_temp.as_user('ac100000-0000-0000-0000-000000000051');
select pg_temp.check(pg_temp.error_of($q$select public.submit_verification('ac100000-0000-0000-0000-0000000000e1', 'ac100000-0000-0000-0000-000000000051/s.jpg')$q$)
    = 'start again: this request is no longer open', 'auth-09: a gesture from three days ago is refused');
select pg_temp.check(pg_temp.error_of($q$select public.submit_verification('ac100000-0000-0000-0000-0000000000e2', 'ac100000-0000-0000-0000-000000000051/s.jpg')$q$)
    = 'start again: this request is no longer open', 'auth-09: a gesture replaced by a newer one is refused');
select pg_temp.check(pg_temp.error_of($q$select public.submit_verification('ac100000-0000-0000-0000-0000000000e3', 'ac100000-0000-0000-0000-000000000051/s.jpg')$q$) is null,
  'auth-09: the current gesture is accepted');
select pg_temp.as_admin();

-- ───────── IOS-01: Sign in with Apple tokens are revoked at deletion ─────────
select pg_temp.check(not has_function_privilege('authenticated', 'public.apple_token_save(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.apple_revoke_take(integer)', 'execute')
    and has_function_privilege('service_role', 'public.apple_revoke_take(integer)', 'execute'),
  'IOS-01: only the service role (the Edge Function) touches Apple tokens');
select pg_temp.check(not has_table_privilege('authenticated', 'private.apple_tokens', 'select'), 'IOS-01: the API roles cannot read the tokens');
insert into auth.users (id, email) values ('ac100000-0000-0000-0000-000000000061', 'apple.user@privaterelay.appleid.com');
select pg_temp.signup('ac100000-0000-0000-0000-000000000061', 'Abel');
select public.apple_token_save('ac100000-0000-0000-0000-000000000061', 'r.apple-refresh-token-qa');
select pg_temp.as_user('ac100000-0000-0000-0000-000000000061');
select public.delete_my_account();
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from private.apple_tokens where user_id = 'ac100000-0000-0000-0000-000000000061')
    and exists (select 1 from private.apple_revoke_queue where refresh_token = 'r.apple-refresh-token-qa'),
  'IOS-01: the deleted account''s Apple token waits on the revoke queue');
select pg_temp.check((select count(*) from public.apple_revoke_take(5) t where t.refresh_token = 'r.apple-refresh-token-qa') = 1,
  'IOS-01: the Edge Function takes it');
select public.apple_revoke_done((select id from private.apple_revoke_queue where refresh_token = 'r.apple-refresh-token-qa'), true, null);
select pg_temp.check(not exists (select 1 from private.apple_revoke_queue where refresh_token = 'r.apple-refresh-token-qa'),
  'IOS-01: once revoked it is forgotten');

-- ───────── Clean up ─────────
select pg_temp.as_admin();
delete from public.support_requests where contact = 'other.person@example.com';
delete from public.staff_roles where user_id::text like 'ac100000-%';
delete from auth.users where id::text like 'ac100000-%';
delete from private.flagged_identities where source_user::text like 'ac100000-%';
alter table auth.users drop column if exists phone;
alter table auth.users drop column if exists email;
reset irly_test.unverified;
