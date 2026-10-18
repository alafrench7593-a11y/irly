import { useCallback, useEffect, useState } from 'react';
import { t } from '@/i18n';
import { useAccount, withProfile } from '@/features/auth/account';
import { communitiesChanged, useCommunitiesVersion } from './data';
import { NONE } from '@/lib/none';
import { supabase } from '@/lib/supabase';
import { CATEGORY_BY_ID, photoForText, type CategoryKey } from '@/data/catalog/categories';
import type { PhotoKey } from '@/data/photos';
import type { Profile } from '@/state/store';

/**
 * IRLY Community: the official communities IRLY runs in each city (IRLY Gym,
 * IRLY Newcomers…). Which ones exist, and what they match, is configured on
 * the server (community_topics); the app only sends the member's own
 * onboarding answers as tags and shows what comes back. Joining is always
 * the member's choice.
 */

export type OfficialCommunity = {
  id: string;
  topic: string;
  name: string;
  tagline: string;
  emoji: string;
  girlOnly: boolean;
  /** Introductions strongly suggested (newcomers). */
  introFirst: boolean;
  /** Real member count from the server. */
  members: number;
  isMember: boolean;
  score: number;
  cityId: string;
};

type Row = Record<string, unknown>;

/** Tags from what the member actually answered: nothing is guessed. */
export function profileTags(p: Profile): string[] {
  const tags = new Set<string>();
  p.types.forEach((x) => tags.add(`type:${x}`));
  p.interests.forEach((x) => tags.add(`interest:${x}`));
  p.activities.forEach((x) => tags.add(`activity:${x}`));
  // Every answer to "What are you looking for?" is a goal the server can match.
  (p.lookingFor ?? []).forEach((x) => tags.add(`goal:${x}`));
  if (p.since === 'new' || p.since === 'year') tags.add('newcomer');
  return [...tags];
}

const toCommunity = (r: Row): OfficialCommunity => ({
  id: r.id as string,
  topic: r.topic as string,
  name: r.name as string,
  tagline: (r.tagline as string) ?? '',
  emoji: (r.emoji as string) ?? '',
  girlOnly: Boolean(r.girl_only),
  introFirst: Boolean(r.intro_first),
  members: Number(r.members ?? 0),
  isMember: Boolean(r.is_member),
  score: Number(r.score ?? 0),
  cityId: (r.city_id as string) ?? '',
});

/** Communities recommended for these answers in this city, best first. */
export function useRecommendedCommunities(cityId: string, tags: string[], limit = 6) {
  const uid = useAccount()?.userId;
  const [list, setList] = useState<OfficialCommunity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = tags.slice().sort().join(',');
  const version = useCommunitiesVersion();
  const [n, setN] = useState(0);
  const refresh = useCallback(() => setN((x) => x + 1), []);
  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    supabase.rpc('community_recommend', { p_city: cityId, p_tags: key ? key.split(',') : [], p_limit: limit }).then(({ data, error: e }) => {
      if (!alive) return;
      if (e) {
        setError(e.message);
        setList((l) => l ?? []);
        return;
      }
      setError(null);
      setList(((data as Row[]) ?? []).map(toCommunity));
    }, (e: unknown) => {
      // Never a spinner forever: an unreachable server ends the load with a message.
      if (!alive) return;
      setError(e instanceof Error ? e.message : 'offline');
      setList((l) => l ?? []);
    });
    return () => {
      alive = false;
    };
  }, [cityId, key, limit, uid, version, n]);
  return { list: uid ? list : NONE, loading: Boolean(uid) && list === null, error, refresh, signedIn: Boolean(uid) };
}

/** Joins several communities at once; returns how many were joined. */
export async function joinCommunities(ids: string[]): Promise<number> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  if (!ids.length) return 0;
  const sb = supabase;
  const data = await withProfile(async () => {
    const { data: n, error } = await sb.rpc('join_communities', { p_ids: ids });
    if (error) throw new Error(error.message);
    return n;
  });
  communitiesChanged();
  return Number(data ?? 0);
}

/** Discover groups for the official topics (filters on the Communities page). */
export const TOPIC_GROUPS: Record<string, string[]> = {
  sports: ['sport', 'football', 'running', 'beach'],
  fitness: ['gym', 'running', 'wellness'],
  networking: ['network', 'entrepreneurs', 'tech', 'ai', 'ecom'],
  business: ['entrepreneurs', 'ecom', 'network'],
  travel: ['trip', 'beach'],
  food: ['food', 'nights'],
  culture: ['culture', 'nights'],
  lifestyle: ['newcomers', 'expats', 'girls', 'moms', 'families', 'food', 'beach', 'shopping', 'nights'],
};

/** The photo of each IRLY community: always a photo taken in Dubai (the library's Dubai photos, DUBAI_KEYS). */
// Some keys are IRLY photos added to the library (DUBAI_KEYS), outside the static PhotoKey list.
export const TOPIC_PHOTO = {
  newcomers: 'emirates',
  gym: 'gym',
  sport: 'crossfit',
  football: 'football',
  running: 'running',
  trip: 'roadtrip',
  beach: 'beachClub',
  food: 'brunch',
  network: 'founders',
  entrepreneurs: 'meeting',
  ecom: 'startup',
  tech: 'office',
  ai: 'startup',
  girls: 'girlFitness',
  moms: 'kids',
  expats: 'dubaiMarina',
  wellness: 'yoga',
  culture: 'souk',
  nights: 'rooftopNeon',
  shopping: 'mall',
  families: 'waterPark',
} as Record<string, PhotoKey>;

/** Category photos that were not taken in Dubai, and the Dubai photo a community shows instead. */
const DUBAI_INSTEAD = { gallery: 'souk', concert: 'festival', dogPark: 'nature', family: 'waterPark', education: 'office' } as Record<string, PhotoKey>;

/** A community's photo: its IRLY topic, else its category (a Dubai photo either way), else none. */
export function communityPhoto(topic: string | null | undefined, categoryId: string | null | undefined, name?: string | null): PhotoKey {
  // What the community is about, from its own name, first: "Padel girls" shows padel.
  const named = name ? photoForText(name) : null;
  if (named) return named;
  if (topic && TOPIC_PHOTO[topic]) return TOPIC_PHOTO[topic];
  const key = categoryId ? CATEGORY_BY_ID[categoryId as CategoryKey]?.photo : undefined;
  // Never an icon or a logo: people together in Dubai when nothing says more.
  return key ? (DUBAI_INSTEAD[key] ?? key) : 'girlsOut';
}

/** The house rules of every IRLY community. */
export const GUIDELINES = [
  'Be respectful and kind.',
  'Include new members.',
  'No harassment, no hate.',
  'No spam or selling.',
  'Respect everyone’s boundaries.',
  'Help people feel comfortable.',
];

/** A first message the member can edit before sending: only their own answers. */
export function introDraft(p: Profile, cityName: string, interestLabels: string[]): string {
  const name = p.name.trim();
  const newcomer = p.since === 'new' || p.since === 'year';
  const into = interestLabels.slice(0, 3);
  return [
    name
      ? t(newcomer ? 'Hey everyone 👋 I’m {name}, new to {city}.' : 'Hey everyone 👋 I’m {name}, living in {city}.', { name, city: cityName })
      : t('Hey everyone 👋'),
    into.length ? t('I’m into {list}.', { list: into.join(', ') }) : '',
    t('Happy to meet you!'),
  ]
    .filter(Boolean)
    .join(' ');
}
