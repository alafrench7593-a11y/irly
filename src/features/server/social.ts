import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CityId } from '@/data/types';
import { useCityFilter } from './scope';
import { create } from 'zustand';
import { NONE } from '@/lib/none';
import { useAccount } from '@/features/auth/account';
import { friendlyError, supabase, topic } from '@/lib/supabase';
import { changed, useRefreshOn, useSyncVersion } from './sync';
import { cleanImage } from '@/lib/media';
import { uploadLiveFile, type LiveMedia } from '@/features/live/liveMedia';

/**
 * IRL posts, friends and notifications on the server (signed in), live
 * over Realtime. Signed out, these return nothing and the app keeps its
 * on-device experience.
 */

export type ServerIrlPost = {
  id: string;
  authorId: string;
  firstName: string;
  areaId: string;
  placeName: string | null;
  body: string;
  mediaUrl: string | null;
  visibility: 'everyone' | 'friends';
  createdAt: number;
  friend: boolean;
  mine: boolean;
  activityId: string | null;
  activityTitle: string | null;
  /** 'photo' or 'video'; a video's poster image (never the video itself until played) and length. */
  mediaKind?: 'photo' | 'video';
  posterUrl?: string | null;
  seconds?: number | null;
  /** Its emirate: the feed covers the whole destination. */
  cityId: string | null;
};

type FeedRow = {
  id: string;
  author_id: string;
  first_name: string;
  area_id: string;
  place_name: string | null;
  body: string;
  media_path: string | null;
  visibility: 'everyone' | 'friends';
  created_at: string;
  friend: boolean;
  activity_id?: string | null;
  activity_title?: string | null;
  media_kind?: 'photo' | 'video' | null;
  thumb_path?: string | null;
  media_seconds?: number | null;
};

