-- Back office editorial (migration 20261028000000_irly_admin_cms): the
-- team's news, the Home layout per flavour and the Home banners. Who may
-- write (content staff only, every other caller refused), what members read
-- (published, visible now, not deleted; IRLY Girl items only for accounts
-- that pass private.girl_eligible_unchecked), notifications sent once and
-- only to the right audience, the layout's draft / publish / restore, strict
-- checks, and the files' read rule. TEST accounts only, ids c0c50000-….
--
--   01 Olga   owner                      05 Mark  man, member
--   02 Cleo   content staff              06 Rae   woman, IRLY Girl suspended
--   03 Mia    moderator (not content)    07 Gina  woman, member (IRLY Girl)
--   04 Wendy  woman, member (IRLY Girl)
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
revoke all on public.irly_news, public.irly_banners, public.home_layouts, public.home_layout_versions from anon, authenticated;

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL admin_cms: %', label; end if;
  raise notice 'ok  %', label;
end $$;
-- The SQLSTATE a statement fails with, or null when it succeeds.
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;
-- The message a statement fails with, or null.
create or replace function pg_temp.why(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlerrm;
end $$;
-- Ids of the news in a member's feed.
create or replace function pg_temp.feed_news(p_space text) returns text[] language sql as $$
  select coalesce(array(select x ->> 'id' from jsonb_array_elements(public.home_feed(p_space) -> 'news') x), '{}')
$$;
create or replace function pg_temp.feed_banners(p_space text) returns text[] language sql as $$
  select coalesce(array(select x ->> 'id' from jsonb_array_elements(public.home_feed(p_space) -> 'banners') x), '{}')
$$;
create or replace function pg_temp.feed_keys(p_space text) returns text[] language sql as $$
  select coalesce(array(select x ->> 'key' from jsonb_array_elements(public.home_feed(p_space) -> 'layout' -> 'sections') x), '{}')
$$;
create or replace function pg_temp.news_notes(p_news text) returns bigint language sql as $$
  select count(*) from public.notifications where kind = 'IRLY_NEWS' and payload ->> 'news_id' = p_news
$$;
create or replace function pg_temp.noted(p_user uuid, p_news text) returns bigint language sql as $$
  select count(*) from public.notifications where kind = 'IRLY_NEWS' and user_id = p_user and payload ->> 'news_id' = p_news
$$;

-- ───────── Accounts, and a stand-in for Storage (removed at the end) ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('c0c50000-0000-0000-0000-000000000001'), ('c0c50000-0000-0000-0000-000000000002'), ('c0c50000-0000-0000-0000-000000000003'),
  ('c0c50000-0000-0000-0000-000000000004'), ('c0c50000-0000-0000-0000-000000000005'), ('c0c50000-0000-0000-0000-000000000006'),
  ('c0c50000-0000-0000-0000-000000000007');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c0c50000-0000-0000-0000-000000000001', 'Olga', '1985-01-01', 'woman', 'dubai'),
  ('c0c50000-0000-0000-0000-000000000002', 'Cleo', '1990-02-02', 'woman', 'dubai'),
  ('c0c50000-0000-0000-0000-000000000003', 'Mia', '1991-03-03', 'woman', 'dubai'),
  ('c0c50000-0000-0000-0000-000000000004', 'Wendy', '1994-04-04', 'woman', 'dubai'),
  ('c0c50000-0000-0000-0000-000000000005', 'Mark', '1992-05-05', 'man', 'dubai'),
  ('c0c50000-0000-0000-0000-000000000006', 'Rae', '1993-06-06', 'woman', 'dubai'),
  ('c0c50000-0000-0000-0000-000000000007', 'Gina', '1995-07-07', 'woman', 'dubai');
insert into public.staff_roles (user_id, role) values
  ('c0c50000-0000-0000-0000-000000000001', 'owner'),
  ('c0c50000-0000-0000-0000-000000000002', 'content'),
  ('c0c50000-0000-0000-0000-000000000003', 'moderator');
insert into public.girl_suspensions (user_id, reason) values ('c0c50000-0000-0000-0000-000000000006', 'cms test');

create schema storage;
create table storage.objects (bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
grant usage on schema storage to anon, authenticated;
grant select on storage.objects to anon;
grant select, insert on storage.objects to authenticated;
alter table storage.objects enable row level security;
-- The same rules as the migration's (they are only created where Storage exists).
create policy cms_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'cms-media' and (storage.foldername(name))[1] = auth.uid()::text and private.is_content_staff(auth.uid()));
create policy cms_media_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'cms-media' and public.cms_file_readable(name));
insert into storage.objects (bucket_id, name) values
  ('cms-media', 'c0c50000-0000-0000-0000-000000000002/both.jpg'),
  ('cms-media', 'c0c50000-0000-0000-0000-000000000002/girl.jpg'),
  ('cms-media', 'c0c50000-0000-0000-0000-000000000002/draft.jpg'),
  ('cms-media', 'c0c50000-0000-0000-0000-000000000002/gallery.jpg'),
  ('cms-media', 'c0c50000-0000-0000-0000-000000000002/clip.mp4'),
  ('cms-media', 'c0c50000-0000-0000-0000-000000000002/banner.jpg'),
  ('cms-media', 'c0c50000-0000-0000-0000-000000000002/banner2.jpg'),
  ('cms-media', 'c0c50000-0000-0000-0000-000000000002/girlbanner.jpg'),
  ('cms-media', 'c0c50000-0000-0000-0000-000000000002/bali.jpg'),
  ('cms-media', 'c0c50000-0000-0000-0000-000000000001/olga.jpg');

