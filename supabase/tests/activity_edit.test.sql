-- Editing an activity: public.update_activity and the table's own guard
-- (20261122000000_irly_activity_edit.sql).
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed ae220000-….
--
--   w1 Lina  woman, IRLY Girl access: hosts every plan below, owns both communities
--   w2 Maya  woman, IRLY Girl access: going to the padel evening and the girls brunch
--   m1 Tom   man: going to the padel evening and the club run
--   m2 Rob   man, blocked by Lina
--   m3 Sam   man, outsider (going to nothing)
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
select private.restrict_profile_columns();

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
  if not coalesce(ok, false) then
    raise exception 'FAIL activity_edit: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;
-- The SQLSTATE a statement fails with (null when it succeeds).
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;
-- What a statement says when it fails (null when it succeeds).
create or replace function pg_temp.says(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlerrm;
end $$;
-- Rows a statement touches (0 when row level security hides them all).
create or replace function pg_temp.changed(stmt text) returns integer language plpgsql as $$
declare n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;
-- The same, for a caller who may be refused outright: 0 when no row was touched, -1 when the statement fails.
create or replace function pg_temp.touched(stmt text) returns integer language plpgsql as $$
declare n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when others then
  return -1;
end $$;
-- The host's edit, as the app sends it.
create or replace function pg_temp.edit(aid text, patch text) returns text language sql as $$
  select format('select public.update_activity(%L, %L::jsonb)', aid, patch)
$$;
-- « ACTIVITY_UPDATED » notices of one member about one plan (read as the server).
create or replace function pg_temp.notices(uid text, aid text, unread boolean default false) returns integer
language sql security definer as $$
  select count(*)::integer from public.notifications n
  where n.user_id = uid::uuid and n.kind = 'ACTIVITY_UPDATED' and n.payload ->> 'activity_id' = aid
    and (not unread or n.read_at is null)
$$;

-- ───────── Accounts, communities (server role) ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('ae220000-0000-0000-0000-0000000000a1'), ('ae220000-0000-0000-0000-0000000000a2'),
  ('ae220000-0000-0000-0000-0000000000a3'), ('ae220000-0000-0000-0000-0000000000a4'),
  ('ae220000-0000-0000-0000-0000000000a5');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('ae220000-0000-0000-0000-0000000000a1', 'Lina', '1993-03-03', 'woman', 'dubai'),
  ('ae220000-0000-0000-0000-0000000000a2', 'Maya', '1994-04-04', 'woman', 'dubai'),
  ('ae220000-0000-0000-0000-0000000000a3', 'Tom', '1991-05-05', 'man', 'dubai'),
  ('ae220000-0000-0000-0000-0000000000a4', 'Rob', '1990-06-06', 'man', 'dubai'),
  ('ae220000-0000-0000-0000-0000000000a5', 'Sam', '1989-07-07', 'man', 'dubai');
update public.profiles set verified_at = now()
where id in ('ae220000-0000-0000-0000-0000000000a1', 'ae220000-0000-0000-0000-0000000000a2');
insert into public.communities (id, city_id, name, category_id, girl_only, created_by) values
  ('ae220000-0000-0000-0000-0000000000c1', 'dubai', 'Edit Test Club', 'sport', false, 'ae220000-0000-0000-0000-0000000000a1'),
  ('ae220000-0000-0000-0000-0000000000c2', 'dubai', 'Edit Test Runners', 'sport', false, 'ae220000-0000-0000-0000-0000000000a1');
insert into public.community_members (community_id, user_id, role) values
  ('ae220000-0000-0000-0000-0000000000c1', 'ae220000-0000-0000-0000-0000000000a1', 'owner'),
  ('ae220000-0000-0000-0000-0000000000c1', 'ae220000-0000-0000-0000-0000000000a3', 'member'),
  ('ae220000-0000-0000-0000-0000000000c2', 'ae220000-0000-0000-0000-0000000000a1', 'owner')
on conflict do nothing;
insert into public.blocks (blocker_id, blocked_id) values ('ae220000-0000-0000-0000-0000000000a1', 'ae220000-0000-0000-0000-0000000000a4');

-- ───────── Lina's plans, created as the app does ─────────
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, description, category_id, city_id, area_id, place_name, starts_at, ends_at, capacity, price_minor, currency, privacy, girl_only, audience, community_id) values
  -- b1 the padel evening: mixed, public, 6 spots, free.
  ('ae220000-0000-0000-0000-0000000000b1', 'ae220000-0000-0000-0000-0000000000a1', 'AE padel evening', 'Bring a racket.', 'sport', 'dubai', 'marina', 'Marina courts',
    now() + interval '3 days', now() + interval '3 days 2 hours', 6, 0, 'AED', 'public', false, 'all', null),
  -- b2 the girls brunch: IRLY Girl.
  ('ae220000-0000-0000-0000-0000000000b2', 'ae220000-0000-0000-0000-0000000000a1', 'AE girls brunch', null, 'food', 'dubai', 'jbr', 'JBR',
    now() + interval '4 days', null, null, 0, 'AED', 'public', true, 'girls', null),
  -- b3 will be over, b4 cancelled (below).
  ('ae220000-0000-0000-0000-0000000000b3', 'ae220000-0000-0000-0000-0000000000a1', 'AE yesterday walk', null, 'sport', 'dubai', 'marina', null,
    now() + interval '1 day', now() + interval '1 day 1 hour', null, 0, 'AED', 'public', false, 'all', null),
  ('ae220000-0000-0000-0000-0000000000b4', 'ae220000-0000-0000-0000-0000000000a1', 'AE called off', null, 'sport', 'dubai', 'marina', null,
    now() + interval '2 days', null, null, 0, 'AED', 'public', false, 'all', null),
  -- b5 the club run: in the club, for its members.
  ('ae220000-0000-0000-0000-0000000000b5', 'ae220000-0000-0000-0000-0000000000a1', 'AE club run', null, 'sport', 'dubai', 'marina', null,
    now() + interval '5 days', null, null, 0, 'AED', 'community', false, 'all', 'ae220000-0000-0000-0000-0000000000c1'),
  -- b6 nobody joined it. b7 in Bali, priced in IDR.
  ('ae220000-0000-0000-0000-0000000000b6', 'ae220000-0000-0000-0000-0000000000a1', 'AE solo plan', null, 'sport', 'dubai', 'marina', null,
    now() + interval '6 days', null, null, 0, 'AED', 'public', false, 'all', null),
  ('ae220000-0000-0000-0000-0000000000b7', 'ae220000-0000-0000-0000-0000000000a1', 'AE Bali surf', null, 'sport', 'bali', 'canggu', null,
    now() + interval '6 days', null, null, 5000000, 'IDR', 'public', false, 'all', null);
