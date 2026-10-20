-- IRLY community titles: never a code ("Girls Padel mvgq82y1").
--
-- Where the codes come from: the end-to-end scripts (scripts/e2e-girl.mjs,
-- e2e-sync.mjs, e2e-ui.mjs) run against the live backend with throwaway
-- accounts and name their communities after the run, `${words} ${run}` with
-- run = Date.now().toString(36) ("Girls Padel mvgq82y1", "Book & Matcha
-- mvgq82y1", "Sync club …", "Photo club … Bali", "E2E Padel …"). Their
-- cleanup deletes the accounts straight from auth.users; that skips
-- delete_my_account, so the community survives: created_by becomes null
-- (communities_created_by_fkey ON DELETE SET NULL), the members go, and the
-- row reads like a community IRLY itself runs, listed in Dubai and Bali with
-- its run stamp in the title. 20261019000100 removed one by hand ("Sync club
-- mv00tl2o"); this fixes the cause and every row still showing a code.
--
-- 1. private.community_word_is_technical(): the one rule for a word that is a
--    code (uuid, "#12345", "abc12345", a base-36 run stamp, a uuid fragment),
--    the same as src/features/community/name.ts on the phone.
-- 2. Existing rows, only those IRLY or a deleted account left (created_by is
--    null, or official), and only when a word of the name is a code:
--      - nobody in it: removed the way delete_community removes one
--        (deleted_at; row, posts and chat history kept for moderation);
--      - members in it: renamed in place (same id, members, posts, chat; the
--        chat title follows through communities_chat_title), the code
--        dropped; a name another community of the city already has gets the
--        city ("Girls Padel · Dubai"); a name with nothing left is the topic
--        or category and the city ("Gym & Fitness · Dubai").
--    A name a member chose (created_by set) is never touched.
-- 3. The generator: an account deleted any way other than delete_my_account
--    takes the communities only it was in with it (as delete_my_account
--    does), so no orphan is left behind again. The e2e scripts also remove
--    their communities before their accounts.

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
    when w ~ '^[0-9a-f]{8,}$' and regexp_count(w, '[0-9]') >= 2 and regexp_count(w, '[a-f]') >= 2 then true
    else false
  end
$$;
revoke all on function private.community_word_is_technical(text) from public, anon, authenticated;

create or replace function private.community_name_is_technical(p_name text) returns boolean
language sql immutable set search_path = pg_catalog, private as $$
  select coalesce(btrim(p_name), '') = ''
      or exists (select 1 from regexp_split_to_table(btrim(p_name), '\s+') w where private.community_word_is_technical(w))
$$;
revoke all on function private.community_name_is_technical(text) from public, anon, authenticated;

-- The name without its codes; null when nothing readable is left.
create or replace function private.community_clean_name(p_name text) returns text
language sql immutable set search_path = pg_catalog, private as $$
  select case when char_length(k) >= 3 and k ~ '[[:alpha:]]' then k end
  from (
    select btrim(regexp_replace(string_agg(w, ' ' order by n), '^[[:space:]·|:,–-]+|[[:space:]·|:,–-]+$', '', 'g')) as k
    from regexp_split_to_table(btrim(coalesce(p_name, '')), '\s+') with ordinality t (w, n)
    where w <> '' and not private.community_word_is_technical(w)
  ) x
$$;
revoke all on function private.community_clean_name(text) from public, anon, authenticated;

create or replace function private.community_city_label(p_city text) returns text
language sql immutable set search_path = pg_catalog as $$
  select case p_city
    when 'dubai' then 'Dubai' when 'abudhabi' then 'Abu Dhabi' when 'sharjah' then 'Sharjah'
    when 'ajman' then 'Ajman' when 'rak' then 'Ras Al Khaimah' when 'fujairah' then 'Fujairah'
    when 'uaq' then 'Umm Al Quwain' when 'bali' then 'Bali'
    else initcap(replace(coalesce(p_city, ''), '_', ' '))
  end
$$;
revoke all on function private.community_city_label(text) from public, anon, authenticated;

-- "Gym & Fitness · Dubai": what it is about and where (same labels as name.ts).
create or replace function private.community_fallback_name(p_topic text, p_category text, p_city text) returns text
language sql immutable set search_path = pg_catalog, private as $$
  select concat_ws(' · ',
    coalesce(
      case p_topic
        when 'gym' then 'Gym & Fitness' when 'sport' then 'Sport' when 'football' then 'Football'
        when 'running' then 'Running' when 'trip' then 'Trips' when 'beach' then 'Beach' when 'food' then 'Food'
        when 'network' then 'Network' when 'entrepreneurs' then 'Entrepreneurs' when 'ecom' then 'E-commerce'
        when 'tech' then 'Tech' when 'ai' then 'AI' when 'girls' then 'IRLY Girl' when 'moms' then 'IRLY Moms'
        when 'families' then 'IRLY Family' when 'newcomers' then 'Newcomers' when 'lifestyle' then 'Lifestyle'
        when 'nights' then 'Nights out' when 'help' then 'Help & Questions'
      end,
      nullif(initcap(replace(coalesce(p_topic, ''), '_', ' ')), ''),
      nullif(initcap(replace(coalesce(p_category, ''), '_', ' ')), ''),
      'Community'),
    nullif(private.community_city_label(p_city), ''))
$$;
revoke all on function private.community_fallback_name(text, text, text) from public, anon, authenticated;

-- Existing rows. Safe to run again: a fixed row has no code left.
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
    where c.deleted_at is null and (c.created_by is null or c.official)
      and private.community_name_is_technical(c.name)
    order by c.created_at, c.id
  loop
    if not exists (select 1 from public.community_members m where m.community_id = r.id) then
      -- A test leftover nobody is in: gone from every list, history kept (as delete_community).
      update public.communities set deleted_at = now() where (id = r.id or parent_id = r.id) and deleted_at is null;
      delete from public.conversation_members cm using public.conversations v, public.communities x
      where v.community_id = x.id and (x.id = r.id or x.parent_id = r.id) and cm.conversation_id = v.id;
    else
      base := coalesce(private.community_clean_name(r.name), private.community_fallback_name(r.topic, r.category_id, r.city_id));
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

-- The generator: an account deleted outside delete_my_account (straight from
-- auth.users, the dashboard, a script) takes with it the communities only it
-- was in and that it created or owned, the way delete_my_account does. A
-- community other members are in stays, and is remembered as orphaned: when
-- the last of those members' accounts is deleted the same way (the e2e runs
-- delete all their accounts at once, in any order), it goes too. Runs before
-- the delete, while the creator and the memberships are still there.
create table if not exists private.orphaned_communities (
  community_id uuid primary key references public.communities (id) on delete cascade,
  at timestamptz not null default now()
);
revoke all on private.orphaned_communities from public, anon, authenticated;

create or replace function private.retire_lone_communities() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  with gone as (
    update public.communities c set deleted_at = now()
    where c.deleted_at is null and not c.official
      and (c.created_by = old.id
        or exists (select 1 from public.community_members m where m.community_id = c.id and m.user_id = old.id and m.role = 'owner')
        or (exists (select 1 from private.orphaned_communities o where o.community_id = c.id)
            and exists (select 1 from public.community_members m where m.community_id = c.id and m.user_id = old.id)))
      and not exists (select 1 from public.community_members m where m.community_id = c.id and m.user_id <> old.id)
    returning c.id
  ), groups as (
    update public.communities g set deleted_at = now()
    from gone where g.parent_id = gone.id and g.deleted_at is null
    returning g.id
  )
  delete from public.conversation_members cm
  using public.conversations v
  where cm.conversation_id = v.id
    and (v.community_id in (select id from gone) or v.community_id in (select id from groups));
  -- Lives on with other members: its creator is gone (created_by becomes null).
  insert into private.orphaned_communities (community_id)
  select c.id from public.communities c
  where c.created_by = old.id and c.deleted_at is null and not c.official
  on conflict (community_id) do nothing;
  return old;
end $$;
revoke all on function private.retire_lone_communities() from public, anon, authenticated;
drop trigger if exists profiles_retire_lone_communities on public.profiles;
create trigger profiles_retire_lone_communities before delete on public.profiles
for each row execute function private.retire_lone_communities();

-- ───────── Likes and saves: one per member, whatever the timing ─────────
-- Two toggles of the same member at once (two phones, two screens) both
-- found nothing to delete and both inserted: the second hit likes_pkey and
-- the app rolled back a like the server had kept. The second one now finds
-- the like there and leaves it (still one row: the primary key).
create or replace function public.toggle_like(p_type text, p_id text) returns boolean
language plpgsql set search_path = public as $$
begin
  delete from public.likes where user_id = auth.uid() and target_type = p_type and target_id = p_id;
  if found then return false; end if;
  insert into public.likes (user_id, target_type, target_id) values (auth.uid(), p_type, p_id)
  on conflict (user_id, target_type, target_id) do nothing;
  return true;
end $$;

create or replace function public.toggle_save(p_type text, p_id text) returns boolean
language plpgsql set search_path = public as $$
begin
  delete from public.saves where user_id = auth.uid() and target_type = p_type and target_id = p_id;
  if found then return false; end if;
  insert into public.saves (user_id, target_type, target_id) values (auth.uid(), p_type, p_id)
  on conflict (user_id, target_type, target_id) do nothing;
  return true;
end $$;
revoke all on function public.toggle_like(text, text), public.toggle_save(text, text) from public, anon;
grant execute on function public.toggle_like(text, text), public.toggle_save(text, text) to authenticated;
