-- Creating communities and activities, and their chats (20261024009900_irly_create_and_chats.sql):
-- one community and one chat per creation (double tap, retry), the owner and
-- the member count right, join and leave keep the chat in step (and a member
-- who left reads nothing new), IRLY Girl's five official communities stay
-- five with the same ids; an activity can be created in every category the
-- app offers, at the right instant, with exactly one chat that only its
-- members read; a host's block takes the blocked person out of her plans.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed c9900000-….
--
--   a1 Mia  woman, IRLY Girl access (creator)
--   a2 Lea  woman (participant)
--   a3 Sam  man (outsider)
--   a4 Bob  man (blocked by Mia)
--   a5 Cat  woman (creates one activity per category)
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
    raise exception 'FAIL create_and_chats: %', label;
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
insert into auth.users (id) values ('c9900000-0000-0000-0000-0000000000a1'), ('c9900000-0000-0000-0000-0000000000a2'),
  ('c9900000-0000-0000-0000-0000000000a3'), ('c9900000-0000-0000-0000-0000000000a4'), ('c9900000-0000-0000-0000-0000000000a5');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c9900000-0000-0000-0000-0000000000a1', 'Mia', '1995-02-02', 'woman', 'dubai'),
  ('c9900000-0000-0000-0000-0000000000a2', 'Lea', '1996-03-03', 'woman', 'dubai'),
  ('c9900000-0000-0000-0000-0000000000a3', 'Sam', '1993-04-04', 'man', 'dubai'),
  ('c9900000-0000-0000-0000-0000000000a4', 'Bob', '1992-05-05', 'man', 'dubai'),
  ('c9900000-0000-0000-0000-0000000000a5', 'Cat', '1994-06-06', 'woman', 'dubai');
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

-- ───────── 1. Creating a community ─────────
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
insert into ids select 'club', public.create_community('c99 Run Club', 'dubai', 'Runs at dawn', null, 'sport', false);
-- A double tap or a retry (same name, other case and spaces): the same community.
insert into ids select 'club2', public.create_community('  C99 run club ', 'dubai', 'Runs at dawn', null, 'sport', false);
select pg_temp.check((select v from ids where k = 'club') = (select v from ids where k = 'club2'), 'same name within 2 minutes: the same community');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.communities where created_by = 'c9900000-0000-0000-0000-0000000000a1') = 1, 'one community row, not two');
select pg_temp.check((select role from public.community_members where community_id = (select v from ids where k = 'club') and user_id = 'c9900000-0000-0000-0000-0000000000a1') = 'owner', 'the creator is its owner');
select pg_temp.check((select members_count from public.communities where id = (select v from ids where k = 'club')) = 1, 'members_count is 1');
select pg_temp.check((select count(*) from public.conversations where community_id = (select v from ids where k = 'club')) = 1, 'exactly one community chat');
insert into ids select 'club_conv', id from public.conversations where community_id = (select v from ids where k = 'club');
select pg_temp.check((select role from public.conversation_members where conversation_id = (select v from ids where k = 'club_conv') and user_id = 'c9900000-0000-0000-0000-0000000000a1') = 'admin', 'the owner is the chat admin');
select pg_temp.check((select count(*) from public.messages where conversation_id = (select v from ids where k = 'club_conv') and kind = 'system') = 1, 'one welcome message, not one per tap');
select pg_temp.check(pg_temp.fails($$insert into public.conversations (kind, community_id, title) select 'community', v, 'dup' from ids where k = 'club'$$) = '23505', 'a second chat for the community is impossible (unique community_id)');

