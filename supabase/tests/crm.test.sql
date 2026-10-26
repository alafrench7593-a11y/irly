-- Back office CRM (migration 20261031000000_irly_crm): only owners and admins
-- read or write it, nothing can be deleted except a partnership's contact
-- link, stage changes are logged by the server, owners and assignees must be
-- owners or admins, and the bookkeeping columns cannot be forged. Ids a0f00000-….
\set ON_ERROR_STOP 1

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL crm: %', label; end if;
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

-- f1 owner, f2 admin, f3 moderator, f4 content, f5 member.
insert into auth.users (id) values
  ('a0f00000-0000-0000-0000-0000000000f1'), ('a0f00000-0000-0000-0000-0000000000f2'), ('a0f00000-0000-0000-0000-0000000000f3'),
  ('a0f00000-0000-0000-0000-0000000000f4'), ('a0f00000-0000-0000-0000-0000000000f5');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('a0f00000-0000-0000-0000-0000000000f1', 'Crmowner', '1990-01-01', 'woman', 'dubai'),
  ('a0f00000-0000-0000-0000-0000000000f2', 'Crmadmin', '1990-01-01', 'man', 'dubai'),
  ('a0f00000-0000-0000-0000-0000000000f3', 'Crmmod', '1990-01-01', 'woman', 'dubai'),
  ('a0f00000-0000-0000-0000-0000000000f4', 'Crmcontent', '1990-01-01', 'woman', 'dubai'),
  ('a0f00000-0000-0000-0000-0000000000f5', 'Crmmember', '1990-01-01', 'man', 'dubai');
insert into public.staff_roles (user_id, role) values
  ('a0f00000-0000-0000-0000-0000000000f1', 'owner'), ('a0f00000-0000-0000-0000-0000000000f2', 'admin'),
  ('a0f00000-0000-0000-0000-0000000000f3', 'moderator'), ('a0f00000-0000-0000-0000-0000000000f4', 'content')
  on conflict (user_id) do update set role = excluded.role;

-- ───────── An admin works the CRM ─────────
select pg_temp.as_user('a0f00000-0000-0000-0000-0000000000f2');
insert into public.crm_organizations (id, name, kind, network_target)
values ('a0f00000-0000-0000-0000-0000000000b1', 'Example Events Co', 'event_organizer', true);
insert into public.crm_contacts (id, first_name, last_name, organization_id, category, email, stage, tags, details, next_follow_up, owner_id, created_by)
values ('a0f00000-0000-0000-0000-0000000000c1', 'Test', 'Organiser', 'a0f00000-0000-0000-0000-0000000000b1', 'event_organizer',
        'organiser@example.com', 'new', '{launch}', '{"event_types":"Run clubs"}', current_date - 1,
        'a0f00000-0000-0000-0000-0000000000f2', 'a0f00000-0000-0000-0000-0000000000f5');
select pg_temp.check((select created_by from public.crm_contacts where id = 'a0f00000-0000-0000-0000-0000000000c1') = 'a0f00000-0000-0000-0000-0000000000f2',
  'created_by is the caller, whatever the app sends');
select pg_temp.check((select count(*) from public.crm_stage_history where contact_id = 'a0f00000-0000-0000-0000-0000000000c1' and from_stage is null and to_stage = 'new') = 1,
  'creating a contact logs its first stage');

update public.crm_contacts set stage = 'contacted' where id = 'a0f00000-0000-0000-0000-0000000000c1';
update public.crm_contacts set notes = 'Called, waiting for the deck' where id = 'a0f00000-0000-0000-0000-0000000000c1';
select pg_temp.check((select count(*) from public.crm_stage_history where contact_id = 'a0f00000-0000-0000-0000-0000000000c1') = 2,
  'a stage change is logged once; another edit is not');
