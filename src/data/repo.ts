import { bali } from './content/bali';
import { GIRL_PEOPLE } from './content/girls';
import { dubai } from './content/dubai';
import { regionalContent } from './content/regional';
import { CITIES } from './destinations';
import type {
  ActivitySession,
  CityContent,
  CityId,
  Community,
  Conversation,
  IrlEvent,
  Person,
  Place,
  Professional,
  ServiceProvider,
} from './types';

/**
 * Repository: the only door between screens and data.
 *
 * Today it reads seed content; tomorrow each function becomes an API call
 * (with React Query or similar) and no screen has to change.
 */

export function getCityContent(cityId: CityId): CityContent {
  if (cityId === 'dubai') return dubai;
  if (cityId === 'bali') return bali;
  return regionalContent(cityId);
}

type Index = {
  people: Map<string, Person>;
  sessions: Map<string, ActivitySession>;
  events: Map<string, IrlEvent>;
  places: Map<string, Place>;
  communities: Map<string, Community>;
  services: Map<string, ServiceProvider>;
  professionals: Map<string, Professional>;
  conversations: Map<string, Conversation>;
};

let index: Index | null = null;

function buildIndex(): Index {
  const idx: Index = {
    people: new Map(),
    sessions: new Map(),
    events: new Map(),
    places: new Map(),
    communities: new Map(),
    services: new Map(),
    professionals: new Map(),
    conversations: new Map(),
  };
  (Object.keys(CITIES) as CityId[]).forEach((cityId) => {
    const c = getCityContent(cityId);
    c.people.forEach((x) => idx.people.set(x.id, x));
    c.sessions.forEach((x) => idx.sessions.set(x.id, x));
    c.events.forEach((x) => idx.events.set(x.id, x));
    c.places.forEach((x) => idx.places.set(x.id, x));
    c.communities.forEach((x) => idx.communities.set(x.id, x));
    c.services.forEach((x) => idx.services.set(x.id, x));
    c.professionals.forEach((x) => idx.professionals.set(x.id, x));
    c.conversations.forEach((x) => idx.conversations.set(x.id, x));
  });
  return idx;
}

function idx(): Index {
  if (!index) index = buildIndex();
  return index;
}

// IRLY Girl members are looked up too (chat names, avatars after a match).
export const findPerson = (id: string) => idx().people.get(id) ?? GIRL_PEOPLE.get(id);
export const findSession = (id: string) => idx().sessions.get(id);
export const findEvent = (id: string) => idx().events.get(id);
export const findPlace = (id: string) => idx().places.get(id);
export const findCommunity = (id: string) => idx().communities.get(id);
export const findService = (id: string) => idx().services.get(id);
export const findProfessional = (id: string) => idx().professionals.get(id);
export const findConversation = (id: string) => idx().conversations.get(id);

export function peopleByIds(ids: string[]): Person[] {
  return ids.map((id) => findPerson(id)).filter((p): p is Person => Boolean(p));
}

export function goingCount(item: { goingIds: string[]; extraGoing: number }, joined: boolean): number {
  return item.goingIds.length + item.extraGoing + (joined ? 1 : 0);
}
