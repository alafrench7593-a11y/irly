import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ConnectButton } from '@/components/cards/PeopleCards';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { JoinButton } from '@/components/ui/JoinButton';
import { Text } from '@/components/ui/Text';
import { findPerson, peopleByIds } from '@/data/repo';
import { openHero } from '@/features/hero/heroStore';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { blur, ease, motion, spring } from '@/motion/tokens';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { MapMarkerData } from './markers';

export type Snap = 'collapsed' | 'half' | 'expanded';

const PEEK = 136;

/**
 * The map's bottom sheet: three snap points (peek 136 px, half, nearly
 * full). It follows the finger exactly while dragged, then lands on the
 * snap the gesture is heading to, using the release velocity, on
 * `spring.medium`. Pulled past the top it resists; flicked down from the
 * peek it closes. The map above stays live and keeps reacting.
 */
export function MapSheet({
  marker,
  height,
  bottom,
  top,
  snap,
  onSnap,
  onClose,
}: {
  marker: MapMarkerData;
  /** Height of the area the sheet lives in (screen minus the tab bar). */
  height: number;
  bottom: number;
  top: number;
  snap: Snap;
  onSnap: (s: Snap) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  // translateY of the sheet from the top of its area, for each snap.
  const Y = useMemo(
    () => ({ collapsed: height - PEEK, half: Math.round(height * 0.48), expanded: top }),
    [height, top],
  );
  const y = useSharedValue(height);
  const startY = useSharedValue(0);

  useEffect(() => {
    y.set(withSpring(Y[snap], spring.medium));
  }, [snap, Y, y]);

  const settle = (s: Snap) => {
    haptic('select');
    onSnap(s);
  };

  const close = () => {
    y.set(withTiming(height + 20, { duration: motion.normal, easing: ease.exit }, (fin) => {
      if (fin) scheduleOnRN(onClose);
    }));
  };

  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onStart(() => {
      startY.set(y.get());
    })
    .onChange((e) => {
      const next = startY.get() + e.translationY;
      // Controlled overscroll above the top snap.
      y.set(next < Y.expanded ? Y.expanded - (Y.expanded - next) * 0.25 : next);
    })
    .onEnd((e) => {
      const projected = y.get() + e.velocityY * 0.18;
      if (projected > Y.collapsed + 70) {
        scheduleOnRN(close);
        return;
      }
      const options: [Snap, number][] = [
        ['collapsed', Y.collapsed],
        ['half', Y.half],
        ['expanded', Y.expanded],
      ];
      let best = options[0];
      for (const o of options) if (Math.abs(o[1] - projected) < Math.abs(best[1] - projected)) best = o;
      y.set(withSpring(best[1], { ...spring.medium, velocity: e.velocityY }));
      scheduleOnRN(settle, best[0]);
    });

  const tap = Gesture.Tap().onEnd(() => {
    scheduleOnRN(settle, snap === 'collapsed' ? 'half' : snap === 'half' ? 'expanded' : 'half');
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const halfStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [Y.collapsed - 10, Y.half + 40], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [Y.collapsed, Y.half], [16, 0], Extrapolation.CLAMP) }],
  }));
  const fullStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [Y.half - 10, Y.expanded + 60], [0, 1], Extrapolation.CLAMP),
  }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [Y.half, Y.collapsed], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { bottom, zIndex: 8 }]} pointerEvents="box-none">
      <Animated.View style={[styles.sheet, { height: height - top + 40 }, sheetStyle]}>
        <Glass style={[StyleSheet.absoluteFill, styles.glass]} intensity={blur.strong} />
        <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
          <View style={styles.header} accessibilityRole="adjustable" accessibilityLabel="Details. Drag up for more">
            <View style={[styles.grabber, { backgroundColor: 'rgba(10,10,10,0.18)' }]} />
            <View style={styles.titleRow}>
              <Lead marker={marker} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text variant="overline" color={marker.color}>
                  {label(marker)}
                  {marker.live ? ' · Live' : ''}
                </Text>
                <Text variant="titleM" numberOfLines={1}>
                  {marker.title}
                </Text>
                <Text variant="bodyS" tone="secondary" numberOfLines={1}>
                  {marker.subtitle}
                </Text>
              </View>
              <IconButton icon="x" label="Close" size={34} variant="plain" onPress={close} />
            </View>
            <Animated.View style={[styles.hint, hintStyle]} pointerEvents="none">
              <Icon name="chevronUp" size={14} color={t.c.textTertiary} />
              <Text variant="caption" tone="tertiary">
                Swipe up
              </Text>
            </Animated.View>
          </View>
        </GestureDetector>

        <ScrollView scrollEnabled={snap === 'expanded'} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          <Animated.View style={[styles.body, halfStyle]}>
            <HalfContent marker={marker} />
          </Animated.View>
          <Animated.View style={[styles.body, fullStyle]}>
            <FullContent marker={marker} />
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function label(m: MapMarkerData) {
  switch (m.type) {
    case 'person':
      return m.color === '#32D74B' ? 'Available now' : 'Available later';
    case 'activity':
      return 'Activity';
    case 'event':
      return 'Event';
    case 'group':
      return 'Group';
    case 'place':
      return 'Place';
    case 'live':
      return 'IRL';
  }
}

