-- Communities: members list, header, directory, favourites and the fan-out
-- of a new plan (migration 20261107100000_irly_community_social).
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed cb500000-….
--
--   b1 Nadia  woman: owns « Social Runners » (club) and « Social Girls » (girls)
--   b2 Karim  man: club moderator; blocks Omar
--   b3 Sara   woman: club member with plan notices off; in girls
--   b4 Leo    man: club member; blocks Karim
--   b5 Omar   man: club member; blocks Nadia
--   b6 Zed    man: not in the club; owns the three « Zqx » communities
--   b7 Ana    woman: club member whose account is closed
--   b8 Yara   woman: club member, in girls; her profile is hidden from strangers
--   b9 Tom    man: in Zqx Alpha and Zqx Gamma
--   ba Lina   woman: in girls, then her IRLY Girl access is withdrawn
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
    raise exception 'FAIL community_social: %', label;
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

-- ───────── Test accounts (server role) ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('cb500000-0000-0000-0000-0000000000b1'), ('cb500000-0000-0000-0000-0000000000b2'),
  ('cb500000-0000-0000-0000-0000000000b3'), ('cb500000-0000-0000-0000-0000000000b4'),
  ('cb500000-0000-0000-0000-0000000000b5'), ('cb500000-0000-0000-0000-0000000000b6'),
  ('cb500000-0000-0000-0000-0000000000b7'), ('cb500000-0000-0000-0000-0000000000b8'),
  ('cb500000-0000-0000-0000-0000000000b9'), ('cb500000-0000-0000-0000-0000000000ba');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('cb500000-0000-0000-0000-0000000000b1', 'Nadia', '1993-03-03', 'woman', 'dubai'),
  ('cb500000-0000-0000-0000-0000000000b2', 'Karim', '1991-05-05', 'man', 'dubai'),
  ('cb500000-0000-0000-0000-0000000000b3', 'Sara', '1995-07-07', 'woman', 'dubai'),
  ('cb500000-0000-0000-0000-0000000000b4', 'Leo', '1990-09-09', 'man', 'dubai'),
  ('cb500000-0000-0000-0000-0000000000b5', 'Omar', '1992-01-01', 'man', 'dubai'),
  ('cb500000-0000-0000-0000-0000000000b6', 'Zed', '1989-02-02', 'man', 'dubai'),
  ('cb500000-0000-0000-0000-0000000000b7', 'Ana', '1994-04-04', 'woman', 'dubai'),
  ('cb500000-0000-0000-0000-0000000000b8', 'Yara', '1997-06-06', 'woman', 'dubai'),
  ('cb500000-0000-0000-0000-0000000000b9', 'Tom', '1988-08-08', 'man', 'dubai'),
  ('cb500000-0000-0000-0000-0000000000ba', 'Lina', '1996-10-10', 'woman', 'dubai');

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

-- ───────── Communities and members ─────────
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b1');
insert into ids values ('club', public.create_community('Social Runners', 'dubai', 'Runs at dawn', null, 'sport', false));
insert into ids values ('girls', public.create_community('Social Girls', 'dubai', null, null, 'food', true));
do $$
declare u uuid;
begin
  foreach u in array array['cb500000-0000-0000-0000-0000000000b2', 'cb500000-0000-0000-0000-0000000000b3', 'cb500000-0000-0000-0000-0000000000b4',
                           'cb500000-0000-0000-0000-0000000000b5', 'cb500000-0000-0000-0000-0000000000b7', 'cb500000-0000-0000-0000-0000000000b8']::uuid[] loop
    perform pg_temp.as_user(u);
    perform public.join_community((select v from ids where k = 'club'));
  end loop;
  foreach u in array array['cb500000-0000-0000-0000-0000000000b3', 'cb500000-0000-0000-0000-0000000000b8', 'cb500000-0000-0000-0000-0000000000ba']::uuid[] loop
    perform pg_temp.as_user(u);
    perform public.join_community((select v from ids where k = 'girls'));
  end loop;
end $$;
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b1');
select public.set_community_role((select v from ids where k = 'club'), 'cb500000-0000-0000-0000-0000000000b2', 'moderator');
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b3');
insert into public.community_notification_prefs (user_id, community_id, activities)
values ('cb500000-0000-0000-0000-0000000000b3', (select v from ids where k = 'club'), false);
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b8');
insert into public.safety_settings (user_id, profile_visibility) values ('cb500000-0000-0000-0000-0000000000b8', 'communities')
on conflict (user_id) do update set profile_visibility = 'communities';

