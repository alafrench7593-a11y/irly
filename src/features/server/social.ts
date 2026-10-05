import { useCallback, useEffect, useState } from 'react';
import { NONE } from '@/lib/none';
import { useAccount } from '@/features/auth/account';
import { supabase, topic } from '@/lib/supabase';
import { imageBytes, imageType } from '@/lib/media';

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
};

async function signed(path: string | null): Promise<string | null> {
  if (!path || !supabase) return null;
  const { data } = await supabase.storage.from('irl-media').createSignedUrl(path, 4 * 3600);
  return data?.signedUrl ?? null;
}

export function useServerIrl(cityId: string): { posts: ServerIrlPost[]; refresh: () => void } {
  const account = useAccount();
  const uid = account?.userId;
  const [posts, setPosts] = useState<ServerIrlPost[]>([]);

  const load = useCallback(async (): Promise<ServerIrlPost[]> => {
    if (!supabase || !uid) return [];
    const { data, error } = await supabase.rpc('irl_feed', { p_city: cityId });
    if (error) throw new Error(error.message);
    const rows = (data as FeedRow[]) ?? [];
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        authorId: r.author_id,
        firstName: r.first_name,
        areaId: r.area_id,
        placeName: r.place_name,
        body: r.body,
        mediaUrl: await signed(r.media_path),
        visibility: r.visibility,
        createdAt: Date.parse(r.created_at),
        friend: r.friend,
        mine: r.author_id === uid,
        activityId: r.activity_id ?? null,
        activityTitle: r.activity_title ?? null,
      })),
    );
  }, [cityId, uid]);

  const refresh = useCallback(() => {
    load().then(setPosts).catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    load().then((p) => alive && setPosts(p)).catch(() => undefined);
    const channel = supabase
      .channel(topic(`irl-${cityId}-${uid}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'irl_posts', filter: `city_id=eq.${cityId}` }, () => {
        load().then((p) => alive && setPosts(p)).catch(() => undefined);
      })
      // Realtime cannot filter DELETE events (the old row only has its id): listen unfiltered.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'irl_posts' }, () => {
        load().then((p) => alive && setPosts(p)).catch(() => undefined);
      })
      .subscribe();
    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [cityId, uid, load]);

  return { posts: uid ? posts : NONE, refresh };
}

/** Post what you're doing right now. Photo goes to the member's own folder. */
export async function postServerIrl(input: {
  cityId: string;
  areaId: string;
  placeName?: string;
  body: string;
  photoUri?: string;
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
  if (input.photoUri) {
    const body = await imageBytes(input.photoUri);
    const img = imageType(input.photoUri);
    media_path = `${uid}/${Date.now()}.${img.ext}`;
    const { error } = await supabase.storage.from('irl-media').upload(media_path, body, { contentType: img.contentType });
    if (error) throw new Error(error.message);
  }
  const { error } = await supabase.from('irl_posts').insert({
    author_id: uid,
    city_id: input.cityId,
    area_id: input.areaId,
    place_name: input.placeName ?? null,
    body: input.body,
    media_path,
    ...(input.visibility ? { visibility: input.visibility } : {}),
    activity_id: input.activityId ?? null,
  });
  if (error) throw new Error(error.message);
  return true;
}

export async function deleteServerIrl(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('irl_posts').delete().eq('id', id);
  if (error) throw new Error(error.message);
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
    const channel = supabase
      .channel(topic(`friends-${uid}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        load().then((f) => alive && setFriends(f)).catch(() => undefined);
      })
      .subscribe();
    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [uid, load]);
  return { friends: uid ? friends : NONE, refresh };
}

/** Sends a request, or accepts one. Returns 'pending' or 'accepted'. */
export async function addFriend(userId: string): Promise<string> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { data, error } = await supabase.rpc('add_friend', { p_user: userId });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function removeFriend(userId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('remove_friend', { p_user: userId });
  if (error) throw new Error(error.message);
}

/* ───────────────────────── Notifications ───────────────────────── */

export type ServerNotification = { id: string; kind: string; payload: Record<string, string>; readAt: number | null; createdAt: number };

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
  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    load().then((n) => alive && setItems(n)).catch(() => undefined);
    const channel = supabase
      .channel(topic(`notifications-${uid}`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => {
        load().then((n) => alive && setItems(n)).catch(() => undefined);
      })
      .subscribe();
    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [uid, load]);
  const markAllRead = useCallback(() => {
    if (!supabase || !uid) return;
    const now = new Date().toISOString();
    supabase
      .from('notifications')
      .update({ read_at: now })
      .is('read_at', null)
      .then(() => setItems((list) => list.map((n) => (n.readAt ? n : { ...n, readAt: Date.parse(now) }))));
  }, [uid]);
  const list = uid ? items : NONE;
  return { items: list, unread: list.filter((n) => !n.readAt).length, markAllRead };
}
