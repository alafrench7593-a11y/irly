-- IRLY back office, editorial: the team's own news (« Actualités »), the
-- Home's layout per flavour (IRLY Mixte, IRLY Girl) and the Home banners.
--
-- 1. News (public.irly_news): written only through the admin_news_* calls
--    below (content staff and above, not suspended: private.need_photo_staff
--    of 20261027700000), every change in the staff journal (private.journal).
--    A row is a draft, published or unpublished; « scheduled » is a published
--    row whose publish_at is still ahead: members never see it before, as
--    every read filters publish_at <= now() (no job needed to show it).
--    Deleting is soft (deleted_at). One row per news item: its audience is
--    'mixte' (IRLY), 'girl' (IRLY Girl) or 'both', never a copy per flavour.
--    Members read through home_feed() and news_item(): published, visible
--    now, not deleted, and a Girl item only for an account that passes
--    private.girl_eligible_unchecked (the single IRLY Girl rule). Signed-out
--    visitors read the IRLY ones. The table itself is closed to the API.
-- 2. Notifications: a news item with notify on reaches its readers once, as
--    an in-app notification 'IRLY_NEWS' (and a push through the existing
--    push pipeline), when it first becomes visible: at once when it is
--    published now, else by the minute job (pg_cron) when its time comes,
--    or the next time the team opens the news list. notified_at, taken in
--    the same statement that sends, and a unique index per member and item
--    make it once only; editing, unpublishing and republishing never send it
--    again. Girl items are sent to IRLY Girl members only, and a member who
--    loses IRLY Girl no longer reads them (restrictive rule below).
-- 3. Home layout (public.home_layouts): a draft and a published list of
--    sections per flavour, checked strictly by the server (known sections,
--    their real styles, counts within bounds, known categories, safe links).
--    Saving the draft never changes what members see; publishing copies the
--    draft in one statement and keeps a version (public.home_layout_versions)
--    that can be brought back into the draft. A layout only orders and
--    words the Home: every section still reads its data through its own
--    calls and rules (an IRLY Girl section through the Girl ones).
-- 4. Banners (public.irly_banners): image, title, text, link, audience,
--    placement (the Home), order, on/off and optional dates.
-- 5. Files: a private bucket "cms-media" (photos, and videos within the
--    limit posts already use). Content staff upload into their own folder;
--    a file is readable by a member only while a published news item, an
--    active banner or a published layout that this member may see uses it
--    (a Girl item's photo only by IRLY Girl members, a draft's by the team).
--    Nothing here deletes a stored file.
-- Additive: no table or column is dropped, RLS stays on everywhere.

-- ───────── 0. Shared checks ─────────
/** The categories of the app's catalogue (src/data/catalog/categories.ts; scripts/check-cms.mts compares). */
create or replace function private.cms_categories() returns text[]
language sql immutable as $$
  select array['sport', 'networking', 'food', 'travel', 'outdoor', 'shopping', 'culture', 'entertainment', 'nightlife', 'wellness',
    'animals', 'family', 'creative', 'learning', 'outings', 'cafes', 'beach', 'games', 'experiences', 'communities']
$$;

/**
 * A link a button may open: a screen of the app (the list below, the same
 * as src/features/cms/destinations.ts) or a secure web address.
 */
create or replace function private.cms_destination_ok(p text) returns boolean
language sql immutable as $$
  select p is null or (char_length(p) <= 500 and (
    p ~ '^/(discover|live|map|messages|notifications|profile|social|communities|activities|calendar|categories|events|eat|search|saved|network|girl|girl/match|girl/moving|bali|news|help|services|business|recap|actu|match|support)(\?[A-Za-z0-9_=&-]{1,100})?$'
    or p ~ '^/(category|activities|space|place)/[a-z0-9-]{1,60}$'
    or p ~ '^/(c|a|actu|person)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{2,5})?(/[^[:space:]<>"]*)?$'))
$$;

/** A stored file of the team: "<their id>/<name>", photo or (videos allowed) mp4/mov. */
create or replace function private.cms_path_ok(p text, p_video boolean default false) returns boolean
language sql immutable as $$
  select p ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'
    and (case when p_video then p ~* '\.(mp4|mov)$' else p ~* '\.(jpg|jpeg|png|webp)$' end)
$$;

/**
 * A new file put on a news item, a banner or a layout: one of the caller's
 * own uploads (unless it was already there), stored where Storage exists.
 */
create or replace function private.cms_need_file(p text, p_video boolean, p_keep text[]) returns void
language plpgsql stable security definer set search_path = public, private as $$
declare stored boolean;
begin
  if p is null or p = any (coalesce(p_keep, '{}')) then return; end if;
  if not private.cms_path_ok(p, p_video) then raise exception 'invalid file' using errcode = '22023'; end if;
  if not private.own_upload(p) then raise exception 'the photo must be one of your own uploads' using errcode = '42501'; end if;
  if to_regclass('storage.objects') is not null then
    execute 'select exists (select 1 from storage.objects where bucket_id = ''cms-media'' and name = $1)' into stored using p;
    if not stored then raise exception 'the photo was not uploaded' using errcode = 'P0002'; end if;
  end if;
end $$;
revoke all on function private.cms_need_file(text, boolean, text[]) from public, anon, authenticated;

/** A text field of a request: absent (keep), null or a string (trimmed, empty = null); anything else is refused. */
create or replace function private.cms_text(p jsonb, p_field text, p_max integer, p_label text) returns text
language plpgsql immutable as $$
declare v text;
begin
  if p -> p_field is null or jsonb_typeof(p -> p_field) = 'null' then return null; end if;
  if jsonb_typeof(p -> p_field) <> 'string' then raise exception 'invalid value' using errcode = '22023'; end if;
  v := nullif(btrim(p ->> p_field), '');
  if char_length(v) > p_max then raise exception '% is at most % characters', p_label, p_max using errcode = '22023'; end if;
  return v;
end $$;

