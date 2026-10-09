import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '@/features/auth/account';
import { changed, useRefreshOn } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';

/**
 * A member's profile from the server, as the viewer may see it (their
 * profile visibility is applied by public_profile), with real follower and
 * following counts and the follow / message state.
 */
export type MemberProfile = {
  id: string;
  firstName: string;
  photo: string | null;
  bio: string | null;
  cityId: string | null;
  interests: string[];
  languages: string[];
  /** False: their settings hide the profile from you (only name and photo show). */
  visible: boolean;
  followers: number;
  following: number;
  iFollow: boolean;
  followsMe: boolean;
  canMessage: boolean;
  directId: string | null;
  isMe: boolean;
};

export type MemberPost = { id: string; body: string; at: number; communityId: string; communityName: string };
export type MemberCommunity = { id: string; name: string; cityId: string; cover: string | null; members: number };
export type FollowPerson = { id: string; firstName: string; photo: string | null; iFollow: boolean };

function sb() {
  if (!supabase) throw new Error('The IRLY server is not configured');
  return supabase;
}

type Row = {
  id: string;
  first_name: string;
  photo_path: string | null;
  bio: string | null;
  city_id: string | null;
  interests: string[] | null;
  languages: string[] | null;
  visible: boolean;
  followers: number;
  following: number;
  i_follow: boolean;
  follows_me: boolean;
  can_message: boolean;
  direct_id: string | null;
  is_me: boolean;
};

export function useMemberProfile(userId: string) {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ for: string; profile: MemberProfile | null; communities: MemberCommunity[]; posts: MemberPost[]; error: string | null }>({ for: '', profile: null, communities: [], posts: [], error: null });
  const seq = useRef(0);
  const key = `${uid}|${userId}`;

  const load = useCallback(() => {
    if (!supabase || !uid) return;
    const n = ++seq.current;
    // Their posts in communities you can read (the read rules decide; nothing else is asked).
    const posts = sb()
      .from('community_posts')
      .select('id, body, created_at, community_id, communities(name)')
      .eq('author_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10);
    Promise.all([sb().rpc('public_profile', { p_user: userId }), sb().rpc('member_communities', { p_user: userId }), posts])
      .then(([p, c, ps]) => {
        if (n !== seq.current) return;
        if (p.error) throw new Error(p.error.message);
        const r = ((p.data as Row[] | null) ?? [])[0];
        const visible = Boolean(r?.visible);
        setState({
          for: key,
          error: null,
          // A hidden profile shows no posts here, even ones you could read in a shared community.
          posts: visible
            ? ((ps.data as { id: string; body: string; created_at: string; community_id: string; communities: { name: string } | { name: string }[] | null }[] | null) ?? []).map((x) => ({
                id: x.id,
                body: x.body,
                at: Date.parse(x.created_at),
                communityId: x.community_id,
                communityName: (Array.isArray(x.communities) ? x.communities[0]?.name : x.communities?.name) ?? '',
              }))
            : [],
          profile: r
            ? {
                id: r.id,
                firstName: r.first_name,
                photo: r.photo_path,
                bio: r.bio,
                cityId: r.city_id,
                interests: r.interests ?? [],
                languages: r.languages ?? [],
                visible: r.visible,
                followers: r.followers,
                following: r.following,
                iFollow: r.i_follow,
                followsMe: r.follows_me,
                canMessage: r.can_message,
                directId: r.direct_id,
                isMe: r.is_me,
              }
            : null,
          communities: ((c.data as { id: string; name: string; city_id: string; cover_path: string | null; members: number }[] | null) ?? []).map((x) => ({
            id: x.id,
            name: x.name,
            cityId: x.city_id,
            cover: x.cover_path,
            members: x.members,
          })),
        });
      })
      .catch((e) => n === seq.current && setState((s) => ({ ...s, for: key, error: /fetch|network/i.test(String(e)) ? 'Can’t reach IRLY right now' : e instanceof Error ? e.message : 'Could not load' })));
  }, [uid, userId, key]);

  useEffect(load, [load]);
  // A follow anywhere (yours, theirs, on another device), a new photo or name.
  useRefreshOn(['follows', 'people'], load);

  const ready = state.for === key;
  return { profile: ready ? state.profile : null, communities: ready ? state.communities : [], posts: ready ? state.posts : [], loading: Boolean(uid) && !ready, error: ready ? state.error : null, reload: load, signedIn: Boolean(uid) };
}

// One request per person at a time: a double tap never sends two.
const inFlight = new Map<string, Promise<void>>();

/** Follow or unfollow; resolves once the server has recorded it (never shown as done before). */
export function setFollow(userId: string, on: boolean): Promise<void> {
  const k = `${userId}|${on}`;
  const running = inFlight.get(k);
  if (running) return running;
  const p = (async () => {
    const { error } = await sb().rpc(on ? 'follow_user' : 'unfollow_user', { p_user: userId });
    if (error) throw new Error(/fetch|network/i.test(error.message) ? 'No connection: try again' : error.message);
    changed('follows');
  })().finally(() => inFlight.delete(k));
  inFlight.set(k, p);
  return p;
}

/** Followers or following of a member (empty when their profile is hidden from you). */
export function useFollowList(userId: string, which: 'followers' | 'following') {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ for: string; people: FollowPerson[]; error: string | null }>({ for: '', people: [], error: null });
  const key = `${uid}|${userId}|${which}`;
  const load = useCallback(() => {
    if (!supabase || !uid) return;
    sb()
      .rpc('follow_list', { p_user: userId, p_which: which })
      .then(({ data, error }) => {
        if (error) {
          setState({ for: key, people: [], error: error.message });
          return;
        }
        setState({
          for: key,
          error: null,
          people: ((data as { id: string; first_name: string; photo_path: string | null; i_follow: boolean }[] | null) ?? []).map((r) => ({ id: r.id, firstName: r.first_name, photo: r.photo_path, iFollow: r.i_follow })),
        });
      });
  }, [uid, userId, which, key]);
  useEffect(load, [load]);
  useRefreshOn(['follows', 'people'], load);
  const ready = state.for === key;
  return { people: ready ? state.people : [], loading: Boolean(uid) && !ready, error: ready ? state.error : null, reload: load, me: uid };
}

/** Opens (or reuses) the private chat with a member; the server checks they accept it. */
export async function openDirect(userId: string): Promise<string> {
  const { data, error } = await sb().rpc('open_direct', { p_user: userId });
  if (error) throw new Error(/not accept/i.test(error.message) ? 'This member does not accept new messages from you' : error.message);
  changed('inbox');
  return data as string;
}
