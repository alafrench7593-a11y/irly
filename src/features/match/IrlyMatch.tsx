import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { IrlyMark } from '@/brand/IrlyMark';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { ACTIVITIES, INTERESTS } from '@/data/catalog';
import { findPerson, getCityContent } from '@/data/repo';
import type { Person } from '@/data/types';
import { openCreate } from '@/features/create/createStore';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { spring, transition } from '@/motion/tokens';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';

const FACE = 112;
/** Dots of light that burst out when the two faces meet (the IRLY dot). */
const BURST = Array.from({ length: 16 }, (_, i) => ({ angle: (i / 16) * Math.PI * 2, reach: 120 + (i % 3) * 34, size: i % 2 ? 5 : 7 }));

/**
 * Watches connection requests: when someone accepts while you are in the
 * app, IT'S AN IRLY MATCH plays over whatever you were doing.
 */
export function MatchHost() {
  const [person, setPerson] = useState<Person | null>(null);
  const prev = useRef(useStore.getState().connections);
  useEffect(
    () =>
      useStore.subscribe((s) => {
        const before = prev.current;
        prev.current = s.connections;
        if (before === s.connections) return;
        const accepted = Object.keys(s.connections).find((id) => s.connections[id] === 'connected' && before[id] === 'pending');
        const p = accepted ? findPerson(accepted) : undefined;
        if (p) setPerson(p);
      }),
    [],
  );
  if (!person) return null;
  return <IrlyMatch person={person} onClose={() => setPerson(null)} />;
}

/**
 * IT'S AN IRLY MATCH. Both faces glide in from either side and tilt toward
 * each other; where they meet, a halo of light breathes, a burst of IRLY
 * dots flies out and the IRLY mark lands (success haptic). Then the words
 * word by word, what you share, and the two ways forward: say hello, or
 * find something to do together. About 1.8 s end to end; Reduce Motion
 * gets a plain fade.
 */
