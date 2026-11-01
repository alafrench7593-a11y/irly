-- IRLY news polls: the team can attach a poll to a news item (a question and
-- 2 to 6 answers). Members who may read the item vote once and may change
-- their answer; everyone who reads it sees the counts. A poll can no longer
-- change (nor be removed) once someone voted, as in community posts.
--
-- Additive: one column on irly_news, one table of votes, one function to
-- vote; news_member_json, news_admin_json and admin_news_save are redefined
-- with the poll (everything else in them is unchanged).

-- ───────── 1. The poll on a news item ─────────
/**
 * A poll as the team wrote it, cleaned: {question, options} with the
 * question 3 to 140 characters and 2 to 6 different answers of 1 to 60
 * characters. null stays null (no poll). Refuses anything else, with a
 * sentence the app can show.
 */
create or replace function private.news_poll_clean(p jsonb) returns jsonb
language plpgsql immutable set search_path = public, private as $$
declare q text; opts text[]; o jsonb; s text;
begin
  if p is null or jsonb_typeof(p) = 'null' then return null; end if;
  if jsonb_typeof(p) <> 'object' or jsonb_typeof(p -> 'question') <> 'string' or jsonb_typeof(p -> 'options') <> 'array'
     or exists (select 1 from jsonb_object_keys(p) k where k not in ('question', 'options')) then
    raise exception 'invalid value' using errcode = '22023';
  end if;
  q := btrim(p ->> 'question');
  if char_length(q) < 3 or char_length(q) > 140 then raise exception 'a poll needs a question of 3 to 140 characters' using errcode = '22023'; end if;
  opts := '{}';
  for o in select x from jsonb_array_elements(p -> 'options') x loop
    if jsonb_typeof(o) <> 'string' then raise exception 'invalid value' using errcode = '22023'; end if;
    s := btrim(o #>> '{}');
    if s = '' then continue; end if;
    if char_length(s) > 60 then raise exception 'an answer is at most 60 characters' using errcode = '22023'; end if;
    if lower(s) = any (select lower(x) from unnest(opts) x) then raise exception 'a poll needs 2 to 6 different answers' using errcode = '22023'; end if;
    opts := opts || s;
  end loop;
  if cardinality(opts) < 2 or cardinality(opts) > 6 then raise exception 'a poll needs 2 to 6 different answers' using errcode = '22023'; end if;
  return jsonb_build_object('question', q, 'options', to_jsonb(opts));
end $$;

alter table public.irly_news add column if not exists poll jsonb;
alter table public.irly_news drop constraint if exists irly_news_poll_ok;
alter table public.irly_news add constraint irly_news_poll_ok check (poll is null or private.news_poll_clean(poll) = poll);

-- ───────── 2. Votes ─────────
create table if not exists public.irly_news_poll_votes (
  news_id uuid not null references public.irly_news (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  option smallint not null check (option between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (news_id, user_id)
);
alter table public.irly_news_poll_votes enable row level security;
-- Written by news_poll_vote() only; counts are read through the news functions.
revoke all on public.irly_news_poll_votes from public, anon, authenticated;

-- A suspended or banned account cannot vote (as for community polls).
drop trigger if exists irly_news_poll_votes_block_sanctioned on public.irly_news_poll_votes;
create trigger irly_news_poll_votes_block_sanctioned before insert on public.irly_news_poll_votes
  for each row execute function private.block_sanctioned();

/** A news item's poll for a screen: the question, the answers, the count of each, the total and the caller's answer (null if none). */
create or replace function private.news_poll_json(n public.irly_news) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select case when n.poll is null then null else jsonb_build_object(
    'question', n.poll -> 'question',
    'options', n.poll -> 'options',
    'counts', (select coalesce(jsonb_agg((select count(*) from public.irly_news_poll_votes v where v.news_id = n.id and v.option = o.i) order by o.i), '[]'::jsonb)
               from generate_series(0, jsonb_array_length(n.poll -> 'options') - 1) o (i)),
    'total', (select count(*) from public.irly_news_poll_votes v where v.news_id = n.id),
    'my_vote', (select v.option from public.irly_news_poll_votes v where v.news_id = n.id and v.user_id = auth.uid())) end
$$;
revoke all on function private.news_poll_json(public.irly_news) from public, anon, authenticated;

/**
 * Votes on (or changes one's answer to) a news item's poll. Only a signed-in
 * account that may read the item now; returns the poll with its new counts.
 */
create or replace function public.news_poll_vote(p_id uuid, p_option integer) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare n public.irly_news; me uuid := auth.uid();
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into n from public.irly_news where id = p_id;
  if n.id is null or not private.news_visible_to(n, me) then
    raise exception 'this news item is no longer available' using errcode = 'P0002';
  end if;
  if n.poll is null then raise exception 'this news item has no poll' using errcode = '22023'; end if;
  if p_option is null or p_option < 0 or p_option >= jsonb_array_length(n.poll -> 'options') then
    raise exception 'unknown answer' using errcode = '22023';
  end if;
  insert into public.irly_news_poll_votes (news_id, user_id, option) values (n.id, me, p_option)
  on conflict (news_id, user_id) do update set option = excluded.option, updated_at = now();
  return private.news_poll_json(n);
end $$;
revoke all on function public.news_poll_vote(uuid, integer) from public, anon;
grant execute on function public.news_poll_vote(uuid, integer) to authenticated;

-- ───────── 3. What members and the team read ─────────
/** A member's card says there is a poll; the article carries it with its counts. */
create or replace function private.news_member_json(n public.irly_news, p_full boolean) returns jsonb
language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object('id', n.id, 'title', n.title, 'subtitle', n.subtitle, 'cover_path', n.cover_path,
    'cover_key', n.cover_key, 'category', n.category, 'publish_at', n.publish_at, 'audience', n.audience,
    'cta_label', n.cta_label, 'cta_url', n.cta_url, 'video', n.video_path is not null, 'has_poll', n.poll is not null))
  || case when p_full then jsonb_strip_nulls(jsonb_build_object('body', n.body, 'gallery_paths', to_jsonb(n.gallery_paths), 'video_path', n.video_path,
            'poll', private.news_poll_json(n)))
          else '{}'::jsonb end
$$;

create or replace function private.news_admin_json(n public.irly_news) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', n.id, 'title', n.title, 'subtitle', n.subtitle, 'body', n.body, 'cover_path', n.cover_path,
    'cover_key', n.cover_key, 'gallery_paths', to_jsonb(n.gallery_paths), 'video_path', n.video_path, 'category', n.category,
    'status', n.status, 'state', private.news_state(n), 'publish_at', n.publish_at, 'audience', n.audience, 'position', n.position,
    'cta_label', n.cta_label, 'cta_url', n.cta_url, 'notify', n.notify, 'notified_at', n.notified_at, 'went_live_at', n.went_live_at,
    'created_at', n.created_at, 'updated_at', n.updated_at, 'poll', private.news_poll_json(n))
$$;

-- ───────── 4. The team writes the poll ─────────
/**
 * As in 20261028500000_irly_admin_cms, plus « poll »: {question, options}
 * to set it, null to remove it. Refused once someone voted, unless it is
 * sent unchanged.
 */
create or replace function public.admin_news_save(p_id uuid, p_news jsonb) returns uuid
language plpgsql security definer set search_path = public, private as $$
declare
  n public.irly_news;
  f text;
  keep text[];
  fresh boolean := p_id is null;
  g jsonb;
  pl jsonb;
  allowed constant text[] := array['title', 'subtitle', 'body', 'cover_path', 'cover_key', 'gallery_paths', 'video_path', 'category',
    'audience', 'cta_label', 'cta_url', 'notify', 'position', 'poll'];
begin
  perform private.need_photo_staff('content');
  if p_news is null or jsonb_typeof(p_news) <> 'object' then raise exception 'invalid value' using errcode = '22023'; end if;
  for f in select jsonb_object_keys(p_news) loop
    if not f = any (allowed) then raise exception 'unknown field' using errcode = '22023'; end if;
  end loop;
  if fresh then
    n.id := gen_random_uuid(); n.status := 'draft'; n.body := ''; n.gallery_paths := '{}'; n.category := 'news';
    n.audience := 'both'; n.notify := false; n.created_by := auth.uid(); n.created_at := now();
    n.position := coalesce((select min(x.position) - 1 from public.irly_news x where x.deleted_at is null), 0);
  else
    select * into n from public.irly_news where id = p_id and deleted_at is null for update;
    if n.id is null then raise exception 'this news item no longer exists' using errcode = 'P0002'; end if;
  end if;
  keep := array_remove(n.gallery_paths || array[n.cover_path, n.video_path], null);

  if p_news ? 'title' then n.title := private.cms_text(p_news, 'title', 120, 'a title'); end if;
  if char_length(coalesce(n.title, '')) < 3 then raise exception 'a title needs 3 to 120 characters' using errcode = '22023'; end if;
  if p_news ? 'subtitle' then n.subtitle := private.cms_text(p_news, 'subtitle', 200, 'a subtitle'); end if;
  if p_news ? 'body' then n.body := coalesce(private.cms_text(p_news, 'body', 10000, 'the text'), ''); end if;
  if p_news ? 'category' then
    n.category := private.cms_text(p_news, 'category', 20, 'a category');
    if n.category is null or n.category not in ('news', 'event', 'feature', 'community', 'tips', 'partner') then
      raise exception 'unknown category' using errcode = '22023';
    end if;
  end if;
  if p_news ? 'audience' then
    n.audience := private.cms_text(p_news, 'audience', 10, 'an audience');
    if n.audience is null or n.audience not in ('mixte', 'girl', 'both') then raise exception 'unknown audience' using errcode = '22023'; end if;
  end if;
  if p_news ? 'cover_key' then
    n.cover_key := private.cms_text(p_news, 'cover_key', 64, 'a photo');
    if n.cover_key !~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$' then raise exception 'unknown photo' using errcode = '22023'; end if;
  end if;
  if p_news ? 'cover_path' then
    n.cover_path := private.cms_text(p_news, 'cover_path', 120, 'a photo');
    perform private.cms_need_file(n.cover_path, false, keep);
  end if;
  if p_news ? 'video_path' then
    n.video_path := private.cms_text(p_news, 'video_path', 120, 'a video');
    perform private.cms_need_file(n.video_path, true, keep);
  end if;
  if p_news ? 'gallery_paths' then
    g := p_news -> 'gallery_paths';
    if jsonb_typeof(g) <> 'array' or exists (select 1 from jsonb_array_elements(g) x where jsonb_typeof(x) <> 'string') then
      raise exception 'invalid value' using errcode = '22023';
    end if;
    if jsonb_array_length(g) > 12 then raise exception 'the gallery has too many items (at most 12)' using errcode = '22023'; end if;
    n.gallery_paths := array(select x from jsonb_array_elements_text(g) with ordinality t(x, i) order by i);
    for f in select unnest(n.gallery_paths) loop perform private.cms_need_file(f, false, keep); end loop;
  end if;
  if p_news ? 'cta_label' then n.cta_label := private.cms_text(p_news, 'cta_label', 40, 'a button label'); end if;
  if p_news ? 'cta_url' then
    n.cta_url := private.cms_text(p_news, 'cta_url', 500, 'a link');
    if not private.cms_destination_ok(n.cta_url) then raise exception 'invalid destination' using errcode = '22023'; end if;
  end if;
  if n.cta_url is not null and n.cta_label is null then raise exception 'a link needs a button label' using errcode = '22023'; end if;
  if p_news ? 'notify' then
    if jsonb_typeof(p_news -> 'notify') <> 'boolean' then raise exception 'invalid value' using errcode = '22023'; end if;
    -- Decided when the item first goes live: never sent (nor cancelled) by an edit afterwards.
    if n.went_live_at is null and n.notified_at is null then n.notify := (p_news ->> 'notify')::boolean; end if;
  end if;
  if p_news ? 'position' then
    if jsonb_typeof(p_news -> 'position') <> 'number' then raise exception 'invalid value' using errcode = '22023'; end if;
    n.position := greatest(-100000, least(100000, (p_news ->> 'position')::numeric::integer));
  end if;
  if p_news ? 'poll' then
    pl := private.news_poll_clean(p_news -> 'poll');
    if pl is distinct from n.poll and not fresh
       and exists (select 1 from public.irly_news_poll_votes v where v.news_id = n.id) then
      raise exception 'a poll cannot change once people voted' using errcode = '42501';
    end if;
    n.poll := pl;
  end if;
  n.updated_by := auth.uid();
  n.updated_at := now();

  insert into public.irly_news as x values (n.*)
  on conflict (id) do update set title = excluded.title, subtitle = excluded.subtitle, body = excluded.body,
    cover_path = excluded.cover_path, cover_key = excluded.cover_key, gallery_paths = excluded.gallery_paths,
    video_path = excluded.video_path, category = excluded.category, audience = excluded.audience, position = excluded.position,
    cta_label = excluded.cta_label, cta_url = excluded.cta_url, notify = excluded.notify, poll = excluded.poll,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  perform private.journal(case when fresh then 'news.created' else 'news.edited' end, null, null, 'news', n.id, null,
    jsonb_build_object('fields', (select jsonb_agg(k order by k) from jsonb_object_keys(p_news) k)));
  return n.id;
end $$;
revoke all on function public.admin_news_save(uuid, jsonb) from public, anon;
grant execute on function public.admin_news_save(uuid, jsonb) to authenticated;
