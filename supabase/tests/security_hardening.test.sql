-- Security hardening (migration 20261102000000_irly_security_hardening):
-- IRLY Girl needs an identity verified by IRLY; bans and IRLY Girl
-- suspensions outlive a deleted account (hashes only); names and faces follow
-- the profile visibility; community member lists for members; no TRUNCATE /
-- REFERENCES / TRIGGER for API roles and RLS on every table; foreign-key
-- indexes; per-sender rate limits; explicit like / save setters; the typing
-- channel for conversation members only. Runs after irly_test.sql on the
-- same database (scripts/test-db.sh); ids use the prefix 5ec00000-…
\set ON_ERROR_STOP 1

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

create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end $$;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL security_hardening: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

-- The error message of a statement (null when it succeeds).
create or replace function pg_temp.error_of(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlerrm;
end $$;

select pg_temp.as_admin();
-- The local auth shim has no e-mail or phone columns; Supabase has both.
alter table auth.users add column if not exists email text;
alter table auth.users add column if not exists phone text;
-- Women created in this file are not verified (see the fixture in irly_test.sql).
set irly_test.unverified = 'on';

-- ───────── 1. IRLY Girl needs an identity verified by IRLY ─────────
insert into auth.users (id) values
  ('5ec00000-0000-0000-0000-0000000000a1'), ('5ec00000-0000-0000-0000-0000000000a2'), ('5ec00000-0000-0000-0000-0000000000a9');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000a1');
insert into public.profiles (id, first_name, birthdate, gender, city_id)
values ('5ec00000-0000-0000-0000-0000000000a1', 'Wafa', '1994-03-03', 'woman', 'dubai');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000a2');
insert into public.profiles (id, first_name, birthdate, gender, city_id)
values ('5ec00000-0000-0000-0000-0000000000a2', 'Marc', '1990-03-03', 'man', 'dubai');
select pg_temp.as_admin();
insert into public.profiles (id, first_name, birthdate, gender, city_id)
values ('5ec00000-0000-0000-0000-0000000000a9', 'Admina', '1985-03-03', 'woman', 'dubai');
insert into public.staff_roles (user_id, role) values ('5ec00000-0000-0000-0000-0000000000a9', 'admin');

select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000a1');
select pg_temp.check(public.my_girl_status() = 'needs_verification', 'girl: an unverified woman reads needs_verification');
select pg_temp.check(not public.my_girl_access() and not private.is_girl_eligible(), 'girl: and has no IRLY Girl access');
select pg_temp.check(pg_temp.error_of($q$update public.profiles set verified_at = now() where id = auth.uid()$q$) is not null,
  'girl: she cannot verify herself');
select pg_temp.check(pg_temp.error_of($q$insert into public.verification_requests (user_id, gesture, status) values (auth.uid(), 'peace', 'approved')$q$) is not null,
  'girl: nor approve a review of her own');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000a2');
select pg_temp.check(public.my_girl_status() = 'not_eligible', 'girl: a man reads not_eligible (never needs_verification)');

-- Verified by IRLY (the badge decide_verification sets): open.
select pg_temp.as_admin();
update public.profiles set verified_at = now(), photo_paths = array['5ec00000-0000-0000-0000-0000000000a1/1.jpg'],
  verified_photos = array['5ec00000-0000-0000-0000-0000000000a1/1.jpg'] where id = '5ec00000-0000-0000-0000-0000000000a1';
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000a1');
select pg_temp.check(public.my_girl_status() = 'open' and public.my_girl_access(), 'girl: verified, IRLY Girl opens');
-- A new photo nobody reviewed drops the badge, and with it IRLY Girl, unless a review was approved.
update public.profiles set photo_paths = array['5ec00000-0000-0000-0000-0000000000a1/1.jpg', '5ec00000-0000-0000-0000-0000000000a1/2.jpg'] where id = auth.uid();
select pg_temp.check((select verified_at is null from public.my_verification()), 'girl: a new photo drops the badge');
select pg_temp.check(public.my_girl_status() = 'needs_verification', 'girl: without a badge or an approved review: needs_verification again');
select pg_temp.as_admin();
insert into public.verification_requests (user_id, gesture, status, decided_at) values ('5ec00000-0000-0000-0000-0000000000a1', 'peace', 'approved', now());
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000a1');
select pg_temp.check(public.my_girl_status() = 'open', 'girl: an approved selfie review keeps IRLY Girl open');
-- Suspended comes first.
select pg_temp.as_admin();
insert into public.girl_suspensions (user_id, reason) values ('5ec00000-0000-0000-0000-0000000000a1', 'test suspension');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000a1');
select pg_temp.check(public.my_girl_status() = 'suspended' and not public.my_girl_access(), 'girl: a suspension still closes it');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000a9');
select public.girl_reinstate('5ec00000-0000-0000-0000-0000000000a1');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000a1');
select pg_temp.check(public.my_girl_status() = 'open', 'girl: reinstated, open again');

-- ───────── 2. A ban or an IRLY Girl suspension outlives the account ─────────
select pg_temp.as_admin();
insert into auth.users (id, email, phone) values
  ('5ec00000-0000-0000-0000-0000000000b1', 'Ban.Me+x@Example.COM', '+971 50 123 4567'),
  ('5ec00000-0000-0000-0000-0000000000b5', 'lifted@example.com', null),
  ('5ec00000-0000-0000-0000-0000000000c1', 'girl.gone@example.com', null);
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('5ec00000-0000-0000-0000-0000000000b1', 'Bad', '1990-01-01', 'man', 'dubai'),
  ('5ec00000-0000-0000-0000-0000000000b5', 'Lift', '1990-01-01', 'man', 'dubai'),
  ('5ec00000-0000-0000-0000-0000000000c1', 'Gina', '1990-01-01', 'woman', 'dubai');
insert into public.sanctions (user_id, kind, reason) values
  ('5ec00000-0000-0000-0000-0000000000b1', 'ban', 'test ban'),
  ('5ec00000-0000-0000-0000-0000000000b5', 'ban', 'test ban to lift');
insert into public.girl_suspensions (user_id, reason) values ('5ec00000-0000-0000-0000-0000000000c1', 'test suspension');

select pg_temp.check((select count(*) from private.flagged_identities where source_user = '5ec00000-0000-0000-0000-0000000000b1' and flag = 'ban' and lifted_at is null) = 3,
  'identity: a ban flags the e-mail, the normalised e-mail and the phone');
select pg_temp.check(exists (select 1 from private.flagged_identities where source_user = '5ec00000-0000-0000-0000-0000000000b1'
    and hash_kind = 'email' and hash = encode(sha256(convert_to('ban.me+x@example.com', 'UTF8')), 'hex')),
  'identity: the e-mail is kept as sha256(lower(email))');
select pg_temp.check(not exists (select 1 from private.flagged_identities f where f.hash !~ '^[0-9a-f]{64}$' or to_jsonb(f)::text ~* '(@|example|971)'),
  'identity: no address or phone number is stored, only hashes');
select pg_temp.check(not has_table_privilege('authenticated', 'private.flagged_identities', 'select')
    and not has_table_privilege('anon', 'private.flagged_identities', 'select'),
  'identity: the API roles cannot read the hashes');

-- The accounts are deleted; the flags stay.
delete from auth.users where id in ('5ec00000-0000-0000-0000-0000000000b1', '5ec00000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) from private.flagged_identities where source_user in ('5ec00000-0000-0000-0000-0000000000b1', '5ec00000-0000-0000-0000-0000000000c1') and lifted_at is null) = 5,
  'identity: the flags survive the deletion of the account');

-- Signing up again with the same address (any case), a +tag of it, or the same phone: refused.
insert into auth.users (id, email, phone) values
  ('5ec00000-0000-0000-0000-0000000000b2', 'ban.me+x@example.com', null),
  ('5ec00000-0000-0000-0000-0000000000b3', 'BAN.ME+again@example.com', null),
  ('5ec00000-0000-0000-0000-0000000000b4', 'someone.else@example.com', '971501234567'),
  ('5ec00000-0000-0000-0000-0000000000b6', 'fresh@example.com', null);
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000b2');
select pg_temp.check(pg_temp.error_of($q$insert into public.profiles (id, first_name, birthdate, gender, city_id) values (auth.uid(), 'Bad', '1990-01-01', 'man', 'dubai')$q$) = 'your account is suspended',
  'identity: the banned address cannot create a profile again');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000b3');
select pg_temp.check(pg_temp.error_of($q$insert into public.profiles (id, first_name, birthdate, gender, city_id) values (auth.uid(), 'Bad', '1990-01-01', 'man', 'dubai')$q$) = 'your account is suspended',
  'identity: nor with another +tag of it');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000b4');
select pg_temp.check(pg_temp.error_of($q$insert into public.profiles (id, first_name, birthdate, gender, city_id) values (auth.uid(), 'Bad', '1990-01-01', 'man', 'dubai')$q$) = 'your account is suspended',
  'identity: nor with the same phone number');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000b6');
select pg_temp.check(pg_temp.error_of($q$insert into public.profiles (id, first_name, birthdate, gender, city_id) values (auth.uid(), 'Fresh', '1990-01-01', 'man', 'dubai')$q$) is null,
  'identity: anyone else signs up as usual');

-- A lifted ban lifts the flag.
select pg_temp.as_admin();
update public.sanctions set lifted_at = now(), lift_reason = 'test' where user_id = '5ec00000-0000-0000-0000-0000000000b5';
select pg_temp.check(not exists (select 1 from private.flagged_identities where source_user = '5ec00000-0000-0000-0000-0000000000b5' and lifted_at is null),
  'identity: lifting the ban lifts the flag');
delete from auth.users where id = '5ec00000-0000-0000-0000-0000000000b5';
insert into auth.users (id, email) values ('5ec00000-0000-0000-0000-0000000000b7', 'lifted@example.com');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000b7');
select pg_temp.check(pg_temp.error_of($q$insert into public.profiles (id, first_name, birthdate, gender, city_id) values (auth.uid(), 'Lift', '1990-01-01', 'man', 'dubai')$q$) is null,
  'identity: after a lifted ban the address may sign up again');

-- A woman whose IRLY Girl access was withdrawn signs up again: still withdrawn.
select pg_temp.as_admin();
insert into auth.users (id, email) values ('5ec00000-0000-0000-0000-0000000000c2', 'Girl.Gone@example.com');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000c2');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values (auth.uid(), 'Gina', '1990-01-01', 'woman', 'dubai');
select pg_temp.as_admin();
insert into public.verification_requests (user_id, gesture, status, decided_at) values ('5ec00000-0000-0000-0000-0000000000c2', 'peace', 'approved', now());
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000c2');
select pg_temp.check(public.my_girl_status() = 'suspended' and not public.my_girl_access(), 'identity: a re-created account keeps the IRLY Girl suspension');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000a9');
select public.girl_reinstate('5ec00000-0000-0000-0000-0000000000c2');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000c2');
select pg_temp.check(public.my_girl_status() = 'open', 'identity: an admin can still reinstate her');

-- ───────── 3. Names and faces follow the profile visibility ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('5ec00000-0000-0000-0000-0000000000d1'), ('5ec00000-0000-0000-0000-0000000000d2'), ('5ec00000-0000-0000-0000-0000000000d3'),
  ('5ec00000-0000-0000-0000-0000000000d4'), ('5ec00000-0000-0000-0000-0000000000d5');
insert into public.profiles (id, first_name, birthdate, gender, city_id, photo_paths) values
  ('5ec00000-0000-0000-0000-0000000000d1', 'Tara', '1990-01-01', 'man', 'dubai', array['5ec00000-0000-0000-0000-0000000000d1/face.jpg', '5ec00000-0000-0000-0000-0000000000d1/beach.jpg']),
  ('5ec00000-0000-0000-0000-0000000000d2', 'Stan', '1990-01-01', 'man', 'dubai', '{}'),
  ('5ec00000-0000-0000-0000-0000000000d3', 'Fred', '1990-01-01', 'man', 'dubai', '{}'),
  ('5ec00000-0000-0000-0000-0000000000d4', 'Chad', '1990-01-01', 'man', 'dubai', '{}'),
  ('5ec00000-0000-0000-0000-0000000000d5', 'Paul', '1990-01-01', 'man', 'dubai', '{}');
insert into public.safety_settings (user_id, profile_visibility) values ('5ec00000-0000-0000-0000-0000000000d1', 'nobody')
on conflict (user_id) do update set profile_visibility = 'nobody';
-- Fred is her friend; Chad shares a direct chat with her; Paul joined her activity.
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at)
values ('5ec00000-0000-0000-0000-0000000000d1', '5ec00000-0000-0000-0000-0000000000d3', '5ec00000-0000-0000-0000-0000000000d3', 'accepted', now());
insert into public.conversations (id, kind) values ('5ec00000-0000-0000-0000-0000000000e1', 'direct');
insert into public.conversation_members (conversation_id, user_id) values
  ('5ec00000-0000-0000-0000-0000000000e1', '5ec00000-0000-0000-0000-0000000000d1'),
  ('5ec00000-0000-0000-0000-0000000000e1', '5ec00000-0000-0000-0000-0000000000d4');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at)
