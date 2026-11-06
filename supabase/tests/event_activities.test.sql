-- Activities linked to an IRLY event (20261109200000_irly_event_activities.sql):
-- created with the event's key, listed on the event page by
-- public.event_activities with every visibility rule of activities.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed ee000000-….
--
--   w1 Nadia  woman, IRLY Girl access: hosts the women-only and members-only plans
--   w2 Ines   woman, IRLY Girl access, not in the club: blocks Bruno
--   m1 Marc   man, member of the club: hosts a public plan
--   m2 Omar   man, outsider (no community)
--   m3 Bruno  man, blocked by Ines: hosts a public plan
\set ON_ERROR_STOP 1

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
    raise exception 'FAIL event_activities: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;
-- The SQLSTATE a statement fails with, or null when it succeeds.
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;
-- The titles the caller sees on an event's page, in order.
create or replace function pg_temp.seen(p_event text) returns text[] language sql as $$
  select coalesce(array_agg(title order by title), '{}') from public.event_activities(p_event)
$$;

-- ───────── Accounts, communities (server role) ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('ee000000-0000-0000-0000-0000000000a1'), ('ee000000-0000-0000-0000-0000000000a2'),
  ('ee000000-0000-0000-0000-0000000000a3'), ('ee000000-0000-0000-0000-0000000000a4'),
  ('ee000000-0000-0000-0000-0000000000a5');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('ee000000-0000-0000-0000-0000000000a1', 'Nadia', '1993-03-03', 'woman', 'dubai'),
  ('ee000000-0000-0000-0000-0000000000a2', 'Ines', '1994-04-04', 'woman', 'dubai'),
  ('ee000000-0000-0000-0000-0000000000a3', 'Marc', '1991-05-05', 'man', 'dubai'),
  ('ee000000-0000-0000-0000-0000000000a4', 'Omar', '1990-06-06', 'man', 'dubai'),
  ('ee000000-0000-0000-0000-0000000000a5', 'Bruno', '1989-07-07', 'man', 'dubai');
update public.profiles set verified_at = now()
where id in ('ee000000-0000-0000-0000-0000000000a1', 'ee000000-0000-0000-0000-0000000000a2');
-- An open club (Nadia owner, Marc member) and a women-only circle (Nadia owner).
insert into public.communities (id, city_id, name, category_id, girl_only, created_by) values
  ('ee000000-0000-0000-0000-0000000000c1', 'dubai', 'Event Test Club', 'sport', false, 'ee000000-0000-0000-0000-0000000000a1'),
  ('ee000000-0000-0000-0000-0000000000c2', 'dubai', 'Event Test Circle', 'girl', true, 'ee000000-0000-0000-0000-0000000000a1');
insert into public.community_members (community_id, user_id, role) values
  ('ee000000-0000-0000-0000-0000000000c1', 'ee000000-0000-0000-0000-0000000000a1', 'owner'),
  ('ee000000-0000-0000-0000-0000000000c1', 'ee000000-0000-0000-0000-0000000000a3', 'member'),
  ('ee000000-0000-0000-0000-0000000000c2', 'ee000000-0000-0000-0000-0000000000a1', 'owner');
insert into public.blocks (blocker_id, blocked_id) values ('ee000000-0000-0000-0000-0000000000a2', 'ee000000-0000-0000-0000-0000000000a5');

select pg_temp.check(private.girl_eligible_unchecked('ee000000-0000-0000-0000-0000000000a1')
  and private.girl_eligible_unchecked('ee000000-0000-0000-0000-0000000000a2')
  and not private.girl_eligible_unchecked('ee000000-0000-0000-0000-0000000000a3'), 'setup: the women have IRLY Girl access, the men do not');

-- ═════════════════════════ CREATE LINKED ═════════════════════════

-- Marc: a public plan for the event (as the app inserts it).
select pg_temp.as_user('ee000000-0000-0000-0000-0000000000a3');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, place_name, starts_at, privacy, event_key) values
  ('ee000000-0000-0000-0000-0000000000b1', 'ee000000-0000-0000-0000-0000000000a3', 'EV public with Marc', 'networking', 'dubai', 'difc', 'Gate Village',
   now() + interval '2 days', 'public', 'e-d1');
select pg_temp.check((select event_key from public.activities where id = 'ee000000-0000-0000-0000-0000000000b1') = 'e-d1', 'create: the event key is stored with the plan');
-- Friends-only: never on the public event page.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy, event_key) values
  ('ee000000-0000-0000-0000-0000000000b9', 'ee000000-0000-0000-0000-0000000000a3', 'EV friends of Marc', 'networking', 'dubai', 'difc',
   now() + interval '2 days', 'friends', 'e-d1');
-- A key in another shape is refused (it would link to nothing).
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, event_key)
  values ('ee000000-0000-0000-0000-0000000000a3', 'EV bad key', 'networking', 'dubai', 'difc', now() + interval '1 day', 'E-D1; drop')$$) = '23514',
  'create: a malformed event key is refused');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, event_key)
  values ('ee000000-0000-0000-0000-0000000000a3', 'EV long key', 'networking', 'dubai', 'difc', now() + interval '1 day', 'e-' || repeat('a', 70))$$) = '23514',
  'create: an event key over 64 characters is refused');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, event_key)
  values ('ee000000-0000-0000-0000-0000000000a3', 'EV place key', 'networking', 'dubai', 'difc', now() + interval '1 day', 'p-kite-beach')$$) = '23514',
  'create: only an event key (e-…) is accepted');
