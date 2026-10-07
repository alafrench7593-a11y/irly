-- Launch waitlist from the website (irly/site). Visitors are not signed in,
-- so the only way in is join_waitlist(): it validates the address, stores
-- it once (lower-cased) and answers the same way whether or not it was
-- already there, so nobody can test which addresses are on the list.
-- Only IRLY's team (admin rights) can read the list.
create table if not exists public.waitlist (
  email text primary key check (char_length(email) between 6 and 254),
  lang text not null default 'en' check (lang in ('en', 'fr', 'ar')),
  source text check (source is null or char_length(source) <= 40),
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
drop policy if exists waitlist_admin on public.waitlist;
create policy waitlist_admin on public.waitlist for select to authenticated using (private.is_admin());
revoke all on public.waitlist from anon, authenticated;
grant select on public.waitlist to authenticated;

create or replace function public.join_waitlist(p_email text, p_lang text default 'en', p_source text default null)
returns text
language plpgsql security definer set search_path = public, private as $$
declare
  e text := lower(btrim(coalesce(p_email, '')));
begin
  if char_length(e) > 254 or e !~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  -- No flooding: at most 120 new addresses in 10 minutes for everyone.
  if (select count(*) from public.waitlist where created_at > now() - interval '10 minutes') >= 120 then
    raise exception 'slow down: try again in a few minutes' using errcode = '54000';
  end if;
  insert into public.waitlist (email, lang, source)
  values (e, case when p_lang in ('en', 'fr', 'ar') then p_lang else 'en' end, left(p_source, 40))
  on conflict (email) do nothing;
  return 'ok';
end $$;
revoke all on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;

-- Waitlist addresses are kept 24 months at most.
create or replace function private.purge_retention() returns void
language plpgsql security definer set search_path = public, private as $$
begin
  delete from public.reports r
  using public.moderation_cases m
  where m.report_id = r.id and m.status in ('actioned', 'dismissed') and m.updated_at < now() - interval '12 months';
  delete from private.removed_content where removed_at < now() - interval '12 months';
  delete from public.support_requests where created_at < now() - interval '24 months';
  delete from public.waitlist where created_at < now() - interval '24 months';
end $$;
revoke all on function private.purge_retention() from public, anon, authenticated;
drop trigger if exists waitlist_retention on public.waitlist;
create trigger waitlist_retention after insert on public.waitlist
for each statement execute function private.retention_tick();
