// Faces: a person always shows her own photo.
// - A real account (uuid) shows its own profile photo, the same in IRLY and
//   IRLY Girl; never a stock or example portrait, never someone else's photo;
//   no photo means the neutral placeholder (initials).
// - Example people (demo build only) each have one illustrative portrait of
//   their own: no two people share a photo, and no file is missing.
// Run: node --experimental-strip-types --no-warnings --import ./scripts/alias.mjs scripts/test-faces.mts
import crypto from 'node:crypto';
import fs from 'node:fs';
import { cardPhoto, isAccountId, shownPhoto } from '../src/features/server/faceRule.ts';

let failed = 0;
const expect = (ok: boolean, label: string, got?: unknown) => {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed++;
    console.error(`✗ ${label}`, got === undefined ? '' : JSON.stringify(got));
  }
};
const read = (p: string) => fs.readFileSync(p, 'utf8');

/* ───────── Real accounts ───────── */
const ADA = '0b6f3a52-1c1e-4c4e-9a43-2f0e8b1d7a11';
const STOCK = [
  'https://getirly.com/irly/photos/faces/g-maya.jpg?v=2',
  'https://getirly.com/irly/photos/v/girlsOut-1200.jpg',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80',
];
expect(isAccountId(ADA), 'a uuid is a real account');
for (const id of ['g-maya', 'w-salma', 'p-amira', 'me', '', null, undefined]) expect(!isAccountId(id), `"${id}" is not a real account (never looked up)`);

// The server says she has no photo: placeholder, whatever the screen had in hand.
for (const s of STOCK) expect(shownPhoto(ADA, null, s) === undefined, 'real account without photo: placeholder, never a stock photo', s);
// She has a photo: hers, never the one the screen had.
expect(shownPhoto(ADA, { uri: 'https://x.supabase.co/sign/profile-photos/ada/1-s.jpg' }, STOCK[0]) === 'https://x.supabase.co/sign/profile-photos/ada/1-s.jpg', 'real account: her own profile photo wins');
// Example people keep their own illustrative portrait (demo build).
expect(shownPhoto('g-maya', undefined, STOCK[0]) === STOCK[0], 'example person: her own portrait');
expect(shownPhoto('g-maya', null, undefined) === undefined, 'example person without portrait: placeholder');

// Big cards (IRLY Girl deck, match moment): profile photo, then her own photos, else placeholder.
expect(cardPhoto({ uri: 'profile.jpg' }, ['girl-1.jpg']) === 'profile.jpg', 'card: the profile photo first (same as everywhere)');
expect(cardPhoto(null, ['girl-1.jpg']) === 'girl-1.jpg', 'card: her own IRLY Girl photo when no profile photo');
expect(cardPhoto({ uri: 'irly-avatar:v1:abc' }, ['girl-1.jpg']) === 'girl-1.jpg', 'card: a real photo of hers beats her avatar drawing');
expect(cardPhoto(null, []) === undefined && cardPhoto(undefined, undefined) === undefined, 'card: no photo at all is the placeholder');

/* ───────── Sources: no stock or example face for a real account ───────── */
const api = read('src/features/girl/api.ts');
const server = api.slice(api.indexOf('const serverApi'), api.indexOf('/* ───────────────────────── Device'));
expect(!/portrait\(|PhotoKey|cover:/.test(server), 'IRLY Girl server API: no portrait, stock key or cover for real members');
expect([...server.matchAll(/photoUrls: ([^,\n]+)/g)].every((m) => m[1].startsWith('await signedPhotos(')), 'IRLY Girl server API: photos only from the member’s own stored files');
expect(!/portrait\(/.test(api), 'IRLY Girl API never builds a portrait link itself (example photos come from the person record)');

const demo = read('src/features/girl/demo.ts');
const demoLine = demo.split('\n').find((l) => l.startsWith('export const demoPhoto')) ?? '';
expect(/DEMO &&/.test(demoLine), 'demoPhoto: demo build only');
expect(!/portrait\(/.test(demoLine), 'demoPhoto: the person record’s own photo, never a guessed file');
const demoRe = /\/\^\(g\|w\|p\)-\[a-z\]\+\$\//;
expect(demoRe.test(demoLine) && !new RegExp('^(g|w|p)-[a-z]+$').test(ADA), 'demoPhoto: a uuid never matches an example id');

for (const f of ['src/components/ui/Avatar.tsx', 'src/features/girl/CandidateCard.tsx', 'src/features/girl/MatchMoment.tsx']) {
  const src = read(f);
  expect(!/portrait\(|girlPhotoFor|girlCommunityPhoto|\.cover\b/.test(src), `${f}: no stock or example photo stands in for a person`);
}

/* ───────── Example people: one distinct portrait each ───────── */
const CONTENT = ['src/data/content/build.ts', 'src/data/content/dubai.ts', 'src/data/content/bali.ts', 'src/data/content/girls.ts', 'src/data/content/girlDemo.ts', 'src/data/content/regional.ts'].filter((f) => fs.existsSync(f));
const people = new Map<string, Set<string>>();
for (const f of CONTENT) {
  for (const m of read(f).matchAll(/id: '((?:g|w|p)-[a-z]+)',\s*name: '([^']+)'/g)) {
    if (!people.has(m[1])) people.set(m[1], new Set());
    people.get(m[1])!.add(m[2]);
  }
  // Every example portrait is the record's own (portrait(x.id)), demo build only.
  for (const m of read(f).matchAll(/(.{0,20})portrait\(([^)]*)\)/g)) {
    expect(/^\w+\.id$/.test(m[2]) && /DEMO \? $/.test(m[1]), `${f}: portrait(${m[2]}) is the person's own, demo only`, m[0]);
  }
}
expect(people.size >= 40, `example people read (${people.size})`);
for (const [id, names] of people) expect(names.size === 1, `${id} is one person`, [...names]);

const FACES = 'public-photos/faces';
const missing = [...people.keys()].filter((id) => !fs.existsSync(`${FACES}/${id}.jpg`));
expect(missing.length === 0, 'every example person has her own portrait file', missing);

const files = fs.readdirSync(FACES).filter((f) => f.endsWith('.jpg'));
const byHash = new Map<string, string[]>();
const bySource = new Map<string, string[]>();
for (const f of files) {
  const h = crypto.createHash('md5').update(fs.readFileSync(`${FACES}/${f}`)).digest('hex');
  byHash.set(h, [...(byHash.get(h) ?? []), f]);
  if (fs.existsSync(`${FACES}/${f}.src`)) {
    const src = read(`${FACES}/${f}.src`).split('\n')[0].trim();
    bySource.set(src, [...(bySource.get(src) ?? []), f]);
  }
}
const sameFile = [...byHash.values()].filter((v) => v.length > 1);
const sameSource = [...bySource.values()].filter((v) => v.length > 1);
expect(sameFile.length === 0, `no two example people share a photo file (${files.length} portraits)`, sameFile);
expect(sameSource.length === 0, 'no two example people share a source photo', sameSource);

// Same first name in IRLY and IRLY Girl examples (different people, different photos): reported, as it can read as one person.
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const byName = new Map<string, string[]>();
for (const [id, names] of people) for (const n of names) byName.set(plain(n), [...(byName.get(plain(n)) ?? []), id]);
const twins = [...byName.entries()].filter(([, ids]) => ids.length > 1);
if (twins.length) console.log(`note: example people sharing a first name (distinct photos): ${twins.map(([n, ids]) => `${n} (${ids.join(', ')})`).join('; ')}`);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll face checks passed');
