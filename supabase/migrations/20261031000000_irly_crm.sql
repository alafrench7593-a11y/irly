-- IRLY back office: CRM (contacts and prospects, pipeline, companies and
-- partners, partnerships, tasks and follow-ups, marketing campaigns).
--
-- Additive only: new crm_* tables, nothing existing is changed.
--
-- Access: owners and admins of the back office (private.is_admin), the same
-- check as the rest of the admin. RLS on every table; anon gets nothing.
-- Nothing is ever deleted from the app: contacts, companies, partnerships
-- and campaigns are archived (archived_at), tasks are marked done. Only the
-- link between a partnership and a contact can be removed.
--
-- The CRM holds business contacts entered by the team. It reads no member
-- data and no private conversation; campaign signups are counted from the
-- existing aggregated SIGNUP analytics events (utm_campaign), on the client.

-- ───────── Companies, organisations, venues ─────────
create table if not exists public.crm_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  kind text not null default 'company'
    check (kind in ('company', 'event_organizer', 'venue', 'community', 'agency', 'brand', 'other')),
  website text check (website is null or char_length(website) <= 300),
  socials jsonb not null default '{}' check (jsonb_typeof(socials) = 'object' and pg_column_size(socials) <= 4096),
  city text check (city is null or char_length(city) <= 80),
  country text check (country is null or char_length(country) <= 80),
  network_target boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 5000),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────── Contacts and prospects ─────────
create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text check (first_name is null or char_length(first_name) <= 80),
  last_name text check (last_name is null or char_length(last_name) <= 80),
  organization_id uuid references public.crm_organizations (id) on delete set null,
  company text check (company is null or char_length(company) <= 160),
  job_title text check (job_title is null or char_length(job_title) <= 120),
  category text not null default 'other'
    check (category in ('influencer', 'event_organizer', 'company', 'partner', 'ambassador', 'venue', 'other')),
  email text check (email is null or (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text check (phone is null or char_length(phone) <= 40),
  website text check (website is null or char_length(website) <= 300),
  socials jsonb not null default '{}' check (jsonb_typeof(socials) = 'object' and pg_column_size(socials) <= 4096),
  city text check (city is null or char_length(city) <= 80),
  country text check (country is null or char_length(country) <= 80),
  language text check (language is null or char_length(language) <= 40),
  source text check (source is null or char_length(source) <= 120),
  stage text not null default 'new'
    check (stage in ('new', 'qualify', 'to_contact', 'contacted', 'waiting', 'follow_up', 'interested', 'negotiation', 'confirmed', 'active', 'lost')),
  stage_changed_at timestamptz not null default now(),
  tags text[] not null default '{}' check (cardinality(tags) <= 30),
  notes text check (notes is null or char_length(notes) <= 10000),
  -- Influencer and organiser fields (platforms, audience, theme, budget, proposal,
  -- expected content, results, event types, interest, planned events): one object,
  -- so a field that only fits one kind of contact is never required of the others.
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 16384),
  last_contact_at date,
  next_follow_up date,
  owner_id uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_contacts_named check (coalesce(btrim(first_name), '') <> '' or coalesce(btrim(last_name), '') <> '' or coalesce(btrim(company), '') <> '' or organization_id is not null)
);
create index if not exists crm_contacts_stage_idx on public.crm_contacts (stage) where archived_at is null;
create index if not exists crm_contacts_follow_idx on public.crm_contacts (next_follow_up) where archived_at is null;
create index if not exists crm_contacts_email_idx on public.crm_contacts (lower(email)) where email is not null;
create index if not exists crm_contacts_org_idx on public.crm_contacts (organization_id);

