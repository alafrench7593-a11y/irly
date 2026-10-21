-- Back office, completed (migrations 20261027200000_irly_admin_console and
-- 20261027200100_irly_report_email): who may call what, the overview, member
-- sheet, suspension until a date and its enforcement, account deletion
-- through the member's own pipeline, content and community holds, photos,
-- reports (duplicates, related cases), the report email outbox, settings,
-- the append-only journal and role escalation attempts. Ids a0e00000-….
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
  if not coalesce(ok, false) then raise exception 'FAIL admin_console: %', label; end if;
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

-- e1 owner, e2 admin, e3 moderator, e4 content, e5 Ugo (reported), e6/e7/e8 long-standing members, e9 to be deleted.
insert into auth.users (id) values
  ('a0e00000-0000-0000-0000-0000000000e1'), ('a0e00000-0000-0000-0000-0000000000e2'), ('a0e00000-0000-0000-0000-0000000000e3'),
  ('a0e00000-0000-0000-0000-0000000000e4'), ('a0e00000-0000-0000-0000-0000000000e5'), ('a0e00000-0000-0000-0000-0000000000e6'),
  ('a0e00000-0000-0000-0000-0000000000e7'), ('a0e00000-0000-0000-0000-0000000000e8'), ('a0e00000-0000-0000-0000-0000000000e9');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('a0e00000-0000-0000-0000-0000000000e1', 'Ophelie', '1990-01-01', 'woman', 'dubai'),
  ('a0e00000-0000-0000-0000-0000000000e2', 'Arno', '1990-01-01', 'man', 'dubai'),
  ('a0e00000-0000-0000-0000-0000000000e3', 'Mona', '1990-01-01', 'woman', 'dubai'),
  ('a0e00000-0000-0000-0000-0000000000e4', 'Cleo', '1990-01-01', 'woman', 'dubai'),
  ('a0e00000-0000-0000-0000-0000000000e5', 'Ugolin', '1990-01-01', 'man', 'dubai'),
  ('a0e00000-0000-0000-0000-0000000000e6', 'Vicky', '1990-01-01', 'woman', 'dubai'),
  ('a0e00000-0000-0000-0000-0000000000e7', 'Wendy', '1990-01-01', 'woman', 'dubai'),
  ('a0e00000-0000-0000-0000-0000000000e8', 'Xavier', '1990-01-01', 'man', 'dubai'),
  ('a0e00000-0000-0000-0000-0000000000e9', 'Zelda', '1990-01-01', 'woman', 'dubai');
update public.profiles set created_at = now() - interval '60 days' where id::text like 'a0e00000-%';
insert into public.staff_roles (user_id, role) values
  ('a0e00000-0000-0000-0000-0000000000e1', 'owner'), ('a0e00000-0000-0000-0000-0000000000e2', 'admin'),
  ('a0e00000-0000-0000-0000-0000000000e3', 'moderator'), ('a0e00000-0000-0000-0000-0000000000e4', 'content');

insert into public.communities (id, city_id, name, created_by) values
  ('a0e00000-0000-0000-0000-0000000000c1', 'dubai', 'Console runners', 'a0e00000-0000-0000-0000-0000000000e5');
insert into public.community_members (community_id, user_id, role) values
  ('a0e00000-0000-0000-0000-0000000000c1', 'a0e00000-0000-0000-0000-0000000000e6', 'member'),
  ('a0e00000-0000-0000-0000-0000000000c1', 'a0e00000-0000-0000-0000-0000000000e7', 'member'),
  ('a0e00000-0000-0000-0000-0000000000c1', 'a0e00000-0000-0000-0000-0000000000e8', 'member')
  on conflict do nothing;
insert into public.activities (id, title, category_id, city_id, area_id, starts_at, capacity, creator_id) values
  ('a0e00000-0000-0000-0000-0000000000a1', 'Console sunset run', 'sport', 'dubai', 'marina', now() + interval '2 days', 8, 'a0e00000-0000-0000-0000-0000000000e5'),
  ('a0e00000-0000-0000-0000-0000000000a2', 'Console brunch', 'food', 'dubai', 'marina', now() + interval '3 days', 8, 'a0e00000-0000-0000-0000-0000000000e5');
insert into public.activities (id, title, category_id, city_id, area_id, starts_at, capacity, creator_id, girl_only) values
  ('a0e00000-0000-0000-0000-0000000000a3', 'Console girls coffee', 'food', 'dubai', 'marina', now() + interval '3 days', 8, 'a0e00000-0000-0000-0000-0000000000e6', true);
insert into public.activity_participants (activity_id, user_id, status) values
  ('a0e00000-0000-0000-0000-0000000000a1', 'a0e00000-0000-0000-0000-0000000000e6', 'going') on conflict do nothing;
