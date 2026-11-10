-- IRLY Loup-Garou: the random Classic deck of 20261114000000_irly_werewolf_chaos (its drawing function is kept),
-- and « Play online » by mode. The mode named Chaos is, since 20261116000000, the book's Chaos (its own cards,
-- tested in werewolf_v3.test.sql): the secret-deck variant shipped under that name is gone.
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL chaos: %', label; end if;
  raise notice 'ok  %', label;
end $$;
create or replace function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;

-- ───────── Decks ─────────
do $$
declare n integer; k integer; c jsonb; w integer; total integer; seen jsonb := '{}'::jsonb; distinct_decks integer;
begin
  for n in 6..20 loop
    for k in 1..20 loop
      c := private.ww_chaos_composition(n);
      w := (c ->> 'werewolf')::int;
      select sum(value::text::int) into total from jsonb_each(c);
      perform pg_temp.check(total = n and w >= 1 and w * 2 < n and not c ? 'thief'
        and not exists (select 1 from jsonb_each(c) e where e.key not in ('werewolf', 'villager') and e.value::text::int <> 1)
        and not exists (select 1 from jsonb_object_keys(c) x where not (x = any (private.ww_roles()))), format('a valid Chaos deck for %s players', n));
      seen := seen || jsonb_build_object(c::text, 1);
    end loop;
  end loop;
  select count(*) into distinct_decks from jsonb_object_keys(seen);
  perform pg_temp.check(distinct_decks > 100, format('Chaos decks vary (%s different decks in 300 draws)', distinct_decks));
  perform pg_temp.check((private.ww_default_for('classic', 8) ->> 'werewolf')::int = 2 and private.ww_default_for('classic', 8) = private.ww_default_composition(8),
    'the Classic deck is unchanged');
end $$;

-- ───────── Play in a mode: joins a table of that mode, never another ─────────
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); ra uuid; rb uuid; rc uuid;
begin
  insert into auth.users (id) values (a), (b);
  insert into public.profiles (id, first_name, birthdate, gender, city_id, onboarded_at) values
    (a, 'Ana', '1995-01-01', 'woman', 'dubai', now()), (b, 'Bob', '1994-01-01', 'man', 'dubai', now());
  perform set_config('request.jwt.claim.sub', a::text, true);
  ra := public.ww_quickplay('mixte', 'dubai');
  perform pg_temp.check((select mode = 'dubai' from private.ww_games where room_id = ra), 'Play in Dubaï opens a Dubaï table');
  perform set_config('request.jwt.claim.sub', b::text, true);
  rb := public.ww_quickplay('mixte', 'chaos');
  perform pg_temp.check(rb <> ra and (select mode = 'chaos' from private.ww_games where room_id = rb), 'Play in Chaos does not join the Dubaï table');
  rc := public.ww_quickplay('mixte', 'dubai');
  perform pg_temp.check(rc = ra, 'Play in Dubaï joins the open Dubaï table');
end $$;
