-- Push texts of the community notifications added on 2026-11-07
-- (migration 20261107200000_irly_community_push_texts). Notification rows
-- are built in memory only: nothing is inserted.
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL %', label; end if;
  raise notice 'ok  %', label;
end $$;

create or replace function pg_temp.n(k text, p jsonb) returns public.notifications language sql as $$
  select jsonb_populate_record(null::public.notifications, jsonb_build_object('kind', k, 'payload', p))
$$;

select pg_temp.check((select url from private.push_text(pg_temp.n('ACTIVITY_CREATED', '{"activity_id":"11111111-1111-1111-1111-111111111111","community":"Padel Dubai","title":"Padel Friday"}'), 'en')) = '/a/11111111-1111-1111-1111-111111111111', 'new community activity opens the activity');
select pg_temp.check((select title from private.push_text(pg_temp.n('ACTIVITY_CREATED', '{"community":"Padel Dubai","title":"Padel Friday"}'), 'en')) = 'Padel Dubai', 'new community activity: titled with the community');
select pg_temp.check((select body from private.push_text(pg_temp.n('ACTIVITY_CREATED', '{"community":"Padel Dubai","title":"Padel vendredi"}'), 'fr')) like '%propose : Padel vendredi', 'new community activity: French text');
select pg_temp.check((select body from private.push_text(pg_temp.n('COMMUNITY_ROLE', '{"community":"C","role":"co_admin","community_id":"22222222-2222-2222-2222-222222222222"}'), 'en')) like '%co-admin%', 'role: co-admin text');
select pg_temp.check((select url from private.push_text(pg_temp.n('COMMUNITY_ROLE', '{"community":"C","role":"moderator","community_id":"22222222-2222-2222-2222-222222222222"}'), 'fr')) = '/c/22222222-2222-2222-2222-222222222222', 'role: opens the community');
select pg_temp.check((select body from private.push_text(pg_temp.n('COMMUNITY_OWNERSHIP', '{"community":"C"}'), 'fr')) like '%propriétaire%', 'ownership: French text');
select pg_temp.check((select body from private.push_text(pg_temp.n('COMMUNITY_WARNING', '{"community":"C","reason":"spam"}'), 'en')) like '%: spam', 'warning: shows the reason');
select pg_temp.check((select body from private.push_text(pg_temp.n('COMMUNITY_RESTRICTION', '{"community":"C"}'), 'en')) like 'You cannot post%', 'restriction text');
select pg_temp.check((select url from private.push_text(pg_temp.n('COMMUNITY_BAN', '{"community":"C","community_id":"22222222-2222-2222-2222-222222222222"}'), 'en')) = '/notifications', 'ban: does not link into the community');
select pg_temp.check((select body from private.push_text(pg_temp.n('ACTIVITY_JOINED', '{}'), 'en')) = 'Someone joined your activity', 'existing kinds unchanged');
