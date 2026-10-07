// The professional match: scores, reasons and the sentence shown on cards.
import { distanceKm, matchSentence, roundDistance, scorePro, type ProProfile } from '../src/features/network/match.ts';
import { INDUSTRIES, INTENTS } from '../src/features/network/taxonomy.ts';

const base = (p: Partial<ProProfile>): ProProfile => ({
  userId: 'x', firstName: 'X', photoPath: null, role: 'founder', jobTitle: 'Founder', company: null, industries: ['tech'], skills: [], project: null,
  lookingFor: null, canOffer: null, intents: [], cityId: 'dubai', areaId: null, lat: null, lng: null, connection: 'none', ...p,
});
const fill = (s: string, v?: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k] ?? ''));
let failed = 0;
const check = (ok: boolean, label: string, got?: unknown) => {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed++;
    console.log(`✗ ${label}`, got ?? '');
  }
};

check(INDUSTRIES.length === 21 && new Set(INDUSTRIES.map((i) => i.id)).size === 21, '21 distinct domains');
check(INTENTS.length >= 10, 'at least the 10 networking goals');

const me = base({ userId: 'me', firstName: 'Me', industries: ['ai', 'saas'], intents: ['partners', 'meet'], skills: ['Python', 'Sales'], lat: 25.08, lng: 55.14, project: 'AI assistant for clinics' });
const twin = base({ userId: 'a', firstName: 'Lina', industries: ['ai', 'saas'], intents: ['partners'], skills: ['python', 'Design'], lat: 25.09, lng: 55.15, project: 'Clinics scheduling with AI' });
const far = base({ userId: 'b', firstName: 'Omar', industries: ['food'], intents: ['job'], cityId: 'sharjah', lat: 25.35, lng: 55.42 });

const m1 = scorePro(me, twin);
const m2 = scorePro(me, far);
check(m1.percent > m2.percent && m1.percent >= 85, 'same domains, goals, skills, nearby: high match', m1.percent);
check(m2.percent < 60, 'nothing in common: low match', m2.percent);
check(m1.percent <= 99 && m2.percent >= 40, 'percent stays between 40 and 99');
const s1 = matchSentence(m1, fill);
check(s1 === "You both work in AI & SaaS and you are both looking for business partners.", 'the card sentence', s1);

const investor = base({ userId: 'c', firstName: 'Sam', role: 'investor', industries: ['fintech'] });
const raising = base({ userId: 'me', industries: ['ai'], intents: ['investors'] });
check(scorePro(raising, investor).reasons[0]?.text.includes('invests'), 'an investor fits a founder looking for investors');
const freelancer = base({ userId: 'd', firstName: 'Ana', role: 'freelancer', intents: ['clients'], industries: ['design'] });
check(scorePro(base({ intents: ['freelancers'] }), freelancer).reasons.some((r) => r.kind === 'complement'), 'a freelancer fits someone looking for freelancers');
const offer = base({ userId: 'e', firstName: 'Tom', canOffer: 'Fundraising advice and investor intros', industries: ['business'] });
check(scorePro(base({ lookingFor: 'Help with fundraising' }), offer).reasons.some((r) => r.kind === 'complement'), 'what I look for meets what they offer');
check(scorePro(base({ intents: ['cofounder'], skills: ['Sales'] }), base({ userId: 'f', firstName: 'Kim', intents: ['cofounder'], skills: ['React', 'Python'] })).reasons.some((r) => r.text.includes('cofounder')), 'two people looking for a cofounder with different skills');

const km = distanceKm({ lat: 25.08, lng: 55.14 }, { lat: 25.2, lng: 55.27 });
check(km != null && km > 15 && km < 20, 'Marina → Downtown is about 18 km', km);
check(roundDistance(0.4) === '< 1 km' && roundDistance(3.2) === '≈ 3 km' && roundDistance(18) === '≈ 20 km', 'distances are rounded');
check(scorePro(base({}), base({ userId: 'g', cityId: 'dubai' })).distanceKm === null, 'no neighbourhood, no distance');

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nnetwork match ok');
