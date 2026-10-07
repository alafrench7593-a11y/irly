-- 1. Networking connections get their own notifications ("Sara wants to
--    connect", with a link to her professional profile) and a limit: 30 new
--    requests a day, and asking the same person again within a day (after
--    withdrawing) does not notify them twice.
-- 2. Phone notifications: each phone registers its Expo push token; every
--    notification that survives the mute/block filter is queued in
--    push_outbox with a title, a body and the screen to open, and sent to
--    Expo's push service through pg_net when it is available. "Push on this
--    phone" (notification_prefs.push_enabled) turns it off, and busy chats
--    push at most once a minute per conversation.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'MATCH_CREATED', 'MATCH_REMOVED', 'MESSAGE_CREATED', 'ACTIVITY_CREATED', 'ACTIVITY_JOINED',
  'ACTIVITY_INVITATION', 'ACTIVITY_REMINDER', 'ACTIVITY_UPDATED', 'COMMUNITY_JOINED', 'COMMUNITY_INVITATION',
  'COMMUNITY_POST', 'MATCH_SUGGESTION', 'IRLY_POST_CREATED', 'PROFILE_UPDATED', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED',
  'LIKE', 'COMMENT', 'COMMENT_REPLY', 'MENTION', 'SHARE', 'AI_ACTION', 'PRO_CONNECT_REQUEST', 'PRO_CONNECT_ACCEPTED'
));

-- ───────── Networking connections ─────────

create table if not exists public.pro_connect_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  target uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists pro_connect_log_user_idx on public.pro_connect_log (user_id, created_at desc);
alter table public.pro_connect_log enable row level security;
-- No policy: only pro_connect writes and reads it.

