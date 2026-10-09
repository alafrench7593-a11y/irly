-- Coming soon services (IRLY PRO, Bon plan, Visa, Location): a member can
-- ask to be told when one opens. One row per member and service; nothing
-- else is stored, and nothing is promised beyond telling them.
create table if not exists public.service_interest (
  user_id uuid not null references public.profiles (id) on delete cascade,
  service text not null check (service in ('pro', 'bonplan', 'visa', 'location')),
  created_at timestamptz not null default now(),
  primary key (user_id, service)
);
alter table public.service_interest enable row level security;

drop policy if exists service_interest_own on public.service_interest;
create policy service_interest_own on public.service_interest for select to authenticated using (user_id = auth.uid() or private.is_admin());
revoke all on public.service_interest from anon, authenticated;
grant select on public.service_interest to authenticated;

-- Toggle: on asks to be told, off withdraws. Returns the new state.
create or replace function public.set_service_interest(p_service text, p_on boolean default true)
returns boolean
language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_service not in ('pro', 'bonplan', 'visa', 'location') then raise exception 'unknown service' using errcode = '22023'; end if;
  if p_on then
    insert into public.service_interest (user_id, service) values (auth.uid(), p_service) on conflict do nothing;
  else
    delete from public.service_interest where user_id = auth.uid() and service = p_service;
  end if;
  return p_on;
end $$;
revoke all on function public.set_service_interest(text, boolean) from public, anon;
grant execute on function public.set_service_interest(text, boolean) to authenticated;
