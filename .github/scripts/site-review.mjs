// Captures the live getirly.com for a design review: scroll-through frames of
// the website on desktop and phone (EN, FR, AR), the web app's first screens,
// page weight, meta tags and console errors. `node site-review.mjs lh` turns
// the Lighthouse reports into review/lighthouse.txt.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.REVIEW_OUT || path.resolve('review');
fs.mkdirSync(OUT, { recursive: true });

if (process.argv[2] === 'lh') {
  const lines = [];
  for (const f of fs.readdirSync(OUT).filter((n) => n.startsWith('lh-') && n.endsWith('.json'))) {
    const r = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
    const s = Object.values(r.categories).map((c) => `${c.id} ${Math.round(c.score * 100)}`).join(' | ');
    const a = (id) => r.audits[id]?.displayValue || '';
    lines.push(`${f}: ${s}`);
    lines.push(`  FCP ${a('first-contentful-paint')}, LCP ${a('largest-contentful-paint')}, TBT ${a('total-blocking-time')}, CLS ${a('cumulative-layout-shift')}, SI ${a('speed-index')}, weight ${a('total-byte-weight')}`);
    const failed = Object.values(r.audits).filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== 'informative' && x.scoreDisplayMode !== 'notApplicable' && x.scoreDisplayMode !== 'manual');
    for (const x of failed) lines.push(`  - ${x.id}: ${x.title}${x.displayValue ? ` (${x.displayValue})` : ''}`);
  }
  fs.writeFileSync(path.join(OUT, 'lighthouse.txt'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  process.exit(0);
}

const SITE = process.env.SITE || 'https://getirly.com/';
const TAG = process.env.TAG || '';
const ONLY_SITE = process.env.ONLY_SITE === '1';
const APP = 'https://getirly.com/app/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { when: new Date().toISOString(), runs: {} };
const browser = await chromium.launch();

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-US', timezoneId: 'Asia/Dubai', userAgent: IPHONE_UA };
const DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'Europe/Paris' };

async function open(ctxOpts, url, tag) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const log = { url, errors: [], failed: [] };
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => log.errors.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on('requestfailed', (r) => log.failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 200)}`));
  page.on('response', (r) => { if (r.status() >= 400) log.failed.push(`${r.status()} ${r.url().slice(0, 200)}`); });
  const t0 = Date.now();
  const resp = await page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch((e) => { log.errors.push(`goto: ${e.message}`); return null; });
  log.status = resp?.status() ?? null;
  log.loadMs = Date.now() - t0;
  await sleep(3000);
  report.runs[tag] = log;
  return { ctx, page, log };
}

const metrics = (page) => page.evaluate(async () => {
  const nav = performance.getEntriesByType('navigation')[0];
  const res = performance.getEntriesByType('resource');
  const byType = {};
  for (const r of res) byType[r.initiatorType] = (byType[r.initiatorType] || 0) + (r.transferSize || 0);
  const lcp = await new Promise((resolve) => {
    let v = null;
    new PerformanceObserver((l) => { const e = l.getEntries(); v = e[e.length - 1]; }).observe({ type: 'largest-contentful-paint', buffered: true });
    setTimeout(() => resolve(v ? { t: Math.round(v.startTime), el: `${v.element?.tagName}.${v.element?.className || ''}`, url: v.url } : null), 600);
  });
  const meta = (n) => document.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content || null;
  return {
    dcl: Math.round(nav?.domContentLoadedEventEnd || 0), load: Math.round(nav?.loadEventEnd || 0),
    htmlBytes: nav?.transferSize, totalBytes: res.reduce((s, r) => s + (r.transferSize || 0), nav?.transferSize || 0), requests: res.length, byType,
    big: res.filter((r) => (r.transferSize || 0) > 150000).map((r) => [r.name.slice(0, 160), r.transferSize]),
    lcp,
    title: document.title, description: meta('description'), ogTitle: meta('og:title'), ogDescription: meta('og:description'), ogImage: meta('og:image'), twitterCard: meta('twitter:card'),
    canonical: document.querySelector('link[rel=canonical]')?.href || null,
    hreflang: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => `${l.hreflang} ${l.href}`),
    lang: document.documentElement.lang, dir: document.documentElement.dir,
    h1: [...document.querySelectorAll('h1')].map((h) => h.innerText.trim().replace(/\s+/g, ' ')),
    h2: [...document.querySelectorAll('h2')].map((h) => h.innerText.trim().replace(/\s+/g, ' ')),
    imgs: document.images.length,
    imgsNoAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length,
    imgsEmptyAlt: [...document.images].filter((i) => i.getAttribute('alt') === '').length,
    videos: [...document.querySelectorAll('video')].map((v) => ({ src: v.currentSrc || v.querySelector('source')?.src || null, preload: v.preload, autoplay: v.autoplay })),
    jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent.slice(0, 500)),
    height: document.documentElement.scrollHeight,
    links: [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))],
    buttons: [...new Set([...document.querySelectorAll('a.btn, button')].map((b) => (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ')).filter(Boolean))],
  };
});

// Scroll like a reader (wheel steps, so the smooth scroller and the scroll scenes run); one frame per step.
async function scrollThrough(page, prefix, { step = 0.7, max = 80, quality = 78 } = {}) {
  const { width, height } = page.viewportSize();
  await page.mouse.move(width / 2, height / 2);
  let n = 0;
  for (; n < max; n++) {
    await page.screenshot({ path: `${OUT}/${TAG}${prefix}-${String(n).padStart(2, '0')}.jpg`, type: 'jpeg', quality });
    const y0 = await page.evaluate(() => scrollY);
    for (let k = 0; k < 8; k++) { await page.mouse.wheel(0, (height * step) / 8); await sleep(70); }
    await sleep(1100);
    const y = await page.evaluate(() => scrollY);
    if (y <= y0 + 2) break;
  }
  return n + 1;
}

async function labels(page) {
  return page.evaluate(() => [...document.querySelectorAll('[aria-label],[role=button],button,a')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; })
    .map((e) => `${e.getAttribute('role') || e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80)}" @${Math.round(e.getBoundingClientRect().x)},${Math.round(e.getBoundingClientRect().y)}`)
    .slice(0, 60));
}

