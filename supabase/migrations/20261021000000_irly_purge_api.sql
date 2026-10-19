-- The storage purge without a personal access token.
--
-- scripts/storage-purge.mjs ran its SQL through the Management API with a
-- personal access token (sbp_…), which can do anything on every project of
-- the account, and read the project's server key from it at each run. The
-- purge only needs five calls on the queue and the Storage API of this
-- project: these wrappers expose exactly those calls to the project's own
-- server key (service_role, a GitHub secret SUPABASE_PURGE_KEY), through
-- the REST API. Nobody else can call them: execute is revoked from public,
-- anon and authenticated (Supabase grants new public functions to them by
-- default). The queue logic is unchanged (migration 20261020001400).

create or replace function public.storage_purge_sweep(p_limit integer default 500) returns integer
language sql security definer set search_path = public, private as $$
  select private.storage_purge_sweep(p_limit)
$$;

create or replace function public.storage_purge_claim(p_limit integer default 200, p_lease_seconds integer default 900)
returns table (bucket_id text, name text)
language sql security definer set search_path = public, private as $$
  select c.bucket_id, c.name from private.storage_purge_claim(p_limit, p_lease_seconds) c
$$;

create or replace function public.storage_purge_done(p_bucket text, p_names text[]) returns jsonb
language sql security definer set search_path = public, private as $$
  select private.storage_purge_done(p_bucket, p_names)
$$;

create or replace function public.storage_purge_failed(p_bucket text, p_names text[], p_error text) returns integer
language sql security definer set search_path = public, private as $$
  select private.storage_purge_failed(p_bucket, p_names, p_error)
$$;

create or replace function public.storage_purge_status() returns jsonb
language sql stable security definer set search_path = public, private as $$
  select private.storage_purge_status()
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.storage_purge_sweep(integer)',
    'public.storage_purge_claim(integer, integer)',
    'public.storage_purge_done(text, text[])',
    'public.storage_purge_failed(text, text[], text)',
    'public.storage_purge_status()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;
