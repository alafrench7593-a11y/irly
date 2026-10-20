import { useStore } from '@/state/store';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import Animated, { Extrapolation, FadeInDown, interpolate, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Film } from '@/components/visual/Film';
import { Photo } from '@/components/visual/Photo';
import { filmFor } from '@/data/photos';
import { useT } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { ease, motion } from '@/motion/tokens';
import { space } from '@/theme/tokens';
import { GirlHeaderMark } from './GirlMark';
import { girl, GIRL_TINT, girlType } from './theme';
import { GlassFill } from './ui';

const HEIGHT = 340;

/** How far the photo travels up while the whole page scrolls (parallax). */
const TRAVEL = 110;
/** How far below the hero the rose shade keeps turning to cream. */
const SHADE = 220;

/**
 * Dubai behind the whole IRLY Girl home, fixed: a pink DUBAI over Downtown
 * (on the Moms side, a silent film of the beach over its photo), under a
 * rose veil. Below the hero it fades to the Girl cream so the glass panels
 * stay readable, and deepens a little more as you scroll.
 *
 * Motion: fades in with a slight zoom that settles, follows the scroll
 * slower than the page, stretches when pulled, and slides sideways when
 * the side changes. No loop. With Reduce Motion it is simply there.
 */
export function GirlBackdrop({ mode, scrollY, width }: { mode: 'all' | 'moms'; scrollY: SharedValue<number>; width: number }) {
  const reduced = useReducedMotion();
  const h = HEIGHT + useSafeAreaInsets().top;
  const settle = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) settle.set(withTiming(1, { duration: motion.cinematic + 400, easing: ease.enter }));
  }, [reduced, settle]);
  const side = useDerivedValue(() => (reduced ? (mode === 'moms' ? 1 : 0) : withSpring(mode === 'moms' ? 1 : 0, { duration: 700, dampingRatio: 0.9 })));

  const drift = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      opacity: 0.3 + settle.value * 0.7,
      transform: [{ translateY: -interpolate(y, [0, h * 4], [0, TRAVEL], Extrapolation.CLAMP) }, { scale: (1.08 - settle.value * 0.08) * (y < 0 ? 1 + -y / (h * 2) : 1) }],
    };
  });
  const girls = useAnimatedStyle(() => ({ transform: [{ translateX: -side.value * width * 0.3 }, { scale: 1 + side.value * 0.06 }] }));
  const moms = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - side.value) * width }] }));
  const veil = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [h * 0.3, h], [0, 1], Extrapolation.CLAMP) }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop]} pointerEvents="none">
      <Animated.View style={[styles.photo, drift]}>
        <Animated.View style={[StyleSheet.absoluteFill, girls]}>
          <Photo tint={GIRL_TINT} visual={{ photo: 'dubaiPink' }} light="dubai" width={1200} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, moms]}>
          <Photo tint={GIRL_TINT} visual={{ photo: 'beachClub' }} light="dubai" width={1200} style={StyleSheet.absoluteFill} pinned />
          {!reduced && mode === 'moms' ? <Film uri={filmFor('beachClub')!} /> : null}
        </Animated.View>
      </Animated.View>
      {/* One rose shade from the top bar to below the hero (it carries the headline), then the cream veil: no seam. */}
      <LinearGradient
        colors={['rgba(56,40,50,0.45)', 'rgba(56,40,50,0)', 'rgba(201,47,114,0.12)', 'rgba(56,40,50,0.5)', 'rgba(255,245,248,0.78)']}
        locations={[0, 0.2, 0.36, 0.52, 1]}
        style={[styles.top, { height: h + SHADE }]}
      />
      <View style={[styles.below, { top: h + SHADE - 1 }]} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veil]} />
    </View>
  );
}

/**
 * The top of IRLY Girl, over the fixed GirlBackdrop: the glass buttons and
 * the headline, which rises word by word and lifts away as you scroll.
 */
