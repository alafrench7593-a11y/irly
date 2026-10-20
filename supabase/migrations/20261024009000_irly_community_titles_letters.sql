-- IRLY community titles, second pass: run stamps made only of letters
-- ("Book & Matcha mvdxpmvc").
--
-- 20261024007100 taught the server that a word is a code when it reads as
-- Date.now() in base 36 with letters and digits mixed ("mvgq82y1"). A stamp
-- can come out with no digit, or one, at all ("mvdxpmvc", 18 Oct 2026, from
-- scripts/e2e-girl.mjs `Book & Matcha ${run}`): it was kept as a word and
-- still shows in IRLY Girl's communities. Same rule as
-- src/features/community/name.ts: eight lowercase letters or digits starting
-- with l, m or n (every Date.now() in base 36 from 2021 to 2038) with at most
-- one vowel; a real word that long always has two or more ("marathon",
-- "networks", "midnight").
--
-- A stamp can also have two vowels or more ("mncukilg", about one in six):
-- no word rule can tell it from a word, so the names the end-to-end scripts
-- make ("Girls Padel", "Book & Matcha", "Sync club", "Photo club", "E2E
-- Padel", then the stamp) are recognised as such, on the rows below only.
--
-- Then the fix of 20261024007100 runs again on the rows it covers (left by
-- IRLY or a deleted account) and on the rows a test account
-- (e2e-…@irly.test, the end-to-end scripts' accounts) created and still
-- owns. Nothing is deleted: a community nobody is in is retired with
-- deleted_at (row, posts and chat history kept), one with members is renamed
-- in place. A name a real member chose is never touched.

create or replace function private.community_word_is_technical(w text) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select case
    when w is null or w = '' then false
    when w ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then true
    when w ~ '^#[0-9]{3,}$' or w ~ '^[0-9]{5,}$' then true
    when w !~ '^[A-Za-z0-9_-]+$' then false
    when w ~ '[0-9]{5,}' and w ~ '[A-Za-z]' then true
    when w ~ '^[A-Za-z]+(19|20)[0-9]{2}$' then false
    when w ~ '^[l-n][a-z0-9]{7}$' and regexp_count(w, '[0-9]') >= 2
         and regexp_count(w, '[a-z](?=[0-9])|[0-9](?=[a-z])') >= 2 then true
    when w ~ '^[l-n][a-z0-9]{7}$' and regexp_count(w, '[aeiou]') <= 1 then true
    when w ~ '^[0-9a-f]{8,}$' and regexp_count(w, '[0-9]') >= 2 and regexp_count(w, '[a-f]') >= 2 then true
    else false
  end
$$;
revoke all on function private.community_word_is_technical(text) from public, anon, authenticated;

-- A title the end-to-end scripts make: one of their names, then the run
-- stamp (any eight base-36 characters starting with l, m or n, so every
-- stamp is caught, vowels or not: "Sync club mncukilg"), maybe then "Bali".
create or replace function private.community_name_from_e2e(p_name text) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select coalesce(p_name, '') ~ '^(Girls Padel|Book & Matcha|Sync club|Photo club|E2E Padel) [l-n][a-z0-9]{7}( Bali)?$'
$$;
revoke all on function private.community_name_from_e2e(text) from public, anon, authenticated;

-- A community created by one of the end-to-end scripts' accounts.
create or replace function private.community_from_test_account(p_created_by uuid) returns boolean
language plpgsql stable security definer set search_path = public, auth as $$
begin
  return p_created_by is not null and exists (
    select 1 from auth.users u where u.id = p_created_by and u.email like 'e2e-%@irly.test'
  );
exception when undefined_column then
  -- auth.users without an email column (the local test shim): no test accounts to recognise.
  return false;
end $$;
revoke all on function private.community_from_test_account(uuid) from public, anon, authenticated;

-- 20261024007100's fix, on the same rows plus the test accounts' communities. Safe to run again.
create or replace function private.irly_community_titles() returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  r record;
  base text;
  with_city text;
  candidate text;
  k integer;
  n integer := 0;
begin
  for r in
    select c.* from public.communities c
    where c.deleted_at is null
      and (c.created_by is null or c.official or private.community_from_test_account(c.created_by))
      and (private.community_name_is_technical(c.name) or private.community_name_from_e2e(c.name))
    order by c.created_at, c.id
  loop
    if not exists (select 1 from public.community_members m where m.community_id = r.id and not private.community_from_test_account(m.user_id)) then
      -- A test leftover no real member is in: gone from every list, history kept (as delete_community).
      update public.communities set deleted_at = now() where (id = r.id or parent_id = r.id) and deleted_at is null;
      delete from public.conversation_members cm using public.conversations v, public.communities x
      where v.community_id = x.id and (x.id = r.id or x.parent_id = r.id) and cm.conversation_id = v.id;
    else
      base := case when private.community_name_from_e2e(r.name) then regexp_replace(r.name, ' [l-n][a-z0-9]{7}', '')
                   else coalesce(private.community_clean_name(r.name), private.community_fallback_name(r.topic, r.category_id, r.city_id)) end;
      -- Never two communities of one city under one name: then the city, then a count.
      with_city := case when position(lower(private.community_city_label(r.city_id)) in lower(base)) > 0 then base
                        else base || ' · ' || private.community_city_label(r.city_id) end;
      candidate := base;
      k := 0;
      while exists (select 1 from public.communities o where o.city_id = r.city_id and o.deleted_at is null and o.id <> r.id and lower(o.name) = lower(candidate)) loop
        k := k + 1;
        candidate := case when with_city = base then base || ' (' || (k + 1) || ')' when k = 1 then with_city else with_city || ' (' || k || ')' end;
      end loop;
      update public.communities set name = left(candidate, 60) where id = r.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function private.irly_community_titles() from public, anon, authenticated;

select private.irly_community_titles();