-- ───────── Nobody but content staff writes ─────────
create temp table calls (stmt text);
grant select on calls to anon, authenticated;
insert into calls values
  ($q$select public.admin_news_list()$q$),
  ($q$select public.admin_news_get('c0c50000-0000-0000-0000-0000000000a1')$q$),
  ($q$select public.admin_news_save(null, '{"title": "Hacked news"}')$q$),
  ($q$select public.admin_news_publish('c0c50000-0000-0000-0000-0000000000a1')$q$),
  ($q$select public.admin_news_unpublish('c0c50000-0000-0000-0000-0000000000a1')$q$),
  ($q$select public.admin_news_delete('c0c50000-0000-0000-0000-0000000000a1')$q$),
  ($q$select public.admin_news_reorder(array['c0c50000-0000-0000-0000-0000000000a1'::uuid])$q$),
  ($q$select public.admin_banner_list()$q$),
  ($q$select public.admin_banner_save(null, '{"title": "Hacked"}')$q$),
  ($q$select public.admin_banner_reorder(array['c0c50000-0000-0000-0000-0000000000a1'::uuid])$q$),
  ($q$select public.admin_banner_delete('c0c50000-0000-0000-0000-0000000000a1')$q$),
  ($q$select public.admin_home_layout_get('mixte')$q$),
  ($q$select public.admin_home_layout_save_draft('mixte', '[]')$q$),
  ($q$select public.admin_home_layout_publish('mixte')$q$),
  ($q$select public.admin_home_layout_restore('mixte', null)$q$);
create or replace function pg_temp.all_refused() returns boolean language sql as $$
  select bool_and(pg_temp.fails(stmt) = '42501') from calls
$$;
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.all_refused(), 'a member cannot call any back office editorial call (15 calls)');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.all_refused(), 'a moderator (not content staff) cannot either');
select pg_temp.as_anon();
select pg_temp.check(pg_temp.all_refused(), 'a signed-out visitor cannot either');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.fails($q$select * from public.irly_news$q$) = '42501', 'the news table is closed to members');
select pg_temp.check(pg_temp.fails($q$select * from public.home_layouts$q$) = '42501', 'the layout table is closed to members');
select pg_temp.check(pg_temp.fails($q$select * from public.irly_banners$q$) = '42501', 'the banner table is closed to members');
select pg_temp.check(pg_temp.fails($q$insert into storage.objects (bucket_id, name) values ('cms-media', 'c0c50000-0000-0000-0000-000000000005/x.jpg')$q$) = '42501',
  'a member cannot upload into the editorial files');

-- ───────── News: drafts stay with the team ─────────
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
create temp table ids (name text primary key, id uuid);
grant select on ids to anon, authenticated;
insert into ids values ('both', public.admin_news_save(null, jsonb_build_object(
  'title', 'IRLY opens in Abu Dhabi', 'subtitle', 'From next week', 'body', 'All the plans of the capital.', 'audience', 'both',
  'category', 'news', 'cover_path', 'c0c50000-0000-0000-0000-000000000002/both.jpg', 'gallery_paths', jsonb_build_array('c0c50000-0000-0000-0000-000000000002/gallery.jpg'),
  'video_path', 'c0c50000-0000-0000-0000-000000000002/clip.mp4', 'cta_label', 'See plans', 'cta_url', '/discover', 'notify', true)));
insert into ids values ('girl', public.admin_news_save(null, jsonb_build_object(
  'title', 'IRLY Girl brunch club', 'body', 'Women only, every Saturday.', 'audience', 'girl', 'cover_path', 'c0c50000-0000-0000-0000-000000000002/girl.jpg', 'notify', true)));
