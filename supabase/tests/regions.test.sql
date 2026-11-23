-- Regions: IRLY Emirates and IRLY Bali (migration 20261125000000_irly_regions).
-- Account A lives in the Emirates, account B in Bali: each reads, creates and
-- joins inside her region only, on the server. Private chats are kept, and a
-- move from one region to the other is asked for, declared and spaced out.
-- Every check fails before that migration, except those marked (guard).
-- Runs in one transaction rolled back at the end. Ids 4e910000-….
\set ON_ERROR_STOP 1

begin;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
revoke all on table public.region_declarations from anon, authenticated;
grant select on table public.region_declarations to authenticated;
select private.restrict_profile_columns();

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL regions: %', label; end if;
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

-- 01 Amir (A, Dubai), 02 Bayu (B, Bali), 03 Dana (Dubai, woman, will move to
-- Bali), 04 Elif (Abu Dhabi), 05 Wayan (Bali, woman), 06 Sam (IRLY admin, Dubai).
insert into auth.users (id) select ('4e910000-0000-0000-0000-00000000000' || g)::uuid from generate_series(1, 6) g;
insert into public.profiles (id, first_name, birthdate, gender, city_id, interests) values
  ('4e910000-0000-0000-0000-000000000001', 'Amir', '1990-01-01', 'man', 'dubai', '{padel,food}'),
  ('4e910000-0000-0000-0000-000000000002', 'Bayu', '1990-01-01', 'man', 'bali', '{padel,food}'),
  ('4e910000-0000-0000-0000-000000000003', 'Dana', '1990-01-01', 'woman', 'dubai', '{padel,food}'),
  ('4e910000-0000-0000-0000-000000000004', 'Elif', '1990-01-01', 'woman', 'abudhabi', '{padel,food}'),
  ('4e910000-0000-0000-0000-000000000005', 'Wayan', '1990-01-01', 'woman', 'bali', '{padel,food}'),
  ('4e910000-0000-0000-0000-000000000006', 'Sam', '1990-01-01', 'man', 'dubai', '{}');
-- Verified, with three photos: what the people suggestions ask of whoever reads them.
update public.profiles set created_at = now() - interval '90 days', verified_at = now(),
  photo_paths = array[id::text || '/1.jpg', id::text || '/2.jpg', id::text || '/3.jpg'] where id::text like '4e910000-%';
insert into public.staff_roles (user_id, role) values ('4e910000-0000-0000-0000-000000000006', 'admin');

select pg_temp.check((select string_agg(region_id, ',' order by id) from public.profiles where id::text like '4e910000-%') = 'ae,id,ae,ae,id,ae',
  'region: every profile has the country of its city');

insert into public.communities (id, city_id, name, created_by) values
  ('4e910000-0000-0000-0000-0000000000c1', 'dubai', 'Region Dubai Padel', '4e910000-0000-0000-0000-000000000001'),
  ('4e910000-0000-0000-0000-0000000000c2', 'bali', 'Region Bali Surf', '4e910000-0000-0000-0000-000000000002');
insert into public.communities (id, city_id, name, created_by, girl_only) values
  ('4e910000-0000-0000-0000-0000000000c3', 'bali', 'Region Bali Girls', '4e910000-0000-0000-0000-000000000005', true);
insert into public.community_members (community_id, user_id, role) values
  ('4e910000-0000-0000-0000-0000000000c1', '4e910000-0000-0000-0000-000000000001', 'owner'),
  ('4e910000-0000-0000-0000-0000000000c1', '4e910000-0000-0000-0000-000000000003', 'member'),
  ('4e910000-0000-0000-0000-0000000000c2', '4e910000-0000-0000-0000-000000000002', 'owner'),
  ('4e910000-0000-0000-0000-0000000000c3', '4e910000-0000-0000-0000-000000000005', 'owner')
  on conflict (community_id, user_id) do update set role = excluded.role;
