/**
 * Where the space doors lead, written once for every entry (Home portals,
 * Explore, Settings, the assistant, the space pages), so the same door
 * always opens the same place:
 * - IRLY Girl: the gate (/girl, the server check), then IRLY Girl's Home;
 * - IRLY Maman: the same gate, then Discover › People with IRLY Maman open;
 * - IRLY Mixte: no route, the space switch itself (state/appSpace).
 * The IRLY Maman request travels as one-shot params that Discover consumes
 * and clears (never a param left on Home or on Discover that could fire
 * again on back, refresh or the next IRLY Girl entry).
 */
export const GIRL_DOOR = '/girl';
export const MOM_DOOR = '/girl?mode=moms';
/** IRLY Maman inside IRLY Girl: Discover › People, the IRLY Maman view open. */
export const MOM_PAGE = '/discover?tab=people&moms=1';
/** IRLY Girl's Home (the tabs, Home first). */
export const GIRL_HOME = '/(tabs)';

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** Where the gate sends an account IRLY Girl is open for: IRLY Maman's page for the Maman door, Home for every other. */
export function gateTarget(mode: string | string[] | undefined): typeof GIRL_HOME | typeof MOM_PAGE {
  return one(mode) === 'moms' ? MOM_PAGE : GIRL_HOME;
}

/** Discover was opened on IRLY Maman (`moms=1`). */
export const asksMoms = (moms: string | string[] | undefined): boolean => one(moms) === '1';
