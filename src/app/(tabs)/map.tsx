import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { ConnectButton } from '@/components/cards/PeopleCards';
import { useFrame } from '@/components/layout/AppFrame';
import { DestinationPill } from '@/components/navigation/Headers';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { Avatar, AvatarStack } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip, IconButton, LiveDot } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { ACTIVITIES, EVENT_CATEGORIES, PLACE_KINDS, SERVICE_CATEGORIES } from '@/data/catalog';
import { areaName, CITIES } from '@/data/destinations';
import { findPerson, getCityContent, peopleByIds } from '@/data/repo';
import type { CityId, MapPoint } from '@/data/types';
import { DestinationSheet } from '@/features/destination/DestinationSheet';
import { openHero, type HeroKind } from '@/features/hero/heroStore';
import { MapArt } from '@/features/map/MapArt';
import { formatCount } from '@/lib/format';
import { whenLabel } from '@/lib/time';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Layer = 'all' | 'people' | 'activity' | 'event' | 'restaurant' | 'community' | 'service' | 'place';

const LAYERS: { id: Layer; label: string; icon: IconName }[] = [
  { id: 'all', label: 'All', icon: 'layers' },
  { id: 'people', label: 'People', icon: 'users' },
  { id: 'activity', label: 'Activities', icon: 'activity' },
  { id: 'event', label: 'Events', icon: 'ticket' },
  { id: 'restaurant', label: 'Food & drinks', icon: 'utensils' },
  { id: 'community', label: 'Communities', icon: 'heartHandshake' },
  { id: 'service', label: 'Services', icon: 'shield' },
  { id: 'place', label: 'Places', icon: 'palm' },
];

