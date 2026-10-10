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
  /** Where your friendship stands, from the server: none, sent by you, waiting for you, or friends. */
  friendStatus: FriendStatus;
  /** Unique @username, if the member chose one. */
  username: string | null;
  /** Accepted friendships, counted on the server. */
  friends: number;
};

export type FriendStatus = 'none' | 'outgoing' | 'incoming' | 'friends';

export type MemberPost = { id: string; body: string; at: number; communityId: string; communityName: string };
export type MemberCommunity = { id: string; name: string; cityId: string; cover: string | null; members: number; tagline: string | null; role: 'created' | 'joined' };
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
  friend_status: FriendStatus | null;
  username: string | null;
  friends: number | null;
};

export function useMemberProfile(userId: string) {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ for: string; profile: MemberProfile | null; communities: MemberCommunity[]; posts: MemberPost[]; error: string | null }>({ for: '', profile: null, communities: [], posts: [], error: null });
  const seq = useRef(0);
  const key = `${uid}|${userId}`;

  const load = useCallback(() => {
    if (!supabase || !uid) return;
    const n = ++seq.current;
    Promise.all([sb().rpc('public_profile', { p_user: userId }), sb().rpc('member_communities', { p_user: userId })])
      .then(([p, c]) => {
        if (n !== seq.current) return;
        if (p.error) throw new Error(p.error.message);
        const r = ((p.data as Row[] | null) ?? [])[0];
        setState({
          for: key,
          error: null,
          posts: [],
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
                friendStatus: r.friend_status ?? 'none',
                username: r.username ?? null,
                friends: r.friends ?? 0,
              }
            : null,
          communities: ((c.data as { id: string; name: string; city_id: string; cover_path: string | null; members: number; tagline: string | null; role: 'created' | 'joined' | null }[] | null) ?? []).map((x) => ({
            id: x.id,
            name: x.name,
            cityId: x.city_id,
            cover: x.cover_path,
            members: x.members,
            tagline: x.tagline ?? null,
            role: x.role === 'created' ? 'created' : 'joined',
          })),
        });
      })
      .catch((e) => n === seq.current && setState((s) => ({ ...s, for: key, error: /fetch|network/i.test(String(e)) ? 'Can’t reach IRLY right now' : e instanceof Error ? e.message : 'Could not load' })));
  }, [uid, userId, key]);

  useEffect(load, [load]);
  // A follow anywhere (yours, theirs, on another device), a new photo or name.
  useRefreshOn(['follows', 'people', 'friends', 'communities'], load);

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

/**
 * Friend request, acceptance, withdrawal or unfriending. Resolves once the
 * server has recorded it (never shown as done before); a double tap sends
 * one request. `add` asks, or accepts a request waiting for you; `remove`
 * withdraws, declines or unfriends.
 */
export function setFriend(userId: string, action: 'add' | 'remove'): Promise<FriendStatus> {
  const k = `friend|${userId}|${action}`;
  const running = inFlight.get(k) as Promise<FriendStatus> | undefined;
  if (running) return running;
  const p = (async (): Promise<FriendStatus> => {
    const { data, error } = await sb().rpc(action === 'add' ? 'add_friend' : 'remove_friend', { p_user: userId });
    if (error) throw new Error(friendError(error.message));
    changed('friends', 'notifs', 'inbox');
    return action === 'remove' ? 'none' : data === 'accepted' ? 'friends' : 'outgoing';
  })().finally(() => inFlight.delete(k));
  inFlight.set(k, p as unknown as Promise<void>);
  return p;
}

function friendError(m: string): string {
  if (/fetch|network/i.test(m)) return 'No connection: try again';
  if (/sign in|JWT|token/i.test(m)) return 'Your session has ended. Sign in again';
  if (/not available/i.test(m)) return 'This member is not available';
  if (/that is you/i.test(m)) return 'This is your own profile';
  return m;
}

