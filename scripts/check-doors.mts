// The space doors are deterministic: IRLY Girl always opens IRLY Girl,
// IRLY Maman always opens IRLY Maman (features/girl/doors). Checks the
// gate's decision, then reads the source so no entry routes around it
// again: no relay through Home (`girl=moms`), no hand-written Maman links,
// no door to the retired « girls » space page.
//
//   node --experimental-strip-types --no-warnings scripts/check-doors.mts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asksMoms, gateTarget, GIRL_DOOR, GIRL_HOME, MOM_DOOR, MOM_PAGE } from '../src/features/girl/doors.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

let failed = 0;
const expect = (ok: boolean, label: string, got?: unknown) => {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed++;
    console.error(`✗ ${label}`, JSON.stringify(got));
  }
};

// 1. The gate's decision depends on its own params only.
expect(gateTarget(undefined) === GIRL_HOME, 'IRLY Girl door (/girl) → IRLY Girl Home', gateTarget(undefined));
expect(gateTarget('') === GIRL_HOME, 'empty mode → IRLY Girl Home', gateTarget(''));
expect(gateTarget('girl') === GIRL_HOME, 'unknown mode → IRLY Girl Home', gateTarget('girl'));
expect(gateTarget('moms') === MOM_PAGE, 'IRLY Maman door (/girl?mode=moms) → IRLY Maman', gateTarget('moms'));
expect(gateTarget(['moms', 'girl']) === MOM_PAGE, 'repeated param: the first one decides', gateTarget(['moms', 'girl']));
expect(MOM_DOOR === `${GIRL_DOOR}?mode=moms`, 'the Maman door is the gate with mode=moms', MOM_DOOR);
expect(new URL(MOM_PAGE, 'https://x').searchParams.get('moms') === '1' && asksMoms('1'), 'the Maman page asks for IRLY Maman', MOM_PAGE);
expect(!asksMoms(undefined) && !asksMoms('0') && !asksMoms(''), 'no moms param → IRLY Maman stays closed');

// 2. Every entry goes through the doors.
const files: string[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name) && !p.includes(`${path.sep}i18n${path.sep}`)) files.push(p);
  }
};
walk(SRC);
const DOORS_FILE = path.join(SRC, 'features', 'girl', 'doors.ts');
const banned: [RegExp, string][] = [
  [/girl=moms/, 'no IRLY Maman relay through Home (girl=moms)'],
  [/['"`]\/girl\?mode=moms/, 'IRLY Maman links use MOM_DOOR'],
  [/['"`]\/discover\?[^'"`]*moms=1/, 'IRLY Maman page links use MOM_PAGE'],
  [/['"`]\/space\/girls/, 'no door to the retired « girls » space page'],
];
for (const [re, label] of banned) {
  const hits = files.filter((f) => f !== DOORS_FILE && re.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
  expect(hits.length === 0, label, hits);
}

// 3. Each named door leads where its name says (Home portals, Explore).
for (const rel of ['src/features/home/Portals.tsx', 'src/features/home/Explore.tsx']) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const doors = [...src.matchAll(/title: '([^']+)'[^}]*route: ([A-Z_]+|'[^']*')/g)].map((m) => ({ title: m[1], route: m[2] }));
  for (const d of doors.filter((x) => x.title === 'IRLY Girl')) expect(d.route === 'GIRL_DOOR', `${rel}: IRLY Girl → GIRL_DOOR`, d.route);
  for (const d of doors.filter((x) => /Maman|Mom/.test(x.title))) expect(d.route === 'MOM_DOOR' || d.route === 'MOM_PAGE', `${rel}: ${d.title} → IRLY Maman`, d.route);
  expect(doors.some((d) => d.title === 'IRLY Girl'), `${rel}: has its IRLY Girl door`);
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll space doors are deterministic.');
