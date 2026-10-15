import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { CATEGORY_BY_ID, ideaPhoto, type CategoryKey } from '@/data/catalog/categories';
import type { PhotoKey } from '@/data/photos';
import { useAccount } from '@/features/auth/account';
import { cleanImage, imageBytes, imageType } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { changed, useSyncVersion } from './sync';
import { coverLinks } from './activities';
import { communityPhoto } from '@/features/community/official';
import { conversationHead } from './chat';

/**
 * Own photos for sessions, communities and chats. Without one, the app shows
 * its own photo for the category. Uploads go to the private
 * "activity-photos" bucket under "<your id>/…"; the server decides who may
 * set a photo (community owner or moderator, chat admin) and who sees it.
 */

/** Picks a photo from the library, cropped to 16:10 and resized for the app (null if cancelled). */
export async function pickPhoto(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [16, 10] });
  if (res.canceled || !res.assets[0]) return null;
  // Phone photos are 5–10 MB: 1280 px wide is plenty for a card and a header.
  const small = await manipulateAsync(res.assets[0].uri, [{ resize: { width: 1280 } }], { compress: 0.75, format: SaveFormat.JPEG });
  return small.uri;
}

/** Uploads one of your photos to "activity-photos" and returns its stored path. */
export async function uploadCover(uri: string): Promise<string> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error('Sign in first');
  const img = imageType(uri);
  const path = `${uid}/${Date.now()}.${img.ext}`;
  const { error } = await supabase.storage.from('activity-photos').upload(path, await imageBytes(uri), { contentType: img.contentType });
  if (error) throw new Error(error.message);
  return path;
}

/**
 * A session's own photo, sent while the member is still filling the form:
 * cleaned (cleanImage: re-encoded, no EXIF/GPS, ≤1600 px) and uploaded to
 * "<your id>/…" right after it is picked, so publishing only has to save the
 * row. Not readable by anyone else until an activity uses it (storage rule).
 */
export async function stageCover(uri: string): Promise<string> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const [{ data: session }, img] = await Promise.all([supabase.auth.getSession(), cleanImage(uri)]);
  const uid = session.session?.user.id;
  if (!uid) throw new Error('Sign in first');
  const path = `${uid}/${Date.now()}.${img.ext}`;
  const { error } = await supabase.storage.from('activity-photos').upload(path, img.body, { contentType: img.contentType });
  if (error) throw new Error('Could not upload the photo');
  return path;
}

/** A staged photo that ended up unused (replaced, removed, form closed): not left behind. */
export function dropStagedCover(path: string | null | undefined): void {
  if (!path || !supabase) return;
  supabase.storage.from('activity-photos').remove([path]).catch(() => undefined);
}

/** A community's photo: a picked image, or null to go back to the app's photo. */
export async function setCommunityCover(communityId: string, uri: string | null): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const path = uri ? await uploadCover(uri) : null;
  const { error } = await supabase.rpc('set_community_cover', { p_community: communityId, p_path: path });
  if (error) {
    // Refused (no longer allowed, removed meanwhile): the photo just sent is not left behind.
    if (path) await supabase.storage.from('activity-photos').remove([path]).catch(() => undefined);
    throw new Error(error.message);
  }
  changed('communities', 'inbox');
}

/** A chat's photo: a picked image, or null to go back to the app's photo. */
export async function setChatPhoto(conversationId: string, uri: string | null): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const path = uri ? await uploadCover(uri) : null;
  const { error } = await supabase.rpc('set_conversation_photo', { p_conversation: conversationId, p_path: path });
  if (error) {
    // Refused (no longer allowed, removed meanwhile): the photo just sent is not left behind.
    if (path) await supabase.storage.from('activity-photos').remove([path]).catch(() => undefined);
    throw new Error(error.message);
  }
  changed('inbox', 'communities');
}

/** A viewable link for a stored photo path (null while loading or without one). */
export function usePhotoLink(path: string | null | undefined): string | null {
  const [link, setLink] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    coverLinks([path]).then((m) => alive && m[path] && setLink({ path, url: m[path] }));
    return () => {
      alive = false;
    };
  }, [path]);
  return path && link?.path === path ? link.url : null;
}

