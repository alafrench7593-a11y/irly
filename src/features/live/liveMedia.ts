import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { prepareImage } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { mediaKey, mediaRatio, rememberRatio } from './liveRatio';

/**
 * Photos and videos for the Live. A video is checked before anything is sent
 * (length and size, against the server's own limit), gets a poster image so
 * the feed never downloads videos to show them, and is uploaded with a
 * progress bar. The post only exists once the files are stored and the row
 * is saved: nothing is shown as published from the phone alone.
 */
export type LiveMedia = {
  kind: 'photo' | 'video';
  uri: string;
  seconds?: number;
  poster?: string;
  type?: string;
  /** Width / height of the picture as it is shown (upright), when known. */
  ratio?: number;
};

/** The irl-media bucket accepts 25 MB per file; a Live clip is short. */
export const VIDEO_MAX_SECONDS = 60;
export const VIDEO_MAX_BYTES = 25 * 1024 * 1024;
/** An upload with no progress for this long is given up (the member is told and can try again). */
const UPLOAD_IDLE_MS = 60_000;

export async function pickLiveMedia(kind: 'photo' | 'video'): Promise<LiveMedia | null> {
  const res = await ImagePicker.launchImageLibraryAsync(
    kind === 'photo'
      ? // No forced crop (iOS only crops square) and no re-encoding here: the
        // photo keeps its own shape and is encoded once, by prepareImage.
        { mediaTypes: ['images'], quality: 1, allowsEditing: false }
      : { mediaTypes: ['videos'], videoMaxDuration: VIDEO_MAX_SECONDS, videoQuality: ImagePicker.UIImagePickerControllerQualityType.High, allowsEditing: true },
  );
  const a = res.canceled ? null : res.assets[0];
  if (!a) return null;
  if (kind === 'photo') return { kind, uri: a.uri, ratio: mediaRatio(a.width, a.height) ?? undefined };
  const seconds = a.duration ? Math.round(a.duration / 1000) : undefined;
  if (seconds && seconds > VIDEO_MAX_SECONDS) throw new Error(`Videos can last ${VIDEO_MAX_SECONDS} seconds at most. Trim it and try again.`);
  if (a.fileSize && a.fileSize > VIDEO_MAX_BYTES) throw new Error('This video is over 25 MB. Pick a shorter one or trim it.');
  // The server keeps MP4 and MOV only: any other format is refused here with a clear reason, not after the upload.
  const picked = (a.mimeType ?? (a.uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4')).toLowerCase();
  const type = picked === 'video/x-m4v' ? 'video/mp4' : picked;
  if (type !== 'video/mp4' && type !== 'video/quicktime') throw new Error('This video format is not supported. Pick an MP4 or MOV video.');
  const poster = await posterOf(a.uri);
  // The still is upright (the video's rotation applied): its shape is the video's as played.
  const ratio = mediaRatio(poster?.width, poster?.height) ?? mediaRatio(a.width, a.height) ?? undefined;
  return { kind, uri: a.uri, seconds, poster: poster?.uri, type, ratio };
}

/**
 * A still from the first second of the video (phones only; the web shows a
 * plain tile). Taken at 0.9: it is encoded again once by prepareImage (0.85)
 * before upload, and two strong compressions in a row band the gradients.
 */
async function posterOf(uri: string): Promise<{ uri: string; width: number; height: number } | undefined> {
  if (Platform.OS === 'web') return undefined;
  try {
    const { getThumbnailAsync } = await import('expo-video-thumbnails');
    return await getThumbnailAsync(uri, { time: 500, quality: 0.9 });
  } catch {
    return undefined;
  }
}

/** A Live's files, ready to upload: the photo (or the video's poster) cleaned and sized once. */
export type PreparedLive = {
  /** The photo to upload (JPEG), or the video's poster (JPEG) when there is one. */
  image?: { uri: string; width: number; height: number };
  ratio?: number;
};

const prepared = new Map<string, Promise<PreparedLive>>();

/**
 * Starts preparing a picked photo or video as soon as it is picked (while the
 * member writes), so tapping Post only uploads. Same media, same promise; a
 * failure is forgotten so the next try starts again.
 */
export function prepareLiveMedia(media: LiveMedia): Promise<PreparedLive> {
  const key = `${media.kind}|${media.uri}`;
  const hit = prepared.get(key);
  if (hit) return hit;
  const source = media.kind === 'photo' ? media.uri : media.poster;
  const job = (async (): Promise<PreparedLive> => {
    if (!source) return { ratio: media.ratio };
    const image = await prepareImage(source);
    const ratio = mediaRatio(image.width, image.height) ?? media.ratio;
    rememberRatio(image.uri, ratio);
    return { image: { uri: image.uri, width: image.width, height: image.height }, ratio };
  })();
  if (prepared.size > 8) prepared.clear();
  prepared.set(key, job);
  job.catch(() => prepared.delete(key));
  return job;
}

/**
 * Uploads a file (irl-media, or post-media for publications) with progress (0 → 1). Phones send it straight
 * from disk through a signed upload link (no copy in memory); the web uses
 * the regular upload.
 */
export async function uploadLiveFile(path: string, uri: string, type: string, onProgress?: (p: number) => void, bucket: 'irl-media' | 'post-media' = 'irl-media'): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: type });
    if (error) throw new Error(error.message);
    onProgress?.(1);
    return;
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? 'Could not start the upload');
  // Progress events come for every chunk sent (hundreds for a video), each one re-rendering
  // the composer: only a new whole percent is passed on (at most 100 renders).
  let shown = -1;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // Given up when nothing moves for a minute, not after a fixed total: a 25 MB video on a
    // slow uplink (1 Mbit/s: 200 s) is still sending, and used to be cut at 180 s every time.
    let idle: ReturnType<typeof setTimeout> | null = null;
    let done = false;
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      if (idle) clearTimeout(idle);
      if (err) reject(err);
      else resolve();
    };
    const watch = () => {
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => {
        xhr.abort();
        finish(new Error('IRLY did not answer in time. Check your connection and try again.'));
      }, UPLOAD_IDLE_MS);
    };
    xhr.open('PUT', data.signedUrl);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      watch();
      if (!e.lengthComputable || !e.total || !onProgress) return;
      const pct = Math.floor((e.loaded / e.total) * 100);
      if (pct === shown) return;
      shown = pct;
      onProgress(pct / 100);
    };
    xhr.onload = () => finish(xhr.status >= 200 && xhr.status < 300 ? undefined : new Error(xhr.status === 413 ? 'This file is too large.' : `Upload failed (${xhr.status}). Try again.`));
    xhr.onerror = () => finish(new Error('No connection: try again'));
    xhr.onabort = () => finish(new Error('IRLY did not answer in time. Check your connection and try again.'));
    const form = new FormData();
    form.append('cacheControl', '3600');
    // React Native reads the file from disk itself.
    form.append('file', { uri, name: path.split('/').pop() ?? 'file', type } as unknown as Blob);
    watch();
    xhr.send(form);
  });
  onProgress?.(1);
}