-- Connect from Networking: ask, or accept when they already asked you.
create or replace function public.pro_connect(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  f public.friendships;
  asked_recently boolean;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_user = me or private.blocked_unchecked(me, p_user)
     or not exists (select 1 from public.profiles where id = p_user and deleted_at is null) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  select * into f from public.friendships where user_a = least(me, p_user) and user_b = greatest(me, p_user);
  if f.user_a is null then
    if (select count(*) from public.pro_connect_log where user_id = me and created_at > now() - interval '1 day') >= 30 then
      raise exception 'You sent many requests today. Try again tomorrow.' using errcode = 'P0001';
    end if;
    asked_recently := exists (select 1 from public.pro_connect_log where user_id = me and target = p_user and created_at > now() - interval '1 day');
    insert into public.friendships (user_a, user_b, requested_by) values (least(me, p_user), greatest(me, p_user), me);
    insert into public.pro_connect_log (user_id, target) values (me, p_user);
    if not asked_recently then
      perform private.notify(p_user, 'PRO_CONNECT_REQUEST', jsonb_build_object('from', me));
    end if;
    return 'pending';
  end if;
  if f.status = 'pending' and f.requested_by <> me then
    update public.friendships set status = 'accepted', accepted_at = now() where user_a = f.user_a and user_b = f.user_b;
    perform private.notify(p_user, 'PRO_CONNECT_ACCEPTED', jsonb_build_object('from', me));
    return 'accepted';
  end if;
  return f.status;
end $$;
revoke all on function public.pro_connect(uuid) from public, anon;
grant execute on function public.pro_connect(uuid) to authenticated;

-- A request withdrawn (or a connection removed) takes its notification with it.
create or replace function private.on_friendship_removed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' then
    delete from public.notifications n
    where n.user_id = case when old.requested_by = old.user_a then old.user_b else old.user_a end
      and n.kind in ('PRO_CONNECT_REQUEST', 'FRIEND_REQUEST', 'PROFILE_UPDATED')
      and n.payload ->> 'from' = old.requested_by::text
      and (n.kind <> 'PROFILE_UPDATED' or n.payload ->> 'type' = 'friend_request');
  end if;
  return old;
end $$;
drop trigger if exists friendships_removed on public.friendships;
create trigger friendships_removed after delete on public.friendships
for each row execute function private.on_friendship_removed();

-- ───────── Phone notifications ─────────

create table if not exists public.push_tokens (
  token text primary key check (char_length(token) between 10 and 300),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  lang text not null default 'en' check (lang in ('en', 'fr')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_own_read on public.push_tokens;
create policy push_tokens_own_read on public.push_tokens for select to authenticated using (user_id = auth.uid());

-- This phone now belongs to me (a phone that switched accounts moves over).
create or replace function public.register_push_token(p_token text, p_platform text, p_lang text default 'en') returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  insert into public.push_tokens (token, user_id, platform, lang)
  values (p_token, auth.uid(), p_platform, case when p_lang = 'fr' then 'fr' else 'en' end)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, lang = excluded.lang, updated_at = now();
end $$;
revoke all on function public.register_push_token(text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;

-- Signing out: this phone stops receiving my notifications.
create or replace function public.unregister_push_token(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid()
$$;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

create table if not exists public.push_outbox (
  id bigint generated always as identity primary key,
  notification_id uuid,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  title text not null,
  body text not null,
  url text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists push_outbox_created_idx on public.push_outbox (created_at);
alter table public.push_outbox enable row level security;
-- No policy: server only.

-- What a notification says on the lock screen, in the phone's language, and where a tap goes.
create or replace function private.push_text(n public.notifications, lang text, out title text, out body text, out url text)
language plpgsql stable security definer set search_path = public as $$
declare
  fr boolean := lang = 'fr';
  who text;
  msg record;
begin
  select first_name into who from public.profiles where id = private.uuid_or_null(coalesce(n.payload ->> 'from', n.payload ->> 'user_id'));
  url := '/notifications';
  case n.kind
    when 'MESSAGE_CREATED' then
      select m.body, m.kind, p.first_name, c.title as conv into msg
      from public.messages m left join public.profiles p on p.id = m.sender_id left join public.conversations c on c.id = m.conversation_id
      where m.id = private.uuid_or_null(n.payload ->> 'message_id');
      title := coalesce(nullif(msg.conv, ''), msg.first_name, 'IRLY');
      body := case
        when msg.kind = 'photo' then coalesce(msg.first_name || ': ', '') || case when fr then '📷 Photo' else '📷 Photo' end
        when msg.body is not null then coalesce(case when msg.conv is not null then msg.first_name || ': ' end, '') || left(msg.body, 120)
        else case when fr then 'Nouveau message' else 'New message' end end;
      url := '/messages/' || coalesce(n.payload ->> 'conversation_id', '');
    when 'PRO_CONNECT_REQUEST' then
      title := 'Networking';
      body := coalesce(who, 'Someone') || case when fr then ' veut se connecter avec toi' else ' wants to connect with you' end;
      url := '/network/' || (n.payload ->> 'from');
    when 'PRO_CONNECT_ACCEPTED' then
      title := 'Networking';
      body := coalesce(who, 'Someone') || case when fr then ' a accepté ta demande. Écris-lui !' else ' accepted your request. Say hi!' end;
      url := '/network/' || (n.payload ->> 'from');
    when 'FRIEND_REQUEST' then
      title := 'IRLY';
      body := coalesce(who, 'Someone') || case when fr then ' veut être ton ami·e' else ' wants to be friends' end;
    when 'FRIEND_ACCEPTED' then
      title := 'IRLY';
      body := coalesce(who, 'Someone') || case when fr then ' a accepté ta demande' else ' accepted your request' end;
    when 'PROFILE_UPDATED' then
      title := 'IRLY';
      body := case n.payload ->> 'type'
        when 'friend_request' then coalesce(who, 'Someone') || case when fr then ' veut être ton ami·e' else ' wants to be friends' end
        when 'friend_accepted' then coalesce(who, 'Someone') || case when fr then ' a accepté ta demande' else ' accepted your request' end
        else case when fr then 'Ton profil a été mis à jour' else 'Your profile was updated' end end;
    when 'MATCH_CREATED' then
      title := 'IRLY Girl';
      body := case when fr then 'C’est un match ! Dis bonjour 👋' else 'It’s a match! Say hello 👋' end;
      url := case when n.payload ? 'conversation_id' then '/messages/' || (n.payload ->> 'conversation_id') else '/girl' end;
    when 'ACTIVITY_JOINED' then
      title := 'IRLY';
      body := case when fr then 'Quelqu’un a rejoint ton activité' else 'Someone joined your activity' end;
      url := case when n.payload ? 'activity_id' then '/a/' || (n.payload ->> 'activity_id') else '/notifications' end;
    when 'ACTIVITY_UPDATED' then
      title := 'IRLY';
      body := case when fr then 'Une activité de ton agenda a changé' else 'An activity in your calendar changed' end;
      url := case when n.payload ? 'activity_id' then '/a/' || (n.payload ->> 'activity_id') else '/calendar' end;
    when 'ACTIVITY_REMINDER' then
      title := 'IRLY';
      body := case when fr then 'Ton activité commence bientôt' else 'Your activity starts soon' end;
      url := case when n.payload ? 'activity_id' then '/a/' || (n.payload ->> 'activity_id') else '/calendar' end;
    when 'LIKE' then
      title := 'IRLY';
      body := coalesce(who, 'Someone') || case when fr then ' a aimé ton post' else ' liked your post' end;
    when 'COMMENT', 'COMMENT_REPLY', 'MENTION' then
      title := 'IRLY';
      body := coalesce(who, 'Someone') || case n.kind
        when 'COMMENT' then case when fr then ' a commenté' else ' commented' end
        when 'COMMENT_REPLY' then case when fr then ' t’a répondu' else ' replied to you' end
        else case when fr then ' t’a mentionné·e' else ' mentioned you' end end
        || coalesce(': ' || left(n.payload ->> 'body', 100), '');
    when 'IRLY_POST_CREATED' then
      title := 'IRL';
      body := coalesce(who, 'A friend') || case when fr then ' est en live' else ' is live' end;
      url := '/live';
    when 'COMMUNITY_JOINED' then
      title := 'IRLY';
      body := case when fr then 'Tu as rejoint une communauté. Son chat est dans Messages.' else 'You joined a community. Its chat is in Messages.' end;
      url := case when n.payload ? 'conversation_id' then '/messages/' || (n.payload ->> 'conversation_id') else '/messages' end;
    else
      title := 'IRLY';
      body := case when fr then 'Tu as une nouvelle notification' else 'You have a new notification' end;
  end case;
end $$;
revoke all on function private.push_text(public.notifications, text) from public, anon, authenticated;

-- After a notification is stored: queue one push per phone of its owner, and send.
create or replace function private.on_notification_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tok record;
  txt record;
  batch jsonb := '[]';
begin
  if not coalesce((select p.push_enabled from public.notification_prefs p where p.user_id = new.user_id), true) then
    return null;
  end if;
  -- A busy chat pushes once a minute, not once a message.
  if new.kind = 'MESSAGE_CREATED' and exists (
    select 1 from public.push_outbox o join public.notifications n on n.id = o.notification_id
    where o.user_id = new.user_id and n.kind = 'MESSAGE_CREATED' and n.payload ->> 'conversation_id' = new.payload ->> 'conversation_id'
      and o.created_at > now() - interval '1 minute') then
    return null;
  end if;
  for tok in select token, lang from public.push_tokens where user_id = new.user_id loop
    txt := private.push_text(new, tok.lang);
    insert into public.push_outbox (notification_id, user_id, token, title, body, url) values (new.id, new.user_id, tok.token, txt.title, txt.body, txt.url);
    batch := batch || jsonb_build_object('to', tok.token, 'title', txt.title, 'body', txt.body, 'sound', 'default',
      'data', jsonb_build_object('url', txt.url), 'channelId', 'default', 'priority', 'high');
  end loop;
  if jsonb_array_length(batch) > 0 and exists (select 1 from pg_extension where extname = 'pg_net') then
    begin
      execute 'select net.http_post(url := $1, body := $2, headers := $3)'
        using 'https://exp.host/--/api/v2/push/send', batch, '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb;
      update public.push_outbox set sent_at = now() where notification_id = new.id;
    exception when others then
      -- A push that cannot leave never blocks the notification itself.
      null;
    end;
  end if;
  delete from public.push_outbox where created_at < now() - interval '7 days';
  return null;
end $$;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
for each row execute function private.on_notification_push();

-- pg_net sends the pushes on Supabase; a database without it keeps the queue only.
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net not available: pushes are queued, not sent';
end $$;
