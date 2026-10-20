-- IRLY Girl community names (migration 20261024002000_irly_girl_community_names):
-- the new names are in place, and a rename keeps the same community (id,
-- members, posts, chat), never deletes or recreates it, and leaves a name a
-- host chose alone. Runs after irly_test.sql on the same database
-- (scripts/test-db.sh); ids use the prefix f2000000-…
\set ON_ERROR_STOP 1

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL girl_community_names: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

select pg_temp.as_admin();

-- 1. The names, after the migration.
select pg_temp.check((select name from public.community_topics where topic = 'girls') = 'IRLY Girl', 'the girls topic is named IRLY Girl');
select pg_temp.check((select name from public.community_topics where topic = 'families') = 'IRLY Family', 'the families topic is named IRLY Family');
select pg_temp.check((select tagline from public.community_topics where topic = 'moms') = 'Moms meeting moms, with or without the kids.', 'IRLY Moms says Moms, not Mums');
select pg_temp.check(not exists (select 1 from public.communities where deleted_at is null and name in
  ('IRLY Girls', 'IRLY Families', 'Girls Surf Bali', 'Girls Padel Bali', 'French Girls Bali', 'Women Entrepreneurs Bali', 'Girls Moving To Bali', 'New Moms Dubai')),
  'no community keeps an old name');
select pg_temp.check(not exists (select 1 from public.communities where deleted_at is null and (tagline ilike '%mums%')), 'no community tagline says Mums');
select pg_temp.check((select count(*) from public.communities where official and topic = 'girls' and parent_id is null and deleted_at is null and name = 'IRLY Girl')
  = (select cardinality(cities) from public.community_topics where topic = 'girls'), 'every city has its IRLY Girl community');
select pg_temp.check(exists (select 1 from public.communities where city_id = 'bali' and name = 'Bali Surf Girls' and girl_only), 'Bali Surf Girls exists, women only');
select pg_temp.check(exists (select 1 from public.communities where city_id = 'dubai' and name = 'Dubai New Moms' and girl_only), 'Dubai New Moms exists and keeps "Moms"');
select pg_temp.check(exists (select 1 from public.communities where city_id = 'bali' and name = 'Girls Moving to Bali'), 'Girls Moving to Bali is spelled with a lowercase "to"');

-- 2. A renamed community keeps its id, members, posts and chat.
insert into auth.users (id) values ('f2000000-0000-0000-0000-0000000000a1'), ('f2000000-0000-0000-0000-0000000000a2');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('f2000000-0000-0000-0000-0000000000a1', 'Ada', '1994-03-03', 'woman', 'dubai'),
  ('f2000000-0000-0000-0000-0000000000a2', 'Bea', '1993-05-05', 'woman', 'bali');

create temp table before_rename as
select c.id, c.name from public.communities c
where (c.official and c.topic = 'girls' and c.city_id = 'dubai' and c.parent_id is null and c.deleted_at is null)
   or (c.city_id = 'bali' and c.name = 'Bali Surf Girls' and c.deleted_at is null);
select pg_temp.check((select count(*) from before_rename) = 2, 'both communities found');

insert into public.community_members (community_id, user_id, role)
select id, u, 'member' from before_rename, unnest(array['f2000000-0000-0000-0000-0000000000a1'::uuid, 'f2000000-0000-0000-0000-0000000000a2'::uuid]) u
on conflict do nothing;
insert into public.community_posts (community_id, author_id, body)
select id, 'f2000000-0000-0000-0000-0000000000a1', 'Hello from before the rename' from before_rename;

-- Back to the old names (as in a database deployed before the fix), then the rename again.
update public.communities set name = 'IRLY Girls' where id = (select id from before_rename where name = 'IRLY Girl');
update public.communities set name = 'Girls Surf Bali' where id = (select id from before_rename where name = 'Bali Surf Girls');
select pg_temp.check((select title from public.conversations where community_id = (select id from before_rename where name = 'IRLY Girl')) = 'IRLY Girls', 'the chat had the old name');

select pg_temp.check(private.irly_girl_community_names() >= 2, 'the rename runs again on old names');

select pg_temp.check((select name from public.communities where id = (select id from before_rename where name = 'IRLY Girl')) = 'IRLY Girl', 'same row renamed IRLY Girl');
select pg_temp.check((select name from public.communities where id = (select id from before_rename where name = 'Bali Surf Girls')) = 'Bali Surf Girls', 'same row renamed Bali Surf Girls');
select pg_temp.check((select count(*) from public.community_members m join before_rename b on b.id = m.community_id
  where m.user_id in ('f2000000-0000-0000-0000-0000000000a1', 'f2000000-0000-0000-0000-0000000000a2')) = 4, 'members kept after the rename');
select pg_temp.check((select count(*) from public.community_posts p join before_rename b on b.id = p.community_id
  where p.body = 'Hello from before the rename' and p.deleted_at is null) = 2, 'posts kept after the rename');
select pg_temp.check((select title from public.conversations where community_id = (select id from before_rename where name = 'IRLY Girl')) = 'IRLY Girl', 'the chat follows the new name');
select pg_temp.check((select count(*) from public.communities where official and topic = 'girls' and city_id = 'dubai' and deleted_at is null) = 1, 'no second IRLY Girl community created');

-- 3. A name a host chose is never touched; the function is not for members.
insert into public.communities (id, city_id, name, girl_only, created_by)
values ('f2000000-0000-0000-0000-0000000000c1', 'bali', 'Girls Padel Bali', true, 'f2000000-0000-0000-0000-0000000000a2');
select private.irly_girl_community_names();
select pg_temp.check((select name from public.communities where id = 'f2000000-0000-0000-0000-0000000000c1') = 'Girls Padel Bali', 'a member''s own community keeps its name');

select pg_temp.as_user('f2000000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails('select private.irly_girl_community_names()') = '42501', 'members cannot run the rename');
select pg_temp.as_admin();