insert into ids values ('mixte', public.admin_news_save(null, '{"title": "Padel league", "body": "Teams of four.", "audience": "mixte"}'));
insert into ids values ('draft', public.admin_news_save(null, '{"title": "Secret draft", "body": "Not yet.", "cover_path": "c0c50000-0000-0000-0000-000000000002/draft.jpg"}'));
select pg_temp.check((select count(*) from jsonb_array_elements(public.admin_news_list()) x where x ->> 'state' = 'draft') = 4, 'new items are drafts');
select pg_temp.check((public.admin_news_get((select id from ids where name = 'both')) ->> 'video_path') = 'c0c50000-0000-0000-0000-000000000002/clip.mp4', 'a news item can carry a video');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check(cardinality(pg_temp.feed_news('mixte')) = 0, 'drafts are invisible to members');
select pg_temp.check(public.news_item((select id from ids where name = 'both')) is null, 'a draft cannot be opened by its link');
select pg_temp.as_anon();
select pg_temp.check(cardinality(pg_temp.feed_news('mixte')) = 0 and public.news_item((select id from ids where name = 'both')) is null, 'drafts are invisible signed out');
select pg_temp.check(not public.cms_file_readable('c0c50000-0000-0000-0000-000000000002/draft.jpg'), 'a draft''s photo is not readable signed out');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'cms-media') = 0, 'a member lists none of the drafts'' files');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'cms-media') = 10, 'the content team reads every editorial file');

-- ───────── Checks on what is saved ─────────
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "No"}')$q$) = 'a title needs 3 to 120 characters', 'a title of 2 letters is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "Hello", "hack": 1}')$q$) = 'unknown field', 'an unknown field is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "Hello", "audience": "men"}')$q$) = 'unknown audience', 'an unknown audience is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "Hello", "category": "gossip"}')$q$) = 'unknown category', 'an unknown category is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "Hello", "cta_label": "Go", "cta_url": "javascript:alert(1)"}')$q$) = 'invalid destination', 'a javascript: link is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "Hello", "cta_label": "Go", "cta_url": "http://example.com"}')$q$) = 'invalid destination', 'a plain http link is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "Hello", "cta_label": "Go", "cta_url": "/admin"}')$q$) = 'invalid destination', 'a screen outside the list is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "Hello", "cta_url": "https://getirly.com"}')$q$) = 'a link needs a button label', 'a link needs its label');
select pg_temp.check(pg_temp.fails($q$select public.admin_news_save(null, '{"title": "Hello", "cta_label": "Open", "cta_url": "https://getirly.com/app"}')$q$) is null
  and pg_temp.fails($q$select public.admin_news_save(null, '{"title": "Hello", "cta_label": "Open", "cta_url": "/category/sport"}')$q$) is null
  and pg_temp.fails($q$select public.admin_news_save(null, '{"title": "Hello", "cta_label": "Open", "cta_url": "/c/c0c50000-0000-0000-0000-0000000000c1"}')$q$) is null,
  'https links and the app''s own screens are accepted');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "Hello", "cover_path": "c0c50000-0000-0000-0000-000000000001/olga.jpg"}')$q$) = 'the photo must be one of your own uploads',
  'someone else''s upload is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "Hello", "cover_path": "c0c50000-0000-0000-0000-000000000002/missing.jpg"}')$q$) = 'the photo was not uploaded',
  'a photo that was not uploaded is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": "Hello", "video_path": "c0c50000-0000-0000-0000-000000000002/both.jpg"}')$q$) = 'invalid file',
  'a photo is not taken as a video');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, jsonb_build_object('title', 'Hello', 'gallery_paths', (select jsonb_agg('c0c50000-0000-0000-0000-000000000002/gallery.jpg'::text) from generate_series(1, 13))))$q$)
  = 'the gallery has too many items (at most 12)', 'a gallery holds 12 photos at most');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, jsonb_build_object('title', repeat('x', 121)))$q$) = 'a title is at most 120 characters', 'a title holds 120 characters at most');
select pg_temp.check(pg_temp.why($q$select public.admin_news_save(null, '{"title": 42}')$q$) = 'invalid value', 'a title that is not text is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_news_publish((select id from ids where name = 'both'), now() + interval '2 years')$q$) = 'pick a date within a year', 'scheduling is a year ahead at most');
create temp table empty_news as select public.admin_news_save(null, '{"title": "Empty body"}') as id;
select pg_temp.check(pg_temp.why($q$select public.admin_news_publish((select id from empty_news))$q$) = 'add a text before publishing', 'an item without text cannot be published');

-- ───────── Publishing: who sees what, notified once ─────────
select (public.admin_news_publish(id)) from ids where name in ('both', 'girl', 'mixte');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.news_notes((select id::text from ids where name = 'both')) = (select count(*) from public.profiles where deleted_at is null)
  and (select bool_and(pg_temp.noted(u, (select id::text from ids where name = 'both')) = 1) from unnest(array['c0c50000-0000-0000-0000-000000000001', 'c0c50000-0000-0000-0000-000000000002',
    'c0c50000-0000-0000-0000-000000000003', 'c0c50000-0000-0000-0000-000000000004', 'c0c50000-0000-0000-0000-000000000005', 'c0c50000-0000-0000-0000-000000000006',
    'c0c50000-0000-0000-0000-000000000007']::uuid[]) u), 'both: every member is notified, once');
