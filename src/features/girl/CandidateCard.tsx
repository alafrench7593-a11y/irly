import { t as tx, a11y } from '@/i18n';
import { LinearGradient } from 'expo-linear-gradient';
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
import { Avatar, FacePhoto } from '@/components/ui/Avatar';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { ProfilePhoto } from '@/features/match/ProfilePhoto';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { radius } from '@/theme/tokens';
import { reasonLines } from './suggest';
import { labelOf } from './taxonomy';
import { girl, girlType } from './theme';
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
        accessibilityLabel={a11y(`${c.firstName}${c.age ? `, ${c.age}` : ''}. ${tx('{n}% match', { n: c.score })}. ${lines.join(', ')}. ${tx('Open profile')}`)}
      >
        {/* Her own photo: the same profile photo as everywhere in IRLY, then her IRLY Girl photos, else a neutral placeholder. */}
        <FacePhoto name={c.firstName} hue={c.hue} userId={c.userId} photos={c.photoUrls} placeholderColor={girl.cream} placeholderSize={120} style={StyleSheet.absoluteFill} />
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
                {city ? tx('New in {city}', { city: city.name }) : tx('New in town')}
              </Text>
            </Glass>
          ) : null}
        </View>

        <Animated.View style={[styles.stamp, styles.stampLike, likeStamp]} pointerEvents="none">
          <Icon name="heartHandshake" size={18} color="#F4B3CF" />
          <Text variant="label" color={girl.pearl}>
            CONNECT
          </Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampPass, passStamp]} pointerEvents="none">
          <Text variant="label" color={girl.ink}>
            NOT NOW
          </Text>
        </Animated.View>

        <View style={styles.bottom} pointerEvents="none">
          {/* Information sits on the densest pearl glass: no sheen or reflection over the text. */}
          <Glass light variant="sheet" highlight={false} style={styles.panel}>
            <View style={styles.nameRow}>
              <Avatar name={c.firstName} hue={c.hue} size={36} userId={c.userId} photo={c.photoUrls[0]} />
              <View style={{ flex: 1 }}>
                <Text variant="titleL" color={girl.ink} numberOfLines={1} style={girlType.section} raw>
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
                  <Text variant="caption" color={girl.plum}>
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
  card: { position: 'absolute', borderRadius: 32, overflow: 'hidden', backgroundColor: girl.blush, boxShadow: girl.shadow },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(58,42,42,0.08)' },
  top: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: radius.pill },
  dot: { width: 7, height: 7, borderRadius: 4 },
  stamp: { position: 'absolute', top: 60, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.92)' },
  stampLike: { left: 18, transform: [{ rotate: '-10deg' }], backgroundColor: girl.plum, borderWidth: 1, borderColor: 'rgba(255,205,226,0.35)' },
  stampPass: { right: 18, transform: [{ rotate: '10deg' }] },
  bottom: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  panel: { borderRadius: 24, padding: 16, gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goals: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  goal: { paddingHorizontal: 10, height: 26, borderRadius: 13, justifyContent: 'center', backgroundColor: girl.nude },
});

type TileProps = {
  candidate: Candidate;
  /** The card's width; the photo is 4:5 of it. */
  width: number;
  onOpen: () => void;
  /** The same decisions as the deck and the profile sheet (`decide` on the Match screen). */
  onPass: () => void;
  onConnect: () => void;
};

/**
 * A profile in the Match grid (two side by side on a phone): her photo in
 * 4:5 (her full photo, never an enlarged avatar copy), first name and age
 * when she shows it, where she is, two lines of her bio and what you share,
 * then Not now / Connect. Tap the card for the full profile (save, block,
 * report live there). Reusable wherever a Candidate is listed.
 */