insert into public.community_posts (id, community_id, author_id, body) values
  ('a0e00000-0000-0000-0000-0000000000b1', 'a0e00000-0000-0000-0000-0000000000c1', 'a0e00000-0000-0000-0000-0000000000e5', 'Console rude post'),
  ('a0e00000-0000-0000-0000-0000000000b2', 'a0e00000-0000-0000-0000-0000000000c1', 'a0e00000-0000-0000-0000-0000000000e5', 'Console spam post');

-- ───────── Who may call what ─────────
do $$
declare stmt text;
begin
  -- Not signed in: nothing.
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
  foreach stmt in array array[
    $q$select public.admin_overview()$q$, $q$select public.admin_user('a0e00000-0000-0000-0000-0000000000e5')$q$,
    $q$select * from public.admin_communities()$q$, $q$select * from public.admin_content('activity')$q$,
    $q$select public.admin_moderate('activity', 'a0e00000-0000-0000-0000-0000000000a1', 'hide', 'test')$q$,
    $q$select public.admin_settings()$q$, $q$select * from public.report_email_claim()$q$,
    $q$select public.admin_delete_account('a0e00000-0000-0000-0000-0000000000e9', 'DELETE', 'test')$q$] loop
    perform pg_temp.check(pg_temp.fails(stmt) = '42501', 'anon refused: ' || left(stmt, 60));
  end loop;

  -- A member: refused everywhere in the back office.
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e6');
  foreach stmt in array array[
    $q$select public.admin_overview()$q$, $q$select public.admin_user('a0e00000-0000-0000-0000-0000000000e5')$q$,
    $q$select * from public.admin_communities()$q$, $q$select public.admin_community('a0e00000-0000-0000-0000-0000000000c1')$q$,
    $q$select * from public.admin_content('activity')$q$, $q$select public.admin_content_item('activity', 'a0e00000-0000-0000-0000-0000000000a1')$q$,
    $q$select public.admin_moderate('activity', 'a0e00000-0000-0000-0000-0000000000a1', 'hide', 'test')$q$,
    $q$select public.admin_update_community('a0e00000-0000-0000-0000-0000000000c1', 'Mine now', null, null, 'test')$q$,
    $q$select public.admin_set_community_cover('a0e00000-0000-0000-0000-0000000000c1', null, 'test')$q$,
    $q$select public.admin_suspend('a0e00000-0000-0000-0000-0000000000e5', now() + interval '2 days', 'test')$q$,
    $q$select public.admin_reactivate('a0e00000-0000-0000-0000-0000000000e5', 'test')$q$,
    $q$select public.admin_delete_account('a0e00000-0000-0000-0000-0000000000e9', 'DELETE', 'test')$q$,
    $q$select * from public.admin_journal()$q$, $q$select public.admin_settings()$q$,
    $q$select public.admin_set_setting('report_email_to', 'me@example.com')$q$,
    $q$select public.admin_email_retry(gen_random_uuid())$q$] loop
    perform pg_temp.check(pg_temp.fails(stmt) = '42501', 'member refused: ' || left(stmt, 60));
  end loop;
  -- The sender's calls are for the server key only.
  perform pg_temp.check(pg_temp.fails($q$select * from public.report_email_claim()$q$) = '42501', 'a member cannot claim report emails');
  perform pg_temp.check(pg_temp.fails($q$select public.report_email_done(gen_random_uuid(), 'x')$q$) = '42501', 'a member cannot mark an email sent');
  perform pg_temp.check(pg_temp.fails($q$select private.journal('x', null, null, null, null, null)$q$) = '42501', 'a member cannot write the journal');
  perform pg_temp.check(pg_temp.fails($q$select private.moderate_item('activity', 'a0e00000-0000-0000-0000-0000000000a1', 'hide', 'x', null)$q$) = '42501', 'a member cannot reach the moderation core');

  -- A moderator: reads, suspends a week at most; no content takedown, no deletion, no overview, no settings.
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e3');
  perform pg_temp.check((public.admin_user('a0e00000-0000-0000-0000-0000000000e5') ->> 'status') = 'active', 'a moderator opens a member sheet');
  perform pg_temp.check((public.admin_user('a0e00000-0000-0000-0000-0000000000e5') ->> 'email') is null, 'a moderator does not see emails on the sheet');
  perform pg_temp.check(exists (select 1 from public.admin_content('activity', 'Console')), 'a moderator lists activities');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_moderate('activity', 'a0e00000-0000-0000-0000-0000000000a1', 'hide', 'test')$q$) = '42501', 'a moderator cannot hide content directly');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_overview()$q$) = '42501', 'a moderator does not read the overview counts');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_settings()$q$) = '42501', 'a moderator cannot read settings');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_delete_account('a0e00000-0000-0000-0000-0000000000e9', 'DELETE', 'test')$q$) = '42501', 'a moderator cannot delete an account');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_suspend('a0e00000-0000-0000-0000-0000000000e5', now() + interval '30 days', 'Too long')$q$) = '42501', 'a moderator cannot suspend for a month');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_update_community('a0e00000-0000-0000-0000-0000000000c1', 'Renamed', null, null, 'test')$q$) = '42501', 'a moderator is not content staff');

  -- Content staff: edits a community; cannot hide or delete.
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e4');
  perform public.admin_update_community('a0e00000-0000-0000-0000-0000000000c1', 'Console runners club', 'Run together', 'Every week', 'Clearer name');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_update_community('a0e00000-0000-0000-0000-0000000000c1', 'Co', null, null, 'test')$q$) = '22023', 'a name keeps its length rules');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_update_community('a0e00000-0000-0000-0000-0000000000c1', 'Console runners', null, null, '')$q$) = '22023', 'an edit needs a reason');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_moderate('community', 'a0e00000-0000-0000-0000-0000000000c1', 'hide', 'test')$q$) = '42501', 'content staff cannot suspend a community');
