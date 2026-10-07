-- Fifth bug hunt (scratch-DB reproductions; tests in "Bug hunt 5").
--  1. Hidden location precision also hides the city in IRLY Girl discovery.
--  2. Deleting an account keeps reported comments and posts for moderation.
--  3. Content from someone you blocked can still be reported.
--  4. Removing an already removed item writes nothing (no repeated triggers
--     or realtime events).

-- ───────── 1 ─────────
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

-- ───────── 2 ─────────
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  insert into private.removed_content (source, id, body)
    select 'messages', m.id, m.body from public.messages m
    where m.sender_id = me and exists (select 1 from public.reports r where r.target_kind = 'message' and r.target_id = m.id)
    on conflict do nothing;
  -- Reported posts and comments too: moderators keep what was reported.
  insert into private.removed_content (source, id, body)
    select 'comments', c.id, c.body from public.comments c
    where c.author_id = me and exists (select 1 from public.reports r where r.target_kind = 'comment' and r.target_id = c.id)
    on conflict do nothing;
  insert into private.removed_content (source, id, body)
    select 'irl_posts', p.id, p.body || coalesce(' [media: ' || p.media_path || ']', '') from public.irl_posts p
    where p.author_id = me and exists (select 1 from public.reports r where r.target_kind = 'irl_post' and r.target_id = p.id)
    on conflict do nothing;
  insert into private.removed_content (source, id, body)
    select 'community_posts', p.id, p.body from public.community_posts p
    where p.author_id = me and exists (select 1 from public.reports r where r.target_kind = 'community_post' and r.target_id = p.id)
    on conflict do nothing;
  delete from public.messages where sender_id = me;
  delete from public.conversations c where c.kind = 'direct'
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = me);
  delete from public.notifications where payload ->> 'from' = me::text or payload ->> 'user_id' = me::text or payload ->> 'with' = me::text;
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

-- ───────── 3 ─────────
create or replace function private.reportable_extra(p_kind text, p_target_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_kind
    when 'profile' then exists (select 1 from public.profiles where id = p_target_id and deleted_at is null)
    when 'message' then exists (
      select 1 from public.messages m
      left join public.conversations c on c.id = m.conversation_id
      left join public.irly_matches im on im.id = c.match_id
      where m.id = p_target_id
        and (private.is_member(m.conversation_id, auth.uid()) or auth.uid() in (im.user_a, im.user_b)))
    -- Blocking hides their content from you; reporting it must still work.
    else coalesce(private.blocked_unchecked(auth.uid(), private.owner_of(
      case p_kind when 'event' then 'activity' else p_kind end, p_target_id::text)), false)
  end
$$;

create or replace function public.report(p_kind text, p_target_user uuid, p_target_id uuid, p_category text, p_details text default null) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  t uuid := case when p_kind = 'profile' then coalesce(p_target_id, p_target_user) else p_target_id end;
  ok boolean;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if t is null then raise exception 'what are you reporting?' using errcode = '22023'; end if;
  ok := case p_kind
    when 'activity' then exists (select 1 from public.activities where id = t)
    when 'event' then exists (select 1 from public.activities where id = t)
    when 'community' then exists (select 1 from public.communities where id = t)
    when 'irl_post' then exists (select 1 from public.irl_posts where id = t)
    when 'community_post' then exists (select 1 from public.community_posts where id = t)
    when 'comment' then exists (select 1 from private.comment_target(t) ct where private.can_see(ct.target_type, ct.target_id))
    else false
  end or private.reportable_extra(p_kind, t);
  if not coalesce(ok, false) then raise exception 'not found' using errcode = 'P0002'; end if;
  return private.file_report(p_kind, t, p_category, p_details);
end $$;
revoke all on function public.report(text, uuid, uuid, text, text) from public, anon;
grant execute on function public.report(text, uuid, uuid, text, text) to authenticated;

-- ───────── 4 ─────────
create or replace function private.edit_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
declare fixed text[] := tg_argv; k text;
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or private.is_admin(auth.uid()) then return new; end if;
  if old.deleted_at is not null then
    -- Removing again (double tap, retry): skip the row, nothing changes.
    if new.deleted_at is not null
       and (to_jsonb(new) - 'deleted_at' - 'updated_at') = (to_jsonb(old) - 'deleted_at' - 'updated_at') then
      return null;
    end if;
    raise exception 'a removed item cannot be edited or restored' using errcode = '42501';
  end if;
  foreach k in array fixed loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
      raise exception '% cannot be changed', k using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

revoke all on all functions in schema private from public, anon;
grant execute on function private.file_report(text, uuid, text, text), private.reportable_extra(text, uuid),
  private.comment_target(uuid), private.going_count(uuid), private.can_see(text, text), private.precision_of(uuid) to authenticated;
