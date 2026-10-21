-- IRLY Girl spaces (20261024009300_irly_girl_spaces.sql): a Live stays in the
-- space it was posted in, by every road (the feeds, a direct read of the
-- table, member_lives, an edit); and IRLY Girl's five official communities
-- exist once each, can be joined and left, and are for women only.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed c9300000-….
--
--   a1 Mia  woman, IRLY Girl access
--   a2 Sam  man, Mia's friend
--   a3 Nia  woman, Mia's friend
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
    raise exception 'FAIL girl_spaces: %', label;
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
insert into auth.users (id) values ('c9300000-0000-0000-0000-0000000000a1'), ('c9300000-0000-0000-0000-0000000000a2'), ('c9300000-0000-0000-0000-0000000000a3');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c9300000-0000-0000-0000-0000000000a1', 'Mia', '1995-02-02', 'woman', 'dubai'),
  ('c9300000-0000-0000-0000-0000000000a2', 'Sam', '1993-04-04', 'man', 'dubai'),
  ('c9300000-0000-0000-0000-0000000000a3', 'Nia', '1996-06-06', 'woman', 'dubai');
insert into public.friendships (user_a, user_b, status, requested_by) values
  ('c9300000-0000-0000-0000-0000000000a1', 'c9300000-0000-0000-0000-0000000000a2', 'accepted', 'c9300000-0000-0000-0000-0000000000a1'),
  ('c9300000-0000-0000-0000-0000000000a1', 'c9300000-0000-0000-0000-0000000000a3', 'accepted', 'c9300000-0000-0000-0000-0000000000a1');
-- A group chat Mia shares with Sam (not an IRLY Girl chat).
insert into public.conversations (id, kind, title) values ('c9300000-0000-0000-0000-0000000000d1', 'group', 'c93 mixed group');
insert into public.conversation_members (conversation_id, user_id) values
  ('c9300000-0000-0000-0000-0000000000d1', 'c9300000-0000-0000-0000-0000000000a1'), ('c9300000-0000-0000-0000-0000000000d1', 'c9300000-0000-0000-0000-0000000000a2');

-- ───────── 1. Mia posts one Live in each space ─────────
select pg_temp.as_user('c9300000-0000-0000-0000-0000000000a1');
select public.post_live('{"id":"c9300000-0000-0000-0000-0000000000c1","city_id":"dubai","area_id":"marina","body":"c93 girl live","visibility":"everyone","scope":"girl"}'::jsonb);
select public.post_live('{"id":"c9300000-0000-0000-0000-0000000000c2","city_id":"dubai","area_id":"marina","body":"c93 irly live","visibility":"everyone"}'::jsonb);
select pg_temp.as_admin();
select pg_temp.check((select app_scope from public.irl_posts where id = 'c9300000-0000-0000-0000-0000000000c1') = 'irly_girl', 'a Live posted from IRLY Girl is stored in IRLY Girl');
select pg_temp.check((select app_scope from public.irl_posts where id = 'c9300000-0000-0000-0000-0000000000c2') = 'irly', 'a Live posted with no space (installed apps) is stored in IRLY');
select pg_temp.as_user('c9300000-0000-0000-0000-0000000000a1');
select pg_temp.check((public.post_live('{"id":"c9300000-0000-0000-0000-0000000000c1","city_id":"dubai","area_id":"marina","body":"c93 girl live","scope":"girl"}'::jsonb) ->> 'replayed')::boolean,
  'posting the same Live again replays it (no double post)');
select pg_temp.check((select count(*) from public.irl_posts where id::text like 'c9300000-%') = 2, '… still two Lives');

-- « Anyone can join » from IRLY Girl: the plan is women only.
select public.post_live('{"id":"c9300000-0000-0000-0000-0000000000c5","city_id":"dubai","area_id":"marina","body":"c93 girl brunch, join","visibility":"everyone","scope":"girl"}'::jsonb,
  jsonb_build_object('title', 'c93 girl brunch', 'category_id', 'food', 'starts_at', now() + interval '2 hours'));
select pg_temp.as_admin();
select pg_temp.check((select a.girl_only and a.audience = 'girls' from public.activities a join public.irl_posts i on i.activity_id = a.id where i.id = 'c9300000-0000-0000-0000-0000000000c5'),
  'the plan of an IRLY Girl Live is women only');
