// Activities on the Map tab, in the DEMO web build (no server, nothing saved):
// the demo's example plans are pins (by category, clustered when dense), a
// tap opens the plan's card (title, time, going / spots, community, Open),
// Open leads to its page, and « See on the map » on a plan's page opens the
// map on it. Map tiles may be unreachable (sandbox): the pins and cards are
// IRLY's own layer and must render anyway, without a page error. The server
// half (which plans, where) is supabase/tests/map_activities.test.sql.
//
//   EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir <dir>
//   node scripts/e2e-demo-map.mjs <dir> [port] [shots dir]
// Chromium: PW_CHROMIUM (default /opt/pw-browsers/chromium when present).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist = 'dist', port = '8743', shots = 'e2e-shots/demo-map'] = process.argv.slice(2);
const DIST = path.resolve(dist);
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
async function open(browser, space) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/`);
  await page.evaluate((space) => {
    localStorage.setItem('irly-v2-demo', JSON.stringify({ state: { onboarded: true, storySeen: 99, communityIntroSeen: true, destinationId: 'emirates', cityId: 'dubai', profile: { name: 'Demo', gender: 'woman', age: 29, types: [], interests: ['food'], activities: ['padel'], languages: ['English'], lookingFor: [] } }, version: 1 }));
    localStorage.setItem('irly-lang-demo', JSON.stringify({ state: { setting: 'en' }, version: 0 }));
    localStorage.setItem('irly-space-demo', JSON.stringify({ state: { space }, version: 1 }));
  }, space);
  return { ctx, page, errors };
}

const go = async (page, route) => {
  await page.goto(`${BASE}${route}`);
  await page.waitForTimeout(3500);
};

/** Shows the Activities layer only (every plan, whatever the zoom). */
async function activitiesLayer(page) {
  await page.getByText('Activities', { exact: true }).first().click();
  await page.waitForTimeout(1200);
}

/** The demo's IRLY Girl plans (data/content/girlDemo.ts): title, id, spots, place. */
const PLANS = [
  ['Padel 2v2, intermediate', 'ga-padel', 4, 'JLT Padel Courts'],
  ['Sunrise yoga at Kite Beach', 'ga-yoga', 12, 'Kite Beach'],
  ['Girls brunch in Jumeirah', 'ga-brunch', 8, 'A terrace on Jumeirah Beach Road'],
  ['Coffee morning in Al Quoz', 'ga-coffee', 6, 'Alserkal Avenue'],
  ['Shopping afternoon & matcha', 'ga-shopping', 5, 'Dubai Mall'],
];

/** The first plan whose pin is on screen (a pin is a button named after its plan). */
async function pinOnScreen(page) {
  const view = page.viewportSize();
  for (const plan of PLANS) {
    const pin = page.getByRole('button', { name: plan[0], exact: true }).first();
    if (!(await pin.count())) continue;
    const b = await pin.boundingBox();
    if (b && b.x > 0 && b.y > 120 && b.x + b.width < view.width && b.y + b.height < view.height - 160) return { pin, plan };
  }
  return null;
}

async function girlJourney(browser) {
  const { ctx, page, errors } = await open(browser, 'girl');
  await go(page, '/map');
  await activitiesLayer(page);
  let pins = 0;
  for (const plan of PLANS) pins += await page.getByRole('button', { name: plan[0], exact: true }).count();
  check(pins > 0, `girl: the demo plans are pins on the map (${pins} around the view)`);
  await page.screenshot({ path: `${shots}/girl-map.png` });

  // A plan's card: its title, when, going / spots, where, Open.
  const found = await pinOnScreen(page);
  check(Boolean(found), `girl: a plan's pin is on screen${found ? ` (${found.plan[0]})` : ''}`);
  if (found) {
    const [title, id, spots, place] = found.plan;
    await found.pin.click();
    await page.waitForTimeout(1500);
    check(await page.getByText(title, { exact: true }).first().isVisible(), 'girl: tapping it opens its card (title)');
    check(await page.getByText(`/ ${spots} going`, { exact: false }).first().isVisible(), 'girl: the card says going out of the spots');
    check(await page.getByText(place, { exact: false }).first().isVisible(), 'girl: the card says where and when');
    const openBtn = page.getByRole('button', { name: 'Open', exact: true }).first();
    check(await openBtn.isVisible(), 'girl: the card offers Open');
    await page.screenshot({ path: `${shots}/girl-card.png` });
    await openBtn.click();
    await page.waitForTimeout(2500);
    check(page.url().includes(`/a/${id}`), `girl: Open leads to the plan's page (${page.url()})`);
  }

  // « See on the map » from the plan's page: the map, centred on it, its card open.
  await go(page, '/a/ga-yoga');
  const see = page.getByRole('button', { name: 'See on the map' }).first();
  check(await see.isVisible(), 'girl: the plan page offers « See on the map »');
  await see.click();
  await page.waitForTimeout(3500);
  check(page.url().includes('/map') && page.url().includes('activity=ga-yoga'), `girl: it opens the map on that plan (${page.url()})`);
  // (The plan's page stays mounted under the map in the stack: only what is visible counts.)
  check((await page.getByText('Sunrise yoga at Kite Beach', { exact: true }).filter({ visible: true }).count()) > 0
    && (await page.getByText('/ 12 going', { exact: false }).filter({ visible: true }).count()) > 0, 'girl: the map shows that plan\'s card');
  await page.screenshot({ path: `${shots}/girl-see-on-map.png` });

  // An unknown plan: the map says it is not there (never a wrong pin).
  await go(page, '/map?activity=ga-nothing-here');
  check(await page.getByText('This activity is not on the map right now').first().isVisible().catch(() => false), 'girl: a plan not on the map is said so');

  check(errors.length === 0, `girl: no page error${errors.length ? ` (${errors[0]})` : ''}`);
  await ctx.close();
}

async function mixteJourney(browser) {
  const { ctx, page, errors } = await open(browser, 'mixte');
  await go(page, '/map');
  await activitiesLayer(page);
  const markers = await page.locator('[role="button"][aria-label]').count();
  check(markers > 0, `mixte: the demo's plans are on the map (${markers} buttons)`);
  await page.screenshot({ path: `${shots}/mixte-map.png` });
  check(errors.length === 0, `mixte: no page error${errors.length ? ` (${errors[0]})` : ''}`);
  await ctx.close();
}

const executablePath = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath });
try {
  await girlJourney(browser);
  await mixteJourney(browser);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
