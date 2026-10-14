import { webLink } from '@/config/app';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@/components/ui/Toast';
import { NONE } from '@/lib/none';
import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';
import { useAccount } from '@/features/auth/account';
import { track } from '@/lib/analytics';
import { supabase, topic } from '@/lib/supabase';
import { changed, useRefreshOn } from './sync';

/**
 * One interaction system for the whole app. Anything that can be liked,
 * commented, saved, shared or hidden is addressed by (type, id): an IRL post,
 * an activity or event, a community, a community post, a comment, a profile,
 * a place, or a curated catalog item. The server decides who may interact
 * (row level security: only with what you can already see).
 */

export type TargetType = 'irl_post' | 'activity' | 'community' | 'community_post' | 'comment' | 'profile' | 'place' | 'catalog' | 'news';
export type Target = { type: TargetType; id: string; title?: string };

/** What a member can report something for (stored with the report). */
export type ReportCategory = 'harassment' | 'hate_speech' | 'spam' | 'scam' | 'fake_profile' | 'inappropriate' | 'threats' | 'other';

export type Engagement = { likes: number; comments: number; saves: number; liked: boolean; saved: boolean };
const EMPTY: Engagement = { likes: 0, comments: 0, saves: 0, liked: false, saved: false };

type Row = { target_id: string } & Engagement;

/**
 * Realtime filter on just these ids (`target_id=in.(…)`), or null when it
 * cannot be expressed: Realtime takes at most 100 values, and an id with a
 * comma or parenthesis would break the list. Callers then filter by type.
 */
export function realtimeIdsFilter(ids: string[], column = 'target_id'): string | null {
  if (!ids.length || ids.length > 100 || !ids.every((id) => /^[\w.:-]+$/.test(id))) return null;
  return `${column}=in.(${ids.join(',')})`;
}

/** Calls `fn` once, `ms` after the last of a burst of calls. */
function debounced(fn: () => void, ms: number): { call: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    call: () => {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, ms);
    },
    cancel,
  };
}