-- It is in the lists at once, and opening it creates nothing.
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
select pg_temp.check(exists (select 1 from public.community_list('dubai') l where l.id = (select v from ids where k = 'club') and l.is_member and l.members = 1), 'in community_list at once, as a member, 1 member');
select pg_temp.check((select conversation_id from public.community_detail((select v from ids where k = 'club'))) = (select v from ids where k = 'club_conv'), 'community_detail gives its chat');
select pg_temp.check(exists (select 1 from public.my_conversations() m where m.conversation_id = (select v from ids where k = 'club_conv')), 'its chat is in the owner''s inbox');
-- Its photo: on this community, an upload of the owner's.
select public.set_community_cover((select v from ids where k = 'club'), 'c9900000-0000-0000-0000-0000000000a1/club.jpg');
select pg_temp.check((select cover_path from public.communities where id = (select v from ids where k = 'club')) = 'c9900000-0000-0000-0000-0000000000a1/club.jpg', 'the cover is on the community just created');
select pg_temp.check(pg_temp.fails($$select public.set_community_cover((select v from ids where k = 'club'), 'c9900000-0000-0000-0000-0000000000a2/x.jpg')$$) = '42501', 'someone else''s upload is refused as a cover');

-- Lea visits (no chat made), then joins.
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a2');
select pg_temp.check((select conversation_id from public.community_detail((select v from ids where k = 'club'))) is null, 'a visitor sees no chat');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.conversations where community_id = (select v from ids where k = 'club')) = 1, 'visiting the page made no extra chat');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a2');
select pg_temp.check(public.join_community((select v from ids where k = 'club')) = (select v from ids where k = 'club_conv'), 'join gives the community''s one chat');
select public.join_community((select v from ids where k = 'club'));
select pg_temp.check((select members from public.community_detail((select v from ids where k = 'club'))) = 2, 'joining twice counts once (2 members)');
select pg_temp.as_admin();
select pg_temp.check((select members_count from public.communities where id = (select v from ids where k = 'club')) = 2, 'members_count is 2');
select pg_temp.check(exists (select 1 from public.conversation_members where conversation_id = (select v from ids where k = 'club_conv') and user_id = 'c9900000-0000-0000-0000-0000000000a2' and role = 'member'), 'the member is in the chat');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
insert into public.messages (conversation_id, sender_id, kind, body) select v, auth.uid(), 'text', 'c99 hello club' from ids where k = 'club_conv';
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a2');
select pg_temp.check(exists (select 1 from public.messages where body = 'c99 hello club'), 'a member reads the community chat');

-- Roles: the owner makes Lea a moderator; nobody else can.
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails($$select public.set_community_role((select v from ids where k = 'club'), 'c9900000-0000-0000-0000-0000000000a2', 'moderator')$$) = '42501', 'an outsider cannot change roles');
select pg_temp.check((select count(*) from public.messages where body = 'c99 hello club') = 0, 'an outsider reads nothing of the community chat');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
select public.set_community_role((select v from ids where k = 'club'), 'c9900000-0000-0000-0000-0000000000a2', 'moderator');
select pg_temp.check((select my_role from public.community_detail((select v from ids where k = 'club'))) = 'owner', 'the owner stays owner');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a2');
select pg_temp.check((select my_role from public.community_detail((select v from ids where k = 'club'))) = 'moderator', 'Lea is moderator');
select public.set_community_cover((select v from ids where k = 'club'), 'c9900000-0000-0000-0000-0000000000a2/mod.jpg');
select pg_temp.check(pg_temp.fails($$select public.set_community_role((select v from ids where k = 'club'), 'c9900000-0000-0000-0000-0000000000a1', 'member')$$) = '42501', 'a moderator cannot demote the owner');

