-- Activities in communities and chats (2026-10-28). Additive and
-- data-preserving: two new read functions, two replaced functions (same
-- signatures), no table, column, row or policy is changed or removed, and no
-- message already sent is rewritten. RLS stays on everywhere.
--
-- What already existed and is reused as it is (nothing parallel is built):
--   · activities.community_id (one record per activity, its origin
--     community), privacy 'community', activities_girl_only (an activity of a
--     women-only community is women-only), activities_girl_keep;
--   · join_activity (capacity under a row lock, one row per member thanks to
--     the primary key, the activity chat joined), leave_activity and
--     sync_activity_chat (leaving removes that activity's chat only);
--   · one chat per activity (conversations_activity_id_key), readable by its
--     members only (conversations_read / messages_read: private.is_member);
--   · share_to_chat: a message kind 'share' pointing at the activity
--     (ref_type, ref_id), refused when the sender cannot see it (can_see),
--     kept inside IRLY Girl chats for a women-only plan
--     (messages_girl_ref_guard, messages_girl_card), unreadable by anyone
--     without IRLY Girl access in an IRLY Girl chat (messages_girl_chat).
--
-- New:
--  1. activity_cards: the live card of activities by id (a share in a chat,
--     the activity chat's header, the community feed). Security invoker: the
--     reader's own row rules decide, so an activity she may not see (private,
--     women-only, blocked host, deleted) comes back as no row at all and the
--     app shows « Activity not available ». Nothing is copied into messages.
--  2. community_activity_cards: the cards of a community's (and its groups')
--     activities for its feed, pinned first, with their real state (open,
--     full, happening, ended, cancelled).
--  3. community_activities counted every participant row the reader could
--     see (« maybe » included, people hiding their plans excluded): the
--     Activities tab could say 2 going where the page said 3. It now uses the
--     exact count every other view shows (private.going_count).
--  4. ACTIVITY_UPDATED: also when the end time or the exact address changes,
--     and deduplicated: one UNREAD notice per member and plan. Each change
--     still gets its notice (and its push), and the earlier notices of that
--     plan still unread are superseded by it (marked read: the badge counts
--     the plan once, the list keeps every change). A cancellation is
--     announced once, however often cancelled_at is written. Recipients are
--     unchanged: people going, never the organiser, and the existing guards
--     (preferences, blocks, IRLY Girl) still apply.

-- ───────── 1. Live activity cards ─────────
create or replace function public.activity_cards(p_ids uuid[])
returns table (id uuid, title text, starts_at timestamptz, ends_at timestamptz, place_name text, area_id text, city_id text,
  category_id text, sub_id text, cover text, price_minor integer, currency text, capacity integer, going integer, status text,
  girl_only boolean, community_id uuid, community_name text, creator_id uuid, creator_name text, my_status text,
  conversation_id uuid, can_message_host boolean)
language sql stable security invoker set search_path = public as $$
  select a.id, a.title, a.starts_at, a.ends_at, a.place_name, a.area_id, a.city_id, a.category_id, a.sub_id,
    coalesce(a.cover_path, a.cover_url), a.price_minor, a.currency, a.capacity,
    -- Exact (participants who hide their plans still count), as on the page.
    private.going_count(a.id),
    public.activity_status(a.starts_at, a.ends_at, a.cancelled_at),
    a.girl_only, a.community_id, g.name, a.creator_id, p.first_name,
    (select x.status from public.activity_participants x where x.activity_id = a.id and x.user_id = auth.uid()),
    -- The activity chat, for its members only.
    (select c.id from public.conversations c where c.activity_id = a.id and private.is_member(c.id)),
    -- « Contact the organiser »: the same rule open_direct applies (an existing chat, or her messaging settings).
    a.creator_id <> auth.uid() and not private.blocked_unchecked(auth.uid(), a.creator_id) and (
      private.may_message(a.creator_id)
      or exists (select 1 from public.conversations v
        join public.conversation_members m1 on m1.conversation_id = v.id and m1.user_id = auth.uid()
        join public.conversation_members m2 on m2.conversation_id = v.id and m2.user_id = a.creator_id
        where v.kind = 'direct'))
  from public.activities a
  -- The origin community's name, when the reader may see that community.
  left join public.communities g on g.id = a.community_id and g.deleted_at is null
  -- offset 0: the creator's row only (by primary key), through the view's own filter.
  left join lateral (select pp.first_name from public.profiles_public pp where pp.id = a.creator_id offset 0) p on true
  where auth.uid() is not null and a.id = any (p_ids[1:50])
$$;
revoke all on function public.activity_cards(uuid[]) from public, anon;
grant execute on function public.activity_cards(uuid[]) to authenticated;

-- ───────── 2. A community's activity cards (its feed) ─────────
create or replace function public.community_activity_cards(p_community uuid, p_limit integer default 6)
returns table (id uuid, title text, starts_at timestamptz, ends_at timestamptz, place_name text, area_id text, city_id text,
  category_id text, sub_id text, cover text, price_minor integer, currency text, capacity integer, going integer, status text,
  girl_only boolean, community_id uuid, community_name text, creator_id uuid, creator_name text, my_status text,
  conversation_id uuid, can_message_host boolean, pinned_at timestamptz)