end $$;

select pg_temp.as_admin();
select pg_temp.check((select name from public.communities where id = 'a0e00000-0000-0000-0000-0000000000c1') = 'Console runners club', 'the community edit is saved');
select pg_temp.check(exists (select 1 from private.admin_audit where action = 'community.edited' and actor = 'a0e00000-0000-0000-0000-0000000000e4'
  and details ->> 'reason' = 'Clearer name' and details -> 'fields' ? 'name'), 'the edit is in the journal with who, why and which fields');

-- ───────── Overview (real counts) ─────────
do $$
declare o jsonb;
begin
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
  o := public.admin_overview();
  perform pg_temp.as_admin();
  perform pg_temp.check((o ->> 'users')::int = (select count(*) from public.profiles where deleted_at is null), 'overview: members is the real count');
  perform pg_temp.check((o ->> 'activities')::int = (select count(*) from public.activities where cancelled_at is null), 'overview: activities is the real count');
  perform pg_temp.check((o ->> 'active_30d')::int >= 1, 'overview: active members come from real writes');
  perform pg_temp.check(o ? 'reports_open' and o ? 'suspended' and jsonb_typeof(o -> 'recent') = 'array', 'overview: reports, suspensions and recent actions');
end $$;

-- ───────── Reports: duplicates, new reason, related cases, email outbox ─────────
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e6');
select public.report('community_post', null, 'a0e00000-0000-0000-0000-0000000000b1', 'threats', 'He threatened us') as r1 \gset
select pg_temp.check(public.report('community_post', null, 'a0e00000-0000-0000-0000-0000000000b1', 'threats', 'again') = :'r1', 'a double tap (same reason, minutes apart) is one report');
select public.report('community_post', null, 'a0e00000-0000-0000-0000-0000000000b1', 'sexual_content', null) as r2 \gset
select pg_temp.check(:'r2' <> :'r1', 'another reason on the same post is a new report');
select pg_temp.check(public.report('profile', 'a0e00000-0000-0000-0000-0000000000e5', null, 'spam', null) is not null, 'reporting the author too');
select pg_temp.check(not exists (select 1 from public.reports where id = :'r1' and reporter_id <> auth.uid()), 'the reporter sees her own report');
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e5');
select pg_temp.check(not exists (select 1 from public.reports), 'the reported member never sees who reported him');
select pg_temp.as_admin();
-- An older report by the same person and reason no longer folds a new one.
update public.reports set created_at = now() - interval '2 hours' where id = :'r1';
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e6');
select pg_temp.check(public.report('community_post', null, 'a0e00000-0000-0000-0000-0000000000b1', 'threats', 'it happened again') <> :'r1', 'a later report with the same reason gets through');
select pg_temp.as_admin();
select m.id as case1 from public.moderation_cases m where m.report_id = :'r1' \gset

select pg_temp.check((select count(*) from private.admin_notifications n join public.moderation_cases m on m.id = n.case_id
  join public.reports r on r.id = m.report_id where r.reporter_id = 'a0e00000-0000-0000-0000-0000000000e6') = 4, 'every report makes one notification row');
