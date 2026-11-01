-- IRLY security hardening (audit of 2026-11-01). Additive: functions are
-- replaced with the same signatures, new helpers, triggers, policies,
-- indexes and two private tables. No data is deleted; RLS stays on everywhere.
--
-- ───────── For the app (what changed in the API) ─────────
--
--  * public.my_girl_status() returns text, now one of:
--      'open'               IRLY Girl / IRLY Maman are open for this account
--      'suspended'          access withdrawn by moderation (girl_suspend),
--                           including a suspension carried over from a
--                           deleted account of the same person (section 2)
--      'needs_verification' a woman's account whose identity was never
--                           verified by IRLY: show « verify your profile to
--                           enter » and lead to the selfie verification
--                           (my_verification / start_verification)
--      'not_eligible'       anything else (not a woman's account, closed)
--    Older apps map the new value to not_eligible (src/features/girl/access.tsx).
--  * New explicit like / save setters (idempotent, safe to retry; the
--    toggles stay for installed apps):
--      public.set_like(p_type text, p_id text, p_liked boolean) returns boolean
--      public.set_save(p_type text, p_id text, p_saved boolean) returns boolean
--    Same targets and rules as toggle_like / toggle_save; they return the
--    state after the call (true = liked / saved).
--  * Realtime "typing…" broadcast now goes through a PRIVATE channel: topic
--    `typing:<conversation_id>`, created with { config: { private: true } };
--    only members of the conversation (with IRLY Girl access for a girl
--    chat) may receive or send on it (policies on realtime.messages).
--  * A signup whose e-mail (or phone) belonged to a banned account is
--    refused when the profile is created: 'your account is suspended'
--    (42501, already translated).
--  * Rate limits (all refusals reuse messages the app already translates):
--      join_waitlist   anon + signed in: 120 new addresses / 10 min for
--                      everyone (unchanged); 3 / hour per mailbox (lowercase,
--                      +tag removed, dots removed for Gmail); 20 / 10 min per
--                      e-mail domain (60 for large public providers);
--                      signed in: 5 calls / hour per account.
--                      → 'slow down: try again in a few minutes'
--      contact_support 3 / hour per address, 60 / 10 min for everyone
--                      (unchanged); signed in: 5 / hour per account.
--                      → 'slow down: try again later'
--      support_requests (app form, direct insert): 10 / hour per account.
--                      → 'slow down: try again later'
--      analytics       visitors 300 / min in all, members 60 / min
--                      (unchanged); signed-in callers sending events without
--                      user_id now count against their own 60 / min too
--                      (extra events are dropped silently, as before).
--  * profiles_public, profile_faces, public_profile and the first profile
--    photo in storage now follow the member's profile visibility (section 3).
--  * pro_genders_of answers only for connected professionals (section 4).
--  * community_members rows are readable by the members of that community,
--    by the member herself, and by IRLY staff (section 5). Counts stay in
--    communities.members_count and the existing RPCs.
--
-- ───────── What was found and closed ─────────
--  1. IRLY Girl / IRLY Maman were gated on the gender declared at signup
--     only. Now the identity must also have been verified by a person at
--     IRLY (selfie review, decide_verification).
--  2. A banned or girl-suspended member could delete the account and sign up
--     again with the same address. Hashes of the identity are kept (never the
--     address itself) and checked when a profile is created.
--  3. Any signed-in member could read the name and face of any member by id,
--     whatever her visibility setting.
--  4. pro_genders_of told anyone which visible professionals are women.
--  5. Every signed-in member could list the members of every community.
--  6. API roles kept TRUNCATE / REFERENCES / TRIGGER on public tables.
--  7. Foreign keys without an index (slow deletes and joins).
--  8. Rate limits were global only (one sender could exhaust them for all).
--  9. Like / save only had toggles: a retried request undid itself.
-- 10. The typing indicator used a public broadcast channel: anyone who knew
--     a conversation id could listen or inject "typing…".
-- Tests: supabase/tests/security_hardening.test.sql.

-- ───────── 1. IRLY Girl needs an identity verified by IRLY ─────────

-- Verified once by a person at IRLY: the badge (profiles.verified_at, set
-- only by decide_verification, guarded by profiles_verification_guard), or
-- an approved selfie review. The badge alone is not enough as a test: it
-- drops when a photo nobody reviewed is added (a Match rule about photos),
-- while the review of who the person is still holds.
create or replace function private.identity_verified(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.verified_at is not null)
      or exists (select 1 from public.verification_requests v where v.user_id = uid and v.status = 'approved')
$$;
revoke all on function private.identity_verified(uuid) from public, anon, authenticated;

-- The single rule of IRLY Girl (last defined in 20261009002000_irly_girl_world):
-- a woman's account, not deleted, not suspended, and now verified by IRLY.
create or replace function private.girl_eligible_unchecked(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.gender = 'woman' and p.deleted_at is null
      and not exists (select 1 from public.girl_suspensions s where s.user_id = uid)
      and private.identity_verified(uid)
  )
$$;

-- Same answers as before, plus 'needs_verification' (see the header).
create or replace function public.my_girl_status() returns text
language sql stable security definer set search_path = public as $$
  select case
    when private.girl_eligible_unchecked(auth.uid()) then 'open'
    when exists (select 1 from public.girl_suspensions where user_id = auth.uid()) then 'suspended'
    when exists (select 1 from public.profiles p where p.id = auth.uid() and p.gender = 'woman' and p.deleted_at is null)
      then 'needs_verification'
    else 'not_eligible'
  end
$$;
revoke all on function public.my_girl_status() from public, anon;
grant execute on function public.my_girl_status() to authenticated;

-- ───────── 2. A ban or an IRLY Girl suspension outlives the account ─────────

-- Hashes only (sha256, hex): of lower(e-mail), of the same address
-- normalised (+tag removed, dots removed for Gmail), and of the phone's
-- digits. The address itself is never stored. No foreign key: the rows stay
-- when the account is deleted, which is their purpose.
create table if not exists private.flagged_identities (
  id bigserial primary key,
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  hash_kind text not null check (hash_kind in ('email', 'email_norm', 'phone')),
  flag text not null check (flag in ('ban', 'girl')),
  source_user uuid not null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  unique (hash, hash_kind, flag, source_user)
);
create index if not exists flagged_identities_active_idx on private.flagged_identities (hash, flag) where lifted_at is null;
create index if not exists flagged_identities_user_idx on private.flagged_identities (source_user, flag);
revoke all on private.flagged_identities from public, anon, authenticated;
revoke all on sequence private.flagged_identities_id_seq from public, anon, authenticated;

create or replace function private.sha256_hex(t text) returns text
language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(t, 'UTF8')), 'hex')
$$;
revoke all on function private.sha256_hex(text) from public, anon, authenticated;

