-- IRLY Girl security re-audit (2026-10-27). Additive: two new functions for
-- IRLY Network in IRLY Girl, one restrictive policy and one trigger. No data
-- is changed or deleted; RLS stays on everywhere; nobody is signed out.
--
-- Every check goes through the one predicate, private.girl_eligible_unchecked
-- (declared gender, no IRLY Girl suspension, open account). What was found
-- (the rest of the audit is proved by supabase/tests/girl_security.test.sql):
--
--  1. IRLY Network in IRLY Girl listed everyone. pro_discover (and the
--     profile page, pro_profile_of) return every professional, men included,
--     and the app's Network in IRLY Girl called them as they are. New:
--     pro_discover_girl and pro_profile_of_girl, same columns, women with
--     IRLY Girl access only, refused (42501) to anyone without that access.
--     New names rather than an extra parameter, so PostgREST never has two
--     candidates for one call and the installed apps keep calling
--     pro_discover / pro_profile_of unchanged (Mixte).
--     Positions: lat / lng of both are the centre of the neighbourhood the
--     member chose for her professional profile (public.areas), never a
--     personal position; nothing to coarsen.
--  2. A plan card (message kind 'activity' with the plan's id and no
--     ref_type) pointing at a women-only plan could be written into any chat,
--     a man's included (its title in the chat and in his push): the existing
--     guard (messages_girl_ref_guard, 20261024009300) only looks at ref_type.
--     Shares (share_to_chat) were already kept inside girl chats.
--  3. A women-only plan could still be turned into an open one by its host
--     while nobody else was a participant (activity_guard refuses it only
--     once someone joined): people who had joined and left, and what they
--     wrote in its chat (girl_chat), were then opened to men who joined. A
--     women-only plan now stays women-only (staff can still correct one).

-- ───────── 1. IRLY Network in IRLY Girl ─────────
create or replace function public.pro_discover_girl(p_city text, p_filters jsonb default '{}', p_limit integer default 120)
returns table (user_id uuid, first_name text, photo_path text, role text, job_title text, company text, industries text[],
  skills text[], project text, looking_for text, can_offer text, intents text[], city_id text, area_id text,
  lat numeric, lng numeric, connection text, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if not private.girl_eligible_unchecked(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  -- pro_discover's own query, with the one predicate on every member listed.
  return query
  with f as (
    select nullif(p_filters ->> 'industry', '') as industry, nullif(p_filters ->> 'role', '') as role,
      nullif(p_filters ->> 'intent', '') as intent, nullif(p_filters ->> 'city', '') as city,
      '%' || replace(replace(btrim(coalesce(p_filters ->> 'q', '')), '%', ''), '_', '') || '%' as pat,
      btrim(coalesce(p_filters ->> 'q', '')) <> '' as has_q
  )
  select p.user_id, pr.first_name, pr.photo_paths[1], p.role, p.job_title, p.company, p.industries, p.skills, p.project,
    p.looking_for, p.can_offer, p.intents, p.city_id, p.area_id, a.lat, a.lng,
    private.connection_state(auth.uid(), p.user_id), p.updated_at
  from public.pro_profiles p
  join public.profiles pr on pr.id = p.user_id and pr.deleted_at is null
  left join public.areas a on a.city_id = p.city_id and a.id = p.area_id
  cross join f
  where p.user_id <> auth.uid() and p.visible
    and private.girl_eligible_unchecked(p.user_id)
    and (case when f.city is not null then p.city_id = f.city else p.city_id = any (private.city_scope(p_city)) end)
    and (f.industry is null or f.industry = any (p.industries))
    and (f.role is null or p.role = f.role)
    and (f.intent is null or f.intent = any (p.intents))
    and (not f.has_q or p.job_title ilike f.pat or coalesce(p.company, '') ilike f.pat
      or array_to_string(p.skills, ' ') ilike f.pat or coalesce(p.project, '') ilike f.pat)
    and not private.blocked_unchecked(auth.uid(), p.user_id)
    and private.discoverable(p.user_id)
  order by (p.city_id = p_city) desc, p.updated_at desc
  limit least(greatest(coalesce(p_limit, 120), 1), 200);
end $$;
revoke all on function public.pro_discover_girl(text, jsonb, integer) from public, anon;
grant execute on function public.pro_discover_girl(text, jsonb, integer) to authenticated;

-- One professional profile in IRLY Girl: yours, or a woman with IRLY Girl access.
create or replace function public.pro_profile_of_girl(p_user uuid)
returns table (user_id uuid, first_name text, photo_path text, role text, job_title text, company text, industries text[],
  skills text[], project text, looking_for text, can_offer text, intents text[], city_id text, area_id text,
  lat numeric, lng numeric, connection text, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if not private.girl_eligible_unchecked(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return query
  select d.* from public.pro_profile_of(p_user) d
  where d.user_id = auth.uid() or private.girl_eligible_unchecked(d.user_id);
end $$;
revoke all on function public.pro_profile_of_girl(uuid) from public, anon;
grant execute on function public.pro_profile_of_girl(uuid) to authenticated;

-- ───────── 2. A plan card pointing at a women-only plan ─────────
-- messages_girl_ref_guard (20261024009300) keeps every message whose ref_type
-- names IRLY Girl content inside girl chats; a plan card (kind 'activity')
-- written with its ref_id and no ref_type went around it.
drop policy if exists messages_girl_card on public.messages;
create policy messages_girl_card on public.messages as restrictive for insert to authenticated
  with check (
    kind <> 'activity' or ref_id is null or ref_type is not null
    or not private.girl_target('activity', ref_id::text)
    or private.girl_chat(conversation_id)
  );

-- ───────── 3. A women-only plan stays women-only ─────────
create or replace function private.activity_girl_keep() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.girl_only and not new.girl_only and auth.uid() is not null and not private.is_admin(auth.uid()) then
    raise exception 'a women-only plan stays women-only' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.activity_girl_keep() from public, anon, authenticated;
drop trigger if exists activities_girl_keep on public.activities;
create trigger activities_girl_keep before update of girl_only on public.activities
  for each row execute function private.activity_girl_keep();