select pg_temp.check(not exists (select 1 from public.notifications where user_id = 'c9300000-0000-0000-0000-0000000000a2' and kind = 'IRLY_POST_CREATED' and payload ->> 'body' like 'c93 girl%'),
  'Sam, her friend, is not told about her IRLY Girl Lives (their words never reach him)');
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'c9300000-0000-0000-0000-0000000000a2' and kind = 'IRLY_POST_CREATED' and payload ->> 'body' = 'c93 irly live'),
  '… he is told about her IRLY Live');
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'c9300000-0000-0000-0000-0000000000a3' and kind = 'IRLY_POST_CREATED' and payload ->> 'body' = 'c93 girl live'),
  'Nia, a woman friend, is told about the IRLY Girl Live');
select pg_temp.check(not private.user_can_see('c9300000-0000-0000-0000-0000000000a2', 'irl_post', 'c9300000-0000-0000-0000-0000000000c1')
  and private.user_can_see('c9300000-0000-0000-0000-0000000000a3', 'irl_post', 'c9300000-0000-0000-0000-0000000000c1'),
  'the server''s own visibility check follows the space');
select pg_temp.check(private.girl_target('irl_post', 'c9300000-0000-0000-0000-0000000000c1') and not private.girl_target('irl_post', 'c9300000-0000-0000-0000-0000000000c2'),
  'an IRLY Girl Live is IRLY Girl content, an IRLY one is not');
select pg_temp.as_user('c9300000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($$select public.share_to_chat('c9300000-0000-0000-0000-0000000000d1', 'irl_post', 'c9300000-0000-0000-0000-0000000000c1', 'c93 girl live')$$) = '42501',
  'sharing the IRLY Girl Live into a mixed group is refused');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, kind, body, ref_type, ref_id) values ('c9300000-0000-0000-0000-0000000000d1', 'c9300000-0000-0000-0000-0000000000a1', 'share', 'c93 sneaky', 'irl_post', 'c9300000-0000-0000-0000-0000000000c1')$$) = '42501',
  '… also written straight to the table');
select pg_temp.check(pg_temp.fails($$select public.share_to_chat('c9300000-0000-0000-0000-0000000000d1', 'irl_post', 'c9300000-0000-0000-0000-0000000000c2', 'c93 irly live')$$) is null,
  'sharing the IRLY Live into the group still works');

-- Mia's feeds.
select pg_temp.check(exists (select 1 from public.irl_feed_girl('dubai') f where f.id = 'c9300000-0000-0000-0000-0000000000c1'), 'IRLY Girl Live shows the IRLY Girl post');
select pg_temp.check(not exists (select 1 from public.irl_feed_girl('dubai') f where f.id = 'c9300000-0000-0000-0000-0000000000c2'), 'IRLY Girl Live does not show the IRLY post');
select pg_temp.check(exists (select 1 from public.irl_feed('dubai') f where f.id = 'c9300000-0000-0000-0000-0000000000c2'), 'IRLY Live shows the IRLY post');
select pg_temp.check(not exists (select 1 from public.irl_feed('dubai') f where f.id = 'c9300000-0000-0000-0000-0000000000c1'), 'IRLY Live does not show the IRLY Girl post');
select pg_temp.check((select array_agg(id::text order by id) from public.member_lives('c9300000-0000-0000-0000-0000000000a1', 'girl')) = array['c9300000-0000-0000-0000-0000000000c1', 'c9300000-0000-0000-0000-0000000000c5'], 'member_lives in IRLY Girl: only her IRLY Girl Lives');
select pg_temp.check((select array_agg(id::text) from public.member_lives('c9300000-0000-0000-0000-0000000000a1')) = array['c9300000-0000-0000-0000-0000000000c2'], 'member_lives (installed apps): only her IRLY Live');
update public.irl_posts set app_scope = 'irly' where id = 'c9300000-0000-0000-0000-0000000000c1';
select pg_temp.check((select app_scope from public.irl_posts where id = 'c9300000-0000-0000-0000-0000000000c1') = 'irly_girl', 'her own update cannot move a Live to the other space');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.fails($$update public.irl_posts set app_scope = 'irly' where id = 'c9300000-0000-0000-0000-0000000000c1'$$) = '42501', '… nor can any update on the server');
select pg_temp.as_user('c9300000-0000-0000-0000-0000000000a1');
select public.edit_live_post('c9300000-0000-0000-0000-0000000000c1', 'c93 girl live, edited');
select pg_temp.check((select app_scope from public.irl_posts where id = 'c9300000-0000-0000-0000-0000000000c1') = 'irly_girl', 'editing a Live keeps its space');