/** Every photo of a feed signed in ONE request (was one request per photo). */
async function signedAll(paths: (string | null)[]): Promise<Record<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (!wanted.length || !supabase) return {};
  const { data } = await supabase.storage.from('irl-media').createSignedUrls(wanted, 4 * 3600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

/** Bumped after your own post or removal: every IRL feed reloads at once, without waiting for Realtime. */
const useIrlVersion = create<{ n: number }>(() => ({ n: 0 }));
const bumpIrl = () => useIrlVersion.setState((s) => ({ n: s.n + 1 }));

/**
 * Your own posts, shown the moment the server accepts them (with the photo
 * already on the phone), until the feed's next load includes them.
 */
const useIrlMine = create<{ posts: ServerIrlPost[] }>(() => ({ posts: [] }));
/** Last feed loaded per city: coming back to the tab shows it at once, never an empty screen. */
const irlCache = new Map<string, ServerIrlPost[]>();

export function useServerIrl(cityId: string): { posts: ServerIrlPost[]; refresh: () => void } {
  const account = useAccount();
  const uid = account?.userId;
  const key = `${uid ?? ''}:${cityId}`;
  const [posts, setPostsState] = useState<ServerIrlPost[]>(() => irlCache.get(key) ?? []);
  // Loads can overlap (Realtime, your own post, focus): only the latest one
  // started may write, so an older, slower answer never hides a newer post.
  const seq = useRef(0);
  const setPosts = useCallback(
    (p: ServerIrlPost[]) => {
      irlCache.set(key, p);
      setPostsState(p);
      // Confirmed by the server: from now on the feed alone decides (expiry, removal).
      const ids = new Set(p.map((x) => x.id));
      if (useIrlMine.getState().posts.some((x) => ids.has(x.id))) useIrlMine.setState((s) => ({ posts: s.posts.filter((x) => !ids.has(x.id)) }));
    },
    [key],
  );

  const load = useCallback(async (): Promise<ServerIrlPost[]> => {
    if (!supabase || !uid) return [];
    const { data, error } = await supabase.rpc('irl_feed', { p_city: cityId });
    if (error) throw new Error(error.message);
    const rows = (data as FeedRow[]) ?? [];
    const links = await signedAll(rows.flatMap((r) => [r.media_path, r.thumb_path ?? null]));
    return rows.map((r) => ({
        id: r.id,
        authorId: r.author_id,
        firstName: r.first_name,
        areaId: r.area_id,
        placeName: r.place_name,
        body: r.body,
        mediaUrl: r.media_path ? (links[r.media_path] ?? null) : null,
        visibility: r.visibility,
        createdAt: Date.parse(r.created_at),
        friend: r.friend,
        mine: r.author_id === uid,
        activityId: r.activity_id ?? null,
        activityTitle: r.activity_title ?? null,
        mediaKind: r.media_path ? (r.media_kind === 'video' ? 'video' : 'photo') : undefined,
        posterUrl: r.thumb_path ? (links[r.thumb_path] ?? null) : null,
        seconds: r.media_seconds ?? null,
        cityId: (r as { city_id?: string }).city_id ?? null,
      }));
  }, [cityId, uid]);

  /** Loads and applies the result if no newer load started meanwhile. On error, what is shown stays. */
  const reload = useCallback(
    (alive: () => boolean = () => true) => {
      const n = ++seq.current;
      load()
        .then((p) => {
          if (alive() && n === seq.current) setPosts(p);
        })
        .catch(() => undefined);
    },
    [load, setPosts],
  );
  const refresh = useCallback(() => reload(), [reload]);

  const version = useIrlVersion((s) => s.n);
  useEffect(() => {
    if (version) refresh();
  }, [version, refresh]);

  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    const isAlive = () => alive;
    reload(isAlive);
    const channel = supabase
      .channel(topic(`irl-${cityId}-${uid}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'irl_posts', filter: `city_id=eq.${cityId}` }, () => reload(isAlive))
      // Realtime cannot filter DELETE events (the old row only has its id): listen unfiltered.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'irl_posts' }, () => reload(isAlive))
      .subscribe();
    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [cityId, uid, reload]);

  const { keep } = useCityFilter(cityId as CityId);
  const mine = useIrlMine((s) => s.posts);
  const shown = useMemo(() => {
    const ids = new Set(posts.map((p) => p.id));
    const fresh = mine.filter((p) => !ids.has(p.id) && (p.cityId === cityId || keep(p.cityId)));
    return [...fresh, ...posts.filter((p) => keep(p.cityId))];
  }, [posts, mine, keep, cityId]);
  return { posts: uid ? shown : NONE, refresh };
}

/** Post what you're doing right now. Photo goes to the member's own folder. */
export async function postServerIrl(input: {
  cityId: string;
  areaId: string;
  placeName?: string;
  body: string;
  photoUri?: string;
  /** A photo or a video (with its poster); wins over photoUri. */
  media?: LiveMedia;
  /** Upload progress of a video, 0 → 1. */
  onProgress?: (p: number) => void;
  /** Left out: the member's IRL visibility setting applies (server default). */
  visibility?: 'everyone' | 'friends';
  /** IRL → activity: the post points at the activity, never a copy of it. */
  activityId?: string | null;
}): Promise<boolean> {
  if (!supabase) return false;
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return false;
  let media_path: string | null = null;
  let thumb_path: string | null = null;
  const media: LiveMedia | undefined = input.media ?? (input.photoUri ? { kind: 'photo', uri: input.photoUri } : undefined);
  const stamp = Date.now();
  if (media?.kind === 'photo') {
    const img = await cleanImage(media.uri);
    media_path = `${uid}/${stamp}.${img.ext}`;
    const { error } = await supabase.storage.from('irl-media').upload(media_path, img.body, { contentType: img.contentType });
    if (error) throw new Error(friendlyError(error.message));
  } else if (media?.kind === 'video') {
    const ext = media.type === 'video/quicktime' ? 'mov' : 'mp4';
    if (media.poster) {
      const img = await cleanImage(media.poster);
      thumb_path = `${uid}/${stamp}-poster.${img.ext}`;
      const { error } = await supabase.storage.from('irl-media').upload(thumb_path, img.body, { contentType: img.contentType });
      if (error) thumb_path = null; // The video still goes; the feed shows a plain tile.
    }
    media_path = `${uid}/${stamp}.${ext}`;
    try {
      await uploadLiveFile(media_path, media.uri, media.type ?? 'video/mp4', input.onProgress);
    } catch (e) {
      if (thumb_path) await supabase.storage.from('irl-media').remove([thumb_path]);
      throw e;
    }
  }
  const { data: row, error } = await supabase.from('irl_posts').insert({
    author_id: uid,
    city_id: input.cityId,
    area_id: input.areaId,
    place_name: input.placeName ?? null,
    body: input.body,
    media_path,
    ...(media ? { media_kind: media.kind } : {}),
    ...(thumb_path ? { thumb_path } : {}),
    ...(media?.seconds !== undefined ? { media_seconds: Math.min(120, media.seconds) } : {}),
    ...(input.visibility ? { visibility: input.visibility } : {}),
    activity_id: input.activityId ?? null,
  }).select('id, created_at, visibility').single();
  if (error) {
    // The post was refused: its files must not stay behind.
    const files = [media_path, thumb_path].filter((x): x is string => Boolean(x));
    if (files.length) await supabase.storage.from('irl-media').remove(files);
    throw new Error(friendlyError(error.message));
  }
  // On screen at once, with the photo already on the phone; the reload confirms it.
  useIrlMine.setState((s) => ({
    posts: [
      {
        id: row.id,
        authorId: uid,
        firstName: '',
        areaId: input.areaId,
        placeName: input.placeName ?? null,
        body: input.body,
        mediaUrl: media?.uri ?? null,
        mediaKind: media?.kind,
        posterUrl: media?.poster ?? null,
        seconds: media?.seconds ?? null,
        visibility: row.visibility,
        createdAt: Date.parse(row.created_at),
        friend: false,
        mine: true,
        activityId: input.activityId ?? null,
        activityTitle: null,
        cityId: input.cityId,
      },
      // Live posts last 4 hours: older ones are dropped here.
      ...s.posts.filter((p) => p.createdAt > Date.now() - 4 * 3600 * 1000),
    ].slice(0, 20),
  }));
  bumpIrl();
  return true;
}

export async function deleteServerIrl(id: string): Promise<void> {
  if (!supabase) return;
  const { data: row } = await supabase.from('irl_posts').select('media_path, thumb_path').eq('id', id).maybeSingle();
  const { error } = await supabase.from('irl_posts').delete().eq('id', id);
  if (error) throw new Error(friendlyError(error.message));
  // Its photo or video (and poster) go with it.
  const files = [row?.media_path, row?.thumb_path].filter((x): x is string => Boolean(x));
  if (files.length) await supabase.storage.from('irl-media').remove(files).catch(() => undefined);
  useIrlMine.setState((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));
  bumpIrl();
}

/** Corrects the text of my Live while it is on (the author only). */
export async function editServerIrl(id: string, body: string): Promise<void> {
  if (!supabase) return;
  const text = body.trim();
  if (!text) throw new Error('Write something');
  const { error } = await supabase.rpc('edit_live_post', { p_id: id, p_body: text.slice(0, 160) });
  if (error) throw new Error(friendlyError(error.message));
  bumpIrl();
}

/* ───────────────────────── Friends ───────────────────────── */

export type Friend = { userId: string; firstName: string; status: 'pending' | 'accepted'; incoming: boolean };

export function useFriends(): { friends: Friend[]; refresh: () => void } {
  const account = useAccount();
  const uid = account?.userId;
  const [friends, setFriends] = useState<Friend[]>([]);
  const load = useCallback(async (): Promise<Friend[]> => {
    if (!supabase || !uid) return [];
    const { data, error } = await supabase.rpc('my_friends');
    if (error) throw new Error(error.message);
    return ((data as { user_id: string; first_name: string; status: Friend['status']; incoming: boolean }[]) ?? []).map((r) => ({
      userId: r.user_id,
      firstName: r.first_name,
      status: r.status,
      incoming: r.incoming,
    }));
  }, [uid]);
  const refresh = useCallback(() => {
    load().then(setFriends).catch(() => undefined);
  }, [load]);
  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    load().then((f) => alive && setFriends(f)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [uid, load]);
  // Requests and friendships change through the app's one realtime channel (SyncBridge).
  useRefreshOn(['friends'], refresh);
  return { friends: uid ? friends : NONE, refresh };
}

/** Sends a request, or accepts one. Returns 'pending' or 'accepted'. */
export async function addFriend(userId: string): Promise<string> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { data, error } = await supabase.rpc('add_friend', { p_user: userId });
  if (error) throw new Error(friendlyError(error.message));
  changed('friends', 'notifs');
  return data as string;
}

export async function removeFriend(userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('remove_friend', { p_user: userId });
  if (error) throw new Error(error.message);
  changed('friends', 'notifs');
}

/* ───────────────────────── Notifications ───────────────────────── */

export type ServerNotification = { id: string; kind: string; payload: Record<string, string>; readAt: number | null; createdAt: number };

/** Bumped when notifications are marked read: the header badge and the list stay in step. */
const useNotifVersion = create<{ n: number }>(() => ({ n: 0 }));

export function useServerNotifications(): { items: ServerNotification[]; unread: number; markAllRead: () => void } {
  const account = useAccount();
  const uid = account?.userId;
  const [items, setItems] = useState<ServerNotification[]>([]);
  const load = useCallback(async (): Promise<ServerNotification[]> => {
    if (!supabase || !uid) return [];
    const { data, error } = await supabase.from('notifications').select('id, kind, payload, read_at, created_at').order('created_at', { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((n) => ({
      id: n.id,
      kind: n.kind,
      payload: n.payload ?? {},
      readAt: n.read_at ? Date.parse(n.read_at) : null,
      createdAt: Date.parse(n.created_at),
    }));
  }, [uid]);
  const version = useNotifVersion((s) => s.n) + useSyncVersion('notifs');
  useEffect(() => {
    if (!version) return;
    let alive = true;
    load().then((n) => alive && setItems(n)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [version, load]);
  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    load().then((n) => alive && setItems(n)).catch(() => undefined);
    // New ones, and ones read elsewhere (another phone, a chat opened), arrive
    // through the app's sync channel ('notifs'): one reload per change, not two.
    return () => {
      alive = false;
    };
  }, [uid, load]);
  const markAllRead = useCallback(() => {
    if (!supabase || !uid) return;
    const now = new Date().toISOString();
    supabase
      .from('notifications')
      .update({ read_at: now })
      .is('read_at', null)
      .then(({ error }) => {
        if (error) return;
        setItems((list) => list.map((n) => (n.readAt ? n : { ...n, readAt: Date.parse(now) })));
        useNotifVersion.setState((s) => ({ n: s.n + 1 }));
      });
  }, [uid]);
  const list = uid ? items : NONE;
  // Messages have their own badge (the chat icon): the bell never counts them twice.
  return { items: list, unread: list.filter((n) => !n.readAt && n.kind !== 'MESSAGE_CREATED').length, markAllRead };
}

/** Unread notifications (the bell badge), fed once by <BellSync /> for every header. */
export const useServerBell = create<{ n: number }>(() => ({ n: 0 }));

/**
 * Mounted once at the root. Every tab keeps its header mounted: a bell hook
 * in each header opened one Realtime channel and one reload per tab for every
 * notification. Now there is one, and the headers read its count.
 */
export function BellSync() {
  const { unread } = useServerNotifications();
  useEffect(() => {
    useServerBell.setState({ n: unread });
  }, [unread]);
  return null;
}
