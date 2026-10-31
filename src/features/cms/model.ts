import type { AppSpace } from '@/state/appSpace';

/**
 * What the IRLY team publishes for members (news, banners, a Home layout),
 * as the app reads it from home_feed() / news_item() (migration
 * 20261028500000_irly_admin_cms). No React and no storage here: the shapes,
 * the labels and the checks a member's screen relies on (scripts/check-cms.mts
 * runs them).
 */
export type CmsAudience = 'mixte' | 'girl' | 'both';
export type NewsCategory = 'news' | 'event' | 'feature' | 'community' | 'tips' | 'partner';
export type NewsCard = {
  id: string;
  title: string;
  subtitle?: string;
  cover_path?: string;
  cover_key?: string;
  category: NewsCategory;
  publish_at: string;
  audience: CmsAudience;
  cta_label?: string;
  cta_url?: string;
  video?: boolean;
  /** The item carries a poll (its answers and counts come with the article). */
  has_poll?: boolean;
};
/** A poll the team attached to a news item, as a reader sees it: counts per answer, the total and the reader's own answer. */
export type NewsPoll = { question: string; options: string[]; counts: number[]; total: number; myVote: number | null };
export type NewsArticle = NewsCard & { body: string; gallery_paths: string[]; video_path?: string; poll?: NewsPoll };
export type Banner = {
  id: string;
  title: string;
  body?: string | null;
  image_path?: string | null;
  image_key?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  audience: CmsAudience;
};
export type HomeFeed = { space: AppSpace; layout: unknown; news: NewsCard[]; banners: Banner[] };

export const NEWS_CATEGORIES: NewsCategory[] = ['news', 'event', 'feature', 'community', 'tips', 'partner'];
export const NEWS_CATEGORY_LABEL: Record<NewsCategory, string> = {
  news: 'News',
  event: 'Event',
  feature: 'New in the app',
  community: 'Community',
  tips: 'Tips',
  partner: 'Partner',
};
/** IRLY's own photos (the owner's, src/data/photos OWN) when an item has no photo of its own. */
export const NEWS_PHOTO: Record<NewsCategory, string> = {
  news: 'palmAerial',
  event: 'dinnerMix',
  feature: 'meetingMix',
  community: 'beachMix',
  tips: 'newcomerGirl',
  partner: 'nightDinner',
};
export const BANNER_PHOTO = 'dubaiPink';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** A poll from the server, or undefined when it is not one a screen can draw (2 to 6 answers, a count per answer). */
export function cleanPoll(r: unknown): NewsPoll | undefined {
  if (!r || typeof r !== 'object') return undefined;
  const x = r as Record<string, unknown>;
  const question = str(x.question);
  const options = Array.isArray(x.options) ? x.options.filter((o): o is string => typeof o === 'string' && o.length > 0) : [];
  if (!question || options.length < 2 || options.length > 6 || options.length !== (x.options as unknown[]).length) return undefined;
  const raw = Array.isArray(x.counts) ? x.counts : [];
  const counts = options.map((_, i) => {
    const n = Number(raw[i]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  });
  const sum = counts.reduce((a, b) => a + b, 0);
  const total = Number(x.total);
  const vote = Number(x.my_vote);
  return {
    question,
    options,
    counts,
    total: Number.isFinite(total) && total >= sum ? Math.floor(total) : sum,
    myVote: x.my_vote !== null && x.my_vote !== undefined && Number.isInteger(vote) && vote >= 0 && vote < options.length ? vote : null,
  };
}

/** The poll after the reader picks an answer, before the server confirms it: their vote moves, the total counts them once. */
export function pollAfterVote(p: NewsPoll, option: number): NewsPoll {
  if (option < 0 || option >= p.options.length || p.myVote === option) return p;
  const counts = [...p.counts];
  if (p.myVote !== null) counts[p.myVote] = Math.max(0, counts[p.myVote] - 1);
  counts[option] += 1;
  return { ...p, counts, total: p.myVote === null ? p.total + 1 : p.total, myVote: option };
}

/** Each answer's share of the votes, in whole percents (0 when nobody voted). */
export const pollShares = (p: NewsPoll): number[] => p.counts.map((n) => (p.total ? Math.round((n / p.total) * 100) : 0));

/** A news card from the server, or null when it lacks what a card needs (never shown half-made). */
export function cleanNews(r: unknown): NewsArticle | null {
  if (!r || typeof r !== 'object') return null;
  const x = r as Record<string, unknown>;
  const id = str(x.id);
  const title = str(x.title);
  if (!id || !UUID.test(id) || !title) return null;
  const category = (NEWS_CATEGORIES as string[]).includes(String(x.category)) ? (x.category as NewsCategory) : 'news';
  const audience = x.audience === 'girl' || x.audience === 'mixte' ? x.audience : 'both';
  return {
    id,
    title,
    subtitle: str(x.subtitle),
    cover_path: str(x.cover_path),
    cover_key: str(x.cover_key),
    category,
    publish_at: str(x.publish_at) ?? new Date(0).toISOString(),
    audience,
    cta_label: str(x.cta_label),
    cta_url: str(x.cta_url),
    video: x.video === true || Boolean(str(x.video_path)),
    body: typeof x.body === 'string' ? x.body : '',
    gallery_paths: Array.isArray(x.gallery_paths) ? x.gallery_paths.filter((p): p is string => typeof p === 'string') : [],
    video_path: str(x.video_path),
    has_poll: x.has_poll === true || Boolean(x.poll),
    poll: cleanPoll(x.poll),
  };
}

function cleanBanner(r: unknown): Banner | null {
  if (!r || typeof r !== 'object') return null;
  const x = r as Record<string, unknown>;
  const id = str(x.id);
  const title = str(x.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    body: str(x.body) ?? null,
    image_path: str(x.image_path) ?? null,
    image_key: str(x.image_key) ?? null,
    cta_label: str(x.cta_label) ?? null,
    cta_url: str(x.cta_url) ?? null,
    audience: x.audience === 'girl' || x.audience === 'mixte' ? x.audience : 'both',
  };
}

/** The server's answer made safe to show: unusable rows are left out; another flavour's answer shows nothing of it. */
export function cleanFeed(data: unknown, space: AppSpace): HomeFeed | null {
  if (!data || typeof data !== 'object') return null;
  const x = data as Record<string, unknown>;
  // Asked for IRLY Girl, answered for IRLY (no IRLY Girl access): nothing of IRLY's in the Girl Home.
  if (x.space !== space) return { space, layout: null, news: [], banners: [] };
  const layout = x.layout && typeof x.layout === 'object' ? (x.layout as { sections?: unknown }).sections : null;
  return {
    space,
    layout: layout ?? null,
    news: (Array.isArray(x.news) ? x.news : []).map(cleanNews).filter((n): n is NewsArticle => n !== null),
    banners: (Array.isArray(x.banners) ? x.banners : []).map(cleanBanner).filter((b): b is Banner => b !== null),
  };
}
