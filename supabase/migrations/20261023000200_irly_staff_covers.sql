-- The IRLY team changes photos: the owner, admins and the content role can
-- set (or reset) the photo of any community or activity, from the app. The
-- photo is the staff member's own upload ("<their id>/…" in activity-photos),
-- checked here; every change goes to the staff audit log. Members keep the
-- rules they had: a community's owner or moderator, an activity's host.

create or replace function private.is_content_staff(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(private.staff_role(uid) in ('owner', 'admin', 'content'), false)
$$;
revoke all on function private.is_content_staff(uuid) from public, anon;
grant execute on function private.is_content_staff(uuid) to authenticated;

/** The caller may change this community's photo (owner, moderator or content staff). */
create or replace function public.set_community_cover(p_community uuid, p_path text)
returns void language plpgsql security definer set search_path = public, private as $$
declare staff boolean := private.is_content_staff(auth.uid());
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.communities where id = p_community and deleted_at is null) then
    raise exception 'this community no longer exists' using errcode = 'P0002';
  end if;
  if not staff and not exists (
    select 1 from public.community_members m
    where m.community_id = p_community and m.user_id = auth.uid() and m.role in ('owner', 'moderator')
  ) then
    raise exception 'only the community owner or a moderator can change its photo' using errcode = '42501';
  end if;
  if p_path is not null and not private.own_upload(p_path) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  update public.communities set cover_path = p_path where id = p_community;
  if staff then
    perform private.audit('cover.community', (select created_by from public.communities where id = p_community), null,
      jsonb_build_object('community', p_community, 'reset', p_path is null));
  end if;
end $$;
revoke all on function public.set_community_cover(uuid, text) from public, anon;
grant execute on function public.set_community_cover(uuid, text) to authenticated;

-- An activity's photo is the host's upload, or (set by the team) a staff upload.
create or replace function private.activity_cover_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.cover_path is null then return new; end if;
  if tg_op = 'UPDATE' and new.cover_path is not distinct from old.cover_path then return new; end if;
  if new.cover_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$' then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  if split_part(new.cover_path, '/', 1) = new.creator_id::text then return new; end if;
  if private.own_upload(new.cover_path) and private.is_content_staff(auth.uid()) then return new; end if;
  raise exception 'the photo must be one of your own uploads' using errcode = '42501';
end $$;

/** The host, or content staff, sets an activity's photo (null: back to the app's photo). */
create or replace function public.set_activity_cover(p_activity uuid, p_path text)
returns void language plpgsql security definer set search_path = public, private as $$
declare host uuid; staff boolean := private.is_content_staff(auth.uid());
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select creator_id into host from public.activities where id = p_activity and cancelled_at is null;
  if host is null then raise exception 'this activity no longer exists' using errcode = 'P0002'; end if;
  if host <> auth.uid() and not staff then
    raise exception 'only the host can change its photo' using errcode = '42501';
  end if;
  if p_path is not null and not private.own_upload(p_path) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  update public.activities set cover_path = p_path where id = p_activity;
  if staff and host <> auth.uid() then
    perform private.audit('cover.activity', host, null, jsonb_build_object('activity', p_activity, 'reset', p_path is null));
  end if;
end $$;
revoke all on function public.set_activity_cover(uuid, text) from public, anon;
grant execute on function public.set_activity_cover(uuid, text) to authenticated;
