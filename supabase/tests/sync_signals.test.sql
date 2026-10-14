-- Realtime DELETE privacy: deletes on membership / relationship tables carry no
-- key (replica identity = opaque rt_id), and the people concerned hear about
-- them through owner-only sync_signals rows instead.
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

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

select pg_temp.as_admin();

insert into auth.users (id) values
  ('5e000000-0000-0000-0000-0000000000a1'), ('5e000000-0000-0000-0000-0000000000a2'),
  ('5e000000-0000-0000-0000-0000000000a3'), ('5e000000-0000-0000-0000-0000000000a4');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('5e000000-0000-0000-0000-0000000000a1', 'Sana', '1994-03-03', 'woman', 'dubai'),
  ('5e000000-0000-0000-0000-0000000000a2', 'Sara', '1993-05-05', 'woman', 'dubai'),
  ('5e000000-0000-0000-0000-0000000000a3', 'Sofi', '1992-07-07', 'woman', 'dubai'),
  ('5e000000-0000-0000-0000-0000000000a4', 'Sina', '1991-08-08', 'woman', 'dubai');
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('5e000000-0000-0000-0000-0000000000a1', '5e000000-0000-0000-0000-0000000000a2', '5e000000-0000-0000-0000-0000000000a1', 'accepted', now()),
  ('5e000000-0000-0000-0000-0000000000a3', '5e000000-0000-0000-0000-0000000000a4', '5e000000-0000-0000-0000-0000000000a3', 'accepted', now());
insert into public.follows (follower_id, followee_id) values
  ('5e000000-0000-0000-0000-0000000000a1', '5e000000-0000-0000-0000-0000000000a2'),
  ('5e000000-0000-0000-0000-0000000000a2', '5e000000-0000-0000-0000-0000000000a1');

do $$
declare
  a constant uuid := '5e000000-0000-0000-0000-0000000000a1';
  b constant uuid := '5e000000-0000-0000-0000-0000000000a2';
  c constant uuid := '5e000000-0000-0000-0000-0000000000a3';
  n integer;
  base bigint := coalesce((select max(id) from public.sync_signals), 0);
begin
  -- Unfriending signals exactly the two friends, nobody else.
  delete from public.friendships where user_a = a and user_b = b;
  perform pg_temp.check((select count(*) from public.sync_signals where user_id = a and kind = 'friends') = 1, 'unfriend signals the first friend');
  perform pg_temp.check((select count(*) from public.sync_signals where user_id = b and kind = 'friends') = 1, 'unfriend signals the second friend');
  perform pg_temp.check((select count(*) from public.sync_signals where user_id not in (a, b) and id > base) = 0, 'unfriend signals nobody else');
  perform pg_temp.check((select bool_and(ref is null) from public.sync_signals where kind = 'friends' and id > base), 'friend signal names nobody');

  -- Two unfollows in one transaction: one signal per person.
  delete from public.follows where follower_id in (a, b) and followee_id in (a, b);
  perform pg_temp.check((select count(*) from public.sync_signals where user_id = a and kind = 'follows') = 1, 'one follows signal per transaction (a)');
  perform pg_temp.check((select count(*) from public.sync_signals where user_id = b and kind = 'follows') = 1, 'one follows signal per transaction (b)');

  -- A signal for a deleted account is skipped, and the cascade still works.
  delete from public.friendships where user_a = c;
  perform pg_temp.check((select count(*) from public.sync_signals where user_id = c) = 1, 'third user signalled once');
end $$;

-- Only the owner reads her signals; nobody writes them.
do $$
declare
  a constant uuid := '5e000000-0000-0000-0000-0000000000a1';
  b constant uuid := '5e000000-0000-0000-0000-0000000000a2';
  c constant uuid := '5e000000-0000-0000-0000-0000000000a3';
  n integer;
begin
  perform pg_temp.as_user(c);
  perform pg_temp.check((select count(*) from public.sync_signals where user_id in (a, b)) = 0, 'another user cannot read the signals');
  perform pg_temp.check((select count(*) from public.sync_signals) = 1, 'a user reads only her own signals');

  perform pg_temp.as_user(a);
  perform pg_temp.check((select count(*) from public.sync_signals) = 2, 'owner reads her signals');
  begin
    insert into public.sync_signals (user_id, kind) values (a, 'friends');
    raise exception 'FAIL user inserted a signal for herself';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.sync_signals (user_id, kind) values (b, 'friends');
    raise exception 'FAIL user inserted a signal for someone else';
  exception when insufficient_privilege then null;
  end;
  begin
    perform private.sync_signal(array[b], 'friends', null);
    raise exception 'FAIL user called the signal writer';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.sync_signals set kind = 'saved';
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FAIL user updated signals'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.sync_signals where user_id = b;
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FAIL user deleted someone else''s signals'; end if;
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.as_admin();
  perform pg_temp.check((select count(*) from public.sync_signals where user_id = b) = 2, 'other signals untouched');
  raise notice 'ok  clients cannot write signals';
