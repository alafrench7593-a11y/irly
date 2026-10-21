-- IRLY back office: every photo the app shows can be changed or removed by
-- the team, from the back office, with a reason kept in the append-only
-- staff journal (private.admin_audit).
--
-- 1. Member photos (the member's own files):
--      community and activity photos   replace or remove      content staff and above
--      profile photos, IRLY Match       remove only           moderators and above
--      photos (never someone else's
--      picture put on a person)
--      community post and Live media   remove only           moderators and above
--    Verification selfies are never listed nor changed here (review only, in
--    Profile verifications). Private message photos are not browsed: a
--    reported message is removed from its report, as before.
-- 2. IRLY's own photos (categories, catalogue, official communities, Home,
--    IRLY Girl and IRLY Moms...) are files shipped with the app, found by a
--    key ("padel", "girlTrip"...). public.app_photo_overrides holds, per key,
--    a photo the team uploaded instead: everyone reads them (signed out too,
--    through app_photo_overrides_list), only content staff change them
--    (admin_set_app_photo). Without a row, the app's own photo shows.
--    The files live in a new public bucket, "app-photos", that only content
--    staff write to, in their own folder.
-- 3. Old files: a replaced or removed file is queued for the storage purge
--    (private.storage_cleanup, reason 'orphan') once the new reference is
--    saved; the purge job now deletes such a file of a member who still
--    exists only when nothing points at it any more (private.photo_in_use),
--    checked again when the job claims it. Before, those rows were never
--    handed out while the member existed, so the old file stayed for ever.
-- Additive: no table or column is dropped, RLS stays on everywhere.

-- ───────── 0. Who may ─────────
/** Raises unless the caller is content staff (photos level 'content') or a moderator ('moderator'), and not suspended. */
create or replace function private.need_photo_staff(p_level text) returns void
language plpgsql stable security definer set search_path = public, private as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'IRLY team only' using errcode = '42501'; end if;
  if p_level = 'content' and not private.is_content_staff(me) then
    raise exception 'IRLY content team only' using errcode = '42501';
  end if;
  if p_level = 'moderator' and not private.is_moderator(me) then
    raise exception 'IRLY moderators only' using errcode = '42501';
  end if;
  if private.is_sanctioned(me) then raise exception 'your account is suspended' using errcode = '42501'; end if;
end $$;
revoke all on function private.need_photo_staff(text) from public, anon, authenticated;

-- ───────── 1. Is a stored file still used? ─────────
/** True while any row of the app points at this file (unknown buckets: always true, never deleted by mistake). */
create or replace function private.photo_in_use(p_bucket text, p_name text) returns boolean
language plpgsql stable security definer set search_path = public, private as $$
begin
  if p_name is null then return false; end if;
  return case p_bucket
    when 'activity-photos' then
      exists (select 1 from public.communities where cover_path = p_name)
      or exists (select 1 from public.activities where cover_path = p_name)
      or exists (select 1 from public.conversations where photo_path = p_name)
    when 'app-photos' then exists (select 1 from public.app_photo_overrides where storage_path = p_name)
    when 'profile-photos' then
      exists (select 1 from public.profiles p, unnest(p.photo_paths) x where p_name in (x, private.photo_thumb(x)))
    when 'match-photos' then exists (select 1 from public.irly_match_profiles where p_name = any (photo_paths))
    when 'post-media' then exists (select 1 from public.community_posts where p_name = any (media_paths) or thumb_path = p_name)
    when 'irl-media' then exists (select 1 from public.irl_posts where media_path = p_name or thumb_path = p_name)
    when 'chat-media' then exists (select 1 from public.messages where media_path = p_name)
    else true
  end;
end $$;
revoke all on function private.photo_in_use(text, text) from public, anon, authenticated;