export type ChatPhoto = {
  /** Its own photo (a storage path); null: the app's photo. */
  path: string | null;
  /** The app's photo: the session's or the community's, else a meetup. */
  fallback: PhotoKey;
  /** Same seed as the subject's own page, so the same picture shows. */
  seed?: string;
  /** Group, session and community chats have a photo; private chats show the person. */
  hasPhoto: boolean;
  canEdit: boolean;
  /** A community chat: its photo is the community's. */
  communityId: string | null;
  refresh: () => void;
};

type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** A server chat's photo and whether you may change it (chat admin, community owner or moderator). */
export function useChatPhoto(conversationId: string): ChatPhoto {
  const uid = useAccount()?.userId;
  // A new chat or community photo, set by anyone, shows at once.
  const inboxV = useSyncVersion('inbox');
  const communitiesV = useSyncVersion('communities');
  const [state, setState] = useState<Omit<ChatPhoto, 'refresh'>>({ path: null, fallback: 'meeting', hasPhoto: false, canEdit: false, communityId: null });
  const [n, setN] = useState(0);
  const refresh = useCallback(() => setN((x) => x + 1), []);
  useEffect(() => {
    if (!supabase || !uid) return;
    const sb = supabase;
    let alive = true;
    (async () => {
      // Read together with the thread opening at the same time (one request for both).
      const { conv, me } = await conversationHead(conversationId, uid);
      if (!alive || !conv) return;
      const act = one(conv.activities as One<{ category_id: string; title: string; sub_id: string | null; place_name: string | null; cover_path: string | null }>);
      const com = one(conv.communities as One<{ category_id: string | null; topic: string | null; cover_path: string | null }>);
      let canEdit = me?.role === 'admin';
      if (!canEdit && conv.community_id) {
        const { data: cm } = await sb.from('community_members').select('role').eq('community_id', conv.community_id).eq('user_id', uid).maybeSingle();
        canEdit = cm?.role === 'owner' || cm?.role === 'moderator';
      }
      const fallback: PhotoKey = act
        ? ideaPhoto((CATEGORY_BY_ID[act.category_id as CategoryKey] ? act.category_id : 'sport') as CategoryKey, act.title, act.place_name ?? undefined, act.sub_id)
        : ((communityPhoto(com?.topic, com?.category_id) as PhotoKey | null) ?? 'meeting');
      const hasPhoto = conv.kind === 'group' || conv.kind === 'activity' || conv.kind === 'community';
      // One source per picture: a community chat shows the community's own photo
      // (changing it changes the community's), others their chat photo, then the activity's cover.
      const path = conv.community_id ? (com?.cover_path ?? (conv.photo_path as string | null) ?? null) : ((conv.photo_path as string | null) ?? act?.cover_path ?? null);
      // Same seed as the community's page and the activity's page: the same picture of the subject.
      const seed = conv.community_id ? `community-${conv.community_id}-app` : conv.activity_id ? `a-${conv.activity_id}` : undefined;
      if (alive) setState({ path, fallback, seed, hasPhoto, canEdit: hasPhoto && canEdit, communityId: (conv.community_id as string | null) ?? null });
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [conversationId, uid, n, inboxV, communitiesV]);
  return { ...state, refresh };
}

/**
 * The app's picture for each community (by id) that has no photo of its own:
 * the inbox shows a community chat with the same picture as the community's page.
 */
export function useCommunityPhotoKeys(ids: string[]): Record<string, PhotoKey> {
  const [keys, setKeys] = useState<Record<string, PhotoKey>>({});
  const list = [...new Set(ids)].sort().join(',');
  useEffect(() => {
    if (!supabase || !list) return;
    let alive = true;
    supabase
      .from('communities')
      .select('id, topic, category_id')
      .in('id', list.split(','))
      .then(({ data }) => {
        if (!alive || !data) return;
        const out: Record<string, PhotoKey> = {};
        for (const c of data as { id: string; topic: string | null; category_id: string | null }[]) out[c.id] = (communityPhoto(c.topic, c.category_id) as PhotoKey | null) ?? 'meeting';
        setKeys(out);
      }, () => undefined);
    return () => {
      alive = false;
    };
  }, [list]);
  return keys;
}