/** Canonical deep link for anything shareable. */
export function deepLink(t: Target): string {
  const path =
    t.type === 'activity'
      ? `a/${t.id}`
      : t.type === 'community'
        ? `communities`
        : t.type === 'profile'
          ? `person/${t.id}`
          : t.type === 'irl_post'
            ? `live?post=${t.id}`
            : `search?q=${encodeURIComponent(t.title ?? t.id)}`;
  // On the web, the address people can actually open; in the app, the public link.
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}/${path}`;
  return webLink(`/${path}`);
}

/**
 * Counters and my state for a batch of items, live: a like or comment by
 * anyone updates every screen showing it. Optimistic toggles roll back if
 * the server refuses.
 */
export function useEngagement(type: TargetType, ids: string[]) {
  const account = useAccount();
  const uid = account?.userId;
  const key = ids.join(',');
  const [map, setMap] = useState<Record<string, Engagement>>({});

  const load = useCallback(async (): Promise<Record<string, Engagement>> => {
    if (!supabase || !uid || !key) return {};
    const { data, error } = await supabase.rpc('engagement', { p_type: type, p_ids: key.split(',') });
    if (error) throw new Error(error.message);
    const out: Record<string, Engagement> = {};
    for (const r of (data as Row[]) ?? []) out[r.target_id] = { likes: r.likes, comments: r.comments, saves: r.saves, liked: r.liked, saved: r.saved };
    return out;
  }, [type, key, uid]);

  // Ids whose engagement has come back from the server: until then a like
  // cannot know whether it likes or unlikes.
  const loaded = useRef<{ key: string; ids: Set<string> }>({ key: '', ids: new Set() });
  const fetchMap = useCallback(async () => {
    const m = await load();
    loaded.current = { key, ids: new Set(key.split(',')) };
    return m;
  }, [load, key]);

  useEffect(() => {
    if (!supabase || !uid || !key) return;
    let alive = true;
    const reload = () =>
      fetchMap()
        .then((m) => alive && setMap(m))
        .catch(() => undefined);
    reload();
    // Only the items shown, when Realtime can filter on them (else every
    // like of this type app-wide); a burst of events is one reload.
    const later = debounced(reload, 600);
    const filter = realtimeIdsFilter(key.split(',')) ?? `target_type=eq.${type}`;
    const channel = supabase
      .channel(topic(`eng-${type}-${key.length}-${uid}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter }, later.call)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter }, later.call)
      .subscribe();
    return () => {
      alive = false;
      later.cancel();
      supabase?.removeChannel(channel);
    };
  }, [type, key, uid, fetchMap]);

  const patch = useCallback((id: string, next: Partial<Engagement>) => setMap((m) => ({ ...m, [id]: { ...(m[id] ?? EMPTY), ...next } })), []);

  // Latest state for the toggles (not the render's snapshot), and one toggle
  // in flight per item: a double tap must not toggle twice on the server.
  const mapRef = useRef(map);
  useEffect(() => {
    mapRef.current = map;
  }, [map]);
  const busy = useRef(new Set<string>());

  /** Toggles the like; `likeOnly` (a double tap) never unlikes. */
  const like = useCallback(
    async (id: string, likeOnly = false) => {
      const k = `like:${id}`;
      if (busy.current.has(k)) return;
      busy.current.add(k);
      let cur = mapRef.current[id] ?? EMPTY;
      // Not loaded yet: "not liked" is only the placeholder, toggling it
      // blindly could unlike. Ask the server first.
      if (loaded.current.key !== key || !loaded.current.ids.has(id)) {
        try {
          const m = await fetchMap();
          setMap(m);
          cur = m[id] ?? EMPTY;
        } catch (e) {
          busy.current.delete(k);
          throw e;
        }
      }
      if (likeOnly && cur.liked) {
        busy.current.delete(k);
        return;
      }
      patch(id, { liked: !cur.liked, likes: Math.max(0, cur.likes + (cur.liked ? -1 : 1)) });
      try {
        const liked = await toggleLike({ type, id });
        patch(id, { liked });
        if (liked) track(type === 'irl_post' ? 'IRL_LIKE' : type === 'activity' ? 'EVENT_LIKE' : 'LIKE', { type });
      } catch (e) {
        patch(id, { liked: cur.liked, likes: cur.likes });
        throw e;
      } finally {
        busy.current.delete(k);
      }
    },
    [type, key, patch, fetchMap],
  );

  const save = useCallback(
    async (id: string) => {
      const k = `save:${id}`;
      if (busy.current.has(k)) return;
      busy.current.add(k);
      const cur = mapRef.current[id] ?? EMPTY;
      patch(id, { saved: !cur.saved, saves: Math.max(0, cur.saves + (cur.saved ? -1 : 1)) });
      try {
        await toggleSave({ type, id });
      } catch (e) {
        patch(id, { saved: cur.saved, saves: cur.saves });
        throw e;
      } finally {
        busy.current.delete(k);
      }
    },
    [type, patch],
  );

  const get = useCallback((id: string) => map[id] ?? EMPTY, [map]);
  return useMemo(() => ({ get, like, save, signedIn: Boolean(uid) }), [get, like, save, uid]);
}

function need() {
  if (!supabase) throw new Error('The IRLY server is not configured');
  return supabase;
}

export async function toggleLike(t: Target): Promise<boolean> {
  const { data, error } = await need().rpc('toggle_like', { p_type: t.type, p_id: t.id });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function toggleSave(t: Target): Promise<boolean> {
  const { data, error } = await need().rpc('toggle_save', { p_type: t.type, p_id: t.id });
  if (error) throw new Error(error.message);
  changed('saved');
  return Boolean(data);
}

export async function hideItem(t: Target): Promise<void> {
  const sb = need();
  const { data } = await sb.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error('Sign in first');
  const { error } = await sb.from('hidden_items').upsert({ user_id: uid, target_type: t.type, target_id: t.id });
  if (error) throw new Error(error.message);
  changed('activities', 'communities');
}

export async function reportItem(t: Target, category: ReportCategory, ownerId?: string, details?: string): Promise<void> {
  const kind = t.type === 'catalog' || t.type === 'place' ? null : t.type;
  if (!kind) return;
  const { error } = await need().rpc('report', {
    p_kind: kind,
    p_target_user: ownerId ?? null,
    p_target_id: t.id,
    p_category: category,
    p_details: details?.trim() ? details.trim().slice(0, 1000) : null,
  });
  if (error) throw new Error(error.message);
}

/** Native share sheet (or clipboard on the web). Logged as a share. */
export async function shareNative(t: Target): Promise<void> {
  const url = deepLink(t);
  const message = t.title ? `${t.title} on IRLY\n${url}` : url;
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as Navigator | undefined;
    if (nav?.share) await nav.share({ title: t.title ?? 'IRLY', url });
    else {
      await nav?.clipboard?.writeText(url);
      toast('Link copied', 'check', 'positive');
    }
  } else {
    // iOS shares message and url separately (the link appeared twice); Android only has message.
    const res = await Share.share(Platform.OS === 'ios' ? { message: t.title ? `${t.title} on IRLY` : 'IRLY', url } : { message });
    if (res.action !== Share.sharedAction) return; // dismissed: nothing was shared
  }
  logShare(t, Platform.OS === 'web' ? 'link' : 'native');
}

