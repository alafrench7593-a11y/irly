// Community titles: never an id, a uuid or a digit code (src/features/community/name.ts).
// node --experimental-strip-types --no-warnings --import ./scripts/alias.mjs scripts/test-community-names.mts
import { displayCommunityName, fallbackCommunityName, isTechnicalWord } from '../src/features/community/name.ts';

let failed = 0;
const eq = (got: unknown, want: unknown, label: string) => {
  if (got === want) console.log(`✓ ${label}`);
  else {
    failed++;
    console.error(`✗ ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
};

const gym = { topic: 'gym', cityId: 'dubai' };

// A code alone is never a title: the topic (or category) and the city instead.
eq(displayCommunityName({ name: '3f2a91c0-7d4e-4b1a-9c2d-0e5f6a7b8c9d', ...gym }), 'Gym & Fitness · Dubai', 'uuid → topic and city');
eq(displayCommunityName({ name: 'abc12345', ...gym }), 'Gym & Fitness · Dubai', "'abc12345' → topic and city");
eq(displayCommunityName({ name: '#12345', ...gym }), 'Gym & Fitness · Dubai', "'#12345' → topic and city");
eq(displayCommunityName({ name: '12345', categoryId: 'sport', cityId: 'bali' }), 'Sport · Bali', 'digits only → category and city');
eq(displayCommunityName({ name: '', ...gym }), 'Gym & Fitness · Dubai', 'empty → topic and city');
eq(displayCommunityName({ name: '   ', city_id: 'abudhabi' }), 'Community · Abu Dhabi', 'blank, server row shape → Community and city');
eq(displayCommunityName({ name: null }), 'Community', 'missing everything → Community');
eq(displayCommunityName(null), 'Community', 'no row → Community');

// A code inside a name is dropped, the words stay (test leftovers on the live server).
eq(displayCommunityName({ name: 'Girls Padel mvgq82y1', cityId: 'dubai' }), 'Girls Padel', 'run stamp after the name is dropped');
eq(displayCommunityName({ name: 'Sync club mv00tl2o', cityId: 'bali' }), 'Sync club', 'the old leftover too');
eq(displayCommunityName({ name: 'Photo club mvgq82y1 Bali', cityId: 'bali' }), 'Photo club Bali', 'run stamp in the middle');
eq(displayCommunityName({ name: 'Padel abc12345' }), 'Padel', 'letters and five digits dropped');
eq(displayCommunityName({ name: 'Book & Matcha mvdxpmvc', cityId: 'dubai' }), 'Book & Matcha', 'an all-letter run stamp is dropped');
eq(displayCommunityName({ name: 'Girls Padel mvdx3mvc', cityId: 'dubai' }), 'Girls Padel', 'a run stamp with one digit is dropped');
eq(displayCommunityName({ name: 'Sync club mncukilg', cityId: 'bali' }), 'Sync club', 'a test title with a vowel-rich stamp is fixed');
eq(displayCommunityName({ name: 'Photo club mjehuz5h Bali', cityId: 'bali' }), 'Photo club Bali', 'a test title with the city after the stamp');
eq(displayCommunityName({ name: 'Book & Matcha mbonodxa', cityId: 'dubai' }), 'Book & Matcha', 'Book & Matcha with any stamp');
eq(displayCommunityName({ name: 'Morning marathon', cityId: 'dubai' }), 'Morning marathon', 'a real name with an eight-letter word is kept');
eq(displayCommunityName({ name: 'Padel · 3f2a91c0' }), 'Padel', 'uuid fragment and its separator dropped');

// Valid names are shown exactly as written.
for (const n of ['Book & Matcha', 'Moms Marathon club', 'Networks night', 'IRLY Gym', 'Bali Surf Girls', 'Bump & babies (0–1)', 'Teens (12+)', 'Padel 4x4', 'Run club 2026', 'Cafe2024 crew', 'bali2026', 'Web3 builders', 'Dubai 5K runners', 'Marathon 42km', 'Club 101', 'Les Mamans de Dubaï']) {
  eq(displayCommunityName({ name: n, ...gym }), n, `valid name kept: ${n}`);
}
eq(displayCommunityName({ name: '  Padel   Girls  ' }), 'Padel Girls', 'spaces tidied');

// The word rule on its own.
for (const w of ['mvgq82y1', 'mv00tl2o', 'mvdxpmvc', 'mvdx3mvc', 'abc12345', '#12345', '123456', '3f2a91c0']) eq(isTechnicalWord(w), true, `code: ${w}`);
for (const w of ['Padel', '2026', '5K', '42km', 'bali2026', 'cafe2024', '4x4', 'Web3', '(0–1)', 'marathon', 'networks', 'midnight', 'lifestyle', 'mamans', 'Matcha', 'nightout']) eq(isTechnicalWord(w), false, `word: ${w}`);

eq(fallbackCommunityName({ topic: 'ai', city_id: 'dubai' }), 'AI · Dubai', 'fallback from a server row');
eq(fallbackCommunityName({ topic: 'some_new_topic' }), 'Some New Topic', 'unknown topic in words');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
