import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useFrame } from '@/components/layout/AppFrame';
import { t as tx } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { space } from '@/theme/tokens';
import { GoldDust } from '../dubai/Motion';
import { DX, serif, useDubaiFonts } from '../dubai/theme';

const WOLF = require('../../../../../assets/games/classic/werewolf.webp');

/** Where the moon sits in the official illustration (720 × 960), as fractions of its width. */
const MOON = { x: 0.74, y: 0.16, r: 0.17 };
const MAX_W = 560;

/**
 * IRLY Game · Loup-Garou on the Home: the official illustration brought to
 * life (it arrives with the scroll, the moon breathes, fog drifts, gold dust
 * rises, the gold edge catches the light) and two real doors, the game and
 * its presentation. The loops run only while the card is on screen and never
 * with Reduce Motion; everything moves by transform and opacity.
 */
export const HomeWerewolfPromo = memo(function HomeWerewolfPromo({ scrollY }: { scrollY: SharedValue<number> }) {
  const router = useRouter();
  const frame = useFrame();
  const reduced = useReducedMotion();
  const fonts = useDubaiFonts();
  const W = Math.min(frame.width - 2 * space.gutter, MAX_W);
  // The illustration is 3:4. Small phones keep it almost whole; wide screens never stretch it.
  const H = Math.round(W * (W < 340 ? 1.3 : 1.22));
  const top = useSharedValue(-1);
  const [active, setActive] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // On screen or not: the loops below only run while it is.
  useAnimatedReaction(
    () => top.get() >= 0 && scrollY.get() + frame.height > top.get() + 40 && scrollY.get() < top.get() + H,
    (now, before) => {
      if (now !== before) scheduleOnRN(setActive, now);
    },
    [frame.height, H],
  );

  const loop = useSharedValue(0);
  const fog = useSharedValue(0);
  const sheen = useSharedValue(0);
  const press = useSharedValue(0);
  useEffect(() => {
    if (reduced || !active) {
      cancelAnimation(loop);
      cancelAnimation(fog);
      return;
    }
    loop.set(withRepeat(withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }), -1, true));
    fog.set(0);
    fog.set(withRepeat(withTiming(1, { duration: 26000, easing: Easing.linear }), -1, false));
    // One sweep of light on the gold edge each time the card comes into view.
    sheen.set(0);
    sheen.set(withDelay(500, withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) })));
  }, [reduced, active, loop, fog, sheen]);

  const reveal = useAnimatedStyle(() => {
    if (reduced || top.get() < 0) return { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] };
    const p = interpolate(scrollY.get() + frame.height - top.get(), [0, 260], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * 56 }, { scale: 0.94 + p * 0.06 + press.get() * 0.05 }] };
  });
  // Depth: the illustration travels slower than the card that frames it.
  const art = useAnimatedStyle(() => {
    if (reduced || top.get() < 0) return { transform: [{ scale: 1.08 }] };
    const p = interpolate(scrollY.get() + frame.height - top.get(), [0, frame.height + H], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ scale: 1.12 - loop.get() * 0.02 }, { translateY: (p - 0.5) * -26 }] };
  });
  const moon = useAnimatedStyle(() => ({ opacity: 0.4 + loop.get() * 0.6, transform: [{ scale: 1 + loop.get() * 0.12 + press.get() * 0.5 }] }));
  const fogA = useAnimatedStyle(() => ({ transform: [{ translateX: -W + fog.get() * W }] }));
  const fogB = useAnimatedStyle(() => ({ transform: [{ translateX: -fog.get() * W }] }));
  const edge = useAnimatedStyle(() => ({ opacity: 0.55 + loop.get() * 0.35 }));
  const sweep = useAnimatedStyle(() => ({ opacity: Math.sin(sheen.get() * Math.PI) * 0.5, transform: [{ translateX: -W * 0.6 + sheen.get() * W * 1.6 }, { rotate: '18deg' }] }));

  const openGame = useCallback(() => router.push('/games'), [router]);
  const play = useCallback(() => {
    haptic('press');
    if (reduced) {
      openGame();
      return;
    }
    press.set(withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    setLeaving(true);
  }, [reduced, openGame, press]);
  const left = useCallback(() => {
    setLeaving(false);
    press.set(0);
  }, [press]);

  const moonSize = W * MOON.r * 2.7;
  return (
    <Animated.View onLayout={(e) => top.set(e.nativeEvent.layout.y)} style={[styles.root, reveal]}>
      <View style={[styles.card, { width: W, height: H }]} testID="home-werewolf">
        <Animated.View style={[StyleSheet.absoluteFill, art]}>
          <Image source={WOLF} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={300} accessibilityLabel={tx('A werewolf under the full moon, above the village')} />
          {/* The moon's halo lives in the illustration's own layer: it stays on the moon whatever the scale. */}
          <Animated.View pointerEvents="none" style={[styles.halo, { width: moonSize, height: moonSize, left: W * MOON.x - moonSize / 2, top: W * MOON.y - moonSize / 2 }, moon]}>
            {[1, 0.82, 0.66].map((k) => (
              <View key={k} style={[styles.haloRing, { width: moonSize * k, height: moonSize * k, borderRadius: (moonSize * k) / 2 }]} />
            ))}
          </Animated.View>
        </Animated.View>
        {reduced ? null : (
          <View pointerEvents="none" style={[styles.fogBand, { top: H * 0.42, height: H * 0.3 }]}>
            <Animated.View style={[styles.fog, { width: W * 2 }, fogA]}>
              <LinearGradient colors={['rgba(190,205,230,0)', 'rgba(190,205,230,0.16)', 'rgba(190,205,230,0)', 'rgba(190,205,230,0.12)', 'rgba(190,205,230,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Animated.View style={[styles.fog, styles.fogLow, { width: W * 2 }, fogB]}>
              <LinearGradient colors={['rgba(160,175,205,0.1)', 'rgba(160,175,205,0)', 'rgba(160,175,205,0.14)', 'rgba(160,175,205,0)', 'rgba(160,175,205,0.1)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </View>
        )}
        <LinearGradient pointerEvents="none" colors={['rgba(11,9,7,0)', 'rgba(11,9,7,0.2)', 'rgba(11,9,7,0.88)', 'rgba(11,9,7,0.98)']} locations={[0, 0.38, 0.68, 1]} style={StyleSheet.absoluteFill} />
        {active ? <GoldDust count={9} height={H} /> : null}
        <View style={styles.copy}>
          <Text style={[styles.eyebrow, serif(fonts, '700')]} accessibilityRole="header">
            {'🐺 IRLY GAME — LOUP-GAROU'}
          </Text>
          <Text style={[styles.title, serif(fonts, '900')]}>{tx('Bluff, investigate and unmask the Wolves.')}</Text>
          <Text style={styles.body}>{tx('Join a game with other players, discover your character and try to survive until morning.')}</Text>
          <View style={styles.actions}>
            <PressableScale haptic={false} scaleTo={0.96} onPress={play} accessibilityRole="button" accessibilityLabel={tx('Play now')} testID="home-werewolf-play" style={styles.primaryWrap}>
              <LinearGradient colors={[DX.goldLight, DX.gold, DX.goldDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
                <Text style={[styles.primaryLabel, serif(fonts, '900')]}>{tx('Play now')}</Text>
              </LinearGradient>
            </PressableScale>
            <PressableScale haptic="select" scaleTo={0.97} onPress={() => router.push('/games/discover')} accessibilityRole="button" accessibilityLabel={tx('Discover the game')} testID="home-werewolf-discover" style={styles.secondary}>
              <Text style={[styles.secondaryLabel, serif(fonts, '700')]}>{tx('Discover the game')}</Text>
            </PressableScale>
          </View>
        </View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.edge, edge]} />
        {reduced ? null : (
          <Animated.View pointerEvents="none" style={[styles.sweep, { height: H * 1.6, top: -H * 0.3 }, sweep]}>
            <LinearGradient colors={['rgba(247,222,151,0)', 'rgba(247,222,151,0.5)', 'rgba(247,222,151,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
      </View>
      {leaving ? <MoonGate onOpen={openGame} onDone={left} /> : null}
    </Animated.View>
  );
});

/**
 * The way into the game: the screen darkens, the moon comes to the centre,
 * grows until it fills the screen, and the game's real screen is behind it.
 */
function MoonGate({ onOpen, onDone }: { onOpen: () => void; onDone: () => void }) {
  const frame = useFrame();
  const p = useSharedValue(0);
  const opened = useRef(false);
  const open = useCallback(() => {
    if (opened.current) return;
    opened.current = true;
    onOpen();
  }, [onOpen]);
  useEffect(() => {
    p.set(
      withSequence(
        withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
        withTiming(2, { duration: 380, easing: Easing.in(Easing.cubic) }, (ok) => {
          if (ok) scheduleOnRN(open);
        }),
        withDelay(260, withTiming(3, { duration: 280 }, (ok) => {
          if (ok) scheduleOnRN(onDone);
        })),
      ),
    );
    // Whatever happens to the animation, the game opens and the gate closes.
    const a = setTimeout(open, 1100);
    const b = setTimeout(onDone, 1900);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [p, open, onDone]);
  const size = Math.min(frame.width, 430) * 0.42;
  const grow = (Math.hypot(frame.width, frame.height) / size) * 1.15;
  const dark = useAnimatedStyle(() => ({ opacity: interpolate(p.get(), [0, 1, 2, 3], [0, 0.92, 1, 0]) }));
  const disc = useAnimatedStyle(() => ({
    opacity: interpolate(p.get(), [0, 0.4, 2, 3], [0, 1, 1, 0]),
    transform: [{ scale: interpolate(p.get(), [0, 1, 2], [0.5, 1, grow], Extrapolation.CLAMP) }],
  }));
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onDone}>
      <Pressable style={styles.gate} onPress={open} accessibilityLabel={tx('Loup-Garou')}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.gateDark, dark]} />
        <Animated.View style={[styles.gateMoon, { width: size, height: size, borderRadius: size / 2 }, disc]} />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingTop: space[6] },
  card: { borderRadius: 26, overflow: 'hidden', backgroundColor: DX.black },
  halo: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  haloRing: { position: 'absolute', backgroundColor: 'rgba(214,226,255,0.09)' },
  fogBand: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  fog: { position: 'absolute', top: 0, bottom: '35%', left: 0 },
  fogLow: { top: '35%', bottom: 0 },
  copy: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18, gap: 8 },
  eyebrow: { color: DX.gold, fontSize: 12, letterSpacing: 1.6 },
  title: { color: DX.ivory, fontSize: 21, lineHeight: 27 },
  body: { color: DX.muted, fontSize: 14, lineHeight: 20 },
  actions: { gap: 10, marginTop: 8 },
  primaryWrap: { borderRadius: 16, overflow: 'hidden' },
  primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryLabel: { color: '#221506', fontSize: 16, letterSpacing: 1.4, textTransform: 'uppercase' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(226,182,83,0.55)', backgroundColor: 'rgba(11,9,7,0.45)', paddingHorizontal: 18 },
  secondaryLabel: { color: DX.goldLight, fontSize: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
  edge: { borderRadius: 26, borderWidth: 1.5, borderColor: DX.gold },
  sweep: { position: 'absolute', left: 0, width: 70 },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gateDark: { backgroundColor: '#05060B' },
  gateMoon: { backgroundColor: '#E9EEFB', shadowColor: '#BFD0FF', shadowOpacity: 0.9, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } },
});
