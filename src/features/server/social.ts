import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CityId } from '@/data/types';
import { useCityFilter } from './scope';
import { create } from 'zustand';
import { NONE } from '@/lib/none';
import { useAccount } from '@/features/auth/account';
import { friendlyError, supabase, topic } from '@/lib/supabase';
import { changed, useRefreshOn, useSyncVersion } from './sync';
import { signedLinks } from './media';
import { uuid } from '@/lib/uuid';
import { prepareLiveMedia, uploadLiveFile, type LiveMedia } from '@/features/live/liveMedia';
import { rememberRatio } from '@/features/live/liveRatio';
import { LIVE_TTL_MIN } from '@/features/live/liveStore';
import { useNow } from '@/lib/useNow';

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
  /** Width / height of the photo or video when already known on this phone (else read when it loads). */
  mediaRatio?: number | null;
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
  media_ratio?: number | null;
};

/**
 * Every photo of a feed signed in ONE request, through the shared link cache:
 * a reload keeps the same links, so photos and videos are not downloaded again.
 */
const signedAll = (paths: (string | null)[]): Promise<Record<string, string>> => signedLinks('irl-media', paths);

/** Bumped after your own post or removal: every IRL feed reloads at once, without waiting for Realtime. */
const useIrlVersion = create<{ n: number }>(() => ({ n: 0 }));
export const bumpIrl = () => useIrlVersion.setState((s) => ({ n: s.n + 1 }));

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
        // Stored with the post: the card has its size before the image arrives.
        mediaRatio: r.media_ratio ?? null,
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
  // The server ends a Live at expires_at (created_at + 4h by default) but
  // irl_feed does not return it and sends no event when it passes: drop
  // expired posts here too, so nobody likes or comments a gone Live.
  const now = useNow();
  const shown = useMemo(() => {
    const live = (p: ServerIrlPost) => now - p.createdAt < LIVE_TTL_MIN * 60_000;
    const ids = new Set(posts.map((p) => p.id));
    const fresh = mine.filter((p) => !ids.has(p.id) && (p.cityId === cityId || keep(p.cityId)) && live(p));
    return [...fresh, ...posts.filter((p) => keep(p.cityId) && live(p))];
  }, [posts, mine, keep, cityId, now]);
  return { posts: uid ? shown : NONE, refresh };
}

/** True when the file is already stored (a retry of an upload whose answer got lost). */
async function stored(path: string): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.storage.from('irl-media').exists(path);
  return Boolean(data);
}

/** Uploads one file of a Live; "already there" (our own earlier try, same path) counts as done. */
async function uploadIrlFile(path: string, uri: string, type: string, onProgress?: (p: number) => void): Promise<void> {
  try {
    await uploadLiveFile(path, uri, type, onProgress);
  } catch (e) {
    if (await stored(path).catch(() => false)) {
      onProgress?.(1);
      return;
    }
    throw new Error(friendlyError(e instanceof Error ? e.message : 'Upload failed'));
  }
}

/**
 * Post what you're doing right now. Files go to the member's own folder.
 *
 * Fast path: the photo (or the video's poster) was prepared when it was
 * picked (prepareLiveMedia); here the files are only uploaded, all at once
 * (video and poster in parallel, the activity created meanwhile), then the
 * row is inserted ONCE. The post shows in the feed from the server's answer
 * (the confirmed row), never before; no feed reload is needed.
 *
 * `id` makes a retry safe: the same id gives the same files and the same row,
 * so a post whose answer got lost is never published twice.
 */