insert into public.community_posts (id, community_id, author_id, body) values
  ('4e910000-0000-0000-0000-0000000000a1', '4e910000-0000-0000-0000-0000000000c1', '4e910000-0000-0000-0000-000000000001', 'REGION-AE post'),
  ('4e910000-0000-0000-0000-0000000000a2', '4e910000-0000-0000-0000-0000000000c2', '4e910000-0000-0000-0000-000000000002', 'REGION-ID post');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at) values
  ('4e910000-0000-0000-0000-0000000000d1', '4e910000-0000-0000-0000-000000000001', 'Region padel in Dubai', 'sport', 'dubai', 'jumeirah', now() + interval '2 days'),
  ('4e910000-0000-0000-0000-0000000000d2', '4e910000-0000-0000-0000-000000000002', 'Region surf in Bali', 'sport', 'bali', 'canggu', now() + interval '2 days'),
  ('4e910000-0000-0000-0000-0000000000d3', '4e910000-0000-0000-0000-000000000003', 'Region Dana brunch in Dubai', 'food', 'dubai', 'jumeirah', now() + interval '3 days');
insert into public.irl_posts (id, author_id, city_id, area_id, body, visibility) values
  ('4e910000-0000-0000-0000-0000000000e1', '4e910000-0000-0000-0000-000000000001', 'dubai', 'jumeirah', 'REGION-AE live', 'everyone'),
  ('4e910000-0000-0000-0000-0000000000e2', '4e910000-0000-0000-0000-000000000002', 'bali', 'canggu', 'REGION-ID live', 'everyone');
insert into public.news_articles (title, url, city_id, published_at) values
  ('Region news Dubai', 'https://example.ae/region-ae', 'dubai', now()),
  ('Region news Bali', 'https://example.id/region-id', 'bali', now());
-- A private chat between A and B, and one between Dana and B: they outlive every move.
insert into public.conversations (id, kind, title) values
  ('4e910000-0000-0000-0000-0000000000f1', 'direct', null), ('4e910000-0000-0000-0000-0000000000f2', 'direct', null);
insert into public.conversation_members (conversation_id, user_id, role) values
  ('4e910000-0000-0000-0000-0000000000f1', '4e910000-0000-0000-0000-000000000001', 'member'),
  ('4e910000-0000-0000-0000-0000000000f1', '4e910000-0000-0000-0000-000000000002', 'member'),
  ('4e910000-0000-0000-0000-0000000000f2', '4e910000-0000-0000-0000-000000000003', 'member'),
  ('4e910000-0000-0000-0000-0000000000f2', '4e910000-0000-0000-0000-000000000002', 'member');
insert into public.messages (conversation_id, sender_id, body) values
  ('4e910000-0000-0000-0000-0000000000f1', '4e910000-0000-0000-0000-000000000001', 'region hello from Dubai'),
  ('4e910000-0000-0000-0000-0000000000f2', '4e910000-0000-0000-0000-000000000003', 'region hello from Dana');
-- A public game table hosted in Bali.
insert into public.game_rooms (id, game, space, host_id, title, max_players, kind, status, visibility) values
  ('4e910000-0000-0000-0000-0000000000b1', 'werewolf', 'irly', '4e910000-0000-0000-0000-000000000002', 'Region Bali wolves', 8, 'online', 'waiting', 'public');
select pg_temp.check((select region_id from public.game_rooms where id = '4e910000-0000-0000-0000-0000000000b1') = 'id',
  'games: a table takes the region of its host');
-- Dana has a seat in A's activity.
select pg_temp.as_user('4e910000-0000-0000-0000-000000000003');
select public.join_activity('4e910000-0000-0000-0000-0000000000d1');

-- ───────── A (Emirates): her region only ─────────
select pg_temp.as_user('4e910000-0000-0000-0000-000000000001');
select pg_temp.check((public.my_region() ->> 'region_id') = 'ae' and (public.my_region() -> 'regions') @> '[{"id": "id"}]'::jsonb,
  'A: my region is the Emirates, and Bali is among the open regions');
select pg_temp.check(private.city_scope('bali') = private.city_scope('dubai') and not ('bali' = any (private.city_scope('bali'))),
  'A: a list asked for Bali is answered for her own region');
select pg_temp.check((select count(*) from public.communities where id = '4e910000-0000-0000-0000-0000000000c2') = 0
  and (select count(*) from public.communities where id = '4e910000-0000-0000-0000-0000000000c1') = 1, 'A: communities are separate (table)');
select pg_temp.check(not exists (select 1 from public.community_list('bali') where id = '4e910000-0000-0000-0000-0000000000c2')
  and not exists (select 1 from public.community_directory('bali') where id = '4e910000-0000-0000-0000-0000000000c2'), 'A: communities are separate (lists asked for Bali)');
