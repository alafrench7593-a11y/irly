-- IRLY QA fixes: sign-in, account lifecycle, identity flags (QA report
-- "auth" of 2026-11-01, and IOS-01 of the "ios" report). Additive and safe
-- to run again: functions are replaced with the same signatures, one new
-- column, two private tables, triggers dropped then created. No row is
-- deleted by this migration; RLS stays on everywhere.
--
-- ───────── For the app (what changed in the API) ─────────
--  * profiles.first_name is refused when it is blank once trimmed, carries
--    control / bidi / zero-width characters, or reads as the IRLY team
--    ('IRLY Team', 'Admin', 'Moderator', …; IRLY staff are exempt):
--    'choose another first name' (23514). Only checked when the name is
--    written or changed, so existing profiles keep working.
--  * submit_verification refuses a gesture older than 30 minutes, or one
--    that a newer request replaced: 'start again: this request is no longer
--    open' (P0002, the message the app already handles).
--  * New for the back office (admins, with a reason, journaled):
--      public.identity_lift(p_email text, p_phone text, p_flag text, p_reason text) returns integer
--    lifts a ban / suspension / IRLY Girl flag left by a DELETED account
--    whose e-mail or phone matches (an appeal after deletion). Returns how
--    many flag rows were lifted. Accounts that still exist are handled with
--    the sanction itself (mod_lift_sanction, girl_reinstate).
--  * Edge Function apple-revoke (supabase/functions/apple-revoke) and its
--    service-role-only RPCs: apple_token_save, apple_token_queue,
--    apple_revoke_take, apple_revoke_done (see section 6).
--
-- ───────── What was found and closed ─────────
--  auth-02  A banned member changed the sign-in e-mail, deleted the account
--           and signed up again with the new address: the identity is now
--           flagged again whenever the e-mail or phone changes, and when the
--           sign-in account is deleted (whatever deletes it).
--  auth-03  A ban could never be lifted once the account was deleted:
--           identity_lift (above).
--  auth-04  girl_reinstate only lifted the flags of the reinstated account
--           itself, not those of the deleted account she came from.
--  auth-05  support requests kept the deleted member's address and text:
--           they are anonymised when the sign-in account is deleted.
--  auth-06  Invisible, control, bidi or staff-looking first names.
--  auth-08  A temporary suspension was escaped by deleting the account: an
--           active suspension now flags the identity until it ends.
--  auth-09  Stale or replaced verification gestures were still accepted.
--  IOS-01   Sign in with Apple tokens are revoked when the account goes
--           (the Apple refresh token is queued at deletion).
-- Tests: supabase/tests/auth_qa_fixes.test.sql.

-- ───────── 1. Identity flags: suspensions, an end date, any e-mail used ─────────

alter table private.flagged_identities add column if not exists until timestamptz;
alter table private.flagged_identities drop constraint if exists flagged_identities_flag_check;
alter table private.flagged_identities add constraint flagged_identities_flag_check
  check (flag in ('ban', 'girl', 'suspension'));

-- The hashes of an e-mail and / or a phone number (the rules of
-- identity_hashes, 20261102000000, unchanged), usable without an account.
create or replace function private.identity_hashes_of(p_email text, p_phone text)
returns table (hash text, hash_kind text)
language plpgsql stable security definer set search_path = public as $$
declare
  em text := lower(btrim(p_email));
  ph text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  loc text;
  dom text;
begin
  if coalesce(em, '') like '_%@_%' then
    hash := private.sha256_hex(em); hash_kind := 'email'; return next;
    loc := split_part(split_part(em, '@', 1), '+', 1);
    dom := split_part(em, '@', 2);
    if dom in ('gmail.com', 'googlemail.com') then
      loc := replace(loc, '.', '');
      dom := 'gmail.com';
    end if;
    hash := private.sha256_hex(loc || '@' || dom); hash_kind := 'email_norm'; return next;
  end if;
  if char_length(ph) >= 6 then
    hash := private.sha256_hex(ph); hash_kind := 'phone'; return next;
  end if;
end $$;
revoke all on function private.identity_hashes_of(text, text) from public, anon, authenticated;

-- Same answers as before (last defined in 20261102000000), from the shared rules above.
create or replace function private.identity_hashes(uid uuid)
returns table (hash text, hash_kind text)
language plpgsql stable security definer set search_path = public as $$
declare
  em text;
  ph text;
begin
  select to_jsonb(u) ->> 'email', to_jsonb(u) ->> 'phone' into em, ph from auth.users u where u.id = uid;
  if not found then return; end if;
  return query select h.hash, h.hash_kind from private.identity_hashes_of(em, ph) h;
end $$;
revoke all on function private.identity_hashes(uuid) from public, anon, authenticated;