// 1. Website, desktop
{
  const { ctx, page } = await open(DESK, SITE, 'site-desktop');
  report.runs['site-desktop'].metrics = await metrics(page);
  report.runs['site-desktop'].frames = await scrollThrough(page, 'desk', { step: 0.75 });
  await ctx.close();
}

// 2. Website, phone (EN), then the menu
{
  const { ctx, page } = await open(PHONE, SITE, 'site-phone');
  report.runs['site-phone'].metrics = await metrics(page);
  report.runs['site-phone'].frames = await scrollThrough(page, 'phone', { step: 0.7, quality: 72 });
  await page.evaluate(() => scrollTo(0, 0));
  await sleep(1200);
  const menu = page.locator('.menu-btn');
  if (await menu.isVisible().catch(() => false)) {
    await menu.click();
    await sleep(900);
    await page.screenshot({ path: `${OUT}/${TAG}phone-menu.jpg`, type: 'jpeg', quality: 78 });
  }
  await ctx.close();
}

// 3. Website, phone, FR and AR (the opening only)
for (const lang of ['fr', 'ar']) {
  const { ctx, page } = await open(PHONE, `${SITE}?lang=${lang}`, `site-phone-${lang}`);
  report.runs[`site-phone-${lang}`].metrics = { dir: await page.evaluate(() => document.documentElement.dir), lang: await page.evaluate(() => document.documentElement.lang), h1: await page.evaluate(() => [...document.querySelectorAll('h1')].map((h) => h.innerText.trim())) };
  report.runs[`site-phone-${lang}`].frames = await scrollThrough(page, `phone-${lang}`, { step: 0.9, max: 10, quality: 72 });
  await ctx.close();
}

// 4. The web app, as a first-time visitor on a phone
if (!ONLY_SITE) {
  const { ctx, page } = await open(PHONE, APP, 'app-phone');
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/app-00.jpg`, type: 'jpeg', quality: 80 });
  report.runs['app-phone'].labels0 = await labels(page);
  const skip = page.getByLabel('Skip intro');
  if (await skip.count()) { await skip.first().click({ force: true }).catch(() => {}); await sleep(2500); }
  await page.screenshot({ path: `${OUT}/app-01.jpg`, type: 'jpeg', quality: 80 });
  report.runs['app-phone'].labels1 = await labels(page);
  report.runs['app-phone'].metrics = await metrics(page);
  await ctx.close();
}

// 5. The web app on a desktop screen
if (!ONLY_SITE) {
  const { ctx, page } = await open(DESK, APP, 'app-desktop');
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/app-desk-00.jpg`, type: 'jpeg', quality: 80 });
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, `${TAG}report.json`), JSON.stringify(report, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.runs).map(([k, v]) => [k, { status: v.status, loadMs: v.loadMs, errors: v.errors.length, failed: v.failed.length, frames: v.frames }])), null, 1));
