import * as ImagePicker from 'expo-image-picker';
import { DEMO } from '@/config/app';
import { pickPhoto } from '@/features/server/covers';
import { cleanImage, imageBytes } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import type { AppSpace } from '@/state/appSpace';
import { staleHomeFeeds, refreshHomeFeed, type CmsAudience, type NewsCategory } from './feed';
import type { LayoutEntry } from './layout';
import { layoutForServer } from './layout';

/**
 * The editorial back office as the server exposes it (migration
 * 20261028200000_irly_admin_cms): news, the Home layout and banners. Every
 * call is checked by the server against the caller's staff role (content
 * staff and above) and written to the staff journal; the app only decides
 * what to show. The demo build answers from features/cms/demo.
 */
export type NewsState = 'draft' | 'scheduled' | 'published' | 'unpublished';
export type AdminNews = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string;
  cover_path: string | null;
  cover_key: string | null;
  gallery_paths: string[];
  video_path: string | null;
  category: NewsCategory;
  status: 'draft' | 'published' | 'unpublished';
  state: NewsState;
  publish_at: string | null;
  audience: CmsAudience;
  position: number;
  cta_label: string | null;
  cta_url: string | null;
  notify: boolean;
  notified_at: string | null;
  went_live_at: string | null;
  updated_at: string;
};
export type NewsDraft = Partial<Pick<AdminNews, 'title' | 'subtitle' | 'body' | 'cover_path' | 'cover_key' | 'gallery_paths' | 'video_path' | 'category' | 'audience' | 'cta_label' | 'cta_url' | 'notify'>>;

export type AdminBanner = {
  id: string;
  title: string;
  body: string | null;
  image_path: string | null;
  image_key: string | null;
  cta_label: string | null;
  cta_url: string | null;
  audience: CmsAudience;
  placement: 'home';
  position: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};
export type BannerDraft = Partial<Omit<AdminBanner, 'id' | 'placement' | 'position'>>;

export type AdminLayout = {
  flavour: AppSpace;
  draft: unknown[];
  published: unknown[];
  version: number;
  draft_updated_at: string | null;
  published_at: string | null;
  versions: { version: number; published_at: string }[];
};

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (DEMO && !supabase) return (await import('./demo')).demoCms(fn, args) as T;
  if (!supabase) throw new Error('Not connected');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** After a change members can see: every Home reads its feed again on its next look (this one at once). */
async function touched<T>(p: Promise<T>): Promise<T> {
  const out = await p;
  staleHomeFeeds();
  void refreshHomeFeed('mixte', true);
  return out;
}

export const loadAdminNews = () => call<AdminNews[]>('admin_news_list');
export const loadAdminNewsItem = (id: string) => call<AdminNews>('admin_news_get', { p_id: id });
export const saveNews = (id: string | null, draft: NewsDraft) => touched(call<string>('admin_news_save', { p_id: id, p_news: draft }));
export const publishNews = (id: string, at: Date | null = null) => touched(call<AdminNews>('admin_news_publish', { p_id: id, p_at: at ? at.toISOString() : null }));
export const unpublishNews = (id: string) => touched(call<AdminNews>('admin_news_unpublish', { p_id: id }));
export const deleteNews = (id: string) => touched(call<void>('admin_news_delete', { p_id: id }));
export const reorderNews = (ids: string[]) => touched(call<void>('admin_news_reorder', { p_ids: ids }));

export const loadBanners = () => call<AdminBanner[]>('admin_banner_list');
export const saveBanner = (id: string | null, draft: BannerDraft) => touched(call<string>('admin_banner_save', { p_id: id, p_banner: draft }));
export const reorderBanners = (ids: string[]) => touched(call<void>('admin_banner_reorder', { p_ids: ids }));
export const deleteBanner = (id: string) => touched(call<void>('admin_banner_delete', { p_id: id }));

export const loadLayout = (flavour: AppSpace) => call<AdminLayout>('admin_home_layout_get', { p_flavour: flavour });
export const saveLayoutDraft = (flavour: AppSpace, entries: LayoutEntry[]) =>
  call<unknown[]>('admin_home_layout_save_draft', { p_flavour: flavour, p_config: layoutForServer(entries) });
export const publishLayout = (flavour: AppSpace) => touched(call<number>('admin_home_layout_publish', { p_flavour: flavour }));
export const restoreLayout = (flavour: AppSpace, version: number | null) => call<unknown[]>('admin_home_layout_restore', { p_flavour: flavour, p_version: version });

/** Largest photo the team sends (after cleanImage re-encodes it as a JPEG of 1600 px at most). */
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
/** Largest video: the bucket's limit, the one posts already use (25 MB). */
const VIDEO_MAX_BYTES = 25 * 1024 * 1024;

export type UploadStep = 'checking' | 'uploading';

/**
 * A picked file sent to the staff member's own folder of "cms-media" under
 * a new name: every news item and banner owns its files, so changing one
 * never changes another (nor any of IRLY's own photos). Photos are decoded
 * and re-encoded first (no EXIF, no location). Returns the stored path; the
 * demo keeps the picked file's local link instead (nothing leaves the phone).
 */
export async function uploadCmsFile(uri: string, kind: 'photo' | 'video', onStep?: (s: UploadStep) => void): Promise<string> {
  if (DEMO && !supabase) return uri;
  if (!supabase) throw new Error('Not connected');
  onStep?.('checking');
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error('Sign in first');
  let body: ArrayBuffer;
  let ext: string;
  let contentType: string;
  if (kind === 'photo') {
    const img = await cleanImage(uri).catch(() => {
      throw new Error('This file is not a photo IRLY can use');
    });
    if (img.body.byteLength > PHOTO_MAX_BYTES) throw new Error('This photo is too large');
    ({ body, ext, contentType } = img);
  } else {
    body = await imageBytes(uri);
    if (body.byteLength > VIDEO_MAX_BYTES) throw new Error('This video is too large (25 MB at most)');
    const mov = /\.mov(?:[?#].*)?$/i.test(uri) || /^data:video\/quicktime/i.test(uri);
    ext = mov ? 'mov' : 'mp4';
    contentType = mov ? 'video/quicktime' : 'video/mp4';
  }
  const path = `${uid}/${Date.now()}.${ext}`;
  onStep?.('uploading');
  const { error } = await supabase.storage.from('cms-media').upload(path, body, { contentType });
  if (error) throw new Error('Could not upload the file');
  return path;
}

/** A photo from the library, cropped (16:10) where the phone's picker allows it. */
export const pickCmsPhoto = () => pickPhoto();

/** A video from the library (null if cancelled). */
export async function pickCmsVideo(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
  if (res.canceled || !res.assets[0]) return null;
  return res.assets[0].uri;
}
