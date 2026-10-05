-- Fix for 1300: deleting an account sets messages.sender_id to null (FK
-- "on delete set null"). That cascade runs as the member deleting their
-- account, so the edit guard refused it and account deletion failed.
-- Changes made by the database itself (FK actions, other triggers) run at
-- trigger depth > 1 and are not limited; a member's own UPDATE is depth 1.
create or replace function private.edit_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  fixed text[] := tg_argv;
  k text;
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or private.is_admin(auth.uid()) then
    return new;
  end if;
  foreach k in array fixed loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
      raise exception '% cannot be changed', k using errcode = '42501';
    end if;
  end loop;
  if old.deleted_at is not null and new.deleted_at is null then
    raise exception 'a removed item cannot be restored' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function private.moderator_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or private.is_admin(auth.uid()) or auth.uid() = old.author_id then
    return new;
  end if;
  if (to_jsonb(new) - 'deleted_at' - 'updated_at') is distinct from (to_jsonb(old) - 'deleted_at' - 'updated_at') then
    raise exception 'moderators can only remove a post' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on all functions in schema private from public, anon;
