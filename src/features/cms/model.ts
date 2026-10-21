import type { AppSpace } from '@/state/appSpace';

/**
 * What the IRLY team publishes for members (news, banners, a Home layout),
 * as the app reads it from home_feed() / news_item() (migration
 * 20261028000000_irly_admin_cms). No React and no storage here: the shapes,
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
};
export type NewsArticle = NewsCard & { body: string; gallery_paths: string[]; video_path?: string };
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
