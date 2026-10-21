import { CATEGORY_BY_ID, type CategoryKey } from '@/data/catalog/categories';
import { HOME_SECTIONS, type HomeSection } from '@/features/home/sections';
import type { Lang } from '@/i18n';
import { isDestination } from './destinations';

/**
 * The Home's layout as the team sets it from the back office (« Gestion de
 * l'accueil »): the sections of features/home/sections in an order, each on
 * or off, with only the changes its component really supports. The server
 * checks the same rules (private.home_section_spec / home_layout_clean in
 * migration 20261028000000_irly_admin_cms; scripts/check-cms.mts compares).
 *
 * A layout only orders and words the Home: every section still loads its
 * own data through its own calls and rules (IRLY Girl sections through the
 * Girl ones). The app never trusts it blindly either: an unknown section or
 * value is ignored, an empty or broken layout falls back to the app's own
 * order, and the Home can never end up empty.
 */
export type SectionStyle = 'cards' | 'list' | 'carousel' | 'stack' | 'large' | 'compact';

export type SectionSpec = {
  /** Title and the line above it (SectionHeader). */
  text?: boolean;
  /** The header's button: its label and where it leads. */
  cta?: boolean;
  category?: boolean;
  cover?: boolean;
  styles?: readonly SectionStyle[];
  /** Cards shown: [min, max, the app's own number]. */
  count?: readonly [number, number, number];
  pinned?: 'first' | 'last';
};

export const SECTION_SPEC: Record<HomeSection, SectionSpec> = {
  search: { pinned: 'first' },
  today: { text: true, cta: true },
  news: { text: true, cta: true, styles: ['cards', 'list'], count: [1, 10, 5] },
  categories: {},
  banners: { styles: ['carousel', 'stack'], count: [1, 5, 3] },
  featured: { text: true, cta: true, styles: ['large', 'compact'] },
  create: {},
  bali: { cover: true },
  sessions: { text: true, cta: true, count: [1, 5, 3] },
  people: { text: true, cta: true, count: [4, 20, 12] },
  explore: { text: true, cta: true },
  portals: { text: true },
  members: {},
  nearby: { text: true, cta: true, category: true, count: [2, 12, 8] },
  eat: { text: true, cta: true, count: [2, 12, 10] },
  yourCommunities: {},
  communities: { text: true, cta: true, count: [2, 12, 12] },
  forYou: { category: true, count: [1, 6, 3] },
  footer: { pinned: 'last' },
};

/** What the back office calls each section (English; translated on screen). */
export const SECTION_LABEL: Record<HomeSection, string> = {
  search: 'Search and Live now',
  today: 'Today on IRLY',
  news: 'IRLY news',
  categories: 'Discover activities (categories)',
  banners: 'Banners',
  featured: 'Happening now or next up',
  create: 'Create a plan',
  bali: 'Live Bali (in Bali only)',
  sessions: 'Your sessions',
  people: 'People near you',
  explore: 'Explore IRLY (help, news, spaces)',
  portals: 'Find your people (women only)',
  members: 'Planned by members',
  nearby: 'Activities near you',
  eat: 'Find someone to eat with',
  yourCommunities: 'Your communities',
  communities: 'Communities',
  forYou: 'For you (category rails)',
  footer: 'Destination footer',
};

export const STYLE_LABEL: Record<SectionStyle, string> = {
  cards: 'Cards',
  list: 'List',
  carousel: 'Carousel',
  stack: 'Stacked',
  large: 'Large',
  compact: 'Compact',
};

export type LayoutEntry = {
  key: HomeSection;
  enabled: boolean;
  title_fr?: string;
  title_en?: string;
  subtitle_fr?: string;
  subtitle_en?: string;
  category?: CategoryKey;
  cover_path?: string;
  cover_key?: string;
  style?: SectionStyle;
  count?: number;
  cta_label_fr?: string;
  cta_label_en?: string;
  cta_url?: string;
};

const TEXT_FIELDS = ['title_fr', 'title_en', 'subtitle_fr', 'subtitle_en'] as const;
const CTA_FIELDS = ['cta_label_fr', 'cta_label_en', 'cta_url'] as const;
const FIELDS = new Set(['key', 'enabled', 'order', ...TEXT_FIELDS, ...CTA_FIELDS, 'category', 'cover_path', 'cover_key', 'style', 'count']);
const PATH = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,80}$/;
const PHOTO_KEY = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

const isKey = (k: unknown): k is HomeSection => typeof k === 'string' && (HOME_SECTIONS as readonly string[]).includes(k);

/** The app's own Home: every section, on, in its order. */
export const defaultLayout = (): LayoutEntry[] => HOME_SECTIONS.map((key) => ({ key, enabled: true }));

/**
 * Checks a layout. strict (the back office, the demo's server): the first
 * problem throws the server's own words. Not strict (a member's Home): what
 * cannot be used is left out, and a layout that leaves nothing falls back
 * to the app's own order. Either way the result lists every section, search
 * first and the footer last.
 */
