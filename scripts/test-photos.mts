// Photos: every catalog activity, subcategory and official community gets a
// photo of its own subject (running is never a gym, water sports are never
// a gym, table tennis is not tennis), and every photo key exists.
// Run: node --experimental-strip-types --no-warnings --import ./scripts/alias.mjs scripts/test-photos.mts
import fs from 'node:fs';
import { register } from 'node:module';
import { CATEGORIES, ideaPhoto, photoForText, type CategoryKey } from '../src/data/catalog/categories.ts';
import { girlCommunityPhoto, girlPhotoFor } from '../src/features/girl/photos.ts';

const verbose = process.argv.includes('--list');
let failed = 0;
const expect = (ok: boolean, label: string, got?: unknown) => {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed++;
    console.error(`✗ ${label}`, JSON.stringify(got));
  }
};

// Every key the registry can serve: Unsplash ids, the photo library, IRLY's own photos and the Dubai keys.
const photos = fs.readFileSync('src/data/photos.ts', 'utf8');
const dubai = fs.readFileSync('src/data/dubaiKeys.ts', 'utf8');
const idsBlock = photos.slice(photos.indexOf('const ids = {'), photos.indexOf('};', photos.indexOf('const ids = {')));
const listOf = (name: string) => {
  const start = photos.indexOf(`export const ${name} = [`);
  return [...photos.slice(start, photos.indexOf(']', start)).matchAll(/'(\w+)'/g)].map((m) => m[1]);
};
const KNOWN = new Set([...[...idsBlock.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]), ...listOf('LIBRARY'), ...listOf('OWN'), ...[...dubai.matchAll(/"(\w+)"/g)].map((m) => m[1])]);
expect(KNOWN.size > 100, `photo registry read (${KNOWN.size} keys)`);

// The official communities' photo, as communityPhoto (official.ts, which needs the app runtime) computes it.
const official = fs.readFileSync('src/features/community/official.ts', 'utf8');
const block = (name: string) => Object.fromEntries([...official.slice(official.indexOf(`${name} = {`), official.indexOf('}', official.indexOf(`${name} = {`))).matchAll(/(\w+): '(\w+)'/g)].map((m) => [m[1], m[2]]));
const TOPIC_PHOTO = block('TOPIC_PHOTO');
const DUBAI_INSTEAD = block('DUBAI_INSTEAD');
const CATEGORY_PHOTO = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.photo]));
const communityPhoto = (topic: string | null, categoryId: string | null, name?: string) => {
  const named = name ? photoForText(name) : null;
  if (named) return named;
  if (topic && TOPIC_PHOTO[topic]) return TOPIC_PHOTO[topic];
  const key = categoryId ? CATEGORY_PHOTO[categoryId] : undefined;
  return key ? (DUBAI_INSTEAD[key] ?? key) : 'girlsOut';
};
expect(Object.keys(TOPIC_PHOTO).length >= 20, 'TOPIC_PHOTO read from official.ts');

// 1. Every catalog entry: a known key, printed with --list.
const missing: string[] = [];
let count = 0;
for (const c of CATEGORIES) {
  for (const sub of c.subs) {
    const entries = sub.activities?.length ? sub.activities.map((a) => a.label) : [sub.label];
    for (const label of entries) {
      const key = ideaPhoto(c.id as CategoryKey, label, undefined, sub.id);
      count++;
      if (!KNOWN.has(key)) missing.push(`${c.id}/${sub.id}/${label} → ${key}`);
      if (verbose) console.log(`  ${c.id} / ${sub.label} / ${label} → ${key}`);
    }
  }
}
expect(missing.length === 0, `${count} catalog entries all use an existing photo`, missing);