select pg_temp.check(pg_temp.news_notes((select id::text from ids where name = 'girl')) = (select count(*) from public.profiles p where private.girl_eligible_unchecked(p.id))
  and pg_temp.noted('c0c50000-0000-0000-0000-000000000005', (select id::text from ids where name = 'girl')) = 0
  and pg_temp.noted('c0c50000-0000-0000-0000-000000000006', (select id::text from ids where name = 'girl')) = 0
  and pg_temp.noted('c0c50000-0000-0000-0000-000000000004', (select id::text from ids where name = 'girl')) = 1,
  'girl: only IRLY Girl members are notified (never Mark, never Rae, suspended)');
select pg_temp.check(pg_temp.news_notes((select id::text from ids where name = 'mixte')) = 0, 'notify off: nobody is notified');
select pg_temp.check((select payload ->> 'girl' from public.notifications where kind = 'IRLY_NEWS' and payload ->> 'news_id' = (select id::text from ids where name = 'girl') limit 1) = 'true',
  'a Girl item''s notification says so (push title « IRLY Girl »)');

select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.feed_news('mixte') @> array[(select id::text from ids where name = 'both'), (select id::text from ids where name = 'mixte')]
  and not pg_temp.feed_news('mixte') @> array[(select id::text from ids where name = 'girl')], 'Mark (IRLY): both + IRLY items, never the Girl one');
select pg_temp.check((public.home_feed('girl') ->> 'space') = 'mixte' and not pg_temp.feed_news('girl') @> array[(select id::text from ids where name = 'girl')],
  'Mark asking for IRLY Girl gets IRLY''s feed');
select pg_temp.check(public.news_item((select id from ids where name = 'girl')) is null, 'Mark cannot open the Girl item by its link');
select pg_temp.check(public.news_item((select id from ids where name = 'both')) ->> 'body' = 'All the plans of the capital.', 'Mark opens a both item with its text');
select pg_temp.check(public.cms_file_readable('c0c50000-0000-0000-0000-000000000002/both.jpg') and public.cms_file_readable('c0c50000-0000-0000-0000-000000000002/gallery.jpg')
  and public.cms_file_readable('c0c50000-0000-0000-0000-000000000002/clip.mp4'), 'a published item''s photos and video are readable');
select pg_temp.check(not public.cms_file_readable('c0c50000-0000-0000-0000-000000000002/girl.jpg'), 'a Girl item''s photo is not readable by Mark');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'cms-media') = 3, 'Mark lists exactly the published files he may see');
select pg_temp.check(pg_temp.noted('c0c50000-0000-0000-0000-000000000005', (select id::text from ids where name = 'both')) = 1, 'Mark has his notification');

select pg_temp.as_user('c0c50000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.feed_news('girl') @> array[(select id::text from ids where name = 'both'), (select id::text from ids where name = 'girl')]
  and not pg_temp.feed_news('girl') @> array[(select id::text from ids where name = 'mixte')], 'Wendy in IRLY Girl: both + Girl items, not the IRLY-only one');
select pg_temp.check(pg_temp.feed_news('mixte') @> array[(select id::text from ids where name = 'both'), (select id::text from ids where name = 'mixte')]
  and not pg_temp.feed_news('mixte') @> array[(select id::text from ids where name = 'girl')], 'Wendy in IRLY: both + IRLY items');
select pg_temp.check(public.news_item((select id from ids where name = 'girl')) is not null and public.cms_file_readable('c0c50000-0000-0000-0000-000000000002/girl.jpg'),
  'Wendy opens the Girl item and its photo');

select pg_temp.as_user('c0c50000-0000-0000-0000-000000000006');
select pg_temp.check(public.news_item((select id from ids where name = 'girl')) is null and not pg_temp.feed_news('girl') @> array[(select id::text from ids where name = 'girl')],
  'Rae (IRLY Girl suspended) sees no Girl item');
select pg_temp.as_anon();
select pg_temp.check(pg_temp.feed_news('girl') @> array[(select id::text from ids where name = 'both')] and not pg_temp.feed_news('girl') @> array[(select id::text from ids where name = 'girl')]
  and public.news_item((select id from ids where name = 'girl')) is null, 'signed out: both items yes, Girl items never');
