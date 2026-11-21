-- Private communities joined by application, and co-admins named by the
-- co-admins in charge of roles.
--
--  1. communities.access           'open' (as before) or 'application'.
--  2. Members-only content         posts, their comments and likes, channels,
--                                  pinned activities, the member list, the
--                                  media, the search, the games shared
--                                  there: closed to non-members of a
--                                  private community. Its page (name,
--                                  texts, cover, numbers) stays readable.
--  3. community_applications       one pending request per person and
--                                  community; read by its author and by the
--                                  team in charge only.
--  4. RPCs                         community_access, community_set_access,
--                                  community_apply, community_withdraw_application,
--                                  community_applications, community_decide_application.
--  5. join_community               refuses a private community (and a group
--                                  of a private community for a non-member).
--  6. community_set_role           a co-admin with the roles permission names
--                                  and removes co-admins; the new co-admin
--                                  never receives that permission from it.
--  7. Notifications                COMMUNITY_APPLICATION (to the team),
--                                  COMMUNITY_APPLICATION_ACCEPTED / _REFUSED
--                                  (to the applicant).
--
-- No existing row changes: every community stays 'open', every member stays.

-- ───────── 1. Access ─────────
alter table public.communities add column if not exists access text not null default 'open';
alter table public.communities drop constraint if exists communities_access_check;
alter table public.communities add constraint communities_access_check check (access in ('open', 'application'));
alter table public.communities add column if not exists application_questions jsonb not null default '[]';

