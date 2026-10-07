-- "Report a problem" and "Contact support" from Settings: the message is
-- stored for IRLY's team (who read it with admin rights), with the app
-- version and platform. Members can send, never read others' requests.
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('problem', 'question', 'safety', 'privacy')),
  body text not null check (char_length(btrim(body)) between 5 and 2000),
  contact text check (contact is null or char_length(contact) <= 200),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  platform text check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now()
);
alter table public.support_requests enable row level security;
drop policy if exists support_insert on public.support_requests;
create policy support_insert on public.support_requests for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists support_admin on public.support_requests;
create policy support_admin on public.support_requests for select to authenticated using (private.is_admin());

-- At most 5 requests an hour per member (no flooding the team).
create or replace function private.support_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.support_requests where user_id = new.user_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'slow down: too many requests' using errcode = '54000';
  end if;
  return new;
end $$;
drop trigger if exists support_rate on public.support_requests;
create trigger support_rate before insert on public.support_requests
for each row execute function private.support_rate();
