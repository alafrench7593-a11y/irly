-- Verified profiles for Match (Match IRLY and IRLY Girl matching).
--
-- A real check, reviewed by a person, no automated biometrics:
-- 1. The member has at least 3 personal photos on the profile (IRLY
--    avatars do not count).
-- 2. They take a selfie in the app doing a gesture chosen at random by the
--    server (so an old photo cannot be reused), stored in a private bucket
--    only they and IRLY admins can read.
-- 3. An IRLY admin compares the selfie with the profile photos and approves
--    or refuses (with a reason). The selfie is deleted after the decision
--    (the app removes the file; the row keeps no path).
-- 4. Approved: profiles.verified_at and the photos that were reviewed. A
--    photo added later that nobody reviewed removes the badge (the member
--    can ask again). Nobody can set the badge on themselves.
-- 5. Match: only verified members with 3 photos can use Match or appear in
--    it (people_match, irly_match_discover, irly_match_act).

alter table public.profiles add column if not exists verified_at timestamptz;
alter table public.profiles add column if not exists verified_photos text[];
select private.restrict_profile_columns();

create or replace function private.real_photos(paths text[]) returns integer
language sql immutable as $$
  select count(*)::int from unnest(coalesce(paths, '{}')) x where x not like 'irly-avatar:%' and x <> ''
$$;

create or replace function private.match_ready(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.verified_at is not null and private.real_photos(p.photo_paths) >= 3
    from public.profiles p where p.id = uid and p.deleted_at is null), false)
$$;

create or replace function private.assert_match_ready() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if not private.match_ready(auth.uid()) then
    raise exception 'verify your profile to use Match' using errcode = '42501';
  end if;
  return true;
end $$;
grant execute on function private.match_ready(uuid), private.assert_match_ready(), private.real_photos(text[]) to authenticated;

-- Nobody verifies themselves; a photo nobody reviewed removes the badge.
create or replace function private.verification_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.verified_at is distinct from old.verified_at or new.verified_photos is distinct from old.verified_photos)
     and auth.uid() is not null and not private.is_admin(auth.uid()) then
    raise exception 'verification is done by IRLY' using errcode = '42501';
  end if;
  if old.verified_at is not null and new.photo_paths is distinct from old.photo_paths and exists (
    select 1 from unnest(coalesce(new.photo_paths, '{}')) x
    where x not like 'irly-avatar:%' and not x = any (coalesce(old.verified_photos, '{}'))
  ) then
    new.verified_at := null;
    new.verified_photos := null;
  end if;
  return new;