update public.activities set cancelled_at = now() where id = 'ae220000-0000-0000-0000-0000000000b4';
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a2');
select public.join_activity('ae220000-0000-0000-0000-0000000000b1', 'going');
select public.join_activity('ae220000-0000-0000-0000-0000000000b2', 'going');
select public.join_activity('ae220000-0000-0000-0000-0000000000b3', 'going');
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a3');
select public.join_activity('ae220000-0000-0000-0000-0000000000b1', 'going');
select public.join_activity('ae220000-0000-0000-0000-0000000000b5', 'going');
-- The walk happened yesterday (the server's clock, not a member's edit).
select pg_temp.as_admin();
update public.activities set starts_at = now() - interval '5 hours', ends_at = now() - interval '3 hours' where id = 'ae220000-0000-0000-0000-0000000000b3';
delete from public.notifications where user_id::text like 'ae220000-%';

-- ═════════════════════════ WHO MAY EDIT ═════════════════════════

select pg_temp.as_anon();
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"title": "Anon was here"}')) = '42501', 'anonymous: update_activity is not callable');
select pg_temp.check(pg_temp.touched($$update public.activities set title = 'Anon was here' where id = 'ae220000-0000-0000-0000-0000000000b1'$$) <= 0, 'anonymous: the table changes nothing either');
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a5');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"title": "Sam was here"}')) = 'P0002', 'a non-creator cannot edit (activity not found)');
select pg_temp.check(pg_temp.changed($$update public.activities set title = 'Sam was here' where id = 'ae220000-0000-0000-0000-0000000000b1'$$) = 0, 'a non-creator: the table changes nothing either');
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"price_minor": 100}')) = 'P0002', 'a participant cannot edit');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"capacity": 50}')) = 'P0002', 'a participant cannot change the spots');
select pg_temp.check(pg_temp.changed($$update public.activities set starts_at = starts_at + interval '1 hour' where id = 'ae220000-0000-0000-0000-0000000000b1'$$) = 0, 'a participant: the table changes nothing either');
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a4');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"title": "Rob was here"}')) = 'P0002', 'a blocked member cannot edit');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-00000000dead', '{"title": "Nothing there"}')) = 'P0002', 'an unknown activity: not found');
select pg_temp.as_admin();
select pg_temp.check((select title = 'AE padel evening' and price_minor = 0 and capacity = 6 from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'none of them changed anything');
select pg_temp.check((select count(*) = 0 from public.notifications where user_id::text like 'ae220000-%' and kind = 'ACTIVITY_UPDATED'), 'and nobody was told anything');

-- ═════════════════════════ THE CREATOR EDITS EACH FIELD ═════════════════════════

select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select updated_at as before_edit from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1' \gset
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', '{"title": "  AE padel night  "}');
select pg_temp.check((select title = 'AE padel night' from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'title: saved, without the spaces around it');
select pg_temp.check((select updated_at > :'before_edit'::timestamptz from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'updated_at follows the edit (what Realtime and the lists read)');
select pg_temp.as_admin();
select pg_temp.check((select title = 'AE padel night' from public.conversations where activity_id = 'ae220000-0000-0000-0000-0000000000b1'), 'title: the activity chat takes the new name');
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a2');
select pg_temp.check(exists (select 1 from public.my_calendar() where id = 'ae220000-0000-0000-0000-0000000000b1' and title = 'AE padel night'), 'title: a participant''s calendar shows the new name');
select pg_temp.check((select title = 'AE padel night' from public.activity_detail('ae220000-0000-0000-0000-0000000000b1')), 'title: a participant''s page shows the new name');

select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', '{"description": "Doubles, intermediate level."}');
select pg_temp.check((select description = 'Doubles, intermediate level.' from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'description: saved');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', '{"description": "   "}');
select pg_temp.check((select description is null from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'description: emptied');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', '{"price_minor": 3750}');
select pg_temp.check((select price_minor = 3750 and currency = 'AED' from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'price: 37.50 saved, in the activity''s own currency');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', '{"cover_path": "https://getirly.com/img/own/padelGirl-1200.jpg"}');
select pg_temp.check((select cover_path = 'https://getirly.com/img/own/padelGirl-1200.jpg' from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'photo: an IRLY library photo saved');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"cover_path": "https://evil.example.com/pixel.gif"}')) = '42501', 'photo: a link to another site is refused, as when creating');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"cover_path": "ae220000-0000-0000-0000-0000000000a2/hers.jpg"}')) = '42501', 'photo: another member''s upload is refused');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', '{"cover_path": null}');
select pg_temp.check((select cover_path is null from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'photo: removed (back to the app''s photo)');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', '{"capacity": 12}');
select pg_temp.check((select capacity = 12 from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'spots: raised to 12');
select pg_temp.as_admin();
-- Description, price, photo and spots: nobody is told.
select pg_temp.check(pg_temp.notices('ae220000-0000-0000-0000-0000000000a2', 'ae220000-0000-0000-0000-0000000000b1') = 0
  and pg_temp.notices('ae220000-0000-0000-0000-0000000000a3', 'ae220000-0000-0000-0000-0000000000b1') = 0,
  'title, description, price, photo, spots: the people going get no notification');

-- ═════════════════════════ TIME AND PLACE: THE PEOPLE GOING ARE TOLD, ONCE ═════════════════════════

select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1',
  jsonb_build_object('starts_at', now() + interval '3 days 1 hour', 'ends_at', now() + interval '3 days 3 hours'));
select pg_temp.check((select starts_at > now() + interval '3 days 59 minutes' and ends_at > now() + interval '3 days 2 hours 59 minutes' from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'time: moved an hour later');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.notices('ae220000-0000-0000-0000-0000000000a2', 'ae220000-0000-0000-0000-0000000000b1') = 1
  and pg_temp.notices('ae220000-0000-0000-0000-0000000000a3', 'ae220000-0000-0000-0000-0000000000b1') = 1, 'time: each person going gets one notification');
select pg_temp.check(pg_temp.notices('ae220000-0000-0000-0000-0000000000a1', 'ae220000-0000-0000-0000-0000000000b1') = 0, 'time: the editor herself gets none');
select pg_temp.check(pg_temp.notices('ae220000-0000-0000-0000-0000000000a5', 'ae220000-0000-0000-0000-0000000000b1') = 0
  and pg_temp.notices('ae220000-0000-0000-0000-0000000000a4', 'ae220000-0000-0000-0000-0000000000b1') = 0, 'time: people who are not going get none');
select pg_temp.check((select (payload ->> 'starts_at')::timestamptz = (select starts_at from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1') and payload ->> 'title' = 'AE padel night'
  from public.notifications where user_id = 'ae220000-0000-0000-0000-0000000000a2' and kind = 'ACTIVITY_UPDATED'), 'time: the notification carries the new start and the current name');
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a2');
select pg_temp.check(exists (select 1 from public.my_calendar() c join public.activities a on a.id = c.id where c.id = 'ae220000-0000-0000-0000-0000000000b1' and c.starts_at = a.starts_at and c.starts_at > now() + interval '3 days 59 minutes'),
  'time: a participant''s calendar is at the new time');

-- One edit that moves the time AND the place: one notification, not two.
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1',
  jsonb_build_object('starts_at', now() + interval '3 days 2 hours', 'ends_at', now() + interval '3 days 4 hours', 'area_id', 'jbr', 'place_name', 'JBR courts, court 3', 'price_minor', 4000));
select pg_temp.check((select area_id = 'jbr' and place_name = 'JBR courts, court 3' and price_minor = 4000 and city_id = 'dubai' from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'place: neighbourhood and place saved (same city)');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.notices('ae220000-0000-0000-0000-0000000000a2', 'ae220000-0000-0000-0000-0000000000b1') = 2
  and pg_temp.notices('ae220000-0000-0000-0000-0000000000a3', 'ae220000-0000-0000-0000-0000000000b1') = 2, 'time and place in one edit: one more notification each, not two');
select pg_temp.check(pg_temp.notices('ae220000-0000-0000-0000-0000000000a2', 'ae220000-0000-0000-0000-0000000000b1', true) = 1, '… and only the latest is unread');
select pg_temp.check(pg_temp.notices('ae220000-0000-0000-0000-0000000000a1', 'ae220000-0000-0000-0000-0000000000b1') = 0, '… the editor still none');
-- The same values sent again: nothing changed, nobody is told.
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', '{"area_id": "jbr", "place_name": "JBR courts, court 3"}');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', '{}');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.notices('ae220000-0000-0000-0000-0000000000a2', 'ae220000-0000-0000-0000-0000000000b1') = 2, 'an edit that changes nothing tells nobody');

-- ═════════════════════════ WHAT NEVER CHANGES ═════════════════════════

-- By update_activity: each of these is refused by name, whatever else comes with it.
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
do $$
declare
  k text;
  v text;
begin
  for k, v in select * from (values
    ('girl_only', 'true'), ('audience', '"girls"'), ('community_id', '"ae220000-0000-0000-0000-0000000000c1"'), ('creator_id', '"ae220000-0000-0000-0000-0000000000a2"'),
    ('event_key', '"e-d1"'), ('source_post_id', 'null'), ('category_id', '"food"'), ('sub_id', '"x"'), ('privacy', '"invite"'), ('currency', '"IDR"'), ('city_id', '"bali"'),
    ('format', '"event"'), ('cancelled_at', 'null'), ('moderated_at', 'null'), ('created_at', '"2020-01-01"'), ('updated_at', '"2020-01-01"'), ('id', '"ae220000-0000-0000-0000-0000000000b9"'),
    ('place_id', 'null'), ('lat', '1'), ('address', '"Somewhere"'), ('activity_type', '"DINNER"'), ('timezone', '"UTC"')) t(k, v)
  loop
    perform pg_temp.check(pg_temp.says(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', format('{"title": "AE hijack", %s: %s}', to_json(k), v))) = k || ' cannot be changed',
      'update_activity: ' || k || ' cannot be changed');
  end loop;
end $$;
select pg_temp.as_admin();
select pg_temp.check((select title = 'AE padel night' and not girl_only and audience = 'all' and community_id is null and creator_id = 'ae220000-0000-0000-0000-0000000000a1'
  and category_id = 'sport' and privacy = 'public' and currency = 'AED' and city_id = 'dubai'
  from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), '… and nothing of it was saved');

-- By the table, as a signed-in member (an older app, the API by hand).
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($$update public.activities set creator_id = 'ae220000-0000-0000-0000-0000000000a2' where id = 'ae220000-0000-0000-0000-0000000000b1'$$) = '42501', 'table: the creator cannot be changed');
select pg_temp.check(pg_temp.fails($$update public.activities set creator_id = 'ae220000-0000-0000-0000-0000000000a2' where id = 'ae220000-0000-0000-0000-0000000000b6'$$) = '42501', 'table: … nor on a plan nobody joined');
select pg_temp.check(pg_temp.fails($$update public.activities set girl_only = true, audience = 'girls' where id = 'ae220000-0000-0000-0000-0000000000b1'$$) = '42501', 'table: a plan people joined cannot change space (mixed → IRLY Girl)');
select pg_temp.check(pg_temp.fails($$update public.activities set girl_only = false, audience = 'all' where id = 'ae220000-0000-0000-0000-0000000000b2'$$) = '42501', 'table: a women-only plan cannot be opened');
select pg_temp.check(pg_temp.fails($$update public.activities set audience = 'families' where id = 'ae220000-0000-0000-0000-0000000000b1'$$) = '42501', 'table: a plan people joined keeps its audience');
select pg_temp.check(pg_temp.fails($$update public.activities set audience = 'moms' where id = 'ae220000-0000-0000-0000-0000000000b2'$$) = '42501', 'table: a women-only plan people joined keeps its audience');
select pg_temp.check(pg_temp.fails($$update public.activities set community_id = 'ae220000-0000-0000-0000-0000000000c1' where id = 'ae220000-0000-0000-0000-0000000000b1'$$) = '42501', 'table: a plan people joined cannot be moved into a community');
select pg_temp.check(pg_temp.fails($$update public.activities set community_id = 'ae220000-0000-0000-0000-0000000000c2' where id = 'ae220000-0000-0000-0000-0000000000b5'$$) = '42501', 'table: … nor from its community to another');
select pg_temp.check(pg_temp.fails($$update public.activities set community_id = null where id = 'ae220000-0000-0000-0000-0000000000b5'$$) = '42501', 'table: … nor out of its community');
select pg_temp.check(pg_temp.fails($$update public.activities set currency = 'IDR' where id = 'ae220000-0000-0000-0000-0000000000b1'$$) = '42501', 'table: the currency cannot be changed');
select pg_temp.check(pg_temp.fails($$update public.activities set city_id = 'bali' where id = 'ae220000-0000-0000-0000-0000000000b1'$$) = '42501', 'table: the city cannot be changed');
select pg_temp.as_admin();
select pg_temp.check((select not girl_only and audience = 'all' and community_id is null and creator_id = 'ae220000-0000-0000-0000-0000000000a1' and currency = 'AED' and city_id = 'dubai'
  from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1')
  and (select girl_only and audience = 'girls' from public.activities where id = 'ae220000-0000-0000-0000-0000000000b2')
  and (select community_id = 'ae220000-0000-0000-0000-0000000000c1' from public.activities where id = 'ae220000-0000-0000-0000-0000000000b5'),
  'table: space, audience, community, creator, currency and city are all as they were');
-- (Control) what the table still allows its host: the editable fields, and attaching a plan nobody joined to her community.
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.changed($$update public.activities set title = 'AE solo plan, renamed', price_minor = 1500 where id = 'ae220000-0000-0000-0000-0000000000b6'$$) = 1, 'table (control): the host still edits title and price');
select pg_temp.check(pg_temp.changed($$update public.activities set community_id = 'ae220000-0000-0000-0000-0000000000c2' where id = 'ae220000-0000-0000-0000-0000000000b6'$$) = 1, 'table (control): a plan nobody joined can still be attached to her community');

-- ═════════════════════════ SPOTS NEVER UNDER THE PEOPLE GOING ═════════════════════════

-- Three are going to the padel night (Lina, Maya, Tom).
select pg_temp.check(pg_temp.says(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"capacity": 2}')) = 'capacity is below the number of people going', 'spots: 2 for 3 people going is refused');
select pg_temp.check(pg_temp.fails($$update public.activities set capacity = 2 where id = 'ae220000-0000-0000-0000-0000000000b1'$$) = '22023', 'spots: … by the table too');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"capacity": 3}')) is null, 'spots: exactly the people going is accepted');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"capacity": 1}')) = '23514', 'spots: under 2 is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"capacity": 1001}')) = '23514', 'spots: over 1000 is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"capacity": 4.5}')) = '23514', 'spots: not a whole number is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"capacity": "many"}')) = '23514', 'spots: not a number is refused');
select pg_temp.check((select capacity = 3 from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'spots: still 3 after the refusals');
-- Full at 3: the next person is told so, and the host cannot make room disappear under them.
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a5');
select pg_temp.check(public.join_activity('ae220000-0000-0000-0000-0000000000b1', 'going') = 'full', 'spots: the edited capacity is the one joins are counted against');
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', '{"capacity": null}');
select pg_temp.check((select capacity is null from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'spots: unlimited');

-- ═════════════════════════ PRICE ═════════════════════════

select pg_temp.check(pg_temp.says(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"price_minor": -1}')) = 'A price cannot be negative', 'price: negative is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"price_minor": 37.5}')) = '23514', 'price: half a minor unit is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"price_minor": "abc"}')) = '23514', 'price: letters are refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"price_minor": "3750"}')) = '23514', 'price: a number sent as text is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"price_minor": null}')) = '23514', 'price: null is refused (0 is free)');
select pg_temp.check(pg_temp.says(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"price_minor": 100000001}')) = 'This price is too high', 'price: above the ceiling creation has (AED 1,000,000) is refused');
select pg_temp.check(pg_temp.fails($$update public.activities set price_minor = -5 where id = 'ae220000-0000-0000-0000-0000000000b1'$$) = '23514', 'price: the table refuses a negative price too');
select pg_temp.check((select price_minor = 4000 from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'price: unchanged after the refusals');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', '{"price_minor": 100000000}');
select pg_temp.check((select price_minor = 100000000 from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'price: the ceiling itself is accepted');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', '{"price_minor": 0}');
select pg_temp.check((select price_minor = 0 from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1'), 'price: 0 is free');
-- IDR amounts are large: the column's own limit applies there.
select public.update_activity('ae220000-0000-0000-0000-0000000000b7', '{"price_minor": 2000000000}');
select pg_temp.check((select price_minor = 2000000000 and currency = 'IDR' from public.activities where id = 'ae220000-0000-0000-0000-0000000000b7'), 'price: IDR 20,000,000 is accepted, still in IDR');
select pg_temp.check(pg_temp.says(pg_temp.edit('ae220000-0000-0000-0000-0000000000b7', '{"price_minor": 2147483648}')) = 'This price is too high', 'price: above what the column holds is refused, with a sentence');

-- ═════════════════════════ THE VALIDATIONS OF CREATING ═════════════════════════

select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"title": " ab "}')) = '23514', 'title: under 3 characters is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"title": null}')) = '23514', 'title: null is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', jsonb_build_object('title', repeat('x', 81))::text)) = '23514', 'title: over 80 characters is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', jsonb_build_object('title', repeat('x', 80))::text)) is null, 'title: 80 characters is accepted');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', jsonb_build_object('description', repeat('x', 1001))::text)) = '23514', 'description: over 1000 characters is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', jsonb_build_object('place_name', repeat('x', 201))::text)) = '23514', 'place: over 200 characters is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"area_id": "atlantis-under-the-sea"}')) = '23514', 'place: an unknown neighbourhood is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"area_id": "canggu"}')) = '23514', 'place: a neighbourhood of another city is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', jsonb_build_object('starts_at', now() - interval '1 hour')::text)) = '22023', 'time: a start in the past is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', jsonb_build_object('ends_at', now() + interval '1 day')::text)) = '22023', 'time: an end before the start is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', jsonb_build_object('starts_at', now() + interval '6 years', 'ends_at', null)::text)) = '22023', 'time: more than five years ahead is refused');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"starts_at": null}')) = '22023', 'time: no start is refused');
select pg_temp.check(pg_temp.fails($$select public.update_activity('ae220000-0000-0000-0000-0000000000b1', null)$$) = '22023', 'no patch: refused');
select pg_temp.check(pg_temp.fails($$select public.update_activity('ae220000-0000-0000-0000-0000000000b1', '["title"]'::jsonb)$$) = '22023', 'a patch that is not an object: refused');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', '{"title": "AE padel night"}');

