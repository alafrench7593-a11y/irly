import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, Extrapolation, interpolate, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useFrame } from '@/components/layout/AppFrame';
import { Glass } from '@/components/ui/Glass';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useAccount } from '@/features/auth/account';
import { t as tx } from '@/i18n';
import { hasBackend } from '@/lib/supabase';
import { useNow } from '@/lib/useNow';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useGamesOverview } from './api';
import { gamesLine } from './lines';

const WOLF = require('../../../assets/games/classic/werewolf.webp');
/** Where the moon sits in the official illustration (720 × 960), as fractions of its width. */
const MOON = { x: 0.74, y: 0.16, r: 0.17 };

/**
 * « IRLY Games » on the Home: one card, the size of an activity card of the
 * Home's grid (same width, photo ratio, corners, margins and text rows), on
 * the official Loup-Garou illustration brought to life: it arrives with the
 * scroll, the moon breathes, fog drifts, light sweeps once. The loops run
 * only while the card is on screen and never with Reduce Motion. The card
 * opens IRLY Games, never a game directly. Numbers are the server's, shown
 * only when there are some.
 */
export const HomeGames = memo(function HomeGames({ scrollY, width }: { scrollY: SharedValue<number>; width: number }) {
  const t = useTheme();
  const router = useRouter();
  const frame = useFrame();
  const reduced = useReducedMotion();
  const account = useAccount();
  const signedIn = hasBackend && Boolean(account);
  const top = useSharedValue(-1);
  const [active, setActive] = useState(false);
  const photoH = Math.round(width * 0.78);
  const photoW = width - 12;

  useAnimatedReaction(
    () => top.get() >= 0 && scrollY.get() + frame.height > top.get() + 40 && scrollY.get() < top.get() + photoH + 220,
    (now, before) => {
      if (now !== before) scheduleOnRN(setActive, now);
    },
    [frame.height, photoH],
  );
  const loop = useSharedValue(0);
  const fog = useSharedValue(0);
  const sheen = useSharedValue(0);
  useEffect(() => {
    if (reduced || !active) {
      cancelAnimation(loop);
      cancelAnimation(fog);
      return;
    }
    loop.set(withRepeat(withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }), -1, true));
    fog.set(0);
    fog.set(withRepeat(withTiming(1, { duration: 24000, easing: Easing.linear }), -1, false));
    sheen.set(0);
    sheen.set(withDelay(450, withTiming(1, { duration: 1300, easing: Easing.out(Easing.cubic) })));
  }, [reduced, active, loop, fog, sheen]);

  const reveal = useAnimatedStyle(() => {
    if (reduced || top.get() < 0) return { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] };
    const p = interpolate(scrollY.get() + frame.height - top.get(), [0, 240], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * 56 }, { scale: 0.94 + p * 0.06 }] };
  });
  // Depth: the illustration moves a little slower than the card that frames it.
  const art = useAnimatedStyle(() => {
    if (reduced || top.get() < 0) return { transform: [{ scale: 1.06 }] };
    const p = interpolate(scrollY.get() + frame.height - top.get(), [0, frame.height + photoH], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ scale: 1.1 - loop.get() * 0.02 }, { translateY: (p - 0.5) * -12 }] };
  });
  const moon = useAnimatedStyle(() => ({ opacity: 0.4 + loop.get() * 0.6, transform: [{ scale: 1 + loop.get() * 0.12 }] }));
  const fogA = useAnimatedStyle(() => ({ transform: [{ translateX: -photoW + fog.get() * photoW }] }));
  const sweep = useAnimatedStyle(() => ({ opacity: Math.sin(sheen.get() * Math.PI) * 0.45, transform: [{ translateX: -photoW * 0.5 + sheen.get() * photoW * 1.5 }, { rotate: '18deg' }] }));
  const halo = photoW * MOON.r * 2.7;

  return (
    <Animated.View onLayout={(e) => top.set(e.nativeEvent.layout.y)} style={[styles.root, reveal]}>
      <PressableScale haptic="select" scaleTo={0.99} onPress={() => router.push('/games')} accessibilityRole="button" accessibilityLabel="IRLY Games">
        <View style={styles.head}>
          <Icon name="gamepad" size={18} color={t.c.text} />
          <Text variant="titleM" style={{ flex: 1 }}>
            IRLY Games
          </Text>
          {signedIn ? <Online /> : null}
          <Icon name="chevronRight" size={18} color={t.c.textTertiary} />
        </View>
      </PressableScale>
      {signedIn ? <HourLine /> : null}
      <View style={styles.grid}>
        <PressableScale
          onPress={() => router.push('/games')}
          haptic="select"
          scaleTo={0.97}
          style={[styles.tile, { width, boxShadow: t.shadow.card }]}
          accessibilityRole="button"
          accessibilityLabel={`IRLY Games. ${tx('Play, bluff and meet people.')} Loup-Garou. ${tx('Discover the games')}`}
          testID="home-games-card"
        >
          <GlassLayer radius={radius.xl} />
          <View style={[styles.tilePhoto, { height: photoH }]}>
            <Animated.View style={[StyleSheet.absoluteFill, art]}>
              <Image source={WOLF} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={250} accessibilityLabel={tx('A werewolf under the full moon, above the village')} />
              <Animated.View pointerEvents="none" style={[styles.halo, { width: halo, height: halo, left: photoW * MOON.x - halo / 2, top: photoW * MOON.y - halo / 2 }, moon]}>
                {[1, 0.82, 0.66].map((k) => (
                  <View key={k} style={[styles.haloRing, { width: halo * k, height: halo * k, borderRadius: (halo * k) / 2 }]} />
                ))}
              </Animated.View>
            </Animated.View>
            {reduced ? null : (
              <View pointerEvents="none" style={[styles.fogBand, { top: photoH * 0.5, height: photoH * 0.4 }]}>
                <Animated.View style={[styles.fog, { width: photoW * 2 }, fogA]}>
                  <LinearGradient colors={['rgba(190,205,230,0)', 'rgba(190,205,230,0.18)', 'rgba(190,205,230,0)', 'rgba(190,205,230,0.14)', 'rgba(190,205,230,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
                </Animated.View>
              </View>
            )}
            {reduced ? null : (
              <Animated.View pointerEvents="none" style={[styles.sweep, { height: photoH * 1.6, top: -photoH * 0.3 }, sweep]}>
                <LinearGradient colors={['rgba(247,222,151,0)', 'rgba(247,222,151,0.55)', 'rgba(247,222,151,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            )}
            {signedIn ? <Playing /> : null}
          </View>
          <View style={styles.tileBody}>
            <View style={styles.inline}>
              <Icon name="gamepad" size={12} color={GOLD} />
              <Text variant="overline" color={GOLD} numberOfLines={1} style={{ flexShrink: 1 }}>
                IRLY GAMES
              </Text>
            </View>
            <Text variant="titleS" numberOfLines={2}>
              Play, bluff and meet people.
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              Loup-Garou 🐺
            </Text>
            <View style={styles.inline}>
              <Icon name="arrowRight" size={12} color={t.c.textSecondary} />
              <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                Discover the games
              </Text>
            </View>
          </View>
        </PressableScale>
      </View>
    </Animated.View>
  );
});

const GOLD = '#E2B653';

/** Members online in IRLY Games, when there are some. */
function Online() {
  const t = useTheme();
  const { data } = useGamesOverview();
  const online = data?.online ?? 0;
  if (online <= 0) return null;
  return (
    <View style={styles.online}>
      <View style={[styles.dot, { backgroundColor: t.c.positive }]} />
      <Text variant="caption" tone="secondary" raw>
        {tx('{n} online', { n: online })}
      </Text>
    </View>
  );
}

/** A line that fits the hour. */
function HourLine() {
  const t = useTheme();
  const now = useNow(60_000);
  const line = useMemo(() => gamesLine(new Date(now).getHours(), now), [now]);
  return (
    <View style={[styles.line, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <Text variant="bodyL" style={styles.lineTitle} raw>
        {tx(line.title)}
      </Text>
      <Text tone="secondary" raw>
        {tx(line.body)}
      </Text>
    </View>
  );
}

/** On the photo, as an activity's « Live » badge: people playing or tables to join right now. */
function Playing() {
  const { data } = useGamesOverview();
  const wolves = data?.games.find((g) => g.game === 'werewolf');
  const label = wolves?.in_game ? tx('{n} playing now', { n: wolves.in_game }) : wolves?.waiting ? tx('{n} games to join', { n: wolves.waiting }) : null;
  if (!label) return null;
  return (
    <Glass dark style={styles.tileLive}>
      <Text variant="overline" tone="onDark" raw>
        {label}
      </Text>
    </Glass>
  );
}

// The tile's measures are those of the Home's activity tile (components/cards/HomeCards: tile, tilePhoto, tileBody).
const styles = StyleSheet.create({
  root: { gap: space[4], paddingTop: space[6] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space.gutter },
  online: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  dot: { width: 7, height: 7, borderRadius: 4 },
  line: { marginHorizontal: space.gutter, padding: space[5], borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space[2] },
  lineTitle: { fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: space.gutter },
  tile: { borderRadius: radius.xl, overflow: 'hidden' },
  tilePhoto: { margin: 6, marginBottom: 0, borderRadius: radius.xl - 6, overflow: 'hidden', backgroundColor: '#0B0907' },
  tileLive: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 9, borderRadius: 12 },
  tileBody: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  halo: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  haloRing: { position: 'absolute', backgroundColor: 'rgba(214,226,255,0.09)' },
  fogBand: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  fog: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  sweep: { position: 'absolute', left: 0, width: 46 },
});