select pg_temp.check((select count(*) from public.community_posts where body like 'REGION-%') = 1
  and (select body from public.community_posts where body like 'REGION-%') = 'REGION-AE post', 'A: the feed of posts is separate');
select pg_temp.check((select count(*) from public.activities where title like 'Region %' and city_id = 'bali') = 0
  and (select count(*) from public.activities where id = '4e910000-0000-0000-0000-0000000000d1') = 1, 'A: activities are separate (table)');
select pg_temp.check(not exists (select 1 from public.map_activities('bali') where id = '4e910000-0000-0000-0000-0000000000d2')
  and (select count(*) from public.search_all('Region surf', 'bali')) = 0
  and (select count(*) from public.search_all('Region padel', 'bali')) >= 1, 'A: the map and the search asked for Bali show no Bali activity (and still hers)');
select pg_temp.check((select count(*) from public.irl_posts where body like 'REGION-%') = 1
  and not exists (select 1 from public.irl_feed('bali') where body = 'REGION-ID live'), 'A: Lives are separate');
select pg_temp.check((select count(*) from public.news_articles where title like 'Region news%') = 1
  and (select count(*) from public.news_feed('bali') where title = 'Region news Bali') = 0, 'A: news is separate');
select pg_temp.check(not exists (select 1 from public.people_match('bali') where id = '4e910000-0000-0000-0000-000000000002')
  and exists (select 1 from public.people_match('dubai') where id = '4e910000-0000-0000-0000-000000000004'),
  'A: people suggested are of her region (another emirate yes, Bali no)');
select pg_temp.check(not (public.game_rooms_open('werewolf', 'irly') @> '[{"id": "4e910000-0000-0000-0000-0000000000b1"}]'::jsonb), 'A: open game tables are of her region');
select pg_temp.check(pg_temp.fails($q$insert into public.game_participants (room_id, user_id) values ('4e910000-0000-0000-0000-0000000000b1', '4e910000-0000-0000-0000-000000000001')$q$) is not null,
  'A: she takes no seat at a public table of Bali');
-- Writes.
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at) values (auth.uid(), 'Region A in Bali', 'sport', 'bali', 'canggu', now() + interval '2 days')$q$) = '42501',
  'A: she creates no activity in Bali');
select pg_temp.check(pg_temp.fails($q$select public.create_community('Region A club in Bali', 'bali')$q$) = '42501', 'A: nor a community');
select pg_temp.check(pg_temp.fails($q$insert into public.irl_posts (author_id, city_id, area_id, body, visibility) values (auth.uid(), 'bali', 'canggu', 'A live in Bali', 'everyone')$q$) = '42501', 'A: nor a Live');
select pg_temp.check(pg_temp.fails($q$select public.join_activity('4e910000-0000-0000-0000-0000000000d2')$q$) is not null, 'A: she joins no activity of Bali');
select pg_temp.check(pg_temp.fails($q$select public.join_community('4e910000-0000-0000-0000-0000000000c2')$q$) is not null, 'A: nor a community of Bali');
select pg_temp.check(pg_temp.fails($q$update public.profiles set city_id = 'bali' where id = auth.uid()$q$) = '42501', 'A: writing Bali as her city is refused');
select pg_temp.check(pg_temp.fails($q$update public.profiles set residency_declared_at = now() where id = auth.uid()$q$) = '42501', 'A: nor her declaration');
select pg_temp.check(pg_temp.fails($q$update public.profiles set city_id = 'abudhabi' where id = auth.uid()$q$) is null, 'A (guard): she changes emirate freely');
select pg_temp.check((public.my_region() ->> 'city_id') = 'abudhabi' and (public.my_region() ->> 'region_id') = 'ae', 'A (guard): and stays in the Emirates');
update public.profiles set city_id = 'dubai' where id = auth.uid();
-- Private chats are not regional.
select pg_temp.check((select count(*) from public.messages where conversation_id = '4e910000-0000-0000-0000-0000000000f1') = 1, 'A (guard): her private chat with B is readable');

