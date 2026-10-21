import { checkLayout, layoutForServer } from './layout';
import { isDestination } from './destinations';

/**
 * The editorial back office in the demo build only (EXPO_PUBLIC_DEMO=1, no
 * server): the same calls and rules as migration 20261028200000_irly_admin_cms,
 * kept in this browser (localStorage) so the screens and the journeys
 * (scripts/e2e-demo-cms.mjs) can be walked without any real data. Never used
 * when a server is configured. The demo is the owner, as in the rest of the
 * demo back office; the demo visitor counts as an IRLY Girl member.
 *
 * Test hooks (demo only): localStorage « irly-cms-demo-fail » lists calls that
 * fail as if the network were down; globalThis.__irlyCmsCalls counts calls.
 */
type Audience = 'mixte' | 'girl' | 'both';
type News = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string;
  cover_path: string | null;
  cover_key: string | null;
  gallery_paths: string[];
  video_path: string | null;
  category: string;
  status: 'draft' | 'published' | 'unpublished';
  publish_at: string | null;
  audience: Audience;
  position: number;
  cta_label: string | null;
  cta_url: string | null;
  notify: boolean;
  notified_at: string | null;
  went_live_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
type BannerRow = {
  id: string;
  title: string;
  body: string | null;
  image_path: string | null;
  image_key: string | null;
  cta_label: string | null;
  cta_url: string | null;
  audience: Audience;
  placement: 'home';
  position: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
type Layout = { draft: unknown[]; published: unknown[]; version: number; draft_updated_at: string | null; published_at: string | null; versions: { version: number; config: unknown[]; published_at: string }[] };
type State = { news: News[]; banners: BannerRow[]; layouts: Record<'mixte' | 'girl', Layout>; notified: number };

/** A refusal in the server's own words (src/i18n/errors.ts turns them into the app's sentences). */
function refuse(msg: string): never {
  throw new Error(msg);
}

const KEY = 'irly-cms-demo';
const FAIL = 'irly-cms-demo-fail';
const now = () => new Date().toISOString();
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
let seq = 0;
const newId = () => {
  seq += 1;
  const hex = (Date.now().toString(16) + seq.toString(16).padStart(4, '0')).slice(-12).padStart(12, '0');
  return `d0c50000-0000-4000-8000-${hex}`;
};

const emptyLayout = (): Layout => ({ draft: [], published: [], version: 0, draft_updated_at: null, published_at: null, versions: [] });

/** The demo's starting content: IRLY's own photos, nothing about real people. */
function seed(): State {
  const base = { subtitle: null, cover_path: null, gallery_paths: [], video_path: null, notify: false, notified_at: null, deleted_at: null, cta_label: null, cta_url: null };
  return {
    news: [
      {
        ...base,
        id: 'd0c50000-0000-4000-8000-000000000001',
        title: 'Your Home now has IRLY news',
        subtitle: 'What is new on IRLY, from the team',
        body: 'This is where the IRLY team shares what is new: places, plans, features of the app.\n\nTap a card on your Home to read it here.',
        cover_key: 'palmAerial',
        category: 'feature',
        status: 'published',
        publish_at: ago(1),
        audience: 'both',
        position: 0,
        cta_label: 'Discover plans',
        cta_url: '/discover',
        went_live_at: ago(1),
        created_at: ago(2),
        updated_at: ago(1),
      },
      {
        ...base,
        id: 'd0c50000-0000-4000-8000-000000000002',
        title: 'IRLY Girl brunch circle',
        subtitle: 'Women only, every Saturday',
        body: 'Meet women who just moved to the city over brunch. Join from the IRLY Girl communities.',
        cover_key: 'brunchGirl',
        category: 'community',
        status: 'published',
        publish_at: ago(1),
        audience: 'girl',
        position: 1,
        went_live_at: ago(1),
        created_at: ago(2),
        updated_at: ago(1),
      },
      {
        ...base,
        id: 'd0c50000-0000-4000-8000-000000000003',
        title: 'Padel league (draft)',
        body: 'Teams of four, every Thursday evening.',
        cover_key: 'padelMix',
        category: 'event',
        status: 'draft',
        publish_at: null,
        audience: 'mixte',
        position: 2,
        went_live_at: null,
        created_at: ago(1),
        updated_at: ago(1),
      },
    ],
    banners: [
      {
        id: 'd0c50000-0000-4000-8000-0000000000b1',
        title: 'Summer by the sea',
        body: 'Beach plans every weekend',
        image_path: null,
        image_key: 'beachMix',
        cta_label: 'See beach plans',
        cta_url: '/category/beach',
        audience: 'both',
        placement: 'home',
        position: 0,
        active: true,
        starts_at: null,
        ends_at: null,
        created_at: ago(3),
        updated_at: ago(3),
        deleted_at: null,
      },
      {
        id: 'd0c50000-0000-4000-8000-0000000000b2',
        title: 'Girls’ night out',
        body: 'Plans between women this week',
        image_path: null,
        image_key: 'girlsOut',
        cta_label: null,
        cta_url: null,
        audience: 'girl',
        placement: 'home',
        position: 1,
        active: true,
        starts_at: null,
        ends_at: null,
        created_at: ago(3),
        updated_at: ago(3),
        deleted_at: null,
      },
    ],
    layouts: { mixte: emptyLayout(), girl: emptyLayout() },
    notified: 0,
  };
}

let memory: State | null = null;
const web = (): Storage | null => {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
};
function load(): State {
  if (memory) return memory;
  try {
    const raw = web()?.getItem(KEY);
    memory = raw ? (JSON.parse(raw) as State) : seed();
  } catch {
    memory = seed();
  }
  return memory;
}
function save(s: State) {
  memory = s;
  try {
    web()?.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private window: kept for this visit only.
  }
}

const visible = (n: News) => n.status === 'published' && !!n.publish_at && n.publish_at <= now() && !n.deleted_at;
const bannerOn = (b: BannerRow) => b.active && !b.deleted_at && (!b.starts_at || b.starts_at <= now()) && (!b.ends_at || b.ends_at > now());
const state = (n: News) => (n.deleted_at ? 'deleted' : n.status === 'published' && n.publish_at && n.publish_at > now() ? 'scheduled' : n.status);
const adminNews = (n: News) => ({ ...n, state: state(n) });
const card = (n: News, full: boolean) => {
  const out: Record<string, unknown> = {
    id: n.id, title: n.title, subtitle: n.subtitle, cover_path: n.cover_path, cover_key: n.cover_key, category: n.category,
    publish_at: n.publish_at, audience: n.audience, cta_label: n.cta_label, cta_url: n.cta_url, video: Boolean(n.video_path),
  };
  if (full) Object.assign(out, { body: n.body, gallery_paths: n.gallery_paths, video_path: n.video_path });
  return out;
};
const order = <T extends { position: number; created_at: string }>(a: T, b: T) => a.position - b.position || b.created_at.localeCompare(a.created_at);

const text = (v: unknown, max: number, label: string): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') refuse('invalid value');
  const s = v.trim();
  if (s.length > max) refuse(`${label} is at most ${max} characters`);
  return s || null;
};
const NEWS_FIELDS = ['title', 'subtitle', 'body', 'cover_path', 'cover_key', 'gallery_paths', 'video_path', 'category', 'audience', 'cta_label', 'cta_url', 'notify', 'position'];
const BANNER_FIELDS = ['title', 'body', 'image_path', 'image_key', 'cta_label', 'cta_url', 'audience', 'placement', 'position', 'active', 'starts_at', 'ends_at'];

