-- IRLY Loup-Garou, mode Chaos: the Classic cards, but the deck is drawn at random by the server for
-- each game and stays secret until the end (nobody, the host included, knows which powers are in play).
-- Same engine and rules as Classic (20261112000000_irly_werewolf, 20261113000000_irly_werewolf_dubai):
-- only the deck changes. Rules: docs/LOUP-GAROU.md, section « Mode Chaos ».

alter table private.ww_games drop constraint if exists ww_games_mode_check;
alter table private.ww_games add constraint ww_games_mode_check check (mode in ('classic', 'dubai', 'chaos'));

create or replace function private.ww_mode_roles(p_mode text) returns text[]
language sql immutable as $$
  select case when p_mode = 'dubai' then private.ww_dubai_roles() else private.ww_roles() end
$$;

/**
 * A random Classic deck for p_size players: the usual number of werewolves give or take one (always
 * at least one and fewer than half), one to seven distinct special cards (never the Voleur, whose
 * two extra cards would reveal the deck), villagers for the rest. Checked like a host's deck.
 */
create or replace function private.ww_chaos_composition(p_size integer) returns jsonb
language plpgsql volatile as $$
declare
  wolves integer := private.ww_wolves_for(p_size) + (floor(random() * 3)::integer - 1);
  pool text[];
  specials integer;
  c jsonb;
begin
  wolves := greatest(1, least(wolves, (p_size - 1) / 2));
  select array_agg(r order by random()) into pool from unnest(array['seer', 'witch', 'hunter', 'salvateur', 'cupid', 'little_girl', 'elder']) r;
  specials := 1 + floor(random() * least(7, p_size - wolves - 1))::integer;
  c := jsonb_build_object('werewolf', wolves);
  for i in 1 .. specials loop
    c := c || jsonb_build_object(pool[i], 1);
  end loop;
  if p_size - wolves - specials > 0 then c := c || jsonb_build_object('villager', p_size - wolves - specials); end if;
  return private.ww_check_composition(p_size, c);
end $$;
revoke all on function private.ww_chaos_composition(integer) from public, anon, authenticated;

-- Volatile now: the Chaos deck is drawn anew each time a game starts.
create or replace function private.ww_default_for(p_mode text, p_size integer) returns jsonb
language sql volatile as $$
  select case when p_mode = 'dubai' then private.ww_dubai_composition(p_size)
    when p_mode = 'chaos' then private.ww_chaos_composition(p_size)
    else private.ww_default_composition(p_size) end
$$;

-- A host cannot choose a Chaos deck: it is the server's secret.
create or replace function private.ww_check_for(p_mode text, p_size integer, p_comp jsonb) returns jsonb
language plpgsql volatile as $$
begin
  if p_mode = 'chaos' then
    if p_comp is not null then raise exception 'Chaos: the deck is drawn in secret' using errcode = '22023'; end if;
    return private.ww_chaos_composition(p_size);
  end if;
  return case when p_mode = 'dubai' then private.ww_dubai_check(p_size, p_comp) else private.ww_check_composition(p_size, p_comp) end;
end $$;

/** A player's view, with the Chaos deck hidden until the game is over. */
create or replace function private.ww_hide_chaos(p_room uuid, p_view jsonb) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select case
    when (select mode from private.ww_games where room_id = p_room) is distinct from 'chaos' or p_view ->> 'phase' = 'ended' then p_view
    else (p_view - 'composition') || jsonb_build_object('log', coalesce((
      select jsonb_agg(case when e ->> 'kind' = 'start' then jsonb_set(e, '{data}', coalesce(e -> 'data', '{}'::jsonb) - 'composition') else e end order by o)
      from jsonb_array_elements(p_view -> 'log') with ordinality as x (e, o)), '[]'::jsonb))
  end
$$;
revoke all on function private.ww_hide_chaos(uuid, jsonb) from public, anon, authenticated;

drop function if exists public.ww_create(text, text, integer, text, jsonb, text, text, text);
create or replace function public.ww_create(p_space text, p_visibility text default 'public', p_size integer default 8,
  p_kind text default 'online', p_composition jsonb default null, p_title text default null, p_lang text default 'fr',
  p_mode text default 'classic') returns jsonb
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  sp text := private.game_scope(p_space);
  rid uuid;
  c text;