-- ───────── 2. Sam, a man: never reaches the IRLY Girl post ─────────
select pg_temp.as_user('c9300000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.irl_posts where id = 'c9300000-0000-0000-0000-0000000000c1'), 'direct read of the table: the IRLY Girl post is invisible');
select pg_temp.check(exists (select 1 from public.irl_posts where id = 'c9300000-0000-0000-0000-0000000000c2'), 'direct read of the table: the IRLY post is visible');
select pg_temp.check(not exists (select 1 from public.irl_feed('dubai') f where f.id = 'c9300000-0000-0000-0000-0000000000c1'), 'IRLY Live: no IRLY Girl post');
select pg_temp.check(pg_temp.fails($$select * from public.irl_feed_girl('dubai')$$) = '42501', 'IRLY Girl Live refused');
select pg_temp.check(not exists (select 1 from public.member_lives('c9300000-0000-0000-0000-0000000000a1', 'girl')), 'member_lives in IRLY Girl: nothing for him');
select pg_temp.check(pg_temp.fails($$select public.post_live('{"id":"c9300000-0000-0000-0000-0000000000c3","city_id":"dubai","area_id":"marina","body":"c93 sneaky","scope":"girl"}'::jsonb)$$) = '42501', 'posting in IRLY Girl refused');
select pg_temp.check(pg_temp.fails($$insert into public.irl_posts (id, author_id, city_id, area_id, body, app_scope) values ('c9300000-0000-0000-0000-0000000000c4', 'c9300000-0000-0000-0000-0000000000a2', 'dubai', 'marina', 'c93 direct', 'irly_girl')$$) = '42501', 'direct insert into IRLY Girl refused');
select pg_temp.check(pg_temp.fails($$select public.edit_live_post('c9300000-0000-0000-0000-0000000000c1', 'hacked')$$) = '42501', 'editing her IRLY Girl Live refused');
select pg_temp.check(pg_temp.fails($$select public.join_activity((select activity_id from public.irl_posts where id = 'c9300000-0000-0000-0000-0000000000c5'), 'going')$$) is not null,
  'he cannot join the plan of her IRLY Girl Live');
select pg_temp.check(not exists (select 1 from public.messages where conversation_id = 'c9300000-0000-0000-0000-0000000000d1' and body like 'c93 girl%'),
  'the mixed group holds no IRLY Girl words');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.irl_posts where id::text like 'c9300000-%') = 3, 'none of his tries wrote a Live');

-- ───────── 3. The five official IRLY Girl communities ─────────
select pg_temp.check((select count(*) from public.communities where official and deleted_at is null and topic in ('girl_newcomers', 'girl_network', 'girl_francophone', 'girl_trip', 'girl_activity')) = 5, 'five official IRLY Girl communities');
select pg_temp.check((select bool_and(girl_only) from public.communities where topic like 'girl\_%' and official), '… all women only');
select private.ensure_official_communities();
select pg_temp.check((select count(*) from public.communities where official and deleted_at is null and topic in ('girl_newcomers', 'girl_network', 'girl_francophone', 'girl_trip', 'girl_activity')) = 5, '… making them again creates no duplicate');

select pg_temp.as_user('c9300000-0000-0000-0000-0000000000a1');
select pg_temp.check((select array_agg(name order by ord) from public.girl_official_communities() with ordinality as g(id, topic, name, tagline, emoji, members, is_member, city_id, cover_path, ord))
  = array['Girl Trip', 'Girl Expat', 'Girl Activité', 'Girl Sport'], 'Mia sees IRLY Girl''s four (20261028100000), in order');
select public.join_community((select id from public.girl_official_communities() where topic = 'girl_trip'));
select public.join_community((select id from public.girl_official_communities() where topic = 'girl_trip'));
select pg_temp.check((select is_member and members = 1 from public.girl_official_communities() where topic = 'girl_trip'), 'joining (twice) makes her a member once, count 1');
select public.leave_community((select id from public.girl_official_communities() where topic = 'girl_trip'));
select pg_temp.check((select not is_member and members = 0 from public.girl_official_communities() where topic = 'girl_trip'), 'leaving: not a member, count back to 0');

select pg_temp.as_user('c9300000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.fails($$select * from public.girl_official_communities()$$) = '42501', 'Sam: the four are refused');
select pg_temp.check(not exists (select 1 from public.communities where topic like 'girl\_%'), 'Sam: direct read shows none of them');

select pg_temp.as_admin();
set role anon;
select pg_temp.check(pg_temp.fails($$select * from public.girl_official_communities()$$) = '42501', 'anon: not executable');
reset role;
