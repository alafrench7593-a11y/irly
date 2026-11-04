// Every main screen of the DEMO web build (no server, nothing saved) at the
// widths IRLY has to serve: small and standard iPhones, a Pro Max, a narrow
// outer screen, a wide inner screen (simulated: no folding iPhone or
// simulator exists to test on), sideways, and a window resized while in use.
// For each screen and size: no horizontal overflow, no page error, a
// screenshot. Sizes are classes of width, not device models.
//
//   EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir <dir>
//   node scripts/e2e-responsive.mjs <dir> [port] [shots dir] [route filter]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist = 'dist', port = '8743', shots = 'e2e-shots/responsive', only = ''] = process.argv.slice(2);
const DIST = path.resolve(dist);
const SHOTS = path.resolve(shots);
fs.mkdirSync(SHOTS, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const server = http
  .createServer((req, res) => {
    let file = path.join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(Number(port));
const BASE = `http://localhost:${port}`;

// Width classes (points). `frame=0` keeps the web phone preview off at every width.
export const SIZES = [
  { name: 'narrow-outer-320', width: 320, height: 700 },
  { name: 'small-375', width: 375, height: 667 },
  { name: 'standard-393', width: 393, height: 852 },
  { name: 'promax-440', width: 440, height: 956 },
  { name: 'inner-wide-portrait-760', width: 760, height: 900 },
  { name: 'inner-wide-square-900', width: 900, height: 860 },
  { name: 'inner-wide-landscape-1100', width: 1100, height: 760 },
  { name: 'phone-landscape-852', width: 852, height: 393 },
];

const ROUTES = [
  ['home', '/'],
  ['discover', '/discover'],
  ['live', '/live'],
  ['profile', '/profile'],
  ['messages', '/messages'],
  ['activities', '/activities'],
  ['communities', '/communities'],
  ['search', '/search'],
  ['notifications', '/notifications'],
  ['settings', '/settings'],
  ['network', '/network'],
  ['girl-home', '/girl'],
  ['events', '/events'],
  ['categories', '/categories'],
].filter(([name]) => !only || name.includes(only));

let passed = 0;
const failures = [];
const check = (ok, label) => {
  if (ok) passed++;
  else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};

async function seed(page, space = 'mixte') {
  await page.goto(`${BASE}/?frame=0`);
  await page.evaluate((space) => {
    localStorage.setItem('irly-v2-demo', JSON.stringify({ state: { onboarded: true, storySeen: 99, communityIntroSeen: true, destinationId: 'emirates', cityId: 'dubai', profile: { name: 'Demo', gender: 'woman', age: 29, types: [], interests: ['food'], activities: ['padel'], languages: ['English'], lookingFor: [] } }, version: 1 }));
    localStorage.setItem('irly-lang-demo', JSON.stringify({ state: { setting: 'en' }, version: 0 }));
    localStorage.setItem('irly-space-demo', JSON.stringify({ state: { space }, version: 1 }));
  }, space);
}

/** Visible elements whose right edge passes the window (horizontal overflow), ignoring horizontal scrollers' content. */
async function overflow(page) {
  return page.evaluate(() => {
    const W = window.innerWidth;
    const out = [];
    const scrollerInside = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') && p.getBoundingClientRect().right <= W + 1) return true;
      }
      return false;
    };
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.position === 'fixed') continue;
      if (r.right > W + 2 && r.left < W && !scrollerInside(el)) {
        out.push(`${el.tagName.toLowerCase()}${el.getAttribute('data-testid') ? '#' + el.getAttribute('data-testid') : ''} "${(el.textContent || '').trim().slice(0, 40)}" right=${Math.round(r.right)}`);
        if (out.length >= 5) break;
      }
    }
    const docOverflow = document.documentElement.scrollWidth > W + 1;
    return { items: out, docOverflow };
  });
}

async function main() {
  const browser = await chromium.launch();
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await seed(page);
    for (const [name, route] of ROUTES) {
      errors.length = 0;
      await page.goto(`${BASE}${route}${route.includes('?') ? '&' : '?'}frame=0`);
      await page.waitForTimeout(3000);
      const o = await overflow(page);
      check(!o.docOverflow && o.items.length === 0, `${size.name} ${name}: no horizontal overflow${o.items.length ? ' — ' + o.items.join(' | ') : ''}`);
      check(errors.length === 0, `${size.name} ${name}: no page error${errors.length ? ' — ' + errors[0].slice(0, 160) : ''}`);
      await page.screenshot({ path: path.join(SHOTS, `${size.name}--${name}.png`) });
    }
    await ctx.close();
  }

  // Resized while in use: a draft typed in search survives narrow → wide → narrow, no reload, no error.
  if (!only || 'search'.includes(only)) {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await seed(page);
    await page.goto(`${BASE}/search?frame=0`);
    await page.waitForTimeout(3000);
    const input = page.locator('input').first();
    const hasInput = (await input.count()) > 0;
    if (hasInput) await input.fill('padel');
    for (const w of [900, 320, 1100, 393]) {
      await page.setViewportSize({ width: w, height: 860 });
      await page.waitForTimeout(900);
    }
    const kept = hasInput ? await page.locator('input').first().inputValue() : 'padel';
    check(kept === 'padel', `resize while typing: search draft kept (${kept})`);
    check(errors.length === 0, `resize while typing: no page error${errors.length ? ' — ' + errors[0].slice(0, 160) : ''}`);
    await page.screenshot({ path: path.join(SHOTS, `resize--search.png`) });
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
