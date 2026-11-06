import { isNetworkCommunity } from '@/features/network/listed';
import type { AppSpace } from '@/state/appSpace';

/**
 * The four IRLY universes a piece of content belongs to (communities, their
 * chats, their posts and activities):
 * - 'network': a networking community (IRLY Network, Girl CEO, Mom CEO, members'
 *   networking communities), whatever its space;
 * - 'mom': a Mom community (topic `moms` or `mom_*`);
 * - 'girl': any other women-only community;
 * - 'mixte': everything else.
 * The server twin is `private.community_universe(id)` (migration
 * 20261110000000_irly_universe). Data is never moved between universes: only
 * what a screen shows depends on the universe the member is in.
 */
export type Universe = 'mixte' | 'girl' | 'mom' | 'network';

export type UniverseRow = { girlOnly: boolean; topic: string | null; categoryId: string | null };

export const isMomTopic = (topic: string | null | undefined) => topic === 'moms' || (topic ?? '').startsWith('mom_');

export function universeOf(c: UniverseRow): Universe {
  if (isNetworkCommunity({ categoryId: c.categoryId, topic: c.topic })) return 'network';
  if (isMomTopic(c.topic)) return 'mom';
  if (c.girlOnly) return 'girl';
  return 'mixte';
}

/**
 * Universes shown in an app space: the Mixte app shows Mixte (and its Network
 * section, Mixte side); the IRLY Girl app shows Girl and Mom (and Network, Girl
 * side). Network content is split by `girlOnly` like every other list.
 */
export function universesForSpace(space: AppSpace): Universe[] {
  return space === 'girl' ? ['girl', 'mom', 'network'] : ['mixte', 'network'];
}

/** Whether a community row belongs in this app space (Network split by women-only, as lists already do). */
export function belongsToSpace(c: UniverseRow, space: AppSpace): boolean {
  return universeInSpace(universeOf(c), c.girlOnly, space);
}

/** The same rule for a universe the server already worked out (e.g. member_activities' `universe`). */
export function universeInSpace(u: Universe, girlOnly: boolean, space: AppSpace): boolean {
  if (u === 'network') return space === 'girl' ? girlOnly : !girlOnly;
  return universesForSpace(space).includes(u);
}