-- A flag with an optional end (a suspension ends; a ban and an IRLY Girl withdrawal do not).
create or replace function private.flag_identity(uid uuid, p_flag text, p_until timestamptz) returns void
language sql security definer set search_path = public as $$
  insert into private.flagged_identities (hash, hash_kind, flag, source_user, until)
  select h.hash, h.hash_kind, p_flag, uid, p_until from private.identity_hashes(uid) h
  on conflict (hash, hash_kind, flag, source_user) do update set lifted_at = null, until = excluded.until
$$;
revoke all on function private.flag_identity(uuid, text, timestamptz) from public, anon, authenticated;

create or replace function private.flag_identity(uid uuid, p_flag text) returns void
language sql security definer set search_path = public as $$
  select private.flag_identity(uid, p_flag, null::timestamptz)
$$;
revoke all on function private.flag_identity(uuid, text) from public, anon, authenticated;

-- Last defined in 20261102000000: a flag past its end no longer counts.
create or replace function private.identity_flagged(uid uuid, p_flag text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from private.identity_hashes(uid) h
    join private.flagged_identities f on f.hash = h.hash and f.flag = p_flag and f.lifted_at is null
      and (f.until is null or f.until > now())
    where f.source_user <> uid
  )
$$;
revoke all on function private.identity_flagged(uuid, text) from public, anon, authenticated;