select pg_temp.check((select important from private.admin_notifications where case_id = :'case1'), 'a threat is important');
select pg_temp.check(exists (select 1 from private.report_email_outbox where case_id = :'case1' and status = 'pending'), 'an important report queues one email');
select pg_temp.check(not exists (select 1 from private.report_email_outbox o join public.reports r on r.id = o.report_id where r.category = 'spam'
  and r.reporter_id = 'a0e00000-0000-0000-0000-0000000000e6'), 'a plain spam report sends no email (scope: important)');
-- Idempotent: queuing again, or the priority going high, adds nothing.
select private.queue_report_email(:'case1');
update public.moderation_cases set priority = 'high' where id = :'case1';
select private.queue_report_email(:'case1');
select pg_temp.check((select count(*) from private.report_email_outbox where case_id = :'case1') = 1, 'one email per report, whatever happens');
select pg_temp.check(pg_temp.fails(format('insert into private.report_email_outbox (case_id, report_id) values (%L, %L)', :'case1', :'r1')) = '23505', 'the outbox refuses a second row for a report');

select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e3');
select pg_temp.check((select count(*) from public.admin_case_related(:'case1') where same_item) = 2, 'related: the other reports on the same post');
select pg_temp.check(exists (select 1 from public.admin_case_related(:'case1') where not same_item and target_kind = 'profile'), 'related: reports on the same member');

-- The sender: nothing without a destination, then one claim, a lease, retries, sent once.
select pg_temp.as_admin();
set role service_role;
select pg_temp.check(not exists (select 1 from public.report_email_claim()), 'no destination set: nothing is claimed, rows wait');
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
select pg_temp.check(pg_temp.fails($q$select public.admin_set_setting('report_email_to', 'not an email')$q$) = '22023', 'settings: a bad address is refused');
select pg_temp.check(pg_temp.fails($q$select public.admin_set_setting('dashboard_url', 'http://insecure.example')$q$) = '22023', 'settings: the dashboard link must be https');
select pg_temp.check(pg_temp.fails($q$select public.admin_set_setting('provider_key', 'x')$q$) = '22023', 'settings: unknown keys (a provider key) are refused');
select public.admin_set_setting('report_email_to', 'Moderation@Example.org');
select pg_temp.check((public.admin_settings() ->> 'report_email_to') = 'moderation@example.org', 'settings: the destination is saved');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from private.admin_audit where action = 'settings.changed' and details ->> 'setting' = 'report_email_to')
  and not exists (select 1 from private.admin_audit where details::text like '%example.org%'), 'settings: logged without the address');
set role service_role;
select count(*) as claimed, max(case_url) as url, bool_and(to_email = 'moderation@example.org') as dest from public.report_email_claim(50, 600) \gset
select pg_temp.check(:claimed >= 1 and :'dest', 'the sender claims the queued email with its destination');
select pg_temp.check(:'url' like 'https://getirly.com/app/admin/case/%', 'the email links to the case screen');
select pg_temp.check(not exists (select 1 from public.report_email_claim(50, 600)), 'a claimed email is not claimed twice (lease)');
reset role;
select id as out1 from private.report_email_outbox where case_id = :'case1' \gset
set role service_role;
select pg_temp.check(public.report_email_failed(:'out1', 'provider said 500 Bearer re_abc123') = 'pending', 'a failure is retried later');
reset role;
select pg_temp.check((select last_error not like '%re_abc123%' and next_attempt_at > now() from private.report_email_outbox where id = :'out1'), 'the error is kept without any key, with a delay');
update private.report_email_outbox set next_attempt_at = now() where id = :'out1';
set role service_role;
select pg_temp.check(exists (select 1 from public.report_email_claim(50, 600) where id = :'out1' and attempt = 2), 'the retry is claimed again (attempt 2)');
select pg_temp.check(public.report_email_done(:'out1', 'msg_1'), 'sent');
select pg_temp.check(not public.report_email_done(:'out1', 'msg_1'), 'sent once: a second "done" changes nothing');
reset role;
select pg_temp.check((select status = 'sent' and attempts = 2 from private.report_email_outbox where id = :'out1'), 'the outbox row records sent, with its attempts');
-- Leave the destination unset for the tests after this file.
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
select public.admin_set_setting('report_email_to', '');