-- A suspended account cannot edit anything (creating is refused to it as well).
select pg_temp.as_admin();
insert into public.sanctions (user_id, kind, reason) values ('ae220000-0000-0000-0000-0000000000a1', 'suspension', 'activity edit test');
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"price_minor": 500}')) = '42501', 'suspended: no edit, not even the price');
select pg_temp.as_admin();
delete from public.sanctions where user_id = 'ae220000-0000-0000-0000-0000000000a1';
-- Restricted in the community her plan is in: no edit there, as no new plan there.
insert into public.community_restrictions (community_id, user_id, until, reason)
values ('ae220000-0000-0000-0000-0000000000c1', 'ae220000-0000-0000-0000-0000000000a1', now() + interval '2 days', 'activity edit test');
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b5', '{"title": "AE club run, 10 km"}')) = '42501', 'restricted in its community: no edit of the plan that is in it');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b1', '{"description": "Still mine to edit."}')) is null, '… her plans elsewhere are not concerned');
select pg_temp.as_admin();
delete from public.community_restrictions where user_id = 'ae220000-0000-0000-0000-0000000000a1';
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b5', '{"title": "AE club run, 10 km"}')) is null, '… and once the restriction is over she edits it again');

-- ═════════════════════════ OVER, CANCELLED, REMOVED BY THE TEAM ═════════════════════════

