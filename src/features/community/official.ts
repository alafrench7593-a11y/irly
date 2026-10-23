import { useCallback, useEffect, useState } from 'react';
import { t } from '@/i18n';
import { useAccount, withProfile } from '@/features/auth/account';
import { communitiesChanged, useCommunitiesVersion } from './data';
import { NONE } from '@/lib/none';
import { supabase } from '@/lib/supabase';
import { CATEGORY_BY_ID, photoForText, type CategoryKey } from '@/data/catalog/categories';
import type { PhotoKey } from '@/data/photos';
import { girlPhotoFor } from '@/features/girl/photos';
import type { Profile } from '@/state/store';
import { displayCommunityName } from './name';

/**
 * IRLY Community: the official communities IRLY runs in each city (IRLY
 * Expat, IRLY Sport, IRLY Network, IRLY Activité; in IRLY Girl: Girl Trip,
 * Girl Expat, Girl Activité, Girl Sport, and Girl CEO inside IRLY Network;
 * IRLY Mom Community); every other community is created by members. Which ones
 * exist, and what they match, is configured on the server
 * (community_topics, migration 20261028100000_irly_official_communities_four);
 * the app only sends the member's own onboarding answers as tags and shows
 * what comes back. Joining is always the member's choice.
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
  name: displayCommunityName(r as { name: string | null; topic: string | null; city_id: string | null }),
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
      // IRLY Network's own community lives in the IRLY Network section, not as a second tile here.
      setList(((data as Row[]) ?? []).map(toCommunity).filter((c) => !NETWORK_OFFICIAL_TOPICS.includes(c.topic)));
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
  lifestyle: ['newcomers', 'expats', 'lifestyle', 'girls', 'moms', 'families', 'food', 'beach', 'shopping', 'nights'],
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
  // Everyone's questions and the city's good addresses: Dubai itself, and a table with a view.
  help: 'dubai',
  // IRLY Activité (the former IRLY Lifestyle): a table with a view.
  lifestyle: 'dinnerView',
} as Record<string, PhotoKey>;

/**
 * IRLY Girl's official communities (its four, Girl CEO in IRLY Network, and
 * the retired IRLY Francophone for its members): IRLY's own photos taken in
 * Dubai, the same on the card, the page, the thumbnail and the chat (until
 * IRLY sets a cover).
 */
export const GIRL_OFFICIAL_PHOTO: Record<string, PhotoKey> = {
  girl_trip: 'girlTrip',
  girl_newcomers: 'newcomerGirl',
  girl_activity: 'beachClubGirl',
  girl_sport: 'padelGirl',
  girl_network: 'networkingGirl',
  girl_francophone: 'brunchGirl',
};

/**
 * The official communities of IRLY Network: IRLY Network (IRLY) and Girl
 * CEO (IRLY Girl) are reached from the IRLY Network section, never shown as
 * a second tile in the community lists or recommendations.
 */
export const NETWORK_OFFICIAL_TOPICS: readonly (string | null)[] = ['network', 'girl_network'];

/** Category photos that were not taken in Dubai, and the Dubai photo a community shows instead. */
const DUBAI_INSTEAD = { gallery: 'souk', concert: 'festival', dogPark: 'nature', family: 'waterPark', education: 'office' } as Record<string, PhotoKey>;

