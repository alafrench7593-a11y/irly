-- IRLY Girl isolation (audit of 2026-10-25). Additive: new restrictive
-- policies, functions replaced with the same signature, one new helper, one
-- new trigger. No data is changed or deleted; RLS stays on everywhere.
--
-- Every check below goes through the one predicate,
-- private.girl_eligible_unchecked(uid) / private.is_girl_eligible() (the rule
-- itself is unchanged here). What was found and closed:
--
--  1. Revocation: a woman whose IRLY Girl access ends (suspension inserted
--     without girl_suspend's clean-up, a gender corrected by staff, a closed
--     account) kept reading a girl-only plan she had joined, and so its
--     participant list (activities_read lets every participant in). Only
--     the host keeps seeing her own plan (so she can call it off).
--  2. Revocation: notifications about IRLY Girl content (titles, first words
--     of posts and messages, announcements) stayed readable, live
--     (Realtime) and as rows, after the access ended; and kinds the insert
--     check let through by default (ACTIVITY_UPDATED, ACTIVITY_REMINDER,
--     COMMUNITY_JOINED, LIKE, GROUP_ADDED…) still reached members without
--     access. One classifier, private.notification_is_girl(kind, payload),
--     now decides for both: the read rule and the insert check.
--  3. Revocation, writes that ran around the read rules: an UPDATE without
--     WHERE (it reads no column, so no SELECT policy applies) rewrote her own
--     posts in a girl-only community and her comments on IRLY Girl content;
--     set_community_cover, set_community_role and set_conversation_photo
--     (security definer) let a former owner or moderator act on a girl-only
--     community; edit_live_post edited an IRLY Girl Live; poll votes
--     (can_vote) were accepted from a former member; hide_message_for_me
--     answered for a girl chat.
--  4. Revocation, metadata: message_removals of girl chats, IRLY Girl
--     matches and Match decisions (irly_matches, irly_match_actions) stayed
--     readable (and live through Realtime for irly_matches).
--  5. Counts and rights: city_challenges and member_badges counted
--     girl-only plans and answers in girl-only communities for anyone;
--     community_rights told anyone who owns a girl-only community and how
--     many announcements it sent today.
--  6. Bypass of the predicate: girl_circle and irly_match_discover picked
--     candidates with profiles.gender = 'woman' instead of the predicate, so
--     a woman whose access was withdrawn was still listed to others.
--  7. girl_target() did not know comments: a like (or share, or a LIKE
--     notification) on a comment of IRLY Girl content was not IRLY Girl
--     content.
--  8. An anonymous session (Supabase anonymous sign-in, unused by the app)
--     could create a profile and declare a gender: it is refused.