-- Lea leaves: out of the chat, and reads nothing written after.
select public.leave_community((select v from ids where k = 'club'));
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.conversation_members where conversation_id = (select v from ids where k = 'club_conv') and user_id = 'c9900000-0000-0000-0000-0000000000a2'), 'leaving removes her from conversation_members');
select pg_temp.check((select members_count from public.communities where id = (select v from ids where k = 'club')) = 1, 'members_count back to 1');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
insert into public.messages (conversation_id, sender_id, kind, body) select v, auth.uid(), 'text', 'c99 after Lea left' from ids where k = 'club_conv';
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a2');
select pg_temp.check((select count(*) from public.messages where conversation_id = (select v from ids where k = 'club_conv')) = 0, 'after leaving: no message of the chat can be read (REST select)');
select pg_temp.check(not exists (select 1 from public.conversations where id = (select v from ids where k = 'club_conv')), 'after leaving: the chat itself is not readable');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, kind, body) select v, auth.uid(), 'text', 'c99 sneaky' from ids where k = 'club_conv'$$) = '42501', 'after leaving: she cannot write in it');
-- Back again: the same chat, no second one.
select pg_temp.check(public.join_community((select v from ids where k = 'club')) = (select v from ids where k = 'club_conv'), 'rejoining gives the same chat');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.conversations where community_id = (select v from ids where k = 'club')) = 1, 'still exactly one community chat');
-- The owner cannot leave (her community would have nobody to run it).
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
select public.leave_community((select v from ids where k = 'club'));
select pg_temp.check((select my_role from public.community_detail((select v from ids where k = 'club'))) = 'owner', 'the owner stays in her community');

-- Girls-only: Mia may create one; Sam may not, nor join, nor read it.
insert into ids select 'gclub', public.create_community('c99 Girls Padel', 'dubai', null, null, 'sport', true);
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails($$select public.create_community('c99 Sam girls', 'dubai', null, null, null, true)$$) = '42501', 'a man cannot create a girls-only community');
select pg_temp.check(pg_temp.fails($$select public.join_community((select v from ids where k = 'gclub'))$$) = '42501', 'a man cannot join a girls-only community');
select pg_temp.check(not exists (select 1 from public.communities where id = (select v from ids where k = 'gclub')), 'a man does not see a girls-only community');
-- Created over REST (around the RPC): still its creator as owner, one chat, counted.
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a2');
insert into public.communities (id, city_id, name, created_by) values ('c9900000-0000-0000-0000-0000000000e1', 'dubai', 'c99 Rest Club', auth.uid());
select pg_temp.check((select my_role = 'owner' and is_member and conversation_id is not null from public.community_detail('c9900000-0000-0000-0000-0000000000e1')), 'a community inserted directly: its creator is owner, in its chat');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.conversations where community_id = 'c9900000-0000-0000-0000-0000000000e1') = 1, 'a community inserted directly: exactly one chat');
select pg_temp.check((select members_count from public.communities where id = 'c9900000-0000-0000-0000-0000000000e1') = 1, 'a community inserted directly: members_count 1');
select pg_temp.check((select count(*) from public.community_members where community_id = (select v from ids where k = 'club')) = 2
  and (select members_count from public.communities where id = (select v from ids where k = 'club')) = 2, 'create_community: owner added once (count matches the rows)');

-- IRLY Girl's five official communities: five, once each, same ids after a re-run.
select pg_temp.as_admin();
create temp table five as select topic, id from public.communities where official and deleted_at is null and topic in ('girl_newcomers', 'girl_network', 'girl_francophone', 'girl_trip', 'girl_activity');
select pg_temp.check((select count(*) from five) = 5 and (select count(distinct topic) from five) = 5, 'the five official IRLY Girl communities exist once each');
select private.ensure_official_communities();
select pg_temp.check((select count(*) from public.communities c join five f using (topic) where c.official and c.deleted_at is null) = 5
  and not exists (select 1 from five f where not exists (select 1 from public.communities c where c.id = f.id and c.deleted_at is null)), 're-seeding keeps their ids and adds none');
select pg_temp.check((select count(*) from public.conversations v join five f on f.id = v.community_id) = 5, 'one chat each');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
-- Since 20261028100000 IRLY Girl lists four of them (Girl CEO lives in IRLY Network, Francophone is retired; all kept above).
select pg_temp.check((select count(*) from public.girl_official_communities()) = 4, 'IRLY Girl lists its four');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails('select * from public.girl_official_communities()') = '42501', 'a man cannot list them');