select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.says(pg_temp.edit('ae220000-0000-0000-0000-0000000000b3', '{"title": "AE rewritten history"}')) = 'This activity is over', 'over: update_activity refuses');
select pg_temp.check(pg_temp.says(pg_temp.edit('ae220000-0000-0000-0000-0000000000b3', '{"price_minor": 9900}')) = 'This activity is over', 'over: … the price too');
select pg_temp.check(pg_temp.says(pg_temp.edit('ae220000-0000-0000-0000-0000000000b3', jsonb_build_object('starts_at', now() + interval '2 days', 'ends_at', null)::text)) = 'This activity is over', 'over: … and it cannot be moved back into the future');
select pg_temp.check(pg_temp.says($$update public.activities set title = 'AE rewritten history' where id = 'ae220000-0000-0000-0000-0000000000b3'$$) = 'This activity is over', 'over: the table refuses too');
select pg_temp.check(pg_temp.says($$update public.activities set description = 'It was great', price_minor = 9900 where id = 'ae220000-0000-0000-0000-0000000000b3'$$) = 'This activity is over', 'over: … description and price too');
select pg_temp.check(pg_temp.says(pg_temp.edit('ae220000-0000-0000-0000-0000000000b4', '{"title": "AE back on"}')) = 'This activity was cancelled', 'cancelled: update_activity refuses');
select pg_temp.check(pg_temp.says($$update public.activities set title = 'AE back on' where id = 'ae220000-0000-0000-0000-0000000000b4'$$) = 'This activity was cancelled', 'cancelled: the table refuses too');
select pg_temp.check(pg_temp.fails($$update public.activities set cancelled_at = null where id = 'ae220000-0000-0000-0000-0000000000b4'$$) = '42501', 'cancelled: it cannot be brought back (existing rule)');
select pg_temp.as_admin();
select pg_temp.check((select title = 'AE yesterday walk' and price_minor = 0 from public.activities where id = 'ae220000-0000-0000-0000-0000000000b3')
  and (select title = 'AE called off' and cancelled_at is not null from public.activities where id = 'ae220000-0000-0000-0000-0000000000b4'), 'over and cancelled: both as they were');
