-- Global administration, on top of the back office that already exists
-- (20261023000000 roles / sanctions / cases, 20261027200000 console / holds /
-- journal, 20261028500000 editorial). Additive; no data is changed.
--
-- 1. Admin badge: public.staff_badges() says which of the given members hold
--    the owner or admin role, read live from public.staff_roles (members
--    cannot read or write that table; nothing in the profile sets it).
--    Moderators and content staff get no public badge.
-- 2. The last owner cannot leave by accident: deleting an account (or the
--    role) of the only owner is refused until ownership is handed over with
--    public.staff_transfer_owner() (owner only, journaled). The server itself
--    (no signed-in caller: migrations, scripts) is not held back.
-- 3. IRLY's official communities, by space: their order and their tagline /
--    description, from the back office (content staff and above), journaled.
--    The texts are written to the topic, the source the official communities
--    are kept in step with, so an edit is never reverted. Names stay as the
--    owner fixed them. The community lists follow the order.
-- 4. Spaces: private.item_space() says whether an item belongs to IRLY
--    (Mixte), IRLY Girl or IRLY Maman; the back office labels and filters
--    with public.admin_item_spaces() and public.admin_space_overview().
-- 5. Overview: reports handled in 7 days and the errors members saw.

-- ───────── 1. Admin badge ─────────
/** The members, among p_ids, who hold the owner or admin role (at most 200 ids). */
create or replace function public.staff_badges(p_ids uuid[])
returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select s.user_id
  from public.staff_roles s
  join public.profiles p on p.id = s.user_id and p.deleted_at is null
  where auth.uid() is not null
    and s.role in ('owner', 'admin')
    and s.user_id = any ((coalesce(p_ids, '{}'::uuid[]))[1:200])
$$;
revoke all on function public.staff_badges(uuid[]) from public, anon;
grant execute on function public.staff_badges(uuid[]) to authenticated;

-- ───────── 2. The last owner ─────────
create or replace function private.keep_an_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or old.role <> 'owner' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' then return new; end if;
  if not exists (
    select 1 from public.staff_roles s join public.profiles p on p.id = s.user_id and p.deleted_at is null
    where s.role = 'owner' and s.user_id <> old.user_id
  ) then
    raise exception 'last owner: hand over ownership in Back office → Team before deleting this account' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.keep_an_owner() from public, anon, authenticated;
drop trigger if exists staff_roles_keep_an_owner on public.staff_roles;
create trigger staff_roles_keep_an_owner before update or delete on public.staff_roles
  for each row execute function private.keep_an_owner();

/**
 * Owner only: makes another member an owner. With p_keep false the caller
 * becomes an admin (the usual hand-over before leaving); true keeps both
 * owners. The word OWNER is typed to confirm, with a reason for the journal.
 */
create or replace function public.staff_transfer_owner(p_user uuid, p_keep boolean, p_confirm text, p_reason text)
returns void language plpgsql security definer set search_path = public, private as $$
declare me uuid := auth.uid(); why text;
begin
  if coalesce(private.staff_role(me), '') <> 'owner' then raise exception 'owner only' using errcode = '42501'; end if;
  if p_user is null or p_user = me then raise exception 'choose another member' using errcode = '22023'; end if;
  if coalesce(p_confirm, '') <> 'OWNER' then raise exception 'type OWNER to confirm' using errcode = '22023'; end if;
  why := private.need_reason(p_reason);
  if not exists (select 1 from public.profiles where id = p_user and deleted_at is null) then
    raise exception 'no such member' using errcode = '22023';
  end if;
  if private.is_sanctioned(p_user) then raise exception 'this member is suspended' using errcode = '22023'; end if;
  insert into public.staff_roles (user_id, role, granted_by) values (p_user, 'owner', me)
  on conflict (user_id) do update set role = 'owner', granted_by = me, granted_at = now();
  if not coalesce(p_keep, false) then
    update public.staff_roles set role = 'admin', granted_at = now() where user_id = me;
  end if;
  perform private.journal('role.owner_transferred', p_user, null, 'profile', p_user, why,
    jsonb_build_object('previous_owner_kept', coalesce(p_keep, false)));
end $$;
revoke all on function public.staff_transfer_owner(uuid, boolean, text, text) from public, anon;
grant execute on function public.staff_transfer_owner(uuid, boolean, text, text) to authenticated;

/** The caller is the only owner (the app says so before an account deletion). */
create or replace function public.i_am_last_owner() returns boolean
language sql stable security definer set search_path = public, private as $$
  select coalesce(private.staff_role(auth.uid()), '') = 'owner'
    and not exists (
      select 1 from public.staff_roles s join public.profiles p on p.id = s.user_id and p.deleted_at is null
      where s.role = 'owner' and s.user_id <> auth.uid())
