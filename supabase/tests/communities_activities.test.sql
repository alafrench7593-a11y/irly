-- Communities, activities and the IRLY Map, end to end on the server, with
-- two (and more) members switching sessions as the app does (auth.uid() is
-- the signed-in member). Journey C: create → publish → list → map → open →
-- join → notification → edit → every view updated → cancel → delete.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed c0aa0000-….
--
--   a1 Nadia  woman, Dubai: creates the community and hosts the activities
--   a2 Karim  man, Dubai: joins, is promoted, leaves
--   a3 Sari   woman, Bali: hosts a Bali plan (time zone UTC+8)
--   a4 Leo    man: finds the plan full, cannot enter IRLY Girl
--   a5 Mia    woman who hides her plans from others (activity_visibility)
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
    raise exception 'FAIL communities_activities: %', label;
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
-- Rows a statement changed (0 when row level security hid every row).
create or replace function pg_temp.changed(stmt text) returns integer language plpgsql as $$
declare n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;

-- ───────── Test accounts (server role) ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('c0aa0000-0000-0000-0000-0000000000a1'), ('c0aa0000-0000-0000-0000-0000000000a2'),
  ('c0aa0000-0000-0000-0000-0000000000a3'), ('c0aa0000-0000-0000-0000-0000000000a4'),
  ('c0aa0000-0000-0000-0000-0000000000a5');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c0aa0000-0000-0000-0000-0000000000a1', 'Nadia', '1993-03-03', 'woman', 'dubai'),
  ('c0aa0000-0000-0000-0000-0000000000a2', 'Karim', '1991-05-05', 'man', 'dubai'),
  ('c0aa0000-0000-0000-0000-0000000000a3', 'Sari', '1995-07-07', 'woman', 'bali'),
  ('c0aa0000-0000-0000-0000-0000000000a4', 'Leo', '1990-09-09', 'man', 'dubai'),
  ('c0aa0000-0000-0000-0000-0000000000a5', 'Mia', '1996-11-11', 'woman', 'dubai');
insert into public.safety_settings (user_id, activity_visibility) values ('c0aa0000-0000-0000-0000-0000000000a5', 'nobody')
on conflict (user_id) do update set activity_visibility = 'nobody';
-- A listed place with a position (what puts a plan on the map), and a second one to move it to.
insert into public.places (id, slug, city_id, name, kind, lat, lng) values
  ('c0aa0000-0000-0000-0000-0000000000f1', 'c0aa-kite-beach', 'dubai', 'Kite Beach', 'beach', 25.15800, 55.19700),
  ('c0aa0000-0000-0000-0000-0000000000f2', 'c0aa-jlt-park', 'dubai', 'JLT Park', 'park', 25.07000, 55.14000);

-- ═════════════════════════ COMMUNITIES ═════════════════════════

-- ───────── Create (as the app: create_community) ─────────
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a1');
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;
insert into ids values ('club', public.create_community('Dubai Sunrise Runners', 'dubai', 'Runs at 6', 'Every morning on the beach', 'sport', false));
select pg_temp.check((select v from ids where k = 'club') is not null, 'create_community returns the new id');
select pg_temp.check(public.create_community('Dubai Sunrise Runners', 'dubai', 'Runs at 6', 'Every morning on the beach', 'sport', false) = (select v from ids where k = 'club'),
  'double tap / network retry: the same request gives back the same community');
select pg_temp.check((select count(*) from public.communities where name = 'Dubai Sunrise Runners') = 1, 'double tap: one community stored, not two');
select pg_temp.check(pg_temp.fails($$select public.create_community('ab', 'dubai')$$) = '23514', 'a 2-letter name is refused by the server');
select pg_temp.check(pg_temp.fails($$select public.create_community('   ', 'dubai')$$) is not null, 'a blank name is refused by the server');
select pg_temp.check(pg_temp.fails($$select public.create_community('Nowhere Club', 'atlantis')$$) is not null, 'an unknown city is refused (it would be listed nowhere)');
select pg_temp.check((select members = 1 and is_member and my_role = 'owner' and conversation_id is not null
  from public.community_detail((select v from ids where k = 'club'))), 'creator: owner, counted, has the chat');
