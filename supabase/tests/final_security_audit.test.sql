-- Final security audit of migrations 20261109* to 20261110* (and the fixes of
-- 20261110700000_irly_space_lists): every new road keeps IRLY Girl, Mom and
-- women-only Network content to women with IRLY Girl access, each app space
-- lists only its own communities, and the new follows, Live and
-- activity-from-post rules hold.
--
--   0. Static: every security definer function sets its search_path; none
--      of the new functions is callable signed out; row security is on.
--   1. Space lists: a woman in Mixte gets no Girl, Mom or women-only Network
--      community from any list (community_list, community_directory,
--      community_recommend, member_communities, search_all, event and post
--      plans); in IRLY Girl none of her Mixte ones; no space = as before.
--   2. B, a man, with IRLY Girl ids: direct selects and every new RPC.
--   3. C (mom) and D (network member): their communities in their spaces.
--   4. E, community admin and co-admin; staff-only functions refused.
--   5. The Live: one record, in_live rules, the space of each Live.
--   6. Activities from a post: guard, double tap, FK on removal.
--   7. Notifications: universe only for the reader's own rows.
--   8. Storage stand-in: covers and post media of IRLY Girl communities.
--   9. F, mutual follows: follow, counts, friends, unfollow, block,
--      unblock, account deletion.
--  10. Integrity: FKs, indexes, no duplicate (DM pair, Live id).
-- Runs in one transaction rolled back at the end. TEST accounts only, ids
-- f1a00000-….
--
--   01 Ana   woman, IRLY Girl access, uses Mixte and IRLY Girl (persona A)
--   02 Ben   man (persona B, the attacker)
--   03 Cora  woman, IRLY Girl access, a mom (persona C)
--   04 Dina  woman, IRLY Girl access, IRLY Network member (persona D), owns the Network communities
--   05 Eli   woman, IRLY Girl access, owns the Mixte, Girl and Mom communities (persona E)
--   06 Fay   woman, IRLY Girl access, co-admin of the Girl community (persona E)
--   07 Gus   man   } persona F: mutual follows
--   08 Hal   man   }
\set ON_ERROR_STOP 1

begin;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
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
  if not coalesce(ok, false) then raise exception 'FAIL final_security_audit: %', label; end if;
  raise notice 'ok  %', label;
end $$;
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;
create or replace function pg_temp.rows(q text) returns integer language plpgsql as $$
declare n integer;
begin
  execute format('select count(*) from (%s) x', q) into n;
  return n;
exception when others then
  return -1;
end $$;

