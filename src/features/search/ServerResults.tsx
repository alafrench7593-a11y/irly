import { useRouter } from 'expo-router';
import { cityWhen } from '@/lib/time';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useAccount } from '@/features/auth/account';
import { track } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { useSyncVersion } from '@/features/server/sync';
import { PressableScale } from '@/motion/PressableScale';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type SearchHit = { kind: 'activity' | 'community' | 'person' | 'place' | 'area' | 'city' | 'category'; id: string; title: string; subtitle: string | null; cityId: string | null; areaId: string | null; startsAt: number | null };

/** The one server search (typed, voice and assistant all use it). */
export async function searchServer(q: string, cityId: string | null, limit = 30): Promise<SearchHit[]> {
  if (!supabase || q.trim().length < 1) return [];
  const { data } = await supabase.rpc('search_all', { p_q: q.trim(), p_city: cityId, p_limit: limit });
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

const ICON: Record<SearchHit['kind'], IconName> = { activity: 'calendar', community: 'users', person: 'user', place: 'pin', area: 'map', city: 'globe', category: 'layers' };

/**
 * Live results from members (sessions, events, communities, people) and the
 * place directory, above the curated city guide. Hidden when signed out.
 */
export function ServerResults({ q, cityId }: { q: string; cityId: string }) {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const setCity = useStore((s) => s.setCity);
  // Results belong to the query that produced them (no stale list while typing).
  const [res, setRes] = useState<{ key: string; hits: SearchHit[] }>({ key: '', hits: [] });
  const uid = account?.userId;
  // A new, renamed or deleted activity or community is found (or not) at once.
  const fresh = useSyncVersion('activities') + useSyncVersion('communities');

  useEffect(() => {
    if (!uid || q.trim().length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      searchServer(q, cityId).then((h) => {
        if (!alive) return;
        setRes({ key: `${q}|${cityId}|${uid}`, hits: h });
        track('SEARCH', { results: h.length });
      });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, cityId, uid, fresh]);

  const shown = uid && q.trim().length >= 2 && res.key === `${q}|${cityId}|${uid}` ? res.hits : [];
  if (!shown.length) return null;

  const open = (h: SearchHit) => {
    if (h.kind === 'activity') router.push(`/a/${h.id}`);
    else if (h.kind === 'community') router.push(`/c/${h.id}`);
    else if (h.kind === 'category') router.push(`/category/${h.id}`);
    else if (h.kind === 'city' && setCity) setCity(h.id as never);
    // A result opens what it names; saving or adding happens there, on purpose.
    else if (h.kind === 'place') router.push(`/place/${h.id}`);
    else if (h.kind === 'person') router.push(`/person/${h.id}`);
    else router.push('/map');
  };


  return (
    <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
      <Text variant="overline" tone="tertiary">
        On IRLY now
      </Text>
      {shown.map((h) => (
        <PressableScale key={`${h.kind}-${h.id}`} onPress={() => open(h)} haptic="select" scaleTo={0.98} style={[styles.row, { backgroundColor: t.c.surface }]} accessibilityLabel={h.title}>
          <View style={[styles.icon, { backgroundColor: t.c.bg }]}>
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
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
