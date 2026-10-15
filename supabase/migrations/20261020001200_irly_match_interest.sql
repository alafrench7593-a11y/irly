-- "Tell me when it opens" for Match IRLY. Match is shown as coming soon
-- (src/lib/features.ts) through the same teaser page as PRO or Visa, which
-- sends the service id 'match'. The allowed list did not have it, so the
-- server would answer "unknown service". The same list, plus 'match'.
-- Nothing is removed; grants are unchanged (create or replace keeps them).
alter table public.service_interest drop constraint if exists service_interest_service_check;
alter table public.service_interest add constraint service_interest_service_check
  check (service in ('pro', 'bonplan', 'visa', 'location', 'match', 'dest_bali', 'dest_thailand', 'dest_singapore', 'dest_london', 'dest_paris'));
create or replace function public.set_service_interest(p_service text, p_on boolean default true)
returns boolean
language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_service not in ('pro', 'bonplan', 'visa', 'location', 'match', 'dest_bali', 'dest_thailand', 'dest_singapore', 'dest_london', 'dest_paris') then
    raise exception 'unknown service' using errcode = '22023';
  end if;
  if p_on then
    insert into public.service_interest (user_id, service) values (auth.uid(), p_service) on conflict do nothing;
  else
    delete from public.service_interest where user_id = auth.uid() and service = p_service;
  end if;
  return p_on;
end $$;
revoke all on function public.set_service_interest(text, boolean) from public, anon;
grant execute on function public.set_service_interest(text, boolean) to authenticated;
