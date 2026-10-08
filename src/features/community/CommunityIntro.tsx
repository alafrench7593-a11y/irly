import { Image } from 'expo-image';
import { t as tx } from '@/i18n';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IrlyWordmark } from '@/brand/IrlyLogo';
import { useFrame } from '@/components/layout/AppFrame';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { photo as photoUrl, portrait } from '@/data/photos';
import { haptic } from '@/motion/haptics';
import { radius, space } from '@/theme/tokens';
import { useStore } from '@/state/store';

/**
 * IRLY COMMUNITY INTRO: from profile to community to real life, in eight
 * short scenes (about 13 s) built from real UI pieces (the member's own
 * avatar or photo, interest chips, community cards, chat bubbles), not a
 * video. Each scene plays by itself; tap to go on, or skip. Reduce Motion:
 * one still summary instead of the animation.
 */

const SCENES = ['irly', 'me', 'interests', 'communities', 'people', 'chat', 'real', 'end'] as const;
type SceneKey = (typeof SCENES)[number];
const SCENE_MS: Record<SceneKey, number> = { irly: 1500, me: 1600, interests: 1500, communities: 1700, people: 2000, chat: 2200, real: 1600, end: 2200 };

const INTERESTS = [
  { emoji: '🏋️', label: 'Fitness' },
  { emoji: '⚽', label: 'Sport' },
  { emoji: '✈️', label: 'Travel' },
  { emoji: '💼', label: 'Network' },
  { emoji: '🍔', label: 'Food' },
];
const COMMUNITIES = [
  { emoji: '🏋️', name: 'IRLY Gym' },
  { emoji: '🏅', name: 'IRLY Sport' },
  { emoji: '✈️', name: 'IRLY Trip' },
  { emoji: '🤝', name: 'IRLY Network' },
  { emoji: '👋', name: 'IRLY Newcomers' },
];

/** `scene` opens on one scene and `hold` keeps it there (screenshots). */
export function CommunityIntro({ onDone, scene: startAt = 0, hold = false }: { onDone: () => void; scene?: number; hold?: boolean }) {
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(Math.max(0, Math.min(SCENES.length - 1, startAt)));
  const scene = SCENES[index];
  const last = index === SCENES.length - 1;

  useEffect(() => {
    if (reduced || last || hold) return;
    const id = setTimeout(() => setIndex((i) => Math.min(i + 1, SCENES.length - 1)), SCENE_MS[scene]);
    return () => clearTimeout(id);
  }, [index, scene, last, reduced, hold]);

  if (reduced) return <StillSummary onDone={onDone} top={insets.top} bottom={insets.bottom} />;

  const next = () => {
    haptic('select');
    if (last) onDone();
    else setIndex((i) => i + 1);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.bars}>
        {SCENES.map((s, i) => (
          <View key={s} style={[styles.bar, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            {i < index ? <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }]} /> : null}
            {i === index ? <Fill ms={SCENE_MS[s]} /> : null}
          </View>
        ))}
      </View>
      <Pressable style={styles.stage} onPress={next} accessibilityRole="button" accessibilityLabel={tx('Next')}>
        <Animated.View key={scene} entering={FadeIn.duration(260)} exiting={FadeOut.duration(180)} style={styles.scene}>
          {scene === 'irly' ? <IrlyScene /> : null}
          {scene === 'me' ? <MeScene /> : null}
          {scene === 'interests' ? <InterestsScene width={frame.width} toward /> : null}
          {scene === 'communities' ? <CommunitiesScene /> : null}
          {scene === 'people' ? <PeopleScene /> : null}
          {scene === 'chat' ? <ChatScene /> : null}
          {scene === 'real' ? <RealScene width={frame.width} /> : null}
          {scene === 'end' ? <EndScene /> : null}
        </Animated.View>
      </Pressable>
      <View style={styles.actions}>
        {last ? (
          <Animated.View entering={FadeInUp.springify(520).dampingRatio(0.85)} style={{ flex: 1 }}>
            <Button label="Find my communities" icon="arrowRight" variant="inverse" full onPress={onDone} />
          </Animated.View>
        ) : (
          <Button label="Skip" variant="ghost" onPress={onDone} />
        )}
      </View>
    </View>
  );
}

function Fill({ ms }: { ms: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(1, { duration: ms, easing: Easing.linear }));
  }, [ms, p]);
  const style = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#FFFFFF' }, style]} />;
}

