-- IRLY Loup-Garou: voice games.
--
-- The host of an online game chooses « text » or « voice » in the lobby. This
-- migration holds the choice and decides, for each player and each phase, which
-- voice channel they may speak or listen in. It follows the written chat's rules
-- to the letter (ww_say, ww_channel_ok): nothing new is invented here.
--
--   lobby                 everyone there speaks on « all »
--   night, witch          « all » is closed; the pack (same test as the written
--                         pack chat: alive, wolves' camp, not joined this night)
--                         speaks on « wolves »; the dead speak on « dead »
--   day, vote, revote     the living speak on « all »; the dead listen to « all »
--                         and speak on « dead »
--   ended                 every player speaks on « all »
--
-- Training games (AI players write) and in-person games have no voice.
--
-- The audio itself never passes through the database. The Edge Function
-- voice-token calls ww_voice_grant as the member, and signs one short-lived
-- access token per channel for the audio server. Each channel is an audio room
-- whose name changes whenever who may be in it changes (a death, a card that
-- changes camp, night falling): someone who lost a right holds no token for the
-- new room, and the old room is closed on the audio server (« retire »), which
-- disconnects whoever stayed in it.
--
-- Public RPCs:
--   ww_set_comm(p_room, p_comm)   the host, in the lobby
--   ww_voice_state(p_room)        what I may do now, and a key that changes when it changes
--   ww_voice_grant(p_room)        the same with the audio rooms' names (for voice-token)
--   ww_comms(p_rooms)             text or voice, for a list of rooms I can see

alter table private.ww_games add column if not exists comm text not null default 'text';
alter table private.ww_games add column if not exists voice_key text not null default md5(random()::text || clock_timestamp()::text);
do $$ begin
  alter table private.ww_games add constraint ww_games_comm_check check (comm in ('text', 'voice'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table private.ww_games add constraint ww_games_voice_online check (comm = 'text' or kind = 'online');
exception when duplicate_object then null; end $$;

-- The audio rooms a game has used: the current one of each channel, and those replaced (to close them).
create table if not exists private.ww_voice_rooms (
  room_id uuid not null references private.ww_games (room_id) on delete cascade,
  channel text not null check (channel in ('all', 'wolves', 'dead')),
  name text not null,
  created_at timestamptz not null default now(),
  replaced_at timestamptz,
  primary key (room_id, name)
);
create index if not exists ww_voice_rooms_current_idx on private.ww_voice_rooms (room_id, channel) where replaced_at is null;
alter table private.ww_voice_rooms enable row level security;
revoke all on table private.ww_voice_rooms from public, anon, authenticated;

-- ───────── The host's choice ─────────
create or replace function public.ww_set_comm(p_room uuid, p_comm text) returns text
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  r public.game_rooms;
  g private.ww_games;
begin
  select * into r from public.game_rooms where id = p_room for update;
  select * into g from private.ww_games where room_id = p_room;
  if r.id is null or g.room_id is null then raise exception 'this game no longer exists' using errcode = 'P0002'; end if;
  if r.host_id is distinct from me then raise exception 'only the host can do this' using errcode = '42501'; end if;
  if p_comm is null or p_comm not in ('text', 'voice') then raise exception 'choose text or voice' using errcode = '22023'; end if;
  if g.phase <> 'lobby' then raise exception 'this game has already started' using errcode = '22023'; end if;
  if p_comm = 'voice' and g.kind <> 'online' then raise exception 'voice is for online games' using errcode = '22023'; end if;
  update private.ww_games set comm = p_comm where room_id = p_room;
  update public.game_rooms set updated_at = now() where id = p_room;
  return p_comm;
end $$;
revoke all on function public.ww_set_comm(uuid, text) from public, anon;
grant execute on function public.ww_set_comm(uuid, text) to authenticated;

-- ───────── Who may speak and listen where ─────────
create or replace function private.ww_voice_channels(p_room uuid, p_user uuid) returns table (channel text, speak boolean, listen boolean)
language plpgsql stable security definer set search_path = public, private as $$
declare
  g private.ww_games;
  p private.ww_players;
begin
  select * into g from private.ww_games where room_id = p_room;
  if not found or g.comm <> 'voice' or g.kind <> 'online' or p_user is null then return; end if;
  if g.phase = 'lobby' then
    if exists (select 1 from public.game_participants gp where gp.room_id = p_room and gp.user_id = p_user and gp.left_at is null) then
      return query select 'all'::text, true, true;
    end if;
    return;
  end if;
  select * into p from private.ww_players where room_id = p_room and user_id = p_user;
  if not found then return; end if;
  if g.phase = 'ended' then
    return query select 'all'::text, true, true;
  elsif g.phase in ('day', 'vote', 'revote') then
    if p.alive then
      return query select 'all'::text, true, true;
    else
      return query select 'all'::text, false, true;
      return query select 'dead'::text, true, true;
    end if;
  else
    -- Night: the village sleeps. Only the pack, and the dead among themselves.
    if not p.alive then
      return query select 'dead'::text, true, true;
    elsif p.camp = 'wolves' and coalesce(p.wolf_since, 0) <= greatest(g.night, 1) then
      return query select 'wolves'::text, true, true;
    end if;
  end if;
end $$;
revoke all on function private.ww_voice_channels(uuid, uuid) from public, anon, authenticated;

/** The audio room of a channel right now, the same for everyone; null while the channel is closed. */
create or replace function private.ww_voice_room(p_room uuid, p_channel text) returns text
language plpgsql stable security definer set search_path = public, private as $$
declare
  g private.ww_games;
  members text;
  part text;
begin
  select * into g from private.ww_games where room_id = p_room;
  if not found or g.comm <> 'voice' or g.kind <> 'online' then return null; end if;
  if g.phase = 'lobby' then
    if p_channel <> 'all' then return null; end if;
    -- Someone who left or was removed must not stay in the room: its name follows who is gone.
    select coalesce(string_agg(gp.user_id::text, ',' order by gp.user_id), '') into members
      from public.game_participants gp where gp.room_id = p_room and gp.left_at is not null;
    part := 'lobby|' || members;
  elsif g.phase = 'ended' then
    if p_channel <> 'all' then return null; end if;
    part := 'ended';
  elsif p_channel = 'dead' then
    select coalesce(string_agg(seat::text, ',' order by seat), '') into members
      from private.ww_players where room_id = p_room and not alive and not bot;
    if members = '' then return null; end if;
    part := 'dead|' || members;
  elsif g.phase in ('day', 'vote', 'revote') then
    if p_channel <> 'all' then return null; end if;
    select coalesce(string_agg(seat::text, ',' order by seat), '') into members
      from private.ww_players where room_id = p_room and alive and not bot;
    part := 'day|' || g.day || '|' || members;
  else
    if p_channel <> 'wolves' then return null; end if;
    select coalesce(string_agg(seat::text, ',' order by seat), '') into members
      from private.ww_players where room_id = p_room and alive and not bot and camp = 'wolves' and coalesce(wolf_since, 0) <= greatest(g.night, 1);
    if members = '' then return null; end if;
    part := 'wolves|' || g.night || '|' || members;
  end if;
  return 'ww-' || left(replace(p_room::text, '-', ''), 12) || '-' || p_channel || '-' || left(md5(g.voice_key || '|' || part), 16);
end $$;
revoke all on function private.ww_voice_room(uuid, text) from public, anon, authenticated;

create or replace function public.ww_voice_state(p_room uuid) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  g private.ww_games;
  chans jsonb;
begin
  if me is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  select * into g from private.ww_games where room_id = p_room;
  if not found or not private.game_can_read(p_room) then raise exception 'this game no longer exists' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('channel', c.channel, 'speak', c.speak, 'listen', c.listen) order by c.channel), '[]'::jsonb) into chans
    from private.ww_voice_channels(p_room, me) c where private.ww_voice_room(p_room, c.channel) is not null;
  return jsonb_build_object('comm', g.comm, 'channels', chans,
    'key', md5(coalesce((select string_agg(c.channel || c.speak::text || c.listen::text || private.ww_voice_room(p_room, c.channel), '|' order by c.channel)
      from private.ww_voice_channels(p_room, me) c where private.ww_voice_room(p_room, c.channel) is not null), '')));
end $$;
revoke all on function public.ww_voice_state(uuid) from public, anon;
grant execute on function public.ww_voice_state(uuid) to authenticated;

create or replace function public.ww_voice_grant(p_room uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  g private.ww_games;
  ch text;
  cur text;
  chans jsonb;
  retire jsonb;
begin
  select * into g from private.ww_games where room_id = p_room;
  if not found or not private.game_can_read(p_room) then raise exception 'this game no longer exists' using errcode = 'P0002'; end if;
  if g.comm <> 'voice' then raise exception 'this game is played in writing' using errcode = '22023'; end if;
  -- The phase must be the real one before any right is given.
  perform private.ww_advance(p_room);
  if not exists (select 1 from private.ww_voice_channels(p_room, me)) then
    raise exception 'you cannot talk here now' using errcode = '42501';
  end if;
  foreach ch in array array['all', 'wolves', 'dead'] loop
    cur := private.ww_voice_room(p_room, ch);
    update private.ww_voice_rooms set replaced_at = now() where room_id = p_room and channel = ch and replaced_at is null and name is distinct from cur;
    if cur is not null then
      insert into private.ww_voice_rooms (room_id, channel, name) values (p_room, ch, cur)
        on conflict (room_id, name) do update set replaced_at = null;
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('channel', c.channel, 'room', private.ww_voice_room(p_room, c.channel), 'speak', c.speak, 'listen', c.listen) order by c.channel), '[]'::jsonb) into chans
    from private.ww_voice_channels(p_room, me) c where private.ww_voice_room(p_room, c.channel) is not null;
  -- Rooms replaced a moment ago: the audio server closes them, so nobody stays where they no longer belong.
  select coalesce(jsonb_agg(v.name), '[]'::jsonb) into retire
    from private.ww_voice_rooms v where v.room_id = p_room and v.replaced_at > now() - interval '3 minutes';
  return jsonb_build_object('identity', me, 'channels', chans, 'retire', retire);
end $$;
revoke all on function public.ww_voice_grant(uuid) from public, anon;
grant execute on function public.ww_voice_grant(uuid) to authenticated;

create or replace function public.ww_comms(p_rooms uuid[]) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select coalesce(jsonb_object_agg(g.room_id, g.comm), '{}'::jsonb)
  from private.ww_games g
  where g.room_id = any (coalesce(p_rooms, '{}'::uuid[])) and auth.uid() is not null and private.game_can_read(g.room_id)
$$;
revoke all on function public.ww_comms(uuid[]) from public, anon;
grant execute on function public.ww_comms(uuid[]) to authenticated;
