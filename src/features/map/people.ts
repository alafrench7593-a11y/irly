import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO } from '@/config/app';
import { useAccount } from '@/features/auth/account';
import { useRefreshOn } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';
import { useAppSpace } from '@/state/appSpace';
import type { MapPersonRow } from './markers';

/**
 * Members on the map: only those who chose to appear (Privacy settings),
 * that the viewer may see, as the server decides (map_people: opt-in,
 * profile visibility, blocks, sanctions, IRLY Girl access). The server
 * gives a neighbourhood, never a position: nothing finer can be shown.
 * In IRLY Girl: women with IRLY Girl access who chose the IRLY Girl map.
 * The demonstration build shows its example members instead (no server).
 */
export function useMapPeople(cityId: string): { list: MapPersonRow[]; ready: boolean } {
  const uid = useAccount()?.userId;
  const girl = useAppSpace() === 'girl';
  const key = `${uid}|${cityId}|${girl}`;
  const [state, setState] = useState<{ key: string; list: MapPersonRow[] }>({ key: '', list: [] });
  const seq = useRef(0);
  const load = useCallback(() => {
    if (DEMO || !uid || !supabase) return;
    const n = ++seq.current;
    supabase.rpc('map_people', { p_city: cityId, p_girl: girl, p_limit: 200 }).then(
      ({ data, error }) => {
        if (n !== seq.current) return;
        // Server not updated yet, offline, or IRLY Girl refused: nobody (never a guess).
        if (error) return setState({ key, list: [] });
        setState({
          key,
          list: ((data as Record<string, unknown>[] | null) ?? []).flatMap((r) =>
            r.user_id && r.area_id && r.city_id
              ? [
                  {
                    id: r.user_id as string,
                    firstName: (r.first_name as string | null) ?? '',
                    username: (r.username as string | null) ?? null,
                    cityId: r.city_id as string,
                    areaId: r.area_id as string,
                    verified: Boolean(r.verified),
                  },
                ]
              : [],
          ),
        });
      },
      () => n === seq.current && setState({ key, list: [] }),
    );
  }, [uid, cityId, girl, key]);
  useEffect(load, [load]);
  // Someone appears, leaves, changes name or photo, a block: the map follows.
  useRefreshOn(['people', 'friends'], load);
  if (DEMO || !uid || !supabase) return { list: [], ready: true };
  return state.key === key ? { list: state.list, ready: true } : { list: [], ready: false };
}
