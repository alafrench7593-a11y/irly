-- Content its author removes is gone everywhere (20261024009600_irly_content_delete.sql
-- and the purge triggers before it): a Live (deleted, taken down, expired), a
-- community or profile post (removed: deleted_at), a comment (removed).
-- After it: no feed, profile, comment thread, search, saved list, notification,
-- like, share or chat message still carries it; edits are the author's only
-- and reach the feeds and the notices; moderators still read what was reported.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed c9600000-….
--
--   a1 Ana  woman, posts            a3 Cleo woman, Ana's and Ben's friend
--   a2 Ben  man, Ana's friend       a4 Max  IRLY admin (staff)
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
select private.restrict_profile_columns();

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
    raise exception 'FAIL content_delete: %', label;
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
-- Rows a statement changed (0: refused by the row rules without an error).
create or replace function pg_temp.changed(stmt text) returns integer language plpgsql as $$
declare n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;
-- Anything left that names the id (as admin).
create or replace function pg_temp.traces(p_id text) returns integer language sql as $$
  select (select count(*) from public.likes where target_id = p_id)::int
       + (select count(*) from public.saves where target_id = p_id)::int
       + (select count(*) from public.shares where target_id = p_id)::int
       + (select count(*) from public.hidden_items where target_id = p_id)::int
       + (select count(*) from public.comments where target_id = p_id)::int
       + (select count(*) from public.notifications where payload ->> 'post_id' = p_id or payload ->> 'target_id' = p_id or payload ->> 'comment_id' = p_id)::int
$$;

select pg_temp.as_admin();
insert into auth.users (id) values ('c9600000-0000-0000-0000-0000000000a1'), ('c9600000-0000-0000-0000-0000000000a2'),
  ('c9600000-0000-0000-0000-0000000000a3'), ('c9600000-0000-0000-0000-0000000000a4');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c9600000-0000-0000-0000-0000000000a1', 'Ana', '1995-02-02', 'woman', 'dubai'),
  ('c9600000-0000-0000-0000-0000000000a2', 'Ben', '1993-04-04', 'man', 'dubai'),
  ('c9600000-0000-0000-0000-0000000000a3', 'Cleo', '1996-06-06', 'woman', 'dubai'),
  ('c9600000-0000-0000-0000-0000000000a4', 'Max', '1990-01-01', 'man', 'dubai');
insert into public.staff_roles (user_id, role) values ('c9600000-0000-0000-0000-0000000000a4', 'admin');
insert into public.friendships (user_a, user_b, status, requested_by) values
  ('c9600000-0000-0000-0000-0000000000a1', 'c9600000-0000-0000-0000-0000000000a2', 'accepted', 'c9600000-0000-0000-0000-0000000000a1'),
  ('c9600000-0000-0000-0000-0000000000a1', 'c9600000-0000-0000-0000-0000000000a3', 'accepted', 'c9600000-0000-0000-0000-0000000000a1'),
  ('c9600000-0000-0000-0000-0000000000a2', 'c9600000-0000-0000-0000-0000000000a3', 'accepted', 'c9600000-0000-0000-0000-0000000000a2');
-- Ben and Cleo's chat; the community all three are in.
insert into public.conversations (id, kind, title) values ('c9600000-0000-0000-0000-0000000000d1', 'group', 'c96 chat');
insert into public.conversation_members (conversation_id, user_id) values
  ('c9600000-0000-0000-0000-0000000000d1', 'c9600000-0000-0000-0000-0000000000a2'), ('c9600000-0000-0000-0000-0000000000d1', 'c9600000-0000-0000-0000-0000000000a3');
insert into public.communities (id, city_id, name, created_by) values
  ('c9600000-0000-0000-0000-0000000000f1', 'dubai', 'c96 kite club', 'c9600000-0000-0000-0000-0000000000a1');
insert into public.community_members (community_id, user_id, role) values
  ('c9600000-0000-0000-0000-0000000000f1', 'c9600000-0000-0000-0000-0000000000a1', 'owner'),
  ('c9600000-0000-0000-0000-0000000000f1', 'c9600000-0000-0000-0000-0000000000a2', 'member'),
  ('c9600000-0000-0000-0000-0000000000f1', 'c9600000-0000-0000-0000-0000000000a3', 'member');