-- A man cannot slip a women-only plan under the event.
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, girl_only, event_key)
  values ('ee000000-0000-0000-0000-0000000000a3', 'EV girls by Marc', 'networking', 'dubai', 'difc', now() + interval '1 day', true, 'e-d1')$$) = '42501',
  'create: a man cannot create a women-only plan for the event');

-- Nadia: an IRLY Girl plan, a members-only plan of the club, a plan in the women-only circle (not flagged by the app).
select pg_temp.as_user('ee000000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience, event_key) values
  ('ee000000-0000-0000-0000-0000000000b2', 'ee000000-0000-0000-0000-0000000000a1', 'EV girls with Nadia', 'networking', 'dubai', 'difc',
   now() + interval '2 days', true, 'girls', 'e-d1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy, community_id, event_key) values
  ('ee000000-0000-0000-0000-0000000000b3', 'ee000000-0000-0000-0000-0000000000a1', 'EV club members', 'networking', 'dubai', 'difc',
   now() + interval '2 days', 'community', 'ee000000-0000-0000-0000-0000000000c1', 'e-d1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy, community_id, event_key) values
  ('ee000000-0000-0000-0000-0000000000b4', 'ee000000-0000-0000-0000-0000000000a1', 'EV circle plan', 'networking', 'dubai', 'difc',
   now() + interval '2 days', 'public', 'ee000000-0000-0000-0000-0000000000c2', 'e-d1');
select pg_temp.check((select girl_only and community_id = 'ee000000-0000-0000-0000-0000000000c2' and event_key = 'e-d1'
  from public.activities where id = 'ee000000-0000-0000-0000-0000000000b4'),
  'create: made in an IRLY Girl community, it keeps its community and the event, and is women-only');
select pg_temp.check((select community_id = 'ee000000-0000-0000-0000-0000000000c1' and event_key = 'e-d1'
  from public.activities where id = 'ee000000-0000-0000-0000-0000000000b3'), 'create: a community plan keeps both links');
-- Plans that must not show: cancelled, deleted, another event.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, event_key) values
  ('ee000000-0000-0000-0000-0000000000b6', 'ee000000-0000-0000-0000-0000000000a1', 'EV cancelled', 'networking', 'dubai', 'difc', now() + interval '3 days', 'e-d1'),
  ('ee000000-0000-0000-0000-0000000000b7', 'ee000000-0000-0000-0000-0000000000a1', 'EV deleted', 'networking', 'dubai', 'difc', now() + interval '3 days', 'e-d1'),
  ('ee000000-0000-0000-0000-0000000000b8', 'ee000000-0000-0000-0000-0000000000a1', 'EV other event', 'networking', 'dubai', 'difc', now() + interval '3 days', 'e-d2');
update public.activities set cancelled_at = now() where id = 'ee000000-0000-0000-0000-0000000000b6';
select public.delete_activity('ee000000-0000-0000-0000-0000000000b7');
select pg_temp.check(not exists (select 1 from public.activities where id = 'ee000000-0000-0000-0000-0000000000b7'), 'setup: the deleted plan is gone');

-- Bruno (blocked by Ines) and Ines: one public plan each.
select pg_temp.as_user('ee000000-0000-0000-0000-0000000000a5');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, event_key) values
  ('ee000000-0000-0000-0000-0000000000b5', 'ee000000-0000-0000-0000-0000000000a5', 'EV public with Bruno', 'networking', 'dubai', 'difc', now() + interval '2 days', 'e-d1');
select pg_temp.as_user('ee000000-0000-0000-0000-0000000000a2');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, event_key) values
  ('ee000000-0000-0000-0000-0000000000ba', 'ee000000-0000-0000-0000-0000000000a2', 'EV public with Ines', 'networking', 'dubai', 'difc', now() + interval '2 days', 'e-d1');

-- Server role: a finished plan and one removed by the team.
select pg_temp.as_admin();
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, event_key) values
  ('ee000000-0000-0000-0000-0000000000bb', 'ee000000-0000-0000-0000-0000000000a3', 'EV finished', 'networking', 'dubai', 'difc', now() - interval '5 hours', 'e-d1'),
  ('ee000000-0000-0000-0000-0000000000bc', 'ee000000-0000-0000-0000-0000000000a3', 'EV removed by IRLY', 'networking', 'dubai', 'difc', now() + interval '2 days', 'e-d1');
update public.activities set moderated_at = now() where id = 'ee000000-0000-0000-0000-0000000000bc';

-- ═════════════════════════ LIST ═════════════════════════

-- Nadia (woman, club and circle owner): everything she may see, nothing she may not.
select pg_temp.as_user('ee000000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.seen('e-d1') = array['EV circle plan', 'EV club members', 'EV girls with Nadia', 'EV public with Bruno', 'EV public with Ines', 'EV public with Marc'],
  'woman, member: public, women-only and members-only plans; never cancelled, deleted, finished, removed, friends-only or another event''s');