-- ───────── B (Bali): his region only ─────────
select pg_temp.as_user('4e910000-0000-0000-0000-000000000002');
select pg_temp.check((public.my_region() ->> 'region_id') = 'id', 'B: my region is Bali');
select pg_temp.check((select string_agg(name, ',' order by name) from public.communities where name like 'Region %') = 'Region Bali Surf', 'B: communities are separate');
select pg_temp.check((select body from public.community_posts where body like 'REGION-%') = 'REGION-ID post', 'B: posts are separate');
select pg_temp.check((select string_agg(title, ',') from public.activities where title like 'Region %') = 'Region surf in Bali', 'B: activities are separate');
select pg_temp.check((select count(*) from public.search_all('Region surf', 'dubai')) >= 1
  and (select count(*) from public.search_all('Region padel', 'dubai')) = 0
  and not exists (select 1 from public.map_activities('dubai') where id = '4e910000-0000-0000-0000-0000000000d1'), 'B: the search and the map answer for Bali, whatever city is asked');
select pg_temp.check((select body from public.irl_posts where body like 'REGION-%') = 'REGION-ID live', 'B: Lives are separate');
select pg_temp.check((select title from public.news_articles where title like 'Region news%') = 'Region news Bali', 'B: news is separate');
select pg_temp.check(not exists (select 1 from public.people_match('dubai') where id = '4e910000-0000-0000-0000-000000000001'), 'B: people of the Emirates are not suggested');
select pg_temp.check(public.game_rooms_open('werewolf', 'irly') @> '[{"id": "4e910000-0000-0000-0000-0000000000b1"}]'::jsonb, 'B (guard): the table of his region is listed');
select pg_temp.check(pg_temp.fails($q$select public.join_activity('4e910000-0000-0000-0000-0000000000d1')$q$) is not null
  and pg_temp.fails($q$select public.join_community('4e910000-0000-0000-0000-0000000000c1')$q$) is not null, 'B: he joins nothing of the Emirates');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at) values (auth.uid(), 'Region B second surf', 'sport', 'bali', 'canggu', now() + interval '4 days')$q$) is null,
  'B (guard): he creates an activity in Bali');
select pg_temp.check((select (r ->> 'declared_at') is not null from public.declare_residency('id') r), 'B: he declares that he lives in Bali');
select pg_temp.check(pg_temp.fails($q$select public.declare_residency('ae')$q$) = '22023', 'B: not for a region that is not his');
select pg_temp.check((select count(*) from public.region_declarations where user_id = auth.uid() and source = 'signup') = 1
  and (select count(*) from public.region_declarations) = 1, 'B: the declaration is kept, and he reads his own only');

