-- Security audit of 2026-10-20 (migration 20261020001000_irly_security_audit).
-- Runs after irly_test.sql on the same database (scripts/test-db.sh); every
-- person, community, chat and file here has its own ids (prefix e9000000-…).
-- Each block raises if a rule does not hold. Attacks are made as the API
-- roles (authenticated with a JWT subject, or anon), with the table grants
-- Supabase gives them (irly_test.sql grants them on every table and view).
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
  if not coalesce(ok, false) then
    raise exception 'FAIL security_audit: %', label;
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

-- How many rows a statement touches (0 when RLS hides them all).
create or replace function pg_temp.touched(stmt text) returns integer language plpgsql as $$
declare n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when others then
  return -1;
end $$;

select pg_temp.as_admin();

-- People: Ada, Bea, Dee, Fay (women), Cal (man), Eve (woman, IRLY admin).
insert into auth.users (id) values
  ('e9000000-0000-0000-0000-0000000000a1'), ('e9000000-0000-0000-0000-0000000000a2'),
  ('e9000000-0000-0000-0000-0000000000a3'), ('e9000000-0000-0000-0000-0000000000a4'),
  ('e9000000-0000-0000-0000-0000000000a5'), ('e9000000-0000-0000-0000-0000000000a6');
insert into public.profiles (id, first_name, birthdate, gender, city_id, photo_paths) values
  ('e9000000-0000-0000-0000-0000000000a1', 'Ada', '1994-03-03', 'woman', 'dubai',
    array['e9000000-0000-0000-0000-0000000000a1/face.jpg', 'e9000000-0000-0000-0000-0000000000a1/beach.jpg']),
  ('e9000000-0000-0000-0000-0000000000a2', 'Bea', '1993-05-05', 'woman', 'dubai', '{}'),
  ('e9000000-0000-0000-0000-0000000000a3', 'Cal', '1992-07-07', 'man', 'dubai', '{}'),
  ('e9000000-0000-0000-0000-0000000000a4', 'Dee', '1991-09-09', 'woman', 'dubai', '{}'),
  ('e9000000-0000-0000-0000-0000000000a5', 'Eve', '1990-11-11', 'woman', 'dubai', '{}'),
  ('e9000000-0000-0000-0000-0000000000a6', 'Fay', '1989-01-01', 'woman', 'dubai', '{}');
alter table public.profiles disable trigger profiles_guard;
update public.profiles set is_admin = true where id = 'e9000000-0000-0000-0000-0000000000a5';
alter table public.profiles enable trigger profiles_guard;
insert into public.safety_settings (user_id, profile_visibility) values ('e9000000-0000-0000-0000-0000000000a1', 'nobody');

-- Women-only communities: G1 (Ada owner, Bea member), G2 (Dee owner, Fay moderator, Bea member).
insert into public.communities (id, city_id, name, category_id, girl_only, created_by) values
  ('e9000000-0000-0000-0000-0000000000c1', 'dubai', 'Audit Girls One', 'girl', true, 'e9000000-0000-0000-0000-0000000000a1'),
  ('e9000000-0000-0000-0000-0000000000c2', 'dubai', 'Audit Girls Two', 'girl', true, 'e9000000-0000-0000-0000-0000000000a4');
insert into public.community_members (community_id, user_id, role) values
  ('e9000000-0000-0000-0000-0000000000c1', 'e9000000-0000-0000-0000-0000000000a1', 'owner'),
  ('e9000000-0000-0000-0000-0000000000c1', 'e9000000-0000-0000-0000-0000000000a2', 'member'),
  ('e9000000-0000-0000-0000-0000000000c2', 'e9000000-0000-0000-0000-0000000000a4', 'owner'),
  ('e9000000-0000-0000-0000-0000000000c2', 'e9000000-0000-0000-0000-0000000000a6', 'moderator'),
  ('e9000000-0000-0000-0000-0000000000c2', 'e9000000-0000-0000-0000-0000000000a2', 'member');
insert into public.community_posts (id, community_id, author_id, body) values
  ('e9000000-0000-0000-0000-0000000000d1', 'e9000000-0000-0000-0000-0000000000c1', 'e9000000-0000-0000-0000-0000000000a1', 'Audit girls brunch Saturday');
