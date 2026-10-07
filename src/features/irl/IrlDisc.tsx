import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { textDots } from '@/brand/dots';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme/useTheme';

/** The IRL disc: size and how far it rises out of the tab bar. */
export const IRL_DISC = 68;
export const IRL_LIFT = 16;

const WORD = textDots('IRL', true);
/** Width of « IRL » inside the disc. */
const WORD_W = 46;
const PITCH = WORD_W / WORD.cols;
const DOT = PITCH * 0.9;

/**
 * « IRL » in the dots of the IRLY logo, with the logo's 2×2 accent lit in
 * live red above the L: the « you are here » of the wordmark becomes the
 * live signal, and it beats like a pulse.
 */
const DotWord = memo(function DotWord({ ink, live, beat }: { ink: string; live: string; beat: SharedValue<number> }) {
  const accent = useAnimatedStyle(() => ({
    opacity: 0.75 + beat.value * 0.25,
    transform: [{ scale: 1 + beat.value * 0.35 }],
  }));
  const height = (WORD.rows - WORD.top) * PITCH;
  return (
    <View style={{ width: WORD_W, height }} pointerEvents="none">
      {WORD.dots.map((d) => {
        const style = {
          position: 'absolute' as const,
          left: d.col * PITCH + (PITCH - DOT) / 2,
          top: (d.row - WORD.top) * PITCH + (PITCH - DOT) / 2,
          width: DOT,
          height: DOT,
          borderRadius: DOT / 2,
          backgroundColor: d.accent ? live : ink,
        };
        return d.accent ? <Animated.View key={`${d.col}-${d.row}`} style={[style, accent]} /> : <View key={`${d.col}-${d.row}`} style={style} />;
      })}
    </View>
  );
});

/**
 * The face of the IRL disc. A pearl of white on IRLY Noir (a soft radial
 * depth, never flat), « IRL » set in the logo's dots, the live accent
 * beating in red, and a thin line of steel light that travels slowly
 * around the rim, like light on glass. With `progress`, « IRL » turns
 * into a close cross as the IRL menu opens. Reduce Motion: still.
 */
export function IrlDiscFace({ progress }: { progress?: SharedValue<number> }) {
  const t = useTheme();
  const night = t.mode === 'night';
  const reduced = useReducedMotion();
  const beat = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    beat.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 1280 }),
        ),
        -1,
        false,
      ),
    );
    spin.set(withRepeat(withTiming(1, { duration: 7200, easing: Easing.linear }), -1, false));
  }, [reduced, beat, spin]);

  const word = useAnimatedStyle(() => {
    const v = progress ? progress.value : 0;
    return { opacity: 1 - v, transform: [{ scale: 1 - v * 0.3 }] };
  });
  const cross = useAnimatedStyle(() => {
    const v = progress ? progress.value : 0;
    return { opacity: v, transform: [{ rotate: `${(1 - v) * -90}deg` }, { scale: 0.6 + v * 0.4 }] };
  });
  const sheen = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  const r = IRL_DISC / 2;
  return (
    <View style={styles.face}>
      <Svg width={IRL_DISC} height={IRL_DISC} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="irl-pearl" cx="42%" cy="34%" r="70%">
            <Stop offset="0" stopColor={night ? '#FFFFFF' : '#3A3E46'} />
            <Stop offset="0.62" stopColor={night ? '#F1F3F6' : '#16181C'} />
            <Stop offset="1" stopColor={night ? '#D3DAE3' : '#050506'} />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill="url(#irl-pearl)" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, sheen]} pointerEvents="none">
        <Svg width={IRL_DISC} height={IRL_DISC}>
          <Defs>
            <LinearGradient id="irl-rim" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={t.c.steel} stopOpacity={0} />
              <Stop offset="0.5" stopColor={t.c.steel} stopOpacity={night ? 0.95 : 0.8} />
              <Stop offset="1" stopColor={t.c.steel} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Circle cx={r} cy={r} r={r - 1.25} stroke="url(#irl-rim)" strokeWidth={1.5} fill="none" strokeDasharray={`${r * 1.9} ${r * 10}`} strokeLinecap="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.center, word]} pointerEvents="none">
        <DotWord ink={t.c.onBrand} live={t.c.live} beat={beat} />
      </Animated.View>
      {progress ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, cross]} pointerEvents="none">
          <Icon name="x" size={26} color={t.c.onBrand} strokeWidth={2.4} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  face: { width: IRL_DISC, height: IRL_DISC, borderRadius: IRL_DISC / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
