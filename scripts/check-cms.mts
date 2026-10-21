// The editorial back office (news, Home layout, banners) checks the same
// rules on the server (supabase/migrations/20261028200000_irly_admin_cms.sql)
// and in the app (src/features/cms): this compares them, checks that every
// screen a button may open exists, and walks the app-side checks a member's
// Home relies on (a broken layout never empties the Home, another flavour's
// feed never shows).
//
//   node --experimental-strip-types --no-warnings --import ./scripts/alias.mjs scripts/check-cms.mts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../src/data/catalog/categories.ts';
import { DESTINATION_PATTERNS, isDestination, SCREEN_ROUTES } from '../src/features/cms/destinations.ts';
import { cleanFeed, NEWS_CATEGORIES } from '../src/features/cms/model.ts';
import { checkLayout, defaultLayout, entryCount, SECTION_SPEC } from '../src/features/cms/layout.ts';
import { HOME_SECTIONS } from '../src/features/home/sections.ts';

const root = path.join(import.meta.dirname, '..');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261028200000_irly_admin_cms.sql'), 'utf8');
let passed = 0;
const fails: string[] = [];
const check = (ok: boolean, what: string) => {
  if (ok) {
    passed++;
    console.log(`  ✓ ${what}`);
  } else {
    fails.push(what);
    console.log(`  ✗ ${what}`);
  }
};
const same = (a: unknown, b: unknown) => {
  try {
    assert.deepEqual(a, b);
    return true;
  } catch {
    return false;
  }
};
const refusal = (fn: () => unknown): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
};
const arrayIn = (fn: string) => {
  const m = sql.match(new RegExp(`function private\\.${fn}\\(\\)[\\s\\S]*?select array\\[([\\s\\S]*?)\\]`));
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
};

