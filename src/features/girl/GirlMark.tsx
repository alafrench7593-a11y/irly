import { useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { Text } from '@/components/ui/Text';
import { t as tx } from '@/i18n';
import { ease, easing, motion, spring } from '@/motion/tokens';
import { GirlLogo } from './GirlLogo';
import { girl } from './theme';
import { GlassFill } from './ui';

/**
 * GirlMark: the IRLY Girl wordmark in motion. It always draws GirlLogo
 * itself (same letters, stop and italic word, never redrawn or rasterised),
 * then moves the whole mark as one piece: opacity, uniform scale and a small
 * rise only, so the letters are never distorted and rest at scale 1.
 *
 * Variants
 * - `launch`: a rose and nacre halo opens behind the mark, the mark fades in
 *   while it settles from 0.92 to 1, one pearl-rose shimmer crosses the
 *   letters, then `onDone` fires so the parent can move on. `glint` (off by
 *   default) adds a slow glint every 12 s, for the launch screen only.
 * - `intro`: fade and a small rise, one shimmer, then `onDone`.
 * - `header`: fades in on mount and again (softly) when its screen regains
 *   focus; a tiny pulse when `section` changes. Needs to sit inside a screen
 *   (it uses expo-router's useFocusEffect); the other variants work anywhere.
 * - `inline`: the static logo, no motion.
 * Reduce Motion: every variant shows its final state at once and `onDone`
 * fires right away. Nothing loops forever.
 *
 * Ready-made pieces for other screens:
 * - `<GirlHeaderMark section={...} word="Girl" onDark pill />`: the mark for
 *   a top bar; `pill` puts it on the dark glass pill of the IRLY Girl home.
 * - `<GirlLoader label="Opening your space…" />`: the mark over a breathing
 *   halo, for loading states. The halo breathes a fixed number of times,
 *   then rests.
 *
 * Motion primitives (exported, built on src/motion/tokens): `markMotion`,
 * `useAppear` / `useFade` / `useScaleIn`, `useShimmer` + `ShimmerSweep`,
 * `Halo`, `useStateTransition`.
 */

/** Timings of the mark, all from the IRLY motion tokens. */
export const markMotion = {
  /** Opacity and scale-in of the launch mark. */
  appear: { duration: motion.cinematic, easing: ease.enter },
  /** Fade (and small rise) of the intro and header marks. */
  fade: { duration: motion.slow + 160, easing: ease.enter },
  /** The launch mark settles from this scale to 1 (uniform). */
  scaleFrom: 0.92,
  /** Rise, in points, of the intro mark. */
  rise: 10,
  /** One shimmer sweep across the letters. */
  shimmer: { duration: 980, easing: easing.inOut },
  /** The halo opening behind the launch mark. */
  halo: { duration: motion.cinematic + 240, easing: ease.enter },
  /** Loader halo: one breath (in or out) and how many before it rests. */
  breathe: { duration: 1300, breaths: 10 },
  /** The optional launch glint. */
  glintEvery: 12000,
  /** Pulse when the section changes. */
  state: spring.fast,
} as const;

type Appear = { delay?: number; duration?: number; scaleFrom?: number; rise?: number; reduced?: boolean; auto?: boolean };

/**
 * Appear: opacity 0 → 1 with an optional uniform scale-in and rise, on the
 * `ease.enter` curve. `play(from)` replays it (from a partial state when
 * `from` > 0). With `reduced` it is simply there.
 */
export function useAppear({ delay = 0, duration = markMotion.fade.duration, scaleFrom = 1, rise = 0, reduced = false, auto = true }: Appear = {}) {
  const progress = useSharedValue(reduced || !auto ? 1 : 0);
  const play = useCallback(
    (from = 0, wait = 0) => {
      if (reduced) {
        progress.set(1);
        return;
      }
      cancelAnimation(progress);
      progress.set(from);
      progress.set(withDelay(wait, withTiming(1, { duration, easing: ease.enter })));
    },
    [reduced, progress, duration],
  );
  useEffect(() => {
    if (auto) play(0, delay);
  }, [auto, play, delay]);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // Opacity leads the movement a little, so the mark is legible before it settles.
    return {
      opacity: Math.min(1, p * 1.35),
      transform: [{ translateY: (1 - p) * rise }, { scale: scaleFrom + (1 - scaleFrom) * p }],
    };
  });
  return { progress, style, play };
}

