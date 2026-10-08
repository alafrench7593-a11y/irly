// The map with profile photos (PR #43), from the demo build, where map tiles load.
// Writes map-shots/*.jpg (390 x 844 at 2x) and map-shots/labels.txt.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(process.argv[2] || 'dist-demo');
const OUT = path.resolve('map-shots');
fs.mkdirSync(OUT, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) f = fs.existsSync(`${f}.html`) ? `${f}.html` : path.join(ROOT, 'index.html');
  r.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(r);
}).listen(8095);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  locale: 'en-US', timezoneId: 'Asia/Dubai', colorScheme: 'dark',
});
await ctx.route(/alafrench7593-a11y\.github\.io\/irly\/photos\/(.+)$/, (route) => {
  const f = `public-photos/${route.request().url().split('/photos/')[1].split('?')[0]}`;
  return fs.existsSync(f) ? route.fulfill({ path: f, contentType: 'image/jpeg' }) : route.continue();
});
await ctx.route(/supabase\.co\//, (route) => route.abort());
await ctx.addInitScript(() => {
  localStorage.setItem('irly-v2', JSON.stringify({ state: {
    onboarded: true, destinationId: 'emirates', cityId: 'dubai', storySeen: 2, communityIntroSeen: true,
    profile: { name: 'Sara', gender: 'woman', age: 29, types: ['expat'], interests: ['sports', 'food', 'travel'], activities: ['padel', 'gym'], languages: ['English'], lookingFor: ['friends'], photoUri: 'irly-avatar:v1:f.2.0.1.0.0.0.0' },
  }, version: 1 }));
  localStorage.setItem('irly-lang', JSON.stringify({ state: { setting: 'en' }, version: 0 }));
});
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 92 });
const labels = async (name) => {
  const l = await page.evaluate(() => [...document.querySelectorAll('[aria-label]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; })
    .map((e) => { const r = e.getBoundingClientRect(); return `"${e.getAttribute('aria-label')}" @${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)}`; }));
  fs.appendFileSync(`${OUT}/labels.txt`, `\n== ${name}\n${l.join('\n')}\n`);
};

await page.goto('http://localhost:8095/map', { waitUntil: 'load' });
await page.waitForLoadState('networkidle').catch(() => {});
await sleep(9000);
await shot('map-0'); await labels('map-0');
// zoom in around the marina and the centre, so clusters open into people
for (let i = 1; i <= 3; i++) {
  await page.mouse.move(195, 430);
  await page.mouse.wheel(0, -260);
  await sleep(3500);
  await shot(`map-${i}`); await labels(`map-${i}`);
}
// the Live filter
const live = page.getByText('Live', { exact: true }).first();
if (await live.count()) { await live.click().catch(() => {}); await sleep(3500); await shot('map-live'); await labels('map-live'); }
// open a person
const person = page.locator('[aria-label*="Layla"], [aria-label*="Samuel"], [aria-label*="Chloé"]').first();
if (await person.count()) { await person.click({ force: true }).catch(() => {}); await sleep(3000); await shot('map-person'); await labels('map-person'); }
await browser.close();
process.exit(0);