select pg_temp.check((select members_count from public.communities where id = (select v from ids where k = 'club')) = 1, 'members_count starts at 1 (the owner)');
select pg_temp.check(exists (select 1 from public.member_communities('c0aa0000-0000-0000-0000-0000000000a1') where id = (select v from ids where k = 'club') and role = 'created'),
  'creator: in « my communities » as created');
-- The insert path the RPC uses cannot be abused to skip its checks.
select pg_temp.check(pg_temp.fails($$insert into public.communities (city_id, name, created_by, members_count) values ('dubai', 'Inflated Club', 'c0aa0000-0000-0000-0000-0000000000a1', 999)$$) is null,
  'direct insert (the API path): accepted for its owner');
select pg_temp.check((select members_count from public.communities where name = 'Inflated Club') = 1, 'direct insert: members_count cannot be forged (starts at the owner)');

-- ───────── Another member sees it and joins ─────────
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a2');
select pg_temp.check(exists (select 1 from public.community_list('dubai') where id = (select v from ids where k = 'club') and not is_member), 'Karim: listed, not a member yet');
select pg_temp.check(public.join_community((select v from ids where k = 'club')) is not null, 'Karim: join_community answers the chat id');
select pg_temp.check(public.join_community((select v from ids where k = 'club')) is not null, 'Karim: joining twice is harmless');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.community_members where community_id = (select v from ids where k = 'club') and user_id = 'c0aa0000-0000-0000-0000-0000000000a2') = 1, 'server: one membership row, not two');
select pg_temp.check((select members_count from public.communities where id = (select v from ids where k = 'club')) = 2, 'members_count: 2 after a join and a repeated join');
select pg_temp.check((select count(*) from public.notifications where user_id = 'c0aa0000-0000-0000-0000-0000000000a2' and kind = 'COMMUNITY_JOINED'
  and payload ->> 'community_id' = (select v from ids where k = 'club')::text) = 1, 'notification COMMUNITY_JOINED: once, not per tap');
select pg_temp.check(exists (select 1 from public.conversation_members cm join public.conversations c on c.id = cm.conversation_id
  where c.community_id = (select v from ids where k = 'club') and cm.user_id = 'c0aa0000-0000-0000-0000-0000000000a2'), 'server: Karim is in the community chat');
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a2');
select pg_temp.check((select is_member and my_role = 'member' and members = 2 from public.community_detail((select v from ids where k = 'club'))), 'Karim: member state, count 2');
select pg_temp.check(exists (select 1 from public.member_communities('c0aa0000-0000-0000-0000-0000000000a2') where id = (select v from ids where k = 'club') and role = 'joined'),
  'Karim: in « my communities » as joined');

-- ───────── An ordinary member cannot run the community ─────────
select pg_temp.check(pg_temp.changed($$update public.communities set name = 'Hijacked', description = 'mine now' where id = (select v from ids where k = 'club')$$) = 0,
  'member: cannot edit the name/description (0 rows)');
select pg_temp.check(pg_temp.fails($$select public.set_community_role((select v from ids where k = 'club'), 'c0aa0000-0000-0000-0000-0000000000a2', 'moderator')$$) = '42501',
  'member: cannot promote himself');
select pg_temp.check(pg_temp.fails($$select public.delete_community((select v from ids where k = 'club'))$$) = '42501', 'member: cannot delete the community');
select pg_temp.check(pg_temp.fails($$select public.set_community_cover((select v from ids where k = 'club'), 'c0aa0000-0000-0000-0000-0000000000a2/x.jpg')$$) is not null,
  'member: cannot change the cover');
select pg_temp.check(pg_temp.fails($$insert into public.community_members (community_id, user_id, role) values ((select v from ids where k = 'club'), 'c0aa0000-0000-0000-0000-0000000000a4', 'owner')$$) is not null,
  'member: cannot write memberships directly (no owner forged)');
select pg_temp.check(pg_temp.changed($$update public.community_members set role = 'owner' where community_id = (select v from ids where k = 'club') and user_id = 'c0aa0000-0000-0000-0000-0000000000a2'$$) = 0,
  'member: cannot make himself owner by an update');

