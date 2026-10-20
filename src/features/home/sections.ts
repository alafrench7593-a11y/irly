import type { AppSpace } from '@/state/appSpace';

/**
 * The sections of the Home, top to bottom, under the hero. IRLY and IRLY
 * Girl render this one list in this one order with the same components;
 * only the data differs (IRLY Girl: women, girls' plans, IRLY Girl
 * communities, events open to everyone). A section with nothing to show
 * is left out in either space, never replaced by another block.
 * scripts/test-parity.mts checks the list and the Home's use of it.
 */
export const HOME_SECTIONS = [
  'search',
  'categories',
  'featured',
  'create',
  'bali',
  'sessions',
  'people',
  'today',
  'explore',
  'portals',
  'members',
  'nearby',
  'eat',
  'events',
  'yourCommunities',
  'communities',
  'forYou',
  'footer',
] as const;

export type HomeSection = (typeof HOME_SECTIONS)[number];

/** The Home's sections in a space: the same list for both. */
export function homeSections(space: AppSpace): readonly HomeSection[] {
  void space;
  return HOME_SECTIONS;
}