-- ───────── 0. Static ─────────
select pg_temp.check(not exists (
    select 1 from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
      -- An extension's own functions (dblink, installed by a test) are not ours.
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')),
  'every security definer function of IRLY sets its search_path');
select pg_temp.check(not has_function_privilege('anon', p.oid, 'execute'), 'signed out cannot call ' || p.oid::regprocedure::text)
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('my_conversations', 'notification_universe', 'notification_women_only', 'follow_user', 'unfollow_user',
    'community_list', 'community_directory', 'community_recommend', 'member_communities', 'search_all', 'search_all_girl',
    'post_activities', 'event_activities', 'map_activity_pins', 'live_feed', 'member_activities', 'girl_official_communities',
    'mom_official_communities', 'staff_girl_communities', 'staff_girl_community', 'staff_girl_chat', 'staff_girl_activities',
    'admin_official_topics', 'create_subgroup', 'suggest_groups', 'create_group', 'add_group_members', 'rename_group', 'leave_group',
    'community_audit_log', 'community_my_rights', 'community_sanctions', 'community_stats', 'set_community_role', 'girl_feed',
    'my_girl_moderation', 'girl_selfie_required', 'admin_girl_moderator', 'admin_set_girl_moderator', 'admin_girl_selfie',
    'admin_set_girl_selfie_mode', 'irly_post', 'irly_chat_message', 'irly_announce', 'irly_pin_message', 'irly_pin_post',
    'admin_community', 'admin_content', 'admin_content_item', 'delete_my_account', 'open_direct', 'block_user', 'unblock_user');
select pg_temp.check(not has_function_privilege('anon', p.oid, 'execute'), 'signed out cannot call ' || p.oid::regprocedure::text)
from pg_proc p
where p.pronamespace = 'private'::regnamespace
  and p.proname in ('community_universe', 'conversation_universe', 'activity_universe', 'notification_universe_of',
    'community_live_space', 'space_scope', 'community_in_space', 'activity_in_space', 'follow_makes_friends',
    'unfollow_ends_friends', 'friends_follow_each_other', 'unfriend_unfollows', 'activity_source_post_guard',
    'activity_time_guard', 'followed_back_push', 'notification_community_gone');
select pg_temp.check(not has_function_privilege('authenticated', p.oid, 'execute'), 'members cannot call trigger/helper ' || p.oid::regprocedure::text)
from pg_proc p
where p.pronamespace = 'private'::regnamespace
  and p.proname in ('community_universe', 'conversation_universe', 'notification_universe_of', 'follow_makes_friends',
    'unfollow_ends_friends', 'friends_follow_each_other', 'unfriend_unfollows', 'activity_time_guard', 'followed_back_push',
    'send_activity_reminders');
select pg_temp.check(c.relrowsecurity, 'row security on public.' || c.relname)
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('communities', 'community_members', 'community_posts', 'activities', 'activity_participants', 'conversations',
    'conversation_members', 'messages', 'notifications', 'follows', 'friendships', 'irl_posts', 'blocks', 'profiles');
-- No read rule of these tables is open to signed-out visitors (never widened).
select pg_temp.check(not exists (select 1 from pg_policies where schemaname = 'public'
    and tablename in ('community_posts', 'notifications', 'follows', 'friendships', 'conversations', 'messages', 'activities', 'communities')
    and permissive = 'PERMISSIVE' and ('anon' = any (roles) or 'public' = any (roles))),
  'no permissive read rule for signed-out visitors on the social tables');
-- One function per name for the space lists (no ambiguous overload).
select pg_temp.check((select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = n.n) = 1, 'one ' || n.n || ' only')
from (values ('community_list'), ('community_directory'), ('community_recommend'), ('member_communities'), ('search_all'),
  ('event_activities'), ('post_activities')) n (n);

-- ───────── Accounts and communities ─────────
select pg_temp.as_admin();
insert into auth.users (id) select ('f1a00000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid from generate_series(1, 8) g;
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('f1a00000-0000-0000-0000-000000000001', 'Ana', '1992-01-01', 'woman', 'dubai'),
  ('f1a00000-0000-0000-0000-000000000002', 'Ben', '1990-01-01', 'man', 'dubai'),
  ('f1a00000-0000-0000-0000-000000000003', 'Cora', '1988-01-01', 'woman', 'dubai'),
  ('f1a00000-0000-0000-0000-000000000004', 'Dina', '1991-01-01', 'woman', 'dubai'),
  ('f1a00000-0000-0000-0000-000000000005', 'Eli', '1989-01-01', 'woman', 'dubai'),
  ('f1a00000-0000-0000-0000-000000000006', 'Fay', '1993-01-01', 'woman', 'dubai'),
  ('f1a00000-0000-0000-0000-000000000007', 'Gus', '1990-01-01', 'man', 'dubai'),
  ('f1a00000-0000-0000-0000-000000000008', 'Hal', '1991-01-01', 'man', 'dubai');
update public.profiles set created_at = now() - interval '90 days' where id::text like 'f1a00000-%';
update public.profiles set verified_at = now() where gender = 'woman' and id::text like 'f1a00000-%';

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000005');
insert into ids values
  ('mixte', public.create_community('F1a Mixte Padel', 'dubai', 'Padel', 'Mixed padel', 'sport', false)),
  ('girl', public.create_community('F1a Girls Brunch', 'dubai', 'Brunch', 'Women only brunch', 'food', true)),
  ('mom', public.create_community('F1a Mom Walks', 'dubai', 'Walks', 'Moms walk', 'family', true));
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000004');
insert into ids values
  ('netw', public.create_community('F1a Women Founders', 'dubai', 'Founders', 'Women founders', 'networking', true)),
  ('netm', public.create_community('F1a Founders Mixed', 'dubai', 'Founders', 'Founders', 'networking', false));
select pg_temp.as_admin();
update public.communities set topic = 'mom_sport' where id = (select v from ids where k = 'mom');
update public.communities set cover_path = 'f1a00000-0000-0000-0000-000000000005/' || k || '.jpg'
from ids where communities.id = ids.v;
select pg_temp.check(private.community_live_space((select v from ids where k = 'mixte')) = 'irly'
    and private.community_live_space((select v from ids where k = 'netm')) = 'irly'
    and private.community_live_space((select v from ids where k = 'girl')) = 'irly_girl'
    and private.community_live_space((select v from ids where k = 'mom')) = 'irly_girl'
    and private.community_live_space((select v from ids where k = 'netw')) = 'irly_girl',
  'setup: Mixte and mixed Network in Mixte; Girl, Mom and women-only Network in IRLY Girl');

-- Ana joins all five, Cora the Mom one, Dina the Girl one, Fay the Girl one, Ben the Mixte and mixed Network ones.
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000001');
select public.join_community(v) from ids where k in ('mixte', 'girl', 'mom', 'netw');
select public.join_community(v) from ids where k = 'netm';
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000003');
select public.join_community((select v from ids where k = 'mom'));
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000006');
select public.join_community((select v from ids where k = 'girl'));
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000002');
select public.join_community(v) from ids where k in ('mixte', 'netm');
select pg_temp.check(pg_temp.fails(format('select public.join_community(%L)', v)) is not null, 'B cannot join the ' || k || ' community')
from ids where k in ('girl', 'mom', 'netw');

-- Plans: one in each community (members create them, persona « members can create activities »), linked to an event.
create or replace function pg_temp.plan(who uuid, cid uuid, title text) returns uuid language plpgsql as $$
declare r uuid;
begin
  perform pg_temp.as_user(who);
  insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, girl_only, community_id, client_ref, event_key)
  values (who, title, 'sport', 'dubai', 'jumeirah', now() + interval '2 days',
    coalesce((select girl_only from public.communities where id = cid), false), cid, gen_random_uuid(), 'e-f1a-gala')
  returning id into r;
  return r;
end $$;
insert into ids select 'plan_' || k, pg_temp.plan('f1a00000-0000-0000-0000-000000000001', v, 'F1a plan ' || k) from ids where k in ('mixte', 'girl', 'mom', 'netw', 'netm');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.activities where title like 'F1a plan %' and community_id is not null) = 5
    and (select bool_and(girl_only = (title in ('F1a plan girl', 'F1a plan mom', 'F1a plan netw'))) from public.activities where title like 'F1a plan %'),
  'setup: a plain member created a plan in each community (women-only where the community is)');

