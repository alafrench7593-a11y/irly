import { Image } from 'expo-image';
import { t as tx } from '@/i18n';
import { useEffect } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IrlyMark } from '@/brand/IrlyMark';
import { isAvatar } from '@/features/avatar/avatar';
import { IrlyAvatar } from '@/features/avatar/IrlyAvatar';
import { Avatar } from '@/components/ui/Avatar';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { spring, transition } from '@/motion/tokens';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { reasonLines, suggestFor, type Suggestion } from './suggest';
import { labelOf } from './taxonomy';
import { girl } from './theme';
import type { Candidate, MatchResult } from './types';
import { GButton } from './ui';

type Props = {
  match: MatchResult | null;
  person: Candidate | null;
  onHello: () => void;
  onSuggestion: (s: Suggestion) => void;
  onFindExisting: (s: Suggestion) => void;
  onClose: () => void;
};

const CARD_W = 128;
const CARD_H = 168;

/**
 * IT'S AN IRLY MATCH. The two photos glide in from either side and tilt
 * toward each other, the cream glass behind them breathes once, the IRLY
 * mark lands between them with a success haptic, then the words, the
 * reasons and the two ways forward: say hello, or find something to do.
 * Under two seconds end to end; reduced motion gets a simple fade.
 */
export function MatchMoment({ match, person, onHello, onSuggestion, onFindExisting, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const me = useStore((s) => s.profile);
  const p = useSharedValue(0);
  const glow = useSharedValue(0);
  const mark = useSharedValue(0);
  const visible = Boolean(match && person);

  useEffect(() => {
    if (!visible) {
      p.set(0);
      mark.set(0);
      return;
    }
    const t = transition.match;
    if (reduced) {
      p.set(withTiming(1, { duration: 200 }));
      mark.set(withTiming(1, { duration: 200 }));
    } else {
      p.set(withSpring(1, { duration: t.approach, dampingRatio: 0.82 }));
      mark.set(withDelay(t.approach - 120, withSpring(1, spring.strong)));
      glow.set(withDelay(t.approach, withSequence(withTiming(1, { duration: t.merge }), withRepeat(withTiming(0.4, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true))));
    }
    const h = setTimeout(() => haptic('success'), reduced ? 0 : t.approach);
    return () => clearTimeout(h);
  }, [visible, reduced, p, mark, glow]);

  const left = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - p.value) * -220 + 18 }, { rotate: `${-8 * p.value}deg` }, { scale: 0.85 + p.value * 0.15 }],
    opacity: p.value,
  }));
  const right = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - p.value) * 220 - 18 }, { rotate: `${8 * p.value}deg` }, { scale: 0.85 + p.value * 0.15 }],
    opacity: p.value,
  }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + glow.value * 0.5, transform: [{ scale: 0.9 + glow.value * 0.15 }] }));
  const markStyle = useAnimatedStyle(() => ({ opacity: mark.value, transform: [{ scale: 0.4 + mark.value * 0.6 }] }));

  if (!match || !person) return null;
  const lines = reasonLines(match.reasons, labelOf, 6);
  const suggestions = suggestFor(match.reasons, 8);
  const textDelay = reduced ? 0 : transition.match.approach + transition.match.merge;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: girl.bg }]}>
        <Glass style={StyleSheet.absoluteFill} border={false} intensity={80} />
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32, gap: space[6] }} showsVerticalScrollIndicator={false}>
          <View style={styles.stage}>
            <Animated.View style={[styles.halo, halo]} />
            <Animated.View style={[styles.photoCard, left]}>
              {me.photoUri && isAvatar(me.photoUri) ? (
                <View style={[StyleSheet.absoluteFill, styles.center]}>
                  <IrlyAvatar config={me.photoUri} size={160} />
                </View>
              ) : me.photoUri ? (
                <Image source={{ uri: me.photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: girl.blush }]}>
                  <Avatar name={me.name || 'You'} hue={330} size={72} />
                </View>
              )}
            </Animated.View>
            <Animated.View style={[styles.photoCard, right]}>
              {person.photoUrls[0] ? (
                <Image source={{ uri: person.photoUrls[0] }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : person.cover ? (
                <Photo visual={{ photo: person.cover }} light="dubai" style={StyleSheet.absoluteFill} width={400} />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: girl.blush }]}>
                  <Avatar name={person.firstName} hue={person.hue} size={72} />
                </View>
              )}
            </Animated.View>
            <Animated.View style={[styles.mark, markStyle]}>
              <IrlyMark size={44} state="static" ringColor={girl.rose} lensColor={girl.ink} glow={false} />
            </Animated.View>
          </View>

          <Animated.View entering={FadeIn.delay(textDelay).duration(transition.match.text)} style={styles.texts}>
            <Text variant="overline" color={girl.rose} align="center" style={{ letterSpacing: 2 }}>
              IRLY Girl
            </Text>
            <Text variant="displayL" color={girl.ink} align="center">
              It&apos;s an IRLY match
            </Text>
            <Text variant="body" color={girl.inkSoft} align="center">
              {tx('You and {name} both want to meet new people.', { name: person.firstName })}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(textDelay + 120).duration(transition.match.text)} style={styles.why}>
            <View style={styles.whyHead}>
              <Text variant="overline" color={girl.inkSoft}>
                Why you match
              </Text>
              <Text variant="number" color={girl.rose}>
                {match.score}%
              </Text>
            </View>
            {lines.map((l) => (
              <View key={l} style={styles.line}>
                <Icon name="check" size={15} color={girl.positive} strokeWidth={2.6} />
                <Text variant="body" color={girl.ink}>
                  {l}
                </Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeIn.delay(textDelay + 240).duration(transition.match.actions)} style={{ gap: 12, paddingHorizontal: space.gutter }}>
            <GButton label={tx('Say hello to {name}', { name: person.firstName })} icon="message" onPress={onHello} />
          </Animated.View>

          <Animated.View entering={FadeIn.delay(textDelay + 320).duration(transition.match.actions)} style={{ gap: 12 }}>
            <View style={{ paddingHorizontal: space.gutter, gap: 2 }}>
              <Text variant="titleM" color={girl.ink}>
                Find something to do
              </Text>
              <Text variant="bodyS" color={girl.inkSoft}>
                What could you do together? Create it, or join a session already planned.
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
              {suggestions.map((s) => (
                <View key={s.id} style={styles.suggestion}>
                  <PressableScale haptic="select" scaleTo={0.96} onPress={() => onSuggestion(s)} accessibilityLabel={tx('Create: {what}', { what: tx(s.label) })} style={styles.suggestionPhoto}>
                    <Photo visual={{ photo: s.photo }} light="dubai" scrim="strong" style={StyleSheet.absoluteFill} width={400} />
                    <View style={styles.suggestionText}>
                      <Icon name={s.icon} size={16} color="#FFFFFF" />
                      <Text variant="titleS" color="#FFFFFF" numberOfLines={2}>
                        {s.label}
                      </Text>
                    </View>
                  </PressableScale>
                  <PressableScale haptic="select" scaleTo={0.96} onPress={() => onFindExisting(s)} accessibilityLabel={tx('Find activities: {what}', { what: tx(s.label) })} style={styles.findBtn}>
                    <Text variant="caption" color={girl.ink}>
                      Find existing
                    </Text>
                  </PressableScale>
                </View>
              ))}
            </ScrollView>
          </Animated.View>

          <PressableScale haptic="tap" scaleTo={0.96} onPress={onClose} accessibilityLabel="Keep discovering" style={styles.later}>
            <Text variant="label" color={girl.inkSoft}>
              Keep discovering
            </Text>
          </PressableScale>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stage: { height: CARD_H + 40, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  halo: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: girl.blush },
  photoCard: { width: CARD_W, height: CARD_H, borderRadius: 26, overflow: 'hidden', borderWidth: 4, borderColor: '#FFFFFF', boxShadow: girl.shadow, backgroundColor: girl.cream },
  center: { alignItems: 'center', justifyContent: 'center' },
  mark: { position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: girl.shadowSoft },
  texts: { paddingHorizontal: space.gutter, gap: 6 },
  why: { marginHorizontal: space.gutter, padding: 18, gap: 8, borderRadius: radius.xxl, backgroundColor: girl.surface, boxShadow: girl.shadowSoft },
  whyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggestion: { width: 150, gap: 6 },
  suggestionPhoto: { height: 170, borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'flex-end' },
  suggestionText: { padding: 12, gap: 6 },
  findBtn: { height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: girl.cream },
  later: { alignSelf: 'center', padding: 12 },
});
