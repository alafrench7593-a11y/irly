-- Privacy and speed fixes from the security audit (additive; access only
-- tightened, nothing removed).

-- ───────── 1. A hidden profile stays hidden from community co-members ─────────
-- Reading another member's profile row was allowed to anyone sharing a chat
-- with them, community chats included: joining any community someone was in
-- revealed the bio, interests and photos of a member who chose "nobody".
-- Only a private chat (direct, match, group) counts now; community and
-- activity chats get names and photos through chat_members, as before.
create or replace function private.shares_private_chat(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_members x
    join public.conversation_members y on y.conversation_id = x.conversation_id
    join public.conversations c on c.id = x.conversation_id
    where x.user_id = a and y.user_id = b and c.kind in ('direct', 'match', 'group')
  )
$$;
revoke all on function private.shares_private_chat(uuid, uuid) from public, anon;
grant execute on function private.shares_private_chat(uuid, uuid) to authenticated;

drop policy if exists profiles_contacts on public.profiles;
create policy profiles_contacts on public.profiles for select to authenticated
  using (deleted_at is null and private.shares_private_chat(auth.uid(), id) and not private.is_blocked(auth.uid(), id));

-- ───────── 2. Analytics keep the server's clock ─────────
-- Events took the time the phone sent: anyone could backdate rows.
create or replace function private.analytics_clock() returns trigger
language plpgsql set search_path = public as $$
begin
  new.created_at := now();
  return new;
end $$;
revoke all on function private.analytics_clock() from public, anon, authenticated;
drop trigger if exists analytics_events_clock on public.analytics_events;
create trigger analytics_events_clock before insert on public.analytics_events
for each row execute function private.analytics_clock();

-- ───────── 3. Indexes for queries the app runs ─────────
-- A member's Lives on their profile (filtered by author, newest first).
create index if not exists irl_posts_author_idx on public.irl_posts (author_id, created_at desc);
-- Badges count a member's comments; deleting an account cascades through them.
create index if not exists comments_author_idx on public.comments (author_id);
-- The retention clean-up deletes by age.
create index if not exists analytics_events_created_idx on public.analytics_events (created_at);
-- Foreign keys followed when an activity or a message is deleted.
create index if not exists irl_posts_activity_idx on public.irl_posts (activity_id) where activity_id is not null;
create index if not exists community_posts_activity_idx on public.community_posts (activity_id) where activity_id is not null;
create index if not exists community_activity_pins_activity_idx on public.community_activity_pins (activity_id);
create index if not exists message_hides_message_idx on public.message_hides (message_id);
create index if not exists messages_reply_to_idx on public.messages (reply_to) where reply_to is not null;
