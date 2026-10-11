-- Dubai News & Life: news and practical information from the city's sources.
--
-- Rules:
-- - Only headlines, a short summary, the date, the source and a link to the
--   original article are kept: the article is read on the source's site.
-- - A source is used only once an IRLY admin has checked its terms of use
--   (terms_checked) and turned it on. Sources are proposed inactive.
-- - Nothing older than 30 days is shown as news; every article shows its
--   own publication date.
-- - News, members' posts and sponsored content are kept apart: news lives
--   in its own tables, and a sponsored article is always labelled.
-- Fetching runs inside the database (pg_net + pg_cron, already used for
-- push): every hour, each active source's RSS or Atom feed is read and new
-- items are added. Admins can also add, hide, recategorise or label
-- articles from the app.

create table if not exists public.news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  site_url text not null,
  feed_url text unique,
  kind text not null default 'media' check (kind in ('official', 'media', 'partner')),
  default_category text not null default 'local'
    check (default_category in ('local', 'events', 'outings', 'practical', 'business', 'family', 'property', 'leisure')),
  city_id text not null default 'dubai',
  active boolean not null default false,
  terms_checked boolean not null default false,
  -- The source's images are shown only when its terms allow it (an admin decides).
  show_images boolean not null default false,
  notes text,
  -- Only items whose title or summary match (case-insensitive regex), e.g. Dubai and UAE news from a general feed.
  keywords text,
  last_fetch_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  check (not active or terms_checked)
);
alter table public.news_sources enable row level security;
drop policy if exists news_sources_read on public.news_sources;
create policy news_sources_read on public.news_sources for select to authenticated
  using (active or private.is_admin(auth.uid()));

create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.news_sources (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 300),
  summary text check (summary is null or char_length(summary) <= 600),
  url text not null unique check (url ~ '^https?://'),
  image_url text check (image_url is null or image_url ~ '^https://'),
  category text not null default 'local'
    check (category in ('local', 'events', 'outings', 'practical', 'business', 'family', 'property', 'leisure')),
  city_id text not null default 'dubai',
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  status text not null default 'published' check (status in ('published', 'hidden')),
  sponsored boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null
);
create index if not exists news_articles_feed on public.news_articles (city_id, published_at desc) where status = 'published';
alter table public.news_articles enable row level security;
drop policy if exists news_articles_read on public.news_articles;
create policy news_articles_read on public.news_articles for select to authenticated
  using ((status = 'published' and (source_id is null or exists (select 1 from public.news_sources s where s.id = source_id and s.active)))
    or private.is_admin(auth.uid()));

