-- IRLY Girl and IRLY Moms, completed on the existing backend (no parallel
-- system): one feed of the posts of the women-only communities, and a
-- moderation step that withdraws IRLY Girl from an account after reports.

-- ───────────────────────── Moderation: Girl access withdrawn ─────────────────────────

-- Gender is declared at signup and locked (profiles_guard). That alone is
-- self-declared, so moderation can withdraw IRLY Girl from an account, on
-- reports, without deleting the account or anything it wrote.
create table if not exists public.girl_suspensions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.girl_suspensions enable row level security;

-- The person concerned and admins may read it; nobody writes it directly.
drop policy if exists girl_suspensions_read on public.girl_suspensions;
create policy girl_suspensions_read on public.girl_suspensions for select to authenticated
  using (user_id = auth.uid() or private.is_admin(auth.uid()));

-- The single rule of IRLY Girl: a woman's account, not deleted, not suspended.
create or replace function private.girl_eligible_unchecked(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.gender = 'woman' and p.deleted_at is null
      and not exists (select 1 from public.girl_suspensions s where s.user_id = uid)
  )
$$;

-- Admins only. The account leaves the women-only communities and upcoming
-- women-only activities (their chats follow through the existing sync
-- triggers) and disappears from discovery. Posts and messages stay.
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
  delete from public.community_members m using public.communities c
    where m.community_id = c.id and c.girl_only and m.user_id = p_user and m.role <> 'owner';
  delete from public.activity_participants ap using public.activities a
    where ap.activity_id = a.id and a.girl_only and ap.user_id = p_user and a.starts_at > now() and a.creator_id <> p_user;
end $$;

create or replace function public.girl_reinstate(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.girl_suspensions where user_id = p_user;
end $$;

revoke all on function public.girl_suspend(uuid, text), public.girl_reinstate(uuid) from public, anon;
grant execute on function public.girl_suspend(uuid, text), public.girl_reinstate(uuid) to authenticated;

-- What the app asks when IRLY Girl is closed: 'woman' (open), 'suspended',
-- or 'not_eligible'. Says nothing about anyone else.
create or replace function public.my_girl_status() returns text
language sql stable security definer set search_path = public as $$
  select case
    when private.girl_eligible_unchecked(auth.uid()) then 'open'
    when exists (select 1 from public.girl_suspensions where user_id = auth.uid()) then 'suspended'
    else 'not_eligible'
  end
$$;
revoke all on function public.my_girl_status() from public, anon;
grant execute on function public.my_girl_status() to authenticated;

-- ───────────────────────── The IRLY Girl / Moms feed ─────────────────────────

-- Recent posts of the women-only communities of a destination (Moms: the
-- family communities). Security invoker: the existing read rules apply
-- (girl_only communities, blocks, deleted posts), and the gate is checked
-- again here so a direct call gets a clear refusal.
create or replace function public.girl_feed(p_city text, p_moms boolean default false, p_limit integer default 30, p_before timestamptz default null)
returns table (id uuid, community_id uuid, community_name text, author_id uuid, first_name text, body text,
  activity_id uuid, activity_title text, activity_starts_at timestamptz, likes integer, comments integer, liked boolean,
  created_at timestamptz, mine boolean, is_member boolean)
language plpgsql stable security invoker set search_path = public as $$
begin
  if not private.is_girl_eligible(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return query
  select p.id, c.id, c.name, p.author_id, a.first_name, p.body, p.activity_id, act.title, act.starts_at,
    (select count(*)::int from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text),
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    p.created_at, p.author_id = auth.uid(),
    exists (select 1 from public.community_members m where m.community_id = c.id and m.user_id = auth.uid())
  from public.community_posts p
  join public.communities c on c.id = p.community_id and c.deleted_at is null and c.girl_only
  left join public.profiles_public a on a.id = p.author_id
  left join public.activities act on act.id = p.activity_id
  where p.deleted_at is null
    and c.city_id = any (private.city_scope(p_city))
    and (not p_moms or c.category_id = 'family')
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 60);
end $$;
revoke all on function public.girl_feed(text, boolean, integer, timestamptz) from public, anon;
grant execute on function public.girl_feed(text, boolean, integer, timestamptz) to authenticated;
