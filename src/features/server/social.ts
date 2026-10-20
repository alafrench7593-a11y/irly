import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CityId } from '@/data/types';
import { useCityFilter } from './scope';
import { create } from 'zustand';
import { NONE } from '@/lib/none';
import { useAccount } from '@/features/auth/account';
import { friendlyError, liveChannel, supabase, whenListening } from '@/lib/supabase';
import { changed, useRefreshOn, useSyncVersion } from './sync';
import { seedLink, signedLinks } from './media';
import { uuid } from '@/lib/uuid';
import { prepareLiveMedia, uploadLiveFile, type LiveMedia } from '@/features/live/liveMedia';
import { isAnswer, isMissingFunction, LivePublishError, runPublish, settlePending, type AbandonAnswer, type Settled } from '@/features/live/livePublish';
import { pendingJournal, usePendingLives } from '@/features/live/pendingLive';
import { activityColumns, cancelServerActivity, createServerActivity, deleteServerActivity } from './activities';
import { useDrafts } from '@/features/posts/posts';
import { toast } from '@/components/ui/Toast';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MyPlan } from '@/state/store';
import { rememberRatio } from '@/features/live/liveRatio';
import { LIVE_TTL_MIN } from '@/features/live/liveStore';
import { useNow } from '@/lib/useNow';
import { useAppSpace } from '@/state/appSpace';

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
  /** The space it was posted in (your own posts on this phone): IRLY or IRLY Girl. */
  scope?: LiveScope;
};