select pg_temp.check(not public.cms_file_readable('c0c50000-0000-0000-0000-000000000002/girl.jpg') and public.cms_file_readable('c0c50000-0000-0000-0000-000000000002/both.jpg'),
  'signed out: a both item''s photo yes, a Girl item''s photo never');

-- Edit, unpublish, republish: what members see follows, the notification never comes twice.
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select public.admin_news_save((select id from ids where name = 'both'), '{"title": "IRLY opens in Abu Dhabi today", "notify": false}');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check((select x ->> 'title' from jsonb_array_elements(public.home_feed('mixte') -> 'news') x where x ->> 'id' = (select id::text from ids where name = 'both')) = 'IRLY opens in Abu Dhabi today',
  'an edit of a published item reaches members at once');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select pg_temp.check((public.admin_news_get((select id from ids where name = 'both')) ->> 'notify')::boolean, 'notify cannot change once the item went live');
select public.admin_news_unpublish((select id from ids where name = 'both'));
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check(not pg_temp.feed_news('mixte') @> array[(select id::text from ids where name = 'both')] and public.news_item((select id from ids where name = 'both')) is null,
  'unpublished: gone for members');
select pg_temp.check(not public.cms_file_readable('c0c50000-0000-0000-0000-000000000002/both.jpg'), 'unpublished: its photo is no longer readable');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select public.admin_news_publish((select id from ids where name = 'both'));
select public.admin_news_publish((select id from ids where name = 'girl'));
select pg_temp.as_admin();
select private.news_go_live();
select pg_temp.check(pg_temp.news_notes((select id::text from ids where name = 'both')) = (select count(*) from public.profiles where deleted_at is null)
  and pg_temp.news_notes((select id::text from ids where name = 'girl')) = (select count(*) from public.profiles p where private.girl_eligible_unchecked(p.id)),
  'republished and published again: nobody is notified twice');
select pg_temp.check(private.news_send((select id from ids where name = 'both')) = 0, 'sending again by hand does nothing (notified_at)');
select pg_temp.check(pg_temp.fails($q$insert into public.notifications (user_id, kind, payload) values ('c0c50000-0000-0000-0000-000000000005', 'IRLY_NEWS', jsonb_build_object('news_id', (select id::text from ids where name = 'both')))$q$) = '23505',
  'a second notification of the same item to the same member is impossible');

-- A member who loses IRLY Girl no longer reads the Girl item's notification.
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000007');
select pg_temp.check((select count(*) from public.notifications where kind = 'IRLY_NEWS' and payload ->> 'news_id' = (select id::text from ids where name = 'girl')) = 1, 'Gina reads her Girl news notification');
select pg_temp.as_admin();
insert into public.girl_suspensions (user_id, reason) values ('c0c50000-0000-0000-0000-000000000007', 'cms test');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000007');
select pg_temp.check((select count(*) from public.notifications where kind = 'IRLY_NEWS' and payload ->> 'news_id' = (select id::text from ids where name = 'girl')) = 0,
  'once suspended from IRLY Girl, Gina no longer reads it');
select pg_temp.check((select count(*) from public.notifications where kind = 'IRLY_NEWS' and payload ->> 'news_id' = (select id::text from ids where name = 'both')) = 1, 'her both notification stays');
select pg_temp.as_admin();
delete from public.girl_suspensions where user_id = 'c0c50000-0000-0000-0000-000000000007';

-- Scheduled: invisible until its time, then notified once (by the minute job).
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
insert into ids values ('later', public.admin_news_save(null, '{"title": "Summer party", "body": "Save the date.", "audience": "both", "notify": true}'));
select pg_temp.check((public.admin_news_publish((select id from ids where name = 'later'), now() + interval '1 day') ->> 'state') = 'scheduled', 'a future time schedules the item');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check(not pg_temp.feed_news('mixte') @> array[(select id::text from ids where name = 'later')] and public.news_item((select id from ids where name = 'later')) is null,
  'a scheduled item is invisible before its time');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.news_notes((select id::text from ids where name = 'later')) = 0, 'a scheduled item notifies nobody before its time');
-- Its time comes (the clock is moved back for the test).
update public.irly_news set publish_at = now() - interval '1 minute' where id = (select id from ids where name = 'later');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.feed_news('mixte') @> array[(select id::text from ids where name = 'later')], 'its time come, it shows without any job (publish_at <= now())');
select pg_temp.as_admin();
select pg_temp.check(private.news_go_live() = (select count(*) from public.profiles where deleted_at is null) and private.news_go_live() = 0
  and pg_temp.noted('c0c50000-0000-0000-0000-000000000005', (select id::text from ids where name = 'later')) = 1, 'the minute job notifies it once, and only once');

