-- Push texts, French pass: the "Someone" / "A friend" fallbacks were English
-- in French notifications, and "post" is said "publication" in the app.
-- Same function as in 20261007002700, texts only.

-- What a notification says on the lock screen, in the phone's language, and where a tap goes.
create or replace function private.push_text(n public.notifications, lang text, out title text, out body text, out url text)
language plpgsql stable security definer set search_path = public as $$
declare
  fr boolean := lang = 'fr';
  who text;
  someone text := case when lang = 'fr' then 'Quelqu’un' else 'Someone' end;
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
      body := coalesce(who, someone) || case when fr then ' veut entrer en contact avec toi' else ' wants to connect with you' end;
      url := '/network/' || (n.payload ->> 'from');
    when 'PRO_CONNECT_ACCEPTED' then
      title := 'Networking';
      body := coalesce(who, someone) || case when fr then ' a accepté ta demande. Écris-lui !' else ' accepted your request. Say hi!' end;
      url := '/network/' || (n.payload ->> 'from');
    when 'FRIEND_REQUEST' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' veut être ton ami·e' else ' wants to be friends' end;
    when 'FRIEND_ACCEPTED' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' a accepté ta demande' else ' accepted your request' end;
    when 'PROFILE_UPDATED' then
      title := 'IRLY';
      body := case n.payload ->> 'type'
        when 'friend_request' then coalesce(who, someone) || case when fr then ' veut être ton ami·e' else ' wants to be friends' end
        when 'friend_accepted' then coalesce(who, someone) || case when fr then ' a accepté ta demande' else ' accepted your request' end
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
      body := coalesce(who, someone) || case when fr then ' a aimé ta publication' else ' liked your post' end;
    when 'COMMENT', 'COMMENT_REPLY', 'MENTION' then
      title := 'IRLY';
      body := coalesce(who, someone) || case n.kind
        when 'COMMENT' then case when fr then ' a commenté' else ' commented' end
        when 'COMMENT_REPLY' then case when fr then ' t’a répondu' else ' replied to you' end
        else case when fr then ' t’a mentionné·e' else ' mentioned you' end end
        || coalesce(': ' || left(n.payload ->> 'body', 100), '');
    when 'IRLY_POST_CREATED' then
      title := 'IRL';
      body := coalesce(who, case when fr then 'Un·e ami·e' else 'A friend' end) || case when fr then ' est en live' else ' is live' end;
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
