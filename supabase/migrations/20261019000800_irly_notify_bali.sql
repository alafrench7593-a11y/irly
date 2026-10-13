-- "Notify me" for Bali always failed: Bali is an upcoming destination in the
-- app (it sends 'dest_bali'), but the allowed list stopped at Thailand,
-- Singapore, London and Paris, so the server answered "unknown service".
-- The same list, plus 'dest_bali'. Nothing is removed.
alter table public.service_interest drop constraint if exists service_interest_service_check;
alter table public.service_interest add constraint service_interest_service_check
  check (service in ('pro', 'bonplan', 'visa', 'location', 'dest_bali', 'dest_thailand', 'dest_singapore', 'dest_london', 'dest_paris'));
create or replace function public.set_service_interest(p_service text, p_on boolean default true)
returns boolean
language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_service not in ('pro', 'bonplan', 'visa', 'location', 'dest_bali', 'dest_thailand', 'dest_singapore', 'dest_london', 'dest_paris') then
    raise exception 'unknown service' using errcode = '22023';
  end if;
  if p_on then
    insert into public.service_interest (user_id, service) values (auth.uid(), p_service) on conflict do nothing;
  else
    delete from public.service_interest where user_id = auth.uid() and service = p_service;
  end if;
  return p_on;
end $$;