select pg_temp.as_admin();
insert into public.blocks (blocker_id, blocked_id) values
  ('cb500000-0000-0000-0000-0000000000b4', 'cb500000-0000-0000-0000-0000000000b2'),
  ('cb500000-0000-0000-0000-0000000000b2', 'cb500000-0000-0000-0000-0000000000b5'),
  ('cb500000-0000-0000-0000-0000000000b5', 'cb500000-0000-0000-0000-0000000000b1');
update public.profiles set deleted_at = now() where id = 'cb500000-0000-0000-0000-0000000000b7';
insert into public.girl_suspensions (user_id, reason) values ('cb500000-0000-0000-0000-0000000000ba', 'test: access withdrawn');
-- Omar joined a month ago (the « new this week » count leaves him out).
update public.community_members set joined_at = now() - interval '30 days'
where community_id = (select v from ids where k = 'club') and user_id = 'cb500000-0000-0000-0000-0000000000b5';
select pg_temp.check(private.girl_eligible_unchecked('cb500000-0000-0000-0000-0000000000b3') and private.girl_eligible_unchecked('cb500000-0000-0000-0000-0000000000b8')
  and not private.girl_eligible_unchecked('cb500000-0000-0000-0000-0000000000ba') and not private.girl_eligible_unchecked('cb500000-0000-0000-0000-0000000000b2'),
  'setup: Sara and Yara have IRLY Girl access, Lina and Karim do not');

-- ═════════════════════════ MEMBERS LIST ═════════════════════════

-- A stranger (Zed) may list a community he can see: by role, then name;
-- no closed account; Yara's profile is for her communities only.
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b6');
select pg_temp.check((select string_agg(name || ':' || role, ',' order by ord) from (
    select l.name, l.role, row_number() over () as ord from public.community_members_list((select v from ids where k = 'club')) l) x)
  = 'Nadia:owner,Karim:moderator,Leo:member,Omar:member,Sara:member',
  'members list (stranger): owner, moderator, then members by name; no closed account, no hidden profile');
select pg_temp.check((select string_agg(name, ',' order by ord) from (
    select l.name, row_number() over () as ord from public.community_members_list((select v from ids where k = 'club'), null, 2, 2) l) x) = 'Leo,Omar',
  'members list: limit and offset page in the same order');
select pg_temp.check((select string_agg(name, ',') from public.community_members_list((select v from ids where k = 'club'), 'SA')) = 'Sara',
  'members list: search by name, any case');
select pg_temp.check(not exists (select 1 from public.community_members_list((select v from ids where k = 'club'), '%')),
  'members list: a typed % is a literal, not a wildcard');

-- A member (Karim, moderator) sees Yara (they share the community), but
-- nobody he blocked (Omar) or who blocked him (Leo).
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b2');
select pg_temp.check((select string_agg(name, ',' order by ord) from (
    select l.name, row_number() over () as ord from public.community_members_list((select v from ids where k = 'club')) l) x)
  = 'Nadia,Karim,Sara,Yara',
  'members list (member): Yara listed; Leo (blocked him) and Omar (he blocked) are not');
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b4');
select pg_temp.check(not exists (select 1 from public.community_members_list((select v from ids where k = 'club')) where name = 'Karim'),
  'members list: the blocker (Leo) does not see Karim either');
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b5');
select pg_temp.check(not exists (select 1 from public.community_members_list((select v from ids where k = 'club')) where name in ('Nadia', 'Karim')),
  'members list: Omar sees neither Nadia (he blocked) nor Karim (blocked him)');

-- IRLY Girl.
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b2');
select pg_temp.check(pg_temp.fails($$select * from public.community_members_list((select v from ids where k = 'girls'))$$) = '42501',
  'members list: a man cannot list an IRLY Girl community');
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000ba');
select pg_temp.check(pg_temp.fails($$select * from public.community_members_list((select v from ids where k = 'girls'))$$) = '42501',
  'members list: a member whose IRLY Girl access was withdrawn cannot list it');
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b3');
select pg_temp.check((select string_agg(name, ',' order by ord) from (
    select l.name, row_number() over () as ord from public.community_members_list((select v from ids where k = 'girls')) l) x) = 'Nadia,Lina,Sara,Yara',
  'members list: an IRLY Girl member lists the IRLY Girl community');