-- A girls-only activity of G1 (upcoming) and a past one Dee went to.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, community_id) values
  ('e9000000-0000-0000-0000-0000000000b1', 'e9000000-0000-0000-0000-0000000000a1', 'Audit girls padel', 'sport', 'dubai', 'marina', now() + interval '3 days', true, 'e9000000-0000-0000-0000-0000000000c1'),
  ('e9000000-0000-0000-0000-0000000000b2', 'e9000000-0000-0000-0000-0000000000a1', 'Audit girls sunset', 'sport', 'dubai', 'marina', now() - interval '3 days', true, null);
insert into public.activity_participants (activity_id, user_id, status) values
  ('e9000000-0000-0000-0000-0000000000b1', 'e9000000-0000-0000-0000-0000000000a2', 'going'),
  ('e9000000-0000-0000-0000-0000000000b2', 'e9000000-0000-0000-0000-0000000000a4', 'going');
insert into public.comments (target_type, target_id, author_id, body) values
  ('activity', 'e9000000-0000-0000-0000-0000000000b1', 'e9000000-0000-0000-0000-0000000000a2', 'Audit: I bring the balls');
insert into public.likes (target_type, target_id, user_id) values
  ('activity', 'e9000000-0000-0000-0000-0000000000b1', 'e9000000-0000-0000-0000-0000000000a2');
insert into public.messages (conversation_id, sender_id, body)
select v.id, 'e9000000-0000-0000-0000-0000000000a6', 'Audit: G2 chat secret'
from public.conversations v where v.community_id = 'e9000000-0000-0000-0000-0000000000c2';
insert into public.messages (conversation_id, sender_id, body)
select v.id, 'e9000000-0000-0000-0000-0000000000a1', 'Audit: sunset photos tonight'
from public.conversations v where v.activity_id = 'e9000000-0000-0000-0000-0000000000b2';

-- A Match chat between Dee and Bea, and a plain direct chat between Dee and Cal.
insert into public.conversations (id, kind) values
  ('e9000000-0000-0000-0000-0000000000e1', 'match'), ('e9000000-0000-0000-0000-0000000000e2', 'direct');
insert into public.conversation_members (conversation_id, user_id) values
  ('e9000000-0000-0000-0000-0000000000e1', 'e9000000-0000-0000-0000-0000000000a4'),
  ('e9000000-0000-0000-0000-0000000000e1', 'e9000000-0000-0000-0000-0000000000a2'),
  ('e9000000-0000-0000-0000-0000000000e2', 'e9000000-0000-0000-0000-0000000000a4'),
  ('e9000000-0000-0000-0000-0000000000e2', 'e9000000-0000-0000-0000-0000000000a3');
insert into public.messages (conversation_id, sender_id, body) values
  ('e9000000-0000-0000-0000-0000000000e1', 'e9000000-0000-0000-0000-0000000000a2', 'Audit: match secret'),
  ('e9000000-0000-0000-0000-0000000000e2', 'e9000000-0000-0000-0000-0000000000a3', 'Plain hello (audit)');

-- Before the suspension Dee sees her IRLY Girl chats in her inbox.
do $$
begin
  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a4');
  perform pg_temp.check(exists (select 1 from public.my_conversations() where conversation_id = 'e9000000-0000-0000-0000-0000000000e1'),
    'girl_inbox: with access, the Match chat is in the inbox');
  perform pg_temp.check(exists (select 1 from public.my_conversations() c join public.conversations v on v.id = c.conversation_id
      where v.activity_id = 'e9000000-0000-0000-0000-0000000000b2'),
    'girl_inbox: and the girls-only activity chat');
  perform pg_temp.as_admin();
end $$;