function logShare(t: Target, channel: 'link' | 'native') {
  track(t.type === 'irl_post' ? 'IRL_SHARE' : t.type === 'activity' ? 'EVENT_SHARE' : 'SHARE', { type: t.type, channel });
  if (!supabase) return;
  supabase.auth.getSession().then(({ data }) => {
    const uid = data.session?.user.id;
    if (uid) supabase?.from('shares').insert({ user_id: uid, target_type: t.type, target_id: t.id, channel }).then(() => undefined);
  });
}

/** Copies the item's link (no share sheet). */
export async function copyLink(t: Target): Promise<void> {
  await Clipboard.setStringAsync(deepLink(t));
  logShare(t, 'link');
}

/** Send to a chat: one message that points at the canonical item. */
export async function shareToChat(conversationId: string, t: Target): Promise<void> {
  const { error } = await need().rpc('share_to_chat', { p_conversation: conversationId, p_type: t.type, p_id: t.id, p_title: t.title ?? '' });
  if (error) throw new Error(error.message);
  track('SHARE', { type: t.type, channel: 'chat' });
}

/**
 * Where a thing shared in a chat opens: its own page when it has one. A
 * community post opens its community (looked up, since the share names the post).
 */
export async function sharedHref(type: string, id: string | null, text: string): Promise<string> {
  const search = `/search?q=${encodeURIComponent(text)}`;
  if (!id) return type === 'irl_post' ? '/live' : search;
  if (type === 'activity') return `/a/${id}`;
  if (type === 'community') return `/c/${id}`;
  if (type === 'place') return `/place/${id}`;
  if (type === 'irl_post') return '/live';
  if (type === 'community_post' && supabase) {
    const { data } = await supabase.from('community_posts').select('community_id').eq('id', id).maybeSingle();
    return data?.community_id ? `/c/${data.community_id}` : search;
  }
  return search;
}

/** Private chat with a friend or a match (one implementation, shared with profiles). */
export { openDirect } from '@/features/profile/member';

/* ───────── Comments ───────── */

export type Comment = {
  id: string;
  parentId: string | null;
  authorId: string;
  firstName: string;
  body: string;
  createdAt: number;
  deleted: boolean;
  likes: number;
  liked: boolean;
  mine: boolean;
};

type CommentRow = {
  id: string;
  parent_id: string | null;
  author_id: string;
  first_name: string | null;
  body: string;
  created_at: string;
  deleted: boolean;
  likes: number;
  liked: boolean;
};