select pg_temp.check((select changed_by = 'a0f00000-0000-0000-0000-0000000000f2' and from_stage = 'new' and to_stage = 'contacted'
  from public.crm_stage_history where contact_id = 'a0f00000-0000-0000-0000-0000000000c1' order by at desc, id desc limit 1),
  'the log says who moved it, from where to where');

select pg_temp.check(pg_temp.fails($$insert into public.crm_contacts (category) values ('influencer')$$) = '23514',
  'a contact needs a name, a company or an organisation');
select pg_temp.check(pg_temp.fails($$insert into public.crm_contacts (first_name, stage) values ('X', 'won')$$) = '23514',
  'unknown stages are refused');
select pg_temp.check(pg_temp.fails($$insert into public.crm_contacts (first_name, email) values ('X', 'not-an-email')$$) = '23514',
  'a malformed email is refused');
select pg_temp.check(pg_temp.fails($$insert into public.crm_contacts (first_name, owner_id) values ('X', 'a0f00000-0000-0000-0000-0000000000f5')$$) = '22023',
  'a contact cannot be put in the hands of a member');
select pg_temp.check(pg_temp.fails($$insert into public.crm_contacts (first_name, owner_id) values ('X', 'a0f00000-0000-0000-0000-0000000000f3')$$) = '22023',
  'nor of a moderator');
select pg_temp.check(pg_temp.fails($$insert into public.crm_stage_history (contact_id, to_stage) values ('a0f00000-0000-0000-0000-0000000000c1', 'lost')$$) = '42501',
  'the history cannot be written by the app');
-- Refused outright where the grant is missing, a no-op under RLS where a broad grant exists (as on Supabase).
select pg_temp.fails($$delete from public.crm_contacts where id = 'a0f00000-0000-0000-0000-0000000000c1'$$);
select pg_temp.fails($$delete from public.crm_organizations$$);
select pg_temp.check((select count(*) from public.crm_contacts where id = 'a0f00000-0000-0000-0000-0000000000c1') = 1, 'contacts are archived, never deleted');
select pg_temp.check((select count(*) from public.crm_organizations where id = 'a0f00000-0000-0000-0000-0000000000b1') = 1, 'organisations are never deleted');

insert into public.crm_partnerships (id, title, kind, status, organization_id, starts_on, ends_on, budget)
values ('a0f00000-0000-0000-0000-0000000000d1', 'Launch run series', 'event_organizer', 'negotiating', 'a0f00000-0000-0000-0000-0000000000b1', current_date, current_date + 30, 1500);
insert into public.crm_partnership_contacts (partnership_id, contact_id) values ('a0f00000-0000-0000-0000-0000000000d1', 'a0f00000-0000-0000-0000-0000000000c1');
select pg_temp.check(pg_temp.fails($$insert into public.crm_partnerships (title, starts_on, ends_on) values ('Backwards', current_date, current_date - 1)$$) = '23514',
  'a partnership cannot end before it starts');
delete from public.crm_partnership_contacts where partnership_id = 'a0f00000-0000-0000-0000-0000000000d1';
select pg_temp.check((select count(*) from public.crm_partnership_contacts) = 0, 'a contact can be unlinked from a partnership');
insert into public.crm_partnership_contacts (partnership_id, contact_id) values ('a0f00000-0000-0000-0000-0000000000d1', 'a0f00000-0000-0000-0000-0000000000c1');

insert into public.crm_tasks (id, title, contact_id, due_on, priority, assignee_id)
values ('a0f00000-0000-0000-0000-0000000000e1', 'Send the deck', 'a0f00000-0000-0000-0000-0000000000c1', current_date - 1, 'high', 'a0f00000-0000-0000-0000-0000000000f1');
select pg_temp.check(pg_temp.fails($$insert into public.crm_tasks (title, assignee_id) values ('X', 'a0f00000-0000-0000-0000-0000000000f4')$$) = '22023',
  'a task cannot be given to a content editor');
