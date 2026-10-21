import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { isAvatar } from '@/features/avatar/avatar';
import { faceThumb, imageBytes, imageType, prepareImage } from '@/lib/media';
import { supabase } from '@/lib/supabase';

/**
 * Stored photos, shown everywhere from the same signed links: members'
 * profile photos ("profile-photos"), covers of activities, communities and
 * chats ("activity-photos"), and photos sent in chats ("chat-media").
 * Links are cached until shortly before they expire, so a list does not ask
 * again on every render, and a new path (a changed photo) is a new link.
 */
export type Bucket = 'profile-photos' | 'activity-photos' | 'chat-media' | 'irl-media' | 'post-media' | 'verifications';

const TTL = 6 * 3600;
const cache = new Map<string, { url: string; until: number }>();
const key = (b: Bucket, p: string) => `${b}|${p}`;

export async function signedLinks(bucket: Bucket, paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const now = Date.now();
  if (cache.size > 2000) for (const [k, v] of cache) if (v.until <= now) cache.delete(k);
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

/**
 * Until when the link signedLinks() gives for this path stays usable (epoch
 * ms), or undefined when none is cached. A link can come from the cache, signed
 * hours ago for another screen: whoever keeps it must not keep it longer.
 */
export function linkUntil(bucket: Bucket, path: string | null | undefined): number | undefined {
  return path ? cache.get(key(bucket, path))?.until : undefined;
}

/**
 * A file this phone just uploaded, shown from the copy already on the phone:
 * the next signedLinks() for that path answers with the local file, so the
 * feed's reload neither downloads it again nor blanks the picture while it
 * does. A local file that fails to show is dropped with forgetLink(), and the
 * next load signs the stored one.
 */
export function seedLink(bucket: Bucket, path: string | null | undefined, local: string | null | undefined, forMs: number): void {
  if (!path || !local) return;
  cache.set(key(bucket, path), { url: local, until: Date.now() + forMs });
}

/** Drops cached links so the next signedLinks() asks for fresh ones (an expired or broken link). */
export function forgetLinks(bucket: Bucket, paths: (string | null | undefined)[]): void {
  for (const p of paths) if (p) cache.delete(key(bucket, p));
}

/**
 * Drops the cached link a signed URL came from (".../object/sign/<bucket>/<path>?token=…"),
 * so "Try again" on a media that failed to load gets a new link instead of the same one.
 */
export function forgetLink(url: string | null | undefined): void {
  if (!url) return;
  const bare = url.split(/[?#]/)[0];
  const m = bare.match(/\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/);
  if (m) {
    let path = m[2];
    try {
      path = decodeURIComponent(path);
    } catch {
      // Kept as is: the link match below still finds it.
    }
    cache.delete(key(m[1] as Bucket, path));
  }
  for (const [k, v] of cache) if (v.url === url) cache.delete(k);
}

/**
 * The stored file a link stands for ("bucket/path"), used as the image's
 * cache key on the phone: a signed link changes every few hours, the file's
 * path never does, so a photo seen once is not downloaded again. Every upload
 * gets a new path (time-stamped), so a changed photo is a new key. Undefined
 * for anything that is not a storage link.
 */
export function storedKey(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const m = url.split(/[?#]/)[0].match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/(.+)$/);
  if (!m) return undefined;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** Where the small copy (256 px) of a profile photo lives, next to it. */
export const thumbOf = (path: string) => path.replace(/(\.[a-z0-9]+)?$/i, '-s.jpg');

/**
 * The full photo a small copy was made from, for a big card (Match tiles):
 * the 256 px copy is for avatars only and would be blurry once enlarged.
 * Profile photos are stored as JPEG (cleanImage), so "<name>-s.jpg" comes
 * from "<name>.jpg". Anything else is not a small copy: undefined.
 */
export const fullOfThumb = (path: string | null | undefined): string | undefined => (path && /-s\.jpg$/i.test(path) ? path.replace(/-s\.jpg$/i, '.jpg') : undefined);

/** Stores the small copy of a profile photo next to it (best effort: avatars fall back to the photo). */
export async function uploadFaceThumb(path: string, source: string): Promise<void> {
  if (!supabase || Platform.OS === 'web') return;
  try {
    const body = await faceThumb(source);
    await supabase.storage.from('profile-photos').upload(thumbOf(path), body, { contentType: 'image/jpeg', upsert: true });
  } catch {
    // The full photo still shows.
  }
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

/**
 * Phone photos are 5–10 MB: the shared preparation (prepareImage) turns them
 * upright, keeps 1600 px on the LONG side (a portrait used to be resized by
 * its width, and a small photo was enlarged), encodes once at 0.85 and drops
 * the file's metadata (GPS position) before it is sent to the chat.
 */
async function shrink(uri: string): Promise<string> {
  return (await prepareImage(uri)).uri;
}

/** Uploads a chat photo under "<your id>/…" in "chat-media" and returns its stored path. */
export async function uploadChatPhoto(uri: string, name: string): Promise<string> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error('Sign in first');
  const img = imageType(uri);
  const path = `${uid}/${name}.${img.ext}`;
  // No upsert: the bucket has no UPDATE policy, so a retry would be refused.
  // The path is the message's own id, so "already there" is our earlier try that
  // was stored before its answer got lost.
  const { error } = await supabase.storage.from('chat-media').upload(path, await imageBytes(uri), { contentType: img.contentType, upsert: false });
  if (!error) return path;
  const status = (error as { statusCode?: string }).statusCode;
  const code = (error as { code?: string }).code;
  if (status === '409' || code === 'ResourceAlreadyExists' || /already exists|duplicate/i.test(error.message)) return path;
  // A refusal can also stand for "already there": only a file actually stored counts.
  if (/row-level|policy/i.test(error.message)) {
    const { data: stored } = await supabase.storage.from('chat-media').exists(path);
    if (stored) return path;
  }
  throw new Error(/fetch|network/i.test(error.message) ? 'No connection: photo not sent' : error.message);
}

/** Signed out or account deleted: every cached link (and local copy standing for an upload) is forgotten. */
export function clearLinkCache(): void {
  cache.clear();
}