/** Queues a file the team just replaced or removed, if it is a member's file and nothing uses it any more. */
create or replace function private.queue_unused_photo(p_bucket text, p_name text) returns boolean
language plpgsql security definer set search_path = public, private as $$
begin
  if p_name is null or p_name !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$' or private.photo_in_use(p_bucket, p_name) then
    return false;
  end if;
  insert into private.storage_cleanup as q (bucket_id, name, user_id, reason)
  values (p_bucket, p_name, split_part(p_name, '/', 1)::uuid, 'orphan')
  on conflict (bucket_id, name) do update
    set done_at = null, attempts = 0, last_error = null, claimed_at = null, flagged_at = null, queued_at = now()
    where q.done_at is not null;
  return true;
end $$;
revoke all on function private.queue_unused_photo(text, text) from public, anon, authenticated;

-- The purge job's claim (20261020001400), with one more case: a file queued
-- as unused ('orphan') of a member who still exists is handed out only if
-- nothing points at it now. Everything else is unchanged.
create or replace function private.storage_purge_claim(p_limit integer default 200, p_lease_seconds integer default 900)
returns table (bucket_id text, name text)
language sql security definer set search_path = public, private as $$
  update private.storage_cleanup q
    set flagged_at = now(), claimed_at = null,
        last_error = coalesce(q.last_error, 'no result after ' || q.attempts || ' attempts')
  where q.done_at is null and q.flagged_at is null and q.attempts >= private.storage_purge_max_attempts()
    and (q.claimed_at is null or q.claimed_at < now() - make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 0)));
  update private.storage_cleanup q
    set flagged_at = now(), last_error = 'not in the member''s own folder'
  where q.done_at is null and q.flagged_at is null and split_part(q.name, '/', 1) <> q.user_id::text;
  with c as (
    select q.bucket_id, q.name from private.storage_cleanup q
    where q.done_at is null and q.flagged_at is null
      and q.attempts < private.storage_purge_max_attempts()
      and (q.claimed_at is null or q.claimed_at < now() - make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 0)))
      and split_part(q.name, '/', 1) = q.user_id::text
      and case when q.reason = 'export_expired' then q.bucket_id = 'data-exports'
               when not exists (select 1 from auth.users u where u.id = q.user_id) then true
               when q.reason = 'orphan' then not private.photo_in_use(q.bucket_id, q.name)
               else false end
    order by q.queued_at, q.bucket_id, q.name
    limit greatest(1, least(coalesce(p_limit, 200), 1000))
    for update of q skip locked
  )
  update private.storage_cleanup q
    set claimed_at = now(), attempts = q.attempts + 1
  from c
  where q.bucket_id = c.bucket_id and q.name = c.name
  returning q.bucket_id, q.name;
$$;
revoke all on function private.storage_purge_claim(integer, integer) from public, anon, authenticated;