export function checkLayout(raw: unknown, strict = false): LayoutEntry[] {
  const fail = (msg: string): never => {
    throw new Error(msg);
  };
  if (!Array.isArray(raw) || raw.length > 40) {
    if (strict) fail('the layout must be a list of sections');
    return defaultLayout();
  }
  if (!raw.length) return defaultLayout();
  const rows = raw
    .map((r, i) => ({ r, i, o: r && typeof r === 'object' && typeof (r as { order?: unknown }).order === 'number' ? (r as { order: number }).order : Infinity }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map((x) => x.r);
  const out: LayoutEntry[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      if (strict) fail('the layout must be a list of sections');
      continue;
    }
    const e = r as Record<string, unknown>;
    if (!isKey(e.key)) {
      if (strict) fail('unknown section');
      continue;
    }
    if (seen.has(e.key)) {
      if (strict) fail('a section is listed twice');
      continue;
    }
    if (strict && Object.keys(e).some((f) => !FIELDS.has(f))) fail('unknown field');
    seen.add(e.key);
    const spec = SECTION_SPEC[e.key];
    const entry: LayoutEntry = { key: e.key, enabled: true };
    if (e.enabled !== undefined) {
      if (typeof e.enabled === 'boolean') entry.enabled = e.enabled;
      else if (strict) fail('invalid value');
    }
    const text = (f: string, max: number, label: string): string | undefined => {
      const v = e[f];
      if (v === undefined || v === null) return undefined;
      if (typeof v !== 'string') return strict ? fail('invalid value') : undefined;
      const s = v.trim();
      if (!s) return undefined;
      if (s.length > max) return strict ? fail(`${label} is at most ${max} characters`) : undefined;
      return s;
    };
    const allowed = (ok: boolean | undefined): boolean => (ok ? true : strict ? fail('this section cannot change that') : false);
    for (const f of TEXT_FIELDS) {
      const v = text(f, 60, 'a section title');
      if (v !== undefined && allowed(spec.text)) entry[f] = v;
    }
    for (const f of CTA_FIELDS) {
      const v = text(f, f === 'cta_url' ? 500 : 40, f === 'cta_url' ? 'a link' : 'a button label');
      if (v === undefined || !allowed(spec.cta)) continue;
      if (f === 'cta_url' && !isDestination(v)) {
        if (strict) fail('invalid destination');
        continue;
      }
      entry[f] = v;
    }
    const category = text('category', 40, 'a category');
    if (category !== undefined && allowed(spec.category)) {
      if (CATEGORY_BY_ID[category as CategoryKey]) entry.category = category as CategoryKey;
      else if (strict) fail('unknown category');
    }
    const coverKey = text('cover_key', 64, 'a photo');
    if (coverKey !== undefined && allowed(spec.cover)) {
      if (PHOTO_KEY.test(coverKey)) entry.cover_key = coverKey;
      else if (strict) fail('unknown photo');
    }
    const coverPath = text('cover_path', 120, 'a photo');
    if (coverPath !== undefined && allowed(spec.cover)) {
      if (PATH.test(coverPath)) entry.cover_path = coverPath;
      else if (strict) fail('invalid file');
    }
    const style = text('style', 20, 'a style');
    if (style !== undefined) {
      if (spec.styles?.includes(style as SectionStyle)) entry.style = style as SectionStyle;
      else if (strict) fail('this section has no such style');
    }
    if (e.count !== undefined && e.count !== null) {
      const c = e.count;
      if (!spec.count) {
        if (strict) fail('this section cannot change that');
      } else if (typeof c === 'number' && Number.isInteger(c) && c >= spec.count[0] && c <= spec.count[1]) entry.count = c;
      else if (strict) fail('number of cards out of range');
    }
    out.push(entry);
  }
  // Sections this layout does not know (a newer app): where the app puts them.
  for (const key of HOME_SECTIONS) {
    if (seen.has(key)) continue;
    const add: LayoutEntry = { key, enabled: true };
    if (key === 'search') out.unshift(add);
    else if (key === 'footer' || out.at(-1)?.key !== 'footer') out.push(add);
    else out.splice(out.length - 1, 0, add);
  }
  const pinnedOk = out[0].key === 'search' && out[0].enabled && out.at(-1)?.key === 'footer' && out.at(-1)?.enabled;
  if (!pinnedOk) {
    if (strict) fail('search stays first and the footer last');
    // A member's Home keeps them in place whatever the layout says.
    const middle = out.filter((x) => x.key !== 'search' && x.key !== 'footer');
    out.splice(0, out.length, { key: 'search', enabled: true }, ...middle, { key: 'footer', enabled: true });
  }
  if (!out.some((x) => x.enabled && !SECTION_SPEC[x.key].pinned)) {
    if (strict) fail('at least one section must stay visible');
    return defaultLayout();
  }
  return out;
}

/** The stored form of a layout (what the server keeps): entries with their order. */
export const layoutForServer = (entries: LayoutEntry[]) => entries.map((e, order) => ({ ...e, order }));

/** A section's title, line or button label in this language (the team's words, never translated), or undefined. */
export function entryText(entry: LayoutEntry | undefined, field: 'title' | 'subtitle' | 'cta_label', lang: Lang): string | undefined {
  if (!entry) return undefined;
  return (entry[`${field}_${lang}` as keyof LayoutEntry] as string | undefined) ?? (entry[`${field}_${lang === 'fr' ? 'en' : 'fr'}` as keyof LayoutEntry] as string | undefined);
}

/** The number of cards to show: the team's choice within bounds, else the app's own. */
export function entryCount(entry: LayoutEntry | undefined, key: HomeSection): number {
  const spec = SECTION_SPEC[key].count;
  if (!spec) return Infinity;
  const n = entry?.count;
  return typeof n === 'number' && n >= spec[0] && n <= spec[1] ? n : spec[2];
}
