import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '@/features/auth/account';
import type { FriendStatus } from '@/features/profile/member';
import { useRefreshOn } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';

/**
 * Match IRLY: real members who share something with me (interests,
 * activities and sports, goals, languages), ranked on the server
 * (`people_match`), which also leaves out blocked, hidden and deleted
 * accounts, friends already, and anyone I said « Not now » to in the last
 * 30 days. A match is only a suggestion: friendship is still Add friend,
 * accepted by the other person.
 */
export type PeopleMatch = {
  id: string;
  firstName: string;
  photo: string | null;
  username: string | null;
  cityId: string | null;
  score: number;
  interests: string[];
  activities: string[];
  goals: string[];
  languages: string[];
  friendStatus: FriendStatus;
  iFollow: boolean;
};

const PAGE = 20;

type Row = {
  id: string;
  first_name: string;
  photo_path: string | null;
  username: string | null;
  city_id: string | null;
  score: number;
  shared_interests: string[] | null;
  shared_activities: string[] | null;
  shared_goals: string[] | null;
  shared_languages: string[] | null;
  friend_status: FriendStatus | null;
  i_follow: boolean;
};

const toMatch = (r: Row): PeopleMatch => ({
  id: r.id,
  firstName: r.first_name,
  photo: r.photo_path,
  username: r.username,
  cityId: r.city_id,
  score: r.score,
  interests: r.shared_interests ?? [],
  activities: r.shared_activities ?? [],
  goals: r.shared_goals ?? [],
  languages: r.shared_languages ?? [],
  friendStatus: r.friend_status ?? 'none',
  iFollow: Boolean(r.i_follow),
});

export function usePeopleMatch(cityId: string) {
  const uid = useAccount()?.userId;
  const key = `${uid}|${cityId}`;
  const [state, setState] = useState<{ for: string; list: PeopleMatch[]; error: string | null; more: boolean }>({ for: '', list: [], error: null, more: false });
  const [loadingMore, setLoadingMore] = useState(false);
  const seq = useRef(0);

  const load = useCallback(() => {
    if (!supabase || !uid) return;
    const n = ++seq.current;
    supabase.rpc('people_match', { p_city: cityId, p_limit: PAGE, p_offset: 0 }).then(({ data, error }) => {
      if (n !== seq.current) return;
      // A failed reload keeps what is on screen and says why.
      if (error) setState((s) => ({ ...s, for: key, error: /fetch|network/i.test(error.message) ? 'Can’t reach IRLY right now' : error.message }));
      else {
        const rows = ((data as Row[] | null) ?? []).map(toMatch);
        setState({ for: key, list: rows, error: null, more: rows.length === PAGE });
      }
    });
  }, [uid, cityId, key]);

  useEffect(load, [load]);
  // A new friend, a block, a new answer in the profile: the list follows.
  useRefreshOn(['friends', 'people'], load);

  const ready = state.for === key;
  const loadMore = useCallback(() => {
    if (!supabase || !uid || loadingMore || !state.more) return;
    setLoadingMore(true);
    // A reload meanwhile starts a new list: this page belongs to the old one.
    const n = seq.current;
    supabase
      .rpc('people_match', { p_city: cityId, p_limit: PAGE, p_offset: state.list.length })
      .then(({ data, error }) => {
        if (error || n !== seq.current) return;
        const rows = ((data as Row[] | null) ?? []).map(toMatch);
        setState((s) => {
          const seen = new Set(s.list.map((x) => x.id));
          return { ...s, list: [...s.list, ...rows.filter((x) => !seen.has(x.id))], more: rows.length === PAGE };
        });
      })
      .then(() => setLoadingMore(false), () => setLoadingMore(false));
  }, [uid, cityId, loadingMore, state.more, state.list.length]);

  /** « Not now »: gone from the list at once, hidden for 30 days once the server agrees. */
  const skip = useCallback(async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.rpc('people_match_skip', { p_user: id });
    if (error) throw new Error(error.message);
    setState((s) => ({ ...s, list: s.list.filter((x) => x.id !== id) }));
  }, []);

  return {
    list: ready ? state.list : [],
    loading: Boolean(uid) && !ready,
    error: ready ? state.error : null,
    more: ready && state.more,
    loadingMore,
    loadMore,
    reload: load,
    skip,
    signedIn: Boolean(uid),
  };
}