values ('5ec00000-0000-0000-0000-0000000000f1', '5ec00000-0000-0000-0000-0000000000d1', 'Morning swim', 'sport', 'dubai', 'marina', now() + interval '3 days');
insert into public.activity_participants (activity_id, user_id) values ('5ec00000-0000-0000-0000-0000000000f1', '5ec00000-0000-0000-0000-0000000000d5')
on conflict do nothing;

select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000d2');
select pg_temp.check(not exists (select 1 from public.profiles_public where id = '5ec00000-0000-0000-0000-0000000000d1'), 'visibility: a stranger does not read a hidden name in profiles_public');
select pg_temp.check(not exists (select 1 from public.profile_faces(array['5ec00000-0000-0000-0000-0000000000d1']::uuid[])), 'visibility: nor her face (profile_faces)');
select pg_temp.check(not exists (select 1 from public.public_profile('5ec00000-0000-0000-0000-0000000000d1')), 'visibility: nor her profile (public_profile)');
select pg_temp.check(not private.can_read_profile_photo('5ec00000-0000-0000-0000-0000000000d1/face.jpg')
    and not private.can_read_profile_photo('5ec00000-0000-0000-0000-0000000000d1/face-s.jpg'), 'visibility: nor her first photo in storage');
select pg_temp.check(exists (select 1 from public.profiles_public where id = auth.uid()) and exists (select 1 from public.public_profile(auth.uid())),
  'visibility: everyone reads their own');
