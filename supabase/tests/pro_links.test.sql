-- IRLY Network links (migration 20261024008000_irly_pro_links): the four link
-- columns of pro_profiles take only safe https links (the platform's own host
-- for LinkedIn, Instagram and TikTok, a real domain for a website), an empty
-- field is no link, only the owner writes them, and others read them through
-- pro_links_of exactly where the professional profile is readable (visible,
-- not blocked, profile visibility). Runs after irly_test.sql on the same
-- database (scripts/test-db.sh); ids use the prefix e8000000-…
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
    raise exception 'FAIL pro_links: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

-- The SQLSTATE a statement fails with (null when it succeeds).
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

select pg_temp.as_admin();

insert into auth.users (id) values
  ('e8000000-0000-0000-0000-0000000000a1'), ('e8000000-0000-0000-0000-0000000000a2'), ('e8000000-0000-0000-0000-0000000000a3');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('e8000000-0000-0000-0000-0000000000a1', 'Nora', '1991-03-03', 'woman', 'dubai'),
  ('e8000000-0000-0000-0000-0000000000a2', 'Karim', '1990-05-05', 'man', 'dubai'),
  ('e8000000-0000-0000-0000-0000000000a3', 'Ines', '1993-08-08', 'woman', 'dubai');

-- 0. The columns are additive: nullable, no default, a profile without links still saves.
select pg_temp.check((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'pro_profiles'
  and column_name in ('linkedin_url', 'website_url', 'instagram_url', 'tiktok_url') and is_nullable = 'YES' and column_default is null) = 4,
  'four nullable link columns');

select pg_temp.as_user('e8000000-0000-0000-0000-0000000000a1');
insert into public.pro_profiles (user_id, role, job_title, industries, city_id) values
  ('e8000000-0000-0000-0000-0000000000a1', 'founder', 'Founder', '{ai}', 'dubai');
select pg_temp.check((select linkedin_url is null and website_url is null and instagram_url is null and tiktok_url is null
  from public.pro_profiles where user_id = auth.uid()), 'a profile without links has none');

-- 1. The owner sets valid links (trimmed).
update public.pro_profiles set
  linkedin_url = '  https://www.linkedin.com/in/nora-haddad  ',
  website_url = 'https://nora.studio/work?ref=irly',
  instagram_url = 'https://www.instagram.com/nora.builds',
  tiktok_url = 'https://www.tiktok.com/@nora.builds'
where user_id = auth.uid();
select pg_temp.check((select linkedin_url from public.pro_profiles where user_id = auth.uid()) = 'https://www.linkedin.com/in/nora-haddad', 'links are trimmed');
select pg_temp.check((select count(*) from public.pro_links_of(auth.uid()) where website_url = 'https://nora.studio/work?ref=irly' and tiktok_url is not null) = 1,
  'the owner reads her own links');

-- Other accepted shapes.
select pg_temp.check(pg_temp.fails($$update public.pro_profiles set linkedin_url = 'https://ae.linkedin.com/company/irly/' where user_id = auth.uid()$$) is null, 'linkedin: country host and company page');
select pg_temp.check(pg_temp.fails($$update public.pro_profiles set website_url = 'https://irly.app' where user_id = auth.uid()$$) is null, 'website: bare domain');
select pg_temp.check(pg_temp.fails($$update public.pro_profiles set instagram_url = 'https://instagram.com/nora_b/' where user_id = auth.uid()$$) is null, 'instagram: without www, trailing slash');

-- 2. An empty field is no link.
update public.pro_profiles set website_url = '   ', tiktok_url = '' where user_id = auth.uid();
select pg_temp.check((select website_url is null and tiktok_url is null from public.pro_profiles where user_id = auth.uid()), 'empty links are stored as none');

-- 3. Anything else is refused by the server (23514 = check violation).
select pg_temp.check(pg_temp.fails(format($$update public.pro_profiles set %I = %L where user_id = auth.uid()$$, c, v)) = '23514', format('refused: %s = %s', c, v))
from (values
  ('linkedin_url', 'http://www.linkedin.com/in/nora'),
  ('linkedin_url', 'https://linkedin.com.evil.io/in/nora'),
  ('linkedin_url', 'https://evil.io/linkedin.com/in/nora'),
  ('linkedin_url', 'https://www.linkedin.com/feed/'),
  ('linkedin_url', 'https://www.linkedin.com/in/nora?trk=x'),
  ('linkedin_url', 'javascript:alert(1)//linkedin.com/in/nora'),
  ('website_url', 'http://nora.studio'),
  ('website_url', 'nora.studio'),
  ('website_url', 'javascript:alert(1)'),
  ('website_url', 'https://user:pass@nora.studio'),
  ('website_url', 'https://127.0.0.1/admin'),
  ('website_url', 'https://localhost/'),
  ('website_url', 'https://nora.studio:8443/'),
  ('website_url', 'https://nora .studio'),
  ('website_url', 'https://nora.studio/<script>'),
  ('website_url', 'https://nora.studio/' || repeat('a', 190)),
  ('instagram_url', 'https://www.instagram.com/p/abc/xyz'),
  ('instagram_url', 'https://instagram.co/nora'),
  ('instagram_url', 'https://www.instagram.com/' || repeat('a', 31)),
  ('tiktok_url', 'https://www.tiktok.com/nora'),
  ('tiktok_url', 'https://vm.tiktok.com/@nora'),
  ('tiktok_url', 'https://www.tiktok.com/@nora/video/123')
) as bad (c, v);