-- The hashes of an account's identity, from auth.users (the e-mail and
-- phone columns are read through to_jsonb: they may not exist locally).
create or replace function private.identity_hashes(uid uuid)
returns table (hash text, hash_kind text)
language plpgsql stable security definer set search_path = public as $$
declare
  em text;
  ph text;
  loc text;
  dom text;
begin
  select lower(btrim(to_jsonb(u) ->> 'email')), regexp_replace(coalesce(to_jsonb(u) ->> 'phone', ''), '\D', '', 'g')
    into em, ph
  from auth.users u where u.id = uid;
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
  if char_length(coalesce(ph, '')) >= 6 then
    hash := private.sha256_hex(ph); hash_kind := 'phone'; return next;
  end if;
end $$;
revoke all on function private.identity_hashes(uuid) from public, anon, authenticated;

create or replace function private.flag_identity(uid uuid, p_flag text) returns void
language sql security definer set search_path = public as $$
  insert into private.flagged_identities (hash, hash_kind, flag, source_user)
  select h.hash, h.hash_kind, p_flag, uid from private.identity_hashes(uid) h
  on conflict (hash, hash_kind, flag, source_user) do update set lifted_at = null
$$;
revoke all on function private.flag_identity(uuid, text) from public, anon, authenticated;

create or replace function private.unflag_identity(uid uuid, p_flag text) returns void
language sql security definer set search_path = public as $$
  update private.flagged_identities set lifted_at = now()
  where source_user = uid and flag = p_flag and lifted_at is null
$$;
revoke all on function private.unflag_identity(uuid, text) from public, anon, authenticated;

-- True when this account's identity carries an active flag left by another
-- account (a deleted one, usually).
create or replace function private.identity_flagged(uid uuid, p_flag text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from private.identity_hashes(uid) h
    join private.flagged_identities f on f.hash = h.hash and f.flag = p_flag and f.lifted_at is null
    where f.source_user <> uid
  )
$$;
revoke all on function private.identity_flagged(uuid, text) from public, anon, authenticated;

-- A ban is written, however it is written (mod_sanction, the admin console):
-- the identity is flagged. Lifting the last active ban lifts the flag.
create or replace function private.sanction_identity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind <> 'ban' then return new; end if;
  if new.lifted_at is null then
    perform private.flag_identity(new.user_id, 'ban');
  elsif not exists (select 1 from public.sanctions s where s.user_id = new.user_id and s.kind = 'ban' and s.lifted_at is null) then
    perform private.unflag_identity(new.user_id, 'ban');
  end if;
  return new;
end $$;
revoke all on function private.sanction_identity() from public, anon, authenticated;
drop trigger if exists sanctions_identity on public.sanctions;
create trigger sanctions_identity after insert or update of lifted_at on public.sanctions
for each row execute function private.sanction_identity();

-- An IRLY Girl suspension (girl_suspend, or any insert) flags the identity too.
create or replace function private.girl_suspension_identity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.flag_identity(new.user_id, 'girl');
  return new;