-- ───────── Holds: hide, restore, delete ─────────
do $$
begin
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_moderate('activity', 'a0e00000-0000-0000-0000-0000000000a1', 'hide', '')$q$) = '22023', 'hiding needs a reason');
  perform public.admin_moderate('activity', 'a0e00000-0000-0000-0000-0000000000a1', 'hide', 'Unsafe meeting point');
  perform public.admin_moderate('activity', 'a0e00000-0000-0000-0000-0000000000a1', 'hide', 'Twice');
  perform pg_temp.check(exists (select 1 from public.admin_content('activity', null, 'hidden') where id = 'a0e00000-0000-0000-0000-0000000000a1'), 'the team still sees the hidden activity');
  perform pg_temp.check(exists (select 1 from public.admin_content('activity', 'girls coffee') where girl_only), 'admins list Girl activities to moderate them');

  -- Gone for its host and for the people going: lists, detail.
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e5');
  perform pg_temp.check(not exists (select 1 from public.activities where id = 'a0e00000-0000-0000-0000-0000000000a1'), 'the host no longer sees the hidden activity');
  perform pg_temp.check(not exists (select 1 from public.activity_detail('a0e00000-0000-0000-0000-0000000000a1')), 'no detail for a hidden activity');
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e6');
  perform pg_temp.check(not exists (select 1 from public.activities where id = 'a0e00000-0000-0000-0000-0000000000a1'), 'a participant no longer sees it');
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e7');
  perform pg_temp.check(not exists (select 1 from public.activities where id = 'a0e00000-0000-0000-0000-0000000000a1'), 'nobody else sees it');
end $$;

select pg_temp.as_admin();
select pg_temp.check((select moderated_at is not null and cancelled_at is not null from public.activities where id = 'a0e00000-0000-0000-0000-0000000000a1'), 'hidden = moderated and cancelled (off the map and search)');
-- The host cannot bring it back by writing the row.
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e5');
select pg_temp.check(pg_temp.fails($q$select private.hold_guard()$q$) is not null, 'the guard is not callable');
select pg_temp.as_admin();
select set_config('request.jwt.claim.sub', 'a0e00000-0000-0000-0000-0000000000e5', false);
select pg_temp.check(pg_temp.fails($q$update public.activities set moderated_at = null, cancelled_at = null where id = 'a0e00000-0000-0000-0000-0000000000a1'$q$) = '42501', 'the host cannot undo the team''s decision');
select set_config('request.jwt.claim.sub', '', false);

do $$
begin
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
  perform public.admin_moderate('activity', 'a0e00000-0000-0000-0000-0000000000a1', 'restore', 'Checked: fine');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_moderate('activity', 'a0e00000-0000-0000-0000-0000000000a1', 'restore', 'again')$q$) = '22023', 'restore only undoes a hold');
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e6');
  perform pg_temp.check(exists (select 1 from public.activities where id = 'a0e00000-0000-0000-0000-0000000000a1' and cancelled_at is null), 'restored: back, and not cancelled');

  -- Posts: hidden, the author cannot revive it, restored.
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
  perform public.admin_moderate('community_post', 'a0e00000-0000-0000-0000-0000000000b2', 'hide', 'Spam');
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e5');
  perform pg_temp.check(pg_temp.fails($q$update public.community_posts set deleted_at = null where id = 'a0e00000-0000-0000-0000-0000000000b2'$q$) = '42501', 'the author cannot revive a hidden post');
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e7');
  perform pg_temp.check(not exists (select 1 from public.community_posts where id = 'a0e00000-0000-0000-0000-0000000000b2'), 'a hidden post leaves the feed');
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
  perform public.admin_moderate('community_post', 'a0e00000-0000-0000-0000-0000000000b2', 'restore', 'Not spam after all');
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e7');
  perform pg_temp.check(exists (select 1 from public.community_posts where id = 'a0e00000-0000-0000-0000-0000000000b2' and deleted_at is null), 'a restored post is back');

  -- Community: suspended (hidden), the owner cannot restore it, the team does.
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
  perform public.admin_moderate('community', 'a0e00000-0000-0000-0000-0000000000c1', 'hide', 'Hateful name');
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e6');
  perform pg_temp.check(not exists (select 1 from public.communities where id = 'a0e00000-0000-0000-0000-0000000000c1'), 'a suspended community leaves every list');
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
  perform pg_temp.check((public.admin_community('a0e00000-0000-0000-0000-0000000000c1') -> 'hold' ->> 'reason') = 'Hateful name', 'the sheet shows why it is suspended');
  perform public.admin_moderate('community', 'a0e00000-0000-0000-0000-0000000000c1', 'restore', 'Renamed with the owner');
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e6');
  perform pg_temp.check(exists (select 1 from public.communities where id = 'a0e00000-0000-0000-0000-0000000000c1'), 'a restored community is back');

  -- Delete: final, the words kept for moderation.
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
  perform public.admin_moderate('activity', 'a0e00000-0000-0000-0000-0000000000a2', 'delete', 'Scam: asked for deposits');
  perform pg_temp.check(not exists (select 1 from public.admin_content('activity', 'Console brunch')), 'a deleted activity is gone');
  perform pg_temp.check((public.admin_content_item('activity', 'a0e00000-0000-0000-0000-0000000000a2') ->> 'gone') = 'true', 'its words stay for the team');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_moderate('activity', 'a0e00000-0000-0000-0000-0000000000a2', 'restore', 'oops')$q$) = '22023', 'a deletion cannot be restored');
