import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Film } from '@/components/visual/Film';
import { Photo } from '@/components/visual/Photo';
import { cityFilm } from '@/data/photos';
import type { City } from '@/data/types';
import { useIntro } from '@/features/intro/introStore';
import { ease, motion } from '@/motion/tokens';
import { useTheme } from '@/theme/useTheme';
import { heroPhoto } from './HomeHero';

/** How far the photo travels up while the whole page scrolls (parallax). */
const TRAVEL = 120;
/** How far below the hero the shade keeps deepening. */
const SHADE = 200;
/** IRLY Girl ground (#FBF2F4, girlPalette.bg) as an rgb triplet for the veils. */
const GIRL_BASE = '251,242,244';
/** IRLY Girl light: rose poudré at the top, beige chaud through the middle, crème below. */
const GIRL_WASH = ['rgba(244,200,214,0.42)', 'rgba(240,218,204,0.30)', 'rgba(251,242,244,0.22)'] as const;

/**
 * The city behind the whole Home: fixed, cropped to cover, with a veil
 * that deepens as you scroll so the glass panels on top stay readable.
 * The photo is there first (never a black screen); the film, when the city
 * has one, fades in over it once it can play and pauses in the background.
 *
 * Motion: it fades in with a slight zoom that settles once the app's
 * curtain lifts, then only follows the scroll (slower than the page).
 * No loop. With Reduce Motion it is simply there.
 */
export const HomeBackdrop = memo(function HomeBackdrop({ city, now, scrollY, heroH }: { city: City; now: number; scrollY: SharedValue<number>; heroH: number }) {
  const t = useTheme();
  const night = t.mode === 'night';
  const girl = t.flavor === 'girl';
  // The veil is the page ground: IRLY Noir/Clair, or the warm rose-cream of IRLY Girl (never grey).
  const base = night ? '5,5,6' : girl ? GIRL_BASE : '246,246,244';
  const reduced = useReducedMotion();
  const introDone = useIntro((s) => s.done);
  const settle = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (introDone && !reduced) settle.set(withTiming(1, { duration: motion.cinematic + 500, easing: ease.enter }));
  }, [introDone, reduced, settle]);

  const photo = useAnimatedStyle(() => {
    const y = scrollY.value;
    const pull = y < 0 ? 1 + -y / (heroH * 2) : 1;
    return {
      opacity: 0.35 + settle.value * 0.65,
      transform: [{ translateY: -interpolate(y, [0, heroH * 4], [0, TRAVEL], Extrapolation.CLAMP) }, { scale: (1.08 - settle.value * 0.08) * pull }],
    };
  });
  // Under the hero the city is clear; under the content it sits behind a veil.
  const veil = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [heroH * 0.25, heroH * 0.95], [0, 1], Extrapolation.CLAMP) }));

  const key = heroPhoto(city, now);
  const film = cityFilm(city.id, key);
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip, { backgroundColor: t.c.bg }]} pointerEvents="none">
      <Animated.View style={[styles.photo, photo]}>
        <Photo visual={{ photo: key }} light={city.light} width={1400} style={StyleSheet.absoluteFill} recyclingKey={`backdrop-${city.id}`} />
        {film && !reduced ? <Film uri={film} /> : null}
      </Animated.View>
      {/* IRLY Girl: a powder-rose and warm-beige light over the city, so the first screen reads rose poudré / crème. */}
      {girl ? <LinearGradient colors={GIRL_WASH} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} /> : null}
      {/* One shade from the top bar to below the hero (it carries the question), then an even veil: no seam. */}
      <LinearGradient
        colors={[night ? 'rgba(0,0,0,0.5)' : `rgba(${base},0.6)`, `rgba(${base},0)`, `rgba(${base},0.55)`, `rgba(${base},0.78)`]}
        locations={[0, 0.2, heroH / (heroH + SHADE), 1]}
        style={[styles.shade, { height: heroH + SHADE }]}
      />
      <View style={[styles.under, { top: heroH + SHADE - 1, backgroundColor: `rgba(${base},0.78)` }]} />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(${base},0.6)` }, veil]} />
    </View>
  );
});

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  // Taller than the screen so the parallax never shows an edge.
  photo: { position: 'absolute', left: 0, right: 0, top: 0, bottom: -TRAVEL },
  shade: { position: 'absolute', left: 0, right: 0, top: 0 },
  under: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
