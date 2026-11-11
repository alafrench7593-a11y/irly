-- IRLY Games: what the audit of 11 November 2026 found on the server.
--
--   1. A Loup-Garou game nobody plays any more never ended: with no ballot and no attack there is no winner, and each
--      phase change refreshed the room, so the « one hour without a move » rule never applied. Its seats kept counting
--      against the three-games limit. Now: twenty minutes without one action or one message from a member ends the
--      game as a draw. The sweep also stops playing rooms that are already closed.
--   2. A member removed by the host, or who left, kept reading the table's chat and a private table's code. Now: the
--      chat is for those seated; someone who left keeps what was said while they were there; someone removed reads
--      nothing more, and a private table is closed to them.
--   3. A waiting room whose host closed the app could never start. Now: after two minutes without the host, the table
--      passes to the member who has been there longest and is still present.
--   4. An action that aims at no one (stay in, hide, ask for a hint...) stored any seat sent with it, which made the
--      Concierge, the Spy and the Paparazzi report a visit that never happened. Now: such an action carries no seat.
--   5. A host who had left the game could still cut the day short. Now: only a host still seated can.
--   6. Leaving a game and playing in it took their locks in opposite orders. Now: the same order.
--   7. A deck sent with « thief: 0 » still counted the Thief's two extra cards, so the host could not take it out.
--
-- Nothing is deleted, and no rule of any card changes.

alter table private.ww_games add column if not exists last_human_at timestamptz;

-- 1. The last time a member (not an AI player) did something in the game.
create or replace function private.ww_mark_human_action() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if exists (select 1 from private.ww_players p where p.room_id = new.room_id and p.seat = new.seat and not p.bot and p.user_id is not null) then
    update private.ww_games set last_human_at = now() where room_id = new.room_id and (last_human_at is null or last_human_at < now() - interval '5 seconds');
  end if;
  return new;
end $$;
revoke all on function private.ww_mark_human_action() from public, anon, authenticated;
drop trigger if exists ww_actions_mark_human on private.ww_actions;
create trigger ww_actions_mark_human after insert or update on private.ww_actions
for each row execute function private.ww_mark_human_action();

create or replace function private.ww_mark_human_message() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if new.user_id is not null then
    update private.ww_games set last_human_at = now() where room_id = new.room_id and (last_human_at is null or last_human_at < now() - interval '5 seconds');
  end if;
  return new;
end $$;
revoke all on function private.ww_mark_human_message() from public, anon, authenticated;
drop trigger if exists game_messages_mark_human on public.game_messages;
create trigger game_messages_mark_human after insert on public.game_messages
for each row execute function private.ww_mark_human_message();

-- 4. An action that aims at no one carries no seat; only the Cupid and the Scammer name two.
create or replace function private.ww_action_targets() returns trigger
language plpgsql as $$
begin
  if new.phase <> 'power' and new.kind in ('ready', 'hint', 'stay', 'bluff', 'hide', 'pass') then
    new.target := null;
  end if;
  if new.kind not in ('link', 'exchange') then
    new.target2 := null;
  end if;
  return new;
end $$;
revoke all on function private.ww_action_targets() from public, anon, authenticated;
drop trigger if exists ww_actions_targets on private.ww_actions;
create trigger ww_actions_targets before insert or update on private.ww_actions
for each row execute function private.ww_action_targets();

-- 2. Who reads what once they are no longer at the table.
create or replace function private.game_is_seated(p_room uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.game_participants gp where gp.room_id = p_room and gp.user_id = p_uid and gp.left_at is null)
$$;
revoke all on function private.game_is_seated(uuid, uuid) from public, anon;
grant execute on function private.game_is_seated(uuid, uuid) to authenticated;

create or replace function private.game_message_readable(p_room uuid, p_author uuid, p_at timestamptz) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
      select 1 from public.game_participants gp
      where gp.room_id = p_room and gp.user_id = auth.uid() and (gp.left_at is null or p_at <= gp.left_at))
    and not exists (select 1 from private.game_kicks k where k.room_id = p_room and k.user_id = auth.uid())
    and (p_author is null or p_author = auth.uid() or not private.blocked_unchecked(auth.uid(), p_author))