export const CandidateTile = memo(function CandidateTile({ candidate: c, width, onOpen, onPass, onConnect }: TileProps) {
  const city = CITIES[c.cityId as CityId];
  const area = c.areas[0] && city ? areaName(city, c.areas[0]) : undefined;
  const shared = reasonLines(c.reasons, labelOf, 2);
  const compact = width < 200;
  const photoH = Math.round(width * 1.25);
  const badge = c.activeNow ? tx('Active now') : c.isNew ? (city ? tx('New in {city}', { city: city.name }) : tx('New in town')) : null;
  return (
    <View style={[tileStyles.card, { width }]}>
      <PressableScale
        haptic="select"
        scaleTo={0.98}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={a11y(
          [`${c.firstName}${c.age ? `, ${c.age}` : ''}`, area, tx('{n}% match', { n: c.score }), c.bio, shared.join(', '), tx('Open profile')].filter(Boolean).join('. '),
        )}
      >
        <View style={{ width, height: photoH }}>
          <ProfilePhoto name={c.firstName} hue={c.hue} userId={c.userId} photos={c.photoUrls} ground={girl.blush} placeholderSize={compact ? 56 : 72} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(36,18,30,0)', 'rgba(36,18,30,0.62)']} start={{ x: 0, y: 0.5 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View style={tileStyles.top} pointerEvents="none">
            {badge ? (
              <View style={tileStyles.badge}>
                {c.activeNow ? <View style={[styles.dot, { backgroundColor: '#5FD38D' }]} /> : <Icon name="sparkles" size={11} color={girl.rose} />}
                <Text variant="caption" color={girl.plum} numberOfLines={1} raw style={{ flexShrink: 1 }}>
                  {badge}
                </Text>
              </View>
            ) : (
              <View />
            )}
            <View style={tileStyles.score}>
              <Icon name="sparkles" size={11} color="#F4B3CF" />
              <Text variant="caption" color={girl.pearl} raw>
                {`${c.score}%`}
              </Text>
            </View>
          </View>
          <View style={tileStyles.name} pointerEvents="none">
            <Text variant="titleM" color={girl.pearl} numberOfLines={1} raw style={[girlType.card, compact ? { fontSize: 21, lineHeight: 25 } : null]}>
              {c.firstName}
              {c.age ? <Text variant="titleS" color="rgba(255,246,250,0.86)" raw>{`  ${c.age}`}</Text> : null}
            </Text>
            {area ? (
              <Text variant="caption" color="rgba(255,246,250,0.86)" numberOfLines={1} raw>
                {area}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={tileStyles.body}>
          {/* Always two lines tall, so the cards of a row line up whatever their bio. */}
          <Text variant="bodyS" color={c.bio ? girl.ink : girl.inkSoft} numberOfLines={2} raw style={tileStyles.bio}>
            {c.bio || c.goals.slice(0, 2).map((g) => tx(labelOf(g))).join(' · ')}
          </Text>
          <View style={tileStyles.shared}>
            {shared.map((l) => (
              <View key={l} style={styles.goal}>
                <Text variant="caption" color={girl.plum} numberOfLines={1} raw>
                  {l}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </PressableScale>
      <View style={tileStyles.actions}>
        <PressableScale haptic="tap" scaleTo={0.9} onPress={onPass} accessibilityRole="button" accessibilityLabel={tx('Not now, {name}', { name: c.firstName })} style={tileStyles.pass}>
          <Icon name="x" size={18} color={girl.ink} />
        </PressableScale>
        <PressableScale haptic="press" scaleTo={0.95} onPress={onConnect} accessibilityRole="button" accessibilityLabel={tx('Connect with {name}', { name: c.firstName })} style={tileStyles.connect}>
          <LinearGradient colors={girl.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />
          {compact ? null : <Icon name="heartHandshake" size={16} color="#FFFFFF" />}
          <Text variant="label" color="#FFFFFF" numberOfLines={1} style={{ flexShrink: 1 }}>
            Connect
          </Text>
        </PressableScale>
      </View>
    </View>
  );
});

const tileStyles = StyleSheet.create({
  card: { borderRadius: 24, overflow: 'hidden', backgroundColor: girl.surface, boxShadow: girl.shadowSoft, flex: 1 },
  top: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,248,251,0.92)', flexShrink: 1 },
  score: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: 'rgba(74,36,64,0.82)' },
  name: { position: 'absolute', left: 12, right: 12, bottom: 10, gap: 1 },
  body: { paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  bio: { minHeight: 36 },
  shared: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 26, overflow: 'hidden' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginTop: 'auto' },
  pass: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: girl.cream, borderWidth: 1, borderColor: girl.line },
  connect: { flex: 1, height: 40, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden', paddingHorizontal: 8 },
});
