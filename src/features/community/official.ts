import { useCallback, useEffect, useState } from 'react';
import { t } from '@/i18n';
import { useAccount } from '@/features/auth/account';
import { communitiesChanged, useCommunitiesVersion } from './data';
import { NONE } from '@/lib/none';
import { supabase } from '@/lib/supabase';
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

const GOALS: Record<string, string> = {
  friends: 'goal:friends',
  sport: 'goal:sport',
  networking: 'goal:networking',
  travel: 'goal:travel',
  food: 'goal:food',
  irlygirl: 'goal:irlygirl',
};

/** Tags from what the member actually answered: nothing is guessed. */
export function profileTags(p: Profile): string[] {
  const tags = new Set<string>();
  p.types.forEach((x) => tags.add(`type:${x}`));
  p.interests.forEach((x) => tags.add(`interest:${x}`));
  p.activities.forEach((x) => tags.add(`activity:${x}`));
  (p.lookingFor ?? []).forEach((x) => GOALS[x] && tags.add(GOALS[x]));
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
  const version = useCommunitiesVersion((x) => x.v);
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
  const { data, error } = await supabase.rpc('join_communities', { p_ids: ids });
  if (error) throw new Error(error.message);
  communitiesChanged();
  return Number(data ?? 0);
}

/** Discover groups for the official topics (filters on the Communities page). */
export const TOPIC_GROUPS: Record<string, string[]> = {
  sports: ['sport', 'football', 'running', 'beach'],
  fitness: ['gym', 'running'],
  networking: ['network', 'entrepreneurs', 'tech', 'ai', 'ecom'],
  business: ['entrepreneurs', 'ecom', 'network'],
  travel: ['trip', 'beach'],
  food: ['food'],
  lifestyle: ['newcomers', 'girls', 'moms', 'food', 'beach'],
};

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
