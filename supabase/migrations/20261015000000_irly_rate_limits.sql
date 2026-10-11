-- Limits against spam and mass actions, enforced on the server whatever
-- the app sends. Messages, friend requests, follows and new activities had
-- none (comments, posts, IRL posts, likes, communities, reports and support
-- requests already do). The limits are far above normal use; a member who
-- hits one gets "slow down" and can try again a little later. Inserts made
-- by the server itself (no signed-in member) are never limited.

create or replace function private.rate_guard() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  actor uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  n integer;
begin
  if auth.uid() is null or actor is distinct from auth.uid() then
    return new;
  end if;
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2::interval', tg_table_schema, tg_table_name, tg_argv[0])
    into n using actor, tg_argv[1];
  if n >= tg_argv[2]::integer then
    raise exception 'slow down: too many in a short time' using errcode = '54000';
  end if;
  return new;
end $$;
revoke all on function private.rate_guard() from public, anon, authenticated;

create index if not exists messages_sender_recent_idx on public.messages (sender_id, created_at);
create index if not exists friendships_requested_recent_idx on public.friendships (requested_by, created_at);
create index if not exists follows_follower_recent_idx on public.follows (follower_id, created_at);
create index if not exists activities_creator_recent_idx on public.activities (creator_id, created_at);

-- Messages: 30 a minute, 500 an hour.
drop trigger if exists messages_rate_minute on public.messages;
create trigger messages_rate_minute before insert on public.messages
for each row execute function private.rate_guard('sender_id', '1 minute', '30');
drop trigger if exists messages_rate_hour on public.messages;
create trigger messages_rate_hour before insert on public.messages
for each row execute function private.rate_guard('sender_id', '1 hour', '500');
-- Friend requests: 40 an hour.
drop trigger if exists friendships_rate on public.friendships;
create trigger friendships_rate before insert on public.friendships
for each row execute function private.rate_guard('requested_by', '1 hour', '40');
-- Follows: 100 an hour.
drop trigger if exists follows_rate on public.follows;
create trigger follows_rate before insert on public.follows
for each row execute function private.rate_guard('follower_id', '1 hour', '100');
-- New activities: 20 a day.
drop trigger if exists activities_rate on public.activities;
create trigger activities_rate before insert on public.activities
for each row execute function private.rate_guard('creator_id', '1 day', '20');
