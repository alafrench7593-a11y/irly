-- Second bug hunt, server side (each item reproduced on a scratch DB; see
-- the "Bug hunt 2" section of supabase/tests/irly_test.sql).
--
--  1. Invite-only activities: a share counts only from the creator or
--     someone going (a hand-written message pointing at the id did).
--  2. Match: hidden fields are also stripped from reasons.facets, and from
--     the reasons stored on matches (both people's hidden fields).
--  3. created_at is the server's clock on inserts by members (backdating
--     beat the rate limits; future dates pinned chats and feeds).
--  4. IRL posts and activities can only point at a community you belong to.
--  5. Mentions on IRL posts follow the post's real visibility.
--  6. Deleting an account removes your messages (they turned into "IRLY"
--     messages) and hands your communities to their oldest member.
--  7. Storage: IRL media readable only through a post you can see; profile
--     photos not by people who blocked you or you blocked.
--  8. Polls are frozen once someone voted; a post's activity is checked on
--     edit too.
--  9. A removed comment keeps its place in the thread (replies were
--     orphaned): its text is erased instead and kept for moderators only.
-- 10. profiles_public hides people you blocked or who blocked you; a
--     profile set to Nobody is not a "visible" target.
-- 11. my_profile(): your own full profile (column grants hid it).
-- 12. Communities: owner cannot change creator or open a girl-only
--     community; direct inserts are rate limited like create_community.

-- ───────── 1 ─────────
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
    -- Invite: shared in one of your chats BY the creator or someone going
    -- (anyone can write a message pointing at an id; that is not an invite).
    or (a.privacy = 'invite' and exists (
        select 1 from public.messages msg
        join public.conversation_members cm on cm.conversation_id = msg.conversation_id and cm.user_id = me
        where msg.kind = 'share' and msg.ref_type = 'activity' and msg.ref_id = p_activity and msg.deleted_at is null
          and (msg.sender_id = a.creator_id or exists (
            select 1 from public.activity_participants ap where ap.activity_id = a.id and ap.user_id = msg.sender_id and ap.status = 'going'))))
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


-- ───────── 2 ─────────
create or replace function private.strip_hidden(r jsonb, hidden text[]) returns jsonb
language sql immutable set search_path = public as $$
  select case when r is null then null else
    (r - coalesce(hidden, '{}'))
    || case when r ? 'facets' then jsonb_build_object('facets', (r -> 'facets') - coalesce(hidden, '{}')) else '{}'::jsonb end
  end
$$;

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
    private.strip_hidden(sc.rs, sc.hidden_fields)
  from scored sc
  where sc.sc >= (select min_score from public.irly_match_config where id = 1)
  order by sc.sc desc, sc.last_active_at desc
  limit lim offset greatest(coalesce(p_offset, 0), 0);
end $$;



create or replace function private.match_reasons_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.reasons := private.strip_hidden(new.reasons, (
    select coalesce(array_agg(distinct f), '{}') from public.irly_match_profiles mp, unnest(mp.hidden_fields) f
    where mp.user_id in (new.user_a, new.user_b)));
  return new;
end $$;
drop trigger if exists irly_matches_reasons on public.irly_matches;
create trigger irly_matches_reasons before insert or update of reasons on public.irly_matches
for each row execute function private.match_reasons_guard();
update public.irly_matches set reasons = reasons;

-- ───────── 3 ─────────
create or replace function private.server_clock() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is not null then
    new.created_at := now();
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['irl_posts', 'comments', 'likes', 'community_posts', 'messages', 'communities', 'activities'] loop
    execute format('drop trigger if exists %I on public.%I', 'a_' || t || '_server_clock', t);
    -- "a_" sorts first: the clock is set before the rate-limit trigger counts.
    execute format('create trigger %I before insert on public.%I for each row execute function private.server_clock()', 'a_' || t || '_server_clock', t);
  end loop;
end $$;