/** Up to three questions of 3 to 200 characters, trimmed; anything else is refused. */
create or replace function private.application_questions_clean(p jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  q jsonb;
  s text;
  clean jsonb := '[]';
begin
  if p is null or jsonb_typeof(p) <> 'array' then
    raise exception 'questions: a list of texts' using errcode = '22023';
  end if;
  for q in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(q) <> 'string' then
      raise exception 'questions: a list of texts' using errcode = '22023';
    end if;
    s := btrim(q #>> '{}');
    if s = '' then continue; end if;
    if char_length(s) not between 3 and 200 then
      raise exception 'a question has 3 to 200 characters' using errcode = '22023';
    end if;
    clean := clean || to_jsonb(s);
  end loop;
  if jsonb_array_length(clean) > 3 then
    raise exception 'three questions at most' using errcode = '22023';
  end if;
  return clean;
end $$;
revoke all on function private.application_questions_clean(jsonb) from public;
grant execute on function private.application_questions_clean(jsonb) to anon, authenticated;

/**
 * Whatever writes the row: IRLY's official communities and the groups of a
 * community stay open, and the questions keep their shape. The access of an
 * existing community changes through community_set_access only (rights and
 * journal): a direct write by an API role is refused. Not security definer,
 * so that current_user is the role that writes.
 */
create or replace function private.community_access_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and current_user in ('anon', 'authenticated')
     and (new.access is distinct from old.access or new.application_questions is distinct from old.application_questions) then
    raise exception 'the access cannot be changed' using errcode = '42501';
  end if;
  if new.access = 'application' and (new.official or new.parent_id is not null) then
    raise exception 'this community cannot be private' using errcode = '22023';
  end if;
  new.application_questions := private.application_questions_clean(new.application_questions);
  return new;
end $$;
revoke all on function private.community_access_guard() from public;
grant execute on function private.community_access_guard() to anon, authenticated;
drop trigger if exists communities_access_guard on public.communities;
create trigger communities_access_guard before insert or update of access, application_questions, official, parent_id
  on public.communities for each row execute function private.community_access_guard();

/** Joined by application: the community itself, or the community a group belongs to. */
create or replace function private.community_is_private(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.communities c
    left join public.communities p on p.id = c.parent_id
    where c.id = cid and (c.access = 'application' or coalesce(p.access, 'open') = 'application'))
$$;
revoke all on function private.community_is_private(uuid) from public, anon, authenticated;

/**
 * May this person read what members share there? Always in an open
 * community. In a private one: its members (a member of the community reads
 * its groups), not banned, and IRLY's moderators (reports).
 */
create or replace function private.community_content_open_for(cid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not private.community_is_private(cid)
    or (uid is not null and (
      (private.community_rank(cid, uid) >= 0 and not private.community_banned(cid, uid))
      or private.is_moderator(uid)))
$$;
revoke all on function private.community_content_open_for(uuid, uuid) from public, anon, authenticated;

create or replace function private.community_content_open(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.community_content_open_for(cid, auth.uid())
$$;
revoke all on function private.community_content_open(uuid) from public;
grant execute on function private.community_content_open(uuid) to anon, authenticated;

/** For the functions that read past row level security: refuses a non-member of a private community. */
create or replace function private.community_members_only(cid uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.community_content_open_for(cid, auth.uid()) then
    raise exception 'this community is private: members only' using errcode = '42501';
  end if;
end $$;
revoke all on function private.community_members_only(uuid) from public, anon, authenticated;

-- ───────── 2. Members-only content ─────────
-- Restrictive policies: added to what each table already requires, nothing
-- of the existing rules is rewritten. Comments, likes, poll votes and post
-- pins read their post through community_posts, so they close with it.
drop policy if exists community_posts_private on public.community_posts;
create policy community_posts_private on public.community_posts as restrictive for select
  using (community_id is null or private.community_content_open(community_id));

drop policy if exists community_channels_private on public.community_channels;
create policy community_channels_private on public.community_channels as restrictive for select
  using (private.community_content_open(community_id));

drop policy if exists community_activity_pins_private on public.community_activity_pins;
create policy community_activity_pins_private on public.community_activity_pins as restrictive for select
  using (private.community_content_open(community_id));

-- The four functions that read a community's content past row level
-- security each start with private.community_open_to_me: the members-only
-- check goes right after it. Their text is otherwise untouched; the
-- migration stops if one of them no longer has that line.
do $$
declare
  f text;
  def text;
  patched text;
  needle constant text := 'perform private.community_open_to_me(p_community);';
begin
  foreach f in array array['community_members_list', 'community_media', 'community_posts_page', 'community_search'] loop
    select pg_get_functiondef(p.oid) into strict def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = f;
    if position('private.community_members_only(p_community)' in def) > 0 then continue; end if;
    if position(needle in def) = 0 then
      raise exception using message = format('community applications: %s has no community_open_to_me line', f);
    end if;
    patched := replace(def, needle, needle || E'\n  perform private.community_members_only(p_community);');
    execute patched;
  end loop;
end $$;

/** The header's numbers for everyone who may see the page; the members' faces for those who may see the members. */
create or replace function public.community_header(p_community uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  faces jsonb := '[]';
begin
  perform private.community_open_to_me(p_community);
  if private.community_content_open_for(p_community, auth.uid()) then
    select coalesce(jsonb_agg(jsonb_build_object('user_id', f.user_id, 'name', f.name)), '[]'::jsonb) into faces
    from public.community_members_list(p_community, null, 5, 0) f;
  end if;
  return jsonb_build_object(
    'members', private.community_member_count(p_community),
    'upcoming_activities', private.community_upcoming_count(p_community),
    'faces', faces,
    'new_members_7d', private.community_member_count(p_community, now() - interval '7 days'));
end $$;
revoke all on function public.community_header(uuid) from public, anon;
grant execute on function public.community_header(uuid) to authenticated;

/**
 * A game shared in a community (its card, and joining from it): as before,
 * plus members only when the community is private.
 */
create or replace function private.game_share_readable(p public.community_posts) returns boolean
language sql stable security definer set search_path = public, private as $$
  select auth.uid() is not null and p.deleted_at is null and p.game_room_id is not null and p.community_id is not null
    and exists (select 1 from public.communities c where c.id = p.community_id and c.deleted_at is null and (not c.girl_only or private.is_girl_eligible()))
    and not private.is_blocked(auth.uid(), p.author_id)
    and private.community_content_open_for(p.community_id, auth.uid())
$$;
revoke all on function private.game_share_readable(public.community_posts) from public, anon, authenticated;

-- ───────── 3. Applications ─────────
create table if not exists public.community_applications (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 10 and 600),
  -- [{ "q": the question as asked, "a": the answer }]
  answers jsonb not null default '[]' check (jsonb_typeof(answers) = 'array'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'refused', 'withdrawn')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null
);
create unique index if not exists community_applications_one_pending
  on public.community_applications (community_id, user_id) where status = 'pending';
create index if not exists community_applications_queue
  on public.community_applications (community_id, created_at) where status = 'pending';
create index if not exists community_applications_user_idx on public.community_applications (user_id, created_at desc);

/**
 * Who answers applications: the owner, a co-admin in charge of members or of
 * moderation, and IRLY's admins. Without IRLY Girl access, nobody does in a
 * women-only community (community_rights_for gives no rights at all).
 */
create or replace function private.community_reviews(cid uuid, uid uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb := private.community_rights_for(cid, uid);
begin
  if r is null or uid is null then return false; end if;
  return (r ->> 'rank')::integer >= 2
    and (coalesce((r ->> 'can_manage_members')::boolean, false) or coalesce((r ->> 'can_moderate')::boolean, false));
end $$;
revoke all on function private.community_reviews(uuid, uuid) from public, anon, authenticated;

create or replace function private.i_review(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.community_reviews(cid, auth.uid())
$$;
revoke all on function private.i_review(uuid) from public, anon;
grant execute on function private.i_review(uuid) to authenticated;

alter table public.community_applications enable row level security;
revoke all on table public.community_applications from anon, authenticated;
grant select on table public.community_applications to authenticated;
-- Read by its author and by the team in charge; written by the functions below only.
drop policy if exists community_applications_read on public.community_applications;
create policy community_applications_read on public.community_applications for select to authenticated
  using (user_id = (select auth.uid()) or private.i_review(community_id));

-- A membership that starts another way (the community opened, a join) closes the pending request.
create or replace function private.community_application_joined() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.community_applications
  set status = 'accepted', decided_at = now()
  where community_id = new.community_id and user_id = new.user_id and status = 'pending';
  return null;
end $$;
revoke all on function private.community_application_joined() from public, anon, authenticated;
drop trigger if exists community_members_close_application on public.community_members;
create trigger community_members_close_application after insert on public.community_members
  for each row execute function private.community_application_joined();

-- ───────── Notification kinds ─────────
do $$
declare
  def text;
  kinds text[];
  k text;
  added boolean := false;
begin
  select pg_get_constraintdef(oid) into def from pg_constraint
  where conrelid = 'public.notifications'::regclass and conname = 'notifications_kind_check';
  if def is null then raise exception using message = 'notifications_kind_check not found'; end if;
  -- Either form: ARRAY['A'::text, …] or '{A,B,…}'::text[].
  if position('{' in def) > 0 then
    kinds := string_to_array(substring(def from '\{([^}]*)\}'), ',');
  else
    select array_agg(m.x[1]) into kinds from regexp_matches(def, '''([A-Z_]+)''', 'g') as m(x);
  end if;
  if coalesce(cardinality(kinds), 0) = 0 then
    raise exception using message = 'notifications_kind_check: kinds not found', detail = def;
  end if;
  foreach k in array array['COMMUNITY_APPLICATION', 'COMMUNITY_APPLICATION_ACCEPTED', 'COMMUNITY_APPLICATION_REFUSED'] loop
    if not k = any (kinds) then
      kinds := kinds || k;
      added := true;
    end if;
  end loop;
  if not added then return; end if;
  alter table public.notifications drop constraint notifications_kind_check;
  execute format('alter table public.notifications add constraint notifications_kind_check check (kind = any (%L::text[]))', kinds);
end $$;

-- Push texts: three cases added before the fallback of private.push_text,
-- every other case untouched. The migration stops if the fallback moved.
do $$
declare
  def text;
  needle constant text := E'    else\n      title := ''IRLY'';\n      body := case when fr then ''Tu as une nouvelle notification''';
  cases constant text := $cases$    when 'COMMUNITY_APPLICATION' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := coalesce(who, someone) || case when fr then ' demande à rejoindre la communauté' else ' asks to join the community' end;
      url := case when n.payload ? 'community_id' then '/community/manage/' || (n.payload ->> 'community_id') || '?section=applications' else '/notifications' end;
    when 'COMMUNITY_APPLICATION_ACCEPTED' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := case when fr then 'Ta candidature est acceptée. Bienvenue !' else 'Your application was accepted. Welcome!' end;
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    when 'COMMUNITY_APPLICATION_REFUSED' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := case when fr then 'Ta candidature n’a pas été retenue' else 'Your application was not accepted' end;
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
$cases$;
begin
  select pg_get_functiondef(p.oid) into strict def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname = 'push_text';
  if position('COMMUNITY_APPLICATION_ACCEPTED' in def) > 0 then return; end if;
  if position(needle in def) = 0 then
    raise exception using message = 'community applications: the fallback of private.push_text was not found';
  end if;
  execute replace(def, needle, cases || needle);
end $$;

-- ───────── 4. Functions ─────────

/**
 * What the page needs to know about joining: the access, the questions, my
 * own request (the last one), and for the team the number waiting.
 */
create or replace function public.community_access(p_community uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c public.communities;
  me uuid := auth.uid();
  mine public.community_applications;
  reviews boolean;
begin
  c := private.community_open_to_me(p_community);
  select * into mine from public.community_applications a
  where a.community_id = p_community and a.user_id = me
  order by a.created_at desc limit 1;
  reviews := private.community_reviews(p_community, me);
  return jsonb_build_object(
    'access', c.access,
    'private', private.community_is_private(p_community),
    'questions', c.application_questions,
    'can_read', private.community_content_open_for(p_community, me),
    'application', case when mine.id is null then null else jsonb_build_object(
      'id', mine.id, 'status', mine.status, 'message', mine.message, 'answers', mine.answers,
      'created_at', mine.created_at, 'decided_at', mine.decided_at) end,
    'can_review', reviews,
    'pending', case when reviews then (
      select count(*) from public.community_applications a where a.community_id = p_community and a.status = 'pending') end);
end $$;
revoke all on function public.community_access(uuid) from public, anon;
grant execute on function public.community_access(uuid) to authenticated;

/**
 * Open or by application, with the questions asked to applicants. The owner,
 * or a co-admin in charge of settings. Members stay; requests waiting when
 * a community opens are simply no longer needed (joining closes them).
 */
create or replace function public.community_set_access(p_community uuid, p_access text, p_questions jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  c public.communities;
  v_questions jsonb;
begin
  r := private.community_act(p_community);
  if not coalesce((r ->> 'can_settings')::boolean, false) then
    raise exception 'only the owner or a co-admin in charge of settings can edit the community' using errcode = '42501';
  end if;
  if p_access is null or p_access not in ('open', 'application') then
    raise exception 'access: open or application' using errcode = '22023';
  end if;
  select * into c from public.communities where id = p_community for update;
  if p_access = 'application' and (c.official or c.parent_id is not null) then
    raise exception 'this community cannot be private' using errcode = '22023';
  end if;
  v_questions := case when p_questions is null then c.application_questions else private.application_questions_clean(p_questions) end;
  if c.access is distinct from p_access or c.application_questions is distinct from v_questions then
    update public.communities set access = p_access, application_questions = v_questions where id = p_community;
    perform private.community_log(p_community, 'community.access', null, p_community, null,
      jsonb_build_object('from', c.access, 'to', p_access, 'questions', jsonb_array_length(v_questions)));
  end if;
  return jsonb_build_object('access', p_access, 'questions', v_questions);
end $$;
revoke all on function public.community_set_access(uuid, text, jsonb) from public, anon;
grant execute on function public.community_set_access(uuid, text, jsonb) to authenticated;

/** May this person be a member there: the rules join_community applies, for anyone (why: account, gone, girl, banned, sanctioned). */
create or replace function private.community_eligible(c public.communities, uid uuid, out ok boolean, out why text)
language plpgsql stable security definer set search_path = public as $$
begin
  ok := false;
  if not exists (select 1 from public.profiles p where p.id = uid and p.deleted_at is null) then
    why := 'account';
  elsif c.deleted_at is not null then
    why := 'gone';
  elsif c.girl_only and not private.girl_eligible_unchecked(uid) then
    why := 'girl';
  elsif private.community_banned(c.id, uid) then
    why := 'banned';
  elsif private.is_sanctioned(uid) then
    why := 'sanctioned';
  else
    ok := true;
  end if;
end $$;
revoke all on function private.community_eligible(public.communities, uuid) from public, anon, authenticated;

/**
 * Asks to join a private community: a message (10 to 600 characters) and one
 * answer per question asked. One pending request per community; the team in
 * charge is told. Returns the request.
 */
create or replace function public.community_apply(p_community uuid, p_message text, p_answers jsonb default '[]') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c public.communities;
  e record;
  v_message text := btrim(coalesce(p_message, ''));
  v_answers jsonb := '[]';
  n integer;
  i integer;
  a text;
  app public.community_applications;
  staff uuid;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  perform private.require_profile(me);
  select * into c from public.communities where id = p_community and deleted_at is null;
  if not found then raise exception 'community not found' using errcode = 'P0002'; end if;
  -- IRLY Girl first: an account without access learns nothing else about the community.
  if c.girl_only and not private.is_girl_eligible(me) then
    raise exception 'this community is reserved for IRLY Girl' using errcode = '42501';
  end if;
  if c.access <> 'application' then
    raise exception 'this community is open: join it directly' using errcode = '22023';
  end if;
  select * into e from private.community_eligible(c, me);
  if not e.ok then
    if e.why = 'banned' then
      raise exception 'you were banned from this community' using errcode = '42501';
    elsif e.why = 'girl' then
      raise exception 'this community is reserved for IRLY Girl' using errcode = '42501';
    elsif e.why = 'sanctioned' then
      raise exception 'your account is suspended' using errcode = '42501';
    else
      raise exception 'community not found' using errcode = 'P0002';
    end if;
  end if;
  if exists (select 1 from public.community_members m where m.community_id = p_community and m.user_id = me) then
    raise exception 'you are already a member' using errcode = '22023';
  end if;
  if char_length(v_message) not between 10 and 600 then
    raise exception 'a message has 10 to 600 characters' using errcode = '22023';
  end if;
  n := jsonb_array_length(c.application_questions);
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) <> n then
    raise exception 'answer every question' using errcode = '22023';
  end if;
  for i in 0 .. n - 1 loop
    if jsonb_typeof(p_answers -> i) <> 'string' then
      raise exception 'answer every question' using errcode = '22023';
    end if;
    a := btrim(p_answers ->> i);
    if char_length(a) not between 1 and 400 then
      raise exception 'an answer has 1 to 400 characters' using errcode = '22023';
    end if;
    v_answers := v_answers || jsonb_build_object('q', c.application_questions ->> i, 'a', a);
  end loop;
  -- One request at a time per person and community (a double tap gets the first).
  perform pg_advisory_xact_lock(hashtextextended('community_apply:' || p_community::text || ':' || me::text, 0));
  select * into app from public.community_applications
  where community_id = p_community and user_id = me and status = 'pending';
  if found then
    return jsonb_build_object('id', app.id, 'status', app.status, 'created_at', app.created_at, 'already', true);
  end if;
  if not private.rate_take('community_apply', me::text, interval '1 day', 10)
     or not private.rate_take('community_apply_one', me::text || ':' || p_community::text, interval '7 days', 3) then
    raise exception 'too many applications: try again later' using errcode = 'P0001';
  end if;
  insert into public.community_applications (community_id, user_id, message, answers)
  values (p_community, me, v_message, v_answers)
  returning * into app;
  for staff in
    select m.user_id from public.community_members m
    where m.community_id = p_community and m.role in ('owner', 'co_admin') and m.user_id <> me
      and private.community_reviews(p_community, m.user_id)
  loop
    perform private.community_notify(staff, 'COMMUNITY_APPLICATION', p_community,
      jsonb_build_object('from', me, 'application_id', app.id));
  end loop;
  return jsonb_build_object('id', app.id, 'status', app.status, 'created_at', app.created_at, 'already', false);
end $$;
revoke all on function public.community_apply(uuid, text, jsonb) from public, anon;
grant execute on function public.community_apply(uuid, text, jsonb) to authenticated;

/** Withdraws my pending request (true when there was one). */
create or replace function public.community_withdraw_application(p_community uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n integer;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  update public.community_applications
  set status = 'withdrawn', decided_at = now()
  where community_id = p_community and user_id = me and status = 'pending';
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.community_withdraw_application(uuid) from public, anon;
grant execute on function public.community_withdraw_application(uuid) to authenticated;

/** The requests of a community, for the team in charge: pending ones first come first, or the answered ones. */
create or replace function public.community_applications(p_community uuid, p_status text default 'pending', p_limit integer default 100)
returns table (id uuid, user_id uuid, name text, message text, answers jsonb, status text, created_at timestamptz, decided_at timestamptz, decided_by_name text)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  perform private.community_act(p_community);
  if not private.community_reviews(p_community, me) then
    raise exception 'only the community’s team reads applications' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('pending', 'answered') then
    raise exception 'status: pending or answered' using errcode = '22023';
  end if;
  return query
    select a.id, a.user_id, p.first_name, a.message, a.answers, a.status, a.created_at, a.decided_at,
      (select d.first_name from public.profiles d where d.id = a.decided_by)
    from public.community_applications a
    join public.profiles p on p.id = a.user_id and p.deleted_at is null
    where a.community_id = p_community
      and case when p_status = 'pending' then a.status = 'pending' else a.status in ('accepted', 'refused') end
      and not private.blocked_unchecked(me, a.user_id)
    order by case when p_status = 'pending' then a.created_at end asc, a.decided_at desc nulls last, a.id
    limit least(greatest(coalesce(p_limit, 100), 1), 200);
end $$;
revoke all on function public.community_applications(uuid, text, integer) from public, anon;
grant execute on function public.community_applications(uuid, text, integer) to authenticated;

/**
 * Accepts or refuses a request. The row is locked: of two answers sent at
 * the same time, the first decides and the second is told what was decided
 * ({ decided: false, status }). Accepting checks again that the person may
 * be a member (IRLY Girl, ban, account), then creates the membership and
 * closes the request in the same transaction.
 */
create or replace function public.community_decide_application(p_application uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  app public.community_applications;
  c public.communities;
  e record;
  conv uuid;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_accept is null then raise exception 'accept or refuse' using errcode = '22023'; end if;
  select * into app from public.community_applications where id = p_application for update;
  if not found then raise exception 'application not found' using errcode = 'P0002'; end if;
  -- Rights are read after the lock: a co-admin demoted meanwhile decides nothing.
  perform private.community_act(app.community_id);
  if not private.community_reviews(app.community_id, me) then
    raise exception 'only the community’s team answers applications' using errcode = '42501';
  end if;
  -- Nobody answers her own request (an IRLY admin included).
  if app.user_id = me then raise exception 'not on yourself' using errcode = '22023'; end if;
  if app.status <> 'pending' then
    return jsonb_build_object('decided', false, 'status', app.status);
  end if;
  select * into c from public.communities where id = app.community_id and deleted_at is null;
  if not found then raise exception 'community not found' using errcode = 'P0002'; end if;
  if not p_accept then
    update public.community_applications set status = 'refused', decided_at = now(), decided_by = me where id = app.id;
    perform private.community_log(c.id, 'application.refuse', app.user_id, app.id, null);
    perform private.community_notify(app.user_id, 'COMMUNITY_APPLICATION_REFUSED', c.id, jsonb_build_object('application_id', app.id));
    return jsonb_build_object('decided', true, 'status', 'refused');
  end if;
  select * into e from private.community_eligible(c, app.user_id);
  if not e.ok then
    if e.why = 'girl' then
      raise exception 'this person does not have access to IRLY Girl' using errcode = '42501';
    elsif e.why = 'banned' then
      raise exception 'this person is banned from this community' using errcode = '42501';
    elsif e.why = 'account' then
      raise exception 'this account no longer exists' using errcode = '42501';
    elsif e.why = 'sanctioned' then
      raise exception 'this account is suspended' using errcode = '42501';
    else
      raise exception 'community not found' using errcode = 'P0002';
    end if;
  end if;
  update public.community_applications set status = 'accepted', decided_at = now(), decided_by = me where id = app.id;
  insert into public.community_members (community_id, user_id) values (c.id, app.user_id) on conflict do nothing;
  conv := private.ensure_conversation('community', c.id, c.name);
  insert into public.conversation_members (conversation_id, user_id) values (conv, app.user_id) on conflict do nothing;
  perform private.community_log(c.id, 'application.accept', app.user_id, app.id, null);
  perform private.community_notify(app.user_id, 'COMMUNITY_APPLICATION_ACCEPTED', c.id,
    jsonb_build_object('application_id', app.id, 'conversation_id', conv));
  return jsonb_build_object('decided', true, 'status', 'accepted');
end $$;
revoke all on function public.community_decide_application(uuid, boolean) from public, anon;
grant execute on function public.community_decide_application(uuid, boolean) to authenticated;

-- ───────── 5. Joining ─────────
-- As 20261107000000, plus: a private community is joined by application, and
-- a group of a private community by its members only.
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
  perform private.require_profile(me);
  select * into c from public.communities where id = p_community and deleted_at is null;
  if not found then
    raise exception 'community not found' using errcode = 'P0002';
  end if;
  if c.girl_only and not private.is_girl_eligible(me) then
    raise exception 'this community is reserved for IRLY Girl' using errcode = '42501';
  end if;
  if private.community_banned(p_community, me) then
    raise exception 'you were banned from this community' using errcode = '42501';
  end if;
  if not exists (select 1 from public.community_members m where m.community_id = p_community and m.user_id = me) then
    if c.access = 'application' then
      raise exception 'this community is joined by application' using errcode = '42501';
    end if;
    if c.parent_id is not null and private.community_is_private(p_community)
       and not exists (select 1 from public.community_members m where m.community_id = c.parent_id and m.user_id = me) then
      raise exception 'this community is joined by application' using errcode = '42501';
    end if;
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
revoke all on function public.join_community(uuid) from public, anon;
grant execute on function public.join_community(uuid) to authenticated;

-- ───────── 6. Roles ─────────
/**
 * Sets a member's role: co_admin, moderator or member. The owner gives any
 * of them. A co-admin with the roles permission names and removes moderators
 * and co-admins, except a co-admin who holds that permission too (the owner
 * only). A new co-admin never receives the roles permission here: the owner
 * alone grants it (community_set_permissions), so promotions cannot chain.
 * Naming needs an active member: not banned, not restricted.
 */
create or replace function public.community_set_role(p_community uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  old_role text;
  old_perms jsonb;
  rank integer;
  default_perms constant jsonb := '{"members": true, "moderation": true, "announcements": true, "activities": true, "settings": false, "stats": true, "roles": false}';
begin
  if p_role is null or p_role not in ('co_admin', 'moderator', 'member') then
    raise exception 'role: co_admin, moderator or member' using errcode = '22023';
  end if;
  r := private.community_act(p_community);
  if not (r ->> 'can_roles')::boolean then
    raise exception 'only the owner or IRLY can change roles' using errcode = '42501';
  end if;
  rank := (r ->> 'rank')::integer;
  if p_user is null then raise exception 'who?' using errcode = '22023'; end if;
  if p_user = auth.uid() then raise exception 'not on yourself' using errcode = '22023'; end if;
  select role, permissions into old_role, old_perms from public.community_members
  where community_id = p_community and user_id = p_user for update;
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
  if old_role = 'owner' then raise exception 'the owner''s role cannot be changed' using errcode = '42501'; end if;
  if rank >= 3 then
    perform private.community_outranks(p_community, r, p_user);
  elsif rank = 2 then
    -- A co-admin in charge of roles: members, moderators and the co-admins who are not in charge of roles.
    if old_role = 'co_admin' and coalesce((old_perms ->> 'roles')::boolean, false) then
      raise exception 'only the owner changes the role of a co-admin in charge of roles' using errcode = '42501';
    end if;
    if private.community_rank(p_community, p_user) > 2 then
      raise exception 'not on someone of your rank or above' using errcode = '42501';
    end if;
  else
    raise exception 'only the owner or IRLY can change roles' using errcode = '42501';
  end if;
  if old_role = p_role then return; end if;
  if p_role in ('co_admin', 'moderator')
     and (private.community_banned(p_community, p_user) or private.community_restricted_until(p_community, p_user) is not null) then
    raise exception 'this member is banned or restricted: lift it first' using errcode = '22023';
  end if;
  update public.community_members
  set role = p_role, permissions = case when p_role = 'co_admin' then default_perms else '{}' end
  where community_id = p_community and user_id = p_user;
  perform private.community_log(p_community, 'role.set', p_user, null, null, jsonb_build_object('from', old_role, 'to', p_role));
  perform private.community_notify(p_user, 'COMMUNITY_ROLE', p_community, jsonb_build_object('role', p_role, 'previous', old_role));
end $$;
revoke all on function public.community_set_role(uuid, uuid, text) from public, anon;
grant execute on function public.community_set_role(uuid, uuid, text) to authenticated;

-- ───────── 7. What else showed the inside of a private community ─────────
-- Activities of a private community (public by default) are for its members:
-- their organiser and the people already going keep them.
drop policy if exists activities_private_community on public.activities;
create policy activities_private_community on public.activities as restrictive for select
  using (community_id is null or creator_id = (select auth.uid())
    or id in (select private.my_participations())
    or private.community_content_open(community_id));

/** As 20261107000000, plus: a public activity of a private community is for its members. */
create or replace function private.activity_readable(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.activities a
    where a.id = aid and a.moderated_at is null
      and (not a.girl_only or a.creator_id = auth.uid() or private.girl_eligible_unchecked(auth.uid()))
      and (a.creator_id = auth.uid()
        or exists (select 1 from public.activity_participants ap where ap.activity_id = a.id and ap.user_id = auth.uid())
        or (a.cancelled_at is null
          and not private.blocked_unchecked(auth.uid(), a.creator_id)
          and ((a.privacy = 'public' and (a.community_id is null or private.community_content_open_for(a.community_id, auth.uid())))
            or (a.privacy = 'community' and a.community_id is not null and private.i_belong(a.community_id))
            or (a.privacy = 'friends' and private.friends_unchecked(auth.uid(), a.creator_id))
            or (a.privacy = 'invite' and private.invited_to(a.id)))))
  )
$$;

-- Three functions read past row level security with one line each that did
-- not know private communities: joining a public activity, the communities
-- shown on someone's profile, and the « same community » filter of Match.
-- One line changes in each; the migration stops if a line is not found.
do $$
declare
  spec text[];
  specs constant text[][] := array[
    array['join_activity',
      E'    a.privacy = ''public''\n',
      E'    (a.privacy = ''public'' and (a.community_id is null or private.community_content_open_for(a.community_id, me)))\n'],
    array['member_communities',
      E'    and not private.community_banned(c.id, p_user)\n',
      E'    and not private.community_banned(c.id, p_user)\n    and (v.own or private.community_content_open_for(c.id, v.me))\n'],
    array['irly_match_discover',
      E'      and (p_filters ->> ''community_id'' is null or exists (\n',
      E'      and (p_filters ->> ''community_id'' is null or private.community_content_open_for((p_filters ->> ''community_id'')::uuid, auth.uid()) and exists (\n']
  ];
  def text;
begin
  foreach spec slice 1 in array specs loop
    select pg_get_functiondef(p.oid) into strict def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = spec[1];
    if position('community_content_open_for' in def) > 0 then continue; end if;
    if position(spec[2] in def) = 0 then
      raise exception using message = format('community applications: the line to change in %s was not found', spec[1]);
    end if;
    execute replace(def, spec[2], spec[3]);
  end loop;
end $$;