-- ───────── 7. A comment is IRLY Girl content when what it comments is ─────────
create or replace function private.girl_target(p_type text, p_id text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_uuid(p_id) then return false; end if;
  return case p_type
    when 'activity' then coalesce((select a.girl_only from public.activities a where a.id = p_id::uuid), false)
    when 'community' then coalesce((select c.girl_only from public.communities c where c.id = p_id::uuid), false)
    when 'community_post' then coalesce((select c.girl_only from public.community_posts p join public.communities c on c.id = p.community_id where p.id = p_id::uuid), false)
    when 'irl_post' then coalesce((select p.app_scope = 'irly_girl' or coalesce(c.girl_only, false)
                                   from public.irl_posts p left join public.communities c on c.id = p.community_id where p.id = p_id::uuid), false)
    -- (A comment never targets a comment: comments_target_type_check.)
    when 'comment' then coalesce((select private.girl_target(k.target_type, k.target_id)
                                  from public.comments k where k.id = p_id::uuid and k.target_type <> 'comment'), false)
    else false
  end;
end $$;

-- ───────── 2. Notifications about IRLY Girl content ─────────
-- True when a notification is about IRLY Girl content: a Match, a girl chat,
-- a girl-only plan or community, an IRLY Girl Live or post, or a comment,
-- like or mention of one. Content already deleted is no longer known as
-- IRLY Girl content (nothing left to look it up by).
create or replace function private.notification_is_girl(p_kind text, p_payload jsonb)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  conv uuid;
begin
  if p_kind in ('MATCH_CREATED', 'MATCH_REMOVED') then return true; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then return false; end if;
  if p_payload ? 'match_id' then return true; end if;
  conv := private.uuid_or_null(p_payload ->> 'conversation_id');
  return (conv is not null and private.girl_chat(conv))
    or private.girl_target('activity', p_payload ->> 'activity_id')
    or private.girl_target('community', p_payload ->> 'community_id')
    or private.girl_target('irl_post', p_payload ->> 'post_id')
    or private.girl_target('community_post', p_payload ->> 'post_id')
    or private.girl_target(p_payload ->> 'target_type', p_payload ->> 'target_id');
end $$;
revoke all on function private.notification_is_girl(text, jsonb) from public, anon;
grant execute on function private.notification_is_girl(text, jsonb) to authenticated;

-- Read (REST and Realtime): kept, but shown only while the reader has IRLY Girl access.
drop policy if exists notifications_girl_only on public.notifications;
create policy notifications_girl_only on public.notifications as restrictive for select to authenticated
  using ((select private.is_girl_eligible()) or not private.notification_is_girl(kind, payload));

-- Insert: never written for a member without IRLY Girl access (nor pushed).
create or replace function private.notification_visible_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not private.notification_visible(new) then
    return null;
  end if;
  if private.notification_is_girl(new.kind, new.payload) and not private.girl_eligible_unchecked(new.user_id) then
    return null;
  end if;
  return new;
end $$;

-- ───────── 1. A girl-only plan after the access ended ─────────
-- activities_read lets every participant in; this rule (restrictive: on top
-- of it) keeps a girl-only plan for members with IRLY Girl access and its
-- host. participants_read reads activities under this rule, so the
-- participant list follows.
drop policy if exists activities_girl_only on public.activities;
create policy activities_girl_only on public.activities as restrictive for select to authenticated
  using (not girl_only or creator_id = (select auth.uid()) or (select private.is_girl_eligible()));

-- ───────── 3. Writes that run around the read rules ─────────
drop policy if exists comments_girl_only_update on public.comments;
create policy comments_girl_only_update on public.comments as restrictive for update to authenticated
  using (not private.girl_target(target_type, target_id) or (select private.is_girl_eligible()) or (select private.is_admin()))
  with check (not private.girl_target(target_type, target_id) or (select private.is_girl_eligible()) or (select private.is_admin()));

drop policy if exists community_posts_girl_only_update on public.community_posts;
create policy community_posts_girl_only_update on public.community_posts as restrictive for update to authenticated
  using (community_id is null or not private.girl_target('community', community_id::text)
         or (select private.is_girl_eligible()) or (select private.is_admin()))
  with check (community_id is null or not private.girl_target('community', community_id::text)
              or (select private.is_girl_eligible()) or (select private.is_admin()));

drop policy if exists conversation_members_girl_chat_update on public.conversation_members;
create policy conversation_members_girl_chat_update on public.conversation_members as restrictive for update to authenticated
  using ((select private.is_girl_eligible()) or not private.girl_chat(conversation_id))
  with check ((select private.is_girl_eligible()) or not private.girl_chat(conversation_id));

-- A poll in a girl-only community: members with IRLY Girl access only (i_belong).
create or replace function private.can_vote(p_post uuid, p_option integer)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_posts p
    where p.id = p_post and p.deleted_at is null and p.poll is not null
      and p_option < jsonb_array_length(p.poll -> 'options')
      and private.i_belong(p.community_id)
  )
$$;

