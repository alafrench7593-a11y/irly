import { Children, useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { FrameContext, useFrame } from '@/components/layout/frame';
import { gridColumns } from '@/components/layout/grid';
import { COLUMN_MAX } from '@/components/layout/responsive';
import { space } from '@/theme/tokens';

/**
 * Wide pages (tabs in WIDE_TABS): from this frame width a page lays its
 * content out in columns or grids instead of one phone column.
 */
export const WIDE_MIN = 760;

/** The widest a wide page's content grows; beyond, it stays centred. */
export const CONTENT_MAX = 1200;

/** True when the space this page is given is wide enough for columns. */
export function useWide(): boolean {
  return useFrame().width >= WIDE_MIN;
}

/** Width of a page's content for a frame width: the whole width on phones, a readable column between, capped and centred when wide. */
export function contentWidth(frameWidth: number): number {
  if (frameWidth >= WIDE_MIN) return Math.min(frameWidth, CONTENT_MAX);
  return frameWidth > COLUMN_MAX + space.gutter * 2 ? COLUMN_MAX : frameWidth;
}

/** How many columns of at least `min` points (gaps and side gutters included) fit in `width`, between 1 and `max`. */
export function columnsFor(width: number, min: number, gap = 12, max = 6): number {
  return gridColumns(width - space.gutter * 2, min, max, gap);
}

/** Width of one item in a row of `columns` (side gutters taken off). */
export function itemWidth(width: number, columns: number, gap = 12): number {
  return Math.floor((width - space.gutter * 2 - gap * (columns - 1)) / columns);
}

/**
 * The content of a page, centred: as wide as `contentWidth` says, and
 * `useFrame()` inside reports that width, so cards size themselves for it.
 * The same tree at every width (resizing never remounts what is inside).
 */
export function Content({ width, style, children }: { width?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const parent = useFrame();
  const w = width ?? contentWidth(parent.width);
  const frame = useMemo(() => ({ ...parent, width: w }), [parent, w]);
  return (
    <View style={[styles.content, { width: w }, style]}>
      <FrameContext.Provider value={frame}>{children}</FrameContext.Provider>
    </View>
  );
}

/** A column of a wide page: `useFrame()` inside reports its width. */
export function Column({ width, style, children }: { width: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const parent = useFrame();
  const frame = useMemo(() => ({ ...parent, width }), [parent, width]);
  return (
    <View style={[{ width }, style]}>
      <FrameContext.Provider value={frame}>{children}</FrameContext.Provider>
    </View>
  );
}

/**
 * Rows of `columns` equal cells inside the side gutters. One column: the
 * children one under the other, as on a phone.
 */
export function Grid({ columns, gap = 12, width, children }: { columns: number; gap?: number; width: number; children: ReactNode }) {
  const cell = itemWidth(width, columns, gap);
  const items = Children.toArray(children);
  return (
    <View style={[styles.grid, { gap }]}>
      {items.map((child, i) => (
        <View key={(child as { key?: string | null }).key ?? i} style={columns > 1 ? { width: cell } : styles.full}>
          {child}
        </View>
      ))}
    </View>
  );
}

/**
 * Cards of different heights in `columns` columns, each card in the column
 * that is shortest so far by count (a light masonry: no measuring). One
 * column: a plain list.
 */
export function Masonry({ columns, gap = 14, children }: { columns: number; gap?: number; children: ReactNode }) {
  const items = Children.toArray(children);
  if (columns <= 1) return <View style={{ gap }}>{items}</View>;
  const cols: ReactNode[][] = Array.from({ length: columns }, () => []);
  items.forEach((child, i) => cols[i % columns].push(child));
  return (
    <View style={[styles.row, { gap }]}>
      {cols.map((list, i) => (
        <View key={i} style={[styles.flex, { gap }]}>
          {list}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', maxWidth: '100%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.gutter },
  full: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1, minWidth: 0 },
});
