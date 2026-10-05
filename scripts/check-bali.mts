// "Where should I live in Bali?", test plans and opening hours.
import { buildTestPlan, isOpenNow, rankAreas, type AreaProfile } from '../src/features/bali/fit.ts';

const p = (areaId: string, traits: AreaProfile['traits']): AreaProfile => ({ areaId, name: areaId[0].toUpperCase() + areaId.slice(1), tagline: '', vibe: '', bestFor: [], notIdealFor: [], traits, pros: [], cons: [] });
// Same values as supabase/migrations/…_irly_bali_moms.sql.
const areas = [
  p('canggu', { beach: 4, surf: 5, nightlife: 4, coworking: 5, wellness: 4, family: 3, nature: 2, social: 5, quiet: 1, restaurants: 5, traffic: 5, airport: 3 }),
  p('sanur', { beach: 4, surf: 1, nightlife: 1, coworking: 3, wellness: 4, family: 5, nature: 2, social: 3, quiet: 5, restaurants: 4, traffic: 2, airport: 4 }),
  p('ubud', { beach: 0, surf: 0, nightlife: 2, coworking: 4, wellness: 5, family: 3, nature: 5, social: 4, quiet: 3, restaurants: 5, traffic: 4, airport: 1 }),
  p('uluwatu', { beach: 5, surf: 5, nightlife: 3, coworking: 3, wellness: 4, family: 2, nature: 4, social: 3, quiet: 3, restaurants: 4, traffic: 3, airport: 3 }),
];

let failed = 0;
const expect = (ok: boolean, label: string, extra?: unknown) => {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed++;
    console.error(`✗ ${label}`, extra ?? '');
  }
};

const nomad = rankAreas(areas, { surf: 'yes', remote: 'yes', coworking: 'yes', social: 'yes', nightlife: 'yes', pace: 'social' });
expect(nomad[0].area.areaId === 'canggu', 'social surfer who works remotely → Canggu', nomad.map((f) => `${f.area.areaId} ${f.score}`));
expect(nomad[0].why.length > 0, 'with reasons', nomad[0].why);

const family = rankAreas(areas, { kids: 'yes', nightlife: 'no', traffic: 'no', beach: 'yes', pace: 'quiet' });
expect(family[0].area.areaId === 'sanur', 'quiet family by the beach → Sanur', family.map((f) => `${f.area.areaId} ${f.score}`));
expect(family.find((f) => f.area.areaId === 'canggu')!.watch.some((w) => w.includes('traffic')), 'warns about Canggu traffic');

const yogi = rankAreas(areas, { wellness: 'yes', nature: 'yes', beach: 'no', surf: 'no' });
expect(yogi[0].area.areaId === 'ubud', 'wellness and nature → Ubud', yogi.map((f) => `${f.area.areaId} ${f.score}`));
expect(yogi.every((f) => f.score >= 0 && f.score <= 100), 'scores stay 0–100');

for (const len of [7, 14, 30, 60] as const) {
  const plan = buildTestPlan(nomad, len, { remote: 'yes' });
  expect(plan.length === len, `${len}-day plan has ${len} days`, plan.length);
  expect(plan[0].theme === 'arrive' && plan.some((d) => d.theme === 'housing') && plan[plan.length - 1].theme === 'decide', `${len}-day plan: arrive → housing → decide`);
}
const fam = buildTestPlan(family, 14, { kids: 'yes' });
expect(fam.some((d) => d.theme === 'family'), 'families get family days');

// Monday 10:00–22:00 in Bali (UTC+8). Monday = day 1.
const hours = { periods: [{ open: { day: 1, hour: 10 }, close: { day: 1, hour: 22 } }, { open: { day: 5, hour: 18 }, close: { day: 6, hour: 2 } }] };
const at = (iso: string) => new Date(iso);
expect(isOpenNow(hours, 8, at('2026-10-05T04:00:00Z')) === true, 'open Monday noon in Bali');
expect(isOpenNow(hours, 8, at('2026-10-05T15:00:00Z')) === false, 'closed Monday 23:00 in Bali');
expect(isOpenNow(hours, 8, at('2026-10-09T17:30:00Z')) === true, 'open past midnight Friday → Saturday 01:30');
expect(isOpenNow(null, 8) === null, 'unknown hours stay unknown');

if (failed) {
  console.error(`${failed} Bali check(s) failed`);
  process.exit(1);
}
console.log('bali ok');