export function GirlHero({
  mode,
  scrollY,
  onBack,
  onProfile,
  onMessages,
  unread = 0,
}: {
  mode: 'all' | 'moms';
  scrollY: SharedValue<number>;
  onBack: () => void;
  onProfile: () => void;
  /** Messages are one tap away from the top of IRLY Girl, with the unread count. */
  onMessages: () => void;
  unread?: number;
}) {
  const insets = useSafeAreaInsets();
  const tr = useT();
  const reduced = useReducedMotion();
  const h = HEIGHT + insets.top;
  const words = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, h * 0.5], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, h * 0.5], [0, -24], Extrapolation.CLAMP) }],
  }));

  const firstName = useStore((st) => st.profile.name?.trim().split(/\s+/)[0] ?? '');
  const headline = mode === 'moms' ? tr('Friends for you, memories for them.') : tr('Sincere friendships. Moments that matter.');
  const parts = headline.split(' ');

  return (
    <View style={{ height: h }}>
      {/* Dubai itself is the page backdrop (GirlBackdrop), fixed behind the whole home. */}
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <PressableScale haptic="tap" scaleTo={0.9} onPress={onBack} accessibilityLabel="Back to IRLY" style={styles.round}>
          <GlassFill dark level="thin" radius={20} />
          <Icon name="chevronLeft" size={20} color="#FFFFFF" />
        </PressableScale>
        <GirlHeaderMark pill onDark size={18} section={mode} word={mode === 'moms' ? 'Moms' : 'Girl'} />
        <View style={styles.actions}>
          <PressableScale
            haptic="select"
            scaleTo={0.9}
            onPress={onMessages}
            accessibilityLabel={unread ? tr('Messages, {n} unread', { n: unread }) : tr('Messages')}
            style={styles.round}
          >
            <GlassFill dark level="thin" radius={20} />
            <Icon name="message" size={18} color="#FFFFFF" />
            {unread ? (
              <View style={styles.badge}>
                <Text variant="caption" color="#FFFFFF" raw style={styles.badgeText}>
                  {unread > 99 ? '99+' : String(unread)}
                </Text>
              </View>
            ) : null}
          </PressableScale>
          <PressableScale haptic="select" scaleTo={0.9} onPress={onProfile} accessibilityLabel="My profile" style={styles.round}>
            <GlassFill dark level="thin" radius={20} />
            <Icon name="user" size={18} color="#FFFFFF" />
          </PressableScale>
        </View>
      </View>
      <Animated.View style={[styles.words, words]} key={mode}>
        {/* A personal hello, like a friend would say it. */}
        {firstName ? (
          <Animated.View entering={reduced ? undefined : FadeInDown.springify(520).dampingRatio(0.85).delay(60)}>
            <Text variant="label" color="#FFFFFF" raw style={[styles.shadow, { marginBottom: 8, letterSpacing: 1.5, textTransform: 'uppercase' }]}>
              {tr('Hi, {name}', { name: firstName })}
            </Text>
          </Animated.View>
        ) : null}
        <View style={styles.line}>
          {parts.map((w, i) => (
            <Animated.View key={`${w}-${i}`} entering={reduced ? undefined : FadeInDown.springify(520).dampingRatio(0.85).delay(120 + i * 70)}>
              <Text variant="displayM" color="#FFFFFF" raw style={[girlType.display, styles.shadow]}>
                {w}
              </Text>
            </Animated.View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { overflow: 'hidden', backgroundColor: girl.bg },
  photo: { position: 'absolute', left: 0, right: 0, top: 0, bottom: -TRAVEL },
  top: { position: 'absolute', left: 0, right: 0, top: 0 },
  below: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,245,248,0.78)' },
  veil: { backgroundColor: 'rgba(255,245,248,0.7)' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter },
  actions: { flexDirection: 'row', gap: 8 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: girl.rose, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFFFFF' },
  badgeText: { fontSize: 10, lineHeight: 12, fontWeight: '700' },
  round: { width: 40, height: 40, borderRadius: 20, zIndex: 0, alignItems: 'center', justifyContent: 'center' },
  words: { position: 'absolute', left: space.gutter, right: space.gutter, bottom: 44 },
  shadow: { textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } },
  line: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 9 },
});
