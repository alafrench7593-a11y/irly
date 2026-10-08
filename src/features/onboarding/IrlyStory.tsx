import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { t as tx } from '@/i18n';
import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IrlyWordmark } from '@/brand/IrlyLogo';
import { useFrame } from '@/components/layout/AppFrame';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { LiveDot } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Film } from '@/components/visual/Film';
import { filmFor, photo as photoUrl, portrait, type PhotoKey } from '@/data/photos';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { radius, space } from '@/theme/tokens';

/** Bump when the story changes: everyone sees the new one once (src/app/index.tsx). */
export const STORY_VERSION = 2;

/** How long a scene stays before the next one comes in by itself. */
const SCENE_MS = 3000;

type Scene = { key: string; word: string; line: string };

const SCENES: Scene[] = [
  { key: 'friends', word: 'Make friends.', line: 'People near you who love what you love.' },
  { key: 'activities', word: 'Do things together.', line: 'Padel at 7. Brunch on Sunday. The desert at sunset.' },
  { key: 'network', word: 'Grow your network.', line: 'Founders, creatives and professionals around you.' },
  { key: 'real', word: 'Meet in real life.', line: 'Join a plan, meet up, become friends.' },
  { key: 'irly', word: 'Friends. Activities. Network.', line: "In real life. That's IRLY." },
];

/**
 * What IRLY is, in five scenes, before you choose where you are going:
 * make friends, do things together, grow your network, meet in real life,
 * then the promise over Dubai. Real photographs throughout (example
 * portraits and Dubai photos from the library). Each scene plays by itself
 * for three seconds (the bars at the top fill like stories); tap the right
 * side to go on, the left side to go back, or skip. Reduce Motion: the same
 * scenes, still, cross-faded.
 */
