// Communities, plans and the map in the DEMO web build (no server, nothing
// saved): what the demo supports of journey C, in a real browser, in IRLY
// (mixte) and IRLY Girl: lists that never pretend, the creation form's
// checks, the map's Activities layer. The server half of the journey (create, join with
// two accounts, notifications, edit, cancel, delete, map) is covered by
// supabase/tests/communities_activities.test.sql.
//
//   EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir <dir>
//   node scripts/e2e-demo-communities.mjs <dir> [port] [shots dir]
// Chromium: PW_CHROMIUM (default /opt/pw-browsers/chromium when present).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist = 'dist', port = '8742', shots = 'e2e-shots/demo-communities'] = process.argv.slice(2);
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

// The splash and the first render take a moment on a cold load.
const go = async (page, route) => {
  await page.goto(`${BASE}${route}`);
  await page.waitForTimeout(3500);
};

const mine = async (page) => {
  const label = await page.getByText(/^Mine · \d+$/).first().textContent({ timeout: 8000 }).catch(() => null);
  return label ? Number(label.split('·')[1]) : null;
};

async function journey(browser, space) {
  const { ctx, page, errors } = await open(browser, space);
  const girl = space === 'girl';

  // ── Communities ──
  await go(page, '/communities');
  if (girl) {
    // IRLY Girl's official communities are listed in the demo; joining needs a real account:
    // the demo says so and nothing changes (no fake membership).
    const before = await mine(page);
    check(before !== null, 'girl: communities list shows « Mine · n »');
    const join = page.getByRole('button', { name: /^Join / }).first();
    check((await join.count()) > 0, 'girl: a community to join is offered');
    if ((await join.count()) > 0) {
      await join.click();
      await page.waitForTimeout(800);
      check(await page.getByText('Sign in to join IRLY Girl communities').first().isVisible(), 'girl: joining in the demo asks to sign in');
      check((await mine(page)) === before, 'girl: « Mine » unchanged (nothing pretended)');
    }
  } else {
    // IRLY (mixte) communities live on the server only: the demo says so, never a fake list.
    check(await page.getByText('Sign in to see the communities').first().isVisible(), 'mixte: the demo says communities need an account (no fake list)');
  }
  await page.screenshot({ path: `${shots}/${space}-communities.png` });

  // ── New community form: a too-short name cannot be sent ──
  await go(page, girl ? '/girl/new-community' : '/community/new');
  const name = page.getByLabel('Community name');
  const create = page.getByRole('button', { name: girl ? 'Create the community' : 'Create community', exact: true });
  check(await create.isDisabled(), `${space}: « Create » is disabled while the name is empty`);
  await name.fill('ab');
  check(await create.isDisabled(), `${space}: « Create » stays disabled for a 2-letter name`);
  await name.fill('Sunrise Runners');
  check(await create.isEnabled(), `${space}: « Create » is enabled for a valid name`);
  await page.screenshot({ path: `${shots}/${space}-new-community.png` });

  // ── Map: opens on its Activities layer without an error ──
  await go(page, '/map');
  const activities = page.getByText('Activities', { exact: true }).first();
  check(await activities.isVisible(), `${space}: the map shows its Activities layer`);
  await activities.click();
  await page.waitForTimeout(1200);
  check(errors.length === 0, `${space}: no page error through the journey${errors.length ? ` (${errors[0]})` : ''}`);
  await page.screenshot({ path: `${shots}/${space}-map-activities.png` });
  await ctx.close();
}

const executablePath = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath });
try {
  for (const space of ['mixte', 'girl']) await journey(browser, space);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
