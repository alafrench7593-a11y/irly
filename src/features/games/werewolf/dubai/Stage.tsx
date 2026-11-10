import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Avatar } from '@/components/ui/Avatar';
import { t as tx } from '@/i18n';
import { haptic } from '@/motion/haptics';
import type { WwPlayer } from '../api';
import { BACKGROUND } from './art';
import { GoldDust, LivingScene } from './Motion';
import { DX, serif, useDubaiFonts } from './theme';

type Props = {
  phase: 'night' | 'day' | 'ended';
  title: string;
  subtitle?: string;
  clock?: ReactNode;
  players: WwPlayer[];
  mySeat?: number;
  /** Seats that can be chosen now (the current action's targets), and the one chosen. */
  targets: number[];
  chosen: number | null;
  /** Little marks on a seat (votes of the pack, «x2 vote», «immune»). */
  marks?: Record<number, string>;
  onPick?: (seat: number) => void;
};

/**
 * The table as the official mockup draws it: the city's scene, the phase's
 * title and clock in the middle, the players all around. A player who can be
 * chosen now glows; touching them sends the choice (the server checks it).
 */
export const Stage = memo(function Stage({ phase, title, subtitle, clock, players, mySeat, targets, chosen, marks, onPick }: Props) {
  const fonts = useDubaiFonts();
  const { width } = useWindowDimensions();
  const W = Math.min(width - 32, 560);
  const n = players.length;
  const face = n <= 8 ? 56 : n <= 12 ? 48 : n <= 16 ? 42 : 36;
  const H = Math.max(380, Math.round(W * 1.12));
  const rx = W / 2 - face / 2 - 6;
  const ry = H / 2 - face / 2 - 18;
  return (
    <View style={[styles.stage, { width: W, height: H }]}>
      <LivingScene source={phase === 'night' ? BACKGROUND.night : phase === 'day' ? BACKGROUND.day : BACKGROUND.victory} />
      <LinearGradient colors={['rgba(11,9,7,0.25)', 'rgba(11,9,7,0.1)', 'rgba(11,9,7,0.7)']} style={StyleSheet.absoluteFill} />
      {phase === 'night' ? <GoldDust count={10} height={H} /> : null}
      <View style={styles.center} pointerEvents="none">
        <Animated.View key={title} entering={FadeIn.duration(600)} style={styles.banner}>
          <Text style={[styles.title, serif(fonts, '900')]} accessibilityRole="header">
            {title.toUpperCase()}
          </Text>
          {subtitle ? <Text style={[styles.sub, serif(fonts, '600')]}>{subtitle}</Text> : null}
        </Animated.View>
        {clock ? <View style={styles.clock}>{clock}</View> : null}
      </View>
      {players.map((p, i) => {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const x = W / 2 + rx * Math.cos(a) - face / 2;
        const y = H / 2 + ry * Math.sin(a) - face / 2;
        return (
          <Seat
            key={p.seat}
            p={p}
            x={x}
            y={y}
            size={face}
            index={i}
            me={p.seat === mySeat}
            pickable={targets.includes(p.seat)}
            chosen={chosen === p.seat}
            mark={marks?.[p.seat]}
            onPick={onPick}
          />
        );
      })}
    </View>
  );
});

