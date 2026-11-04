import { StyleSheet } from 'react-native';

/**
 * A grid sized from the width it is given, never from a device: as many
 * columns as fit cards of at least `min` pt (at most `max`), all the same
 * width. One column when even one card does not fit twice.
 */
export function gridColumns(width: number, min: number, max = 3, gap = 12): number {
  const fit = Math.floor((width + gap) / (min + gap));
  return Math.max(1, Math.min(max, fit));
}

/** Width of one cell of that grid (whole points, so a row never wraps on a rounding). */
export function gridCell(width: number, min: number, max = 3, gap = 12): number {
  const cols = gridColumns(width, min, max, gap);
  return Math.floor((width - gap * (cols - 1)) / cols);
}

export const gridStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