export function useComments(t: Target) {
  const account = useAccount();
  const uid = account?.userId;
  const [list, setList] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (): Promise<Comment[]> => {
    if (!supabase || !uid) return [];
    const { data, error } = await supabase.rpc('comment_thread', { p_type: t.type, p_id: t.id });
    if (error) throw new Error(error.message);
    return ((data as CommentRow[]) ?? []).map((r) => ({
      id: r.id,
      parentId: r.parent_id,
      authorId: r.author_id,
      firstName: r.first_name ?? 'Member',
      body: r.body,
      createdAt: Date.parse(r.created_at),
      deleted: r.deleted,
      likes: r.likes,
      liked: r.liked,
      mine: r.author_id === uid,
    }));
  }, [t.type, t.id, uid]);

  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    // A failed refresh keeps what is on screen; only a first load failure shows an error.
    const reload = () =>
      load()
        .then((c) => {
          if (!alive) return;
          setList(c);
          setFailed(false);
          setLoading(false);
        })
        .catch(() => {
          if (!alive) return;
          setFailed(true);
          setLoading(false);
        });
    reload();
    // A burst of events (a busy thread) is one reload.
    const later = debounced(reload, 600);
    const channel = supabase
      .channel(topic(`comments-${t.type}-${t.id}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `target_id=eq.${t.id}` }, later.call)
      .subscribe();
    return () => {
      alive = false;
      later.cancel();
      supabase?.removeChannel(channel);
    };
  }, [t.type, t.id, uid, load]);

  // Likes on this thread's comments only (it listened to every comment like
  // in the app), re-subscribed when the comments change.
  const likeKey = useMemo(
    () =>
      list
        .filter((c) => !c.id.startsWith('tmp-'))
        .map((c) => c.id)
        .join(','),
    [list],
  );
  useEffect(() => {
    if (!supabase || !uid || !likeKey) return;
    let alive = true;
    const later = debounced(() => {
      load()
        .then((c) => {
          if (!alive) return;
          setList(c);
          setFailed(false);
        })
        .catch(() => undefined);
    }, 600);
    const channel = supabase
      .channel(topic(`comment-likes-${t.type}-${t.id}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: realtimeIdsFilter(likeKey.split(',')) ?? 'target_type=eq.comment' }, later.call)
      .subscribe();
    return () => {
      alive = false;
      later.cancel();
      supabase?.removeChannel(channel);
    };
  }, [t.type, t.id, uid, likeKey, load]);

  const refresh = useCallback(() => {
    load()
      .then((c) => {
        setList(c);
        setFailed(false);
      })
      .catch(() => undefined);
  }, [load]);

  /** Optimistic: shows at once, marked pending, replaced by the server row. */
  const add = useCallback(
    async (body: string, parentId?: string | null) => {
      if (!supabase || !uid) throw new Error('Sign in to comment');
      const text = body.trim();
      if (!text) return;
      const temp: Comment = { id: `tmp-${Date.now()}`, parentId: parentId ?? null, authorId: uid, firstName: 'You', body: text, createdAt: Date.now(), deleted: false, likes: 0, liked: false, mine: true };
      setList((l) => [...l, temp]);
      const { data, error } = await supabase
        .from('comments')
        .insert({ target_type: t.type, target_id: t.id, author_id: uid, body: text, parent_id: parentId ?? null })
        .select('id, created_at')
        .single();
      if (error || !data) {
        setList((l) => l.filter((c) => c.id !== temp.id));
        throw new Error(error?.message.includes('slow down') ? 'Slow down a little' : (error?.message ?? 'Could not post'));
      }
      // The real row replaces the pending one, even if the refresh below fails.
      setList((l) => l.map((c) => (c.id === temp.id ? { ...c, id: data.id as string, createdAt: Date.parse(data.created_at as string) } : c)));
      track(t.type === 'irl_post' ? 'IRL_COMMENT' : 'COMMENT', { type: t.type, reply: Boolean(parentId) });
      refresh();
    },
    [t.type, t.id, uid, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!supabase || id.startsWith('tmp-')) return;
      setList((l) => l.map((c) => (c.id === id ? { ...c, deleted: true, body: '' } : c)));
      const { error } = await supabase.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) {
        refresh();
        throw new Error(error.message);
      }
    },
    [refresh],
  );

  return { comments: uid ? list : NONE, loading: uid ? loading : false, failed: uid ? failed : false, add, remove, refresh, signedIn: Boolean(uid) };
}

/* ───────── Saved ───────── */

export type SavedItem = { type: TargetType; id: string; createdAt: number };

export function useSaved() {
  const account = useAccount();
  const uid = account?.userId;
  const [items, setItems] = useState<SavedItem[]>([]);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async (): Promise<SavedItem[]> => {
    if (!supabase || !uid) return [];
    const { data, error } = await supabase.from('saves').select('target_type, target_id, created_at').order('created_at', { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ type: r.target_type as TargetType, id: r.target_id as string, createdAt: Date.parse(r.created_at as string) }));
  }, [uid]);
  const refresh = useCallback(() => {
    load()
      .then((s) => {
        setItems(s);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [load]);
  useEffect(() => {
    let alive = true;
    load()
      .then((s) => {
        if (!alive) return;
        setItems(s);
        setFailed(false);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [load]);
  useRefreshOn(['saved', 'activities', 'communities'], refresh);
  return { items: uid ? items : NONE, failed: uid ? failed : false, refresh, signedIn: Boolean(uid) };
}
