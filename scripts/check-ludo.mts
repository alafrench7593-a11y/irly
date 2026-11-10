// The Ludo board drawn by the app (src/features/games/ludo/geometry.ts) matches
// the server's rules (supabase/migrations/20261111000000_irly_games.sql):
// 52 distinct track squares in a closed loop, each colour's start 13 squares
// apart, its last track square next to its home column, which leads to the centre.
import { homeColumnCells, legalTokens, SAFE, TRACK, tokenCell } from '../src/features/games/ludo/geometry.ts';

let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'ok ' : 'FAIL'} ${what}`);
  if (!ok) failed += 1;
};
const adj = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1 || (Math.abs(a.x - b.x) === 1 && Math.abs(a.y - b.y) === 1);

check(TRACK.length === 52, '52 track squares');
check(new Set(TRACK.map((c) => `${c.x},${c.y}`)).size === 52, 'every track square is a different cell');
check(TRACK.every((c, i) => adj(c, TRACK[(i + 1) % 52])), 'the track is one closed loop of neighbouring cells');
check(TRACK.every((c) => c.x >= 0 && c.x < 15 && c.y >= 0 && c.y < 15 && (c.x >= 6 && c.x <= 8 || c.y >= 6 && c.y <= 8)), 'the track stays on the cross, inside the 15 × 15 board');
const starts = [0, 1, 2, 3].map((k) => TRACK[k * 13]);
check(JSON.stringify(starts) === JSON.stringify([{ x: 1, y: 6 }, { x: 8, y: 1 }, { x: 13, y: 8 }, { x: 6, y: 13 }]), 'starts: red left, green top, yellow right, blue bottom');
check([...SAFE].sort((a, b) => a - b).join(',') === '0,8,13,21,26,34,39,47', 'the same safe squares as the server');
for (let color = 0; color < 4; color++) {
  const last = TRACK[(color * 13 + 50) % 52];
  const col = homeColumnCells(color);
  check(col.length === 5 && adj(last, col[0]) && col.every((c, i) => i === 0 || adj(c, col[i - 1])), `colour ${color}: the home column follows its last track square`);
  check(col.every((c) => !TRACK.some((t) => t.x === c.x && t.y === c.y)), `colour ${color}: the home column is off the shared track`);
  const home = tokenCell(color, 56, 0);
  check(Math.abs(home.x - 7.5) < 1 && Math.abs(home.y - 7.5) < 1, `colour ${color}: home is the centre`);
  const yard = [0, 1, 2, 3].map((k) => tokenCell(color, -1, k));
  check(new Set(yard.map((c) => `${c.x},${c.y}`)).size === 4, `colour ${color}: four distinct yard spots`);
}
check(legalTokens([-1, -1, -1, -1], 5).length === 0 && legalTokens([-1, -1, -1, -1], 6).length === 4, 'the yard opens with a 6 only');
check(legalTokens([53, 50, 56, -1], 4).join(',') === '1', 'exact roll home; a token home never moves');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
