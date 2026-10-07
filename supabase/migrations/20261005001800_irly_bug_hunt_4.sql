-- Fourth bug hunt: fixes to fixes (each reproduced on a scratch DB).
--
--  1. report() checks visibility as the reporter actually sees things (RLS),
--     not with a narrower copy: friends-only and community activities,
--     communities you are not in, and people you blocked can be reported.
--  2. Priority goes high at 3 distinct reporters whatever their account age
--     (new apps have only new accounts); auto-hiding still needs established
--     accounts. The third report's own case is included.
--  3. "hidden" location precision also hides profiles.city_id.
--  5. Deleting something already removed is a no-op, not an error.
--  6. activities.going (computed column) answers only for activities you can see.
--  7. Deleting an account keeps the text of reported messages for moderation.

-- ───────── 1 + 2. Reports ─────────
create or replace function private.file_report(p_kind text, p_target_id uuid, p_category text, p_details text) returns uuid
language plpgsql security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  owner uuid;
  rid uuid;
  n integer;
begin
  if (select count(*) from public.reports where reporter_id = me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'slow down: too many in a short time' using errcode = '54000';
  end if;
  owner := case p_kind
    when 'message' then (select sender_id from public.messages where id = p_target_id)
    when 'profile' then p_target_id
    else private.owner_of(case p_kind when 'event' then 'activity' else p_kind end, p_target_id::text)
  end;
  if owner = me then raise exception 'you cannot report yourself' using errcode = '22023'; end if;
  insert into public.reports (reporter_id, target_user_id, target_kind, target_id, category, details)
  values (me, owner, p_kind, p_target_id, p_category, p_details)
  on conflict do nothing
  returning id into rid;
  if rid is null then
    return (select id from public.reports where reporter_id = me and target_kind = p_kind and target_id = p_target_id);
  end if;
  insert into public.moderation_cases (report_id) values (rid);
  select count(distinct reporter_id) into n from public.reports
  where target_kind = p_kind and target_id = p_target_id and created_at > now() - interval '1 day';
  if n >= 3 then
    update public.moderation_cases m set priority = 'high'
    from public.reports r where r.id = m.report_id and r.target_kind = p_kind and r.target_id = p_target_id and m.status <> 'dismissed';
  end if;
  return rid;
end $$;

-- Could the reporter see (or have seen) the target? Pieces that RLS cannot answer.
create or replace function private.reportable_extra(p_kind text, p_target_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_kind
    -- People can be reported after blocking them (block, then report).
    when 'profile' then exists (select 1 from public.profiles where id = p_target_id and deleted_at is null)
    -- A message in a chat you are (or were, for a match) part of.
    when 'message' then exists (
      select 1 from public.messages m
      left join public.conversations c on c.id = m.conversation_id
      left join public.irly_matches im on im.id = c.match_id
      where m.id = p_target_id
        and (private.is_member(m.conversation_id, auth.uid()) or auth.uid() in (im.user_a, im.user_b)))
    else false
  end
$$;
create or replace function private.comment_target(p_id uuid) returns table (target_type text, target_id text)
language sql stable security definer set search_path = public as $$
  select target_type, target_id from public.comments where id = p_id
$$;

-- Invoker: visibility is checked with the reporter's own row-level security.
create or replace function public.report(p_kind text, p_target_user uuid, p_target_id uuid, p_category text, p_details text default null) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  t uuid := case when p_kind = 'profile' then coalesce(p_target_id, p_target_user) else p_target_id end;
  ok boolean;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if t is null then raise exception 'what are you reporting?' using errcode = '22023'; end if;
  ok := case p_kind
    when 'activity' then exists (select 1 from public.activities where id = t)
    when 'event' then exists (select 1 from public.activities where id = t)
    when 'community' then exists (select 1 from public.communities where id = t)
    when 'irl_post' then exists (select 1 from public.irl_posts where id = t)
    when 'community_post' then exists (select 1 from public.community_posts where id = t)
    when 'comment' then exists (select 1 from private.comment_target(t) ct where private.can_see(ct.target_type, ct.target_id))
    else private.reportable_extra(p_kind, t)
  end;
  if not coalesce(ok, false) then raise exception 'not found' using errcode = 'P0002'; end if;
  return private.file_report(p_kind, t, p_category, p_details);
end $$;
revoke all on function public.report(text, uuid, uuid, text, text) from public, anon;
grant execute on function public.report(text, uuid, uuid, text, text) to authenticated;

-- Auto-hiding: 3 established accounts (7 days), never over a dismissal.
create or replace function private.on_report_escalate() returns trigger
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if new.target_id is null then return new; end if;
  select count(distinct r.reporter_id) into n from public.reports r
  join public.profiles p on p.id = r.reporter_id and p.deleted_at is null and p.created_at < now() - interval '7 days'
  where r.target_kind = new.target_kind and r.target_id = new.target_id and r.created_at > now() - interval '1 day';
  if n < 3 or exists (select 1 from public.moderation_cases m join public.reports r on r.id = m.report_id
      where r.target_id = new.target_id and m.status = 'dismissed') then
    return new;
  end if;
  if new.target_kind = 'irl_post' then
    update public.irl_posts set expires_at = now() where id = new.target_id;
  elsif new.target_kind = 'comment' then
    update public.comments set deleted_at = now() where id = new.target_id and deleted_at is null;
  elsif new.target_kind = 'community_post' then
    update public.community_posts set deleted_at = now() where id = new.target_id and deleted_at is null;
  end if;
  return new;
end $$;

-- ───────── 3. Hidden precision hides the city too ─────────
create or replace function private.restrict_profile_columns() returns void
language plpgsql security definer set search_path = public as $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
    and column_name not in ('birthdate', 'faith', 'gender', 'is_admin', 'area_id', 'city_id');
  execute 'revoke select on public.profiles from anon, authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;
revoke all on function private.restrict_profile_columns() from public, anon, authenticated;
select private.restrict_profile_columns();

-- ───────── 5. Removing twice is fine ─────────
create or replace function private.edit_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
declare fixed text[] := tg_argv; k text;
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or private.is_admin(auth.uid()) then return new; end if;
  if old.deleted_at is not null then
    -- Removing again (double tap, retry) changes nothing.
    if new.deleted_at is not null
       and (to_jsonb(new) - 'deleted_at' - 'updated_at') = (to_jsonb(old) - 'deleted_at' - 'updated_at') then
      return old;
    end if;
    raise exception 'a removed item cannot be edited or restored' using errcode = '42501';
  end if;
  foreach k in array fixed loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
      raise exception '% cannot be changed', k using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

-- ───────── 6. going only for activities you can see ─────────
create or replace function public.going(a public.activities) returns integer
language sql stable security invoker set search_path = public as $$
  select case when exists (select 1 from public.activities x where x.id = a.id) then private.going_count(a.id) end
$$;
revoke all on function public.going(public.activities) from public, anon;
grant execute on function public.going(public.activities) to authenticated;

-- ───────── 7. Reported messages survive account deletion ─────────
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  insert into private.removed_content (source, id, body)
    select 'messages', m.id, m.body from public.messages m
    where m.sender_id = me and exists (select 1 from public.reports r where r.target_kind = 'message' and r.target_id = m.id)
    on conflict do nothing;
  delete from public.messages where sender_id = me;
  delete from public.conversations c where c.kind = 'direct'
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = me);
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

revoke all on all functions in schema private from public, anon;
grant execute on function private.file_report(text, uuid, text, text), private.reportable_extra(text, uuid),
  private.comment_target(uuid), private.going_count(uuid), private.can_see(text, text) to authenticated;