-- ───────── 1. Each space lists its own (A, a woman in both) ─────────
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000001');
create temp table girlish as select v from ids where k in ('girl', 'mom', 'netw');
create temp table mixtish as select v from ids where k in ('mixte', 'netm');
grant all on girlish, mixtish to authenticated;

select pg_temp.check((select count(*) from public.community_list('dubai', 'mixte') where id in (select v from girlish)) = 0
    and (select count(*) from public.community_list('dubai', 'mixte') where id in (select v from mixtish)) = 2,
  'A, community_list in Mixte: her Mixte and mixed Network ones, no Girl, Mom or women-only Network');
select pg_temp.check((select count(*) from public.community_list('dubai', 'girl') where id in (select v from mixtish)) = 0
    and (select count(*) from public.community_list('dubai', 'girl') where id in (select v from girlish)) = 3,
  'A, community_list in IRLY Girl: Girl, Mom, women-only Network, none of her Mixte ones');
select pg_temp.check((select count(*) from public.community_list('dubai', 'mixte') where girl_only) = 0
    and (select count(*) from public.community_list('dubai', 'girl') where private.community_live_space(id) <> 'irly_girl') = 0,
  'A, community_list: no women-only row at all in Mixte (official ones included), no Mixte row in IRLY Girl');
select pg_temp.check((select count(*) from public.community_list('dubai')) >= 5, 'A, community_list without a space: as before, both');
select pg_temp.check((select count(*) from public.community_directory('dubai', 'members', null, 200, 'mixte') where girl_only or id in (select v from girlish)) = 0
    and (select count(*) from public.community_directory('dubai', 'recent', 'F1a', 200, 'mixte')) = 2
    and (select count(*) from public.community_directory('dubai', 'recent', 'F1a', 200, 'girl')) = 3
    and (select count(*) from public.community_directory('dubai', 'recent', 'F1a', 200)) = 5,
  'A, community_directory: 2 in Mixte, 3 in IRLY Girl, 5 without a space, searched alike');
select pg_temp.check((select count(*) from public.community_recommend('dubai', array['interest:sport', 'interest:food', 'type:family', 'goal:network', 'newcomer', 'lang:fr', 'interest:running', 'interest:padel', 'interest:travel'], 20, 'mixte') where girl_only) = 0
    and (select count(*) from public.community_recommend('dubai', array['interest:sport', 'interest:food', 'type:family', 'goal:network', 'newcomer', 'lang:fr', 'interest:running', 'interest:padel', 'interest:travel'], 20, 'girl') r
         where private.community_live_space(r.id) <> 'irly_girl') = 0,
  'A, community_recommend: no Girl or Mom twin in Mixte, no Mixte official in IRLY Girl');
select pg_temp.check((select count(*) from public.member_communities('f1a00000-0000-0000-0000-000000000001', 'mixte') where id in (select v from girlish)) = 0
    and (select count(*) from public.member_communities('f1a00000-0000-0000-0000-000000000001', 'mixte')) = 2
    and (select count(*) from public.member_communities('f1a00000-0000-0000-0000-000000000001', 'girl')) = 3
    and (select count(*) from public.member_communities('f1a00000-0000-0000-0000-000000000001')) = 5,
  'A, member_communities (her profile): 2 in Mixte, 3 in IRLY Girl, 5 without a space');
select pg_temp.check((select count(*) from public.search_all('F1a', 'dubai', 100, 'mixte') where kind in ('community', 'activity') and (id::uuid in (select v from girlish)
      or id::uuid in (select a.id from public.activities a where a.girl_only))) = 0
    and (select count(*) from public.search_all('F1a', 'dubai', 100, 'mixte') where kind = 'community') = 2
    and (select count(*) from public.search_all('F1a', 'dubai', 100, 'mixte') where kind = 'activity') = 2
    and (select count(*) from public.search_all('F1a', 'dubai', 100, 'girl') where kind = 'community' and id::uuid in (select v from mixtish)) = 0
    and (select count(*) from public.search_all('F1a', 'dubai', 100) where kind = 'community') = 5,
  'A, search_all: Mixte finds no Girl, Mom or women-only Network community or plan; IRLY Girl none of her Mixte ones');
select pg_temp.check((select count(*) from public.search_all_girl('F1a', 'dubai', 100) where kind = 'community' and id::uuid in (select v from mixtish)) = 0,
  'A, search_all_girl: none of her Mixte communities');