/** Fade: appear without any movement. */
export const useFade = (o: Omit<Appear, 'scaleFrom' | 'rise'> = {}) => useAppear(o);
/** Scale-in: appear from `markMotion.scaleFrom` (uniform). */
export const useScaleIn = (o: Omit<Appear, 'scaleFrom'> = {}) => useAppear({ scaleFrom: markMotion.scaleFrom, ...o });

/**
 * Shimmer: one sweep, 0 → 1, after `delay`. `play()` runs it again (used by
 * the optional glint). Disabled or reduced, it never runs.
 */
export function useShimmer({ delay = 0, enabled = true, reduced = false }: { delay?: number; enabled?: boolean; reduced?: boolean } = {}) {
  const progress = useSharedValue(0);
  const play = useCallback(
    (wait = 0) => {
      if (reduced || !enabled) return;
      cancelAnimation(progress);
      progress.set(0);
      progress.set(withDelay(wait, withTiming(1, markMotion.shimmer)));
    },
    [reduced, enabled, progress],
  );
  useEffect(() => {
    play(delay);
  }, [play, delay]);
  return { progress, play };
}

/** Strips of the shimmer band, centre brightest: a soft edge without a mask. */
const BAND = [0.18, 0.42, 0.72, 0.95, 0.72, 0.42, 0.18];

/**
 * The shimmer itself: a soft vertical band of narrow windows travelling
 * across the mark. Each window shows a pearl-tinted copy of the mark exactly
 * on top of the real one (the window moves one way, the copy the other), so
 * only the letters light up, as real text, on web and native alike.
 */
export const ShimmerSweep = memo(function ShimmerSweep({
  progress,
  width,
  height,
  children,
}: {
  progress: SharedValue<number>;
  width: number;
  height: number;
  /** The tinted copy, laid out exactly like the mark it covers. */
  children: ReactNode;
}) {
  if (!width || !height) return null;
  const band = Math.max(36, width * 0.34);
  const strip = band / BAND.length;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {BAND.map((peak, k) => (
        <Strip key={k} progress={progress} index={k} peak={peak} strip={strip} band={band} width={width} height={height}>
          {children}
        </Strip>
      ))}
    </View>
  );
});

function Strip({
  progress,
  index,
  peak,
  strip,
  band,
  width,
  height,
  children,
}: {
  progress: SharedValue<number>;
  index: number;
  peak: number;
  strip: number;
  band: number;
  width: number;
  height: number;
  children: ReactNode;
}) {
  const win = useAnimatedStyle(() => {
    const p = progress.value;
    const x = -band + p * (width + band) + index * strip;
    return { opacity: p > 0 && p < 1 ? peak : 0, transform: [{ translateX: x }] };
  });
  const copy = useAnimatedStyle(() => {
    const p = progress.value;
    return { transform: [{ translateX: -(-band + p * (width + band) + index * strip) }] };
  });
  return (
    <Animated.View style={[styles.strip, { width: strip + 0.5, height }, win]}>
      <Animated.View style={[styles.copy, { width, height }, copy]}>{children}</Animated.View>
    </Animated.View>
  );
}

/**
 * Halo: a soft radial light (rose at the heart, nacre around) centred behind
 * the mark. `progress` drives its opacity and a uniform scale; it is drawn
 * with react-native-svg, outside the letters, and never clips them.
 */
