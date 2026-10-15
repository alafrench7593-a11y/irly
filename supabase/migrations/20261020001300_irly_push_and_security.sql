-- Phone notifications that cannot be stolen, notifications that never carry
-- what their recipient may not read, and bounded free-text columns.
-- Additive only: RLS stays on everywhere, nothing is dropped from any table,
-- every change narrows access. Tests: supabase/tests/push_and_security.test.sql.
--
-- 1. Push token hijack. register_push_token moved a token to whoever
--    registered it, so anyone who learned another phone's Expo token could
--    take that phone over: the victim stopped receiving her own
--    notifications, and the attacker's notifications (texts and links the
--    attacker controls) were shown on the victim's phone.
--    Now each app install has a random secret of its own (kept in the phone's
--    Keychain / Keystore, never sent anywhere but here). The server keeps only
--    a hash of it per token, in private.push_installs (no API access at
--    all), and that binding outlives sign-out and account deletion. A token
--    bound to an install moves to another account only when the same install
--    secret comes with it: an account switch on the same phone works (even
--    when the old account's sign-out never reached the server); another
--    install, or anyone without the secret, is refused. The account that
--    holds the token may always refresh it (language, platform). A token
--    registered before this change (no binding yet) is bound by the first
--    install that sends a secret for it: each phone does so at its next
--    launch with the updated app, which closes that window.
--    The old 3-argument call still works (p_install defaults to null), so
--    clients that are not updated yet keep registering as before.
--    release_push_token(token, secret) lets a phone that signed out offline
--    stop its notifications later without the old session (anon allowed,
--    acts only on a matching secret, answers the same either way).
-- 2. Notification content after access ends. A member whose IRLY Girl access
--    was withdrawn stays a member of her Match chats and of the chats of past
--    girls-only activities (kept so a reinstated member finds them back), so
--    each new message there was still pushed to her phone with the sender's
--    name and the first 120 characters of the text, and comments on her
--    girls-only activities reached her with their text (in the push and in
--    the notification's payload). A notification that shows content is now
--    only stored (and pushed) when its recipient may read that content at
--    that moment: a message only to a member of the chat (IRLY Girl chats:
--    only with IRLY Girl access); a comment, reply or mention only to someone
--    who can see what was commented (girls-only content: only with IRLY Girl
--    access); a community post or announcement only to a member (women-only
--    communities: only with IRLY Girl access); a Match only with IRLY Girl
--    access; nothing at all for a deleted account.
-- 3. Free-text columns members write directly (communities, profiles, IRLY
--    Match profiles, activities, notification settings, assistant commands,
--    messages) had no size limit: one member could store megabytes in a
--    community tagline served to every member in every list. Each now has a
--    bound well above what the app lets anyone type, checked only when the
--    value is written or changed (existing rows are never rejected).

-- ───────── 1. A push token belongs to one app install ─────────

create table if not exists private.push_installs (
  token text primary key,
  -- sha256(token || '|' || install secret), hex: the secret itself is never stored.
  install_hash text not null check (install_hash ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);
alter table private.push_installs enable row level security;
revoke all on private.push_installs from public, anon, authenticated;

create or replace function private.push_install_hash(p_token text, p_install text) returns text
language sql immutable set search_path = public as $$
  select encode(sha256(convert_to(p_token || '|' || p_install, 'UTF8')), 'hex')
$$;
revoke all on function private.push_install_hash(text, text) from public, anon, authenticated;

-- One function, the old arguments first: callers without p_install (apps not
-- updated yet) and with it resolve to the same function.
drop function if exists public.register_push_token(text, text, text);
create or replace function public.register_push_token(p_token text, p_platform text, p_lang text default 'en', p_install text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  h text;
  bound text;
  holder uuid;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_token is null or char_length(p_token) > 300 or p_token !~ '^Expo(nent)?PushToken\[[^]\s]{1,250}\]$' then
    raise exception 'invalid push token' using errcode = '22023';
  end if;
  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'invalid platform' using errcode = '22023';
  end if;
  if p_install is not null then
    if p_install !~ '^[A-Za-z0-9_-]{32,128}$' then
      raise exception 'invalid install id' using errcode = '22023';
    end if;
    h := private.push_install_hash(p_token, p_install);
  end if;
  -- One registration of a token at a time (two accounts racing for it).
  perform pg_advisory_xact_lock(hashtextextended('push_token:' || p_token, 0));
  select install_hash into bound from private.push_installs where token = p_token;
  select user_id into holder from public.push_tokens where token = p_token;

  -- (coalesce: a missing secret compares as null, which must mean "no", never "unknown".)
  if not coalesce(
    holder = me                  -- my own registration: refreshed, whatever the install says
    or bound is null             -- never bound (new token, or registered before installs had a secret)
    or bound = h,                -- the same install: an account switch on this phone
    false
  ) then
    raise exception 'this notification token belongs to another app install' using errcode = '42501';
  end if;

  insert into public.push_tokens (token, user_id, platform, lang)
  values (p_token, me, p_platform, case when p_lang = 'fr' then 'fr' else 'en' end)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, lang = excluded.lang, updated_at = now();

  if h is not null then
    insert into private.push_installs (token, install_hash) values (p_token, h)
    on conflict (token) do update set install_hash = excluded.install_hash, updated_at = now();
  end if;
end $$;
revoke all on function public.register_push_token(text, text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text, text) to authenticated;

-- unregister_push_token is unchanged: it removes the caller's own
-- registration only. The install binding stays, so a signed-out phone keeps
-- its token for the next account that signs in on it.

-- Signing out offline: unregister_push_token needs the old session, so the
-- phone kept receiving the old account's notifications (lock-screen
-- previews included). The phone proves it is the install that owns the token
-- with its secret instead, without any session: the registration is removed
-- only when sha256(token|secret) matches the binding. Always returns nothing
-- (match or not, valid or not), so it tells a caller nothing; guessing a
-- 256-bit secret is not practical, and the work per call is one hash and one
-- primary-key lookup. A token never bound to an install (registered by an
-- app without a secret) cannot be released this way: nothing proves who owns
-- it (the updated app binds it at its next launch).
create or replace function public.release_push_token(p_token text, p_install text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or p_install is null
     or char_length(p_token) > 300 or p_token !~ '^Expo(nent)?PushToken\[[^]\s]{1,250}\]$'
     or p_install !~ '^[A-Za-z0-9_-]{32,128}$' then
    return;
  end if;
  delete from public.push_tokens t
  using private.push_installs i
  where t.token = p_token and i.token = p_token
    and i.install_hash = private.push_install_hash(p_token, p_install);
end $$;
revoke all on function public.release_push_token(text, text) from public;
grant execute on function public.release_push_token(text, text) to anon, authenticated;

-- ───────── 2. A notification only carries what its recipient may read ─────────

-- Girls-only content: an activity, a post or Live of a women-only community,
-- or the community itself.
create or replace function private.girl_target(p_type text, p_id text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_uuid(p_id) then return false; end if;
  return case p_type
    when 'activity' then coalesce((select a.girl_only from public.activities a where a.id = p_id::uuid), false)
    when 'community' then coalesce((select c.girl_only from public.communities c where c.id = p_id::uuid), false)
    when 'community_post' then coalesce((select c.girl_only from public.community_posts p join public.communities c on c.id = p.community_id where p.id = p_id::uuid), false)
    when 'irl_post' then coalesce((select c.girl_only from public.irl_posts p join public.communities c on c.id = p.community_id where p.id = p_id::uuid), false)
    else false
  end;
end $$;
revoke all on function private.girl_target(text, text) from public, anon, authenticated;

create or replace function private.notification_visible(n public.notifications) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  conv uuid;
  cid uuid;
begin
  if not exists (select 1 from public.profiles p where p.id = n.user_id and p.deleted_at is null) then
    return false;
  end if;
  case n.kind
    when 'MESSAGE_CREATED' then
      -- (A message of no existing chat has no text to show: the push says "New message".)
      conv := private.uuid_or_null(n.payload ->> 'conversation_id');
      return conv is null
        or not exists (select 1 from public.conversations v where v.id = conv)
        or (exists (select 1 from public.conversation_members m where m.conversation_id = conv and m.user_id = n.user_id)
            and (not private.girl_chat(conv) or private.girl_eligible_unchecked(n.user_id)));
    when 'COMMENT', 'COMMENT_REPLY', 'MENTION' then
      return private.user_can_see(n.user_id, n.payload ->> 'target_type', n.payload ->> 'target_id')
        and (not private.girl_target(n.payload ->> 'target_type', n.payload ->> 'target_id')
             or private.girl_eligible_unchecked(n.user_id));
    when 'COMMUNITY_POST', 'COMMUNITY_ANNOUNCEMENT' then
      cid := private.uuid_or_null(n.payload ->> 'community_id');
      return cid is null
        or (exists (select 1 from public.community_members m where m.community_id = cid and m.user_id = n.user_id)
            and (not exists (select 1 from public.communities c where c.id = cid and c.girl_only)
                 or private.girl_eligible_unchecked(n.user_id)));
    when 'MATCH_CREATED' then
      return private.girl_eligible_unchecked(n.user_id);
    else
      return true;
  end case;
end $$;
revoke all on function private.notification_visible(public.notifications) from public, anon, authenticated;

-- Before the push trigger (after insert) ever sees it: an invisible
-- notification is not stored, so nothing is pushed and nothing is listed.
create or replace function private.notification_visible_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not private.notification_visible(new) then
    return null;
  end if;
  return new;
end $$;
revoke all on function private.notification_visible_guard() from public, anon, authenticated;

drop trigger if exists notifications_visible on public.notifications;
create trigger notifications_visible before insert on public.notifications
for each row execute function private.notification_visible_guard();

-- ───────── 3. Bounded free text on member-written columns ─────────
-- Arguments: 'column:max' for text (characters), 'column[]:items:max' for
-- text arrays (number of items, characters per item), 'column{}:bytes' for
-- jsonb. Checked on insert, and on update only for a column that changes.
create or replace function private.text_limits() returns trigger
language plpgsql set search_path = public as $$
declare
  spec text;
  col text;
  parts text[];
  v jsonb;
  item jsonb;
begin
  foreach spec in array tg_argv loop
    parts := string_to_array(spec, ':');
    col := regexp_replace(parts[1], '(\[\]|\{\})$', '');
    v := to_jsonb(new) -> col;
    if v is null or jsonb_typeof(v) = 'null' then continue; end if;
    if tg_op = 'UPDATE' and v is not distinct from (to_jsonb(old) -> col) then continue; end if;
    if parts[1] like '%[]' then
      if jsonb_array_length(v) > parts[2]::int then
        raise exception '% has too many items (at most %)', col, parts[2] using errcode = '22001';
      end if;
      for item in select jsonb_array_elements(v) loop
        if char_length(item #>> '{}') > parts[3]::int then
          raise exception '% items are at most % characters', col, parts[3] using errcode = '22001';
        end if;
      end loop;
    elsif parts[1] like '%{}' then
      if octet_length(v::text) > parts[2]::int then
        raise exception '% is too large (at most % bytes)', col, parts[2] using errcode = '22001';
      end if;
    elsif char_length(v #>> '{}') > parts[2]::int then
      raise exception '% is at most % characters', col, parts[2] using errcode = '22001';
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.text_limits() from public, anon, authenticated;

-- The app's own limits are lower (tagline 80, description 600, country 56, …).
drop trigger if exists communities_text_limits on public.communities;
create trigger communities_text_limits before insert or update on public.communities
for each row execute function private.text_limits('tagline:160', 'description:2000', 'emoji:16');

drop trigger if exists profiles_text_limits on public.profiles;
create trigger profiles_text_limits before insert or update on public.profiles
for each row execute function private.text_limits('country:80', 'faith:60',
  'interests[]:100:80', 'sports[]:100:80', 'languages[]:100:80', 'travel[]:100:80', 'food[]:100:80',
  'intentions[]:100:80', 'activity_prefs[]:100:80');

drop trigger if exists irly_match_profiles_text_limits on public.irly_match_profiles;
create trigger irly_match_profiles_text_limits before insert or update on public.irly_match_profiles
for each row execute function private.text_limits('destination:80', 'lifestyle{}:4096',
  'interests[]:100:80', 'sports[]:100:80', 'activities[]:100:80', 'goals[]:100:80', 'languages[]:100:80',
  'areas[]:100:80', 'availability[]:100:80', 'travel[]:100:80', 'looking_for[]:100:80');

drop trigger if exists activities_text_limits on public.activities;
create trigger activities_text_limits before insert or update on public.activities
for each row execute function private.text_limits('place_name:200', 'formatted_address:300', 'cover_url:2000',
  'currency:8', 'timezone:64');

drop trigger if exists notification_prefs_text_limits on public.notification_prefs;
create trigger notification_prefs_text_limits before insert or update on public.notification_prefs
for each row execute function private.text_limits('muted_kinds[]:50:60');

drop trigger if exists ai_commands_text_limits on public.ai_commands;
create trigger ai_commands_text_limits before insert or update on public.ai_commands
for each row execute function private.text_limits('intent:60', 'entities{}:8192', 'result_type:40', 'result_id:200');

drop trigger if exists messages_text_limits on public.messages;
create trigger messages_text_limits before insert or update on public.messages
for each row execute function private.text_limits('ref_type:40');
