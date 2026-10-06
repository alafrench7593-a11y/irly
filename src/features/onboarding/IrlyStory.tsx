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
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CITIES } from '@/data/destinations';
import { MapArt } from '@/features/map/MapArt';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { radius, space } from '@/theme/tokens';

/** How long a scene stays before the next one comes in by itself. */
const SCENE_MS = 3000;

type Scene = { key: string; word: string; line: string };

const SCENES: Scene[] = [
  { key: 'people', word: 'People.', line: "Who's around you, right now." },
  { key: 'places', word: 'Places.', line: 'Cafés, courts, rooftops, beaches.' },
  { key: 'activities', word: 'Activities.', line: 'Padel at 7. Brunch on Sunday. A run at sunrise.' },
  { key: 'real', word: 'Real life.', line: 'Then you meet. For real.' },
  { key: 'irly', word: 'Find someone to do something with.', line: "That's IRLY." },
];

/**
 * What IRLY is, in five scenes, before you choose where you are going.
 * PEOPLE. PLACES. ACTIVITIES. REAL LIFE. Then the promise: find someone
 * to do something with. Each scene plays by itself for three seconds (the
 * bars at the top fill like stories); tap the right side to go on, the
 * left side to go back, or skip. Every scene is drawn from the app's own
 * pieces: faces, the dark map, activity chips, the meeting. Reduce Motion:
 * the same scenes, still, cross-faded.
 */
export function IrlyStory({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const last = index === SCENES.length - 1;
  const scene = SCENES[index];
  // The scene fills everything between the bars and the words.
  const stageTop = insets.top + 56;
  const stageH = Math.max(260, frame.height - stageTop - insets.bottom - 56 - 150);

  useEffect(() => {
    if (last) return;
    const id = setTimeout(() => setIndex((i) => Math.min(SCENES.length - 1, i + 1)), SCENE_MS);
    return () => clearTimeout(id);
  }, [index, last]);

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
          {scene.key === 'people' ? <PeopleScene h={stageH} w={frame.width} reduced={reduced} /> : null}
          {scene.key === 'places' ? <PlacesScene h={stageH} w={frame.width} reduced={reduced} /> : null}
          {scene.key === 'activities' ? <ActivitiesScene h={stageH} w={frame.width} reduced={reduced} /> : null}
          {scene.key === 'real' ? <RealLifeScene h={stageH} w={frame.width} reduced={reduced} /> : null}
          {scene.key === 'irly' ? <IrlyScene h={stageH} /> : null}
        </Animated.View>
      </View>

      <View style={[styles.words, { bottom: insets.bottom + (last ? 112 : 56) }]} pointerEvents="none">
        <Animated.View key={`w-${scene.key}`} entering={reduced ? FadeIn.duration(300) : FadeInDown.springify(620).dampingRatio(0.82).delay(80)}>
          <Text variant={last ? 'displayL' : 'displayXL'} tone="onDark" style={last ? undefined : styles.word} accessibilityRole="header">
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

type FaceDef = { name: string; hue: number; x: number; y: number; size: number; live?: boolean; online?: boolean };

const FACES: FaceDef[] = [
  { name: 'Layla', hue: 12, x: 0.5, y: 0.42, size: 84, live: true },
  { name: 'Samuel', hue: 210, x: 0.22, y: 0.25, size: 62 },
  { name: 'Chloé', hue: 330, x: 0.78, y: 0.22, size: 66, online: true },
  { name: 'Arjun', hue: 40, x: 0.16, y: 0.62, size: 56, online: true },
  { name: 'Kadek', hue: 150, x: 0.83, y: 0.6, size: 58 },
  { name: 'Nadia', hue: 280, x: 0.36, y: 0.82, size: 50 },
  { name: 'Omar', hue: 95, x: 0.66, y: 0.84, size: 54, online: true },
];

/** PEOPLE: faces drift in from everywhere and gather, then breathe. */
const PeopleScene = memo(function PeopleScene({ w, h, reduced }: SceneProps) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {FACES.map((f, i) => (
        <Face key={f.name} face={f} index={i} w={w} h={h} reduced={reduced} />
      ))}
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
        <Avatar name={face.name} hue={face.hue} size={face.size} online={face.online} />
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

const PINS: { icon: IconName; label: string; x: number; y: number }[] = [
  { icon: 'coffee', label: 'Café', x: 0.26, y: 0.32 },
  { icon: 'target', label: 'Padel court', x: 0.7, y: 0.26 },
  { icon: 'martini', label: 'Rooftop', x: 0.62, y: 0.66 },
  { icon: 'palm', label: 'Beach', x: 0.22, y: 0.72 },
];

/** PLACES: the city at night, and the places where things happen drop in. */
const PlacesScene = memo(function PlacesScene({ w, h, reduced }: SceneProps) {
  const zoom = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) zoom.set(withTiming(1, { duration: 2600, easing: Easing.out(Easing.cubic) }));
  }, [reduced, zoom]);
  const mapStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1.18 - zoom.value * 0.12 }] }));
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]}>
      <Animated.View style={[StyleSheet.absoluteFill, mapStyle]}>
        <MapArt city={CITIES.dubai} mode="night" width={w} height={h} showAreas={false} />
      </Animated.View>
      <LinearGradient
        colors={['#050506', 'rgba(5,5,6,0)', 'rgba(5,5,6,0)', '#050506']}
        locations={[0, 0.2, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
      {PINS.map((p, i) => (
        <Pin key={p.label} pin={p} index={i} w={w} h={h} reduced={reduced} />
      ))}
    </View>
  );
});

