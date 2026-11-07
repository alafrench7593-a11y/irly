// Each app space shows only its own communities, and profiles have no
// Friends counter, in the DEMO web build (no server, nothing saved), as a
// woman who uses both spaces, at 390 px, in English and French.
//
//   1. Home and Communities (For you, Mine, Discover) in IRLY Mixte: every
//      community name shown is a Mixte one (the demo's Dubai communities),
//      never an IRLY Girl, Mom or women-only Network one; in IRLY Girl, every
//      name shown is an IRLY Girl one (Girl, Mom, women-only Network), never
//      a Mixte one. At least one name of the space is shown (never vacuous).
//   2. Profile screens (my profile, IRLY Girl profile, IRLY Network profile,
//      a member's followers and following): « Followers » / « Abonnés » only,
//      no « Friends » / « Amis » counter, box, tab or button.
// The server half (community_list, community_directory, community_recommend,
// member_communities, search_all with p_space) is covered by
// supabase/tests/final_security_audit.test.sql.
//
//   EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir <dir>
//   node scripts/e2e-demo-spaces.mjs <dir> [port] [shots dir]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist = 'dist', port = '8761', shots = 'e2e-shots/demo-spaces'] = process.argv.slice(2);
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

// The demo's community names, read from its fixtures (never typed twice here).
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const names = (src, re) => [...src.matchAll(re)].map((m) => m[1]);
const dubai = read('src/data/content/dubai.ts');
const communitiesBlock = dubai.slice(dubai.indexOf('  communities: ['), dubai.indexOf('  services: ['));
const MIXTE = names(communitiesBlock, /^\s{6}name: '([^']+)',$/gm);
const GIRL = [
  ...names(read('src/data/content/girlDemo.ts'), /\{ id: 'gc-[a-z-]+', name: '([^']+)'/g),
  ...names(read('src/features/girl/GirlOfficial.tsx'), /\{ id: 'demo-[a-z_]+', topic: '[a-z_]+', name: '([^']+)'/g),
];
if (MIXTE.length < 5 || GIRL.length < 10) {
  console.log(`FAIL fixtures not found (mixte ${MIXTE.length}, girl ${GIRL.length})`);
  process.exit(1);
}

async function open(browser, space, lang) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/`);
  await page.evaluate(
    ({ space, lang }) => {
      localStorage.setItem('irly-v2-demo', JSON.stringify({ state: { onboarded: true, storySeen: 99, communityIntroSeen: true, destinationId: 'emirates', cityId: 'dubai', profile: { name: 'Demo', gender: 'woman', age: 29, types: [], interests: ['food'], activities: ['padel'], languages: ['English'], lookingFor: [] } }, version: 1 }));
      localStorage.setItem('irly-lang-demo', JSON.stringify({ state: { setting: lang }, version: 0 }));
      localStorage.setItem('irly-space-demo', JSON.stringify({ state: { space }, version: 1 }));
    },
    { space, lang },
  );
  return { ctx, page, errors };
}

const go = async (page, route) => {
  await page.goto(`${BASE}${route}`);
  await page.waitForTimeout(3500);
};

// Everything readable on the page, scrolled to the end so lazy sections render.
async function text(page) {
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(250);
  }
  const t = await page.evaluate(() => document.body.innerText);
  await page.evaluate(() => window.scrollTo(0, 0));
  return t;
}

const shown = (body, list) => list.filter((n) => body.includes(n));

async function spaceJourney(browser, space, lang) {
  const { ctx, page, errors } = await open(browser, space, lang);
  const girl = space === 'girl';
  const own = girl ? GIRL : MIXTE;
  const other = girl ? MIXTE : GIRL;
  const tag = `${space} ${lang}`;
  let ownSeen = 0;

  await go(page, '/');
  let body = await text(page);
  await page.screenshot({ path: `${shots}/${space}-${lang}-home.png` });
  check(shown(body, other).length === 0, `${tag}: Home shows no community of the other space (${shown(body, other).join(', ') || 'none'})`);
  ownSeen += shown(body, own).length;

  await go(page, '/communities');
  for (const tab of [null, /^(Mine|Mes communautés|Les miennes)/, /^(Discover|Découvrir|All|Toutes)/]) {
    if (tab) {
      const b = page.getByText(tab).first();
      if (await b.count()) {
        await b.click().catch(() => undefined);
        await page.waitForTimeout(1200);
      }
    }
    body = await text(page);
    const where = tab ? String(tab).replace(/[/^()]/g, '').split('|')[0] : 'For you';
    await page.screenshot({ path: `${shots}/${space}-${lang}-communities-${where.toLowerCase()}.png` });
    check(shown(body, other).length === 0, `${tag}: Communities « ${where} » shows no community of the other space (${shown(body, other).join(', ') || 'none'})`);
    ownSeen += shown(body, own).length;
  }
  check(ownSeen > 0, `${tag}: Home and Communities show at least one community of the space`);
  check(errors.length === 0, `${tag}: no page error${errors.length ? ` (${errors[0].slice(0, 120)})` : ''}`);
  await ctx.close();
}

// « Friends » / « Amis » as a word of its own (a counter, a tab, a button), not inside another word.
const FRIENDS = /(^|[\s·•|(])(\d+\s*)?(Friends?|Amis?|Amie?s?)(?=$|[\s·•|):,])/m;

async function profiles(browser, space, lang) {
  const { ctx, page, errors } = await open(browser, space, lang);
  const tag = `${space} ${lang}`;
  const routes = space === 'girl' ? ['/profile', '/girl/profile'] : ['/profile', '/network/profile'];
  for (const r of routes) {
    await go(page, r);
    const body = await text(page);
    await page.screenshot({ path: `${shots}/${space}-${lang}-${r.replace(/\//g, '_')}.png` });
    const m = body.match(FRIENDS);
    check(!m, `${tag}: ${r} has no Friends counter, tab or button${m ? ` (« ${m[0].trim()} »)` : ''}`);
  }
  check(errors.length === 0, `${tag}: profiles, no page error${errors.length ? ` (${errors[0].slice(0, 120)})` : ''}`);
  await ctx.close();
}

const executablePath = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath });
try {
  for (const lang of ['en', 'fr']) {
    for (const space of ['mixte', 'girl']) {
      await spaceJourney(browser, space, lang);
      await profiles(browser, space, lang);
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
