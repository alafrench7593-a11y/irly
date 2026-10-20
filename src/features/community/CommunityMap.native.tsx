import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useReducedMotion } from 'react-native-reanimated';
import { cityCoords } from '@/data/geo';
import { t as tx } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { useTheme } from '@/theme/useTheme';
import { MapError, MapFrame, MapNotice, MapSkeleton, noticeFor, pinLabel, SpotPin, SpotSheet, useCommunityMapModel, type CommunityMapProps } from './CommunityMapParts';
import { spotBounds } from './mapSpots';

/**
 * Phones: the communities of the list on the same real map as the Map tab
 * (Apple Maps on iPhone, Google Maps on Android). Tilt and rotation are off:
 * a compact map to see where communities meet, not to explore.
 */
export function CommunityMap(props: CommunityMapProps) {
  if (props.status === 'loading') return <MapSkeleton />;
  if (props.status === 'error') return <MapError onRetry={() => props.onRetry?.()} />;
  return <Engine {...props} />;
}

function Engine(props: CommunityMapProps) {
  const { cityId } = props;
  const t = useTheme();
  const reduced = useReducedMotion();
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const { spots, selected, select, fitKey } = useCommunityMapModel(props);
  const centre = cityCoords(cityId) ?? { latitude: 25.2, longitude: 55.27 };

  // The map follows the list: refit to its markers whenever the places change.
  useEffect(() => {
    if (!ready) return;
    const b = spotBounds(spots, cityId);
    map.current?.fitToCoordinates([b.sw, b.ne], { edgePadding: { top: 36, right: 36, bottom: 36, left: 36 }, animated: !reduced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey, cityId, reduced]);

  const notice = noticeFor(props, spots);

  return (
    <MapFrame label={tx('Map of the communities')}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...centre, latitudeDelta: 0.2, longitudeDelta: 0.2 }}
        onMapReady={() => setReady(true)}
        onPress={() => select(null)}
        pitchEnabled={false}
        rotateEnabled={false}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        userInterfaceStyle={t.mode === 'night' ? 'dark' : 'light'}
      >
        {spots.map((s) => {
          const isSel = selected?.id === s.id;
          return (
            <Marker
              key={s.id}
              coordinate={s.coords}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={Platform.OS === 'ios' || isSel}
              zIndex={isSel ? 20 : s.kind === 'meetup' ? 2 : 1}
              accessibilityLabel={pinLabel(s)}
              onPress={(e) => {
                e.stopPropagation();
                haptic('select');
                select(isSel ? null : s.id);
              }}
            >
              <View pointerEvents="none" style={styles.pinBox}>
                <SpotPin spot={s} selected={isSel} />
              </View>
            </Marker>
          );
        })}
      </MapView>
      {notice ? <MapNotice icon={notice.icon} text={notice.text} /> : null}
      {selected ? <SpotSheet spot={selected} cityId={cityId} onClose={() => select(null)} /> : null}
    </MapFrame>
  );
}

const styles = StyleSheet.create({
  pinBox: { width: 60, height: 40, alignItems: 'center', justifyContent: 'center' },
});
