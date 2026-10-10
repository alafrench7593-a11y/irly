import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { isAvatar } from '@/features/avatar/avatar';
import { imageBytes, imageType } from '@/lib/media';
import { supabase } from '@/lib/supabase';

/**
 * Stored photos, shown everywhere from the same signed links: members'
 * profile photos ("profile-photos"), covers of activities, communities and
 * chats ("activity-photos"), and photos sent in chats ("chat-media").
 * Links are cached until shortly before they expire, so a list does not ask
 * again on every render, and a new path (a changed photo) is a new link.
 */
export type Bucket = 'profile-photos' | 'activity-photos' | 'chat-media' | 'irl-media';

const TTL = 6 * 3600;
const cache = new Map<string, { url: string; until: number }>();
const key = (b: Bucket, p: string) => `${b}|${p}`;

export async function signedLinks(bucket: Bucket, paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const now = Date.now();
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const p of new Set(paths.filter((x): x is string => Boolean(x)))) {
    // IRLY avatars and full links stand for themselves.
    if (isAvatar(p) || /^https?:|^data:|^file:|^blob:/.test(p)) out[p] = p;
    else {
      const hit = cache.get(key(bucket, p));
      if (hit && hit.until > now) out[p] = hit.url;
      else missing.push(p);
    }
  }
  if (missing.length && supabase) {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(missing, TTL);
    for (const d of data ?? []) {
      if (!d.path || !d.signedUrl) continue;
      cache.set(key(bucket, d.path), { url: d.signedUrl, until: now + (TTL - 600) * 1000 });
      out[d.path] = d.signedUrl;
    }
  }
  return out;
}

/** Signed links for a list of paths in one bucket (unchanged paths keep their links). */
export function useSignedLinks(bucket: Bucket, paths: (string | null | undefined)[]): Record<string, string> {
  const list = useMemo(() => [...new Set(paths.filter((x): x is string => Boolean(x)))].sort(), [paths]);
  const id = list.join('\n');
  const [links, setLinks] = useState<{ id: string; map: Record<string, string> }>({ id: '', map: {} });
  useEffect(() => {
    if (!id) return;
    let alive = true;
    signedLinks(bucket, id.split('\n')).then((map) => alive && setLinks({ id, map }));
    return () => {
      alive = false;
    };
  }, [bucket, id]);
  return links.map;
}

/* ───────── Photos sent in chats ───────── */

/** Up to 4 photos from the library, resized for chat (null if cancelled). */
export async function pickChatPhotos(): Promise<string[] | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: 4 });
  if (res.canceled || !res.assets.length) return null;
  return Promise.all(res.assets.slice(0, 4).map((a) => shrink(a.uri)));
}

/** A photo from the camera (null if cancelled; throws when permission is refused). */
export async function takeChatPhoto(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Allow the camera in your settings to take a photo');
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  if (res.canceled || !res.assets[0]) return null;
  return shrink(res.assets[0].uri);
}

/** Phone photos are 5–10 MB: 1600 px on the long side keeps them sharp in a chat. */
async function shrink(uri: string): Promise<string> {
  const small = await manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.78, format: SaveFormat.JPEG });
  return small.uri;
}

/** Uploads a chat photo under "<your id>/…" in "chat-media" and returns its stored path. */
export async function uploadChatPhoto(uri: string, name: string): Promise<string> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error('Sign in first');
  const img = imageType(uri);
  const path = `${uid}/${name}.${img.ext}`;
  const { error } = await supabase.storage.from('chat-media').upload(path, await imageBytes(uri), { contentType: img.contentType, upsert: true });
  if (error) throw new Error(/fetch|network/i.test(error.message) ? 'No connection: photo not sent' : error.message);
  return path;
}
