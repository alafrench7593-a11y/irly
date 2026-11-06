-- Push texts for the community notifications added on 2026-11-07:
-- ACTIVITY_CREATED (20261107100000) and the governance kinds COMMUNITY_ROLE,
-- COMMUNITY_OWNERSHIP, COMMUNITY_WARNING, COMMUNITY_RESTRICTION, COMMUNITY_BAN
-- (20261107000000). Same function as 20261018000100, plus these cases; every
-- other kind is unchanged. No data is changed.

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
        when 'verified' then case when fr then 'Ton profil est vérifié ✓ Match est ouvert.' else 'Your profile is verified ✓ Match is open.' end
        when 'verification_rejected' then case when fr then 'Vérification refusée' else 'Verification declined' end
          || coalesce(': ' || (n.payload ->> 'reason'), case when fr then '. Tu peux réessayer.' else '. You can try again.' end)
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
    when 'ACTIVITY_CREATED' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := coalesce(who, someone) || case when fr then ' propose : ' else ' proposes: ' end || coalesce(left(n.payload ->> 'title', 100), case when fr then 'une activité' else 'an activity' end);
      url := case when n.payload ? 'activity_id' then '/a/' || (n.payload ->> 'activity_id') else '/notifications' end;
    when 'COMMUNITY_ROLE' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := case n.payload ->> 'role'
        when 'co_admin' then case when fr then 'Tu es maintenant co-administrateur·rice de cette communauté' else 'You are now a co-admin of this community' end
        when 'moderator' then case when fr then 'Tu es maintenant modérateur·rice de cette communauté' else 'You are now a moderator of this community' end
        else case when fr then 'Ton rôle dans cette communauté a changé' else 'Your role in this community changed' end end;
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    when 'COMMUNITY_OWNERSHIP' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := case when fr then 'Tu es maintenant le ou la propriétaire de cette communauté' else 'You are now the owner of this community' end;
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    when 'COMMUNITY_WARNING' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := case when fr then 'Avertissement de la modération' else 'A warning from the moderators' end || coalesce(': ' || left(n.payload ->> 'reason', 100), '');
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    when 'COMMUNITY_RESTRICTION' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := case when fr then 'Tu ne peux plus publier dans cette communauté pour le moment' else 'You cannot post in this community for now' end || coalesce(': ' || left(n.payload ->> 'reason', 100), '');
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    when 'COMMUNITY_BAN' then
      title := coalesce(n.payload ->> 'community', 'IRLY');
      body := case when fr then 'Tu as été exclu·e de cette communauté' else 'You were banned from this community' end || coalesce(': ' || left(n.payload ->> 'reason', 100), '');
      url := '/notifications';
    when 'NEW_FOLLOWER' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' s’est abonné·e à toi' else ' started following you' end;
      url := case when n.payload ? 'from' then '/person/' || (n.payload ->> 'from') else '/notifications' end;
    when 'GROUP_ADDED' then
      title := coalesce(nullif(n.payload ->> 'title', ''), 'IRLY');
      body := coalesce(who, someone) || case when fr then ' t’a ajouté·e au groupe' else ' added you to the group' end;
      url := case when n.payload ? 'conversation_id' then '/messages/' || (n.payload ->> 'conversation_id') else '/messages' end;
    when 'COMMUNITY_POST' then
      title := coalesce(nullif(n.payload ->> 'community', ''), 'IRLY');
      body := coalesce(who, someone) || ': ' || coalesce(left(n.payload ->> 'body', 100), case when fr then 'nouvelle publication' else 'new post' end);
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    when 'COMMUNITY_ANNOUNCEMENT' then
      title := '📣 ' || coalesce(nullif(n.payload ->> 'community', ''), 'IRLY');
      body := coalesce(left(n.payload ->> 'body', 140), case when fr then 'Nouvelle annonce' else 'New announcement' end);
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    else
      title := 'IRLY';
      body := case when fr then 'Tu as une nouvelle notification' else 'You have a new notification' end;
  end case;
end $$;