/** The space a Live belongs to: IRLY's Live and IRLY Girl's never show each other's posts (irl_posts.app_scope). */
export type LiveScope = 'irly' | 'irly_girl';

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
  // In the IRLY Girl space the feed is women's posts only (irl_feed_girl, checked by the server).
  const girlSpace = useAppSpace() === 'girl';
  const key = `${uid ?? ''}:${cityId}:${girlSpace ? 'girl' : 'mixte'}`;
  // Kept with the feed it belongs to: switching space (or account, or city) never shows the other feed's posts.
  const [feed, setFeed] = useState<{ key: string; posts: ServerIrlPost[] }>(() => ({ key, posts: irlCache.get(key) ?? [] }));
  const posts = feed.key === key ? feed.posts : (irlCache.get(key) ?? NONE);
  // Loads can overlap (Realtime, your own post, focus): only the latest one
  // started may write, so an older, slower answer never hides a newer post.
  const seq = useRef(0);
  const setPosts = useCallback(
    (p: ServerIrlPost[]) => {
      irlCache.set(key, p);
      setFeed({ key, posts: p });
      // Confirmed by the server: from now on the feed alone decides (expiry, removal).
      const ids = new Set(p.map((x) => x.id));
      if (useIrlMine.getState().posts.some((x) => ids.has(x.id))) useIrlMine.setState((s) => ({ posts: s.posts.filter((x) => !ids.has(x.id)) }));
    },
    [key],
  );

  const load = useCallback(async (): Promise<ServerIrlPost[]> => {
    if (!supabase || !uid) return [];
    const { data, error } = await supabase.rpc(girlSpace ? 'irl_feed_girl' : 'irl_feed', { p_city: cityId });
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
  }, [cityId, uid, girlSpace]);

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

  // The ids on screen, for the DELETE events below (heard app-wide).
  const shownIds = useRef(new Set<string>());
  useEffect(() => {
    shownIds.current = new Set(posts.map((p) => p.id));
  }, [posts]);

  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    const isAlive = () => alive;
    reload(isAlive);
    // A burst of events (several posts, edits, a wave of expiries) is one reload of the feed, not one each.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const later = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        reload(isAlive);
      }, 400);
    };
    const channel = liveChannel(`irl-${cityId}-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'irl_posts', filter: `city_id=eq.${cityId}` }, (payload) => {
        // My own post, already confirmed and shown, and its feed reload already asked: not twice.
        const id = (payload.new as { id?: string } | null)?.id;
        if (payload.eventType === 'INSERT' && id && confirmedHere.has(id)) return;
        later();
      })
      // Realtime cannot filter DELETE events (the old row only has its id): heard for every
      // Live app-wide, so only a removal of a post on this screen reloads the feed.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'irl_posts' }, (payload) => {
        const id = (payload.old as { id?: string } | null)?.id;
        if (!id || shownIds.current.has(id)) later();
      })
      // Listening: a Live posted before then is in no event.
      .subscribe(whenListening(later));
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
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
    // Your own posts of this space only: one posted in IRLY Girl never shows in IRLY's Live, and back.
    const space: LiveScope = girlSpace ? 'irly_girl' : 'irly';
    const fresh = mine.filter((p) => !ids.has(p.id) && (p.scope ?? 'irly') === space && (p.cityId === cityId || keep(p.cityId)) && live(p));
    return [...fresh, ...posts.filter((p) => keep(p.cityId) && live(p))];
  }, [posts, mine, keep, cityId, now, girlSpace]);
  return { posts: uid ? shown : NONE, refresh };
}

/** Posts confirmed on this phone (their own feed reload is already asked by bumpIrl): their realtime echo is skipped. */
const confirmedHere = new Set<string>();

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

/** "Anyone can join": the activity the Live makes, saved with it (never before, never without it). */
export type LiveActivityPlan = { plan: Omit<MyPlan, 'id' | 'createdAt'>; at: Date };

type SavedLive = { id: string; created_at: string; visibility: ServerIrlPost['visibility']; activity_id: string | null; replayed: boolean };

/**
 * Post what you're doing right now. Files go to the member's own folder.
 *
 * States (see livePublish.ts): draft → publishing → published | failed.
 * The photo (or the video's poster) was prepared when it was picked
 * (prepareLiveMedia); here the files are uploaded (video and poster in
 * parallel), then the Live AND its "anyone can join" activity are saved by
 * the server in one transaction (post_live): both or neither. The activity is
 * no longer created while the files upload, so a failed or abandoned Live can
 * never leave it published. The post shows in the feed from the server's
 * answer, never before.
 *
 * `id` makes a retry safe: the same id gives the same files, the same row and
 * the same activity, so a post whose answer got lost is never published twice.
 * A failure is a LivePublishError: 'refused' (nothing of it exists) or
 * 'unknown' (no answer: kept in the phone's journal until settleLive).
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
  /** IRL → activity: created with the post, in the same transaction. */
  activity?: LiveActivityPlan | null;
  /** The space it is posted in; left out: IRLY. */
  scope?: LiveScope;
  /** The post's id, made on the phone (kept across retries of the same post). */
  id?: string;
  /** An earlier try of this id got no answer (it may be saved already). */
  prior?: boolean;
}): Promise<{ id: string; activityId: string | null; activityCreated: boolean }> {
  // Never a silent no-op: the composer would close as if the post were live.
  if (!supabase) throw new LivePublishError('The IRLY server is not configured', 'refused');
  const sb = supabase;
  const { data: s } = await sb.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) throw new LivePublishError('Sign in to post', 'refused');
  const id = input.id ?? uuid();
  const media: LiveMedia | undefined = input.media ?? (input.photoUri ? { kind: 'photo', uri: input.photoUri } : undefined);
  let media_path: string | null = null;
  let thumb_path: string | null = null;
  let shownUri: string | null = null;
  let posterUri: string | null = null;
  let ratio: number | undefined = media?.ratio;
  const uploads: (() => Promise<unknown>)[] = [];
  const files: string[] = [];
  if (media?.kind === 'photo') {
    const prep = await prepareLiveMedia(media).catch(() => ({ image: undefined, ratio: undefined }));
    if (!prep.image) throw new LivePublishError('Could not read this photo', 'refused');
    const image = prep.image;
    ratio = prep.ratio ?? ratio;
    const path = `${uid}/${id}.jpg`;
    media_path = path;
    shownUri = image.uri;
    files.push(path);
    uploads.push(() => uploadIrlFile(path, image.uri, 'image/jpeg', input.onProgress));
  } else if (media?.kind === 'video') {
    // The poster is best effort: without it the video still goes (the feed shows a plain tile).
    const prep = await prepareLiveMedia(media).catch(() => ({ image: undefined, ratio: media.ratio }));
    ratio = prep.ratio ?? ratio;
    const ext = media.type === 'video/quicktime' ? 'mov' : 'mp4';
    const path = `${uid}/${id}.${ext}`;
    media_path = path;
    shownUri = media.uri;
    files.push(path);
    if (prep.image) {
      const poster = `${uid}/${id}-poster.jpg`;
      const image = prep.image;
      posterUri = image.uri;
      files.push(poster);
      uploads.push(() =>
        uploadIrlFile(poster, image.uri, 'image/jpeg').then(
          () => (thumb_path = poster),
          () => undefined,
        ),
      );
    }
    uploads.push(() => uploadIrlFile(path, media.uri, media.type ?? 'video/mp4', input.onProgress));
  }

  const post = {
    id,
    city_id: input.cityId,
    area_id: input.areaId,
    place_name: input.placeName ?? null,
    body: input.body,
    media_path,
    ...(media ? { media_kind: media.kind } : {}),
    ...(media?.seconds !== undefined ? { media_seconds: Math.min(120, media.seconds) } : {}),
    ...(media && ratio ? { media_ratio: Math.round(Math.min(9.9, Math.max(0.11, ratio)) * 1000) / 1000 } : {}),
    ...(input.visibility ? { visibility: input.visibility } : {}),
    // The server keeps it in this space, and refuses IRLY Girl to anyone without access.
    scope: input.scope ?? 'irly',
  };
  const save = async (): Promise<SavedLive> => {
    const full = { ...post, ...(thumb_path ? { thumb_path } : {}) };
    const activity = input.activity ? activityColumns(input.activity.plan, input.activity.at) : null;
    const { data, error } = await sb.rpc('post_live', { p_post: full, p_activity: activity });
    if (!error && data) return data as SavedLive;
    if (error && isMissingFunction(error)) return saveLegacy(sb, uid, full, input.activity ?? null);
    throw new LivePublishError(friendlyError(error?.message ?? 'Could not post'), error && isAnswer(error) ? 'refused' : 'unknown');
  };
  const row = await runPublish<SavedLive>(
    { postId: id, uid, files, body: input.body, activity: Boolean(input.activity), at: Date.now(), prior: input.prior },
    {
      upload: async () => {
        await Promise.all(uploads.map((u) => u()));
      },
      save,
      removeFiles: () => removeUnsaved(sb, id, files),
      journal: pendingJournal,
    },
  );
  const activityId = row.activity_id ?? null;
  const activityCreated = Boolean(activityId && input.activity && !row.replayed);
  if (activityId) changed('activities', 'inbox');
  // The media's shape, known before the feed loads it: the card never jumps.
  if (media_path) rememberRatio(`irl-media/${media_path}`, ratio);
  // The feed's next load shows the files already on this phone: nothing is downloaded
  // again and the picture does not blank while it would be (a local file that fails
  // to show is dropped by its retry, which then signs the stored one).
  seedLink('irl-media', media_path, shownUri, LIVE_TTL_MIN * 60_000);
  seedLink('irl-media', thumb_path, posterUri, LIVE_TTL_MIN * 60_000);
  if (confirmedHere.size > 50) confirmedHere.clear();
  confirmedHere.add(row.id);
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
    posterUrl: thumb_path ? posterUri : null,
    seconds: media?.seconds ?? null,
    mediaRatio: ratio ?? null,
    visibility: row.visibility,
    createdAt: Date.parse(row.created_at),
    friend: false,
    mine: true,
    activityId,
    activityTitle: input.activity ? input.activity.plan.title ?? null : null,
    cityId: input.cityId,
    scope: input.scope ?? 'irly',
  };
  useIrlMine.setState((st) => ({
    posts: [
      confirmed,
      // Live posts last 4 hours: older ones are dropped here.
      ...st.posts.filter((p) => p.id !== confirmed.id && p.createdAt > Date.now() - LIVE_TTL_MIN * 60_000),
    ].slice(0, 20),
  }));
  // The feeds pick up the server's copy (same signed links, so nothing is downloaded again):
  // the local copy never outlives a removal done elsewhere.
  bumpIrl();
  return { id: row.id, activityId, activityCreated };
}

/** Files of a Live that was not saved: removed, unless the Live turns out to be saved (they are its files) or that cannot be checked. */
async function removeUnsaved(sb: SupabaseClient, id: string, files: string[]): Promise<void> {
  if (!files.length) return;
  const { data: saved, error } = await sb.from('irl_posts').select('id').eq('id', id).maybeSingle();
  if (saved || error) return;
  await sb.storage.from('irl-media').remove(files).catch(() => undefined);
}

/**
 * The server without post_live (database not migrated yet): the older steps,
 * in an order that never leaves the activity alone on purpose: the files are
 * already stored, then the activity (its client_ref is the Live's id, so a
 * retry finds it), then the Live; a refused Live rolls its activity back.
 */
async function saveLegacy(sb: SupabaseClient, uid: string, post: Record<string, unknown>, activity: LiveActivityPlan | null): Promise<SavedLive> {
  const id = post.id as string;
  let activityId: string | null = null;
  if (activity) {
    try {
      activityId = await createServerActivity(activity.plan, activity.at, { clientRef: id });
    } catch (e) {
      // Its answer may have been lost (it may exist): settled like any Live without answer.
      throw new LivePublishError(friendlyError(e instanceof Error ? e.message : 'Could not post'), 'unknown');
    }
  }
  const insert = await sb
    .from('irl_posts')
    .insert({ ...post, author_id: uid, activity_id: activityId })
    .select('id, created_at, visibility, activity_id')
    .single();
  let row = insert.data as Omit<SavedLive, 'replayed'> | null;
  if (insert.error) {
    // Already there: our earlier try was saved before its answer got lost.
    // Same for a rate-limit refusal of a retry: the first try may be the one that counted.
    if (insert.error.code === '23505' || /slow down/i.test(insert.error.message)) {
      const { data: again } = await sb.from('irl_posts').select('id, created_at, visibility, activity_id').eq('id', id).eq('author_id', uid).maybeSingle();
      if (again) return { ...(again as Omit<SavedLive, 'replayed'>), replayed: true };
    }
    if (!isAnswer(insert.error)) throw new LivePublishError(friendlyError(insert.error.message), 'unknown');
    // Refused: the activity made for it goes too (or the Live is settled later, never left half done).
    if (activityId) {
      try {
        await legacyAbandon(sb, uid, id);
      } catch {
        throw new LivePublishError(friendlyError(insert.error.message), 'unknown');
      }
    }
    throw new LivePublishError(friendlyError(insert.error.message), 'refused');
  }
  if (!row) throw new LivePublishError('Could not post', 'unknown');
  row = row as Omit<SavedLive, 'replayed'>;
  return { ...row, replayed: false };
}

/** abandon_live with the older steps (database not migrated): the same answers, without the server-side lock. */
async function legacyAbandon(sb: SupabaseClient, uid: string, postId: string): Promise<AbandonAnswer> {
  const { data: post, error } = await sb.from('irl_posts').select('author_id').eq('id', postId).maybeSingle();
  if (error) throw new Error(error.message);
  if (post) return (post as { author_id: string }).author_id === uid ? 'published' : 'not_mine';
  const { data: act, error: e2 } = await sb.from('activities').select('id, cancelled_at').eq('creator_id', uid).eq('client_ref', postId).maybeSingle();
  if (e2) throw new Error(e2.message);
  if (!act) return 'abandoned';
  const a = act as { id: string; cancelled_at: string | null };
  if (a.cancelled_at) return 'cancelled';
  const { count, error: e3 } = await sb
    .from('activity_participants')
    .select('user_id', { count: 'exact', head: true })
    .eq('activity_id', a.id)
    .neq('user_id', uid)
    .in('status', ['going', 'maybe']);
  if (e3) throw new Error(e3.message);
  // Someone else joined: called off (they hear it), never deleted.
  if (count) {
    await cancelServerActivity(a.id);
    return 'cancelled';
  }
  await deleteServerActivity(a.id);
  return 'deleted';
}

/** Asks the server to give up on a Live that got no answer (see abandon_live). */
async function abandonLive(postId: string): Promise<AbandonAnswer> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const sb = supabase;
  const { data, error } = await sb.rpc('abandon_live', { p_post: postId });
  if (error && isMissingFunction(error)) {
    const { data: s } = await sb.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) throw new Error('Sign in again');
    return legacyAbandon(sb, uid, postId);
  }
  if (error) throw new Error(error.message);
  return data as AbandonAnswer;
}

/**
 * Settles a Live whose publish got no answer (the member closed the composer,
 * discarded it, changed it, or the app starts again after being killed):
 * 'published' when it landed (shown), 'dropped' when it never will (its files
 * removed, an activity made for it rolled back), 'later' when the server
 * could not be asked (kept, asked again). 'none': nothing was pending.
 */
export async function settleLive(postId: string): Promise<Settled | 'none'> {
  const p = pendingJournal.get(postId);
  if (!p) return 'none';
  const sb = supabase;
  const r = await settlePending(p, {
    abandon: abandonLive,
    removeFiles: async (paths) => {
      if (sb) await sb.storage.from('irl-media').remove(paths);
    },
  });
  if (r === 'later') return r;
  pendingJournal.drop(postId);
  if (r === 'published') bumpIrl();
  if (p.activity) changed('activities', 'inbox');
  return r;
}

/**
 * At start (signed in): Lives left mid-publish by an earlier run of the app
 * (killed, closed, offline) are settled. One that landed is announced; one
 * that did not gives its words back as the Live draft. Unreachable server:
 * asked again a minute later, never assumed.
 */
function useLeftOverLives(uid: string | undefined): void {
  const saveDraft = useDrafts((st) => st.save);
  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sweep = async () => {
      timer = null;
      let again = false;
      for (const p of pendingJournal.leftOver(uid)) {
        if (!alive) return;
        const r = await settleLive(p.postId).catch(() => 'later' as const);
        if (!alive) return;
        if (r === 'later') again = true;
        else if (r === 'published') toast('Your Live was posted', 'zap', 'live');
        else if (r === 'dropped' && p.body.trim()) {
          // The words come back (unless a newer draft is already there).
          if (!useDrafts.getState().byKey.live) saveDraft('live', { body: p.body, media: null, at: Date.now() });
          toast('Your Live was not posted. It is kept as a draft.', 'edit', 'live');
        }
      }
      if (again && alive) timer = setTimeout(() => void sweep(), 60_000);
    };
    // The journal is read from the phone's storage: wait for it.
    const start = () => void sweep();
    const unsub = usePendingLives.persist.hasHydrated() ? (start(), () => undefined) : usePendingLives.persist.onFinishHydration(start);
    return () => {
      alive = false;
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [uid, saveDraft]);
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
  if (error) throw new Error(friendlyError(error.message));
  changed('friends', 'notifs');
}

/* ───────────────────────── Notifications ───────────────────────── */

export type ServerNotification = { id: string; kind: string; payload: Record<string, string>; readAt: number | null; createdAt: number };

/** Bumped when notifications are marked read: the header badge and the list stay in step. */
const useNotifVersion = create<{ n: number }>(() => ({ n: 0 }));

/**
 * Notifications this phone marked read and the server has not confirmed yet
 * (id → when): the list and the bell show them read at once, before the
 * round trip. Removed again if the server refuses.
 */
const useReadHere = create<{ ids: Record<string, number> }>(() => ({ ids: {} }));

/**
 * Marks one notification read: on screen at once, then on the server (its own
 * row only: RLS). An already-read one, or one already being marked, sends
 * nothing. Resolves false when the server refused (it shows unread again).
 */
export async function markNotificationRead(id: string): Promise<boolean> {
  if (!supabase) return true;
  if (useReadHere.getState().ids[id]) return true;
  const at = Date.now();
  useReadHere.setState((s) => ({ ids: { ...s.ids, [id]: at } }));
  const { error } = await supabase.from('notifications').update({ read_at: new Date(at).toISOString() }).eq('id', id).is('read_at', null);
  if (error) {
    useReadHere.setState((s) => {
      const ids = { ...s.ids };
      delete ids[id];
      return { ids };
    });
    return false;
  }
  useNotifVersion.setState((s) => ({ n: s.n + 1 }));
  return true;
}

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
  // Reads can cross (a sync bump while the first read is on its way): only the newest one started lands.
  const seq = useRef(0);
  useEffect(() => {
    if (!version) return;
    let alive = true;
    const n0 = ++seq.current;
    load().then(
      (n) => {
        if (!alive || n0 !== seq.current) return;
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
    const n0 = ++seq.current;
    load().then(
      (n) => {
        if (!alive || n0 !== seq.current) return;
        setItems(n);
        setStatus('ok');
      },
      () => alive && n0 === seq.current && setStatus((s) => (s === 'ok' ? s : 'failed')),
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
  const readHere = useReadHere((s) => s.ids);
  const list = useMemo(() => (uid ? items.map((n) => (n.readAt || !readHere[n.id] ? n : { ...n, readAt: readHere[n.id] })) : NONE), [uid, items, readHere]);
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
  // Mounted once at the root, signed in: the right place to settle Lives left mid-publish.
  useLeftOverLives(useAccount()?.userId);
  useEffect(() => {
    useServerBell.setState({ n: unread });
  }, [unread]);
  return null;
}

/** Signed out or account deleted: the previous member's feeds and own Lives are forgotten on this phone. */
export function clearSocialCache(): void {
  irlCache.clear();
  confirmedHere.clear();
  useReadHere.setState({ ids: {} });
  useIrlMine.setState({ posts: [] });
}
