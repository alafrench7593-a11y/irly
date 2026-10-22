-- A group chat is created once, even when its request is sent twice.
-- Tests: supabase/tests/create_group_once.test.sql.
--
-- The New group screen sends create_group once per tap, but a request whose
-- answer is lost (network gone, timeout) leaves the member on the screen with
-- "Could not create the group": tapping Create again made a second group with
-- the same people, each of them notified twice. create_community already
-- answers a retry with the community it just made; create_group now does the
-- same: the same title with exactly the same people, made by the same member
-- in the last two minutes, is that group. Everything else is unchanged
-- (validation, members, notifications); additive, no data touched.

create or replace function public.create_group(p_title text, p_members uuid[], p_photo text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
  m uuid;
  people uuid[];
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 60 then
    raise exception 'give the group a name (60 characters at most)' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct x), '{}') into people from unnest(p_members) x where x is not null and x <> me;
  if cardinality(people) = 0 or cardinality(people) > 49 then
    raise exception 'add between 1 and 49 people' using errcode = '22023';
  end if;
  if p_photo is not null and not private.own_upload(p_photo) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  foreach m in array people loop
    if not exists (select 1 from public.profiles where id = m and deleted_at is null) or not private.may_message(m) then
      raise exception 'one of these people does not accept messages from you' using errcode = '42501';
    end if;
  end loop;
  -- A double tap or a request retried after a lost answer gets the group it already made
  -- (two requests at the same moment wait for each other here).
  perform pg_advisory_xact_lock(hashtextextended('create_group:' || me::text, 0));
  select c.id into conv
  from public.conversations c
  join public.conversation_members mine on mine.conversation_id = c.id and mine.user_id = me and mine.role = 'admin'
  where c.kind = 'group'
    and c.title = btrim(p_title)
    and c.created_at > now() - interval '2 minutes'
    and (select array_agg(cm.user_id order by cm.user_id) from public.conversation_members cm where cm.conversation_id = c.id)
      = (select array_agg(x order by x) from unnest(people || me) x)
  order by c.created_at desc
  limit 1;
  if conv is not null then
    return conv;
  end if;
  insert into public.conversations (kind, title, photo_path) values ('group', btrim(p_title), p_photo) returning id into conv;
  insert into public.conversation_members (conversation_id, user_id, role) values (conv, me, 'admin');
  insert into public.conversation_members (conversation_id, user_id)
    select conv, x from unnest(people) x on conflict do nothing;
  insert into public.notifications (user_id, kind, payload)
    select x, 'GROUP_ADDED', jsonb_build_object('from', me, 'conversation_id', conv, 'title', btrim(p_title))
    from unnest(people) x;
  return conv;
end $$;
