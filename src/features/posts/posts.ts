import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { storageName } from '@/config/app';
import { pickLiveMedia, uploadLiveFile } from '@/features/live/liveMedia';
import { changed } from '@/features/server/sync';
import { cleanImage } from '@/lib/media';
import { supabase } from '@/lib/supabase';

/**
 * Publications: a text, photos (up to 10) or a video, posted on the
 * member's profile or in a community. They are community_posts rows (a
 * profile post has no community), so comments, likes, saves, reports and
 * moderation work as everywhere else. Files go to the private post-media
 * bucket, in the author's own folder.
 */
export const MAX_PHOTOS = 10;

/** A file of a post being written: already stored (path) or picked on the phone (uri). */
export type DraftFile = { path?: string; uri?: string; type?: string };
export type DraftMedia = { kind: 'photo'; files: DraftFile[] } | { kind: 'video'; files: [DraftFile]; poster?: string; posterPath?: string; seconds?: number };

/** Photos from the library (several at once). */
export async function pickPhotos(room: number): Promise<DraftFile[]> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: Math.max(1, room), orderedSelection: true });
  if (res.canceled) return [];
  return res.assets.slice(0, room).map((a) => ({ uri: a.uri }));
}

/** One video (60 s, 25 MB at most, checked before anything is sent). */
export async function pickVideo(): Promise<DraftMedia | null> {
  const m = await pickLiveMedia('video');
  if (!m) return null;
  return { kind: 'video', files: [{ uri: m.uri, type: m.type }], poster: m.poster, seconds: m.seconds };
}

type Stored = { media_paths: string[]; media_kind: 'photo' | 'video' | null; thumb_path: string | null; media_seconds: number | null };

/** Sends the picked files (photos cleaned of their metadata) and returns what the post row keeps. */
async function store(uid: string, media: DraftMedia | null, onProgress?: (p: number) => void): Promise<{ row: Stored; fresh: string[] }> {
  if (!media || !media.files.length) return { row: { media_paths: [], media_kind: null, thumb_path: null, media_seconds: null }, fresh: [] };
  const sb = supabase!;
  const stamp = Date.now();
  const fresh: string[] = [];
  try {
    if (media.kind === 'photo') {
      const paths: string[] = [];
      for (const [i, f] of media.files.entries()) {
        if (f.path) {
          paths.push(f.path);
          continue;
        }
        const img = await cleanImage(f.uri!);
        const path = `${uid}/${stamp}-${i}.${img.ext}`;
        const { error } = await sb.storage.from('post-media').upload(path, img.body, { contentType: img.contentType });
        if (error) throw new Error('A photo could not be sent. Try again.');
        fresh.push(path);
        paths.push(path);
        onProgress?.((i + 1) / media.files.length);
      }
      return { row: { media_paths: paths, media_kind: 'photo', thumb_path: null, media_seconds: null }, fresh };
    }
    const f = media.files[0];
    let path = f.path;
    let thumb = media.posterPath ?? null;
    if (!path) {
      path = `${uid}/${stamp}-video.${(f.type ?? '').includes('quicktime') ? 'mov' : 'mp4'}`;
      if (media.poster) {
        const img = await cleanImage(media.poster);
        const p = `${uid}/${stamp}-poster.${img.ext}`;
        const { error } = await sb.storage.from('post-media').upload(p, img.body, { contentType: img.contentType });
        if (!error) {
          thumb = p;
          fresh.push(p);
        }
      }
      await uploadLiveFile(path, f.uri!, f.type ?? 'video/mp4', onProgress, 'post-media');
      fresh.push(path);
    }
    return { row: { media_paths: [path], media_kind: 'video', thumb_path: thumb, media_seconds: media.seconds ?? null }, fresh };
  } catch (e) {
    if (fresh.length) await sb.storage.from('post-media').remove(fresh);
    throw e;
  }
}

const friendly = (msg: string) =>
  /row-level|policy/i.test(msg) ? 'Join the community to post' : /slow down|rate/i.test(msg) ? 'Slow down a little' : /author''s own files|own files/i.test(msg) ? 'This file cannot be used' : msg;