do $$
declare who uuid;
begin
  foreach who in array array['5ec00000-0000-0000-0000-0000000000d3', '5ec00000-0000-0000-0000-0000000000d4', '5ec00000-0000-0000-0000-0000000000d5']::uuid[] loop
    perform pg_temp.as_user(who);
    perform pg_temp.check(exists (select 1 from public.profiles_public where id = '5ec00000-0000-0000-0000-0000000000d1')
        and exists (select 1 from public.profile_faces(array['5ec00000-0000-0000-0000-0000000000d1']::uuid[]))
        and private.can_read_profile_photo('5ec00000-0000-0000-0000-0000000000d1/face.jpg'),
      'visibility: a friend, a chat partner, a participant still read her name and face (' || right(who::text, 2) || ')');
    perform pg_temp.check((select not visible and bio is null from public.public_profile('5ec00000-0000-0000-0000-0000000000d1')),
      'visibility: her profile page opens, private (' || right(who::text, 2) || ')');
    perform pg_temp.check(not private.can_read_profile_photo('5ec00000-0000-0000-0000-0000000000d1/beach.jpg') or who = '5ec00000-0000-0000-0000-0000000000d3'::uuid,
      'visibility: the other photos keep their own rule (' || right(who::text, 2) || ')');
  end loop;
  perform pg_temp.as_user('5ec00000-0000-0000-0000-0000000000a9');
  perform pg_temp.check(exists (select 1 from public.profiles_public where id = '5ec00000-0000-0000-0000-0000000000d1'), 'visibility: IRLY staff read it (moderation)');
  perform pg_temp.as_admin();