/** A community's photo: its IRLY topic, else its category (a Dubai photo either way), else none. */
export function communityPhoto(topic: string | null | undefined, categoryId: string | null | undefined, name?: string | null): PhotoKey {
  // IRLY Girl's official communities: their own photo, whatever their name says.
  const official = topic ? GIRL_OFFICIAL_PHOTO[topic] : undefined;
  if (official) return official;
  // A group of IRLY Girls: IRLY's photos of women, on its subject.
  if (topic === 'girls' && name) return girlPhotoFor(name, TOPIC_PHOTO.girls);
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

/**
 * What every official community's welcome says: who it is for is its
 * description; then what to post, how to meet members and how to suggest
 * an activity.
 */
export const WELCOME_CHARTER = [
  'Introduce yourself: the name you like to be called, what you enjoy, what you are looking for.',
  'Post questions, tips, recommendations, photos and plans that fit the community.',
  'Meet members: reply to their posts, join their activities, say hello in the chat.',
  'Suggest an activity: tap “Create an activity”, pick a place and a time, and members join you.',
];

/**
 * The themed question of a community's introduction (optional, the member
 * answers or deletes it): what people there want to know first.
 */
function introQuestion(topic: string | null | undefined, cityName: string): string {
  if (topic === 'girl_network' || topic === 'network') return t('What I do, and what I’m building or looking for: …');
  if (topic === 'girl_trip') return t('Destinations I’d love to discover: …');
  if (topic === 'sport' || topic === 'girl_sport') return t('Sports I practise: …');
  if (topic === 'expats' || topic === 'girl_newcomers') return t('In {city} since: …', { city: cityName });
  return t('What I’m looking for here: …');
}

/**
 * A first message the member can edit before sending: only their own
 * answers (name, how long here, interests, activities), then the
 * community's themed question left for them to answer. Nothing sensitive is
 * ever filled in (no address, no children's details).
 */
export function introDraft(p: Profile, cityName: string, interestLabels: string[], topic?: string | null, activityLabels: string[] = []): string {
  const name = p.name.trim();
  const newcomer = p.since === 'new' || p.since === 'year';
  const into = interestLabels.slice(0, 3);
  const likes = activityLabels.slice(0, 3);
  return [
    name
      ? t(newcomer ? 'Hey everyone 👋 I’m {name}, new to {city}.' : 'Hey everyone 👋 I’m {name}, living in {city}.', { name, city: cityName })
      : t('Hey everyone 👋'),
    into.length ? t('I’m into {list}.', { list: into.join(', ') }) : '',
    likes.length ? t('Activities I like: {list}.', { list: likes.join(', ') }) : '',
    introQuestion(topic, cityName),
    t('Happy to meet you!'),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * IRLY Girl's official communities: the four IRLY runs for it, in its order
 * (girl_official_communities on the server): Girl Trip, Girl Expat (topic
 * girl_newcomers, the former IRLY Nouvelle Arrivante), Girl Activité, Girl
 * Sport. Every page that features IRLY Girl's communities shows these and
 * no other official one (Girl CEO is in IRLY Network); the communities
 * members create stay listed as theirs.
 */
export const GIRL_OFFICIAL_TOPICS = ['girl_trip', 'girl_newcomers', 'girl_activity', 'girl_sport'] as const;
export type GirlOfficialTopic = (typeof GIRL_OFFICIAL_TOPICS)[number];

/**
 * IRLY Mom Community's official community: IRLY Mom Community (topic moms,
 * the former IRLY Moms, then IRLY Maman). Women only; listed first among the
 * mom communities.
 */
export const MAMAN_OFFICIAL_TOPICS = ['moms'] as const;

export type GirlOfficialCommunity = { id: string; topic: GirlOfficialTopic; name: string; tagline: string; emoji: string; members: number; isMember: boolean; coverPath: string | null };

export function useGirlOfficialCommunities(enabled = true) {
  const uid = useAccount()?.userId;
  const [list, setList] = useState<GirlOfficialCommunity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const version = useCommunitiesVersion();
  const [n, setN] = useState(0);
  const refresh = useCallback(() => setN((x) => x + 1), []);
  useEffect(() => {
    if (!supabase || !uid || !enabled) return;
    let alive = true;
    supabase.rpc('girl_official_communities').then(({ data, error: e }) => {
      if (!alive) return;
      if (e) {
        setError(e.message);
        setList((l) => l ?? []);
        return;
      }
      setError(null);
      setList(
        ((data as Row[]) ?? []).map((r) => ({
          id: r.id as string,
          topic: r.topic as GirlOfficialTopic,
          name: (r.name as string) ?? '',
          tagline: (r.tagline as string) ?? '',
          emoji: (r.emoji as string) ?? '',
          members: Number(r.members ?? 0),
          isMember: Boolean(r.is_member),
          coverPath: (r.cover_path as string | null) ?? null,
        })),
      );
    }, (e: unknown) => {
      // Never a spinner forever: an unreachable server ends the load with a message.
      if (!alive) return;
      setError(e instanceof Error ? e.message : 'offline');
      setList((l) => l ?? []);
    });
    return () => {
      alive = false;
    };
  }, [uid, version, n, enabled]);
  return { list: uid ? list : NONE, loading: Boolean(uid) && enabled && list === null, error, refresh, signedIn: Boolean(uid) };
}
