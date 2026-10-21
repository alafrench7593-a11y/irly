import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { setPhotoOverrides } from '@/data/photos';
import { useSyncVersion } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';

/**
 * IRLY's own photos that the team replaced from the back office
 * (public.app_photo_overrides, migration 20261027700000_irly_admin_photos):
 * read by everyone, signed out too, through app_photo_overrides_list().
 *
 * Loaded at launch (the last list known is shown first, from this phone),
 * then again whenever the app reloads its communities (coming back to the
 * app, back online, a change heard from the server), at most once a minute,
 * and at once after a change made in the back office. Each link carries the
 * photo's version: a new photo is a new link, never a cached old picture.
 * The app's own photos stay the fallback for every key without a row.
 */
const STORE = 'irly.photoOverrides.v1';
const BUCKET = 'app-photos';
const EVERY_MS = 60_000;

type Row = { key: string; path: string; version: number; updated_at: string | null };
const useOverrides = create<{ version: number; rows: Row[] }>(() => ({ version: 0, rows: [] }));

/** Moves whenever the photo overrides change: screens that resolve photo keys re-render with it. */
export const usePhotoOverridesVersion = () => useOverrides((s) => s.version);
/** The keys the team replaced, with their stored file (the back office lists them). */
export const usePhotoOverrideRows = () => useOverrides((s) => s.rows);

/** The public link of a file of the "app-photos" bucket, with its version. */
export function appPhotoUrl(path: string, version: number): string | null {
  if (!supabase) return null;
  return `${supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?v=${version}`;
}

function apply(rows: Row[]) {
  const map: Record<string, string> = {};
  for (const r of rows) {
    const url = appPhotoUrl(r.path, r.version);
    if (url) map[r.key] = url;
  }
  setPhotoOverrides(map);
  useOverrides.setState((s) => ({ version: s.version + 1, rows }));
}

const clean = (data: unknown): Row[] =>
  (Array.isArray(data) ? data : [])
    .map((r) => r as { key?: unknown; path?: unknown; version?: unknown; updated_at?: unknown })
    .filter((r) => typeof r.key === 'string' && typeof r.path === 'string')
    .map((r) => ({ key: r.key as string, path: r.path as string, version: Number(r.version ?? 0), updated_at: typeof r.updated_at === 'string' ? r.updated_at : null }));

let lastLoad = 0;
let loading: Promise<void> | null = null;

/** Reads the overrides from the server (force: now, even if read less than a minute ago). */
export function refreshPhotoOverrides(force = false): Promise<void> {
  const sb = supabase;
  if (!sb) return Promise.resolve();
  if (loading) return loading;
  if (!force && Date.now() - lastLoad < EVERY_MS) return Promise.resolve();
  lastLoad = Date.now();
  loading = (async () => {
    try {
      const { data, error } = await sb.rpc('app_photo_overrides_list');
      // Not reachable (offline, older server): the list already shown stays.
      if (error) return;
      const rows = clean(data);
      apply(rows);
      AsyncStorage.setItem(STORE, JSON.stringify(rows)).catch(() => undefined);
    } finally {
      loading = null;
    }
  })();
  return loading;
}

let started = false;
/** Mounted once at the root: the list known on this phone first, then the server's, then on every sync. */
export function PhotoOverridesBridge() {
  const v = useSyncVersion('communities');
  const first = useRef(true);
  useEffect(() => {
    if (!supabase || started) return;
    started = true;
    AsyncStorage.getItem(STORE)
      .then((raw) => {
        // The server's answer, if it came first, wins.
        if (raw && useOverrides.getState().version === 0) apply(clean(JSON.parse(raw)));
      })
      .catch(() => undefined)
      .finally(() => void refreshPhotoOverrides(true));
  }, []);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void refreshPhotoOverrides();
  }, [v]);
  return null;
}