end $$;
-- Visible to everyone again: strangers read it, as before.
update public.safety_settings set profile_visibility = 'everyone' where user_id = '5ec00000-0000-0000-0000-0000000000d1';
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000d2');
select pg_temp.check(exists (select 1 from public.profiles_public where id = '5ec00000-0000-0000-0000-0000000000d1')
    and exists (select 1 from public.profile_faces(array['5ec00000-0000-0000-0000-0000000000d1']::uuid[]))
    and (select visible from public.public_profile('5ec00000-0000-0000-0000-0000000000d1')),
  'visibility: a public profile reads as before');
-- A block still hides everything.
select pg_temp.as_admin();
insert into public.blocks (blocker_id, blocked_id) values ('5ec00000-0000-0000-0000-0000000000d1', '5ec00000-0000-0000-0000-0000000000d3');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000d3');
select pg_temp.check(not exists (select 1 from public.profiles_public where id = '5ec00000-0000-0000-0000-0000000000d1')
    and not exists (select 1 from public.profile_faces(array['5ec00000-0000-0000-0000-0000000000d1']::uuid[])),
  'visibility: a block hides her even from a friend');
select pg_temp.as_admin();
delete from public.blocks where blocker_id = '5ec00000-0000-0000-0000-0000000000d1';

-- ───────── 5. Community member lists: members only; counts stay ─────────
insert into public.communities (id, city_id, name, created_by) values ('5ec00000-0000-0000-0000-0000000000c9', 'dubai', 'Sec Hardening Club', '5ec00000-0000-0000-0000-0000000000d4');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000d4');
select public.join_community('5ec00000-0000-0000-0000-0000000000c9');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000d5');
select public.join_community('5ec00000-0000-0000-0000-0000000000c9');
select pg_temp.check((select count(*) from public.community_members where community_id = '5ec00000-0000-0000-0000-0000000000c9') = 2,
  'members: a member lists the members of her community');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000d2');