select pg_temp.check(pg_temp.fails($$select * from public.community_members_list('cb500000-0000-0000-0000-00000000ffff')$$) = 'P0002',
  'members list: an unknown community is not found');

-- ═════════════════════════ HEADER ═════════════════════════
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b1');
-- Two upcoming plans the page lists, one cancelled, one for friends only.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy, community_id) values
  ('cb500000-0000-0000-0000-0000000000c1', 'cb500000-0000-0000-0000-0000000000b1', 'Dawn run', 'sport', 'dubai', 'jumeirah', now() + interval '3 days', 'public', (select v from ids where k = 'club')),
  ('cb500000-0000-0000-0000-0000000000c2', 'cb500000-0000-0000-0000-0000000000b1', 'Members run', 'sport', 'dubai', 'jumeirah', now() + interval '4 days', 'community', (select v from ids where k = 'club')),
  ('cb500000-0000-0000-0000-0000000000c3', 'cb500000-0000-0000-0000-0000000000b1', 'Cancelled run', 'sport', 'dubai', 'jumeirah', now() + interval '5 days', 'public', (select v from ids where k = 'club')),
  ('cb500000-0000-0000-0000-0000000000c4', 'cb500000-0000-0000-0000-0000000000b1', 'Friends brunch', 'food', 'dubai', 'jumeirah', now() + interval '6 days', 'friends', (select v from ids where k = 'club'));
update public.activities set cancelled_at = now() where id = 'cb500000-0000-0000-0000-0000000000c3';

select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b6');
create temp table hdr as select public.community_header((select v from ids where k = 'club')) as h;
select pg_temp.as_admin();
select pg_temp.check((select (h ->> 'members')::int from hdr) = (select count(*) from public.community_members where community_id = (select v from ids where k = 'club'))
  and (select (h ->> 'members')::int from hdr) = 7,
  'header: members is the real number of membership rows (7)');
select pg_temp.check((select (h ->> 'new_members_7d')::int from hdr) = (select count(*) from public.community_members
    where community_id = (select v from ids where k = 'club') and joined_at > now() - interval '7 days')
  and (select (h ->> 'new_members_7d')::int from hdr) = 6,
  'header: new_members_7d leaves out Omar, who joined a month ago (6)');
select pg_temp.check((select (h ->> 'upcoming_activities')::int from hdr) = 2,
  'header: upcoming_activities counts the 2 listed plans (not the cancelled or friends-only one)');
select pg_temp.check((select jsonb_array_length(h -> 'faces') from hdr) = 5 and (select h -> 'faces' -> 0 ->> 'name' from hdr) = 'Nadia'
  and not exists (select 1 from hdr, jsonb_array_elements(h -> 'faces') f where f ->> 'name' in ('Ana', 'Yara')),
  'header: 5 faces at most, owner first, no closed account or hidden profile');
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b2');
select pg_temp.check(not exists (select 1 from jsonb_array_elements(public.community_header((select v from ids where k = 'club')) -> 'faces') f
    where f ->> 'name' in ('Leo', 'Omar')),
  'header: faces leave out people blocked either way');
select pg_temp.check(pg_temp.fails($$select public.community_header((select v from ids where k = 'girls'))$$) = '42501',
  'header: a man cannot read an IRLY Girl community''s header');

-- ═════════════════════════ ACTIVITY FAN-OUT ═════════════════════════
select pg_temp.as_admin();
select pg_temp.check((select array_agg(user_id order by user_id) from public.notifications
    where kind = 'ACTIVITY_CREATED' and payload ->> 'activity_id' = 'cb500000-0000-0000-0000-0000000000c1')
  = array['cb500000-0000-0000-0000-0000000000b2', 'cb500000-0000-0000-0000-0000000000b4', 'cb500000-0000-0000-0000-0000000000b8']::uuid[],
  'new plan: Karim, Leo and Yara are told (not Nadia the organiser, Sara (notices off), Omar (blocked her), Ana (closed))');