-- Put the full set back for the read tests.
update public.pro_profiles set linkedin_url = 'https://www.linkedin.com/in/nora-haddad', website_url = 'https://nora.studio',
  instagram_url = 'https://www.instagram.com/nora.builds', tiktok_url = 'https://www.tiktok.com/@nora.builds' where user_id = auth.uid();

-- 4. Nobody else writes or reads the row directly.
select pg_temp.as_user('e8000000-0000-0000-0000-0000000000a2');
insert into public.pro_profiles (user_id, role, job_title, industries, city_id) values
  ('e8000000-0000-0000-0000-0000000000a2', 'investor', 'Angel investor', '{fintech}', 'dubai');
update public.pro_profiles set website_url = 'https://phish.example.com' where user_id = 'e8000000-0000-0000-0000-0000000000a1';
select pg_temp.check(not exists (select 1 from public.pro_profiles where user_id = 'e8000000-0000-0000-0000-0000000000a1'), 'another member cannot read the row directly');
select pg_temp.as_admin();
select pg_temp.check((select website_url from public.pro_profiles where user_id = 'e8000000-0000-0000-0000-0000000000a1') = 'https://nora.studio', 'another member cannot change her links');

-- 5. Readable where the professional profile is readable.
select pg_temp.as_user('e8000000-0000-0000-0000-0000000000a2');
select pg_temp.check((select linkedin_url from public.pro_links_of('e8000000-0000-0000-0000-0000000000a1')) = 'https://www.linkedin.com/in/nora-haddad', 'a member reads the links of a visible profile');
select pg_temp.check(exists (select 1 from public.pro_profile_of('e8000000-0000-0000-0000-0000000000a1')), 'pro_profile_of is unchanged');
select pg_temp.check(not exists (select 1 from public.pro_links_of('e8000000-0000-0000-0000-0000000000a3')), 'no professional profile: no links');

-- Hidden from Networking: no links either (the owner still reads hers).
select pg_temp.as_user('e8000000-0000-0000-0000-0000000000a1');
update public.pro_profiles set visible = false where user_id = auth.uid();
select pg_temp.check(exists (select 1 from public.pro_links_of(auth.uid())), 'a hidden profile: the owner still reads her links');
select pg_temp.as_user('e8000000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.pro_links_of('e8000000-0000-0000-0000-0000000000a1')), 'a hidden profile: others do not read the links');
select pg_temp.as_user('e8000000-0000-0000-0000-0000000000a1');
update public.pro_profiles set visible = true where user_id = auth.uid();

-- Blocked either way: no links.
insert into public.blocks (blocker_id, blocked_id) values ('e8000000-0000-0000-0000-0000000000a1', 'e8000000-0000-0000-0000-0000000000a2');
select pg_temp.as_user('e8000000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.pro_links_of('e8000000-0000-0000-0000-0000000000a1')), 'blocked: the blocked member does not read the links');
select pg_temp.as_user('e8000000-0000-0000-0000-0000000000a1');
select pg_temp.check(not exists (select 1 from public.pro_links_of('e8000000-0000-0000-0000-0000000000a2')), 'blocked: the blocker does not read theirs');
delete from public.blocks where blocker_id = 'e8000000-0000-0000-0000-0000000000a1' and blocked_id = 'e8000000-0000-0000-0000-0000000000a2';

-- Profile visibility "nobody": no links.
select pg_temp.as_admin();
insert into public.safety_settings (user_id, profile_visibility) values ('e8000000-0000-0000-0000-0000000000a1', 'nobody')
on conflict (user_id) do update set profile_visibility = 'nobody';
select pg_temp.as_user('e8000000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.pro_links_of('e8000000-0000-0000-0000-0000000000a1')), 'profile visible to nobody: no links');
select pg_temp.as_admin();
update public.safety_settings set profile_visibility = 'everyone' where user_id = 'e8000000-0000-0000-0000-0000000000a1';

-- 6. Signed out: nothing (not even a call).
select pg_temp.as_admin();
set role anon;
select pg_temp.check(pg_temp.fails($$select * from public.pro_links_of('e8000000-0000-0000-0000-0000000000a1')$$) = '42501', 'anon cannot call pro_links_of');
reset role;

-- 7. The data export still carries the professional profile, links included.
select pg_temp.check((select to_jsonb(x) ? 'linkedin_url' from public.pro_profiles x where x.user_id = 'e8000000-0000-0000-0000-0000000000a1'), 'the export row has the links');

select pg_temp.as_admin();
delete from public.pro_profiles where user_id in ('e8000000-0000-0000-0000-0000000000a1', 'e8000000-0000-0000-0000-0000000000a2');