/** `scene` opens on one scene and `hold` keeps it there (website screenshots). */
export function IrlyStory({ onDone, scene: startAt = 0, hold = false }: { onDone: () => void; scene?: number; hold?: boolean }) {
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(Math.max(0, Math.min(SCENES.length - 1, startAt)));
  const last = index === SCENES.length - 1;
  const scene = SCENES[index];
  // The scene fills everything between the bars and the words.
  const stageTop = insets.top + 56;
  const stageH = Math.max(260, frame.height - stageTop - insets.bottom - 56 - 150);

  useEffect(() => {
    if (last || hold) return;
    const id = setTimeout(() => setIndex((i) => Math.min(SCENES.length - 1, i + 1)), SCENE_MS);
    return () => clearTimeout(id);
  }, [index, last, hold]);

  const next = () => {
    haptic('select');
    if (last) onDone();
    else setIndex(index + 1);
  };
  const prev = () => {
    if (index === 0) return;
    haptic('select');
    setIndex(index - 1);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Tap zones: a third to go back, the rest to go on. */}
      <View style={[StyleSheet.absoluteFill, styles.zones]}>
        <Pressable style={{ flex: 1 }} onPress={prev} accessibilityRole="button" accessibilityLabel={tx('Previous')} />
        <Pressable style={{ flex: 2 }} onPress={next} accessibilityRole="button" accessibilityLabel={tx('Next')} />
      </View>

      <View style={[styles.top, { top: insets.top + 12 }]} pointerEvents="box-none">
        <View style={styles.bars} pointerEvents="none">
          {SCENES.map((s, i) => (
            <Bar key={s.key} state={i < index ? 'done' : i === index ? 'now' : 'later'} reduced={reduced} />
          ))}
        </View>
        {!last ? (
          <PressableScale haptic="select" scaleTo={0.94} onPress={onDone} style={styles.skip} accessibilityLabel={tx('Skip')}>
            <Text variant="label" color="rgba(255,255,255,0.78)">
              Skip
            </Text>
          </PressableScale>
        ) : null}
      </View>

      <View style={[styles.stage, { top: stageTop, height: stageH }]} pointerEvents="none">
        <Animated.View key={scene.key} entering={FadeIn.duration(380)} exiting={FadeOut.duration(220)} style={StyleSheet.absoluteFill}>
          {scene.key === 'friends' ? <PeopleScene h={stageH} w={frame.width} reduced={reduced} /> : null}
          {scene.key === 'activities' ? <ActivitiesScene h={stageH} w={frame.width} reduced={reduced} /> : null}
          {scene.key === 'network' ? <NetworkScene h={stageH} w={frame.width} reduced={reduced} /> : null}
          {scene.key === 'real' ? <RealLifeScene h={stageH} w={frame.width} reduced={reduced} /> : null}
          {scene.key === 'irly' ? <IrlyScene h={stageH} reduced={reduced} /> : null}
        </Animated.View>
      </View>

      <View style={[styles.words, { bottom: insets.bottom + (last ? 112 : 56) }]} pointerEvents="none">
        <Animated.View key={`w-${scene.key}`} entering={reduced ? FadeIn.duration(300) : FadeInDown.springify(620).dampingRatio(0.82).delay(80)}>
          <Text variant="displayL" tone="onDark" accessibilityRole="header">
            {scene.word}
          </Text>
        </Animated.View>
        <Animated.View key={`l-${scene.key}`} entering={FadeIn.duration(420).delay(reduced ? 0 : 260)}>
          <Text variant="bodyL" color="rgba(255,255,255,0.7)">
            {scene.line}
          </Text>
        </Animated.View>
      </View>

      {last ? (
        <Animated.View entering={FadeInDown.springify(520).dampingRatio(0.9).delay(reduced ? 0 : 420)} style={[styles.cta, { bottom: insets.bottom + space[6] }]}>
          <Button label="Get started" iconRight="arrowRight" full haptic="press" onPress={onDone} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/* ───────── Progress bars ───────── */

function Bar({ state, reduced }: { state: 'done' | 'now' | 'later'; reduced: boolean }) {
  const p = useSharedValue(state === 'done' ? 1 : 0);
  useEffect(() => {
    if (state === 'now') {
      p.set(0);
      p.set(withTiming(1, { duration: reduced ? 1 : SCENE_MS, easing: Easing.linear }));
    } else p.set(state === 'done' ? 1 : 0);
  }, [state, p, reduced]);
  const fill = useAnimatedStyle(() => ({ transform: [{ translateX: `${(p.value - 1) * 100}%` }] }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.barFill, fill]} />
    </View>
  );
}

/* ───────── Scenes ───────── */

type SceneProps = { w: number; h: number; reduced: boolean };

type FaceDef = { id: string; name: string; hue: number; x: number; y: number; size: number; live?: boolean; online?: boolean };

/** Example portraits (stock photos), never presented as members. */
const FACES: FaceDef[] = [
  { id: 'p-layla', name: 'Layla', hue: 12, x: 0.5, y: 0.4, size: 96, live: true },
  { id: 'p-kenji', name: 'Kenji', hue: 210, x: 0.2, y: 0.22, size: 66 },
  { id: 'p-chloe', name: 'Chloé', hue: 330, x: 0.8, y: 0.2, size: 70, online: true },
  { id: 'p-lucas', name: 'Lucas', hue: 40, x: 0.15, y: 0.6, size: 60, online: true },
  { id: 'p-mia', name: 'Mia', hue: 150, x: 0.85, y: 0.58, size: 62 },
  { id: 'p-amira', name: 'Amira', hue: 280, x: 0.34, y: 0.84, size: 54 },
  { id: 'p-tom', name: 'Tom', hue: 95, x: 0.68, y: 0.86, size: 58, online: true },
];

/** FRIENDS: real faces drift in from everywhere and gather; what you share shows. */
const PeopleScene = memo(function PeopleScene({ w, h, reduced }: SceneProps) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {FACES.map((f, i) => (
        <Face key={f.name} face={f} index={i} w={w} h={h} reduced={reduced} />
      ))}
      <Animated.View entering={reduced ? undefined : FadeInDown.delay(900).duration(500)} style={[styles.shared, { top: h * 0.4 + 66, left: w / 2 - 90 }]}>
        <Glass dark level="regular" style={styles.sharedGlass}>
          <Icon name="sparkles" size={14} color="#FFFFFF" />
          <Text variant="caption" color="#FFFFFF" numberOfLines={1}>
            Also into padel
          </Text>
        </Glass>
      </Animated.View>
    </View>
  );
});