function goLive(s: State) {
  for (const n of s.news) {
    if (visible(n) && !n.went_live_at) {
      n.went_live_at = now();
      if (n.notify && !n.notified_at) {
        n.notified_at = now();
        s.notified += 1;
      }
    }
  }
}

function saveNews(s: State, id: string | null, p: Record<string, unknown>): string {
  if (!p || typeof p !== 'object') refuse('invalid value');
  for (const f of Object.keys(p)) if (!NEWS_FIELDS.includes(f)) refuse('unknown field');
  let n = id ? s.news.find((x) => x.id === id && !x.deleted_at) : undefined;
  if (id && !n) refuse('this news item no longer exists');
  if (!n) {
    n = {
      id: newId(), title: '', subtitle: null, body: '', cover_path: null, cover_key: null, gallery_paths: [], video_path: null, category: 'news',
      status: 'draft', publish_at: null, audience: 'both', position: Math.min(0, ...s.news.filter((x) => !x.deleted_at).map((x) => x.position)) - 1,
      cta_label: null, cta_url: null, notify: false, notified_at: null, went_live_at: null, created_at: now(), updated_at: now(), deleted_at: null,
    };
  }
  const next = { ...n };
  if ('title' in p) next.title = text(p.title, 120, 'a title') ?? '';
  if (next.title.length < 3) refuse('a title needs 3 to 120 characters');
  if ('subtitle' in p) next.subtitle = text(p.subtitle, 200, 'a subtitle');
  if ('body' in p) next.body = text(p.body, 10000, 'the text') ?? '';
  if ('category' in p) {
    const c = text(p.category, 20, 'a category');
    if (!c || !['news', 'event', 'feature', 'community', 'tips', 'partner'].includes(c)) refuse('unknown category');
    next.category = c;
  }
  if ('audience' in p) {
    const a = text(p.audience, 10, 'an audience');
    if (a !== 'mixte' && a !== 'girl' && a !== 'both') refuse('unknown audience');
    next.audience = a;
  }
  if ('cover_key' in p) next.cover_key = text(p.cover_key, 64, 'a photo');
  if ('cover_path' in p) next.cover_path = typeof p.cover_path === 'string' && p.cover_path ? p.cover_path : null;
  if ('video_path' in p) next.video_path = typeof p.video_path === 'string' && p.video_path ? p.video_path : null;
  if ('gallery_paths' in p) {
    if (!Array.isArray(p.gallery_paths) || p.gallery_paths.some((x) => typeof x !== 'string')) refuse('invalid value');
    if (p.gallery_paths.length > 12) refuse('the gallery has too many items (at most 12)');
    next.gallery_paths = p.gallery_paths as string[];
  }
  if ('cta_label' in p) next.cta_label = text(p.cta_label, 40, 'a button label');
  if ('cta_url' in p) {
    next.cta_url = text(p.cta_url, 500, 'a link');
    if (!isDestination(next.cta_url)) refuse('invalid destination');
  }
  if (next.cta_url && !next.cta_label) refuse('a link needs a button label');
  if ('notify' in p) {
    if (typeof p.notify !== 'boolean') refuse('invalid value');
    if (!next.went_live_at && !next.notified_at) next.notify = p.notify;
  }
  if ('position' in p) {
    if (typeof p.position !== 'number') refuse('invalid value');
    next.position = Math.round(p.position);
  }
  next.updated_at = now();
  s.news = s.news.some((x) => x.id === next.id) ? s.news.map((x) => (x.id === next.id ? next : x)) : [...s.news, next];
  return next.id;
}

