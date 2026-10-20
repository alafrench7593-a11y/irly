-- Community titles, second pass (migration 20261024009000_irly_community_titles_letters):
-- a run stamp made only of letters ("Book & Matcha mvdxpmvc") is a code too,
-- and the communities the end-to-end scripts' accounts (e2e-…@irly.test)
-- still own are fixed like orphaned ones. Names a real member chose are never
-- touched. Ids use the prefix c9000000-…
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL community_titles_letters: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', false);

-- 0. The word rule (same cases as scripts/test-community-names.mts).
select pg_temp.check(bool_and(private.community_word_is_technical(w)), 'all-letter and one-digit run stamps are codes')
from unnest(array['mvdxpmvc', 'mvdx3mvc', 'mvgq82y1', 'mv00tl2o']) w;
select pg_temp.check(not bool_or(private.community_word_is_technical(w)), 'eight-letter words are words')
from unnest(array['marathon', 'networks', 'midnight', 'nightout', 'Matcha', 'mamans', 'lifestyle', 'IRLY']) w;
select pg_temp.check(private.community_clean_name('Book & Matcha mvdxpmvc') = 'Book & Matcha', 'clean: all-letter stamp dropped');

-- The local auth.users shim has no email column; the live one has.
alter table auth.users add column if not exists email text;

insert into auth.users (id, email) values
  ('c9000000-0000-0000-0000-0000000000a1', 'rae@example.com'),
  ('c9000000-0000-0000-0000-0000000000a2', 'e2e-girl-mvdxpmvc-lea@irly.test'),
  ('c9000000-0000-0000-0000-0000000000a3', 'e2e-girl-mvdxpmvc-mia@irly.test'),
  ('c9000000-0000-0000-0000-0000000000a4', 'uma@example.com');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c9000000-0000-0000-0000-0000000000a1', 'Rae', '1992-02-02', 'woman', 'dubai'),
  ('c9000000-0000-0000-0000-0000000000a2', 'Lea', '1995-04-04', 'woman', 'dubai'),
  ('c9000000-0000-0000-0000-0000000000a3', 'Mia', '1995-04-04', 'woman', 'dubai'),
  ('c9000000-0000-0000-0000-0000000000a4', 'Uma', '1994-07-07', 'woman', 'dubai');

insert into public.communities (id, city_id, name, topic, girl_only, created_by) values
  -- Left by a deleted test account, a real member in it.
  ('c9000000-0000-0000-0000-0000000000c1', 'dubai', 'Book & Matcha mvdxpmvc', null, true, null),
  -- Created and still owned by a test account, only test accounts in it.
  ('c9000000-0000-0000-0000-0000000000c2', 'dubai', 'Girls Padel mvdxpmvc', null, true, 'c9000000-0000-0000-0000-0000000000a2'),
  -- Created by a test account, a real member joined it.
  ('c9000000-0000-0000-0000-0000000000c3', 'dubai', 'Run club mvdxpmvc', null, true, 'c9000000-0000-0000-0000-0000000000a2'),
  -- A real member's own name: never touched.
  ('c9000000-0000-0000-0000-0000000000c4', 'dubai', 'Book club mvdxpmvc', null, true, 'c9000000-0000-0000-0000-0000000000a4'),
  -- A real word of eight letters: never a code.
  ('c9000000-0000-0000-0000-0000000000c5', 'dubai', 'Morning marathon', null, true, null);
insert into public.community_members (community_id, user_id, role) values
  ('c9000000-0000-0000-0000-0000000000c1', 'c9000000-0000-0000-0000-0000000000a1', 'member'),
  ('c9000000-0000-0000-0000-0000000000c2', 'c9000000-0000-0000-0000-0000000000a2', 'owner'),
  ('c9000000-0000-0000-0000-0000000000c2', 'c9000000-0000-0000-0000-0000000000a3', 'member'),
  ('c9000000-0000-0000-0000-0000000000c3', 'c9000000-0000-0000-0000-0000000000a2', 'owner'),
  ('c9000000-0000-0000-0000-0000000000c3', 'c9000000-0000-0000-0000-0000000000a1', 'member'),
  ('c9000000-0000-0000-0000-0000000000c4', 'c9000000-0000-0000-0000-0000000000a4', 'owner'),
  ('c9000000-0000-0000-0000-0000000000c5', 'c9000000-0000-0000-0000-0000000000a1', 'member');

select pg_temp.check(private.irly_community_titles() = 3, 'three titles fixed (the member''s own name and the real word are not)');
select pg_temp.check((select name from public.communities where id = 'c9000000-0000-0000-0000-0000000000c1') = 'Book & Matcha', 'Book & Matcha: the stamp is gone, the community kept');
select pg_temp.check((select deleted_at is not null from public.communities where id = 'c9000000-0000-0000-0000-0000000000c2'), 'a test account''s community with only test accounts leaves the lists');
select pg_temp.check((select count(*) from public.communities where id = 'c9000000-0000-0000-0000-0000000000c2') = 1, '… its row is kept (moderation history)');
select pg_temp.check((select name from public.communities where id = 'c9000000-0000-0000-0000-0000000000c3') = 'Run club', 'a test account''s community a real member joined is renamed in place');
select pg_temp.check((select deleted_at is null from public.communities where id = 'c9000000-0000-0000-0000-0000000000c3'), '… and stays listed');
select pg_temp.check((select name from public.communities where id = 'c9000000-0000-0000-0000-0000000000c4') = 'Book club mvdxpmvc', 'a name a real member chose is never touched');
select pg_temp.check((select name from public.communities where id = 'c9000000-0000-0000-0000-0000000000c5') = 'Morning marathon', 'a real word is never touched');
select pg_temp.check((select count(*) from public.community_members where community_id::text like 'c9000000-%') = 7, 'members kept');
select pg_temp.check(private.irly_community_titles() = 0, 'running it again changes nothing');
select pg_temp.check((select title from public.conversations where community_id = 'c9000000-0000-0000-0000-0000000000c1') = 'Book & Matcha', 'the chat follows the new title');