create or replace function public.set_community_cover(p_community uuid, p_path text)
returns void
language plpgsql security definer set search_path = public, private as $$
declare staff boolean := private.is_content_staff(auth.uid());
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.communities where id = p_community and deleted_at is null) then
    raise exception 'this community no longer exists' using errcode = 'P0002';
  end if;
  if not staff and private.girl_target('community', p_community::text) and not private.girl_eligible_unchecked(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  if not staff and not exists (
    select 1 from public.community_members m
    where m.community_id = p_community and m.user_id = auth.uid() and m.role in ('owner', 'moderator')
  ) then
    raise exception 'only the community owner or a moderator can change its photo' using errcode = '42501';
  end if;
  if p_path is not null and not private.own_upload(p_path) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  update public.communities set cover_path = p_path where id = p_community;
  if staff then
    perform private.audit('cover.community', (select created_by from public.communities where id = p_community), null,
      jsonb_build_object('community', p_community, 'reset', p_path is null));
  end if;
end $$;

create or replace function public.set_community_role(p_community uuid, p_user uuid, p_role text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  parent uuid;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_role not in ('moderator', 'member') then raise exception 'role: moderator or member' using errcode = '22023'; end if;
  select parent_id into parent from public.communities where id = p_community and deleted_at is null;
  if not private.is_admin(me) and private.girl_target('community', p_community::text) and not private.girl_eligible_unchecked(me) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  if not (private.is_admin(me) or exists (
    select 1 from public.community_members where user_id = me and role = 'owner' and community_id in (p_community, parent)
  )) then
    raise exception 'only the owner or IRLY can change roles' using errcode = '42501';
  end if;
  if not exists (select 1 from public.community_members where community_id = p_community and user_id = p_user) then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  update public.community_members set role = p_role where community_id = p_community and user_id = p_user and role <> 'owner';
end $$;

create or replace function public.set_conversation_photo(p_conversation uuid, p_path text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  conv public.conversations;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into conv from public.conversations where id = p_conversation;
  if conv.id is null or conv.kind not in ('group', 'activity', 'community') then
    raise exception 'this chat has no photo of its own' using errcode = '42501';
  end if;
  if private.girl_chat(conv.id) and not private.girl_eligible_unchecked(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  if not (
    exists (select 1 from public.conversation_members where conversation_id = conv.id and user_id = auth.uid() and role = 'admin')
    or (conv.community_id is not null and exists (
      select 1 from public.community_members where community_id = conv.community_id and user_id = auth.uid() and role in ('owner', 'moderator')))
  ) then
    raise exception 'only the chat admin can change its photo' using errcode = '42501';
  end if;
  if p_path is not null and not private.own_upload(p_path) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  update public.conversations set photo_path = p_path where id = conv.id;
end $$;

create or replace function public.edit_live_post(p_id uuid, p_body text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  p public.irl_posts;
begin
  select * into p from public.irl_posts where id = p_id;
  if not found or p.author_id is distinct from auth.uid() then
    raise exception 'only the author can edit this post' using errcode = '42501';
  end if;
  if p.app_scope = 'irly_girl' and not private.girl_eligible_unchecked(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  if p.expires_at <= now() then
    raise exception 'this Live has ended' using errcode = '42501';
  end if;
  update public.irl_posts set body = btrim(coalesce(p_body, '')), edited_at = now() where id = p_id;
end $$;

create or replace function public.hide_message_for_me(p_message uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  conv uuid;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select m.conversation_id into conv from public.messages m where m.id = p_message;
  if conv is null or not exists (select 1 from public.conversation_members where conversation_id = conv and user_id = auth.uid())
     or (private.girl_chat(conv) and not private.girl_eligible_unchecked(auth.uid())) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.message_hides (user_id, message_id) values (auth.uid(), p_message) on conflict do nothing;
end $$;

-- ───────── 4. Metadata of girl chats and of IRLY Girl Match ─────────
drop policy if exists message_removals_girl_chat on public.message_removals;
create policy message_removals_girl_chat on public.message_removals as restrictive for select to authenticated
  using ((select private.is_girl_eligible()) or not private.girl_chat(conversation_id));

drop policy if exists matches_girl_only on public.irly_matches;
create policy matches_girl_only on public.irly_matches as restrictive for select to authenticated
  using ((select private.is_girl_eligible()));

drop policy if exists match_actions_girl_only on public.irly_match_actions;
create policy match_actions_girl_only on public.irly_match_actions as restrictive for select to authenticated
  using ((select private.is_girl_eligible()));

-- ───────── 5. Counts and rights ─────────
-- Nothing for a girl-only community to whoever has no IRLY Girl access
-- (the app reads no row as « no rights »).
create or replace function public.community_rights(p_community uuid)
returns table (is_admin boolean, can_moderate boolean, is_owner boolean, announcements_today integer, next_announcement_at timestamptz)
language sql stable security definer set search_path = public as $$
  select private.is_admin(auth.uid()),
    private.moderates(p_community),
    private.is_admin(auth.uid()) or exists (
      select 1 from public.community_members where user_id = auth.uid() and role = 'owner'
        and community_id in (p_community, (select parent_id from public.communities where id = p_community))),
    (select count(*)::int from public.community_broadcasts b where b.community_id = p_community and b.created_at > now() - interval '1 day'),
    (select max(b.created_at) + interval '1 hour' from public.community_broadcasts b where b.community_id = p_community and b.created_at > now() - interval '1 hour')
  where not private.girl_target('community', p_community::text)
    or private.girl_eligible_unchecked(auth.uid())
    or private.is_admin(auth.uid())
$$;

-- The city's challenges count girl-only plans and answers in girl-only
-- communities only for members with IRLY Girl access.
create or replace function public.city_challenges(p_city text)
returns table (challenge text, goal integer, done integer, mine integer)
language sql stable security definer set search_path = public as $$
  with month as (
    select date_trunc('month', now() at time zone private.city_tz(p_city)) at time zone private.city_tz(p_city) as start
  ),
  me as (select private.girl_eligible_unchecked(auth.uid()) as girl)
  select 'activities', 100,
    (select count(*)::int from public.activities a, month, me where a.city_id = p_city and a.cancelled_at is null and a.starts_at >= month.start and a.starts_at < now()
      and (not a.girl_only or me.girl)
      and exists (select 1 from public.activity_participants x where x.activity_id = a.id and x.user_id <> a.creator_id and x.status = 'going')),
    (select count(*)::int from public.activity_participants x join public.activities a on a.id = x.activity_id, month, me
      where x.user_id = auth.uid() and x.status = 'going' and a.city_id = p_city and a.cancelled_at is null and a.starts_at >= month.start and a.starts_at < now()
      and (not a.girl_only or me.girl))
  union all
  select 'places', 50,
    (select count(distinct coalesce(a.place_id::text, a.place_name))::int from public.activities a, month, me where a.city_id = p_city and a.cancelled_at is null
      and a.starts_at >= month.start and a.starts_at < now() and coalesce(a.place_id::text, a.place_name) is not null
      and (not a.girl_only or me.girl)),
    (select count(distinct coalesce(a.place_id::text, a.place_name))::int from public.activity_participants x join public.activities a on a.id = x.activity_id, month, me
      where x.user_id = auth.uid() and x.status = 'going' and a.city_id = p_city and a.cancelled_at is null and a.starts_at >= month.start and a.starts_at < now()
      and coalesce(a.place_id::text, a.place_name) is not null
      and (not a.girl_only or me.girl))
  union all
  select 'answers', 200,
    (select count(*)::int from public.comments k join public.community_posts q on q.id::text = k.target_id and k.target_type = 'community_post' and q.kind = 'question'
      join public.communities g on g.id = q.community_id, month, me
      where g.city_id = p_city and k.deleted_at is null and k.created_at >= month.start
        and (not g.girl_only or me.girl)),
    (select count(*)::int from public.comments k join public.community_posts q on q.id::text = k.target_id and k.target_type = 'community_post' and q.kind = 'question'
      left join public.communities g on g.id = q.community_id, month, me
      where k.author_id = auth.uid() and k.deleted_at is null and k.created_at >= month.start
        and (not coalesce(g.girl_only, false) or me.girl))
$$;

-- A member's badges, as the viewer may see them: girl-only plans and answers
-- in girl-only communities count only for a viewer with IRLY Girl access.
create or replace function public.member_badges(p_user uuid)
returns table (badge text, level integer, count integer)
language plpgsql stable security definer set search_path = public as $$
declare
  organised integer;
  helped integer;
  joined integer;
  girl boolean := private.girl_eligible_unchecked(auth.uid());
begin
  if p_user is null or private.blocked_unchecked(auth.uid(), p_user) then return; end if;
  -- Activities they organised that happened with at least one other person.
  select count(*) into organised from public.activities a
  where a.creator_id = p_user and a.cancelled_at is null and a.starts_at < now()
    and (not a.girl_only or girl)
    and exists (select 1 from public.activity_participants x where x.activity_id = a.id and x.user_id <> p_user and x.status = 'going');
  -- Answers in Help & Questions that someone found useful (liked).
  select count(*) into helped from public.comments k
  join public.community_posts q on q.id::text = k.target_id and k.target_type = 'community_post' and q.kind = 'question' and q.deleted_at is null
  left join public.communities g on g.id = q.community_id
  where k.author_id = p_user and k.deleted_at is null and q.author_id <> p_user
    and (not coalesce(g.girl_only, false) or girl)
    and exists (select 1 from public.likes l where l.target_type = 'comment' and l.target_id = k.id::text and l.user_id <> p_user);
  -- Activities they went to (in the past).
  select count(*) into joined from public.activity_participants x join public.activities a on a.id = x.activity_id
  where x.user_id = p_user and x.status = 'going' and a.cancelled_at is null and a.starts_at < now() and a.creator_id <> p_user
    and (not a.girl_only or girl);
  if organised > 0 then return query select 'organizer', case when organised >= 20 then 3 when organised >= 5 then 2 else 1 end, organised; end if;
  if helped > 0 then return query select 'helper', case when helped >= 50 then 3 when helped >= 10 then 2 else 1 end, helped; end if;
  if joined > 0 then return query select 'explorer', case when joined >= 30 then 3 when joined >= 10 then 2 else 1 end, joined; end if;
end $$;

-- ───────── 6. The candidates of IRLY Girl Match and the Circle: the predicate, not the gender column ─────────
create or replace function public.girl_circle(p_destination text, p_status text default null, p_moms boolean default false,
  p_area text default null, p_limit integer default 30, p_looking text default null)
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
  join public.profiles p on p.id = mp.user_id and p.deleted_at is null and private.girl_eligible_unchecked(mp.user_id)
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

create or replace function public.irly_match_discover(p_filters jsonb default '{}'::jsonb, p_limit integer default 20, p_offset integer default 0)
returns table (user_id uuid, first_name text, age integer, city_id text, bio text, photo_paths text[], interests text[], sports text[],
  activities text[], goals text[], languages text[], areas text[], travel text[], active_now boolean, is_new boolean, saved boolean,
  score integer, reasons jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
  ready boolean := private.assert_match_ready();
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
    join public.profiles p on p.id = mp.user_id and p.deleted_at is null and private.girl_eligible_unchecked(mp.user_id)
    left join public.safety_settings s on s.user_id = mp.user_id
    where mp.user_id <> me
      and mp.visible
      and private.match_ready(mp.user_id)
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
    case when private.precision_of(sc.user_id) = 'hidden' then null else sc.pcity end,
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

-- ───────── 8. No profile (so no declared gender) for an anonymous session ─────────
-- Supabase anonymous sign-ins get the authenticated role; the app never uses
-- them. Their JWT carries is_anonymous = true (request.jwt.claims).
create or replace function private.profiles_no_anonymous() returns trigger
language plpgsql set search_path = public as $$
declare
  claims text := nullif(current_setting('request.jwt.claims', true), '');
begin
  if claims is not null and claims ~ '^\s*\{' and coalesce((claims::jsonb ->> 'is_anonymous')::boolean, false) then
    raise exception 'create an account first' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.profiles_no_anonymous() from public, anon, authenticated;
drop trigger if exists profiles_no_anonymous on public.profiles;
create trigger profiles_no_anonymous before insert on public.profiles
  for each row execute function private.profiles_no_anonymous();