-- ───────── 1. News ─────────
create table if not exists public.irly_news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  subtitle text check (char_length(subtitle) <= 200),
  body text not null default '' check (char_length(body) <= 10000),
  -- The cover: the team's upload, else one of IRLY's own photos (a key of src/data/photos.ts).
  cover_path text check (cover_path is null or private.cms_path_ok(cover_path)),
  cover_key text check (cover_key is null or cover_key ~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$'),
  gallery_paths text[] not null default '{}' check (cardinality(gallery_paths) <= 12),
  video_path text check (video_path is null or private.cms_path_ok(video_path, true)),
  category text not null default 'news' check (category in ('news', 'event', 'feature', 'community', 'tips', 'partner')),
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  publish_at timestamptz,
  audience text not null default 'both' check (audience in ('mixte', 'girl', 'both')),
  position integer not null default 0,
  cta_label text check (char_length(cta_label) <= 40),
  cta_url text check (private.cms_destination_ok(cta_url)),
  notify boolean not null default false,
  notified_at timestamptz,
  -- First time members could see it (published, its time reached): the notification is decided then, once.
  went_live_at timestamptz,
  first_published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (status = 'draft' or publish_at is not null)
);
create index if not exists irly_news_feed_idx on public.irly_news (position, publish_at desc) where status = 'published' and deleted_at is null;
alter table public.irly_news enable row level security;
-- Read through home_feed() / news_item() / admin_news_*; written by admin_news_* only.
revoke all on public.irly_news from public, anon, authenticated;

/** Can this person (null: signed out) read this news item now? */
create or replace function private.news_visible_to(n public.irly_news, uid uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select n.status = 'published' and n.publish_at <= now() and n.deleted_at is null
    and (n.audience <> 'girl' or (uid is not null and private.girl_eligible_unchecked(uid)))
$$;
revoke all on function private.news_visible_to(public.irly_news, uuid) from public, anon, authenticated;

/** Where a news item stands for the team: draft, scheduled, published, unpublished or deleted. */
create or replace function private.news_state(n public.irly_news) returns text
language sql stable as $$
  select case when n.deleted_at is not null then 'deleted'
              when n.status = 'published' and n.publish_at > now() then 'scheduled'
              else n.status end
$$;

create or replace function private.news_admin_json(n public.irly_news) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', n.id, 'title', n.title, 'subtitle', n.subtitle, 'body', n.body, 'cover_path', n.cover_path,
    'cover_key', n.cover_key, 'gallery_paths', to_jsonb(n.gallery_paths), 'video_path', n.video_path, 'category', n.category,
    'status', n.status, 'state', private.news_state(n), 'publish_at', n.publish_at, 'audience', n.audience, 'position', n.position,
    'cta_label', n.cta_label, 'cta_url', n.cta_url, 'notify', n.notify, 'notified_at', n.notified_at, 'went_live_at', n.went_live_at,
    'created_at', n.created_at, 'updated_at', n.updated_at)
$$;

/** What a member's screen gets of a news item (body only for the article itself). */
create or replace function private.news_member_json(n public.irly_news, p_full boolean) returns jsonb
language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object('id', n.id, 'title', n.title, 'subtitle', n.subtitle, 'cover_path', n.cover_path,
    'cover_key', n.cover_key, 'category', n.category, 'publish_at', n.publish_at, 'audience', n.audience,
    'cta_label', n.cta_label, 'cta_url', n.cta_url, 'video', n.video_path is not null))
  || case when p_full then jsonb_strip_nulls(jsonb_build_object('body', n.body, 'gallery_paths', to_jsonb(n.gallery_paths), 'video_path', n.video_path))
          else '{}'::jsonb end
$$;

-- Notifications: one more kind, added to whatever the list holds now (other changes to it are kept).
do $$
declare def text; kinds text[];
begin
  select pg_get_constraintdef(c.oid) into def from pg_constraint c
  where c.conrelid = 'public.notifications'::regclass and c.conname = 'notifications_kind_check';
  if def is null or position('''IRLY_NEWS''' in def) > 0 then return; end if;
  select array_agg(m.x[1]) into kinds from regexp_matches(def, '''([A-Z_]+)''', 'g') as m(x);
  alter table public.notifications drop constraint notifications_kind_check;
  execute format('alter table public.notifications add constraint notifications_kind_check check (kind = any (%L::text[]))', kinds || 'IRLY_NEWS'::text);
end $$;
-- Once per member and news item, whatever happens.
create unique index if not exists notifications_news_once on public.notifications (user_id, (payload ->> 'news_id')) where kind = 'IRLY_NEWS';

/** A notification about a news item stays readable only while its reader may read a Girl item, if it is one. */
create or replace function private.news_notification_readable(p_payload jsonb) returns boolean
language sql stable security definer set search_path = public, private as $$
  select not exists (select 1 from public.irly_news n where n.id = private.uuid_or_null(p_payload ->> 'news_id') and n.audience = 'girl')
    or private.girl_eligible_unchecked(auth.uid())
$$;
revoke all on function private.news_notification_readable(jsonb) from public, anon;
grant execute on function private.news_notification_readable(jsonb) to authenticated;
drop policy if exists notifications_news_girl on public.notifications;
create policy notifications_news_girl on public.notifications as restrictive for select to authenticated
  using (kind <> 'IRLY_NEWS' or private.news_notification_readable(payload));

/**
 * Sends a news item's notification, once: only if it asks for one, was never
 * sent, and is visible now. Each reader gets one in-app notification (the
 * push follows through the usual pipeline); a Girl item only reaches IRLY
 * Girl members. Returns how many were written.
 */
create or replace function private.news_send(p_id uuid) returns integer
language plpgsql security definer set search_path = public, private as $$
declare n public.irly_news; sent integer;
begin
  update public.irly_news set notified_at = now()
  where id = p_id and notify and notified_at is null and status = 'published' and publish_at <= now() and deleted_at is null
  returning * into n;
  if n.id is null then return 0; end if;
  insert into public.notifications (user_id, kind, payload)
  select p.id, 'IRLY_NEWS', jsonb_build_object('news_id', n.id, 'title', n.title, 'girl', n.audience = 'girl')
  from public.profiles p
  where p.deleted_at is null and (n.audience <> 'girl' or private.girl_eligible_unchecked(p.id))
  on conflict do nothing;
  get diagnostics sent = row_count;
  perform private.journal('news.notified', null, null, 'news', n.id, null, jsonb_build_object('sent', sent));
  return sent;
