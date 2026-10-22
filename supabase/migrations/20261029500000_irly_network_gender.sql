-- IRLY Network speaks French with the right gender (2026-10-29). A woman's
-- professional profile read « Fondateur », « Investisseur », « Salarié »:
-- the app had no way to know whom the words are about, since profiles.gender
-- is not readable by other members (column grants) and pro_discover /
-- pro_profile_of do not return it.
--
-- Additive: one read-only function, nothing else changes (no table, no
-- policy, no data). pro_genders_of returns the declared gender ('woman',
-- 'man', 'other') of professionals whose professional profile you may see,
-- with exactly the rule of pro_profile_of and pro_links_of (yours, or a
-- visible profile, not blocked either way, profile visibility): nowhere
-- else, and only for a professional profile. The app uses it only to make
-- French words agree (« Fondatrice », « Fondateur », « Fondateur·rice »).
-- The existing functions keep their columns, so installed apps are unchanged;
-- an app reading a server without this function shows the inclusive form.
-- Tests: supabase/tests/pro_gender.test.sql.

create or replace function public.pro_genders_of(p_users uuid[])
returns table (user_id uuid, gender text)
language sql stable security definer set search_path = public as $$
  select p.user_id, pr.gender
  from public.pro_profiles p
  join public.profiles pr on pr.id = p.user_id and pr.deleted_at is null
  where auth.uid() is not null
    and p.user_id = any ((coalesce(p_users, '{}'::uuid[]))[1:200])
    and (p.user_id = auth.uid() or (p.visible and not private.blocked_unchecked(auth.uid(), p.user_id) and private.discoverable(p.user_id)))
$$;
revoke all on function public.pro_genders_of(uuid[]) from public, anon;
grant execute on function public.pro_genders_of(uuid[]) to authenticated;