-- ───────── 2. An activity in every category the app offers ─────────
-- src/data/catalog/categories.ts (CategoryKey): every one exists on the server.
select pg_temp.as_admin();
create temp table app_categories (id text primary key);
insert into app_categories values ('sport'), ('networking'), ('food'), ('travel'), ('outdoor'), ('shopping'), ('culture'), ('entertainment'),
  ('nightlife'), ('wellness'), ('animals'), ('family'), ('creative'), ('learning'), ('outings'), ('cafes'), ('beach'), ('games'),
  ('experiences'), ('communities');
select pg_temp.check(not exists (select 1 from app_categories a where not exists (select 1 from public.categories c where c.id = a.id)), 'every category of the app is in public.categories');
grant select on app_categories to authenticated;
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a5');
do $$
declare k text; aid uuid; made int := 0;
begin
  for k in select id from app_categories order by id loop
    insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, timezone, client_ref, format)
    values (auth.uid(), 'c99 ' || k, k, 'dubai', 'marina', now() + interval '1 day', 'Asia/Dubai', gen_random_uuid(), 'meetup')
    returning id into aid;
    made := made + 1;
  end loop;
  perform pg_temp.check(made = 20, 'an activity is created in each of the 20 categories');
end $$;
select pg_temp.as_admin();
select pg_temp.check((select count(distinct v.activity_id) from public.conversations v join public.activities a on a.id = v.activity_id
  where a.creator_id = 'c9900000-0000-0000-0000-0000000000a5') = 20, 'each of them has its chat');

-- ───────── 3. Creating an activity: instant, one row, one chat ─────────
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
-- 19:30 in Dubai (UTC+4), as the app sends it (an ISO instant), whatever the phone's own zone.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, place_name, starts_at, ends_at, timezone, client_ref, format, cover_path)
values ('c9900000-0000-0000-0000-0000000000b1', auth.uid(), 'c99 Sunset run', 'sport', 'dubai', 'marina', 'Marina Walk',
  '2030-11-02T15:30:00.000Z', '2030-11-02T17:00:00.000Z', 'Asia/Dubai', 'c9900000-0000-0000-0000-0000000000f1', 'meetup',
  'c9900000-0000-0000-0000-0000000000a1/run.jpg');
select pg_temp.check((select to_char(starts_at at time zone timezone, 'YYYY-MM-DD HH24:MI') from public.activities where id = 'c9900000-0000-0000-0000-0000000000b1') = '2030-11-02 19:30', 'stored instant reads 19:30 in Dubai');
-- Bali (UTC+8): its own time zone even when the request says Dubai (or nothing).
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, timezone, format)
values ('c9900000-0000-0000-0000-0000000000b4', auth.uid(), 'c99 Canggu surf', 'sport', 'bali', 'canggu', '2030-11-02T11:30:00Z', 'Asia/Dubai', 'meetup');
select pg_temp.check((select timezone = 'Asia/Makassar' and to_char(starts_at at time zone timezone, 'HH24:MI') = '19:30' from public.activities where id = 'c9900000-0000-0000-0000-0000000000b4'), 'a Bali activity is stored in Asia/Makassar (19:30 there)');
select pg_temp.check((select timezone from public.activities where id = 'c9900000-0000-0000-0000-0000000000b1') = 'Asia/Dubai', 'a Dubai activity stays in Asia/Dubai');
select pg_temp.check((select place_name = 'Marina Walk' and area_id = 'marina' and cover_path = 'c9900000-0000-0000-0000-0000000000a1/run.jpg' from public.activities where id = 'c9900000-0000-0000-0000-0000000000b1'), 'place and photo on the right activity');
-- A double tap / retry with the same client_ref: refused, the first one stays the only one.
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, client_ref, format)
  values (auth.uid(), 'c99 Sunset run', 'sport', 'dubai', 'marina', '2030-11-02T15:30:00Z', 'c9900000-0000-0000-0000-0000000000f1', 'meetup')$$) = '23505', 'same client_ref: no second activity');
