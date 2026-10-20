/**
 * Neighbourhoods are never chosen or ordered by the raw data order (which
 * puts Deira first in Dubai): no `city.areas[0]` default in the app, and the
 * picker ranks by relevance, or by zone then name when nothing is typed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { rankAreas } from '../src/data/areas.ts';
import { CITIES } from '../src/data/destinations.ts';

const fails: string[] = [];
const check = (ok: boolean, what: string) => (ok ? console.log(`  ✓ ${what}`) : fails.push(what));

// 1. No first-area default left in the app.
const src = path.join(import.meta.dirname, '..', 'src');
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []));
const hits = walk(src).flatMap((f) =>
  fs
    .readFileSync(f, 'utf8')
    .split('\n')
    .map((l, i) => ({ f: path.relative(src, f), i: i + 1, l }))
    .filter((x) => /\bcity\.areas\[0\]|\bcity\.areas\.slice\(0,/.test(x.l)),
);
hits.forEach((h) => console.log(`  ✗ ${h.f}:${h.i}  ${h.l.trim()}`));
check(!hits.length, `no city.areas[0] default in src (${hits.length} found)`);

// 2. Search ranking, on the real Dubai data.
const dubai = CITIES.dubai;
const names = (q: string, zone?: string | null) => rankAreas(dubai, q, zone).map((a) => a.name);
const show = (q: string, zone?: string | null) => console.log(`  "${q}"${zone ? ` [zone ${zone}]` : ''} → ${names(q, zone).slice(0, 10).join(' · ')}`);
['dubai', 'de', 'marina', 'jbr', ''].forEach((q) => show(q));
show('', 'creek');

const before = (list: string[], a: string, b: string) => list.indexOf(a) >= 0 && (list.indexOf(b) < 0 || list.indexOf(a) < list.indexOf(b));
check(before(names('dubai'), 'Dubai Marina', 'Deira'), '"dubai": Dubai Marina before Deira');
check(!names('dubai').includes('Deira'), '"dubai": Deira not pulled in through "Creek & old Dubai"');
check(names('de')[0] === 'Deira', '"de": Deira first, because its name starts with it');
check(names('marina')[0] === 'Dubai Marina', '"marina": Dubai Marina first');
check(names('jbr')[0] === 'JBR', '"jbr": JBR first');
check(names('')[0] !== 'Deira' && names('').indexOf('Deira') > 0, 'empty search: zone order, not raw order (Deira not first)');
const marinaZone = names('', 'marina');
check(marinaZone.join() === [...marinaZone].sort((a, b) => a.localeCompare(b)).join(), 'a zone lists its neighbourhoods alphabetically');
const creek = names('', 'creek');
check(creek[0] !== 'Deira' || [...creek].sort((a, b) => a.localeCompare(b))[0] === 'Deira', 'creek zone: alphabetical, not data order');

if (fails.length) {
  console.error(`✗ ${fails.length} failed:\n  ${fails.join('\n  ')}`);
  process.exit(1);
}
console.log('area order ok');
