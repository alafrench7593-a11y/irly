import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
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
import { scheduleOnRN } from 'react-native-worklets';
import { AvatarStack } from '@/components/ui/Avatar';
import { LiveDot } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { peopleByIds } from '@/data/repo';
import { openCreate } from '@/features/create/createStore';
import { useLives } from '@/features/live/liveStore';
import { PressableScale } from '@/motion/PressableScale';
import { ease, motion, spring } from '@/motion/tokens';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** The IRL disc: size and how far it rises out of the tab bar. */
export const IRL_DISC = 66;
export const IRL_LIFT = 16;

type Router = ReturnType<typeof useRouter>;
type Action = { id: string; label: string; a11y: string; icon: IconName; run: (router: Router) => void };

/** The five IRL actions, left to right along the arc (brief order). */
const ACTIONS: Action[] = [
  { id: 'activity', label: 'Create\nactivity', a11y: 'Create activity', icon: 'sparkles', run: () => openCreate(null, { format: 'activity' }) },
  { id: 'post', label: 'Post\nIRL', a11y: 'Post IRL', icon: 'camera', run: (r) => r.push('/live?compose=photo' as never) },
  { id: 'find', label: 'Find\nsomeone', a11y: 'Find someone', icon: 'users', run: (r) => r.push('/match?intent=friends' as never) },
  { id: 'event', label: 'Create\nevent', a11y: 'Create event', icon: 'ticket', run: () => openCreate(null, { format: 'event' }) },
  { id: 'now', label: "Share what\nI'm doing", a11y: "Share what I'm doing", icon: 'zap', run: (r) => r.push('/live?compose=1' as never) },
];

/** Degrees along the arc, from the left (162°) to the right (18°). */
const ANGLES = [162, 126, 90, 54, 18];
const ORB = 62;
const ORB_BOX = 96;

/**
 * The face of the IRL disc: white on IRLY Noir (the one main action),
 * a breathing live dot over « IRL ». With `progress`, « IRL » turns into a
 * close cross as the menu opens.
 */
export function IrlDiscFace({ progress }: { progress?: SharedValue<number> }) {
  const t = useTheme();
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.set(withRepeat(withTiming(1, { duration: 1800 }), -1, true));
  }, [breathe]);
  const dot = useAnimatedStyle(() => ({ opacity: 0.45 + breathe.value * 0.55, transform: [{ scale: 0.85 + breathe.value * 0.3 }] }));
  const word = useAnimatedStyle(() => {
    const v = progress ? progress.value : 0;
    return { opacity: 1 - v, transform: [{ scale: 1 - v * 0.3 }] };
  });
  const cross = useAnimatedStyle(() => {
    const v = progress ? progress.value : 0;
    return { opacity: v, transform: [{ rotate: `${(1 - v) * -90}deg` }, { scale: 0.6 + v * 0.4 }] };
  });
  return (
    <View style={[styles.face, { backgroundColor: t.c.brand }]}>
      <Animated.View style={[styles.center, word]}>
        <Animated.View style={[styles.dot, { backgroundColor: t.c.live }, dot]} />
        <Text variant="label" color={t.c.onBrand} style={styles.word}>
          IRL
        </Text>
      </Animated.View>
      {progress ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, cross]}>
          <Icon name="x" size={26} color={t.c.onBrand} strokeWidth={2.4} />
        </Animated.View>
      ) : null}
    </View>
  );
}

type Props = {
  /** Centre of the IRL disc, in window coordinates. */
  center: { x: number; y: number };
  /** Width of the app column (the phone frame on desktop). */
  frameWidth: number;
  onLive: () => void;
  onClosed: () => void;
};

/**
 * IRL: the heart of the app. The disc squashes like a drop of glass, a
 * pane of dark glass expands from it to cover the screen (radial reveal,
 * blur), a ring of light ripples out, and the five actions spring out of
 * the disc along an arc, one after another. « IRL » turns into a cross.
 * Choosing an action folds everything back into the disc, then acts.
 * With Reduce Motion on, the same layers simply fade.
 */