-- ───────── 2. IRLY's own photos, replaced by the team ─────────
create table if not exists public.app_photo_overrides (
  key text primary key check (key ~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$'),
  storage_path text not null check (storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'),
  -- Grows on every change: part of the link, so no screen keeps showing a cached copy.
  version bigint not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.app_photo_overrides enable row level security;
-- Read through app_photo_overrides_list() only (no staff id leaves the server); written by admin_set_app_photo().
revoke all on public.app_photo_overrides from public, anon, authenticated;
create sequence if not exists private.app_photo_version;
revoke all on sequence private.app_photo_version from public, anon, authenticated;

/** Every photo the team put instead of one of IRLY's own: key, stored file, version. Anyone may read it. */
create or replace function public.app_photo_overrides_list()
returns table (key text, path text, version bigint, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.key, o.storage_path, o.version, o.updated_at from public.app_photo_overrides o order by o.key
$$;
revoke all on function public.app_photo_overrides_list() from public;
grant execute on function public.app_photo_overrides_list() to anon, authenticated;

/**
 * Puts the team's photo in place of IRLY's own photo `p_key` everywhere in
 * the app, or (p_path null) goes back to IRLY's own photo. The file is the
 * staff member's own upload to "app-photos", just made by the back office;
 * the old file is queued for removal once nothing uses it. Returns the new
 * version (0 when back to IRLY's own photo).
 */
create or replace function public.admin_set_app_photo(p_key text, p_path text, p_reason text)
returns bigint language plpgsql security definer set search_path = public, private as $$
declare why text; old text; v bigint := 0; stored boolean;
begin
  perform private.need_photo_staff('content');
  why := private.need_reason(p_reason);
  if p_key is null or p_key !~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$' then raise exception 'unknown photo' using errcode = '22023'; end if;
  if p_path is not null and not private.own_upload(p_path) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  -- The file must really be there (where Storage exists): never a key pointing at nothing.
  if p_path is not null and to_regclass('storage.objects') is not null then
    execute 'select exists (select 1 from storage.objects where bucket_id = ''app-photos'' and name = $1)' into stored using p_path;
    if not stored then raise exception 'the photo was not uploaded' using errcode = 'P0002'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('app_photo:' || p_key, 11));
  select storage_path into old from public.app_photo_overrides where key = p_key for update;
  if p_path is not distinct from old then
    return coalesce((select version from public.app_photo_overrides where key = p_key), 0);
  end if;
  if p_path is null then
    delete from public.app_photo_overrides where key = p_key;
  else
    v := nextval('private.app_photo_version');
    insert into public.app_photo_overrides (key, storage_path, version, updated_at, updated_by)
    values (p_key, p_path, v, now(), auth.uid())
    on conflict (key) do update set storage_path = excluded.storage_path, version = excluded.version,
      updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  end if;
  perform private.queue_unused_photo('app-photos', old);
  perform private.journal(case when p_path is null then 'photo.app_restored' else 'photo.app_replaced' end,
    null, null, 'app_photo', null, why, jsonb_build_object('key', p_key));
  return v;
end $$;
revoke all on function public.admin_set_app_photo(text, text, text) from public, anon;
grant execute on function public.admin_set_app_photo(text, text, text) to authenticated;

-- The bucket: public (IRLY's photos are public), images only, 5 MB; written
-- by content staff in their own folder; a staff member may take back an
-- upload of theirs that no key uses (a save that was refused).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('app-photos', 'app-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    execute 'drop policy if exists app_photos_insert on storage.objects';
    execute $p$
      create policy app_photos_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'app-photos' and (storage.foldername(name))[1] = auth.uid()::text and private.is_content_staff(auth.uid()))
    $p$;
    execute 'drop policy if exists app_photos_read on storage.objects';
    execute $p$
      create policy app_photos_read on storage.objects for select to anon, authenticated
      using (bucket_id = 'app-photos')
    $p$;
    execute 'drop policy if exists app_photos_delete on storage.objects';
    execute $p$
      create policy app_photos_delete on storage.objects for delete to authenticated
      using (bucket_id = 'app-photos' and (storage.foldername(name))[1] = auth.uid()::text and private.is_content_staff(auth.uid())
             and not exists (select 1 from public.app_photo_overrides o where o.storage_path = name))
    $p$;
  end if;
end $$;

-- ───────── 3. Members' photos ─────────
-- The guard on community posts (20261005001400) lets someone else than the
-- author only remove a post. A photo taken off by the team, through
-- admin_set_photo below (which checked the role), is the one other change:
-- that function says so for its own statement only (a transaction setting no
-- client can make: PostgREST runs no SQL of the caller's).
create or replace function private.moderator_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or private.is_admin(auth.uid()) or auth.uid() = old.author_id
     or current_setting('irly.staff_photo', true) = 'on' then
    return new;
  end if;
  if (to_jsonb(new) - 'deleted_at' - 'updated_at') is distinct from (to_jsonb(old) - 'deleted_at' - 'updated_at') then
    raise exception 'moderators can only remove a post' using errcode = '42501';
  end if;
  return new;
end $$;

/**
 * The photos of one thing, for its sheet in the back office: one row per
 * photo (slot 'cover', 'profile', 'match' or 'media'), its bucket and path
 * (an activity's IRLY library photo is its https link), and for a video its
 * small picture. Verification selfies are never listed.
 */
create or replace function public.admin_item_photos(p_kind text, p_id uuid)
returns table (slot text, bucket text, path text, media text, thumb text)
language plpgsql stable security definer set search_path = public, private as $$
begin
  perform private.need_staff();
  if p_kind = 'community' then
    return query select 'cover'::text, 'activity-photos'::text, c.cover_path, 'photo'::text, null::text
      from public.communities c where c.id = p_id and c.cover_path is not null;
  elsif p_kind = 'activity' then
    return query select 'cover'::text, 'activity-photos'::text, a.cover_path, 'photo'::text, null::text
      from public.activities a where a.id = p_id and a.cover_path is not null;
  elsif p_kind = 'community_post' then
    return query select 'media'::text, 'post-media'::text, x.path, coalesce(p.media_kind, 'photo'), p.thumb_path
      from public.community_posts p, unnest(p.media_paths) with ordinality x(path, n)
      where p.id = p_id order by x.n;
  elsif p_kind = 'irl_post' then
    return query select 'media'::text, 'irl-media'::text, p.media_path, p.media_kind, p.thumb_path
      from public.irl_posts p where p.id = p_id and p.media_path is not null;
  elsif p_kind = 'profile' then
    if not private.is_moderator(auth.uid()) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
    return query
      select 'profile'::text, 'profile-photos'::text, x.path, 'photo'::text, private.photo_thumb(x.path)
        from public.profiles p, unnest(p.photo_paths) with ordinality x(path, n) where p.id = p_id
      union all
      select 'match'::text, 'match-photos'::text, x.path, 'photo'::text, null::text
        from public.irly_match_profiles m, unnest(m.photo_paths) with ordinality x(path, n) where m.user_id = p_id;
  else
    raise exception 'unknown kind' using errcode = '22023';
  end if;
end $$;
revoke all on function public.admin_item_photos(text, uuid) from public, anon;
grant execute on function public.admin_item_photos(text, uuid) to authenticated;

/**
 * Members' photos, to browse: the latest things that carry one (or, with a
 * search, any match by name, words, author or id). One row per thing, its
 * photos' paths and where they are stored. Profiles: moderators and above.
 */
create or replace function public.admin_photos(p_kind text, p_search text default null, p_limit integer default 60)
returns table (id uuid, kind text, title text, owner_id uuid, owner_name text, bucket text, paths text[], media text,
  created_at timestamptz, girl_only boolean, hidden boolean)
language plpgsql stable security definer set search_path = public, private as $$
declare q text := nullif(btrim(coalesce(p_search, '')), ''); lim integer := least(greatest(coalesce(p_limit, 60), 1), 200);
begin
  perform private.need_staff();
  if p_kind = 'community' then
    return query
      select c.id, 'community'::text, c.name, c.created_by, pc.first_name, 'activity-photos'::text,
        case when c.cover_path is null then '{}'::text[] else array[c.cover_path] end, 'photo'::text, c.created_at, c.girl_only,
        private.is_held('community', c.id) or c.deleted_at is not null
      from public.communities c left join public.profiles pc on pc.id = c.created_by
      where (q is null and c.cover_path is not null and c.deleted_at is null)
         or (q is not null and (private.has_text(c.name, q) or c.id::text = q or private.has_text(pc.first_name, q)))
      order by (c.cover_path is not null) desc, c.created_at desc limit lim;
  elsif p_kind = 'activity' then
    return query
      select a.id, 'activity'::text, a.title, a.creator_id, pa.first_name, 'activity-photos'::text,
        case when a.cover_path is null then '{}'::text[] else array[a.cover_path] end, 'photo'::text, a.created_at, a.girl_only,
        a.moderated_at is not null
      from public.activities a left join public.profiles pa on pa.id = a.creator_id
      where (q is null and a.cover_path is not null and a.cancelled_at is null)
         or (q is not null and (private.has_text(a.title, q) or a.id::text = q or private.has_text(pa.first_name, q)))
      order by (a.cover_path is not null) desc, a.created_at desc limit lim;
  elsif p_kind = 'community_post' then
    return query
      select x.id, 'community_post'::text, coalesce(c.name, 'Profile post'), x.author_id, px.first_name, 'post-media'::text,
        case when x.media_kind = 'video' and x.thumb_path is not null then array[x.thumb_path] else x.media_paths end,
        coalesce(x.media_kind, 'photo'), x.created_at, coalesce(c.girl_only, false), private.is_held('community_post', x.id)
      from public.community_posts x left join public.profiles px on px.id = x.author_id left join public.communities c on c.id = x.community_id
      where cardinality(x.media_paths) > 0 and x.deleted_at is null
        and (q is null or private.has_text(x.body, q) or private.has_text(px.first_name, q) or private.has_text(c.name, q) or x.id::text = q)
      order by x.created_at desc limit lim;
  elsif p_kind = 'irl_post' then
    return query
      select x.id, 'irl_post'::text, left(x.body, 80), x.author_id, px.first_name, 'irl-media'::text,
        array[coalesce(case when x.media_kind = 'video' then x.thumb_path end, x.media_path)], x.media_kind, x.created_at,
        x.app_scope <> 'irly', private.is_held('irl_post', x.id)
      from public.irl_posts x left join public.profiles px on px.id = x.author_id
      where x.media_path is not null
        and (q is null or private.has_text(x.body, q) or private.has_text(px.first_name, q) or x.id::text = q)
      order by x.created_at desc limit lim;
  elsif p_kind = 'profile' then
    if not private.is_moderator(auth.uid()) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
    return query
      select p.id, 'profile'::text, p.first_name, p.id, p.first_name, 'profile-photos'::text, p.photo_paths, 'photo'::text,
        p.created_at, false, false
      from public.profiles p
      where p.deleted_at is null and cardinality(p.photo_paths) > 0
        and (q is null or private.has_text(p.first_name, q) or private.has_text(p.username, q) or p.id::text = q)
      order by p.created_at desc limit lim;
  else
    raise exception 'unknown kind' using errcode = '22023';
  end if;
end $$;
revoke all on function public.admin_photos(text, text, integer) from public, anon;
grant execute on function public.admin_photos(text, text, integer) to authenticated;

/**
 * Changes one member photo, with a reason for the journal:
 *   community, activity: p_path = the staff member's new upload (replace) or null (remove: the app's photo shows);
 *   profile, match, community_post, irl_post: remove only (p_path null), p_old = the file to take off.
 * The old file is queued for removal once nothing uses it.
 */
create or replace function public.admin_set_photo(p_kind text, p_id uuid, p_path text, p_old text, p_reason text)
returns void language plpgsql security definer set search_path = public, private as $$
declare why text; old text; owner uuid; left_paths text[]; words text; thumb text;
begin
  if p_kind = 'community' then
    perform private.need_photo_staff('content');
    perform public.admin_set_community_cover(p_id, p_path, p_reason);
    return;
  end if;
  if p_kind = 'activity' then
    perform private.need_photo_staff('content');
    why := private.need_reason(p_reason);
    select cover_path, creator_id into old, owner from public.activities where id = p_id for update;
    if owner is null then raise exception 'this activity no longer exists' using errcode = 'P0002'; end if;
    if p_path is not null and not private.own_upload(p_path) then
      raise exception 'the photo must be one of your own uploads' using errcode = '42501';
    end if;
    if p_path is not distinct from old then return; end if;
    update public.activities set cover_path = p_path where id = p_id;
    perform private.queue_unused_photo('activity-photos', old);
    perform private.journal(case when p_path is null then 'activity.photo_removed' else 'activity.photo_replaced' end,
      owner, null, 'activity', p_id, why);
    return;
  end if;

  -- Everything else: a member's own photo, which the team can only take off.
  perform private.need_photo_staff('moderator');
  why := private.need_reason(p_reason);
  if p_path is not null then
    raise exception 'a member''s photo can only be removed, never replaced by another picture' using errcode = '22023';
  end if;
  if p_old is null then raise exception 'which photo?' using errcode = '22023'; end if;
  if p_kind in ('profile', 'match') then
    owner := p_id;
    -- A team member's own photos: admins only.
    if private.staff_role(owner) is not null and not private.is_admin(auth.uid()) then
      raise exception 'only an admin can change a team member''s photos' using errcode = '42501';
    end if;
    if p_kind = 'profile' then
      select photo_paths into left_paths from public.profiles where id = p_id for update;
      if left_paths is null or not (p_old = any (left_paths)) then raise exception 'this photo is no longer on the profile' using errcode = 'P0002'; end if;
      update public.profiles set photo_paths = array_remove(photo_paths, p_old) where id = p_id;
      perform private.queue_unused_photo('profile-photos', p_old);
      perform private.queue_unused_photo('profile-photos', private.photo_thumb(p_old));
      perform private.journal('profile.photo_removed', owner, null, 'profile', p_id, why);
    else
      select photo_paths into left_paths from public.irly_match_profiles where user_id = p_id for update;
      if left_paths is null or not (p_old = any (left_paths)) then raise exception 'this photo is no longer on the profile' using errcode = 'P0002'; end if;
      update public.irly_match_profiles set photo_paths = array_remove(photo_paths, p_old) where user_id = p_id;
      perform private.queue_unused_photo('match-photos', p_old);
      perform private.journal('match.photo_removed', owner, null, 'profile', p_id, why);
    end if;
  elsif p_kind = 'community_post' then
    select author_id, media_paths, community_posts.body, thumb_path into owner, left_paths, words, thumb
      from public.community_posts where id = p_id and deleted_at is null for update;
    if owner is null then raise exception 'this post no longer exists' using errcode = 'P0002'; end if;
    if not (p_old = any (left_paths)) then raise exception 'this photo is no longer on the post' using errcode = 'P0002'; end if;
    left_paths := array_remove(left_paths, p_old);
    if cardinality(left_paths) = 0 and char_length(btrim(coalesce(words, ''))) = 0 then
      raise exception 'this post is only this photo: hide or delete the post instead' using errcode = '22023';
    end if;
    perform set_config('irly.staff_photo', 'on', true);
    update public.community_posts
      set media_paths = left_paths,
          media_kind = case when cardinality(left_paths) = 0 then null else media_kind end,
          thumb_path = case when cardinality(left_paths) = 0 then null else thumb_path end,
          media_seconds = case when cardinality(left_paths) = 0 then null else media_seconds end
      where id = p_id;
    perform set_config('irly.staff_photo', 'off', true);
    perform private.queue_unused_photo('post-media', p_old);
    if cardinality(left_paths) = 0 then perform private.queue_unused_photo('post-media', thumb); end if;
    perform private.journal('post.photo_removed', owner, null, 'community_post', p_id, why);
  elsif p_kind = 'irl_post' then
    select author_id, media_path, irl_posts.body, thumb_path into owner, old, words, thumb from public.irl_posts where id = p_id for update;
    if owner is null then raise exception 'this Live no longer exists' using errcode = 'P0002'; end if;
    if old is distinct from p_old then raise exception 'this photo is no longer on the Live' using errcode = 'P0002'; end if;
    if char_length(btrim(coalesce(words, ''))) = 0 then
      raise exception 'this Live is only this photo: hide or delete the Live instead' using errcode = '22023';
    end if;
    update public.irl_posts set media_path = null, thumb_path = null, media_seconds = null, media_ratio = null where id = p_id;
    perform private.queue_unused_photo('irl-media', old);
    perform private.queue_unused_photo('irl-media', thumb);
    perform private.journal('live.photo_removed', owner, null, 'irl_post', p_id, why);
  else
    raise exception 'unknown kind' using errcode = '22023';
  end if;
end $$;
revoke all on function public.admin_set_photo(text, uuid, text, text, text) from public, anon;
grant execute on function public.admin_set_photo(text, uuid, text, text, text) to authenticated;
