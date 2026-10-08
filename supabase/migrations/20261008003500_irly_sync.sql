-- One living system: the database keeps every copy of a fact in step, so
-- no screen can show a version the server does not have.
--   · chat membership follows activity participants and community members
--     (whatever path wrote them: RPC, admin, cascade);
--   · a renamed activity or community renames its chat;
--   · a cancelled plan says so in its chat; a deleted one disappears with
--     its chat; a deleted community leaves every inbox;
--   · one tap = one object (client_ref on activities, a short dedupe window
--     on communities);
--   · every table a screen shows is published to realtime, with full rows
--     on delete so filtered listeners hear about leaves and removals.

-- ───────── Realtime: full rows on update/delete, every shown table published ─────────
alter table public.activities replica identity full;
alter table public.activity_participants replica identity full;
alter table public.communities replica identity full;
alter table public.community_members replica identity full;
alter table public.conversation_members replica identity full;
alter table public.conversations replica identity full;

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return; -- local databases without Supabase realtime
  end if;
  foreach t in array array['activities', 'activity_participants', 'communities', 'community_members', 'conversations', 'conversation_members', 'profiles', 'saves'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ───────── Activity participants ↔ activity chat ─────────
create or replace function private.sync_activity_chat() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a public.activities;
  conv uuid;
  row public.activity_participants := coalesce(new, old);
begin
  select * into a from public.activities where id = row.activity_id;
  if not found then return null; end if; -- the activity itself is being deleted
  if tg_op = 'DELETE' or row.status <> 'going' then
    delete from public.conversation_members cm
    using public.conversations c
    where c.activity_id = a.id and cm.conversation_id = c.id and cm.user_id = row.user_id and row.user_id <> a.creator_id;
    return null;
  end if;
  conv := private.ensure_conversation('activity', a.id, a.title);
  insert into public.conversation_members (conversation_id, user_id, role)
  values (conv, new.user_id, case when new.user_id = a.creator_id then 'admin' else 'member' end)
  on conflict do nothing;
  return null;
end $$;
drop trigger if exists activity_participants_chat on public.activity_participants;
create trigger activity_participants_chat after insert or update of status or delete on public.activity_participants
for each row execute function private.sync_activity_chat();

-- ───────── Community members ↔ community chat ─────────
create or replace function private.sync_community_chat() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c public.communities;
  conv uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.conversation_members cm
    using public.conversations cv
    where cv.community_id = old.community_id and cm.conversation_id = cv.id and cm.user_id = old.user_id;
    return null;
  end if;
  select * into c from public.communities where id = new.community_id and deleted_at is null;
  if not found then return null; end if;
  conv := private.ensure_conversation('community', c.id, c.name);
  insert into public.conversation_members (conversation_id, user_id, role)
  values (conv, new.user_id, case when new.role = 'owner' then 'admin' else 'member' end)
  on conflict do nothing;
  return null;
end $$;
drop trigger if exists community_members_chat on public.community_members;
create trigger community_members_chat after insert or delete on public.community_members
for each row execute function private.sync_community_chat();

-- ───────── One name: the chat is renamed with its activity or community ─────────
create or replace function private.sync_activity_chat_title() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.title is distinct from old.title then
    update public.conversations set title = new.title where activity_id = new.id;
  end if;
  return null;
end $$;
create or replace function private.sync_community_chat_title() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update public.conversations set title = new.name where community_id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists activities_chat_title on public.activities;
create trigger activities_chat_title after update of title on public.activities
for each row execute function private.sync_activity_chat_title();
drop trigger if exists communities_chat_title on public.communities;
create trigger communities_chat_title after update of name on public.communities
for each row execute function private.sync_community_chat_title();

-- ───────── A cancelled plan says so in its chat ─────────
create or replace function private.activity_cancelled() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  conv uuid;
begin
  if old.cancelled_at is null and new.cancelled_at is not null then
    select id into conv from public.conversations where activity_id = new.id;
    if conv is not null then
      insert into public.messages (conversation_id, sender_id, kind, body)
      values (conv, null, 'system', 'This plan was cancelled by the host.');
    end if;
  end if;
  return null;
end $$;
drop trigger if exists activities_cancelled on public.activities;
create trigger activities_cancelled after update of cancelled_at on public.activities
for each row execute function private.activity_cancelled();

-- (A new time, place or a cancellation already reaches the people going: private.on_activity_updated.)

-- ───────── One tap = one activity ─────────
alter table public.activities add column if not exists client_ref uuid;
create unique index if not exists activities_client_ref on public.activities (creator_id, client_ref) where client_ref is not null;

-- ───────── Delete an activity (its host): gone everywhere, chat included ─────────
create or replace function public.delete_activity(p_activity uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.activities;
  p record;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into a from public.activities where id = p_activity for update;
  if not found or a.creator_id <> auth.uid() then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  -- People who were going hear it once, then the plan and its chat go.
  for p in select user_id from public.activity_participants where activity_id = a.id and status = 'going' and user_id <> a.creator_id loop
    perform private.notify(p.user_id, 'ACTIVITY_UPDATED', jsonb_build_object('activity_id', a.id, 'title', a.title, 'change', 'deleted'));
  end loop;
  delete from public.activities where id = a.id;
end $$;
revoke all on function public.delete_activity(uuid) from public, anon;
grant execute on function public.delete_activity(uuid) to authenticated;

-- ───────── Delete a community (its owner): out of every list and inbox ─────────
create or replace function public.delete_community(p_community uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.community_members m join public.communities c on c.id = m.community_id
    where m.community_id = p_community and m.user_id = auth.uid() and m.role = 'owner' and c.deleted_at is null and not c.official
  ) then
    raise exception 'only the owner can delete this community' using errcode = '42501';
  end if;
  update public.communities set deleted_at = now() where id = p_community;
  -- The chat leaves every inbox; its history is kept for moderation.
  delete from public.conversation_members cm using public.conversations c
  where c.community_id = p_community and cm.conversation_id = c.id;
end $$;
revoke all on function public.delete_community(uuid) from public, anon;
grant execute on function public.delete_community(uuid) to authenticated;

-- ───────── One tap = one community: the same name twice within two minutes returns the first ─────────
create or replace function public.create_community(
  p_name text,
  p_city text,
  p_tagline text default null,
  p_description text default null,
  p_category text default null,
  p_girl_only boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cid uuid;
  conv uuid;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  -- A double tap (or a retried request) gets the community it already made.
  perform pg_advisory_xact_lock(hashtextextended('create_community:' || me::text, 0));
  select id into cid from public.communities
  where created_by = me and city_id = p_city and lower(name) = lower(trim(p_name)) and deleted_at is null
    and created_at > now() - interval '2 minutes'
  limit 1;
  if cid is not null then
    return cid;
  end if;
  if p_girl_only and not private.is_girl_eligible(me) then
    raise exception 'only IRLY Girl members can create a girls-only community' using errcode = '42501';
  end if;
  if (select count(*) from public.communities where created_by = me and created_at > now() - interval '1 day') >= 3 then
    raise exception 'you can create up to 3 communities a day' using errcode = 'P0001';
  end if;
  insert into public.communities (city_id, name, tagline, description, category_id, girl_only, created_by)
  values (p_city, trim(p_name), nullif(trim(p_tagline), ''), nullif(trim(p_description), ''), p_category, p_girl_only, me)
  returning id into cid;
  -- The owner joins; the member trigger opens the chat and adds them as admin.
  insert into public.community_members (community_id, user_id, role) values (cid, me, 'owner');
  select id into conv from public.conversations where community_id = cid;
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (conv, null, 'system', 'Welcome to ' || trim(p_name) || '! Introduce yourself and plan the first meetup.');
  return cid;
end $$;
