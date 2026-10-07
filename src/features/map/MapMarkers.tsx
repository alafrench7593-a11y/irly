import { t as tx } from '@/i18n';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import { Avatar } from '@/components/ui/Avatar';
import { LiveDot } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { findPerson, peopleByIds } from '@/data/repo';
import { LiveRing } from '@/features/live/LiveStrip';
import { PressableScale } from '@/motion/PressableScale';
import { ease, scale as scaleTokens, spring } from '@/motion/tokens';
import { status } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { Cluster, MapMarkerData } from './markers';

/** Camera state shared by the canvas and every marker, on the UI thread. */
export type Camera = {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  zoom: SharedValue<number>;
  /** 0 = flat 2D map, 1 = tilted 3D camera. */
  tilt: SharedValue<number>;
};

export const TILT = { angle: (56 * Math.PI) / 180, perspective: 900, zoom: 1.35 } as const;

/**
 * Where a point of the map canvas lands on screen, for any camera. Same
 * maths as the canvas transform (pan, zoom, then perspective + rotateX +
 * scale around the screen centre), so markers stay glued to the map in 2D
 * and in 3D while staying upright like billboards.
 */
export function project(px: number, py: number, S: number, W: number, H: number, tx: number, ty: number, z: number, tilt: number) {
  'worklet';
  const cx = W / 2;
  const cy = H / 2;
  const sx = cx + tx + (px - S / 2) * z;
  const sy = cy + ty + (py - S / 2) * z;
  const m = 1 + (TILT.zoom - 1) * tilt;
  const a = TILT.angle * tilt;
  const dx = (sx - cx) * m;
  const dy = (sy - cy) * m;
  const yy = dy * Math.cos(a);
  const zz = dy * Math.sin(a);
  const k = TILT.perspective / Math.max(1, TILT.perspective - zz);
  return { x: cx + dx * k, y: cy + yy * k, k, behind: TILT.perspective - zz < 80 };
}

const BOX = 72;

/**
 * Positions one marker (or cluster) on screen. The outer view follows the
 * camera every frame; the inner view carries the entrance (scale 0.8 → 1,
 * fade in) and exit (scale → 0.9, fade out), so the two never fight over
 * the same transform.
 */
export const Projected = memo(function Projected({
  point,
  S,
  W,
  H,
  cam,
  index,
  selected,
  children,
}: {
  point: { x: number; y: number };
  S: number;
  W: number;
  H: number;
  cam: Camera;
  index: number;
  selected?: boolean;
  children: React.ReactNode;
}) {
  const px = point.x * S;
  const py = point.y * S;
  const style = useAnimatedStyle(() => {
    const p = project(px, py, S, W, H, cam.tx.value, cam.ty.value, cam.zoom.value, cam.tilt.value);
    // Far markers shrink a little in 3D, never below 70 %.
    const depth = Math.max(0.7, Math.min(1.15, p.k));
    return {
      opacity: p.behind ? 0 : 1,
      transform: [{ translateX: p.x - BOX / 2 }, { translateY: p.y - BOX / 2 }, { scale: depth }],
    };
  });
  return (
    <Animated.View style={[styles.box, { zIndex: selected ? 20 : 1 }, style]} pointerEvents="box-none">
      <Animated.View
        entering={ZoomIn.springify(spring.strong.duration).dampingRatio(0.75).delay(Math.min(index, 12) * 18)}
        exiting={FadeOut.duration(160)}
        style={styles.center}
        pointerEvents="box-none"
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
});

/** Selection: scale 1 → 1.12 on a micro spring, plus one halo pulse. */
function useSelection(selected: boolean) {
  const s = useSharedValue(selected ? scaleTokens.selected : 1);
  const halo = useSharedValue(0);
  useEffect(() => {
    s.set(withSpring(selected ? scaleTokens.selected : 1, spring.strong));
    if (selected) halo.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 700, easing: ease.enter })));
  }, [selected, s, halo]);
  const body = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const ring = useAnimatedStyle(() => ({
    opacity: selected ? 0.8 * (1 - halo.value) : 0,
    transform: [{ scale: 1 + halo.value * 1.3 }],
  }));
  return { body, ring };
}