-- ───────── The owner manages ─────────
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.changed($$update public.communities set description = 'Every morning at 6 on Kite Beach' where id = (select v from ids where k = 'club')$$) = 1, 'owner: edits the description');
select pg_temp.fails($$update public.communities set members_count = 500 where id = (select v from ids where k = 'club')$$);
select pg_temp.check((select members_count from public.communities where id = (select v from ids where k = 'club')) = 2, 'owner: cannot forge members_count');
select public.set_community_role((select v from ids where k = 'club'), 'c0aa0000-0000-0000-0000-0000000000a2', 'moderator');
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a2');
select pg_temp.check((select can_moderate and not is_owner from public.community_rights((select v from ids where k = 'club'))), 'Karim promoted: moderator rights, not owner');
select pg_temp.check((select my_role from public.community_detail((select v from ids where k = 'club'))) = 'moderator', 'Karim: detail shows moderator');
select pg_temp.check(pg_temp.changed($$update public.communities set name = 'Moderator Rename' where id = (select v from ids where k = 'club')$$) = 0,
  'moderator: admin settings (name) stay the owner''s');

-- ───────── Leave ─────────
select public.leave_community((select v from ids where k = 'club'));
select pg_temp.check(not (select is_member from public.community_detail((select v from ids where k = 'club'))), 'Karim left: not a member');
select pg_temp.check((select members from public.community_detail((select v from ids where k = 'club'))) = 1, 'Karim left: count back to 1');
select pg_temp.check(not exists (select 1 from public.member_communities('c0aa0000-0000-0000-0000-0000000000a2') where id = (select v from ids where k = 'club')), 'Karim left: not in « my communities »');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.conversation_members cm join public.conversations c on c.id = cm.conversation_id
  where c.community_id = (select v from ids where k = 'club') and cm.user_id = 'c0aa0000-0000-0000-0000-0000000000a2'), 'Karim left: out of the chat');
select pg_temp.check(exists (select 1 from public.sync_signals where user_id = 'c0aa0000-0000-0000-0000-0000000000a2'), 'Karim left: his other sessions get a sync signal');
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a1');
-- The owner is never offered « Leave » (the app shows Delete); a direct call leaves her owner.
select public.leave_community((select v from ids where k = 'club'));
select pg_temp.check((select my_role from public.community_detail((select v from ids where k = 'club'))) = 'owner', 'owner: leave_community leaves her owner (nobody to run it otherwise)');

-- ───────── IRLY Girl communities ─────────
insert into ids values ('girlclub', public.create_community('Dubai Girls Brunch', 'dubai', null, null, 'food', true));
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.communities where id = (select v from ids where k = 'girlclub')), 'man: does not see the IRLY Girl community');
select pg_temp.check(not exists (select 1 from public.community_list('dubai') where id = (select v from ids where k = 'girlclub')), 'man: not in his community list');
select pg_temp.check(pg_temp.fails($$select public.join_community((select v from ids where k = 'girlclub'))$$) = '42501', 'man: join refused');
select pg_temp.check(public.join_communities(array[(select v from ids where k = 'girlclub')]) = 0, 'man: bulk join skips it');
select pg_temp.check(pg_temp.fails($$select public.create_community('Not For Me', 'dubai', null, null, null, true)$$) = '42501', 'man: cannot create an IRLY Girl community');
select pg_temp.check(pg_temp.fails($$insert into public.communities (city_id, name, created_by, girl_only) values ('dubai', 'Sneaky Girls', 'c0aa0000-0000-0000-0000-0000000000a2', true)$$) is not null,
  'man: direct insert of an IRLY Girl community refused');
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a5');
select pg_temp.check(public.join_community((select v from ids where k = 'girlclub')) is not null, 'woman: joins the IRLY Girl community');

-- ───────── Counts stay exact ─────────
select pg_temp.as_admin();
select pg_temp.check(not exists (
  select 1 from public.communities c
  where c.name in ('Dubai Sunrise Runners', 'Dubai Girls Brunch', 'Inflated Club')
    and c.members_count <> (select count(*) from public.community_members m where m.community_id = c.id)
), 'members_count equals the membership rows (trigger, not the client)');

-- ═════════════════════════ ACTIVITIES ═════════════════════════

-- ───────── Create (as the app: insert with a client_ref) ─────────
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a1');
-- 19:00 in Dubai (UTC+4) = 15:00 UTC, sent as an instant; the phone says Bali by mistake.
insert into public.activities (id, creator_id, title, description, category_id, city_id, area_id, place_name, place_id, starts_at,
  price_minor, currency, capacity, privacy, client_ref, timezone)
