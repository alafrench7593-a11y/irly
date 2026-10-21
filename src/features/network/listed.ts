/**
 * Which communities IRLY Network lists, in each space (no import: checked by
 * scripts/check-community.mts).
 */

/**
 * Official IRLY communities about business, by topic (migration
 * 20261008003400): IRLY Network, and Girl CEO in IRLY Girl (20261028100000:
 * both live here, not in the community lists; the others are retired).
 */
export const NETWORK_TOPICS = new Set(['network', 'girl_network', 'entrepreneurs', 'ecom', 'tech', 'ai']);
export const NETWORK_CATEGORY = 'networking';

// Both fields required: a community without its category is never taken for a networking one.
type About = { categoryId: string | null; topic: string | null };
type Listed = About & { girlOnly: boolean };

/** About business: the Networking category, or one of the official business topics. */
export const isNetworkCommunity = (c: About) =>
  c.categoryId === NETWORK_CATEGORY || (c.topic != null && NETWORK_TOPICS.has(c.topic));

/**
 * The same rule as every community list (community/data.ts): in IRLY Girl,
 * women-only communities only (Girl CEO, members' women-only networking
 * communities); in IRLY Mixte, no women-only one (IRLY Network, members'
 * mixed ones). A woman in IRLY Mixte was shown women-only communities there.
 */
export const networkListed = (c: Listed, girlSpace: boolean) => isNetworkCommunity(c) && (girlSpace ? c.girlOnly : !c.girlOnly);
