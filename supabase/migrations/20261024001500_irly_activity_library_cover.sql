-- An activity's photo can be a photo of the IRLY library (chosen when the
-- activity is created: « IRLY library » or « Surprise me »), saved in the
-- same column as an uploaded photo, cover_path, as its https link. Every
-- screen already shows cover_path first (a link stands for itself, an
-- upload is signed), so the chosen photo shows everywhere, for everyone.
--
-- Only links to IRLY's own photo sets are accepted (the app's photo library,
-- IRLY's own Dubai photos, the Unsplash photos the app ships): never a link
-- to anywhere else (tracking pixels, other people's pictures). Uploaded
-- photos keep their rule: the host's own upload, or a content staff upload.
-- Additive: replaces the guard function only; the trigger and every policy stay.

create or replace function private.activity_cover_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.cover_path is null then return new; end if;
  if tg_op = 'UPDATE' and new.cover_path is not distinct from old.cover_path then return new; end if;
  -- A photo of the IRLY library: its link, on IRLY's photo hosts only, no spaces, no quotes, ≤ 400 characters.
  if new.cover_path ~ '^https://(alafrench7593-a11y\.github\.io/irly/photos/|getirly\.com/img/own/|images\.unsplash\.com/photo-)[A-Za-z0-9._~/?&=%-]+$'
     and char_length(new.cover_path) <= 400 and new.cover_path !~ '\.\.' then
    return new;
  end if;
  if new.cover_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$' then
    raise exception 'the photo must be one of your own uploads or an IRLY library photo' using errcode = '42501';
  end if;
  if split_part(new.cover_path, '/', 1) = new.creator_id::text then return new; end if;
  if private.own_upload(new.cover_path) and private.is_content_staff(auth.uid()) then return new; end if;
  raise exception 'the photo must be one of your own uploads' using errcode = '42501';
end $$;