select pg_temp.check(not exists (select 1 from public.community_members where community_id = '5ec00000-0000-0000-0000-0000000000c9'),
  'members: a non-member lists nobody');
select pg_temp.check(not exists (select 1 from public.community_members where user_id = '5ec00000-0000-0000-0000-0000000000d5'),
  'members: nor which communities someone else is in');
select pg_temp.check((select members from public.community_detail('5ec00000-0000-0000-0000-0000000000c9')) = 2
    and (select members from public.community_digest('5ec00000-0000-0000-0000-0000000000c9')) = 2,
  'members: the count stays readable (community_detail, community_digest)');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000a9');
select pg_temp.check((select count(*) from public.community_members where community_id = '5ec00000-0000-0000-0000-0000000000c9') = 2,
  'members: IRLY staff list them (moderation)');

-- ───────── 6. Privileges ─────────
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity),
  'privileges: every public table has RLS enabled');
select pg_temp.check(not exists (
    select 1 from pg_class c, unnest(array['anon', 'authenticated']) r, unnest(array['truncate', 'references', 'trigger']) p
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm')
      and has_table_privilege(r, c.oid, p)),
  'privileges: anon and authenticated have no TRUNCATE, REFERENCES or TRIGGER on any public table');
select pg_temp.check(not has_table_privilege('anon', 'public.profiles', 'truncate'), 'privileges: anon cannot truncate profiles');

-- ───────── 7. Foreign keys have an index ─────────
select pg_temp.check(not exists (
    select 1 from (values ('message_reads', 'user_id'), ('message_reactions', 'user_id'), ('community_poll_votes', 'user_id'),
      ('shares', 'user_id'), ('shares', 'conversation_id'), ('close_friends', 'friend_id'), ('people_match_skips', 'other_id'),
      ('comments', 'parent_id'), ('irl_posts', 'community_id'), ('community_notification_prefs', 'community_id')) fk (t, col)
    where not exists (
      select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
      where i.indrelid = ('public.' || fk.t)::regclass and a.attname = fk.col)),
  'indexes: each listed foreign key leads an index');

-- ───────── 8. Rate limits per sender ─────────
select pg_temp.as_anon();
select public.join_waitlist('flood+1@sec-flood.example');
select public.join_waitlist('flood+2@sec-flood.example');
select public.join_waitlist('flood+3@sec-flood.example');
select pg_temp.check(pg_temp.error_of($q$select public.join_waitlist('flood+4@sec-flood.example')$q$) like 'slow down%',
  'waitlist: 3 an hour for one mailbox (+tags)');
