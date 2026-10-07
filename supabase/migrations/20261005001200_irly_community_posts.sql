-- Community posts, live: feed with authors, likes and comments (the
-- universal interaction system), polls with one vote per member, posts
-- that point at an activity, member notifications, moderation by the
-- community's owner and moderators, and a weekly digest for the assistant.

-- ───────────────────────── Polls ─────────────────────────

create table if not exists public.community_poll_votes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  option smallint not null check (option between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.community_poll_votes enable row level security;

-- Read the votes of posts you can see; vote (and change your vote) only as
-- a member of the community, on an option that exists.
create or replace function private.can_vote(p_post uuid, p_option integer) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_posts p
    join public.community_members m on m.community_id = p.community_id and m.user_id = auth.uid()
    where p.id = p_post and p.deleted_at is null and p.poll is not null
      and p_option < jsonb_array_length(p.poll -> 'options')
  )
$$;
grant execute on function private.can_vote(uuid, integer) to authenticated;

drop policy if exists poll_votes_read on public.community_poll_votes;
create policy poll_votes_read on public.community_poll_votes for select to authenticated
  using (exists (select 1 from public.community_posts p where p.id = post_id));
drop policy if exists poll_votes_write on public.community_poll_votes;
create policy poll_votes_write on public.community_poll_votes for insert to authenticated
  with check (user_id = auth.uid() and private.can_vote(post_id, option));
drop policy if exists poll_votes_change on public.community_poll_votes;
create policy poll_votes_change on public.community_poll_votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and private.can_vote(post_id, option));
drop policy if exists poll_votes_delete on public.community_poll_votes;
create policy poll_votes_delete on public.community_poll_votes for delete to authenticated using (user_id = auth.uid());

-- ───────────────────────── Moderation ─────────────────────────

create or replace function private.moderates(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_members where community_id = cid and user_id = auth.uid() and role in ('owner', 'moderator'))
$$;
grant execute on function private.moderates(uuid) to authenticated;



-- Removing a post is a soft delete (deleted_at). The read rule hid deleted
-- posts from everyone, which also blocked the author and moderators from
-- deleting at all: they keep seeing the rows they may remove. Feeds filter
-- deleted posts themselves.
drop policy if exists community_posts_read on public.community_posts;
create policy community_posts_read on public.community_posts for select to authenticated
  using (
    exists (select 1 from public.communities c where c.id = community_id)
    and not private.is_blocked(auth.uid(), author_id)
    and (deleted_at is null or author_id = auth.uid() or private.moderates(community_id))
  );

-- Owners and moderators can remove any post of their community.
drop policy if exists community_posts_moderate on public.community_posts;
create policy community_posts_moderate on public.community_posts for update to authenticated
  using (private.moderates(community_id)) with check (private.moderates(community_id));

-- A post's activity must be one the author can see.
create or replace function private.community_post_shape() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.body := btrim(new.body);
  if new.activity_id is not null and not exists (select 1 from public.activities where id = new.activity_id) then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  return new;
end $$;
drop trigger if exists community_posts_shape on public.community_posts;
create trigger community_posts_shape before insert on public.community_posts
for each row execute function private.community_post_shape();

-- Members hear about new posts (mutable in notification preferences).
create or replace function private.on_community_post() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cname text;
begin
  select name into cname from public.communities where id = new.community_id;
  insert into public.notifications (user_id, kind, payload)
  select m.user_id, 'COMMUNITY_POST',
    jsonb_build_object('from', new.author_id, 'community_id', new.community_id, 'post_id', new.id, 'community', cname, 'body', left(new.body, 80))
  from public.community_members m
  where m.community_id = new.community_id and m.user_id <> new.author_id;
  return new;
end $$;
drop trigger if exists community_posts_created on public.community_posts;
create trigger community_posts_created after insert on public.community_posts
for each row execute function private.on_community_post();

-- ───────────────────────── Reads ─────────────────────────

create or replace function public.community_detail(p_id uuid)
returns table (id uuid, name text, tagline text, description text, category_id text, city_id text, girl_only boolean,
  members integer, is_member boolean, my_role text, conversation_id uuid, created_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select c.id, c.name, c.tagline, c.description, c.category_id, c.city_id, c.girl_only,
    (select count(*)::int from public.community_members m where m.community_id = c.id),
    private.i_belong(c.id),
    (select m.role from public.community_members m where m.community_id = c.id and m.user_id = auth.uid()),
    (select v.id from public.conversations v where v.community_id = c.id and private.is_member(v.id)),
    c.created_at
  from public.communities c
  where c.id = p_id and c.deleted_at is null
$$;

create or replace function public.community_list(p_city text)
returns table (id uuid, name text, tagline text, category_id text, girl_only boolean, members integer, is_member boolean, posts_week integer)
language sql stable security invoker set search_path = public as $$
  select c.id, c.name, c.tagline, c.category_id, c.girl_only,
    (select count(*)::int from public.community_members m where m.community_id = c.id),
    private.i_belong(c.id),
    (select count(*)::int from public.community_posts p where p.community_id = c.id and p.deleted_at is null and p.created_at > now() - interval '7 days')
  from public.communities c
  where c.city_id = p_city and c.deleted_at is null
  order by 8 desc, 6 desc, c.name
  limit 200
$$;

create or replace function public.community_feed(p_community uuid, p_limit integer default 30, p_before timestamptz default null)
returns table (id uuid, author_id uuid, first_name text, body text, activity_id uuid, activity_title text, activity_starts_at timestamptz,
  poll jsonb, poll_counts integer[], my_vote smallint, likes integer, comments integer, liked boolean, created_at timestamptz, mine boolean)
language sql stable security invoker set search_path = public as $$
  select p.id, p.author_id, a.first_name, p.body, p.activity_id, act.title, act.starts_at, p.poll,
    case when p.poll is null then null else array(
      select (select count(*)::int from public.community_poll_votes v where v.post_id = p.id and v.option = o.i)
      from generate_series(0, jsonb_array_length(p.poll -> 'options') - 1) o (i)
    ) end,
    (select v.option from public.community_poll_votes v where v.post_id = p.id and v.user_id = auth.uid()),
    (select count(*)::int from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text),
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    p.created_at, p.author_id = auth.uid()
  from public.community_posts p
  left join public.profiles_public a on a.id = p.author_id
  left join public.activities act on act.id = p.activity_id
  where p.community_id = p_community and p.deleted_at is null
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

-- The week in a community, for the assistant's digest.
create or replace function public.community_digest(p_community uuid)
returns table (posts_week integer, new_members_week integer, members integer, upcoming integer, next_title text, next_starts_at timestamptz,
  top_post_id uuid, top_post_body text, top_post_likes integer)
language sql stable security invoker set search_path = public as $$
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
    (select count(*)::int from public.community_members m where m.community_id = p_community and m.joined_at > now() - interval '7 days'),
    (select count(*)::int from public.community_members m where m.community_id = p_community),
    (select count(*)::int from public.activities a where a.community_id = p_community and a.cancelled_at is null and a.starts_at > now()),
    (select title from nxt), (select starts_at from nxt),
    (select id from top), (select body from top), (select n from top)
$$;

grant execute on function public.community_detail(uuid), public.community_list(text), public.community_feed(uuid, integer, timestamptz),
  public.community_digest(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.community_poll_votes;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