select pg_temp.check((select payload ->> 'community_id' from public.notifications
    where kind = 'ACTIVITY_CREATED' and payload ->> 'activity_id' = 'cb500000-0000-0000-0000-0000000000c1' limit 1) = (select v from ids where k = 'club')::text,
  'new plan: the notice names its community');
select pg_temp.check((select count(*) from public.notifications
    where kind = 'ACTIVITY_CREATED' and payload ->> 'activity_id' = 'cb500000-0000-0000-0000-0000000000c2') = 3,
  'new members-only plan: told to the same 3 members');
select pg_temp.check(not exists (select 1 from public.notifications
    where kind = 'ACTIVITY_CREATED' and payload ->> 'activity_id' = 'cb500000-0000-0000-0000-0000000000c4'),
  'friends-only plan: no notice to the community');

insert into ids select 'club_chat', id from public.conversations where community_id = (select v from ids where k = 'club');
select pg_temp.check((select count(*) from public.messages where conversation_id = (select v from ids where k = 'club_chat')
    and kind = 'share' and ref_type = 'activity' and ref_id = 'cb500000-0000-0000-0000-0000000000c1') = 1,
  'chat: exactly one card of the new plan in the community chat');
select pg_temp.check((select sender_id = 'cb500000-0000-0000-0000-0000000000b1' and body = 'Dawn run' from public.messages
    where conversation_id = (select v from ids where k = 'club_chat') and ref_id = 'cb500000-0000-0000-0000-0000000000c1'),
  'chat: the card is the organiser''s, in the share_to_chat format (title as text)');
select pg_temp.check(not exists (select 1 from public.notifications n join public.messages m on m.id::text = n.payload ->> 'message_id'
    where n.kind = 'MESSAGE_CREATED' and m.ref_id = 'cb500000-0000-0000-0000-0000000000c1'),
  'chat: the card does not also send « new message » (the plan notice says it)');
select pg_temp.check(not exists (select 1 from public.messages where ref_id = 'cb500000-0000-0000-0000-0000000000c4'),
  'chat: no card for a friends-only plan');

-- Shared again into the same community chat: the same card, not a second one.
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b2');
select pg_temp.check(public.share_to_chat((select v from ids where k = 'club_chat'), 'activity', 'cb500000-0000-0000-0000-0000000000c1', 'Dawn run')
    = (select id from public.messages where conversation_id = (select v from ids where k = 'club_chat') and ref_id = 'cb500000-0000-0000-0000-0000000000c1'),
  'share again: share_to_chat answers the existing card');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.messages where conversation_id = (select v from ids where k = 'club_chat')
    and kind = 'share' and ref_id = 'cb500000-0000-0000-0000-0000000000c1') = 1,
  'share again: still one card in the chat');

-- IRLY Girl: a women-only plan, in the girls' community and in the mixed club.
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy, community_id, girl_only) values
  ('cb500000-0000-0000-0000-0000000000c5', 'cb500000-0000-0000-0000-0000000000b1', 'Girls brunch', 'food', 'dubai', 'jumeirah', now() + interval '2 days', 'public', (select v from ids where k = 'girls'), false),
  ('cb500000-0000-0000-0000-0000000000c6', 'cb500000-0000-0000-0000-0000000000b1', 'Women run', 'sport', 'dubai', 'jumeirah', now() + interval '2 days', 'public', (select v from ids where k = 'club'), true);
select pg_temp.as_admin();
select pg_temp.check((select array_agg(user_id order by user_id) from public.notifications
    where kind = 'ACTIVITY_CREATED' and payload ->> 'activity_id' = 'cb500000-0000-0000-0000-0000000000c5')
  = array['cb500000-0000-0000-0000-0000000000b3', 'cb500000-0000-0000-0000-0000000000b8']::uuid[],
  'IRLY Girl plan: Sara and Yara are told, never Lina (access withdrawn)');
select pg_temp.check((select array_agg(user_id order by user_id) from public.notifications
    where kind = 'ACTIVITY_CREATED' and payload ->> 'activity_id' = 'cb500000-0000-0000-0000-0000000000c6')
  = array['cb500000-0000-0000-0000-0000000000b8']::uuid[],
  'women-only plan in a mixed community: only Yara (no man, no Sara: notices off)');
select pg_temp.check((select count(*) from public.messages m join public.conversations v on v.id = m.conversation_id
    where v.community_id = (select v from ids where k = 'girls') and m.ref_id = 'cb500000-0000-0000-0000-0000000000c5') = 1,
  'IRLY Girl plan: its card is in the IRLY Girl chat');