select public.join_waitlist('j.doe@gmail.com');
select public.join_waitlist('jdoe+a@gmail.com');
select public.join_waitlist('j.d.o.e@googlemail.com');
select pg_temp.check(pg_temp.error_of($q$select public.join_waitlist('jdoe@gmail.com')$q$) like 'slow down%',
  'waitlist: Gmail dots and googlemail are the same mailbox');
do $$
begin
  for i in 1..17 loop
    perform public.join_waitlist('person' || i || '@sec-flood.example');
  end loop;
end $$;
select pg_temp.check(pg_temp.error_of($q$select public.join_waitlist('person99@sec-flood.example')$q$) like 'slow down%',
  'waitlist: 20 in 10 minutes for one domain');
select pg_temp.check(pg_temp.error_of($q$select public.join_waitlist('someone@other-domain.example')$q$) is null,
  'waitlist: other domains are not affected');

select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000d2');
do $$
begin
  for i in 1..5 loop
    perform public.contact_support('sender' || i || '@sec-support.example', 'other', 'A question about IRLY number ' || i);
  end loop;
end $$;
select pg_temp.check(pg_temp.error_of($q$select public.contact_support('sender6@sec-support.example', 'other', 'One question too many')$q$) like 'slow down%',
  'support: 5 an hour for one signed-in account, whatever address it gives');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000d3');
select pg_temp.check(pg_temp.error_of($q$select public.contact_support('other@sec-support.example', 'other', 'Another member asks')$q$) is null,
  'support: another member is not affected');
do $$
begin
  for i in 1..10 loop
    insert into public.support_requests (user_id, kind, body) values (auth.uid(), 'question', 'From the app ' || i);
  end loop;
end $$;
select pg_temp.check(pg_temp.error_of($q$insert into public.support_requests (user_id, kind, body) values (auth.uid(), 'question', 'From the app 11')$q$) like 'slow down%',
  'support: 10 an hour from the app form');

select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000d4');
do $$
begin
  for i in 1..70 loop
    insert into public.analytics_events (user_id, name) values (null, 'SEC_HARDENING_TEST');
  end loop;
end $$;
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.analytics_events where name = 'SEC_HARDENING_TEST') = 60,
  'analytics: a member sending events without user_id is held to her own 60 a minute');
delete from public.analytics_events where name = 'SEC_HARDENING_TEST';

-- ───────── 9. Like / save: explicit setters ─────────
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000d5');
select pg_temp.check(public.set_like('activity', '5ec00000-0000-0000-0000-0000000000f1', true)
    and public.set_like('activity', '5ec00000-0000-0000-0000-0000000000f1', true), 'set_like: true, twice');
select pg_temp.check((select count(*) from public.likes where user_id = auth.uid() and target_id = '5ec00000-0000-0000-0000-0000000000f1') = 1,
  'set_like: liking twice is one like (a retry does not undo it)');
-- (Each change in its own statement: a statement reads the rows as they were when it began.)
select pg_temp.check(not public.set_like('activity', '5ec00000-0000-0000-0000-0000000000f1', false)
    and not public.set_like('activity', '5ec00000-0000-0000-0000-0000000000f1', false), 'set_like: false, twice');
select pg_temp.check(not exists (select 1 from public.likes where user_id = auth.uid() and target_id = '5ec00000-0000-0000-0000-0000000000f1'),
  'set_like: unliking twice leaves no like (a retry does not like again)');
select pg_temp.check(public.set_save('activity', '5ec00000-0000-0000-0000-0000000000f1', true)
    and public.set_save('activity', '5ec00000-0000-0000-0000-0000000000f1', true), 'set_save: true, twice');
select pg_temp.check((select count(*) from public.saves where user_id = auth.uid() and target_id = '5ec00000-0000-0000-0000-0000000000f1') = 1,
  'set_save: saving twice is one save');
select pg_temp.check(not public.toggle_save('activity', '5ec00000-0000-0000-0000-0000000000f1'), 'set_save: the old toggle still works');
select pg_temp.check(not exists (select 1 from public.saves where user_id = auth.uid() and target_id = '5ec00000-0000-0000-0000-0000000000f1'),
  'set_save: the toggle removed the save');
