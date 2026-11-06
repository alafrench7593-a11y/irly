-- IRLY's official communities in Dubai only, the owner's list of 2026-11-06
-- (migration 20261108200000_irly_official_communities_dubai).
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL %', label; end if;
  raise notice 'ok  %', label;
end $$;

create or replace function pg_temp.listed() returns text[] language sql as $$
  select coalesce(array_agg(c.topic order by c.topic), '{}') from public.communities c
  where c.official and c.parent_id is null and c.deleted_at is null and c.retired_at is null
$$;

select pg_temp.check(
  (select array_agg(topic order by topic) from public.community_topics where active)
    = array['expats', 'francais', 'girl_activity', 'girl_francaise', 'girl_network', 'girl_newcomers', 'girl_padel', 'girl_running', 'girl_sport', 'girl_trip', 'lifestyle', 'mom_activity', 'mom_expat', 'mom_francaise', 'mom_network', 'mom_padel', 'mom_running', 'mom_sport', 'mom_trip', 'network', 'padel', 'running', 'sport', 'trip'],
  'active topics are exactly the owner''s list: IRLY, IRLY Girl and IRLY Mom Community (20261109000000)');
select pg_temp.check(not exists (select 1 from public.community_topics where active and cities <> '{dubai}'),
  'every active topic runs in Dubai only');
select pg_temp.check(pg_temp.listed()
    = array['expats', 'francais', 'girl_activity', 'girl_francaise', 'girl_network', 'girl_newcomers', 'girl_padel', 'girl_running', 'girl_sport', 'girl_trip', 'lifestyle', 'mom_activity', 'mom_expat', 'mom_francaise', 'mom_network', 'mom_padel', 'mom_running', 'mom_sport', 'mom_trip', 'network', 'padel', 'running', 'sport', 'trip'],
  'listed official communities: one per topic of the list');
select pg_temp.check(not exists (select 1 from public.communities c
    where c.official and c.parent_id is null and c.deleted_at is null and c.retired_at is null and c.city_id <> 'dubai'),
  'no official community is listed outside Dubai');
select pg_temp.check((select name from public.communities where official and topic = 'running' and city_id = 'dubai' and parent_id is null) = 'IRLY Running Club',
  'IRLY Running is renamed IRLY Running Club');
select pg_temp.check((select name from public.communities where official and topic = 'padel' and city_id = 'dubai' and parent_id is null and retired_at is null) = 'IRLY Padel Club',
  'IRLY Padel Club exists in Dubai');
select pg_temp.check((select not girl_only from public.communities where official and topic = 'francais' and city_id = 'dubai' and parent_id is null and retired_at is null),
  'Les Français à Dubaï is open to everyone');
select pg_temp.check((select girl_only from public.communities where official and topic = 'girls' and city_id = 'dubai' and parent_id is null),
  'IRLY Girl stays women only (retired since 20261109000000)');
select pg_temp.check(exists (select 1 from public.conversations v join public.communities c on c.id = v.community_id
    where c.official and c.topic = 'padel' and c.city_id = 'dubai'),
  'IRLY Padel Club has its chat');

-- Retired, never deleted.
select pg_temp.check(not exists (select 1 from public.communities where official and deleted_at is not null and topic in ('girl_trip', 'girl_newcomers', 'girl_activity', 'girl_sport', 'girl_network', 'moms')),
  'retired communities are not deleted');
select pg_temp.check(not exists (select 1 from public.communities where official and parent_id is null and retired_at is null and topic in ('girls', 'moms')),
  'IRLY Girl (general) and IRLY Maman are retired (20261109000000; the Girl four came back)');

-- Running again changes nothing.
select pg_temp.check(private.retire_official_communities() = 0, 'retire again: nothing more');
select pg_temp.check(private.ensure_official_communities() = 0, 'ensure again: nothing new');
select pg_temp.check(pg_temp.listed()
    = array['expats', 'francais', 'girl_activity', 'girl_francaise', 'girl_network', 'girl_newcomers', 'girl_padel', 'girl_running', 'girl_sport', 'girl_trip', 'lifestyle', 'mom_activity', 'mom_expat', 'mom_francaise', 'mom_network', 'mom_padel', 'mom_running', 'mom_sport', 'mom_trip', 'network', 'padel', 'running', 'sport', 'trip'],
  'the list is stable');

-- A member's community is never touched.
begin;
insert into public.communities (city_id, name, tagline, official, created_by)
values ('sharjah', 'Sharjah walkers', 'Evening walks', false, null);
select private.retire_official_communities();
select pg_temp.check((select retired_at is null from public.communities where name = 'Sharjah walkers'), 'a member''s community outside Dubai stays listed');
rollback;