export const Halo = memo(function Halo({
  progress,
  width,
  height,
  onDark = false,
}: {
  progress: SharedValue<number>;
  width: number;
  height: number;
  onDark?: boolean;
}) {
  const id = `gh${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: 0.8 + progress.value * 0.2 }] }));
  const heart = onDark ? '#FFFFFF' : girl.brand;
  const nacre = onDark ? '#E6DCFF' : girl.blush;
  return (
    <Animated.View pointerEvents="none" style={[styles.halo, { width, height, marginLeft: -width / 2, marginTop: -height / 2 }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={heart} stopOpacity={onDark ? 0.32 : 0.2} />
            <Stop offset="0.45" stopColor={nacre} stopOpacity={onDark ? 0.18 : 0.55} />
            <Stop offset="1" stopColor={nacre} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
});

/**
 * State transition: a tiny uniform pulse (and a short dip in opacity) each
 * time `key` changes after mount, e.g. Girl → Moms.
 */
export function useStateTransition(key: string | undefined, reduced = false) {
  const s = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    s.set(withSequence(withTiming(0, { duration: motion.fast, easing: ease.exit }), withSpring(1, markMotion.state)));
  }, [key, reduced, s]);
  return useAnimatedStyle(() => ({ opacity: 0.55 + s.value * 0.45, transform: [{ scale: 0.96 + s.value * 0.04 }] }));
}

export type GirlMarkVariant = 'launch' | 'intro' | 'header' | 'inline';

type MarkProps = {
  variant?: GirlMarkVariant;
  size?: number;
  onDark?: boolean;
  word?: 'Girl' | 'Moms';
  /** Header: the current section; the mark pulses softly when it changes. */
  section?: string;
  /** Launch and intro: wait this long before starting. */
  delay?: number;
  /** Launch only: a slow glint every 12 s while mounted. Off by default. */
  glint?: boolean;
  /** Launch and intro: called once the mark has fully arrived and shimmered. */
  onDone?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Timeline of launch and intro, from the start (after `delay`). */
const TIMELINE = {
  launch: { halo: 0, appear: 120, shimmer: 720, done: 1640 },
  intro: { halo: 0, appear: 0, shimmer: 460, done: 1380 },
} as const;

export function GirlMark({ variant = 'inline', size = 20, onDark = false, word = 'Girl', section, delay = 0, glint = false, onDone, style }: MarkProps) {
  const reduced = useReducedMotion();
  const animated = variant !== 'inline';
  const staged = variant === 'launch' || variant === 'intro';
  const times = variant === 'launch' ? TIMELINE.launch : TIMELINE.intro;
  const [box, setBox] = useState({ width: 0, height: 0 });

  const appear = useAppear({
    reduced: reduced || !animated,
    auto: variant === 'launch' || variant === 'intro',
    delay: delay + times.appear,
    duration: variant === 'launch' ? markMotion.appear.duration : markMotion.fade.duration,
    scaleFrom: variant === 'launch' ? markMotion.scaleFrom : 1,
    rise: variant === 'intro' ? markMotion.rise : variant === 'header' ? 4 : 0,
  });
  const halo = useAppear({ reduced: reduced || variant !== 'launch', auto: variant === 'launch', delay: delay + times.halo, duration: markMotion.halo.duration });
  const shimmer = useShimmer({ reduced, enabled: staged, delay: delay + times.shimmer });
  const pulse = useStateTransition(variant === 'header' ? section : undefined, reduced);


  // Launch and intro hand over once the shimmer has crossed (at once with Reduce Motion).
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (!staged) return;
    const t = setTimeout(() => done.current?.(), reduced ? 0 : delay + times.done);
    return () => clearTimeout(t);
  }, [staged, reduced, delay, times.done]);

  // The optional launch glint: one sweep every 12 s while the launch screen is up.
  const replay = shimmer.play;
  useEffect(() => {
    if (variant !== 'launch' || !glint || reduced) return;
    const h = setInterval(() => replay(), markMotion.glintEvery);
    return () => clearInterval(h);
  }, [variant, glint, reduced, replay]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (Math.abs(b.width - width) < 0.5 && Math.abs(b.height - height) < 0.5 ? b : { width, height }));
  }, []);

  // Room around the letters: the italic word leans past its box, the halo needs air.
  const pad = staged ? { paddingHorizontal: size * 0.3, paddingVertical: size * 0.18 } : { paddingHorizontal: size * 0.08 };
  const sheen = onDark ? '#DCD0FF' : '#D4C6FF';

  if (!animated) {
    return (
      <View style={[styles.mark, pad, style]}>
        <GirlLogo size={size} onDark={onDark} word={word} />
      </View>
    );
  }
  return (
    <View style={[styles.mark, style]}>
      {variant === 'header' ? <OnFocus play={appear.play} /> : null}
      {variant === 'launch' ? <Halo progress={halo.progress} width={size * 10} height={size * 5.6} onDark={onDark} /> : null}
      <Animated.View style={appear.style}>
        <Animated.View style={pulse} onLayout={onLayout}>
          <View style={pad}>
            <GirlLogo size={size} onDark={onDark} word={word} />
          </View>
          {staged ? (
            <ShimmerSweep progress={shimmer.progress} width={box.width} height={box.height}>
              <View style={pad}>
                <GirlLogo size={size} onDark={onDark} word={word} tint={sheen} decorative />
              </View>
            </ShimmerSweep>
          ) : null}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/**
 * Header: fade in when the screen gains focus, a softer fade when it comes
 * back. Its own component so only the header variant needs a screen around it.
 */
function OnFocus({ play }: { play: (from?: number) => void }) {
  const seen = useRef(false);
  useFocusEffect(
    useCallback(() => {
      play(seen.current ? 0.5 : 0);
      seen.current = true;
    }, [play]),
  );
  return null;
}

/** The mark for a top bar: header motion, optionally on the dark glass pill of the IRLY Girl home. */
export function GirlHeaderMark({
  section,
  word = 'Girl',
  onDark = false,
  size = 18,
  pill = false,
  style,
}: {
  section?: string;
  word?: 'Girl' | 'Moms';
  onDark?: boolean;
  size?: number;
  pill?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  if (!pill) return <GirlMark variant="header" size={size} onDark={onDark} word={word} section={section} style={style} />;
  return (
    <View style={[styles.pill, style]}>
      <GlassFill dark={onDark} level="thin" radius={18} />
      <GirlMark variant="header" size={size} onDark={onDark} word={word} section={section} />
    </View>
  );
}

/**
 * Loading state: the mark fades in over a halo that breathes slowly a fixed
 * number of times, then stays lit. With Reduce Motion, a still halo.
 */
export function GirlLoader({ size = 26, word = 'Girl', label, onDark = false, style }: { size?: number; word?: 'Girl' | 'Moms'; label?: string; onDark?: boolean; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const breath = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    const { duration, breaths } = markMotion.breathe;
    breath.set(withSequence(withTiming(1, { duration, easing: easing.inOut }), withRepeat(withTiming(0.55, { duration, easing: easing.inOut }), breaths, true)));
    return () => cancelAnimation(breath);
  }, [reduced, breath]);
  return (
    <View style={[styles.loader, style]} accessible accessibilityRole="progressbar" accessibilityLabel={tx('IRLY {word}, loading', { word })}>
      <View style={styles.mark}>
        <Halo progress={breath} width={size * 9} height={size * 5.4} onDark={onDark} />
        <GirlMark variant="intro" size={size} word={word} onDark={onDark} />
      </View>
      {label ? (
        <Text variant="body" color={onDark ? '#FFFFFF' : girl.inkSoft} align="center">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center' },
  strip: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  copy: { position: 'absolute', left: 0, top: 0 },
  halo: { position: 'absolute', left: '50%', top: '50%' },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 36, borderRadius: 18, zIndex: 0 },
  loader: { alignItems: 'center', justifyContent: 'center', gap: 18 },
});
