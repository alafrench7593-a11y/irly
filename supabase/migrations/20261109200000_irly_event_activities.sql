-- Activities members create around an IRLY event (« Y aller ensemble »).
--
-- IRLY's listed events (Discover → Events, /events, the event page) are
-- catalogue content shipped with the app (src/data/content: ids such as
-- 'e-d1', 'e-b3', 'e-abudhabi-0'), not rows of the database. An activity
-- made from one keeps that stable key in activities.event_key: the event
-- page asks the server for the plans linked to it, the activity page shows
-- the event it belongs to. A key is a format, checked here; it is not a
-- foreign key (there is no events table to point at).
--
-- 1. activities.event_key text: null, or 'e-' and lower-case letters,
--    digits and single dashes (64 characters at most). Set when the plan
--    is created; afterwards it can only be kept or removed (a plan is not
--    moved under another event's page).
-- 2. public.event_activities(p_event text, p_limit integer default 50):
--    the plans linked to an event that the caller may see. Security
--    invoker: the read rules of activities apply (privacy, IRLY Girl,
--    moderation), and on top of them, for a list shown to everyone:
--      * cancelled, removed by the team and finished plans are left out;
--      * women-only plans only for women with IRLY Girl access (never a
--        man, even one still holding an old participation);
--      * members-only plans (privacy 'community') only for the
--        community's members (and their host);
--      * nobody blocked, either way, even as a participant;
--      * friends-only and invite-only plans stay out of the event page:
--        it is a public page, they are found where they were shared.
--    Signed out: refused.
--
-- Tests: supabase/tests/event_activities.test.sql.

-- ───────── 1. The link ─────────
alter table public.activities add column if not exists event_key text;

alter table public.activities drop constraint if exists activities_event_key_format;
alter table public.activities add constraint activities_event_key_format
  check (event_key is null or (char_length(event_key) <= 64 and event_key ~ '^e-[a-z0-9]+(-[a-z0-9]+)*$'));

create index if not exists activities_event_key_idx on public.activities (event_key, starts_at)
  where event_key is not null and cancelled_at is null;

-- Kept or removed, never moved to another event (the team may correct it).
create or replace function private.activity_event_keep() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or private.i_am_staff() then return new; end if;
  if new.event_key is not null and new.event_key is distinct from old.event_key then
    raise exception 'a plan stays with the event it was made for' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.activity_event_keep() from public, anon, authenticated;

drop trigger if exists activities_event_keep on public.activities;
create trigger activities_event_keep before update of event_key on public.activities
for each row execute function private.activity_event_keep();

-- ───────── 2. The plans linked to an event ─────────
create or replace function public.event_activities(p_event text, p_limit integer default 50)
returns table (id uuid, title text, category_id text, sub_id text, city_id text, area_id text, place_name text,
  starts_at timestamptz, ends_at timestamptz, capacity integer, going integer, girl_only boolean,
  community_id uuid, community_name text, creator_id uuid, creator_name text, cover_url text, my_status text)
language plpgsql stable security invoker set search_path = public as $$
declare
  me uuid := auth.uid();
  girl boolean;
  blocked uuid[];
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_event is null or char_length(p_event) > 64 or p_event !~ '^e-[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'unknown event' using errcode = '22023';
  end if;
  girl := private.is_girl_eligible();
  blocked := private.my_block_ids();
  return query
  select a.id, a.title, a.category_id, a.sub_id, a.city_id, a.area_id, a.place_name,
    a.starts_at, a.ends_at, a.capacity,
    private.going_count(a.id),
    a.girl_only, a.community_id, g.name,
    a.creator_id, p.first_name,
    coalesce(a.cover_path, a.cover_url),
    (select x.status from public.activity_participants x where x.activity_id = a.id and x.user_id = me)
  from public.activities a
  left join public.communities g on g.id = a.community_id and g.deleted_at is null
  -- offset 0: the creator's row only, through the view's own filter.
  left join lateral (select pp.first_name from public.profiles_public pp where pp.id = a.creator_id offset 0) p on true
  where a.event_key = p_event
    and a.cancelled_at is null
    and a.moderated_at is null
    and coalesce(a.ends_at, a.starts_at + interval '2 hours') > now()
    and (not a.girl_only or girl)
    and not (a.creator_id = any (blocked))
    and (a.privacy = 'public'
      or (a.privacy = 'community' and a.community_id is not null
        and (a.creator_id = me or private.i_belong(a.community_id))))
  order by a.starts_at, a.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;
revoke all on function public.event_activities(text, integer) from public, anon;
grant execute on function public.event_activities(text, integer) to authenticated;
