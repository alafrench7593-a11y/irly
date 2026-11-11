import { useAppSpace } from '@/state/appSpace';
import { rpcInSpace } from '@/features/universe/spaceRpc';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '@/features/auth/account';
import { changed, useRefreshOn } from '@/features/server/sync';
import { friendlyError, supabase } from '@/lib/supabase';
import { askPushInContext } from '@/features/push/push';
import { displayCommunityName } from '@/features/community/name';
import { universeInSpace, universeOf, type Universe } from '@/features/universe/universe';
import type { AppSpace } from '@/state/appSpace';

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
  /** Friends = you follow each other (the server keeps it so); 'outgoing' / 'incoming': an older app's request. */
  friendStatus: FriendStatus;
  /** Unique @username, if the member chose one. */
  username: string | null;
  /** Friends (mutual follows), counted on the server; not shown (only followers and following are). */
  friends: number;
};

export type FriendStatus = 'none' | 'outgoing' | 'incoming' | 'friends';

/** A post on a profile: in a community, or on the profile itself (communityId null). */
export type MemberPost = { id: string; body: string; at: number; communityId: string | null; communityName: string };
/**
 * A community on a profile (member_communities: only those the viewer may
 * see). `topic` and `categoryId` pick IRLY's photo when it has none of its
 * own; `retired`: no longer in the lists (shown on your own profile only).
 */
export type MemberCommunity = {
  id: string;
  name: string;
  cityId: string;
  cover: string | null;
  members: number;
  tagline: string | null;
  role: 'created' | 'joined';
  official: boolean;
  topic: string | null;
  categoryId: string | null;
  retired: boolean;
  girlOnly?: boolean;
  /** Mixte, Girl, Mom or Network (features/universe): which app space lists it (unknown: every space). */
  universe?: Universe;
};
type CommunityRow = {
  id: string;
  name: string;
  city_id: string;
  cover_path: string | null;
  members: number;
  tagline: string | null;
  role: 'created' | 'joined' | null;
  official?: boolean | null;
  topic?: string | null;
  category_id?: string | null;
  retired?: boolean | null;
  girl_only?: boolean | null;
};
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
  // Her communities in this app space only, on the server (20261110700000): her Girl and Mom ones never show in Mixte.
  const space = useAppSpace();
  const key = `${uid}|${userId}|${space}`;

  const load = useCallback(() => {
    if (!supabase || !uid) return;
    const n = ++seq.current;
    Promise.all([sb().rpc('public_profile', { p_user: userId }), rpcInSpace(sb(), 'member_communities', { p_user: userId }, space)])
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
          communities: ((c.data as CommunityRow[] | null) ?? []).map((x) => ({
            id: x.id,
            name: displayCommunityName({ name: x.name, topic: x.topic ?? null, category_id: x.category_id ?? null, city_id: x.city_id }),
            cityId: x.city_id,
            cover: x.cover_path,
            members: x.members,
            tagline: x.tagline ?? null,
            role: x.role === 'created' ? 'created' : 'joined',
            official: Boolean(x.official),
            topic: x.topic ?? null,
            categoryId: x.category_id ?? null,
            retired: Boolean(x.retired),
            girlOnly: Boolean(x.girl_only),
            universe: universeOf({ girlOnly: Boolean(x.girl_only), topic: x.topic ?? null, categoryId: x.category_id ?? null }),
          })),
        });
      })
      .catch((e) => {
        if (n !== seq.current) return;
        const error = /fetch|network/i.test(String(e)) ? 'Can’t reach IRLY right now' : e instanceof Error ? e.message : 'Could not load';
        // What is kept under the error is this person's own (a refresh that failed), never the previous person's.
        setState((s) => (s.for === key ? { ...s, error } : { for: key, profile: null, communities: [], posts: [], error }));
      });
  }, [uid, userId, key, space]);

  useEffect(() => {
    load();
    return () => {
      seq.current += 1;
    };
  }, [load]);
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
    if (error) throw new Error(friendlyError(error.message));
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
    // A request sent: the moment a notification for the answer makes sense.
    if (action === 'add') void askPushInContext();
    return action === 'remove' ? 'none' : data === 'accepted' ? 'friends' : 'outgoing';
  })().finally(() => inFlight.delete(k));
  inFlight.set(k, p as unknown as Promise<void>);
  return p;
}

