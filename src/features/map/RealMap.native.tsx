import * as Location from 'expo-location';
import { t as tx } from '@/i18n';
import { useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
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
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { MapButton, MapTopBar, ModeSwitch, searchMap, type Layer } from './MapControls';
import { ClusterView, MarkerView } from './MapMarkers';
import { MapSheet, type Snap } from './MapSheet';
import { buildMarkers, type MapMarkerData } from './markers';
import { placeMarkers, STREET, type Located } from './place';

export const hasRealMap = true;

/**
 * Real map: Apple Maps on iPhone, Google Maps on Android (both available in
 * Expo Go, no key needed). IRLY's own layer sits on top: the same markers,
 * clusters, sheet and 2D / 3D switch as the IRLY map, now on real streets
 * and real 3D buildings. People and lives are only ever placed around
 * their neighbourhood, never at an address.
 */
export function RealCityMap({ cityId, areaId }: { cityId: CityId; areaId?: string }) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const night = t.mode === 'night';
  const frame = useFrame();
  const tabSpace = useTabBarSpace();
  const map = useRef<MapView>(null);
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const lives = useLives();
  const [layer, setLayer] = useState<Layer>('all');
  const [selected, setSelected] = useState<MapMarkerData | null>(null);
  const [snap, setSnap] = useState<Snap>('collapsed');
  const [destSheet, setDestSheet] = useState(false);
  const [three, setThree] = useState(false);
  const [query, setQuery] = useState('');
  const [me, setMe] = useState(false);

  const sheetBottom = tabSpace - 28;
  const sheetArea = frame.height - sheetBottom;

  const all = useMemo(
    () => buildMarkers(city, content, lives).filter((m): m is Located => Boolean(m.coords)),
    [city, content, lives],
  );

  // Open on the requested neighbourhood, else the busiest one.
  const start = useMemo<Region>(() => {
    const counts = new Map<string, number>();
    all.forEach((m) => counts.set(m.areaId, (counts.get(m.areaId) ?? 0) + 1));
    const busiest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? city.areas[0].id;
    const c = areaCoords(cityId, areaId ?? busiest) ?? all[0]?.coords ?? { latitude: 25.2, longitude: 55.27 };
    return { ...c, latitudeDelta: areaId ? 0.03 : 0.06, longitudeDelta: areaId ? 0.03 : 0.06 };
  }, [all, city, cityId, areaId]);
  const [region, setRegion] = useState<Region>(start);

  const placed = useMemo(() => placeMarkers(all, layer, region, frame), [all, layer, region, frame]);

  /** Glide so `c` sits in the middle of what the sheet leaves visible. */
  const centerOn = (c: LatLng, span?: number, sheetH = 0) => {
    const d = span ?? region.latitudeDelta;
    const shift = sheetH ? ((sheetH - (frame.height - sheetArea)) / 2 / frame.height) * d : 0;
    map.current?.animateToRegion({ latitude: c.latitude - shift, longitude: c.longitude, latitudeDelta: d, longitudeDelta: d }, 600);
  };

  const select = (m: MapMarkerData & { coords?: LatLng }) => {
    haptic('select');
    setSelected(m);
    setSnap('collapsed');
    if (m.coords) centerOn(m.coords, Math.min(region.latitudeDelta, STREET * 0.9), 136);
  };

  const setMode = async (next: boolean) => {
    if (next === three) return;
    haptic('press');
    setThree(next);
    const cam = await map.current?.getCamera();
    map.current?.animateCamera(
      {
        pitch: next ? 60 : 0,
        heading: next ? (cam?.heading ?? 0) - 25 : 0,
        // Closer in 3D so buildings stand up; iOS reads altitude, Android zoom.
        altitude: next ? 700 : 2600,
        zoom: next ? 17 : 14.5,
      },
      { duration: next ? 1200 : 800 },
    );
  };

  const zoomBy = async (factor: number) => {
    haptic('select');
    const cam = await map.current?.getCamera();
    if (!cam) return;
    map.current?.animateCamera(
      { zoom: (cam.zoom ?? 14) + (factor > 1 ? 1 : -1), altitude: cam.altitude ? cam.altitude / factor : undefined },
      { duration: 300 },
    );
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
      // Location services off, no signal, or a timeout: say so and keep the city view.
      toast('Your position is not available right now. Showing the busiest area', 'pin', 'brand');
      centerOn(start, start.latitudeDelta);
      return;
    }
    setMe(true);
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
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={start}
        onRegionChangeComplete={setRegion}
        onPress={() => setSelected(null)}
        showsUserLocation={me}
        showsBuildings
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        pitchEnabled
        rotateEnabled
        userInterfaceStyle={night ? 'dark' : 'light'}
        customMapStyle={Platform.OS === 'android' ? (night ? ANDROID_NIGHT : ANDROID_STYLE) : undefined}
        mapPadding={{ top: insets.top + 110, right: 0, bottom: tabSpace, left: 0 }}
      >
        {placed.map((p) =>
          p.kind === 'marker' ? (
            <Marker
              key={p.m.id}
              coordinate={p.m.coords}
              onPress={(e) => {
                e.stopPropagation();
                select(p.m);
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={Platform.OS === 'ios' || selected?.id === p.m.id}
              zIndex={selected?.id === p.m.id ? 20 : 1}
            >
              <View pointerEvents="none" style={styles.markerBox}>
                <MarkerView m={p.m} selected={selected?.id === p.m.id} onPress={() => undefined} />
              </View>
            </Marker>
          ) : (
            <Marker
              key={p.id}
              coordinate={p.coords}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={Platform.OS === 'ios'}
              onPress={(e) => {
                e.stopPropagation();
                haptic('tap');
                centerOn(p.coords, region.latitudeDelta / 2.6);
              }}
            >
              <View pointerEvents="none" style={styles.markerBox}>
                <ClusterView c={{ id: p.id, point: { x: 0, y: 0 }, members: p.members, colors: p.colors }} onPress={() => undefined} />
              </View>
            </Marker>
          ),
        )}
      </MapView>

      <MapTopBar
        top={insets.top + 8}
        cityName={city.name}
        query={query}
        onQuery={setQuery}
        results={results}
        onResult={(r) => {
          setQuery('');
          if (r.marker) select(r.marker);
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

/** Google Maps on Android, IRLY Noir: near-black land, deep blue water, roads as faint light. */
const ANDROID_NIGHT = [
  { elementType: 'geometry', stylers: [{ color: '#121417' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8A9099' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0C0E' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#22252B' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2C3038' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A1621' }] },
];

/** Google Maps on Android: quiet light style so IRLY markers carry the colour. */
const ANDROID_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#F4F3F0' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B6B6B' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F4F3F0' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#E9E7E2' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CFDDE6' }] },
];

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  controls: { position: 'absolute', right: space.gutter - 4, gap: 10, alignItems: 'center', zIndex: 5 },
  markerBox: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
});
