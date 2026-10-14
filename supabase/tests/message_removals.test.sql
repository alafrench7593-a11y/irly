-- "Delete for everyone": the removal reaches the other members (message_removals),
-- never non-members, and clients cannot write removals themselves.
\set ON_ERROR_STOP 1

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

select pg_temp.as_admin();

insert into auth.users (id) values
  ('7e000000-0000-0000-0000-0000000000a1'), ('7e000000-0000-0000-0000-0000000000a2'),
  ('7e000000-0000-0000-0000-0000000000a3');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('7e000000-0000-0000-0000-0000000000a1', 'Remy', '1994-03-03', 'woman', 'dubai'),
  ('7e000000-0000-0000-0000-0000000000a2', 'Rita', '1993-05-05', 'woman', 'dubai'),
  ('7e000000-0000-0000-0000-0000000000a3', 'Rosa', '1992-07-07', 'woman', 'dubai');
insert into public.conversations (id, kind, title)
values ('7e000000-0000-0000-0000-0000000000c1', 'group', 'Removal test');
insert into public.conversation_members (conversation_id, user_id) values
  ('7e000000-0000-0000-0000-0000000000c1', '7e000000-0000-0000-0000-0000000000a1'),
  ('7e000000-0000-0000-0000-0000000000c1', '7e000000-0000-0000-0000-0000000000a2');
insert into public.messages (id, conversation_id, sender_id, body) values
  ('7e000000-0000-0000-0000-0000000000d1', '7e000000-0000-0000-0000-0000000000c1', '7e000000-0000-0000-0000-0000000000a1', 'Oops, wrong chat'),
  ('7e000000-0000-0000-0000-0000000000d2', '7e000000-0000-0000-0000-0000000000c1', '7e000000-0000-0000-0000-0000000000a2', 'Hello');

do $$
begin
  -- Someone else's message cannot be removed (and leaves no removal row).
  perform pg_temp.as_user('7e000000-0000-0000-0000-0000000000a1');
  begin
    perform public.delete_my_message('7e000000-0000-0000-0000-0000000000d2');
    raise exception 'FAIL removals: deleted someone else''s message';
  exception when sqlstate 'P0002' then null;
  end;

  -- The sender deletes for everyone.
  perform public.delete_my_message('7e000000-0000-0000-0000-0000000000d1');
  -- Deleting twice stays quiet.
  perform public.delete_my_message('7e000000-0000-0000-0000-0000000000d1');
  if (select count(*) from public.message_removals where conversation_id = '7e000000-0000-0000-0000-0000000000c1') <> 1 then
    raise exception 'FAIL removals: sender should see exactly one removal';
  end if;

  -- The other member no longer sees the message, but sees its removal.
  perform pg_temp.as_user('7e000000-0000-0000-0000-0000000000a2');
  if exists (select 1 from public.messages where id = '7e000000-0000-0000-0000-0000000000d1') then
    raise exception 'FAIL removals: deleted message still readable by other member';
  end if;
  if not exists (select 1 from public.message_removals
                 where message_id = '7e000000-0000-0000-0000-0000000000d1'
                   and conversation_id = '7e000000-0000-0000-0000-0000000000c1') then
    raise exception 'FAIL removals: other member does not see the removal';
  end if;

  -- A non-member sees nothing.
  perform pg_temp.as_user('7e000000-0000-0000-0000-0000000000a3');
  if exists (select 1 from public.message_removals where conversation_id = '7e000000-0000-0000-0000-0000000000c1') then
    raise exception 'FAIL removals: non-member sees the removal';
  end if;

  -- Clients cannot write removals (forge, change or erase them), even as members.
  perform pg_temp.as_user('7e000000-0000-0000-0000-0000000000a2');
  begin
    insert into public.message_removals (message_id, conversation_id)
    values ('7e000000-0000-0000-0000-0000000000d2', '7e000000-0000-0000-0000-0000000000c1');
    raise exception 'FAIL removals: client inserted a removal';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.message_removals set removed_at = now() - interval '1 day'
    where message_id = '7e000000-0000-0000-0000-0000000000d1';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.message_removals where message_id = '7e000000-0000-0000-0000-0000000000d1';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.as_admin();
  if (select count(*) from public.message_removals where conversation_id = '7e000000-0000-0000-0000-0000000000c1') <> 1
     or (select removed_at from public.message_removals where message_id = '7e000000-0000-0000-0000-0000000000d1') < now() - interval '1 hour' then
    raise exception 'FAIL removals: client changed or erased a removal';
  end if;
  raise notice 'ok  message removals: members only, server-written only';
end $$;

select pg_temp.as_admin();
