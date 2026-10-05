-- Third bug hunt (scratch-DB reproductions; tests in the "Bug hunt 3"
-- section of supabase/tests/irly_test.sql).
--
--  A. who_can_message is enforced (open_direct, and messages in direct
--     chats); one direct chat per pair even when both open it at once.
--  B. irl_visibility is the default audience of a new IRL post.
--  D. location_precision: others never read profiles.area_id; "hidden"
--     hides the city in profiles_public; IRL posts drop the venue below
--     "area" precision.
--  E. Reports: only through report(), which checks you can see the target,
--     sets whose content it is, refuses self-reports and duplicates, 10 an
--     hour. Escalation counts established accounts, same kind, and never
--     overrides a moderator's dismissal. Reports survive account deletion.
--  F. A removed item is frozen for its author (the body could be rewritten
--     and read again).
--  G. Removed text does not live on in notifications.
--  H. Activities: girl-only stays girl-only once women joined; capacity not
--     below the people going; community checked only when it changes (a
--     creator who left her community can still cancel).
--  I. Match reasons keep their lists (empty when hidden): removing the keys
--     crashed IRLY Girl screens. hidden_fields limited to age, languages,
--     areas; matches stripped again when read.
--  J. Invitees can open an invite-only activity shared with them.
--  K. Account deletion also removes direct chats and notifications about
--     the person; notifications only change read_at; chat roles and
--     birthdate are fixed.