function Face({ face, index, w, h, reduced }: { face: FaceDef; index: number; w: number; h: number; reduced: boolean }) {
  const enter = useSharedValue(reduced ? 1 : 0);
  const float = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    enter.set(withDelay(index * 80, withSpring(1, { duration: 700, dampingRatio: 0.78 })));
    float.set(withDelay(800 + index * 120, withRepeat(withTiming(1, { duration: 2200 + index * 180, easing: Easing.inOut(Easing.sin) }), -1, true)));
  }, [reduced, enter, float, index]);
  const fromX = (face.x - 0.5) * 2.4 * w * 0.5;
  const fromY = (face.y - 0.5) * 2.4 * h * 0.5;
  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateX: (1 - enter.value) * fromX },
      { translateY: (1 - enter.value) * fromY + (float.value - 0.5) * 8 },
      { scale: 0.5 + enter.value * 0.5 },
    ],
  }));
  return (
    <Animated.View style={[styles.face, { left: face.x * w - face.size / 2, top: face.y * h - face.size / 2 }, style]}>
      <View style={[styles.faceRing, face.live ? { borderColor: '#FF453A' } : null]}>
        <Avatar name={face.name} hue={face.hue} size={face.size} online={face.online} photo={portrait(face.id)} />
      </View>
      {face.live ? (
        <View style={styles.livePill}>
          <LiveDot size={5} color="#FFFFFF" />
          <Text variant="caption" color="#FFFFFF" style={{ fontSize: 10, lineHeight: 12 }}>
            LIVE
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

// Dubai photos only (checked, served from the photo library).
const ROWS: { photo: PhotoKey; label: string }[][] = [
  [
    { photo: 'gym', label: 'Gym' },
    { photo: 'beachSunset', label: 'Beach' },
    { photo: 'yacht', label: 'Boat day' },
    { photo: 'streetFood', label: 'Street food' },
  ],
  [
    { photo: 'dunes', label: 'Desert' },
    { photo: 'souk', label: 'Souk' },
    { photo: 'djSunset', label: 'Sunset' },
    { photo: 'coffeeBar', label: 'Coffee' },
  ],
  [
    { photo: 'kayak', label: 'Hatta' },
    { photo: 'rooftopNeon', label: 'Night out' },
    { photo: 'dubaiMarina', label: 'Marina walk' },
    { photo: 'steak', label: 'Dinner' },
  ],
];

/** ACTIVITIES: rows of real things to do in Dubai flow past in opposite directions. */
const ActivitiesScene = memo(function ActivitiesScene({ h, reduced }: SceneProps) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip, { justifyContent: 'center', gap: 12 }]}>
      {ROWS.map((row, i) => (
        <Marquee key={i} items={row} dir={i % 2 ? 1 : -1} speed={12000 + i * 2400} reduced={reduced} delay={i * 120} tileH={Math.min(118, Math.max(84, h * 0.2))} />
      ))}
    </View>
  );
});

function Marquee({ items, dir, speed, reduced, delay, tileH }: { items: { photo: PhotoKey; label: string }[]; dir: 1 | -1; speed: number; reduced: boolean; delay: number; tileH: number }) {
  const [rowW, setRowW] = useState(0);
  const x = useSharedValue(0);
  const appear = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced || !rowW) return;
    appear.set(withDelay(delay, withTiming(1, { duration: 500 })));
    x.set(withRepeat(withTiming(1, { duration: speed, easing: Easing.linear }), -1, false));
  }, [reduced, rowW, x, appear, speed, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateX: dir < 0 ? -x.value * rowW : (x.value - 1) * rowW }],
  }));
  const tiles = (copy: number) =>
    items.map((c) => (
      <View key={`${copy}-${c.label}`} style={[styles.tile, { height: tileH, width: tileH * 1.45 }]}>
        <Image source={{ uri: photoUrl(c.photo, 480) }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']} start={{ x: 0, y: 0.45 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text variant="label" color="#FFFFFF" style={styles.tileLabel}>
          {c.label}
        </Text>
      </View>
    ));
  return (
    <Animated.View style={[styles.marquee, style]}>
      <View style={styles.marqueeRow} onLayout={(e) => setRowW(e.nativeEvent.layout.width + 12)}>
        {tiles(0)}
      </View>
      <View style={styles.marqueeRow}>{tiles(1)}</View>
      <View style={styles.marqueeRow}>{tiles(2)}</View>
    </Animated.View>
  );
}

