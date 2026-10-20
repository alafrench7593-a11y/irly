import type { Map as MapLibre } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { t as tx } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { useTheme } from '@/theme/useTheme';
import { MapError, MapFrame, MapNotice, MapSkeleton, noticeFor, pinLabel, SpotPin, SpotSheet, useCommunityMapModel, type CommunityMapProps } from './CommunityMapParts';
import { spotBounds, type MapSpan } from './mapSpots';

/** OpenFreeMap: OpenStreetMap vector tiles, free for any use, no key (same as the Map tab). */
const STYLE = {
  day: 'https://tiles.openfreemap.org/styles/positron',
  night: 'https://tiles.openfreemap.org/styles/dark',
};

/**
 * Web: the communities of the list on a real map (MapLibre on OpenStreetMap,
 * like the Map tab). Pages scroll over it; the map pans with two fingers or
 * Ctrl + scroll, so it never traps the page.
 */
export function CommunityMap(props: CommunityMapProps) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  if (props.status === 'loading') return <MapSkeleton />;
  if (props.status === 'error' || failed)
    return (
      <MapError
        onRetry={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
          props.onRetry?.();
        }}
      />
    );
  return <Engine key={attempt} {...props} onFail={() => setFailed(true)} />;
}

function Engine(props: CommunityMapProps & { onFail: () => void }) {
  const { cityId, onFail } = props;
  const t = useTheme();
  const night = t.mode === 'night';
  const reduced = useReducedMotion();
  const host = useRef<View>(null);
  const [map, setMap] = useState<MapLibre | null>(null);
  const [, setTick] = useState(0);
  const [view, setView] = useState<MapSpan | null>(null);
  const { spots, shown, selected, select, fitKey } = useCommunityMapModel(props, view);

  useEffect(() => {
    let alive = true;
    let created: MapLibre | null = null;
    (async () => {
      let lib: typeof import('maplibre-gl');
      try {
        lib = await import('maplibre-gl');
      } catch {
        if (alive) onFail();
        return;
      }
      const el = host.current as unknown as HTMLElement | null;
      if (!alive || !el) return;
      const b = spotBounds([], cityId);
      created = new lib.Map({
        container: el,
        style: night ? STYLE.night : STYLE.day,
        bounds: [
          [b.sw.longitude, b.sw.latitude],
          [b.ne.longitude, b.ne.latitude],
        ],
        attributionControl: false,
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      created.addControl(new lib.AttributionControl({ compact: true }), 'bottom-left');
      let loaded = false;
      created.on('load', () => {
        loaded = true;
      });
      // The style itself unreachable (offline, blocked): the error card with a retry, never a blank box.
      created.on('error', (e: { error?: { url?: string } }) => {
        if (!loaded && e.error?.url?.startsWith('https://tiles.openfreemap.org/styles/')) onFail();
      });
      const sync = () => {
        const b = created!.getBounds();
        const box = created!.getContainer();
        setView({ latSpan: b.getNorth() - b.getSouth(), lngSpan: b.getEast() - b.getWest(), width: box.clientWidth, height: box.clientHeight });
      };
      created.on('load', sync);
      created.on('moveend', sync);
      created.on('move', () => setTick((n) => n + 1));
      created.on('click', () => select(null));
      setMap(created);
    })();
    return () => {
      alive = false;
      created?.remove();
      setMap(null);
    };
    // Created once; theme changes swap the style below, spots refit below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styleShown = useRef(night ? STYLE.night : STYLE.day);
  useEffect(() => {
    const next = night ? STYLE.night : STYLE.day;
    if (!map || styleShown.current === next) return;
    styleShown.current = next;
    map.setStyle(next);
  }, [map, night]);

  // The map follows the list: refit to its markers whenever the places change.
  useEffect(() => {
    if (!map) return;
    const b = spotBounds(spots, cityId);
    map.fitBounds(
      [
        [b.sw.longitude, b.sw.latitude],
        [b.ne.longitude, b.ne.latitude],
      ],
      { padding: 36, maxZoom: 13.5, duration: reduced ? 0 : 500 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey, cityId, reduced]);

  const notice = noticeFor(props, spots);

  return (
    <MapFrame label={tx('Map of the communities')}>
      {/* MapLibre makes its container position: relative, so it fills a positioned box instead. */}
      <View style={StyleSheet.absoluteFill}>
        <View ref={host} style={styles.fill} />
      </View>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {map
          ? shown.map((s) => {
              const at = map.project([s.coords.longitude, s.coords.latitude]);
              const isSel = selected?.id === s.id;
              return (
                <Pressable
                  key={s.id}
                  style={[styles.pinBox, { left: at.x - 30, top: at.y - 20, zIndex: isSel ? 20 : s.kind === 'meetup' ? 2 : 1 }]}
                  onPress={() => {
                    haptic('select');
                    select(isSel ? null : s.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={pinLabel(s)}
                  testID="community-map-pin"
                >
                  <View pointerEvents="none">
                    <SpotPin spot={s} selected={isSel} />
                  </View>
                </Pressable>
              );
            })
          : null}
      </View>
      {notice ? <MapNotice icon={notice.icon} text={notice.text} /> : null}
      {selected ? <SpotSheet spot={selected} cityId={cityId} onClose={() => select(null)} /> : null}
    </MapFrame>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  pinBox: { position: 'absolute', width: 60, height: 40, alignItems: 'center', justifyContent: 'center' },
});