-- ═════════ 1. A Live deleted by its author ═════════
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a1');
select public.post_live('{"id":"c9600000-0000-0000-0000-0000000000b1","city_id":"dubai","area_id":"marina","body":"c96 sunset kite","visibility":"everyone","media_path":"c9600000-0000-0000-0000-0000000000a1/c9600000-0000-0000-0000-0000000000b1.jpg"}'::jsonb);
select public.post_live('{"id":"c9600000-0000-0000-0000-0000000000b2","city_id":"dubai","area_id":"marina","body":"c96 girl brunch","visibility":"everyone","scope":"girl"}'::jsonb);

-- Ben likes, saves, comments, shares it; Cleo answers him; Ana likes his comment.
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
insert into public.likes (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a2', 'irl_post', 'c9600000-0000-0000-0000-0000000000b1');
insert into public.saves (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a2', 'irl_post', 'c9600000-0000-0000-0000-0000000000b1');
insert into public.comments (id, target_type, target_id, author_id, body) values
  ('c9600000-0000-0000-0000-0000000000e1', 'irl_post', 'c9600000-0000-0000-0000-0000000000b1', 'c9600000-0000-0000-0000-0000000000a2', 'c96 nice kite');
select public.share_to_chat('c9600000-0000-0000-0000-0000000000d1', 'irl_post', 'c9600000-0000-0000-0000-0000000000b1', 'c96 sunset kite');
select public.report('irl_post', null, 'c9600000-0000-0000-0000-0000000000b1', 'spam', 'c96') is not null as reported \gset
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a3');
insert into public.comments (id, target_type, target_id, author_id, body, parent_id) values
  ('c9600000-0000-0000-0000-0000000000e2', 'irl_post', 'c9600000-0000-0000-0000-0000000000b1', 'c9600000-0000-0000-0000-0000000000a3', 'c96 me too', 'c9600000-0000-0000-0000-0000000000e1');
insert into public.saves (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a3', 'irl_post', 'c9600000-0000-0000-0000-0000000000b2');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a1');
insert into public.likes (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a1', 'comment', 'c9600000-0000-0000-0000-0000000000e1');

select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.notifications where user_id = 'c9600000-0000-0000-0000-0000000000a2' and kind = 'IRLY_POST_CREATED' and payload ->> 'post_id' = 'c9600000-0000-0000-0000-0000000000b1') = 1, 'Ben was told about the Live');
select pg_temp.check((select count(*) from public.notifications where user_id = 'c9600000-0000-0000-0000-0000000000a1' and kind in ('LIKE', 'COMMENT') and payload ->> 'target_id' = 'c9600000-0000-0000-0000-0000000000b1') = 3,
  'Ana was told about the like and both comments');
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'c9600000-0000-0000-0000-0000000000a2' and kind = 'COMMENT_REPLY' and payload ->> 'comment_id' = 'c9600000-0000-0000-0000-0000000000e2')
  and exists (select 1 from public.notifications where user_id = 'c9600000-0000-0000-0000-0000000000a2' and kind = 'LIKE' and payload ->> 'target_id' = 'c9600000-0000-0000-0000-0000000000e1'),
  'Ben was told about the reply and the like on his comment');
select pg_temp.check((select body from public.messages where conversation_id = 'c9600000-0000-0000-0000-0000000000d1' and kind = 'share') = 'c96 sunset kite', 'the share in the chat quotes the Live');

-- Search never lists a Live (nor a post): its words are not searchable.
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a3');
select pg_temp.check(not exists (select 1 from public.search_all('c96 sunset', null, 50)), 'search_all never returns a Live''s words');
select pg_temp.check(not exists (select 1 from public.search_all_girl('c96 girl brunch', null, 50)), 'search_all_girl never returns a Live''s words');

