// IRLY Network in French agrees with the person it speaks of: a woman is
// « Fondatrice », a man « Fondateur », an unknown or other gender
// « Fondateur·rice » (as « Ami·e » elsewhere); "you both…" is « toutes les
// deux » only when both are women. Reads fr.ts and the Network modules
// directly, with translateAs's rule (src/i18n): the form `key (gender)`,
// else the plain entry.
//
//   node --experimental-strip-types --no-warnings --import ./scripts/alias.mjs scripts/check-network-gender.mts
import { fr } from '../src/i18n/fr.ts';
import { scorePro, type ProProfile } from '../src/features/network/match.ts';
import { agreeOf, JOB_SUGGESTIONS, ROLE_CHOICES, ROLE_LABEL, ROLES, type RoleId } from '../src/features/network/taxonomy.ts';

type Agree = 'woman' | 'man' | 'other';
const fr_ = (text: string, who: Agree) => fr[`${text} (${who})`] ?? fr[text] ?? text;

let failed = 0;
const expect = (ok: boolean, label: string, got?: unknown) => {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed++;
    console.error(`✗ ${label}`, JSON.stringify(got));
  }
};

// 1. Every role, in each gender.
const ROLE_FR: Record<RoleId, Record<Agree, string>> = {
  founder: { woman: 'Fondatrice', man: 'Fondateur', other: 'Fondateur·rice' },
  entrepreneur: { woman: 'Entrepreneuse', man: 'Entrepreneur', other: 'Entrepreneur·e' },
  freelancer: { woman: 'Freelance', man: 'Freelance', other: 'Freelance' },
  employee: { woman: 'Salariée', man: 'Salarié', other: 'Salarié·e' },
  investor: { woman: 'Investisseuse', man: 'Investisseur', other: 'Investisseur·euse' },
};
for (const r of ROLES)
  for (const who of ['woman', 'man', 'other'] as const) {
    const got = fr_(ROLE_LABEL[r.id], who);
    expect(got === ROLE_FR[r.id][who], `${r.id} (${who}) → ${ROLE_FR[r.id][who]}`, got);
  }
for (const c of ROLE_CHOICES) expect(fr_(c.label, 'woman') === ROLE_FR[c.id].woman, `editor choice ${c.id} for a woman`, fr_(c.label, 'woman'));

// 2. Job suggestions a woman taps write a feminine title.
const womanTitles = JOB_SUGGESTIONS.map((s) => fr_(s, 'woman'));
expect(womanTitles.includes('Fondatrice') && womanTitles.includes('Investisseuse') && !womanTitles.some((s) => ['Fondateur', 'Investisseur', 'Ingénieur logiciel'].includes(s)), 'job suggestions for a woman are feminine', womanTitles);
expect(JOB_SUGGESTIONS.map((s) => fr_(s, 'man')).includes('Fondateur'), 'job suggestions for a man are masculine');

// 3. Whose gender: declared, women only in IRLY Girl, inclusive when unknown.
expect(agreeOf({ gender: 'woman' }, false) === 'woman' && agreeOf({ gender: 'man' }, false) === 'man', 'declared gender in IRLY');
expect(agreeOf({ gender: null }, false) === 'other' && agreeOf(null, false) === 'other', 'unknown → inclusive form');
expect(agreeOf({ gender: null }, true) === 'woman' && agreeOf(null, true) === 'woman', 'IRLY Girl → feminine');

// 4. Match reasons agree with the two of you.
const pro = (userId: string, gender: Agree | null, more: Partial<ProProfile> = {}): ProProfile => ({
  userId, firstName: userId, photoPath: null, role: 'founder', jobTitle: 'x', company: null, industries: ['ai'], skills: [], project: null,
  lookingFor: null, canOffer: null, intents: ['partners', 'suppliers'], cityId: 'dubai', areaId: null, lat: 25.08, lng: 55.14, connection: 'none', gender, ...more,
});
const say = (a: ProProfile, b: ProProfile) => scorePro(a, b).reasons.map((r) => fr_(r.text, r.who ?? 'man').replace(/\{(\w+)\}/g, (_, k) => String(r.vars?.[k] ?? '')));
const women = say(pro('a', 'woman'), pro('b', 'woman'));
expect(women.some((s) => s.includes('toutes les deux')) && !women.some((s) => s.includes('tous les deux')) && women.some((s) => s.includes('l’une de l’autre')), 'two women: « toutes les deux », « l’une de l’autre »', women);
const mixed = say(pro('a', 'woman'), pro('b', 'man'));
expect(mixed.some((s) => s.includes('tous les deux')) && !mixed.some((s) => s.includes('toutes')), 'a woman and a man: « tous les deux »', mixed);
const unknown = say(pro('a', 'woman'), pro('b', null));
expect(!unknown.some((s) => s.includes('toutes')), 'gender unknown: never assumed feminine', unknown);
const supplier = scorePro(pro('a', 'man', { intents: ['suppliers'] }), pro('b', 'woman', { intents: [], industries: ['trade'] })).reasons.find((r) => r.text === '{name} could supply you');
expect(supplier?.who === 'woman' && fr_(supplier.text, 'woman').includes('ta fournisseuse'), '« pourrait être ta fournisseuse »', supplier);
expect(fr_('New on IRLY Network', 'woman') === 'Nouvelle sur IRLY Network', '« Nouvelle sur IRLY Network »');

// 5. Every gendered form has its plain entry and the same placeholders.
const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
for (const [k, v] of Object.entries(fr)) {
  const m = / \((woman|man|other)\)$/.exec(k);
  if (!m) continue;
  const base = k.slice(0, m.index);
  if (!(base in fr) || holes(base) !== holes(v)) expect(false, `gendered form ${JSON.stringify(k)} matches its plain entry`, v);
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nIRLY Network agrees in French: all good');
