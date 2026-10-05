import { useEffect } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { DestinationPill } from '@/components/navigation/Headers';
import { Chip } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import type { MapPoint } from '@/data/types';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { blur, motion, spring } from '@/motion/tokens';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { MapMarkerData, MarkerType } from './markers';

export type Layer = 'all' | MarkerType;

export const LAYERS: { id: Layer; label: string; icon: IconName }[] = [
  { id: 'all', label: 'All', icon: 'layers' },
  { id: 'live', label: 'Live', icon: 'zap' },
  { id: 'activity', label: 'Activities', icon: 'activity' },
  { id: 'event', label: 'Events', icon: 'ticket' },
  { id: 'person', label: 'People', icon: 'users' },
  { id: 'group', label: 'Groups', icon: 'heartHandshake' },
  { id: 'place', label: 'Places', icon: 'pin' },
];

export type SearchResult = { id: string; title: string; sub: string; point: MapPoint; areaId?: string; marker: MapMarkerData | null };

/** Search results for the map: neighbourhoods first, then anything placed on it. */
export function searchMap(query: string, areas: { id: string; name: string; point: MapPoint }[], all: MapMarkerData[]): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: SearchResult[] = areas
    .filter((a) => a.name.toLowerCase().includes(q))
    .map((a) => ({ id: a.id, title: a.name, sub: 'Neighbourhood', point: a.point, areaId: a.id, marker: null }));
  const things: SearchResult[] = all
    .filter((m) => m.title.toLowerCase().includes(q))
    .map((m) => ({ id: m.id, title: m.title, sub: m.subtitle, point: m.point, areaId: m.areaId, marker: m }));
  return [...hits, ...things].slice(0, 6);
}

/**
 * Floating top of the map: search and destination, then either the search
 * results or the layer chips. Arrives after the map, stays put in 2D and 3D.
 */
export function MapTopBar({
  top,
  cityName,
  query,
  onQuery,
  results,
  onResult,
  layer,
  onLayer,
  onDestination,
}: {
  top: number;
  cityName: string;
  query: string;
  onQuery: (q: string) => void;
  results: SearchResult[];
  onResult: (r: SearchResult) => void;
  layer: Layer;
  onLayer: (l: Layer) => void;
  onDestination: () => void;
}) {
  const t = useTheme();
  return (
    <Animated.View entering={enter.fade(0, 120)} style={[styles.top, { paddingTop: top }]} pointerEvents="box-none">
      <View style={styles.searchRow}>
        <Glass style={[styles.search, { boxShadow: t.shadow.card }]} intensity={blur.medium}>
          <Icon name="search" size={18} color={t.c.textSecondary} />
          <TextInput
            value={query}
            onChangeText={onQuery}
            placeholder={`Search ${cityName}`}
            placeholderTextColor={t.c.textTertiary}
            selectionColor={t.c.text}
            style={[styles.searchInput, { color: t.c.text }]}
            accessibilityLabel="Search the map"
            returnKeyType="search"
          />
          {query ? (
            <PressableScale haptic="select" onPress={() => onQuery('')} accessibilityLabel="Clear search" hitSlop={8}>
              <Icon name="x" size={16} color={t.c.textSecondary} />
            </PressableScale>
          ) : null}
        </Glass>
        <DestinationPill onPress={onDestination} />
      </View>
      {results.length ? (
        <Animated.View entering={FadeIn.duration(motion.fast)} exiting={FadeOut.duration(motion.fast)}>
          <Glass style={[styles.results, { boxShadow: t.shadow.float }]} intensity={blur.strong}>
            {results.map((r) => (
              <PressableScale key={r.id} haptic="select" scaleTo={0.98} style={styles.result} onPress={() => onResult(r)}>
                <Icon name={r.marker ? r.marker.icon : 'pin'} size={16} color={r.marker ? r.marker.color : t.c.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text variant="label" numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {r.sub}
                  </Text>
                </View>
              </PressableScale>
            ))}
          </Glass>
        </Animated.View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layers}>
          {LAYERS.map((l) => (
            <Glass key={l.id} style={{ borderRadius: radius.pill }} border={false} intensity={blur.light}>
              <Chip size="sm" label={l.label} icon={l.icon} selected={layer === l.id} onPress={() => onLayer(l.id)} />
            </Glass>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

/** 2D | 3D with a sliding indicator. */
export function ModeSwitch({ three, onChange }: { three: boolean; onChange: (three: boolean) => void }) {
  const t = useTheme();
  const x = useSharedValue(three ? 1 : 0);
  useEffect(() => {
    x.set(withSpring(three ? 1 : 0, spring.medium));
  }, [three, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateY: x.value * 40 }] }));
  return (
    <Glass style={[styles.mode, { boxShadow: t.shadow.card }]} intensity={blur.medium}>
      <Animated.View style={[styles.modePill, { backgroundColor: t.c.brand }, pill]} />
      {(['2D', '3D'] as const).map((label, i) => {
        const on = (i === 1) === three;
        return (
          <PressableScale
            key={label}
            haptic={false}
            scaleTo={0.92}
            onPress={() => onChange(i === 1)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label === '3D' ? '3D view' : '2D view'}
            style={styles.modeItem}
          >
            <Text variant="label" color={on ? t.c.onBrand : t.c.text}>
              {label}
            </Text>
          </PressableScale>
        );
      })}
    </Glass>
  );
}

export function MapButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale haptic="select" scaleTo={0.9} onPress={onPress} accessibilityLabel={label} hitSlop={4}>
      <Glass style={[styles.button, { boxShadow: t.shadow.card }]} intensity={blur.medium}>
        <Icon name={icon} size={18} color={t.c.text} />
      </Glass>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, gap: 10, zIndex: 5 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.gutter - 4 },
  search: { flex: 1, height: 48, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  searchInput: { flex: 1, fontFamily: font.medium, fontSize: 15, paddingVertical: 0 },
  results: { marginHorizontal: space.gutter - 4, borderRadius: radius.xl, paddingVertical: 6 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  layers: { paddingHorizontal: space.gutter - 4, gap: 8 },
  mode: { width: 48, height: 88, borderRadius: 24, padding: 4 },
  modePill: { position: 'absolute', top: 4, left: 4, width: 40, height: 40, borderRadius: 20 },
  modeItem: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