values ('c0aa0000-0000-0000-0000-0000000000b1', 'c0aa0000-0000-0000-0000-0000000000a1', 'Sunset run', 'Easy 5 km', 'sport', 'dubai', 'jumeirah', 'Kite Beach',
  'c0aa0000-0000-0000-0000-0000000000f1', date_trunc('day', now() + interval '3 days') + interval '15 hours',
  0, 'AED', 3, 'public', 'c0aa0000-0000-0000-0000-0000000000e1', 'Asia/Makassar');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, client_ref)
  values ('c0aa0000-0000-0000-0000-0000000000a1', 'Sunset run', 'sport', 'dubai', 'jumeirah', now() + interval '3 days', 'c0aa0000-0000-0000-0000-0000000000e1')$$) = '23505',
  'double tap / retry: a second row with the same client_ref is refused');
select pg_temp.check((select timezone from public.activities where id = 'c0aa0000-0000-0000-0000-0000000000b1') = 'Asia/Dubai', 'time zone: a Dubai plan is stored in Asia/Dubai whatever the phone sent');
select pg_temp.check((select to_char(starts_at at time zone 'UTC', 'HH24:MI') from public.activities where id = 'c0aa0000-0000-0000-0000-0000000000b1') = '15:00'
  and (select to_char(starts_at at time zone timezone, 'HH24:MI') from public.activities where id = 'c0aa0000-0000-0000-0000-0000000000b1') = '19:00',
  'time zone: stored as UTC 15:00, reads 19:00 in Dubai');
select pg_temp.check((select lat is not null and geo_source = 'place' from public.activities where id = 'c0aa0000-0000-0000-0000-0000000000b1'), 'position: taken from the listed place');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at)
  values ('c0aa0000-0000-0000-0000-0000000000a1', 'ab', 'sport', 'dubai', 'jumeirah', now() + interval '1 day')$$) = '23514', 'validation: a 2-letter title is refused');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, capacity)
  values ('c0aa0000-0000-0000-0000-0000000000a1', 'Solo run', 'sport', 'dubai', 'jumeirah', now() + interval '1 day', 1)$$) = '23514', 'validation: capacity 1 is refused');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, price_minor)
  values ('c0aa0000-0000-0000-0000-0000000000a1', 'Paid run', 'sport', 'dubai', 'jumeirah', now() + interval '1 day', -5)$$) = '23514', 'validation: a negative price is refused');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at)
  values ('c0aa0000-0000-0000-0000-0000000000a2', 'Fake host', 'sport', 'dubai', 'jumeirah', now() + interval '1 day')$$) = '42501', 'organizer: nobody publishes in another member''s name');
select pg_temp.check((select going = 1 and my_status = 'going' and conversation_id is not null from public.activity_detail('c0aa0000-0000-0000-0000-0000000000b1')),
  'host: counted as going, has the chat');

-- Bali: 19:00 in Bali (UTC+8) = 11:00 UTC.
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a3');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, timezone)
values ('c0aa0000-0000-0000-0000-0000000000b3', 'c0aa0000-0000-0000-0000-0000000000a3', 'Canggu sunset surf', 'sport', 'bali', 'canggu',
  date_trunc('day', now() + interval '3 days') + interval '11 hours', 'Asia/Dubai');
select pg_temp.check((select timezone = 'Asia/Makassar' and to_char(starts_at at time zone timezone, 'HH24:MI') = '19:00'
  from public.activities where id = 'c0aa0000-0000-0000-0000-0000000000b3'), 'time zone: a Bali plan is Asia/Makassar, 11:00 UTC reads 19:00 in Bali');

-- ───────── Listed and on the map for another member ─────────
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a2');
select pg_temp.check(exists (select 1 from public.activities where id = 'c0aa0000-0000-0000-0000-0000000000b1' and cancelled_at is null and not girl_only),
  'Karim: the new plan is in his list (what useServerActivities reads)');