function saveBanner(s: State, id: string | null, p: Record<string, unknown>): string {
  if (!p || typeof p !== 'object') refuse('invalid value');
  for (const f of Object.keys(p)) if (!BANNER_FIELDS.includes(f)) refuse('unknown field');
  let b = id ? s.banners.find((x) => x.id === id && !x.deleted_at) : undefined;
  if (id && !b) refuse('this banner no longer exists');
  if (!b) {
    b = {
      id: newId(), title: '', body: null, image_path: null, image_key: null, cta_label: null, cta_url: null, audience: 'both', placement: 'home',
      position: Math.min(0, ...s.banners.filter((x) => !x.deleted_at).map((x) => x.position)) - 1, active: false, starts_at: null, ends_at: null,
      created_at: now(), updated_at: now(), deleted_at: null,
    };
  }
  const next = { ...b };
  if ('title' in p) next.title = text(p.title, 80, 'a title') ?? '';
  if (!next.title) refuse('a banner needs a title');
  if ('body' in p) next.body = text(p.body, 200, 'the text');
  if ('image_key' in p) next.image_key = text(p.image_key, 64, 'a photo');
  if ('image_path' in p) next.image_path = typeof p.image_path === 'string' && p.image_path ? p.image_path : null;
  if ('cta_label' in p) next.cta_label = text(p.cta_label, 40, 'a button label');
  if ('cta_url' in p) {
    next.cta_url = text(p.cta_url, 500, 'a link');
    if (!isDestination(next.cta_url)) refuse('invalid destination');
  }
  if ('audience' in p) {
    const a = text(p.audience, 10, 'an audience');
    if (a !== 'mixte' && a !== 'girl' && a !== 'both') refuse('unknown audience');
    next.audience = a;
  }
  if ('placement' in p && p.placement !== 'home') refuse('unknown placement');
  if ('active' in p) {
    if (typeof p.active !== 'boolean') refuse('invalid value');
    next.active = p.active;
  }
  if ('position' in p) {
    if (typeof p.position !== 'number') refuse('invalid value');
    next.position = Math.round(p.position);
  }
  const date = (v: unknown) => {
    if (v === null || v === '' || v === undefined) return null;
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) refuse('invalid value');
    return d.toISOString();
  };
  if ('starts_at' in p) next.starts_at = date(p.starts_at);
  if ('ends_at' in p) next.ends_at = date(p.ends_at);
  if (next.starts_at && next.ends_at && next.ends_at <= next.starts_at) refuse('the end must come after the start');
  next.updated_at = now();
  s.banners = s.banners.some((x) => x.id === next.id) ? s.banners.map((x) => (x.id === next.id ? next : x)) : [...s.banners, next];
  return next.id;
}