function Lead({ marker }: { marker: MapMarkerData }) {
  const t = useTheme();
  const p = marker.personId ? findPerson(marker.personId) : undefined;
  if (p) return <Avatar name={p.name} hue={p.hue} size={48} verified={p.verified} online={p.online} />;
  return (
    <View style={[styles.lead, { backgroundColor: t.c.overlay }]}>
      <Icon name={marker.icon} size={22} color={marker.color} />
    </View>
  );
}

function HalfContent({ marker }: { marker: MapMarkerData }) {
  const router = useRouter();
  const joined = useStore((s) => Boolean(s.joined[marker.id]));
  const me = useStore((s) => s.profile.name) || 'You';
  const going = peopleByIds(marker.goingIds ?? []).slice(0, 4);
  const person = marker.personId ? findPerson(marker.personId) : undefined;
  if (person) {
    return (
      <View style={{ gap: space[5] }}>
        <Text variant="body" tone="secondary" numberOfLines={3}>
          {person.bio}
        </Text>
        <View style={styles.actions}>
          <Button label="Profile" variant="secondary" size="md" onPress={() => router.push(`/person/${person.id}`)} />
          <View style={{ flex: 1 }}>
            <ConnectButton person={person} size="md" full />
          </View>
        </View>
      </View>
    );
  }
  const more = Math.max(0, (marker.count ?? 0) - going.length);
  return (
    <View style={{ gap: space[5] }}>
      {going.length ? (
        <View style={styles.people}>
          {joined ? <PersonDot name={me} hue={0} label="You" /> : null}
          {going.map((p) => (
            <PersonDot key={p.id} name={p.name} hue={p.hue} label={p.name.split(' ')[0]} onPress={() => router.push(`/person/${p.id}`)} />
          ))}
          {more > 0 ? <PersonDot name={`+${more}`} hue={0} label="more" plus /> : null}
        </View>
      ) : null}
      {marker.body ? (
        <Text variant="body" tone="secondary" numberOfLines={3}>
          {marker.body}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {marker.type === 'activity' || marker.type === 'event' ? (
          <JoinButton id={marker.id} full style={{ flex: 1 }} />
        ) : marker.type === 'group' ? (
          <JoinButton id={marker.id} membership label="JOIN GROUP" full style={{ flex: 1 }} />
        ) : marker.hero ? (
          <Button label="Open" iconRight="arrowUpRight" size="lg" full onPress={() => marker.hero && openHero(marker.hero)} />
        ) : null}
      </View>
    </View>
  );
}

function PersonDot({ name, hue, label: text, onPress, plus }: { name: string; hue: number; label: string; onPress?: () => void; plus?: boolean }) {
  const t = useTheme();
  const inner = plus ? (
    <View style={[styles.plus, { backgroundColor: t.c.brand }]}>
      <Text variant="label" color={t.c.onBrand}>
        {name}
      </Text>
    </View>
  ) : (
    <Avatar name={name} hue={hue} size={48} />
  );
  return (
    <View style={styles.personDot}>
      {onPress ? (
        <PressableScale onPress={onPress} scaleTo={0.92} haptic="select" accessibilityLabel={`Open ${text}'s profile`}>
          {inner}
        </PressableScale>
      ) : (
        inner
      )}
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function FullContent({ marker }: { marker: MapMarkerData }) {
  const t = useTheme();
  const router = useRouter();
  if (!marker.hero || marker.type === 'person') return null;
  const hero = marker.hero;
  const going = peopleByIds(marker.goingIds ?? []);
  return (
    <View style={{ gap: space[5], marginTop: space[6] }}>
      {going.length ? (
        <View style={{ gap: space[3] }}>
          <Text variant="titleS">{marker.type === 'group' ? 'Members' : "Who's going"}</Text>
          {going.slice(0, 6).map((p) => (
            <PressableScale key={p.id} haptic="select" scaleTo={0.98} onPress={() => router.push(`/person/${p.id}`)} style={styles.personRow}>
              <Avatar name={p.name} hue={p.hue} size={40} online={p.online} />
              <View style={{ flex: 1 }}>
                <Text variant="label" raw>{p.name}</Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {p.headline}
                </Text>
              </View>
              <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
            </PressableScale>
          ))}
        </View>
      ) : null}
      <View style={[styles.detail, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
        <Row icon="pin" text={marker.subtitle} />
        {marker.type === 'activity' || marker.type === 'event' ? <Row icon="message" text="Group chat opens when you join" /> : null}
        {marker.type === 'group' ? <Row icon="users" text={`${marker.count ?? 0} members`} /> : null}
      </View>
      <Button label="Open full page" variant="secondary" iconRight="arrowUpRight" full onPress={() => openHero(hero)} />
    </View>
  );
}

function Row({ icon, text }: { icon: 'pin' | 'message' | 'users'; text: string }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={16} color={t.c.textSecondary} />
      <Text variant="bodyS" tone="secondary" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, top: 0 },
  glass: { borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl },
  header: { paddingTop: 8, paddingHorizontal: space.gutter, paddingBottom: 10 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 10 },
  lead: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.gutter },
  people: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  personDot: { alignItems: 'center', gap: 4, width: 56 },
  plus: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  detail: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
});