end $$;

-- Reported content taken down from a case is restorable too.
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
select public.mod_remove_content(:'case1', 'Threat removed');
select pg_temp.check((select status from public.moderation_cases where id = :'case1') = 'actioned', 'the case is actioned');
select pg_temp.check((public.admin_content_item('community_post', 'a0e00000-0000-0000-0000-0000000000b1') -> 'hold' ->> 'reason') = 'Threat removed', 'the takedown is a hold with its reason');

-- Three long-standing members report a post: it is hidden for review, never decided.
select pg_temp.as_admin();
insert into public.community_posts (id, community_id, author_id, body) values
  ('a0e00000-0000-0000-0000-0000000000b3', 'a0e00000-0000-0000-0000-0000000000c1', 'a0e00000-0000-0000-0000-0000000000e5', 'Console third post');
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e6');
select public.report('community_post', null, 'a0e00000-0000-0000-0000-0000000000b3', 'spam', null) is not null as x1 \gset
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e7');
select public.report('community_post', null, 'a0e00000-0000-0000-0000-0000000000b3', 'spam', null) is not null as x2 \gset
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e8');
select public.report('community_post', null, 'a0e00000-0000-0000-0000-0000000000b3', 'spam', null) is not null as x3 \gset
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from private.moderation_holds where target_id = 'a0e00000-0000-0000-0000-0000000000b3' and active and created_by is null), 'three reports: hidden pending review, as a hold');
select pg_temp.check((select count(*) from public.moderation_cases m join public.reports r on r.id = m.report_id
  where r.target_id = 'a0e00000-0000-0000-0000-0000000000b3' and m.status = 'open' and m.priority = 'high') = 3, 'the cases stay open (high priority) for a person to decide');
select pg_temp.check(exists (select 1 from private.report_email_outbox o join public.reports r on r.id = o.report_id
  where r.target_id = 'a0e00000-0000-0000-0000-0000000000b3'), 'high priority makes them important: emails queued');
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
select public.admin_moderate('community_post', 'a0e00000-0000-0000-0000-0000000000b3', 'restore', 'Reviewed: allowed');
select pg_temp.as_admin();
select pg_temp.check((select deleted_at is null from public.community_posts where id = 'a0e00000-0000-0000-0000-0000000000b3'), 'an automatic hide can be undone');

-- ───────── Photos ─────────
select pg_temp.as_admin();
update public.communities set cover_path = 'a0e00000-0000-0000-0000-0000000000e5/old.jpg' where id = 'a0e00000-0000-0000-0000-0000000000c1';
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e4');
select pg_temp.check(pg_temp.fails($q$select public.admin_set_community_cover('a0e00000-0000-0000-0000-0000000000c1', 'a0e00000-0000-0000-0000-0000000000e5/x.jpg', 'New photo')$q$) = '42501', 'a photo must be the staff member''s own upload');
select public.admin_set_community_cover('a0e00000-0000-0000-0000-0000000000c1', 'a0e00000-0000-0000-0000-0000000000e4/1700000000000.jpg', 'Inappropriate photo replaced');
select pg_temp.as_admin();
select pg_temp.check((select cover_path from public.communities where id = 'a0e00000-0000-0000-0000-0000000000c1') = 'a0e00000-0000-0000-0000-0000000000e4/1700000000000.jpg', 'the new photo (new path: no stale cache) is saved');
select pg_temp.check(exists (select 1 from private.storage_cleanup where name = 'a0e00000-0000-0000-0000-0000000000e5/old.jpg' and reason = 'orphan'), 'the old file is queued for removal once replaced');
-- A file still used elsewhere is not queued.
-- (Written directly, as the content staff member: the photo guard lets her own upload through.)
select set_config('request.jwt.claim.sub', 'a0e00000-0000-0000-0000-0000000000e4', false);
update public.activities set cover_path = 'a0e00000-0000-0000-0000-0000000000e4/1700000000000.jpg' where id = 'a0e00000-0000-0000-0000-0000000000a1';
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e4');
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e4');
select public.admin_set_community_cover('a0e00000-0000-0000-0000-0000000000c1', null, 'Removed: inappropriate');
select pg_temp.as_admin();
select pg_temp.check((select cover_path from public.communities where id = 'a0e00000-0000-0000-0000-0000000000c1') is null, 'a photo can be removed');
select pg_temp.check(not exists (select 1 from private.storage_cleanup where name = 'a0e00000-0000-0000-0000-0000000000e4/1700000000000.jpg'), 'a file still used by an activity is kept');
select pg_temp.check((select count(*) from private.admin_audit where action in ('community.photo_replaced', 'community.photo_removed')) = 2, 'photo changes are journaled');

