import { useStore } from '@/state/store';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, FadeInDown, interpolate, useAnimatedStyle, useDerivedValue, useReducedMotion, withSpring, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Film } from '@/components/visual/Film';
import { Photo } from '@/components/visual/Photo';
import { filmFor } from '@/data/photos';
import { useT } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { space } from '@/theme/tokens';
import { GirlLogo } from './GirlLogo';
import { girl, GIRL_TINT, girlType } from './theme';

const HEIGHT = 340;

/**
 * The top of IRLY Girl: Dubai behind the words (a pink DUBAI over Downtown;
 * on the Moms side, a silent film of the beach over its photo). It drifts slower than the page, stretches when pulled, and pushes
 * sideways when the side changes. The headline rises word by word.
 */
export function GirlHero({
  mode,
  scrollY,
  width,
  onBack,
  onProfile,
  onMessages,
  unread = 0,
}: {
  mode: 'all' | 'moms';
  scrollY: SharedValue<number>;
  width: number;
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
  const side = useDerivedValue(() => (reduced ? (mode === 'moms' ? 1 : 0) : withSpring(mode === 'moms' ? 1 : 0, { duration: 700, dampingRatio: 0.9 })));

  const drift = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      transform: [{ translateY: y < 0 ? y / 2 : y * 0.42 }, { scale: y < 0 ? 1 + -y / h : 1 }],
    };
  });
  const girls = useAnimatedStyle(() => ({ transform: [{ translateX: -side.value * width * 0.3 }, { scale: 1 + side.value * 0.06 }] }));
  const moms = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - side.value) * width }] }));
  const words = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, h * 0.5], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, h * 0.5], [0, -24], Extrapolation.CLAMP) }],
  }));

  const firstName = useStore((st) => st.profile.name?.trim().split(/\s+/)[0] ?? '');
  const headline = mode === 'moms' ? tr('Friends for you, memories for them.') : tr('Sincere friendships. Moments that matter.');
  const parts = headline.split(' ');

  return (
    <View style={{ height: h }}>
      <View style={[StyleSheet.absoluteFill, styles.clip]}>
        <Animated.View style={[StyleSheet.absoluteFill, drift]}>
          <Animated.View style={[StyleSheet.absoluteFill, girls]}>
            <Photo tint={GIRL_TINT} visual={{ photo: 'dubaiPink' }} light="dubai" width={1200} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, moms]}>
            <Photo tint={GIRL_TINT} visual={{ photo: 'beachClub' }} light="dubai" width={1200} style={StyleSheet.absoluteFill} pinned />
            {!reduced && mode === 'moms' ? <Film uri={filmFor('beachClub')!} /> : null}
          </Animated.View>
        </Animated.View>
        <LinearGradient
          colors={['rgba(56,40,50,0.45)', 'rgba(56,40,50,0)', 'rgba(201,47,114,0.10)', 'rgba(56,40,50,0.78)']}
          locations={[0, 0.3, 0.6, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <PressableScale haptic="tap" scaleTo={0.9} onPress={onBack} accessibilityLabel="Back to IRLY" style={styles.round}>
          <Icon name="chevronLeft" size={20} color="#FFFFFF" />
        </PressableScale>
        <View style={styles.brand}>
          <GirlLogo size={18} onDark word={mode === 'moms' ? 'Moms' : 'Girl'} />
        </View>
        <View style={styles.actions}>
          <PressableScale
            haptic="select"
            scaleTo={0.9}
            onPress={onMessages}
            accessibilityLabel={unread ? tr('Messages, {n} unread', { n: unread }) : tr('Messages')}
            style={styles.round}
          >
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
  clip: { overflow: 'hidden', borderBottomLeftRadius: 36, borderBottomRightRadius: 36 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter },
  actions: { flexDirection: 'row', gap: 8 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: girl.rose, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFFFFF' },
  badgeText: { fontSize: 10, lineHeight: 12, fontWeight: '700' },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,250,246,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  words: { position: 'absolute', left: space.gutter, right: space.gutter, bottom: 44 },
  brand: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: 'rgba(56,40,50,0.32)' },
  shadow: { textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } },
  line: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 9 },
});