-- ───── Edits: the author's only, on the server; they reach the feed and the notice ─────
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.fails($q$select public.edit_live_post('c9600000-0000-0000-0000-0000000000b1', 'c96 hacked')$q$) = '42501', 'someone else cannot edit a Live (edit_live_post)');
select pg_temp.check(pg_temp.changed($q$update public.irl_posts set body = 'c96 hacked' where id = 'c9600000-0000-0000-0000-0000000000b1'$q$) = 0, '… nor write it directly');
select pg_temp.check(pg_temp.changed($q$delete from public.irl_posts where id = 'c9600000-0000-0000-0000-0000000000b1'$q$) = 0, '… nor delete it');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a1');
select public.edit_live_post('c9600000-0000-0000-0000-0000000000b1', 'c96 sunset kite, fixed');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
select pg_temp.check((select body from public.irl_feed('dubai') where id = 'c9600000-0000-0000-0000-0000000000b1') = 'c96 sunset kite, fixed', 'the edit is what the feed shows');
select pg_temp.check((select body from public.member_lives('c9600000-0000-0000-0000-0000000000a1') where id = 'c9600000-0000-0000-0000-0000000000b1') = 'c96 sunset kite, fixed', '… and her profile');
select pg_temp.check((select payload ->> 'body' from public.notifications where kind = 'IRLY_POST_CREATED' and payload ->> 'post_id' = 'c9600000-0000-0000-0000-0000000000b1') = 'c96 sunset kite, fixed',
  '… and Ben''s « Ana is live » notice (not the words she took back)');
select pg_temp.as_admin();
select pg_temp.check((select body from private.removed_content where source = 'irl_posts' and id = 'c9600000-0000-0000-0000-0000000000b1') = 'c96 sunset kite',
  'the words Ben reported are kept for the moderators');

-- ───── Ana deletes it ─────
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.changed($q$delete from public.irl_posts where id = 'c9600000-0000-0000-0000-0000000000b1'$q$) = 1, 'the author deletes her Live');
select pg_temp.check(not exists (select 1 from public.member_lives('c9600000-0000-0000-0000-0000000000a1') where id = 'c9600000-0000-0000-0000-0000000000b1'), 'it is off her own profile');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.irl_feed('dubai') where id = 'c9600000-0000-0000-0000-0000000000b1'), 'it is off the Live feed');
select pg_temp.check(not exists (select 1 from public.member_lives('c9600000-0000-0000-0000-0000000000a1') where id = 'c9600000-0000-0000-0000-0000000000b1'), '… and off her profile for Ben');
select pg_temp.check(not exists (select 1 from public.comment_thread('irl_post', 'c9600000-0000-0000-0000-0000000000b1')), '… its comments are gone');
select pg_temp.check(not exists (select 1 from public.saves), '… and off Ben''s saved list');
select pg_temp.check(not exists (select 1 from public.notifications where payload::text like '%c9600000-0000-0000-0000-0000000000b1%' or payload::text like '%c9600000-0000-0000-0000-0000000000e_%'),
  '… and from his notifications (the Live, the reply, the like of his comment)');
select pg_temp.check(exists (select 1 from public.sync_signals where kind = 'notifs'), '… and his bell is told to reload (Realtime cannot hear that delete)');
select pg_temp.check((select body from public.messages where conversation_id = 'c9600000-0000-0000-0000-0000000000d1' and kind = 'share') = 'This is no longer available',
  'the share in the chat no longer quotes it');