const spring = (delay = 0) => FadeInDown.springify(560).dampingRatio(0.82).delay(delay);

function Big({ children, delay = 0 }: { children: string; delay?: number }) {
  return (
    <Animated.View entering={spring(delay)}>
      <Text variant="displayL" align="center" style={styles.white}>
        {children}
      </Text>
    </Animated.View>
  );
}

function Line({ children, delay = 0 }: { children: string; delay?: number }) {
  return (
    <Animated.View entering={spring(delay)}>
      <Text variant="body" align="center" style={styles.soft}>
        {children}
      </Text>
    </Animated.View>
  );
}

function IrlyScene() {
  return (
    <View style={styles.center}>
      <Animated.View entering={ZoomIn.springify(600).dampingRatio(0.7)}>
        <IrlyWordmark size={64} color="#FFFFFF" />
      </Animated.View>
      <Line delay={320}>Meet people. Find your community.</Line>
    </View>
  );
}

/** The member's own avatar or photo (or initials) in the middle. */
function Me({ size = 112 }: { size?: number }) {
  const profile = useStore((s) => s.profile);
  return <Avatar name={profile.name || 'IRLY'} hue={210} size={size} photo={profile.photoUri} ring />;
}

function MeScene() {
  return (
    <View style={styles.center}>
      <Animated.View entering={ZoomIn.springify(560).dampingRatio(0.75)}>
        <Me />
      </Animated.View>
      <Big delay={200}>This is you.</Big>
    </View>
  );
}

function InterestsScene({ width, toward }: { width: number; toward?: boolean }) {
  const r = Math.min(width * 0.36, 150);
  return (
    <View style={styles.center}>
      <View style={{ width: r * 2 + 120, height: r * 2 + 60, alignItems: 'center', justifyContent: 'center' }}>
        <Me size={96} />
        {INTERESTS.map((it, i) => {
          const a = (i / INTERESTS.length) * Math.PI * 2 - Math.PI / 2;
          return (
            // The position sits on a plain view: an entering animation owns its own transform.
            <View key={it.label} style={{ position: 'absolute', transform: [{ translateX: Math.cos(a) * r }, { translateY: Math.sin(a) * r * 0.8 }] }}>
              <Animated.View entering={ZoomIn.springify(520).dampingRatio(0.7).delay(120 + i * 110)} style={styles.chip}>
                <Text variant="label" style={styles.white}>
                  {`${it.emoji} ${tx(it.label)}`}
                </Text>
              </Animated.View>
            </View>
          );
        })}
      </View>
      {toward ? <Line delay={500}>Your interests…</Line> : null}
    </View>
  );
}

function CommunitiesScene() {
  return (
    <View style={[styles.center, { gap: 10 }]}>
      <Line>…lead to your communities.</Line>
      {COMMUNITIES.map((c, i) => (
        <Animated.View key={c.name} entering={FadeInDown.springify(520).dampingRatio(0.8).delay(140 + i * 120)} style={styles.card}>
          <Text style={styles.emoji}>{c.emoji}</Text>
          <Text variant="titleS" style={styles.white}>
            {c.name}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

/** You in the middle, softly linked to a few communities. */
function PeopleScene() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [pulse]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.18 + pulse.value * 0.22, transform: [{ scale: 1 + pulse.value * 0.12 }] }));
  return (
    <View style={styles.center}>
      <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: space[5] }}>
        <Animated.View style={[styles.halo, halo]} />
        <Me size={84} />
      </View>
      <View style={styles.row}>
        {COMMUNITIES.slice(0, 3).map((c, i) => (
          <Animated.View key={c.name} entering={ZoomIn.springify(500).delay(100 + i * 120)} style={styles.dot}>
            <Text style={styles.emoji}>{c.emoji}</Text>
          </Animated.View>
        ))}
      </View>
      <Big delay={300}>You don’t have to find everyone.</Big>
      <Line delay={800}>IRLY helps you find your people.</Line>
    </View>
  );
}

const FACES = ['p-layla', 'p-james', 'p-mei', 'p-arjun'];

