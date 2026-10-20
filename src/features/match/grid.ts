/**
 * Match grids (IRLY Girl Match, Match IRLY): profiles side by side when the
 * screen has room. One column under 360 pt (small phones: a card stays
 * readable), two on phones, then as many 220 pt cards as fit on a tablet
 * (four at most).
 */
export const GRID_GAP = 12;
const MIN_TILE = 220;

export function gridColumns(width: number): number {
  if (width < 360) return 1;
  if (width < 600) return 2;
  return Math.max(2, Math.min(4, Math.floor((width + GRID_GAP) / (MIN_TILE + GRID_GAP))));
}

/** Width of one card for the space available (inside the page gutters). */
export function tileWidth(inner: number, columns: number): number {
  return Math.floor((inner - GRID_GAP * (columns - 1)) / columns);
}