function friendError(m: string): string {
  if (/did not answer|abort|fetch|network|JWT|token is expired|sign in required/i.test(m)) return friendlyError(m);
  if (/not available/i.test(m)) return 'This member is not available';
  if (/that is you/i.test(m)) return 'This is your own profile';
  return m;
}

/** Followers or following of a member (empty when their profile is hidden from you). */
export function useFollowList(userId: string, which: 'followers' | 'following') {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ for: string; people: FollowPerson[]; error: string | null }>({ for: '', people: [], error: null });
  const key = `${uid}|${userId}|${which}`;
  // Loads can overlap (a follow, then its sync bump): only the newest one started lands.
  const seq = useRef(0);
  const load = useCallback(() => {
    if (!supabase || !uid) return;
    const n = ++seq.current;
    sb()
      .rpc('follow_list', { p_user: userId, p_which: which })
      .then(({ data, error }) => {
        if (n !== seq.current) return;
        if (error) {
          // A failed refresh keeps the list on screen; a first load says it failed (never a spinner forever).
          setState((s) => (s.for === key ? { ...s, error: error.message } : { for: key, people: [], error: error.message }));
          return;
        }
        setState({
          for: key,
          error: null,
          people: ((data as { id: string; first_name: string; photo_path: string | null; i_follow: boolean }[] | null) ?? []).map((r) => ({ id: r.id, firstName: r.first_name, photo: r.photo_path, iFollow: r.i_follow })),
        });
      })
      .then(undefined, (e: unknown) => n === seq.current && setState((s) => ({ ...s, for: key, error: netError(e) })));
  }, [uid, userId, which, key]);
  useEffect(() => {
    load();
    return () => {
      seq.current += 1;
    };
  }, [load]);
  useRefreshOn(['follows', 'people', 'friends'], load);
  const ready = state.for === key;
  return { people: ready ? state.people : [], loading: Boolean(uid) && !ready, error: ready ? state.error : null, reload: load, me: uid };
}

/** Opens (or reuses) the private chat with a member; the server checks they accept it. */
export async function openDirect(userId: string): Promise<string> {
  const { data, error } = await sb().rpc('open_direct', { p_user: userId });
  if (error) throw new Error(/not accept/i.test(error.message) ? 'This member does not accept new messages from you' : error.message);
  // No inbox reload here: an existing chat has not changed, and a new one arrives
  // through the membership signal (it reloaded every inbox on screen while the chat opened).
  return data as string;
}

/* ───────── Profile tabs: posts, lives, activities (server, as the viewer may see them) ───────── */

export type ProfilePost = MemberPost & { universe: Universe | null; girlOnly: boolean; likes: number; comments: number; liked: boolean; media: string | null; mediaPaths: string[]; mediaKind: 'photo' | 'video' | null; thumbPath: string | null; mediaSeconds: number | null; edited: boolean };
export type ProfileLive = { id: string; body: string; media: string | null; video: boolean; poster: string | null; seconds: number | null; areaId: string; placeName: string | null; at: number; expiresAt: number; live: boolean };
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
  /** The activity's universe (server: private.activity_universe); null from an older server. */
  universe: Universe | null;
  girlOnly: boolean;
};

