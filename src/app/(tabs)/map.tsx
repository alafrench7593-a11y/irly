import { useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  FadeIn,
  FadeOut,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { LinearGradient } from 'expo-linear-gradient';
import { useFrame } from '@/components/layout/AppFrame';
import { DestinationPill } from '@/components/navigation/Headers';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { Chip } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CITIES } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import type { CityId, MapPoint } from '@/data/types';
import { DestinationSheet } from '@/features/destination/DestinationSheet';
import { MapArt } from '@/features/map/MapArt';
import { ClusterView, MarkerView, Projected, TILT, type Camera } from '@/features/map/MapMarkers';
import { MapSheet, type Snap } from '@/features/map/MapSheet';
import { useLives } from '@/features/live/liveStore';
import { buildMarkers, placeMarkers, ZOOM, type MapMarkerData, type MarkerType } from '@/features/map/markers';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { blur, ease, motion, spring } from '@/motion/tokens';
import { useCityId } from '@/state/store';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Layer = 'all' | MarkerType;

const LAYERS: { id: Layer; label: string; icon: IconName }[] = [
  { id: 'all', label: 'All', icon: 'layers' },
  { id: 'live', label: 'Live', icon: 'zap' },
  { id: 'activity', label: 'Activities', icon: 'activity' },
  { id: 'event', label: 'Events', icon: 'ticket' },
  { id: 'person', label: 'People', icon: 'users' },
  { id: 'group', label: 'Groups', icon: 'heartHandshake' },
  { id: 'place', label: 'Places', icon: 'pin' },
];

const MIN_Z = 0.75;
const MAX_Z = 2.8;
/** Opens at street level on the busiest neighbourhood: people and plans, not bubbles. */
const START_Z = 1.5;

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

/**
 * Map. Everything happening around you, on IRLY's own night map, in 2D or
 * with a tilted camera. Markers fade and scale in progressively, clusters
 * dissolve into markers as you zoom, the selected marker grows with a halo
 * while the camera glides to keep it in view above the sheet, and the
 * sheet follows the finger between its three snaps.
 */
