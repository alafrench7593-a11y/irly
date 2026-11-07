import { useEffect, useState } from 'react';
import { useSyncVersion } from '@/features/server/sync';
import type { UniverseRow } from '@/features/universe/universe';
import { supabase } from '@/lib/supabase';

/** What a list that only knows communities by id needs: its photo and its universe. */
export type CommunityFacts = UniverseRow & { name: string | null; coverPath: string | null };

/**
 * The photo and the universe of communities a list only knows by id (search
 * results): one read for all, under the communities' row security (a
 * community the member may not see is simply absent). Asked again when a
 * community changes; the answer kept meanwhile (no flash of the app's photo).
 */
export function useCommunityFacts(ids: string[]): { facts: Record<string, CommunityFacts>; ready: boolean } {
  const [state, setState] = useState<{ list: string; facts: Record<string, CommunityFacts> }>({ list: '', facts: {} });
  const v = useSyncVersion('communities');
  const list = [...new Set(ids)].sort().join(',');
  useEffect(() => {
    if (!supabase || !list) return;
    let alive = true;
    supabase
      .from('communities')
      .select('id, name, cover_path, topic, category_id, girl_only')
      .in('id', list.split(','))
      .then(({ data, error }) => {
        // Not read (offline): what is known stays.
        if (!alive || error) return;
        const facts: Record<string, CommunityFacts> = {};
        for (const r of (data ?? []) as { id: string; name: string | null; cover_path: string | null; topic: string | null; category_id: string | null; girl_only: boolean | null }[]) {
          facts[r.id] = { name: r.name, coverPath: r.cover_path, topic: r.topic, categoryId: r.category_id, girlOnly: Boolean(r.girl_only) };
        }
        setState({ list, facts });
      }, () => undefined);
    return () => {
      alive = false;
    };
  }, [list, v]);
  return { facts: state.facts, ready: !list || state.list === list };
}