$$;
revoke all on function private.game_message_readable(uuid, uuid, timestamptz) from public, anon;
grant execute on function private.game_message_readable(uuid, uuid, timestamptz) to authenticated;

drop policy if exists game_messages_read on public.game_messages;
create policy game_messages_read on public.game_messages for select to authenticated
  using (private.game_message_readable(room_id, user_id, created_at) and created_at <= now() and private.ww_channel_ok(room_id, channel));

/** A room is readable by its players (present or past, unless the host removed them), and a public room by anyone allowed in its space. */
create or replace function private.game_can_read(p_room uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.game_rooms r
    where r.id = p_room
      and ((private.game_is_player(r.id, auth.uid())
            and not exists (select 1 from private.game_kicks k where k.room_id = r.id and k.user_id = auth.uid()))
        or (r.visibility = 'public' and private.game_space_ok(r.space, auth.uid())))
  )
$$;
revoke all on function private.game_can_read(uuid) from public, anon;
grant execute on function private.game_can_read(uuid) to authenticated;

create or replace function public.game_room(p_room uuid) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  r public.game_rooms;
begin
  if me is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  select * into r from public.game_rooms where id = p_room;
  if not found or not private.game_can_read(p_room) then raise exception 'this game no longer exists' using errcode = 'P0002'; end if;
  return private.game_room_card(r, me) || jsonb_build_object(
    'space', r.space,
    'code', case when private.game_is_seated(r.id, me) then r.code end,
    'state', r.state,
    'deadline', r.turn_deadline,
    'now', now(),
    'winner_id', r.winner_id,
    'started_at', r.started_at,
    'finished_at', r.finished_at,
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', gp.user_id, 'seat', gp.seat, 'left', gp.left_at is not null, 'place', gp.place,
        'name', private.game_first_name(gp.user_id),
        'photo', (select p.photo_paths[1] from public.profiles p where p.id = gp.user_id and p.deleted_at is null),
        'blocked', me <> gp.user_id and private.blocked_unchecked(me, gp.user_id)
      ) order by gp.seat, gp.joined_at)
      from public.game_participants gp where gp.room_id = r.id
        and (gp.left_at is null or r.status <> 'waiting')
    ), '[]'::jsonb)
  );
end $$;
revoke all on function public.game_room(uuid) from public, anon;
grant execute on function public.game_room(uuid) to authenticated;