-- Every stage change, written by the server (the app cannot write or edit it).
create table if not exists public.crm_stage_history (
  id bigint generated always as identity primary key,
  contact_id uuid not null references public.crm_contacts (id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  at timestamptz not null default now()
);
create index if not exists crm_stage_history_contact_idx on public.crm_stage_history (contact_id, at desc);

-- ───────── Partnerships ─────────
create table if not exists public.crm_partnerships (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  kind text not null default 'other'
    check (kind in ('event_organizer', 'venue', 'company', 'community', 'influencer', 'launch', 'network', 'other')),
  objective text check (objective is null or char_length(objective) <= 2000),
  status text not null default 'proposed'
    check (status in ('idea', 'proposed', 'negotiating', 'active', 'paused', 'completed', 'cancelled')),
  organization_id uuid references public.crm_organizations (id) on delete set null,
  starts_on date,
  ends_on date,
  budget numeric(12, 2) check (budget is null or budget >= 0),
  currency text not null default 'AED' check (currency ~ '^[A-Z]{3}$'),
  deliverables text check (deliverables is null or char_length(deliverables) <= 5000),
  results text check (results is null or char_length(results) <= 5000),
  notes text check (notes is null or char_length(notes) <= 5000),
  next_due date,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_partnerships_dates check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table if not exists public.crm_partnership_contacts (
  partnership_id uuid not null references public.crm_partnerships (id) on delete cascade,
  contact_id uuid not null references public.crm_contacts (id) on delete cascade,
  primary key (partnership_id, contact_id)
);
create index if not exists crm_partnership_contacts_contact_idx on public.crm_partnership_contacts (contact_id);

-- ───────── Tasks and follow-ups ─────────
create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  contact_id uuid references public.crm_contacts (id) on delete set null,
  partnership_id uuid references public.crm_partnerships (id) on delete set null,
  due_on date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  notes text check (notes is null or char_length(notes) <= 5000),
  assignee_id uuid references public.profiles (id) on delete set null,
  done_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_tasks_open_idx on public.crm_tasks (due_on) where done_at is null;

-- ───────── Marketing campaigns ─────────
create table if not exists public.crm_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  channel text not null default 'other'
    check (channel in ('tiktok', 'instagram', 'youtube', 'snapchat', 'x', 'linkedin', 'google', 'email', 'influencer', 'event', 'other')),
  objective text check (objective is null or char_length(objective) <= 2000),
  status text not null default 'draft' check (status in ('draft', 'planned', 'running', 'paused', 'ended')),
  starts_on date,
  ends_on date,
  budget numeric(12, 2) check (budget is null or budget >= 0),
  currency text not null default 'AED' check (currency ~ '^[A-Z]{3}$'),
  url text check (url is null or char_length(url) <= 500),
  utm_source text check (utm_source is null or utm_source ~ '^[A-Za-z0-9._-]{1,80}$'),
  utm_medium text check (utm_medium is null or utm_medium ~ '^[A-Za-z0-9._-]{1,80}$'),
  utm_campaign text check (utm_campaign is null or utm_campaign ~ '^[A-Za-z0-9._-]{1,80}$'),
  impressions bigint check (impressions is null or impressions >= 0),
  clicks bigint check (clicks is null or clicks >= 0),
  signups_reported integer check (signups_reported is null or signups_reported >= 0),
  notes text check (notes is null or char_length(notes) <= 5000),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_campaigns_dates check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create unique index if not exists crm_campaigns_utm_idx on public.crm_campaigns (lower(utm_campaign)) where utm_campaign is not null and archived_at is null;

-- ───────── Server-side bookkeeping ─────────
-- Owner and assignee must be on the back office team (owner or admin).
create or replace function private.crm_guard() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare person text;
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  -- One field per table: plpgsql cannot name a column the row does not have.
  if tg_table_name = 'crm_contacts' then
    person := to_jsonb(new) ->> 'owner_id';
  elsif tg_table_name = 'crm_tasks' then
    person := to_jsonb(new) ->> 'assignee_id';
  end if;
  if person is not null and not private.is_admin(person::uuid) then
    raise exception 'the person in charge must be an admin of the back office' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function private.crm_guard() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['crm_organizations', 'crm_contacts', 'crm_partnerships', 'crm_tasks', 'crm_campaigns'] loop
    execute format('drop trigger if exists %1$s_guard on public.%1$s', t);
    execute format('create trigger %1$s_guard before insert or update on public.%1$s for each row execute function private.crm_guard()', t);
  end loop;
end $$;

-- The pipeline history: one row per stage change, by whom and when.
create or replace function private.crm_stage_stamp() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  else
    new.stage_changed_at := old.stage_changed_at;
  end if;
  return new;
end $$;
revoke all on function private.crm_stage_stamp() from public, anon, authenticated;
drop trigger if exists crm_contacts_stage_stamp on public.crm_contacts;
create trigger crm_contacts_stage_stamp before insert or update on public.crm_contacts
for each row execute function private.crm_stage_stamp();

create or replace function private.crm_stage_log() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.crm_stage_history (contact_id, from_stage, to_stage, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.stage end, new.stage, auth.uid());
  end if;
  return null;
end $$;
revoke all on function private.crm_stage_log() from public, anon, authenticated;
drop trigger if exists crm_contacts_stage on public.crm_contacts;
create trigger crm_contacts_stage after insert or update of stage on public.crm_contacts
for each row execute function private.crm_stage_log();

-- ───────── Access: back office owners and admins only ─────────
do $$
declare t text;
begin
  foreach t in array array['crm_organizations', 'crm_contacts', 'crm_stage_history', 'crm_partnerships', 'crm_partnership_contacts', 'crm_tasks', 'crm_campaigns'] loop
    execute format('alter table public.%1$s enable row level security', t);
    execute format('revoke all on public.%1$s from anon, authenticated', t);
    execute format('drop policy if exists %1$s_admin_read on public.%1$s', t);
    execute format('create policy %1$s_admin_read on public.%1$s for select to authenticated using (private.is_admin())', t);
  end loop;
  -- Archive instead of delete: insert and update only.
  foreach t in array array['crm_organizations', 'crm_contacts', 'crm_partnerships', 'crm_tasks', 'crm_campaigns'] loop
    execute format('grant select, insert, update on public.%1$s to authenticated', t);
    execute format('drop policy if exists %1$s_admin_insert on public.%1$s', t);
    execute format('create policy %1$s_admin_insert on public.%1$s for insert to authenticated with check (private.is_admin())', t);
    execute format('drop policy if exists %1$s_admin_update on public.%1$s', t);
    execute format('create policy %1$s_admin_update on public.%1$s for update to authenticated using (private.is_admin()) with check (private.is_admin())', t);
  end loop;
end $$;

-- The history is read-only for the team; the trigger above writes it.
grant select on public.crm_stage_history to authenticated;

-- A partnership's contacts: link and unlink.
grant select, insert, delete on public.crm_partnership_contacts to authenticated;
drop policy if exists crm_partnership_contacts_admin_insert on public.crm_partnership_contacts;
create policy crm_partnership_contacts_admin_insert on public.crm_partnership_contacts for insert to authenticated with check (private.is_admin());
drop policy if exists crm_partnership_contacts_admin_delete on public.crm_partnership_contacts;
create policy crm_partnership_contacts_admin_delete on public.crm_partnership_contacts for delete to authenticated using (private.is_admin());
