import { useIsFocused, useRouter } from 'expo-router';
import { cityWhen } from '@/lib/time';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { enter } from '@/motion/enter';
import Animated from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useAccount } from '@/features/auth/account';
import { track } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { useSyncVersion } from '@/features/server/sync';
import { useServerActivities } from '@/features/server/activities';
import { useCommunityList } from '@/features/community/data';
import type { CityId } from '@/data/types';
import { useAppSpace } from '@/state/appSpace';
import { PressableScale } from '@/motion/PressableScale';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';

export type SearchHit = { kind: 'activity' | 'community' | 'person' | 'place' | 'area' | 'city' | 'category'; id: string; title: string; subtitle: string | null; cityId: string | null; areaId: string | null; startsAt: number | null };

/** The one server search (typed, voice and assistant all use it). */
export async function searchServer(q: string, cityId: string | null, limit = 30): Promise<SearchHit[]> {
  if (!supabase || q.trim().length < 1) return [];
  const { data, error } = await supabase.rpc('search_all', { p_q: q.trim(), p_city: cityId, p_limit: limit });
  // Unreachable is not "nothing found".
  if (error) throw new Error(error.message);
  return ((data as Record<string, string | null>[]) ?? []).map((r) => ({
    kind: r.kind as SearchHit['kind'],
    id: r.id as string,
    title: r.title as string,
    subtitle: r.subtitle,
    cityId: r.city_id,
    areaId: r.area_id,
    startsAt: r.starts_at ? Date.parse(r.starts_at) : null,
  }));
}

/** How long changes elsewhere settle before the open search runs again. */
const REFRESH_MS = 2000;

const ICON: Record<SearchHit['kind'], IconName> = { activity: 'calendar', community: 'users', person: 'user', place: 'pin', area: 'map', city: 'globe', category: 'layers' };

/**
 * Live results from members (sessions, events, communities, people) and the
 * place directory, above the curated city guide. Hidden when signed out.
 */
export function ServerResults({ q, cityId }: { q: string; cityId: string }) {
  const inGirl = useAppSpace() === 'girl';
  return inGirl ? <GirlServerResults q={q} cityId={cityId} /> : <ResultsList q={q} cityId={cityId} />;
}

/**
 * IRLY Girl space: the plans and communities found are the women-only ones
 * (the lists IRLY Girl already shows, girl_only on the server). People,
 * places and the guide stay as found: the search does not say who is a woman.
 */
function GirlServerResults({ q, cityId }: { q: string; cityId: string }) {
  const { activities } = useServerActivities(cityId as CityId, { girlOnly: true });
  const communities = useCommunityList(cityId);
  const keep = useMemo(() => {
    const plans = new Set(activities.filter((a) => a.girlOnly).map((a) => a.id));
    const groups = new Set(communities.filter((c) => c.girlOnly).map((c) => c.id));
    return (h: SearchHit) => (h.kind === 'activity' ? plans.has(h.id) : h.kind === 'community' ? groups.has(h.id) : true);
  }, [activities, communities]);
  return <ResultsList q={q} cityId={cityId} keep={keep} />;
}

function ResultsList({ q, cityId, keep }: { q: string; cityId: string; keep?: (h: SearchHit) => boolean }) {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const setCity = useStore((s) => s.setCity);
  // Results belong to the query that produced them (no stale list while typing).
  const [res, setRes] = useState<{ key: string; hits: SearchHit[]; failed?: boolean }>({ key: '', hits: [] });
  const uid = account?.userId;
  // A new, renamed or deleted activity or community is found (or not), but a
  // burst of changes elsewhere is one search, and only while this screen is
  // in front (a hidden one catches up when it comes back).
  const focused = useIsFocused();
  const fresh = useSyncVersion('activities') + useSyncVersion('communities');
  const [seen, setSeen] = useState(fresh);
  useEffect(() => {
    if (!focused || fresh === seen) return;
    const timer = setTimeout(() => setSeen(fresh), REFRESH_MS);
    return () => clearTimeout(timer);
  }, [focused, fresh, seen]);

  useEffect(() => {
    if (!uid || q.trim().length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      searchServer(q, cityId).then(
        (h) => {
          if (!alive) return;
          setRes({ key: `${q}|${cityId}|${uid}`, hits: h });
          track('SEARCH', { results: h.length });
        },
        () => alive && setRes({ key: `${q}|${cityId}|${uid}`, hits: [], failed: true }),
      );
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, cityId, uid, seen]);

  const current = uid && q.trim().length >= 2 && res.key === `${q}|${cityId}|${uid}`;
  const shown = current ? (keep ? res.hits.filter(keep) : res.hits) : [];
  if (current && res.failed)
    return (
      <Text variant="bodyS" tone="secondary" style={{ paddingHorizontal: space.gutter }}>
        Can’t reach IRLY right now
      </Text>
    );
  if (!shown.length) return null;

  const open = (h: SearchHit) => {
    if (h.kind === 'activity') router.push(`/a/${h.id}`);
    else if (h.kind === 'community') router.push(`/c/${h.id}`);
    else if (h.kind === 'category') router.push(`/category/${h.id}`);
    else if (h.kind === 'city' && setCity) setCity(h.id as never);
    // A result opens what it names; saving or adding happens there, on purpose.
    else if (h.kind === 'place') router.push(`/place/${h.id}`);
    else if (h.kind === 'person') router.push(`/person/${h.id}`);
    // A Bali area has its own page; other areas show on the map.
    else if (h.kind === 'area' && h.cityId === 'bali') router.push(`/bali/area/${h.id}`);
    else router.push('/map');
  };


  return (
    <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
      <Text variant="overline" tone="tertiary">
        On IRLY now
      </Text>
      {shown.map((h, idx) => (
        <Animated.View key={`${h.kind}-${h.id}`} entering={enter.rise(Math.min(idx, 8))}>
          <PressableScale onPress={() => open(h)} haptic="select" scaleTo={0.98} style={[styles.row, { backgroundColor: 'transparent', overflow: 'hidden' }]} accessibilityLabel={h.title}>
            <GlassLayer radius={radius.lg} />
            <View style={[styles.icon, { backgroundColor: t.c.brandSoft }]}>
              <Icon name={ICON[h.kind]} size={18} color={t.c.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleS" numberOfLines={1}>
                {h.title}
              </Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {h.startsAt ? cityWhen(h.startsAt, h.cityId) : (h.subtitle ?? h.kind)}
                {h.areaId && h.kind === 'activity' ? ` · ${h.areaId}` : ''}
              </Text>
            </View>
            <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
          </PressableScale>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