const PAGE = 20;
type PostCommunity = { name: string; topic?: string | null; category_id?: string | null; girl_only?: boolean | null };
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
        .select('id, body, media_path, media_paths, media_kind, thumb_path, media_seconds, edited_at, created_at, community_id, communities(name, topic, category_id, girl_only)')
        .eq('author_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(PAGE);
      if (before) q = q.lt('created_at', before);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows =
        (data as
          | {
              id: string;
              body: string;
              media_path: string | null;
              media_paths: string[] | null;
              media_kind: 'photo' | 'video' | null;
              thumb_path: string | null;
              media_seconds: number | null;
              edited_at: string | null;
              created_at: string;
              community_id: string | null;
              communities: PostCommunity | PostCommunity[] | null;
            }[]
          | null) ?? [];
      const counts = rows.length ? await sb().rpc('engagement', { p_type: 'community_post', p_ids: rows.map((r) => r.id) }) : { data: [] };
      const by = new Map(((counts.data as { target_id: string; likes: number; comments: number; liked: boolean }[] | null) ?? []).map((c) => [c.target_id, c]));
      return rows.map((x) => {
        const c = Array.isArray(x.communities) ? (x.communities[0] ?? null) : x.communities;
        return {
        id: x.id,
        body: x.body,
        media: x.media_path,
        mediaPaths: x.media_paths ?? [],
        mediaKind: x.media_kind,
        thumbPath: x.thumb_path,
        mediaSeconds: x.media_seconds,
        edited: Boolean(x.edited_at),
        at: Date.parse(x.created_at),
        communityId: x.community_id,
        communityName: x.community_id ? displayCommunityName(c) : '',
        // A post on the profile itself belongs to no universe: every app space shows it.
        universe: c ? universeOf({ girlOnly: Boolean(c.girl_only), topic: c.topic ?? null, categoryId: c.category_id ?? null }) : null,
        girlOnly: Boolean(c?.girl_only),
        likes: by.get(x.id)?.likes ?? 0,
        comments: by.get(x.id)?.comments ?? 0,
        liked: by.get(x.id)?.liked ?? false,
        };
      });
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
  useEffect(() => {
    load();
    return () => {
      seq.current += 1;
    };
  }, [load]);
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
function useProfileRpc<R, T>(fn: string, userId: string, map: (r: R) => T, kinds: Parameters<typeof useRefreshOn>[0], enabled: boolean, extra?: Record<string, string>) {
  const uid = useAccount()?.userId;
  const extraKey = extra ? JSON.stringify(extra) : '';
  const key = `${uid}|${userId}|${extraKey}`;
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
      .rpc(fn, { p_user: userId, ...(extraKey ? (JSON.parse(extraKey) as Record<string, string>) : {}) })
      .then(({ data, error }) => {
        if (n !== seq.current) return;
        if (error) setState((s) => ({ ...s, for: key, error: netError(error.message) }));
        else setState({ for: key, items: ((data as R[] | null) ?? []).map((r) => mapRef.current(r)), error: null });
      })
      // Lost on the way: said, never a spinner forever.
      .then(undefined, (e: unknown) => n === seq.current && setState((s) => ({ ...s, for: key, error: netError(e) })));
  }, [uid, key, userId, fn, enabled, extraKey]);
  useEffect(() => {
    load();
    return () => {
      seq.current += 1;
    };
  }, [load]);
  useRefreshOn(kinds, load);
  const ready = state.for === key;
  return { items: ready ? state.items : [], loading: Boolean(uid) && enabled && !ready, error: ready ? state.error : null, reload: load };
}

type ActivityRow = { id: string; title: string; category_id: string; city_id: string; area_id: string; place_name: string | null; starts_at: string; ends_at: string | null; cover_path: string | null; going: number; role: 'created' | 'joined'; state: ProfileActivity['state']; universe?: Universe | null; girl_only?: boolean | null };
type LiveRow = { id: string; body: string; media_path: string | null; area_id: string; place_name: string | null; created_at: string; expires_at: string; live: boolean; media_kind?: string | null; thumb_path?: string | null; media_seconds?: number | null };

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
      universe: r.universe ?? null,
      girlOnly: Boolean(r.girl_only),
    }),
    ['activities'],
    enabled,
  );

/** Their IRL posts of this space (IRLY or IRLY Girl): live ones in their audience; the author also sees past ones. */
export const useMemberLives = (userId: string, enabled = true) => {
  const scope = useAppSpace() === 'girl' ? 'irly_girl' : 'irly';
  return useProfileRpc<LiveRow, ProfileLive>(
    'member_lives',
    userId,
    (r) => ({ id: r.id, body: r.body, media: r.media_path, video: r.media_kind === 'video', poster: r.thumb_path ?? null, seconds: r.media_seconds ?? null, areaId: r.area_id, placeName: r.place_name, at: Date.parse(r.created_at), expiresAt: Date.parse(r.expires_at), live: r.live }),
    ['friends', 'people'],
    enabled,
    { p_scope: scope },
  );
};

/**
 * Whether a profile item shows in this app space (Mixte + Network, or IRLY
 * Girl + Mom + Network). An item without universe (a post on the profile
 * itself, a row from an older server) shows in every space. Display only:
 * the member's data stays as it is.
 */
export const inSpace = (x: { universe: Universe | null; girlOnly: boolean }, space: AppSpace) => x.universe === null || universeInSpace(x.universe, x.girlOnly, space);
