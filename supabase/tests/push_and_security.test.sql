-- Push tokens, notification content and bounded free text
-- (migration 20261020001300_irly_push_and_security).
-- Runs after irly_test.sql on the same database (scripts/test-db.sh); every
-- person, chat and token here has its own ids (prefix f1300000-…). Each
-- block raises if a rule does not hold. Attacks are made as the API roles
-- (authenticated with a JWT subject, or anon).
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
    raise exception 'FAIL push_and_security: %', label;
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

-- Who holds a token (admin view).
create or replace function pg_temp.holder(tok text) returns uuid language sql as $$
  select user_id from public.push_tokens where token = tok
$$;

select pg_temp.as_admin();

-- People: Pia, Quinn, Rex, Sam (men and women, plain members), Xan (attacker),
-- Lia and Mae (IRLY Girl), Ula (IRLY admin).
insert into auth.users (id) values
  ('f1300000-0000-0000-0000-0000000000a1'), ('f1300000-0000-0000-0000-0000000000a2'),
  ('f1300000-0000-0000-0000-0000000000a3'), ('f1300000-0000-0000-0000-0000000000a4'),
  ('f1300000-0000-0000-0000-0000000000a5'), ('f1300000-0000-0000-0000-0000000000a6'),
  ('f1300000-0000-0000-0000-0000000000a7'), ('f1300000-0000-0000-0000-0000000000a8');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('f1300000-0000-0000-0000-0000000000a1', 'Pia', '1994-03-03', 'woman', 'dubai'),
  ('f1300000-0000-0000-0000-0000000000a2', 'Quinn', '1993-05-05', 'man', 'dubai'),
  ('f1300000-0000-0000-0000-0000000000a3', 'Rex', '1992-07-07', 'man', 'dubai'),
  ('f1300000-0000-0000-0000-0000000000a4', 'Sam', '1991-09-09', 'man', 'dubai'),
  ('f1300000-0000-0000-0000-0000000000a5', 'Xan', '1990-11-11', 'man', 'dubai'),
  ('f1300000-0000-0000-0000-0000000000a6', 'Lia', '1989-01-01', 'woman', 'dubai'),
  ('f1300000-0000-0000-0000-0000000000a7', 'Mae', '1988-02-02', 'woman', 'dubai'),
  ('f1300000-0000-0000-0000-0000000000a8', 'Ula', '1987-04-04', 'woman', 'dubai');
alter table public.profiles disable trigger profiles_guard;
update public.profiles set is_admin = true where id = 'f1300000-0000-0000-0000-0000000000a8';
alter table public.profiles enable trigger profiles_guard;

-- Install secrets (what each phone keeps in its Keychain / Keystore).
-- PIA_PHONE: Pia's phone, later shared with Quinn. PIA_TABLET: her 2nd device.
-- REX_PHONE, MAE_PHONE, XAN_PHONE: the attacker's own install.
create temp table secrets (name text primary key, secret text);
insert into secrets values
  ('PIA_PHONE', 'pia-phone-install-0000000000000000000000000000'),
  ('PIA_TABLET', 'pia-tablet-install-000000000000000000000000000'),
  ('REX_PHONE', 'rex-phone-install-0000000000000000000000000000'),
  ('MAE_PHONE', 'mae-phone-install-0000000000000000000000000000'),
  ('XAN_PHONE', 'xan-phone-install-0000000000000000000000000000');
grant select on secrets to authenticated, anon;
create or replace function pg_temp.s(n text) returns text language sql as $$ select secret from secrets where name = n $$;

-- ───────── 1. Push tokens: no hijack, account switch, several devices, revocation ─────────

-- Pia's phone registers (new app: with its install secret).
do $$
begin
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a1');
  perform public.register_push_token('ExponentPushToken[pia-phone]', 'ios', 'en', pg_temp.s('PIA_PHONE'));
  perform pg_temp.check((select count(*) from public.push_tokens where token = 'ExponentPushToken[pia-phone]') = 1,
    'push_register: Pia''s phone is registered');
  perform pg_temp.as_admin();
  perform pg_temp.check(not exists (select 1 from private.push_installs where install_hash = pg_temp.s('PIA_PHONE')),
    'push_register: the install secret itself is never stored');