end $$;
revoke all on function private.news_send(uuid) from public, anon, authenticated;

/**
 * Published items whose time has come and that nobody saw yet: marked live,
 * and notified if they ask for it. Run by the minute job, after a publish,
 * and when the team opens the list (where pg_cron is missing).
 */
create or replace function private.news_go_live(p_only uuid default null) returns integer
language plpgsql security definer set search_path = public, private as $$
declare r record; n integer := 0;
begin
  for r in
    select id, notify from public.irly_news
    where status = 'published' and publish_at <= now() and deleted_at is null and went_live_at is null
      and (p_only is null or id = p_only)
    for update skip locked
  loop
    update public.irly_news set went_live_at = now() where id = r.id;
    if r.notify then n := n + private.news_send(r.id); end if;
  end loop;
  return n;
end $$;
revoke all on function private.news_go_live(uuid) from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'irly-news-live';
  perform cron.schedule('irly-news-live', '* * * * *', 'select private.news_go_live()');
exception when others then
  raise notice 'pg_cron not available: scheduled news notify when the team next opens the news list';
end $$;

-- The phone notification of a news item: its title, opening the article.
create or replace function private.news_push_text() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare k text; p jsonb; fr boolean;
begin
  select x.kind, x.payload into k, p from public.notifications x where x.id = new.notification_id;
  if k is distinct from 'IRLY_NEWS' then return new; end if;
  fr := coalesce((select t.lang from public.push_tokens t where t.token = new.token), 'en') = 'fr';
  new.title := case when (p ->> 'girl')::boolean then 'IRLY Girl' else 'IRLY' end;
  new.body := coalesce(left(nullif(p ->> 'title', ''), 140), case when fr then 'Nouvelle actualité' else 'New from IRLY' end);
  new.url := case when private.uuid_or_null(p ->> 'news_id') is not null then '/actu/' || (p ->> 'news_id') else '/notifications' end;
  return new;
end $$;
revoke all on function private.news_push_text() from public, anon, authenticated;
drop trigger if exists push_outbox_news_text on public.push_outbox;
create trigger push_outbox_news_text before insert on public.push_outbox
  for each row execute function private.news_push_text();

-- ───────── 1b. News, for the team ─────────
/** Every news item not deleted, in their order (scheduled ones that came due are marked live first). */
create or replace function public.admin_news_list() returns jsonb
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.need_photo_staff('content');
  perform private.news_go_live();
  return coalesce((select jsonb_agg(private.news_admin_json(n) order by n.position, n.created_at desc)
    from public.irly_news n where n.deleted_at is null), '[]'::jsonb);
end $$;
revoke all on function public.admin_news_list() from public, anon;
grant execute on function public.admin_news_list() to authenticated;

