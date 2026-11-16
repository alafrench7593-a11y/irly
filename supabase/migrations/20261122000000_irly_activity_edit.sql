-- Editing an activity (additive: no table, column, policy or existing function is changed).
--
-- What already existed and is kept as it is:
--   - the creator may update her own row (policy activities_creator);
--   - a change of time or place tells the people going, once, never the host
--     (private.on_activity_updated, kind ACTIVITY_UPDATED); updated_at follows every change;
--   - the chat takes the new title (private.sync_activity_chat_title);
--   - reminders are keyed by the start they were sent for (private.send_activity_reminders),
--     so a moved activity is reminded again for its new start, never for the old one;
--   - capacity never goes under the people going (private.activity_guard), time rules,
--     price ceiling and text limits (private.activity_input_guard, text_limits), the photo
--     rule (private.activity_cover_guard), suspended accounts (private.block_sanctioned_edit).
--
-- What this adds:
--   1. public.update_activity(p_activity, p_patch): the one way the app edits an activity.
--      It only knows the editable fields, and says no to an activity that is over,
--      cancelled or removed by the team.
--   2. private.activity_edit_guard (trigger): the same integrity rules for a member writing
--      to the table directly (an older version of the app, or the API by hand).

-- ───────── 1. Has anyone other than the host joined? ─────────
create or replace function private.activity_has_guests(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.activity_participants p
    join public.activities a on a.id = p.activity_id
    where p.activity_id = aid and p.user_id <> a.creator_id
  )
$$;
revoke all on function private.activity_has_guests(uuid) from public, anon;
grant execute on function private.activity_has_guests(uuid) to authenticated;

-- ───────── 2. A member's direct write to the table ─────────
-- Runs with the caller's own role (not security definer) so that it can tell a member's
-- request to the table (role "authenticated") from the server's own functions, which
-- carry their own checks (set_activity_cover, delete_activity, the team's tools,
-- cascades). The team is not concerned either.
create or replace function private.activity_edit_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' or auth.uid() is null or pg_trigger_depth() > 1 or private.i_am_staff() then
    return new;
  end if;
  -- Never editable: who created it, its city and the currency its price is in.
  if new.creator_id is distinct from old.creator_id then
    raise exception 'creator_id cannot be changed' using errcode = '42501';
  end if;
  if new.city_id is distinct from old.city_id then
    raise exception 'city_id cannot be changed' using errcode = '42501';
  end if;
  if new.currency is distinct from old.currency then
    raise exception 'currency cannot be changed' using errcode = '42501';
  end if;
  -- Its space (IRLY Girl or mixed), its audience and its community: people joined it as it
  -- was, so they stay as they are once someone other than the host is in. (Opening a
  -- women-only plan is refused whoever is in it, by its own rule: activities_girl_keep.)
  if (new.girl_only, new.audience, new.community_id) is distinct from (old.girl_only, old.audience, old.community_id)
     and not (old.girl_only and not new.girl_only)
     and private.activity_has_guests(old.id) then
    raise exception 'people joined this plan: its space and community stay as they are' using errcode = '42501';
  end if;
  -- Over or cancelled: what people saw is what stays (calling it off is not an edit).
  if (old.cancelled_at is not null or coalesce(old.ends_at, old.starts_at + interval '2 hours') < now())
     and (new.title, new.description, new.place_name, new.area_id, new.address, new.starts_at, new.ends_at, new.capacity, new.price_minor, new.cover_path)
       is distinct from
         (old.title, old.description, old.place_name, old.area_id, old.address, old.starts_at, old.ends_at, old.capacity, old.price_minor, old.cover_path) then
    if old.cancelled_at is not null then
      raise exception 'This activity was cancelled' using errcode = '22023';
    end if;
    raise exception 'This activity is over' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function private.activity_edit_guard() from public, anon;
grant execute on function private.activity_edit_guard() to authenticated;

drop trigger if exists activities_edit_guard on public.activities;
create trigger activities_edit_guard before update on public.activities
  for each row execute function private.activity_edit_guard();

