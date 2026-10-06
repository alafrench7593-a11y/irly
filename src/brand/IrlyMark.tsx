import { memo, useEffect } from 'react';
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
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { easing, spring } from '@/motion/tokens';
import { markDots, type Dot } from './dots';

/**
 * The IRLY mark: a lowercase "i" drawn in dots, whose dot is the 2×2
 * accent: you, here, in real life.
 *
 * States
 * - idle: light climbs the stem, the accent beats like a pulse
 * - loading: the stem dots chase upward, quickly
 * - success: every dot lights, the accent pops
 * - transition: the mark grows from the accent until it fills the screen
 * - static: no motion (lists, headers, reduced motion)
 */
export type MarkState = 'idle' | 'loading' | 'success' | 'transition' | 'static';

type Props = {
  size?: number;
  state?: MarkState;
  /** Stem colour. */
  ringColor?: string;
  /** Accent colour. */
  lensColor?: string;
  glow?: boolean;
  /** Called when the success or transition animation has finished. */
  onDone?: () => void;
};

const LAYOUT = markDots();
const STEM = LAYOUT.dots.filter((d) => !d.accent).length;

export const IrlyMark = memo(function IrlyMark({
  size = 64,
  state = 'idle',
  ringColor = '#FFFFFF',
  lensColor = '#FFFFFF',
  glow = true,
  onDone,
}: Props) {
  const pitch = size / 9;
  const dot = pitch * 0.88;
  const width = LAYOUT.cols * pitch;
  const height = (LAYOUT.rows - LAYOUT.top) * pitch;

  const wave = useSharedValue(0);
  const beat = useSharedValue(0);
  const lit = useSharedValue(0);
  const scale = useSharedValue(1);
  const fade = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(wave);
    cancelAnimation(beat);
    const loop = (ms: number) => withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false);
    const pulse = (up: number, down: number, rest: number) =>
      withRepeat(withSequence(withTiming(1, { duration: up, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: down, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: rest })), -1, false);

    switch (state) {
      case 'idle':
        wave.set(0);
        wave.set(loop(2600));
        beat.set(pulse(420, 700, 1100));
        lit.set(withTiming(0, { duration: 300 }));
        scale.set(withSpring(1, spring.smooth));
        fade.set(withTiming(1, { duration: 300 }));
        break;
      case 'loading':
        wave.set(0);
        wave.set(loop(800));
        beat.set(pulse(200, 300, 100));
        lit.set(withTiming(0, { duration: 200 }));
        break;
      case 'success':
        wave.set(withTiming(0, { duration: 200 }));
        beat.set(withSequence(withSpring(1, spring.bouncy), withTiming(0.4, { duration: 400 })));
        lit.set(withTiming(1, { duration: 260, easing: easing.standard }));
        break;
      case 'transition':
        lit.set(withTiming(1, { duration: 160 }));
        fade.set(withDelay(260, withTiming(0, { duration: 500 })));
        scale.set(withDelay(120, withTiming(40, { duration: 720, easing: easing.emphasized })));
        break;
      case 'static':
        wave.set(0);
        beat.set(0);
        lit.set(0);
        break;
    }
    // Callbacks are fired from JS timers, in step with the durations above.
    if (onDone && (state === 'success' || state === 'transition')) {
      const t = setTimeout(onDone, state === 'success' ? 900 : 760);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Grows from the accent, so the transition opens out of "you".
  const ax = (LAYOUT.dots.find((d) => d.accent)!.col + 1) * pitch - width / 2;
  const ay = (0.6 - LAYOUT.top) * pitch - height / 2;
  const container = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateX: ax }, { translateY: ay }, { scale: scale.value }, { translateX: -ax }, { translateY: -ay }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.35 + 0.45 * beat.value, transform: [{ scale: 0.9 + 0.25 * beat.value }] }));

  const moving = state !== 'static';
  const g = pitch * 5;

  return (
    <View style={{ width: size, height, alignItems: 'center' }} pointerEvents="none">
      <Animated.View style={[{ width, height }, container]}>
        {glow ? (
          <Animated.View style={[{ position: 'absolute', left: ax + width / 2 - g / 2, top: ay + height / 2 - g / 2, width: g, height: g }, glowStyle]}>
            <Svg width={g} height={g}>
              <Defs>
                <RadialGradient id="irlyGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={lensColor} stopOpacity={0.5} />
                  <Stop offset="0.5" stopColor={lensColor} stopOpacity={0.12} />
                  <Stop offset="1" stopColor={lensColor} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={g / 2} cy={g / 2} r={g / 2} fill="url(#irlyGlow)" />
            </Svg>
          </Animated.View>
        ) : null}
        {LAYOUT.dots.map((d) => {
          const style = {
            position: 'absolute' as const,
            left: d.col * pitch + (pitch - dot) / 2,
            top: (d.row - LAYOUT.top) * pitch + (pitch - dot) / 2,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: d.accent ? lensColor : ringColor,
          };
          return moving ? <MarkDot key={`${d.col}-${d.row}`} d={d} style={style} wave={wave} beat={beat} lit={lit} /> : <View key={`${d.col}-${d.row}`} style={style} />;
        })}
      </Animated.View>
    </View>
  );
});

function MarkDot({ d, style, wave, beat, lit }: { d: Dot; style: object; wave: SharedValue<number>; beat: SharedValue<number>; lit: SharedValue<number> }) {
  // Stem dots are numbered from the bottom: light climbs toward the accent.
  const k = d.accent ? 0 : (7 - d.row) / STEM;
  const animated = useAnimatedStyle(() => {
    if (d.accent) return { opacity: 1, transform: [{ scale: 1 + 0.3 * beat.value }] };
    const dist = Math.abs(((k - wave.value + 1.5) % 1) - 0.5);
    const band = Math.max(0, 1 - dist * 5);
    return { opacity: Math.max(lit.value, 0.55 + 0.45 * band), transform: [{ scale: 1 + 0.18 * band }] };
  });
  return <Animated.View style={[style, animated]} />;
}
