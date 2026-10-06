import { memo, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/useTheme';
import { wordmarkDots, type Dot } from './dots';
import { IrlyMark, type MarkState } from './IrlyMark';

type WordmarkProps = {
  /** Roughly the type size it replaces: the caps are about this tall. */
  size?: number;
  color?: string;
  /** Accent dots colour (defaults to the wordmark colour). */
  accentColor?: string;
  /**
   * Motion: the dots light up in a sweep, then a band of light passes
   * across every few seconds and the accent pulses. Off in headers.
   */
  animated?: boolean;
};

const LAYOUT = wordmarkDots();

/**
 * The IRLY wordmark, set in dots on the halftone grid: four letters and the
 * 2×2 accent above the Y. Reads at 16 px in a header and 120 px on a splash.
 */
export const IrlyWordmark = memo(function IrlyWordmark({ size = 18, color, accentColor, animated = false }: WordmarkProps) {
  const t = useTheme();
  const ink = color ?? t.c.text;
  const accent = accentColor ?? ink;
  const pitch = size / 6.2;
  const dot = pitch * 0.88;
  const width = LAYOUT.cols * pitch;
  const height = (LAYOUT.rows - LAYOUT.top) * pitch;

  const enter = useSharedValue(animated ? 0 : 1);
  const sweep = useSharedValue(-1);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    enter.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    // A band of light crosses the letters, then rests.
    sweep.set(withDelay(900, withRepeat(withSequence(withTiming(1.4, { duration: 1500, easing: Easing.inOut(Easing.quad) }), withTiming(-1, { duration: 0 }), withTiming(-1, { duration: 2600 })), -1, false)));
    pulse.set(withDelay(1100, withRepeat(withSequence(withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 900 })), -1, false)));
    return () => {
      cancelAnimation(enter);
      cancelAnimation(sweep);
      cancelAnimation(pulse);
    };
  }, [animated, enter, sweep, pulse]);

  return (
    <View style={{ width, height }} accessibilityRole="image" accessibilityLabel="IRLY" pointerEvents="none">
      {LAYOUT.dots.map((d) => {
        const left = d.col * pitch + (pitch - dot) / 2;
        const top = (d.row - LAYOUT.top) * pitch + (pitch - dot) / 2;
        const style = { position: 'absolute' as const, left, top, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: d.accent ? accent : ink };
        return animated ? (
          <MovingDot key={`${d.col}-${d.row}`} d={d} style={style} enter={enter} sweep={sweep} pulse={pulse} />
        ) : (
          <View key={`${d.col}-${d.row}`} style={style} />
        );
      })}
    </View>
  );
});

function MovingDot({
  d,
  style,
  enter,
  sweep,
  pulse,
}: {
  d: Dot;
  style: object;
  enter: SharedValue<number>;
  sweep: SharedValue<number>;
  pulse: SharedValue<number>;
}) {
  const x = d.col / LAYOUT.cols;
  // Each dot arrives a little after its left neighbour, with a touch of jitter.
  const jitter = useMemo(() => ((d.col * 7 + d.row * 13) % 10) / 60, [d.col, d.row]);
  const animated = useAnimatedStyle(() => {
    const local = Math.min(1, Math.max(0, (enter.value * 1.8 - x - jitter) * 3));
    const band = Math.exp(-((x - sweep.value) ** 2) / 0.012);
    const beat = d.accent ? pulse.value : 0;
    return {
      opacity: local * (0.82 + 0.18 * band + 0.18 * beat),
      transform: [{ scale: local * (1 + 0.28 * band + 0.3 * beat) }],
    };
  });
  return <Animated.View style={[style, animated]} />;
}

type LogoProps = { size?: number; state?: MarkState; color?: string };

/** Mark + wordmark lockup. */
export const IrlyLogo = memo(function IrlyLogo({ size = 18, state = 'static', color }: LogoProps) {
  const t = useTheme();
  const ink = color ?? t.c.text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: size * 0.5 }}>
      <IrlyMark size={size * 1.6} state={state} ringColor={ink} lensColor={ink} glow={false} />
      <IrlyWordmark size={size} color={ink} />
    </View>
  );
});