-- 5. Only a host still seated cuts the day short, and the phase is read under the game's lock.
create or replace function public.ww_skip_day(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  ph text;
begin
  select phase into ph from private.ww_games where room_id = p_room for update;
  if (select host_id from public.game_rooms where id = p_room) is distinct from me or not private.game_is_seated(p_room, me) then
    raise exception 'only the host can do this' using errcode = '42501';
  end if;
  if ph is distinct from 'day' then raise exception 'this game is not running' using errcode = '22023'; end if;
  perform private.ww_advance(p_room, true);
end $$;
revoke all on function public.ww_skip_day(uuid) from public, anon;
grant execute on function public.ww_skip_day(uuid) to authenticated;

-- 6. Leaving takes the Loup-Garou game's lock first, as playing does.
create or replace function public.game_leave(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  r public.game_rooms;
  idx integer;
  next_host uuid;
begin
  perform 1 from private.ww_games where room_id = p_room for update;
  select * into r from public.game_rooms where id = p_room for update;
  if not found or not exists (select 1 from public.game_participants gp where gp.room_id = p_room and gp.user_id = me and gp.left_at is null) then
    return;
  end if;
  update public.game_participants set left_at = now() where room_id = p_room and user_id = me;
  perform private.game_system(p_room, 'left', jsonb_build_object('user', me));
  if r.status = 'waiting' then
    select gp.user_id into next_host from public.game_participants gp where gp.room_id = p_room and gp.left_at is null order by gp.joined_at limit 1;
    if next_host is null then
      update public.game_rooms set status = 'abandoned', finished_at = now(), updated_at = now() where id = p_room;
    elsif r.host_id = me then
      update public.game_rooms set host_id = next_host, updated_at = now() where id = p_room;
    else
      update public.game_rooms set updated_at = now() where id = p_room;
    end if;
  elsif r.status = 'playing' and r.game = 'werewolf' then
    -- Leaving a running Loup-Garou game: out of the game (no card shown), lovers follow.
    select seat into idx from private.ww_players where room_id = p_room and user_id = me and alive;
    if idx is not null then
      perform private.ww_kill(p_room, array[idx], 'left', 'left');
      perform private.ww_log_add(p_room, 'all', 'left_game', jsonb_build_object('seat', idx));
      if not private.ww_check_victory(p_room) then perform private.ww_touch(p_room); end if;
    end if;
  elsif r.status = 'playing' and r.game = 'ludo' then
    select (i.idx - 1)::integer into idx from jsonb_array_elements_text(r.state -> 'players') with ordinality i(uid, idx) where i.uid::uuid = me;
    if idx is not null then perform private.ludo_drop(p_room, idx); end if;
  end if;
end $$;
revoke all on function public.game_leave(uuid) from public, anon;
grant execute on function public.game_leave(uuid) to authenticated;

-- 7. The Thief's two extra cards count only when the Thief is in the deck.
create or replace function private.ww_extra_cards(p_comp jsonb) returns integer
language sql immutable as $$ select case when coalesce((p_comp ->> 'thief')::integer, 0) > 0 then 2 else 0 end $$;
revoke all on function private.ww_extra_cards(jsonb) from public, anon, authenticated;

-- 1 and 3. The sweep, every minute.
create or replace function private.games_sweep() returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  r record;
  heir uuid;
begin
  for r in select id from public.game_rooms where status = 'playing' and turn_deadline < now() limit 200 loop
    perform private.game_advance(r.id);
  end loop;
  -- Loup-Garou: a game no member has touched for twenty minutes ends as a draw.
  for r in
    select w.room_id as id from private.ww_games w join public.game_rooms g on g.id = w.room_id
    where w.phase not in ('lobby', 'ended') and g.status = 'playing'
      and coalesce(w.last_human_at, w.started_at, g.started_at, g.updated_at) < now() - interval '20 minutes'
    limit 200 for update of w skip locked
  loop
    perform private.ww_log_add(r.id, 'all', 'idle_end', '{}'::jsonb);
    perform private.ww_finish(r.id, 'draw', '{}'::integer[]);
  end loop;
  -- Loup-Garou: phases whose time is up move on even when nobody has the game open (never in a closed room).
  for r in
    select w.room_id as id from private.ww_games w join public.game_rooms g on g.id = w.room_id
    where w.phase not in ('lobby', 'ended') and g.status = 'playing' and w.deadline < now() limit 200
  loop
    perform private.ww_advance(r.id);
  end loop;
  -- A waiting room whose host has been away two minutes passes to the member there longest who is present.
  for r in
    select g.id, g.host_id from public.game_rooms g
    where g.status = 'waiting' and g.kind = 'online' and g.created_at < now() - interval '2 minutes'
      and not exists (select 1 from public.game_presence p where p.user_id = g.host_id and p.room_id = g.id and p.seen_at > now() - interval '2 minutes')
    limit 200 for update of g skip locked
  loop
    select gp.user_id into heir from public.game_participants gp
      join public.game_presence p on p.user_id = gp.user_id and p.room_id = gp.room_id and p.seen_at > now() - interval '90 seconds'
      where gp.room_id = r.id and gp.left_at is null and gp.user_id <> r.host_id
      order by gp.joined_at limit 1;
    if heir is not null then
      update public.game_rooms set host_id = heir, updated_at = now() where id = r.id;
      perform private.game_system(r.id, 'host', jsonb_build_object('user', heir));
    end if;
  end loop;
  -- A waiting room left two hours without anyone, or a game without a move for an hour.
  update public.game_rooms set status = 'abandoned', finished_at = now(), turn_deadline = null, updated_at = now()
    where (status = 'waiting' and updated_at < now() - interval '2 hours')
       or (status = 'playing' and updated_at < now() - interval '1 hour');
  delete from public.game_presence where seen_at < now() - interval '1 day';
end $$;
revoke all on function private.games_sweep() from public, anon, authenticated;
