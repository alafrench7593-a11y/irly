-- A plan's photo can be one of the IRLY team's photos (owner report, live
-- E2E 2026-11-10: « Not published: the photo must be one of your own uploads
-- or an IRLY library photo » when creating a yoga plan).
--
-- The team replaces library photos from the back office (public.app_photo_overrides,
-- migration 20261027700000): the app then offers that photo, served from this
-- project's public « app-photos » bucket, in the IRLY library and in « Surprise
-- me ». The cover rule (20261024001500) only knew the library's other hosts, so
-- a member who got a team photo (yoga, brunch, meeting… replaced in production)
-- could not publish the plan.
--
-- Now also accepted: the public link of a photo the team set in
-- app_photo_overrides (current file only, with or without its ?v= version).
-- Nothing else from that bucket, and nothing from any other bucket or host.
-- Same rule otherwise. Additive: replaces the guard function only.

/** Whether a file of the app-photos bucket is a photo the team set in the library now. */
create or replace function private.team_photo_path(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_photo_overrides o where o.storage_path = p_path)
$$;
revoke all on function private.team_photo_path(text) from public, anon;
grant execute on function private.team_photo_path(text) to authenticated;

create or replace function private.activity_cover_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  team_base constant text := 'https://yqutcmgslwxcmnsqmhvy.supabase.co/storage/v1/object/public/app-photos/';
begin
  if new.cover_path is null then return new; end if;
  if tg_op = 'UPDATE' and new.cover_path is not distinct from old.cover_path then return new; end if;
  -- A photo of the IRLY library: its link, on IRLY's photo hosts only, no spaces, no quotes, ≤ 400 characters.
  if new.cover_path ~ '^https://(alafrench7593-a11y\.github\.io/irly/photos/|getirly\.com/img/own/|images\.unsplash\.com/photo-)[A-Za-z0-9._~/?&=%-]+$'
     and char_length(new.cover_path) <= 400 and new.cover_path !~ '\.\.' then
    return new;
  end if;
  -- A photo the IRLY team put in the library (back office): its current public link.
  if new.cover_path ~ ('^' || replace(team_base, '.', '\.') || '[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}(\?v=[0-9]{1,12})?$')
     and private.team_photo_path(substr(split_part(new.cover_path, '?', 1), char_length(team_base) + 1)) then
    return new;
  end if;
  if new.cover_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$' then
    raise exception 'the photo must be one of your own uploads or an IRLY library photo' using errcode = '42501';
  end if;
  if split_part(new.cover_path, '/', 1) = new.creator_id::text then return new; end if;
  if private.own_upload(new.cover_path) and private.is_content_staff(auth.uid()) then return new; end if;
  raise exception 'the photo must be one of your own uploads' using errcode = '42501';
end $$;