type Marker = {
  id: string;
  layer: Exclude<Layer, 'all'>;
  point: MapPoint;
  title: string;
  subtitle: string;
  icon: IconName;
  hero?: { kind: HeroKind; id: string };
  personId?: string;
  goingIds?: string[];
  live?: boolean;
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function jitter(p: MapPoint, id: string, spread = 0.045): MapPoint {
  const h = hash(id);
  const angle = (h % 360) * (Math.PI / 180);
  const r = spread * (0.35 + ((h >> 8) % 100) / 160);
  return { x: Math.min(0.97, Math.max(0.03, p.x + Math.cos(angle) * r)), y: Math.min(0.97, Math.max(0.03, p.y + Math.sin(angle) * r)) };
}

/**
 * Pushes overlapping points apart until they are at least `minDist` from
 * each other (a few relaxation passes, deterministic, stays near the area).
 */
function declutter<T extends { point: MapPoint }>(list: T[], minDist: number): T[] {
  const pts = list.map((m) => ({ ...m.point }));
  for (let pass = 0; pass < 30; pass++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        let dx = pts[j].x - pts[i].x;
        let dy = pts[j].y - pts[i].y;
        let d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        if (d < 1e-6) {
          dx = Math.cos(i + j);
          dy = Math.sin(i + j);
          d = 1;
        }
        const push = (minDist - Math.min(d, minDist)) / 2;
        pts[i].x -= (dx / d) * push;
        pts[i].y -= (dy / d) * push;
        pts[j].x += (dx / d) * push;
        pts[j].y += (dy / d) * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  const inside = (v: number) => Math.min(0.97, Math.max(0.03, v));
  return list.map((m, i) => ({ ...m, point: { x: inside(pts[i].x), y: inside(pts[i].y) } }));
}

/** Point of the area holding the most markers. */
function busiestArea(areas: { id: string; point: MapPoint }[], markers: { point: MapPoint }[]): MapPoint {
  const counts = new Map<string, number>();
  for (const m of markers) {
    let nearest = areas[0];
    let best = Infinity;
    for (const a of areas) {
      const d = (a.point.x - m.point.x) ** 2 + (a.point.y - m.point.y) ** 2;
      if (d < best) {
        best = d;
        nearest = a;
      }
    }
    counts.set(nearest.id, (counts.get(nearest.id) ?? 0) + 1);
  }
  let top = areas[0];
  for (const a of areas) if ((counts.get(a.id) ?? 0) > (counts.get(top.id) ?? 0)) top = a;
  return top.point;
}

export default function MapScreen() {
  const cityId = useCityId();
  const params = useLocalSearchParams<{ area?: string }>();
  // A new city, or a link to one of its areas, starts with a fresh camera and selection.
  return <CityMap key={`${cityId}:${params.area ?? ''}`} cityId={cityId} areaId={params.area} />;
}

function CityMap({ cityId, areaId }: { cityId: CityId; areaId?: string }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const bottom = useTabBarSpace();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const [layer, setLayer] = useState<Layer>('all');
  const [selected, setSelected] = useState<Marker | null>(null);
  const [destSheet, setDestSheet] = useState(false);

  const W = frame.width;
  const H = frame.height;
  const S = Math.round(Math.max(W, H) * 1.35);

  const rawMarkers = useMemo<Marker[]>(() => {
    const pt = (areaId: string) => (city.areas.find((a) => a.id === areaId) ?? city.areas[0]).point;
    const list: Marker[] = [];
    content.people.forEach((p) =>
      list.push({
        id: p.id,
        layer: 'people',
        point: jitter(pt(p.areaId), p.id, 0.05),
        title: p.name,
        subtitle: p.headline,
        icon: 'user',
        personId: p.id,
      }),
    );
    content.sessions.forEach((s) =>
      list.push({
        id: s.id,
        layer: 'activity',
        point: jitter(pt(s.areaId), s.id),
        title: s.title,
        subtitle: whenLabel(s.when, city),
        icon: ACTIVITIES[s.kind].icon,
        hero: { kind: 'session', id: s.id },
        goingIds: s.goingIds,
        live: s.when.dayOffset === 0,
      }),
    );
    content.events.forEach((e) =>
      list.push({
        id: e.id,
        layer: 'event',
        point: jitter(pt(e.areaId), e.id),
        title: e.title,
        subtitle: whenLabel(e.when, city),
        icon: EVENT_CATEGORIES[e.category].icon,
        hero: { kind: 'event', id: e.id },
        goingIds: e.goingIds,
        live: e.when.dayOffset === 0,
      }),
    );
    content.places.forEach((p) =>
      list.push({
        id: p.id,
        layer: ['restaurant', 'cafe', 'rooftop', 'market'].includes(p.kind) ? 'restaurant' : 'place',
        point: jitter(pt(p.areaId), p.id),
        title: p.name,
        subtitle: `${PLACE_KINDS[p.kind].label} · ★ ${p.rating.toFixed(1)}`,
        icon: PLACE_KINDS[p.kind].icon,
        hero: { kind: 'place', id: p.id },
      }),
    );
    content.communities.forEach((c) =>
      list.push({
        id: c.id,
        layer: 'community',
        point: jitter(pt(city.areas[hash(c.id) % city.areas.length].id), c.id),
        title: c.name,
        subtitle: `${formatCount(c.members)} members · ${c.rhythm}`,
        icon: 'heartHandshake',
        hero: { kind: 'community', id: c.id },
        goingIds: c.memberIds,
      }),
    );
    content.services.slice(0, 8).forEach((s) =>
      list.push({
        id: s.id,
        layer: 'service',
        point: jitter(pt(s.areaId), s.id),
        title: s.name,
        subtitle: SERVICE_CATEGORIES[s.category].label,
        icon: SERVICE_CATEGORIES[s.category].icon,
        hero: { kind: 'service', id: s.id },
      }),
    );
    return list;
  }, [content, city]);
  // Markers keep a constant size on screen: push apart the ones that would
  // overlap so each stays tappable (about one marker apart).
  const markers = useMemo(() => declutter(rawMarkers, 50 / S), [rawMarkers, S]);

  const visible = layer === 'all' ? markers : markers.filter((m) => m.layer === layer);

  // Camera. Shared values are read and written with get/set so the
  // React Compiler can reason about them. The camera never shows past the
  // edge of the map.
  const bound = useCallback(
    (v: number, z: number, viewport: number) => {
      'worklet';
      const max = Math.max(0, (S * z - viewport) / 2);
      return clamp(v, -max, max);
    },
    [S],
  );

  // Open on the busiest neighbourhood (or the one asked for), not on the
  // geometric middle of the map, which in Bali is empty jungle.
  const hub = useMemo(() => busiestArea(city.areas, rawMarkers), [city, rawMarkers]);
  const area = areaId ? city.areas.find((a) => a.id === areaId) : undefined;
  const focus = area?.point ?? hub;
  const scale = useSharedValue(1);
  const tx = useSharedValue(bound(-(focus.x - 0.5) * S, 1, W));
  const ty = useSharedValue(bound(-(focus.y - 0.5) * S, 1, H));
  const startScale = useSharedValue(1);

  const centerOn = useCallback(
    (p: MapPoint, zoom?: number) => {
      const z = zoom ?? scale.get();
      if (zoom) scale.set(withSpring(zoom, spring.smooth));
      tx.set(withSpring(bound(-(p.x - 0.5) * S * z, z, W), spring.smooth));
      ty.set(withSpring(bound(-(p.y - 0.5) * S * z - 70, z, H), spring.smooth));
    },
    [S, W, H, bound, scale, tx, ty],
  );

  useEffect(() => {
    if (area) centerOn(area.point, 1.5);
  }, [area, centerOn]);

  const pan = Gesture.Pan()
    .onChange((e) => {
      tx.set(tx.get() + e.changeX);
      ty.set(ty.get() + e.changeY);
    })
    .onEnd((e) => {
      const maxX = Math.max(0, (S * scale.get() - W) / 2);
      const maxY = Math.max(0, (S * scale.get() - H) / 2);
      tx.set(withDecay({ velocity: e.velocityX, clamp: [-maxX, maxX] }));
      ty.set(withDecay({ velocity: e.velocityY, clamp: [-maxY, maxY] }));
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.set(scale.get());
    })
    .onChange((e) => {
      scale.set(clamp(startScale.get() * e.scale, 0.75, 2.6));
    })
    .onEnd(() => {
      tx.set(withSpring(bound(tx.get(), scale.get(), W), spring.snappy));
      ty.set(withSpring(bound(ty.get(), scale.get(), H), spring.snappy));
    });

  // Tapping empty map closes the sheet. Taps on a marker are left to the
  // marker: hit-test against marker positions on screen, on the UI thread.
  const points = useMemo(() => visible.map((m) => m.point), [visible]);
  const tap = Gesture.Tap().onEnd((e) => {
    const z = scale.get();
    const cx = W / 2 + tx.get();
    const cy = H / 2 + ty.get();
    for (let i = 0; i < points.length; i++) {
      const mx = cx + (points[i].x * S - S / 2) * z;
      const my = cy + (points[i].y * S - S / 2) * z;
      if (Math.abs(e.x - mx) < 30 && Math.abs(e.y - my) < 30) return;
    }
    scheduleOnRN(setSelected, null);
  });

  const gesture = Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  const zoom = (factor: number) => {
    haptic('select');
    const z = Math.max(0.75, Math.min(2.6, scale.get() * factor));
    scale.set(withTiming(z, { duration: 260 }));
  };

  const select = (m: Marker) => {
    haptic('tap');
    setSelected(m);
    centerOn(m.point);
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[{ position: 'absolute', width: S, height: S, left: (W - S) / 2, top: (H - S) / 2 }, canvasStyle]}>
            <MapArt city={city} mode={t.mode} width={S} height={S} />
            {city.areas.map((a) => (
              <AreaLabel key={a.id} name={a.name} x={a.point.x * S} y={a.point.y * S} scale={scale} />
            ))}
            {visible.map((m) => (
              <MapMarker key={m.id} marker={m} S={S} scale={scale} selected={selected?.id === m.id} onPress={() => select(m)} />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Top chrome */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Glass style={styles.titlePill}>
            <Icon name="map" size={16} color={t.c.text} />
            <Text variant="label">{visible.length} around you</Text>
          </Glass>
          <DestinationPill onPress={() => setDestSheet(true)} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layers}>
          {LAYERS.map((l) => (
            <Glass key={l.id} style={{ borderRadius: radius.pill }} border={false}>
              <Chip size="sm" label={l.label} icon={l.icon} selected={layer === l.id} onPress={() => setLayer(l.id)} />
            </Glass>
          ))}
        </ScrollView>
      </View>

      <View style={[styles.controls, { bottom: bottom + (selected ? 186 : 12) }]} pointerEvents="box-none">
        <IconButton icon="plus" label="Zoom in" onPress={() => zoom(1.35)} />
        <IconButton icon="minus" label="Zoom out" onPress={() => zoom(1 / 1.35)} />
        <IconButton icon="locate" label="Recenter" onPress={() => centerOn(hub, 1)} />
      </View>

      {selected ? (
        <MarkerSheet
          key={selected.id}
          marker={selected}
          bottom={bottom - 10}
          onClose={() => setSelected(null)}
          onOpen={(h) => openHero(h)}
          onPerson={(id) => router.push(`/person/${id}`)}
        />
      ) : null}
      <DestinationSheet visible={destSheet} onClose={() => setDestSheet(false)} />
    </View>
  );
}

const AreaLabel = memo(function AreaLabel({ name, x, y, scale }: { name: string; x: number; y: number; scale: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 / scale.get() }], opacity: scale.get() < 0.9 ? 0 : 1 }));
  return (
    <Animated.View style={[styles.areaLabel, { left: x - 70, top: y + 18 }, style]} pointerEvents="none">
      <Text variant="overline" tone="tertiary" align="center" style={{ fontSize: 9.5 }}>
        {name}
      </Text>
    </Animated.View>
  );
});

