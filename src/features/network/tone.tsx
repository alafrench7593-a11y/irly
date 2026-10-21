import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { NetworkScope } from '@/theme/flavor';
import { networkGirl, networkSurface, type NetworkSurface } from '@/theme/tokens';
import { useTheme, type Theme } from '@/theme/useTheme';

/**
 * The identity of IRLY Network, one architecture for both experiences:
 * - IRLY Girl: violet glass. Electric violet for accents, selected states
 *   and the match, deep plum-violet for the contrast panels, a violet light
 *   on the panes, lavender glass.
 * - IRLY (Mixte): silver glass. Ink (white on IRLY Noir, black on Clair) for
 *   accents, anthracite or off-white panes with a cool silver rim, nothing
 *   coloured but the photos.
 * Every Network surface reads its accents from here, so the whole page
 * (cards, badges, icons, loaders, selections) follows the experience.
 */
export type NetworkTone = {
  /** Accent for icons, links, selected fills and badges. */
  accent: string;
  /** Text and icons laid on `accent`. */
  onAccent: string;
  /** A quiet fill of the accent (icon wells, the "why" box, shared tags). */
  soft: string;
  /** Border of soft accent fills. */
  softLine: string;
  /** Gradient of the match pill and the Network mark. */
  gradient: readonly [string, string, ...string[]];
  /** Glow under the accent gradient. */
  glow: string;
  /** The deep contrast panel (why you should meet). */
  panel: readonly [string, string, ...string[]];
  /** Text on `panel`. */
  onPanel: string;
  /** Light pooled in the corner of a pane (decorative). */
  light: readonly [string, string];
  /** Panes, depth, drifting light, portraits and loaders (see networkSurface). */
  surface: NetworkSurface;
  isGirl: boolean;
};

export function networkTone(t: Theme): NetworkTone {
  if (t.flavor === 'girl') {
    return {
      accent: t.c.brand,
      onAccent: '#FFFFFF',
      soft: 'rgba(106,59,238,0.08)',
      softLine: 'rgba(106,59,238,0.20)',
      gradient: networkGirl.gradient,
      glow: networkGirl.glow,
      panel: networkGirl.plumGradient,
      onPanel: networkGirl.pearl,
      light: ['rgba(124,77,255,0.13)', 'rgba(124,77,255,0)'],
      surface: networkSurface.girl,
      isGirl: true,
    };
  }
  const night = t.mode === 'night';
  return {
    accent: t.c.text,
    onAccent: t.c.bg,
    soft: night ? 'rgba(255,255,255,0.07)' : 'rgba(10,10,10,0.045)',
    softLine: night ? 'rgba(255,255,255,0.14)' : 'rgba(10,10,10,0.10)',
    // Silver: a brushed white to steel on IRLY Noir, graphite to ink on Clair.
    gradient: night ? ['#FFFFFF', '#E3E6EB', '#C9CED6'] : ['#3A3D43', '#1C1E22', '#0A0A0A'],
    glow: night ? '0px 10px 28px rgba(214,222,234,0.18)' : '0px 10px 26px rgba(10,10,10,0.20)',
    panel: night ? ['#F4F5F7', '#DCDFE4', '#C6CBD2'] : ['#2E3136', '#1A1C20', '#0A0A0A'],
    onPanel: t.c.bg,
    light: night ? ['rgba(186,198,216,0.11)', 'rgba(186,198,216,0)'] : ['rgba(120,130,146,0.09)', 'rgba(120,130,146,0)'],
    surface: networkSurface.mixte[t.mode],
    isGirl: false,
  };
}

export function useNetworkTone(): NetworkTone {
  const t = useTheme();
  return useMemo(() => networkTone(t), [t]);
}

/**
 * A gradient laid under a surface's content (the match pill, the Network
 * mark, the contrast panels). The surface needs `zIndex: 0` (see
 * `layered`): the fill sits at -1 inside it, so icons drawn after it (SVG
 * on web) are never painted underneath.
 */
export const AccentFill = memo(function AccentFill({ colors, radius }: { colors: readonly [string, string, ...string[]]; radius?: number }) {
  return <LinearGradient pointerEvents="none" colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.under, radius != null ? { borderRadius: radius } : null]} />;
});

/** The stacking context an AccentFill needs on its surface. */
export const layered = { zIndex: 0 } as const;

/**
 * The light of a Network pane: a soft glow pooled in its top-left corner
 * (violet in IRLY Girl, steel grey in IRLY). Static, decorative, never
 * catches a touch. Drop it right after the pane's background.
 */
export const PaneLight = memo(function PaneLight({ radius }: { radius: number }) {
  const tone = useNetworkTone();
  return <LinearGradient pointerEvents="none" colors={tone.light} start={{ x: 0, y: 0 }} end={{ x: 0.75, y: 0.9 }} style={[StyleSheet.absoluteFill, styles.under, { borderRadius: radius }]} />;
});

/**
 * A pane of Network glass, faked: a translucent fill, a sheen across the
 * top, a thin rim lit from above and the corner light. No live blur, so a
 * list of fifty cards costs what one costs. With `press` (0 → 1, driven by
 * the card's touch) a soft light blooms on the pane while it is held.
 * Drop it as the first child of a surface with `overflow: 'hidden'`.
 */
export const NetworkPane = memo(function NetworkPane({ radius, press, light = true }: { radius: number; press?: SharedValue<number>; light?: boolean }) {
  const tone = useNetworkTone();
  const s = tone.surface;
  return (
    <>
      <LinearGradient pointerEvents="none" colors={s.pane} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFill, styles.under, { borderRadius: radius }]} />
      <LinearGradient pointerEvents="none" colors={[s.sheen, 'rgba(255,255,255,0)']} locations={[0, 0.5]} style={[StyleSheet.absoluteFill, styles.under, { borderRadius: radius }]} />
      {light ? <LinearGradient pointerEvents="none" colors={tone.light} start={{ x: 0, y: 0 }} end={{ x: 0.75, y: 0.9 }} style={[StyleSheet.absoluteFill, styles.under, { borderRadius: radius }]} /> : null}
      {press ? <PressBloom radius={radius} press={press} color={s.press} /> : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim, { borderRadius: radius, borderColor: s.rim, borderTopColor: s.rimTop }]} />
    </>
  );
});

function PressBloom({ radius, press, color }: { radius: number; press: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({ opacity: press.value }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.under, { borderRadius: radius }, style]}>
      <LinearGradient colors={[color, 'rgba(255,255,255,0)']} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />
    </Animated.View>
  );
}

/** A Network page: violet in IRLY Girl, silver in IRLY (theme, glass and light, see NetworkScope). */
export function NetworkScreen({ children }: { children: ReactNode }) {
  return <NetworkScope>{children}</NetworkScope>;
}

const styles = StyleSheet.create({
  under: { zIndex: -1 },
  rim: { borderWidth: StyleSheet.hairlineWidth * 2, zIndex: 1 },
});