-- ───────── 1. profiles_public is read-only (any member could rename or delete anyone) ─────────
do $$
begin
  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a3');
  perform pg_temp.check(pg_temp.fails($q$update public.profiles_public set first_name = 'Pwned' where id = 'e9000000-0000-0000-0000-0000000000a1'$q$) = '42501',
    'profiles_public_read_only: a member cannot rename someone through the view');
  perform pg_temp.check(pg_temp.fails($q$delete from public.profiles_public where id = 'e9000000-0000-0000-0000-0000000000a1'$q$) = '42501',
    'profiles_public_read_only: a member cannot delete someone through the view');
  perform pg_temp.check(pg_temp.fails($q$insert into public.profiles_public (id, first_name) values ('e9000000-0000-0000-0000-0000000000a3', 'Again')$q$) = '42501',
    'profiles_public_read_only: nor insert through it');
  perform pg_temp.check((select first_name from public.profiles_public where id = 'e9000000-0000-0000-0000-0000000000a1') = 'Ada',
    'profiles_public_read_only: members still read names through it');
  perform pg_temp.as_admin();
  perform pg_temp.check((select first_name from public.profiles where id = 'e9000000-0000-0000-0000-0000000000a1') = 'Ada',
    'profiles_public_read_only: the profile is untouched');
  perform pg_temp.as_anon();
  perform pg_temp.check(pg_temp.fails($q$select count(*) from public.profiles_public$q$) is not null,
    'profiles_public_read_only: anon cannot list members');
  perform pg_temp.as_admin();
end $$;

-- ───────── 2. IRLY Girl eligibility cannot be self-granted (verified safe) ─────────
do $$
begin
  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a3');
  perform pg_temp.check(not public.my_girl_access(), 'girl_gate: a man has no IRLY Girl access');
  perform pg_temp.check(pg_temp.fails($q$update public.profiles set gender = 'woman' where id = auth.uid()$q$) = '42501',
    'girl_gate: gender cannot be edited after signup');
  perform pg_temp.check(pg_temp.fails($q$insert into public.profiles (id, first_name, birthdate, gender, city_id)
      values (auth.uid(), 'Cal', '1992-07-07', 'woman', 'dubai') on conflict (id) do update set gender = excluded.gender$q$) = '42501',
    'girl_gate: nor through an upsert');
  perform pg_temp.check(pg_temp.fails($q$insert into public.profiles (id, first_name, birthdate, gender, city_id)
      values ('e9000000-0000-0000-0000-0000000000f9', 'Fake', '1992-07-07', 'woman', 'dubai')$q$) is not null,
    'girl_gate: nor by creating a profile for another id');
  perform pg_temp.check(pg_temp.fails($q$delete from public.girl_suspensions where user_id = auth.uid()$q$) is not null
      or pg_temp.touched($q$delete from public.girl_suspensions where user_id = auth.uid()$q$) <= 0,
    'girl_gate: suspensions are not writable');
  perform pg_temp.check(not public.my_girl_access(), 'girl_gate: still no access');

  -- Nothing of the women-only space reaches him through the API.
  perform pg_temp.check(not exists (select 1 from public.communities where id in ('e9000000-0000-0000-0000-0000000000c1', 'e9000000-0000-0000-0000-0000000000c2')),
    'girl_gate: women-only communities are hidden');
  perform pg_temp.check(not exists (select 1 from public.community_members where community_id = 'e9000000-0000-0000-0000-0000000000c1'),
    'girl_gate: and their member lists');
  perform pg_temp.check(not exists (select 1 from public.community_posts where id = 'e9000000-0000-0000-0000-0000000000d1'),
    'girl_gate: and their posts');
  perform pg_temp.check(not exists (select 1 from public.activities where id in ('e9000000-0000-0000-0000-0000000000b1', 'e9000000-0000-0000-0000-0000000000b2')),
    'girl_gate: girls-only activities are hidden');
  perform pg_temp.check(not exists (select 1 from public.activity_participants where activity_id = 'e9000000-0000-0000-0000-0000000000b1'),
    'girl_gate: and who goes');
  perform pg_temp.check(not exists (select 1 from public.comments where target_id = 'e9000000-0000-0000-0000-0000000000b1'),
    'girl_gate: and their comments');
  perform pg_temp.check(not exists (select 1 from public.likes where target_id = 'e9000000-0000-0000-0000-0000000000b1'),
    'girl_gate: and their likes');
  perform pg_temp.check(not exists (select 1 from public.messages where body like 'Audit:%'),
    'girl_gate: and their chats');
  perform pg_temp.check(pg_temp.fails($q$select public.join_community('e9000000-0000-0000-0000-0000000000c1')$q$) = '42501',
    'girl_gate: he cannot join a women-only community');
  perform pg_temp.check(pg_temp.fails($q$select public.join_activity('e9000000-0000-0000-0000-0000000000b1')$q$) is not null,
    'girl_gate: nor a girls-only activity');
  perform pg_temp.check(pg_temp.fails($q$insert into public.communities (city_id, name, girl_only, created_by)
      values ('dubai', 'Fake girls', true, auth.uid())$q$) is not null,
    'girl_gate: nor create a women-only community');
  perform pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, girl_only)
      values (auth.uid(), 'Fake girls night', 'food', 'dubai', 'marina', now() + interval '1 day', true)$q$) is not null,
    'girl_gate: nor a girls-only activity');
  perform pg_temp.check(pg_temp.fails($q$select * from public.girl_circle('dubai')$q$) = '42501',
    'girl_gate: nor list the women of the circle');
  perform pg_temp.as_admin();