select pg_temp.check(pg_temp.fails($q$select public.share_to_chat('c9600000-0000-0000-0000-0000000000d1', 'irl_post', 'c9600000-0000-0000-0000-0000000000b1', 'c96 again')$q$) = 'P0002', 'it cannot be shared again');
select pg_temp.check(pg_temp.fails($q$insert into public.saves (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a2', 'irl_post', 'c9600000-0000-0000-0000-0000000000b1')$q$) is not null, '… nor saved');
select pg_temp.check(pg_temp.fails($q$insert into public.comments (target_type, target_id, author_id, body) values ('irl_post', 'c9600000-0000-0000-0000-0000000000b1', 'c9600000-0000-0000-0000-0000000000a2', 'c96 hello?')$q$) is not null, '… nor commented');
select pg_temp.check(pg_temp.fails($q$select public.report('irl_post', null, 'c9600000-0000-0000-0000-0000000000b1', 'other', null)$q$) = 'P0002', '… nor reported again');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a3');
select pg_temp.check((select body from public.messages where conversation_id = 'c9600000-0000-0000-0000-0000000000d1' and kind = 'share') = 'This is no longer available', 'Cleo''s copy of the chat says so too');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.traces('c9600000-0000-0000-0000-0000000000b1') = 0 and pg_temp.traces('c9600000-0000-0000-0000-0000000000e1') = 0
  and pg_temp.traces('c9600000-0000-0000-0000-0000000000e2') = 0, 'nothing in the database names the Live or its comments any more');
select pg_temp.check(not exists (select 1 from public.comments where id in ('c9600000-0000-0000-0000-0000000000e1', 'c9600000-0000-0000-0000-0000000000e2')), 'its comments are deleted');

-- The moderators' case still opens, with what was reported.
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a4');
select pg_temp.check((select (public.mod_case(m.id) -> 'target' ->> 'removed')::boolean and public.mod_case(m.id) -> 'target' ->> 'body' = 'c96 sunset kite'
                      from public.moderation_cases m join public.reports r on r.id = m.report_id where r.target_id = 'c9600000-0000-0000-0000-0000000000b1'),
  'the case on the deleted Live shows it removed, with the words that were reported');

-- An IRLY Girl Live deleted: gone from IRLY Girl, Cleo's save with it; it never reached Ben.
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a3');
select pg_temp.check(exists (select 1 from public.irl_feed_girl('dubai') where id = 'c9600000-0000-0000-0000-0000000000b2'), 'Cleo sees the IRLY Girl Live');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.irl_posts where id = 'c9600000-0000-0000-0000-0000000000b2'), 'Ben never sees it (spaces stay apart)');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a1');
delete from public.irl_posts where id = 'c9600000-0000-0000-0000-0000000000b2';
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a3');
select pg_temp.check(not exists (select 1 from public.irl_feed_girl('dubai') where id = 'c9600000-0000-0000-0000-0000000000b2')
  and not exists (select 1 from public.saves where target_id = 'c9600000-0000-0000-0000-0000000000b2'), 'deleted, it is off IRLY Girl''s Live and off Cleo''s saved list');

-- ═════════ 2. A Live taken down (expires_at set to now) ═════════
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a1');
select public.post_live('{"id":"c9600000-0000-0000-0000-0000000000b3","city_id":"dubai","area_id":"marina","body":"c96 takedown me","visibility":"everyone"}'::jsonb);
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
insert into public.likes (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a2', 'irl_post', 'c9600000-0000-0000-0000-0000000000b3');
insert into public.saves (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a2', 'irl_post', 'c9600000-0000-0000-0000-0000000000b3');
insert into public.comments (target_type, target_id, author_id, body) values ('irl_post', 'c9600000-0000-0000-0000-0000000000b3', 'c9600000-0000-0000-0000-0000000000a2', 'c96 meh');
select public.share_to_chat('c9600000-0000-0000-0000-0000000000d1', 'irl_post', 'c9600000-0000-0000-0000-0000000000b3', 'c96 takedown me');
select public.report('irl_post', null, 'c9600000-0000-0000-0000-0000000000b3', 'inappropriate', null) is not null as reported \gset
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a4');
select public.mod_remove_content((select m.id from public.moderation_cases m join public.reports r on r.id = m.report_id where r.target_id = 'c9600000-0000-0000-0000-0000000000b3'), 'c96 takedown');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.traces('c9600000-0000-0000-0000-0000000000b3') = 0, 'a Live taken down loses its likes, saves, shares, comments and notifications');
select pg_temp.check((select body from public.messages where kind = 'share' and ref_id = 'c9600000-0000-0000-0000-0000000000b3') = 'This is no longer available', '… and its share in the chat no longer quotes it');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.irl_feed('dubai') where id = 'c9600000-0000-0000-0000-0000000000b3')
  and not exists (select 1 from public.member_lives('c9600000-0000-0000-0000-0000000000a1') where id = 'c9600000-0000-0000-0000-0000000000b3'), '… and is off the feed and her profile');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($q$select public.edit_live_post('c9600000-0000-0000-0000-0000000000b3', 'c96 back')$q$) = '42501', 'its author cannot edit it back on');