-- Everything the account's identity must carry right now, for its current
-- e-mail and phone (older ones keep their rows: same source_user). Bans and
-- IRLY Girl withdrawals are only ever added here (their own triggers lift
-- them); a suspension follows its sanctions (active, until when).
create or replace function private.refresh_identity_flags(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  susp boolean;
  susp_until timestamptz;
begin
  if exists (select 1 from public.sanctions s where s.user_id = uid and s.kind = 'ban' and s.lifted_at is null) then
    perform private.flag_identity(uid, 'ban');
  end if;
  select count(*) > 0, case when bool_or(s.ends_at is null) then null else max(s.ends_at) end
    into susp, susp_until
  from public.sanctions s
  where s.user_id = uid and s.kind = 'suspension' and s.lifted_at is null and (s.ends_at is null or s.ends_at > now());
  if susp then
    perform private.flag_identity(uid, 'suspension', susp_until);
  else
    perform private.unflag_identity(uid, 'suspension');
  end if;
  if exists (select 1 from public.girl_suspensions g where g.user_id = uid) then
    perform private.flag_identity(uid, 'girl');
  end if;
end $$;
revoke all on function private.refresh_identity_flags(uuid) from public, anon, authenticated;

-- Last defined in 20261102000000: bans as before; suspensions too now.
create or replace function private.sanction_identity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'ban' then
    if new.lifted_at is null then
      perform private.flag_identity(new.user_id, 'ban');
    elsif not exists (select 1 from public.sanctions s where s.user_id = new.user_id and s.kind = 'ban' and s.lifted_at is null) then
      perform private.unflag_identity(new.user_id, 'ban');
    end if;
  elsif new.kind = 'suspension' then
    perform private.refresh_identity_flags(new.user_id);
  end if;
  return new;
end $$;
revoke all on function private.sanction_identity() from public, anon, authenticated;
drop trigger if exists sanctions_identity on public.sanctions;
create trigger sanctions_identity after insert or update of lifted_at, ends_at on public.sanctions
for each row execute function private.sanction_identity();

-- Suspensions already in place: flagged now (bans and IRLY Girl were done in 20261102000000).
do $$
declare r record;
begin
  for r in select distinct user_id from public.sanctions
           where kind = 'suspension' and lifted_at is null and (ends_at is null or ends_at > now()) loop
    perform private.refresh_identity_flags(r.user_id);
  end loop;
end $$;

-- Signing up again (last defined in 20261102000000): a banned identity, or
-- one still under a suspension, gets no profile.
create or replace function private.profile_identity_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if private.identity_flagged(new.id, 'ban') or private.identity_flagged(new.id, 'suspension') then
    raise exception 'your account is suspended' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.profile_identity_guard() from public, anon, authenticated;

-- ───────── 2. The sign-in account changes or goes ─────────

-- A new e-mail or phone: the flags follow it (auth-02).
create or replace function private.auth_user_identity_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.refresh_identity_flags(new.id);
  return new;
end $$;
revoke all on function private.auth_user_identity_changed() from public, anon, authenticated;
drop trigger if exists irly_identity_changed on auth.users;
create trigger irly_identity_changed after update on auth.users
for each row
when ((to_jsonb(new) ->> 'email') is distinct from (to_jsonb(old) ->> 'email')
   or (to_jsonb(new) ->> 'phone') is distinct from (to_jsonb(old) ->> 'phone'))
execute function private.auth_user_identity_changed();

-- The account is deleted (delete_my_account, admin_delete_account, the
-- Supabase dashboard): its current identity is flagged as it stands
-- (auth-02, auth-08), its support requests lose the address and the text
-- (auth-05), and its Sign in with Apple token waits to be revoked (IOS-01).
-- Runs before the row goes, while the e-mail and the sanctions are readable.
create table if not exists private.apple_tokens (
  user_id uuid primary key,
  refresh_token text not null check (char_length(refresh_token) between 10 and 4000),
  saved_at timestamptz not null default now()
);
revoke all on private.apple_tokens from public, anon, authenticated;

create table if not exists private.apple_revoke_queue (
  id bigserial primary key,
  refresh_token text not null,
  queued_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text
);
revoke all on private.apple_revoke_queue from public, anon, authenticated;
revoke all on sequence private.apple_revoke_queue_id_seq from public, anon, authenticated;

create or replace function private.auth_user_leaving() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  em text := lower(btrim(to_jsonb(old) ->> 'email'));
begin
  perform private.refresh_identity_flags(old.id);
  update public.support_requests r
     set contact = null, body = '[removed: the member deleted the account]'
   where (r.user_id = old.id or (em is not null and em <> '' and lower(btrim(r.contact)) = em))
     and (r.contact is not null or r.body <> '[removed: the member deleted the account]');
  insert into private.apple_revoke_queue (refresh_token)
    select t.refresh_token from private.apple_tokens t where t.user_id = old.id;
  delete from private.apple_tokens where user_id = old.id;
  return old;
end $$;
revoke all on function private.auth_user_leaving() from public, anon, authenticated;
drop trigger if exists irly_user_leaving on auth.users;
create trigger irly_user_leaving before delete on auth.users
for each row execute function private.auth_user_leaving();

-- ───────── 3. Lifting a flag after the account is gone (auth-03, auth-04) ─────────

-- Admins: an appeal from someone whose banned / suspended account was
-- deleted. Every flag of the deleted account(s) matching the e-mail or the
-- phone is lifted (all of their hashes, so the other one works too).
create or replace function public.identity_lift(p_email text, p_phone text, p_flag text, p_reason text) returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  why text;
  n integer;
begin
  perform private.need_admin();
  why := private.need_reason(p_reason);
  if p_flag is null or p_flag not in ('ban', 'suspension', 'girl') then
    raise exception 'unknown flag' using errcode = '22023';
  end if;
  if not exists (select 1 from private.identity_hashes_of(p_email, p_phone)) then
    raise exception 'give an e-mail address or a phone number' using errcode = '22023';
  end if;
  update private.flagged_identities f set lifted_at = now()
  where f.flag = p_flag and f.lifted_at is null
    and f.source_user in (
      select g.source_user from private.flagged_identities g
      join private.identity_hashes_of(p_email, p_phone) h on h.hash = g.hash
      where g.flag = p_flag and g.lifted_at is null)
    and not exists (select 1 from auth.users u where u.id = f.source_user);
  get diagnostics n = row_count;
  -- The journal keeps how many, never the address or the number.
  perform private.journal('identity.lifted', null, null, 'identity', null, why, jsonb_build_object('flag', p_flag, 'rows', n));
  return n;
end $$;
revoke all on function public.identity_lift(text, text, text, text) from public, anon;
grant execute on function public.identity_lift(text, text, text, text) to authenticated;

-- Last defined in 20261102000000: also lifts the IRLY Girl flags left by a
-- deleted account of the same person, so the reinstatement holds after
-- another deletion and signup.
create or replace function public.girl_reinstate(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.girl_suspensions where user_id = p_user;
  perform private.unflag_identity(p_user, 'girl');
  update private.flagged_identities f set lifted_at = now()
  where f.flag = 'girl' and f.lifted_at is null
    and f.source_user in (
      select g.source_user from private.flagged_identities g
      join private.identity_hashes(p_user) h on h.hash = g.hash
      where g.flag = 'girl' and g.lifted_at is null);
end $$;
revoke all on function public.girl_reinstate(uuid) from public, anon;
grant execute on function public.girl_reinstate(uuid) to authenticated;

-- ───────── 4. First names (auth-06) ─────────

-- Visible text, no control, bidi or zero-width characters (ZWJ / ZWNJ stay:
-- Persian and Indic scripts need them).
create or replace function private.first_name_ok(n text) returns boolean
language sql immutable as $$
  select n !~ '[\x01-\x1f\x7f-\x9f­؜᠎​‎‏‪-‮⁠-⁤⁦-⁩﻿]'
     and regexp_replace(n, '[[:space:]   -‍  　︀-️]', '', 'g') <> ''
$$;

-- Names that read as the IRLY team ('IRLY member', the app's default, is fine).
create or replace function private.first_name_reserved(n text) returns boolean
language sql immutable as $$
  select regexp_replace(lower(coalesce(n, '')), '[^[:alnum:]]', '', 'g')
    ~ '^(irly(team|staff|support|admin|administrator|moderator|moderation|mod|official|safety|security|help|app)?|(team|staff|support)irly|admin|administrator|moderator|moderation|support|staff|system)$'
$$;

create or replace function private.first_name_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.first_name is null or (tg_op = 'UPDATE' and new.first_name is not distinct from old.first_name) then
    return new;
  end if;
  new.first_name := btrim(new.first_name);
  if not private.first_name_ok(new.first_name) then
    raise exception 'choose another first name' using errcode = '23514';
  end if;
  if auth.uid() is not null and private.staff_role(auth.uid()) is null and private.first_name_reserved(new.first_name) then
    raise exception 'choose another first name' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.first_name_guard() from public, anon, authenticated;
drop trigger if exists profiles_first_name_guard on public.profiles;
create trigger profiles_first_name_guard before insert or update of first_name on public.profiles
for each row execute function private.first_name_guard();

-- ───────── 5. Selfie verification: only the current gesture (auth-09) ─────────

-- Last defined in 20261018000400: the request must be the member's newest
-- one and less than 30 minutes old (start_verification hands out the same
-- one for 30 minutes, then a new gesture).
create or replace function public.submit_verification(p_request uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_path is null or p_path not like me::text || '/%' then raise exception 'invalid file' using errcode = '22023'; end if;
  update public.verification_requests v set selfie_path = p_path, status = 'pending', submitted_at = now(),
    photos = (select array(select x from unnest(p.photo_paths) x where x not like 'irly-avatar:%') from public.profiles p where p.id = me)
  where v.id = p_request and v.user_id = me and v.status = 'started'
    and v.created_at > now() - interval '30 minutes'
    and not exists (select 1 from public.verification_requests n
                    where n.user_id = me and n.id <> v.id and n.created_at > v.created_at);
  if not found then raise exception 'start again: this request is no longer open' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.submit_verification(uuid, text) from public, anon;
grant execute on function public.submit_verification(uuid, text) to authenticated;

-- ───────── 6. Sign in with Apple: tokens revoked when the account goes (IOS-01) ─────────
-- Apple asks apps to revoke a member's Sign in with Apple tokens when the
-- account is deleted. The Edge Function apple-revoke (the only caller of
-- these, with the service role, from its own environment) exchanges the
-- authorization code of a native Apple sign-in for a refresh token
-- (apple_token_save), and revokes it at appleid.apple.com when the member
-- deletes the account (apple_token_queue, then the queue). A token still
-- stored when the sign-in account is deleted is queued by
-- auth_user_leaving (section 2) and revoked by the next call of the function.

create or replace function public.apple_token_save(p_user uuid, p_token text) returns void
language sql security definer set search_path = public as $$
  insert into private.apple_tokens (user_id, refresh_token)
  select p_user, p_token where exists (select 1 from auth.users u where u.id = p_user)
  on conflict (user_id) do update set refresh_token = excluded.refresh_token, saved_at = now()
$$;

-- The member is leaving: the token goes on the revoke queue.
create or replace function public.apple_token_queue(p_user uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into private.apple_revoke_queue (refresh_token)
    select t.refresh_token from private.apple_tokens t where t.user_id = p_user;
  get diagnostics n = row_count;
  delete from private.apple_tokens where user_id = p_user;
  return n;
end $$;

-- Up to p_limit tokens to revoke (10 attempts each at most, oldest first).
create or replace function public.apple_revoke_take(p_limit integer) returns table (id bigint, refresh_token text)
language sql security definer set search_path = public as $$
  update private.apple_revoke_queue q set attempts = q.attempts + 1
  where q.id in (select x.id from private.apple_revoke_queue x where x.attempts < 10
                 order by x.queued_at limit greatest(1, least(coalesce(p_limit, 5), 20))
                 for update skip locked)
  returning q.id, q.refresh_token
$$;

-- Revoked: forgotten. Not revoked: the reason is kept for the next try.
create or replace function public.apple_revoke_done(p_id bigint, p_ok boolean, p_error text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_ok then
    delete from private.apple_revoke_queue where id = p_id;
  else
    update private.apple_revoke_queue set last_error = left(p_error, 300) where id = p_id;
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array['apple_token_save(uuid, text)', 'apple_token_queue(uuid)', 'apple_revoke_take(integer)', 'apple_revoke_done(bigint, boolean, text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
