import { StyleSheet, View } from 'react-native';
import { Photo } from '@/components/visual/Photo';
import { CITIES } from '@/data/destinations';
import { useStore } from '@/state/store';
import { useTheme } from '@/theme/useTheme';

/**
 * The destination's light, blurred and veiled: what surrounds the app on
 * desktop web, and a single-column page on wide screens (ScreenColumn).
 */
export function AmbientBackdrop() {
  const t = useTheme();
  const cityId = useStore((s) => s.cityId);
  const city = cityId ? CITIES[cityId] : null;
  const night = t.mode === 'night';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Photo visual={{ photo: city?.photo ?? 'emirates' }} light={city?.light ?? 'dubai'} blur={28} width={1600} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: night ? 'rgba(5,5,6,0.72)' : t.flavor === 'girl' ? 'rgba(251,242,244,0.72)' : 'rgba(246,246,244,0.7)' }]} />
    </View>
  );
}
