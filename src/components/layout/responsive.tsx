import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { FrameContext, useFrame } from '@/components/layout/frame';
import { useTheme } from '@/theme/useTheme';
import { AmbientBackdrop } from '@/components/layout/AmbientBackdrop';

/**
 * Size classes for the whole app, picked from the width IRLY really has,
 * never from a device name: the same rules serve a small iPhone, a Pro Max,
 * the narrow outer screen of a folding phone, its wide inner screen, a
 * tablet browser or a resized window.
 *
 * - `compact`: under 360 pt (narrow outer screens, small phones). Phone
 *   layout, tighter sides.
 * - `regular`: 360 to 699 pt. Every iPhone in portrait today.
 * - `expanded`: 700 pt and more. Side rail instead of the floating bar,
 *   two panes where a list and its detail fit side by side.
 */
export type SizeClass = 'compact' | 'regular' | 'expanded';

export const BREAKPOINTS = { regular: 360, expanded: 700 } as const;

/** Readable width of a single-column page on a wide screen. */
export const COLUMN_MAX = 640;

/** Width of the side rail (expanded) and the space it takes from the page, rail margins included. */
export const RAIL_WIDTH = 76;
export const RAIL_SPACE = RAIL_WIDTH + 24;

/**
 * Routes of the root stack that draw their own wide layout (two panes, a
 * grid, a rail). Every other page keeps a readable column on wide screens.
 */
export const WIDE_ROUTES = new Set<string>([
  '(tabs)',
  'index',
  // Profiles: two columns from 760 pt (components/layout/ProfileColumns).
  'person/[id]',
  'network/[id]',
  // Activities: list and detail side by side (components/layout/SplitView).
  'activities/index',
  'activities/[kind]',
]);

/** Tabs that draw their own wide layout (same rule, inside the tabs). */
export const WIDE_TABS = new Set<string>(['map', 'messages', 'profile']);

/** Width of the list pane in a list + detail screen. */
export const LIST_PANE = 360;

export function sizeClassFor(width: number): SizeClass {
  if (width >= BREAKPOINTS.expanded) return 'expanded';
  if (width >= BREAKPOINTS.regular) return 'regular';
  return 'compact';
}

export type Layout = {
  /** Window of the app (or of the framed phone on desktop web). */
  windowWidth: number;
  windowHeight: number;
  sizeClass: SizeClass;
  landscape: boolean;
  /** Expanded: navigation moves to a rail on the left. */
  rail: boolean;
};

export const LayoutContext = createContext<Layout>({
  windowWidth: 390,
  windowHeight: 844,
  sizeClass: 'regular',
  landscape: false,
  rail: false,
});

/** Size class and window of the app. Updates live when the window changes (fold, rotate, resize). */
export function useLayout(): Layout {
  return useContext(LayoutContext);
}

/** True when a list and its detail should sit side by side in the width this screen has. */
export function useSplit(): boolean {
  const frame = useFrame();
  return frame.width >= LIST_PANE + 380;
}

/**
 * The space a page is given. On narrow screens it is the whole width. On
 * wide screens a page that has no wide layout keeps a readable column in
 * the middle (and `useFrame()` inside reports that column's width, so
 * cards are sized for it); a page with a wide layout (`wide`) gets all of it.
 *
 * The tree is the same in every size: unfolding, folding or resizing never
 * remounts the page, so scroll, drafts and navigation stay where they were.
 */
export function ScreenColumn({ wide = false, inset = 0, children }: { wide?: boolean; inset?: number; children: ReactNode }) {
  const parent = useFrame();
  const { sizeClass } = useLayout();
  const available = Math.max(0, parent.width - inset);
  const capped = !wide && sizeClass === 'expanded';
  const width = capped ? Math.min(available, COLUMN_MAX) : available;
  const frame = useMemo(() => ({ ...parent, width }), [parent, width]);
  const t = useTheme();
  const night = t.mode === 'night';
  // The backdrop slot is always there (null when unused): the page keeps its place in the tree.
  return (
    <View style={styles.outer}>
      {capped ? <AmbientBackdrop /> : null}
      <View
        style={[
          styles.inner,
          { width: capped ? width : '100%' },
          capped && {
            backgroundColor: t.c.bg,
            borderLeftWidth: StyleSheet.hairlineWidth * 2,
            borderRightWidth: StyleSheet.hairlineWidth * 2,
            borderColor: night ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,10,0.08)',
            boxShadow: night ? '0px 30px 90px rgba(0,0,0,0.7)' : '0px 30px 80px rgba(10,10,10,0.18)',
          },
        ]}
      >
        <FrameContext.Provider value={frame}>{children}</FrameContext.Provider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  inner: { flex: 1, maxWidth: '100%', overflow: 'hidden' },
});
