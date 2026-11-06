import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useFrame } from '@/components/layout/frame';
import { COLUMN_MAX } from '@/components/layout/responsive';
import { space } from '@/theme/tokens';

/** From this page width a profile sits in two columns (who they are | what they do). */
export const PROFILE_SPLIT = 760;
/** The whole two-column block never grows past this, centred: lines stay readable on a wide window. */
export const PROFILE_MAX = 1040;

/** True when the profile shown in this page's width uses two columns. */
export function useProfileSplit(): boolean {
  return useFrame().width >= PROFILE_SPLIT;
}

/** Width of the left column (photo, name, actions) for this page width. */
export function profileSideWidth(frameWidth: number): number {
  return frameWidth >= 1000 ? 360 : 320;
}

/**
 * The body of a profile, under its cover. Narrow: `side` then `main`, one
 * column, as on a phone (capped to a readable column past 640 pt). Wide
 * (page of 760 pt and more): `side` on the left (photo, name, the actions)
 * and `main` on the right (interests, plans, communities, posts), the block
 * centred and capped at 1040 pt.
 *
 * The left column follows the scroll like a sticky header: it stays in view
 * while the right one scrolls, and, when it is taller than the screen,
 * scrolls first until its end shows. Driven by the page's `scrollY` (UI
 * thread), the same on iOS, Android and the web.
 *
 * The tree is the same in both layouts (only styles change): folding or
 * resizing keeps the scroll, the open tab and anything typed.
 *
 * Must be a direct child of the scroll content (its own position is the
 * offset the sticky column starts from).
 */
export function ProfileColumns({
  scrollY,
  side,
  main,
  top,
  bottom = 0,
  lift = 0,
}: {
  scrollY: SharedValue<number>;
  side: ReactNode;
  main: ReactNode;
  /** Space kept clear at the top of the screen (header, safe area) when the left column sticks. */
  top: number;
  /** Space kept clear at the bottom of the screen (tab bar, floating action). */
  bottom?: number;
  /** How far the left column's content rises over the cover (its negative top margin). */
  lift?: number;
}) {
  const frame = useFrame();
  const wide = frame.width >= PROFILE_SPLIT;
  const sideWidth = profileSideWidth(frame.width);
  const viewport = frame.height;
  const rowY = useSharedValue(0);
  const rowH = useSharedValue(0);
  const sideH = useSharedValue(0);
  const sticky = useAnimatedStyle(() => {
    if (!wide) return { transform: [{ translateY: 0 }] };
    // Sticks once its top reaches `top`; a column taller than the screen first scrolls until its end shows.
    const start = Math.max(rowY.value - lift - top, rowY.value + sideH.value - viewport + bottom);
    const room = Math.max(0, rowH.value - sideH.value);
    return { transform: [{ translateY: Math.min(room, Math.max(0, scrollY.value - start)) }] };
  });
  return (
    <View
      style={[styles.row, wide ? styles.wide : styles.narrow]}
      onLayout={(e) => {
        rowY.set(e.nativeEvent.layout.y);
        rowH.set(e.nativeEvent.layout.height);
      }}
    >
      <Animated.View style={[wide ? { width: sideWidth } : null, styles.side, sticky]} onLayout={(e) => sideH.set(e.nativeEvent.layout.height)}>
        {side}
      </Animated.View>
      <View style={wide ? styles.mainWide : null}>{main}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', alignSelf: 'center' },
  narrow: { maxWidth: COLUMN_MAX },
  wide: { maxWidth: PROFILE_MAX, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: space[3] },
  side: { zIndex: 1 },
  mainWide: { flex: 1, minWidth: 0, paddingTop: space[6] },
});
