import type { IconName } from '@/components/ui/Icon';
import { ACTIVITIES } from '@/data/catalog';
import type { ActivityKind, ActivitySession, EventCategory, Interest, IrlEvent, PlaceKind } from '@/data/types';
import type { MyPlan } from '@/state/store';
import { CATEGORY_BY_ID, type CategoryKey } from './categories';

/** Where the existing demo content sits in the catalog. */
export const SESSION_CATEGORY: Record<ActivityKind, CategoryKey> = {
  padel: 'sport',
  football: 'sport',
  basketball: 'sport',
  tennis: 'sport',
  running: 'sport',
  gym: 'sport',
  boxing: 'sport',
  cycling: 'sport',
  volleyball: 'sport',
  swimming: 'sport',
  surf: 'sport',
  networking: 'networking',
  yoga: 'wellness',
  wellness: 'wellness',
  beach: 'outdoor',
  hiking: 'outdoor',
  kayak: 'outdoor',
};

export const EVENT_CATEGORY: Record<EventCategory, CategoryKey> = {
  sports: 'sport',
  networking: 'networking',
  business: 'networking',
  party: 'nightlife',
  food: 'food',
  culture: 'culture',
  wellness: 'wellness',
};

export const PLACE_CATEGORY: Record<PlaceKind, CategoryKey> = {
  restaurant: 'food',
  cafe: 'food',
  beachclub: 'nightlife',
  rooftop: 'nightlife',
  coworking: 'networking',
  market: 'shopping',
  gallery: 'culture',
  nature: 'outdoor',
};

export const categoryOfSession = (s: ActivitySession) => SESSION_CATEGORY[s.kind];
export const categoryOfEvent = (e: IrlEvent) => EVENT_CATEGORY[e.category];

/** How a member's own session reads anywhere in the app. */
export function planDisplay(plan: MyPlan): { title: string; label: string; icon: IconName; color: string; categoryId: CategoryKey } {
  if (plan.categoryId) {
    const c = CATEGORY_BY_ID[plan.categoryId];
    const sub = c.subs.find((x) => x.id === plan.subId);
    return {
      title: plan.title ?? sub?.label ?? c.label,
      label: sub?.label ?? c.label,
      icon: c.icon,
      color: c.color,
      categoryId: c.id,
    };
  }
  const kind = plan.kind ?? 'padel';
  const a = ACTIVITIES[kind];
  const c = CATEGORY_BY_ID[SESSION_CATEGORY[kind]];
  return { title: a.label, label: a.label, icon: a.icon, color: c.color, categoryId: c.id };
}

/** Member interests → categories, for recommendations and "people into this". */
export const INTEREST_CATEGORY: Record<Interest, CategoryKey> = {
  sports: 'sport',
  wellness: 'wellness',
  food: 'food',
  nightlife: 'nightlife',
  business: 'networking',
  startups: 'networking',
  tech: 'networking',
  art: 'culture',
  music: 'creative',
  outdoors: 'outdoor',
  fashion: 'shopping',
  languages: 'learning',
  family: 'family',
  travel: 'travel',
};