-- IRLY Girl follows the region too.
select pg_temp.as_user('4e910000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from public.communities where id = '4e910000-0000-0000-0000-0000000000c3') = 1, 'girl (guard): a woman of Bali sees the women-only community of Bali');
select pg_temp.as_user('4e910000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from public.communities where id = '4e910000-0000-0000-0000-0000000000c3') = 0, 'girl: a woman of the Emirates does not');

-- IRLY's staff read every region.
select pg_temp.as_user('4e910000-0000-0000-0000-000000000006');
select pg_temp.check((select count(*) from public.communities where id in ('4e910000-0000-0000-0000-0000000000c1', '4e910000-0000-0000-0000-0000000000c2')) = 2
  and (select count(*) from public.activities where title like 'Region %') >= 3, 'staff: an IRLY admin reads both regions');

-- ───────── Moving: Dana goes from Dubai to Bali ─────────
select pg_temp.as_user('4e910000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.fails($q$select public.change_region('id', 'bali', false)$q$) = '22023', 'move: not without the declaration');
select pg_temp.check(pg_temp.fails($q$select public.change_region('id', 'dubai', true)$q$) = '22023', 'move: the city belongs to the region');
select pg_temp.check(pg_temp.fails($q$select public.change_region('ae', 'abudhabi', true)$q$) = '22023', 'move: not to the region she is in');
-- The owner of a community hands it over or deletes it first.
select pg_temp.as_user('4e910000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails($q$select public.change_region('id', 'bali', true)$q$) = '22023', 'move: the owner of a community of the region does not just leave');
select pg_temp.check((public.my_region() ->> 'region_id') = 'ae' and exists (select 1 from public.community_members where community_id = '4e910000-0000-0000-0000-0000000000c1' and user_id = auth.uid()),
  'move: nothing changed for her');

select pg_temp.as_user('4e910000-0000-0000-0000-000000000003');
select pg_temp.check((select (r ->> 'region_id') = 'id' and (r ->> 'city_id') = 'bali' and (r ->> 'left_communities')::int = 1 and (r ->> 'left_activities')::int = 1
  and (r ->> 'can_change_at') is not null from public.change_region('id', 'bali', true) r), 'move: Dana lives in Bali now; one community and one seat were left');
select pg_temp.as_admin();
select pg_temp.check((select region_id = 'id' and city_id = 'bali' and residency_declared_at is not null from public.profiles where id = '4e910000-0000-0000-0000-000000000003'),
  'move: the profile is updated, with its declaration');
select pg_temp.check((select count(*) from public.region_declarations where user_id = '4e910000-0000-0000-0000-000000000003' and source = 'change' and previous_region = 'ae' and region_id = 'id') = 1,
  'move: the move is recorded');
select pg_temp.check(not exists (select 1 from public.community_members where community_id = '4e910000-0000-0000-0000-0000000000c1' and user_id = '4e910000-0000-0000-0000-000000000003')
  and not exists (select 1 from public.conversation_members cm join public.conversations v on v.id = cm.conversation_id
    where v.community_id = '4e910000-0000-0000-0000-0000000000c1' and cm.user_id = '4e910000-0000-0000-0000-000000000003'),
  'move: she left the community of the Emirates and its chat');
select pg_temp.check(not exists (select 1 from public.activity_participants where activity_id = '4e910000-0000-0000-0000-0000000000d1' and user_id = '4e910000-0000-0000-0000-000000000003'),
  'move: her seat in the activity coming up there is freed');
select pg_temp.check(exists (select 1 from public.profiles where id = '4e910000-0000-0000-0000-000000000003' and deleted_at is null)
  and exists (select 1 from public.activities where id = '4e910000-0000-0000-0000-0000000000d3' and cancelled_at is null),
  'move: the account is the same, and what she organised is untouched');
select pg_temp.as_user('4e910000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from public.messages where conversation_id = '4e910000-0000-0000-0000-0000000000f2') = 1, 'move: her private chat is kept');
select pg_temp.check((select count(*) from public.communities where id = '4e910000-0000-0000-0000-0000000000c2') = 1
  and (select count(*) from public.communities where id = '4e910000-0000-0000-0000-0000000000c1') = 0, 'move: she sees the communities of Bali, no longer those of the Emirates');
select pg_temp.check((select count(*) from public.activities where id = '4e910000-0000-0000-0000-0000000000d1') = 0
  and (select count(*) from public.activities where id = '4e910000-0000-0000-0000-0000000000d3') = 1, 'move: nor their activities, except the one she organises');
select pg_temp.check(not exists (select 1 from public.people_match('dubai') where id = '4e910000-0000-0000-0000-000000000001'), 'move: people of the old region are no longer suggested');
select pg_temp.check(pg_temp.fails($q$select public.join_community('4e910000-0000-0000-0000-0000000000c2')$q$) is null, 'move: she joins a community of Bali');
-- Not back and forth.
select pg_temp.check(pg_temp.fails($q$select public.change_region('ae', 'dubai', true)$q$) = 'P0001', 'move: a second move right away is refused');
select pg_temp.as_admin();
update public.region_declarations set declared_at = now() - interval '91 days' where user_id = '4e910000-0000-0000-0000-000000000003' and source = 'change';
select pg_temp.as_user('4e910000-0000-0000-0000-000000000003');
select pg_temp.check((select (r ->> 'region_id') = 'ae' from public.change_region('ae', 'dubai', true) r), 'move: after 90 days she may move again');
select pg_temp.check((select count(*) from public.messages where conversation_id = '4e910000-0000-0000-0000-0000000000f2') = 1, 'move: and her private chat is still there');
-- B, who stayed, still reads the private chats with the people who moved or live elsewhere.
select pg_temp.as_user('4e910000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.messages where conversation_id in ('4e910000-0000-0000-0000-0000000000f1', '4e910000-0000-0000-0000-0000000000f2')) = 2,
  'chats: B keeps his private chats with A and with Dana');

rollback;
