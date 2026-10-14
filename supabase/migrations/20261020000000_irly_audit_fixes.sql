-- Audit fixes (additive: no table or data removed, no policy loosened beyond
-- what is described).

-- ───────── 1. A host can always call off her own plan ─────────
-- A suspended IRLY Girl host could neither cancel nor edit her girl-only
-- activity: the women going kept a plan nobody could call off. Cancelling
-- (cancelled_at set) is now always allowed to the creator; other edits keep
-- the IRLY Girl rule.
drop policy if exists activities_creator on public.activities;
create policy activities_creator on public.activities for update to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid() and ((not girl_only) or private.is_girl_eligible() or cancelled_at is not null));

-- ───────── 2. A deleted activity takes its notifications with it ─────────
-- Joined / updated notices of a deleted activity opened "no longer available".
-- Only the "deleted" notice stays: it tells people going that it is off.
create or replace function private.purge_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k text := case tg_table_name when 'comments' then 'comment_id' when 'activities' then 'activity_id' else 'post_id' end;
begin
  if tg_op = 'DELETE' or (case when tg_table_name = 'irl_posts' then (to_jsonb(new) ->> 'expires_at')::timestamptz <= now()
                               else to_jsonb(new) ->> 'deleted_at' is not null end) then
    -- Likes and comments name what they are on as target_id.
    delete from public.notifications
    where (tg_table_name <> 'activities' and payload ->> k = old.id::text)
       or (tg_table_name = 'activities' and tg_op = 'DELETE' and payload ->> k = old.id::text
           and coalesce(payload ->> 'change', '') <> 'deleted')
       or (kind in ('LIKE', 'COMMENT', 'COMMENT_REPLY', 'MENTION') and payload ->> 'target_id' = old.id::text);
  end if;
  return null;
end $$;

-- ───────── 3. Long comment threads keep showing new comments ─────────
-- The thread stopped at the 500 oldest comments: past that, a new comment
-- vanished right after it was posted. Now: the 200 newest conversations
-- (top-level comments) with all their replies, shown oldest first as before.
create or replace function public.comment_thread(p_type text, p_id text)
returns table (id uuid, parent_id uuid, author_id uuid, first_name text, body text, created_at timestamptz,
  deleted boolean, likes integer, liked boolean)
language sql stable set search_path = public as $$
  with roots as (
    select c.id from public.comments c
    where c.target_type = p_type and c.target_id = p_id and c.parent_id is null
    order by c.created_at desc
    limit 200
  )
  select c.id, c.parent_id, c.author_id, p.first_name,
    case when c.deleted_at is null then c.body else '' end,
    c.created_at, c.deleted_at is not null,
    (select count(*)::int from public.likes l where l.target_type = 'comment' and l.target_id = c.id::text),
    exists (select 1 from public.likes l where l.target_type = 'comment' and l.target_id = c.id::text and l.user_id = auth.uid())
  from public.comments c
  left join public.profiles_public p on p.id = c.author_id
  where c.target_type = p_type and c.target_id = p_id
    and (c.id in (select r.id from roots r) or c.parent_id in (select r.id from roots r))
  order by coalesce(c.parent_id, c.id) = c.id desc, c.created_at
  limit 1000
$$;

-- ───────── 4. A category of a busy community shows its own posts ─────────
-- The category feed filtered the community's 100 newest posts: a quiet
-- category showed "No posts yet" while it had posts. Filter first, then limit.
create or replace function public.community_space_feed(p_community uuid, p_category text default null,
  p_limit integer default 30, p_before timestamptz default null)
returns table (id uuid, author_id uuid, first_name text, body text, activity_id uuid, activity_title text,
  activity_starts_at timestamptz, poll jsonb, poll_counts integer[], my_vote smallint, likes integer, comments integer,
  liked boolean, created_at timestamptz, mine boolean, media_paths text[], media_kind text, thumb_path text,
  media_seconds integer, edited_at timestamptz, kind text, category text, pinned_at timestamptz)
