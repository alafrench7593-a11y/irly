-- Speed (final performance audit). Nothing anyone sees changes: the same
-- rows, the same rules, measured faster on a database seeded with realistic
-- volumes (5k members, 1.1k communities, 5k activities, 50k messages).
-- Additive only. Tested by supabase/tests/perf_final.test.sql. Section 3 is a
-- fix found by the live E2E on the way (members could not delete their files).
--
-- 1. Search and the map no longer check the read rule of every past activity.
--    Their « not over yet » test, coalesce(ends_at, starts_at + 2 h), is not
--    leakproof, so Postgres ran the activities read rule (participation,
--    blocks, friends, communities: ~16 µs a row) on every activity ever made
--    before testing it. An equivalent bound on the plain columns (starts_at
--    within 2 h, or ends_at to come) is leakproof: it is checked first, by an
--    index, and the rule only runs on activities that can still be shown. The
--    original test stays, so the result is exactly the same.
--    Measured (EXPLAIN ANALYZE, 5k activities, half of them past):
--    search_all 90 ms → 44 ms, map_activities (30 days) 64 ms → 30 ms; the
--    gain grows with every activity that ends, the old cost never stopped growing.
--
--    The functions are rewritten from their CURRENT definition (whatever the
--    latest migration made them), adding only the bound: a change another
--    migration made to them is kept, never replaced by an older copy here.
--
-- 2. The read rule of community member lists asked « is this member a woman
--    with IRLY Girl access? » once for EVERY row read; the answer depends on
--    the reader only. Wrapped in a scalar sub-select (as the IRLY Girl rules
--    of chats, activities and notifications already are), Postgres asks once
--    per query. Same predicate (private.is_girl_eligible), same answer.
--    Measured: a full read of community_members 25 ms → 14 ms. Rewritten from
--    the current rule as well (only that call changes). The communities rule
--    itself stays as it is: a sub-select there makes Postgres expand the
--    owners' update rule (members → communities) and refuse it as recursive.

-- ───────── 1. The bound, and the index that serves it ─────────
create index if not exists activities_live_end_idx on public.activities (ends_at)
  where cancelled_at is null and ends_at is not null;

do $$
declare
  fn record;
  def text;
  old_test text;
  bound text;
begin
  for fn in
    select * from (values
      ('public.search_all(text,text,integer)',
       $t$coalesce(a.ends_at, a.starts_at + interval '2 hours') >= now()$t$,
       $b$ and (a.starts_at >= now() - interval '2 hours' or a.ends_at >= now())$b$),
      ('public.search_all_girl(text,text,integer)',
       $t$coalesce(a.ends_at, a.starts_at + interval '2 hours') >= now()$t$,
       $b$ and (a.starts_at >= now() - interval '2 hours' or a.ends_at >= now())$b$),
      ('public.map_activities(text,timestamp with time zone,timestamp with time zone,text,uuid,double precision,double precision,double precision,integer,boolean)',
       $t$coalesce(a.ends_at, a.starts_at + interval '2 hours') > greatest(now(), coalesce(p_from, now()))$t$,
       $b$ and (a.starts_at > greatest(now(), coalesce(p_from, now())) - interval '2 hours' or a.ends_at > greatest(now(), coalesce(p_from, now())))$b$)
    ) v (sig, test, add)
  loop
    if to_regprocedure(fn.sig) is null then
      raise notice 'irly_perf_final: % not found, left as is', fn.sig;
      continue;
    end if;
    def := pg_get_functiondef(to_regprocedure(fn.sig));
    old_test := fn.test;
    bound := fn.add;
    -- Already bounded (this migration ran), or the test is no longer there (rewritten since): left as is.
    if position(btrim(bound) in def) > 0 or position(old_test in def) = 0 then
      raise notice 'irly_perf_final: % left as is', fn.sig;
      continue;
    end if;
    execute replace(def, old_test, old_test || bound);
  end loop;
end $$;

-- ───────── 2. IRLY Girl access asked once per query in the members' read rule ─────────
do $$
declare
  p record;
  expr text;
begin
  for p in
    select pol.polname, pol.polrelid::regclass as tbl, pg_get_expr(pol.polqual, pol.polrelid) as qual
    from pg_policy pol
    where pol.polrelid = 'public.community_members'::regclass and pol.polname = 'community_members_read'
  loop
    -- Only a rule that calls it per row, and nothing else changes in it.
    if p.qual is null or p.qual !~ 'private\.is_girl_eligible\(\)' or p.qual ~ 'SELECT private\.is_girl_eligible\(\)' then
      continue;
    end if;
    expr := replace(p.qual, 'private.is_girl_eligible()', '(select private.is_girl_eligible())');
    execute format('alter policy %I on %s using (%s)', p.polname, p.tbl, expr);
  end loop;
end $$;

-- ───────── 3. Members can delete their own files again ─────────
-- Found by the live E2E (« Alice deletes the video post »: permission denied
-- for table app_photo_overrides). Storage checks EVERY delete rule of
-- storage.objects for a delete, and app_photos_delete (20261027700000) read
-- public.app_photo_overrides as the caller, who may not read that table: every
-- member's file removal (a Live, a post's photos, an old profile photo)
-- failed. The same rule, with that check done by a function that may read it.
create or replace function private.app_photo_kept(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_photo_overrides o where o.storage_path = p_name)
$$;
revoke all on function private.app_photo_kept(text) from public, anon;
grant execute on function private.app_photo_kept(text) to authenticated;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute 'drop policy if exists app_photos_delete on storage.objects';
    execute $p$
      create policy app_photos_delete on storage.objects for delete to authenticated
      using (bucket_id = 'app-photos' and (storage.foldername(name))[1] = auth.uid()::text and private.is_content_staff(auth.uid())
             and not private.app_photo_kept(name))
    $p$;
  end if;
end $$;
