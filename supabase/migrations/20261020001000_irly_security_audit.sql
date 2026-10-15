-- Security audit of the authorization model (2026-10-20).
-- Additive only: RLS stays on everywhere, no table, column or content is
-- dropped, and every change below narrows access. Tests:
-- supabase/tests/security_audit.test.sql.
--
-- 1. profiles_public was writable. It is a view owned by the migration role,
--    so writes through it skip the RLS of public.profiles; with the table
--    privileges Supabase gives API roles by default, any signed-in member
--    could rename (PATCH) or delete (DELETE) ANY member's profile through
--    /rest/v1/profiles_public. Now: read-only for members (privileges
--    revoked, and a trigger refuses every write whatever the grants), and
--    not readable by anon.
-- 2. A member whose IRLY Girl access was withdrawn (girl_suspend) kept the
--    women-only communities she OWNED (the suspension skipped owners), so she
--    stayed in their chat (reading and writing the messages), received their
--    post notifications and could still moderate them (announce to every
--    member, pin, add groups, change roles). She also stayed in the chats of
--    girls-only activities and IRLY Girl matches.
--    Now: suspension hands each women-only community she owns to a woman of
--    the community and removes her from every women-only community; being a
--    member or a moderator of a women-only community (i_belong, moderates)
--    requires IRLY Girl access; and the messages, members and details of an
--    IRLY Girl chat (girls-only community or activity, Match) are only served
--    to members who have IRLY Girl access (restrictive policies, so a
--    reinstated member finds her activity and Match chats back).
-- 3. profile-photos: any signed-in member could list and download every file
--    of every member (all photos of private profiles, photos removed from a
--    profile, photos of deleted accounts). Now: your own files; the first
--    photo (and its small copy) of a member who has not blocked you, as the
--    app shows it everywhere; the other photos of a profile only to people
--    who may see that profile (its privacy setting) or share a private chat
--    with its owner; IRLY admins (verification review).
-- 4. match-photos: any IRLY Girl member could list every file and read the
--    photos of people who blocked her. Now: your own files, and the photos of
--    an IRLY Match profile whose owner has not blocked you.
-- 5. Functions that only make sense signed in no longer run for anon (they
--    kept PostgreSQL's default EXECUTE for everyone).
-- 6. The inbox (my_conversations) and chat member lists (chat_members) run
--    with the owner's rights: they now apply the IRLY Girl chat rule of 2.
--    register_push_token is unchanged (see the note at the end).

-- ───────── 1. profiles_public is read-only ─────────

revoke insert, update, delete, truncate, references, trigger on public.profiles_public from public, anon, authenticated;
revoke select on public.profiles_public from public, anon;
grant select on public.profiles_public to authenticated;

create or replace function private.read_only_view() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception '% is read-only', tg_table_name using errcode = '42501';
end $$;
revoke all on function private.read_only_view() from public, anon, authenticated;

drop trigger if exists profiles_public_read_only on public.profiles_public;
create trigger profiles_public_read_only instead of insert or update or delete on public.profiles_public
for each row execute function private.read_only_view();

-- ───────── 2. IRLY Girl: a withdrawn access is withdrawn everywhere ─────────

-- Member of a community: for a women-only one, only with IRLY Girl access.
create or replace function private.i_belong(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_members where community_id = cid and user_id = auth.uid())
    and (not exists (select 1 from public.communities c where c.id = cid and c.girl_only)
         or private.girl_eligible_unchecked(auth.uid()))
$$;

-- Moderator (owner or moderator, of the community or of its parent): for a
-- women-only community, only with IRLY Girl access. IRLY admins as before.
create or replace function private.moderates(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.is_admin(auth.uid()) or (
    exists (
      select 1 from public.community_members m
      where m.user_id = auth.uid() and m.role in ('owner', 'moderator')
        and m.community_id in (cid, (select parent_id from public.communities where id = cid))
    )
    and (not exists (select 1 from public.communities c where c.id = cid and c.girl_only)
         or private.girl_eligible_unchecked(auth.uid()))
  )
$$;

-- An IRLY Girl chat: a Match chat, or the chat of a girls-only community or
-- activity (groups of a women-only community are women-only themselves).
create or replace function private.girl_chat(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations v
    left join public.communities c on c.id = v.community_id
    left join public.activities a on a.id = v.activity_id
    where v.id = conv
      and (v.kind = 'match' or coalesce(c.girl_only, false) or coalesce(a.girl_only, false))
  )
$$;
revoke all on function private.girl_chat(uuid) from public, anon;
grant execute on function private.girl_chat(uuid) to authenticated;

-- Restrictive: they narrow what the existing policies allow, never widen it.
-- "(select …)" is computed once per query: members with IRLY Girl access
-- (everyone who is in such a chat in normal use) pay nothing per row.
drop policy if exists messages_girl_chat on public.messages;
create policy messages_girl_chat on public.messages as restrictive for all to authenticated
  using ((select private.is_girl_eligible()) or not private.girl_chat(conversation_id))
  with check ((select private.is_girl_eligible()) or not private.girl_chat(conversation_id));

drop policy if exists conversation_members_girl_chat on public.conversation_members;
create policy conversation_members_girl_chat on public.conversation_members as restrictive for select to authenticated
  using ((select private.is_girl_eligible()) or not private.girl_chat(conversation_id));

drop policy if exists conversations_girl_chat on public.conversations;
create policy conversations_girl_chat on public.conversations as restrictive for select to authenticated
  using ((select private.is_girl_eligible()) or not private.girl_chat(id));

-- Takes a member out of every women-only community, the ones she owns
-- included: each of those goes to a woman of the community (a moderator
-- first, then the longest-standing member), who also runs its chat. Leaving
-- a community takes her out of its chat (and its groups) as usual.
create or replace function private.girl_withdraw(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.community_members cm set role = 'owner'
  from (
    select distinct on (m.community_id) m.community_id, m.user_id
    from public.community_members m
    join public.community_members mine on mine.community_id = m.community_id and mine.user_id = p_user and mine.role = 'owner'
    join public.communities c on c.id = m.community_id and c.girl_only
    where m.user_id <> p_user
      and private.girl_eligible_unchecked(m.user_id)
      and not exists (select 1 from public.community_members o
                      where o.community_id = m.community_id and o.role = 'owner' and o.user_id <> p_user)
    order by m.community_id, (m.role = 'moderator') desc, m.joined_at
  ) heir
  where cm.community_id = heir.community_id and cm.user_id = heir.user_id;

  -- Run by an admin (girl_suspend) or by this migration: the role freeze lets both through.
  update public.conversation_members cvm set role = 'admin'
  from public.conversations v, public.community_members cm, public.communities c
  where v.id = cvm.conversation_id and v.community_id = cm.community_id and c.id = cm.community_id and c.girl_only
    and cm.user_id = cvm.user_id and cm.role = 'owner' and cm.user_id <> p_user and cvm.role <> 'admin'
    and exists (select 1 from public.community_members s where s.community_id = cm.community_id and s.user_id = p_user and s.role = 'owner');

  delete from public.community_members m using public.communities c
  where m.community_id = c.id and c.girl_only and m.user_id = p_user;
end $$;
revoke all on function private.girl_withdraw(uuid) from public, anon, authenticated;

create or replace function public.girl_suspend(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.girl_suspensions (user_id, reason, created_by)
  values (p_user, btrim(p_reason), auth.uid())
  on conflict (user_id) do update set reason = excluded.reason, created_by = excluded.created_by, created_at = now();
  update public.irly_match_profiles set visible = false where user_id = p_user;
  perform private.girl_withdraw(p_user);
  delete from public.activity_participants ap using public.activities a
    where ap.activity_id = a.id and a.girl_only and ap.user_id = p_user and a.starts_at > now() and a.creator_id <> p_user;
end $$;

-- Accounts already suspended: the same withdrawal (their posts and messages stay).
do $$
declare s record;
begin
  for s in select user_id from public.girl_suspensions loop
    perform private.girl_withdraw(s.user_id);
  end loop;
end $$;

-- ───────── 3–4. Storage: who may read a profile or Match photo ─────────

-- The small copy of a profile photo, stored next to it (thumbOf in
-- src/features/server/media.ts).
create or replace function private.photo_thumb(p_path text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(p_path, '(\.[a-z0-9]+)?$', '-s.jpg', 'i')
$$;

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
  if p_name in (p.photo_paths[1], private.photo_thumb(p.photo_paths[1])) then return true; end if;
  -- The rest of the profile's photos: for whoever may see the profile.
  if exists (select 1 from unnest(p.photo_paths) x where p_name in (x, private.photo_thumb(x))) then
    return private.visible_to(me, owner, (select s.profile_visibility from public.safety_settings s where s.user_id = owner))
      or private.shares_private_chat(me, owner);
  end if;
  return false;
end $$;
revoke all on function private.can_read_profile_photo(text) from public, anon;
grant execute on function private.can_read_profile_photo(text) to authenticated;

create or replace function private.can_read_match_photo(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  owner uuid := private.uuid_or_null(split_part(coalesce(p_name, ''), '/', 1));
begin
  if me is null or p_name is null or not private.girl_eligible_unchecked(me) then return false; end if;
  if owner = me then return true; end if;
  if owner is null or private.blocked_unchecked(me, owner) then return false; end if;
  return exists (select 1 from public.irly_match_profiles mp where mp.user_id = owner and p_name = any (mp.photo_paths));
end $$;
revoke all on function private.can_read_match_photo(text) from public, anon;
grant execute on function private.can_read_match_photo(text) to authenticated;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute 'drop policy if exists profile_photos_read on storage.objects';
    execute $p$
      create policy profile_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'profile-photos' and private.can_read_profile_photo(name))
    $p$;
    execute 'drop policy if exists match_photos_read on storage.objects';
    execute $p$
      create policy match_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'match-photos' and private.can_read_match_photo(name))
    $p$;
  end if;
end $$;

-- ───────── 5. Signed-in functions are not callable by anon ─────────

do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('comment_thread', 'community_detail', 'community_digest', 'community_subgroups',
                        'engagement', 'my_calendar', 'search_all', 'toggle_like', 'toggle_save')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ───────── 6. The inbox and chat member lists follow the same IRLY Girl rule ─────────
-- my_conversations and chat_members run with the owner's rights, so the
-- restrictive policies of section 2 do not apply to them: a member without
-- IRLY Girl access (suspended) still saw her Match and girls-only activity
-- chats in her inbox, with the last message, and their member lists.
-- my_conversations: the body of 20261020000300_irly_chat_speed (unread capped
-- at 100, blocks read once), plus one condition on the rows it already joins;
-- the access check is computed once per call.
create or replace function public.my_conversations()
returns table (conversation_id uuid, kind text, title text, other_user_id uuid, other_name text, last_body text,
  last_sender uuid, last_at timestamptz, unread integer, ref_id uuid,
  other_photo text, photo_path text, photo_bucket text, members integer, last_kind text, last_sender_name text, archived boolean)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.kind,
    coalesce(com.name, act.title, c.title, other.first_name, 'IRLY'),
    other.id,
    other.first_name,
    lm.body,
    lm.sender_id,
    coalesce(lm.created_at, c.created_at),
    (select count(*)::int from (
       select 1 from public.messages x
       where x.conversation_id = c.id and x.deleted_at is null
         and x.sender_id is distinct from auth.uid()
         and x.created_at > greatest(coalesce(me.last_read_at, 'epoch'::timestamptz), coalesce(me.cleared_at, 'epoch'::timestamptz))
         and (x.sender_id is null or x.sender_id <> all (array(
           select b.blocked_id from public.blocks b where b.blocker_id = auth.uid()
           union all select b.blocker_id from public.blocks b where b.blocked_id = auth.uid())))
         and not exists (select 1 from public.message_hides h where h.user_id = auth.uid() and h.message_id = x.id)
       limit 100
     ) u),
    coalesce(c.activity_id, c.community_id, c.match_id),
    other.photo,
    coalesce(com.cover_path, c.photo_path, act.cover_path),
    case when coalesce(com.cover_path, c.photo_path, act.cover_path) is null then null else 'activity-photos' end,
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
    lm.kind,
    lm.first_name,
    me.archived_at is not null
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join public.communities com on com.id = c.community_id
  left join public.activities act on act.id = c.activity_id
  left join lateral (
    select p.id, p.first_name, p.photo_paths[1] as photo from public.conversation_members o
    join public.profiles p on p.id = o.user_id
    where o.conversation_id = c.id and o.user_id <> auth.uid() and c.kind in ('direct', 'match')
    limit 1
  ) other on true
  left join lateral (
    select m.body, m.sender_id, m.created_at, m.kind, sp.first_name from public.messages m
    left join public.profiles sp on sp.id = m.sender_id
    where m.conversation_id = c.id and m.deleted_at is null
      and (m.sender_id is null or not private.blocked_unchecked(auth.uid(), m.sender_id))
      and m.created_at > coalesce(me.cleared_at, '-infinity'::timestamptz)
      and not exists (select 1 from public.message_hides h where h.user_id = auth.uid() and h.message_id = m.id)
    order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
    and not (c.kind in ('direct', 'match') and other.id is not null and private.blocked_unchecked(auth.uid(), other.id))
    and (me.cleared_at is null or lm.created_at is not null)
    -- IRLY Girl chats (Match, girls-only community or activity) only with IRLY Girl access.
    and ((select private.is_girl_eligible())
         or not (c.kind = 'match' or coalesce(com.girl_only, false) or coalesce(act.girl_only, false)))
  order by coalesce(lm.created_at, c.created_at) desc
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

create or replace function public.chat_members(p_conversation uuid)
returns table (user_id uuid, first_name text, photo_path text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.photo_paths[1], m.role
  from public.conversation_members m
  join public.profiles p on p.id = m.user_id and p.deleted_at is null
  where m.conversation_id = p_conversation
    and private.is_member(p_conversation, auth.uid())
    and ((select private.is_girl_eligible()) or not private.girl_chat(p_conversation))
  order by m.role = 'admin' desc, p.first_name
  limit 500
$$;
revoke all on function public.chat_members(uuid) from public, anon;
grant execute on function public.chat_members(uuid) to authenticated;

-- register_push_token is left as is: a token moving to the account that
-- registers it is how a phone follows an account switch (sign-out may never
-- reach the server), and the server cannot tell that phone from someone who
-- learned the token. Taking a token over only redirects pushes to the phone
-- that owns it: no notification content reaches the person who took it.