end $$;
drop trigger if exists profiles_verification_guard on public.profiles;
create trigger profiles_verification_guard before update on public.profiles
for each row execute function private.verification_guard();

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  gesture text not null check (gesture in ('peace', 'thumb', 'nose', 'ear', 'three')),
  selfie_path text,
  -- The photos the selfie is compared with, as they were when it was sent.
  photos text[],
  status text not null default 'started' check (status in ('started', 'pending', 'approved', 'rejected')),
  reason text check (reason is null or char_length(reason) <= 200),
  reviewer_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  decided_at timestamptz
);
create index if not exists verification_requests_user on public.verification_requests (user_id, created_at desc);
create index if not exists verification_requests_pending on public.verification_requests (submitted_at) where status = 'pending';
alter table public.verification_requests enable row level security;
drop policy if exists verification_requests_own on public.verification_requests;
create policy verification_requests_own on public.verification_requests for select to authenticated
  using (user_id = auth.uid() or private.is_admin(auth.uid()));

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('verifications', 'verifications', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
    execute 'drop policy if exists verifications_write on storage.objects';
    execute $p$
      create policy verifications_write on storage.objects for insert to authenticated
      with check (bucket_id = 'verifications' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute 'drop policy if exists verifications_read on storage.objects';
    execute $p$
      create policy verifications_read on storage.objects for select to authenticated
      using (bucket_id = 'verifications' and ((storage.foldername(name))[1] = auth.uid()::text or private.is_admin(auth.uid())))
    $p$;
    execute 'drop policy if exists verifications_delete on storage.objects';
    execute $p$
      create policy verifications_delete on storage.objects for delete to authenticated
      using (bucket_id = 'verifications' and ((storage.foldername(name))[1] = auth.uid()::text or private.is_admin(auth.uid())))
    $p$;
  end if;
end $$;

-- Where I am: photos, last request, badge.
create or replace function public.my_verification()
returns table (photos integer, verified_at timestamptz, request_id uuid, status text, gesture text, reason text, ready boolean)
language sql stable security definer set search_path = public as $$
  select private.real_photos(p.photo_paths), p.verified_at, r.id, r.status, r.gesture, r.reason, private.match_ready(p.id)
  from public.profiles p
  left join lateral (
    select * from public.verification_requests v where v.user_id = p.id order by v.created_at desc limit 1
  ) r on true
  where p.id = auth.uid()
$$;

-- A gesture for the selfie, chosen by the server (5 tries a day).
create or replace function public.start_verification() returns table (request_id uuid, gesture text)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r public.verification_requests;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if (select private.real_photos(photo_paths) from public.profiles where id = me) < 3 then
    raise exception 'add at least 3 photos of yourself first' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.verification_requests where user_id = me and status = 'pending') then
    raise exception 'your selfie is being reviewed' using errcode = 'P0001';
  end if;
  select * into r from public.verification_requests where user_id = me and status = 'started' and created_at > now() - interval '30 minutes' order by created_at desc limit 1;
  if found then
    return query select r.id, r.gesture;
    return;
  end if;
  if (select count(*) from public.verification_requests where user_id = me and created_at > now() - interval '1 day') >= 5 then
    raise exception 'five tries a day: try again tomorrow' using errcode = 'P0001';
  end if;
  return query
  insert into public.verification_requests (user_id, gesture)
  values (me, (array['peace', 'thumb', 'nose', 'ear', 'three'])[1 + floor(random() * 5)::int])
  returning id, verification_requests.gesture;
end $$;

-- The selfie is sent: a person will review it.
create or replace function public.submit_verification(p_request uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_path is null or p_path not like me::text || '/%' then raise exception 'invalid file' using errcode = '22023'; end if;
  update public.verification_requests set selfie_path = p_path, status = 'pending', submitted_at = now(),
    photos = (select array(select x from unnest(p.photo_paths) x where x not like 'irly-avatar:%') from public.profiles p where p.id = me)
  where id = p_request and user_id = me and status = 'started';
  if not found then raise exception 'start again: this request is no longer open' using errcode = 'P0002'; end if;
end $$;

-- IRLY admins: the queue, oldest first.
create or replace function public.verification_queue()
returns table (request_id uuid, user_id uuid, first_name text, photo_paths text[], selfie_path text, gesture text, submitted_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin(auth.uid()) then raise exception 'IRLY admins only' using errcode = '42501'; end if;
  return query
    select v.id, v.user_id, p.first_name, coalesce(v.photos, p.photo_paths), v.selfie_path, v.gesture, v.submitted_at
    from public.verification_requests v
    join public.profiles p on p.id = v.user_id and p.deleted_at is null
    where v.status = 'pending'
    order by v.submitted_at
    limit 50;
end $$;

-- An admin decides; returns the selfie's path so the app deletes the file.
create or replace function public.decide_verification(p_request uuid, p_approve boolean, p_reason text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v public.verification_requests;
begin
  if not private.is_admin(me) then raise exception 'IRLY admins only' using errcode = '42501'; end if;
  select * into v from public.verification_requests where id = p_request and status = 'pending' for update;
  if not found then raise exception 'already decided' using errcode = 'P0002'; end if;
  if v.user_id = me then raise exception 'someone else reviews your own request' using errcode = '42501'; end if;
  update public.verification_requests
    set status = case when p_approve then 'approved' else 'rejected' end,
        reason = case when p_approve then null else left(nullif(btrim(coalesce(p_reason, '')), ''), 200) end,
        reviewer_id = me, decided_at = now(), selfie_path = null
  where id = v.id;
  if p_approve then
    -- Only the photos the admin saw: if the member changed them since, they ask again.
    if exists (select 1 from public.profiles p, unnest(p.photo_paths) x
               where p.id = v.user_id and x not like 'irly-avatar:%' and not x = any (coalesce(v.photos, '{}'))) then
      raise exception 'the photos changed since the selfie: decline and ask for a new one' using errcode = 'P0001';
    end if;
    update public.profiles set verified_at = now(), verified_photos = v.photos where id = v.user_id;
  end if;
  perform private.notify(v.user_id, 'PROFILE_UPDATED',
    jsonb_build_object('type', case when p_approve then 'verified' else 'verification_rejected' end, 'reason', nullif(btrim(coalesce(p_reason, '')), '')));
  return v.selfie_path;
end $$;

-- Who is verified, for badges (blocked members excluded).
create or replace function public.verified_members(p_ids uuid[]) returns table (id uuid)
language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p
  where p.id = any (p_ids[1:200]) and p.deleted_at is null and p.verified_at is not null
    and not private.blocked_unchecked(auth.uid(), p.id)
$$;

revoke all on function public.my_verification(), public.start_verification(), public.submit_verification(uuid, text),
  public.verification_queue(), public.decide_verification(uuid, boolean, text), public.verified_members(uuid[]) from public, anon;
grant execute on function public.my_verification(), public.start_verification(), public.submit_verification(uuid, text),
  public.verification_queue(), public.decide_verification(uuid, boolean, text), public.verified_members(uuid[]) to authenticated;

-- Match IRLY: only verified members, for verified members.
create or replace function public.people_match(p_city text, p_limit integer default 20, p_offset integer default 0)
returns table (id uuid, first_name text, photo_path text, username text, city_id text, score integer,
  shared_interests text[], shared_activities text[], shared_goals text[], shared_languages text[], friend_status text, i_follow boolean)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, p.city_id, p.interests, p.activity_prefs || p.sports as acts, p.intentions, p.languages
    from public.profiles p where p.id = auth.uid() and p.deleted_at is null and private.assert_match_ready()
  ),
  cand as (
    select o.id, o.first_name, o.photo_paths[1] as photo_path, o.username, o.city_id,
      array(select unnest(o.interests) intersect select unnest(me.interests)) as si,
      array(select unnest(o.activity_prefs || o.sports) intersect select unnest(me.acts)) as sa,
      array(select unnest(o.intentions) intersect select unnest(me.intentions)) as sg,
      array(select unnest(o.languages) intersect select unnest(me.languages)) as sl,
      o.city_id = me.city_id as same_city
    from public.profiles o, me
    where o.id <> me.id and o.deleted_at is null and private.match_ready(o.id)
      and o.city_id = any (private.city_scope(p_city))
      and not private.blocked_unchecked(me.id, o.id)
      and private.visible_to(me.id, o.id, (select s.profile_visibility from public.safety_settings s where s.user_id = o.id))
      and not private.friends_unchecked(me.id, o.id)
      and not exists (select 1 from public.people_match_skips k where k.user_id = me.id and k.other_id = o.id and k.until > now())
  )
  select c.id, c.first_name, c.photo_path, c.username, c.city_id,
    (3 * cardinality(c.si) + 2 * cardinality(c.sa) + 2 * cardinality(c.sg) + cardinality(c.sl) + case when c.same_city then 2 else 0 end)::int,
    c.si, c.sa, c.sg, c.sl,
    private.friend_status(auth.uid(), c.id),
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = c.id)
  from cand c
  where cardinality(c.si) + cardinality(c.sa) + cardinality(c.sg) > 0
  order by 6 desc, md5(c.id::text || auth.uid()::text || current_date::text)
  limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0)
$$;

-- IRLY Girl matching: same rule.
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
    join public.profiles p on p.id = mp.user_id and p.deleted_at is null and p.gender = 'woman'
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

create or replace function public.irly_match_act(p_target uuid, p_action text)
returns table (match_id uuid, conversation_id uuid, score integer, reasons jsonb)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
  ready boolean := private.assert_match_ready();
  a uuid := least(me, p_target);
  b uuid := greatest(me, p_target);
  m public.irly_matches;
  conv uuid;
  sc integer;
  rs jsonb;
  starter text;
begin
  if p_action in ('like', 'save') and not private.match_ready(p_target) then
    raise exception 'this profile is not verified' using errcode = '42501';
  end if;
  if p_action not in ('like', 'pass', 'save', 'unsave') then
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
  if p_target = me then
    raise exception 'cannot act on yourself' using errcode = '22023';
  end if;
  if not private.is_girl_eligible(p_target) or private.is_blocked(me, p_target)
     or not exists (select 1 from public.irly_match_profiles where irly_match_profiles.user_id = p_target and visible) then
    raise exception 'profile not available' using errcode = 'P0002';
  end if;

  if p_action = 'unsave' then
    delete from public.irly_match_actions where actor_id = me and target_id = p_target and action = 'save';
    return;
  end if;
  if p_action = 'save' then
    insert into public.irly_match_actions (actor_id, target_id, action) values (me, p_target, 'save') on conflict do nothing;
    return;
  end if;

  -- Changing your mind replaces the previous decision.
  delete from public.irly_match_actions where actor_id = me and target_id = p_target and action in ('like', 'pass') and action <> p_action;
  insert into public.irly_match_actions (actor_id, target_id, action) values (me, p_target, p_action) on conflict do nothing;

  if p_action <> 'like' or not exists (
    select 1 from public.irly_match_actions where actor_id = p_target and target_id = me and action = 'like'
  ) then
    return;
  end if;

  select s.score, s.reasons into sc, rs from private.match_score(a, b) s;
  insert into public.irly_matches (user_a, user_b, score, reasons) values (a, b, sc, rs)
  on conflict (user_a, user_b) do update set removed_at = null, removed_by = null
    where irly_matches.removed_at is not null
  returning * into m;
  if m.id is null then
    -- Already matched: nothing new.
    select * into m from public.irly_matches where user_a = a and user_b = b and removed_at is null;
    if m.id is null then
      return;
    end if;
    select c.id into conv from public.conversations c where c.match_id = m.id;
    return query select m.id, conv, m.score::integer, m.reasons;
    return;
  end if;

  conv := private.ensure_conversation('match', m.id, null);
  insert into public.conversation_members (conversation_id, user_id) values (conv, a), (conv, b) on conflict do nothing;

  -- Conversation starters from what they actually share.
  if not exists (select 1 from public.messages where messages.conversation_id = conv) then
    starter := case
      when jsonb_array_length(m.reasons -> 'sports') > 0 then 'You both love ' || (m.reasons -> 'sports' ->> 0) || ' 👀'
      when jsonb_array_length(m.reasons -> 'activities') > 0 then 'You both like ' || (m.reasons -> 'activities' ->> 0) || '.'
      when jsonb_array_length(m.reasons -> 'travel') > 0 then 'You both love travelling ✈️'
      when jsonb_array_length(m.reasons -> 'interests') > 0 then 'You both are into ' || (m.reasons -> 'interests' ->> 0) || '.'
      else 'You both want to meet new people.'
    end;
    insert into public.messages (conversation_id, sender_id, kind, body) values
      (conv, null, 'system', 'It''s an IRLY match. Say hello!'),
      (conv, null, 'starter', starter),
      (conv, null, 'starter', 'Want to grab coffee or create an activity together?');
  end if;

  perform private.notify(a, 'MATCH_CREATED', jsonb_build_object('match_id', m.id, 'conversation_id', conv, 'with', b));
  perform private.notify(b, 'MATCH_CREATED', jsonb_build_object('match_id', m.id, 'conversation_id', conv, 'with', a));
  return query select m.id, conv, m.score::integer, m.reasons;
end $$;