const MapMarker = memo(function MapMarker({
  marker,
  S,
  scale,
  selected,
  onPress,
}: {
  marker: Marker;
  S: number;
  scale: SharedValue<number>;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const pop = useSharedValue(selected ? 1.25 : 1);
  useEffect(() => {
    pop.set(withSpring(selected ? 1.28 : 1, spring.bouncy));
  }, [selected, pop]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() / scale.get() }] }));
  const person = marker.personId ? findPerson(marker.personId) : undefined;
  const isPerson = marker.layer === 'people' && person;
  const color =
    marker.layer === 'event' ? t.c.live : marker.layer === 'community' ? t.c.brand : marker.layer === 'service' ? t.c.positive : t.accent;
  return (
    <Animated.View style={[styles.marker, { left: marker.point.x * S - 22, top: marker.point.y * S - 22, zIndex: selected ? 10 : 1 }, style]}>
      <PressableScale haptic={false} scaleTo={0.88} onPress={onPress} accessibilityLabel={marker.title} hitSlop={6}>
        {isPerson ? (
          <View style={[styles.personMarker, { borderColor: selected ? t.c.brand : t.c.bg, boxShadow: t.shadow.card }]}>
            <Avatar name={person.name} hue={person.hue} size={34} />
          </View>
        ) : (
          <View style={[styles.pin, { backgroundColor: selected ? color : t.c.raised, borderColor: color, boxShadow: t.shadow.card }]}>
            <Icon name={marker.icon} size={17} color={selected ? '#FFFFFF' : color} strokeWidth={2.2} />
            {marker.live ? (
              <View style={styles.liveDot}>
                <LiveDot size={8} />
              </View>
            ) : null}
          </View>
        )}
      </PressableScale>
    </Animated.View>
  );
});