select pg_temp.check(not exists (select 1 from public.messages where conversation_id = (select v from ids where k = 'club_chat')
    and ref_id = 'cb500000-0000-0000-0000-0000000000c6'),
  'women-only plan: no card in the mixed chat (men read it)');
select pg_temp.check(not exists (select 1 from public.notifications n
    where n.user_id in ('cb500000-0000-0000-0000-0000000000b2', 'cb500000-0000-0000-0000-0000000000b4', 'cb500000-0000-0000-0000-0000000000b5', 'cb500000-0000-0000-0000-0000000000ba')
      and n.payload ->> 'activity_id' in ('cb500000-0000-0000-0000-0000000000c5', 'cb500000-0000-0000-0000-0000000000c6')),
  'IRLY Girl: no notice of any kind about women-only plans for anyone without access');

-- ═════════════════════════ DIRECTORY ═════════════════════════
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b6');
insert into ids values ('alpha', public.create_community('Zqx Alpha', 'dubai', 'First of three', null, 'music', false));
insert into ids values ('beta', public.create_community('Zqx Beta', 'dubai', null, null, 'zzqcat', false));
insert into ids values ('gamma', public.create_community('Zqx Gamma', 'dubai', null, 'Meets near the plumbago hedge', 'art', false));
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b9');
select public.join_community((select v from ids where k = 'alpha'));
select public.join_community((select v from ids where k = 'gamma'));
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b2');
select public.join_community((select v from ids where k = 'alpha'));
-- Beta: two upcoming plans (their two cards are chat messages too).
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b6');
insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, privacy, community_id) values
  ('cb500000-0000-0000-0000-0000000000b6', 'Beta jam 1', 'entertainment', 'dubai', 'jumeirah', now() + interval '1 day', 'public', (select v from ids where k = 'beta')),
  ('cb500000-0000-0000-0000-0000000000b6', 'Beta jam 2', 'entertainment', 'dubai', 'jumeirah', now() + interval '2 days', 'community', (select v from ids where k = 'beta'));
-- Gamma: three chat messages this week.
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b9');
insert into public.messages (conversation_id, sender_id, body)
select v.id, 'cb500000-0000-0000-0000-0000000000b9', x from public.conversations v, unnest(array['hi', 'who paints?', 'see you']) x
where v.community_id = (select v from ids where k = 'gamma');
select pg_temp.as_admin();
update public.communities set created_at = now() - interval '3 days' where id = (select v from ids where k = 'alpha');
update public.communities set created_at = now() - interval '2 days' where id = (select v from ids where k = 'beta');
update public.communities set created_at = now() - interval '1 day' where id = (select v from ids where k = 'gamma');

create or replace function pg_temp.dir_order(p_sort text) returns text language sql as $$
  select string_agg(name, ',' order by ord) from (
    select d.name, row_number() over () as ord from public.community_directory('dubai', p_sort, 'zqx') d) x
$$;
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b2');
select pg_temp.check(pg_temp.dir_order('members') = 'Zqx Alpha,Zqx Gamma,Zqx Beta', 'directory members: 3, 2, 1 members');
select pg_temp.check(pg_temp.dir_order(null) = 'Zqx Alpha,Zqx Gamma,Zqx Beta', 'directory: members is the default sort');
select pg_temp.check(pg_temp.dir_order('activities') = 'Zqx Beta,Zqx Alpha,Zqx Gamma', 'directory activities: Beta (2 upcoming) first, then by members');
select pg_temp.check(pg_temp.dir_order('recent') = 'Zqx Gamma,Zqx Beta,Zqx Alpha', 'directory recent: newest first');
select pg_temp.check(pg_temp.dir_order('active') = 'Zqx Gamma,Zqx Beta,Zqx Alpha', 'directory active: Gamma (3 messages), Beta (2 cards), Alpha (0)');
select pg_temp.check(pg_temp.fails($$select * from public.community_directory('dubai', 'loudest')$$) = '22023', 'directory: an unknown sort is refused');
select pg_temp.check((select members_count = 3 and upcoming_count = 0 and is_member and not is_favorite and emoji is not distinct from null and category_id = 'music'
    from public.community_directory('dubai', 'members', 'zqx') where name = 'Zqx Alpha'),
  'directory: Alpha has 3 members, 0 upcoming, Karim is a member');