end $$;
revoke all on function private.girl_suspension_identity() from public, anon, authenticated;
drop trigger if exists girl_suspensions_identity on public.girl_suspensions;
create trigger girl_suspensions_identity after insert or update on public.girl_suspensions
for each row execute function private.girl_suspension_identity();

-- Reinstating (last defined in 20261009002000_irly_girl_world) also lifts the
-- flag. (A suspension removed because the account is deleted keeps it.)
create or replace function public.girl_reinstate(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.girl_suspensions where user_id = p_user;
  perform private.unflag_identity(p_user, 'girl');
end $$;
revoke all on function public.girl_reinstate(uuid) from public, anon;
grant execute on function public.girl_reinstate(uuid) to authenticated;

-- Bans and suspensions already in place: flagged now.
do $$
declare r record;
begin
  for r in select distinct user_id from public.sanctions where kind = 'ban' and lifted_at is null loop
    perform private.flag_identity(r.user_id, 'ban');
  end loop;
  for r in select user_id from public.girl_suspensions loop
    perform private.flag_identity(r.user_id, 'girl');
  end loop;
end $$;

-- Signing up again: a banned identity gets no profile.
create or replace function private.profile_identity_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if private.identity_flagged(new.id, 'ban') then
    raise exception 'your account is suspended' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.profile_identity_guard() from public, anon, authenticated;
drop trigger if exists profiles_identity_guard on public.profiles;
create trigger profiles_identity_guard before insert on public.profiles
for each row execute function private.profile_identity_guard();

-- …and an identity whose IRLY Girl access was withdrawn starts suspended
-- (the same withdrawal the old account had: my_girl_status says 'suspended').
create or replace function private.profile_identity_carry() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if private.identity_flagged(new.id, 'girl') then
    insert into public.girl_suspensions (user_id, reason, created_by)
    values (new.id, 'IRLY Girl access withdrawn from a previous account', null)
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function private.profile_identity_carry() from public, anon, authenticated;
drop trigger if exists profiles_identity_carry on public.profiles;
create trigger profiles_identity_carry after insert on public.profiles
for each row execute function private.profile_identity_carry();

-- ───────── 3. Names and faces follow the profile visibility ─────────

-- May `viewer` see the name and first photo of `target`? Yourself; nobody
-- blocked either way; otherwise the member's visibility (visible_to, as
-- search_people / discoverable use it), or something the two already share:
-- a friendship (or her friend request to the viewer), her following the
-- viewer, a direct or Match chat, a chat she wrote in, a community, an
-- activity (host or participant). IRLY staff see everyone (moderation).
-- The order matters (CASE): the common case answers on the first lookups.
create or replace function private.profile_visible_unchecked(viewer uuid, target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when viewer is null or target is null then false
    when viewer = target then true
    when private.blocked_unchecked(viewer, target) then false
    when private.visible_to(viewer, target, (select s.profile_visibility from public.safety_settings s where s.user_id = target)) then true
    when exists (select 1 from public.friendships f
                 where f.user_a = least(viewer, target) and f.user_b = greatest(viewer, target)
                   and (f.status = 'accepted' or f.requested_by = target)) then true
    when exists (select 1 from public.follows f where f.follower_id = target and f.followee_id = viewer) then true
    when exists (select 1 from public.conversation_members x
                 join public.conversation_members y on y.conversation_id = x.conversation_id and y.user_id = target
                 join public.conversations c on c.id = x.conversation_id
                 where x.user_id = viewer
                   and (c.kind in ('direct', 'match') or exists (
                     select 1 from public.messages m where m.conversation_id = c.id and m.sender_id = target and m.deleted_at is null))) then true
    when exists (select 1 from public.community_members a
                 join public.community_members b on b.community_id = a.community_id and b.user_id = target
                 where a.user_id = viewer) then true
    when exists (select 1 from public.activity_participants a
                 join public.activities act on act.id = a.activity_id
                 where (a.user_id = viewer and (act.creator_id = target or exists (
                          select 1 from public.activity_participants b where b.activity_id = a.activity_id and b.user_id = target)))
                    or (a.user_id = target and act.creator_id = viewer)) then true
    else private.is_moderator(viewer)
  end
$$;
revoke all on function private.profile_visible_unchecked(uuid, uuid) from public, anon, authenticated;

-- The same, always about the caller (policies and the profiles_public view).
create or replace function private.profile_visible(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.profile_visible_unchecked(auth.uid(), uid)
$$;
revoke all on function private.profile_visible(uuid) from public, anon;
grant execute on function private.profile_visible(uuid) to authenticated;

-- profiles_public (last defined in 20261005001600_irly_bug_hunt_3): same
-- columns, read-only as before (its privileges and trigger stay), one more
-- condition.
create or replace view public.profiles_public with (security_barrier = true) as
  select id, first_name, case when id = auth.uid() or private.precision_of(id) <> 'hidden' then city_id end as city_id
  from public.profiles
  where deleted_at is null and not private.blocked_unchecked(auth.uid(), id) and private.profile_visible(id);

-- profile_faces (last defined in 20261017000000_irly_profile_faces): a face
-- the caller may not see is simply not returned (the app shows initials).
create or replace function public.profile_faces(p_ids uuid[])
returns table (id uuid, photo_path text)
language sql stable security definer set search_path = public as $$
  select p.id, p.photo_paths[1]
  from public.profiles p
  where auth.uid() is not null
    and p.id = any (p_ids[1:200])
    and p.deleted_at is null
    and not private.blocked_unchecked(auth.uid(), p.id)
    and private.profile_visible_unchecked(auth.uid(), p.id)
$$;
revoke all on function public.profile_faces(uuid[]) from public, anon;
grant execute on function public.profile_faces(uuid[]) to authenticated;

-- public_profile (last defined in 20261024009800_irly_social_counts): a
-- profile the caller may not see at all reads as not found (no row), as a
-- blocked one did. Otherwise unchanged: `visible` still decides the bio,
-- city, interests and languages.
create or replace function public.public_profile(p_user uuid)
returns table (id uuid, first_name text, photo_path text, bio text, city_id text, interests text[], languages text[], visible boolean,
  followers integer, following integer, i_follow boolean, follows_me boolean, can_message boolean, direct_id uuid, is_me boolean,
  friend_status text, username text, friends integer)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  vis boolean;
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_user and p.deleted_at is null)
     or (p_user <> me and private.blocked_unchecked(me, p_user))
     or not private.profile_visible_unchecked(me, p_user) then
    return;
  end if;
  vis := p_user = me or private.visible_to(me, p_user, (select s.profile_visibility from public.safety_settings s where s.user_id = p_user));
  return query
  select p.id, p.first_name, p.photo_paths[1],
    case when vis then p.bio end,
    case when vis then p.city_id end,
    case when vis then p.interests else '{}'::text[] end,
    case when vis then p.languages else '{}'::text[] end,
    vis,
    -- The same people as follow_list: a closed account, or one blocked with
    -- the viewer, is in no list, so it is in no count either.
    (select count(*)::int from public.follows f
      join public.profiles o on o.id = f.follower_id and o.deleted_at is null
      where f.followee_id = p.id and (o.id = me or not private.blocked_unchecked(me, o.id))),
    (select count(*)::int from public.follows f
      join public.profiles o on o.id = f.followee_id and o.deleted_at is null
      where f.follower_id = p.id and (o.id = me or not private.blocked_unchecked(me, o.id))),
    exists (select 1 from public.follows f where f.follower_id = me and f.followee_id = p.id),
    exists (select 1 from public.follows f where f.follower_id = p.id and f.followee_id = me),
    p.id <> me and (private.may_message(p.id) or exists (
      select 1 from public.conversations c
      where c.kind = 'direct'
        and exists (select 1 from public.conversation_members a where a.conversation_id = c.id and a.user_id = me)
        and exists (select 1 from public.conversation_members b where b.conversation_id = c.id and b.user_id = p.id))),
    (select c.id from public.conversations c
      where c.kind = 'direct'
        and exists (select 1 from public.conversation_members a where a.conversation_id = c.id and a.user_id = me)
        and exists (select 1 from public.conversation_members b where b.conversation_id = c.id and b.user_id = p.id)
      limit 1),
    p.id = me,
    case when p.id = me then 'none' else private.friend_status(me, p.id) end,
    p.username,
    (select count(*)::int from public.friendships f
      join public.profiles o on o.id = case when f.user_a = p.id then f.user_b else f.user_a end and o.deleted_at is null
      where f.status = 'accepted' and p.id in (f.user_a, f.user_b) and (o.id = me or not private.blocked_unchecked(me, o.id)))
  from public.profiles p where p.id = p_user;
end $$;
revoke all on function public.public_profile(uuid) from public, anon;
grant execute on function public.public_profile(uuid) to authenticated;

-- Storage (last defined in 20261020001000_irly_security_audit): the first
-- photo (and its small copy) only for whoever may see the face; the other
-- photos keep their rule (full profile visibility, or a chat she wrote in).
create or replace function private.can_read_profile_photo(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  owner uuid := private.uuid_or_null(split_part(coalesce(p_name, ''), '/', 1));
  p public.profiles;
begin
  if me is null or p_name is null then return false; end if;
  if owner = me or private.is_admin(me) then return true; end if;
  -- Files outside a member's folder (none are written by the app): as before.
  if owner is null then return true; end if;
  if private.blocked_unchecked(me, owner) then return false; end if;
  select * into p from public.profiles where id = owner and deleted_at is null;
  if not found or cardinality(p.photo_paths) = 0 then return false; end if;
  -- The face shown next to the name everywhere (lists, chats, comments).
  if p_name in (p.photo_paths[1], private.photo_thumb(p.photo_paths[1])) then
    return private.profile_visible_unchecked(me, owner);
  end if;
  -- The rest of the profile's photos: for whoever may see the profile.
  if exists (select 1 from unnest(p.photo_paths) x where p_name in (x, private.photo_thumb(x))) then
    return private.visible_to(me, owner, (select s.profile_visibility from public.safety_settings s where s.user_id = owner))
      or private.shares_private_chat(me, owner);
  end if;
  return false;
end $$;
revoke all on function private.can_read_profile_photo(text) from public, anon;
grant execute on function private.can_read_profile_photo(text) to authenticated;

-- ───────── 4. pro_genders_of: only for connected professionals ─────────
-- (Last defined in 20261029500000_irly_network_gender.) Yours; or a visible
-- professional profile you may see (not blocked, profile visibility) of
-- someone you are connected with (accepted, or her request to you) or share
-- a private chat with. Anyone else: no row, and the app writes the
-- inclusive form (« Fondateur·rice »). Same columns and values as before.
create or replace function public.pro_genders_of(p_users uuid[])
returns table (user_id uuid, gender text)
language sql stable security definer set search_path = public as $$
  select p.user_id, pr.gender
  from public.pro_profiles p
  join public.profiles pr on pr.id = p.user_id and pr.deleted_at is null
  where auth.uid() is not null
    and p.user_id = any ((coalesce(p_users, '{}'::uuid[]))[1:200])
    and (p.user_id = auth.uid() or (
      p.visible and not private.blocked_unchecked(auth.uid(), p.user_id) and private.discoverable(p.user_id)
      and (private.connection_state(auth.uid(), p.user_id) in ('connected', 'incoming')
           or private.shares_private_chat(auth.uid(), p.user_id))))
$$;
revoke all on function public.pro_genders_of(uuid[]) from public, anon;
grant execute on function public.pro_genders_of(uuid[]) to authenticated;

-- ───────── 5. Who may list the members of a community ─────────

-- Its members, and IRLY staff (moderation). About the caller only.
create or replace function private.can_list_members(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.community_members m where m.community_id = cid and m.user_id = auth.uid())
    or private.is_moderator(auth.uid()))
$$;
revoke all on function private.can_list_members(uuid) from public, anon;
grant execute on function private.can_list_members(uuid) to authenticated;

-- (Last altered in 20261028400000_irly_perf_final.) Your own rows, or the
-- rows of a community you may list, with the IRLY Girl rule as before.
drop policy if exists community_members_read on public.community_members;
create policy community_members_read on public.community_members for select to authenticated
  using (
    (user_id = (select auth.uid()) or private.can_list_members(community_id))
    and exists (select 1 from public.communities c where c.id = community_id and c.deleted_at is null
                and (not c.girl_only or (select private.is_girl_eligible())))
  );

-- Counts stay public where they were: how many members (joined since
-- p_since, when given) a community has, as the old read rule let anyone
-- count them (not deleted; IRLY Girl access for a girls-only one).
create or replace function private.community_member_count(cid uuid, p_since timestamptz default null) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.community_members m
  where m.community_id = cid and (p_since is null or m.joined_at > p_since)
    and exists (select 1 from public.communities c where c.id = cid and c.deleted_at is null
                and (not c.girl_only or private.girl_eligible_unchecked(auth.uid())))
$$;
revoke all on function private.community_member_count(uuid, timestamptz) from public, anon;
grant execute on function private.community_member_count(uuid, timestamptz) to authenticated;

-- The security invoker functions that counted members through the read
-- rule: the same bodies (community_detail and community_digest last defined
-- in 20261005001200_irly_community_posts, space_community in
-- 20261018000300_irly_spaces, suggest_groups in
-- 20261028100000_irly_official_communities_four), the count through the helper.
create or replace function public.community_detail(p_id uuid)
returns table (id uuid, name text, tagline text, description text, category_id text, city_id text, girl_only boolean, members integer,
  is_member boolean, my_role text, conversation_id uuid, created_at timestamptz)
language sql stable set search_path = public as $$
  select c.id, c.name, c.tagline, c.description, c.category_id, c.city_id, c.girl_only,
    private.community_member_count(c.id),
    private.i_belong(c.id),
    (select m.role from public.community_members m where m.community_id = c.id and m.user_id = auth.uid()),
    (select v.id from public.conversations v where v.community_id = c.id and private.is_member(v.id)),
    c.created_at
  from public.communities c
  where c.id = p_id and c.deleted_at is null
$$;

create or replace function public.space_community(p_topic text, p_city text)
returns table (id uuid, name text, tagline text, girl_only boolean, members integer, is_member boolean, city_id text)
language sql stable set search_path = public as $$
  select c.id, c.name, c.tagline, c.girl_only,
    private.community_member_count(c.id),
    private.i_belong(c.id), c.city_id
  from public.communities c
  where c.official and c.topic = p_topic and c.parent_id is null and c.deleted_at is null
    and c.city_id = any (private.city_scope(p_city))
  order by (c.city_id = p_city) desc
  limit 1
$$;

create or replace function public.community_digest(p_community uuid)
returns table (posts_week integer, new_members_week integer, members integer, upcoming integer, next_title text,
  next_starts_at timestamptz, top_post_id uuid, top_post_body text, top_post_likes integer)
language sql stable set search_path = public as $$
  with top as (
    select p.id, p.body, (select count(*)::int from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text) as n
    from public.community_posts p
    where p.community_id = p_community and p.deleted_at is null and p.created_at > now() - interval '7 days'
    order by 3 desc, p.created_at desc limit 1
  ), nxt as (
    select a.title, a.starts_at from public.activities a
    where a.community_id = p_community and a.cancelled_at is null and a.starts_at > now()
    order by a.starts_at limit 1
  )
  select
    (select count(*)::int from public.community_posts p where p.community_id = p_community and p.deleted_at is null and p.created_at > now() - interval '7 days'),
    private.community_member_count(p_community, now() - interval '7 days'),
    private.community_member_count(p_community),
    (select count(*)::int from public.activities a where a.community_id = p_community and a.cancelled_at is null and a.starts_at > now()),
    (select title from nxt), (select starts_at from nxt),
    (select id from top), (select body from top), (select n from top)
$$;

create or replace function public.suggest_groups(p_city text, p_limit integer default 8)
returns table (id uuid, name text, emoji text, parent_id uuid, parent_name text, members integer, posts_week integer, reason text)
language sql stable set search_path = public as $$
  with me as (
    select coalesce(interests, '{}') || coalesce(activity_prefs, '{}') || coalesce(sports, '{}') as likes
    from public.profiles where id = auth.uid()
  )
  select g.id, g.name, g.emoji, g.parent_id, par.name,
    private.community_member_count(g.id),
    (select count(*)::int from public.community_posts x where x.community_id = g.id and x.deleted_at is null and x.created_at > now() - interval '7 days'),
    case when private.i_belong(g.parent_id) then 'in_your_community' else 'your_interests' end
  from public.communities g
  join public.communities par on par.id = g.parent_id and par.deleted_at is null
  cross join me
  where g.deleted_at is null and g.parent_id is not null
    and g.city_id = any (private.city_scope(p_city))
    and not private.i_belong(g.id)
    and (par.retired_at is null or private.i_belong(g.parent_id))
    and (private.i_belong(g.parent_id) or g.subtopic = any (me.likes) or lower(g.name) = any (me.likes))
  order by private.i_belong(g.parent_id) desc, 7 desc, 6 desc
  limit least(greatest(p_limit, 1), 20)
$$;

-- ───────── 6. API roles: no TRUNCATE, REFERENCES or TRIGGER ─────────
-- RLS does not apply to TRUNCATE; REFERENCES and TRIGGER are never needed by
-- a client. Existing tables now, future tables by default.
do $$
declare t record;
begin
  for t in select c.oid::regclass as tbl from pg_class c
           where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f') loop
    execute format('revoke truncate, references, trigger on %s from public, anon, authenticated', t.tbl);
  end loop;
end $$;
alter default privileges in schema public revoke truncate, references, trigger on tables from public, anon, authenticated;

-- ───────── 7. Foreign keys with an index ─────────
create index if not exists message_reads_user_idx on public.message_reads (user_id);
create index if not exists message_reactions_user_idx on public.message_reactions (user_id);
create index if not exists community_poll_votes_user_idx on public.community_poll_votes (user_id);
create index if not exists shares_user_idx on public.shares (user_id);
create index if not exists shares_conversation_idx on public.shares (conversation_id) where conversation_id is not null;
create index if not exists close_friends_friend_idx on public.close_friends (friend_id);
create index if not exists people_match_skips_other_idx on public.people_match_skips (other_id);
create index if not exists comments_parent_idx on public.comments (parent_id) where parent_id is not null;
create index if not exists irl_posts_community_idx on public.irl_posts (community_id) where community_id is not null;
create index if not exists community_notification_prefs_community_idx on public.community_notification_prefs (community_id);
-- Used by the rate limits below.
create index if not exists waitlist_created_idx on public.waitlist (created_at);
create index if not exists support_requests_user_recent_idx on public.support_requests (user_id, created_at) where user_id is not null;

-- ───────── 8. Rate limits per sender ─────────

-- Counted hits per (bucket, key) for limits that have no table of their own
-- to count (a signed-in caller's calls). Old hits are removed as they go.
create table if not exists private.rate_hits (
  bucket text not null,
  key text not null,
  at timestamptz not null default now()
);
create index if not exists rate_hits_key_idx on private.rate_hits (bucket, key, at);
revoke all on private.rate_hits from public, anon, authenticated;

-- True (and counted) when under p_max hits in p_window; false otherwise.
create or replace function private.rate_take(p_bucket text, p_key text, p_window interval, p_max integer) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from private.rate_hits where bucket = p_bucket and key = p_key and at <= now() - p_window;
  if (select count(*) from private.rate_hits where bucket = p_bucket and key = p_key) >= p_max then
    return false;
  end if;
  insert into private.rate_hits (bucket, key) values (p_bucket, p_key);
  return true;
end $$;
revoke all on function private.rate_take(text, text, interval, integer) from public, anon, authenticated;

-- The mailbox an address delivers to: lowercase, +tag removed, dots removed for Gmail.
create or replace function private.mailbox_of(e text) returns text
language sql immutable set search_path = public as $$
  select case when split_part(lower(e), '@', 2) in ('gmail.com', 'googlemail.com')
    then replace(split_part(split_part(lower(e), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else split_part(split_part(lower(e), '@', 1), '+', 1) || '@' || split_part(lower(e), '@', 2)
  end
$$;
revoke all on function private.mailbox_of(text) from public, anon, authenticated;

-- join_waitlist (last defined in 20261007003100_irly_waitlist): the global
-- cap stays; per mailbox, per domain and per account limits are added.
create or replace function public.join_waitlist(p_email text, p_lang text default 'en', p_source text default null)
returns text
language plpgsql security definer set search_path = public, private as $$
declare
  e text := lower(btrim(coalesce(p_email, '')));
  dom text;
  box text;
begin
  if char_length(e) > 254 or e !~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  dom := split_part(e, '@', 2);
  box := private.mailbox_of(e);
  -- No flooding: at most 120 new addresses in 10 minutes for everyone…
  if (select count(*) from public.waitlist where created_at > now() - interval '10 minutes') >= 120
     -- …3 an hour for one mailbox (a+1@, a+2@, a.b@gmail…)…
     or (select count(*) from public.waitlist w where w.created_at > now() - interval '1 hour'
           and split_part(w.email, '@', 2) in (dom, case when dom = 'gmail.com' then 'googlemail.com' when dom = 'googlemail.com' then 'gmail.com' end)
           and private.mailbox_of(w.email) = box) >= 3
     -- …20 in 10 minutes for one domain (60 for the large public providers)…
     or (select count(*) from public.waitlist w where w.created_at > now() - interval '10 minutes'
           and split_part(w.email, '@', 2) = dom)
        >= (case when dom in ('gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.fr', 'live.com', 'live.fr',
                             'yahoo.com', 'yahoo.fr', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'orange.fr', 'free.fr')
                then 60 else 20 end)
     -- …and 5 calls an hour for one signed-in account.
     or (auth.uid() is not null and not private.rate_take('join_waitlist', auth.uid()::text, interval '1 hour', 5)) then
    raise exception 'slow down: try again in a few minutes' using errcode = '54000';
  end if;
  insert into public.waitlist (email, lang, source)
  values (e, case when p_lang in ('en', 'fr', 'ar') then p_lang else 'en' end, left(p_source, 40))
  on conflict (email) do nothing;
  return 'ok';
end $$;
revoke all on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;

-- contact_support (last defined in 20261014000000_irly_web_support): the
-- per-address and global caps stay; a signed-in caller also gets 5 an hour.
create or replace function public.contact_support(
  p_email text, p_subject text, p_message text, p_lang text default 'en', p_website text default null)
returns text
language plpgsql security definer set search_path = public, private as $$
declare
  e text := lower(btrim(coalesce(p_email, '')));
  m text := btrim(coalesce(p_message, ''));
  k text;
begin
  -- A bot fills every field; people never see this one. Same answer, nothing stored.
  if coalesce(btrim(p_website), '') <> '' then
    return 'ok';
  end if;
  if char_length(e) > 200 or e !~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  k := case p_subject
    when 'account' then 'question'
    when 'login' then 'problem'
    when 'bug' then 'problem'
    when 'safety' then 'safety'
    when 'privacy' then 'privacy'
    when 'delete' then 'privacy'
    when 'other' then 'question'
  end;
  if k is null then
    raise exception 'invalid subject' using errcode = '22023';
  end if;
  if char_length(m) < 10 or char_length(m) > 2000 then
    raise exception 'invalid message' using errcode = '22023';
  end if;
  -- No flooding: 3 requests an hour per address, 60 in 10 minutes for
  -- everyone, 5 an hour per signed-in account.
  if (select count(*) from public.support_requests where source = 'web' and contact = e and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.support_requests where source = 'web' and created_at > now() - interval '10 minutes') >= 60
     or (auth.uid() is not null and not private.rate_take('contact_support', auth.uid()::text, interval '1 hour', 5)) then
    raise exception 'slow down: try again later' using errcode = '54000';
  end if;
  insert into public.support_requests (user_id, kind, subject, body, contact, platform, source, lang)
  values (null, k, p_subject, m, e, 'web', 'web', case when p_lang in ('en', 'fr', 'ar') then p_lang else 'en' end);
  return 'ok';
end $$;
revoke all on function public.contact_support(text, text, text, text, text) from public;
grant execute on function public.contact_support(text, text, text, text, text) to anon, authenticated;

-- The app's support form inserts directly (support_insert): 10 an hour per account.
create or replace function private.support_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.user_id = auth.uid()
     and (select count(*) from public.support_requests r where r.user_id = new.user_id and r.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'slow down: try again later' using errcode = '54000';
  end if;
  return new;
end $$;
revoke all on function private.support_rate() from public, anon, authenticated;
drop trigger if exists support_requests_rate on public.support_requests;
create trigger support_requests_rate before insert on public.support_requests
for each row execute function private.support_rate();

-- Analytics (last defined in 20261024009400_irly_security_fixes): the same
-- caps, and a signed-in caller sending events without user_id (before the
-- profile exists, src/lib/analytics.ts) counts against her own 60 a minute
-- instead of only the visitors' pool.
create or replace function private.analytics_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then
    if (select count(*) from public.analytics_events e where e.user_id is null and e.created_at > now() - interval '1 minute') >= 300 then
      return null;
    end if;
    if auth.uid() is not null and not private.rate_take('analytics', auth.uid()::text, interval '1 minute', 60) then
      return null;
    end if;
  elsif (select count(*) from public.analytics_events e where e.user_id = new.user_id and e.created_at > now() - interval '1 minute') >= 60 then
    return null;
  end if;
  return new;
end $$;
revoke all on function private.analytics_rate() from public, anon, authenticated;

-- ───────── 9. Like / save: explicit setters ─────────
-- Same rights as the toggles (security invoker: the likes / saves policies
-- decide). The result is the state after the call.
create or replace function public.set_like(p_type text, p_id text, p_liked boolean) returns boolean
language plpgsql set search_path = public as $$
begin
  if p_liked is null then raise exception 'invalid value' using errcode = '22023'; end if;
  if p_liked then
    insert into public.likes (user_id, target_type, target_id) values (auth.uid(), p_type, p_id)
    on conflict (user_id, target_type, target_id) do nothing;
  else
    delete from public.likes where user_id = auth.uid() and target_type = p_type and target_id = p_id;
  end if;
  return p_liked;
end $$;

create or replace function public.set_save(p_type text, p_id text, p_saved boolean) returns boolean
language plpgsql set search_path = public as $$
begin
  if p_saved is null then raise exception 'invalid value' using errcode = '22023'; end if;
  if p_saved then
    insert into public.saves (user_id, target_type, target_id) values (auth.uid(), p_type, p_id)
    on conflict (user_id, target_type, target_id) do nothing;
  else
    delete from public.saves where user_id = auth.uid() and target_type = p_type and target_id = p_id;
  end if;
  return p_saved;
end $$;
revoke all on function public.set_like(text, text, boolean), public.set_save(text, text, boolean) from public, anon;
grant execute on function public.set_like(text, text, boolean), public.set_save(text, text, boolean) to authenticated;

-- ───────── 10. "Typing…" on a private Realtime channel ─────────

-- May the caller use the Realtime topic `typing:<conversation_id>`? A member
-- of that conversation, with IRLY Girl access when it is a girl chat.
create or replace function private.typing_topic_allowed(p_topic text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  conv uuid;
begin
  if auth.uid() is null or p_topic is null or p_topic not like 'typing:%' then return false; end if;
  conv := private.uuid_or_null(substr(p_topic, 8));
  if conv is null then return false; end if;
  return private.is_member(conv, auth.uid())
    and (not private.girl_chat(conv) or private.girl_eligible_unchecked(auth.uid()));
end $$;
revoke all on function private.typing_topic_allowed(text) from public, anon;
grant execute on function private.typing_topic_allowed(text) to authenticated;

-- The policies on realtime.messages (Supabase Realtime Authorization), where
-- that schema exists (not on a plain local PostgreSQL). Kept as a function
-- so the tests can install them on a stand-in table.
create or replace function private.install_typing_policies() returns void
language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('realtime.messages') is null then return; end if;
  execute 'drop policy if exists irly_typing_receive on realtime.messages';
  execute $p$
    create policy irly_typing_receive on realtime.messages for select to authenticated
    using (realtime.messages.extension = 'broadcast' and private.typing_topic_allowed((select realtime.topic())))
  $p$;
  execute 'drop policy if exists irly_typing_send on realtime.messages';
  execute $p$
    create policy irly_typing_send on realtime.messages for insert to authenticated
    with check (realtime.messages.extension = 'broadcast' and private.typing_topic_allowed((select realtime.topic())))
  $p$;
end $$;
revoke all on function private.install_typing_policies() from public, anon, authenticated;
select private.install_typing_policies();