select pg_temp.check((select count(*) from public.event_activities('e-f1a-gala', 50, 'mixte') where girl_only) = 0
    and (select count(*) from public.event_activities('e-f1a-gala', 50, 'mixte')) = 2
    and (select count(*) from public.event_activities('e-f1a-gala', 50, 'girl')) = 3
    and (select count(*) from public.event_activities('e-f1a-gala', 50)) = 5,
  'A, event_activities: 2 Mixte plans in Mixte, 3 women-only plans in IRLY Girl');
select pg_temp.check(pg_temp.fails($$select * from public.community_list('dubai', 'nowhere')$$) = '22023'
    and pg_temp.fails($$select * from public.community_directory('dubai', 'members', null, 10, 'mom')$$) = '22023',
  'an unknown space is refused (22023)');
select pg_temp.check((select count(*) from public.member_activities('f1a00000-0000-0000-0000-000000000001') where title like 'F1a plan %' and universe in ('girl', 'mom')) = 2
    and (select count(*) from public.member_activities('f1a00000-0000-0000-0000-000000000001') where title = 'F1a plan netw' and universe = 'network' and girl_only) = 1,
  'A, member_activities: each plan with its universe and women-only flag (My recap sorts them by space)');
select pg_temp.check((select count(*) from public.my_conversations() c where c.universe in ('girl', 'mom') or (c.universe = 'network' and c.women_only)) >= 3
    and (select count(*) from public.my_conversations() c where c.ref_id = (select v from ids where k = 'mixte') and c.universe = 'mixte' and not c.women_only) = 1,
  'A, my_conversations: each community chat with its universe and women-only side');

-- ───────── 2. B, a man, with IRLY Girl ids ─────────
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.communities where id in (select v from girlish)) = 0
    and (select count(*) from public.activities where community_id in (select v from girlish) or girl_only) = 0
    and (select count(*) from public.conversations where community_id in (select v from girlish)) = 0,
  'B, direct selects: no Girl, Mom or women-only Network community, plan or chat');
select pg_temp.check((select count(*) from public.community_list('dubai', 'girl')) = 0
    and (select count(*) from public.community_list('dubai')) >= 2
    and (select count(*) from public.community_list('dubai') where girl_only) = 0,
  'B, community_list: nothing in IRLY Girl, no women-only row without a space');
select pg_temp.check((select count(*) from public.community_directory('dubai', 'recent', 'F1a', 200, 'girl')) = 0
    and (select count(*) from public.community_directory('dubai', 'recent', 'F1a', 200)) = 2,
  'B, community_directory: no women-only community, even asking IRLY Girl');
select pg_temp.check((select count(*) from public.member_communities('f1a00000-0000-0000-0000-000000000001', 'girl')) = 0
    and (select count(*) from public.member_communities('f1a00000-0000-0000-0000-000000000001') where girl_only) = 0,
  'B, A''s profile: none of her women-only communities, whatever the space');
select pg_temp.check((select count(*) from public.member_activities('f1a00000-0000-0000-0000-000000000001') where girl_only) = 0,
  'B, A''s activities: none of her women-only plans');
select pg_temp.check((select count(*) from public.search_all('F1a', 'dubai', 100, 'girl') where kind in ('community', 'activity')) = 0
    and pg_temp.fails($$select * from public.search_all_girl('F1a', 'dubai', 100)$$) = '42501',
  'B, search: nothing women-only; the IRLY Girl search is refused');
select pg_temp.check((select count(*) from public.event_activities('e-f1a-gala', 50) where girl_only) = 0
    and (select count(*) from public.event_activities('e-f1a-gala', 50, 'girl')) = 0,
  'B, event_activities: no women-only plan');
select pg_temp.check(pg_temp.fails($$select * from public.live_feed('dubai', 'irly_girl')$$) = '42501'
    and pg_temp.fails($$select * from public.map_activity_pins('dubai', p_girl_only => true)$$) = '42501'
    and pg_temp.fails($$select * from public.girl_official_communities()$$) is not null
    and pg_temp.fails($$select * from public.mom_official_communities()$$) is not null,
  'B, IRLY Girl Live, map, official lists: refused');
select pg_temp.check((select count(*) from public.map_activity_pins('dubai') m where m.id in (select v from ids where k like 'plan_%' and k in ('plan_girl', 'plan_mom', 'plan_netw'))) = 0,
  'B, map_activity_pins: no women-only plan');
select pg_temp.check((select count(*) from public.my_conversations() c where c.women_only or c.universe in ('girl', 'mom')) = 0
    and (select count(*) from public.my_conversations() c where c.ref_id in (select v from girlish)) = 0,
  'B, my_conversations: no women-only chat');
select pg_temp.check(pg_temp.rows(format('select * from public.community_activities(%L)', v)) <= 0, 'B, community_activities: nothing for ' || k)
from ids where k in ('girl', 'mom', 'netw');
select pg_temp.check(pg_temp.fails(format($q$insert into public.community_posts (community_id, author_id, body, in_live) values (%L, auth.uid(), 'F1a intrusion', true)$q$, v)) is not null,
  'B cannot post (nor publish to the Live) in the ' || k || ' community')
