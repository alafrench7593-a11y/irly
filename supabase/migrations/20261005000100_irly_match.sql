-- IRLY Girl Match: women-only friendship matching.
-- Eligibility, visibility, scoring and match creation all happen here.
-- Clients can only call the functions below; they never read another
-- member's match profile directly.

-- ───────────────────────── Configuration ─────────────────────────

-- Weights live in the database so product can tune matching without an app
-- release. Each weight multiplies a 0..1 similarity; the score is the
-- weighted mean over the facets both people filled in.
create table public.irly_match_config (
  id smallint primary key default 1 check (id = 1),
  weights jsonb not null,
  min_score integer not null default 0 check (min_score between 0 and 100),
  updated_at timestamptz not null default now()
);

insert into public.irly_match_config (weights) values (jsonb_build_object(
  'interests', 3,
  'activities', 2.5,
  'sports', 2,
  'goals', 2.5,
  'lifestyle', 2,
  'languages', 1.5,
  'availability', 1.5,
  'areas', 1,
  'age', 1,
  'communities', 1,
  'travel', 1
));

-- ───────────────────────── Profiles ─────────────────────────

create table public.irly_match_onboarding (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now()
);

create table public.irly_match_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  visible boolean not null default true,
  bio text check (bio is null or char_length(bio) <= 300),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) between 0 and 6),
  interests text[] not null default '{}',
  sports text[] not null default '{}',
  activities text[] not null default '{}',
  goals text[] not null default '{}' check (cardinality(goals) >= 1),
  languages text[] not null default '{}',
  -- Neighbourhoods, never coordinates.
  areas text[] not null default '{}',
  availability text[] not null default '{}',
  travel text[] not null default '{}',
  -- Each dimension is -1, 0 or 1: chronotype (morning..night), social
  -- (introvert..social), planning (planner..spontaneous), energy
  -- (relaxed..active), setting (city..nature), travel frequency.
  lifestyle jsonb not null default '{}',
  age_min smallint not null default 18 check (age_min >= 18),
  age_max smallint not null default 99 check (age_max >= age_min),
  -- Fields the member keeps to herself (e.g. 'age', 'languages', 'areas').
  hidden_fields text[] not null default '{}',
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index irly_match_profiles_visible_idx on public.irly_match_profiles (visible, last_active_at desc);
create index irly_match_profiles_interests_idx on public.irly_match_profiles using gin (interests);
create index irly_match_profiles_sports_idx on public.irly_match_profiles using gin (sports);

create trigger irly_match_profiles_touch before update on public.irly_match_profiles
for each row execute function private.touch_updated_at();

-- ───────────────────────── Actions & matches ─────────────────────────

create table public.irly_match_actions (
  actor_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in ('like', 'pass', 'save')),
  created_at timestamptz not null default now(),
  primary key (actor_id, target_id, action),
  check (actor_id <> target_id)
);

-- Like and pass exclude each other; save is independent.
create unique index irly_match_actions_decision_idx on public.irly_match_actions (actor_id, target_id) where action <> 'save';
create index irly_match_actions_target_idx on public.irly_match_actions (target_id, action);

create table public.irly_matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  reasons jsonb not null default '{}',
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references public.profiles (id) on delete set null,
  -- One match per pair, whoever liked first.
  check (user_a < user_b),
  unique (user_a, user_b)
);

create index irly_matches_b_idx on public.irly_matches (user_b);

alter table public.conversations
  add constraint conversations_match_fk foreign key (match_id) references public.irly_matches (id) on delete cascade;

alter table public.irly_match_config enable row level security;
alter table public.irly_match_onboarding enable row level security;
alter table public.irly_match_profiles enable row level security;
alter table public.irly_match_actions enable row level security;
alter table public.irly_matches enable row level security;

create policy match_config_read on public.irly_match_config for select to authenticated using (true);
create policy match_config_admin on public.irly_match_config for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy match_onboarding_self on public.irly_match_onboarding for select to authenticated using (user_id = auth.uid());

-- Your own match profile only, and only if you are eligible.
create policy match_profile_self on public.irly_match_profiles for all to authenticated
  using (user_id = auth.uid() and private.is_girl_eligible(auth.uid()))
  with check (
    user_id = auth.uid()
    and private.is_girl_eligible(auth.uid())
    and exists (select 1 from public.irly_match_onboarding o where o.user_id = auth.uid())
  );

create policy match_actions_self on public.irly_match_actions for select to authenticated using (actor_id = auth.uid());

create policy matches_self on public.irly_matches for select to authenticated
  using (auth.uid() in (user_a, user_b) and removed_at is null);

-- ───────────────────────── Scoring ─────────────────────────

-- Set similarity: |A ∩ B| / sqrt(|A| · |B|). 1 when identical, 0 when
-- disjoint, and fair between someone with 3 interests and someone with 12.
create or replace function private.set_similarity(a text[], b text[]) returns numeric
language sql immutable as $$
  select case
    when coalesce(cardinality(a), 0) = 0 or coalesce(cardinality(b), 0) = 0 then null
    else (select count(*) from (select unnest(a) intersect select unnest(b)) x)::numeric
         / sqrt(cardinality(a)::numeric * cardinality(b)::numeric)
  end