begin
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  if p_kind not in ('online', 'irl') then raise exception 'online or in person' using errcode = '22023'; end if;
  if p_visibility not in ('public', 'private') then raise exception 'public or private' using errcode = '22023'; end if;
  if p_mode not in ('classic', 'dubai', 'chaos') then raise exception 'this mode is not available yet' using errcode = '22023'; end if;
  if p_size is null or p_size not between 6 and 20 then raise exception 'Loup-Garou: 6 to 20 players' using errcode = '22023'; end if;
  if p_lang not in ('en', 'fr') then raise exception 'language: en or fr' using errcode = '22023'; end if;
  if (select count(*) from public.game_rooms r join public.game_participants gp on gp.room_id = r.id and gp.user_id = me and gp.left_at is null
      where r.status in ('waiting', 'playing')) >= 3 then
    raise exception 'you are already in three games' using errcode = '22023';
  end if;
  if p_composition is not null then perform private.ww_check_for(p_mode, p_size, p_composition); end if;
  c := case when p_visibility = 'private' or p_kind = 'irl' then private.game_new_code() end;
  insert into public.game_rooms (game, space, host_id, title, visibility, code, lang, max_players, kind)
    values ('werewolf', sp, me, nullif(btrim(coalesce(p_title, '')), ''), case when p_kind = 'irl' then 'private' else p_visibility end, c, p_lang, p_size, p_kind)
    returning id into rid;
  insert into public.game_participants (room_id, user_id, seat) values (rid, me, 0);
  insert into private.ww_games (room_id, kind, size, composition, mode) values (rid, p_kind, p_size, p_composition, p_mode);
  return jsonb_build_object('id', rid, 'code', c);
end $$;
revoke all on function public.ww_create(text, text, integer, text, jsonb, text, text, text) from public, anon;
grant execute on function public.ww_create(text, text, integer, text, jsonb, text, text, text) to authenticated;

drop function if exists public.ww_training(text, integer, text, text, text);
create or replace function public.ww_training(p_space text, p_size integer default 8, p_role text default null,
  p_difficulty text default 'intermediate', p_mode text default 'classic') returns uuid
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  sp text := private.game_scope(p_space);
  rid uuid;
  comp jsonb;
  plain text;
begin
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  if p_mode not in ('classic', 'dubai', 'chaos') then raise exception 'this mode is not available yet' using errcode = '22023'; end if;
  if p_size is null or p_size not between 6 and 20 then raise exception 'Loup-Garou: 6 to 20 players' using errcode = '22023'; end if;
  if p_difficulty not in ('beginner', 'intermediate', 'expert') then raise exception 'difficulty: beginner, intermediate or expert' using errcode = '22023'; end if;
  comp := private.ww_default_for(p_mode, p_size);
  if p_role is not null then
    if not (p_role = any (private.ww_mode_roles(p_mode))) then raise exception 'composition: unknown card' using errcode = '22023'; end if;
    -- A role not in the default deck takes a plain card's place (villager, expat; an Escroc's for an Escrocs' card).
    if not comp ? p_role then
      plain := case when p_mode = 'dubai' then case when private.ww_camp(p_role) = 'wolves' then 'escroc' else 'expat' end
        else 'villager' end;
      if coalesce((comp ->> plain)::integer, 0) < 1 or (plain = 'escroc' and (comp ->> 'escroc')::integer < 1) then
        raise exception 'composition: that role cannot be added at this size' using errcode = '22023';
      end if;
      comp := comp || jsonb_build_object(p_role, 1, plain, (comp ->> plain)::integer - 1 + case when p_role = 'thief' then 2 else 0 end);
      if (comp ->> plain)::integer = 0 then comp := comp - plain; end if;
    end if;
    -- Training lets a member try any card: the size caps are not applied to her own choice.
    if p_mode <> 'dubai' then perform private.ww_check_composition(p_size, comp); end if;
  end if;
  update public.game_rooms r set status = 'abandoned', finished_at = now(), updated_at = now()
    where r.kind = 'training' and r.host_id = me and r.status in ('waiting', 'playing');
  insert into public.game_rooms (game, space, host_id, title, visibility, code, lang, max_players, kind, status)
    values ('werewolf', sp, me, null, 'private', null, 'fr', p_size, 'training', 'waiting') returning id into rid;
  insert into public.game_participants (room_id, user_id, seat) values (rid, me, 0);
  insert into private.ww_games (room_id, kind, size, composition, difficulty, human_role, mode) values (rid, 'training', p_size, comp, p_difficulty, p_role, p_mode);
  perform private.ww_start(rid);
  return rid;