select pg_temp.check((select count(*) from public.activities where client_ref = 'c9900000-0000-0000-0000-0000000000f1') = 1, 'one row for the request');
select pg_temp.check((select my_status = 'going' and going = 1 and conversation_id is not null from public.activity_detail('c9900000-0000-0000-0000-0000000000b1')), 'the creator is going and has its chat');
select pg_temp.as_admin();
insert into ids select 'run_conv', id from public.conversations where activity_id = 'c9900000-0000-0000-0000-0000000000b1';
select pg_temp.check((select count(*) from public.conversations where activity_id = 'c9900000-0000-0000-0000-0000000000b1') = 1, 'exactly one activity chat, made with the activity');
select pg_temp.check((select role from public.conversation_members where conversation_id = (select v from ids where k = 'run_conv') and user_id = 'c9900000-0000-0000-0000-0000000000a1') = 'admin', 'the organiser is chat admin');
select pg_temp.check(pg_temp.fails($$insert into public.conversations (kind, activity_id, title) values ('activity', 'c9900000-0000-0000-0000-0000000000b1', 'dup')$$) = '23505', 'a second activity chat is impossible (unique activity_id)');
-- In the feed and its category page at once.
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a2');
select pg_temp.check(exists (select 1 from public.activities where id = 'c9900000-0000-0000-0000-0000000000b1' and category_id = 'sport' and cancelled_at is null), 'others see it in the sport list');

-- ───────── 4. Activity chat: join, outsider, leave ─────────
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a2');
select public.join_activity('c9900000-0000-0000-0000-0000000000b1', 'going');
select pg_temp.check((select conversation_id from public.activity_detail('c9900000-0000-0000-0000-0000000000b1')) = (select v from ids where k = 'run_conv'), 'joining: the same chat as the organiser');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
insert into public.messages (conversation_id, sender_id, kind, body) select v, auth.uid(), 'text', 'c99 see you at the marina' from ids where k = 'run_conv';
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a2');
select pg_temp.check(exists (select 1 from public.messages where body = 'c99 see you at the marina'), 'a participant reads the activity chat');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a3');
select pg_temp.check(not exists (select 1 from public.messages where body = 'c99 see you at the marina'), 'an outsider reads nothing of it');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, kind, body) select v, auth.uid(), 'text', 'c99 hi' from ids where k = 'run_conv'$$) = '42501', 'an outsider cannot write in it');
select pg_temp.check((select conversation_id from public.activity_detail('c9900000-0000-0000-0000-0000000000b1')) is null, 'an outsider is given no chat id');
-- Lea switches to maybe, then leaves: out of the chat both times.
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a2');
select public.join_activity('c9900000-0000-0000-0000-0000000000b1', 'maybe');
select pg_temp.check(not exists (select 1 from public.messages where conversation_id = (select v from ids where k = 'run_conv')), '"maybe": out of the chat');
select public.join_activity('c9900000-0000-0000-0000-0000000000b1', 'going');
select public.leave_activity('c9900000-0000-0000-0000-0000000000b1');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
insert into public.messages (conversation_id, sender_id, kind, body) select v, auth.uid(), 'text', 'c99 after Lea went' from ids where k = 'run_conv';
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.messages where conversation_id = (select v from ids where k = 'run_conv')), 'after leaving: nothing of the activity chat can be read');
-- The organiser cannot leave her own plan's chat.
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
select public.leave_activity('c9900000-0000-0000-0000-0000000000b1');
select pg_temp.check((select my_status = 'going' and conversation_id is not null from public.activity_detail('c9900000-0000-0000-0000-0000000000b1')), 'the organiser stays in her plan and its chat');

