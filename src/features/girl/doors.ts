/**
 * Where the space doors lead, written once for every entry (Home portals,
 * Explore, Settings, the assistant, the space pages), so the same door
 * always opens the same place:
 * - IRLY Girl: the gate (/girl, the server check), then IRLY Girl's Home;
 * - IRLY Mom Community: only from inside IRLY Girl. Its page (/girl/moms)
 *   belongs to IRLY Girl; from IRLY (Mixte) or a link, the same gate first
 *   (women only, switch to IRLY Girl), then that page;
 * - IRLY Mixte: no route, the space switch itself (state/appSpace).
 * No door relays through Home or leaves a param behind that could fire
 * again on back, refresh or the next IRLY Girl entry.
 */
export const GIRL_DOOR = '/girl';
export const MOM_DOOR = '/girl?mode=moms';
/** IRLY Mom Community's page, inside IRLY Girl. */
export const MOM_PAGE = '/girl/moms';
/** IRLY Girl's Home (the tabs, Home first). */
export const GIRL_HOME = '/(tabs)';

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** Where the gate sends an account IRLY Girl is open for: IRLY Mom Community's page for the Mom door, Home for every other. */
export function gateTarget(mode: string | string[] | undefined): typeof GIRL_HOME | typeof MOM_PAGE {
  return one(mode) === 'moms' ? MOM_PAGE : GIRL_HOME;
}