const Seat = memo(function Seat({ p, x, y, size, index, me, pickable, chosen, mark, onPick }: { p: WwPlayer; x: number; y: number; size: number; index: number; me: boolean; pickable: boolean; chosen: boolean; mark?: string; onPick?: (seat: number) => void }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  const fall = useSharedValue(p.alive ? 0 : 1);
  useEffect(() => {
    if (reduced || !pickable || chosen) {
      pulse.set(0);
      return;
    }
    pulse.set(withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1, false));
  }, [reduced, pickable, chosen, pulse]);
  useEffect(() => {
    // An elimination: a shake, then the portrait fades to grey.
    if (p.alive) {
      fall.set(0);
      return;
    }
    fall.set(reduced ? 1 : withSequence(withTiming(0.2, { duration: 120 }), withSpring(1, { damping: 8 })));
  }, [p.alive, fall, reduced]);
  const ring = useAnimatedStyle(() => ({ opacity: chosen ? 1 : 0.35 + pulse.get() * 0.65, transform: [{ scale: chosen ? 1.08 : 1 + pulse.get() * 0.06 }] }));
  const body = useAnimatedStyle(() => ({ opacity: 1 - fall.get() * 0.55, transform: [{ rotate: `${Math.sin(fall.get() * Math.PI * 3) * 6 * (1 - fall.get())}deg` }] }));
  const ringColor = chosen ? DX.redLight : pickable ? DX.goldLight : me ? DX.gold : DX.goldDark;
  return (
    <Animated.View entering={reduced ? undefined : ZoomIn.delay(index * 45).duration(380)} style={[styles.seat, { left: x, top: y, width: size }]}>
      <Pressable
        disabled={!pickable || !onPick}
        onPress={() => {
          haptic('select');
          onPick?.(p.seat);
        }}
        accessibilityRole="button"
        accessibilityState={{ disabled: !pickable, selected: chosen }}
        accessibilityLabel={p.name + (p.alive ? '' : ` · ${tx('eliminated')}`)}
        hitSlop={6}
      >
        <Animated.View style={body}>
          {(pickable || chosen || me) && p.alive ? <Animated.View style={[styles.ring, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, borderColor: ringColor }, ring]} /> : null}
          <View style={[styles.face, { width: size, height: size, borderRadius: size / 2, borderColor: chosen ? DX.redLight : DX.gold }]}>
            {p.bot || !p.user_id ? (
              <LinearGradient colors={['#2A1F14', DX.black]} style={[StyleSheet.absoluteFill, styles.initialBox]}>
                <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{p.name.slice(0, 1).toUpperCase()}</Text>
              </LinearGradient>
            ) : (
              <Avatar name={p.name} hue={0} userId={p.user_id} size={size - 3} />
            )}
          </View>
          {!p.alive ? (
            <Animated.View entering={reduced ? undefined : ZoomIn.duration(300)} style={[styles.dead, { width: size * 0.42, height: size * 0.42, borderRadius: size * 0.21 }]}>
              <Svg width={size * 0.24} height={size * 0.24} viewBox="0 0 24 24">
                <Path d="M5 5l14 14M19 5L5 19" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" />
              </Svg>
            </Animated.View>
          ) : p.acted ? (
            <View style={styles.acted} />
          ) : null}
        </Animated.View>
      </Pressable>
      <View style={[styles.nameTag, me && { borderColor: DX.gold }]}>
        <Text style={styles.name} numberOfLines={1}>
          {p.name}
        </Text>
      </View>
      {mark ? (
        <View style={styles.mark}>
          <Text style={styles.markText}>{mark}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  stage: { borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: DX.gold, alignSelf: 'center' },
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 10 },
  banner: { alignItems: 'center', borderWidth: 1.5, borderColor: DX.gold, borderRadius: 12, backgroundColor: 'rgba(11,9,7,0.78)', paddingHorizontal: 18, paddingVertical: 6, maxWidth: '62%' },
  title: { color: DX.goldLight, fontSize: 20, letterSpacing: 1.2, textAlign: 'center' },
  sub: { color: DX.ivory, fontSize: 12, textAlign: 'center' },
  clock: { borderWidth: 1.5, borderColor: DX.gold, borderRadius: 18, backgroundColor: 'rgba(11,9,7,0.85)', paddingHorizontal: 14, paddingVertical: 3 },
  seat: { position: 'absolute', alignItems: 'center' },
  ring: { position: 'absolute', left: -4, top: -4, borderWidth: 2.5 },
  face: { overflow: 'hidden', borderWidth: 2, backgroundColor: DX.black, alignItems: 'center', justifyContent: 'center' },
  initialBox: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: DX.goldLight, fontWeight: '800' },
  dead: { position: 'absolute', right: -4, top: -4, backgroundColor: DX.redLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  acted: { position: 'absolute', right: 0, top: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#3FBF6F', borderWidth: 2, borderColor: DX.black },
  nameTag: { marginTop: 3, borderWidth: 1, borderColor: 'transparent', borderRadius: 8, backgroundColor: 'rgba(11,9,7,0.8)', paddingHorizontal: 5, paddingVertical: 1, maxWidth: 76 },
  name: { color: DX.ivory, fontSize: 10.5, fontWeight: '700' },
  mark: { marginTop: 2, borderRadius: 8, backgroundColor: DX.red, borderWidth: 1, borderColor: DX.gold, paddingHorizontal: 5 },
  markText: { color: DX.goldLight, fontSize: 9.5, fontWeight: '800' },
});
