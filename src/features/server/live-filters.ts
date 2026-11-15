/**
 * Server-side filters for Realtime database changes.
 *
 * Realtime checks every change of a table against every subscription to it.
 * A subscription whose filter does not match costs a comparison; one with no
 * filter costs a row-level-security query, for every member connected. So a
 * listener that can name the rows it cares about names them.
 *
 * Pure (no React, no Supabase): scripts/test-live-filters.mts runs it.
 */

/** The most values Realtime accepts in one `in` filter. */
export const IN_FILTER_MAX = 100;
/** Ids that can be written in a filter as they are (uuids, slugs). */
const SAFE_ID = /^[\w.:-]+$/;

/**
 * `column=in.(…)` filters that together name every id, at most
 * IN_FILTER_MAX each (one subscription per filter, on the same channel):
 *   · []    no id: there is nothing to listen to;
 *   · null  they cannot be named (more than `maxFilters` filters would be
 *           needed, or an id cannot be written in a filter): the caller
 *           listens without a filter, as before.
 * The same ids in any order, repeated or not, give the same filters.
 */
export function inFilters(column: string, ids: readonly string[], maxFilters = 3): string[] | null {
  const unique = [...new Set(ids)].sort();
  if (!unique.every((id) => SAFE_ID.test(id))) return null;
  if (unique.length > IN_FILTER_MAX * maxFilters) return null;
  const filters: string[] = [];
  for (let i = 0; i < unique.length; i += IN_FILTER_MAX) filters.push(`${column}=in.(${unique.slice(i, i + IN_FILTER_MAX).join(',')})`);
  return filters;
}

/** True when every id is already named by a set (nothing new to listen to). */
export function allKnown(known: ReadonlySet<string> | null, ids: readonly string[]): boolean {
  // null: listening to everything.
  return known === null || ids.every((id) => known.has(id));
}
