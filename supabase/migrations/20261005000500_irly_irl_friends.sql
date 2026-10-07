-- Friends and IRL (live posts). Friends see each other's IRL posts; IRL
-- posts expire after 4 hours and only ever show a neighbourhood or venue.

create table if not exists public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists friendships_b_idx on public.friendships (user_b);

create or replace function private.friends_unchecked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted'
  )
$$;

-- Clients may only ask about their own friendships.
create or replace function private.are_friends(a uuid, b uuid) returns boolean
language plpgsql stable security invoker set search_path = public as $$
begin
  perform private.assert_self(a, b);
  return private.friends_unchecked(a, b);
end $$;

alter table public.friendships enable row level security;
drop policy if exists friendships_mine on public.friendships;
create policy friendships_mine on public.friendships for select to authenticated using (auth.uid() in (user_a, user_b));

-- Ask, or accept when the other person already asked you.
create or replace function public.add_friend(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  f public.friendships;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_user = me or private.blocked_unchecked(me, p_user) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  select * into f from public.friendships where user_a = least(me, p_user) and user_b = greatest(me, p_user);
  if f.user_a is null then
    insert into public.friendships (user_a, user_b, requested_by) values (least(me, p_user), greatest(me, p_user), me);
    perform private.notify(p_user, 'PROFILE_UPDATED', jsonb_build_object('type', 'friend_request', 'from', me));
    return 'pending';
  end if;
  if f.status = 'pending' and f.requested_by <> me then
    update public.friendships set status = 'accepted', accepted_at = now() where user_a = f.user_a and user_b = f.user_b;
    perform private.notify(p_user, 'PROFILE_UPDATED', jsonb_build_object('type', 'friend_accepted', 'from', me));
    return 'accepted';
  end if;
  return f.status;
end $$;

create or replace function public.remove_friend(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.friendships where user_a = least(auth.uid(), p_user) and user_b = greatest(auth.uid(), p_user)
$$;

-- Friends with names, and requests waiting for you.
create or replace function public.my_friends()
returns table (user_id uuid, first_name text, status text, incoming boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, f.status, f.status = 'pending' and f.requested_by <> auth.uid()
  from public.friendships f
  join public.profiles p on p.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  where auth.uid() in (f.user_a, f.user_b) and p.deleted_at is null
  order by f.status, p.first_name
$$;

-- ───────────────────────── IRL posts ─────────────────────────

create table if not exists public.irl_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  city_id text not null,
  area_id text not null,
  place_name text check (place_name is null or char_length(place_name) <= 80),
  body text not null check (char_length(body) between 1 and 160),
  media_path text,
  visibility text not null default 'friends' check (visibility in ('everyone', 'friends')),
  activity_id uuid references public.activities (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '4 hours'
);

create index if not exists irl_posts_city_idx on public.irl_posts (city_id, expires_at desc);

alter table public.irl_posts enable row level security;

drop policy if exists irl_posts_read on public.irl_posts;
create policy irl_posts_read on public.irl_posts for select to authenticated
  using (
    author_id = auth.uid()
    or (
      expires_at > now()
      and not private.is_blocked(auth.uid(), author_id)
      and (visibility = 'everyone' or private.are_friends(auth.uid(), author_id))
    )
  );
drop policy if exists irl_posts_insert on public.irl_posts;
create policy irl_posts_insert on public.irl_posts for insert to authenticated
  with check (author_id = auth.uid() and expires_at <= now() + interval '4 hours 1 minute');
drop policy if exists irl_posts_delete on public.irl_posts;
create policy irl_posts_delete on public.irl_posts for delete to authenticated using (author_id = auth.uid());

-- Friends hear about it (one notification each).
create or replace function private.on_irl_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, payload)
  select case when f.user_a = new.author_id then f.user_b else f.user_a end, 'IRLY_POST_CREATED',
    jsonb_build_object('post_id', new.id, 'from', new.author_id, 'body', left(new.body, 80), 'area_id', new.area_id)
  from public.friendships f
  where f.status = 'accepted' and new.author_id in (f.user_a, f.user_b)
    and new.visibility in ('friends', 'everyone');
  return new;
end $$;

drop trigger if exists irl_posts_created on public.irl_posts;
create trigger irl_posts_created after insert on public.irl_posts
for each row execute function private.on_irl_post();

-- First names only, readable by signed-in members (feeds, lists).
create or replace view public.profiles_public with (security_barrier = true) as
  select id, first_name, city_id from public.profiles where deleted_at is null;
grant select on public.profiles_public to authenticated;

-- Author names for the feed without exposing whole profiles.
create or replace function public.irl_feed(p_city text)
returns table (id uuid, author_id uuid, first_name text, area_id text, place_name text, body text, media_path text, visibility text, created_at timestamptz, friend boolean)
language sql stable security invoker set search_path = public as $$
  select i.id, i.author_id, p.first_name, i.area_id, i.place_name, i.body, i.media_path, i.visibility, i.created_at,
    private.are_friends(auth.uid(), i.author_id)
  from public.irl_posts i
  cross join lateral (select first_name from public.profiles_public where id = i.author_id) p
  where i.city_id = p_city and i.expires_at > now()
  order by i.created_at desc
  limit 100
$$;

grant execute on function private.are_friends(uuid, uuid), private.friends_unchecked(uuid, uuid) to authenticated;
revoke all on function public.add_friend(uuid), public.remove_friend(uuid), public.my_friends() from public, anon;
grant execute on function public.add_friend(uuid), public.remove_friend(uuid), public.my_friends(), public.irl_feed(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.irl_posts, public.friendships;
  end if;
exception when duplicate_object then null;
end $$;