select pg_temp.check(pg_temp.notices('ae220000-0000-0000-0000-0000000000a2', 'ae220000-0000-0000-0000-0000000000b3') = 0, 'over: its participant was told nothing');
-- Calling a plan off is not an edit: the host still can, and cannot edit it afterwards.
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.changed($$update public.activities set cancelled_at = now() where id = 'ae220000-0000-0000-0000-0000000000b6'$$) = 1, 'the host can still cancel her plan');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b6', '{"title": "AE solo plan again"}')) = '22023', '… and no longer edit it');
-- Removed by the IRLY team: not the host's to edit any more.
select pg_temp.as_admin();
update public.activities set moderated_at = now() where id = 'ae220000-0000-0000-0000-0000000000b7';
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b7', '{"title": "AE Bali surf, cleaned up"}')) = '42501', 'removed by the team: update_activity refuses');

-- ═════════════════════════ A WOMEN-ONLY PLAN STAYS INVISIBLE TO A MAN ═════════════════════════

select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a3');
select pg_temp.check(not exists (select 1 from public.activities where id = 'ae220000-0000-0000-0000-0000000000b2')
  and not exists (select 1 from public.activity_detail('ae220000-0000-0000-0000-0000000000b2')), 'IRLY Girl: (before) a man does not see the brunch');
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select public.update_activity('ae220000-0000-0000-0000-0000000000b2',
  jsonb_build_object('title', 'AE girls brunch, terrace', 'description', 'On the terrace.', 'starts_at', now() + interval '4 days 2 hours', 'area_id', 'marina', 'place_name', 'Marina terrace',
    'capacity', 8, 'price_minor', 9500, 'cover_path', 'https://getirly.com/img/own/padelGirl-1200.jpg'));
