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
// `NAME = {` or `NAME: Type = {`: the object literal that follows the name.
const block = (name: string) => {
  const start = official.indexOf('{', official.search(new RegExp(`\\b${name}\\b[^=]*= \\{`)));
  return Object.fromEntries([...official.slice(start, official.indexOf('}', start)).matchAll(/(\w+): '(\w+)'/g)].map((m) => [m[1], m[2]]));
};
const TOPIC_PHOTO = block('TOPIC_PHOTO');
const DUBAI_INSTEAD = block('DUBAI_INSTEAD');
const GIRL_OFFICIAL = block('GIRL_OFFICIAL_PHOTO');
const CATEGORY_PHOTO = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.photo]));
const communityPhoto = (topic: string | null, categoryId: string | null, name?: string) => {
  if (topic && GIRL_OFFICIAL[topic]) return GIRL_OFFICIAL[topic];
  if (topic === 'girls' && name) return girlPhotoFor(name, TOPIC_PHOTO.girls);
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
  ['sport', 'Padel', ['padelMix', 'padel']],
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
  ['food', 'Fine dining', ['dinnerView', 'fineDining']],
  ['sport', 'Dance', ['dance']],
  ['sport', 'Boxing', ['boxing']],
  ['animals', 'Pet cafes', ['petCafe']],
  ['animals', 'Desert horse ride', ['horseRiding']],
  ['travel', 'Musandam dhow cruise', ['dhow']],
  ['outings', 'Walks', ['nature']],
  ['travel', 'Downtown walk', ['burjKhalifa']],
  ['travel', 'Heart of Sharjah heritage walk', ['sharjah']],
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
expect(communityPhoto('wellness', null, 'IRLY Wellness') === 'yoga', 'IRLY Wellness (everyone) is not a photo of women at a spa', communityPhoto('wellness', null, 'IRLY Wellness'));
expect(!/Girl$|^girl/.test(ideaPhoto('sport', 'Padel')), 'Mixte padel shows a photo that is not of women only', ideaPhoto('sport', 'Padel'));

// IRLY Girl's official communities (its four, Girl CEO, the retired Francophone): each its own photo, all IRLY's own photos taken in Dubai.
{
  const src = fs.readFileSync('src/features/girl/GirlOfficial.tsx', 'utf8');
  expect(/const PHOTO: Record<GirlOfficialTopic, PhotoKey> = GIRL_OFFICIAL_PHOTO;/.test(src), 'Girl official card takes its photo from GIRL_OFFICIAL_PHOTO (official.ts)');
  const map = GIRL_OFFICIAL;
  // The community page, thumbnail and chat header (communityPhoto) show the card's photo, whatever the name says.
  for (const [topic, name] of topics.filter(([t]) => t.startsWith('girl_'))) expect(communityPhoto(topic, null, name) === map[topic], `${name}: page photo = card photo (${map[topic]})`, communityPhoto(topic, null, name));
  for (const topic of Object.keys(map)) expect(communityPhoto(topic, 'communities', 'Padel and dinner') === map[topic], `${topic}: topic photo before name`, communityPhoto(topic, 'communities', 'Padel and dinner'));
  const own = new Set(listOf('OWN'));
  expect(Object.keys(map).length === 6 && Object.values(map).every((k) => own.has(k)), 'Girl official communities: six photos, all IRLY\'s own', map);
  expect(new Set(Object.values(map)).size === 6, 'Girl official communities: no photo twice', map);
}
// IRLY Girls' groups: IRLY's photos of women, never a mixed group.
for (const s of subtopics.filter((g) => g.parent === 'girls')) {
  const key = communityPhoto('girls', null, s.name);
  expect(!/Mix$/.test(key) && key === girlPhotoFor(s.name, TOPIC_PHOTO.girls), `girls group ${s.name} → ${key} (photos of women)`, key);
}
// Classic help and lifestyle communities: not a photo of women only.
for (const topic of ['help', 'lifestyle']) expect(Boolean(TOPIC_PHOTO[topic]) && !/Girl$|^girl/.test(TOPIC_PHOTO[topic]), `${topic} topic → ${TOPIC_PHOTO[topic]} (not gendered)`, TOPIC_PHOTO[topic]);
// Every own photo exists at both sizes.
const ownMissing = listOf('OWN').filter((k) => !['480', '1200'].every((w) => fs.existsSync(`site/img/own/${k}-${w}.jpg`)));
expect(ownMissing.length === 0, 'every own photo has its 480 and 1200 files', ownMissing);

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
// Every photo IRLY sent is offered in the IRLY library (under at least one type of activity).
const inLibrary = new Set(Object.values(lib.KIND_KEYS).flat() as string[]);
const ownNotInLibrary = listOf('OWN').filter((k) => !inLibrary.has(k));
expect(!ownNotInLibrary.length, 'every IRLY own photo is in the IRLY library', ownNotInLibrary);
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

// 6. Stock photo of an activity without a photo of its own (cover_path null): a hash of its id, not the order screens appear in.
{
  const { photo, variantsOf } = await import('../src/data/photos.ts');
  const { VARIANTS } = await import('../src/data/photoVariants.ts');
  const twice = Object.entries(VARIANTS).filter(([, urls]) => new Set(urls).size !== urls.length).map(([k]) => k);
  expect(twice.length === 0, `no link twice within a key (${Object.keys(VARIANTS).length} keys)`, twice);
  const id = '8f14e45f-ceea-467f-a0e6-5f7b7a1c2d3e';
  const first = photo('footballMix', 500, `srv-${id}`);
  // Other keys and seeds asked in between: the activity keeps its photo.
  for (let i = 0; i < 7; i++) photo('footballMix', 500, `srv-other-${i}`);
  photo('footballMix', 500);
  expect(photo('footballMix', 500, `a-${id}`) === first && photo('footballMix', 500, `${id}-thumb`) === first, 'same seed → same photo (card, page, thumb)', [first, photo('footballMix', 500, `a-${id}`)]);
  for (const [cat, label] of [['sport', 'Football'], ['sport', 'Padel'], ['sport', 'Running'], ['sport', 'Tennis'], ['food', 'Brunch'], ['food', 'Dinner'], ['sport', 'Gym session']] as const) {
    const key = ideaPhoto(cat, label);
    const urls = Array.from({ length: 50 }, (_, i) => photo(key, 500, `srv-${i.toString(16).padStart(8, '0')}-4a1b-9c2d-${i}`));
    const distinct = new Set(urls).size;
    const pool = variantsOf(key).length + 1;
    expect(distinct >= Math.min(4, pool) && pool >= 3, `50 "${label}" activities (${key}) → ${distinct} distinct photos of ${pool}`, { distinct, pool });
  }
  // IRLY Girl: a key of women keeps IRLY's photo of women.
  const girlUrls = new Set(Array.from({ length: 30 }, (_, i) => photo('padelGirl', 500, `srv-g${i}`, false, true)));
  expect(girlUrls.size === 1 && [...girlUrls][0].includes('/own/padelGirl-'), 'Girl: padelGirl always shows IRLY\'s photo of women', [...girlUrls]);
  expect(variantsOf('footballMix', true).length > 0, 'Girl: a mixed key still varies (not a key of women)');
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll photo checks passed');