from ids where k in ('girl', 'mom', 'netw');
select pg_temp.check(pg_temp.fails(format('select public.set_community_role(%L, %L, %L)', (select v from ids where k = 'girl'), 'f1a00000-0000-0000-0000-000000000002', 'co_admin')) is not null,
  'B cannot make himself co-admin of the Girl community');
select pg_temp.check(pg_temp.fails('select public.staff_girl_communities()') = '42501'
    and pg_temp.fails(format('select public.staff_girl_community(%L)', (select v from ids where k = 'girl'))) = '42501'
    and pg_temp.fails('select public.staff_girl_activities()') = '42501',
  'B, the team''s IRLY Girl view: refused');

-- ───────── 3. C (mom) and D (network member) ─────────
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from public.member_communities('f1a00000-0000-0000-0000-000000000003', 'girl')) = 1
    and (select count(*) from public.member_communities('f1a00000-0000-0000-0000-000000000003', 'mixte')) = 0
    and exists (select 1 from public.community_list('dubai', 'girl') where id = (select v from ids where k = 'mom'))
    and not exists (select 1 from public.community_list('dubai', 'mixte') where id = (select v from ids where k = 'mom')),
  'C, a mom: her Mom community in IRLY Girl, never in Mixte');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000004');
select pg_temp.check((select array_agg(id order by id) from public.member_communities('f1a00000-0000-0000-0000-000000000004', 'girl')) = (select array_agg(v order by v) from ids where k = 'netw')
    and (select array_agg(id order by id) from public.member_communities('f1a00000-0000-0000-0000-000000000004', 'mixte')) = (select array_agg(v order by v) from ids where k = 'netm'),
  'D, Network: the women-only one in IRLY Girl, the mixed one in Mixte');

-- ───────── 4. E: admin and co-admin ─────────
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000005');
select public.set_community_role((select v from ids where k = 'girl'), 'f1a00000-0000-0000-0000-000000000006', 'co_admin');
select pg_temp.check((select role from public.community_members where community_id = (select v from ids where k = 'girl') and user_id = 'f1a00000-0000-0000-0000-000000000006') = 'co_admin',
  'E, the owner names a co-admin');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails(format('select public.set_community_role(%L, %L, %L)', (select v from ids where k = 'girl'), 'f1a00000-0000-0000-0000-000000000001', 'co_admin')) is not null,
  'a plain member cannot give herself a role');
select pg_temp.check(pg_temp.fails('select public.staff_girl_communities()') = '42501', 'a member who is not on the team: the team''s IRLY Girl view is refused');

-- ───────── 5. The Live: one record ─────────
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000001');
insert into public.community_posts (id, community_id, author_id, body, in_live) values
  ('f1a00000-0000-0000-0000-0000000000b1', (select v from ids where k = 'girl'), auth.uid(), 'F1a girl live', true),
  ('f1a00000-0000-0000-0000-0000000000b2', (select v from ids where k = 'mixte'), auth.uid(), 'F1a mixte live', true),
  ('f1a00000-0000-0000-0000-0000000000b3', (select v from ids where k = 'netw'), auth.uid(), 'F1a netw live', true),
  ('f1a00000-0000-0000-0000-0000000000b4', (select v from ids where k = 'girl'), auth.uid(), 'F1a girl post', false);
select pg_temp.check(pg_temp.fails($$insert into public.community_posts (id, community_id, author_id, body, in_live)
    values ('f1a00000-0000-0000-0000-0000000000b1', (select v from ids where k = 'girl'), auth.uid(), 'F1a again', true)$$) = '23505',
  'Live publish retried with the same id: refused, never a second record');
select pg_temp.check(pg_temp.fails($$insert into public.community_posts (author_id, body, in_live) values (auth.uid(), 'F1a profile live', true)$$) = '23514',
  'a post without a community cannot be flagged in the Live');
select pg_temp.check(pg_temp.fails($$update public.community_posts set in_live = true where id = 'f1a00000-0000-0000-0000-0000000000b4'$$) = '42501',
  'an old post cannot be pushed into the Live later');
select pg_temp.check((select array_agg(id order by id) from public.live_feed('dubai', 'irly') where source = 'community' and body like 'F1a%') = array['f1a00000-0000-0000-0000-0000000000b2'::uuid]
    and (select array_agg(id order by id) from public.live_feed('dubai', 'irly_girl') where source = 'community' and body like 'F1a%')
        = array['f1a00000-0000-0000-0000-0000000000b1'::uuid, 'f1a00000-0000-0000-0000-0000000000b3'::uuid],
  'A, the Live: her Mixte post in the Mixte Live; her Girl and women-only Network posts in the IRLY Girl Live only');