function flavour(v: unknown): 'mixte' | 'girl' {
  if (v !== 'mixte' && v !== 'girl') refuse('unknown flavour');
  return v;
}

/** The demo's answer to an editorial call (the same names and arguments as the server's). */
export function demoCms(fn: string, args: Record<string, unknown> = {}): unknown {
  const counts = ((globalThis as { __irlyCmsCalls?: Record<string, number> }).__irlyCmsCalls ??= {});
  counts[fn] = (counts[fn] ?? 0) + 1;
  let failing = '';
  try {
    failing = web()?.getItem(FAIL) ?? '';
  } catch {
    // No storage: nothing to fail.
  }
  if (failing.split(',').includes(fn)) throw new Error('Can’t reach IRLY right now');
  const s = structuredClone(load());
  const sorted = (list: News[]) => [...list].sort(order);
  switch (fn) {
    case 'home_feed': {
      const sp = args.p_space === 'girl' ? 'girl' : 'mixte';
      return {
        space: sp,
        layout: { version: s.layouts[sp].version, sections: s.layouts[sp].published },
        news: sorted(s.news.filter((n) => visible(n) && (n.audience === sp || n.audience === 'both'))).slice(0, 10).map((n) => card(n, false)),
        banners: [...s.banners].sort(order).filter((b) => bannerOn(b) && (b.audience === sp || b.audience === 'both')).slice(0, 5)
          .map(({ id, title, body, image_path, image_key, cta_label, cta_url, audience, placement, position }) => ({ id, title, body, image_path, image_key, cta_label, cta_url, audience, placement, position })),
      };
    }
    case 'news_item': {
      const n = s.news.find((x) => x.id === args.p_id && visible(x));
      return n ? card(n, true) : null;
    }
    case 'admin_news_list':
      goLive(s);
      save(s);
      return sorted(s.news.filter((n) => !n.deleted_at)).map(adminNews);
    case 'admin_news_get': {
      const n = s.news.find((x) => x.id === args.p_id && !x.deleted_at);
      if (!n) refuse('this news item no longer exists');
      return adminNews(n);
    }
    case 'admin_news_save': {
      const id = saveNews(s, (args.p_id as string | null) ?? null, args.p_news as Record<string, unknown>);
      save(s);
      return id;
    }
    case 'admin_news_publish': {
      const n = s.news.find((x) => x.id === args.p_id && !x.deleted_at);
      if (!n) refuse('this news item no longer exists');
      if (!n.body.trim()) refuse('add a text before publishing');
      const at = args.p_at ? new Date(String(args.p_at)).toISOString() : now();
      const when = at < now() ? now() : at;
      if (Date.parse(when) > Date.now() + 366 * 86_400_000) refuse('pick a date within a year');
      n.status = 'published';
      n.publish_at = when;
      n.updated_at = now();
      goLive(s);
      save(s);
      return adminNews(n);
    }
    case 'admin_news_unpublish': {
      const n = s.news.find((x) => x.id === args.p_id && !x.deleted_at);
      if (!n) refuse('this news item no longer exists');
      if (n.status === 'published') n.status = 'unpublished';
      save(s);
      return adminNews(n);
    }
    case 'admin_news_delete': {
      const n = s.news.find((x) => x.id === args.p_id && !x.deleted_at);
      if (!n) refuse('this news item no longer exists');
      n.deleted_at = now();
      save(s);
      return null;
    }
    case 'admin_news_reorder':
    case 'admin_banner_reorder': {
      const ids = (args.p_ids as string[]) ?? [];
      const list = fn === 'admin_news_reorder' ? s.news : s.banners;
      const rest = list.filter((x) => !x.deleted_at && !ids.includes(x.id)).sort(order);
      for (const x of list) {
        const i = ids.indexOf(x.id);
        if (i >= 0) x.position = i;
      }
      rest.forEach((x, i) => (x.position = ids.length + i + 1));
      save(s);
      return null;
    }
    case 'admin_banner_list':
      return [...s.banners].filter((b) => !b.deleted_at).sort(order);
    case 'admin_banner_save': {
      const id = saveBanner(s, (args.p_id as string | null) ?? null, args.p_banner as Record<string, unknown>);
      save(s);
      return id;
    }
    case 'admin_banner_delete': {
      const b = s.banners.find((x) => x.id === args.p_id && !x.deleted_at);
      if (!b) refuse('this banner no longer exists');
      b.deleted_at = now();
      b.active = false;
      save(s);
      return null;
    }
    case 'admin_home_layout_get': {
      const fl = flavour(args.p_flavour);
      const l = s.layouts[fl];
      return {
        flavour: fl, draft: l.draft, published: l.published, version: l.version, draft_updated_at: l.draft_updated_at, published_at: l.published_at,
        versions: [...l.versions].reverse().slice(0, 20).map((v) => ({ version: v.version, published_at: v.published_at })),
      };
    }
    case 'admin_home_layout_save_draft': {
      const fl = flavour(args.p_flavour);
      const clean = layoutForServer(checkLayout(args.p_config, true));
      s.layouts[fl].draft = clean;
      s.layouts[fl].draft_updated_at = now();
      save(s);
      return clean;
    }
    case 'admin_home_layout_publish': {
      const fl = flavour(args.p_flavour);
      const l = s.layouts[fl];
      const clean = l.draft.length ? layoutForServer(checkLayout(l.draft, true)) : [];
      l.published = clean;
      l.draft = clean;
      l.version += 1;
      l.published_at = now();
      l.versions.push({ version: l.version, config: clean, published_at: now() });
      save(s);
      return l.version;
    }
    case 'admin_home_layout_restore': {
      const fl = flavour(args.p_flavour);
      const l = s.layouts[fl];
      const v = args.p_version == null ? null : l.versions.find((x) => x.version === args.p_version);
      if (args.p_version != null && !v) refuse('this version no longer exists');
      l.draft = v ? v.config : l.published;
      l.draft_updated_at = now();
      save(s);
      return l.draft;
    }
  }
  throw new Error('Demo: nothing is saved');
}

// The demo journeys (scripts/e2e-demo-cms.mjs) also drive the demo's server directly.
(globalThis as { __irlyCmsDemo?: typeof demoCms }).__irlyCmsDemo = demoCms;