-- Deleted (soft): out of every list, kept in the table.
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select public.admin_news_delete((select id from ids where name = 'mixte'));
select pg_temp.check(not exists (select 1 from jsonb_array_elements(public.admin_news_list()) x where x ->> 'id' = (select id::text from ids where name = 'mixte')), 'a deleted item leaves the team''s list');
select pg_temp.check(pg_temp.fails($q$select public.admin_news_publish((select id from ids where name = 'mixte'))$q$) = 'P0002', 'a deleted item cannot be published again');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check(not pg_temp.feed_news('mixte') @> array[(select id::text from ids where name = 'mixte')], 'a deleted item is gone for members');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.irly_news where id = (select id from ids where name = 'mixte') and deleted_at is not null), 'the deleted row is kept (soft delete)');

-- Order.
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select public.admin_news_reorder(array[(select id from ids where name = 'girl'), (select id from ids where name = 'later'), (select id from ids where name = 'both')]);
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000004');
select pg_temp.check((pg_temp.feed_news('girl'))[1:3] = array[(select id::text from ids where name = 'girl'), (select id::text from ids where name = 'later'), (select id::text from ids where name = 'both')],
  'members see the team''s order');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from private.admin_audit where details ->> 'kind' = 'news' and action in ('news.created', 'news.published', 'news.edited', 'news.unpublished',
  'news.republished', 'news.scheduled', 'news.deleted', 'news.notified')) >= 12
  and exists (select 1 from private.admin_audit where action = 'news.reordered' and actor = 'c0c50000-0000-0000-0000-000000000002'), 'every news change is in the staff journal, with who');

-- ───────── Home layout ─────────
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select pg_temp.check(jsonb_array_length(public.admin_home_layout_get('mixte') -> 'draft') = 0 and (public.admin_home_layout_get('mixte') ->> 'version')::int = 0, 'no layout yet: empty draft, version 0');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check(cardinality(pg_temp.feed_keys('mixte')) = 0, 'members get no layout yet (the app''s own order)');

-- Invalid layouts are refused whole.
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('mixte', '{"key": "news"}')$q$) = 'the layout must be a list of sections', 'a layout is a list');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('mixte', '[{"key": "casino"}]')$q$) = 'unknown section', 'an unknown section is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('mixte', '[{"key": "news"}, {"key": "news"}]')$q$) = 'a section is listed twice', 'a section twice is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('mixte', '[{"key": "news", "colour": "red"}]')$q$) = 'unknown field', 'an unknown field is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('mixte', '[{"key": "news", "style": "neon"}]')$q$) = 'this section has no such style', 'a style the section does not draw is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('mixte', '[{"key": "news", "count": 50}]')$q$) = 'number of cards out of range', 'too many cards is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('mixte', '[{"key": "news", "count": 2.5}]')$q$) = 'number of cards out of range', 'a fraction of a card is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('mixte', '[{"key": "forYou", "category": "casino"}]')$q$) = 'unknown category', 'an unknown category is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('mixte', '[{"key": "categories", "title_fr": "Nope"}]')$q$) = 'this section cannot change that', 'a title on a section without one is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('mixte', '[{"key": "eat", "cta_url": "javascript:x"}]')$q$) = 'invalid destination', 'a bad button link is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('mixte', '[{"key": "news"}, {"key": "search"}]')$q$) = 'search stays first and the footer last', 'search stays first');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('mixte', '[{"key": "footer", "enabled": false}]')$q$) = 'search stays first and the footer last', 'the footer cannot be hidden');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('mixte', (select jsonb_agg(jsonb_build_object('key', k, 'enabled', k in ('search', 'footer'))) from unnest(private.home_section_keys()) k))$q$)
  = 'at least one section must stay visible', 'hiding every section is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('mixte', '[{"key": "bali", "cover_path": "c0c50000-0000-0000-0000-000000000001/olga.jpg"}]')$q$) = 'the photo must be one of your own uploads',
  'a cover that is not one''s own upload is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_save_draft('men', '[]')$q$) = 'unknown flavour', 'an unknown flavour is refused');

-- Move two sections, rename one, hide one: saved as a draft only.
select public.admin_home_layout_save_draft('mixte', jsonb_build_array(
  jsonb_build_object('key', 'search'), jsonb_build_object('key', 'people', 'title_fr', 'Les gens', 'title_en', 'The people', 'count', 6),
  jsonb_build_object('key', 'today'), jsonb_build_object('key', 'news', 'style', 'list', 'count', 3),
  jsonb_build_object('key', 'eat', 'enabled', false), jsonb_build_object('key', 'bali', 'cover_path', 'c0c50000-0000-0000-0000-000000000002/bali.jpg'),
  jsonb_build_object('key', 'nearby', 'category', 'beach', 'cta_label_fr', 'Tout voir', 'cta_url', '/category/beach')));