$$;
revoke all on function public.i_am_last_owner() from public, anon;
grant execute on function public.i_am_last_owner() to authenticated;

-- ───────── 3. Official communities ─────────
create or replace function private.topic_space(p_topic text, p_girl boolean) returns text
language sql immutable as $$
  select case when p_topic = 'moms' then 'mom' when p_girl then 'girl' else 'mixte' end
$$;

/** IRLY's official topics (active ones), by space and order, with their texts. Content staff and above. */
create or replace function public.admin_official_topics()
returns table (topic text, name text, space text, sort integer, tagline text, description text, emoji text,
  communities bigint, members bigint, in_network boolean)
language plpgsql stable security definer set search_path = public, private as $$
begin
  if not private.is_content_staff(auth.uid()) then raise exception 'IRLY content team only' using errcode = '42501'; end if;
  return query
    select t.topic, t.name, private.topic_space(t.topic, t.girl_only), t.sort, t.tagline, t.description, t.emoji,
      (select count(*) from public.communities c where c.official and c.topic = t.topic and c.deleted_at is null and c.parent_id is null),
      (select coalesce(sum(c.members_count), 0)::bigint from public.communities c
        where c.official and c.topic = t.topic and c.deleted_at is null and c.parent_id is null),
      t.topic in ('network', 'girl_network')
    from public.community_topics t
    where t.active
    order by private.topic_space(t.topic, t.girl_only), t.sort, t.topic;
end $$;
revoke all on function public.admin_official_topics() from public, anon;
grant execute on function public.admin_official_topics() to authenticated;

/**
 * New order of one space's official communities: p_topics lists every
 * active topic of that space exactly once (no duplicate, none missing, none
 * unknown or from another space).
 */
create or replace function public.admin_official_reorder(p_space text, p_topics text[], p_reason text)
returns void language plpgsql security definer set search_path = public, private as $$
declare why text; current_topics text[]; before text[];
begin
  if not private.is_content_staff(auth.uid()) then raise exception 'IRLY content team only' using errcode = '42501'; end if;
  if p_space is null or p_space not in ('mixte', 'girl', 'mom') then raise exception 'unknown space' using errcode = '22023'; end if;
  why := private.need_reason(p_reason);
  -- One change at a time: two editors never interleave their orders.
  perform pg_advisory_xact_lock(hashtextextended('admin_official_reorder', 3));
  select coalesce(array_agg(t.topic order by t.sort, t.topic), '{}') into before
  from public.community_topics t where t.active and private.topic_space(t.topic, t.girl_only) = p_space;
  select coalesce(array_agg(x order by x), '{}') into current_topics from unnest(before) x;
  if p_topics is null or cardinality(p_topics) <> cardinality(array(select distinct x from unnest(p_topics) x)) then
    raise exception 'each community once' using errcode = '22023';
  end if;
  if (select coalesce(array_agg(x order by x), '{}') from unnest(p_topics) x) is distinct from current_topics then
    raise exception 'the list must hold exactly this space''s official communities' using errcode = '22023';
  end if;
  if p_topics = before then return; end if;
  update public.community_topics t set sort = o.n
  from unnest(p_topics) with ordinality o(topic, n)
  where t.topic = o.topic;
  perform private.journal('official.reordered', null, null, 'space', null, why,
    jsonb_build_object('space', p_space, 'from', to_jsonb(before), 'to', to_jsonb(p_topics)));
end $$;
revoke all on function public.admin_official_reorder(text, text[], text) from public, anon;
grant execute on function public.admin_official_reorder(text, text[], text) to authenticated;

create or replace function private.set_official_texts(p_topic text, p_tagline text, p_description text) returns boolean
language plpgsql security definer set search_path = public as $$
declare tag text := nullif(btrim(coalesce(p_tagline, '')), ''); body text := nullif(btrim(coalesce(p_description, '')), ''); t public.community_topics;
begin
  select * into t from public.community_topics where topic = p_topic and active for update;
  if t.topic is null then raise exception 'unknown official community' using errcode = '22023'; end if;
  if tag is not null and char_length(tag) > 140 then raise exception 'a tagline has at most 140 characters' using errcode = '22023'; end if;
  if body is null or char_length(body) not between 20 and 1500 then
    raise exception 'a description has 20 to 1500 characters' using errcode = '22023';
  end if;
  if tag is not distinct from t.tagline and body is not distinct from t.description then return false; end if;
  update public.community_topics set tagline = tag, description = body where topic = p_topic;
  update public.communities set tagline = tag, description = body
  where official and topic = p_topic and parent_id is null and deleted_at is null;
  return true;