language sql stable security invoker set search_path = public as $$
  -- Coming up, happening, or over / cancelled since yesterday (its real state shows), through the reader's own rules.
  with ids as (
    select a.id from public.activities a
    where a.community_id in (select p_community union all
        select s.id from public.communities s where s.parent_id = p_community and s.deleted_at is null)
      and exists (select 1 from public.communities g where g.id = a.community_id and g.deleted_at is null)
      and coalesce(a.ends_at, a.starts_at + interval '2 hours') > now() - interval '1 day'
    order by a.starts_at
    limit 50
  )
  select c.*, pin.pinned_at
  from public.activity_cards(array(select ids.id from ids)) c
  left join public.community_activity_pins pin on pin.community_id = p_community and pin.activity_id = c.id
  order by (pin.activity_id is not null) desc, pin.pinned_at desc nulls last,
    (c.status in ('upcoming', 'ongoing')) desc, c.starts_at
  limit least(greatest(coalesce(p_limit, 6), 1), 20)
$$;
revoke all on function public.community_activity_cards(uuid, integer) from public, anon;
grant execute on function public.community_activity_cards(uuid, integer) to authenticated;

-- ───────── 3. The Activities tab's « going »: the exact count ─────────
create or replace function public.community_activities(p_community uuid, p_past boolean default false, p_limit integer default 40)
returns table (id uuid, title text, starts_at timestamptz, ends_at timestamptz, place_name text, area_id text, city_id text,
  category_id text, community_id uuid, community_name text, status text, going integer, capacity integer, cover_path text,
  cover_url text, creator_id uuid, pinned_at timestamptz, has_location boolean)
language sql stable set search_path = public as $$
  select a.id, a.title, a.starts_at, a.ends_at, a.place_name, a.area_id, a.city_id, a.category_id, a.community_id, g.name,
    public.activity_status(a.starts_at, a.ends_at, a.cancelled_at),
    -- Was count(*) of the participant rows the reader can see (« maybe » in, hidden plans out).
    private.going_count(a.id),
    a.capacity, a.cover_path, a.cover_url, a.creator_id, pin.pinned_at, a.lat is not null
  from public.activities a
  join public.communities g on g.id = a.community_id and g.deleted_at is null
  left join public.community_activity_pins pin on pin.community_id = p_community and pin.activity_id = a.id
  where a.community_id in (select p_community union all select s.id from public.communities s where s.parent_id = p_community)
    and (case when p_past
      then a.starts_at > now() - interval '60 days'
      else coalesce(a.ends_at, a.starts_at + interval '2 hours') > now() end)
  order by (pin.activity_id is not null) desc, pin.pinned_at desc nulls last,
    case when p_past then null else a.starts_at end asc, a.starts_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

-- ───────── 4. Important changes, announced once ─────────
create or replace function private.on_activity_updated() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cancelled boolean := new.cancelled_at is not null;
  v_payload jsonb;
begin
  if (new.starts_at, new.ends_at, new.area_id, coalesce(new.place_name, ''), coalesce(new.address, ''), new.cancelled_at is null)
     is distinct from (old.starts_at, old.ends_at, old.area_id, coalesce(old.place_name, ''), coalesce(old.address, ''), old.cancelled_at is null) then
    v_payload := jsonb_build_object('activity_id', new.id, 'title', new.title, 'cancelled', v_cancelled, 'starts_at', new.starts_at);
    if v_cancelled then
      -- A cancellation is announced once (whatever else changes with it).
      insert into public.notifications (user_id, kind, payload)
      select p.user_id, 'ACTIVITY_UPDATED', v_payload from public.activity_participants p
      where p.activity_id = new.id and p.user_id <> new.creator_id and p.status = 'going'
        and not exists (select 1 from public.notifications n where n.user_id = p.user_id and n.kind = 'ACTIVITY_UPDATED'
          and n.payload ->> 'activity_id' = new.id::text and n.payload ->> 'cancelled' = 'true');
    else
      -- The previous notices of this plan still unread are superseded by this one (marked read): one
      -- unread notice per member and plan, always the latest; the list keeps every change.
      update public.notifications n set read_at = now()
      where n.kind = 'ACTIVITY_UPDATED' and n.read_at is null
        and n.payload ->> 'activity_id' = new.id::text and coalesce(n.payload ->> 'cancelled', 'false') = 'false'
        and n.user_id in (select p.user_id from public.activity_participants p where p.activity_id = new.id and p.status = 'going')
        and coalesce(n.payload ->> 'change', '') <> 'deleted';
      -- Who hears it: the people going (never the organiser), as before.
      insert into public.notifications (user_id, kind, payload)
      select p.user_id, 'ACTIVITY_UPDATED', v_payload from public.activity_participants p
      where p.activity_id = new.id and p.user_id <> new.creator_id and p.status = 'going';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.on_activity_updated() from public, anon, authenticated;

-- Rollback (documented, not run): restore public.community_activities from
-- 20261019000400_irly_security_speed and private.on_activity_updated from
-- 20261005000600_irly_engage (their previous definitions, same signatures),
-- then drop function public.community_activity_cards(uuid, integer) and
-- public.activity_cards(uuid[]). No data depends on them.