select pg_temp.check(not exists (select 1 from public.irl_feed('dubai') where id = 'c9600000-0000-0000-0000-0000000000b3'), '… and her own feed no longer shows it');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a4');
select pg_temp.check((select (public.mod_case(m.id) -> 'target' ->> 'removed')::boolean and public.mod_case(m.id) -> 'target' ->> 'body' = 'c96 takedown me'
                      from public.moderation_cases m join public.reports r on r.id = m.report_id where r.target_id = 'c9600000-0000-0000-0000-0000000000b3'),
  'its case shows it removed, with its words');

-- ═════════ 3. A Live that simply expired (no event at all) ═════════
select pg_temp.as_admin();
insert into public.irl_posts (id, author_id, city_id, area_id, body, visibility, created_at, expires_at) values
  ('c9600000-0000-0000-0000-0000000000b4', 'c9600000-0000-0000-0000-0000000000a1', 'dubai', 'marina', 'c96 old news', 'everyone', now() - interval '5 hours', now() - interval '1 hour');
insert into public.comments (target_type, target_id, author_id, body) values ('irl_post', 'c9600000-0000-0000-0000-0000000000b4', 'c9600000-0000-0000-0000-0000000000a2', 'c96 earlier comment');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.irl_posts where id = 'c9600000-0000-0000-0000-0000000000b4')
  and not exists (select 1 from public.irl_feed('dubai') where id = 'c9600000-0000-0000-0000-0000000000b4')
  and not exists (select 1 from public.member_lives('c9600000-0000-0000-0000-0000000000a1') where id = 'c9600000-0000-0000-0000-0000000000b4'),
  'an expired Live is off the feed, her profile and a direct read');