end $$;

-- Leaving an activity: the person, the host and the other attendees hear it,
-- and the chat leave that follows reaches only the person's inbox.
do $$
declare
  a constant uuid := '5e000000-0000-0000-0000-0000000000a1';
  b constant uuid := '5e000000-0000-0000-0000-0000000000a2';
  c constant uuid := '5e000000-0000-0000-0000-0000000000a3';
  d constant uuid := '5e000000-0000-0000-0000-0000000000a4';
  act constant uuid := '5e000000-0000-0000-0000-0000000000f1';
  base bigint;
begin
  perform pg_temp.as_admin();
  insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at)
  values (act, a, 'Signals walk', 'sport', 'dubai', 'marina', now() + interval '1 day');
  insert into public.activity_participants (activity_id, user_id) values (act, a), (act, b), (act, c)
  on conflict do nothing;
  base := coalesce((select max(id) from public.sync_signals), 0);
  delete from public.activity_participants where activity_id = act and user_id = b;
  perform pg_temp.check((select count(*) from public.sync_signals where id > base and kind = 'activities' and ref = act::text and user_id in (a, b, c)) = 3, 'activity leave signals person, host and attendees');
  perform pg_temp.check((select count(*) from public.sync_signals where id > base and user_id not in (a, b, c)) = 0, 'activity leave signals nobody else');
  perform pg_temp.check(not exists (select 1 from public.sync_signals where id > base and kind = 'inbox' and user_id <> b), 'chat leave reaches only the person');
  perform pg_temp.check(not exists (select 1 from public.sync_signals where id > base and user_id = d), 'outsider not signalled');
  delete from public.activities where id = act;
end $$;

-- A deleted account is not signalled inside its own cascade (no FK failure).
do $$
declare
  c constant uuid := '5e000000-0000-0000-0000-0000000000a3';
  d constant uuid := '5e000000-0000-0000-0000-0000000000a4';
begin
  perform pg_temp.as_admin();
  insert into public.friendships (user_a, user_b, requested_by, status) values (c, d, c, 'pending');
  delete from public.profiles where id = d;
  perform pg_temp.check((select count(*) from public.sync_signals where user_id = d) = 0, 'deleted account has no signals');
  perform pg_temp.check((select count(*) from public.sync_signals where user_id = c and kind = 'friends') = 2, 'her friend still hears about it');
end $$;

-- DELETE events carry no key: replica identity is the opaque rt_id alone,
-- which is not part of the primary key (Realtime keeps only pkey columns).
do $$
declare
  t text;
begin
  foreach t in array array['activity_participants', 'community_members', 'conversation_members', 'follows',
                           'friendships', 'saves', 'likes', 'community_poll_votes'] loop
    perform pg_temp.check(
      (select relreplident = 'i' from pg_class where oid = ('public.' || t)::regclass)
      and (select array_agg(a.attname::text) from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
           where i.indrelid = ('public.' || t)::regclass and i.indisreplident) = array['rt_id']
      and not exists (select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
                      where i.indrelid = ('public.' || t)::regclass and i.indisprimary and a.attname = 'rt_id'),
      t || ': delete events carry no key');
  end loop;
end $$;

-- Publication: the sensitive tables stay published (INSERT/UPDATE are RLS-checked;
-- screens rely on them) and the signals join them. Checked on a stand-in.
do $$
declare
  t text;
  created boolean := false;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime for table public.activity_participants, public.community_members,
      public.conversation_members, public.follows, public.friendships, public.saves, public.likes, public.community_poll_votes;
    created := true;
  end if;
  perform private.sync_signals_realtime();
  perform private.sync_signals_realtime(); -- idempotent
  perform pg_temp.check(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sync_signals'), 'sync_signals published');
  foreach t in array array['activity_participants', 'community_members', 'conversation_members', 'follows',
                           'friendships', 'saves', 'likes', 'community_poll_votes'] loop
    perform pg_temp.check(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t), t || ' still published');
  end loop;
  -- Signals themselves: key = id only, never the owner.
  perform pg_temp.check((select relreplident = 'd' from pg_class where oid = 'public.sync_signals'::regclass), 'signal deletes carry only their id');
  if created then
    drop publication supabase_realtime;
  end if;
end $$;

select pg_temp.as_admin();
