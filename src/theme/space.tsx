import { useLocalSearchParams, useRootNavigationState, useRoute } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Flavor, type FlavorId } from './flavor';

/**
 * Which experience a shared screen belongs to (activity, community, chat,
 * profile, notifications, settings...). Those pages are reached from Home
 * and from IRLY Girl alike; they wear the look of the space the member
 * came from, so leaving the Girl home never drops her into the Mixte look.
 *
 * Purely cosmetic: it picks a palette, never grants anything. IRLY Girl
 * access is decided by the server (features/girl/access), not here.
 *
 * Resolution, most explicit first:
 * 1. `?flavor=girl` on the route (a link that wants the Girl look, or a
 *    web reload of such a page);
 * 2. the navigation history under the screen: walking down the stack, the
 *    first page that defines a space wins (a girl/* route → girl; a Mixte
 *    page such as the tabs → mixte). Shared pages are transparent and
 *    pass the question further down, so Girl → plan → chat → profile stays
 *    Girl, and the same chain opened from Home stays Mixte;
 * 3. nothing found (deep link, cold start): Mixte.
 * The history is the session's real memory: it needs no flag to clear when
 * the member goes back to the Mixte tabs, and it cannot go stale.
 */

/** Shared pages: they take the space of whatever is under them. */
const SHARED = new Set([
  'a/[id]',
  'c/[id]',
  'messages/[id]',
  'person/[id]',
  'notifications',
  'search',
  'settings',
  'account',
  'calendar',
  'verify',
  'comments',
  'preferences',
  'communities',
  'place/[slug]',
]);

type RouteLike = { key?: string; name: string; params?: object; state?: StateLike };
type StateLike = { type?: string; index?: number; routes: RouteLike[] };

const girlParam = (params: object | undefined) => (params as { flavor?: unknown } | undefined)?.flavor === 'girl';

/** girl / mixte when this page defines a space, null when it is shared (look further down). */
function spaceOf(r: RouteLike): FlavorId | null {
  if (girlParam(r.params)) return 'girl';
  if (r.name === 'girl' || r.name.startsWith('girl/')) return 'girl';
  if (SHARED.has(r.name)) return null;
  // The Messages list lives in the tabs but is shared too (opened from the Girl header).
  if (r.name === '(tabs)') {
    // Its own state once the tabs have mounted, else the screen it was opened on.
    const focused = r.state ? r.state.routes[r.state.index ?? r.state.routes.length - 1] : (r.params as { screen?: string; params?: object } | undefined);
    const name = r.state ? (focused as RouteLike | undefined)?.name : (focused as { screen?: string } | undefined)?.screen;
    if (name === 'messages') return girlParam(focused?.params) ? 'girl' : null;
  }
  return 'mixte';
}

/** The chain of navigator states from the root down to the route `key`, with the index taken at each level. */
function pathTo(state: StateLike | undefined, key: string): { state: StateLike; index: number }[] | null {
  if (!state?.routes) return null;
  for (let i = 0; i < state.routes.length; i += 1) {
    const r = state.routes[i];
    if (r.key === key) return [{ state, index: i }];
    const below = pathTo(r.state, key);
    if (below) return [{ state, index: i }, ...below];
  }
  return null;
}

/**
 * The focused chain: a screen that just mounted is the focused one, even
 * when its navigator (the tabs) has not reported its own state to the root yet.
 */
function focusedPath(state: StateLike | undefined): { state: StateLike; index: number }[] {
  const path: { state: StateLike; index: number }[] = [];
  for (let s = state; s?.routes?.length; ) {
    const index = s.index ?? s.routes.length - 1;
    path.push({ state: s, index });
    s = s.routes[index].state;
  }
  return path;
}

export function spaceFromHistory(root: StateLike | undefined, key: string): FlavorId | null {
  const path = pathTo(root, key) ?? focusedPath(root);
  // Deepest navigator first; only stacks have a history (tab order is not one).
  for (let level = path.length - 1; level >= 0; level -= 1) {
    const { state, index } = path[level];
    if (state.type && state.type !== 'stack') continue;
    for (let i = index - 1; i >= 0; i -= 1) {
      const space = spaceOf(state.routes[i]);
      if (space) return space;
    }
  }
  return null;
}

/** The space of the current screen (see above), decided when it opens and kept while it lives. */
export function useSpace(): FlavorId {
  const { flavor } = useLocalSearchParams<{ flavor?: string }>();
  const route = useRoute();
  const root = useRootNavigationState() as unknown as StateLike | undefined;
  // What is under a screen does not change while it is open: read the history once.
  const [space] = useState<FlavorId>(() => (flavor === 'girl' ? 'girl' : (spaceFromHistory(root, route.key) ?? 'mixte')));
  return flavor === 'girl' ? 'girl' : space;
}

/**
 * Wraps a shared screen so every component inside (Glass, Button, Sheet,
 * Page, Ambient...) reads the palette of the space it was opened from.
 * Pass the screen as children from the route component: when only the
 * history changes, the screen itself does not re-render.
 */
export function SpaceFlavor({ children }: { children: ReactNode }) {
  return <Flavor value={useSpace()}>{children}</Flavor>;
}
