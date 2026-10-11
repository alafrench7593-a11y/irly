import { useEffect } from 'react';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { signedLinks } from './media';
import { useSyncVersion } from './sync';

/**
 * Members' faces, one logic for the whole app: any avatar given a member id
 * shows that member's current profile photo (or IRLY avatar). Ids asked for
 * in the same moment are fetched together (one request), links are signed in
 * one batch and shared, and a changed photo (yours, or anyone's, through the
 * "people" sync) is fetched again: a new photo has a new path, so its link and
 * the image cache are new too.
 */
type Faces = { url: Record<string, string | null> };
const useFaces = create<Faces>(() => ({ url: {} }));

const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const ids = [...pending];
  pending.clear();
  if (!supabase || !ids.length) return;
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await supabase.rpc('profile_faces', { p_ids: chunk });
    if (error) continue; // Tried again on the next sync or screen.
    const rows = (data as { id: string; photo_path: string | null }[] | null) ?? [];
    const links = await signedLinks('profile-photos', rows.map((r) => r.photo_path));
    const next: Record<string, string | null> = {};
    for (const id of chunk) next[id] = null;
    for (const r of rows) next[r.id] = r.photo_path ? (links[r.photo_path] ?? null) : null;
    useFaces.setState((s) => ({ url: { ...s.url, ...next } }));
  }
}

function want(id: string) {
  pending.add(id);
  if (!timer) timer = setTimeout(flush, 40);
}

let seenVersion = 0;
/** The face of a member (a link or an IRLY avatar string), or undefined while unknown / without photo. */
export function useFace(userId?: string | null): string | undefined {
  const url = useFaces((s) => (userId ? s.url[userId] : undefined));
  const version = useSyncVersion('people');
  useEffect(() => {
    if (!userId) return;
    // A profile changed somewhere: every face on screen is checked again, once per change.
    if (version !== seenVersion) {
      seenVersion = version;
      for (const id of Object.keys(useFaces.getState().url)) want(id);
    }
    if (!(userId in useFaces.getState().url)) want(userId);
  }, [userId, version]);
  return url ?? undefined;
}

/** Forget every face (sign-out). */
export function clearFaces() {
  useFaces.setState({ url: {} });
}