function CityMap({ cityId, areaId }: { cityId: CityId; areaId?: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const tabSpace = useTabBarSpace();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const [layer, setLayer] = useState<Layer>('all');
  const [selected, setSelected] = useState<MapMarkerData | null>(null);
  const [snap, setSnap] = useState<Snap>('collapsed');
  const [destSheet, setDestSheet] = useState(false);
  const [mode3d, setMode3d] = useState(false);
  const [query, setQuery] = useState('');
  const [zq, setZq] = useState(START_Z);

  const W = frame.width;
  const H = frame.height;
  const S = Math.round(Math.max(W, H) * 1.35);
  // The sheet lives above the floating tab bar.
  const sheetBottom = tabSpace - 28;
  const sheetArea = H - sheetBottom;

  const lives = useLives();
  const all = useMemo(() => buildMarkers(city, content, lives), [city, content, lives]);
  const layerMarkers = useMemo(() => (layer === 'all' ? all : all.filter((m) => m.type === layer)), [all, layer]);
  // A chosen layer shows all its markers whatever the zoom.
  const placed = useMemo(
    () => placeMarkers(layer === 'all' ? layerMarkers : layerMarkers, layer === 'all' ? zq : Math.max(zq, ZOOM.street), S),
    [layerMarkers, layer, zq, S],
  );

  // Camera, on the UI thread. The camera never shows past the edge of the map.
  const bound = useCallback(
    (v: number, z: number, viewport: number) => {
      'worklet';
      const max = Math.max(0, (S * z - viewport) / 2);
      return clamp(v, -max, max);
    },
    [S],
  );

  const hub = useMemo(() => busiestArea(city.areas, all), [city, all]);
  const area = areaId ? city.areas.find((a) => a.id === areaId) : undefined;
  const focus = area?.point ?? hub;
  const cam: Camera = {
    zoom: useSharedValue(START_Z),
    tx: useSharedValue(bound(-(focus.x - 0.5) * S * START_Z, START_Z, W)),
    ty: useSharedValue(bound(-(focus.y - 0.5) * S * START_Z, START_Z, H)),
    tilt: useSharedValue(0),
  };
  const startZoom = useSharedValue(1);

  // Recompute clusters when the zoom crosses an eighth.
  useAnimatedReaction(
    () => Math.round(cam.zoom.value * 8) / 8,
    (q, prev) => {
      if (q !== prev) scheduleOnRN(setZq, q);
    },
  );

  /** Glide so `p` sits in the middle of what the sheet leaves visible. */
  const centerOn = useCallback(
    (p: MapPoint, zoom?: number, sheetH = 0) => {
      const z = zoom ?? cam.zoom.get();
      if (zoom) cam.zoom.set(withSpring(zoom, spring.soft));
      const visibleShift = sheetH ? -(sheetH - (H - sheetArea)) / 2 : -30;
      cam.tx.set(withSpring(bound(-(p.x - 0.5) * S * z, z, W), spring.soft));
      cam.ty.set(withSpring(bound(-(p.y - 0.5) * S * z + visibleShift, z, H), spring.soft));
    },
    [S, W, H, bound, cam.tx, cam.ty, cam.zoom, sheetArea],
  );

  useEffect(() => {
    if (area) centerOn(area.point, 1.6);
  }, [area, centerOn]);

  const pan = Gesture.Pan()
    .onChange((e) => {
      cam.tx.set(cam.tx.get() + e.changeX);
      cam.ty.set(cam.ty.get() + e.changeY);
    })
    .onEnd((e) => {
      const maxX = Math.max(0, (S * cam.zoom.get() - W) / 2);
      const maxY = Math.max(0, (S * cam.zoom.get() - H) / 2);
      cam.tx.set(withDecay({ velocity: e.velocityX, clamp: [-maxX, maxX] }));
      cam.ty.set(withDecay({ velocity: e.velocityY, clamp: [-maxY, maxY] }));
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startZoom.set(cam.zoom.get());
    })
    .onChange((e) => {
      cam.zoom.set(clamp(startZoom.get() * e.scale, MIN_Z, MAX_Z));
    })
    .onEnd(() => {
      cam.tx.set(withSpring(bound(cam.tx.get(), cam.zoom.get(), W), spring.medium));
      cam.ty.set(withSpring(bound(cam.ty.get(), cam.zoom.get(), H), spring.medium));
    });

  // Markers sit above the canvas and take their own taps; a tap that
  // reaches the canvas is a tap on empty map: it folds the selection away.
  const tap = Gesture.Tap().onEnd(() => {
    scheduleOnRN(setSelected, null);
  });

  const gesture = Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);

  const cameraStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: TILT.perspective },
      { rotateX: `${TILT.angle * cam.tilt.value}rad` },
      { scale: 1 + (TILT.zoom - 1) * cam.tilt.value },
    ],
  }));
  const fogStyle = useAnimatedStyle(() => ({ opacity: cam.tilt.value }));
  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cam.tx.get() }, { translateY: cam.ty.get() }, { scale: cam.zoom.get() }],
  }));

  const zoomBy = (factor: number) => {
    haptic('select');
    const z = clamp(cam.zoom.get() * factor, MIN_Z, MAX_Z);
    cam.zoom.set(withTiming(z, { duration: motion.normal, easing: ease.standard }));
  };

  const setMode = (three: boolean) => {
    if (three === mode3d) return;
    haptic('press');
    setMode3d(three);
    cam.tilt.set(withTiming(three ? 1 : 0, { duration: three ? 1200 : 800, easing: ease.camera }));
  };

  const select = (m: MapMarkerData) => {
    haptic('select');
    setSelected(m);
    setSnap('collapsed');
    centerOn(m.point, Math.max(cam.zoom.get(), ZOOM.neighbourhood + 0.15), 136);
  };

  const openCluster = (p: MapPoint) => {
    centerOn(p, clamp(cam.zoom.get() * 1.6, MIN_Z, MAX_Z));
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const areas = city.areas.filter((a) => a.name.toLowerCase().includes(q)).map((a) => ({ id: a.id, title: a.name, sub: 'Neighbourhood', point: a.point, marker: null as MapMarkerData | null }));
    const things = all
      .filter((m) => m.title.toLowerCase().includes(q))
      .map((m) => ({ id: m.id, title: m.title, sub: m.subtitle, point: m.point, marker: m as MapMarkerData | null }));
    return [...areas, ...things].slice(0, 6);
  }, [query, city, all]);

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, cameraStyle]}>
            <Animated.View style={[{ position: 'absolute', width: S, height: S, left: (W - S) / 2, top: (H - S) / 2 }, canvasStyle]}>
              <MapArt city={city} mode={t.mode} width={S} height={S} />
              {city.areas.map((a) => (
                <AreaLabel key={a.id} name={a.name} x={a.point.x * S} y={a.point.y * S} zoom={cam.zoom} />
              ))}
            </Animated.View>
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Markers: projected on screen, upright in 2D and 3D. */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 1 }]} pointerEvents="box-none">
        {placed.map((p, i) =>
          p.kind === 'marker' ? (
            <Projected key={p.m.id} point={p.m.point} S={S} W={W} H={H} cam={cam} index={i} selected={selected?.id === p.m.id}>
              <MarkerView m={p.m} selected={selected?.id === p.m.id} onPress={() => select(p.m)} />
            </Projected>
          ) : (
            <Projected key={p.c.id} point={p.c.point} S={S} W={W} H={H} cam={cam} index={i}>
              <ClusterView c={p.c} onPress={() => openCluster(p.c.point)} />
            </Projected>
          ),
        )}
      </View>

      {/* Fog at the horizon: in 3D the far edge of the map dissolves into black. */}
      <Animated.View style={[styles.fog, fogStyle]} pointerEvents="none">
        <LinearGradient colors={['#F6F6F4', 'rgba(246,246,244,0.85)', 'rgba(246,246,244,0)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* Floating UI: arrives after the map, stays put in 2D and 3D. */}
      <Animated.View entering={enter.fade(0, 120)} style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.searchRow}>
          <Glass style={styles.search} intensity={blur.medium}>
            <Icon name="search" size={18} color={t.c.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${city.name}`}
              placeholderTextColor={t.c.textTertiary}
              selectionColor={t.c.text}
              style={[styles.searchInput, { color: t.c.text }]}
              accessibilityLabel="Search the map"
              returnKeyType="search"
            />
            {query ? (
              <PressableScale haptic="select" onPress={() => setQuery('')} accessibilityLabel="Clear search" hitSlop={8}>
                <Icon name="x" size={16} color={t.c.textSecondary} />
              </PressableScale>
            ) : null}
          </Glass>
          <DestinationPill onPress={() => setDestSheet(true)} />
        </View>
        {results.length ? (
          <Animated.View entering={FadeIn.duration(motion.fast)} exiting={FadeOut.duration(motion.fast)}>
            <Glass style={styles.results} intensity={blur.strong}>
              {results.map((r) => (
                <PressableScale
                  key={r.id}
                  haptic="select"
                  scaleTo={0.98}
                  style={styles.result}
                  onPress={() => {
                    setQuery('');
                    if (r.marker) select(r.marker);
                    else centerOn(r.point, 1.6);
                  }}
                >
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
                <Chip size="sm" label={l.label} icon={l.icon} selected={layer === l.id} onPress={() => setLayer(l.id)} />
              </Glass>
            ))}
          </ScrollView>
        )}
      </Animated.View>

      <Animated.View entering={enter.fade(1, 160)} style={[styles.controls, { top: insets.top + 118 }]} pointerEvents="box-none">
        <ModeSwitch three={mode3d} onChange={setMode} />
        <MapButton icon="locate" label="Recenter" onPress={() => centerOn(hub, START_Z)} />
        <MapButton icon="plus" label="Zoom in" onPress={() => zoomBy(1.35)} />
        <MapButton icon="minus" label="Zoom out" onPress={() => zoomBy(1 / 1.35)} />
      </Animated.View>

      {mode3d ? <TiltNote /> : null}

      {/* Legal mention of the base map stays visible. */}
      {!selected ? (
        <View style={[styles.credit, { bottom: tabSpace - 18 }]} pointerEvents="none">
          <Text variant="caption" tone="tertiary" style={{ fontSize: 10 }}>
            IRLY map
          </Text>
        </View>
      ) : null}

      {selected ? (
        <MapSheet
          key={selected.id}
          marker={selected}
          height={sheetArea}
          bottom={sheetBottom}
          top={insets.top + 8}
          snap={snap}
          onSnap={(s) => {
            setSnap(s);
            if (s !== 'expanded') centerOn(selected.point, undefined, s === 'half' ? sheetArea * 0.52 : 136);
          }}
          onClose={() => setSelected(null)}
        />
      ) : null}
      <DestinationSheet visible={destSheet} onClose={() => setDestSheet(false)} />
    </View>
  );
}

/** 2D | 3D with a sliding indicator. */
function ModeSwitch({ three, onChange }: { three: boolean; onChange: (three: boolean) => void }) {
  const t = useTheme();
  const x = useSharedValue(three ? 1 : 0);
  useEffect(() => {
    x.set(withSpring(three ? 1 : 0, spring.medium));
  }, [three, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateY: x.value * 40 }] }));
  return (
    <Glass style={styles.mode} intensity={blur.medium}>
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

function MapButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale haptic="select" scaleTo={0.9} onPress={onPress} accessibilityLabel={label} hitSlop={4}>
      <Glass style={styles.button} intensity={blur.medium}>
        <Icon name={icon} size={18} color={t.c.text} />
      </Glass>
    </PressableScale>
  );
}

/** Honest about what the 3D button shows without Google's 3D tiles. */
function TiltNote() {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setShown(false), 3200);
    return () => clearTimeout(id);
  }, []);
  if (!shown) return null;
  return (
    <Animated.View entering={FadeIn.duration(motion.normal)} exiting={FadeOut.duration(motion.normal)} style={styles.noteWrap} pointerEvents="none">
      <Glass style={styles.note} intensity={blur.medium}>
        <Icon name="orbit3d" size={14} color="#FFFFFF" />
        <Text variant="caption">Tilted view · photorealistic 3D arrives with Google Maps</Text>
      </Glass>
    </Animated.View>
  );
}

const AreaLabel = memo(function AreaLabel({ name, x, y, zoom }: { name: string; x: number; y: number; zoom: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 / zoom.get() }], opacity: zoom.get() < 0.9 ? 0 : 1 }));
  return (
    <Animated.View style={[styles.areaLabel, { left: x - 70, top: y + 18 }, style]} pointerEvents="none">
      <Text variant="overline" color="#7A7A7A" align="center" style={{ fontSize: 9.5 }}>
        {name}
      </Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  fog: { position: 'absolute', top: 0, left: 0, right: 0, height: '42%', zIndex: 2 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, gap: 10, zIndex: 5 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.gutter - 4 },
  search: { flex: 1, height: 48, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  searchInput: { flex: 1, fontFamily: font.medium, fontSize: 15, paddingVertical: 0 },
  results: { marginHorizontal: space.gutter - 4, borderRadius: radius.xl, paddingVertical: 6 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  layers: { paddingHorizontal: space.gutter - 4, gap: 8 },
  controls: { position: 'absolute', right: space.gutter - 4, gap: 10, alignItems: 'center', zIndex: 5 },
  mode: { width: 48, height: 88, borderRadius: 24, padding: 4 },
  modePill: { position: 'absolute', top: 4, left: 4, width: 40, height: 40, borderRadius: 20 },
  modeItem: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  noteWrap: { position: 'absolute', left: 0, right: 0, bottom: 150, alignItems: 'center', zIndex: 5 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 34, paddingHorizontal: 14, borderRadius: radius.pill },
  credit: { position: 'absolute', left: space.gutter, zIndex: 5 },
  areaLabel: { position: 'absolute', width: 140 },
});
