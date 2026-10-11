-- Contact form of the website (getirly.com/support). Visitors are not signed
-- in, so the only way in is contact_support(): it checks the reply address,
-- the topic and the message, drops what a bot filled in (the hidden
-- "website" field), limits how often one address can write, and stores the
-- request with the others (support_requests, read by IRLY's team with admin
-- rights, kept 24 months). Visitors can never read anything back.

alter table public.support_requests add column if not exists subject text
  check (subject is null or char_length(subject) <= 40);
alter table public.support_requests add column if not exists source text not null default 'app'
  check (source in ('app', 'web'));
alter table public.support_requests add column if not exists lang text
  check (lang is null or lang in ('en', 'fr', 'ar'));

create or replace function public.contact_support(
  p_email text, p_subject text, p_message text, p_lang text default 'en', p_website text default null)
returns text
language plpgsql security definer set search_path = public, private as $$
declare
  e text := lower(btrim(coalesce(p_email, '')));
  m text := btrim(coalesce(p_message, ''));
  k text;
begin
  -- A bot fills every field; people never see this one. Same answer, nothing stored.
  if coalesce(btrim(p_website), '') <> '' then
    return 'ok';
  end if;
  if char_length(e) > 200 or e !~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  k := case p_subject
    when 'account' then 'question'
    when 'login' then 'problem'
    when 'bug' then 'problem'
    when 'safety' then 'safety'
    when 'privacy' then 'privacy'
    when 'delete' then 'privacy'
    when 'other' then 'question'
  end;
  if k is null then
    raise exception 'invalid subject' using errcode = '22023';
  end if;
  if char_length(m) < 10 or char_length(m) > 2000 then
    raise exception 'invalid message' using errcode = '22023';
  end if;
  -- No flooding: 3 requests an hour per address, 60 in 10 minutes for everyone.
  if (select count(*) from public.support_requests where source = 'web' and contact = e and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.support_requests where source = 'web' and created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'slow down: try again later' using errcode = '54000';
  end if;
  insert into public.support_requests (user_id, kind, subject, body, contact, platform, source, lang)
  values (null, k, p_subject, m, e, 'web', 'web', case when p_lang in ('en', 'fr', 'ar') then p_lang else 'en' end);
  return 'ok';
end $$;
revoke all on function public.contact_support(text, text, text, text, text) from public;
grant execute on function public.contact_support(text, text, text, text, text) to anon, authenticated;
