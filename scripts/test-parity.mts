/**
 * IRLY and IRLY Girl share one Home: the same sections, in the same order,
 * with the same components (features/home/sections, HOME_SECTIONS). This
 * renders nothing; it checks the list and how the Home and Discover use it.
 *   node --experimental-strip-types --no-warnings --import ./scripts/alias.mjs scripts/test-parity.mts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { HOME_SECTIONS, homeSections } from '../src/features/home/sections.ts';
import { checkLayout } from '../src/features/cms/layout.ts';

const fails: string[] = [];
const check = (ok: boolean, what: string) => (ok ? console.log(`  ✓ ${what}`) : (console.log(`  ✗ ${what}`), fails.push(what)));
const root = path.join(import.meta.dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');

// 1. One list, the same in both spaces.
const mixte = homeSections('mixte');
const girl = homeSections('girl');
check((() => { try { assert.deepEqual([...girl], [...mixte]); return true; } catch { return false; } })(), `same Home sections in IRLY and IRLY Girl (${mixte.length})`);
check(new Set(HOME_SECTIONS).size === HOME_SECTIONS.length, 'no section twice');
const count = (id: string) => HOME_SECTIONS.filter((s) => s === id).length;
check(count('categories') === 1, 'exactly one « Discover activities »');
check(!(HOME_SECTIONS as readonly string[]).includes('byCategory'), 'no « Activities by category » (members\' plans are « Planned by members »)');
check(!(HOME_SECTIONS as readonly string[]).includes('find'), 'no « Find something to do » section');
check(count('members') === 1, 'exactly one « Planned by members »');
check(HOME_SECTIONS[0] === 'search' && HOME_SECTIONS.at(-1) === 'footer', 'search first, footer last');
check(HOME_SECTIONS[1] === 'today', '« Real plans, today » right after Live now (in search)');
check(!(HOME_SECTIONS as readonly string[]).includes('events'), 'no « Events this week » on the Home');
console.log(`  order: ${HOME_SECTIONS.join(' › ')}`);

// 2. The Home renders that list, every section has its case, and no Girl-only block is left.
const home = read('src/app/(tabs)/index.tsx');
// The order comes from the team's published layout (features/cms/layout), which falls back to HOME_SECTIONS.
check(/useHomeLayout\(/.test(home) && /entries\.filter\(\(e\) => e\.enabled\)\.map\(/.test(home), 'Home renders the layout\'s sections (useHomeLayout → entries.map(…))');
const keys = (raw: unknown) => checkLayout(raw).map((e) => e.key);
check((() => { try { assert.deepEqual(keys([]), [...HOME_SECTIONS]); assert.deepEqual(keys(null), [...HOME_SECTIONS]); assert.deepEqual(keys('broken'), [...HOME_SECTIONS]); return true; } catch { return false; } })(),
  'no layout, an empty or a broken one: the Home is HOME_SECTIONS, in order');
check((() => { try { assert.deepEqual(keys([{ key: 'casino' }, { key: 'eat' }]).filter((k) => k !== 'eat'), [...HOME_SECTIONS].filter((k) => k !== 'eat')); return true; } catch { return false; } })(),
  'an unknown section is ignored, every known one stays');
check(checkLayout(HOME_SECTIONS.map((key) => ({ key, enabled: false }))).every((e) => e.enabled), 'a layout hiding everything falls back to the whole Home');
check((() => { const l = keys([{ key: 'footer' }, { key: 'news' }, { key: 'search' }]); return l[0] === 'search' && l.at(-1) === 'footer'; })(), 'whatever the layout says, search stays first and the footer last');
for (const id of HOME_SECTIONS) check(home.includes(`case '${id}':`), `Home renders section '${id}'`);
const gone = ['MomsView', 'GirlMessages', 'GirlModes', 'MatchCard', 'GirlMovingCard', 'GirlFeed', 'GirlPlans', 'KindRail'];
for (const name of gone) check(!new RegExp(`\\b${name}\\b`).test(home), `Home has no Girl-only block ${name}`);
const discoverGrid = (home.match(/<DiscoverCategories\b/g) ?? []).length;
check(discoverGrid === 1, `one <DiscoverCategories> in the Home source (${discoverGrid})`);
check(!/<ActivitiesByCategory\b/.test(home), 'no <ActivitiesByCategory> in the Home source');
check(!/Find something to do|FindSomethingToDo/.test(home), 'no « Find something to do » block in the Home source');
check((home.match(/<MemberActivities\b/g) ?? []).length === 1, 'one <MemberActivities> in the Home source');

// 3. Discover: the same four pages in both spaces (no Girl-only page components).
const discover = read('src/app/(tabs)/discover.tsx');
check(!/title="Find something to do"/.test(read('src/features/discover/DiscoverPages.tsx')), 'no « Find something to do » section in Discover');
check(/const pages = \[PeoplePage, ActivitiesPage, PlacesPage, EventsPage\];/.test(discover), 'Discover uses the same four pages in both spaces');
check(!/GirlPeoplePage|GirlActivitiesPage/.test(discover + read('src/features/girl/GirlSections.tsx')), 'no GirlPeoplePage / GirlActivitiesPage left');

if (fails.length) {
  console.error(`\nparity: ${fails.length} failed`);
  process.exit(1);
}
console.log('\nparity ok: IRLY and IRLY Girl share the Home and Discover structure');