update public.community_posts set in_live = false where id = 'f1a00000-0000-0000-0000-0000000000b1';
select pg_temp.check(not exists (select 1 from public.live_feed('dubai', 'irly_girl') where id = 'f1a00000-0000-0000-0000-0000000000b1')
    and exists (select 1 from public.community_posts where id = 'f1a00000-0000-0000-0000-0000000000b1' and deleted_at is null),
  'taken off the Live by its author: gone from the Live, kept in the community');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.live_feed('dubai', 'irly') where body like 'F1a%' and id <> 'f1a00000-0000-0000-0000-0000000000b2') = 0
    and (select count(*) from public.community_posts where id in ('f1a00000-0000-0000-0000-0000000000b1', 'f1a00000-0000-0000-0000-0000000000b3', 'f1a00000-0000-0000-0000-0000000000b4')) = 0,
  'B, the Live and direct selects: no IRLY Girl post');
select pg_temp.check(pg_temp.fails($$update public.community_posts set in_live = false, body = 'F1a hijack' where id = 'f1a00000-0000-0000-0000-0000000000b2'$$) is null
    and (select body from public.community_posts where id = 'f1a00000-0000-0000-0000-0000000000b2') = 'F1a mixte live',
  'B cannot edit or take another member''s post off the Live');

-- ───────── 6. Activities from a post ─────────
create or replace function pg_temp.from_post(who uuid, post uuid, cid uuid, girl boolean) returns text language plpgsql as $$
begin
  perform pg_temp.as_user(who);
  return pg_temp.fails(format($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, girl_only, community_id, client_ref, source_post_id)
    values (%L, 'F1a from post', 'sport', 'dubai', 'jumeirah', now() + interval '3 days', %L, %L, gen_random_uuid(), %L)$q$, who, girl, cid, post));
end $$;
select pg_temp.check(pg_temp.from_post('f1a00000-0000-0000-0000-000000000002', 'f1a00000-0000-0000-0000-0000000000b4', (select v from ids where k = 'mixte'), false) = '42501',
  'B cannot make a plan from an IRLY Girl post (he cannot see it)');
select pg_temp.check(pg_temp.from_post('f1a00000-0000-0000-0000-000000000001', 'f1a00000-0000-0000-0000-0000000000b4', (select v from ids where k = 'mixte'), false) = '42501',
  'A cannot move a plan made from an IRLY Girl post into a Mixte community');
select pg_temp.check(pg_temp.from_post('f1a00000-0000-0000-0000-000000000001', 'f1a00000-0000-0000-0000-0000000000b4', (select v from ids where k = 'girl'), true) is null,
  'A makes a plan from the Girl post, in the Girl community');
select pg_temp.check(pg_temp.from_post('f1a00000-0000-0000-0000-000000000001', 'f1a00000-0000-0000-0000-0000000000b4', (select v from ids where k = 'girl'), true) = '23505',
  'a double tap is refused (one plan from the post)');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from public.post_activities('f1a00000-0000-0000-0000-0000000000b4', 5, 'girl')) = 1
    and (select count(*) from public.post_activities('f1a00000-0000-0000-0000-0000000000b4', 5, 'mixte')) = 0,
  'A, post_activities: the plan in IRLY Girl, not in Mixte');
select pg_temp.check(pg_temp.fails($$update public.activities set community_id = (select v from ids where k = 'mixte') where source_post_id = 'f1a00000-0000-0000-0000-0000000000b4'$$) is not null
    and (select community_id from public.activities where source_post_id = 'f1a00000-0000-0000-0000-0000000000b4') = (select v from ids where k = 'girl'),
  'a plan made from a Girl post never moves to a Mixte community');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.post_activities('f1a00000-0000-0000-0000-0000000000b4', 5)) = 0,
  'B, post_activities with the Girl post id: nothing');
select pg_temp.as_admin();
select pg_temp.check((select confdeltype from pg_constraint where conrelid = 'public.activities'::regclass and contype = 'f'
    and conkey = array[(select attnum from pg_attribute where attrelid = 'public.activities'::regclass and attname = 'source_post_id')]) = 'n',
  'activities.source_post_id: on delete set null (removing the post never removes the plan)');
delete from public.community_posts where id = 'f1a00000-0000-0000-0000-0000000000b4';
select pg_temp.check(exists (select 1 from public.activities where title = 'F1a from post' and source_post_id is null and cancelled_at is null),
  'post erased by the team: the plan stays, unlinked');

-- ───────── 7. Notifications: the reader's own only ─────────
select pg_temp.as_admin();
insert into public.notifications (id, user_id, kind, payload) values
  ('f1a00000-0000-0000-0000-0000000000c1', 'f1a00000-0000-0000-0000-000000000001', 'COMMUNITY_POST', jsonb_build_object('community_id', (select v from ids where k = 'girl'))),
  ('f1a00000-0000-0000-0000-0000000000c2', 'f1a00000-0000-0000-0000-000000000002', 'COMMUNITY_POST', jsonb_build_object('community_id', (select v from ids where k = 'mixte')));
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000001');
select pg_temp.check((select public.notification_universe(n) = 'girl' and public.notification_women_only(n) from public.notifications n where n.id = 'f1a00000-0000-0000-0000-0000000000c1'),
  'A, her own notification: Girl, women-only');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.notifications where id = 'f1a00000-0000-0000-0000-0000000000c1') = 0, 'B cannot read A''s notification');