$$;

create or replace function private.shared(a text[], b text[]) returns text[]
language sql immutable as $$
  select coalesce(array_agg(x order by x), '{}') from (select unnest(a) intersect select unnest(b)) s(x)
$$;

-- Lifestyle: mean agreement over the dimensions both answered (-1..1 each).
create or replace function private.lifestyle_similarity(a jsonb, b jsonb) returns numeric
language sql immutable as $$
  select avg(1 - abs((a ->> k)::numeric - (b ->> k)::numeric) / 2)
  from jsonb_object_keys(a) k
  where b ? k and jsonb_typeof(a -> k) = 'number' and jsonb_typeof(b -> k) = 'number'
$$;

create or replace function private.age_of(uid uuid) returns integer
language sql stable as $$
  select date_part('year', age(current_date, birthdate))::integer from public.profiles where id = uid
$$;

-- Age fits when each is inside the other's range; it fades over 10 years outside.
create or replace function private.age_similarity(age_a integer, min_a integer, max_a integer, age_b integer, min_b integer, max_b integer) returns numeric
language sql immutable as $$
  select least(
    1 - least(1, greatest(0, min_a - age_b, age_b - max_a)::numeric / 10),
    1 - least(1, greatest(0, min_b - age_a, age_a - max_b)::numeric / 10)
  )
$$;

