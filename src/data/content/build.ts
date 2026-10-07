import { DEMO } from '@/config/app';
import { portrait, type PhotoKey } from '../photos';
import type {
  ActivityKind,
  ActivitySession,
  Availability,
  CityId,
  Community,
  EventCategory,
  Intent,
  Interest,
  IrlEvent,
  Level,
  Person,
  Place,
  PlaceKind,
  ServiceCategoryId,
  ServiceProvider,
  UserType,
  Visual,
} from '../types';

/**
 * Compact constructors used by the content files. They keep the seed data
 * readable (one line per item) while producing fully typed records.
 */

type When = [dayOffset: number, time: string, durationMin: number];

export function person(
  cityId: CityId,
  p: {
    id: string;
    name: string;
    age: number;
    types: UserType[];
    headline: string;
    bio: string;
    area: string;
    interests: Interest[];
    activities: ActivityKind[];
    intents: Intent[];
    availability?: Availability[];
    languages: string[];
    origin: string;
    since: string;
    verified?: boolean;
    hue: number;
    online?: boolean;
  },
): Person {
  return {
    id: p.id,
    name: p.name,
    age: p.age,
    types: p.types,
    headline: p.headline,
    bio: p.bio,
    cityId,
    areaId: p.area,
    interests: p.interests,
    activities: p.activities,
    intents: p.intents,
    availability: p.availability ?? ['evenings', 'weekends'],
    languages: p.languages,
    origin: p.origin,
    since: p.since,
    verified: p.verified ?? false,
    hue: p.hue,
    online: p.online,
    photo: DEMO ? portrait(p.id) : undefined,
  };
}

export function session(
  cityId: CityId,
  id: string,
  kind: ActivityKind,
  title: string,
  area: string,
  venue: string,
  when: When,
  level: Level,
  spots: number,
  goingIds: string[],
  extraGoing: number,
  hostId: string,
  price: number,
  visual?: Visual,
): ActivitySession {
  return {
    id,
    cityId,
    kind,
    title,
    areaId: area,
    venue,
    when: { dayOffset: when[0], time: when[1], durationMin: when[2] },
    level,
    spots,
    goingIds,
    extraGoing,
    hostId,
    price,
    visual,
  };
}

export function event(
  cityId: CityId,
  e: {
    id: string;
    title: string;
    category: EventCategory;
    area: string;
    venue: string;
    when: When;
    price: number;
    capacity: number;
    going: string[];
    extra: number;
    host: string;
    hostVerified?: boolean;
    description: string;
    highlights: string[];
    photo: PhotoKey;
    featured?: boolean;
  },
): IrlEvent {
  return {
    id: e.id,
    cityId,
    title: e.title,
    category: e.category,
    areaId: e.area,
    venue: e.venue,
    when: { dayOffset: e.when[0], time: e.when[1], durationMin: e.when[2] },
    price: e.price,
    capacity: e.capacity,
    goingIds: e.going,
    extraGoing: e.extra,
    host: e.host,
    hostVerified: e.hostVerified ?? false,
    description: e.description,
    highlights: e.highlights,
    visual: { photo: e.photo },
    featured: e.featured,
  };
}

export function place(
  cityId: CityId,
  id: string,
  name: string,
  kind: PlaceKind,
  area: string,
  blurb: string,
  priceLevel: 1 | 2 | 3 | 4,
  rating: number,
  tags: string[],
  visual: Visual,
  irlyPick?: boolean,
): Place {
  return { id, cityId, name, kind, areaId: area, blurb, priceLevel, rating, tags, visual, irlyPick };
}

export function community(
  cityId: CityId,
  c: Omit<Community, 'cityId' | 'visual'> & { photo: PhotoKey },
): Community {
  const { photo, ...rest } = c;
  return { ...rest, cityId, visual: { photo } };
}

export function service(
  cityId: CityId,
  id: string,
  category: ServiceCategoryId,
  name: string,
  tagline: string,
  description: string,
  priceFrom: number,
  unit: string,
  rating: number,
  reviews: number,
  perks: string[],
  area: string,
  visual: Visual,
  languages: string[] = ['English'],
  responseTime = 'Replies in ~1h',
): ServiceProvider {
  return {
    id,
    cityId,
    category,
    name,
    tagline,
    description,
    priceFrom,
    unit,
    rating,
    reviews,
    responseTime,
    languages,
    perks,
    areaId: area,
    visual,
  };
}
