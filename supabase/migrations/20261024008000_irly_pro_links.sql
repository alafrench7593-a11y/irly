-- IRLY Network: a professional profile can carry the member's own links
-- (LinkedIn, website, Instagram, TikTok). Additive: four nullable columns on
-- pro_profiles, each checked on the server (https only, at most 200
-- characters, the platform's own host and profile path for LinkedIn,
-- Instagram and TikTok, a plain https address with a real domain name for a
-- website: no IP address, no port, no user:password@, no spaces).
--
-- Row level security is unchanged: only the owner reads and writes their row
-- (the pro_profiles_own_* policies). Others read the links through
-- pro_links_of, with exactly the rule of pro_profile_of (visible profile, not
-- blocked either way, profile visibility), so links are readable where the
-- professional profile is readable, and nowhere else.
-- Tests: supabase/tests/pro_links.test.sql.

alter table public.pro_profiles add column if not exists linkedin_url text;
alter table public.pro_profiles add column if not exists website_url text;
alter table public.pro_profiles add column if not exists instagram_url text;
alter table public.pro_profiles add column if not exists tiktok_url text;

alter table public.pro_profiles drop constraint if exists pro_profiles_linkedin_url_check;
alter table public.pro_profiles add constraint pro_profiles_linkedin_url_check check (
  linkedin_url is null or (char_length(linkedin_url) <= 200
    and linkedin_url ~* '^https://([a-z]{2,3}\.)?linkedin\.com/(in|company|school)/[^[:space:]/?#<>"'']{2,100}/?$'));

alter table public.pro_profiles drop constraint if exists pro_profiles_website_url_check;
alter table public.pro_profiles add constraint pro_profiles_website_url_check check (
  website_url is null or (char_length(website_url) <= 200
    and website_url ~* '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}([/?#][^[:space:]<>"''\\]*)?$'));

alter table public.pro_profiles drop constraint if exists pro_profiles_instagram_url_check;
alter table public.pro_profiles add constraint pro_profiles_instagram_url_check check (
  instagram_url is null or (char_length(instagram_url) <= 200
    and instagram_url ~* '^https://(www\.)?instagram\.com/[a-z0-9._]{1,30}/?$'));

alter table public.pro_profiles drop constraint if exists pro_profiles_tiktok_url_check;
alter table public.pro_profiles add constraint pro_profiles_tiktok_url_check check (
  tiktok_url is null or (char_length(tiktok_url) <= 200
    and tiktok_url ~* '^https://(www\.)?tiktok\.com/@[a-z0-9._]{2,24}/?$'));

-- What people type: trimmed, an empty field is no link.
create or replace function private.pro_links_shape() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.linkedin_url := nullif(btrim(coalesce(new.linkedin_url, '')), '');
  new.website_url := nullif(btrim(coalesce(new.website_url, '')), '');
  new.instagram_url := nullif(btrim(coalesce(new.instagram_url, '')), '');
  new.tiktok_url := nullif(btrim(coalesce(new.tiktok_url, '')), '');
  return new;
end $$;

drop trigger if exists pro_profiles_links_shape on public.pro_profiles;
create trigger pro_profiles_links_shape before insert or update on public.pro_profiles
for each row execute function private.pro_links_shape();

-- One professional's links (yours, or someone whose professional profile you may see).
create or replace function public.pro_links_of(p_user uuid)
returns table (user_id uuid, linkedin_url text, website_url text, instagram_url text, tiktok_url text)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.linkedin_url, p.website_url, p.instagram_url, p.tiktok_url
  from public.pro_profiles p
  join public.profiles pr on pr.id = p.user_id and pr.deleted_at is null
  where auth.uid() is not null and p.user_id = p_user
    and (p.user_id = auth.uid() or (p.visible and not private.blocked_unchecked(auth.uid(), p.user_id) and private.discoverable(p.user_id)))
$$;
revoke all on function public.pro_links_of(uuid) from public, anon;
grant execute on function public.pro_links_of(uuid) to authenticated;