-- ───────── Suspension until a date, and what it blocks ─────────
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e3');
select pg_temp.check(pg_temp.fails($q$select public.admin_suspend('a0e00000-0000-0000-0000-0000000000e5', now() - interval '1 day', 'Past')$q$) = '22023', 'a suspension ends in the future');
select pg_temp.check(pg_temp.fails($q$select public.admin_suspend('a0e00000-0000-0000-0000-0000000000e2', now() + interval '2 days', 'Coup')$q$) = '42501', 'a moderator cannot suspend an admin');
select public.admin_suspend('a0e00000-0000-0000-0000-0000000000e5', now() + interval '5 days', 'Threats in a community', :'case1') is not null as suspended \gset
do $$
begin
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e3');
  perform pg_temp.check((public.admin_user('a0e00000-0000-0000-0000-0000000000e5') ->> 'status') = 'suspended'
    and (public.admin_user('a0e00000-0000-0000-0000-0000000000e5') ->> 'status_until') is not null, 'the sheet shows suspended, until when');

  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e5');
  perform pg_temp.check(pg_temp.fails($q$insert into public.community_posts (community_id, author_id, body) values ('a0e00000-0000-0000-0000-0000000000c1', 'a0e00000-0000-0000-0000-0000000000e5', 'still here')$q$) = '42501', 'suspended: no new post');
  perform pg_temp.check(pg_temp.fails($q$insert into public.activities (title, category_id, city_id, area_id, starts_at, creator_id) values ('Sneaky', 'food', 'dubai', 'marina', now() + interval '1 day', 'a0e00000-0000-0000-0000-0000000000e5')$q$) = '42501', 'suspended: no new activity');
  perform pg_temp.check(pg_temp.fails($q$update public.community_posts set body = 'edited threat' where id = 'a0e00000-0000-0000-0000-0000000000b3'$q$) = '42501', 'suspended: no editing a published post');
  perform pg_temp.check(pg_temp.fails($q$update public.profiles set bio = 'new insults' where id = 'a0e00000-0000-0000-0000-0000000000e5'$q$) = '42501', 'suspended: no editing the profile text');
  perform pg_temp.check(pg_temp.fails($q$update public.activities set title = 'Renamed' where id = 'a0e00000-0000-0000-0000-0000000000a1'$q$) = '42501', 'suspended: no editing an activity');
  perform pg_temp.check(public.report('profile', 'a0e00000-0000-0000-0000-0000000000e6', null, 'harassment', null) is not null, 'suspended: reporting stays open');
  -- Removing one's own post stays possible.
  update public.community_posts set deleted_at = now() where id = 'a0e00000-0000-0000-0000-0000000000b3';

  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e3');
  perform pg_temp.check(public.admin_reactivate('a0e00000-0000-0000-0000-0000000000e5', 'Apologised') = 1, 'reactivation lifts the suspension');
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e5');
  update public.profiles set bio = 'Back, calmer' where id = 'a0e00000-0000-0000-0000-0000000000e5';
end $$;
select pg_temp.as_admin();
select pg_temp.check((select bio from public.profiles where id = 'a0e00000-0000-0000-0000-0000000000e5') = 'Back, calmer', 'reactivated: the member writes again');
select pg_temp.check(exists (select 1 from private.admin_audit where action = 'sanction.suspension' and target_user = 'a0e00000-0000-0000-0000-0000000000e5' and details ? 'until'), 'the suspension is journaled with its end date');

-- ───────── Account deletion by an admin ─────────
do $$
begin
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_delete_account('a0e00000-0000-0000-0000-0000000000e2', 'DELETE', 'Myself')$q$) = '22023', 'an admin cannot delete her own account here');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_delete_account('a0e00000-0000-0000-0000-0000000000e9', 'delete', 'Fake account')$q$) = '22023', 'deletion needs DELETE typed exactly');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_delete_account('a0e00000-0000-0000-0000-0000000000e9', 'DELETE', '')$q$) = '22023', 'deletion needs a reason');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_delete_account('a0e00000-0000-0000-0000-0000000000e3', 'DELETE', 'Rogue moderator')$q$) = '42501', 'a team member is not deleted here');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_delete_account('a0e00000-0000-0000-0000-0000000000e1', 'DELETE', 'Coup')$q$) = '42501', 'the owner is never deleted here');
  perform public.admin_delete_account('a0e00000-0000-0000-0000-0000000000e9', 'DELETE', 'Fake account, confirmed by support');
  perform pg_temp.check(auth.uid() = 'a0e00000-0000-0000-0000-0000000000e2', 'the acting admin is herself again after the deletion');
  perform pg_temp.check(public.my_staff_role() = 'admin', 'and keeps her rights');
