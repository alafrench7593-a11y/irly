/**
 * Where a button of the team's content (a news item, a banner, a Home
 * section) may lead: a screen of the app from this list, or a secure web
 * address. The server checks the same rules (private.cms_destination_ok in
 * migration 20261028200000_irly_admin_cms); scripts/check-cms.mts compares
 * the two and checks that every screen listed exists.
 */
export const SCREEN_ROUTES = [
  'discover', 'live', 'map', 'messages', 'notifications', 'profile', 'social', 'communities', 'activities', 'calendar', 'categories',
  'events', 'eat', 'search', 'saved', 'network', 'girl', 'girl/match', 'girl/moving', 'bali', 'news', 'help', 'services', 'business',
  'recap', 'actu', 'match', 'support',
] as const;

export const DESTINATION_PATTERNS = [
  new RegExp(`^/(${SCREEN_ROUTES.join('|')})(\\?[A-Za-z0-9_=&-]{1,100})?$`),
  /^\/(category|activities|space|place)\/[a-z0-9-]{1,60}$/,
  /^\/(c|a|actu|person)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{2,5})?(\/[^\s<>"]*)?$/,
];

/** True for a link a button may open (empty: no link). */
export function isDestination(url: string | null | undefined): boolean {
  if (!url) return true;
  return url.length <= 500 && DESTINATION_PATTERNS.some((re) => re.test(url));
}