const PROS: { id: string; name: string; role: string; hue: number }[] = [
  { id: 'p-marco', name: 'Marco', role: 'Founder · Fintech', hue: 210 },
  { id: 'p-chloe', name: 'Chloé', role: 'Product designer', hue: 330 },
  { id: 'p-lucas', name: 'Lucas', role: 'Investor · Real estate', hue: 40 },
];

/** NETWORK: professional cards fan in; one request turns into a connection. */
const NetworkScene = memo(function NetworkScene({ w, h, reduced }: SceneProps) {
  const [connected, setConnected] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(() => {
      setConnected(true);
      haptic('tap');
    }, 1500);
    return () => clearTimeout(id);
  }, [reduced]);
  const cardW = Math.min(300, w - space.gutter * 2);
  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: h * 0.06 }]}>
      {PROS.map((p, i) => (
        <Animated.View key={p.id} entering={reduced ? undefined : FadeInDown.springify(620).dampingRatio(0.8).delay(120 + i * 180)} style={{ width: cardW, transform: [{ rotate: `${(i - 1) * -1.5}deg` }] }}>
          <Glass dark level="regular" style={styles.proCard}>
            <Avatar name={p.name} hue={p.hue} size={52} photo={portrait(p.id)} />
            <View style={{ flex: 1 }}>
              <Text variant="titleS" tone="onDark" numberOfLines={1}>
                {p.name}
              </Text>
              <Text variant="caption" color="rgba(255,255,255,0.7)" numberOfLines={1}>
                {p.role}
              </Text>
            </View>
            {i === 1 && connected ? (
              <Animated.View entering={reduced ? undefined : FadeIn.duration(250)} style={[styles.connect, styles.connected]}>
                <Icon name="check" size={14} color="#050506" strokeWidth={2.6} />
                <Text variant="caption" color="#050506" style={{ fontWeight: '700' }}>
                  Connected
                </Text>
              </Animated.View>
            ) : (
              <View style={[styles.connect, styles.connectRound]}>
                <Icon name="plus" size={16} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            )}
          </Glass>
        </Animated.View>
      ))}
    </View>
  );
});

/** REAL LIFE: two people come from either side and meet over a plan. */
const RealLifeScene = memo(function RealLifeScene({ w, h, reduced }: SceneProps) {
  const p = useSharedValue(reduced ? 1 : 0);
  const card = useSharedValue(reduced ? 1 : 0);
  const burst = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    card.set(withDelay(120, withSpring(1, spring.strong)));
    p.set(withDelay(380, withSpring(1, { duration: 900, dampingRatio: 0.85 })));
    burst.set(withDelay(1150, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })));
    const id = setTimeout(() => haptic('tap'), 1150);
    return () => clearTimeout(id);
  }, [reduced, p, card, burst]);
  const travel = w * 0.36;
  const left = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 2), transform: [{ translateX: -travel * (1 - p.value) - 40 }] }));
  const right = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 2), transform: [{ translateX: travel * (1 - p.value) + 40 }] }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: card.value, transform: [{ scale: 0.8 + card.value * 0.2 }, { translateY: (1 - card.value) * 20 }] }));
  const cy = h * 0.42;
  return (
    <View style={StyleSheet.absoluteFill}>
      {Array.from({ length: 14 }, (_, i) => (
        <BurstDot key={i} angle={(i / 14) * Math.PI * 2} reach={110 + (i % 3) * 30} burst={burst} cx={w / 2} cy={cy} />
      ))}
      <Animated.View style={[styles.meetFace, { left: w / 2 - 40, top: cy - 40 }, left]}>
        <Avatar name="Layla" hue={12} size={80} photo={portrait('p-layla')} />
      </Animated.View>
      <Animated.View style={[styles.meetFace, { left: w / 2 - 40, top: cy - 40 }, right]}>
        <Avatar name="Kenji" hue={210} size={80} photo={portrait('p-kenji')} />
      </Animated.View>
      <Animated.View style={[styles.planCard, { top: cy + 64, left: w / 2 - 118 }, cardStyle]}>
        <Glass dark level="regular" style={styles.planGlass}>
          <View style={styles.planIcon}>
            <Icon name="target" size={18} color="#050506" />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleS" tone="onDark">
              Padel · 19:30
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.7)">
              {tx('2 going · Al Quoz')}
            </Text>
          </View>
          <Icon name="check" size={18} color="#32D74B" strokeWidth={2.6} />
        </Glass>
      </Animated.View>
    </View>
  );
});

