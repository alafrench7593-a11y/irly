// The space doors are deterministic: IRLY Girl always opens IRLY Girl,
// IRLY Mom Community always opens IRLY Mom Community (features/girl/doors). Checks the
// gate's decision, then reads the source so no entry routes around it
// again: no relay through Home (`girl=moms`), no hand-written Mom links,
// no door to the retired « girls » space page.
//
//   node --experimental-strip-types --no-warnings scripts/check-doors.mts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gateTarget, GIRL_DOOR, GIRL_HOME, MOM_DOOR, MOM_PAGE } from '../src/features/girl/doors.ts';

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
expect(gateTarget('moms') === MOM_PAGE, 'IRLY Mom Community door (/girl?mode=moms) → IRLY Mom Community', gateTarget('moms'));
expect(gateTarget(['moms', 'girl']) === MOM_PAGE, 'repeated param: the first one decides', gateTarget(['moms', 'girl']));
expect(MOM_DOOR === `${GIRL_DOOR}?mode=moms`, 'the Mom door is the gate with mode=moms', MOM_DOOR);
expect(MOM_PAGE === '/girl/moms', 'IRLY Mom Community is a page of IRLY Girl (/girl/moms)', MOM_PAGE);
const momPage = fs.readFileSync(path.join(ROOT, 'src/app/girl/moms.tsx'), 'utf8');
expect(/useAppSpace\(\) === 'girl'/.test(momPage) && /<Redirect href=\{MOM_DOOR\}/.test(momPage), 'outside IRLY Girl, the Mom page goes through the IRLY Girl gate first');
expect(/onMomPage/.test(momPage), 'the Mom page shows « Your spaces » with the way back to IRLY Girl');

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
  [/girl=moms/, 'no IRLY Mom Community relay through Home (girl=moms)'],
  [/['"`]\/girl\?mode=moms/, 'IRLY Mom Community links use MOM_DOOR'],
  [/['"`]\/discover\?[^'"`]*moms=1/, 'IRLY Mom Community page links use MOM_PAGE'],
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
  // GIRL_HOME only on the Mom page's « Your spaces », already inside IRLY Girl (the way back).
  for (const d of doors.filter((x) => x.title === 'IRLY Girl')) expect(d.route === 'GIRL_DOOR' || d.route === 'GIRL_HOME', `${rel}: IRLY Girl → IRLY Girl`, d.route);
  for (const d of doors.filter((x) => /Maman|Mom/.test(x.title))) expect(d.route === 'MOM_DOOR' || d.route === 'MOM_PAGE', `${rel}: ${d.title} → IRLY Mom Community`, d.route);
  expect(doors.some((d) => d.title === 'IRLY Girl'), `${rel}: has its IRLY Girl door`);
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll space doors are deterministic.');
