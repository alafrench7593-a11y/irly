import { LinearGradient } from 'expo-linear-gradient';
import { t as tx, a11y } from '@/i18n';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LiveDot } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import type { PhotoKey } from '@/data/photos';
import type { City, CityId } from '@/data/types';
import { useIntro } from '@/features/intro/introStore';
import { CITY_FILMS } from '@/data/photos';
import { HeroVideo } from './HeroVideo';
import { cityHour, localClock } from '@/lib/time';
import { PressableScale } from '@/motion/PressableScale';
import { ease, motion } from '@/motion/tokens';
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
 * The Home opens on the city itself: a full-bleed photograph of where you
 * are (at night, the city at night) that melts into the page, and the one
 * question of the app.
 *
 * Motion: as the app's curtain lifts the city zooms out into place
 * (cinematic), then breathes with a very slow drift (Ken Burns). The
 * question arrives word by word, then the destination and the live line.
 * Scrolling moves the photo slower than the page (parallax), pulling down
 * stretches it, and the words lift and fade. Transforms and opacity only;
 * with Reduce Motion everything is simply there.
 */
export const HomeHero = memo(function HomeHero({ city, now, height, scrollY, live, onDestination, onLive }: Props) {
  const t = useTheme();
  const night = t.mode === 'night';
  const base = night ? '5,5,6' : '246,246,244';
  const introDone = useIntro((s) => s.done);
  const reduced = useReducedMotion();
  const zoom = useSharedValue(reduced ? 1 : 0);
  const drift = useSharedValue(0);

  useEffect(() => {
    if (!introDone || reduced) return;
    zoom.set(withTiming(1, { duration: motion.cinematic + 700, easing: ease.enter }));
    drift.set(withDelay(1600, withRepeat(withTiming(1, { duration: 18000, easing: Easing.inOut(Easing.quad) }), -1, true)));
  }, [introDone, reduced, zoom, drift]);

  const photo = useAnimatedStyle(() => {
    const y = scrollY.value;
    const settle = 1.18 - zoom.value * 0.16;
    const breathe = 1 + drift.value * 0.06;
    if (y < 0) return { transform: [{ translateY: y / 2 }, { translateX: -drift.value * 10 }, { scale: settle * breathe * (1 + -y / height) }] };
    return { transform: [{ translateY: y * 0.45 }, { translateX: -drift.value * 10 }, { scale: settle * breathe }] };
  });
  const words = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, height * 0.42], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, height * 0.42], [0, -28], Extrapolation.CLAMP) }],
  }));

  const question = tx("What's happening around you?");
  const parts = question.split(' ');
  const after = 160 + parts.length * WORD_STEP;

  return (
    <View style={{ height }}>
      <View style={[StyleSheet.absoluteFill, styles.clip]}>
        <Animated.View style={[StyleSheet.absoluteFill, photo]}>
          <Photo visual={{ photo: heroPhoto(city, now) }} light={city.light} width={1400} style={StyleSheet.absoluteFill} recyclingKey={`hero-${city.id}`} />
          {CITY_FILMS[city.id] && !reduced ? <HeroVideo uri={CITY_FILMS[city.id]!} /> : null}
        </Animated.View>
      </View>
      <LinearGradient
        colors={[night ? 'rgba(0,0,0,0.55)' : 'rgba(246,246,244,0.75)', `rgba(${base},0)`, `rgba(${base},0.42)`, `rgba(${base},1)`]}
        locations={[0, 0.3, 0.6, 1]}
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
  clip: { overflow: 'hidden' },
  words: { position: 'absolute', left: space.gutter, right: space.gutter, bottom: space[5], gap: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16 },
  title: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: 360 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});
