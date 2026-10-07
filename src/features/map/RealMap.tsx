import * as Location from 'expo-location';
import type { Map as MapLibre } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrame } from '@/components/layout/AppFrame';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { toast } from '@/components/ui/Toast';
import { CITIES } from '@/data/destinations';
import { areaCoords, type LatLng } from '@/data/geo';
import { getCityContent } from '@/data/repo';
import type { CityId } from '@/data/types';
import { DestinationSheet } from '@/features/destination/DestinationSheet';
import { useLives } from '@/features/live/liveStore';
import { t as tx, a11y } from '@/i18n';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { MapButton, MapTopBar, ModeSwitch, searchMap, type Layer } from './MapControls';
import { ClusterView, MarkerView } from './MapMarkers';
import { MapSheet, type Snap } from './MapSheet';
import { buildMarkers, type MapMarkerData } from './markers';
import { placeMarkers, STREET, type Located, type Region } from './place';

export const hasRealMap = true;

/** OpenFreeMap: OpenStreetMap vector tiles, free for any use, no key. */
const STYLE = {
  day: 'https://tiles.openfreemap.org/styles/positron',
  night: 'https://tiles.openfreemap.org/styles/dark',
};

/** Zoom level that shows `span` degrees of latitude over `height` pixels. */
const zoomFor = (span: number, height: number) => Math.log2((height * 360) / (256 * span));

/**
 * Web build: the same real map as on phones, drawn with MapLibre on
 * OpenStreetMap data. IRLY's layer (markers, clusters, sheet, 2D / 3D)
 * sits on top as ordinary views placed at their projected position. People
 * and lives are only ever placed around their neighbourhood.
 */
