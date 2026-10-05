import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Avatar } from '@/components/ui/Avatar';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { haptic } from '@/motion/haptics';
import { spring } from '@/motion/tokens';
import { radius } from '@/theme/tokens';
import { reasonLines } from './suggest';
import { labelOf } from './taxonomy';
import { girl } from './theme';
import type { Candidate } from './types';
import { ScorePill } from './ui';

const SWIPE = 110;

type Props = {
  candidate: Candidate;
  width: number;
  height: number;
  /** Top card only: draggable. */
  active: boolean;
  /** Set to 1 (connect) or -1 (pass) by the buttons below the deck. */
  fling: SharedValue<number>;
  onDecide: (d: 'like' | 'pass') => void;
  onOpen: () => void;
};

/**
 * A profile in the deck. Drag right to connect, left to pass: the card
 * follows the finger, tilts with it and a glass stamp ("Connect" / "Not
 * now") fades in. Released past the threshold (or flicked), it flies off
 * with the finger's velocity; otherwise it springs back. Tap opens the
 * full profile.
 */
export const CandidateCard = memo(function CandidateCard({ candidate: c, width, height, active, fling, onDecide, onOpen }: Props) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const city = CITIES[c.cityId as CityId];

  const fly = (dir: 1 | -1, vx = 0) => {
    'worklet';
    x.set(withTiming(dir * width * 1.5, { duration: Math.max(180, 320 - Math.abs(vx) / 10) }, (fin) => {
      if (fin) scheduleOnRN(onDecide, dir === 1 ? 'like' : 'pass');
    }));
  };

  useAnimatedReaction(
    () => fling.value,
    (v) => {
      if (active && v !== 0) {
        fling.set(0);
        fly(v > 0 ? 1 : -1);
      }
    },
  );

  const pan = Gesture.Pan()
    .enabled(active)
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      x.set(e.translationX);
      y.set(e.translationY * 0.25);
    })
    .onEnd((e) => {
      const past = Math.abs(x.value) > SWIPE || Math.abs(e.velocityX) > 900;
      if (past) {
        scheduleOnRN(haptic, x.value > 0 ? 'success' : 'tap');
        fly(x.value > 0 || e.velocityX > 900 ? 1 : -1, e.velocityX);
      } else {
        x.set(withSpring(0, spring.medium));
        y.set(withSpring(0, spring.medium));
      }
    });

  const tap = Gesture.Tap()
    .enabled(active)
    .onEnd(() => scheduleOnRN(onOpen));

  const card = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width, 0, width], [-12, 0, 12], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const likeStamp = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [20, SWIPE], [0, 1], Extrapolation.CLAMP) }));
  const passStamp = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-SWIPE, -20], [1, 0], Extrapolation.CLAMP) }));

  const lines = reasonLines(c.reasons, labelOf, 3);
  const area = c.areas[0] && city ? areaName(city, c.areas[0]) : undefined;

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        style={[styles.card, { width, height }, card]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${c.firstName}${c.age ? `, ${c.age}` : ''}. ${c.score}% match. ${lines.join(', ')}. Open profile`}
      >
        {c.photoUrls[0] ? (
          <Image source={{ uri: c.photoUrls[0] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        ) : c.cover ? (
          <Photo visual={{ photo: c.cover }} light="dubai" style={StyleSheet.absoluteFill} width={900} recyclingKey={`girl-${c.userId}`} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: girl.cream }]} />
        )}
        <View style={styles.scrim} pointerEvents="none" />

        <View style={styles.top} pointerEvents="none">
          {c.activeNow ? (
            <Glass dark style={styles.badge}>
              <View style={[styles.dot, { backgroundColor: '#5FD38D' }]} />
              <Text variant="caption" color="#FFFFFF">
                Active now
              </Text>
            </Glass>
          ) : null}
          {c.isNew ? (
            <Glass dark style={styles.badge}>
              <Icon name="sparkles" size={12} color="#FFFFFF" />
              <Text variant="caption" color="#FFFFFF">
                New in {city?.name ?? 'town'}
              </Text>
            </Glass>
          ) : null}
        </View>

        <Animated.View style={[styles.stamp, styles.stampLike, likeStamp]} pointerEvents="none">
          <Icon name="heartHandshake" size={18} color={girl.ink} />
          <Text variant="label" color={girl.ink}>
            CONNECT
          </Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampPass, passStamp]} pointerEvents="none">
          <Text variant="label" color={girl.ink}>
            NOT NOW
          </Text>
        </Animated.View>

        <View style={styles.bottom} pointerEvents="none">
          <Glass style={styles.panel} intensity={60}>
            <View style={styles.nameRow}>
              <Avatar name={c.firstName} hue={c.hue} size={36} />
              <View style={{ flex: 1 }}>
                <Text variant="titleL" color={girl.ink} numberOfLines={1}>
                  {c.firstName}
                  {c.age ? <Text variant="titleM" color={girl.inkSoft}>{`  ${c.age}`}</Text> : null}
                </Text>
                {area ? (
                  <Text variant="bodyS" color={girl.inkSoft} numberOfLines={1}>
                    {area}
                  </Text>
                ) : null}
              </View>
              <ScorePill score={c.score} />
            </View>
            {lines.length ? (
              <View style={{ gap: 3 }}>
                <Text variant="overline" color={girl.rose}>
                  You both
                </Text>
                {lines.map((l) => (
                  <Text key={l} variant="bodyS" color={girl.ink} numberOfLines={1}>
                    • {l}
                  </Text>
                ))}
              </View>
            ) : null}
            <View style={styles.goals}>
              {c.goals.slice(0, 3).map((g) => (
                <View key={g} style={styles.goal}>
                  <Text variant="caption" color={girl.ink}>
                    {labelOf(g)}
                  </Text>
                </View>
              ))}
            </View>
          </Glass>
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  card: { position: 'absolute', borderRadius: 32, overflow: 'hidden', backgroundColor: girl.cream, boxShadow: girl.shadow },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(58,42,42,0.08)' },
  top: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: radius.pill },
  dot: { width: 7, height: 7, borderRadius: 4 },
  stamp: { position: 'absolute', top: 60, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.92)' },
  stampLike: { left: 18, transform: [{ rotate: '-10deg' }] },
  stampPass: { right: 18, transform: [{ rotate: '10deg' }] },
  bottom: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  panel: { borderRadius: 24, padding: 16, gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goals: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  goal: { paddingHorizontal: 10, height: 26, borderRadius: 13, justifyContent: 'center', backgroundColor: girl.blush },
});