select pg_temp.as_admin();
select pg_temp.check((select girl_only and audience = 'girls' and privacy = 'public' and title = 'AE girls brunch, terrace' and capacity = 8 and price_minor = 9500 and area_id = 'marina'
  from public.activities where id = 'ae220000-0000-0000-0000-0000000000b2'), 'IRLY Girl: every editable field saved, still women-only with its audience');
select pg_temp.check(pg_temp.notices('ae220000-0000-0000-0000-0000000000a2', 'ae220000-0000-0000-0000-0000000000b2') = 1, 'IRLY Girl: the woman going is told about the new time and place');
select pg_temp.check((select count(*) = 0 from public.notifications where user_id in ('ae220000-0000-0000-0000-0000000000a3', 'ae220000-0000-0000-0000-0000000000a4', 'ae220000-0000-0000-0000-0000000000a5')
  and payload ->> 'activity_id' = 'ae220000-0000-0000-0000-0000000000b2'), 'IRLY Girl: no man hears about it');
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a3');
select pg_temp.check(not exists (select 1 from public.activities where id = 'ae220000-0000-0000-0000-0000000000b2'), 'IRLY Girl: (after) a man still does not see it in the table');
select pg_temp.check(not exists (select 1 from public.activity_detail('ae220000-0000-0000-0000-0000000000b2')), 'IRLY Girl: … nor by its link');
select pg_temp.check(not exists (select 1 from public.activities where title like 'AE girls brunch%'), 'IRLY Girl: … nor by its new name');
select pg_temp.check(pg_temp.fails($$select public.join_activity('ae220000-0000-0000-0000-0000000000b2', 'going')$$) = '42501', 'IRLY Girl: … and still cannot join it');
select pg_temp.check(pg_temp.fails(pg_temp.edit('ae220000-0000-0000-0000-0000000000b2', '{"title": "Open to all"}')) = 'P0002', 'IRLY Girl: … nor learn it exists by trying to edit it');
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a2');
select pg_temp.check((select title = 'AE girls brunch, terrace' and price_minor = 9500 from public.activity_detail('ae220000-0000-0000-0000-0000000000b2')), 'IRLY Girl: the woman going sees the new version');