end $$;

-- ───────── 3. A suspended owner leaves her women-only community and its chats ─────────
-- Before 20261020001000, girl_suspend skipped owners: Dee kept G2, its chat,
-- its notifications and its moderation tools.
select pg_temp.as_user('e9000000-0000-0000-0000-0000000000a5');
select public.girl_suspend('e9000000-0000-0000-0000-0000000000a4', 'audit test');
do $$
begin
  perform pg_temp.as_admin();
  perform pg_temp.check(not exists (select 1 from public.community_members where user_id = 'e9000000-0000-0000-0000-0000000000a4'
      and community_id = 'e9000000-0000-0000-0000-0000000000c2'),
    'girl_suspend_owner: the suspended owner leaves her women-only community');
  perform pg_temp.check((select role from public.community_members where user_id = 'e9000000-0000-0000-0000-0000000000a6'
      and community_id = 'e9000000-0000-0000-0000-0000000000c2') = 'owner',
    'girl_suspend_owner: it goes to its moderator');
  perform pg_temp.check((select m.role from public.conversation_members m join public.conversations v on v.id = m.conversation_id
      where v.community_id = 'e9000000-0000-0000-0000-0000000000c2' and m.user_id = 'e9000000-0000-0000-0000-0000000000a6') = 'admin',
    'girl_suspend_owner: who now runs its chat');
  perform pg_temp.check(not exists (select 1 from public.conversation_members m join public.conversations v on v.id = m.conversation_id
      where v.community_id = 'e9000000-0000-0000-0000-0000000000c2' and m.user_id = 'e9000000-0000-0000-0000-0000000000a4'),
    'girl_suspend_owner: she is out of its chat');

  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a4');
  perform pg_temp.check(not exists (select 1 from public.messages where body = 'Audit: G2 chat secret'),
    'girl_suspend_owner: she cannot read its messages');
  perform pg_temp.check(pg_temp.fails($q$select public.announce('e9000000-0000-0000-0000-0000000000c2', 'Audit announcement to all')$q$) is not null,
    'girl_suspend_owner: nor announce to its members');
  perform pg_temp.check(pg_temp.fails($q$insert into public.community_posts (community_id, author_id, body)
      values ('e9000000-0000-0000-0000-0000000000c2', auth.uid(), 'Audit: still here')$q$) is not null,
    'girl_suspend_owner: nor post in it');

  -- The chat of a past girls-only activity she went to: closed while suspended.
  perform pg_temp.check(not exists (select 1 from public.messages where body = 'Audit: sunset photos tonight'),
    'girl_chat_rls: a suspended member cannot read a girls-only activity chat');
  perform pg_temp.check(pg_temp.fails($q$insert into public.messages (conversation_id, sender_id, body)
      select v.id, auth.uid(), 'Audit: hello?' from public.conversations v where v.activity_id = 'e9000000-0000-0000-0000-0000000000b2'$q$) is not null
      or not exists (select 1 from public.conversations v where v.activity_id = 'e9000000-0000-0000-0000-0000000000b2'),
    'girl_chat_rls: nor write in it');
  perform pg_temp.as_admin();
  perform pg_temp.check(not exists (select 1 from public.messages where body = 'Audit: hello?'), 'girl_chat_rls: nothing was written');
  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a4');
  perform pg_temp.check(not exists (select 1 from public.conversation_members m join public.conversations v on v.id = m.conversation_id
      where v.activity_id = 'e9000000-0000-0000-0000-0000000000b2'),
    'girl_chat_rls: nor see who is in it');

  -- Her inbox and the member lists (owner-rights functions) follow the same rule.
  perform pg_temp.check(not exists (select 1 from public.my_conversations() where conversation_id = 'e9000000-0000-0000-0000-0000000000e1'),
    'girl_inbox: a suspended member no longer sees her Match chat in the inbox');
  perform pg_temp.check(not exists (select 1 from public.my_conversations() c join public.conversations v on v.id = c.conversation_id
      where v.activity_id = 'e9000000-0000-0000-0000-0000000000b2' or v.community_id = 'e9000000-0000-0000-0000-0000000000c2'),
    'girl_inbox: nor girls-only activity or community chats');
  perform pg_temp.check(not exists (select 1 from public.my_conversations() where last_body like 'Audit:%secret%' or last_body like 'Audit: sunset%'),
    'girl_inbox: nor their last message');
  perform pg_temp.check(exists (select 1 from public.my_conversations() where conversation_id = 'e9000000-0000-0000-0000-0000000000e2' and last_body = 'Plain hello (audit)'),
    'girl_inbox: her other chats are still there');
  perform pg_temp.check(not exists (select 1 from public.chat_members('e9000000-0000-0000-0000-0000000000e1')),
    'girl_inbox: chat_members hides a Match chat''s members');
  perform pg_temp.check(not exists (select 1 from public.chat_members(
      (select v.id from public.conversations v where v.activity_id = 'e9000000-0000-0000-0000-0000000000b2'))),
    'girl_inbox: and a girls-only activity chat''s members');
  perform pg_temp.check((select count(*) from public.chat_members('e9000000-0000-0000-0000-0000000000e2')) = 2,
    'girl_inbox: chat_members still lists her other chats');
  perform pg_temp.check(not exists (select 1 from public.messages where body = 'Audit: match secret'),
    'girl_chat_rls: nor read the Match chat');

  -- The other side of the Match keeps it.
  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a2');
  perform pg_temp.check(exists (select 1 from public.my_conversations() where conversation_id = 'e9000000-0000-0000-0000-0000000000e1'),
    'girl_inbox: a woman with access keeps the Match chat');
  perform pg_temp.check((select count(*) from public.chat_members('e9000000-0000-0000-0000-0000000000e1')) = 2,
    'girl_inbox: and sees its members');

  -- Its host still has it.
  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a1');
  perform pg_temp.check(exists (select 1 from public.messages where body = 'Audit: sunset photos tonight'),
    'girl_chat_rls: members with access still read the chat');
  -- The new owner moderates G2.
  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a6');
  perform pg_temp.check(public.announce('e9000000-0000-0000-0000-0000000000c2', 'Audit: welcome from the new host') >= 1,
    'girl_suspend_owner: the new owner can announce');
  perform pg_temp.as_admin();
