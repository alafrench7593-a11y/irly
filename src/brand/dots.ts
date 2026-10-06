/**
 * The IRLY dot-matrix letterforms. Every glyph sits on the same grid as the
 * halftone field, so the logo reads as dots that happen to be lit.
 * `#` is a dot, `.` is empty. Seven rows, cap height.
 */
const GLYPHS: Record<string, string[]> = {
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  L: ['#...', '#...', '#...', '#...', '#...', '#...', '####'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
};

export type Dot = { col: number; row: number; accent: boolean };
export type DotLayout = { dots: Dot[]; cols: number; rows: number; top: number };

/** The 2×2 accent: IRLY's "you are here", above and right of the last letter. */
const ACCENT: [number, number][] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

/** "IRLY" + accent. Rows run from `top` (negative: above the caps) to 6. */
export function wordmarkDots(): DotLayout {
  const dots: Dot[] = [];
  let x = 0;
  for (const ch of 'IRLY') {
    const g = GLYPHS[ch];
    g.forEach((line, row) => [...line].forEach((c, col) => c === '#' && dots.push({ col: x + col, row, accent: false })));
    x += g[0].length + 1;
  }
  ACCENT.forEach(([c, r]) => dots.push({ col: x - 0.4 + c, row: -2.2 + r, accent: true }));
  return { dots, cols: x + 1.6, rows: 7, top: -2.2 };
}

/** The app mark: a lowercase "i" whose dot is the accent. */
export function markDots(): DotLayout {
  const dots: Dot[] = [];
  for (let row = 2; row < 8; row += 1) dots.push({ col: 0, row, accent: false });
  ACCENT.forEach(([c, r]) => dots.push({ col: 1.6 + c, row: -0.4 + r, accent: true }));
  return { dots, cols: 3.6, rows: 8, top: -0.4 };
}