-- Saving a news article reuses saves (target type 'news').
do $$
declare t text;
begin
  foreach t in array array['likes', 'saves', 'hidden_items', 'shares'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_type_check');
    execute format($f$alter table public.%I add constraint %I check (target_type in
      ('irl_post', 'activity', 'community', 'community_post', 'comment', 'profile', 'place', 'catalog', 'news'))$f$, t, t || '_type_check');
  end loop;
end $$;

-- The feed: latest first, never older than 30 days, by category, searchable.
create or replace function public.news_feed(p_city text default 'dubai', p_category text default null, p_query text default null,
  p_saved boolean default false, p_limit integer default 40, p_before timestamptz default null)
returns table (id uuid, title text, summary text, url text, image_url text, category text, published_at timestamptz,
  source_name text, source_kind text, source_site text, sponsored boolean, saved boolean)
language sql stable security invoker set search_path = public as $$
  select a.id, a.title, a.summary, a.url, case when a.source_id is null or s.show_images then a.image_url end, a.category, a.published_at,
    coalesce(s.name, 'IRLY'), coalesce(s.kind, 'partner'), s.site_url, a.sponsored,
    exists (select 1 from public.saves v where v.user_id = auth.uid() and v.target_type = 'news' and v.target_id = a.id::text)
  from public.news_articles a
  left join public.news_sources s on s.id = a.source_id
  where a.status = 'published' and (a.source_id is null or s.active)
    and a.city_id = coalesce(p_city, 'dubai')
    and (p_saved or a.published_at > now() - interval '30 days')
    and a.published_at <= now() + interval '1 hour'
    and (p_category is null or a.category = p_category)
    and (p_query is null or a.title ilike '%' || p_query || '%' or a.summary ilike '%' || p_query || '%')
    and (not p_saved or exists (select 1 from public.saves v where v.user_id = auth.uid() and v.target_type = 'news' and v.target_id = a.id::text))
    and (p_before is null or a.published_at < p_before)
  order by a.published_at desc
  limit least(greatest(p_limit, 1), 100)
$$;
revoke all on function public.news_feed(text, text, text, boolean, integer, timestamptz) from public, anon;
grant execute on function public.news_feed(text, text, text, boolean, integer, timestamptz) to authenticated;

-- ───────── Reading feeds (RSS 2.0 and Atom) ─────────
create or replace function private.news_decode(x text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(replace(replace(replace(coalesce(x, ''),
    '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''), '&apos;', ''''), '&nbsp;', ' '), '&amp;', '&')
$$;

-- Plain text from a feed field: entities decoded, CDATA and HTML tags removed, spaces collapsed.
create or replace function private.news_text(x text, max_len integer) returns text
language sql immutable as $$
  select nullif(left(btrim(regexp_replace(private.news_decode(
    regexp_replace(private.news_decode(regexp_replace(coalesce(x, ''), '<!\[CDATA\[|\]\]>', '', 'g')), '<[^>]*>', ' ', 'g')),
    '\s+', ' ', 'g')), max_len), '')
$$;

-- Adds a feed's new items (recent ones only); returns how many were added.
create or replace function private.news_ingest(p_source uuid, p_xml text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  src public.news_sources;
  doc xml;
  item xml;
  t text;
  link text;
  descr text;
  pub text;
  img text;
  at timestamptz;
  n integer := 0;
  ns text[][] := array[array['a', 'http://www.w3.org/2005/Atom'], array['media', 'http://search.yahoo.com/mrss/']];
begin
  select * into src from public.news_sources where id = p_source;
  if not found then return 0; end if;
  begin
    doc := xmlparse(document p_xml);
  exception when others then
    update public.news_sources set last_error = 'not a valid RSS or Atom feed', last_fetch_at = now() where id = p_source;
    return 0;
  end;
  for item in
    select unnest(xpath('//item', doc)) union all select unnest(xpath('//a:entry', doc, ns))
  loop
    -- Every text node (a CDATA block often sits between line breaks).
    t := private.news_text(array_to_string(xpath('/item/title//text()|/a:entry/a:title//text()', item, ns)::text[], ''), 300);
    link := btrim(coalesce(nullif(btrim(array_to_string(xpath('/item/link//text()', item, ns)::text[], '')), ''), (xpath('/a:entry/a:link[not(@rel) or @rel="alternate"]/@href', item, ns))[1]::text, ''));
    descr := private.news_text(coalesce(nullif(array_to_string(xpath('/item/description//text()', item, ns)::text[], ''), ''),
      array_to_string(xpath('/a:entry/a:summary//text()', item, ns)::text[], '')), 400);
    pub := btrim(coalesce(nullif(btrim(array_to_string(xpath('/item/pubDate//text()', item, ns)::text[], '')), ''),
      (xpath('/a:entry/a:published/text()|/a:entry/a:updated/text()', item, ns))[1]::text));
    img := coalesce((xpath('/item/enclosure[starts-with(@type,"image")]/@url', item, ns))[1]::text, (xpath('/item/media:content/@url|/item/media:thumbnail/@url', item, ns))[1]::text);
    begin
      at := pub::timestamptz;
    exception when others then
      at := null;
    end;
    -- No date, no title or no link: not shown as news. Off-topic for the city: skipped.
    continue when at is null or t is null or link !~ '^https?://' or at < now() - interval '30 days' or at > now() + interval '1 day';
    continue when src.keywords is not null and (t || ' ' || coalesce(descr, '')) !~* src.keywords;
    insert into public.news_articles (source_id, title, summary, url, image_url, category, city_id, published_at)
    values (src.id, t, descr, link, case when img ~ '^https://' then img end, src.default_category, src.city_id, least(at, now()))
    on conflict (url) do nothing;
    if found then n := n + 1; end if;
  end loop;
  update public.news_sources set last_fetch_at = now(), last_error = null where id = p_source;
  return n;
end $$;
revoke all on function private.news_ingest(uuid, text) from public, anon, authenticated;

-- Hourly: ask every active source for its feed (pg_net), then read the answers.
create table if not exists private.news_fetches (
  request_id bigint primary key,
  source_id uuid not null references public.news_sources (id) on delete cascade,
  asked_at timestamptz not null default now()
);

create or replace function private.news_fetch_all() returns integer
language plpgsql security definer set search_path = public as $$
declare
  s public.news_sources;
  rid bigint;
  n integer := 0;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return 0; end if;
  for s in select * from public.news_sources where active and terms_checked and feed_url is not null loop
    execute 'select net.http_get(url := $1, headers := $2, timeout_milliseconds := 15000)'
      into rid using s.feed_url, jsonb_build_object('User-Agent', 'IRLY News (+https://alafrench7593-a11y.github.io/irly/)', 'Accept', 'application/rss+xml, application/atom+xml, application/xml, text/xml');
    insert into private.news_fetches (request_id, source_id) values (rid, s.id) on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function private.news_collect() returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return 0; end if;
  for r in execute $q$
    select f.request_id, f.source_id, x.status_code, x.content, x.error_msg, x.timed_out
    from private.news_fetches f join net._http_response x on x.id = f.request_id $q$
  loop
    if r.status_code = 200 and r.content is not null then
      n := n + private.news_ingest(r.source_id, r.content);
    else
      update public.news_sources set last_fetch_at = now(),
        last_error = coalesce(r.error_msg, case when r.timed_out then 'timed out' else 'HTTP ' || r.status_code end)
      where id = r.source_id;
    end if;
    delete from private.news_fetches where request_id = r.request_id;
  end loop;
  delete from private.news_fetches where asked_at < now() - interval '1 hour';
  return n;
end $$;
revoke all on function private.news_fetch_all(), private.news_collect() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname in ('irly-news-fetch', 'irly-news-collect');
  perform cron.schedule('irly-news-fetch', '7 * * * *', 'select private.news_fetch_all()');
  perform cron.schedule('irly-news-collect', '*/5 * * * *', 'select private.news_collect()');
exception when others then
  raise notice 'pg_cron not available: news are added by admins only';
end $$;

-- ───────── Admin tools ─────────
create or replace function public.news_save_source(p_id uuid, p_name text, p_site text, p_feed text, p_kind text,
  p_category text, p_active boolean, p_terms_checked boolean, p_notes text default null, p_keywords text default null, p_show_images boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  sid uuid := p_id;
begin
  if not private.is_admin(auth.uid()) then raise exception 'IRLY admins only' using errcode = '42501'; end if;
  if p_active and not p_terms_checked then raise exception 'check the source''s terms of use before turning it on' using errcode = '22023'; end if;
  if sid is null then
    insert into public.news_sources (name, site_url, feed_url, kind, default_category, active, terms_checked, notes, keywords, show_images)
    values (btrim(p_name), btrim(p_site), nullif(btrim(coalesce(p_feed, '')), ''), p_kind, p_category, p_active, p_terms_checked, p_notes, nullif(btrim(coalesce(p_keywords, '')), ''), coalesce(p_show_images, false))
    returning id into sid;
  else
    update public.news_sources set name = btrim(p_name), site_url = btrim(p_site), feed_url = nullif(btrim(coalesce(p_feed, '')), ''),
      kind = p_kind, default_category = p_category, active = p_active, terms_checked = p_terms_checked, notes = p_notes,
      keywords = nullif(btrim(coalesce(p_keywords, '')), ''), show_images = coalesce(p_show_images, false)
    where id = sid;
  end if;
  return sid;
end $$;

create or replace function public.news_admin_sources()
returns table (id uuid, name text, site_url text, feed_url text, kind text, default_category text, active boolean, terms_checked boolean,
  notes text, keywords text, show_images boolean, last_fetch_at timestamptz, last_error text, articles integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin(auth.uid()) then raise exception 'IRLY admins only' using errcode = '42501'; end if;
  return query select s.id, s.name, s.site_url, s.feed_url, s.kind, s.default_category, s.active, s.terms_checked, s.notes, s.keywords, s.show_images,
    s.last_fetch_at, s.last_error, (select count(*)::int from public.news_articles a where a.source_id = s.id)
  from public.news_sources s order by s.active desc, s.name;
end $$;

create or replace function public.news_update_article(p_id uuid, p_status text, p_category text, p_sponsored boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_admin(auth.uid()) then raise exception 'IRLY admins only' using errcode = '42501'; end if;
  update public.news_articles set status = coalesce(p_status, status), category = coalesce(p_category, category),
    sponsored = coalesce(p_sponsored, sponsored)
  where id = p_id;
end $$;

-- An article added by hand (a source's link, or IRLY's own practical info).
create or replace function public.news_add_article(p_title text, p_summary text, p_url text, p_category text, p_source uuid default null,
  p_published_at timestamptz default now(), p_sponsored boolean default false, p_image text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  aid uuid;
begin
  if not private.is_admin(auth.uid()) then raise exception 'IRLY admins only' using errcode = '42501'; end if;
  insert into public.news_articles (source_id, title, summary, url, image_url, category, published_at, sponsored, created_by)
  values (p_source, btrim(p_title), nullif(btrim(coalesce(p_summary, '')), ''), btrim(p_url), p_image, p_category,
    least(coalesce(p_published_at, now()), now()), coalesce(p_sponsored, false), auth.uid())
  returning id into aid;
  return aid;
end $$;

revoke all on function public.news_save_source(uuid, text, text, text, text, text, boolean, boolean, text, text, boolean), public.news_admin_sources(),
  public.news_update_article(uuid, text, text, boolean), public.news_add_article(text, text, text, text, uuid, timestamptz, boolean, text) from public, anon;
grant execute on function public.news_save_source(uuid, text, text, text, text, text, boolean, boolean, text, text, boolean), public.news_admin_sources(),
  public.news_update_article(uuid, text, text, boolean), public.news_add_article(text, text, text, text, uuid, timestamptz, boolean, text) to authenticated;

-- Saving / sharing an article: the same "can see it" rule as everything else.
create or replace function private.can_see(p_type text, p_id text) returns boolean
language plpgsql stable security invoker set search_path = public as $$
begin
  if p_type in ('place', 'catalog') then
    return p_id is not null and char_length(p_id) between 1 and 120;
  end if;
  if not private.is_uuid(p_id) then
    return false;
  end if;
  return case p_type
    when 'irl_post' then exists (select 1 from public.irl_posts where id = p_id::uuid)
    when 'activity' then exists (select 1 from public.activities where id = p_id::uuid)
    when 'community' then exists (select 1 from public.communities where id = p_id::uuid)
    when 'community_post' then exists (select 1 from public.community_posts where id = p_id::uuid)
    when 'comment' then exists (select 1 from public.comments where id = p_id::uuid)
    when 'news' then exists (select 1 from public.news_articles where id = p_id::uuid)
    when 'profile' then exists (select 1 from public.profiles_public where id = p_id::uuid)
      and not private.is_blocked(auth.uid(), p_id::uuid)
      and (p_id::uuid = auth.uid() or private.discoverable(p_id::uuid))
    else false
  end;
end $$;
grant execute on function private.can_see(text, text) to authenticated;

-- Sources proposed, all OFF: each one is turned on by an admin after
-- checking its terms of use. Feeds checked to answer (Oct 2026).
insert into public.news_sources (name, site_url, feed_url, kind, default_category, active, terms_checked, notes, keywords) values
  ('Khaleej Times', 'https://www.khaleejtimes.com', 'https://www.khaleejtimes.com/stories.rss', 'media', 'local', false, false,
    'General feed: the keywords keep Dubai and UAE stories.', '(dubai|uae|abu dhabi|emirat|sharjah|rta|metro)'),
  ('Gulf News', 'https://gulfnews.com', 'https://gulfnews.com/feed', 'media', 'local', false, false,
    'General feed: the keywords keep Dubai and UAE stories.', '(dubai|uae|abu dhabi|emirat|sharjah|rta|metro)'),
  ('The National', 'https://www.thenationalnews.com', 'https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml', 'media', 'local', false, false,
    'General feed: the keywords keep Dubai and UAE stories.', '(dubai|uae|abu dhabi|emirat|sharjah)'),
  ('What''s On Dubai', 'https://whatson.ae', 'https://whatson.ae/feed/', 'media', 'outings', false, false,
    'Things to do, events and openings in Dubai and the UAE.', null)
on conflict (feed_url) do nothing;