function MarkerSheet({
  marker,
  bottom,
  onClose,
  onOpen,
  onPerson,
}: {
  marker: Marker;
  bottom: number;
  onClose: () => void;
  onOpen: (h: { kind: HeroKind; id: string }) => void;
  onPerson: (id: string) => void;
}) {
  const t = useTheme();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const y = useSharedValue(220);
  useEffect(() => {
    y.set(withSpring(0, spring.sheet));
  }, [y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const person = marker.personId ? findPerson(marker.personId) : undefined;
  const going = marker.goingIds ? peopleByIds(marker.goingIds) : [];
  return (
    <Animated.View style={[styles.sheetWrap, { bottom }, style]}>
      <Glass style={styles.sheet} intensity={70}>
        <View style={styles.sheetTop}>
          {person ? (
            <Avatar name={person.name} hue={person.hue} size={48} verified={person.verified} online={person.online} />
          ) : (
            <View style={[styles.sheetIcon, { backgroundColor: t.light.accentSoft }]}>
              <Icon name={marker.icon} size={22} color={t.accent} />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="titleM" numberOfLines={1}>
              {marker.title}
            </Text>
            <Text variant="bodyS" tone="secondary" numberOfLines={1}>
              {person ? `${person.headline} · ${areaName(city, person.areaId)}` : marker.subtitle}
            </Text>
          </View>
          <IconButton icon="x" label="Close" size={34} onPress={onClose} variant="plain" />
        </View>
        {going.length ? (
          <View style={styles.sheetRow}>
            <AvatarStack people={going} size={26} max={4} />
            <Text variant="caption" tone="secondary">
              {going.map((p) => p.name).slice(0, 2).join(', ')} {marker.layer === 'community' ? 'are members' : 'are going'}
            </Text>
          </View>
        ) : null}
        <View style={styles.sheetActions}>
          {person ? (
            <>
              <Button label="Profile" variant="secondary" size="md" onPress={() => onPerson(person.id)} />
              <View style={{ flex: 1 }}>
                <ConnectButton person={person} size="md" full />
              </View>
            </>
          ) : marker.hero ? (
            <Button label="Open" iconRight="arrowUpRight" size="md" full onPress={() => marker.hero && onOpen(marker.hero)} />
          ) : null}
        </View>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, gap: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.gutter },
  titlePill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 14, borderRadius: radius.pill },
  layers: { paddingHorizontal: space.gutter, gap: 8 },
  controls: { position: 'absolute', right: space.gutter, gap: 10 },
  areaLabel: { position: 'absolute', width: 140 },
  marker: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  personMarker: { borderRadius: 20, borderWidth: 3 },
  pin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: { position: 'absolute', top: -2, right: -2 },
  sheetWrap: { position: 'absolute', left: 12, right: 12 },
  sheet: { borderRadius: radius.xl, padding: 16, gap: 14 },
  sheetTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetActions: { flexDirection: 'row', gap: 10 },
});
