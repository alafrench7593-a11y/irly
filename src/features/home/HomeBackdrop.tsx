import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Photo } from '@/components/visual/Photo';
import { bestPhoto, type PhotoKey } from '@/data/photos';
import type { City } from '@/data/types';
import { useIntro } from '@/features/intro/introStore';
import { usePhotoOverridesVersion } from '@/features/photo/overrides';
import { useFrame } from '@/components/layout/AppFrame';
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
 * One still photo, the best we have, and nothing else: no film fades in
 * over it any more (the Dubai Fountain clip used to pop in over the night
 * photo seconds after the page opened). It is decoration only: it never
 * takes a tap (pointerEvents none on the whole layer).
 *
 * On a phone in Dubai it is IRLY's own photo (see OWN_DAY), served whole on
 * dense screens; on wide screens the city's own HD photo (2400 px), always
 * the same one.
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

  const frame = useFrame();
  const key = backdropPhoto(city, now, frame.width < frame.height, girl);
  // The longest side of the screen: a full-screen cover needs that many points (times the density).
  const size = Math.max(frame.width, frame.height);
  // The IRLY team may replace the photo from the back office: a new list re-resolves it.
  const overrides = usePhotoOverridesVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uri = useMemo(() => bestPhoto(key, size), [key, size, overrides]);
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip, { backgroundColor: t.c.bg }]} pointerEvents="none">
      <Animated.View style={[styles.photo, photo]}>
        <Photo visual={{ photo: key, uri }} light={city.light} width={size} style={StyleSheet.absoluteFill} recyclingKey={`backdrop-${city.id}`} pinned />
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

/**
 * IRLY's own photos of the city, for tall (phone) screens, by space and by
 * day / night: IRLY Girl opens on friends in a pool above Dubai Marina
 * (1125 px), IRLY on the Burj Al Arab at sunset (1080 × 1920) and, at night,
 * the Burj Khalifa (736 px only: IRLY needs a larger original for very dense
 * screens). Wide screens keep the city's HD photo (2400 px).
 */
const OWN_DAY: Partial<Record<City['id'], { mixte: PhotoKey; girl: PhotoKey }>> = { dubai: { mixte: 'burjArabSunset', girl: 'poolGirl' } };
const OWN_NIGHT: Partial<Record<City['id'], { mixte: PhotoKey }>> = { dubai: { mixte: 'burjNight' } };

/** The Home background: IRLY's own photo first where it fits the screen, else the city's (by night, the city at night). */
export function backdropPhoto(city: City, now: number, tall: boolean, girl: boolean): PhotoKey {
  const key = heroPhoto(city, now);
  if (!tall) return key;
  if (key === city.photo) return OWN_DAY[city.id]?.[girl ? 'girl' : 'mixte'] ?? key;
  return (!girl && OWN_NIGHT[city.id]?.mixte) || key;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  // Taller than the screen so the parallax never shows an edge.
  photo: { position: 'absolute', left: 0, right: 0, top: 0, bottom: -TRAVEL },
  shade: { position: 'absolute', left: 0, right: 0, top: 0 },
  under: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