language sql stable set search_path = public as $$
  select p.id, p.author_id, a.first_name, p.body, p.activity_id, act.title, act.starts_at, p.poll,
    case when p.poll is null then null else array(
      select (select count(*)::int from public.community_poll_votes v where v.post_id = p.id and v.option = o.i)
      from generate_series(0, jsonb_array_length(p.poll -> 'options') - 1) o (i)
    ) end,
    (select v.option from public.community_poll_votes v where v.post_id = p.id and v.user_id = auth.uid()),
    (select count(*)::int from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text),
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    p.created_at, p.author_id = auth.uid(),
    p.media_paths, p.media_kind, p.thumb_path, p.media_seconds, p.edited_at,
    p.kind, p.category, pin.pinned_at
  from public.community_posts p
  left join public.profiles_public a on a.id = p.author_id
  left join public.activities act on act.id = p.activity_id
  left join public.community_pins pin on pin.post_id = p.id
  where p.community_id = p_community and p.deleted_at is null
    and p.category is not distinct from p_category
    and (p_before is null or p.created_at < p_before)
    and (p_before is null or pin.post_id is null)
  order by (pin.post_id is not null and p_before is null) desc, pin.pinned_at desc nulls last, p.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

-- ───────── 5. A sent message cannot be rewritten ─────────
-- The app never edits messages, but the table let a sender change the text
-- of any past message (even one that was reported). The text is now frozen
-- like the sender and the time; deleting still erases it.
drop trigger if exists messages_edit_guard on public.messages;
create trigger messages_edit_guard before update on public.messages
for each row execute function private.edit_guard('conversation_id', 'sender_id', 'kind', 'created_at', 'ref_type', 'ref_id', 'body');

-- ───────── 6. Joining a chat does not mark its whole history unread ─────────
-- New members (group, community, activity) started with "read nothing yet":
-- joining a busy community showed 99+ unread. They start read up to now.
create or replace function private.member_read_from_now() returns trigger
language plpgsql set search_path = public as $$
begin
  new.last_read_at := coalesce(new.last_read_at, now());
  return new;
end $$;
revoke all on function private.member_read_from_now() from public, anon, authenticated;
drop trigger if exists conversation_members_read_from_now on public.conversation_members;
create trigger conversation_members_read_from_now before insert on public.conversation_members
for each row execute function private.member_read_from_now();

-- ───────── 7. Friend requests: one decision at a time, one ping a week ─────────
-- Cancel and accept at the same moment could delete a friendship just
-- accepted: removing takes the same per-pair lock as asking.
create or replace function public.remove_friend(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a uuid := least(auth.uid(), p_user);
  b uuid := greatest(auth.uid(), p_user);
begin
  perform pg_advisory_xact_lock(hashtextextended('friend:' || a::text || b::text, 0));
  delete from public.friendships where user_a = a and user_b = b;
end $$;

-- Ask, cancel, ask again… pinged (and pushed) every time, because cancelling
-- deletes the request's notification the weekly check relied on. The last
-- ping is now kept on its own.
create table if not exists private.friend_request_pings (
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  primary key (from_id, to_id)
);
revoke all on private.friend_request_pings from public, anon, authenticated;

create or replace function public.add_friend(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a uuid := least(me, p_user);
  b uuid := greatest(me, p_user);
  f public.friendships;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_user is null or p_user = me then raise exception 'that is you' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_user and deleted_at is null)
     or private.blocked_unchecked(me, p_user) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  -- One decision per pair at a time.
  perform pg_advisory_xact_lock(hashtextextended('friend:' || a::text || b::text, 0));
  select * into f from public.friendships where user_a = a and user_b = b;
  if not found then
    insert into public.friendships (user_a, user_b, requested_by) values (a, b, me) on conflict do nothing;
    -- Asking again after removing does not ping them again for a week.
    if not exists (
      select 1 from private.friend_request_pings r
      where r.from_id = me and r.to_id = p_user and r.at > now() - interval '7 days'
    ) and not exists (
      select 1 from public.notifications n
      where n.user_id = p_user and n.kind = 'FRIEND_REQUEST' and n.payload ->> 'from' = me::text
        and n.created_at > now() - interval '7 days'
    ) then
      perform private.notify(p_user, 'FRIEND_REQUEST', jsonb_build_object('from', me));
      insert into private.friend_request_pings (from_id, to_id) values (me, p_user)
      on conflict (from_id, to_id) do update set at = now();
    end if;
    return 'pending';
  end if;
  if f.status = 'pending' and f.requested_by <> me then
    update public.friendships set status = 'accepted', accepted_at = now() where user_a = a and user_b = b;
    update public.notifications set read_at = coalesce(read_at, now())
      where user_id = me and kind in ('FRIEND_REQUEST', 'PRO_CONNECT_REQUEST') and payload ->> 'from' = p_user::text;
    perform private.notify(p_user, 'FRIEND_ACCEPTED', jsonb_build_object('from', me));
    return 'accepted';
  end if;
  return f.status;
end $$;