export async function postServerIrl(input: {
  cityId: string;
  areaId: string;
  placeName?: string;
  body: string;
  photoUri?: string;
  /** A photo or a video (with its poster); wins over photoUri. */
  media?: LiveMedia;
  /** Upload progress, 0 → 1 (the video, or the photo). */
  onProgress?: (p: number) => void;
  /** Left out: the member's IRL visibility setting applies (server default). */
  visibility?: 'everyone' | 'friends';
  /** IRL → activity: the post points at the activity, never a copy of it. May still be being created. */
  activityId?: string | null | Promise<string | null>;
  /** The post's id, made on the phone (kept across retries of the same post). */
  id?: string;
}): Promise<boolean> {
  // Never a silent no-op: the composer would close as if the post were live.
  if (!supabase) throw new Error('The IRLY server is not configured');
  const sb = supabase;
  const { data: s } = await sb.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) throw new Error('Sign in to post');
  const id = input.id ?? uuid();
  const media: LiveMedia | undefined = input.media ?? (input.photoUri ? { kind: 'photo', uri: input.photoUri } : undefined);
  let media_path: string | null = null;
  let thumb_path: string | null = null;
  let shownUri: string | null = null;
  let posterUri: string | null = null;
  let ratio: number | undefined = media?.ratio;
  const uploads: Promise<unknown>[] = [];
  if (media?.kind === 'photo') {
    const prep = await prepareLiveMedia(media);
    if (!prep.image) throw new Error('Could not read this photo');
    ratio = prep.ratio ?? ratio;
    media_path = `${uid}/${id}.jpg`;
    shownUri = prep.image.uri;
    uploads.push(uploadIrlFile(media_path, prep.image.uri, 'image/jpeg', input.onProgress));
  } else if (media?.kind === 'video') {
    // The poster is best effort: without it the video still goes (the feed shows a plain tile).
    const prep = await prepareLiveMedia(media).catch(() => ({ image: undefined, ratio: media.ratio }));
    ratio = prep.ratio ?? ratio;
    const ext = media.type === 'video/quicktime' ? 'mov' : 'mp4';
    media_path = `${uid}/${id}.${ext}`;
    shownUri = media.uri;
    if (prep.image) {
      const poster = `${uid}/${id}-poster.jpg`;
      posterUri = prep.image.uri;
      uploads.push(
        uploadIrlFile(poster, prep.image.uri, 'image/jpeg').then(
          () => (thumb_path = poster),
          () => undefined,
        ),
      );
    }
    uploads.push(uploadIrlFile(media_path, media.uri, media.type ?? 'video/mp4', input.onProgress));
  }
  const files = () => [media_path, thumb_path].filter((x): x is string => Boolean(x));
  // Not published: its files go, unless an earlier try of this same post was saved (they are its files).
  const cleanup = async () => {
    if (!files().length) return;
    const { data: saved, error: unknown } = await sb.from('irl_posts').select('id').eq('id', id).maybeSingle();
    if (saved || unknown) return;
    await sb.storage.from('irl-media').remove(files()).catch(() => undefined);
  };
  let activityId: string | null = null;
  try {
    const [activity] = await Promise.all([Promise.resolve(input.activityId ?? null), ...uploads]);
    activityId = activity;
  } catch (e) {
    // Nothing is published: what was stored for it goes.
    await Promise.allSettled(uploads);
    await cleanup().catch(() => undefined);
    throw e;
  }
  const insert = await sb
    .from('irl_posts')
    .insert({
      id,
      author_id: uid,
      city_id: input.cityId,
      area_id: input.areaId,
      place_name: input.placeName ?? null,
      body: input.body,
      media_path,
      ...(media ? { media_kind: media.kind } : {}),
      ...(thumb_path ? { thumb_path } : {}),
      ...(media?.seconds !== undefined ? { media_seconds: Math.min(120, media.seconds) } : {}),
      ...(media && ratio ? { media_ratio: Math.round(Math.min(9.9, Math.max(0.11, ratio)) * 1000) / 1000 } : {}),
      ...(input.visibility ? { visibility: input.visibility } : {}),
      activity_id: activityId,
    })
    .select('id, created_at, visibility')
    .single();
  let row = insert.data;
  if (insert.error) {
    // Already there: our earlier try was saved before its answer got lost.
    if (insert.error.code === '23505') {
      const { data: again } = await sb.from('irl_posts').select('id, created_at, visibility').eq('id', id).eq('author_id', uid).maybeSingle();
      row = again;
    }
    if (!row) {
      // The post was refused: its files must not stay behind.
      await cleanup().catch(() => undefined);
      throw new Error(friendlyError(insert.error.message));
    }
  }
  if (!row) throw new Error('Could not post');
  // The media's shape, known before the feed loads it: the card never jumps.
  if (media_path) rememberRatio(`irl-media/${media_path}`, ratio);
  if (thumb_path) rememberRatio(`irl-media/${thumb_path}`, ratio);
  rememberRatio(shownUri, ratio);
  rememberRatio(posterUri, ratio);
  // The confirmed row goes straight into the feed (with the files already on
  // the phone, never shown to anyone else); the next load of the feed
  // (Realtime) replaces it with the server's own copy.
  const confirmed: ServerIrlPost = {
    id: row.id,
    authorId: uid,
    firstName: '',
    areaId: input.areaId,
    placeName: input.placeName ?? null,
    body: input.body,
    mediaUrl: shownUri,
    mediaKind: media?.kind,
    posterUrl: posterUri,
    seconds: media?.seconds ?? null,
    mediaRatio: ratio ?? null,
    visibility: row.visibility,
    createdAt: Date.parse(row.created_at),
    friend: false,
    mine: true,
    activityId,
    activityTitle: null,
    cityId: input.cityId,
  };
  useIrlMine.setState((st) => ({
    posts: [
      confirmed,
      // Live posts last 4 hours: older ones are dropped here.
      ...st.posts.filter((p) => p.id !== confirmed.id && p.createdAt > Date.now() - LIVE_TTL_MIN * 60_000),
    ].slice(0, 20),
  }));
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

export function useServerNotifications(): { items: ServerNotification[]; unread: number; markAllRead: () => void; status: 'loading' | 'ok' | 'failed'; reload: () => void } {
  const account = useAccount();
  const uid = account?.userId;
  const [items, setItems] = useState<ServerNotification[]>([]);
  // Loading or unreachable is not "nothing new".
  const [status, setStatus] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [retry, setRetry] = useState(0);
  const load = useCallback(async (): Promise<ServerNotification[]> => {
    if (!supabase || !uid) return [];
    // One MESSAGE_CREATED row per chat message pushed friend requests out of
    // the latest 50 (and the bell to 0): messages have their own badge.
    const { data, error } = await supabase
      .from('notifications')
      .select('id, kind, payload, read_at, created_at')
      .neq('kind', 'MESSAGE_CREATED')
      .order('created_at', { ascending: false })
      .limit(50);
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
    load().then(
      (n) => {
        if (!alive) return;
        setItems(n);
        setStatus('ok');
      },
      () => alive && setStatus((s) => (s === 'ok' ? s : 'failed')),
    );
    return () => {
      alive = false;
    };
  }, [version, load]);
  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    load().then(
      (n) => {
        if (!alive) return;
        setItems(n);
        setStatus('ok');
      },
      () => alive && setStatus((s) => (s === 'ok' ? s : 'failed')),
    );
    // New ones, and ones read elsewhere (another phone, a chat opened), arrive
    // through the app's sync channel ('notifs'): one reload per change, not two.
    return () => {
      alive = false;
    };
  }, [uid, load, retry]);
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
  const reload = useCallback(() => {
    setStatus('loading');
    setRetry((n) => n + 1);
  }, []);
  return { items: list, unread: list.filter((n) => !n.readAt && n.kind !== 'MESSAGE_CREATED').length, markAllRead, status, reload };
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
