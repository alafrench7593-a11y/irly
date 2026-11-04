import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { useSplit } from '@/components/layout/responsive';
import { closeHero, useHeroStore } from '@/features/hero/heroStore';

/**
 * List + detail for a list of sessions (Activities, one activity's page).
 *
 * Wide (`split`): a tap selects a session, shown in the detail pane; with
 * nothing picked (or the pick filtered out) the first one is shown. The
 * pick lives in the address (`?s=`), so it survives the window changing
 * size, a reload and a shared link. Narrow: no selection, a tap opens the
 * session full screen as before.
 */
export function useSessionSplit(ids: string[]) {
  const split = useSplit();
  const router = useRouter();
  const focused = useIsFocused();
  const { s } = useLocalSearchParams<{ s?: string }>();
  const picked = typeof s === 'string' && ids.includes(s) ? s : null;
  const selected = split ? (picked ?? ids[0] ?? null) : null;
  const select = useCallback((id: string) => router.setParams({ s: id }), [router]);

  // Widened while one of these sessions is open full screen: it moves into the detail pane.
  const hero = useHeroStore((h) => h.item);
  const heroId = hero?.kind === 'session' && ids.includes(hero.id) ? hero.id : null;
  useEffect(() => {
    if (!split || !focused || !heroId) return;
    select(heroId);
    closeHero();
  }, [split, focused, heroId, select]);

  return { split, selected, select };
}
