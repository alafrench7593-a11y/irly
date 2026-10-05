import type { ActivityKind, EventCategory, PlaceKind } from '@/data/types';
import { category } from './tokens';

/**
 * Category colour of anything placed in the city. Colour is only ever an
 * icon, a dot, a ring or a halo: it tells the category at a glance on a
 * black and white interface.
 */
const ACTIVITY: Record<ActivityKind, string> = {
  padel: category.padel,
  tennis: category.padel,
  football: category.sport,
  basketball: category.sport,
  running: category.sport,
  gym: category.sport,
  boxing: category.sport,
  cycling: category.sport,
  volleyball: category.beach,
  hiking: category.travel,
  kayak: category.travel,
  surf: category.beach,
  swimming: category.beach,
  beach: category.beach,
  yoga: category.wellness,
  wellness: category.wellness,
  networking: category.networking,
};

const EVENT: Record<EventCategory, string> = {
  sports: category.sport,
  networking: category.networking,
  party: category.nightlife,
  wellness: category.wellness,
  business: category.business,
  culture: category.culture,
  food: category.food,
};

const PLACE: Record<PlaceKind, string> = {
  restaurant: category.food,
  cafe: category.coffee,
  beachclub: category.beach,
  rooftop: category.nightlife,
  coworking: category.business,
  market: category.food,
  gallery: category.culture,
  nature: category.travel,
};

export const activityColor = (k: ActivityKind) => ACTIVITY[k];
export const eventColor = (c: EventCategory) => EVENT[c];
export const placeColor = (k: PlaceKind) => PLACE[k];
