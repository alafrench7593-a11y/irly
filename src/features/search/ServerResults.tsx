import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useAccount } from '@/features/auth/account';
import { toggleSave } from '@/features/server/engage';
import { addFriend } from '@/features/server/social';
import { track } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
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
const when = (ms: number) => new Date(ms).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Live results from members (sessions, events, communities, people) and the
 * place directory, above the curated city guide. Hidden when signed out.
 */
export function ServerResults({ q, cityId }: { q: string; cityId: string }) {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const setCity = useStore((s) => s.setCity);
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (!account || q.trim().length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      searchServer(q, cityId).then((h) => {
        if (!alive) return;
        setHits(h);
        track('SEARCH', { results: h.length });
      });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, cityId, account]);

  const shown = account && q.trim().length >= 2 ? hits : [];
  if (!shown.length) return null;

  const open = (h: SearchHit) => {
    if (h.kind === 'activity') router.push(`/a/${h.id}`);
    else if (h.kind === 'community') router.push(`/c/${h.id}`);
    else if (h.kind === 'category') router.push(`/category/${h.id}`);
    else if (h.kind === 'city' && setCity) setCity(h.id as never);
    else if (h.kind === 'place')
      toggleSave({ type: 'place', id: h.id })
        .then((saved) => toast(saved ? `${h.title} saved` : 'Removed from saved', 'bookmark', 'brand'))
        .catch(() => undefined);
    else if (h.kind === 'person')
      addFriend(h.id)
        .then(() => toast('Friend request sent', 'user', 'brand'))
        .catch((e) => toast(e instanceof Error ? e.message : 'Could not add', 'x', 'live'));
    else router.push('/map');
  };

  const action: Partial<Record<SearchHit['kind'], string>> = { place: 'Save', person: 'Add' };

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
              {h.startsAt ? when(h.startsAt) : (h.subtitle ?? h.kind)}
              {h.areaId && h.kind === 'activity' ? ` · ${h.areaId}` : ''}
            </Text>
          </View>
          {action[h.kind] ? (
            <Text variant="label" tone="secondary">
              {action[h.kind]}
            </Text>
          ) : (
            <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
          )}
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
