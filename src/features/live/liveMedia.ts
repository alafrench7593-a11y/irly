import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

/**
 * Photos and videos for the Live. A video is checked before anything is sent
 * (length and size, against the server's own limit), gets a poster image so
 * the feed never downloads videos to show them, and is uploaded with a
 * progress bar. The post only exists once the files are stored and the row
 * is saved: nothing is shown as published from the phone alone.
 */
export type LiveMedia = { kind: 'photo' | 'video'; uri: string; seconds?: number; poster?: string; type?: string };

/** The irl-media bucket accepts 25 MB per file; a Live clip is short. */
export const VIDEO_MAX_SECONDS = 60;
export const VIDEO_MAX_BYTES = 25 * 1024 * 1024;

export async function pickLiveMedia(kind: 'photo' | 'video'): Promise<LiveMedia | null> {
  const res = await ImagePicker.launchImageLibraryAsync(
    kind === 'photo'
      ? { mediaTypes: ['images'], quality: 0.9, allowsEditing: true }
      : { mediaTypes: ['videos'], videoMaxDuration: VIDEO_MAX_SECONDS, videoQuality: ImagePicker.UIImagePickerControllerQualityType.High, allowsEditing: true },
  );
  const a = res.canceled ? null : res.assets[0];
  if (!a) return null;
  if (kind === 'photo') return { kind, uri: a.uri };
  const seconds = a.duration ? Math.round(a.duration / 1000) : undefined;
  if (seconds && seconds > VIDEO_MAX_SECONDS) throw new Error(`Videos can last ${VIDEO_MAX_SECONDS} seconds at most. Trim it and try again.`);
  if (a.fileSize && a.fileSize > VIDEO_MAX_BYTES) throw new Error('This video is over 25 MB. Pick a shorter one or trim it.');
  return { kind, uri: a.uri, seconds, poster: await posterOf(a.uri), type: a.mimeType ?? (a.uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4') };
}

/** A still from the first second of the video (phones only; the web shows a plain tile). */
async function posterOf(uri: string): Promise<string | undefined> {
  if (Platform.OS === 'web') return undefined;
  try {
    const { getThumbnailAsync } = await import('expo-video-thumbnails');
    return (await getThumbnailAsync(uri, { time: 500, quality: 0.7 })).uri;
  } catch {
    return undefined;
  }
}

/**
 * Uploads a file to irl-media with progress (0 → 1). Phones send it straight
 * from disk through a signed upload link (no copy in memory); the web uses
 * the regular upload.
 */
export async function uploadLiveFile(path: string, uri: string, type: string, onProgress?: (p: number) => void): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const { error } = await supabase.storage.from('irl-media').upload(path, blob, { contentType: type });
    if (error) throw new Error(error.message);
    onProgress?.(1);
    return;
  }
  const { data, error } = await supabase.storage.from('irl-media').createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? 'Could not start the upload');
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', data.signedUrl);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.timeout = 180_000;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.status === 413 ? 'This file is too large.' : `Upload failed (${xhr.status}). Try again.`)));
    xhr.onerror = () => reject(new Error('No connection: try again'));
    xhr.ontimeout = () => reject(new Error('IRLY did not answer in time. Check your connection and try again.'));
    const form = new FormData();
    form.append('cacheControl', '3600');
    // React Native reads the file from disk itself.
    form.append('file', { uri, name: path.split('/').pop() ?? 'file', type } as unknown as Blob);
    xhr.send(form);
  });
  onProgress?.(1);
}
