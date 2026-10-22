-- The storage read rule of irl-media finds the Live showing a file by an
-- index (20261029400000), not by reading every Live ever posted.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
\set ON_ERROR_STOP 1

do $$
declare
  plan text := '';
  line text;
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'irl_posts_media_path_idx') then
    raise exception 'FAIL irl_posts_media_path_idx is missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'irl_posts_thumb_path_idx') then
    raise exception 'FAIL irl_posts_thumb_path_idx is missing';
  end if;
  -- The rule's own lookup can use them (sequential scans off: only an index plan remains possible).
  set local enable_seqscan = off;
  for line in execute 'explain select 1 from public.irl_posts p where p.media_path = ''u/x.jpg'' or p.thumb_path = ''u/x.jpg''' loop
    plan := plan || line || E'\n';
  end loop;
  if plan not ilike '%irl_posts_%_path_idx%' then
    raise exception 'FAIL the media lookup does not use the path indexes: %', plan;
  end if;
  raise notice 'ok irl-media lookup by index';
end $$;