export function RealCityMap({ cityId, areaId }: { cityId: CityId; areaId?: string }) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const night = t.mode === 'night';
  const frame = useFrame();
  const tabSpace = useTabBarSpace();
  const host = useRef<View>(null);
  const [map, setMap] = useState<MapLibre | null>(null);
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const lives = useLives();
  const [layer, setLayer] = useState<Layer>('all');
  const [selected, setSelected] = useState<MapMarkerData | null>(null);
  const [snap, setSnap] = useState<Snap>('collapsed');
  const [destSheet, setDestSheet] = useState(false);
  const [three, setThree] = useState(false);
  const [query, setQuery] = useState('');
  // Bumped on every camera frame so the IRLY layer follows the map.
  const [, setFrameTick] = useState(0);

  const sheetBottom = tabSpace - 28;
  const sheetArea = frame.height - sheetBottom;

  const all = useMemo(() => buildMarkers(city, content, lives).filter((m): m is Located => Boolean(m.coords)), [city, content, lives]);

  const start = useMemo<Region>(() => {
    const counts = new Map<string, number>();
    all.forEach((m) => counts.set(m.areaId, (counts.get(m.areaId) ?? 0) + 1));
    const busiest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? city.areas[0].id;
    const c = areaCoords(cityId, areaId ?? busiest) ?? all[0]?.coords ?? { latitude: 25.2, longitude: 55.27 };
    return { ...c, latitudeDelta: areaId ? 0.03 : 0.06, longitudeDelta: areaId ? 0.03 : 0.06 };
  }, [all, city, cityId, areaId]);
  const [region, setRegion] = useState<Region>(start);

  useEffect(() => {
    let alive = true;
    let created: MapLibre | null = null;
    (async () => {
      const { Map: MapCtor, AttributionControl } = await import('maplibre-gl');
      const el = host.current as unknown as HTMLElement | null;
      if (!alive || !el) return;
      created = new MapCtor({
        container: el,
        style: night ? STYLE.night : STYLE.day,
        center: [start.longitude, start.latitude],
        zoom: zoomFor(start.latitudeDelta, frame.height),
        attributionControl: false,
        maxPitch: 70,
      });
      created.addControl(new AttributionControl({ compact: true }), 'bottom-left');
      // If the night style is unavailable, fall back to the light one.
      const onError = (e: { error?: { url?: string } }) => {
        if (!e.error?.url?.startsWith(STYLE.night)) return;
        created?.off('error', onError);
        created?.setStyle(STYLE.day);
      };
      created.on('error', onError);
      const sync = () => {
        const b = created!.getBounds();
        const c = created!.getCenter();
        setRegion({ latitude: c.lat, longitude: c.lng, latitudeDelta: b.getNorth() - b.getSouth(), longitudeDelta: b.getEast() - b.getWest() });
      };
      created.on('move', () => setFrameTick((n) => n + 1));
      created.on('moveend', sync);
      created.on('load', sync);
      created.on('click', () => setSelected(null));
      setMap(created);
    })();
    return () => {
      alive = false;
      created?.remove();
      setMap(null);
    };
    // The map is created once per city (the screen keys it); theme changes swap the style below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme changes swap the map style (the first one is set at creation).
  const styleShown = useRef(night ? STYLE.night : STYLE.day);
  useEffect(() => {
    const next = night ? STYLE.night : STYLE.day;
    if (!map || styleShown.current === next) return;
    styleShown.current = next;
    map.setStyle(next);
  }, [map, night]);

  const placed = useMemo(() => placeMarkers(all, layer, region, frame), [all, layer, region, frame]);

  const project = (c: LatLng) => map?.project([c.longitude, c.latitude]);

  /** Glide so `c` sits in the middle of what the sheet leaves visible. */
  const centerOn = (c: LatLng, span?: number, sheetH = 0) => {
    const d = span ?? region.latitudeDelta;
    map?.easeTo({ center: [c.longitude, c.latitude], zoom: zoomFor(d, frame.height), offset: [0, -sheetH / 2], duration: 600 });
  };

  const select = (m: Located) => {
    haptic('select');
    setSelected(m);
    setSnap('collapsed');
    centerOn(m.coords, Math.min(region.latitudeDelta, STREET * 0.9), 136);
  };

  const setMode = (next: boolean) => {
    if (next === three) return;
    haptic('press');
    setThree(next);
    const m = map;
    if (!m) return;
    m.easeTo({ pitch: next ? 60 : 0, bearing: next ? m.getBearing() - 25 : 0, zoom: next ? Math.max(m.getZoom(), 16) : Math.min(m.getZoom(), 14.5), duration: next ? 1200 : 800 });
  };

  const zoomBy = (factor: number) => {
    haptic('select');
    const m = map;
    if (m) m.easeTo({ zoom: m.getZoom() + (factor > 1 ? 1 : -1), duration: 300 });
  };

  const locate = async () => {
    haptic('select');
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      toast('Location is off. Showing the busiest area', 'pin', 'brand');
      centerOn(start, start.latitudeDelta);
      return;
    }
    let pos: Location.LocationObject;
    try {
      pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    } catch {
      toast('Your position is not available right now. Showing the busiest area', 'pin', 'brand');
      centerOn(start, start.latitudeDelta);
      return;
    }
    const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    const far = Math.abs(here.latitude - start.latitude) > 0.6 || Math.abs(here.longitude - start.longitude) > 0.6;
    if (far) {
      toast(tx('You are not in {city} right now. Showing {city}', { city: city.name }), 'pin', 'brand');
      centerOn(start, start.latitudeDelta);
    } else {
      centerOn(here, 0.02);
    }
  };

  const results = useMemo(() => searchMap(query, city.areas, all), [query, city, all]);

  return (
    <View style={styles.root}>
      {/* MapLibre makes its container position: relative, so it fills a positioned box instead. */}
      <View style={StyleSheet.absoluteFill}>
        <View ref={host} style={styles.fill} />
      </View>

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {placed.map((p) => {
          const at = project(p.kind === 'marker' ? p.m.coords : p.coords);
          if (!at) return null;
          const isSel = p.kind === 'marker' && selected?.id === p.m.id;
          return (
            <Pressable
              key={p.kind === 'marker' ? p.m.id : p.id}
              style={[styles.markerBox, { left: at.x - 36, top: at.y - 36, zIndex: isSel ? 20 : 1 }]}
              onPress={() => {
                if (p.kind === 'marker') select(p.m);
                else {
                  haptic('tap');
                  centerOn(p.coords, region.latitudeDelta / 2.6);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={p.kind === 'marker' ? a11y(p.m.title) : tx('{n} places', { n: p.members.length })}
            >
              <View pointerEvents="none">
                {p.kind === 'marker' ? (
                  <MarkerView m={p.m} selected={isSel} onPress={() => undefined} />
                ) : (
                  <ClusterView c={{ id: p.id, point: { x: 0, y: 0 }, members: p.members, colors: p.colors }} onPress={() => undefined} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <MapTopBar
        top={insets.top + 8}
        cityName={city.name}
        query={query}
        onQuery={setQuery}
        results={results}
        onResult={(r) => {
          setQuery('');
          if (r.marker?.coords) select(r.marker as Located);
          else if (r.areaId) {
            const c = areaCoords(cityId, r.areaId);
            if (c) centerOn(c, 0.03);
          }
        }}
        layer={layer}
        onLayer={setLayer}
        onDestination={() => setDestSheet(true)}
      />

      <Animated.View entering={enter.fade(1, 160)} style={[styles.controls, { top: insets.top + 118 }]} pointerEvents="box-none">
        <ModeSwitch three={three} onChange={setMode} />
        <MapButton icon="locate" label="My location" onPress={locate} />
        <MapButton icon="plus" label="Zoom in" onPress={() => zoomBy(2)} />
        <MapButton icon="minus" label="Zoom out" onPress={() => zoomBy(0.5)} />
      </Animated.View>

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
            const c = (selected as MapMarkerData).coords;
            if (c && s !== 'expanded') centerOn(c, undefined, s === 'half' ? sheetArea * 0.52 : 136);
          }}
          onClose={() => setSelected(null)}
        />
      ) : null}
      <DestinationSheet visible={destSheet} onClose={() => setDestSheet(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  controls: { position: 'absolute', right: space.gutter - 4, gap: 10, alignItems: 'center', zIndex: 5 },
  markerBox: { position: 'absolute', width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
});
