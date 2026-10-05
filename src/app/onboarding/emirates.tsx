import { useFocusEffect, useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useRef, type RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrame } from '@/components/layout/AppFrame';
import { Badge, IconButton } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { citiesOf, DESTINATIONS } from '@/data/destinations';
import type { City } from '@/data/types';
import { useExpand } from '@/features/onboarding/useExpand';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { formatCount } from '@/lib/format';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';

export default function ChooseEmirate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const setDestination = useStore((s) => s.setDestination);
  const { overlay, expand, reset } = useExpand();
  const dest = DESTINATIONS.emirates;
  const cities = citiesOf('emirates');
  const [featured, ...others] = cities;
  const colW = (frame.width - space.gutter * 2 - 12) / 2;

  useFocusEffect(
    useCallback(() => {
      reset();
    }, [reset]),
  );

  const pick = (city: City, ref: RefObject<View | null>) => {
    haptic('press');
    setDestination('emirates', city.id);
    expand(ref, { photo: city.photo }, city.light, () => router.push('/onboarding/you'));
  };

  return (
    <View style={styles.root}>
      <Photo visual={{ photo: dest.photo }} light="dubai" scrim="full" width={1200} style={StyleSheet.absoluteFill} />
      <Animated.View entering={FadeIn.duration(500)} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)', '#000000']} locations={[0, 0.35, 0.7]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={enter.rise(0, 80)} style={styles.head}>
          <Text variant="overline" color="rgba(255,255,255,0.7)">
            {dest.flag}  IRLY Emirates
          </Text>
          <Text variant="displayL" tone="onDark">
            Choose your Emirate
          </Text>
          <Text variant="body" color="rgba(255,255,255,0.62)">
            Dubai is live first. The other emirates open with their founding members.
          </Text>
        </Animated.View>

        <Animated.View entering={enter.rise(1, 120)} style={{ paddingHorizontal: space.gutter }}>
          <FeaturedCard city={featured} onPick={pick} />
        </Animated.View>

        <View style={styles.grid}>
          {others.map((city, i) => (
            <Animated.View key={city.id} entering={enter.rise(i + 2, 140)}>
              <EmirateCard city={city} width={colW} onPick={pick} />
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.back, { top: insets.top + 8 }]}>
        <IconButton icon="chevronLeft" label="Back" variant="glass" onPress={() => router.back()} />
      </View>
      {overlay}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="number" tone="onDark">
        {formatCount(value)}
      </Text>
      <Text variant="caption" color="rgba(255,255,255,0.6)">
        {label}
      </Text>
    </View>
  );
}

function FeaturedCard({ city, onPick }: { city: City; onPick: (c: City, ref: RefObject<View | null>) => void }) {
  const ref = useRef<View>(null);
  return (
    <PressableScale ref={ref} haptic={false} onPress={() => onPick(city, ref)} style={styles.featured} accessibilityLabel={`${city.name}, launch city`}>
      <Photo visual={{ photo: city.photo }} light={city.light} scrim="strong" width={1000} style={StyleSheet.absoluteFill} />
      <View style={styles.featuredTop}>
        <Badge kind="live" onDark label="Launch city · live now" />
        <Text variant="caption" color="rgba(255,255,255,0.7)">
          {city.coordinates}
        </Text>
      </View>
      <View style={{ padding: 18, gap: 14 }}>
        <View>
          <Text variant="displayXL" tone="onDark">
            {city.name}
          </Text>
          <Text variant="body" color="rgba(255,255,255,0.78)">
            {city.tagline}
          </Text>
        </View>
        <Glass dark style={styles.stats}>
          <Stat value={city.stats.communities} label={tx('communities')} />
          <Stat value={city.stats.activities} label={tx('activities')} />
          <Stat value={city.stats.events} label="events this week" />
          <View style={styles.go}>
            <Icon name="arrowRight" size={20} color="#000000" strokeWidth={2.4} />
          </View>
        </Glass>
      </View>
    </PressableScale>
  );
}

function EmirateCard({ city, width, onPick }: { city: City; width: number; onPick: (c: City, ref: RefObject<View | null>) => void }) {
  const ref = useRef<View>(null);
  return (
    <PressableScale ref={ref} haptic={false} onPress={() => onPick(city, ref)} style={[styles.small, { width }]} accessibilityLabel={city.name}>
      <Photo visual={{ photo: city.photo }} light={city.light} scrim="strong" width={500} style={StyleSheet.absoluteFill} />
      <View style={{ padding: 12 }}>
        <Badge kind="neutral" onDark label="Early access" />
      </View>
      <View style={{ padding: 14, gap: 2 }}>
        <Text variant="titleM" tone="onDark" numberOfLines={1}>
          {city.name}
        </Text>
        <Text variant="caption" color="rgba(255,255,255,0.7)" numberOfLines={1}>
          {tx('{c} communities · {e} events', { c: city.stats.communities, e: city.stats.events })}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  head: { paddingHorizontal: space.gutter, gap: 8, marginBottom: space[7] },
  featured: { height: 330, borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'space-between' },
  featuredTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  stats: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.lg, gap: 8 },
  go: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: space.gutter,
    paddingTop: 12,
  },
  small: { height: 200, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'space-between' },
  back: { position: 'absolute', left: space.gutter },
});