select pg_temp.check(pg_temp.seen('e-d2') = array['EV other event'], 'each event lists its own plans');
select pg_temp.check((select going = 1 and my_status = 'going' and creator_name = 'Nadia' and community_name = 'Event Test Club'
  from public.event_activities('e-d1') where id = 'ee000000-0000-0000-0000-0000000000b3'), 'card: count, my status, host and community name');
select pg_temp.check(pg_temp.seen('e-zz9') = '{}', 'an event nobody planned for: empty list');

-- Ines (woman, not in the club, blocked Bruno).
select pg_temp.as_user('ee000000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.seen('e-d1') = array['EV circle plan', 'EV girls with Nadia', 'EV public with Ines', 'EV public with Marc'],
  'woman outside the club: women-only plans yes, members-only no, the man she blocked no');

-- Marc (man, club member).
select pg_temp.as_user('ee000000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.seen('e-d1') = array['EV club members', 'EV public with Bruno', 'EV public with Ines', 'EV public with Marc'],
  'man, member: the members-only plan yes, no women-only plan');
select pg_temp.check(not exists (select 1 from public.event_activities('e-d1') where girl_only), 'man: not one women-only plan on the event page');

-- Omar (man, outsider).
select pg_temp.as_user('ee000000-0000-0000-0000-0000000000a4');
select pg_temp.check(pg_temp.seen('e-d1') = array['EV public with Bruno', 'EV public with Ines', 'EV public with Marc'],
  'outsider man: public plans only (no women-only, no members-only)');
-- Join from the event page: the count and his status follow.
select public.join_activity('ee000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select going = 2 and my_status = 'going' from public.event_activities('e-d1') where id = 'ee000000-0000-0000-0000-0000000000b1'),
  'join from the event page: going 2, his status going');

-- Bruno (blocked by Ines): her plan is hidden from him too.
select pg_temp.as_user('ee000000-0000-0000-0000-0000000000a5');
select pg_temp.check(pg_temp.seen('e-d1') = array['EV public with Bruno', 'EV public with Marc'],
  'blocked man: not the plan of the woman who blocked him (nor any women-only one)');

-- A man who once got into a women-only plan (data from before a rule) still never sees it listed.
select pg_temp.as_admin();
insert into public.activity_participants (activity_id, user_id, status) values ('ee000000-0000-0000-0000-0000000000b2', 'ee000000-0000-0000-0000-0000000000a4', 'going')
on conflict do nothing;
select pg_temp.as_user('ee000000-0000-0000-0000-0000000000a4');
select pg_temp.check(not exists (select 1 from public.event_activities('e-d1') where id = 'ee000000-0000-0000-0000-0000000000b2'),
  'man holding a participation: the women-only plan stays off his event page');
select pg_temp.as_admin();
delete from public.activity_participants where activity_id = 'ee000000-0000-0000-0000-0000000000b2' and user_id = 'ee000000-0000-0000-0000-0000000000a4';

-- ═════════════════════════ GUARDS ═════════════════════════

select pg_temp.as_user('ee000000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails($$select * from public.event_activities('not an event')$$) = '22023', 'a malformed key: refused');
select pg_temp.check(pg_temp.fails($$select * from public.event_activities(null)$$) = '22023', 'no key: refused');
-- The host cannot move a plan under another event, can unlink it.
select pg_temp.check(pg_temp.fails($$update public.activities set event_key = 'e-d2' where id = 'ee000000-0000-0000-0000-0000000000b1'$$) = '42501',
  'host: a plan cannot move to another event');
update public.activities set event_key = null where id = 'ee000000-0000-0000-0000-0000000000b1';
select pg_temp.check(not exists (select 1 from public.event_activities('e-d1') where id = 'ee000000-0000-0000-0000-0000000000b1'), 'host: an unlinked plan leaves the event page');
select pg_temp.check(pg_temp.fails($$update public.activities set event_key = 'e-d1' where id = 'ee000000-0000-0000-0000-0000000000b1'$$) = '42501',
  'host: an unlinked plan cannot be linked again afterwards');
-- Signed out: refused.
select pg_temp.as_admin();
set role authenticated;
select pg_temp.check(pg_temp.fails($$select * from public.event_activities('e-d1')$$) = '42501', 'signed out: refused');
reset role;
-- anon cannot call it at all.
set role anon;
select pg_temp.check(pg_temp.fails($$select * from public.event_activities('e-d1')$$) = '42501', 'anon: no access');
reset role;

-- ───────── Clean up ─────────
select pg_temp.as_admin();
delete from public.activities where creator_id in (select id from auth.users where id::text like 'ee000000-%');
delete from public.communities where id in ('ee000000-0000-0000-0000-0000000000c1', 'ee000000-0000-0000-0000-0000000000c2');
delete from public.blocks where blocker_id = 'ee000000-0000-0000-0000-0000000000a2';
delete from public.profiles where id::text like 'ee000000-%';
delete from auth.users where id::text like 'ee000000-%';
