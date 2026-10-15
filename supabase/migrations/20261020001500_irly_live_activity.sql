-- Live + "Anyone can join": the activity exists only with its Live.
--
-- Before: the app created the activity while the photo or video uploaded,
-- then inserted the Live. A failed or abandoned Live (screen closed, network
-- lost, app killed) left the activity published on its own.
--
-- 1. public.post_live(p_post, p_activity): the Live and its activity in ONE
--    transaction (security invoker: the same row rules, rate limits and
--    triggers as the plain inserts). Either both exist or neither does.
--    Idempotent on the Live's id (made on the phone): a retry whose first
--    answer got lost returns the row already saved, never a second Live or a
--    second activity (the activity's client_ref is the Live's id).
-- 2. public.abandon_live(p_post): the member gave up on a Live that was not
--    confirmed. Answers 'published' when it did land (nothing is touched);
--    otherwise records the id as abandoned, so a late copy of the same request
--    can never publish it afterwards, and rolls back an activity made for it
--    by an older app (client_ref = the Live's id): deleted when nobody else
--    is in it, cancelled (never deleted) when someone else joined.
-- Both take the same per-Live lock: a publish and an abandon of the same Live
-- never interleave; the first one wins and the other sees its result.
-- Nothing existing is changed or removed.

create table if not exists private.live_abandoned (
  post_id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now()
);
revoke all on private.live_abandoned from public, anon, authenticated;

-- Read by post_live (security invoker) without exposing the table.
create or replace function private.live_was_abandoned(p_post uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from private.live_abandoned where post_id = p_post)
$$;
revoke all on function private.live_was_abandoned(uuid) from public, anon;
grant execute on function private.live_was_abandoned(uuid) to authenticated;

create or replace function public.post_live(p_post jsonb, p_activity jsonb default null)
returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  me uuid := auth.uid();
  pid uuid;
  aid uuid;
  r record;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  pid := nullif(p_post ->> 'id', '')::uuid;
  if pid is null then raise exception 'a Live needs its id' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('irly-live:' || pid::text, 0));

  -- Saved by an earlier try whose answer got lost: the same Live, as it is.
  select i.id, i.created_at, i.visibility, i.activity_id into r from public.irl_posts i where i.id = pid and i.author_id = me;
  if found then
    return jsonb_build_object('id', r.id, 'created_at', r.created_at, 'visibility', r.visibility, 'activity_id', r.activity_id, 'replayed', true);
  end if;
  if private.live_was_abandoned(pid) then
    raise exception 'this Live was abandoned' using errcode = '22023';
  end if;

  if p_activity is not null then
    -- An older app may have made it already (same client_ref): reuse it while it is on.
    select a.id into aid from public.activities a where a.creator_id = me and a.client_ref = pid and a.cancelled_at is null;
    if aid is null then
      insert into public.activities (
        creator_id, format, title, description, category_id, sub_id, catalog_activity_id, city_id, area_id, place_name,
        starts_at, timezone, price_minor, currency, capacity, privacy, client_ref
      ) values (
        me,
        coalesce(p_activity ->> 'format', 'meetup'),
        p_activity ->> 'title',
        nullif(p_activity ->> 'description', ''),
        coalesce(p_activity ->> 'category_id', 'entertainment'),
        p_activity ->> 'sub_id',
        p_activity ->> 'catalog_activity_id',
        coalesce(p_activity ->> 'city_id', p_post ->> 'city_id'),
        coalesce(p_activity ->> 'area_id', p_post ->> 'area_id'),
        p_activity ->> 'place_name',
        (p_activity ->> 'starts_at')::timestamptz,
        coalesce(p_activity ->> 'timezone', 'Asia/Dubai'),
        coalesce((p_activity ->> 'price_minor')::integer, 0),
        coalesce(p_activity ->> 'currency', 'AED'),
        (p_activity ->> 'capacity')::integer,
        coalesce(p_activity ->> 'privacy', 'public'),
        pid
      ) returning id into aid;
    end if;
  end if;

  insert into public.irl_posts (
    id, author_id, city_id, area_id, place_name, body, media_path, media_kind, thumb_path, media_seconds, media_ratio, visibility, activity_id
  ) values (
    pid, me,
    p_post ->> 'city_id',
    p_post ->> 'area_id',
    p_post ->> 'place_name',
    coalesce(p_post ->> 'body', ''),
    p_post ->> 'media_path',
    coalesce(p_post ->> 'media_kind', 'photo'),
    p_post ->> 'thumb_path',
    (p_post ->> 'media_seconds')::integer,
    (p_post ->> 'media_ratio')::real,
    coalesce(p_post ->> 'visibility', private.default_irl_visibility()),
    aid
  ) returning id, created_at, visibility, activity_id into r;
  return jsonb_build_object('id', r.id, 'created_at', r.created_at, 'visibility', r.visibility, 'activity_id', r.activity_id, 'replayed', false);
end $$;
revoke all on function public.post_live(jsonb, jsonb) from public, anon;
grant execute on function public.post_live(jsonb, jsonb) to authenticated;

create or replace function public.abandon_live(p_post uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a public.activities;
  author uuid;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_post is null then raise exception 'a Live needs its id' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('irly-live:' || p_post::text, 0));

  select i.author_id into author from public.irl_posts i where i.id = p_post;
  if found then
    -- It landed (or the id is someone else's): nothing of it is touched.
    return case when author = me then 'published' else 'not_mine' end;
  end if;

  insert into private.live_abandoned (post_id, user_id) values (p_post, me) on conflict (post_id) do nothing;
  -- Kept a week: long after any retry of the same request could arrive.
  delete from private.live_abandoned where at < now() - interval '7 days';

  select * into a from public.activities where creator_id = me and client_ref = p_post for update;
  if not found then return 'abandoned'; end if;
  if a.cancelled_at is not null then return 'cancelled'; end if;
  if exists (
    select 1 from public.activity_participants p
    where p.activity_id = a.id and p.user_id <> me and p.status in ('going', 'maybe')
  ) then
    -- Someone else already joined: called off (they hear it), never deleted.
    update public.activities set cancelled_at = now() where id = a.id;
    return 'cancelled';
  end if;
  delete from public.activities where id = a.id;
  return 'deleted';
end $$;
revoke all on function public.abandon_live(uuid) from public, anon;
grant execute on function public.abandon_live(uuid) to authenticated;