/** Signed out or account deleted: photos prepared for a Live are forgotten. */
export function clearLiveCache(): void {
  prepared.clear();
  warmed.clear();
}

const warmed = new Set<string>();
const WARM_MAX = 8;
const WARM_AT_ONCE = 2;

/**
 * Starts downloading the feed's photos and video posters into the image disk
 * cache as soon as the feed is known (Home reads it for its Live strip), under
 * the key LivePhoto and LiveVideo show them with (mediaKey): opening Live then
 * shows them from the phone instead of starting every download only when the
 * cards appear. Phones only; the newest few, two at a time; each picture is
 * released once stored. Best effort: a failure leaves it to the card.
 */
export function warmLiveImages(urls: (string | null | undefined)[]): void {
  if (Platform.OS === 'web') return;
  const todo = urls.filter((u): u is string => typeof u === 'string' && /^https?:/i.test(u) && !warmed.has(mediaKey(u))).slice(0, WARM_MAX);
  if (!todo.length) return;
  for (const u of todo) warmed.add(mediaKey(u));
  if (warmed.size > 300) warmed.clear();
  const next = async (): Promise<void> => {
    const url = todo.shift();
    if (!url) return;
    try {
      const ref = await Image.loadAsync({ uri: url, cacheKey: mediaKey(url) });
      ref.release();
    } catch {
      warmed.delete(mediaKey(url));
    }
    return next();
  };
  for (let i = 0; i < WARM_AT_ONCE; i++) void next();
}
