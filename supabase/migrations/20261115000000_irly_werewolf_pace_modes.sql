-- IRLY Loup-Garou: a calmer pace against the AI players, and two more modes.
--
-- Pace (members' feedback: « the AI goes too fast, no time to vote »):
--   - training timers are longer (night 75 s, witch 45 s, day 180 s, vote 90 s, second round 60 s);
--   - in training, a phase never ends less than 5 s after it began, even when everyone has acted:
--     the AI players answer at once, and without this a whole night, or the whole end of the game
--     once the member is out, went by in a blink.
-- Modes (same engine and rules as Classic, only the deck changes; docs/LOUP-GAROU.md):
--   - nightmare: one more werewolf, no Seer;
--   - powers: every seat a special card while there are some (no plain villager first).

create or replace function private.ww_duration(p_kind text, p_phase text) returns integer
language sql immutable as $$
  select case p_kind
    when 'irl' then case p_phase when 'night' then 60 when 'witch' then 30 when 'day' then 300 when 'vote' then 60 else 45 end
    when 'training' then case p_phase when 'night' then 75 when 'witch' then 45 when 'day' then 180 when 'vote' then 90 else 60 end
    else case p_phase when 'night' then 45 when 'witch' then 25 when 'day' then 150 when 'vote' then 60 else 45 end
  end
$$;
revoke all on function private.ww_duration(text, text) from public, anon, authenticated;

/** Seconds a phase lasts at least, even when everyone has acted (training only). */
create or replace function private.ww_min_seconds(p_kind text) returns integer
language sql immutable as $$
  select case when p_kind = 'training' then 5 else 0 end
$$;
revoke all on function private.ww_min_seconds(text) from public, anon, authenticated;

create or replace function private.ww_advance(p_room uuid, p_force boolean default false) returns boolean
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  moved boolean := false;
begin
  for i in 1..40 loop
    select * into g from private.ww_games where room_id = p_room for update skip locked;
    if not found or g.phase in ('lobby', 'ended') then exit; end if;
    if not (p_force or g.deadline <= now()
        or (private.ww_phase_done(p_room)
          and clock_timestamp() >= g.deadline - make_interval(secs => private.ww_duration(g.kind, g.phase) - private.ww_min_seconds(g.kind)))) then
      exit;
    end if;
    p_force := false;
    if g.phase = 'night' and g.mode = 'dubai' then perform private.ww_resolve_night_dubai(p_room);
    elsif g.phase = 'night' then perform private.ww_resolve_night(p_room);
    elsif g.phase = 'witch' then perform private.ww_resolve_witch(p_room);
    elsif g.phase = 'day' then perform private.ww_enter(p_room, 'vote');
    else perform private.ww_resolve_vote(p_room);
    end if;
    moved := true;
  end loop;
  return moved;
end $$;
revoke all on function private.ww_advance(uuid, boolean) from public, anon, authenticated;

-- ───────── Modes ─────────
create or replace function private.ww_modes() returns text[]
language sql immutable as $$
  select array['classic', 'dubai', 'chaos', 'nightmare', 'powers']
$$;
revoke all on function private.ww_modes() from public, anon, authenticated;

alter table private.ww_games drop constraint if exists ww_games_mode_check;
alter table private.ww_games add constraint ww_games_mode_check check (mode in ('classic', 'dubai', 'chaos', 'nightmare', 'powers'));

/** Nightmare: the Classic deck with one more werewolf (while they stay fewer than half) and no Seer. */
create or replace function private.ww_nightmare_composition(p_size integer) returns jsonb
language plpgsql immutable as $$
declare
  c jsonb := private.ww_default_composition(p_size) - 'seer' - 'villager';
  wolves integer := (c ->> 'werewolf')::integer;
  others integer;
begin
  if (wolves + 1) * 2 < p_size then wolves := wolves + 1; end if;
  c := c || jsonb_build_object('werewolf', wolves);
  select coalesce(sum(value::text::integer), 0) into others from jsonb_each(c);
  c := c || jsonb_build_object('villager', p_size + case when c ? 'thief' then 2 else 0 end - others);
  return private.ww_check_composition(p_size, c);
end $$;
revoke all on function private.ww_nightmare_composition(integer) from public, anon, authenticated;

/** All powers: the usual werewolves, then one special card per seat while there are some; villagers only after. */
create or replace function private.ww_powers_composition(p_size integer) returns jsonb
language plpgsql immutable as $$
declare
  wolves integer := private.ww_wolves_for(p_size);
  specials constant text[] := array['seer', 'witch', 'hunter', 'salvateur', 'cupid', 'little_girl', 'elder'];
  n integer := least(array_length(specials, 1), p_size - wolves);
  c jsonb := jsonb_build_object('werewolf', wolves);
begin
  for i in 1 .. n loop
    c := c || jsonb_build_object(specials[i], 1);
  end loop;
  if p_size - wolves - n > 0 then c := c || jsonb_build_object('villager', p_size - wolves - n); end if;
  return private.ww_check_composition(p_size, c);
end $$;
revoke all on function private.ww_powers_composition(integer) from public, anon, authenticated;

create or replace function private.ww_default_for(p_mode text, p_size integer) returns jsonb
language sql volatile as $$
  select case p_mode
    when 'dubai' then private.ww_dubai_composition(p_size)
    when 'chaos' then private.ww_chaos_composition(p_size)
    when 'nightmare' then private.ww_nightmare_composition(p_size)
    when 'powers' then private.ww_powers_composition(p_size)
    else private.ww_default_composition(p_size) end
$$;

-- The three public functions that take a mode now accept every mode of private.ww_modes()
-- (their bodies are otherwise those of 20261114000000_irly_werewolf_chaos, kept as deployed).
do $$
declare
  f regprocedure;
  def text;
  old constant text := 'p_mode not in (''classic'', ''dubai'', ''chaos'')';
begin
  foreach f in array array[
    'public.ww_create(text, text, integer, text, jsonb, text, text, text)'::regprocedure,
    'public.ww_training(text, integer, text, text, text)'::regprocedure,
    'public.ww_quickplay(text, text)'::regprocedure]
  loop
    def := pg_get_functiondef(f);
    if position(old in def) = 0 then
      if position('p_mode = any (private.ww_modes())' in def) > 0 then continue; end if;
      raise exception 'ww modes: % does not have the expected mode check', f;
    end if;
    execute replace(def, old, 'not (p_mode = any (private.ww_modes()))');
  end loop;
end $$;