end $$;
revoke all on function private.set_official_texts(text, text, text) from public, anon, authenticated;

/** Tagline and description of an official community (every city), content staff and above. */
create or replace function public.admin_official_texts(p_topic text, p_tagline text, p_description text, p_reason text)
returns void language plpgsql security definer set search_path = public, private as $$
declare why text;
begin
  if not private.is_content_staff(auth.uid()) then raise exception 'IRLY content team only' using errcode = '42501'; end if;
  why := private.need_reason(p_reason);
  if private.set_official_texts(p_topic, p_tagline, p_description) then
    perform private.journal('official.texts_edited', null, null, 'topic', null, why, jsonb_build_object('topic', p_topic));
  end if;
end $$;
revoke all on function public.admin_official_texts(text, text, text, text) from public, anon;
grant execute on function public.admin_official_texts(text, text, text, text) to authenticated;

-- Same as in 20261027200000, except an official community: its texts go to
-- its topic (kept in step everywhere), and its name stays the owner's.
create or replace function public.admin_update_community(p_id uuid, p_name text, p_tagline text, p_description text, p_reason text)
returns void language plpgsql security definer set search_path = public, private as $$
declare c public.communities; why text; changed text[] := '{}';
begin
  if not private.is_content_staff(auth.uid()) then raise exception 'IRLY content team only' using errcode = '42501'; end if;
  why := private.need_reason(p_reason);
  select * into c from public.communities where id = p_id and deleted_at is null for update;
  if c.id is null then raise exception 'this community no longer exists' using errcode = 'P0002'; end if;
  if c.official and c.topic is not null and c.parent_id is null then
    if btrim(coalesce(p_name, '')) is distinct from c.name then
      raise exception 'the names of IRLY''s official communities are fixed' using errcode = '22023';
    end if;
    if private.set_official_texts(c.topic, p_tagline, p_description) then
      perform private.journal('official.texts_edited', null, null, 'community', p_id, why, jsonb_build_object('topic', c.topic));
    end if;
    return;
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 60 then raise exception 'a name has 3 to 60 characters' using errcode = '22023'; end if;
  if btrim(p_name) is distinct from c.name then changed := array_append(changed, 'name'); end if;
  if nullif(btrim(coalesce(p_tagline, '')), '') is distinct from c.tagline then changed := array_append(changed, 'tagline'); end if;
  if nullif(btrim(coalesce(p_description, '')), '') is distinct from c.description then changed := array_append(changed, 'description'); end if;
  if cardinality(changed) = 0 then return; end if;
  update public.communities set name = btrim(p_name), tagline = nullif(btrim(coalesce(p_tagline, '')), ''),
    description = nullif(btrim(coalesce(p_description, '')), '') where id = p_id;
  perform private.journal('community.edited', c.created_by, null, 'community', p_id, why, jsonb_build_object('fields', to_jsonb(changed)));