-- ───────── 5. Blocking: out of the host's plans, and no way back in ─────────
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a4');
select public.join_activity('c9900000-0000-0000-0000-0000000000b1', 'going');
select pg_temp.check((select conversation_id from public.activity_detail('c9900000-0000-0000-0000-0000000000b1')) is not null, 'Bob joined and is in the chat');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), 'c9900000-0000-0000-0000-0000000000a4');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.activity_participants where activity_id = 'c9900000-0000-0000-0000-0000000000b1' and user_id = 'c9900000-0000-0000-0000-0000000000a4'), 'blocked by the host: no longer a participant of her upcoming plan');
select pg_temp.check(not exists (select 1 from public.conversation_members where conversation_id = (select v from ids where k = 'run_conv') and user_id = 'c9900000-0000-0000-0000-0000000000a4'), 'blocked by the host: out of its chat');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a4');
select pg_temp.check(not exists (select 1 from public.messages where conversation_id = (select v from ids where k = 'run_conv')), 'blocked: reads nothing of the chat');
select pg_temp.check(pg_temp.fails($$select public.join_activity('c9900000-0000-0000-0000-0000000000b1', 'going')$$) = 'P0002', 'blocked: cannot join again');

-- ───────── 6. IRLY Girl activity: women only ─────────
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, client_ref, format, girl_only, audience)
values ('c9900000-0000-0000-0000-0000000000b2', auth.uid(), 'c99 Girls brunch', 'food', 'dubai', 'marina', now() + interval '2 days', gen_random_uuid(), 'meetup', true, 'girls');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, format, girl_only)
  values (auth.uid(), 'c99 Sam girls', 'food', 'dubai', 'marina', now() + interval '2 days', 'meetup', true)$$) = '42501', 'a man cannot create an IRLY Girl activity');
select pg_temp.check(not exists (select 1 from public.activities where id = 'c9900000-0000-0000-0000-0000000000b2'), 'a man does not see it');
select pg_temp.check(pg_temp.fails($$select public.join_activity('c9900000-0000-0000-0000-0000000000b2', 'going')$$) = '42501', 'a man cannot join it');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a2');
select public.join_activity('c9900000-0000-0000-0000-0000000000b2', 'going');
select pg_temp.check((select conversation_id from public.activity_detail('c9900000-0000-0000-0000-0000000000b2')) is not null, 'a woman joins it and its chat');
-- In a girls-only community, an activity is girls-only even when the app forgot to say so.
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, format, community_id, privacy)
select 'c9900000-0000-0000-0000-0000000000b3', auth.uid(), 'c99 Padel in the club', 'sport', 'dubai', 'marina', now() + interval '3 days', 'meetup', v, 'community' from ids where k = 'gclub';
select pg_temp.as_admin();
select pg_temp.check((select girl_only from public.activities where id = 'c9900000-0000-0000-0000-0000000000b3'), 'an activity of a girls-only community is girls-only');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, format, community_id)
  select auth.uid(), 'c99 not a member', 'sport', 'dubai', 'marina', now() + interval '3 days', 'meetup', v from ids where k = 'club'$$) = '42501', 'a non-member cannot plan in a community');

-- ───────── 7. Cancelled, then deleted ─────────
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
update public.activities set cancelled_at = now() where id = 'c9900000-0000-0000-0000-0000000000b2';
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a2');
select pg_temp.check((select cancelled and conversation_id is not null from public.activity_detail('c9900000-0000-0000-0000-0000000000b2')), 'cancelled: the participant still opens it and its chat');
select pg_temp.check(exists (select 1 from public.messages m join public.conversations v on v.id = m.conversation_id
  where v.activity_id = 'c9900000-0000-0000-0000-0000000000b2' and m.kind = 'system' and m.body like '%cancelled%'), 'cancelled: the chat says so');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a5');
select pg_temp.check(pg_temp.fails($$select public.join_activity('c9900000-0000-0000-0000-0000000000b2', 'going')$$) = 'P0002', 'cancelled: nobody new can join');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a1');
select public.delete_activity('c9900000-0000-0000-0000-0000000000b2');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.conversations where activity_id = 'c9900000-0000-0000-0000-0000000000b2'), 'deleted: its chat goes with it (no broken link left)');
select pg_temp.as_user('c9900000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.activity_detail('c9900000-0000-0000-0000-0000000000b2')), 'deleted: its page says it no longer exists');

select pg_temp.as_admin();
-- Its plans leave the shared database (later files rank the first 50 of a city).
delete from public.activities where creator_id::text like 'c9900000%';
