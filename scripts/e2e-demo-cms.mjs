// The editorial back office in the DEMO web build (no server: features/cms/demo
// keeps the team's news, layouts and banners in the browser, with the same
// rules as the server). Journeys, in a real browser, in IRLY (mixte) and
// IRLY Girl:
//   A  news: draft → publish → visible in the right flavour → edit follows → unpublish gone
//   B  Home layout: move two sections, rename one, hide one, save the draft
//      (Home unchanged) → publish (new order) → reload (kept)
//   C  IRLY vs IRLY Girl vs both
//   E  a poll: written in the editor, published, voted, the vote changed, the poll fixed
//   D  a missing photo, an empty layout, the network failing (last feed kept),
//      an interrupted publish (draft kept, nothing published), no repeated
//      requests, no stored file removed by the code
// What the demo cannot show (who may see a Girl item, notifications to the
// right members, the role checks) is covered by supabase/tests/admin_cms.test.sql
// and, once the migration is deployed, by scripts/e2e-cms.mjs (live).
//
//   EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir <dir>
//   node scripts/e2e-demo-cms.mjs <dir> [port] [shots dir]
// Chromium: PW_CHROMIUM (default /opt/pw-browsers/chromium when present).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist = 'dist', port = '8743', shots = 'e2e-shots/demo-cms'] = process.argv.slice(2);
const DIST = path.resolve(dist);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
fs.mkdirSync(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = http
  .createServer((req, res) => {
    let file = path.join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(Number(port));
const BASE = `http://localhost:${port}`;

let passed = 0;
const failures = [];
const check = (ok, label) => {
  if (ok) {
    passed++;
    console.log(`ok  ${label}`);
  } else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};

// A demo member who finished onboarding, in Dubai, in the given space (as the demo stores it).
async function open(browser, space, keep) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/`);
  await page.evaluate(
    ([space, keep]) => {
      localStorage.setItem('irly-v2-demo', JSON.stringify({ state: { onboarded: true, storySeen: 99, communityIntroSeen: true, destinationId: 'emirates', cityId: 'dubai', profile: { name: 'Demo', gender: 'woman', age: 29, types: [], interests: ['food'], activities: ['padel'], languages: ['English'], lookingFor: [] } }, version: 1 }));
      localStorage.setItem('irly-lang-demo', JSON.stringify({ state: { setting: 'en' }, version: 0 }));
      localStorage.setItem('irly-space-demo', JSON.stringify({ state: { space }, version: 1 }));
      if (keep) localStorage.setItem('irly-cms-demo', keep);
    },
    [space, keep ?? null],
  );
  return { ctx, page, errors };
}

const go = async (page, route, wait = 3500) => {
  await page.goto(`${BASE}${route}`);
  await page.waitForTimeout(wait);
};
const demo = async (page, fn, args = {}) => {
  await page.waitForFunction(() => typeof globalThis.__irlyCmsDemo === 'function', null, { timeout: 15000 });
  return page.evaluate(([fn, args]) => globalThis.__irlyCmsDemo(fn, args), [fn, args]);
};
const state = (page) => page.evaluate(() => localStorage.getItem('irly-cms-demo'));
const newsTitles = (page) => page.$$eval('[data-testid="home-news"] [data-testid="news-card"]', (els) => els.map((e) => e.getAttribute('aria-label')));
const bannerTitles = (page) => page.$$eval('[data-testid="home-banner"]', (els) => els.map((e) => e.getAttribute('aria-label')));
// -1: news above banners, 1: banners above news, 0: one is missing.
const newsVsBanners = (page) =>
  page.evaluate(() => {
    const n = document.querySelector('[data-testid="home-news"]');
    const b = document.querySelector('[data-testid="home-banners"]');
    if (!n || !b) return 0;
    return n.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
const row = (page, key) => page.locator(`[data-testid="layout-row-${key}"]`).locator('xpath=..');

const executablePath = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath });
try {
  // ───────── A. News: draft → publish → both flavours → edit → unpublish ─────────
  const m = await open(browser, 'mixte');
  await go(m.page, '/');
  const seeded = await newsTitles(m.page);
  check(seeded.includes('Your Home now has IRLY news') && !seeded.includes('Padel league (draft)'), 'A: the Home shows published news, never a draft');
  await go(m.page, '/admin/actu/new');
  await m.page.getByLabel('Title', { exact: true }).fill('Rooftop yoga at sunrise');
  await m.page.getByLabel('Text', { exact: true }).fill('Every Sunday, 6:30, on a Marina rooftop.');
  await m.page.getByRole('button', { name: 'Save the draft' }).click();
  await m.page.waitForURL(/\/admin\/actu\/d0c5/, { timeout: 10000 }).catch(() => undefined);
  await m.page.waitForTimeout(1500);
  const id = m.page.url().split('/').pop();
  check(/^d0c50000-/.test(id ?? ''), 'A: saving a new item makes a draft with its own id');
  check(await m.page.locator('[data-testid="news-state-draft"]').first().isVisible(), 'A: it is shown as a draft');
  await go(m.page, '/');
  check(!(await newsTitles(m.page)).includes('Rooftop yoga at sunrise'), 'A: a draft is not on the Home');
  await go(m.page, `/admin/actu/${id}`);
  await m.page.getByRole('button', { name: 'Publish now' }).click();
  await m.page.waitForTimeout(2000);
  check(await m.page.locator('[data-testid="news-state-published"]').first().isVisible(), 'A: published');
  await go(m.page, '/');
  check((await newsTitles(m.page)).includes('Rooftop yoga at sunrise'), 'A: published, it is on the IRLY Home');
  await m.page.screenshot({ path: `${shots}/a-mixte-home.png` });
  const g = await open(browser, 'girl', await state(m.page));
  await go(g.page, '/');
  check((await newsTitles(g.page)).includes('Rooftop yoga at sunrise'), 'A: « both »: it is on the IRLY Girl Home too');
  await g.ctx.close();
  await go(m.page, `/admin/actu/${id}`);
  await m.page.getByLabel('Title', { exact: true }).fill('Rooftop yoga at sunset');
  await m.page.getByRole('button', { name: 'Save the draft' }).click();
  await m.page.waitForTimeout(1500);
  await go(m.page, '/');
  const edited = await newsTitles(m.page);
  check(edited.includes('Rooftop yoga at sunset') && !edited.includes('Rooftop yoga at sunrise'), 'A: an edit reaches the Home');
  await go(m.page, `/actu/${id}`);
  check(await m.page.getByText('Every Sunday, 6:30, on a Marina rooftop.').first().isVisible(), 'A: the article opens with its text');
  await go(m.page, `/admin/actu/${id}`);
  await m.page.getByRole('button', { name: 'Unpublish' }).click();
  await m.page.waitForTimeout(1500);
  await go(m.page, '/');
  check(!(await newsTitles(m.page)).includes('Rooftop yoga at sunset'), 'A: unpublished, it leaves the Home');
  await go(m.page, `/actu/${id}`);
  check(await m.page.locator('[data-testid="news-gone"]').first().isVisible(), 'A: its link says it is no longer available');
  // Notified once (the demo counts what the server would send).
  const before = JSON.parse((await state(m.page)) ?? '{}').notified ?? 0;
  const nid = await demo(m.page, 'admin_news_save', { p_id: null, p_news: { title: 'Notify test', body: 'Once only.', notify: true } });
  await demo(m.page, 'admin_news_publish', { p_id: nid });
  await demo(m.page, 'admin_news_unpublish', { p_id: nid });
  await demo(m.page, 'admin_news_publish', { p_id: nid });
  await demo(m.page, 'admin_news_save', { p_id: nid, p_news: { title: 'Notify test, edited', notify: true } });
  const after = JSON.parse((await state(m.page)) ?? '{}').notified ?? 0;
  check(after - before === 1, 'A: notify on: sent once (publish, unpublish, publish again, edit)');
  await demo(m.page, 'admin_news_delete', { p_id: nid });

  // ───────── B. Home layout ─────────
  await go(m.page, '/');
  check((await newsVsBanners(m.page)) === -1, 'B: the app\'s own order: news above banners');
  check(await m.page.getByText('Next up', { exact: true }).first().isVisible().catch(() => false), 'B: « Next up » is on the Home');
  await go(m.page, '/admin/home-layout');
  // One tap at a time: the rows move between taps.
  const tap = async (key, name) => {
    await row(m.page, key).getByRole('button', { name }).click();
    await m.page.waitForTimeout(700);
  };
  await tap('banners', 'Move Banners up');
  await tap('banners', 'Move Banners up');
  await tap('eat', 'Move Find someone to eat with up');
  await tap('news', 'Edit IRLY news');
  await row(m.page, 'news').getByLabel('Title in English', { exact: true }).fill('Team news');
  await row(m.page, 'featured').getByRole('switch').click();
  await m.page.waitForTimeout(500);
  await m.page.screenshot({ path: `${shots}/b-layout-editor.png` });
  await m.page.getByRole('button', { name: 'Save the draft' }).click();
  await m.page.waitForTimeout(1500);
  await go(m.page, '/');
  check((await newsVsBanners(m.page)) === -1 && (await m.page.getByText('IRLY news', { exact: true }).count()) > 0, 'B: draft saved: the Home is unchanged');
  await go(m.page, '/admin/home-layout');
  const draft = await demo(m.page, 'admin_home_layout_get', { p_flavour: 'mixte' });
  check(draft.draft.findIndex((e) => e.key === 'banners') < draft.draft.findIndex((e) => e.key === 'news') && draft.published.length === 0, 'B: the draft holds the new order, nothing published');
  await m.page.getByRole('button', { name: 'Publish', exact: true }).click();
  await m.page.waitForTimeout(2000);
  await go(m.page, '/');
  check((await newsVsBanners(m.page)) === 1, 'B: published: banners now above news');
  check((await m.page.getByText('Team news', { exact: true }).count()) > 0, 'B: published: the new title shows (as written)');
  check((await m.page.getByText('Next up', { exact: true }).count()) === 0 && (await m.page.getByText('Happening now', { exact: true }).count()) === 0, 'B: published: the hidden section is gone');
  await m.page.screenshot({ path: `${shots}/b-home-published.png` });
  await m.page.reload();
  await m.page.waitForTimeout(3500);
  check((await newsVsBanners(m.page)) === 1 && (await m.page.getByText('Team news', { exact: true }).count()) > 0, 'B: after a reload the layout is kept');
  const g2 = await open(browser, 'girl', await state(m.page));
  await go(g2.page, '/');
  check((await newsVsBanners(g2.page)) === -1, 'B: IRLY Girl\'s Home keeps its own (unchanged) layout');

  // ───────── C. IRLY vs IRLY Girl vs both ─────────
  const mixteOnly = await demo(m.page, 'admin_news_save', { p_id: null, p_news: { title: 'Padel night, everyone', body: 'Mixed teams.', audience: 'mixte' } });
  await demo(m.page, 'admin_news_publish', { p_id: mixteOnly });
  await go(m.page, '/');
  const mixteNews = await newsTitles(m.page);
  const mixteBanners = await bannerTitles(m.page);
  await g2.page.evaluate((s) => localStorage.setItem('irly-cms-demo', s), await state(m.page));
  await go(g2.page, '/');
  const girlNews = await newsTitles(g2.page);
  const girlBanners = await bannerTitles(g2.page);
  check(mixteNews.includes('Your Home now has IRLY news') && girlNews.includes('Your Home now has IRLY news'), 'C: a « both » item is in both Homes');
  check(!mixteNews.includes('IRLY Girl brunch circle') && girlNews.includes('IRLY Girl brunch circle'), 'C: an IRLY Girl item is only in IRLY Girl');
  check(mixteNews.includes('Padel night, everyone') && !girlNews.includes('Padel night, everyone'), 'C: an IRLY item is only in IRLY');
  check(mixteBanners.includes('Summer by the sea') && girlBanners.includes('Summer by the sea') && !mixteBanners.includes('Girls’ night out') && girlBanners.includes('Girls’ night out'), 'C: banners follow the same audiences');
  await g2.page.screenshot({ path: `${shots}/c-girl-home.png` });
  check(g2.errors.length === 0, `C: no page error in IRLY Girl${g2.errors.length ? ` (${g2.errors[0]})` : ''}`);
  await g2.ctx.close();

  // ───────── D. Hard cases ─────────
  const broken = await demo(m.page, 'admin_news_save', { p_id: null, p_news: { title: 'Photo missing', body: 'The file is gone.', cover_path: 'https://example.invalid/gone.jpg' } });
  await demo(m.page, 'admin_news_publish', { p_id: broken });
  await go(m.page, '/');
  check((await newsTitles(m.page)).includes('Photo missing'), 'D: an item whose photo cannot load still shows (IRLY\'s photo behind it)');
  // The server answers an empty layout, then a broken one: the app's own Home either way.
  for (const [label, published] of [['an empty layout', []], ['a broken layout', [{ key: 'casino' }, { key: 'footer', enabled: false }, 'x']]]) {
    await m.page.evaluate((published) => {
      const st = JSON.parse(localStorage.getItem('irly-cms-demo'));
      st.layouts.mixte.published = published;
      localStorage.setItem('irly-cms-demo', JSON.stringify(st));
    }, published);
    await go(m.page, '/');
    check((await newsVsBanners(m.page)) === -1 && (await m.page.getByText('IRLY news', { exact: true }).count()) > 0 && (await m.page.getByText('Next up', { exact: true }).count()) > 0,
      `D: ${label}: the app's own Home, every section`);
  }
  // The network fails: the last feed stays on screen.
  await m.page.evaluate(() => localStorage.setItem('irly-cms-demo-fail', 'home_feed'));
  await m.page.reload();
  await m.page.waitForTimeout(4000);
  check((await newsTitles(m.page)).includes('Your Home now has IRLY news'), 'D: network down: the last news known on this phone stay');
  check((await m.page.locator('[data-testid="home-banners"]').count()) > 0, 'D: network down: the banners stay too');
  await m.page.evaluate(() => localStorage.removeItem('irly-cms-demo-fail'));
  // An interrupted publish: the draft is kept, nothing goes live.
  await go(m.page, '/admin/home-layout');
  await row(m.page, 'eat').getByRole('button', { name: 'Move Find someone to eat with up' }).click();
  await m.page.waitForTimeout(700);
  const live = await demo(m.page, 'admin_home_layout_get', { p_flavour: 'mixte' });
  await m.page.evaluate(() => localStorage.setItem('irly-cms-demo-fail', 'admin_home_layout_publish'));
  await m.page.getByRole('button', { name: 'Publish', exact: true }).click();
  await m.page.waitForTimeout(1500);
  check(await m.page.locator('[data-testid="cms-error"]').first().isVisible(), 'D: a publish that fails says so on screen');
  const kept = await demo(m.page, 'admin_home_layout_get', { p_flavour: 'mixte' });
  const order = (l) => l.map((e) => e.key).join(',');
  check(order(kept.published) === order(live.published) && kept.version === live.version && order(kept.draft) !== order(live.published),
    `D: the draft is saved, the published layout untouched (no partial publish) [v${kept.version}]`);
  check(await row(m.page, 'eat').isVisible(), 'D: the editor still shows the draft');
  await m.page.evaluate(() => localStorage.removeItem('irly-cms-demo-fail'));
  // Requests: one feed read per Home visit, none while it sits there or after a round trip in the app.
  await go(m.page, '/', 1500);
  await m.page.evaluate(() => (globalThis.__irlyCmsCalls = {}));
  await m.page.waitForTimeout(10000);
  await m.page.locator('[data-testid="home-news"]').getByText('All', { exact: true }).first().click().catch(() => undefined);
  await m.page.waitForTimeout(1500);
  await m.page.goBack();
  await m.page.waitForTimeout(2000);
  const calls = await m.page.evaluate(() => globalThis.__irlyCmsCalls ?? {});
  check((calls.home_feed ?? 0) === 0, `D: no repeated requests: ${calls.home_feed ?? 0} feed read in 13 s on the Home and back (fresh for a minute)`);
  // No stored file is ever removed by the editorial code.
  const code = ['src/features/cms', 'src/app/admin/actu', 'src/app/actu'].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).map((f) => fs.readFileSync(path.join(ROOT, d, f), 'utf8')));
  code.push(...['src/app/admin/home-layout.tsx', 'src/app/admin/banners.tsx'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')));
  check(code.every((c) => !/\.remove\(|storage\.from\([^)]*\)\.(remove|delete|move|update)\(/.test(c)), 'D: the editorial code never removes, moves or overwrites a stored file');
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261028500000_irly_admin_cms.sql'), 'utf8');
  check(!/delete\s+from\s+storage\.objects|for delete to|for update to/i.test(sql), 'D: the migration gives no rule to delete or change a stored file');
  // ───────── E. A poll on a news item ─────────
  await go(m.page, '/admin/actu/new');
  await m.page.getByLabel('Title', { exact: true }).fill('Which evening for the next IRLY night?');
  await m.page.getByLabel('Text', { exact: true }).fill('Tell us which evening suits you best.');
  await m.page.getByLabel('Add a poll to this news item').first().click();
  await m.page.waitForTimeout(400);
  await m.page.getByLabel('Poll question', { exact: true }).fill('Which evening suits you?');
  const answers = m.page.getByLabel('Poll answer', { exact: true });
  await answers.nth(0).fill('Friday');
  await answers.nth(1).fill('Friday');
  await m.page.waitForTimeout(300);
  check(await m.page.getByRole('button', { name: 'Publish now' }).isDisabled(), 'E: the same answer twice: nothing can be published yet');
  await answers.nth(1).fill('Saturday');
  await m.page.getByRole('button', { name: 'Add an answer' }).click();
  await m.page.getByLabel('Poll answer', { exact: true }).nth(2).fill('Sunday');
  await m.page.getByRole('button', { name: 'Publish now' }).click();
  await m.page.waitForURL(/\/admin\/actu\/d0c5/, { timeout: 10000 }).catch(() => undefined);
  await m.page.waitForTimeout(1500);
  const pid = m.page.url().split('/').pop();
  check(await m.page.locator('[data-testid="news-state-published"]').first().isVisible(), 'E: the item with its poll is published');
  await go(m.page, '/');
  check((await newsTitles(m.page)).includes('Which evening for the next IRLY night?'), 'E: it is on the Home');
  await go(m.page, `/actu/${pid}`);
  const options = m.page.locator('[data-testid="news-poll-option"]');
  check((await options.count()) === 3 && (await m.page.getByText('Which evening suits you?').first().isVisible()), 'E: the article shows the question and its 3 answers');
  await options.nth(1).click();
  await m.page.waitForTimeout(1200);
  check((await options.nth(1).innerText()).includes('100%') && (await m.page.getByText('1 votes').count()) + (await m.page.getByText('1 vote').count()) > 0, 'E: a vote counts at once (Saturday 100%)');
  await options.nth(2).click();
  await m.page.waitForTimeout(1200);
  check((await options.nth(2).innerText()).includes('100%') && (await options.nth(1).innerText()).includes('0%'), 'E: changing the answer moves the vote');
  await go(m.page, `/actu/${pid}`);
  check((await m.page.locator('[data-testid="news-poll-option"]').nth(2).innerText()).includes('100%'), 'E: the vote is kept after a reload');
  await m.page.screenshot({ path: `${shots}/e-poll.png` });
  await go(m.page, `/admin/actu/${pid}`);
  check(await m.page.locator('[data-testid="news-poll-fixed"]').first().isVisible(), 'E: once voted, the editor shows the poll as fixed');
  const refusedPoll = await m.page.evaluate((id) => {
    try {
      globalThis.__irlyCmsDemo('admin_news_save', { p_id: id, p_news: { poll: { question: 'Which evening suits you?', options: ['Friday', 'Saturday'] } } });
      return null;
    } catch (e) {
      return String(e.message);
    }
  }, pid);
  check(refusedPoll === 'a poll cannot change once people voted', 'E: once voted, the poll cannot change');
  await m.page.getByLabel('Title', { exact: true }).fill('Which evening for our next IRLY night?');
  await m.page.getByRole('button', { name: 'Save the draft' }).click();
  await m.page.waitForTimeout(1500);
  check(!(await m.page.locator('[data-testid="cms-error"]').count()), 'E: the rest of a voted item can still be edited');
  check(m.errors.length === 0, `no page error through the journeys${m.errors.length ? ` (${m.errors[0]})` : ''}`);
  await m.ctx.close();
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