end $$;
revoke all on function public.ww_training(text, integer, text, text, text) from public, anon;
grant execute on function public.ww_training(text, integer, text, text, text) to authenticated;

create or replace function public.ww_view(p_room uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  seat_ integer;
  g private.ww_games;
  fits boolean;
begin
  if me is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  select * into g from private.ww_games where room_id = p_room;
  if not found or not private.game_can_read(p_room) then raise exception 'this game no longer exists' using errcode = 'P0002'; end if;
  perform private.ww_advance(p_room);
  select * into g from private.ww_games where room_id = p_room;
  if g.phase = 'lobby' then
    seat_ := (select count(*) from public.game_participants gp where gp.room_id = p_room and gp.left_at is null);
    -- Chaos: the deck is drawn at the start and never shown before the end.
    if g.mode = 'chaos' then
      return jsonb_build_object('phase', 'lobby', 'kind', g.kind, 'size', g.size, 'mode', g.mode, 'ranked', g.ranked, 'present', seat_,
        'custom', false, 'composition', null);
    end if;
    fits := g.composition is not null and private.ww_card_count(g.composition) = greatest(seat_, 6) + private.ww_extra_cards(g.composition);
    return jsonb_build_object('phase', 'lobby', 'kind', g.kind, 'size', g.size, 'mode', g.mode, 'ranked', g.ranked, 'present', seat_,
      'custom', fits,
      'composition', case when fits then g.composition else private.ww_default_for(g.mode, greatest(seat_, 6)) end);
  end if;
  seat_ := private.ww_my_seat(p_room);
  if seat_ is null then raise exception 'you are not playing in this game' using errcode = '42501'; end if;
  return private.ww_hide_chaos(p_room, private.ww_view_for(p_room, seat_));
end $$;
revoke all on function public.ww_view(uuid) from public, anon;
grant execute on function public.ww_view(uuid) to authenticated;

/**
 * « Play » in one mode: the oldest public online table of that mode with a free seat, else a new
 * public table of that mode (8 seats). Same checks as game_quickplay (space, kicks, blocks).
 */
create or replace function public.ww_quickplay(p_space text, p_mode text default 'classic') returns uuid
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  sp text := private.game_scope(p_space);
  r record;
begin
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  if p_mode not in ('classic', 'dubai', 'chaos') then raise exception 'this mode is not available yet' using errcode = '22023'; end if;
  for r in
    select g.id from public.game_rooms g join private.ww_games w on w.room_id = g.id
    where g.game = 'werewolf' and w.mode = p_mode and g.space = sp and g.visibility = 'public' and g.status = 'waiting' and g.kind = 'online'
      and (select count(*) from public.game_participants gp where gp.room_id = g.id and gp.left_at is null) < g.max_players
      and not exists (select 1 from private.game_kicks k where k.room_id = g.id and k.user_id = me)
      and not exists (select 1 from public.game_participants gp where gp.room_id = g.id and gp.left_at is null and private.blocked_unchecked(me, gp.user_id))
    order by g.created_at
    limit 5
  loop
    begin
      return private.game_enter(r.id, me, false);
    exception when others then
      -- Taken meanwhile: try the next one.
    end;
  end loop;
  return (public.ww_create(p_space, 'public', 8, 'online', null, null, 'fr', p_mode) ->> 'id')::uuid;
end $$;
revoke all on function public.ww_quickplay(text, text) from public, anon;
grant execute on function public.ww_quickplay(text, text) to authenticated;