update public.crm_tasks set done_at = now() where id = 'a0f00000-0000-0000-0000-0000000000e1';
select pg_temp.check((select done_at is not null from public.crm_tasks where id = 'a0f00000-0000-0000-0000-0000000000e1'), 'a task is marked done');

insert into public.crm_campaigns (id, name, channel, status, utm_source, utm_medium, utm_campaign, budget, clicks)
values ('a0f00000-0000-0000-0000-0000000000a1', 'TikTok launch', 'tiktok', 'running', 'tiktok', 'paid', 'launch-oct', 500, 120);
select pg_temp.check(pg_temp.fails($$insert into public.crm_campaigns (name, utm_campaign) values ('Twin', 'LAUNCH-OCT')$$) = '23505',
  'two live campaigns cannot share a utm_campaign');
select pg_temp.check(pg_temp.fails($$insert into public.crm_campaigns (name, utm_campaign) values ('Spaces', 'bad value')$$) = '23514',
  'utm values are url-safe');

update public.crm_contacts set archived_at = now(), created_by = 'a0f00000-0000-0000-0000-0000000000f5' where id = 'a0f00000-0000-0000-0000-0000000000c1';
select pg_temp.check((select archived_at is not null and created_by = 'a0f00000-0000-0000-0000-0000000000f2' from public.crm_contacts where id = 'a0f00000-0000-0000-0000-0000000000c1'),
  'archiving works and created_by cannot be rewritten');

-- ───────── The owner sees the same CRM ─────────
select pg_temp.as_user('a0f00000-0000-0000-0000-0000000000f1');
select pg_temp.check((select count(*) from public.crm_contacts) = 1 and (select count(*) from public.crm_campaigns) = 1, 'the owner reads the CRM');

-- ───────── Everyone else: nothing ─────────
do $$
declare uid uuid;
begin
  foreach uid in array array['a0f00000-0000-0000-0000-0000000000f3', 'a0f00000-0000-0000-0000-0000000000f4', 'a0f00000-0000-0000-0000-0000000000f5']::uuid[] loop
    perform pg_temp.as_user(uid);
    perform pg_temp.check((select count(*) from public.crm_contacts) = 0 and (select count(*) from public.crm_organizations) = 0
      and (select count(*) from public.crm_partnerships) = 0 and (select count(*) from public.crm_tasks) = 0
      and (select count(*) from public.crm_campaigns) = 0 and (select count(*) from public.crm_stage_history) = 0
      and (select count(*) from public.crm_partnership_contacts) = 0, format('%s reads nothing', uid));
    perform pg_temp.check(pg_temp.fails($q$insert into public.crm_contacts (first_name) values ('Intruder')$q$) = '42501', format('%s cannot add a contact', uid));
    update public.crm_contacts set stage = 'lost';
    update public.crm_campaigns set budget = 0;
  end loop;
end $$;
select pg_temp.as_admin();
select pg_temp.check((select stage from public.crm_contacts where id = 'a0f00000-0000-0000-0000-0000000000c1') = 'contacted'
  and (select budget from public.crm_campaigns where id = 'a0f00000-0000-0000-0000-0000000000a1') = 500,
  'their updates change nothing');

select pg_temp.as_anon();
select pg_temp.check(coalesce(pg_temp.fails($$select 1 / (select count(*)::int from public.crm_contacts)$$), '') in ('42501', '22012'), 'signed out: no access at all');
select pg_temp.as_admin();

-- Leave the shared test database as it was.
delete from public.crm_tasks where id::text like 'a0f00000-%';
delete from public.crm_partnerships where id::text like 'a0f00000-%';
delete from public.crm_contacts where id::text like 'a0f00000-%';
delete from public.crm_organizations where id::text like 'a0f00000-%';
delete from public.crm_campaigns where id::text like 'a0f00000-%';
delete from public.staff_roles where user_id::text like 'a0f00000-%';
delete from public.profiles where id::text like 'a0f00000-%';
delete from auth.users where id::text like 'a0f00000-%';
