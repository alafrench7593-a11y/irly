-- Security fixes from the bug hunt (each one reproduced on a scratch
-- database first, see supabase/tests/irly_test.sql "Bug hunt" section).
--
--  1. Profiles: no self-DELETE (delete + re-insert bypassed the gender lock
--     and undid admin soft-deletes); other members never read birthdate,
--     faith, gender or is_admin (shared chats exposed them).
--  2. Posts, comments, messages: only the text (and deleted_at) is editable;
--     author, community, conversation, kind and dates are fixed, and a
--     removal (moderation or 3 reports) cannot be undone by its author.
--  3. Removed comments and deleted messages are no longer readable.
--  4. Mentions: only people who can see the post, each once, existing only.
--  5. join_activity honours privacy (friends, community, invite).
--  6. Blocking ends the friendship.
--  7. Match: hidden age/languages never leak through filters or reasons;
--     'friends' and 'communities' visibility are enforced.
--  8. No repeated ACTIVITY_JOINED / FRIEND_REQUEST / COMMUNITY_JOINED.
--  9. Girl-only community activities stay invisible to non-eligible members.

-- ───────── 1. Profiles ─────────

drop policy if exists profiles_self on public.profiles;
drop policy if exists profiles_self_read on public.profiles;
drop policy if exists profiles_self_insert on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_read on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() and deleted_at is null);
-- A soft-deleted profile is frozen (only an admin brings it back).
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid() and deleted_at is null) with check (id = auth.uid());

-- Column privileges: the row policies decide WHO, this decides WHAT. Every
-- column except the sensitive ones; the app reads its own sensitive data
-- through security-definer functions only.
create or replace function private.restrict_profile_columns() returns void
language plpgsql security definer set search_path = public as $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
    and column_name not in ('birthdate', 'faith', 'gender', 'is_admin');
  execute 'revoke select on public.profiles from anon, authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;
revoke all on function private.restrict_profile_columns() from public, anon, authenticated;
select private.restrict_profile_columns();

-- ───────── 2. What an edit may change ─────────

create or replace function private.edit_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  fixed text[] := tg_argv;
  k text;
begin
  -- Server jobs and admins are not limited.
  if auth.uid() is null or private.is_admin(auth.uid()) then
    return new;
  end if;
  foreach k in array fixed loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
      raise exception '% cannot be changed', k using errcode = '42501';
    end if;
  end loop;
  if old.deleted_at is not null and new.deleted_at is null then
    raise exception 'a removed item cannot be restored' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists community_posts_edit_guard on public.community_posts;
create trigger community_posts_edit_guard before update on public.community_posts
for each row execute function private.edit_guard('community_id', 'author_id', 'created_at');
drop trigger if exists comments_edit_guard on public.comments;
create trigger comments_edit_guard before update on public.comments
for each row execute function private.edit_guard('target_type', 'target_id', 'author_id', 'parent_id', 'mentions', 'created_at');
drop trigger if exists messages_edit_guard on public.messages;
create trigger messages_edit_guard before update on public.messages
for each row execute function private.edit_guard('conversation_id', 'sender_id', 'kind', 'created_at', 'ref_type', 'ref_id');

-- Moderators remove posts; they never rewrite them.
create or replace function private.moderator_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or private.is_admin(auth.uid()) or auth.uid() = old.author_id then
    return new;
  end if;
  if (to_jsonb(new) - 'deleted_at' - 'updated_at') is distinct from (to_jsonb(old) - 'deleted_at' - 'updated_at') then
    raise exception 'moderators can only remove a post' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists community_posts_moderator_guard on public.community_posts;
create trigger community_posts_moderator_guard before update on public.community_posts
for each row execute function private.moderator_guard();

-- ───────── 3. Removed content is not readable ─────────

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to authenticated
  using (
    private.can_see(target_type, target_id)
    and not private.is_blocked(auth.uid(), author_id)
    and (deleted_at is null or author_id = auth.uid())
  );
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated
  using (private.is_member(conversation_id) and (deleted_at is null or sender_id = auth.uid()));

-- ───────── 4. Mentions ─────────