select pg_temp.check(public.notification_universe(jsonb_populate_record(null::public.notifications, jsonb_build_object('id', 'f1a00000-0000-0000-0000-0000000000c2',
      'user_id', 'f1a00000-0000-0000-0000-000000000002', 'kind', 'COMMUNITY_POST', 'payload', jsonb_build_object('community_id', (select v from ids where k = 'girl'))))) = 'mixte'
    and public.notification_universe(jsonb_populate_record(null::public.notifications, jsonb_build_object('id', gen_random_uuid(),
      'user_id', 'f1a00000-0000-0000-0000-000000000002', 'kind', 'COMMUNITY_POST', 'payload', jsonb_build_object('community_id', (select v from ids where k = 'girl'))))) is null
    and not public.notification_women_only(jsonb_populate_record(null::public.notifications, jsonb_build_object('id', 'f1a00000-0000-0000-0000-0000000000c1',
      'user_id', 'f1a00000-0000-0000-0000-000000000001', 'kind', 'COMMUNITY_POST', 'payload', jsonb_build_object('community_id', (select v from ids where k = 'girl'))))),
  'B, a made-up notification row: the stored row decides (his own: Mixte), never the universe of a Girl id he names');

-- ───────── 8. Storage (stand-in, policies of 20261009005200 and 20261018000000) ─────────
select pg_temp.as_admin();
create schema storage;
create table storage.objects (bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(cardinality(string_to_array(name, '/')) - 1, 0)]
$$;
grant usage on schema storage to anon, authenticated;
grant select on storage.objects to authenticated;
alter table storage.objects enable row level security;
create policy post_media_read on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.community_posts p where p.deleted_at is null and (name = any (p.media_paths) or p.thumb_path = name))
  ));
create policy activity_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'activity-photos' and (
    (storage.foldername(objects.name))[1] = auth.uid()::text
    or exists (select 1 from public.activities a where a.cover_path = objects.name)
    or exists (select 1 from public.communities c where c.cover_path = objects.name)
    or exists (select 1 from public.conversations v where v.photo_path = objects.name)
  ));
update public.community_posts set media_kind = 'photo', media_paths = array['f1a00000-0000-0000-0000-000000000001/' || id::text || '.jpg'] where id::text like 'f1a00000-%';
insert into storage.objects (bucket_id, name)
  select 'activity-photos', 'f1a00000-0000-0000-0000-000000000005/' || k || '.jpg' from ids where k in ('mixte', 'girl', 'mom', 'netw', 'netm')
  union all select 'post-media', 'f1a00000-0000-0000-0000-000000000001/' || id::text || '.jpg' from public.community_posts where id::text like 'f1a00000-%';
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000002');
select pg_temp.check((select array_agg(name order by name) from storage.objects where bucket_id = 'activity-photos')
    = array['f1a00000-0000-0000-0000-000000000005/mixte.jpg', 'f1a00000-0000-0000-0000-000000000005/netm.jpg'],
  'B, community covers: the Mixte ones only');
select pg_temp.check((select array_agg(name) from storage.objects where bucket_id = 'post-media')
    = array['f1a00000-0000-0000-0000-000000000001/f1a00000-0000-0000-0000-0000000000b2.jpg'],
  'B, post photos (Live included): the Mixte one only');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'activity-photos') = 5,
  'C, a woman with IRLY Girl access: every cover (community_list keeps each to its space)');

