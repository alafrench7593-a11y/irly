/**
 * Screens of the demonstration build for the website (site/shots/*.jpg)
 * and a real map of Dubai for the "Your city" chapter (site/shots/dubai-map.jpg).
 * Runs in CI where photos and map tiles are reachable.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.argv[2] || 'dist-demo';
const OUT = 'site/shots';
fs.mkdirSync(OUT, { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.json': 'application/json' };
const srv = http
  .createServer((q, r) => {
    let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) f = fs.existsSync(`${f}.html`) ? `${f}.html` : path.join(ROOT, 'index.html');
    r.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream');
    fs.createReadStream(f).pipe(r);
  })
  .listen(8095);

const browser = await chromium.launch();
const errors = [];

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US', colorScheme: 'dark' });
  // Photos not deployed yet (new portraits) come from this checkout.
  await ctx.route(/alafrench7593-a11y\.github\.io\/irly\/photos\/(.+)$/, (route) => {
    const f = `public-photos/${route.request().url().split('/photos/')[1]}`;
    return fs.existsSync(f) ? route.fulfill({ path: f, contentType: 'image/jpeg' }) : route.continue();
  });
  // The demo build needs no server.
  await ctx.route(/supabase\.co\//, (route) => route.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8095/');
  await page.evaluate(() => {
    localStorage.setItem('irly-v2', JSON.stringify({ state: { onboarded: true, destinationId: 'emirates', cityId: 'dubai', profile: { name: 'Sara', gender: 'woman', age: 29, types: [], interests: ['startups', 'food'], activities: ['padel'], languages: ['English'], lookingFor: [] } }, version: 1 }));
    localStorage.setItem('irly-lang', JSON.stringify({ state: { setting: 'en' }, version: 0 }));
  });
  return { ctx, page };
}

// [file, route, wait ms, optional action]
const SHOTS = [
  ['home', '/', 6000],
  ['home-scroll', '/', 6000, (p) => p.mouse.wheel(0, 900)],
  ['people', '/social', 5000],
  ['category', '/category/sport', 5000],
  ['map', '/map', 9000],
  ['create', '/category/sport', 5000, (p) => p.getByText(/create session/i).first().click()],
  ['communities', '/communities', 5000],
  ['profile', '/person/p-layla', 5000],
  ['chat', '/messages/cv-d1', 4000],
];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
for (const [name, url, wait, act] of SHOTS) {
  if (only && !only.includes(name)) continue;
  const { ctx, page } = await open();
  try {
    await page.goto(`http://localhost:8095${url}`);
    await page.waitForTimeout(wait);
    if (act) {
      await act(page);
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80 });
    console.log('shot', name);
  } catch (e) {
    console.log('failed', name, e.message);
  }
  await ctx.close();
}

// The app's intro story (make friends, do things together, grow your network,
// meet IRL, the promise), scene by scene in English and French: the website's
// hero phone plays them, so the site always shows the app as it is.
if (!only || only.includes('story')) {
  for (const lang of ['en', 'fr']) {
    const { ctx, page } = await open();
    try {
      await page.evaluate((l) => localStorage.setItem('irly-lang', JSON.stringify({ state: { setting: l }, version: 0 })), lang);
      for (let i = 1; i <= 5; i++) {
        await page.goto(`http://localhost:8095/story?scene=${i}&hold=1`);
        await page.waitForTimeout(3500);
        await page.screenshot({ path: `${OUT}/story-${lang}-${i}.jpg`, type: 'jpeg', quality: 80 });
      }
      console.log('shot story', lang);
    } catch (e) {
      console.log('failed story', lang, e.message);
    }
    await ctx.close();
  }
}

// A real, quiet map of Dubai (OpenStreetMap via OpenFreeMap) for the website.
if (!only || only.includes('dubai-map')) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css"><script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
<style>html,body,#m{margin:0;height:100%;background:#000}.maplibregl-ctrl-attrib{display:none}</style></head><body><div id="m"></div><script>
const m=new maplibregl.Map({container:'m',style:'https://tiles.openfreemap.org/styles/dark',center:[55.2,25.13],zoom:10.6,bearing:-28,pitch:0,attributionControl:false,interactive:false,preserveDrawingBuffer:true});
m.on('idle',()=>{document.title='ready'});</script></body></html>`);
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 60000 }).catch(() => console.log('map: not idle'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/dubai-map.jpg`, type: 'jpeg', quality: 82 });
  console.log('shot dubai-map');
  await ctx.close();
}

// Social card (1200×630) from the website's own hero, once the screens above exist.
if (!only || only.includes('og')) {
  const { execFileSync } = await import('node:child_process');
  execFileSync('node', ['.github/scripts/site-build.mjs'], { stdio: 'inherit' });
  const site = http
    .createServer((q, r) => {
      let f = path.join('dist/site', decodeURIComponent(q.url.split('?')[0].replace(/^\/irly\/site/, '')));
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
      r.setHeader('content-type', types[path.extname(f)] || (f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.webp') ? 'image/webp' : 'application/octet-stream'));
      fs.createReadStream(f).pipe(r);
    })
    .listen(8097);
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('irly-intro', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8097/irly/site/');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'site/og.jpg', type: 'jpeg', quality: 82 });
  console.log('shot og');
  await ctx.close();
  site.close();
}

await browser.close();
srv.close();
console.log(errors.length ? `page errors:\n${[...new Set(errors)].join('\n')}` : 'no page errors');
