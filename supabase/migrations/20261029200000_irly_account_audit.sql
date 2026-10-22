-- Pre-App-Store audit: account deletion and IRLY Maman.
-- Additive only: no table or column is dropped, RLS stays on everywhere, no
-- access is widened (the new functions are private, run by triggers only).
--
-- 1. Reported content survives every kind of deletion, not only the member's
--    own words. Deleting an account deletes, with it, rows written by OTHER
--    people: its direct chats (the other person's messages too), the plans it
--    hosted (and so each plan's chat), its group's last messages. When one of
--    those rows was reported, its words went with it and the moderators were
--    left with a report about nothing (a member harassed in a private chat who
--    reports, then deletes her account, erased the evidence). The privacy
--    policy says reported content is kept until the report is handled, then
--    12 months: a trigger now keeps the text of any reported message, comment,
--    community post or plan whenever its row is deleted, by any path (the same
--    rule Lives already had, private.keep_reported_live). Nothing else is
--    kept; private.removed_content is staff only and purged after 12 months
--    (private.retention_purge).
-- 2. « IRLY Maman » (and IRLY's other official names) can no longer be taken
--    by a member's community: a member creating or renaming a community to the
--    exact name of one of IRLY's official communities is refused, so the
--    official IRLY Maman is the only « IRLY Maman » in the lists. Admins and
--    the server's own work (auth.uid() null) are not concerned; existing rows
--    are untouched.

-- ───────── 1. reported content is kept whatever deletes it ─────────
create or replace function private.keep_reported_on_delete() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  j jsonb := to_jsonb(old);
  kinds text[] := case tg_table_name
    when 'messages' then array['message']
    when 'comments' then array['comment']
    when 'community_posts' then array['community_post']
    when 'activities' then array['activity', 'event']
  end;
  kept text;
begin
  if kinds is null or not exists (select 1 from public.reports r where r.target_kind = any (kinds) and r.target_id = old.id) then
    return old;
  end if;
  kept := case tg_table_name
    -- The same shape as admin_moderate's « delete » of a plan.
    when 'activities' then left(coalesce(j ->> 'title', '') || coalesce(E'\n' || (j ->> 'description'), ''), 3000)
    when 'messages' then coalesce(j ->> 'body', '') || coalesce(' [media: ' || (j ->> 'media_path') || ']', '')
    else coalesce(j ->> 'body', '')
  end;
  -- A removed comment or message reads « — »: its words were already kept when it was removed.
  insert into private.removed_content (source, id, body)
  values (tg_table_name, old.id, kept)
  on conflict (source, id) do nothing;
  return old;
end $$;
revoke all on function private.keep_reported_on_delete() from public, anon, authenticated;

drop trigger if exists messages_keep_reported on public.messages;
create trigger messages_keep_reported before delete on public.messages
  for each row execute function private.keep_reported_on_delete();
drop trigger if exists comments_keep_reported on public.comments;
create trigger comments_keep_reported before delete on public.comments
  for each row execute function private.keep_reported_on_delete();
drop trigger if exists community_posts_keep_reported on public.community_posts;
create trigger community_posts_keep_reported before delete on public.community_posts
  for each row execute function private.keep_reported_on_delete();
drop trigger if exists activities_keep_reported on public.activities;
create trigger activities_keep_reported before delete on public.activities
  for each row execute function private.keep_reported_on_delete();

-- ───────── 2. IRLY's official names stay IRLY's ─────────
-- « IRLY  maman », « irly Maman »: the same name (case and spaces do not count).
create or replace function private.community_name_key(p text) returns text
language sql immutable set search_path = pg_catalog as $$
  select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'))
$$;
revoke all on function private.community_name_key(text) from public, anon, authenticated;

create or replace function private.official_name_guard() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if new.official or auth.uid() is null or private.is_admin(auth.uid()) then
    return new;
  end if;
  if tg_op = 'UPDATE' and private.community_name_key(new.name) = private.community_name_key(old.name) then
    return new;
  end if;
  if exists (select 1 from public.community_topics t
             where t.active and private.community_name_key(t.name) = private.community_name_key(new.name)) then
    raise exception 'this name is reserved for an IRLY community' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.official_name_guard() from public, anon, authenticated;
drop trigger if exists communities_official_name_guard on public.communities;
create trigger communities_official_name_guard before insert or update of name on public.communities
  for each row execute function private.official_name_guard();
