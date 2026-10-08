import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { CATEGORY_BY_ID, ideaPhoto, type CategoryKey } from '@/data/catalog/categories';
import type { PhotoKey } from '@/data/photos';
import { useAccount } from '@/features/auth/account';
import { imageBytes, imageType } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { coverLinks } from './activities';

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

async function upload(uri: string): Promise<string> {
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

/** A community's photo: a picked image, or null to go back to the app's photo. */
export async function setCommunityCover(communityId: string, uri: string | null): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const path = uri ? await upload(uri) : null;
  const { error } = await supabase.rpc('set_community_cover', { p_community: communityId, p_path: path });
  if (error) throw new Error(error.message);
}

/** A chat's photo: a picked image, or null to go back to the app's photo. */
export async function setChatPhoto(conversationId: string, uri: string | null): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const path = uri ? await upload(uri) : null;
  const { error } = await supabase.rpc('set_conversation_photo', { p_conversation: conversationId, p_path: path });
  if (error) throw new Error(error.message);
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
  /** Group, session and community chats have a photo; private chats show the person. */
  hasPhoto: boolean;
  canEdit: boolean;
  refresh: () => void;
};

type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** A server chat's photo and whether you may change it (chat admin, community owner or moderator). */
export function useChatPhoto(conversationId: string): ChatPhoto {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<Omit<ChatPhoto, 'refresh'>>({ path: null, fallback: 'meeting', hasPhoto: false, canEdit: false });
  const [n, setN] = useState(0);
  const refresh = useCallback(() => setN((x) => x + 1), []);
  useEffect(() => {
    if (!supabase || !uid) return;
    const sb = supabase;
    let alive = true;
    (async () => {
      const [{ data: conv }, { data: me }] = await Promise.all([
        sb
          .from('conversations')
          .select('kind, photo_path, community_id, activities(category_id, title), communities(category_id)')
          .eq('id', conversationId)
          .maybeSingle(),
        sb.from('conversation_members').select('role').eq('conversation_id', conversationId).eq('user_id', uid).maybeSingle(),
      ]);
      if (!alive || !conv) return;
      const act = one(conv.activities as One<{ category_id: string; title: string }>);
      const com = one(conv.communities as One<{ category_id: string | null }>);
      let canEdit = me?.role === 'admin';
      if (!canEdit && conv.community_id) {
        const { data: cm } = await sb.from('community_members').select('role').eq('community_id', conv.community_id).eq('user_id', uid).maybeSingle();
        canEdit = cm?.role === 'owner' || cm?.role === 'moderator';
      }
      const fallback: PhotoKey = act
        ? ideaPhoto((CATEGORY_BY_ID[act.category_id as CategoryKey] ? act.category_id : 'sport') as CategoryKey, act.title)
        : (CATEGORY_BY_ID[com?.category_id as CategoryKey]?.photo ?? 'meeting');
      const hasPhoto = conv.kind === 'group' || conv.kind === 'activity' || conv.kind === 'community';
      if (alive) setState({ path: (conv.photo_path as string | null) ?? null, fallback, hasPhoto, canEdit: hasPhoto && canEdit });
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [conversationId, uid, n]);
  return { ...state, refresh };
}