create or replace function public.admin_news_get(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare n public.irly_news;
begin
  perform private.need_photo_staff('content');
  select * into n from public.irly_news where id = p_id and deleted_at is null;
  if n.id is null then raise exception 'this news item no longer exists' using errcode = 'P0002'; end if;
  return private.news_admin_json(n);
end $$;
revoke all on function public.admin_news_get(uuid) from public, anon;
grant execute on function public.admin_news_get(uuid) to authenticated;

/**
 * Creates (p_id null: a draft) or changes a news item. Only the fields sent
 * change; an unknown field, a wrong type or a bad value refuses the whole
 * save. A published item changes for members at once (no new notification).
 * « notify » can no longer change once the item went live.
 */
create or replace function public.admin_news_save(p_id uuid, p_news jsonb) returns uuid
language plpgsql security definer set search_path = public, private as $$
declare
  n public.irly_news;
  f text;
  keep text[];
  fresh boolean := p_id is null;
  g jsonb;
  allowed constant text[] := array['title', 'subtitle', 'body', 'cover_path', 'cover_key', 'gallery_paths', 'video_path', 'category',
    'audience', 'cta_label', 'cta_url', 'notify', 'position'];
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
  n.updated_by := auth.uid();
  n.updated_at := now();

  insert into public.irly_news as x values (n.*)
  on conflict (id) do update set title = excluded.title, subtitle = excluded.subtitle, body = excluded.body,
    cover_path = excluded.cover_path, cover_key = excluded.cover_key, gallery_paths = excluded.gallery_paths,
    video_path = excluded.video_path, category = excluded.category, audience = excluded.audience, position = excluded.position,
    cta_label = excluded.cta_label, cta_url = excluded.cta_url, notify = excluded.notify,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  perform private.journal(case when fresh then 'news.created' else 'news.edited' end, null, null, 'news', n.id, null,
    jsonb_build_object('fields', (select jsonb_agg(k order by k) from jsonb_object_keys(p_news) k)));
  return n.id;
end $$;
revoke all on function public.admin_news_save(uuid, jsonb) from public, anon;
grant execute on function public.admin_news_save(uuid, jsonb) to authenticated;

/**
 * Publishes now (p_at null or past) or schedules (p_at ahead, a year at
 * most). Republishing an unpublished item works the same way; it is never
 * notified a second time. Returns the item.
 */
create or replace function public.admin_news_publish(p_id uuid, p_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare n public.irly_news; v_at timestamptz := greatest(coalesce(p_at, now()), now());
begin
  perform private.need_photo_staff('content');
  select * into n from public.irly_news where id = p_id and deleted_at is null for update;
  if n.id is null then raise exception 'this news item no longer exists' using errcode = 'P0002'; end if;
  if char_length(btrim(n.body)) = 0 then raise exception 'add a text before publishing' using errcode = '22023'; end if;
  if v_at > now() + interval '366 days' then raise exception 'pick a date within a year' using errcode = '22023'; end if;
  update public.irly_news set status = 'published', publish_at = v_at, first_published_at = coalesce(first_published_at, now()),
    updated_by = auth.uid(), updated_at = now()
  where id = p_id;
  perform private.journal(case when v_at > now() then 'news.scheduled' when n.status = 'unpublished' then 'news.republished' else 'news.published' end,
    null, null, 'news', p_id, null, jsonb_build_object('publish_at', v_at));
  perform private.news_go_live(p_id);
  select * into n from public.irly_news where id = p_id;
  return private.news_admin_json(n);
end $$;
revoke all on function public.admin_news_publish(uuid, timestamptz) from public, anon;
grant execute on function public.admin_news_publish(uuid, timestamptz) to authenticated;

/** Takes a published (or scheduled) item off members' screens; it can be published again. */
create or replace function public.admin_news_unpublish(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare n public.irly_news;
begin
  perform private.need_photo_staff('content');
  update public.irly_news set status = 'unpublished', updated_by = auth.uid(), updated_at = now()
  where id = p_id and deleted_at is null and status = 'published'
  returning * into n;
  if n.id is null then
    select * into n from public.irly_news where id = p_id and deleted_at is null;
    if n.id is null then raise exception 'this news item no longer exists' using errcode = 'P0002'; end if;
    return private.news_admin_json(n);
  end if;
  perform private.journal('news.unpublished', null, null, 'news', p_id, null);
  return private.news_admin_json(n);
end $$;
revoke all on function public.admin_news_unpublish(uuid) from public, anon;
grant execute on function public.admin_news_unpublish(uuid) to authenticated;

/** Deletes a news item (kept, out of every list: soft delete). Its files stay stored. */
create or replace function public.admin_news_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.need_photo_staff('content');
  update public.irly_news set deleted_at = now(), updated_by = auth.uid(), updated_at = now() where id = p_id and deleted_at is null;
  if not found then raise exception 'this news item no longer exists' using errcode = 'P0002'; end if;
  perform private.journal('news.deleted', null, null, 'news', p_id, null);
end $$;
revoke all on function public.admin_news_delete(uuid) from public, anon;
grant execute on function public.admin_news_delete(uuid) to authenticated;

/** Puts news items in this order (first = top); items not listed keep theirs, after these. */
create or replace function public.admin_news_reorder(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.need_photo_staff('content');
  if p_ids is null or cardinality(p_ids) > 500 then raise exception 'invalid value' using errcode = '22023'; end if;
  update public.irly_news n set position = x.i - 1
  from unnest(p_ids) with ordinality x(id, i) where n.id = x.id and n.deleted_at is null;
  update public.irly_news n set position = cardinality(p_ids) + r.rn
  from (select x.id, row_number() over (order by x.position, x.created_at desc) rn
        from public.irly_news x where x.deleted_at is null and not (x.id = any (p_ids))) r
  where n.id = r.id;
  perform private.journal('news.reordered', null, null, 'news', null, null, jsonb_build_object('count', cardinality(p_ids)));
end $$;
revoke all on function public.admin_news_reorder(uuid[]) from public, anon;
grant execute on function public.admin_news_reorder(uuid[]) to authenticated;

-- ───────── 2. Banners ─────────
create table if not exists public.irly_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  body text check (char_length(body) <= 200),
  -- The banner's own upload (a new file on every replacement), else one of IRLY's own photos.
  image_path text check (image_path is null or private.cms_path_ok(image_path)),
  image_key text check (image_key is null or image_key ~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$'),
  cta_label text check (char_length(cta_label) <= 40),
  cta_url text check (private.cms_destination_ok(cta_url)),
  audience text not null default 'both' check (audience in ('mixte', 'girl', 'both')),
  -- Where it shows: the Home is the one place that has banners.
  placement text not null default 'home' check (placement in ('home')),
  position integer not null default 0,
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
alter table public.irly_banners enable row level security;
revoke all on public.irly_banners from public, anon, authenticated;

create or replace function private.banner_visible_to(b public.irly_banners, uid uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select b.active and b.deleted_at is null and (b.starts_at is null or b.starts_at <= now()) and (b.ends_at is null or b.ends_at > now())
    and (b.audience <> 'girl' or (uid is not null and private.girl_eligible_unchecked(uid)))
$$;
revoke all on function private.banner_visible_to(public.irly_banners, uuid) from public, anon, authenticated;

create or replace function private.banner_json(b public.irly_banners) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', b.id, 'title', b.title, 'body', b.body, 'image_path', b.image_path, 'image_key', b.image_key,
    'cta_label', b.cta_label, 'cta_url', b.cta_url, 'audience', b.audience, 'placement', b.placement, 'position', b.position,
    'active', b.active, 'starts_at', b.starts_at, 'ends_at', b.ends_at, 'updated_at', b.updated_at)
$$;

create or replace function public.admin_banner_list() returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
begin
  perform private.need_photo_staff('content');
  return coalesce((select jsonb_agg(private.banner_json(b) order by b.position, b.created_at desc)
    from public.irly_banners b where b.deleted_at is null), '[]'::jsonb);
end $$;
revoke all on function public.admin_banner_list() from public, anon;
grant execute on function public.admin_banner_list() to authenticated;

/** Creates (p_id null) or changes a banner; only the fields sent change, all checked. */
create or replace function public.admin_banner_save(p_id uuid, p_banner jsonb) returns uuid
language plpgsql security definer set search_path = public, private as $$
declare
  b public.irly_banners;
  f text;
  fresh boolean := p_id is null;
  allowed constant text[] := array['title', 'body', 'image_path', 'image_key', 'cta_label', 'cta_url', 'audience', 'placement',
    'position', 'active', 'starts_at', 'ends_at'];
begin
  perform private.need_photo_staff('content');
  if p_banner is null or jsonb_typeof(p_banner) <> 'object' then raise exception 'invalid value' using errcode = '22023'; end if;
  for f in select jsonb_object_keys(p_banner) loop
    if not f = any (allowed) then raise exception 'unknown field' using errcode = '22023'; end if;
  end loop;
  if fresh then
    b.id := gen_random_uuid(); b.audience := 'both'; b.placement := 'home'; b.active := false; b.created_by := auth.uid(); b.created_at := now();
    b.position := coalesce((select min(x.position) - 1 from public.irly_banners x where x.deleted_at is null), 0);
  else
    select * into b from public.irly_banners where id = p_id and deleted_at is null for update;
    if b.id is null then raise exception 'this banner no longer exists' using errcode = 'P0002'; end if;
  end if;
  if p_banner ? 'title' then b.title := private.cms_text(p_banner, 'title', 80, 'a title'); end if;
  if b.title is null then raise exception 'a banner needs a title' using errcode = '22023'; end if;
  if p_banner ? 'body' then b.body := private.cms_text(p_banner, 'body', 200, 'the text'); end if;
  if p_banner ? 'image_key' then
    b.image_key := private.cms_text(p_banner, 'image_key', 64, 'a photo');
    if b.image_key !~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$' then raise exception 'unknown photo' using errcode = '22023'; end if;
  end if;
  if p_banner ? 'image_path' then
    f := b.image_path;
    b.image_path := private.cms_text(p_banner, 'image_path', 120, 'a photo');
    perform private.cms_need_file(b.image_path, false, array_remove(array[f], null));
  end if;
  if p_banner ? 'cta_label' then b.cta_label := private.cms_text(p_banner, 'cta_label', 40, 'a button label'); end if;
  if p_banner ? 'cta_url' then
    b.cta_url := private.cms_text(p_banner, 'cta_url', 500, 'a link');
    if not private.cms_destination_ok(b.cta_url) then raise exception 'invalid destination' using errcode = '22023'; end if;
  end if;
  if p_banner ? 'audience' then
    b.audience := private.cms_text(p_banner, 'audience', 10, 'an audience');
    if b.audience is null or b.audience not in ('mixte', 'girl', 'both') then raise exception 'unknown audience' using errcode = '22023'; end if;
  end if;
  if p_banner ? 'placement' then
    b.placement := private.cms_text(p_banner, 'placement', 20, 'a placement');
    if b.placement is distinct from 'home' then raise exception 'unknown placement' using errcode = '22023'; end if;
  end if;
  if p_banner ? 'active' then
    if jsonb_typeof(p_banner -> 'active') <> 'boolean' then raise exception 'invalid value' using errcode = '22023'; end if;
    b.active := (p_banner ->> 'active')::boolean;
  end if;
  if p_banner ? 'position' then
    if jsonb_typeof(p_banner -> 'position') <> 'number' then raise exception 'invalid value' using errcode = '22023'; end if;
    b.position := greatest(-100000, least(100000, (p_banner ->> 'position')::numeric::integer));
  end if;
  begin
    if p_banner ? 'starts_at' then b.starts_at := nullif(p_banner ->> 'starts_at', '')::timestamptz; end if;
    if p_banner ? 'ends_at' then b.ends_at := nullif(p_banner ->> 'ends_at', '')::timestamptz; end if;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'invalid value' using errcode = '22023';
  end;
  if b.ends_at is not null and b.starts_at is not null and b.ends_at <= b.starts_at then
    raise exception 'the end must come after the start' using errcode = '22023';
  end if;
  b.updated_by := auth.uid();
  b.updated_at := now();
  insert into public.irly_banners as x values (b.*)
  on conflict (id) do update set title = excluded.title, body = excluded.body, image_path = excluded.image_path,
    image_key = excluded.image_key, cta_label = excluded.cta_label, cta_url = excluded.cta_url, audience = excluded.audience,
    placement = excluded.placement, position = excluded.position, active = excluded.active, starts_at = excluded.starts_at,
    ends_at = excluded.ends_at, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  perform private.journal(case when fresh then 'banner.created' else 'banner.edited' end, null, null, 'banner', b.id, null,
    jsonb_build_object('fields', (select jsonb_agg(k order by k) from jsonb_object_keys(p_banner) k)));
  return b.id;
end $$;
revoke all on function public.admin_banner_save(uuid, jsonb) from public, anon;
grant execute on function public.admin_banner_save(uuid, jsonb) to authenticated;

create or replace function public.admin_banner_reorder(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.need_photo_staff('content');
  if p_ids is null or cardinality(p_ids) > 200 then raise exception 'invalid value' using errcode = '22023'; end if;
  update public.irly_banners b set position = x.i - 1
  from unnest(p_ids) with ordinality x(id, i) where b.id = x.id and b.deleted_at is null;
  update public.irly_banners b set position = cardinality(p_ids) + r.rn
  from (select x.id, row_number() over (order by x.position, x.created_at desc) rn
        from public.irly_banners x where x.deleted_at is null and not (x.id = any (p_ids))) r
  where b.id = r.id;
  perform private.journal('banner.reordered', null, null, 'banner', null, null, jsonb_build_object('count', cardinality(p_ids)));
end $$;
revoke all on function public.admin_banner_reorder(uuid[]) from public, anon;
grant execute on function public.admin_banner_reorder(uuid[]) to authenticated;

create or replace function public.admin_banner_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.need_photo_staff('content');
  update public.irly_banners set deleted_at = now(), active = false, updated_by = auth.uid(), updated_at = now() where id = p_id and deleted_at is null;
  if not found then raise exception 'this banner no longer exists' using errcode = 'P0002'; end if;
  perform private.journal('banner.deleted', null, null, 'banner', p_id, null);
end $$;
revoke all on function public.admin_banner_delete(uuid) from public, anon;
grant execute on function public.admin_banner_delete(uuid) to authenticated;

-- ───────── 3. Home layout ─────────
/** The Home's sections, in the app's own order (src/features/home/sections.ts; scripts/check-cms.mts compares). */
create or replace function private.home_section_keys() returns text[]
language sql immutable as $$
  select array['search', 'today', 'news', 'categories', 'banners', 'featured', 'create', 'bali', 'sessions', 'people', 'explore',
    'portals', 'members', 'nearby', 'eat', 'yourCommunities', 'communities', 'forYou', 'footer']
$$;

/**
 * What the team may change on a section (src/features/cms/layout.ts holds
 * the same): its words (« text »: title and line above it), its button
 * (« cta »), a category, a cover, a style among those its component really
 * draws, a number of cards. Search stays first and the footer last.
 */
create or replace function private.home_section_spec(p_key text) returns jsonb
language sql immutable as $$
  select (case p_key
    when 'search' then '{"pinned": "first"}'
    when 'today' then '{"text": true, "cta": true}'
    when 'news' then '{"text": true, "cta": true, "styles": ["cards", "list"], "count": [1, 10]}'
    when 'categories' then '{}'
    when 'banners' then '{"styles": ["carousel", "stack"], "count": [1, 5]}'
    when 'featured' then '{"text": true, "cta": true, "styles": ["large", "compact"]}'
    when 'create' then '{}'
    when 'bali' then '{"cover": true}'
    when 'sessions' then '{"text": true, "cta": true, "count": [1, 5]}'
    when 'people' then '{"text": true, "cta": true, "count": [4, 20]}'
    when 'explore' then '{"text": true, "cta": true}'
    when 'portals' then '{"text": true}'
    when 'members' then '{}'
    when 'nearby' then '{"text": true, "cta": true, "category": true, "count": [2, 12]}'
    when 'eat' then '{"text": true, "cta": true, "count": [2, 12]}'
    when 'yourCommunities' then '{}'
    when 'communities' then '{"text": true, "cta": true, "count": [2, 12]}'
    when 'forYou' then '{"category": true, "count": [1, 6]}'
    when 'footer' then '{"pinned": "last"}'
  end)::jsonb
$$;

/**
 * A layout as the team sent it, checked and put in its stored form: a list
 * of every section in order (missing ones added where the app has them),
 * each {key, enabled, order, and only the overrides its section supports}.
 * Anything unknown or out of bounds refuses the whole layout.
 * p_keep: cover files already in the layout (not re-checked as uploads).
 */
create or replace function private.home_layout_clean(p_config jsonb, p_keep text[] default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  e jsonb;
  spec jsonb;
  k text;
  f text;
  v jsonb;
  item jsonb;
  items jsonb[] := '{}';
  seen text[] := '{}';
  keys constant text[] := private.home_section_keys();
  fields constant text[] := array['key', 'enabled', 'order', 'title_fr', 'title_en', 'subtitle_fr', 'subtitle_en', 'category', 'cover_path',
    'cover_key', 'style', 'count', 'cta_label_fr', 'cta_label_en', 'cta_url'];
  lo integer;
  hi integer;
  out jsonb := '[]';
  i integer := 0;
  shown integer := 0;
begin
  if p_config is null or jsonb_typeof(p_config) <> 'array' or jsonb_array_length(p_config) > 40 then
    raise exception 'the layout must be a list of sections' using errcode = '22023';
  end if;
  for e in
    select x from jsonb_array_elements(p_config) with ordinality t(x, n)
    order by case when jsonb_typeof(x -> 'order') = 'number' then (x ->> 'order')::numeric end nulls last, n
  loop
    if jsonb_typeof(e) <> 'object' then raise exception 'the layout must be a list of sections' using errcode = '22023'; end if;
    k := e ->> 'key';
    spec := private.home_section_spec(k);
    if spec is null then raise exception 'unknown section' using errcode = '22023'; end if;
    if k = any (seen) then raise exception 'a section is listed twice' using errcode = '22023'; end if;
    seen := seen || k;
    for f in select jsonb_object_keys(e) loop
      if not f = any (fields) then raise exception 'unknown field' using errcode = '22023'; end if;
    end loop;
    item := jsonb_build_object('key', k, 'enabled', true);
    if e ? 'enabled' then
      if jsonb_typeof(e -> 'enabled') <> 'boolean' then raise exception 'invalid value' using errcode = '22023'; end if;
      item := item || jsonb_build_object('enabled', (e ->> 'enabled')::boolean);
    end if;
    foreach f in array array['title_fr', 'title_en', 'subtitle_fr', 'subtitle_en'] loop
      v := to_jsonb(private.cms_text(e, f, 60, 'a section title'));
      if v is not null then
        if not coalesce((spec ->> 'text')::boolean, false) then raise exception 'this section cannot change that' using errcode = '22023'; end if;
        item := item || jsonb_build_object(f, v);
      end if;
    end loop;
    foreach f in array array['cta_label_fr', 'cta_label_en', 'cta_url'] loop
      v := to_jsonb(private.cms_text(e, f, case when f = 'cta_url' then 500 else 40 end, case when f = 'cta_url' then 'a link' else 'a button label' end));
      if v is not null then
        if not coalesce((spec ->> 'cta')::boolean, false) then raise exception 'this section cannot change that' using errcode = '22023'; end if;
        if f = 'cta_url' and not private.cms_destination_ok(v #>> '{}') then raise exception 'invalid destination' using errcode = '22023'; end if;
        item := item || jsonb_build_object(f, v);
      end if;
    end loop;
    v := to_jsonb(private.cms_text(e, 'category', 40, 'a category'));
    if v is not null then
      if not coalesce((spec ->> 'category')::boolean, false) then raise exception 'this section cannot change that' using errcode = '22023'; end if;
      if not (v #>> '{}') = any (private.cms_categories()) then raise exception 'unknown category' using errcode = '22023'; end if;
      item := item || jsonb_build_object('category', v);
    end if;
    v := to_jsonb(private.cms_text(e, 'cover_key', 64, 'a photo'));
    if v is not null then
      if not coalesce((spec ->> 'cover')::boolean, false) then raise exception 'this section cannot change that' using errcode = '22023'; end if;
      if (v #>> '{}') !~ '^[A-Za-z][A-Za-z0-9_-]{0,63}$' then raise exception 'unknown photo' using errcode = '22023'; end if;
      item := item || jsonb_build_object('cover_key', v);
    end if;
    v := to_jsonb(private.cms_text(e, 'cover_path', 120, 'a photo'));
    if v is not null then
      if not coalesce((spec ->> 'cover')::boolean, false) then raise exception 'this section cannot change that' using errcode = '22023'; end if;
      perform private.cms_need_file(v #>> '{}', false, p_keep);
      item := item || jsonb_build_object('cover_path', v);
    end if;
    v := to_jsonb(private.cms_text(e, 'style', 20, 'a style'));
    if v is not null then
      if not coalesce(spec -> 'styles', '[]'::jsonb) ? (v #>> '{}') then raise exception 'this section has no such style' using errcode = '22023'; end if;
      item := item || jsonb_build_object('style', v);
    end if;
    if e ? 'count' and jsonb_typeof(e -> 'count') <> 'null' then
      if spec -> 'count' is null then raise exception 'this section cannot change that' using errcode = '22023'; end if;
      lo := (spec -> 'count' ->> 0)::integer;
      hi := (spec -> 'count' ->> 1)::integer;
      if jsonb_typeof(e -> 'count') <> 'number' or (e ->> 'count')::numeric <> trunc((e ->> 'count')::numeric)
         or (e ->> 'count')::numeric not between lo and hi then
        raise exception 'number of cards out of range' using errcode = '22023';
      end if;
      item := item || jsonb_build_object('count', (e ->> 'count')::integer);
    end if;
    items := items || item;
  end loop;
  -- Sections this layout does not know yet (added by a newer app): shown where the app puts them.
  foreach k in array keys loop
    if not k = any (seen) then
      if k = 'search' then items := jsonb_build_object('key', k, 'enabled', true) || items;
      elsif k = 'footer' then items := items || jsonb_build_object('key', k, 'enabled', true);
      elsif items[cardinality(items)] ->> 'key' = 'footer' then
        items := items[1:cardinality(items) - 1] || jsonb_build_object('key', k, 'enabled', true) || items[cardinality(items)];
      else
        items := items || jsonb_build_object('key', k, 'enabled', true);
      end if;
    end if;
  end loop;
  if items[1] ->> 'key' <> 'search' or not (items[1] ->> 'enabled')::boolean
     or items[cardinality(items)] ->> 'key' <> 'footer' or not (items[cardinality(items)] ->> 'enabled')::boolean then
    raise exception 'search stays first and the footer last' using errcode = '22023';
  end if;
  foreach item in array items loop
    if (item ->> 'enabled')::boolean and item ->> 'key' not in ('search', 'footer') then shown := shown + 1; end if;
    out := out || jsonb_build_array(item || jsonb_build_object('order', i));
    i := i + 1;
  end loop;
  if shown = 0 then raise exception 'at least one section must stay visible' using errcode = '22023'; end if;
  return out;
end $$;
revoke all on function private.home_layout_clean(jsonb, text[]) from public, anon, authenticated;

create table if not exists public.home_layouts (
  flavour text primary key check (flavour in ('mixte', 'girl')),
  -- Empty: the app's own order.
  draft jsonb not null default '[]' check (jsonb_typeof(draft) = 'array'),
  published jsonb not null default '[]' check (jsonb_typeof(published) = 'array'),
  version integer not null default 0,
  draft_updated_at timestamptz,
  draft_updated_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null
);
alter table public.home_layouts enable row level security;
revoke all on public.home_layouts from public, anon, authenticated;
insert into public.home_layouts (flavour) values ('mixte'), ('girl') on conflict do nothing;

create table if not exists public.home_layout_versions (
  flavour text not null references public.home_layouts (flavour),
  version integer not null,
  config jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null,
  primary key (flavour, version)
);
alter table public.home_layout_versions enable row level security;
revoke all on public.home_layout_versions from public, anon, authenticated;

/** Cover files a layout row already uses (draft, published, kept versions). */
create or replace function private.home_layout_files(p_flavour text) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct x ->> 'cover_path') filter (where x ->> 'cover_path' is not null), '{}')
  from (
    select jsonb_array_elements(l.draft) x from public.home_layouts l where l.flavour = p_flavour
    union all select jsonb_array_elements(l.published) from public.home_layouts l where l.flavour = p_flavour
    union all select jsonb_array_elements(v.config) from public.home_layout_versions v where v.flavour = p_flavour
  ) s
$$;
revoke all on function private.home_layout_files(text) from public, anon, authenticated;

create or replace function private.home_flavour(p text) returns text
language plpgsql immutable as $$
begin
  if p is null or p not in ('mixte', 'girl') then raise exception 'unknown flavour' using errcode = '22023'; end if;
  return p;
end $$;

/** The draft and published layouts of a flavour, with the last published versions. */
create or replace function public.admin_home_layout_get(p_flavour text) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare l public.home_layouts;
begin
  perform private.need_photo_staff('content');
  select * into l from public.home_layouts where flavour = private.home_flavour(p_flavour);
  return jsonb_build_object('flavour', l.flavour, 'draft', l.draft, 'published', l.published, 'version', l.version,
    'draft_updated_at', l.draft_updated_at, 'published_at', l.published_at,
    'versions', coalesce((select jsonb_agg(jsonb_build_object('version', v.version, 'published_at', v.published_at) order by v.version desc)
      from (select * from public.home_layout_versions where flavour = l.flavour order by version desc limit 20) v), '[]'::jsonb));
end $$;
revoke all on function public.admin_home_layout_get(text) from public, anon;
grant execute on function public.admin_home_layout_get(text) to authenticated;

/** Saves the draft (checked); members keep seeing the published layout. Returns the stored draft. */
create or replace function public.admin_home_layout_save_draft(p_flavour text, p_config jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare fl text := private.home_flavour(p_flavour); clean jsonb;
begin
  perform private.need_photo_staff('content');
  perform 1 from public.home_layouts where flavour = fl for update;
  clean := private.home_layout_clean(p_config, private.home_layout_files(fl));
  update public.home_layouts set draft = clean, draft_updated_at = now(), draft_updated_by = auth.uid() where flavour = fl;
  perform private.journal('home.draft_saved', null, null, 'home_layout', null, null, jsonb_build_object('flavour', fl));
  return clean;
end $$;
revoke all on function public.admin_home_layout_save_draft(text, jsonb) from public, anon;
grant execute on function public.admin_home_layout_save_draft(text, jsonb) to authenticated;

/**
 * Publishes the saved draft, whole or not at all: checked again, copied to
 * « published » and kept as a new version, in one statement. Returns the version.
 */
create or replace function public.admin_home_layout_publish(p_flavour text) returns integer
language plpgsql security definer set search_path = public, private as $$
declare fl text := private.home_flavour(p_flavour); l public.home_layouts; clean jsonb;
begin
  perform private.need_photo_staff('content');
  select * into l from public.home_layouts where flavour = fl for update;
  clean := case when jsonb_array_length(l.draft) = 0 then '[]'::jsonb else private.home_layout_clean(l.draft, private.home_layout_files(fl)) end;
  update public.home_layouts set published = clean, draft = clean, version = l.version + 1, published_at = now(), published_by = auth.uid()
  where flavour = fl;
  insert into public.home_layout_versions (flavour, version, config, published_by) values (fl, l.version + 1, clean, auth.uid());
  perform private.journal('home.published', null, null, 'home_layout', null, null, jsonb_build_object('flavour', fl, 'version', l.version + 1));
  return l.version + 1;
end $$;
revoke all on function public.admin_home_layout_publish(text) from public, anon;
grant execute on function public.admin_home_layout_publish(text) to authenticated;

/** Brings a published version (null: the one members see now) back into the draft; publishing stays a separate step. */
create or replace function public.admin_home_layout_restore(p_flavour text, p_version integer default null) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare fl text := private.home_flavour(p_flavour); cfg jsonb;
begin
  perform private.need_photo_staff('content');
  perform 1 from public.home_layouts where flavour = fl for update;
  if p_version is null then
    select published into cfg from public.home_layouts where flavour = fl;
  else
    select config into cfg from public.home_layout_versions where flavour = fl and version = p_version;
    if cfg is null then raise exception 'this version no longer exists' using errcode = 'P0002'; end if;
  end if;
  update public.home_layouts set draft = cfg, draft_updated_at = now(), draft_updated_by = auth.uid() where flavour = fl;
  perform private.journal('home.restored', null, null, 'home_layout', null, null, jsonb_build_object('flavour', fl, 'version', p_version));
  return cfg;
end $$;
revoke all on function public.admin_home_layout_restore(text, integer) from public, anon;
grant execute on function public.admin_home_layout_restore(text, integer) to authenticated;

-- ───────── 4. What members read ─────────
/**
 * Everything the Home needs from the team in one call: the published layout,
 * the news and the banners of the flavour. 'girl' is honoured only for an
 * account that passes the IRLY Girl rule; anyone else gets IRLY's.
 */
create or replace function public.home_feed(p_space text default 'mixte') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  sp text := case when p_space = 'girl' and me is not null and private.girl_eligible_unchecked(me) then 'girl' else 'mixte' end;
begin
  return jsonb_build_object(
    'space', sp,
    'layout', (select jsonb_build_object('version', l.version, 'sections', l.published) from public.home_layouts l where l.flavour = sp),
    'news', coalesce((select jsonb_agg(private.news_member_json(n, false) order by n.position, n.publish_at desc)
      from (select * from public.irly_news x
            where x.status = 'published' and x.publish_at <= now() and x.deleted_at is null and x.audience in (sp, 'both')
              and private.news_visible_to(x, me)
            order by x.position, x.publish_at desc limit 10) n), '[]'::jsonb),
    'banners', coalesce((select jsonb_agg(private.banner_json(b) - 'active' - 'starts_at' - 'ends_at' - 'updated_at' order by b.position, b.created_at desc)
      from (select * from public.irly_banners x
            where x.placement = 'home' and x.audience in (sp, 'both') and private.banner_visible_to(x, me)
            order by x.position, x.created_at desc limit 5) b), '[]'::jsonb));
end $$;
revoke all on function public.home_feed(text) from public;
grant execute on function public.home_feed(text) to anon, authenticated;

/** One news item for its page (a link, a notification), or null when it is not (or no longer) for the caller. */
create or replace function public.news_item(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select private.news_member_json(n, true) from public.irly_news n where n.id = p_id and private.news_visible_to(n, auth.uid())
$$;
revoke all on function public.news_item(uuid) from public;
grant execute on function public.news_item(uuid) to anon, authenticated;

-- ───────── 5. Files ─────────
/**
 * May the caller read this file of "cms-media"? The team always; anyone
 * else while a news item, banner or published layout they may see uses it.
 */
create or replace function public.cms_file_readable(p_name text) returns boolean
language sql stable security definer set search_path = public, private as $$
  select private.is_content_staff(auth.uid())
    or exists (select 1 from public.irly_news n
               where (n.cover_path = p_name or n.video_path = p_name or p_name = any (n.gallery_paths)) and private.news_visible_to(n, auth.uid()))
    or exists (select 1 from public.irly_banners b where b.image_path = p_name and private.banner_visible_to(b, auth.uid()))
    or exists (select 1 from public.home_layouts l, jsonb_array_elements(l.published) x
               where x ->> 'cover_path' = p_name and (l.flavour = 'mixte' or private.girl_eligible_unchecked(auth.uid())))
$$;
revoke all on function public.cms_file_readable(text) from public;
grant execute on function public.cms_file_readable(text) to anon, authenticated;

-- Private bucket: photos (and videos, the size posts allow), written by
-- content staff in their own folder, read by the rule above. No update or
-- delete rule: a stored file is never changed nor removed from the app.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('cms-media', 'cms-media', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
    on conflict (id) do nothing;
    execute 'drop policy if exists cms_media_insert on storage.objects';
    execute $p$
      create policy cms_media_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'cms-media' and (storage.foldername(name))[1] = auth.uid()::text and private.is_content_staff(auth.uid()))
    $p$;
    execute 'drop policy if exists cms_media_read on storage.objects';
    execute $p$
      create policy cms_media_read on storage.objects for select to anon, authenticated
      using (bucket_id = 'cms-media' and public.cms_file_readable(name))
    $p$;
  end if;
end $$;