-- ═════════════════════════ REMINDERS FOLLOW THE NEW TIME ═════════════════════════

-- Lina moves the padel night to 110 minutes from now: reminded for that start.
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', jsonb_build_object('starts_at', now() + interval '110 minutes', 'ends_at', null));
select pg_temp.as_admin();
select private.send_activity_reminders();
select pg_temp.check((select count(*) = 1 from public.notifications where user_id = 'ae220000-0000-0000-0000-0000000000a2' and kind = 'ACTIVITY_REMINDER'
  and payload ->> 'activity_id' = 'ae220000-0000-0000-0000-0000000000b1' and (payload ->> 'starts_at')::timestamptz = (select starts_at from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1')),
  'reminder: sent for the start the host set');
-- She moves it by a few minutes, inside the reminder window: reminded once for the new start.
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', jsonb_build_object('starts_at', now() + interval '118 minutes'));
select pg_temp.as_admin();
select private.send_activity_reminders();
select private.send_activity_reminders();
select pg_temp.check((select count(*) = 2 from public.notifications where user_id = 'ae220000-0000-0000-0000-0000000000a2' and kind = 'ACTIVITY_REMINDER'
  and payload ->> 'activity_id' = 'ae220000-0000-0000-0000-0000000000b1'), 'reminder: one more for the new start, never twice for the same start');
select pg_temp.check((select count(*) = 1 from public.notifications where user_id = 'ae220000-0000-0000-0000-0000000000a2' and kind = 'ACTIVITY_REMINDER'
  and payload ->> 'activity_id' = 'ae220000-0000-0000-0000-0000000000b1' and (payload ->> 'starts_at')::timestamptz = (select starts_at from public.activities where id = 'ae220000-0000-0000-0000-0000000000b1')),
  'reminder: the latest one is for the activity''s current start');
-- Moved to tomorrow: no reminder goes out now for a start that is no longer the activity's.
select pg_temp.as_user('ae220000-0000-0000-0000-0000000000a1');
select public.update_activity('ae220000-0000-0000-0000-0000000000b1', jsonb_build_object('starts_at', now() + interval '1 day'));
select pg_temp.as_admin();
delete from public.notifications where kind = 'ACTIVITY_REMINDER' and payload ->> 'activity_id' = 'ae220000-0000-0000-0000-0000000000b1';
select private.send_activity_reminders();
select pg_temp.check((select count(*) = 0 from public.notifications where kind = 'ACTIVITY_REMINDER' and payload ->> 'activity_id' = 'ae220000-0000-0000-0000-0000000000b1'),
  'reminder: none for the old time once the activity has moved out of the window');
-- … and when the new start comes into the window, it is reminded.
update public.activities set starts_at = now() + interval '112 minutes' where id = 'ae220000-0000-0000-0000-0000000000b1';
select private.send_activity_reminders();
select pg_temp.check((select count(*) = 1 from public.notifications where user_id = 'ae220000-0000-0000-0000-0000000000a3' and kind = 'ACTIVITY_REMINDER'
  and payload ->> 'activity_id' = 'ae220000-0000-0000-0000-0000000000b1'), 'reminder: sent when the new start is near');

-- ───────── Clean up ─────────
select pg_temp.as_admin();
delete from public.notifications where user_id::text like 'ae220000-%';
delete from public.activities where creator_id in (select id from auth.users where id::text like 'ae220000-%');
delete from public.communities where id in ('ae220000-0000-0000-0000-0000000000c1', 'ae220000-0000-0000-0000-0000000000c2');
delete from public.blocks where blocker_id = 'ae220000-0000-0000-0000-0000000000a1';
delete from public.profiles where id::text like 'ae220000-%';
delete from auth.users where id::text like 'ae220000-%';