select pg_temp.check((select array_agg(x ->> 'key' order by (x ->> 'order')::int) from jsonb_array_elements(public.admin_home_layout_get('mixte') -> 'draft') x)[1:4]
  = array['search', 'people', 'today', 'news'], 'the draft keeps the new order');
select pg_temp.check(jsonb_array_length(public.admin_home_layout_get('mixte') -> 'draft') = cardinality(private.home_section_keys())
  and (select x ->> 'key' from jsonb_array_elements(public.admin_home_layout_get('mixte') -> 'draft') x order by (x ->> 'order')::int desc limit 1) = 'footer',
  'sections left out are added back where the app has them, footer last');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check(cardinality(pg_temp.feed_keys('mixte')) = 0, 'saving the draft does not change what members see');
select pg_temp.check(not public.cms_file_readable('c0c50000-0000-0000-0000-000000000002/bali.jpg'), 'a draft layout''s cover is not readable by members');

select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select pg_temp.check(public.admin_home_layout_publish('mixte') = 1, 'publish: version 1');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check((pg_temp.feed_keys('mixte'))[1:4] = array['search', 'people', 'today', 'news'], 'published: members get the new order');
select pg_temp.check((select (x ->> 'enabled')::boolean from jsonb_array_elements(public.home_feed('mixte') -> 'layout' -> 'sections') x where x ->> 'key' = 'eat') = false
  and (select x ->> 'title_fr' from jsonb_array_elements(public.home_feed('mixte') -> 'layout' -> 'sections') x where x ->> 'key' = 'people') = 'Les gens',
  'published: hidden section and new title reach members');
select pg_temp.check(public.cms_file_readable('c0c50000-0000-0000-0000-000000000002/bali.jpg'), 'a published IRLY layout''s cover is readable');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000004');
select pg_temp.check(cardinality(pg_temp.feed_keys('girl')) = 0, 'the IRLY layout does not touch IRLY Girl''s');

-- Restore: version 1 back into the draft after a second publish.
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select public.admin_home_layout_save_draft('mixte', '[{"key": "search"}, {"key": "eat"}, {"key": "news"}]');
select public.admin_home_layout_publish('mixte');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check((pg_temp.feed_keys('mixte'))[2] = 'eat', 'version 2 is live');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select public.admin_home_layout_restore('mixte', 1);
select pg_temp.check((select x ->> 'key' from jsonb_array_elements(public.admin_home_layout_get('mixte') -> 'draft') x where (x ->> 'order')::int = 1) = 'people', 'restore brings version 1 back into the draft');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check((pg_temp.feed_keys('mixte'))[2] = 'eat', 'restoring into the draft does not change what members see');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select public.admin_home_layout_publish('mixte');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check((pg_temp.feed_keys('mixte'))[2] = 'people', 'published again: version 1''s order is back');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select public.admin_home_layout_save_draft('mixte', '[{"key": "search"}, {"key": "news"}]');
select public.admin_home_layout_restore('mixte', null);
select pg_temp.check((select x ->> 'key' from jsonb_array_elements(public.admin_home_layout_get('mixte') -> 'draft') x where (x ->> 'order')::int = 1) = 'people', 'restore of the live layout into the draft');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_restore('mixte', 99)$q$) = 'this version no longer exists', 'an unknown version is refused');

-- Publishing is all or nothing: a draft that no longer passes the checks publishes nothing.
select pg_temp.as_admin();
update public.home_layouts set draft = '[{"key": "search"}, {"key": "casino"}]' where flavour = 'mixte';
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.why($q$select public.admin_home_layout_publish('mixte')$q$) = 'unknown section', 'a broken draft is not published');
select pg_temp.check((public.admin_home_layout_get('mixte') ->> 'version')::int = 3, 'the version did not move');
select pg_temp.check(public.admin_home_layout_get('mixte') -> 'draft' = '[{"key": "search"}, {"key": "casino"}]'::jsonb, 'the draft is kept as it was');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check((pg_temp.feed_keys('mixte'))[2] = 'people', 'members still see the last published layout');

-- IRLY Girl's layout: for IRLY Girl members only.
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select public.admin_home_layout_save_draft('girl', '[{"key": "search"}, {"key": "portals", "title_fr": "Entre filles"}, {"key": "news"}]');
select public.admin_home_layout_publish('girl');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000004');
select pg_temp.check((pg_temp.feed_keys('girl'))[2] = 'portals' and (pg_temp.feed_keys('mixte'))[2] = 'people', 'Wendy: IRLY Girl''s layout in IRLY Girl, IRLY''s in IRLY');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check((pg_temp.feed_keys('girl'))[2] = 'people', 'Mark asking for IRLY Girl''s layout gets IRLY''s');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from private.admin_audit where action in ('home.draft_saved', 'home.published', 'home.restored')) >= 9, 'layout changes are in the staff journal');