export function IrlMenu({ center, frameWidth, onLive, onClosed }: Props) {
  const t = useTheme();
  const night = t.mode === 'night';
  const router = useRouter();
  const reduced = useReducedMotion();
  const { width: W, height: H } = useWindowDimensions();
  const lives = useLives();
  const livePeople = useMemo(
    () => peopleByIds(lives.map((l) => l.authorId).filter((id) => id !== 'me')).slice(0, 4),
    [lives],
  );
  const p = useSharedValue(0);
  const ripple = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (reduced) {
      p.set(withTiming(1, { duration: motion.fast }));
      return;
    }
    p.set(withTiming(1, { duration: motion.emphasized, easing: ease.enter }));
    ripple.set(withTiming(1, { duration: motion.cinematic, easing: ease.enter }));
    // Glass distortion: the disc squashes under the press and springs back.
    sx.set(withSequence(withTiming(1.12, { duration: 90 }), withSpring(1, spring.strong)));
    sy.set(withSequence(withTiming(0.9, { duration: 90 }), withSpring(1, spring.strong)));
  }, [p, ripple, sx, sy, reduced]);

  const close = (after?: () => void) => {
    if (closing) return;
    setClosing(true);
    p.set(
      withTiming(0, { duration: reduced ? motion.fast : after ? 220 : motion.standard, easing: ease.exit }, (fin) => {
        if (!fin) return;
        scheduleOnRN(onClosed);
        if (after) scheduleOnRN(after);
      }),
    );
  };

  const cx = center.x;
  const cy = center.y;
  const R = Math.min(156, frameWidth / 2 - 48);
  const far = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
  const D = far * 2;
  const startScale = IRL_DISC / D;
  const RING = IRL_DISC * 4.6;
  const arcTop = cy - R - ORB / 2;
  const colLeft = cx - frameWidth / 2 + space.gutter;

  const reveal = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.12], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: reduced ? 1 : interpolate(p.value, [0, 1], [startScale, 1], Extrapolation.CLAMP) }],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.value, [0, 0.15, 1], [0, 0.5, 0]),
    transform: [{ scale: interpolate(ripple.value, [0, 1], [IRL_DISC / RING, 1]) }],
  }));
  const head = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.35, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: reduced ? 0 : interpolate(p.value, [0, 1], [18, 0], Extrapolation.CLAMP) }],
  }));
  const disc = useAnimatedStyle(() => ({ transform: [{ scaleX: sx.value }, { scaleY: sy.value }] }));

  const count = lives.length;
  // Android has no live blur here: a denser tint keeps the actions legible.
  const backdropTint = Platform.OS === 'android'
    ? night ? 'rgba(5,5,6,0.88)' : 'rgba(246,246,244,0.9)'
    : night ? 'rgba(5,5,6,0.12)' : 'rgba(246,246,244,0.2)';

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => close()}>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        {/* Radial reveal: a disc of dark glass grows from the button. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.reveal, { left: cx - D / 2, top: cy - D / 2, width: D, height: D, borderRadius: D / 2 }, reveal]}
        >
          {Platform.OS === 'android' ? null : <BlurView intensity={64} tint={night ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: backdropTint }]} />
        </Animated.View>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => close()}
          accessible={false}
          importantForAccessibility="no"
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { left: cx - RING / 2, top: cy - RING / 2, width: RING, height: RING, borderRadius: RING / 2, borderColor: night ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,10,0.3)' },
            rippleStyle,
          ]}
        />

        <Animated.View style={[styles.head, { left: colLeft, width: frameWidth - space.gutter * 2, bottom: H - arcTop + 34 }, head]} pointerEvents="box-none">
          <View style={styles.overRow}>
            <LiveDot size={6} />
            <Text variant="overline" tone="secondary">
              IRL
            </Text>
          </View>
          <Text variant="displayL" accessibilityRole="header">
            Your move.
          </Text>
          <PressableScale
            haptic="select"
            scaleTo={0.97}
            onPress={() => close(onLive)}
            accessibilityLabel={count ? tx('{n} live around you', { n: count }) : tx('Nobody live yet. Be the first.')}
            accessibilityHint={tx('Opens the live feed')}
            style={styles.livePress}
          >
            <Glass level="regular" style={styles.live}>
              <LiveDot size={7} />
              <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                {count ? tx('{n} live around you', { n: count }) : 'Nobody live yet. Be the first.'}
              </Text>
              {livePeople.length ? <AvatarStack people={livePeople} size={24} max={4} /> : null}
              <Icon name="chevronRight" size={18} color={t.c.textSecondary} />
            </Glass>
          </PressableScale>
        </Animated.View>

        {ACTIONS.map((a, i) => {
          const rad = (ANGLES[i] * Math.PI) / 180;
          return (
            <Orb
              key={a.id}
              action={a}
              index={i}
              x={cx + R * Math.cos(rad)}
              y={cy - R * Math.sin(rad)}
              cx={cx}
              cy={cy}
              p={p}
              onPress={() => close(() => a.run(router))}
            />
          );
        })}

        <Animated.View style={[styles.discWrap, { left: cx - IRL_DISC / 2, top: cy - IRL_DISC / 2 }, disc]}>
          <PressableScale
            haptic="tap"
            scaleTo={0.9}
            onPress={() => close()}
            accessibilityLabel={tx('Close')}
            style={[styles.disc, { boxShadow: t.shadow.glow }]}
          >
            <IrlDiscFace progress={p} />
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Orb({
  action,
  index,
  x,
  y,
  cx,
  cy,
  p,
  onPress,
}: {
  action: Action;
  index: number;
  x: number;
  y: number;
  cx: number;
  cy: number;
  p: SharedValue<number>;
  onPress: () => void;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const own = useSharedValue(0);
  useEffect(() => {
    own.set(reduced ? withTiming(1, { duration: motion.fast }) : withDelay(70 + index * 45, withSpring(1, spring.physical)));
  }, [own, index, reduced]);
  const style = useAnimatedStyle(() => {
    // Out on its own spring (it may overshoot a little), back with the menu.
    const v = own.value * p.value;
    if (reduced) return { opacity: v };
    return {
      opacity: interpolate(v, [0, 0.45], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateX: (1 - v) * (cx - x) }, { translateY: (1 - v) * (cy - y) }, { scale: 0.35 + 0.65 * v }],
    };
  });
  return (
    <Animated.View style={[styles.orbBox, { left: x - ORB_BOX / 2, top: y - ORB / 2 }, style]}>
      <PressableScale haptic="press" scaleTo={0.9} onPress={onPress} accessibilityLabel={tx(action.a11y)}
        style={styles.orbPress}
      >
        <Glass level="thin" dark={t.mode === 'night'} style={styles.orb}>
          <Icon name={action.icon} size={24} color={t.c.text} strokeWidth={1.9} />
        </Glass>
        <Text variant="overline" align="center" color={t.c.text} numberOfLines={2} style={styles.orbLabel}>
          {action.label}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  face: { width: IRL_DISC, height: IRL_DISC, borderRadius: IRL_DISC / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dot: { width: 7, height: 7, borderRadius: 4, marginBottom: 2 },
  word: { letterSpacing: 1.4, fontSize: 15, lineHeight: 18 },
  reveal: { position: 'absolute', overflow: 'hidden' },
  ring: { position: 'absolute', borderWidth: 1.5 },
  head: { position: 'absolute', gap: 10 },
  overRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  livePress: { marginTop: 10, alignSelf: 'stretch' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: radius.pill },
  orbBox: { position: 'absolute', width: ORB_BOX, alignItems: 'center' },
  orbPress: { alignItems: 'center', gap: 8 },
  orb: { width: ORB, height: ORB, borderRadius: ORB / 2, alignItems: 'center', justifyContent: 'center' },
  orbLabel: { width: ORB_BOX, fontSize: 10.5, lineHeight: 13, letterSpacing: 0.8 },
  discWrap: { position: 'absolute', width: IRL_DISC, height: IRL_DISC },
  disc: { width: IRL_DISC, height: IRL_DISC, borderRadius: IRL_DISC / 2 },
});