-- ───────── 4 ─────────
drop policy if exists irl_posts_insert on public.irl_posts;
create policy irl_posts_insert on public.irl_posts for insert to authenticated
  with check (
    author_id = auth.uid() and expires_at <= now() + interval '4 hours 1 minute'
    and (community_id is null or private.i_belong(community_id))
    and (visibility <> 'community' or community_id is not null)
  );
drop policy if exists activities_create on public.activities;
create policy activities_create on public.activities for insert to authenticated
  with check (
    creator_id = auth.uid() and (not girl_only or private.is_girl_eligible())
    and (community_id is null or private.i_belong(community_id))
  );
drop policy if exists activities_creator on public.activities;
create policy activities_creator on public.activities for update to authenticated
  using (creator_id = auth.uid())
  with check (
    creator_id = auth.uid() and (not girl_only or private.is_girl_eligible())
    and (community_id is null or private.i_belong(community_id))
  );

-- ───────── 5 ─────────
create or replace function private.user_can_see(p_user uuid, p_type text, p_id text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  cid uuid;
  a public.activities;
  p public.irl_posts;
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
    select * into p from public.irl_posts where id = p_id::uuid;
    if not found then return false; end if;
    if p.author_id = p_user then return true; end if;
    return p.expires_at > now() and not private.blocked_unchecked(p_user, p.author_id) and (
      p.visibility = 'everyone'
      or (p.visibility = 'friends' and private.friends_unchecked(p.author_id, p_user))
      or (p.visibility = 'close_friends' and exists (select 1 from public.close_friends cf where cf.user_id = p.author_id and cf.friend_id = p_user))
      or (p.visibility = 'community' and p.community_id is not null
          and exists (select 1 from public.community_members cm where cm.community_id = p.community_id and cm.user_id = p_user))
    );
  elsif p_type = 'profile' then
    return not private.blocked_unchecked(p_user, p_id::uuid);
  end if;
  return false;
end $$;
revoke all on function private.user_can_see(uuid, text, text) from public, anon, authenticated;

-- ───────── 6 ─────────
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  -- A sender-less message reads as IRLY's own: never leave the person's words behind.
  delete from public.messages where sender_id = me;
  -- Communities they owned keep an owner: the longest-standing member.
  update public.community_members cm set role = 'owner'
  from (
    select distinct on (m.community_id) m.community_id, m.user_id
    from public.community_members m
    join public.community_members mine on mine.community_id = m.community_id and mine.user_id = me and mine.role = 'owner'
    where m.user_id <> me
      and not exists (select 1 from public.community_members o where o.community_id = m.community_id and o.role = 'owner' and o.user_id <> me)
    order by m.community_id, (m.role = 'moderator') desc, m.joined_at
  ) heir
  where cm.community_id = heir.community_id and cm.user_id = heir.user_id;
  delete from auth.users where id = me;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ───────── 7 ─────────
create or replace function private.uuid_or_null(s text) returns uuid
language sql immutable set search_path = public as $$
  select case when private.is_uuid(s) then s::uuid end
$$;
grant execute on function private.uuid_or_null(text) to authenticated;
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute 'drop policy if exists irl_media_read on storage.objects';
    execute $p$
      create policy irl_media_read on storage.objects for select to authenticated
      using (bucket_id = 'irl-media' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or exists (select 1 from public.irl_posts p where p.media_path = name)
      ))
    $p$;
    execute 'drop policy if exists profile_photos_read on storage.objects';
    execute $p$
      create policy profile_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'profile-photos' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or not private.is_blocked(auth.uid(), private.uuid_or_null((storage.foldername(name))[1]))
      ))
    $p$;
  end if;
end $$;

