-- "Delete for everyone" reaches the other members live.
-- messages_read hides a deleted message from everyone but its sender, so the
-- other members never receive the Realtime UPDATE for it (RLS drops the event).
-- A removal row, readable by the conversation's members, carries that signal.
-- Additive only: nothing here weakens an existing policy.

create table if not exists public.message_removals (
  message_id uuid primary key references public.messages (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  removed_at timestamptz not null default now()
);
create index if not exists message_removals_conversation_idx
  on public.message_removals (conversation_id, removed_at desc);

alter table public.message_removals enable row level security;

drop policy if exists message_removals_read on public.message_removals;
create policy message_removals_read on public.message_removals for select to authenticated
  using (private.is_member(conversation_id));
-- No insert/update/delete policy: only delete_my_message() (security definer) writes here.
revoke insert, update, delete on public.message_removals from anon, authenticated;
grant select on public.message_removals to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_removals') then
    alter publication supabase_realtime add table public.message_removals;
  end if;
end $$;

-- Same signature and rules as before; also records the removal for the members.
create or replace function public.delete_my_message(p_message uuid) returns void
language plpgsql security definer set search_path = public, private as $$
declare conv uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  select conversation_id into conv from public.messages where id = p_message and sender_id = auth.uid();
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  -- The erase trigger keeps the text aside for moderators and empties it.
  update public.messages set deleted_at = now() where id = p_message and sender_id = auth.uid() and deleted_at is null;
  insert into public.message_removals (message_id, conversation_id) values (p_message, conv)
  on conflict (message_id) do nothing;
end $$;
revoke all on function public.delete_my_message(uuid) from public, anon;
grant execute on function public.delete_my_message(uuid) to authenticated;