select pg_temp.check(not exists (select 1 from public.comment_thread('irl_post', 'c9600000-0000-0000-0000-0000000000b4')), '… its comments are not readable');
select pg_temp.check(pg_temp.fails($q$select public.share_to_chat('c9600000-0000-0000-0000-0000000000d1', 'irl_post', 'c9600000-0000-0000-0000-0000000000b4', 'c96')$q$) = 'P0002'
  and pg_temp.fails($q$insert into public.saves (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a2', 'irl_post', 'c9600000-0000-0000-0000-0000000000b4')$q$) is not null
  and pg_temp.fails($q$insert into public.likes (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a2', 'irl_post', 'c9600000-0000-0000-0000-0000000000b4')$q$) is not null,
  '… and it cannot be shared, saved or liked');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a1');
select pg_temp.check(exists (select 1 from public.member_lives('c9600000-0000-0000-0000-0000000000a1') where id = 'c9600000-0000-0000-0000-0000000000b4' and not live), 'its author keeps it in her own past Lives');

-- ═════════ 4. A community post removed by its author ═════════
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a1');
insert into public.community_posts (id, community_id, author_id, body) values
  ('c9600000-0000-0000-0000-0000000001a1', 'c9600000-0000-0000-0000-0000000000f1', 'c9600000-0000-0000-0000-0000000000a1', 'c96 kite meetup friday');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
insert into public.likes (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a2', 'community_post', 'c9600000-0000-0000-0000-0000000001a1');
insert into public.saves (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a2', 'community_post', 'c9600000-0000-0000-0000-0000000001a1');
insert into public.comments (id, target_type, target_id, author_id, body) values
  ('c9600000-0000-0000-0000-0000000000e3', 'community_post', 'c9600000-0000-0000-0000-0000000001a1', 'c9600000-0000-0000-0000-0000000000a2', 'c96 count me in');
select public.share_to_chat('c9600000-0000-0000-0000-0000000000d1', 'community_post', 'c9600000-0000-0000-0000-0000000001a1', 'c96 kite meetup friday');
select public.report('community_post', null, 'c9600000-0000-0000-0000-0000000001a1', 'spam', null) is not null as reported \gset
select pg_temp.check((select payload ->> 'body' from public.notifications where kind = 'COMMUNITY_POST' and payload ->> 'post_id' = 'c9600000-0000-0000-0000-0000000001a1') = 'c96 kite meetup friday', 'Ben was told about the post');
select pg_temp.check(pg_temp.changed($q$update public.community_posts set body = 'c96 hacked' where id = 'c9600000-0000-0000-0000-0000000001a1'$q$) = 0
  and pg_temp.changed($q$update public.community_posts set deleted_at = now() where id = 'c9600000-0000-0000-0000-0000000001a1'$q$) = 0, 'a member cannot edit or remove someone else''s post');

select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a1');
update public.community_posts set body = 'c96 kite meetup saturday', edited_at = now() where id = 'c9600000-0000-0000-0000-0000000001a1';
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
select pg_temp.check((select body from public.community_feed('c9600000-0000-0000-0000-0000000000f1') where id = 'c9600000-0000-0000-0000-0000000001a1') = 'c96 kite meetup saturday', 'the edit is what the community feed shows');
select pg_temp.check((select payload ->> 'body' from public.notifications where kind = 'COMMUNITY_POST' and payload ->> 'post_id' = 'c9600000-0000-0000-0000-0000000001a1') = 'c96 kite meetup saturday', '… and Ben''s notice');

select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.changed($q$update public.community_posts set deleted_at = now() where id = 'c9600000-0000-0000-0000-0000000001a1'$q$) = 1, 'the author removes her post');
select pg_temp.check(not exists (select 1 from public.community_feed('c9600000-0000-0000-0000-0000000000f1') where id = 'c9600000-0000-0000-0000-0000000001a1'), 'it is off the feed, also for her');
select pg_temp.check(pg_temp.fails($q$insert into public.saves (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a1', 'community_post', 'c9600000-0000-0000-0000-0000000001a1')$q$) is not null
  and pg_temp.fails($q$insert into public.likes (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a1', 'community_post', 'c9600000-0000-0000-0000-0000000001a1')$q$) is not null,
  'nobody, not even its author, saves or likes a removed post');
select pg_temp.check(pg_temp.fails($q$update public.community_posts set deleted_at = null where id = 'c9600000-0000-0000-0000-0000000001a1'$q$) = '42501', 'a removed post cannot be restored');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.community_posts where id = 'c9600000-0000-0000-0000-0000000001a1')
  and not exists (select 1 from public.community_feed('c9600000-0000-0000-0000-0000000000f1') where id = 'c9600000-0000-0000-0000-0000000001a1'), 'Ben no longer reads it, directly or in the feed');
select pg_temp.check(not exists (select 1 from public.comment_thread('community_post', 'c9600000-0000-0000-0000-0000000001a1')), '… nor its comments');
select pg_temp.check((select body from public.messages where kind = 'share' and ref_id = 'c9600000-0000-0000-0000-0000000001a1') = 'This is no longer available', '… and the chat share no longer quotes it');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.traces('c9600000-0000-0000-0000-0000000001a1') = 0 and pg_temp.traces('c9600000-0000-0000-0000-0000000000e3') = 0, 'nothing names the removed post or its comment any more');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a4');
select pg_temp.check((select (public.mod_case(m.id) -> 'target' ->> 'removed')::boolean and public.mod_case(m.id) -> 'target' ->> 'reported' = 'c96 kite meetup friday'
                      from public.moderation_cases m join public.reports r on r.id = m.report_id where r.target_id = 'c9600000-0000-0000-0000-0000000001a1'),
  'its case shows it removed, and the words reported before the edit');

-- A profile post (no community): removed, it leaves Ben's saved list.
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a1');
insert into public.community_posts (id, author_id, body) values ('c9600000-0000-0000-0000-0000000001a2', 'c9600000-0000-0000-0000-0000000000a1', 'c96 my profile post');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
insert into public.saves (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a2', 'community_post', 'c9600000-0000-0000-0000-0000000001a2');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a1');
update public.community_posts set deleted_at = now() where id = 'c9600000-0000-0000-0000-0000000001a2';
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.saves where target_id = 'c9600000-0000-0000-0000-0000000001a2')
  and not exists (select 1 from public.community_posts where id = 'c9600000-0000-0000-0000-0000000001a2'), 'a removed profile post is off Ben''s saved list and unreadable');

-- ═════════ 5. A comment removed by its author ═════════
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a1');
select public.post_live('{"id":"c9600000-0000-0000-0000-0000000000b5","city_id":"dubai","area_id":"marina","body":"c96 beach run","visibility":"everyone"}'::jsonb);
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
insert into public.comments (id, target_type, target_id, author_id, body, mentions) values
  ('c9600000-0000-0000-0000-0000000000e5', 'irl_post', 'c9600000-0000-0000-0000-0000000000b5', 'c9600000-0000-0000-0000-0000000000a2', 'c96 rude words', array['c9600000-0000-0000-0000-0000000000a3'::uuid]);
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a3');
insert into public.likes (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a3', 'comment', 'c9600000-0000-0000-0000-0000000000e5');
select public.report('comment', null, 'c9600000-0000-0000-0000-0000000000e5', 'harassment', null) is not null as reported \gset
select pg_temp.check((select payload ->> 'body' from public.notifications where kind = 'MENTION' and payload ->> 'comment_id' = 'c9600000-0000-0000-0000-0000000000e5') = 'c96 rude words', 'Cleo was told she was mentioned');
select pg_temp.check(pg_temp.changed($q$update public.comments set body = 'c96 not mine' where id = 'c9600000-0000-0000-0000-0000000000e5'$q$) = 0, 'someone else cannot edit a comment');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
update public.comments set body = 'c96 kind words', edited_at = now() where id = 'c9600000-0000-0000-0000-0000000000e5';
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a3');
select pg_temp.check((select body from public.comment_thread('irl_post', 'c9600000-0000-0000-0000-0000000000b5') where id = 'c9600000-0000-0000-0000-0000000000e5') = 'c96 kind words', 'the edited comment shows in the thread');
select pg_temp.check((select payload ->> 'body' from public.notifications where kind = 'MENTION' and payload ->> 'comment_id' = 'c9600000-0000-0000-0000-0000000000e5') = 'c96 kind words', '… and in Cleo''s notice');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a2');
update public.comments set deleted_at = now() where id = 'c9600000-0000-0000-0000-0000000000e5';
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a3');
select pg_temp.check((select deleted and body = '' from public.comment_thread('irl_post', 'c9600000-0000-0000-0000-0000000000b5') where id = 'c9600000-0000-0000-0000-0000000000e5'), 'a removed comment shows as removed, without its words');
select pg_temp.check(not exists (select 1 from public.notifications where payload ->> 'comment_id' = 'c9600000-0000-0000-0000-0000000000e5' or payload ->> 'target_id' = 'c9600000-0000-0000-0000-0000000000e5'), '… and leaves Cleo''s notifications');
select pg_temp.check(pg_temp.fails($q$insert into public.likes (user_id, target_type, target_id) values ('c9600000-0000-0000-0000-0000000000a3', 'comment', 'c9600000-0000-0000-0000-0000000000e5')$q$) is not null, '… and cannot be liked any more');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.likes where target_id = 'c9600000-0000-0000-0000-0000000000e5'), 'its likes are gone');
select pg_temp.as_user('c9600000-0000-0000-0000-0000000000a4');
select pg_temp.check((select (public.mod_case(m.id) -> 'target' ->> 'removed')::boolean and public.mod_case(m.id) -> 'target' ->> 'body' = 'c96 rude words'
                      from public.moderation_cases m join public.reports r on r.id = m.report_id where r.target_id = 'c9600000-0000-0000-0000-0000000000e5'),
  'its case shows the words that were reported, not « — » nor the edit');

-- ═════════ 6. Cleanup ═════════
select pg_temp.as_admin();
delete from public.messages where conversation_id = 'c9600000-0000-0000-0000-0000000000d1';
delete from public.conversations where id = 'c9600000-0000-0000-0000-0000000000d1';
delete from public.communities where id = 'c9600000-0000-0000-0000-0000000000f1';
delete from private.removed_content where id::text like 'c9600000-%';
delete from public.irl_posts where id::text like 'c9600000-%';
delete from public.community_posts where id::text like 'c9600000-%';
delete from public.reports where reporter_id::text like 'c9600000-%';
delete from public.staff_roles where user_id::text like 'c9600000-%';
delete from public.friendships where user_a::text like 'c9600000-%';
delete from public.profiles where id::text like 'c9600000-%';
delete from auth.users where id::text like 'c9600000-%';
select pg_temp.check(not exists (select 1 from public.profiles where id::text like 'c9600000-%'), 'content_delete test data cleaned up');
