import { supabase } from '@/lib/supabase';

/** The kind of scene, for the enhancement (a restaurant is not a beach). */
export type SceneKind = 'food' | 'outdoor' | 'sport' | 'indoor' | 'night' | 'default';
const SCENE: Record<string, SceneKind> = {
  food: 'food', sport: 'sport', outdoor: 'outdoor', beach: 'outdoor', travel: 'outdoor', animals: 'outdoor', family: 'outdoor',
  nightlife: 'night', networking: 'indoor', culture: 'indoor', creative: 'indoor', learning: 'indoor', wellness: 'indoor', shopping: 'indoor', entertainment: 'indoor',
};
export const sceneOf = (categoryId?: string | null): SceneKind => (categoryId ? (SCENE[categoryId] ?? 'default') : 'default');

/**
 * AI enhancement of a stored cover (Cloudinary, through the enhance-photo
 * function): returns the enhanced photo's path, or the original's when the
 * service is not configured or fails. The original is never changed.
 */
export async function enhanceCover(path: string, kind: SceneKind = 'default'): Promise<string> {
  if (!supabase) return path;
  try {
    const { data, error } = await supabase.functions.invoke('enhance-photo', { body: { path, kind } });
    const r = data as { enabled?: boolean; hd?: string } | null;
    return !error && r?.enabled && r.hd ? r.hd : path;
  } catch {
    return path;
  }
}

/**
 * The right version of a cover for where it is shown: the subject-aware
 * 16:10 crop for cards, the 1:1 crop for thumbnails, the full enhanced photo
 * for headers. Covers that were not enhanced have one version for all.
 */
export function coverVariant(path: string | null | undefined, use: 'card' | 'square' | 'full'): string | null {
  if (!path) return null;
  if (!path.endsWith('.hd.jpg') || use === 'full') return path;
  return path.replace(/\.hd\.jpg$/, use === 'card' ? '.c169.jpg' : '.c11.jpg');
}

