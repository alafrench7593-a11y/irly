/**
 * Proportions of Live photos and videos. A feed card follows the media's own
 * shape (portrait, square, landscape) within 4:5 … 1.91:1, so a very tall or
 * very wide picture never takes over the feed; the photo opened full screen
 * shows the whole picture at its real proportions.
 *
 * Pure (no React Native): unit-tested from node.
 */

/** Tallest card: 4:5 portrait. */
export const FEED_MIN_RATIO = 4 / 5;
/** Widest card: 1.91:1 landscape. */
export const FEED_MAX_RATIO = 1.91;
/** Before the media's size is known. */
export const FEED_DEFAULT_RATIO = 1;

/** width / height, or null when the size is unknown or unusable. */
export function mediaRatio(width?: number | null, height?: number | null): number | null {
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return width / height;
}

/** The ratio a feed card uses for a media of ratio `r` (width / height). */
export function feedRatio(r?: number | null, fallback = FEED_DEFAULT_RATIO): number {
  const v = r && Number.isFinite(r) && r > 0 ? r : fallback;
  return Math.min(FEED_MAX_RATIO, Math.max(FEED_MIN_RATIO, v));
}

/**
 * The stable name of a media behind a link: a signed link changes its token
 * but not its path ("irl-media/<user>/<file>"), a local file is its own path.
 * Used as the image cache key and to remember a media's size.
 */
export function mediaKey(url: string): string {
  const bare = url.split(/[?#]/)[0];
  const signed = bare.match(/\/object\/(?:sign|public|authenticated)\/(.+)$/);
  return signed ? decodeURIComponent(signed[1]) : bare;
}

const known = new Map<string, number>();

/** Remembers the ratio of a media (by link or by "bucket/path"), so it never jumps twice. */
export function rememberRatio(urlOrKey: string | null | undefined, r: number | null | undefined): void {
  if (!urlOrKey || !r || !Number.isFinite(r) || r <= 0) return;
  if (known.size > 500) known.clear();
  known.set(mediaKey(urlOrKey), r);
}

export function knownRatio(urlOrKey: string | null | undefined): number | null {
  return urlOrKey ? (known.get(mediaKey(urlOrKey)) ?? null) : null;
}