function BurstDot({ angle, reach, burst, cx, cy }: { angle: number; reach: number; burst: SharedValue<number>; cx: number; cy: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: burst.value <= 0 ? 0 : (1 - burst.value) * 0.9,
    transform: [{ translateX: Math.cos(angle) * reach * burst.value }, { translateY: Math.sin(angle) * reach * burst.value }],
  }));
  return <Animated.View style={[styles.burst, { left: cx - 3, top: cy - 3 }, style]} />;
}

/** The promise over Dubai: the city (photo, then its film) and the wordmark lighting up, dot by dot. */
const IrlyScene = memo(function IrlyScene({ h, reduced }: { h: number; reduced: boolean }) {
  const film = filmFor('dubai');
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip, styles.cityFrame]}>
      <Image source={{ uri: photoUrl('dubai', 900) }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      {film && !reduced ? <Film uri={film} /> : null}
      <LinearGradient colors={['#050506', 'rgba(5,5,6,0.35)', 'rgba(5,5,6,0.35)', '#050506']} locations={[0, 0.25, 0.7, 1]} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingBottom: h * 0.1 }]}>
        <IrlyWordmark size={72} color="#FFFFFF" animated />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  zones: { flexDirection: 'row' },
  top: { position: 'absolute', left: space.gutter, right: space.gutter, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bars: { flex: 1, flexDirection: 'row', gap: 5 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  barFill: { backgroundColor: '#FFFFFF', borderRadius: 2 },
  skip: { paddingHorizontal: 12, height: 32, borderRadius: 16, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  stage: { position: 'absolute', left: 0, right: 0 },
  clip: { overflow: 'hidden' },
  words: { position: 'absolute', left: space.gutter, right: space.gutter, gap: 10 },
  cta: { position: 'absolute', left: space.gutter, right: space.gutter },
  face: { position: 'absolute', alignItems: 'center' },
  faceRing: { borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', padding: 2, boxShadow: '0px 12px 32px rgba(0,0,0,0.6)' },
  livePill: { position: 'absolute', bottom: -8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, height: 18, borderRadius: 9, backgroundColor: '#FF453A' },
  pinBox: { position: 'absolute', width: 120, alignItems: 'center' },
  pinRing: { position: 'absolute', top: 0, width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)' },
  pin: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 8px 24px rgba(255,255,255,0.25)' },
  pinLabel: { paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center' },
  marquee: { flexDirection: 'row', gap: 12 },
  tile: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'flex-end' },
  tileLabel: { margin: 10, fontSize: 15 },
  shared: { position: 'absolute', width: 180, alignItems: 'center' },
  sharedGlass: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 28, borderRadius: 14 },
  proCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg },
  connect: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  connected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  connectRound: { width: 32, height: 32, paddingHorizontal: 0, borderRadius: 16, justifyContent: 'center' },
  cityFrame: { borderRadius: 0 },
  marqueeRow: { flexDirection: 'row', gap: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.16)' },
  chipOn: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  meetFace: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#FFFFFF', overflow: 'hidden', boxShadow: '0px 14px 36px rgba(0,0,0,0.6)' },
  planCard: { position: 'absolute', width: 236 },
  planGlass: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg },
  planIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  burst: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
});