function ChatScene() {
  return (
    <View style={[styles.center, { alignItems: 'stretch', gap: 10, paddingHorizontal: space.gutter }]}>
      <Animated.View entering={spring(0)} style={styles.chatHead}>
        <Text style={styles.emoji}>🏋️</Text>
        <Text variant="titleS" style={styles.white}>
          IRLY Gym
        </Text>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(200)} style={styles.system}>
        <Text variant="caption" style={styles.soft}>
          {tx('{name} just joined 👋 Say hello!', { name: 'Sarah' })}
        </Text>
      </Animated.View>
      <Bubble mine delay={500} text={tx('Hey everyone 👋 I’m new here.')} />
      <Bubble face={FACES[0]} delay={1000} text={tx('Welcome! 🙌')} />
      <Bubble face={FACES[1]} delay={1350} text={tx('We train Saturday at 8, join us?')} />
      <Bubble face={FACES[2]} delay={1700} text="🔥🔥" />
    </View>
  );
}

function Bubble({ text, delay, mine, face }: { text: string; delay: number; mine?: boolean; face?: string }) {
  return (
    <Animated.View entering={FadeInDown.springify(480).dampingRatio(0.8).delay(delay)} style={[styles.bubbleRow, mine ? { justifyContent: 'flex-end' } : null]}>
      {face ? <Image source={{ uri: portrait(face) }} style={styles.face} contentFit="cover" /> : null}
      <View style={[styles.bubble, mine ? styles.bubbleMine : null]}>
        <Text variant="body" style={mine ? { color: '#0A0A0A' } : styles.white}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

function RealScene({ width }: { width: number }) {
  const zoom = useSharedValue(1.08);
  useEffect(() => {
    zoom.set(withDelay(100, withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) })));
  }, [zoom]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));
  return (
    <View style={styles.center}>
      <Animated.View entering={ZoomIn.springify(560).dampingRatio(0.85)} style={[styles.photo, { width: width - space.gutter * 2 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, style]}>
          <Image source={{ uri: photoUrl('gym', 900) }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
        <View style={styles.photoTag}>
          <Text variant="label" style={styles.white}>
            {`🏋️ IRLY Gym · ${tx('Saturday 8:00')}`}
          </Text>
        </View>
      </Animated.View>
      <Big delay={300}>Chat → people → real life.</Big>
    </View>
  );
}

function EndScene() {
  return (
    <View style={styles.center}>
      <Line>From profile</Line>
      <Line delay={250}>to community</Line>
      <Line delay={500}>to real life.</Line>
      <Animated.View entering={ZoomIn.springify(600).dampingRatio(0.75).delay(900)} style={{ marginTop: space[6], alignItems: 'center', gap: 6 }}>
        <IrlyWordmark size={52} color="#FFFFFF" />
        <Text variant="label" style={styles.soft}>
          In Real Life.
        </Text>
      </Animated.View>
    </View>
  );
}

/** Reduce Motion: the whole idea at once, no movement. */
function StillSummary({ onDone, top, bottom }: { onDone: () => void; top: number; bottom: number }) {
  return (
    <View style={[styles.root, { paddingTop: top + 40, paddingBottom: bottom + 16, justifyContent: 'space-between' }]}>
      <View style={[styles.center, { gap: 14 }]}>
        <IrlyWordmark size={48} color="#FFFFFF" />
        <Text variant="displayL" align="center" style={styles.white}>
          Meet people. Find your community.
        </Text>
        <Text variant="body" align="center" style={styles.soft}>
          IRLY suggests communities from your interests. Join the ones you like, say hello, and meet in real life.
        </Text>
        <View style={[styles.row, { flexWrap: 'wrap', justifyContent: 'center' }]}>
          {COMMUNITIES.map((c) => (
            <View key={c.name} style={styles.chip}>
              <Text variant="label" style={styles.white}>{`${c.emoji} ${c.name}`}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.actions}>
        <Button label="Find my communities" icon="arrowRight" variant="inverse" full onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050506' },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: space.gutter },
  bar: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  stage: { flex: 1 },
  scene: { flex: 1, justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: space.gutter },
  actions: { paddingHorizontal: space.gutter, flexDirection: 'row', justifyContent: 'center', minHeight: 52 },
  white: { color: '#FFFFFF' },
  soft: { color: 'rgba(255,255,255,0.72)' },
  emoji: { fontSize: 22 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, width: 260, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.08)' },
  row: { flexDirection: 'row', gap: 14 },
  dot: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  halo: { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: '#FFFFFF' },
  chatHead: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center' },
  system: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.08)' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)' },
  bubbleMine: { backgroundColor: '#FFFFFF' },
  face: { width: 30, height: 30, borderRadius: 15 },
  photo: { height: 260, borderRadius: radius.xl, overflow: 'hidden' },
  photoTag: { position: 'absolute', left: 12, bottom: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.55)' },
});