-- ───────── 8 ─────────
create or replace function private.community_post_shape() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.body := btrim(new.body);
  if new.activity_id is not null and (tg_op = 'INSERT' or new.activity_id is distinct from old.activity_id)
     and not exists (select 1 from public.activities where id = new.activity_id) then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  if tg_op = 'UPDATE' and new.poll is distinct from old.poll
     and exists (select 1 from public.community_poll_votes v where v.post_id = old.id) then
    raise exception 'a poll cannot change once people voted' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists community_posts_shape on public.community_posts;
create trigger community_posts_shape before insert or update on public.community_posts
for each row execute function private.community_post_shape();

-- ───────── 9 ─────────
create table if not exists private.removed_content (
  source text not null,
  id uuid not null,
  body text not null,
  removed_at timestamptz not null default now(),
  primary key (source, id)
);
revoke all on private.removed_content from public, anon, authenticated;

create or replace function private.erase_on_remove() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if old.deleted_at is null and new.deleted_at is not null and new.body <> '—' then
    insert into private.removed_content (source, id, body) values (tg_table_name, old.id, old.body)
    on conflict (source, id) do nothing;
    new.body := '—';
  end if;
  return new;
end $$;
drop trigger if exists comments_erase on public.comments;
create trigger comments_erase before update of deleted_at on public.comments
for each row execute function private.erase_on_remove();
drop trigger if exists messages_erase on public.messages;
create trigger messages_erase before update of deleted_at on public.messages
for each row execute function private.erase_on_remove();
-- Already removed before this migration.
insert into private.removed_content (source, id, body)
  select 'comments', id, body from public.comments where deleted_at is not null and body <> '—'
  on conflict do nothing;
update public.comments set body = '—' where deleted_at is not null and body <> '—';
insert into private.removed_content (source, id, body)
  select 'messages', id, body from public.messages where deleted_at is not null and body <> '—'
  on conflict do nothing;
update public.messages set body = '—' where deleted_at is not null and body <> '—';

-- Deleted comments are visible again (as empty placeholders), so replies keep their parent.
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to authenticated
  using (private.can_see(target_type, target_id) and not private.is_blocked(auth.uid(), author_id));

-- ───────── 10 ─────────
create or replace view public.profiles_public with (security_barrier = true) as
  select id, first_name, city_id from public.profiles
  where deleted_at is null and not private.blocked_unchecked(auth.uid(), id);
grant select on public.profiles_public to authenticated;

create or replace function private.can_see(p_type text, p_id text) returns boolean
language plpgsql stable security invoker set search_path = public as $$
begin
  if p_type in ('place', 'catalog') then
    return p_id is not null and char_length(p_id) between 1 and 120;
  end if;
  if not private.is_uuid(p_id) then
    return false;
  end if;
  return case p_type
    when 'irl_post' then exists (select 1 from public.irl_posts where id = p_id::uuid)
    when 'activity' then exists (select 1 from public.activities where id = p_id::uuid)
    when 'community' then exists (select 1 from public.communities where id = p_id::uuid)
    when 'community_post' then exists (select 1 from public.community_posts where id = p_id::uuid)
    when 'comment' then exists (select 1 from public.comments where id = p_id::uuid)
    when 'profile' then exists (select 1 from public.profiles_public where id = p_id::uuid)
      and not private.is_blocked(auth.uid(), p_id::uuid)
      and (p_id::uuid = auth.uid() or private.discoverable(p_id::uuid))
    else false
  end;
end $$;

-- ───────── 11 ─────────
create or replace function public.my_profile() returns setof public.profiles
language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid()
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- ───────── 12 ─────────
drop trigger if exists communities_edit_guard on public.communities;
create trigger communities_edit_guard before update on public.communities
for each row execute function private.edit_guard('created_by', 'girl_only', 'created_at');
drop trigger if exists communities_rate on public.communities;
create trigger communities_rate before insert on public.communities
for each row execute function private.rate_limit('created_by', '3', '1 day');

revoke all on all functions in schema private from public, anon;
grant execute on function private.can_see(text, text), private.discoverable(uuid), private.uuid_or_null(text) to authenticated;
