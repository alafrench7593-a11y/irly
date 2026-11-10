/**
 * The Ludo board drawn on a 15 × 15 grid, matching the server's rules
 * (supabase/migrations/20261111000000_irly_games.sql): square 0 is red's
 * start, the track runs clockwise, each colour starts 13 squares after the
 * previous one. A token's progress: -1 yard, 0..50 track, 51..55 home
 * column, 56 home.
 */

export type Cell = { x: number; y: number };

/** Red, green, yellow, blue: the colour index the server gives each player. */
export const LUDO_COLORS = ['#E5484D', '#30A46C', '#F2B705', '#0A84FF'] as const;
export const LUDO_COLOR_NAMES = ['Red', 'Green', 'Yellow', 'Blue'] as const;

/** The 52 squares of the shared track, from red's start, clockwise. */
export const TRACK: Cell[] = (() => {
  const out: Cell[] = [];
  const run = (from: Cell, dx: number, dy: number, n: number) => {
    for (let i = 0; i < n; i++) out.push({ x: from.x + dx * i, y: from.y + dy * i });
  };
  run({ x: 1, y: 6 }, 1, 0, 5);
  run({ x: 6, y: 5 }, 0, -1, 6);
  out.push({ x: 7, y: 0 }, { x: 8, y: 0 });
  run({ x: 8, y: 1 }, 0, 1, 5);
  run({ x: 9, y: 6 }, 1, 0, 6);
  out.push({ x: 14, y: 7 }, { x: 14, y: 8 });
  run({ x: 13, y: 8 }, -1, 0, 5);
  run({ x: 8, y: 9 }, 0, 1, 6);
  out.push({ x: 7, y: 14 }, { x: 6, y: 14 });
  run({ x: 6, y: 13 }, 0, -1, 5);
  run({ x: 5, y: 8 }, -1, 0, 6);
  out.push({ x: 0, y: 7 }, { x: 0, y: 6 });
  return out;
})();

/** Start squares and stars: no capture there. */
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** Each colour's home column (progress 51..55), towards the centre. */
const HOME_COLUMN: Cell[][] = [
  [1, 2, 3, 4, 5].map((x) => ({ x, y: 7 })),
  [1, 2, 3, 4, 5].map((y) => ({ x: 7, y })),
  [13, 12, 11, 10, 9].map((x) => ({ x, y: 7 })),
  [13, 12, 11, 10, 9].map((y) => ({ x: 7, y })),
];

/** The yard of each colour: its corner, and four token spots. */
export const YARD_ORIGIN: Cell[] = [
  { x: 0, y: 0 },
  { x: 9, y: 0 },
  { x: 9, y: 9 },
  { x: 0, y: 9 },
];
const YARD_SPOTS: Cell[] = [
  { x: 1.5, y: 1.5 },
  { x: 3.5, y: 1.5 },
  { x: 1.5, y: 3.5 },
  { x: 3.5, y: 3.5 },
];

/** Where a token stands (cell coordinates of its centre, in grid units). */
export function tokenCell(color: number, progress: number, token: number): { x: number; y: number } {
  if (progress < 0) {
    const o = YARD_ORIGIN[color];
    const s = YARD_SPOTS[token];
    return { x: o.x + s.x + 0.5, y: o.y + s.y + 0.5 };
  }
  if (progress <= 50) {
    const c = TRACK[(color * 13 + progress) % 52];
    return { x: c.x + 0.5, y: c.y + 0.5 };
  }
  if (progress <= 55) {
    const c = HOME_COLUMN[color][progress - 51];
    return { x: c.x + 0.5, y: c.y + 0.5 };
  }
  // Home: around the centre, one corner of it per colour.
  const corner = [
    { x: -0.45, y: 0 },
    { x: 0, y: -0.45 },
    { x: 0.45, y: 0 },
    { x: 0, y: 0.45 },
  ][color];
  return { x: 7.5 + corner.x, y: 7.5 + corner.y };
}

export function homeColumnCells(color: number): Cell[] {
  return HOME_COLUMN[color];
}

/** The tokens a player may move with this die (the server's rule, to highlight them). */
export function legalTokens(tokens: number[], die: number): number[] {
  const out: number[] = [];
  tokens.forEach((p, k) => {
    if (p === -1 ? die === 6 : p < 56 && p + die <= 56) out.push(k);
  });
  return out;
}