-- Could this member see the commented item? (Mentions only; a conservative
-- definer-side copy of the read rules.)
create or replace function private.user_can_see(p_user uuid, p_type text, p_id text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  cid uuid;
  a public.activities;
  author uuid;
begin
  if p_type in ('place', 'catalog') then return true; end if;
  if not private.is_uuid(p_id) then return false; end if;
  if p_type = 'community' then
    return exists (select 1 from public.community_members where community_id = p_id::uuid and user_id = p_user);
  elsif p_type = 'community_post' then
    select community_id into cid from public.community_posts where id = p_id::uuid and deleted_at is null;
    return cid is not null and exists (select 1 from public.community_members where community_id = cid and user_id = p_user);
  elsif p_type = 'activity' then
    select * into a from public.activities where id = p_id::uuid;
    if not found or private.blocked_unchecked(p_user, a.creator_id) then return false; end if;
    return a.creator_id = p_user
      or exists (select 1 from public.activity_participants where activity_id = a.id and user_id = p_user)
      or (a.privacy = 'public' and a.cancelled_at is null and (not a.girl_only or private.girl_eligible_unchecked(p_user)));
  elsif p_type = 'irl_post' then
    select author_id into author from public.irl_posts where id = p_id::uuid;
    return author is not null and (author = p_user or private.friends_unchecked(author, p_user))
      and not private.blocked_unchecked(author, p_user);
  elsif p_type = 'profile' then
    return not private.blocked_unchecked(p_user, p_id::uuid);
  end if;
  return false;
end $$;
revoke all on function private.user_can_see(uuid, text, text) from public, anon, authenticated;

create or replace function private.on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  owner uuid := private.owner_of(new.target_type, new.target_id);
  parent_author uuid;
  payload jsonb := jsonb_build_object('from', new.author_id, 'target_type', new.target_type, 'target_id', new.target_id,
    'comment_id', new.id, 'body', left(new.body, 80));
  m uuid;
begin
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    if parent_author is not null and parent_author <> new.author_id then
      perform private.notify(parent_author, 'COMMENT_REPLY', payload);
    end if;
  end if;
  if owner is not null and owner <> new.author_id and owner is distinct from parent_author then
    perform private.notify(owner, 'COMMENT', payload);
  end if;
  -- Each mentioned member once, only real accounts, only if they can see it.
  for m in
    select distinct x from unnest(coalesce(new.mentions, '{}')) x
    join public.profiles p on p.id = x and p.deleted_at is null
  loop
    if m <> new.author_id and m is distinct from owner and m is distinct from parent_author
      and not private.blocked_unchecked(m, new.author_id)
      and private.user_can_see(m, new.target_type, new.target_id) then
      perform private.notify(m, 'MENTION', payload);
    end if;
  end loop;
  return new;
end $$;

-- ───────── 5. Joining honours privacy ─────────

create or replace function public.join_activity(p_activity uuid, p_status text default 'going') returns text
language plpgsql security definer set search_path = public as $$
declare
  a public.activities;
  going integer;
  conv uuid;
  me uuid := auth.uid();
  before text;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  select * into a from public.activities where id = p_activity and cancelled_at is null for update;
  if not found then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  if a.girl_only and not private.is_girl_eligible(me) then
    raise exception 'this activity is reserved for IRLY Girl' using errcode = '42501';
  end if;
  if private.is_blocked(me, a.creator_id) then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  select status into before from public.activity_participants where activity_id = p_activity and user_id = me;
  -- Who may join: anyone (public), the creator's friends, the community's
  -- members, or (invite) people it was shared with in a chat they are in.
  if a.creator_id <> me and before is null and not (
    a.privacy = 'public'
    or (a.privacy = 'friends' and private.friends_unchecked(me, a.creator_id))
    or (a.privacy = 'community' and a.community_id is not null
        and exists (select 1 from public.community_members where community_id = a.community_id and user_id = me))
    or (a.privacy = 'invite' and exists (
        select 1 from public.messages msg
        join public.conversation_members cm on cm.conversation_id = msg.conversation_id and cm.user_id = me
        where msg.ref_type = 'activity' and msg.ref_id::text = p_activity::text and msg.deleted_at is null))
  ) then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  if p_status = 'going' and a.capacity is not null then
    select count(*) into going from public.activity_participants
    where activity_id = p_activity and status = 'going' and user_id <> me;
    if going >= a.capacity then
      return 'full';
    end if;
  end if;
  insert into public.activity_participants (activity_id, user_id, status) values (p_activity, me, p_status)
  on conflict (activity_id, user_id) do update set status = excluded.status;
  conv := private.ensure_conversation('activity', p_activity, a.title);
  if p_status = 'going' then
    insert into public.conversation_members (conversation_id, user_id) values (conv, me) on conflict do nothing;
    -- Once per person and activity, however often they switch going/maybe.
    if a.creator_id <> me and not exists (
      select 1 from public.notifications n
      where n.user_id = a.creator_id and n.kind = 'ACTIVITY_JOINED'
        and n.payload ->> 'activity_id' = p_activity::text and n.payload ->> 'user_id' = me::text
    ) then
      perform private.notify(a.creator_id, 'ACTIVITY_JOINED', jsonb_build_object('activity_id', p_activity, 'user_id', me));
    end if;
  else
    delete from public.conversation_members where conversation_id = conv and user_id = me and user_id <> a.creator_id;
  end if;
  return p_status;
end $$;

-- Friends-only activities are visible to friends; girl-only community
-- activities only to eligible members.
drop policy if exists activities_read on public.activities;
create policy activities_read on public.activities for select to authenticated
  using (
    creator_id = auth.uid()
    or private.i_participate(id)
    or (
      cancelled_at is null
      and (not girl_only or private.is_girl_eligible())
      and not private.is_blocked(auth.uid(), creator_id)
      and (
        privacy = 'public'
        or (privacy = 'community' and community_id is not null and private.i_belong(community_id))
        or (privacy = 'friends' and private.are_friends(auth.uid(), creator_id))
      )
    )
  );

-- ───────── 6. Blocking ends the friendship ─────────

create or replace function private.on_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships where user_a = least(new.blocker_id, new.blocked_id) and user_b = greatest(new.blocker_id, new.blocked_id);
  return new;
end $$;
drop trigger if exists blocks_end_friendship on public.blocks;
create trigger blocks_end_friendship after insert on public.blocks for each row execute function private.on_block();
delete from public.friendships f using public.blocks b
where f.user_a = least(b.blocker_id, b.blocked_id) and f.user_b = greatest(b.blocker_id, b.blocked_id);

-- ───────── 7. Visibility settings ─────────

create or replace function private.visible_to(viewer uuid, target uuid, vis text) returns boolean
language sql stable security definer set search_path = public as $$
  select case coalesce(vis, 'everyone')
    when 'everyone' then true
    when 'nobody' then false
    when 'friends' then private.friends_unchecked(viewer, target)
    when 'communities' then private.friends_unchecked(viewer, target) or exists (
      select 1 from public.community_members a join public.community_members b on b.community_id = a.community_id
      where a.user_id = viewer and b.user_id = target)
    else false
  end
$$;
revoke all on function private.visible_to(uuid, uuid, text) from public, anon, authenticated;

create or replace function private.discoverable(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.visible_to(auth.uid(), uid, (select s.profile_visibility from public.safety_settings s where s.user_id = uid))
$$;
grant execute on function private.discoverable(uuid) to authenticated;

create or replace function public.irly_match_discover(p_filters jsonb default '{}', p_limit integer default 20, p_offset integer default 0)
returns table (
  user_id uuid,
  first_name text,
  age integer,
  city_id text,
  bio text,
  photo_paths text[],
  interests text[],
  sports text[],
  activities text[],
  goals text[],
  languages text[],
  areas text[],
  travel text[],
  active_now boolean,
  is_new boolean,
  saved boolean,
  score integer,
  reasons jsonb
)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
  my_city text;
  section text := coalesce(p_filters ->> 'section', 'for_you');
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  me_profile public.irly_match_profiles;
begin
  select * into me_profile from public.irly_match_profiles where irly_match_profiles.user_id = me;
  if me_profile.user_id is null then
    raise exception 'create your IRLY Match profile first' using errcode = 'P0001';
  end if;
  select p.city_id into my_city from public.profiles p where p.id = me;

  return query
  with candidates as (
    select mp.*, p.first_name as fname, p.city_id as pcity, p.created_at as pcreated, p.arrived_at,
      private.age_of(mp.user_id) as page,
      coalesce(s.show_active, false) as show_active,
      exists (select 1 from public.irly_match_actions sa where sa.actor_id = me and sa.target_id = mp.user_id and sa.action = 'save') as is_saved
    from public.irly_match_profiles mp
    join public.profiles p on p.id = mp.user_id and p.deleted_at is null and p.gender = 'woman'
    left join public.safety_settings s on s.user_id = mp.user_id
    where mp.user_id <> me
      and mp.visible
      and private.visible_to(me, mp.user_id, s.profile_visibility)
      and not private.is_blocked(me, mp.user_id)
      and not exists (select 1 from public.irly_match_actions d where d.actor_id = me and d.target_id = mp.user_id and d.action in ('like', 'pass'))
      and not exists (
        select 1 from public.irly_matches m
        where m.user_a = least(me, mp.user_id) and m.user_b = greatest(me, mp.user_id) and m.removed_at is null
      )
  ),
  filtered as (
    select c.* from candidates c
    where (section <> 'saved' or c.is_saved)
      and (p_filters -> 'interests' is null or c.interests && array(select jsonb_array_elements_text(p_filters -> 'interests')))
      and (p_filters ->> 'sport' is null or (p_filters ->> 'sport') = any (c.sports))
      and (p_filters ->> 'language' is null or ((p_filters ->> 'language') = any (c.languages) and not 'languages' = any (c.hidden_fields)))
      and (p_filters ->> 'goal' is null or (p_filters ->> 'goal') = any (c.goals))
      and (p_filters ->> 'area' is null or ((p_filters ->> 'area') = any (c.areas) and not 'areas' = any (c.hidden_fields)))
      and (p_filters ->> 'availability' is null or (p_filters ->> 'availability') = any (c.availability))
      and (p_filters ->> 'community_id' is null or exists (
        select 1 from public.community_members cm where cm.user_id = c.user_id and cm.community_id = (p_filters ->> 'community_id')::uuid))
      and (coalesce((p_filters ->> 'travel')::boolean, false) = false or cardinality(c.travel) > 0)
      -- A hidden age never answers an age filter (narrowing the range would reveal it).
      and (p_filters ->> 'age_min' is null or (not 'age' = any (c.hidden_fields) and c.page >= (p_filters ->> 'age_min')::integer))
      and (p_filters ->> 'age_max' is null or (not 'age' = any (c.hidden_fields) and c.page <= (p_filters ->> 'age_max')::integer))
      and case section
        when 'new' then coalesce(c.arrived_at, c.pcreated::date) >= current_date - 60
        when 'active' then c.show_active and c.last_active_at > now() - interval '15 minutes'
        when 'nearby' then c.areas && me_profile.areas and not 'areas' = any (c.hidden_fields)
        when 'interests' then c.interests && me_profile.interests
        when 'sports' then c.sports && me_profile.sports
        when 'travel' then cardinality(c.travel) > 0
        else c.pcity = my_city
      end
  ),
  scored as (
    select f.*, s.score as sc, s.reasons as rs
    from filtered f, lateral private.match_score(me, f.user_id) s
  )
  select
    sc.user_id,
    sc.fname,
    case when 'age' = any (sc.hidden_fields) then null else sc.page end,
    sc.pcity,
    sc.bio,
    sc.photo_paths,
    sc.interests,
    sc.sports,
    sc.activities,
    sc.goals,
    case when 'languages' = any (sc.hidden_fields) then '{}'::text[] else sc.languages end,
    case when 'areas' = any (sc.hidden_fields) then '{}'::text[] else sc.areas end,
    sc.travel,
    sc.show_active and sc.last_active_at > now() - interval '15 minutes',
    coalesce(sc.arrived_at, sc.pcreated::date) >= current_date - 60,
    sc.is_saved,
    sc.sc,
    -- Never reveal which hidden fields matched.
    sc.rs - array(select f from unnest(array['areas', 'languages', 'age']) f where f = any (sc.hidden_fields))
  from scored sc
  where sc.sc >= (select min_score from public.irly_match_config where id = 1)
  order by sc.sc desc, sc.last_active_at desc
  limit lim offset greatest(coalesce(p_offset, 0), 0);
end $$;


create or replace function public.girl_circle(
  p_destination text,
  p_status text default null,
  p_moms boolean default false,
  p_area text default null,
  p_limit integer default 30,
  p_looking text default null
)
returns table (user_id uuid, first_name text, areas text[], destination_status text, move_month date, mom_mode boolean,
  kids_age_groups text[], looking_for text[], interests text[], score integer)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
begin
  return query
  select mp.user_id, p.first_name,
    case when 'areas' = any (mp.hidden_fields) then '{}'::text[] else mp.areas end,
    mp.destination_status, mp.move_month, mp.mom_mode,
    case when mp.mom_mode then mp.kids_age_groups else '{}'::text[] end,
    mp.looking_for, mp.interests,
    (select s.score from private.match_score(me, mp.user_id) s)
  from public.irly_match_profiles mp
  join public.profiles p on p.id = mp.user_id and p.deleted_at is null and p.gender = 'woman'
  left join public.safety_settings ss on ss.user_id = mp.user_id
  where mp.user_id <> me
    and mp.visible
    and private.visible_to(me, mp.user_id, ss.profile_visibility)
    and not private.is_blocked(me, mp.user_id)
    and (mp.destination = p_destination or (mp.destination is null and p.city_id = p_destination))
    and (p_status is null or mp.destination_status = p_status)
    and (not p_moms or mp.mom_mode)
    and (p_area is null or (p_area = any (mp.areas) and not 'areas' = any (mp.hidden_fields)))
    and (p_looking is null or p_looking = any (mp.looking_for))
  order by 10 desc nulls last, mp.last_active_at desc
  limit least(greatest(p_limit, 1), 60);
end $$;


-- ───────── 8. No repeated notifications ─────────

create or replace function public.add_friend(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a uuid := least(me, p_user);
  b uuid := greatest(me, p_user);
  f public.friendships;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_user = me then raise exception 'that is you' using errcode = '22023'; end if;
  if private.blocked_unchecked(me, p_user) then raise exception 'not available' using errcode = 'P0002'; end if;
  select * into f from public.friendships where user_a = a and user_b = b;
  if not found then
    insert into public.friendships (user_a, user_b, requested_by) values (a, b, me);
    -- Asking again after removing does not ping them again for a week.
    if not exists (
      select 1 from public.notifications n
      where n.user_id = p_user and n.kind = 'FRIEND_REQUEST' and n.payload ->> 'from' = me::text
        and n.created_at > now() - interval '7 days'
    ) then
      perform private.notify(p_user, 'FRIEND_REQUEST', jsonb_build_object('from', me));
    end if;
    return 'pending';
  end if;
  if f.status = 'pending' and f.requested_by <> me then
    update public.friendships set status = 'accepted', accepted_at = now() where user_a = a and user_b = b;
    perform private.notify(p_user, 'FRIEND_ACCEPTED', jsonb_build_object('from', me));
    return 'accepted';
  end if;
  return f.status;
end $$;

create or replace function public.join_community(p_community uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c public.communities;
  conv uuid;
  me uuid := auth.uid();
  added integer;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  select * into c from public.communities where id = p_community and deleted_at is null;
  if not found then
    raise exception 'community not found' using errcode = 'P0002';
  end if;
  if c.girl_only and not private.is_girl_eligible(me) then
    raise exception 'this community is reserved for IRLY Girl' using errcode = '42501';
  end if;
  insert into public.community_members (community_id, user_id) values (p_community, me) on conflict do nothing;
  get diagnostics added = row_count;
  conv := private.ensure_conversation('community', p_community, c.name);
  insert into public.conversation_members (conversation_id, user_id) values (conv, me) on conflict do nothing;
  if added > 0 then
    perform private.notify(me, 'COMMUNITY_JOINED', jsonb_build_object('community_id', p_community, 'conversation_id', conv));
  end if;
  return conv;
end $$;

revoke all on all functions in schema private from public, anon;