end $$;
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.profiles where id = 'a0e00000-0000-0000-0000-0000000000e9')
  and not exists (select 1 from auth.users where id = 'a0e00000-0000-0000-0000-0000000000e9'), 'the account is gone (profile and sign-in)');
select pg_temp.check(exists (select 1 from private.admin_audit where action = 'account.deleted' and target_user = 'a0e00000-0000-0000-0000-0000000000e9'
  and actor = 'a0e00000-0000-0000-0000-0000000000e2' and details ->> 'reason' = 'Fake account, confirmed by support'), 'the deletion is journaled (id and reason only)');

-- ───────── The journal is append-only ─────────
select pg_temp.as_admin();
select pg_temp.check(pg_temp.fails($q$update private.admin_audit set action = 'nothing' where true$q$) = '42501', 'nobody rewrites the journal, not even the database owner');
select pg_temp.check(pg_temp.fails($q$delete from private.admin_audit where true$q$) = '42501', 'nobody deletes journal lines');
select pg_temp.check(pg_temp.fails($q$truncate private.admin_audit$q$) = '42501', 'nobody empties the journal');
select pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
select pg_temp.check(pg_temp.fails($q$select count(*) from private.admin_audit$q$) = '42501', 'clients never touch the journal table, admins included');
select pg_temp.check(exists (select 1 from public.admin_journal() where action = 'content.hide' and reason = 'Unsafe meeting point'), 'admins read the journal with reasons');
select pg_temp.as_admin();
insert into private.admin_audit (actor, action, at) values (null, 'console.ancient', now() - interval '25 months');
select private.purge_retention();
select pg_temp.check(not exists (select 1 from private.admin_audit where action = 'console.ancient'), 'only the 24-month retention removes old lines');
select pg_temp.check(pg_temp.fails($q$delete from private.admin_audit where true$q$) = '42501', 'and the journal is locked again right after');

-- ───────── Role escalation ─────────
do $$
begin
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e6');
  perform pg_temp.check(pg_temp.fails($q$insert into public.staff_roles (user_id, role) values ('a0e00000-0000-0000-0000-0000000000e6', 'admin')$q$) = '42501', 'a member cannot insert herself as admin');
  -- Refused, or no row reachable (RLS without any policy for members): checked below.
  perform pg_temp.fails($q$update public.staff_roles set role = 'owner' where true$q$);
  perform pg_temp.fails($q$delete from public.staff_roles where true$q$);
  perform pg_temp.check(pg_temp.fails($q$select private.grant_owner('x@example.org')$q$) = '42501', 'a member cannot call grant_owner');
  perform pg_temp.check(pg_temp.fails($q$insert into private.admin_settings (key, value) values ('report_email_to', 'evil@example.org')$q$) = '42501', 'a member cannot write settings');
  perform pg_temp.check(pg_temp.fails($q$update private.report_email_outbox set status = 'sent' where true$q$) = '42501', 'a member cannot touch the outbox');
  perform pg_temp.check(pg_temp.fails($q$update public.profiles set is_admin = true where id = 'a0e00000-0000-0000-0000-0000000000e6'$q$) is not null, 'a member cannot set her own admin flag');
  perform pg_temp.check(public.my_staff_role() is null, 'a member who tries the admin flag stays a member');
  -- Content staff cannot climb either.
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e4');
  perform pg_temp.check(pg_temp.fails($q$select public.staff_set_role('a0e00000-0000-0000-0000-0000000000e4', 'admin')$q$) = '42501', 'content staff cannot promote herself');
  perform pg_temp.as_user('a0e00000-0000-0000-0000-0000000000e2');
  perform pg_temp.check(pg_temp.fails($q$select public.staff_set_role('a0e00000-0000-0000-0000-0000000000e6', 'admin')$q$) = '42501', 'an admin cannot grant roles');
end $$;
select pg_temp.as_admin();
select pg_temp.check(not (select is_admin from public.profiles where id = 'a0e00000-0000-0000-0000-0000000000e6'), 'the admin flag never moved');
select pg_temp.check((select count(*) from public.staff_roles where user_id::text like 'a0e00000-%') = 4
  and (select role from public.staff_roles where user_id = 'a0e00000-0000-0000-0000-0000000000e3') = 'moderator'
  and not exists (select 1 from public.staff_roles where user_id = 'a0e00000-0000-0000-0000-0000000000e6'), 'a member could neither change nor remove a role');