end $$;
revoke all on function public.admin_update_community(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_update_community(uuid, text, text, text, text) to authenticated;

-- Same as in 20261028100000, with IRLY's official ones in the team's order.
create or replace function public.community_list(p_city text)
returns table (id uuid, name text, tagline text, category_id text, girl_only boolean, members integer, is_member boolean,
  posts_week integer, city_id text, official boolean, topic text, emoji text, created_at timestamptz)
language sql stable set search_path = public as $$
  select c.id, c.name, c.tagline, c.category_id, c.girl_only, c.members_count,
    private.i_belong(c.id),
    (select count(*)::int from public.community_posts p where p.community_id = c.id and p.deleted_at is null and p.created_at > now() - interval '7 days'),
    c.city_id, c.official, c.topic, t.emoji, c.created_at
  from public.communities c
  left join public.community_topics t on t.topic = c.topic
  where c.city_id = any (private.city_scope(p_city)) and c.deleted_at is null and c.parent_id is null
    and c.retired_at is null
  order by (c.city_id = p_city) desc, c.official desc, case when c.official then t.sort end nulls last,
    c.members_count desc, c.created_at, c.id
  limit 200
$$;
revoke all on function public.community_list(text) from public, anon;
grant execute on function public.community_list(text) to authenticated;

-- ───────── 4. Spaces ─────────
create or replace function private.community_space(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when c.topic = 'moms' or pc.topic = 'moms' then 'mom'
    when c.girl_only then 'girl'
    else 'mixte' end
  from public.communities c left join public.communities pc on pc.id = c.parent_id
  where c.id = p_id
$$;
revoke all on function private.community_space(uuid) from public, anon, authenticated;

/** 'mixte', 'girl' or 'mom' for an item of the back office (null: not tied to a space, e.g. a profile or a message). */
create or replace function private.item_space(p_kind text, p_id text, p_depth integer default 0) returns text
language plpgsql stable security definer set search_path = public as $$
declare r record; uid uuid;
begin
  if p_id is null or p_depth > 2 then return null; end if;
  begin
    uid := p_id::uuid;
  exception when others then
    return null;
  end;
  if p_kind = 'community' then
    return private.community_space(uid);
  elsif p_kind in ('activity', 'event') then
    select a.audience, a.girl_only, a.community_id into r from public.activities a where a.id = uid;
    if not found then return null; end if;
    if r.audience = 'moms' or (r.community_id is not null and private.community_space(r.community_id) = 'mom') then return 'mom'; end if;
    return case when r.girl_only then 'girl' else 'mixte' end;
  elsif p_kind = 'community_post' then
    return private.community_space((select community_id from public.community_posts where id = uid));
  elsif p_kind = 'irl_post' then
    select p.app_scope, p.community_id into r from public.irl_posts p where p.id = uid;
    if not found then return null; end if;
    if r.community_id is not null and private.community_space(r.community_id) = 'mom' then return 'mom'; end if;
    return case when r.app_scope = 'irly_girl' then 'girl' else 'mixte' end;
  elsif p_kind = 'comment' then
    select c.target_type, c.target_id into r from public.comments c where c.id = uid;
    if not found then return null; end if;
    return private.item_space(r.target_type, r.target_id, p_depth + 1);
  end if;
  return null;
end $$;
revoke all on function private.item_space(text, text, integer) from public, anon, authenticated;

/** The space of each listed item (team only, at most 200 ids). */
create or replace function public.admin_item_spaces(p_kind text, p_ids uuid[])
returns table (id uuid, space text)
language plpgsql stable security definer set search_path = public, private as $$
begin
  perform private.need_staff();
  return query select x, private.item_space(p_kind, x::text) from unnest((coalesce(p_ids, '{}'::uuid[]))[1:200]) x;
end $$;
revoke all on function public.admin_item_spaces(text, uuid[]) from public, anon;
grant execute on function public.admin_item_spaces(text, uuid[]) to authenticated;

/** Per space: communities, upcoming activities, open and in-progress reports (team only). */
create or replace function public.admin_space_overview()
returns table (space text, communities bigint, activities_upcoming bigint, reports_open bigint, reports_review bigint)
language plpgsql stable security definer set search_path = public, private as $$
begin
  perform private.need_staff();
  return query
    with cases as (
      select m.status, private.item_space(r.target_kind, r.target_id::text) as sp
      from public.moderation_cases m join public.reports r on r.id = m.report_id
      where m.status in ('open', 'reviewing', 'need_info')
    ), comms as (
      select private.community_space(c.id) as sp from public.communities c
      where c.deleted_at is null and c.parent_id is null and c.retired_at is null
    ), acts as (
      select private.item_space('activity', a.id::text) as sp from public.activities a
      where a.cancelled_at is null and a.starts_at > now()
    )
    select s.sp,
      (select count(*) from comms where comms.sp = s.sp),
      (select count(*) from acts where acts.sp = s.sp),
      (select count(*) from cases where cases.sp = s.sp and cases.status = 'open'),
      (select count(*) from cases where cases.sp = s.sp and cases.status <> 'open')
    from unnest(array['mixte', 'girl', 'mom']) s(sp);
end $$;
revoke all on function public.admin_space_overview() from public, anon;
grant execute on function public.admin_space_overview() to authenticated;

-- ───────── 5. Overview: handled reports, errors seen ─────────
/** Reports handled in 7 days and the errors members saw (admins), next to admin_overview(). */
create or replace function public.admin_overview_more() returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
begin
  perform private.need_admin();
  return jsonb_build_object(
    'reports_closed_7d', (select count(*) from public.moderation_cases where status in ('actioned', 'dismissed', 'closed')
      and updated_at > now() - interval '7 days'),
    'reports_dismissed_7d', (select count(*) from public.moderation_cases where status = 'dismissed'
      and updated_at > now() - interval '7 days'),
    'errors_7d', (select count(*) from public.analytics_events
      where name in ('SERVER_ERROR', 'PROFILE_MISSING') and created_at > now() - interval '7 days'),
    'errors_top', coalesce((select jsonb_agg(x order by x.n desc) from (
        select coalesce(props ->> 'code', props ->> 'why', name) as code, coalesce(props ->> 'where', '') as place, count(*) as n
        from public.analytics_events
        where name in ('SERVER_ERROR', 'PROFILE_MISSING') and created_at > now() - interval '7 days'
        group by 1, 2 order by 3 desc limit 5) x), '[]')
  );
end $$;
revoke all on function public.admin_overview_more() from public, anon;
grant execute on function public.admin_overview_more() to authenticated;