select pg_temp.check(exists (select 1 from public.map_activities('dubai', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b1' and going = 1 and capacity = 3),
  'Karim: on the IRLY map, 1 going of 3');
select pg_temp.check(not exists (select 1 from public.map_activities('bali', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b1'), 'region: not on the Bali map');
select pg_temp.check(exists (select 1 from public.map_activities('dubai', p_category => 'sport', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b1')
  and not exists (select 1 from public.map_activities('dubai', p_category => 'food', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b1'), 'map: category filter');
select pg_temp.check(not exists (select 1 from public.map_activities('dubai', p_to => now() + interval '1 day', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b1'),
  'map: « today » filter leaves out a plan in 3 days');
select pg_temp.check(exists (select 1 from public.map_activities('dubai', p_lat => 25.158, p_lng => 55.197, p_km => 2, p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b1')
  and not exists (select 1 from public.map_activities('dubai', p_lat => 25.30, p_lng => 55.45, p_km => 2, p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b1'), 'map: distance filter');
select pg_temp.check(not exists (select 1 from public.map_activities('dubai', p_girl_only => true) where false) and pg_temp.fails($$select * from public.map_activities('dubai', p_girl_only => true)$$) = '42501',
  'map: a man cannot open the IRLY Girl map');

-- ───────── Join → notification, counts everywhere ─────────
select pg_temp.check(public.join_activity('c0aa0000-0000-0000-0000-0000000000b1', 'going') = 'going', 'Karim: joins');
select pg_temp.check(public.join_activity('c0aa0000-0000-0000-0000-0000000000b1', 'going') = 'going', 'Karim: joining twice is harmless');
select pg_temp.check((select going from public.activity_detail('c0aa0000-0000-0000-0000-0000000000b1')) = 2, 'detail: 2 going (not 3 after a repeated join)');
select pg_temp.check((select going from public.map_activities('dubai', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b1') = 2, 'map: 2 going');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.notifications where user_id = 'c0aa0000-0000-0000-0000-0000000000a1' and kind = 'ACTIVITY_JOINED'
  and payload ->> 'activity_id' = 'c0aa0000-0000-0000-0000-0000000000b1' and payload ->> 'user_id' = 'c0aa0000-0000-0000-0000-0000000000a2') = 1,
  'host: notified once that Karim joined');
-- Mia joins too: she hides her plans from others, the counts still count her.
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a5');
select pg_temp.check(public.join_activity('c0aa0000-0000-0000-0000-0000000000b1', 'going') = 'going', 'Mia: joins (last spot)');
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a4');
select pg_temp.check((select going from public.activity_detail('c0aa0000-0000-0000-0000-0000000000b1')) = 3, 'Leo: detail says 3 going');
select pg_temp.check((select going from public.map_activities('dubai', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b1') = 3,
  'Leo: the map says 3 going too (same count as the detail, hidden participants included)');
select pg_temp.check((select a.going from public.activities a where a.id = 'c0aa0000-0000-0000-0000-0000000000b1') = 3, 'Leo: lists (activities.going) say 3');

-- ───────── Capacity (server side, row locked) ─────────
select pg_temp.check(public.join_activity('c0aa0000-0000-0000-0000-0000000000b1', 'going') = 'full', 'Leo: full (3 of 3)');
select pg_temp.check(public.join_activity('c0aa0000-0000-0000-0000-0000000000b1', 'maybe') = 'maybe', 'Leo: « maybe » does not take a spot');
select pg_temp.check(public.join_activity('c0aa0000-0000-0000-0000-0000000000b1', 'going') = 'full', 'Leo: still full when switching maybe → going');
select pg_temp.check((select going from public.activity_detail('c0aa0000-0000-0000-0000-0000000000b1')) = 3, 'capacity never exceeded');
select public.leave_activity('c0aa0000-0000-0000-0000-0000000000b1');

-- ───────── Others cannot edit; the host edits; everyone sees it ─────────
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.changed($$update public.activities set title = 'Hijacked run' where id = 'c0aa0000-0000-0000-0000-0000000000b1'$$) = 0, 'participant: cannot edit the plan');
select pg_temp.check(pg_temp.changed($$update public.activities set cancelled_at = now() where id = 'c0aa0000-0000-0000-0000-0000000000b1'$$) = 0, 'participant: cannot cancel the plan');
select pg_temp.check(pg_temp.fails($$select public.delete_activity('c0aa0000-0000-0000-0000-0000000000b1')$$) = 'P0002', 'participant: cannot delete the plan');
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($$update public.activities set capacity = 2 where id = 'c0aa0000-0000-0000-0000-0000000000b1'$$) = '22023', 'host: capacity cannot go below the people going');
select pg_temp.check(pg_temp.changed($$update public.activities set title = 'Sunset run 7 km', capacity = 6, price_minor = 2500,
  starts_at = starts_at + interval '1 hour', place_name = 'JLT Park', place_id = 'c0aa0000-0000-0000-0000-0000000000f2'
  where id = 'c0aa0000-0000-0000-0000-0000000000b1'$$) = 1, 'host: edits title, spots, price, time and place');
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a2');
select pg_temp.check((select title = 'Sunset run 7 km' and capacity = 6 and price_minor = 2500 and place_name = 'JLT Park'
  and to_char(starts_at at time zone 'Asia/Dubai', 'HH24:MI') = '20:00' from public.activity_detail('c0aa0000-0000-0000-0000-0000000000b1')), 'Karim: detail shows the edit (20:00 Dubai)');
select pg_temp.check((select abs(lat - 25.07) < 0.001 and abs(lng - 55.14) < 0.001 and title = 'Sunset run 7 km'
  from public.map_activities('dubai', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b1'), 'Karim: the map pin moved to the new place');
select pg_temp.check((select title from public.conversations where activity_id = 'c0aa0000-0000-0000-0000-0000000000b1') = 'Sunset run 7 km', 'chat title follows the edit');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'c0aa0000-0000-0000-0000-0000000000a2' and kind = 'ACTIVITY_UPDATED'
  and payload ->> 'activity_id' = 'c0aa0000-0000-0000-0000-0000000000b1' and not (payload ->> 'cancelled')::boolean), 'Karim: notified of the new time/place');
select pg_temp.check(not exists (select 1 from public.notifications where user_id = 'c0aa0000-0000-0000-0000-0000000000a1' and kind = 'ACTIVITY_UPDATED'
  and payload ->> 'activity_id' = 'c0aa0000-0000-0000-0000-0000000000b1'), 'host: not notified of her own edit');

-- The edit sheet changes the place by its name: the pin follows (never left at the old spot).
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, place_name, place_id, starts_at)
values ('c0aa0000-0000-0000-0000-0000000000b7', 'c0aa0000-0000-0000-0000-0000000000a1', 'Beach volley', 'sport', 'dubai', 'jumeirah', 'Kite Beach',
  'c0aa0000-0000-0000-0000-0000000000f1', now() + interval '2 days');
update public.activities set place_name = 'Kite Beach, court 3' where id = 'c0aa0000-0000-0000-0000-0000000000b7';
select pg_temp.check(exists (select 1 from public.map_activities('dubai', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b7' and abs(lat - 25.158) < 0.001),
  'edit: a detail added to the place name keeps the pin');
update public.activities set place_name = 'Marina Walk' where id = 'c0aa0000-0000-0000-0000-0000000000b7';
select pg_temp.check(not exists (select 1 from public.map_activities('dubai', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b7'),
  'edit: moved to another place by name, the old pin is gone (never a wrong point)');
select pg_temp.check((select place_name = 'Marina Walk' and place_id is null from public.activities where id = 'c0aa0000-0000-0000-0000-0000000000b7'), 'edit: the new place name is kept');
update public.activities set place_id = 'c0aa0000-0000-0000-0000-0000000000f2', place_name = 'JLT Park' where id = 'c0aa0000-0000-0000-0000-0000000000b7';
select pg_temp.check(exists (select 1 from public.map_activities('dubai', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b7' and abs(lat - 25.07) < 0.001),
  'edit: a listed place chosen again puts it back on the map');

-- ───────── Leave and rejoin ─────────
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a2');
select public.leave_activity('c0aa0000-0000-0000-0000-0000000000b1');
select pg_temp.check((select going from public.activity_detail('c0aa0000-0000-0000-0000-0000000000b1')) = 2 and (select my_status from public.activity_detail('c0aa0000-0000-0000-0000-0000000000b1')) is null,
  'Karim left: 2 going, no status');
select pg_temp.check(public.join_activity('c0aa0000-0000-0000-0000-0000000000b1', 'going') = 'going', 'Karim: rejoins');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.notifications where user_id = 'c0aa0000-0000-0000-0000-0000000000a1' and kind = 'ACTIVITY_JOINED'
  and payload ->> 'user_id' = 'c0aa0000-0000-0000-0000-0000000000a2' and payload ->> 'activity_id' = 'c0aa0000-0000-0000-0000-0000000000b1') = 1, 'host: a rejoin does not notify twice');

-- ───────── Cancel: gone from availability everywhere ─────────
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.changed($$update public.activities set cancelled_at = now() where id = 'c0aa0000-0000-0000-0000-0000000000b1'$$) = 1, 'host: cancels');
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a4');
select pg_temp.check(not exists (select 1 from public.activities where id = 'c0aa0000-0000-0000-0000-0000000000b1'), 'Leo (not going): the cancelled plan is gone from his lists');
select pg_temp.check(not exists (select 1 from public.map_activities('dubai', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b1'), 'Leo: gone from the map');
select pg_temp.check(pg_temp.fails($$select public.join_activity('c0aa0000-0000-0000-0000-0000000000b1', 'going')$$) = 'P0002', 'Leo: cannot join a cancelled plan');
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a2');
select pg_temp.check((select cancelled from public.activity_detail('c0aa0000-0000-0000-0000-0000000000b1')), 'Karim (going): his page says cancelled');
select pg_temp.check(not exists (select 1 from public.map_activities('dubai', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b1'), 'Karim: gone from his map');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'c0aa0000-0000-0000-0000-0000000000a2' and kind = 'ACTIVITY_UPDATED'
  and payload ->> 'activity_id' = 'c0aa0000-0000-0000-0000-0000000000b1' and (payload ->> 'cancelled')::boolean), 'Karim: notified of the cancellation');
select pg_temp.check(exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
  where c.activity_id = 'c0aa0000-0000-0000-0000-0000000000b1' and m.kind = 'system' and m.body like '%cancelled%'), 'the chat says it was cancelled');

-- ───────── Delete: participants told, nothing left behind ─────────
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, place_id, starts_at, community_id, privacy)
values ('c0aa0000-0000-0000-0000-0000000000b2', 'c0aa0000-0000-0000-0000-0000000000a1', 'Club long run', 'sport', 'dubai', 'jumeirah',
  'c0aa0000-0000-0000-0000-0000000000f1', now() + interval '2 days', (select v from ids where k = 'club'), 'community');
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a4');
select pg_temp.check(not exists (select 1 from public.activities where id = 'c0aa0000-0000-0000-0000-0000000000b2'), 'visibility: a community plan is hidden from non-members');
select pg_temp.check(not exists (select 1 from public.map_activities('dubai', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b2'), 'visibility: … and from their map');
select pg_temp.check(pg_temp.fails($$select public.join_activity('c0aa0000-0000-0000-0000-0000000000b2', 'going')$$) = 'P0002', 'visibility: … and they cannot join it');
select public.join_community((select v from ids where k = 'club'));
select pg_temp.check(public.join_activity('c0aa0000-0000-0000-0000-0000000000b2', 'going') = 'going', 'Leo joined the community: he can join its plan');
select pg_temp.check(exists (select 1 from public.community_activities((select v from ids where k = 'club'), false, 20) where id = 'c0aa0000-0000-0000-0000-0000000000b2'), 'the plan is in the community''s list');
select pg_temp.check(exists (select 1 from public.map_activities('dubai', p_community => (select v from ids where k = 'club'), p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b2'),
  'map: community filter');
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a1');
select public.delete_activity('c0aa0000-0000-0000-0000-0000000000b2');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.activities where id = 'c0aa0000-0000-0000-0000-0000000000b2'), 'delete: the plan is gone');
select pg_temp.check(not exists (select 1 from public.conversations where activity_id = 'c0aa0000-0000-0000-0000-0000000000b2'), 'delete: its chat is gone');
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'c0aa0000-0000-0000-0000-0000000000a4' and kind = 'ACTIVITY_UPDATED'
  and payload ->> 'activity_id' = 'c0aa0000-0000-0000-0000-0000000000b2' and payload ->> 'change' = 'deleted'), 'delete: Leo (going) is told');
select pg_temp.check(not exists (select 1 from public.notifications where user_id = 'c0aa0000-0000-0000-0000-0000000000a1' and kind = 'ACTIVITY_JOINED'
  and payload ->> 'activity_id' = 'c0aa0000-0000-0000-0000-0000000000b2'), 'delete: the host''s « joined » notifications for it are cleaned up');

-- ───────── IRLY Girl plans ─────────
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, place_id, starts_at, girl_only, audience)
values ('c0aa0000-0000-0000-0000-0000000000b4', 'c0aa0000-0000-0000-0000-0000000000a1', 'Girls sunrise yoga', 'wellness', 'dubai', 'jumeirah',
  'c0aa0000-0000-0000-0000-0000000000f1', now() + interval '2 days', true, 'girls');
select pg_temp.check(exists (select 1 from public.map_activities('dubai', p_girl_only => true) where id = 'c0aa0000-0000-0000-0000-0000000000b4'), 'IRLY Girl map: shows the women-only plan');
select pg_temp.check(not exists (select 1 from public.map_activities('dubai', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b4'), 'IRLY (mixte) map: never shows it');
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.activities where id = 'c0aa0000-0000-0000-0000-0000000000b4'), 'man: does not see the women-only plan');
select pg_temp.check(not exists (select 1 from public.map_activities('dubai') where id = 'c0aa0000-0000-0000-0000-0000000000b4'), 'man: not on any map he can open');
select pg_temp.check(pg_temp.fails($$select public.join_activity('c0aa0000-0000-0000-0000-0000000000b4', 'going')$$) is not null, 'man: cannot join it');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience)
  values ('c0aa0000-0000-0000-0000-0000000000a2', 'Fake girls plan', 'sport', 'dubai', 'jumeirah', now() + interval '1 day', true, 'girls')$$) = '42501', 'man: cannot publish an IRLY Girl plan');
-- A plan of an IRLY Girl community is women-only by itself.
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, community_id)
values ('c0aa0000-0000-0000-0000-0000000000b5', 'c0aa0000-0000-0000-0000-0000000000a1', 'Brunch club', 'food', 'dubai', 'marina', now() + interval '2 days', (select v from ids where k = 'girlclub'));
select pg_temp.check((select girl_only from public.activities where id = 'c0aa0000-0000-0000-0000-0000000000b5'), 'a plan of an IRLY Girl community is women-only');

-- ═════════════════════ COMMUNITY DELETION ═════════════════════
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, place_id, starts_at, community_id, privacy)
values ('c0aa0000-0000-0000-0000-0000000000b6', 'c0aa0000-0000-0000-0000-0000000000a1', 'Club tempo run', 'sport', 'dubai', 'jumeirah',
  'c0aa0000-0000-0000-0000-0000000000f1', now() + interval '2 days', (select v from ids where k = 'club'), 'community');
insert into public.community_posts (community_id, author_id, body) values ((select v from ids where k = 'club'), 'c0aa0000-0000-0000-0000-0000000000a1', 'Welcome runners');
select public.delete_community((select v from ids where k = 'club'));
select pg_temp.check(not exists (select 1 from public.community_list('dubai') where id = (select v from ids where k = 'club')), 'deleted: out of the community list');
select pg_temp.check(not exists (select 1 from public.member_communities('c0aa0000-0000-0000-0000-0000000000a1') where id = (select v from ids where k = 'club')), 'deleted: out of « my communities »');
select pg_temp.check(pg_temp.fails($$select public.create_community('Dubai Sunrise Runners', 'dubai')$$) is not null
  or not exists (select 1 from public.communities where id = (select v from ids where k = 'club')), 'deleted: a retried create never brings back the deleted one');
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a4');
select pg_temp.check(not exists (select 1 from public.community_posts where community_id = (select v from ids where k = 'club')), 'deleted: its posts are no longer readable');
select pg_temp.check(pg_temp.fails($$select public.join_community((select v from ids where k = 'club'))$$) = 'P0002', 'deleted: cannot be joined');
select pg_temp.check(not exists (select 1 from public.conversation_members cm join public.conversations c on c.id = cm.conversation_id
  where c.community_id = (select v from ids where k = 'club') and cm.user_id = 'c0aa0000-0000-0000-0000-0000000000a4'), 'deleted: its chat left Leo''s inbox');
select pg_temp.check(not exists (select 1 from public.map_activities('dubai', p_girl_only => false) where id = 'c0aa0000-0000-0000-0000-0000000000b6'),
  'deleted: its members-only plans leave the map of former members');
select pg_temp.check(pg_temp.fails($$select public.join_activity('c0aa0000-0000-0000-0000-0000000000b6', 'going')$$) = 'P0002',
  'deleted: its members-only plans can no longer be joined');


-- The API cannot remove it by a plain update (only delete_community, which cleans up).
select pg_temp.as_user('c0aa0000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($$update public.communities set deleted_at = now() where name = 'Inflated Club' and created_by = 'c0aa0000-0000-0000-0000-0000000000a1'$$) = '42501',
  'owner: a direct update of deleted_at is refused (delete_community only)');

select pg_temp.as_admin();