/** Publishes a post (profile when no community). Files already sent are removed if the post is refused. */
export async function createPost(input: { communityId: string | null; body: string; media: DraftMedia | null; kind?: 'post' | 'question' | 'recommendation'; category?: string | null; onProgress?: (p: number) => void }): Promise<string> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { data: auth } = await supabase.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) throw new Error('Sign in to post');
  const body = input.body.trim();
  if (!body && !input.media?.files.length) throw new Error('Write something or add a photo');
  const { row, fresh } = await store(uid, input.media, input.onProgress);
  const { data, error } = await supabase.from('community_posts').insert({ community_id: input.communityId, author_id: uid, body, kind: input.kind ?? 'post', ...(input.communityId && input.category ? { category: input.category } : {}), ...row }).select('id').single();
  if (error || !data) {
    if (fresh.length) await supabase.storage.from('post-media').remove(fresh);
    throw new Error(friendly(error?.message ?? 'Could not post'));
  }
  changed('communities');
  return (data as { id: string }).id;
}

/** Saves the author's changes (text and media); files no longer used are removed. */
export async function updatePost(id: string, input: { body: string; media: DraftMedia | null; before: string[]; onProgress?: (p: number) => void }): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { data: auth } = await supabase.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) throw new Error('Sign in to edit');
  const body = input.body.trim();
  if (!body && !input.media?.files.length) throw new Error('Write something or add a photo');
  const { row, fresh } = await store(uid, input.media, input.onProgress);
  const { error } = await supabase.from('community_posts').update({ body, ...row }).eq('id', id).eq('author_id', uid);
  if (error) {
    if (fresh.length) await supabase.storage.from('post-media').remove(fresh);
    throw new Error(friendly(error.message));
  }
  const kept = new Set([...row.media_paths, row.thumb_path ?? '']);
  const gone = input.before.filter((p) => !kept.has(p));
  if (gone.length) await supabase.storage.from('post-media').remove(gone);
  changed('communities');
}

/** Removes a post (the author, or a moderator of its community). */
export async function removePost(id: string): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { error } = await supabase.from('community_posts').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  changed('communities');
}

/** A post as stored, for editing. */
export async function loadPost(id: string): Promise<{ body: string; communityId: string | null; media: DraftMedia | null; files: string[] } | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('community_posts').select('body, community_id, media_paths, media_kind, thumb_path, media_seconds').eq('id', id).maybeSingle();
  if (!data) return null;
  const r = data as { body: string; community_id: string | null; media_paths: string[] | null; media_kind: 'photo' | 'video' | null; thumb_path: string | null; media_seconds: number | null };
  const paths = r.media_paths ?? [];
  const media: DraftMedia | null = !paths.length
    ? null
    : r.media_kind === 'video'
      ? { kind: 'video', files: [{ path: paths[0] }], posterPath: r.thumb_path ?? undefined, seconds: r.media_seconds ?? undefined }
      : { kind: 'photo', files: paths.map((p) => ({ path: p })) };
  return { body: r.body, communityId: r.community_id, media, files: [...paths, ...(r.thumb_path ? [r.thumb_path] : [])] };
}

/**
 * Drafts kept on the phone, one per place (profile or a community): leaving
 * the composer without posting keeps the words and picked photos for next time.
 */
type Draft = { body: string; media: DraftMedia | null; at: number };
type Drafts = { byKey: Record<string, Draft>; save: (key: string, d: Draft | null) => void };
export const useDrafts = create<Drafts>()(
  persist(
    (set) => ({
      byKey: {},
      save: (key, d) =>
        set((s) => {
          const next = { ...s.byKey };
          if (d) next[key] = d;
          else delete next[key];
          return { byKey: next };
        }),
    }),
    { name: storageName('irly-post-drafts'), storage: createJSONStorage(() => AsyncStorage) },
  ),
);
export const draftKey = (communityId: string | null) => communityId ?? 'profile';