create or replace function private.match_score(a uuid, b uuid) returns table (score integer, reasons jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  pa public.irly_match_profiles;
  pb public.irly_match_profiles;
  w jsonb;
  facets jsonb := '{}';
  num numeric := 0;
  den numeric := 0;
  k text;
  sim numeric;
  comm_a text[];
  comm_b text[];
begin
  select * into pa from public.irly_match_profiles where user_id = a;
  select * into pb from public.irly_match_profiles where user_id = b;
  if pa.user_id is null or pb.user_id is null then
    return query select 0, '{}'::jsonb;
    return;
  end if;
  select weights into w from public.irly_match_config where id = 1;
  select coalesce(array_agg(community_id::text), '{}') into comm_a from public.community_members where user_id = a;
  select coalesce(array_agg(community_id::text), '{}') into comm_b from public.community_members where user_id = b;

  facets := jsonb_build_object(
    'interests', private.set_similarity(pa.interests, pb.interests),
    'activities', private.set_similarity(pa.activities, pb.activities),
    'sports', private.set_similarity(pa.sports, pb.sports),
    'goals', private.set_similarity(pa.goals, pb.goals),
    'lifestyle', private.lifestyle_similarity(pa.lifestyle, pb.lifestyle),
    'languages', case when cardinality(private.shared(pa.languages, pb.languages)) > 0 then 1
                      when cardinality(pa.languages) > 0 and cardinality(pb.languages) > 0 then 0 end,
    'availability', private.set_similarity(pa.availability, pb.availability),
    'areas', private.set_similarity(pa.areas, pb.areas),
    'age', private.age_similarity(private.age_of(a), pa.age_min, pa.age_max, private.age_of(b), pb.age_min, pb.age_max),
    'communities', private.set_similarity(comm_a, comm_b),
    'travel', private.set_similarity(pa.travel, pb.travel)
  );

  for k in select jsonb_object_keys(facets) loop
    if jsonb_typeof(facets -> k) = 'number' and w ? k then
      sim := (facets ->> k)::numeric;
      num := num + sim * (w ->> k)::numeric;
      den := den + (w ->> k)::numeric;
    end if;
  end loop;

  return query select
    case when den = 0 then 0 else round(100 * num / den)::integer end,
    jsonb_build_object(
      'interests', private.shared(pa.interests, pb.interests),
      'activities', private.shared(pa.activities, pb.activities),
      'sports', private.shared(pa.sports, pb.sports),
      'goals', private.shared(pa.goals, pb.goals),
      'languages', private.shared(pa.languages, pb.languages),
      'areas', private.shared(pa.areas, pb.areas),
      'availability', private.shared(pa.availability, pb.availability),
      'travel', private.shared(pa.travel, pb.travel),
      'facets', facets
    );
end $$;

-- ───────────────────────── API (RPC) ─────────────────────────

create or replace function private.require_match_access() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if not private.is_girl_eligible(me) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return me;
end $$;

-- Where the member is in the IRLY Girl flow: 'onboarding', 'profile' or 'ready'.
create or replace function public.irly_match_state() returns text
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
begin
  if not exists (select 1 from public.irly_match_onboarding where user_id = me) then
    return 'onboarding';
  end if;
  if not exists (select 1 from public.irly_match_profiles where user_id = me) then
    return 'profile';
  end if;
  return 'ready';
end $$;

create or replace function public.complete_irly_match_onboarding() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
begin
  insert into public.irly_match_onboarding (user_id) values (me) on conflict do nothing;
end $$;

create or replace function public.irly_match_ping() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
begin
  update public.irly_match_profiles set last_active_at = now() where user_id = me;
end $$;

-- Discovery: eligible, visible, not blocked, not already decided, not
-- matched. Only fields the person chose to show, scored against you.
-- Filters (all optional): interests[], sport, language, goal, area,
-- availability, community_id, travel (bool), age_min, age_max,
-- section ('for_you' | 'new' | 'active' | 'nearby' | 'interests' | 'sports' | 'travel' | 'saved').
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
      and coalesce(s.profile_visibility, 'everyone') <> 'nobody'
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
      and (p_filters ->> 'age_min' is null or c.page >= (p_filters ->> 'age_min')::integer)
      and (p_filters ->> 'age_max' is null or c.page <= (p_filters ->> 'age_max')::integer)
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
    case when 'areas' = any (sc.hidden_fields) then sc.rs - 'areas' else sc.rs end
  from scored sc
  where sc.sc >= (select min_score from public.irly_match_config where id = 1)
  order by sc.sc desc, sc.last_active_at desc
  limit lim offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- Like, pass or save. A like that meets a like becomes a match, with its
-- private chat and conversation starters, in one transaction. Idempotent:
-- liking twice or racing a mutual like never creates two matches or chats.
create or replace function public.irly_match_act(p_target uuid, p_action text)
returns table (match_id uuid, conversation_id uuid, score integer, reasons jsonb)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
  a uuid := least(me, p_target);
  b uuid := greatest(me, p_target);
  m public.irly_matches;
  conv uuid;
  sc integer;
  rs jsonb;
  starter text;
begin
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

-- Your matches, newest first, with the other person's visible card.
create or replace function public.irly_my_matches()
returns table (match_id uuid, conversation_id uuid, user_id uuid, first_name text, photo_paths text[], score integer, reasons jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, c.id, other.id, other.first_name, coalesce(mp.photo_paths, '{}'), m.score::integer, m.reasons, m.created_at
  from public.irly_matches m
  cross join lateral (select case when m.user_a = private.require_match_access() then m.user_b else m.user_a end as oid) o
  join public.profiles other on other.id = o.oid and other.deleted_at is null
  left join public.irly_match_profiles mp on mp.user_id = other.id
  left join public.conversations c on c.match_id = m.id
  where auth.uid() in (m.user_a, m.user_b)
    and m.removed_at is null
    and not private.is_blocked(m.user_a, m.user_b)
  order by m.created_at desc
$$;

-- Unmatch: the match disappears for both and the private chat closes.
create or replace function public.irly_unmatch(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
  m public.irly_matches;
begin
  update public.irly_matches set removed_at = now(), removed_by = me
  where id = p_match and me in (user_a, user_b) and removed_at is null
  returning * into m;
  if m.id is null then
    return;
  end if;
  delete from public.conversation_members cm using public.conversations c
  where c.id = cm.conversation_id and c.match_id = m.id;
  -- Unmatching also withdraws the like, so the pair does not re-match by itself.
  delete from public.irly_match_actions where actor_id = me and target_id = case when m.user_a = me then m.user_b else m.user_a end and action = 'like';
  perform private.notify(case when m.user_a = me then m.user_b else m.user_a end, 'MATCH_REMOVED', jsonb_build_object('match_id', m.id));
end $$;

-- Block: hides both people from each other everywhere and ends any match.
create or replace function public.block_user(p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  mid uuid;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (me, p_target) on conflict do nothing;
  select id into mid from public.irly_matches where user_a = least(me, p_target) and user_b = greatest(me, p_target) and removed_at is null;
  if mid is not null then
    update public.irly_matches set removed_at = now(), removed_by = me where id = mid;
    delete from public.conversation_members cm using public.conversations c where c.id = cm.conversation_id and c.match_id = mid;
  end if;
  delete from public.irly_match_actions where (actor_id = me and target_id = p_target) or (actor_id = p_target and target_id = me);
end $$;

create or replace function public.unblock_user(p_target uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_target
$$;

revoke all on function
  public.irly_match_state(), public.complete_irly_match_onboarding(), public.irly_match_ping(),
  public.irly_match_discover(jsonb, integer, integer), public.irly_match_act(uuid, text),
  public.irly_my_matches(), public.irly_unmatch(uuid), public.block_user(uuid), public.unblock_user(uuid)
from public, anon;
grant execute on function
  public.irly_match_state(), public.complete_irly_match_onboarding(), public.irly_match_ping(),
  public.irly_match_discover(jsonb, integer, integer), public.irly_match_act(uuid, text),
  public.irly_my_matches(), public.irly_unmatch(uuid), public.block_user(uuid), public.unblock_user(uuid)
to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_admin(uuid), private.is_girl_eligible(uuid), private.is_blocked(uuid, uuid),
  private.is_member(uuid, uuid), private.shares_conversation(uuid, uuid), private.assert_self(uuid[]),
  private.girl_eligible_unchecked(uuid), private.blocked_unchecked(uuid, uuid), private.shares_unchecked(uuid, uuid) to authenticated;