export const MarkerView = memo(function MarkerView({
  m,
  selected,
  onPress,
}: {
  m: MapMarkerData;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const { body, ring } = useSelection(selected);
  const label = `${m.title}. ${m.subtitle}`;
  // IRLY Noir: markers are chips of smoked glass with white type; on the
  // light map they are white. The category colour stays on the icon.
  const skin = markerSkin(t.mode === 'night');

  let content: React.ReactNode;
  let ringShape = { width: 44, height: 44, borderRadius: 22 };
  switch (m.type) {
    case 'live': {
      const p = m.personId ? findPerson(m.personId) : undefined;
      ringShape = { width: 50, height: 50, borderRadius: 25 };
      content = (
        <LiveRing size={50}>
          <Avatar name={p?.name ?? 'You'} hue={p?.hue ?? 0} size={36} />
        </LiveRing>
      );
      break;
    }
    case 'person': {
      const p = m.personId ? findPerson(m.personId) : undefined;
      content = (
        <View style={[styles.person, { borderColor: skin.personEdge, boxShadow: `0px 4px 18px ${m.color}88` }]}>
          <Avatar name={p?.name ?? m.title} hue={p?.hue ?? 0} size={36} />
          <View style={[styles.personStatus, { backgroundColor: m.color, borderColor: t.c.bg }]} />
        </View>
      );
      break;
    }
    case 'activity':
      ringShape = { width: 64, height: 32, borderRadius: 16 };
      content = (
        <View style={[styles.pill, { backgroundColor: skin.fill, boxShadow: skin.shadow, borderColor: selected ? m.color : skin.edge }]}>
          <Icon name={m.icon} size={15} color={m.color} strokeWidth={2.1} />
          <Text variant="label" style={{ fontSize: 12.5 }}>
            {m.count ?? ''}
          </Text>
          {m.live ? (
            <View style={styles.pillLive}>
              <LiveDot size={6} color={status.live} />
            </View>
          ) : null}
        </View>
      );
      break;
    case 'event':
      ringShape = { width: 40, height: 40, borderRadius: 12 };
      content = (
        <View style={[styles.event, { backgroundColor: skin.solid, boxShadow: skin.shadow, borderColor: selected ? m.color : skin.edge, borderBottomColor: m.color }]}>
          <Text variant="caption" tone="secondary" style={{ fontSize: 8, lineHeight: 10, letterSpacing: 0.8 }}>
            {m.month}
          </Text>
          <Text variant="label" style={{ fontSize: 14, lineHeight: 15 }}>
            {m.day}
          </Text>
          {m.live ? <View style={[styles.eventLive, { backgroundColor: status.live, borderColor: t.c.bg }]} /> : null}
        </View>
      );
      break;
    case 'group': {
      const [a, b] = peopleByIds(m.goingIds ?? []);
      ringShape = { width: 58, height: 34, borderRadius: 17 };
      content = (
        <View style={[styles.group, { backgroundColor: skin.fill, boxShadow: skin.shadow, borderColor: selected ? m.color : skin.edge }]}>
          <View style={{ flexDirection: 'row' }}>
            {a ? <Avatar name={a.name} hue={a.hue} size={22} ring /> : null}
            {b ? (
              <View style={{ marginLeft: -8 }}>
                <Avatar name={b.name} hue={b.hue} size={22} ring />
              </View>
            ) : null}
          </View>
          <Text variant="caption" tone="secondary" style={{ fontSize: 10.5 }}>
            {compact(m.count ?? 0)}
          </Text>
        </View>
      );
      break;
    }
    case 'place':
      ringShape = { width: 18, height: 18, borderRadius: 9 };
      content = (
        <View style={styles.placeWrap}>
          <View style={[styles.place, { backgroundColor: m.color, borderColor: t.c.bg }]} />
          <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.placeName}>
            {m.title}
          </Text>
        </View>
      );
      break;
  }

  return (
    <PressableScale haptic={false} scaleTo={0.9} onPress={onPress} accessibilityLabel={label} hitSlop={8} style={styles.hit}>
      <Animated.View style={[styles.ring, ringShape, { borderColor: m.color }, ring]} pointerEvents="none" />
      <Animated.View style={body}>{content}</Animated.View>
    </PressableScale>
  );
});

function markerSkin(night: boolean) {
  return night
    ? {
        fill: 'rgba(22,24,28,0.92)',
        solid: '#16181C',
        edge: 'rgba(255,255,255,0.14)',
        personEdge: 'rgba(255,255,255,0.9)',
        shadow: '0px 8px 20px rgba(0,0,0,0.55)',
      }
    : {
        fill: 'rgba(255,255,255,0.94)',
        solid: '#FFFFFF',
        edge: 'rgba(10,10,10,0.08)',
        personEdge: '#FFFFFF',
        shadow: '0px 6px 16px rgba(10,10,10,0.12)',
      };
}

function compact(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

/** Cluster bubble: total count, ring cut by the categories inside. */
export const ClusterView = memo(function ClusterView({ c, onPress }: { c: Cluster; onPress: () => void }) {
  const t = useTheme();
  const skin = markerSkin(t.mode === 'night');
  const n = c.members.length;
  const size = Math.min(64, 44 + Math.log2(n) * 5);
  const colors = c.colors.length ? c.colors : ['#FFFFFF'];
  const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;
  const border: Record<string, string> = {};
  sides.forEach((side, i) => {
    border[`border${side}Color`] = colors[i % colors.length];
  });
  return (
    <PressableScale haptic="tap" scaleTo={0.9} onPress={onPress} accessibilityLabel={tx('{n} places here. Zoom in', { n })} hitSlop={6}>
      <View style={[styles.cluster, { width: size, height: size, borderRadius: size / 2, backgroundColor: skin.fill, boxShadow: skin.shadow }, border]}>
        <Text variant="label" style={{ fontSize: n > 99 ? 12 : 14 }}>
          {n}
        </Text>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  box: { position: 'absolute', left: 0, top: 0, width: BOX, height: BOX },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hit: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
  person: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  personStatus: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  pill: {
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
  },
  pillLive: { position: 'absolute', top: -3, right: -3 },
  event: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderBottomWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventLive: { position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  group: {
    height: 34,
    paddingLeft: 5,
    paddingRight: 9,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
  },
  placeWrap: { alignItems: 'center', gap: 3 },
  place: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  placeName: { fontSize: 10, maxWidth: 90 },
  cluster: { borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