console.log('Server and app hold the same rules');
check(same(arrayIn('home_section_keys'), [...HOME_SECTIONS]), `the same Home sections, in the same order (${HOME_SECTIONS.length})`);
check(same(arrayIn('cms_categories'), CATEGORIES.map((c) => c.id)), `the same categories (${CATEGORIES.length})`);
const specBlock = sql.match(/function private\.home_section_spec[\s\S]*?end\)::jsonb/)?.[0] ?? '';
for (const key of HOME_SECTIONS) {
  const m = specBlock.match(new RegExp(`when '${key}' then '([^']*)'`));
  const server = m ? (JSON.parse(m[1]) as Record<string, unknown>) : null;
  const app = SECTION_SPEC[key];
  const appAsServer: Record<string, unknown> = {};
  if (app.pinned) appAsServer.pinned = app.pinned;
  if (app.text) appAsServer.text = true;
  if (app.cta) appAsServer.cta = true;
  if (app.category) appAsServer.category = true;
  if (app.cover) appAsServer.cover = true;
  if (app.styles) appAsServer.styles = [...app.styles];
  if (app.count) appAsServer.count = [app.count[0], app.count[1]];
  check(server !== null && same(server, appAsServer), `section '${key}': same changes allowed on both sides`);
  if (app.count) check(app.count[2] >= app.count[0] && app.count[2] <= app.count[1], `section '${key}': the app's own number of cards is within bounds`);
}
const sqlCats = sql.match(/category text not null default 'news' check \(category in \(([^)]*)\)\)/)?.[1] ?? '';
check(same([...sqlCats.matchAll(/'([^']+)'/g)].map((x) => x[1]), NEWS_CATEGORIES), 'the same news categories');

const dest = sql.match(/function private\.cms_destination_ok[\s\S]*?\$\$;/)?.[0] ?? '';
const screens = dest.match(/'\^\/\(([a-z/|]+)\)\(\\\?/)?.[1]?.split('|') ?? [];
check(same(screens, [...SCREEN_ROUTES]), `the same screens a button may open (${SCREEN_ROUTES.length})`);
const sqlPatterns = [...dest.matchAll(/p ~ '([^']+)'/g)].map((x) => x[1]);
const appPatterns = DESTINATION_PATTERNS.map((re) => re.source.replace(/\\\//g, '/'));
check(sqlPatterns.length === 4 && appPatterns.length === 4, 'four kinds of links on both sides');
check(sqlPatterns[1] === appPatterns[1] && sqlPatterns[2] === appPatterns[2], 'the same rules for /category/…, /c/<id>, /actu/<id>…');

console.log('Every screen a button may open exists');
const app = path.join(root, 'src/app');
const exists = (route: string) => {
  const segs = route.split('/');
  const dir = path.join(app, ...segs);
  const tabs = path.join(app, '(tabs)', ...segs);
  return [`${dir}.tsx`, path.join(dir, 'index.tsx'), `${tabs}.tsx`, path.join(tabs, 'index.tsx')].some((f) => fs.existsSync(f));
};
for (const r of SCREEN_ROUTES) check(exists(r), `/${r}`);
for (const r of ['category', 'activities', 'space', 'place', 'c', 'a', 'actu', 'person']) {
  const dir = path.join(app, r);
  check(fs.existsSync(dir) && fs.readdirSync(dir).some((f) => /^\[.+\]\.tsx$/.test(f)), `/${r}/<id>`);
}

console.log('Links');
for (const ok of ['/discover', '/category/beach', '/girl/match', '/discover?tab=people', '/actu/0b6f1a2c-1111-4222-8333-444455556666', 'https://getirly.com/app', 'https://www.instagram.com/irlyofficial/', null, ''])
  check(isDestination(ok), `accepted: ${JSON.stringify(ok)}`);
for (const bad of ['javascript:alert(1)', 'http://example.com', '/admin', '/admin/actu', '//evil.com', 'https://', '/c/not-an-id', 'https://x.com/<script>', `/discover?${'a'.repeat(120)}`])
  check(!isDestination(bad), `refused: ${JSON.stringify(bad.slice(0, 40))}`);

console.log('Layouts (app side)');
const keys = (raw: unknown) => checkLayout(raw).map((e) => e.key);
check(same(keys([]), [...HOME_SECTIONS]) && same(keys(undefined), [...HOME_SECTIONS]) && same(keys({ sections: 1 }), [...HOME_SECTIONS]), 'nothing usable: the app\'s own Home');
check(same(checkLayout(HOME_SECTIONS.map((key) => ({ key, enabled: key === 'search' || key === 'footer' }))), defaultLayout()), 'a layout that hides every section: the whole Home instead');
const moved = keys([{ key: 'search' }, { key: 'eat' }, { key: 'people' }]);
check(moved[1] === 'eat' && moved[2] === 'people' && moved.length === HOME_SECTIONS.length && moved.at(-1) === 'footer', 'a moved section keeps its place; the others follow in the app\'s order');
const lenient = checkLayout([{ key: 'casino' }, { key: 'news', style: 'neon', count: 99, title_fr: 42 }, { key: 'news' }]);
const news = lenient.find((e) => e.key === 'news');
check(!lenient.some((e) => (e.key as string) === 'casino') && news?.style === undefined && news?.count === undefined && news?.title_fr === undefined, 'a member\'s Home ignores what it cannot use');
check(entryCount(news, 'news') === 5 && entryCount({ key: 'people', enabled: true, count: 6 }, 'people') === 6, 'card numbers: the team\'s within bounds, else the app\'s');
const strict = (raw: unknown) => refusal(() => checkLayout(raw, true));
check(strict([{ key: 'casino' }]) === 'unknown section', 'back office: unknown section refused');
check(strict([{ key: 'news' }, { key: 'news' }]) === 'a section is listed twice', 'back office: a section twice refused');
check(strict([{ key: 'news', style: 'neon' }]) === 'this section has no such style', 'back office: unknown style refused');
check(strict([{ key: 'news', count: 11 }]) === 'number of cards out of range', 'back office: too many cards refused');
check(strict([{ key: 'categories', title_fr: 'x' }]) === 'this section cannot change that', 'back office: a title where there is none refused');
check(strict([{ key: 'eat', cta_url: 'http://x.com' }]) === 'invalid destination', 'back office: bad link refused');
check(strict([{ key: 'nearby', category: 'casino' }]) === 'unknown category', 'back office: unknown category refused');
check(strict([{ key: 'news' }, { key: 'search' }]) === 'search stays first and the footer last', 'back office: search stays first');
check(strict([{ key: 'news', colour: 'red' }]) === 'unknown field', 'back office: unknown field refused');
check(strict([{ key: 'news', title_en: 'x'.repeat(61) }]) === 'a section title is at most 60 characters', 'back office: a title of 61 characters refused');

console.log('Feeds');
const row = { id: '0b6f1a2c-1111-4222-8333-444455556666', title: 'Hello', category: 'event', publish_at: '2026-10-01T10:00:00Z', audience: 'both' };
const girlAsked = cleanFeed({ space: 'mixte', layout: { sections: [{ key: 'search' }] }, news: [row], banners: [{ id: 'b', title: 'B' }] }, 'girl');
check(girlAsked !== null && girlAsked.news.length === 0 && girlAsked.banners.length === 0 && girlAsked.layout === null, 'asked for IRLY Girl, answered for IRLY: nothing of it shows in the Girl Home');
const mixed = cleanFeed({ space: 'mixte', layout: null, news: [row, { id: 'nope', title: 'x' }, { ...row, id: '0b6f1a2c-1111-4222-8333-444455556667', title: '' }, null], banners: [{ title: 'no id' }] }, 'mixte');
check(mixed !== null && mixed.news.length === 1 && mixed.banners.length === 0, 'rows without what a card needs are left out');
check(cleanFeed(null, 'mixte') === null && cleanFeed('x', 'mixte') === null, 'an unreadable answer is not a feed (the last good one stays)');

console.log(`\n${passed} passed, ${fails.length} failed`);
if (fails.length) {
  console.error('Failed:\n- ' + fails.join('\n- '));
  process.exit(1);
}