export function IrlyMatch({ person, onClose }: { person: Person; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const me = useStore((s) => s.profile);
  const p = useSharedValue(0);
  const glow = useSharedValue(0);
  const mark = useSharedValue(0);
  const burst = useSharedValue(0);
  const timing = transition.match;

  useEffect(() => {
    if (reduced) {
      p.set(withTiming(1, { duration: 200 }));
      mark.set(withTiming(1, { duration: 200 }));
      glow.set(withTiming(0.6, { duration: 200 }));
      haptic('success');
      return;
    }
    p.set(withSpring(1, { duration: timing.approach, dampingRatio: 0.8 }));
    mark.set(withDelay(timing.approach - 140, withSpring(1, spring.strong)));
    burst.set(withDelay(timing.approach - 160, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })));
    glow.set(
      withDelay(
        timing.approach - 100,
        withSequence(withTiming(1, { duration: timing.merge }), withRepeat(withTiming(0.45, { duration: 1700, easing: Easing.inOut(Easing.quad) }), -1, true)),
      ),
    );
    const h = setTimeout(() => haptic('success'), timing.approach - 120);
    return () => clearTimeout(h);
  }, [reduced, p, mark, glow, burst, timing]);

  const shared = useMemo(() => {
    const i = me.interests.filter((x) => person.interests.includes(x)).map((x) => ({ key: x, label: INTERESTS[x].label, icon: INTERESTS[x].icon }));
    const a = me.activities.filter((x) => person.activities.includes(x)).map((x) => ({ key: x, label: ACTIVITIES[x].label, icon: ACTIVITIES[x].icon }));
    return [...a, ...i].slice(0, 5);
  }, [me, person]);

  const left = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateX: (1 - p.value) * -230 - FACE * 0.36 }, { rotate: `${-7 * p.value}deg` }, { scale: 0.84 + p.value * 0.16 }],
  }));
  const right = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateX: (1 - p.value) * 230 + FACE * 0.36 }, { rotate: `${7 * p.value}deg` }, { scale: 0.84 + p.value * 0.16 }],
  }));
  const halo = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.8 + glow.value * 0.3 }] }));
  const markStyle = useAnimatedStyle(() => ({ opacity: mark.value, transform: [{ scale: 0.3 + mark.value * 0.7 }] }));

  const conversation = getCityContent(person.cityId).conversations.find((c) => c.kind === 'direct' && c.personIds?.includes(person.id));
  const first = person.name.split(' ')[0];
  const words = tx("It's an IRLY match").split(' ');
  const textDelay = reduced ? 0 : timing.approach + timing.merge;

  const close = () => {
    haptic('tap');
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        {Platform.OS === 'android' ? null : <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: Platform.OS === 'android' ? 'rgba(5,5,6,0.96)' : 'rgba(5,5,6,0.62)' }]} />
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32, gap: space[7] }} showsVerticalScrollIndicator={false}>
          <View style={styles.stage}>
            <Animated.View style={[styles.halo, halo]} pointerEvents="none">
              <Svg width={340} height={340}>
                <Defs>
                  <RadialGradient id="irly-match-halo" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.28} />
                    <Stop offset="0.45" stopColor="#8EA5BF" stopOpacity={0.12} />
                    <Stop offset="1" stopColor="#8EA5BF" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x={0} y={0} width={340} height={340} fill="url(#irly-match-halo)" />
              </Svg>
            </Animated.View>
            {reduced ? null : BURST.map((d, i) => <BurstDot key={i} dot={d} burst={burst} />)}
            <Animated.View style={[styles.face, left]}>
              <Avatar name={me.name || 'You'} hue={262} size={FACE} photo={me.photoUri} />
            </Animated.View>
            <Animated.View style={[styles.face, right]}>
              <Avatar name={person.name} hue={person.hue} size={FACE} />
            </Animated.View>
            <Animated.View style={[styles.mark, markStyle]}>
              <IrlyMark size={34} state="static" ringColor="#0A0A0A" lensColor="#0A0A0A" glow={false} />
            </Animated.View>
          </View>

          <View style={styles.texts}>
            <View style={styles.title} accessible accessibilityRole="header" accessibilityLabel={tx("It's an IRLY match")}>
              {words.map((w, i) => (
                <Animated.View key={`${w}-${i}`} entering={reduced ? undefined : FadeInDown.springify(560).dampingRatio(0.78).delay(textDelay + i * 80)} importantForAccessibility="no-hide-descendants">
                  <Text raw variant="displayL" style={styles.word}>
                    {w}
                  </Text>
                </Animated.View>
              ))}
            </View>
            <Animated.View entering={reduced ? undefined : FadeIn.delay(textDelay + words.length * 80 + 60).duration(transition.match.text)} style={{ gap: 14, alignItems: 'center' }}>
              <Text variant="bodyL" color="rgba(255,255,255,0.74)" align="center">
                {tx('You and {name} said yes to meeting.', { name: first })}
              </Text>
              {shared.length ? (
                <View style={styles.shared}>
                  {shared.map((s) => (
                    <View key={s.key} style={styles.chip}>
                      <Icon name={s.icon} size={14} color="#FFFFFF" />
                      <Text variant="label" color="#FFFFFF">
                        {s.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Animated.View>
          </View>

          <Animated.View entering={reduced ? undefined : FadeInDown.springify(520).dampingRatio(0.9).delay(textDelay + transition.match.actions)} style={styles.actions}>
            <Button
              label="Say hello"
              icon="message"
              full
              haptic="press"
              onPress={() => {
                onClose();
                router.push((conversation ? `/messages/${conversation.id}` : '/messages') as never);
              }}
            />
            <Button
              label="Find something to do"
              icon="sparkles"
              variant="secondary"
              full
              onPress={() => {
                onClose();
                openCreate(null, { format: 'activity' });
              }}
            />
            <PressableScale haptic="tap" scaleTo={0.95} onPress={close} style={styles.later} accessibilityLabel="Not now">
              <Text variant="label" color="rgba(255,255,255,0.6)">
                Not now
              </Text>
            </PressableScale>
          </Animated.View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function BurstDot({ dot, burst }: { dot: { angle: number; reach: number; size: number }; burst: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const v = burst.value;
    return {
      opacity: v <= 0 ? 0 : (1 - v) * 0.9,
      transform: [{ translateX: Math.cos(dot.angle) * dot.reach * v }, { translateY: Math.sin(dot.angle) * dot.reach * v }, { scale: 1 - v * 0.4 }],
    };
  });
  return <Animated.View style={[styles.dot, { width: dot.size, height: dot.size, borderRadius: dot.size / 2 }, style]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  stage: { height: 230, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 340, height: 340 },
  face: { position: 'absolute', width: FACE + 8, height: FACE + 8, borderRadius: (FACE + 8) / 2, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0px 18px 48px rgba(0,0,0,0.6)' },
  mark: { position: 'absolute', width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 8px 28px rgba(255,255,255,0.28)' },
  dot: { position: 'absolute', backgroundColor: '#FFFFFF' },
  texts: { paddingHorizontal: space.gutter, gap: 14, alignItems: 'center' },
  title: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  word: { textTransform: 'uppercase', marginHorizontal: 5, color: '#FFFFFF' },
  shared: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 13, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.18)' },
  actions: { paddingHorizontal: space.gutter, gap: 10 },
  later: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20 },
});