// 2. Official communities and their groups (names from the migrations).
const sql = fs.readdirSync('supabase/migrations').map((f) => fs.readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');
const topics = [...new Map([...sql.matchAll(/\('([a-z_]+)', '(IRLY [^']+)'/g)].map((m) => [m[1], m[2]])).entries()];
const subtopics = [...sql.matchAll(/\('([a-z_]+)', '([a-z_]+)', '([^']+)', '[^']*', '[^']*', \d+\)/g)].map((m) => ({ parent: m[1], sub: m[2], name: m[3] }));
expect(topics.length >= 20 && subtopics.length >= 10, `official topics (${topics.length}) and groups (${subtopics.length}) read`);
for (const [topic, name] of topics) {
  const key = communityPhoto(topic, null, name);
  if (verbose) console.log(`  community ${name} → ${key}`);
  expect(KNOWN.has(key), `community ${name} → ${key} exists`);
}
for (const s of subtopics) {
  const key = communityPhoto(s.parent, null, s.name);
  if (verbose) console.log(`  group ${s.parent}/${s.name} → ${key}`);
  expect(KNOWN.has(key), `group ${s.name} → ${key} exists`);
}

// 3. The subjects that must never be mixed up.
const is = (key: string, allowed: string[]) => allowed.includes(key);
const RUN = ['runMix', 'running', 'runGirl', 'marathon'];
const GYM = ['gymMix', 'gym', 'gymGirl', 'crossfit'];
const cases: [string, string, string[]][] = [
  ['sport', 'Running', RUN],
  ['sport', 'Morning run', RUN],
  ['sport', 'Jogging', RUN],
  ['sport', 'Gym session', GYM],
  ['sport', 'Fitness class', GYM],
  ['sport', 'Padel', ['padelGirl', 'padel']],
  ['sport', 'Tennis', ['tennisMix', 'tennis', 'tennisGirl']],
  ['sport', 'Table tennis', ['tableTennis']],
  ['sport', 'Water sports', ['surf']],
  ['sport', 'Football', ['footballMix', 'football']],
  ['sport', 'Swimming', ['swimMix', 'swimming']],
  ['wellness', 'Yoga', ['yoga']],
  ['wellness', 'Beach yoga', ['yoga']],
  ['wellness', 'Pilates', ['pilatesGirl', 'yoga']],
  ['food', 'Brunch', ['brunchGirl', 'brunch']],
  ['food', 'Dinner', ['dinnerMix', 'restaurantGirl']],
  ['outdoor', 'Yacht day', ['yachtGirl', 'yacht']],
  ['travel', 'Desert safari', ['desertGirl', 'dunes']],
];
for (const [cat, label, allowed] of cases) {
  const key = ideaPhoto(cat as CategoryKey, label);
  expect(is(key, allowed), `${label} → ${key}`, { allowed });
}
for (const label of ['Running', 'Morning run', 'Run club', 'Marathon training']) expect(!GYM.includes(ideaPhoto('sport', label)), `${label} is never a gym photo`);
expect(is(ideaPhoto('sport', 'Morning run', 'Kite Beach'), RUN), 'a run at Kite Beach shows a run', ideaPhoto('sport', 'Morning run', 'Kite Beach'));
expect(ideaPhoto('outdoor', 'Chill afternoon', 'Kite Beach') === 'kiteBeach', 'the place still gives the photo when the title says nothing', ideaPhoto('outdoor', 'Chill afternoon', 'Kite Beach'));
expect(photoForText('Sports bar') !== 'gymMix' && photoForText('Sports bar') !== 'gymGirl', 'a sports bar is not a gym', photoForText('Sports bar'));
expect(communityPhoto('families', null, 'Schools, nurseries & clubs') === 'kids', 'schools and nurseries are not a nightclub', communityPhoto('families', null, 'Schools, nurseries & clubs'));
expect(communityPhoto('running', null, 'IRLY Running') !== 'gym', 'IRLY Running is not a gym', communityPhoto('running', null, 'IRLY Running'));
expect(is(communityPhoto('sport', null, 'Water sports'), ['surf']), 'Water sports group → surf', communityPhoto('sport', null, 'Water sports'));
expect(is(communityPhoto('sport', null, 'Running'), RUN), 'Running group → running', communityPhoto('sport', null, 'Running'));
expect(is(communityPhoto('sport', null, 'Yoga'), ['yoga']), 'Yoga group → yoga', communityPhoto('sport', null, 'Yoga'));

// 4. IRLY Girl: women's plans and communities keep IRLY's photos of women, on the right subject.
const girl: [string, string][] = [
  ['Girls run club', 'runGirl'],
  ['Girls padel', 'padelGirl'],
  ['Girls tennis', 'tennisGirl'],
  ['Girls water sports', 'girlSurf'],
  ['Ladies gym', 'gymGirl'],
  ['Girls brunch', 'brunchGirl'],
  ['Girls yoga', 'girlClass'],
];
for (const [label, want] of girl) {
  const key = ideaPhoto('sport', label);
  expect(key === want && KNOWN.has(key), `${label} → ${key}`, { want });
}
expect(girlPhotoFor('Table tennis') !== 'tennisGirl', 'Girl: table tennis is not tennis', girlPhotoFor('Table tennis'));
for (const [name, want] of [['Running girls', 'runGirl'], ['Padel girls', 'padelGirl'], ['Yoga girls', 'yoga'], ['Moms', 'kids'], ['Brunch club', 'brunchGirl']] as const) {
  const key = girlCommunityPhoto(name);
  expect(key === want && KNOWN.has(key), `Girl community ${name} → ${key}`, { want });
}

// 5. The IRLY photo library of the activity form (features/create/photoLibrary.ts).
// The app module imports react-native (PixelRatio) for its sizes: a stand-in here.
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function resolve(s, c, next) { return s === 'react-native' ? { url: 'data:text/javascript,export const PixelRatio = { get: () => 2 };', shortCircuit: true } : next(s, c); }`,
    ),
);
const lib = await import('../src/features/create/photoLibrary.ts');
const { PHOTO_IDS } = await import('../src/data/photos.ts');
const UNSPLASH = new Set(Object.values(PHOTO_IDS) as string[]);
// A library link → the file the website serves it from (checked in this repository), or the Unsplash id the app ships.
const localFile = (url: string): string | null => {
  const gh = url.match(/^https:\/\/alafrench7593-a11y\.github\.io\/irly\/photos\/(.+)$/);
  if (gh) return `public-photos/${gh[1]}`;
  const own = url.match(/^https:\/\/getirly\.com\/img\/own\/(.+)$/);
  if (own) return `site/img/own/${own[1]}`;
  return null;
};
const reachable = (url: string): boolean => {
  const file = localFile(url);
  if (file) return fs.existsSync(file) && fs.statSync(file).size > 1000;
  const id = url.match(/^https:\/\/images\.unsplash\.com\/photo-([0-9a-f-]+)\?/)?.[1];
  return Boolean(id && UNSPLASH.has(id));
};
const { createHash } = await import('node:crypto');
const sha = (file: string) => createHash('sha1').update(fs.readFileSync(file)).digest('hex');

const unknownKeys = Object.entries(lib.KIND_KEYS).flatMap(([kind, keys]) => (keys as string[]).filter((k) => !KNOWN.has(k)).map((k) => `${kind}/${k}`));
expect(unknownKeys.length === 0, 'every library key is a known photo key', unknownKeys);
const kinds = [...Object.keys(lib.KIND_KEYS), ...CATEGORIES.map((c) => c.id)];
let total = new Set<string>();
const counts: string[] = [];
for (const kind of kinds) {
  for (const girlSpace of [false, true]) {
    const urls: string[] = lib.libraryFor(kind as never, { girl: girlSpace });
    if (!girlSpace) {
      counts.push(`${kind}:${urls.length}`);
      urls.forEach((u) => total.add(u));
    }
    const label = `${girlSpace ? 'Girl' : 'Mixte'} library "${kind}"`;
    expect(urls.length >= 4, `${label}: ${urls.length} photos (at least 4)`, urls.length);
    expect(new Set(urls).size === urls.length, `${label}: each link once`);
    const broken = urls.filter((u) => !reachable(u) || !lib.isLibraryUrl(u));
    expect(broken.length === 0, `${label}: every photo is in the project's photo sets and accepted by the server rule`, broken);
    const thumbs = urls.map(lib.libraryThumb).filter((u) => localFile(u) && !reachable(u));
    expect(thumbs.length === 0, `${label}: every grid thumbnail exists`, thumbs);
    // Same picture under two names (jbr = surf…): never twice in one grid.
    const seen = new Map<string, string>();
    const twins: string[] = [];
    for (const u of urls) {
      const file = localFile(u);
      if (!file) continue;
      const h = sha(file);
      if (seen.has(h)) twins.push(`${seen.get(h)} = ${u}`);
      else seen.set(h, u);
    }
    expect(twins.length === 0, `${label}: no picture twice`, twins);
    if (girlSpace) expect(urls.every((u) => !/Mix-\d+\.jpg$/.test(u)) || urls.length < 4, `${label}: no photo of mixed groups`, urls.filter((u) => /Mix-/.test(u)));
  }
}
console.log(`  library sizes: ${counts.join(' ')}`);
console.log(`  ${total.size} distinct library photos`);

// The type of an activity, from its words.
const kindCases: [string, string, string][] = [
  ['sport', 'Football', 'football'],
  ['sport', 'Padel', 'padel'],
  ['sport', 'Morning run', 'running'],
  ['sport', 'Gym session', 'gym'],
  ['wellness', 'Beach yoga', 'yoga'],
  ['food', 'Brunch', 'brunch'],
  ['food', 'Coffee', 'cafe'],
  ['food', 'Girls dinner', 'restaurant'],
  ['shopping', 'Dubai Mall', 'shopping'],
  ['outdoor', 'Beach day', 'beach'],
  ['travel', 'Desert safari', 'desert'],
  ['networking', 'Founders breakfast', 'networking'],
  ['outdoor', 'Walk together', 'walk'],
  ['wellness', 'Spa afternoon', 'spa'],
  ['entertainment', 'Comedy night', 'outings'],
  ['travel', 'Trip to Oman', 'travel'],
];
for (const [cat, label, want] of kindCases) {
  const got = lib.libraryKindOf(cat as CategoryKey, label);
  expect(got === want, `"${label}" uses the ${want} library`, got);
}
expect(lib.libraryKindOf('learning', 'Something unusual') === 'learning', 'an unknown activity uses its whole category', lib.libraryKindOf('learning', 'Something unusual'));

// SURPRISE ME: uniform among the type's photos, never the previous one while others exist.
for (const kind of ['padel', 'brunch', 'restaurant', 'sport']) {
  const urls: string[] = lib.libraryFor(kind as never);
  const draws: string[] = [];
  let prev: string | null = null;
  let repeats = 0;
  for (let i = 0; i < 50; i++) {
    const u = lib.surprise(urls, [prev]) as string;
    if (u === prev) repeats++;
    draws.push(u);
    prev = u;
  }
  const distinct = new Set(draws).size;
  console.log(`  surprise ${kind}: 50 draws over ${urls.length} photos → ${distinct} distinct, ${repeats} back-to-back repeats`);
  expect(repeats === 0, `surprise ${kind}: never the previous photo twice in a row`);
  expect(distinct >= Math.min(urls.length, 50) * 0.5, `surprise ${kind}: varied (${distinct} distinct in 50 draws)`, distinct);
  expect(draws.every((u) => urls.includes(u)), `surprise ${kind}: always a photo of the type`);
}
expect(lib.surprise(['only'], ['only']) === 'only', 'surprise with a single photo still answers it');
expect(lib.surprise([], []) === null, 'surprise with no photo answers nothing');
// Uniform: 20,000 draws over the padel photos, each within 25% of its fair share.
{
  const urls: string[] = lib.libraryFor('padel');
  const n = 20000;
  const hits = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const u = lib.surprise(urls) as string;
    hits.set(u, (hits.get(u) ?? 0) + 1);
  }
  const fair = n / urls.length;
  const off = [...hits.values()].filter((h) => Math.abs(h - fair) > fair * 0.25);
  expect(hits.size === urls.length && off.length === 0, `surprise padel: uniform over ${urls.length} photos`, [...hits.values()]);
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll photo checks passed');
