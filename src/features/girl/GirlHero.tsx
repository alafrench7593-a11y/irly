import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, FadeInDown, interpolate, useAnimatedStyle, useDerivedValue, useReducedMotion, withSpring, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { useT } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { space } from '@/theme/tokens';
import { girl } from './theme';

const HEIGHT = 340;

/**
 * The top of IRLY Girl: a photo of friends (or of moms and kids on the Moms
 * side) that drifts slower than the page, stretches when pulled, and pushes
 * sideways when the side changes. The headline rises word by word.
 */
export function GirlHero({
  mode,
  scrollY,
  width,
  onBack,
  onProfile,
}: {
  mode: 'all' | 'moms';
  scrollY: SharedValue<number>;
  width: number;
  onBack: () => void;
  onProfile: () => void;
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

  const headline = mode === 'moms' ? tr('Meet moms. Find activities.') : tr('Find girls you actually get along with');
  const parts = headline.split(' ');

  return (
    <View style={{ height: h }}>
      <View style={[StyleSheet.absoluteFill, styles.clip]}>
        <Animated.View style={[StyleSheet.absoluteFill, drift]}>
          <Animated.View style={[StyleSheet.absoluteFill, girls]}>
            <Photo visual={{ photo: 'girlFriends' }} light="dubai" width={1200} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, moms]}>
            <Photo visual={{ photo: 'momPlaydate' }} light="dubai" width={1200} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </Animated.View>
        <LinearGradient
          colors={['rgba(40,26,26,0.55)', 'rgba(40,26,26,0)', 'rgba(40,26,26,0.18)', 'rgba(40,26,26,0.78)']}
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
          <Text variant="label" color="#FFFFFF" style={{ letterSpacing: 3 }} raw>
            IRLY
          </Text>
          <View style={styles.brandTag}>
            <Text variant="label" color="#FFFFFF" style={{ letterSpacing: 3 }} raw>
              {mode === 'moms' ? 'MOMS' : 'GIRL'}
            </Text>
          </View>
        </View>
        <PressableScale haptic="select" scaleTo={0.9} onPress={onProfile} accessibilityLabel="Edit my IRLY Match profile" style={styles.round}>
          <Icon name="user" size={18} color="#FFFFFF" />
        </PressableScale>
      </View>
      <Animated.View style={[styles.words, words]} key={mode}>
        <View style={styles.line}>
          {parts.map((w, i) => (
            <Animated.View key={`${w}-${i}`} entering={reduced ? undefined : FadeInDown.springify(520).dampingRatio(0.85).delay(120 + i * 70)}>
              <Text variant="displayM" color="#FFFFFF" raw style={styles.shadow}>
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
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,250,246,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  words: { position: 'absolute', left: space.gutter, right: space.gutter, bottom: 44 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 4, height: 32, borderRadius: 16, backgroundColor: 'rgba(40,26,26,0.35)' },
  brandTag: { paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center', backgroundColor: girl.rose },
  shadow: { textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } },
  line: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 },
});
