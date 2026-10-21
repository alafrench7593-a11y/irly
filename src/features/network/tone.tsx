import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { NetworkScope } from '@/theme/flavor';
import { networkGirl } from '@/theme/tokens';
import { useTheme, type Theme } from '@/theme/useTheme';

/**
 * The identity of IRLY Network, one architecture for both experiences:
 * - IRLY Girl: violet glass. Electric violet for accents, selected states
 *   and the match, deep plum-violet for the contrast panels, a violet light
 *   on the panes.
 * - IRLY (Mixte): grey glass. Ink (white on IRLY Noir, black on Clair) for
 *   accents, cool steel-grey light, nothing coloured but the photos.
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
  isGirl: boolean;
};

export function networkTone(t: Theme): NetworkTone {
  if (t.flavor === 'girl') {
    return {
      accent: t.c.brand,
      onAccent: '#FFFFFF',
      soft: 'rgba(106,59,238,0.09)',
      softLine: 'rgba(106,59,238,0.22)',
      gradient: networkGirl.gradient,
      glow: networkGirl.glow,
      panel: networkGirl.plumGradient,
      onPanel: networkGirl.pearl,
      light: ['rgba(124,77,255,0.14)', 'rgba(124,77,255,0)'],
      isGirl: true,
    };
  }
  const night = t.mode === 'night';
  return {
    accent: t.c.text,
    onAccent: t.c.bg,
    soft: night ? 'rgba(255,255,255,0.07)' : 'rgba(10,10,10,0.05)',
    softLine: night ? 'rgba(255,255,255,0.14)' : 'rgba(10,10,10,0.10)',
    gradient: night ? ['#FFFFFF', '#DADDE2'] : ['#2B2D31', '#0A0A0A'],
    glow: t.shadow.glow,
    panel: night ? ['#F4F5F7', '#D8DBE0'] : ['#26282C', '#0A0A0A'],
    onPanel: t.c.bg,
    light: night ? ['rgba(180,190,204,0.10)', 'rgba(180,190,204,0)'] : ['rgba(120,130,146,0.08)', 'rgba(120,130,146,0)'],
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
 * catches a touch. Drop it right after the pane's GlassLayer.
 */
export const PaneLight = memo(function PaneLight({ radius }: { radius: number }) {
  const tone = useNetworkTone();
  return <LinearGradient pointerEvents="none" colors={tone.light} start={{ x: 0, y: 0 }} end={{ x: 0.75, y: 0.9 }} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />;
});

/** A Network page: violet in IRLY Girl, grey in IRLY (theme, glass and light, see NetworkScope). */
export function NetworkScreen({ children }: { children: ReactNode }) {
  return <NetworkScope>{children}</NetworkScope>;
}

const styles = StyleSheet.create({
  under: { zIndex: -1 },
});
