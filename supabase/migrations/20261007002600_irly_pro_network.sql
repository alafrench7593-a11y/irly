-- IRLY Networking, professional side: a professional profile (role, job,
-- company, industries, skills, project, what you look for and offer, your
-- networking goals) and a discovery list of the other professionals of the
-- country, filtered on the server. "Connect" reuses friendships (add_friend),
-- so a connection opens the private chat like any other.
-- Only the owner reads and writes their row; others see it through
-- pro_discover / pro_profile_of, which respect blocks and profile visibility.

create table if not exists public.pro_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null check (role in ('entrepreneur', 'freelancer', 'employee', 'investor', 'founder')),
  job_title text not null check (char_length(btrim(job_title)) between 2 and 60),
  company text check (company is null or char_length(company) <= 60),
  industries text[] not null check (cardinality(industries) between 1 and 3 and industries <@ array[
    'tech', 'ai', 'saas', 'ecommerce', 'apps', 'fintech', 'marketing', 'design', 'business', 'startups', 'web3',
    'realestate', 'retail', 'food', 'media', 'creator', 'legal', 'education', 'health', 'mobility', 'trade']),
  skills text[] not null default '{}' check (cardinality(skills) <= 12),
  project text check (project is null or char_length(project) <= 200),
  looking_for text check (looking_for is null or char_length(looking_for) <= 200),
  can_offer text check (can_offer is null or char_length(can_offer) <= 200),
  intents text[] not null default '{}' check (intents <@ array[
    'meet', 'cofounder', 'clients', 'investors', 'partners', 'freelancers', 'suppliers', 'grow', 'ideas', 'opportunities', 'job']),
  city_id text not null references public.cities (id),
  area_id text,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pro_profiles_city_idx on public.pro_profiles (city_id) where visible;

-- Tidy what people type: trimmed, no empty or duplicate skills, short tags.
create or replace function private.pro_profile_shape() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.job_title := btrim(new.job_title);
  new.company := nullif(btrim(coalesce(new.company, '')), '');
  new.project := nullif(btrim(coalesce(new.project, '')), '');
  new.looking_for := nullif(btrim(coalesce(new.looking_for, '')), '');
  new.can_offer := nullif(btrim(coalesce(new.can_offer, '')), '');
  new.skills := coalesce((
    select array_agg(s order by n) from (
      select distinct on (lower(btrim(x))) left(btrim(x), 40) as s, n
      from unnest(new.skills) with ordinality as u (x, n)
      where btrim(x) <> ''
      order by lower(btrim(x)), n
    ) d), '{}');
  new.intents := coalesce((select array_agg(distinct i) from unnest(new.intents) i), '{}');
  new.industries := coalesce((select array_agg(distinct i) from unnest(new.industries) i), '{}');
  if new.area_id is not null and not exists (select 1 from public.areas a where a.city_id = new.city_id and a.id = new.area_id) then
    new.area_id := null;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists pro_profiles_shape on public.pro_profiles;
create trigger pro_profiles_shape before insert or update on public.pro_profiles
for each row execute function private.pro_profile_shape();

alter table public.pro_profiles enable row level security;
drop policy if exists pro_profiles_own_read on public.pro_profiles;
create policy pro_profiles_own_read on public.pro_profiles for select to authenticated using (user_id = auth.uid());
drop policy if exists pro_profiles_own_insert on public.pro_profiles;
create policy pro_profiles_own_insert on public.pro_profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists pro_profiles_own_update on public.pro_profiles;
create policy pro_profiles_own_update on public.pro_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists pro_profiles_own_delete on public.pro_profiles;
create policy pro_profiles_own_delete on public.pro_profiles for delete to authenticated using (user_id = auth.uid());

-- Where two members stand with each other.
create or replace function private.connection_state(me uuid, other uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when f.status = 'accepted' then 'connected' when f.requested_by = me then 'requested' else 'incoming' end
    from public.friendships f where f.user_a = least(me, other) and f.user_b = greatest(me, other)), 'none')
$$;
revoke all on function private.connection_state(uuid, uuid) from public, anon, authenticated;

-- Professionals of the country (own city first), filtered on the server.
-- p_filters: industry, role, intent, city (one city instead of the country), q (job, company, skill).
create or replace function public.pro_discover(p_city text, p_filters jsonb default '{}', p_limit integer default 120)
returns table (user_id uuid, first_name text, photo_path text, role text, job_title text, company text, industries text[],
  skills text[], project text, looking_for text, can_offer text, intents text[], city_id text, area_id text,
  lat numeric, lng numeric, connection text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  with f as (
    select nullif(p_filters ->> 'industry', '') as industry, nullif(p_filters ->> 'role', '') as role,
      nullif(p_filters ->> 'intent', '') as intent, nullif(p_filters ->> 'city', '') as city,
      '%' || replace(replace(btrim(coalesce(p_filters ->> 'q', '')), '%', ''), '_', '') || '%' as pat,
      btrim(coalesce(p_filters ->> 'q', '')) <> '' as has_q
  )
  select p.user_id, pr.first_name, pr.photo_paths[1], p.role, p.job_title, p.company, p.industries, p.skills, p.project,
    p.looking_for, p.can_offer, p.intents, p.city_id, p.area_id, a.lat, a.lng,
    private.connection_state(auth.uid(), p.user_id), p.updated_at
  from public.pro_profiles p
  join public.profiles pr on pr.id = p.user_id and pr.deleted_at is null
  left join public.areas a on a.city_id = p.city_id and a.id = p.area_id
  cross join f
  where auth.uid() is not null and p.user_id <> auth.uid() and p.visible
    and (case when f.city is not null then p.city_id = f.city else p.city_id = any (private.city_scope(p_city)) end)
    and (f.industry is null or f.industry = any (p.industries))
    and (f.role is null or p.role = f.role)
    and (f.intent is null or f.intent = any (p.intents))
    and (not f.has_q or p.job_title ilike f.pat or coalesce(p.company, '') ilike f.pat
      or array_to_string(p.skills, ' ') ilike f.pat or coalesce(p.project, '') ilike f.pat)
    and not private.blocked_unchecked(auth.uid(), p.user_id)
    and private.discoverable(p.user_id)
  order by (p.city_id = p_city) desc, p.updated_at desc
  limit least(greatest(p_limit, 1), 200)
$$;
revoke all on function public.pro_discover(text, jsonb, integer) from public, anon;
grant execute on function public.pro_discover(text, jsonb, integer) to authenticated;

-- One professional profile (yours, or someone you may see).
create or replace function public.pro_profile_of(p_user uuid)
returns table (user_id uuid, first_name text, photo_path text, role text, job_title text, company text, industries text[],
  skills text[], project text, looking_for text, can_offer text, intents text[], city_id text, area_id text,
  lat numeric, lng numeric, connection text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.user_id, pr.first_name, pr.photo_paths[1], p.role, p.job_title, p.company, p.industries, p.skills, p.project,
    p.looking_for, p.can_offer, p.intents, p.city_id, p.area_id, a.lat, a.lng,
    private.connection_state(auth.uid(), p.user_id), p.updated_at
  from public.pro_profiles p
  join public.profiles pr on pr.id = p.user_id and pr.deleted_at is null
  left join public.areas a on a.city_id = p.city_id and a.id = p.area_id
  where auth.uid() is not null and p.user_id = p_user
    and (p.user_id = auth.uid() or (p.visible and not private.blocked_unchecked(auth.uid(), p.user_id) and private.discoverable(p.user_id)))
$$;
revoke all on function public.pro_profile_of(uuid) from public, anon;
grant execute on function public.pro_profile_of(uuid) to authenticated;