-- ───────── Banners ─────────
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
insert into ids values ('b_both', public.admin_banner_save(null, '{"title": "Summer on IRLY", "body": "Plans by the sea", "image_path": "c0c50000-0000-0000-0000-000000000002/banner.jpg", "cta_label": "See", "cta_url": "/category/beach", "audience": "both", "active": true}'));
insert into ids values ('b_girl', public.admin_banner_save(null, '{"title": "Girls brunch", "image_path": "c0c50000-0000-0000-0000-000000000002/girlbanner.jpg", "audience": "girl", "active": true}'));
insert into ids values ('b_off', public.admin_banner_save(null, '{"title": "Not yet on", "image_key": "padelGirl", "audience": "both"}'));
insert into ids values ('b_soon', public.admin_banner_save(null, jsonb_build_object('title', 'Soon', 'audience', 'both', 'active', true, 'starts_at', now() + interval '1 day')));
insert into ids values ('b_past', public.admin_banner_save(null, jsonb_build_object('title', 'Over', 'audience', 'both', 'active', true, 'starts_at', now() - interval '2 days', 'ends_at', now() - interval '1 day')));
insert into ids values ('b_mixte', public.admin_banner_save(null, '{"title": "Padel night", "audience": "mixte", "active": true}'));
select pg_temp.check(pg_temp.why($q$select public.admin_banner_save(null, jsonb_build_object('title', 'Bad', 'starts_at', now(), 'ends_at', now() - interval '1 hour'))$q$) = 'the end must come after the start', 'an end before the start is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_banner_save(null, '{"title": "Bad", "placement": "map"}')$q$) = 'unknown placement', 'only the Home has banners');
select pg_temp.check(pg_temp.why($q$select public.admin_banner_save(null, '{"title": "Bad", "cta_url": "ftp://x"}')$q$) = 'invalid destination', 'a bad banner link is refused');
select pg_temp.check(pg_temp.why($q$select public.admin_banner_save(null, '{"body": "No title"}')$q$) = 'a banner needs a title', 'a banner needs a title');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.feed_banners('mixte') @> array[(select id::text from ids where name = 'b_both'), (select id::text from ids where name = 'b_mixte')]
  and cardinality(pg_temp.feed_banners('mixte')) = 2, 'Mark: the active both and IRLY banners only (not off, not before, not after its dates, not Girl)');
select pg_temp.check(public.cms_file_readable('c0c50000-0000-0000-0000-000000000002/banner.jpg') and not public.cms_file_readable('c0c50000-0000-0000-0000-000000000002/girlbanner.jpg'),
  'Mark reads the both banner''s image, never the Girl one''s');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.feed_banners('girl') @> array[(select id::text from ids where name = 'b_both'), (select id::text from ids where name = 'b_girl')]
  and cardinality(pg_temp.feed_banners('girl')) = 2, 'Wendy in IRLY Girl: the both and Girl banners');
select pg_temp.as_anon();
select pg_temp.check(pg_temp.feed_banners('girl') @> array[(select id::text from ids where name = 'b_both')] and not pg_temp.feed_banners('girl') @> array[(select id::text from ids where name = 'b_girl')],
  'signed out (even asking for IRLY Girl): the both banner, never the Girl one');
-- Replacing a banner's image: its own new file; the old one stays stored.
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select public.admin_banner_save((select id from ids where name = 'b_both'), '{"image_path": "c0c50000-0000-0000-0000-000000000002/banner2.jpg"}');
select public.admin_banner_save((select id from ids where name = 'b_both'), '{"active": false}');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000005');
select pg_temp.check(not pg_temp.feed_banners('mixte') @> array[(select id::text from ids where name = 'b_both')], 'switched off: gone for members');
select pg_temp.as_user('c0c50000-0000-0000-0000-000000000002');
select public.admin_banner_reorder(array[(select id from ids where name = 'b_mixte'), (select id from ids where name = 'b_both')]);
select pg_temp.check((public.admin_banner_list() -> 0 ->> 'id') = (select id::text from ids where name = 'b_mixte'), 'banners keep the team''s order');
select public.admin_banner_delete((select id from ids where name = 'b_off'));
select pg_temp.check(not exists (select 1 from jsonb_array_elements(public.admin_banner_list()) x where x ->> 'id' = (select id::text from ids where name = 'b_off')), 'a deleted banner leaves the list');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'cms-media') = 10, 'no stored file was removed by any of this');
select pg_temp.check((select count(*) from private.admin_audit where action like 'banner.%') >= 9, 'banner changes are in the staff journal');

drop schema storage cascade;