-- ───────── 3. update_activity: the host edits her activity ─────────
-- p_patch holds only what changes. Editable: title, description, place_name, area_id,
-- starts_at, ends_at, capacity (null: unlimited), price_minor (0: free, in the activity's
-- own currency), cover_path (an IRLY library photo, one of her uploads, or null).
-- Anything else (space, audience, community, event, category, creator, currency…) is
-- refused by name. One UPDATE: the existing triggers do the rest (who is told, the chat
-- title, the photo rule, the time rules, updated_at).
create or replace function public.update_activity(p_activity uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  a public.activities;
  k text;
  editable constant text[] := array['title', 'description', 'place_name', 'area_id', 'starts_at', 'ends_at', 'capacity', 'price_minor', 'cover_path'];
  v_title text;
  v_description text;
  v_place text;
  v_area text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_capacity integer;
  v_price numeric;
  v_price_max numeric;
  v_cover text;
  v_until timestamptz;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  perform private.require_profile(me);
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'nothing to change' using errcode = '22023';
  end if;
  for k in select jsonb_object_keys(p_patch) loop
    if not (k = any (editable)) then
      raise exception '% cannot be changed', k using errcode = '42501';
    end if;
  end loop;
  -- Nothing given: nothing is written, nobody is told.
  if p_patch = '{}'::jsonb then return; end if;

  -- Locked like a join: the people going are counted against the new capacity as they are now.
  select * into a from public.activities where id = p_activity for update;
  -- Only its creator. Anyone else learns nothing about it (as delete_activity).
  if not found or a.creator_id <> me then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  if a.moderated_at is not null then
    raise exception 'this activity was removed by the IRLY team' using errcode = '42501';
  end if;
  if a.cancelled_at is not null then
    raise exception 'This activity was cancelled' using errcode = '22023';
  end if;
  if coalesce(a.ends_at, a.starts_at + interval '2 hours') < now() then
    raise exception 'This activity is over' using errcode = '22023';
  end if;
  -- The rules of creating one, again: a suspended account, a paused IRLY Girl access,
  -- a ban or a restriction in its community.
  if private.is_sanctioned(me) then
    raise exception 'your account is suspended' using errcode = '42501';
  end if;
  if a.girl_only and not private.is_girl_eligible(me) then
    raise exception 'IRLY Girl is paused for you: you can only cancel this plan' using errcode = '42501';
  end if;
  if a.community_id is not null then
    if private.community_banned(a.community_id, me) then
      raise exception 'you were banned from this community' using errcode = '42501';
    end if;
    v_until := private.community_restricted_until(a.community_id, me);
    if v_until is not null then
      raise exception 'you are restricted in this community until %', to_char(v_until at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"')
        using errcode = '42501', hint = 'community_restricted';
    end if;
  end if;

  v_title := a.title;
  if p_patch ? 'title' then
    v_title := regexp_replace(coalesce(p_patch ->> 'title', ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if char_length(v_title) < 3 then
      raise exception 'The title needs at least 3 characters' using errcode = '23514';
    end if;
    if char_length(v_title) > 80 then
      raise exception 'The title is too long (80 characters at most)' using errcode = '23514';
    end if;
  end if;

  v_description := a.description;
  if p_patch ? 'description' then
    v_description := nullif(btrim(coalesce(p_patch ->> 'description', '')), '');
    if char_length(v_description) > 1000 then
      raise exception 'The description is too long (1000 characters at most)' using errcode = '23514';
    end if;
  end if;

  v_place := a.place_name;
  if p_patch ? 'place_name' then
    v_place := nullif(btrim(coalesce(p_patch ->> 'place_name', '')), '');
    if char_length(v_place) > 200 then
      raise exception 'The place is too long (200 characters at most)' using errcode = '23514';
    end if;
  end if;

  v_area := a.area_id;
  if p_patch ? 'area_id' then
    v_area := btrim(coalesce(p_patch ->> 'area_id', ''));
    -- A neighbourhood of the activity's own city (the city itself never changes).
    if v_area is distinct from a.area_id and not exists (select 1 from public.areas r where r.city_id = a.city_id and r.id = v_area) then
      raise exception 'unknown neighbourhood' using errcode = '23514';
    end if;
  end if;

  v_starts := a.starts_at;
  if p_patch ? 'starts_at' then
    if jsonb_typeof(p_patch -> 'starts_at') <> 'string' then
      raise exception 'Pick a date and a start time' using errcode = '22023';
    end if;
    v_starts := (p_patch ->> 'starts_at')::timestamptz;
  end if;
  v_ends := a.ends_at;
  if p_patch ? 'ends_at' then
    v_ends := case when jsonb_typeof(p_patch -> 'ends_at') = 'null' then null else (p_patch ->> 'ends_at')::timestamptz end;
  end if;
  if v_ends is not null and v_ends <= v_starts then
    raise exception 'The end must be after the start' using errcode = '22023';
  end if;

  v_capacity := a.capacity;
  if p_patch ? 'capacity' then
    if jsonb_typeof(p_patch -> 'capacity') = 'null' then
      v_capacity := null;
    else
      if jsonb_typeof(p_patch -> 'capacity') <> 'number' or (p_patch ->> 'capacity')::numeric <> trunc((p_patch ->> 'capacity')::numeric)
         or (p_patch ->> 'capacity')::numeric not between 2 and 1000 then
        raise exception 'Spots: between 2 and 1000, or none for unlimited' using errcode = '23514';
      end if;
      v_capacity := (p_patch ->> 'capacity')::numeric::integer;
      if v_capacity < private.going_count(a.id) then
        raise exception 'capacity is below the number of people going' using errcode = '22023';
      end if;
    end if;
  end if;

  v_price := a.price_minor;
  if p_patch ? 'price_minor' then
    if jsonb_typeof(p_patch -> 'price_minor') <> 'number' or (p_patch ->> 'price_minor')::numeric <> trunc((p_patch ->> 'price_minor')::numeric) then
      raise exception 'Enter a price, or leave it empty for free' using errcode = '23514';
    end if;
    v_price := (p_patch ->> 'price_minor')::numeric;
    if v_price < 0 then
      raise exception 'A price cannot be negative' using errcode = '23514';
    end if;
    -- The ceiling creation has (private.activity_input_guard); IDR amounts stop at the column's own limit.
    v_price_max := 100000000;
    if a.currency = 'IDR' then v_price_max := 2147483647; end if;
    if v_price > v_price_max then
      raise exception 'This price is too high' using errcode = '23514';
    end if;
  end if;

  v_cover := a.cover_path;
  if p_patch ? 'cover_path' then
    v_cover := nullif(p_patch ->> 'cover_path', '');
  end if;

  update public.activities set
    title = v_title,
    description = v_description,
    place_name = v_place,
    area_id = v_area,
    starts_at = v_starts,
    ends_at = v_ends,
    capacity = v_capacity,
    price_minor = v_price::integer,
    cover_path = v_cover
  where id = a.id;
end $$;
revoke all on function public.update_activity(uuid, jsonb) from public, anon;
grant execute on function public.update_activity(uuid, jsonb) to authenticated;