/** Followers or following of a member (empty when their profile is hidden from you). */
export function useFollowList(userId: string, which: 'followers' | 'following' | 'friends') {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ for: string; people: FollowPerson[]; error: string | null }>({ for: '', people: [], error: null });
  const key = `${uid}|${userId}|${which}`;
  const load = useCallback(() => {
    if (!supabase || !uid) return;
    (which === 'friends' ? sb().rpc('friend_list', { p_user: userId }) : sb().rpc('follow_list', { p_user: userId, p_which: which }))
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
  useRefreshOn(['follows', 'people', 'friends'], load);
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

/* ───────── Profile tabs: posts, lives, activities (server, as the viewer may see them) ───────── */

export type ProfilePost = MemberPost & { likes: number; comments: number; liked: boolean; media: string | null };
export type ProfileLive = { id: string; body: string; media: string | null; areaId: string; placeName: string | null; at: number; expiresAt: number; live: boolean };
export type ProfileActivity = {
  id: string;
  title: string;
  categoryId: string;
  cityId: string;
  areaId: string;
  placeName: string | null;
  startsAt: number;
  endsAt: number | null;
  cover: string | null;
  going: number;
  role: 'created' | 'joined';
  state: 'upcoming' | 'live' | 'past' | 'cancelled';
};

const PAGE = 20;
const netError = (e: unknown) => (/fetch|network/i.test(String(e)) ? 'Can’t reach IRLY right now' : e instanceof Error ? e.message : 'Could not load');

/**
 * A member's community posts, newest first, 20 at a time ("more" loads the
 * next page). The community read rules decide what the viewer may see;
 * likes and comments come from the same counts as everywhere else.
 */
export function useMemberPosts(userId: string, enabled = true) {
  const uid = useAccount()?.userId;
  const key = `${uid}|${userId}`;
  const [state, setState] = useState<{ for: string; items: ProfilePost[]; done: boolean; error: string | null; loadingMore: boolean }>({ for: '', items: [], done: false, error: null, loadingMore: false });
  const seq = useRef(0);
  const fetchPage = useCallback(
    async (before: string | null): Promise<ProfilePost[]> => {
      let q = sb()
        .from('community_posts')
        .select('id, body, media_path, created_at, community_id, communities(name)')
        .eq('author_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(PAGE);
      if (before) q = q.lt('created_at', before);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = (data as { id: string; body: string; media_path: string | null; created_at: string; community_id: string; communities: { name: string } | { name: string }[] | null }[] | null) ?? [];
      const counts = rows.length ? await sb().rpc('engagement', { p_type: 'community_post', p_ids: rows.map((r) => r.id) }) : { data: [] };
      const by = new Map(((counts.data as { target_id: string; likes: number; comments: number; liked: boolean }[] | null) ?? []).map((c) => [c.target_id, c]));
      return rows.map((x) => ({
        id: x.id,
        body: x.body,
        media: x.media_path,
        at: Date.parse(x.created_at),
        communityId: x.community_id,
        communityName: (Array.isArray(x.communities) ? x.communities[0]?.name : x.communities?.name) ?? '',
        likes: by.get(x.id)?.likes ?? 0,
        comments: by.get(x.id)?.comments ?? 0,
        liked: by.get(x.id)?.liked ?? false,
      }));
    },
    [userId],
  );
  const load = useCallback(() => {
    if (!supabase || !uid || !enabled) return;
    const n = ++seq.current;
    fetchPage(null)
      .then((items) => n === seq.current && setState({ for: key, items, done: items.length < PAGE, error: null, loadingMore: false }))
      .catch((e) => n === seq.current && setState((s) => ({ ...s, for: key, error: netError(e), loadingMore: false })));
  }, [uid, key, enabled, fetchPage]);
  useEffect(load, [load]);
  useRefreshOn(['communities', 'people'], load);
  const more = useCallback(() => {
    if (state.for !== key || state.done || state.loadingMore || !state.items.length) return;
    const n = seq.current;
    const last = new Date(state.items[state.items.length - 1].at).toISOString();
    setState((s) => ({ ...s, loadingMore: true }));
    fetchPage(last)
      .then((next) => n === seq.current && setState((s) => ({ ...s, items: [...s.items, ...next.filter((x) => !s.items.some((y) => y.id === x.id))], done: next.length < PAGE, loadingMore: false })))
      .catch((e) => n === seq.current && setState((s) => ({ ...s, error: netError(e), loadingMore: false })));
  }, [state, key, fetchPage]);
  const ready = state.for === key;
  return { items: ready ? state.items : [], loading: Boolean(uid) && enabled && !ready, error: ready ? state.error : null, done: ready ? state.done : false, loadingMore: state.loadingMore, more, reload: load };
}

/** Rows of a profile RPC, reloaded when its kinds of data change anywhere. */
function useProfileRpc<R, T>(fn: string, userId: string, map: (r: R) => T, kinds: Parameters<typeof useRefreshOn>[0], enabled: boolean) {
  const uid = useAccount()?.userId;
  const key = `${uid}|${userId}`;
  const [state, setState] = useState<{ for: string; items: T[]; error: string | null }>({ for: '', items: [], error: null });
  const seq = useRef(0);
  const mapRef = useRef(map);
  useEffect(() => {
    mapRef.current = map;
  });
  const load = useCallback(() => {
    if (!supabase || !uid || !enabled) return;
    const n = ++seq.current;
    sb()
      .rpc(fn, { p_user: userId })
      .then(({ data, error }) => {
        if (n !== seq.current) return;
        if (error) setState((s) => ({ ...s, for: key, error: netError(error.message) }));
        else setState({ for: key, items: ((data as R[] | null) ?? []).map((r) => mapRef.current(r)), error: null });
      });
  }, [uid, key, userId, fn, enabled]);
  useEffect(load, [load]);
  useRefreshOn(kinds, load);
  const ready = state.for === key;
  return { items: ready ? state.items : [], loading: Boolean(uid) && enabled && !ready, error: ready ? state.error : null, reload: load };
}

type ActivityRow = { id: string; title: string; category_id: string; city_id: string; area_id: string; place_name: string | null; starts_at: string; ends_at: string | null; cover_path: string | null; going: number; role: 'created' | 'joined'; state: ProfileActivity['state'] };
type LiveRow = { id: string; body: string; media_path: string | null; area_id: string; place_name: string | null; created_at: string; expires_at: string; live: boolean };

/** Activities a member created or joined (the activity rules and their activity visibility decide). */
export const useMemberActivities = (userId: string, enabled = true) =>
  useProfileRpc<ActivityRow, ProfileActivity>(
    'member_activities',
    userId,
    (r) => ({
      id: r.id,
      title: r.title,
      categoryId: r.category_id,
      cityId: r.city_id,
      areaId: r.area_id,
      placeName: r.place_name,
      startsAt: Date.parse(r.starts_at),
      endsAt: r.ends_at ? Date.parse(r.ends_at) : null,
      cover: r.cover_path,
      going: r.going,
      role: r.role,
      state: r.state,
    }),
    ['activities'],
    enabled,
  );

/** Their IRL posts: live ones in their audience; the author also sees past ones. */
export const useMemberLives = (userId: string, enabled = true) =>
  useProfileRpc<LiveRow, ProfileLive>(
    'member_lives',
    userId,
    (r) => ({ id: r.id, body: r.body, media: r.media_path, areaId: r.area_id, placeName: r.place_name, at: Date.parse(r.created_at), expiresAt: Date.parse(r.expires_at), live: r.live }),
    ['friends', 'people'],
    enabled,
  );
