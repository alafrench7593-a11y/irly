/**
 * Which communities IRLY Network lists, in each space (no import: checked by
 * scripts/check-community.mts).
 */

/**
 * Official IRLY communities about business, by topic (migration 20261008003400),
 * and IRLY Girl's own, women only (IRLY Girl Networking, migration 20261024009300).
 */
export const NETWORK_TOPICS = new Set(['network', 'entrepreneurs', 'ecom', 'tech', 'ai', 'girl_network']);
export const NETWORK_CATEGORY = 'networking';

/** IRLY Girl's five official communities (community/official.ts, GIRL_OFFICIAL_TOPICS). */
const GIRL_OFFICIAL = new Set(['girl_newcomers', 'girl_network', 'girl_francophone', 'girl_trip', 'girl_activity']);

// Both fields required: a community without its category is never taken for a networking one.
type About = { categoryId: string | null; topic: string | null };
type Listed = About & { girlOnly: boolean; official: boolean };

/** About business: the Networking category, or one of the official business topics. */
export const isNetworkCommunity = (c: About) =>
  c.categoryId === NETWORK_CATEGORY || (c.topic != null && NETWORK_TOPICS.has(c.topic));

/**
 * The same rule as every community list (community/data.ts): in IRLY Girl,
 * women-only communities only (of IRLY's official ones, IRLY Girl's own); in
 * IRLY Mixte, no women-only one. IRLY Girl's Network listed no community to
 * join at all before: the official business ones are mixed, and IRLY Girl
 * Networking was not one of its topics.
 */
export const networkListed = (c: Listed, girlSpace: boolean) =>
  isNetworkCommunity(c) && (girlSpace ? c.girlOnly && (!c.official || (c.topic != null && GIRL_OFFICIAL.has(c.topic))) : !c.girlOnly);
