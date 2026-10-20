-- A new activity's full form (migration 20261024001500_irly_activity_library_cover):
-- description, photo (an IRLY library link or the host's upload), price and
-- capacity are saved on the row and read back as they were sent; a girls-only
-- activity is seen by women and never by men. Runs after irly_test.sql on the
-- same database (scripts/test-db.sh); ids use the prefix fa100000-….
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
    raise exception 'FAIL activity_library_cover: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

select pg_temp.as_admin();
insert into auth.users (id) values
  ('fa100000-0000-0000-0000-0000000000a1'), ('fa100000-0000-0000-0000-0000000000a2'), ('fa100000-0000-0000-0000-0000000000a6');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('fa100000-0000-0000-0000-0000000000a1', 'Lea', '1994-03-03', 'woman', 'dubai'),
  ('fa100000-0000-0000-0000-0000000000a2', 'Mia', '1993-05-05', 'woman', 'dubai'),
  ('fa100000-0000-0000-0000-0000000000a6', 'Max', '1989-01-01', 'man', 'dubai');

-- A. A woman creates a girls-only activity with every field of the form and a library photo.
select pg_temp.as_user('fa100000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, format, title, description, category_id, sub_id, city_id, area_id, place_name,
  starts_at, ends_at, price_minor, currency, capacity, privacy, girl_only, audience, cover_path)
values ('fa100000-0000-0000-0000-0000000000b1', 'fa100000-0000-0000-0000-0000000000a1', 'session', 'Girls padel at sunset',
  E'Level: beginners welcome.\nBring water, rackets provided.', 'sport', 'padel', 'dubai', 'marina', 'Padel Pro Marina',
  now() + interval '3 days', now() + interval '3 days 2 hours', 8000, 'AED', 4, 'public', true, 'girls',
  'https://alafrench7593-a11y.github.io/irly/photos/v/padel-2-1600.jpg');
select pg_temp.check((select description = E'Level: beginners welcome.\nBring water, rackets provided.' and price_minor = 8000 and currency = 'AED'
  and capacity = 4 and girl_only and cover_path = 'https://alafrench7593-a11y.github.io/irly/photos/v/padel-2-1600.jpg'
  from public.activities where id = 'fa100000-0000-0000-0000-0000000000b1'), 'the host reads back description, price, capacity, girl_only and the library photo');

-- B. Another woman sees all of it, through the table and the activity page (activity_detail).
select pg_temp.as_user('fa100000-0000-0000-0000-0000000000a2');
select pg_temp.check((select count(*) = 1 from public.activities where id = 'fa100000-0000-0000-0000-0000000000b1'), 'another woman sees the girls-only activity');
select pg_temp.check((select description like 'Level: beginners%' and price_minor = 8000 and capacity = 4
  and cover_url = 'https://alafrench7593-a11y.github.io/irly/photos/v/padel-2-1600.jpg'
  from public.activity_detail('fa100000-0000-0000-0000-0000000000b1')), '… and its page gives her the description, price, capacity and the chosen photo');

-- C. A man never sees it (table, page).
select pg_temp.as_user('fa100000-0000-0000-0000-0000000000a6');
select pg_temp.check((select count(*) = 0 from public.activities where id = 'fa100000-0000-0000-0000-0000000000b1'), 'a man does not see the girls-only activity');
select pg_temp.check((select count(*) = 0 from public.activity_detail('fa100000-0000-0000-0000-0000000000b1')), '… nor its page');

-- D. Only IRLY library links are accepted as a link; uploads stay the host's own.
select pg_temp.as_user('fa100000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($q$update public.activities set cover_path = 'https://getirly.com/img/own/padelGirl-1200.jpg' where id = 'fa100000-0000-0000-0000-0000000000b1'$q$) is null, 'the host changes to another library photo (IRLY''s own)');
select pg_temp.check(pg_temp.fails($q$update public.activities set cover_path = 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1600&q=80' where id = 'fa100000-0000-0000-0000-0000000000b1'$q$) is null, '… or an Unsplash photo of the app');
select pg_temp.check(pg_temp.fails($q$update public.activities set cover_path = 'https://evil.example.com/pixel.gif' where id = 'fa100000-0000-0000-0000-0000000000b1'$q$) like '42501%', 'a link to another site is refused');
select pg_temp.check(pg_temp.fails($q$update public.activities set cover_path = 'https://getirly.com.evil.example/img/own/x.jpg' where id = 'fa100000-0000-0000-0000-0000000000b1'$q$) like '42501%', 'a look-alike host is refused');
select pg_temp.check(pg_temp.fails($q$update public.activities set cover_path = 'https://getirly.com/img/own/../../x.jpg' where id = 'fa100000-0000-0000-0000-0000000000b1'$q$) like '42501%', 'a path climbing out of the photo folder is refused');
select pg_temp.check(pg_temp.fails($q$update public.activities set cover_path = 'http://getirly.com/img/own/padelGirl-1200.jpg' where id = 'fa100000-0000-0000-0000-0000000000b1'$q$) like '42501%', 'a plain http link is refused');
select pg_temp.check(pg_temp.fails($q$update public.activities set cover_path = 'fa100000-0000-0000-0000-0000000000a2/x.jpg' where id = 'fa100000-0000-0000-0000-0000000000b1'$q$) like '42501%', 'another member''s upload is refused');
select pg_temp.check(pg_temp.fails($q$update public.activities set cover_path = 'fa100000-0000-0000-0000-0000000000a1/1700000000.jpg' where id = 'fa100000-0000-0000-0000-0000000000b1'$q$) is null, 'the host''s own upload is accepted');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, cover_path) values ('fa100000-0000-0000-0000-0000000000a1', 'Bad photo', 'food', 'dubai', 'marina', now() + interval '2 days', 'https://evil.example.com/a.jpg')$q$) like '42501%', 'creating with a foreign link is refused');

-- E. Nobody else changes the photo (the host's rule is unchanged).
select pg_temp.as_user('fa100000-0000-0000-0000-0000000000a2');
update public.activities set cover_path = 'https://getirly.com/img/own/brunchGirl-1200.jpg' where id = 'fa100000-0000-0000-0000-0000000000b1';
select pg_temp.as_admin();
select pg_temp.check((select cover_path = 'fa100000-0000-0000-0000-0000000000a1/1700000000.jpg' from public.activities where id = 'fa100000-0000-0000-0000-0000000000b1'), 'another woman cannot change the host''s photo');

-- F. Mixte: a man's open activity with a library photo is seen by everyone.
select pg_temp.as_user('fa100000-0000-0000-0000-0000000000a6');
insert into public.activities (id, creator_id, title, description, category_id, city_id, area_id, starts_at, price_minor, currency, capacity, cover_path)
values ('fa100000-0000-0000-0000-0000000000b2', 'fa100000-0000-0000-0000-0000000000a6', 'Sunday football', 'Five-a-side, all levels.', 'sport', 'dubai', 'marina',
  now() + interval '4 days', 0, 'AED', 10, 'https://getirly.com/img/own/footballMix-1200.jpg');
select pg_temp.as_user('fa100000-0000-0000-0000-0000000000a2');
select pg_temp.check((select cover_url = 'https://getirly.com/img/own/footballMix-1200.jpg' and description = 'Five-a-side, all levels.' and capacity = 10 and price_minor = 0
  from public.activity_detail('fa100000-0000-0000-0000-0000000000b2')), 'an open activity''s photo, description, capacity and price read back for another member');

select pg_temp.as_admin();
delete from public.activities where id in ('fa100000-0000-0000-0000-0000000000b1', 'fa100000-0000-0000-0000-0000000000b2');
delete from public.profiles where id::text like 'fa100000-%';
delete from auth.users where id::text like 'fa100000-%';
