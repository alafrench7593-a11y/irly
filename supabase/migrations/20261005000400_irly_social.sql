-- Communities created by members, the inbox, read state.

-- Create a community: the creator becomes its owner and is in its chat.
create or replace function public.create_community(
  p_name text,
  p_city text,
  p_tagline text default null,
  p_description text default null,
  p_category text default null,
  p_girl_only boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cid uuid;
  conv uuid;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_girl_only and not private.is_girl_eligible(me) then
    raise exception 'only IRLY Girl members can create a girls-only community' using errcode = '42501';
  end if;
  if (select count(*) from public.communities where created_by = me and created_at > now() - interval '1 day') >= 3 then
    raise exception 'you can create up to 3 communities a day' using errcode = 'P0001';
  end if;
  insert into public.communities (city_id, name, tagline, description, category_id, girl_only, created_by)
  values (p_city, trim(p_name), nullif(trim(p_tagline), ''), nullif(trim(p_description), ''), p_category, p_girl_only, me)
  returning id into cid;
  insert into public.community_members (community_id, user_id, role) values (cid, me, 'owner');
  conv := private.ensure_conversation('community', cid, trim(p_name));
  insert into public.conversation_members (conversation_id, user_id, role) values (conv, me, 'admin');
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (conv, null, 'system', 'Welcome to ' || trim(p_name) || '! Introduce yourself and plan the first meetup.');
  return cid;
end $$;

-- The inbox: every conversation you are in, with its last message, unread
-- count and, for one-to-one chats, the other person's name.
create or replace function public.my_conversations()
returns table (
  conversation_id uuid,
  kind text,
  title text,
  other_user_id uuid,
  other_name text,
  last_body text,
  last_sender uuid,
  last_at timestamptz,
  unread integer,
  ref_id uuid
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.kind,
    coalesce(c.title, other.first_name, 'IRLY'),
    other.id,
    other.first_name,
    lm.body,
    lm.sender_id,
    coalesce(lm.created_at, c.created_at),
    (select count(*)::int from public.messages x
       where x.conversation_id = c.id and x.deleted_at is null
         and (x.sender_id is distinct from auth.uid())
         and x.created_at > coalesce(me.last_read_at, 'epoch'::timestamptz)),
    coalesce(c.activity_id, c.community_id, c.match_id)
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join lateral (
    select p.id, p.first_name from public.conversation_members o
    join public.profiles p on p.id = o.user_id
    where o.conversation_id = c.id and o.user_id <> auth.uid() and c.kind in ('direct', 'match')
    limit 1
  ) other on true
  left join lateral (
    select m.body, m.sender_id, m.created_at from public.messages m
    where m.conversation_id = c.id and m.deleted_at is null
    order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
  order by coalesce(lm.created_at, c.created_at) desc
$$;

create or replace function public.mark_conversation_read(p_conversation uuid) returns void
language sql security definer set search_path = public as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid()
$$;

revoke all on function public.create_community(text, text, text, text, text, boolean), public.my_conversations(),
  public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.create_community(text, text, text, text, text, boolean), public.my_conversations(),
  public.mark_conversation_read(uuid) to authenticated;
