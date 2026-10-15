-- Push token binding, pending pushes of a token that leaves its member, and
-- IRLY Moms choices (migration 20261020001600_irly_push_owner_and_moms_choices).
-- Runs after irly_test.sql on the same database (scripts/test-db.sh); ids use
-- the prefix f1600000-…. Each block raises if a rule does not hold.
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

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL push_owner_and_moms: %', label;
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

create or replace function pg_temp.holder(tok text) returns uuid language sql as $$
  select user_id from public.push_tokens where token = tok
$$;

select pg_temp.as_admin();

-- Ada (owner of a phone registered before install secrets), Bo (attacker), Cy (another member).
insert into auth.users (id) values
  ('f1600000-0000-0000-0000-0000000000a1'), ('f1600000-0000-0000-0000-0000000000a2'),
  ('f1600000-0000-0000-0000-0000000000a3');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('f1600000-0000-0000-0000-0000000000a1', 'Ada', '1994-03-03', 'woman', 'dubai'),
  ('f1600000-0000-0000-0000-0000000000a2', 'Bo', '1993-05-05', 'man', 'dubai'),
  ('f1600000-0000-0000-0000-0000000000a3', 'Cy', '1992-07-07', 'woman', 'dubai');

create temp table secrets (name text primary key, secret text);
insert into secrets values
  ('ADA_PHONE', 'ada-phone-install-0000000000000000000000000000'),
  ('BO_PHONE', 'bo-phone-install-00000000000000000000000000000'),
  ('CY_PHONE', 'cy-phone-install-00000000000000000000000000000');
grant select on secrets to authenticated, anon;
create or replace function pg_temp.s(n text) returns text language sql as $$ select secret from secrets where name = n $$;

-- 1. A legacy (unbound) token claimed by another account is not bound to that account's install:
--    the real phone gets it back and binds it, then it is protected.
do $$
begin
  insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[ada-legacy]', 'f1600000-0000-0000-0000-0000000000a1', 'ios');
  perform pg_temp.as_user('f1600000-0000-0000-0000-0000000000a2');
  perform public.register_push_token('ExponentPushToken[ada-legacy]', 'ios', 'en', pg_temp.s('BO_PHONE'));
  perform pg_temp.as_admin();
  perform pg_temp.check(not exists (select 1 from private.push_installs where token = 'ExponentPushToken[ada-legacy]'),
    'push_bind: claiming another member''s unbound token does not bind it to the claimer''s install');
  -- Ada's updated app registers: allowed (still unbound), and on her next registration it is hers and bound.
  perform pg_temp.as_user('f1600000-0000-0000-0000-0000000000a1');
  perform public.register_push_token('ExponentPushToken[ada-legacy]', 'ios', 'en', pg_temp.s('ADA_PHONE'));
  perform public.register_push_token('ExponentPushToken[ada-legacy]', 'ios', 'en', pg_temp.s('ADA_PHONE'));
  perform pg_temp.as_admin();
  perform pg_temp.check(pg_temp.holder('ExponentPushToken[ada-legacy]') = 'f1600000-0000-0000-0000-0000000000a1'
      and exists (select 1 from private.push_installs where token = 'ExponentPushToken[ada-legacy]'
                  and install_hash = private.push_install_hash('ExponentPushToken[ada-legacy]', pg_temp.s('ADA_PHONE'))),
    'push_bind: the real phone takes its token back and binds it');
  perform pg_temp.as_user('f1600000-0000-0000-0000-0000000000a2');
  perform pg_temp.check(pg_temp.fails($q$select public.register_push_token('ExponentPushToken[ada-legacy]', 'ios', 'en', pg_temp.s('BO_PHONE'))$q$) = '42501',
    'push_bind: once bound, the attacker is refused');
  -- A new token nobody holds is still bound at its first registration.
  perform pg_temp.as_user('f1600000-0000-0000-0000-0000000000a3');
  perform public.register_push_token('ExponentPushToken[cy-new]', 'android', 'en', pg_temp.s('CY_PHONE'));
  perform pg_temp.as_admin();
  perform pg_temp.check(exists (select 1 from private.push_installs where token = 'ExponentPushToken[cy-new]'),
    'push_bind: a new token is bound at its first registration');
end $$;

-- 2. Pending pushes of a token that leaves its member are dropped; others stay.
do $$
begin
  insert into public.push_outbox (user_id, token, title, body, url) values
    ('f1600000-0000-0000-0000-0000000000a3', 'ExponentPushToken[cy-new]', 't', 'pending for Cy', '/'),
    ('f1600000-0000-0000-0000-0000000000a1', 'ExponentPushToken[ada-legacy]', 't', 'pending for Ada', '/');
  -- Cy signs out (her registration goes): her pending push goes too.
  perform pg_temp.as_user('f1600000-0000-0000-0000-0000000000a3');
  perform public.unregister_push_token('ExponentPushToken[cy-new]');
  perform pg_temp.as_admin();
  perform pg_temp.check((select handled_at is not null and error = 'token left its member' from public.push_outbox where body = 'pending for Cy'),
    'push_outbox: a signed-out phone''s pending push is not sent later');
  perform pg_temp.check((select handled_at is null from public.push_outbox where body = 'pending for Ada'),
    'push_outbox: another member''s pending push is untouched');
  -- The same phone switches to another account: the previous member's pending push goes.
  update public.push_tokens set user_id = 'f1600000-0000-0000-0000-0000000000a2' where token = 'ExponentPushToken[ada-legacy]';
  perform pg_temp.check((select handled_at is not null from public.push_outbox where body = 'pending for Ada'),
    'push_outbox: a token moved to another account drops the previous member''s pending push');
end $$;

-- 3. IRLY Moms: "looking for" only takes the app's choices (no free text such as a child's name).
do $$
begin
  perform pg_temp.check(pg_temp.fails($q$update public.irly_match_profiles set looking_for = array['friends', 'Emma 4 ans'] where user_id = (select user_id from public.irly_match_profiles limit 1)$q$) = '23514',
    'moms: free text in looking_for is refused');
  perform pg_temp.check(pg_temp.fails($q$update public.irly_match_profiles set looking_for = array['friends', 'travel companions'] where user_id = (select user_id from public.irly_match_profiles limit 1)$q$) is null,
    'moms: the app''s choices are accepted');
end $$;
