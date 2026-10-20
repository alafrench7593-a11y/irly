import { LinearGradient } from 'expo-linear-gradient';
import { t as tx, a11y } from '@/i18n';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { LiveDot } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import type { PhotoKey } from '@/data/photos';
import type { City, CityId } from '@/data/types';
import { useIntro } from '@/features/intro/introStore';
import { cityHour, localClock } from '@/lib/time';
import { PressableScale } from '@/motion/PressableScale';
import { motion } from '@/motion/tokens';
import { space, type } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** After dark the hero shows the city at night where we have the photo. */
const NIGHT: Partial<Record<CityId, PhotoKey>> = { dubai: 'dubaiNight', abudhabi: 'abudhabiSkyline' };

export function heroPhoto(city: City, now: number): PhotoKey {
  const h = cityHour(city, now);
  if ((h >= 18.5 || h < 5.5) && NIGHT[city.id]) return NIGHT[city.id]!;
  if (city.id === 'bali' && h >= 5.5 && h < 8.5) return 'baliDawn';
  return city.photo;
}

type Props = {
  city: City;
  now: number;
  height: number;
  scrollY: SharedValue<number>;
  /** People live around you right now. */
  live: number;
  onDestination: () => void;
  onLive: () => void;
};

const WORD_STEP = 70;

/**
 * The Home opens on the city itself (the fixed HomeBackdrop behind the
 * whole page: at night, the city at night) and the one question of the app.
 *
 * Motion: the question arrives word by word, then the destination and the
 * live line. Scrolling lifts and fades the words. Transforms and opacity
 * only; with Reduce Motion everything is simply there.
 */
export const HomeHero = memo(function HomeHero({ city, now, height, scrollY, live, onDestination, onLive }: Props) {
  const t = useTheme();
  const night = t.mode === 'night';
  const base = night ? '5,5,6' : '246,246,244';
  const introDone = useIntro((s) => s.done);
  const reduced = useReducedMotion();

  const words = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, height * 0.42], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, height * 0.42], [0, -28], Extrapolation.CLAMP) }],
  }));

  const question = tx("What's happening around you?");
  const parts = question.split(' ');
  const after = 160 + parts.length * WORD_STEP;

  return (
    <View style={{ height }}>
      {/* The city itself is the page backdrop (HomeBackdrop); here only the shade that carries the words. */}
      <LinearGradient
        colors={[`rgba(${base},0)`, `rgba(${base},0)`, `rgba(${base},0.5)`, `rgba(${base},0.82)`]}
        locations={[0, 0.45, 0.75, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Animated.View style={[styles.words, words]}>
        {introDone ? (
          <>
            <Animated.View entering={reduced ? undefined : FadeIn.duration(motion.slow).delay(after)} style={{ alignSelf: 'flex-start' }}>
              <PressableScale
                haptic="select"
                scaleTo={0.96}
                onPress={onDestination}
                accessibilityLabel={tx('{city}. Change destination', { city: city.name })}
              >
                <Glass level="thin" dark style={styles.meta}>
                  <Icon name="pin" size={13} color="#FFFFFF" />
                  <Text variant="label" color="#FFFFFF">
                    {city.name} · {localClock(city, now)} · {city.temperature}°C
                  </Text>
                  <Icon name="chevronDown" size={13} color="#FFFFFF" />
                </Glass>
              </PressableScale>
            </Animated.View>
            <View style={styles.title} accessible accessibilityRole="header" accessibilityLabel={a11y(question)}>
              {parts.map((w, i) => (
                <Animated.View
                  key={`${w}-${i}`}
                  entering={reduced ? undefined : FadeInDown.springify(640).dampingRatio(0.8).delay(140 + i * WORD_STEP)}
                  importantForAccessibility="no-hide-descendants"
                >
                  <Text raw variant="displayL" style={{ marginRight: i < parts.length - 1 ? type.displayL.fontSize * 0.24 : 0 }}>
                    {w}
                  </Text>
                </Animated.View>
              ))}
            </View>
            {live ? (
              <Animated.View entering={reduced ? undefined : FadeIn.duration(motion.slow).delay(after + 120)} style={{ alignSelf: 'flex-start' }}>
                <PressableScale haptic="select" scaleTo={0.97} onPress={onLive} style={styles.live} accessibilityLabel={tx('{n} people live right now. Open IRL', { n: live })}>
                  <LiveDot size={7} />
                  <Text variant="label" tone="secondary">
                    {tx('{n} people live right now', { n: live })}
                  </Text>
                  <Icon name="chevronRight" size={14} color={t.c.textSecondary} />
                </PressableScale>
              </Animated.View>
            ) : null}
          </>
        ) : null}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  words: { position: 'absolute', left: space.gutter, right: space.gutter, bottom: space[5], gap: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16 },
  title: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: 360 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});
