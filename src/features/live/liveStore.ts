import { useMemo } from 'react';
import { create } from 'zustand';
import type { PhotoKey } from '@/data/photos';
import { useNow } from '@/lib/useNow';
import { getCityContent } from '@/data/repo';
import type { CityId } from '@/data/types';
import { useCityId } from '@/state/store';

/** How long a live post stays up. IRL is "right now", not a feed archive. */
export const LIVE_TTL_MIN = 240;

export type Live = {
  id: string;
  cityId: CityId;
  /** Person id, or 'me'. */
  authorId: string;
  kind: 'text' | 'photo';
  text: string;
  photo?: PhotoKey;
  /** A photo taken or picked by the member (local URI until uploaded). */
  photoUri?: string;
  /** Never an address: a venue or a neighbourhood. */
  place: string;
  areaId: string;
  postedAt: number;
};

/**
 * Demo lives for a city, derived from its members so the feed reads like
 * what is happening right now. Replaced by the server feed later.
 */
const TEMPLATES: { text: string; photo?: PhotoKey; place: string }[] = [
  { text: 'Coffee and laptop, anyone around?', photo: 'coffee', place: 'Nook Coffee Lab' },
  { text: 'Padel tonight, we need a 4th player', photo: 'padel', place: 'Padel Pro' },
  { text: 'Sunset at the beach, come say hi', photo: 'beachSunset', place: 'the beach' },
  { text: 'Brunch table for 6, two seats left', photo: 'brunch', place: 'Saffron & Sea' },
  { text: 'Running 5k at 7, easy pace', place: 'the promenade' },
  { text: 'Rooftop drinks after work?', photo: 'rooftop', place: 'the rooftop' },
];

function demo(cityId: CityId, now: number): Live[] {
  const content = getCityContent(cityId);
  return content.people.slice(0, TEMPLATES.length).map((p, i) => ({
    id: `live-${cityId}-${p.id}`,
    cityId,
    authorId: p.id,
    kind: TEMPLATES[i].photo ? 'photo' : 'text',
    text: TEMPLATES[i].text,
    photo: TEMPLATES[i].photo,
    place: TEMPLATES[i].place,
    areaId: p.areaId,
    postedAt: now - (i * 17 + 4) * 60_000,
  }));
}

type LiveState = {
  mine: Live[];
  post: (l: Omit<Live, 'id' | 'postedAt' | 'authorId'>) => void;
  remove: (id: string) => void;
};

export const useLiveStore = create<LiveState>((set, get) => ({
  mine: [],
  post: (l) => set({ mine: [{ ...l, id: `live-me-${Date.now()}`, authorId: 'me', postedAt: Date.now() }, ...get().mine] }),
  remove: (id) => set({ mine: get().mine.filter((m) => m.id !== id) }),
}));

const started = Date.now();

/** Lives still up in the current city, newest first. */
export function useLives(): Live[] {
  const cityId = useCityId();
  const mine = useLiveStore((s) => s.mine);
  const now = useNow();
  return useMemo(() => {
    return [...mine.filter((m) => m.cityId === cityId), ...demo(cityId, started)]
      .filter((l) => now - l.postedAt < LIVE_TTL_MIN * 60_000)
      .sort((a, b) => b.postedAt - a.postedAt);
  }, [mine, cityId, now]);
}

export function useLiveCount(): number {
  return useLives().length;
}