end $$;

-- Reinstated, she finds the activity chat again (nothing was deleted there).
select pg_temp.as_user('e9000000-0000-0000-0000-0000000000a5');
select public.girl_reinstate('e9000000-0000-0000-0000-0000000000a4');
do $$
begin
  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a4');
  perform pg_temp.check(exists (select 1 from public.messages where body = 'Audit: sunset photos tonight'),
    'girl_chat_rls: reinstated, she reads the activity chat again');
  perform pg_temp.check(exists (select 1 from public.my_conversations() where conversation_id = 'e9000000-0000-0000-0000-0000000000e1')
      and (select count(*) from public.chat_members('e9000000-0000-0000-0000-0000000000e1')) = 2,
    'girl_inbox: reinstated, her Match chat is back in the inbox');
  perform pg_temp.as_admin();
end $$;

-- ───────── 4. Profile and Match photos (storage read rules) ─────────
-- The storage policies call these functions (storage itself is not part of
-- the local test schema).
insert into public.irly_match_profiles (user_id, goals, photo_paths) values
  ('e9000000-0000-0000-0000-0000000000a1', '{new_friends}', array['e9000000-0000-0000-0000-0000000000a1/match1.jpg']);
do $$
begin
  perform pg_temp.check(private.photo_thumb('e9000000-0000-0000-0000-0000000000a1/face.jpg') = 'e9000000-0000-0000-0000-0000000000a1/face-s.jpg',
    'photo_rules: the small copy is found next to the photo');

  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a3');
  perform pg_temp.check(private.can_read_profile_photo('e9000000-0000-0000-0000-0000000000a1/face.jpg'),
    'photo_rules: a member sees the face of a private profile (as everywhere in the app)');
  perform pg_temp.check(private.can_read_profile_photo('e9000000-0000-0000-0000-0000000000a1/face-s.jpg'),
    'photo_rules: and its small copy');
  perform pg_temp.check(not private.can_read_profile_photo('e9000000-0000-0000-0000-0000000000a1/beach.jpg'),
    'photo_rules: not the other photos of a private profile');
  perform pg_temp.check(not private.can_read_profile_photo('e9000000-0000-0000-0000-0000000000a1/old-removed.jpg'),
    'photo_rules: nor a file no longer on the profile');
  perform pg_temp.check(private.can_read_profile_photo('e9000000-0000-0000-0000-0000000000a3/anything.jpg'),
    'photo_rules: your own files');
  perform pg_temp.check(not private.can_read_match_photo('e9000000-0000-0000-0000-0000000000a1/match1.jpg'),
    'photo_rules: a man cannot read Match photos');

  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a5');
  perform pg_temp.check(private.can_read_profile_photo('e9000000-0000-0000-0000-0000000000a1/beach.jpg'),
    'photo_rules: IRLY admins can (verification review)');

  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a2');
  perform pg_temp.check(private.can_read_match_photo('e9000000-0000-0000-0000-0000000000a1/match1.jpg'),
    'photo_rules: a woman reads Match photos');
  perform pg_temp.check(not private.can_read_match_photo('e9000000-0000-0000-0000-0000000000a1/orphan.jpg'),
    'photo_rules: not a file outside a Match profile');

  perform pg_temp.as_admin();
  update public.safety_settings set profile_visibility = 'everyone' where user_id = 'e9000000-0000-0000-0000-0000000000a1';
  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a3');
  perform pg_temp.check(private.can_read_profile_photo('e9000000-0000-0000-0000-0000000000a1/beach.jpg'),
    'photo_rules: a public profile shows all its photos');

  perform pg_temp.as_admin();
  insert into public.blocks (blocker_id, blocked_id) values
    ('e9000000-0000-0000-0000-0000000000a1', 'e9000000-0000-0000-0000-0000000000a3'),
    ('e9000000-0000-0000-0000-0000000000a1', 'e9000000-0000-0000-0000-0000000000a2');
  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a3');
  perform pg_temp.check(not private.can_read_profile_photo('e9000000-0000-0000-0000-0000000000a1/face.jpg'),
    'photo_rules: nothing for someone she blocked');
  perform pg_temp.as_user('e9000000-0000-0000-0000-0000000000a2');
  perform pg_temp.check(not private.can_read_match_photo('e9000000-0000-0000-0000-0000000000a1/match1.jpg'),
    'photo_rules: no Match photos for someone she blocked');
  perform pg_temp.as_admin();
  delete from public.blocks where blocker_id = 'e9000000-0000-0000-0000-0000000000a1';
end $$;

-- ───────── 5. Signed-in functions are not callable by anon ─────────
do $$
begin
  perform pg_temp.check(not has_function_privilege('anon', 'public.toggle_like(text, text)', 'execute')
      and not has_function_privilege('anon', 'public.search_all(text, text, integer)', 'execute')
      and not has_function_privilege('anon', 'public.comment_thread(text, text)', 'execute'),
    'anon_execute: anon cannot call signed-in functions');
  perform pg_temp.check(has_function_privilege('authenticated', 'public.toggle_like(text, text)', 'execute')
      and has_function_privilege('authenticated', 'public.search_all(text, text, integer)', 'execute'),
    'anon_execute: members still can');
  perform pg_temp.check(has_function_privilege('anon', 'public.join_waitlist(text, text, text)', 'execute')
      and has_function_privilege('anon', 'public.places_search(text, text, text, text, numeric, integer, text[], boolean, text, integer)', 'execute'),
    'anon_execute: the public website functions stay open');
  -- Every SECURITY DEFINER function in public pins its search_path.
  perform pg_temp.check(not exists (
      select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
    'definer_search_path: every SECURITY DEFINER function sets its search_path');
end $$;

select pg_temp.as_admin();