function Pin({ pin, index, w, h, reduced }: { pin: (typeof PINS)[number]; index: number; w: number; h: number; reduced: boolean }) {
  const drop = useSharedValue(reduced ? 1 : 0);
  const ripple = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    drop.set(withDelay(250 + index * 260, withSpring(1, { duration: 560, dampingRatio: 0.55 })));
    ripple.set(withDelay(450 + index * 260, withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false)));
  }, [reduced, drop, ripple, index]);
  const body = useAnimatedStyle(() => ({ opacity: Math.min(1, drop.value * 1.4), transform: [{ translateY: (1 - drop.value) * -70 }, { scale: 0.7 + drop.value * 0.3 }] }));
  const ring = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - ripple.value) * Math.min(1, drop.value), transform: [{ scale: 1 + ripple.value * 1.6 }] }));
  return (
    <View style={[styles.pinBox, { left: pin.x * w - 60, top: pin.y * h - 26 }]}>
      <Animated.View style={[styles.pinRing, ring]} />
      <Animated.View style={[{ alignItems: 'center', gap: 6 }, body]}>
        <View style={styles.pin}>
          <Icon name={pin.icon} size={20} color="#050506" strokeWidth={2.1} />
        </View>
        <Glass dark level="thin" style={styles.pinLabel}>
          <Text variant="caption" color="#FFFFFF">
            {pin.label}
          </Text>
        </Glass>
      </Animated.View>
    </View>
  );
}

const ROWS: { icon: IconName; label: string }[][] = [
  [
    { icon: 'target', label: 'Padel' },
    { icon: 'coffee', label: 'Coffee' },
    { icon: 'utensils', label: 'Dinner' },
    { icon: 'palm', label: 'Beach' },
    { icon: 'dumbbell', label: 'Gym' },
  ],
  [
    { icon: 'sunrise', label: 'Brunch' },
    { icon: 'footprints', label: 'Run' },
    { icon: 'disc', label: 'Party' },
    { icon: 'laptop', label: 'Coworking' },
    { icon: 'plane', label: 'Travel' },
  ],
  [
    { icon: 'leaf', label: 'Yoga' },
    { icon: 'waves', label: 'Surf' },
    { icon: 'trophy', label: 'Football' },
    { icon: 'palette', label: 'Gallery' },
    { icon: 'music', label: 'Concert' },
  ],
];

/** ACTIVITIES: rows of things to do flow past in opposite directions. */
const ActivitiesScene = memo(function ActivitiesScene({ h, reduced }: SceneProps) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip, { justifyContent: 'center', gap: 14 }]}>
      {ROWS.map((row, i) => (
        <Marquee key={i} items={row} dir={i % 2 ? 1 : -1} speed={9000 + i * 2200} highlight={i === 1 ? 0 : -1} reduced={reduced} delay={i * 120} />
      ))}
      <View style={{ height: h * 0.05 }} />
    </View>
  );
});

function Marquee({
  items,
  dir,
  speed,
  highlight,
  reduced,
  delay,
}: {
  items: { icon: IconName; label: string }[];
  dir: 1 | -1;
  speed: number;
  highlight: number;
  reduced: boolean;
  delay: number;
}) {
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
  const chips = (copy: number) =>
    items.map((c, i) => (
      <View key={`${copy}-${c.label}`} style={[styles.chip, i === highlight ? styles.chipOn : null]}>
        <Icon name={c.icon} size={17} color={i === highlight ? '#050506' : '#FFFFFF'} strokeWidth={2} />
        <Text variant="label" color={i === highlight ? '#050506' : '#FFFFFF'} style={{ fontSize: 15 }}>
          {c.label}
        </Text>
      </View>
    ));
  return (
    <Animated.View style={[styles.marquee, style]}>
      <View style={styles.marqueeRow} onLayout={(e) => setRowW(e.nativeEvent.layout.width + 12)}>
        {chips(0)}
      </View>
      <View style={styles.marqueeRow}>{chips(1)}</View>
      <View style={styles.marqueeRow}>{chips(2)}</View>
    </Animated.View>
  );
}

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
        <Avatar name="Layla" hue={12} size={80} />
      </Animated.View>
      <Animated.View style={[styles.meetFace, { left: w / 2 - 40, top: cy - 40 }, right]}>
        <Avatar name="Samuel" hue={210} size={80} />
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

/** The promise: the wordmark lights up, dot by dot. */
const IrlyScene = memo(function IrlyScene({ h }: { h: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingBottom: h * 0.1 }]}>
      <IrlyWordmark size={72} color="#FFFFFF" animated />
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
  word: { textTransform: 'uppercase' },
  cta: { position: 'absolute', left: space.gutter, right: space.gutter },
  face: { position: 'absolute', alignItems: 'center' },
  faceRing: { borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', padding: 2, boxShadow: '0px 12px 32px rgba(0,0,0,0.6)' },
  livePill: { position: 'absolute', bottom: -8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, height: 18, borderRadius: 9, backgroundColor: '#FF453A' },
  pinBox: { position: 'absolute', width: 120, alignItems: 'center' },
  pinRing: { position: 'absolute', top: 0, width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)' },
  pin: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 8px 24px rgba(255,255,255,0.25)' },
  pinLabel: { paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center' },
  marquee: { flexDirection: 'row', gap: 12 },
  marqueeRow: { flexDirection: 'row', gap: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.16)' },
  chipOn: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  meetFace: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#FFFFFF', overflow: 'hidden', boxShadow: '0px 14px 36px rgba(0,0,0,0.6)' },
  planCard: { position: 'absolute', width: 236 },
  planGlass: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg },
  planIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  burst: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
});
