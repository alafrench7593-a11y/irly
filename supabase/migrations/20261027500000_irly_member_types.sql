-- Sign-up answer "Who are you?" kept on the server (2026-10-27). Additive: one column.
--
-- The first sign-up step asks who the member is (expat, local, tourist,
-- entrepreneur, professional, student, nomad; up to 3). The answer only lived
-- on the phone: a member signing in on a new phone (or after a reinstall) got
-- their profile back without it, so their profile badges and the official
-- communities suggested from it (type:… tags) changed for no reason.
--
-- Private like the birth date: left out of the profile columns other members
-- may read (restrict_profile_columns, below); the owner reads it back through
-- my_profile() (security definer). Writable by the owner only, under
-- the existing profiles RLS policies. Test: supabase/tests/member_types.test.sql.

alter table public.profiles
  add column if not exists member_types text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_member_types_valid') then
    alter table public.profiles add constraint profiles_member_types_valid check (
      cardinality(member_types) <= 3
      and member_types <@ array['expat', 'local', 'tourist', 'entrepreneur', 'professional', 'student', 'nomad']::text[]
    );
  end if;
end $$;

-- Kept private for good: the column list other members may read leaves it out
-- too, so a later run of restrict_profile_columns() never exposes it. Same
-- function as migration 20261005001800, one more name in the exclusion list.
create or replace function private.restrict_profile_columns() returns void
language plpgsql security definer set search_path = public as $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
    and column_name not in ('birthdate', 'faith', 'gender', 'is_admin', 'area_id', 'city_id', 'member_types');
  execute 'revoke select on public.profiles from anon, authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;
revoke all on function private.restrict_profile_columns() from public, anon, authenticated;
select private.restrict_profile_columns();