-- ───────── 9. F: mutual follows ─────────
-- Their friendship as either of them reads it (friendships read rule).
create or replace function pg_temp.friends(a uuid, b uuid) returns boolean language sql as $$
  select exists (select 1 from public.friendships where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted')
$$;
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000007');
select public.follow_user('f1a00000-0000-0000-0000-000000000008');
select pg_temp.check((select followers from public.public_profile('f1a00000-0000-0000-0000-000000000008')) = 1
    and (select following from public.public_profile('f1a00000-0000-0000-0000-000000000007')) = 1
    and not exists (select 1 from public.friendships where user_a in ('f1a00000-0000-0000-0000-000000000007', 'f1a00000-0000-0000-0000-000000000008') and status = 'accepted'),
  'F, Gus follows Hal: counts 1 and 1, not friends yet');
select pg_temp.check(pg_temp.fails($$select public.follow_user('f1a00000-0000-0000-0000-000000000008')$$) is null
    and (select count(*) from public.follows where follower_id = 'f1a00000-0000-0000-0000-000000000007') = 1,
  'F, a double tap on Follow: still one follow');
select pg_temp.check(pg_temp.fails($$insert into public.follows (follower_id, followee_id) values ('f1a00000-0000-0000-0000-000000000008', 'f1a00000-0000-0000-0000-000000000007')$$) is not null,
  'F, Gus cannot write a follow in Hal''s name');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000008');
select public.follow_user('f1a00000-0000-0000-0000-000000000007');
select pg_temp.check(exists (select 1 from public.friendships where user_a = least('f1a00000-0000-0000-0000-000000000007'::uuid, 'f1a00000-0000-0000-0000-000000000008'::uuid)
      and user_b = greatest('f1a00000-0000-0000-0000-000000000007'::uuid, 'f1a00000-0000-0000-0000-000000000008'::uuid) and status = 'accepted')
    and pg_temp.friends('f1a00000-0000-0000-0000-000000000007', 'f1a00000-0000-0000-0000-000000000008'),
  'F, Hal follows back: they are friends (mutual follows)');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000007');
select pg_temp.check((select payload ->> 'mutual' from public.notifications where user_id = 'f1a00000-0000-0000-0000-000000000007' and kind = 'NEW_FOLLOWER'
    and payload ->> 'from' = 'f1a00000-0000-0000-0000-000000000008') = 'true',
  'F, Gus is told Hal followed him back');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000008');
select public.unfollow_user('f1a00000-0000-0000-0000-000000000007');
select pg_temp.check(not exists (select 1 from public.friendships where user_a in ('f1a00000-0000-0000-0000-000000000007', 'f1a00000-0000-0000-0000-000000000008') and status = 'accepted')
    and exists (select 1 from public.follows where follower_id = 'f1a00000-0000-0000-0000-000000000007' and followee_id = 'f1a00000-0000-0000-0000-000000000008'),
  'F, Hal unfollows: no longer friends, Gus''s follow stays');
select public.follow_user('f1a00000-0000-0000-0000-000000000007');
select pg_temp.check(pg_temp.friends('f1a00000-0000-0000-0000-000000000007', 'f1a00000-0000-0000-0000-000000000008'), 'F, follows again: friends again');
select public.block_user('f1a00000-0000-0000-0000-000000000007');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.follows where follower_id in ('f1a00000-0000-0000-0000-000000000007', 'f1a00000-0000-0000-0000-000000000008')
      and followee_id in ('f1a00000-0000-0000-0000-000000000007', 'f1a00000-0000-0000-0000-000000000008'))
    and not exists (select 1 from public.friendships where user_a in ('f1a00000-0000-0000-0000-000000000007', 'f1a00000-0000-0000-0000-000000000008') and status = 'accepted'),
  'F, a block ends both follows and the friendship');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000007');
select pg_temp.check(pg_temp.fails($$select public.follow_user('f1a00000-0000-0000-0000-000000000008')$$) = 'P0002', 'F, blocked: following again is refused');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000008');
select public.unblock_user('f1a00000-0000-0000-0000-000000000007');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.follows where follower_id in ('f1a00000-0000-0000-0000-000000000007', 'f1a00000-0000-0000-0000-000000000008')
      and followee_id in ('f1a00000-0000-0000-0000-000000000007', 'f1a00000-0000-0000-0000-000000000008')),
  'F, unblock restores nothing on its own');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000007');
select public.follow_user('f1a00000-0000-0000-0000-000000000008');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000008');
select public.follow_user('f1a00000-0000-0000-0000-000000000007');
select public.follow_user('f1a00000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.friends('f1a00000-0000-0000-0000-000000000007', 'f1a00000-0000-0000-0000-000000000008'), 'F, after unblock both follow again: friends');
select public.delete_my_account();
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.follows where follower_id = 'f1a00000-0000-0000-0000-000000000008' or followee_id = 'f1a00000-0000-0000-0000-000000000008')
    and not exists (select 1 from public.friendships where 'f1a00000-0000-0000-0000-000000000008' in (user_a, user_b))
    and not exists (select 1 from public.profiles where id = 'f1a00000-0000-0000-0000-000000000008'),
  'F, Hal deletes his account: his follows (both ways) and friendships go with it');
select pg_temp.check(exists (select 1 from public.profiles where id = 'f1a00000-0000-0000-0000-000000000007')
    and exists (select 1 from public.profiles where id = 'f1a00000-0000-0000-0000-000000000001')
    and not exists (select 1 from public.follows where followee_id = 'f1a00000-0000-0000-0000-000000000001'),
  'F, the others stay (Ana loses the follower who left, nothing else)');

-- ───────── 10. Integrity ─────────
select pg_temp.check(exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'activities' and indexdef like '%(source_post_id%')
    and exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'activities' and indexdef like '%(event_key%')
    and exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'community_posts' and indexname = 'community_posts_in_live_idx')
    and exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'follows' and indexdef like '%(followee_id%')
    and exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'friendships' and indexdef like '%(user_b%'),
  'indexes on source_post_id, event_key, in_live, follows and friendships');
select pg_temp.check((select count(*) from pg_constraint where conrelid in ('public.follows'::regclass, 'public.friendships'::regclass)
    and contype = 'f' and confdeltype = 'c') >= 4,
  'follows and friendships go with a deleted profile (on delete cascade)');
-- Ana and Cora follow each other (friends: they may write to each other).
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000003');
select public.follow_user('f1a00000-0000-0000-0000-000000000001');
select pg_temp.as_user('f1a00000-0000-0000-0000-000000000001');
select public.follow_user('f1a00000-0000-0000-0000-000000000003');
select pg_temp.check(public.open_direct('f1a00000-0000-0000-0000-000000000003') = public.open_direct('f1a00000-0000-0000-0000-000000000003'),
  'one direct chat per pair (a double tap opens the same)');

rollback;
\echo 'final_security_audit: ALL CHECKS PASSED'