select pg_temp.check(not public.set_save('activity', '5ec00000-0000-0000-0000-0000000000f1', false), 'set_save: false on nothing saved stays false');
select pg_temp.as_admin();
select pg_temp.check(not has_function_privilege('anon', 'public.set_like(text, text, boolean)', 'execute')
    and not has_function_privilege('anon', 'public.set_save(text, text, boolean)', 'execute'), 'set_like / set_save: not for anon');

-- ───────── 10. The typing channel: conversation members only ─────────
-- A stand-in for Supabase's realtime.messages, to run the real policies.
create schema realtime;
create table realtime.messages (id bigserial primary key, topic text not null, extension text not null, payload jsonb);
create function realtime.topic() returns text language sql stable as $$ select nullif(current_setting('realtime.topic', true), '') $$;
alter table realtime.messages enable row level security;
grant usage on schema realtime to authenticated;
grant select, insert on realtime.messages to authenticated;
grant usage on sequence realtime.messages_id_seq to authenticated;
grant execute on function realtime.topic() to authenticated;
select private.install_typing_policies();
insert into realtime.messages (topic, extension, payload) values ('typing:5ec00000-0000-0000-0000-0000000000e1', 'broadcast', '{}');

select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000d4');
select set_config('realtime.topic', 'typing:5ec00000-0000-0000-0000-0000000000e1', false);
select pg_temp.check(private.typing_topic_allowed('typing:5ec00000-0000-0000-0000-0000000000e1'), 'typing: a member may use the topic');
select pg_temp.check(pg_temp.error_of($q$insert into realtime.messages (topic, extension, payload) values ('typing:5ec00000-0000-0000-0000-0000000000e1', 'broadcast', '{"uid":"x"}')$q$) is null,
  'typing: a member sends');
select pg_temp.check((select count(*) from realtime.messages) = 2, 'typing: and receives');
select pg_temp.as_user('5ec00000-0000-0000-0000-0000000000d2');
select set_config('realtime.topic', 'typing:5ec00000-0000-0000-0000-0000000000e1', false);
select pg_temp.check(not private.typing_topic_allowed('typing:5ec00000-0000-0000-0000-0000000000e1'), 'typing: not someone outside the conversation');
select pg_temp.check(pg_temp.error_of($q$insert into realtime.messages (topic, extension, payload) values ('typing:5ec00000-0000-0000-0000-0000000000e1', 'broadcast', '{}')$q$) is not null
    and not exists (select 1 from realtime.messages), 'typing: who is not a member neither sends nor receives');
select pg_temp.check(not private.typing_topic_allowed('typing:not-a-uuid') and not private.typing_topic_allowed('other:5ec00000-0000-0000-0000-0000000000e1')
    and not private.typing_topic_allowed(null), 'typing: other topics are not opened by this rule');
select pg_temp.as_anon();
select pg_temp.check(pg_temp.error_of($q$select private.typing_topic_allowed('typing:5ec00000-0000-0000-0000-0000000000e1')$q$) is not null, 'typing: anon cannot ask');

-- ───────── Clean-up ─────────
select pg_temp.as_admin();
drop schema realtime cascade;
reset irly_test.unverified;
delete from private.rate_hits where key in (select id::text from public.profiles where id::text like '5ec00000-%');
delete from public.waitlist where email like '%@sec-flood.example' or email in ('j.doe@gmail.com', 'jdoe+a@gmail.com', 'j.d.o.e@googlemail.com', 'someone@other-domain.example');
delete from public.support_requests where contact like '%@sec-support.example' or body like 'From the app %';
delete from public.communities where id = '5ec00000-0000-0000-0000-0000000000c9';
delete from public.conversations where id = '5ec00000-0000-0000-0000-0000000000e1';
delete from public.activities where id = '5ec00000-0000-0000-0000-0000000000f1';
delete from auth.users where id::text like '5ec00000-%';
delete from private.flagged_identities where source_user::text like '5ec00000-%';
alter table auth.users drop column if exists phone;
alter table auth.users drop column if exists email;