end $$;

-- The hijack (before this migration: Xan simply registered Pia's token and her phone got his notifications).
do $$
begin
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a5');
  perform pg_temp.check(pg_temp.fails($q$select public.register_push_token('ExponentPushToken[pia-phone]', 'ios', 'en', pg_temp.s('XAN_PHONE'))$q$) = '42501',
    'push_hijack: another install (its own secret) cannot take Pia''s token');
  perform pg_temp.check(pg_temp.fails($q$select public.register_push_token('ExponentPushToken[pia-phone]', 'ios', 'en')$q$) = '42501',
    'push_hijack: nor without a secret (the old 3-argument call)');
  perform pg_temp.check(pg_temp.fails($q$select public.register_push_token('ExponentPushToken[pia-phone]', 'ios', 'en', null)$q$) = '42501',
    'push_hijack: nor with an explicit null secret');
  perform pg_temp.check(pg_temp.fails($q$select public.unregister_push_token('ExponentPushToken[pia-phone]')$q$) is null,
    'push_hijack: unregistering someone else''s token runs');
  perform pg_temp.check(pg_temp.fails($q$select * from private.push_installs$q$) = '42501',
    'push_hijack: the install bindings are not readable through the API');
  perform pg_temp.check(pg_temp.fails($q$delete from private.push_installs$q$) = '42501',
    'push_hijack: nor writable');
  perform pg_temp.as_admin();
  perform pg_temp.check(pg_temp.holder('ExponentPushToken[pia-phone]') = 'f1300000-0000-0000-0000-0000000000a1',
    'push_hijack: Pia still holds her token (the unregister changed nothing)');
end $$;

-- Pia keeps receiving: her phone re-registers at each launch, in another language.
do $$
begin
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a1');
  perform public.register_push_token('ExponentPushToken[pia-phone]', 'ios', 'fr', pg_temp.s('PIA_PHONE'));
  -- An app not updated yet on her phone (no secret) may still refresh her own registration.
  perform public.register_push_token('ExponentPushToken[pia-phone]', 'ios', 'fr');
  -- Her second device.
  perform public.register_push_token('ExponentPushToken[pia-tablet]', 'android', 'en', pg_temp.s('PIA_TABLET'));
  perform pg_temp.as_admin();
  perform pg_temp.check((select lang from public.push_tokens where token = 'ExponentPushToken[pia-phone]') = 'fr'
      and pg_temp.holder('ExponentPushToken[pia-phone]') = 'f1300000-0000-0000-0000-0000000000a1',
    'push_legit: re-registering updates her row (language) and keeps it hers');
  perform pg_temp.check((select count(*) from public.push_tokens where user_id = 'f1300000-0000-0000-0000-0000000000a1') = 2,
    'push_legit: several devices per account');
  perform private.notify('f1300000-0000-0000-0000-0000000000a1', 'FRIEND_REQUEST',
    jsonb_build_object('from', 'f1300000-0000-0000-0000-0000000000a2'));
  perform pg_temp.check((select count(*) from public.push_outbox where user_id = 'f1300000-0000-0000-0000-0000000000a1'
      and token in ('ExponentPushToken[pia-phone]', 'ExponentPushToken[pia-tablet]')) = 2,
    'push_legit: a notification is pushed to both of her devices');
end $$;

-- The refresh without a secret did not unbind the phone.
do $$
begin
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a5');
  perform pg_temp.check(pg_temp.fails($q$select public.register_push_token('ExponentPushToken[pia-phone]', 'ios', 'en', pg_temp.s('XAN_PHONE'))$q$) = '42501',
    'push_hijack: still refused after Pia refreshed without a secret');
  perform pg_temp.as_admin();
end $$;

-- Account switch on the same phone: Quinn signs in on Pia's phone, her sign-out never reached the server.
do $$
begin
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a2');
  perform public.register_push_token('ExponentPushToken[pia-phone]', 'ios', 'en', pg_temp.s('PIA_PHONE'));
  perform pg_temp.as_admin();
  perform pg_temp.check(pg_temp.holder('ExponentPushToken[pia-phone]') = 'f1300000-0000-0000-0000-0000000000a2',
    'push_switch: the same install moves the token to the account now signed in');
  perform pg_temp.check(pg_temp.holder('ExponentPushToken[pia-tablet]') = 'f1300000-0000-0000-0000-0000000000a1',
    'push_switch: Pia''s other device is untouched');
  delete from public.push_outbox where user_id in ('f1300000-0000-0000-0000-0000000000a1', 'f1300000-0000-0000-0000-0000000000a2');
  perform private.notify('f1300000-0000-0000-0000-0000000000a1', 'FRIEND_REQUEST',
    jsonb_build_object('from', 'f1300000-0000-0000-0000-0000000000a3'));
  perform pg_temp.check(not exists (select 1 from public.push_outbox where user_id = 'f1300000-0000-0000-0000-0000000000a1'
      and token = 'ExponentPushToken[pia-phone]'),
    'push_switch: Pia''s notifications no longer go to the phone Quinn now uses');
end $$;

-- Sign-out revokes; the binding survives it.
do $$
begin
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a2');
  perform public.unregister_push_token('ExponentPushToken[pia-phone]');
  perform pg_temp.as_admin();
  perform pg_temp.check(pg_temp.holder('ExponentPushToken[pia-phone]') is null,
    'push_signout: signing out removes the registration');
  perform private.notify('f1300000-0000-0000-0000-0000000000a2', 'FRIEND_REQUEST',
    jsonb_build_object('from', 'f1300000-0000-0000-0000-0000000000a3'));
  perform pg_temp.check(not exists (select 1 from public.push_outbox where token = 'ExponentPushToken[pia-phone]'),
    'push_signout: nothing is pushed to a signed-out phone');
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a5');
  perform pg_temp.check(pg_temp.fails($q$select public.register_push_token('ExponentPushToken[pia-phone]', 'ios', 'en', pg_temp.s('XAN_PHONE'))$q$) = '42501',
    'push_signout: a signed-out phone''s token still cannot be taken by another install');
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a1');
  perform public.register_push_token('ExponentPushToken[pia-phone]', 'ios', 'fr', pg_temp.s('PIA_PHONE'));
  perform pg_temp.as_admin();
  perform pg_temp.check(pg_temp.holder('ExponentPushToken[pia-phone]') = 'f1300000-0000-0000-0000-0000000000a1',
    'push_signout: the next account signing in on that phone gets it');
end $$;

-- Account deletion revokes, and the phone can serve a new account afterwards.
do $$
begin
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a3');
  perform public.register_push_token('ExponentPushToken[rex-phone]', 'android', 'en', pg_temp.s('REX_PHONE'));
  perform pg_temp.as_admin();
  delete from auth.users where id = 'f1300000-0000-0000-0000-0000000000a3';
  perform pg_temp.check(pg_temp.holder('ExponentPushToken[rex-phone]') is null,
    'push_delete: a deleted account''s registration is gone');
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a5');
  perform pg_temp.check(pg_temp.fails($q$select public.register_push_token('ExponentPushToken[rex-phone]', 'android', 'en', pg_temp.s('XAN_PHONE'))$q$) = '42501',
    'push_delete: its token cannot be taken by another install');
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a4');
  perform public.register_push_token('ExponentPushToken[rex-phone]', 'android', 'en', pg_temp.s('REX_PHONE'));
  perform pg_temp.as_admin();
  perform pg_temp.check(pg_temp.holder('ExponentPushToken[rex-phone]') = 'f1300000-0000-0000-0000-0000000000a4',
    'push_delete: a new account on the same phone registers it');
end $$;

-- Phones registered before this migration (no binding): claimed once, then protected.
do $$
begin
  insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[legacy-phone]', 'f1300000-0000-0000-0000-0000000000a1', 'ios');
  insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[legacy-old-app]', 'f1300000-0000-0000-0000-0000000000a1', 'ios');
  -- The same phone, still on the old app, switches accounts: works as before.
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a4');
  perform public.register_push_token('ExponentPushToken[legacy-old-app]', 'ios', 'en');
  perform pg_temp.as_admin();
  perform pg_temp.check(pg_temp.holder('ExponentPushToken[legacy-old-app]') = 'f1300000-0000-0000-0000-0000000000a4',
    'push_legacy: an old app on an unbound phone still follows an account switch');
  -- The updated app on Pia's legacy phone binds it at its next launch.
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a1');
  perform public.register_push_token('ExponentPushToken[legacy-phone]', 'ios', 'en', pg_temp.s('PIA_TABLET'));
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a5');
  perform pg_temp.check(pg_temp.fails($q$select public.register_push_token('ExponentPushToken[legacy-phone]', 'ios', 'en', pg_temp.s('XAN_PHONE'))$q$) = '42501',
    'push_legacy: once bound, a legacy token is protected like any other');
  perform pg_temp.as_admin();
  perform pg_temp.check(pg_temp.holder('ExponentPushToken[legacy-phone]') = 'f1300000-0000-0000-0000-0000000000a1',
    'push_legacy: and stays Pia''s');
end $$;

-- Offline sign-out: the phone releases its token later, without a session, with its install secret.
insert into secrets values ('REL_PHONE', 'release-phone-install-00000000000000000000000000');
do $$
begin
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a2');
  perform public.register_push_token('ExponentPushToken[release-phone]', 'ios', 'en', pg_temp.s('REL_PHONE'));
  -- Wrong, missing or malformed secrets: nothing happens, and the answer is the same (no error).
  perform pg_temp.as_anon();
  perform pg_temp.check(pg_temp.fails($q$select public.release_push_token('ExponentPushToken[release-phone]', pg_temp.s('XAN_PHONE'))$q$) is null
      and pg_temp.fails($q$select public.release_push_token('ExponentPushToken[release-phone]', null)$q$) is null
      and pg_temp.fails($q$select public.release_push_token('ExponentPushToken[release-phone]', 'short')$q$) is null
      and pg_temp.fails($q$select public.release_push_token('not a token', pg_temp.s('REL_PHONE'))$q$) is null
      and pg_temp.fails($q$select public.release_push_token('ExponentPushToken[never-registered]', pg_temp.s('REL_PHONE'))$q$) is null,
    'push_release: wrong, missing or malformed secrets answer like a match (nothing leaks)');
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a5');
  perform public.release_push_token('ExponentPushToken[release-phone]', pg_temp.s('XAN_PHONE'));
  perform pg_temp.as_admin();
  perform pg_temp.check(pg_temp.holder('ExponentPushToken[release-phone]') = 'f1300000-0000-0000-0000-0000000000a2',
    'push_release: neither a wrong secret nor another install releases someone''s token');
  -- The phone that signed out offline, with its own secret and no session.
  perform pg_temp.as_anon();
  perform public.release_push_token('ExponentPushToken[release-phone]', pg_temp.s('REL_PHONE'));
  perform pg_temp.as_admin();
  perform pg_temp.check(pg_temp.holder('ExponentPushToken[release-phone]') is null,
    'push_release: anon with the install''s secret removes the registration');
  perform private.notify('f1300000-0000-0000-0000-0000000000a2', 'FRIEND_REQUEST', jsonb_build_object('from', 'f1300000-0000-0000-0000-0000000000a6'));
  perform pg_temp.check(not exists (select 1 from public.push_outbox where token = 'ExponentPushToken[release-phone]'),
    'push_release: the signed-out account''s notifications no longer reach that phone');
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a5');
  perform pg_temp.check(pg_temp.fails($q$select public.register_push_token('ExponentPushToken[release-phone]', 'ios', 'en', pg_temp.s('XAN_PHONE'))$q$) = '42501',
    'push_release: the released token stays bound to its install');
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a1');
  perform public.register_push_token('ExponentPushToken[release-phone]', 'ios', 'en', pg_temp.s('REL_PHONE'));
  perform pg_temp.as_admin();
  perform pg_temp.check(pg_temp.holder('ExponentPushToken[release-phone]') = 'f1300000-0000-0000-0000-0000000000a1',
    'push_release: release then re-register (next account on that phone) works');
  -- A token never bound to an install: nothing proves who owns it, so it cannot be released without a session.
  perform pg_temp.as_anon();
  perform public.release_push_token('ExponentPushToken[legacy-old-app]', pg_temp.s('XAN_PHONE'));
  perform pg_temp.as_admin();
  perform pg_temp.check(pg_temp.holder('ExponentPushToken[legacy-old-app]') = 'f1300000-0000-0000-0000-0000000000a4',
    'push_release: an unbound (legacy) token cannot be released by anon');
end $$;

-- Input checks; anon cannot register.
do $$
begin
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a5');
  perform pg_temp.check(pg_temp.fails($q$select public.register_push_token('not-an-expo-token-at-all', 'ios', 'en', pg_temp.s('XAN_PHONE'))$q$) = '22023',
    'push_input: a token that is not an Expo push token is refused');
  perform pg_temp.check(pg_temp.fails($q$select public.register_push_token('ExponentPushToken[xan-phone]', 'web', 'en', pg_temp.s('XAN_PHONE'))$q$) = '22023',
    'push_input: an unknown platform is refused');
  perform pg_temp.check(pg_temp.fails($q$select public.register_push_token('ExponentPushToken[xan-phone]', 'ios', 'en', 'short')$q$) = '22023',
    'push_input: a weak install secret is refused');
  perform public.register_push_token('ExponentPushToken[xan-phone]', 'ios', 'xx', pg_temp.s('XAN_PHONE'));
  perform pg_temp.check((select lang from public.push_tokens where token = 'ExponentPushToken[xan-phone]') = 'en',
    'push_input: an unknown language falls back to English');
  perform pg_temp.as_anon();
  perform pg_temp.check(pg_temp.fails($q$select public.register_push_token('ExponentPushToken[anon-phone]', 'ios', 'en', 'anon-install-00000000000000000000000000000')$q$) = '42501',
    'push_input: anon cannot register a phone');
  perform pg_temp.check(pg_temp.fails($q$select public.unregister_push_token('ExponentPushToken[pia-phone]')$q$) = '42501',
    'push_input: nor unregister one');
  perform pg_temp.as_admin();
end $$;

-- ───────── 2. A notification only carries what its recipient may read ─────────

-- Lia and Mae: IRLY Girl members with a Match chat. Mae's phone is registered.
insert into public.conversations (id, kind) values ('f1300000-0000-0000-0000-0000000000e1', 'match');
insert into public.conversation_members (conversation_id, user_id) values
  ('f1300000-0000-0000-0000-0000000000e1', 'f1300000-0000-0000-0000-0000000000a6'),
  ('f1300000-0000-0000-0000-0000000000e1', 'f1300000-0000-0000-0000-0000000000a7');
-- Mae's girls-only activity (upcoming), and a plain direct chat between Pia and Quinn.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only) values
  ('f1300000-0000-0000-0000-0000000000b1', 'f1300000-0000-0000-0000-0000000000a7', 'Push girls brunch', 'sport', 'dubai', 'marina', now() + interval '3 days', true);
insert into public.conversations (id, kind) values ('f1300000-0000-0000-0000-0000000000e2', 'direct');
insert into public.conversation_members (conversation_id, user_id) values
  ('f1300000-0000-0000-0000-0000000000e2', 'f1300000-0000-0000-0000-0000000000a1'),
  ('f1300000-0000-0000-0000-0000000000e2', 'f1300000-0000-0000-0000-0000000000a2');
-- A community Pia is in, Xan is not.
insert into public.communities (id, city_id, name, category_id, created_by) values
  ('f1300000-0000-0000-0000-0000000000c1', 'dubai', 'Push test club', 'sport', 'f1300000-0000-0000-0000-0000000000a1');
insert into public.community_members (community_id, user_id, role) values
  ('f1300000-0000-0000-0000-0000000000c1', 'f1300000-0000-0000-0000-0000000000a1', 'owner');

do $$
begin
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a7');
  perform public.register_push_token('ExponentPushToken[mae-phone]', 'ios', 'en', pg_temp.s('MAE_PHONE'));
  perform pg_temp.as_admin();
  -- With access: the Match message and a comment on her activity reach her phone with their text.
  insert into public.messages (conversation_id, sender_id, body)
    values ('f1300000-0000-0000-0000-0000000000e1', 'f1300000-0000-0000-0000-0000000000a6', 'Push: match hello');
  insert into public.comments (target_type, target_id, author_id, body)
    values ('activity', 'f1300000-0000-0000-0000-0000000000b1', 'f1300000-0000-0000-0000-0000000000a6', 'Push: count me in');
  perform pg_temp.check(exists (select 1 from public.push_outbox where token = 'ExponentPushToken[mae-phone]' and body like '%Push: match hello%'),
    'push_payload: with IRLY Girl access, a Match message is pushed with its text');
  perform pg_temp.check(exists (select 1 from public.push_outbox where token = 'ExponentPushToken[mae-phone]' and body like '%Push: count me in%'),
    'push_payload: and a comment on her girls-only activity');
  -- A plain chat keeps pushing its text.
  insert into public.messages (conversation_id, sender_id, body)
    values ('f1300000-0000-0000-0000-0000000000e2', 'f1300000-0000-0000-0000-0000000000a2', 'Push: padel at 7?');
  perform pg_temp.check(exists (select 1 from public.push_outbox where token = 'ExponentPushToken[pia-phone]' and body = 'Push: padel at 7?'),
    'push_payload: a member of a chat gets its message pushed');

  -- IRLY Girl access withdrawn: she stays in the Match chat (to find it back if reinstated).
  delete from public.push_outbox where token = 'ExponentPushToken[mae-phone]';
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a8');
  perform public.girl_suspend('f1300000-0000-0000-0000-0000000000a7', 'suspended for the push test');
  perform pg_temp.as_admin();
  perform pg_temp.check(exists (select 1 from public.conversation_members where conversation_id = 'f1300000-0000-0000-0000-0000000000e1' and user_id = 'f1300000-0000-0000-0000-0000000000a7'),
    'push_payload: (setup) the suspended member is still in the Match chat');
  -- Before 20261020001300: a new message here was pushed to her with its text.
  insert into public.messages (conversation_id, sender_id, body)
    values ('f1300000-0000-0000-0000-0000000000e1', 'f1300000-0000-0000-0000-0000000000a6', 'Push: girls secret');
  insert into public.comments (target_type, target_id, author_id, body)
    values ('activity', 'f1300000-0000-0000-0000-0000000000b1', 'f1300000-0000-0000-0000-0000000000a6', 'Push: girls comment');
  perform pg_temp.check(not exists (select 1 from public.push_outbox where body like '%Push: girls secret%' or body like '%Push: girls comment%'),
    'push_payload: after suspension, no IRLY Girl message or comment text is pushed to her');
  perform pg_temp.check(not exists (select 1 from public.notifications where user_id = 'f1300000-0000-0000-0000-0000000000a7'
      and (payload ->> 'body' like '%Push: girls%'
           or payload ->> 'message_id' in (select id::text from public.messages where body = 'Push: girls secret'))),
    'push_payload: nor stored in her notifications');
  perform pg_temp.check(exists (select 1 from public.messages where body = 'Push: girls secret'),
    'push_payload: (setup) the message itself was sent');

  -- Content notifications aimed at someone who may not read the content are dropped.
  perform private.notify('f1300000-0000-0000-0000-0000000000a5', 'MESSAGE_CREATED',
    jsonb_build_object('conversation_id', 'f1300000-0000-0000-0000-0000000000e2',
      'message_id', (select id from public.messages where body = 'Push: padel at 7?')));
  perform pg_temp.check(not exists (select 1 from public.notifications where user_id = 'f1300000-0000-0000-0000-0000000000a5' and kind = 'MESSAGE_CREATED'),
    'push_payload: no message notification for someone outside the chat');
  perform private.notify('f1300000-0000-0000-0000-0000000000a5', 'COMMUNITY_POST',
    jsonb_build_object('community_id', 'f1300000-0000-0000-0000-0000000000c1', 'community', 'Push test club', 'body', 'Push: members only', 'from', 'f1300000-0000-0000-0000-0000000000a1'));
  perform pg_temp.check(not exists (select 1 from public.push_outbox where body like '%Push: members only%' and user_id = 'f1300000-0000-0000-0000-0000000000a5'),
    'push_payload: no community post for someone outside the community');
  perform private.notify('f1300000-0000-0000-0000-0000000000a5', 'MATCH_CREATED',
    jsonb_build_object('match_id', gen_random_uuid(), 'with', 'f1300000-0000-0000-0000-0000000000a6'));
  perform pg_temp.check(not exists (select 1 from public.notifications where user_id = 'f1300000-0000-0000-0000-0000000000a5' and kind = 'MATCH_CREATED'),
    'push_payload: no Match notification without IRLY Girl access');
  -- Notifications without content are not affected.
  perform private.notify('f1300000-0000-0000-0000-0000000000a5', 'FRIEND_REQUEST', jsonb_build_object('from', 'f1300000-0000-0000-0000-0000000000a1'));
  perform pg_temp.check(exists (select 1 from public.notifications where user_id = 'f1300000-0000-0000-0000-0000000000a5' and kind = 'FRIEND_REQUEST'),
    'push_payload: other notifications are stored as before');
end $$;

-- ───────── 3. Bounded free text ─────────

do $$
begin
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a1');
  perform pg_temp.check(pg_temp.fails($q$update public.communities set tagline = repeat('x', 100000) where id = 'f1300000-0000-0000-0000-0000000000c1'$q$) = '22001',
    'text_limits: a community tagline cannot hold 100,000 characters');
  perform pg_temp.check(pg_temp.fails($q$update public.communities set description = repeat('x', 5000) where id = 'f1300000-0000-0000-0000-0000000000c1'$q$) = '22001',
    'text_limits: nor a description of 5,000');
  perform pg_temp.check(pg_temp.fails($q$update public.communities set tagline = 'Padel and brunch', description = repeat('x', 600) where id = 'f1300000-0000-0000-0000-0000000000c1'$q$) is null,
    'text_limits: what the app lets you type is accepted');
  perform pg_temp.check(pg_temp.fails($q$select public.create_community('Huge text club', 'dubai', repeat('t', 100000), null, 'sport', false)$q$) = '22001',
    'text_limits: create_community is bounded too');
  perform pg_temp.check(pg_temp.fails($q$update public.profiles set country = repeat('x', 100000) where id = auth.uid()$q$) = '22001',
    'text_limits: profile country');
  perform pg_temp.check(pg_temp.fails($q$update public.profiles set interests = array(select 'i' || g from generate_series(1, 500) g) where id = auth.uid()$q$) = '22001',
    'text_limits: profile interest lists');
  perform pg_temp.check(pg_temp.fails($q$update public.profiles set interests = array['padel', 'brunch'], country = 'France' where id = auth.uid()$q$) is null,
    'text_limits: a normal profile edit works');
  perform pg_temp.check(pg_temp.fails($q$insert into public.notification_prefs (user_id, muted_kinds) values (auth.uid(), array(select repeat('k', 100) from generate_series(1, 1000))) on conflict (user_id) do update set muted_kinds = excluded.muted_kinds$q$) = '22001',
    'text_limits: muted notification kinds');
  perform pg_temp.as_admin();
  -- A row already longer than the bound is never rejected for an unrelated change.
  alter table public.communities disable trigger communities_text_limits;
  update public.communities set tagline = repeat('o', 500) where id = 'f1300000-0000-0000-0000-0000000000c1';
  alter table public.communities enable trigger communities_text_limits;
  perform pg_temp.as_user('f1300000-0000-0000-0000-0000000000a1');
  perform pg_temp.check(pg_temp.fails($q$update public.communities set name = 'Push test club two' where id = 'f1300000-0000-0000-0000-0000000000c1'$q$) is null,
    'text_limits: existing longer values do not block other edits');
  perform pg_temp.as_admin();
end $$;

select pg_temp.as_admin();
\echo push_and_security: ALL CHECKS PASSED