select pg_temp.check((select members_count = 1 and upcoming_count = 2 and not is_member from public.community_directory('dubai', 'members', 'zqx') where name = 'Zqx Beta'),
  'directory: Beta has 1 member, 2 upcoming, Karim is not a member');
create temp table dir as select * from public.community_directory('dubai', 'members', 'zqx');
select pg_temp.as_admin();
select pg_temp.check((select count(*) = 3 and bool_and(d.members_count = (select count(*) from public.community_members m where m.community_id = d.id)
    and d.upcoming_count = (select count(*) from public.activities a where a.community_id = d.id and a.cancelled_at is null and a.starts_at > now()))
    from dir d),
  'directory: members_count and upcoming_count equal the stored rows');
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b2');
select pg_temp.check((select string_agg(name, ',') from public.community_directory('dubai', 'members', 'PLUMBAGO')) = 'Zqx Gamma', 'search: description');
select pg_temp.check((select string_agg(name, ',') from public.community_directory('dubai', 'members', 'zzqcat')) = 'Zqx Beta', 'search: category');
select pg_temp.check((select string_agg(name, ',') from public.community_directory('dubai', 'members', 'first of three')) = 'Zqx Alpha', 'search: tagline');
select pg_temp.check((select string_agg(name, ',') from public.community_directory('dubai', 'members', 'social runners')) = 'Social Runners', 'search: name');
select pg_temp.check(not exists (select 1 from public.community_directory('dubai', 'members', 'zq_')), 'search: a typed _ is a literal');
select pg_temp.check(not exists (select 1 from public.community_directory('dubai', 'members', 'social girls')), 'directory: no IRLY Girl community for a man');
select pg_temp.check(not exists (select 1 from public.community_directory('bali', 'members', 'zqx')), 'directory: another country''s city does not list Dubai''s');
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b3');
select pg_temp.check((select girl_only and is_member from public.community_directory('dubai', 'members', 'social girls')), 'directory: IRLY Girl community listed for a woman with access');

-- ═════════════════════════ FAVOURITES ═════════════════════════
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b2');
select pg_temp.check(public.toggle_community_favorite((select v from ids where k = 'beta')) = true, 'favourite: first toggle adds');
select pg_temp.check((select is_favorite from public.community_directory('dubai', 'members', 'zqx') where name = 'Zqx Beta')
  and not (select is_favorite from public.community_directory('dubai', 'members', 'zqx') where name = 'Zqx Alpha'),
  'favourite: shows as is_favorite in the directory (only that one)');
select pg_temp.check(public.toggle_community_favorite((select v from ids where k = 'beta')) = false, 'favourite: second toggle removes');
select pg_temp.check(not (select is_favorite from public.community_directory('dubai', 'members', 'zqx') where name = 'Zqx Beta'), 'favourite: gone from the directory');
select pg_temp.check(public.toggle_community_favorite((select v from ids where k = 'beta')) = true, 'favourite: added again');
select pg_temp.check(pg_temp.fails($$select public.toggle_community_favorite((select v from ids where k = 'girls'))$$) = '42501', 'favourite: not an IRLY Girl community for a man');
select pg_temp.check(pg_temp.fails($$insert into public.community_favorites (user_id, community_id) values ('cb500000-0000-0000-0000-0000000000b3', (select v from ids where k = 'alpha'))$$) is not null,
  'favourite: nobody writes another member''s favourites');
select pg_temp.as_user('cb500000-0000-0000-0000-0000000000b3');
select pg_temp.check(not exists (select 1 from public.community_favorites), 'favourite: Karim''s favourites are his alone');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.community_favorites where user_id = 'cb500000-0000-0000-0000-0000000000b2') = 1, 'favourite: one row stored');

-- ═════════════════════════ CLEAN UP ═════════════════════════
-- The plans leave the shared database (later files rank the first 50 of a city).
select pg_temp.as_admin();
delete from public.activities where creator_id::text like 'cb500000%';
select pg_temp.check(not exists (select 1 from public.notifications where kind = 'ACTIVITY_CREATED' and user_id::text like 'cb500000%'),
  'clean up: deleted plans take their notices with them');