-- ===== A. who_can_message =====
create or replace function private.may_message(target uuid, conv uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and target <> auth.uid()
    and not private.blocked_unchecked(auth.uid(), target)
    and (
      -- she already wrote in this chat: replying is always fine
      (conv is not null and exists (select 1 from public.messages x where x.conversation_id = conv and x.sender_id = target and x.deleted_at is null))
      or case coalesce((select s.who_can_message from public.safety_settings s where s.user_id = target), 'matches')
        when 'nobody' then false
        when 'friends' then private.friends_unchecked(auth.uid(), target)
        when 'matches' then private.friends_unchecked(auth.uid(), target) or exists (select 1 from public.irly_matches m
          where m.removed_at is null and m.user_a = least(auth.uid(), target) and m.user_b = greatest(auth.uid(), target))
        when 'everyone' then private.friends_unchecked(auth.uid(), target) or private.shares_unchecked(auth.uid(), target)
          or exists (select 1 from public.irly_matches m where m.removed_at is null and m.user_a = least(auth.uid(), target) and m.user_b = greatest(auth.uid(), target))
      end)
$$;
revoke all on function private.may_message(uuid, uuid) from public, anon;
grant execute on function private.may_message(uuid, uuid) to authenticated;

create or replace function public.open_direct(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_user = me or private.blocked_unchecked(me, p_user) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  -- one chat per pair, even when both open it at the same time
  perform pg_advisory_xact_lock(hashtextextended(least(me, p_user)::text || greatest(me, p_user)::text, 0));
  select c.id into conv from public.conversations c
  where c.kind = 'direct'
    and exists (select 1 from public.conversation_members where conversation_id = c.id and user_id = me)
    and exists (select 1 from public.conversation_members where conversation_id = c.id and user_id = p_user)
  limit 1;
  if conv is null and not private.may_message(p_user) then
    raise exception 'this member does not accept new messages from you' using errcode = '42501';
  end if;
  if conv is null then
    insert into public.conversations (kind) values ('direct') returning id into conv;
    insert into public.conversation_members (conversation_id, user_id) values (conv, me), (conv, p_user);
  end if;
  return conv;
end $$;

drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and kind in ('text', 'activity', 'location', 'photo', 'share')
    and private.is_member(conversation_id)
    and not exists (
      select 1 from public.conversations c
      join public.conversation_members m on m.conversation_id = c.id
      where c.id = conversation_id and m.user_id <> auth.uid()
        and ((c.kind in ('direct', 'match') and private.is_blocked(auth.uid(), m.user_id))
          or (c.kind = 'direct' and not private.may_message(m.user_id, c.id)))
    )
  );

-- ===== B. irl_visibility = default audience of a new IRL post =====
create or replace function private.default_irl_visibility() returns text
language sql stable security definer set search_path = public as $$
  select case (select s.irl_visibility from public.safety_settings s where s.user_id = auth.uid())
    when 'everyone' then 'everyone' when 'nobody' then 'private' else 'friends' end
$$;
revoke all on function private.default_irl_visibility() from public, anon;
grant execute on function private.default_irl_visibility() to authenticated;
alter table public.irl_posts alter column visibility set default private.default_irl_visibility();

create or replace function private.going_count(aid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.activity_participants where activity_id = aid and status = 'going'
$$;
grant execute on function private.going_count(uuid) to authenticated;
-- ===== D. location_precision =====
create or replace function private.precision_of(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select s.location_precision from public.safety_settings s where s.user_id = uid), 'area')
$$;
revoke all on function private.precision_of(uuid) from public, anon;
grant execute on function private.precision_of(uuid) to authenticated;
-- others never read profiles.area_id (own value via my_profile())
create or replace function private.restrict_profile_columns() returns void
language plpgsql security definer set search_path = public as $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
    and column_name not in ('birthdate', 'faith', 'gender', 'is_admin', 'area_id');
  execute 'revoke select on public.profiles from anon, authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;
select private.restrict_profile_columns();
create or replace view public.profiles_public with (security_barrier = true) as
  select id, first_name, case when id = auth.uid() or private.precision_of(id) <> 'hidden' then city_id end as city_id
  from public.profiles
  where deleted_at is null and not private.blocked_unchecked(auth.uid(), id);
-- IRL posts: city precision drops the venue, hidden drops the neighbourhood too
create or replace function private.irl_precision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if private.precision_of(new.author_id) <> 'area' then
    new.place_name := null; new.place_id := null;
    new.area_id := new.city_id;  -- area_id is NOT NULL: city-level marker
  end if;
  return new;
end $$;
drop trigger if exists irl_posts_precision on public.irl_posts;
create trigger irl_posts_precision before insert on public.irl_posts for each row execute function private.irl_precision();

-- ===== E. moderation =====
delete from public.reports a using public.reports b
  where a.reporter_id = b.reporter_id and a.target_kind = b.target_kind and a.target_id = b.target_id and a.ctid > b.ctid;
create unique index if not exists reports_once on public.reports (reporter_id, target_kind, target_id) where target_id is not null;
drop policy if exists reports_insert on public.reports;  -- only through report(), which always opens a case
alter table public.reports alter column reporter_id drop not null;
alter table public.reports drop constraint if exists reports_reporter_id_fkey,
  add constraint reports_reporter_id_fkey foreign key (reporter_id) references public.profiles (id) on delete set null;

create or replace function public.report(p_kind text, p_target_user uuid, p_target_id uuid, p_category text, p_details text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  rid uuid;
  owner uuid;
  vis boolean;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_kind = 'profile' then p_target_id := coalesce(p_target_id, p_target_user); end if;
  if p_target_id is null then raise exception 'what are you reporting?' using errcode = '22023'; end if;
  if (select count(*) from public.reports where reporter_id = me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'slow down: too many in a short time' using errcode = '54000';
  end if;
  if p_target_id is not null then
    if p_kind = 'message' then
      select m.sender_id, private.is_member(m.conversation_id, me) into owner, vis from public.messages m where m.id = p_target_id;
    elsif p_kind = 'comment' then
      select c.author_id, private.user_can_see(me, c.target_type, c.target_id) into owner, vis from public.comments c where c.id = p_target_id;
    else
      owner := private.owner_of(case p_kind when 'event' then 'activity' else p_kind end, p_target_id::text);
      vis := private.user_can_see(me, case p_kind when 'event' then 'activity' else p_kind end, p_target_id::text);
    end if;
    if not coalesce(vis, false) then raise exception 'not found' using errcode = 'P0002'; end if;
    p_target_user := owner;   -- never trust the client about whose content it is
  end if;
  if p_target_user = me then raise exception 'you cannot report yourself' using errcode = '22023'; end if;
  insert into public.reports (reporter_id, target_user_id, target_kind, target_id, category, details)
  values (me, p_target_user, p_kind, p_target_id, p_category, p_details)
  on conflict do nothing
  returning id into rid;
  if rid is null then
    select id into rid from public.reports where reporter_id = me and target_kind = p_kind and target_id = p_target_id;
    return rid;
  end if;
  insert into public.moderation_cases (report_id) values (rid);
  return rid;
end $$;

create or replace function private.on_report_escalate() returns trigger
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if new.target_id is null then return new; end if;
  -- same kind, established accounts only, and never against a moderator's dismissal
  select count(distinct r.reporter_id) into n from public.reports r
  join public.profiles p on p.id = r.reporter_id and p.deleted_at is null and p.created_at < now() - interval '7 days'
  where r.target_kind = new.target_kind and r.target_id = new.target_id and r.created_at > now() - interval '1 day';
  if n < 3 or exists (select 1 from public.moderation_cases m join public.reports r on r.id = m.report_id
      where r.target_id = new.target_id and m.status = 'dismissed') then
    return new;
  end if;
  update public.moderation_cases m set priority = 'high'
  from public.reports r where r.id = m.report_id and r.target_id = new.target_id and r.target_kind = new.target_kind;
  if new.target_kind = 'irl_post' then
    update public.irl_posts set expires_at = now() where id = new.target_id;
  elsif new.target_kind = 'comment' then
    update public.comments set deleted_at = now() where id = new.target_id and deleted_at is null;
  elsif new.target_kind = 'community_post' then
    update public.community_posts set deleted_at = now() where id = new.target_id and deleted_at is null;
  end if;
  return new;
end $$;

-- ===== F. removed items are frozen for their author =====
create or replace function private.edit_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
declare fixed text[] := tg_argv; k text;
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or private.is_admin(auth.uid()) then return new; end if;
  if old.deleted_at is not null then
    raise exception 'a removed item cannot be edited or restored' using errcode = '42501';
  end if;
  foreach k in array fixed loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
      raise exception '% cannot be changed', k using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

-- ===== G. removed text does not live on in notifications =====
create or replace function private.purge_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k text := case tg_table_name when 'comments' then 'comment_id' else 'post_id' end;
begin
  if tg_op = 'DELETE' or (case when tg_table_name = 'irl_posts' then (to_jsonb(new) ->> 'expires_at')::timestamptz <= now()
                               else to_jsonb(new) ->> 'deleted_at' is not null end) then
    delete from public.notifications where payload ->> k = old.id::text;
  end if;
  return null;
end $$;
drop trigger if exists comments_purge_notifications on public.comments;
create trigger comments_purge_notifications after update of deleted_at or delete on public.comments for each row execute function private.purge_notifications();
drop trigger if exists community_posts_purge_notifications on public.community_posts;
create trigger community_posts_purge_notifications after update of deleted_at or delete on public.community_posts for each row execute function private.purge_notifications();
drop trigger if exists irl_posts_purge_notifications on public.irl_posts;
create trigger irl_posts_purge_notifications after update of expires_at or delete on public.irl_posts for each row execute function private.purge_notifications();

-- ===== H. activities: no opening a girl-only activity or shrinking under the people going =====
create or replace function private.activity_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or private.is_admin(auth.uid()) then return new; end if;
  if new.created_at is distinct from old.created_at then raise exception 'created_at cannot be changed' using errcode = '42501'; end if;
  if old.girl_only and not new.girl_only
     and exists (select 1 from public.activity_participants where activity_id = old.id and user_id <> old.creator_id) then
    raise exception 'people joined a girl-only activity: it stays girl-only' using errcode = '42501';
  end if;
  if new.community_id is not null and new.community_id is distinct from old.community_id and not private.i_belong(new.community_id) then
    raise exception 'you are not in that community' using errcode = '42501';
  end if;
  if new.capacity is not null and new.capacity is distinct from old.capacity
     and new.capacity < private.going_count(old.id) then
    raise exception 'capacity is below the number of people going' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists activities_guard on public.activities;
create trigger activities_guard before update on public.activities for each row execute function private.activity_guard();


-- ===== I. match reasons =====
update public.irly_match_profiles set hidden_fields = array(select f from unnest(hidden_fields) f where f in ('age', 'languages', 'areas'))
where not hidden_fields <@ array['age', 'languages', 'areas'];
alter table public.irly_match_profiles drop constraint if exists irly_match_profiles_hidden_fields_check;
alter table public.irly_match_profiles add constraint irly_match_profiles_hidden_fields_check
  check (hidden_fields <@ array['age', 'languages', 'areas']);

create or replace function private.strip_hidden(r jsonb, hidden text[]) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  out jsonb := r;
  k text;
begin
  if r is null then return null; end if;
  foreach k in array coalesce(hidden, '{}') loop
    -- Lists stay (empty) so clients always get the same shape.
    if out ? k then
      out := jsonb_set(out, array[k], case when jsonb_typeof(out -> k) = 'array' then '[]'::jsonb else 'null'::jsonb end);
    end if;
    if out ? 'facets' then
      out := jsonb_set(out, '{facets}', (out -> 'facets') - k);
    end if;
  end loop;
  return out;
end $$;
update public.irly_matches set reasons = reasons;

create or replace function private.match_hidden(a uuid, b uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct f), '{}') from public.irly_match_profiles mp, unnest(mp.hidden_fields) f
  where mp.user_id in (a, b)
$$;

create or replace function public.irly_my_matches()
returns table (match_id uuid, conversation_id uuid, user_id uuid, first_name text, photo_paths text[], score integer, reasons jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, c.id, other.id, other.first_name, coalesce(mp.photo_paths, '{}'), m.score::integer,
    private.strip_hidden(m.reasons, private.match_hidden(m.user_a, m.user_b)), m.created_at
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

-- Activity update: the community check moved to activity_guard (only when it changes).
drop policy if exists activities_creator on public.activities;
create policy activities_creator on public.activities for update to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid() and (not girl_only or private.is_girl_eligible()));

-- ===== J. invitees can see what they were invited to =====
create or replace function private.invited_to(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.activities a
    join public.messages msg on msg.kind = 'share' and msg.ref_type = 'activity' and msg.ref_id = a.id and msg.deleted_at is null
    join public.conversation_members cm on cm.conversation_id = msg.conversation_id and cm.user_id = auth.uid()
    where a.id = aid and a.privacy = 'invite'
      and (msg.sender_id = a.creator_id or exists (
        select 1 from public.activity_participants ap where ap.activity_id = a.id and ap.user_id = msg.sender_id and ap.status = 'going'))
  )
$$;
grant execute on function private.invited_to(uuid) to authenticated;
drop policy if exists activities_read on public.activities;
create policy activities_read on public.activities for select to authenticated
  using (
    creator_id = auth.uid()
    or private.i_participate(id)
    or (
      cancelled_at is null
      and (not girl_only or private.is_girl_eligible())
      and not private.is_blocked(auth.uid(), creator_id)
      and (
        privacy = 'public'
        or (privacy = 'community' and community_id is not null and private.i_belong(community_id))
        or (privacy = 'friends' and private.are_friends(auth.uid(), creator_id))
        or (privacy = 'invite' and private.invited_to(id))
      )
    )
  );

-- ===== K. account deletion, notifications, fixed columns =====
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  delete from public.messages where sender_id = me;
  -- One-to-one chats end with the person.
  delete from public.conversations c where c.kind = 'direct'
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = me);
  -- Nobody keeps notifications about them ("X sent you a request").
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

-- Columns a member's own update must not touch (no deleted_at needed).
create or replace function private.freeze() returns trigger
language plpgsql security invoker set search_path = public as $$
declare k text;
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or private.is_admin(auth.uid()) then return new; end if;
  foreach k in array tg_argv loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
      raise exception '% cannot be changed', k using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists notifications_freeze on public.notifications;
create trigger notifications_freeze before update on public.notifications
for each row execute function private.freeze('user_id', 'kind', 'payload', 'created_at');
drop trigger if exists conversation_members_freeze on public.conversation_members;
create trigger conversation_members_freeze before update on public.conversation_members
for each row execute function private.freeze('role', 'conversation_id', 'user_id', 'joined_at');
drop trigger if exists profiles_freeze on public.profiles;
create trigger profiles_freeze before update on public.profiles
for each row execute function private.freeze('birthdate', 'created_at');

revoke all on function private.purge_notifications(), private.activity_guard(), private.irl_precision(), private.match_hidden(uuid, uuid) from public, anon, authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.can_see(text, text), private.discoverable(uuid), private.uuid_or_null(text),
  private.may_message(uuid, uuid), private.default_irl_visibility(), private.going_count(uuid), private.precision_of(uuid), private.invited_to(uuid) to authenticated;
