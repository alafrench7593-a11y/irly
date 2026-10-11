// Capture harness for IRLY App Store screens.
// Serves a static Expo web export, routes photos/videos to the local repo,
// optionally answers a mock Supabase backend, emulates iPhone safe areas.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// promo/app-store/tools → repository root.
export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp4': 'video/mp4' };

export function serve(root, port) {
  const srv = http.createServer((q, r) => {
    let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) f = fs.existsSync(`${f}.html`) ? `${f}.html` : path.join(root, 'index.html');
    r.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream');
    fs.createReadStream(f).pipe(r);
  });
  srv.listen(port);
  return srv;
}

export async function launch() {
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--font-render-hinting=none'] });
}

/**
 * opts: { port, viewport:{width,height}, dpr, seed: {key: jsonString}, mock: async (route, req) => bool, faceMap: fn(id)->file, insets: {top,bottom}, log }
 */
export async function openPage(browser, opts) {
  const { port, viewport = { width: 440, height: 956 }, dpr = 3, seed = {}, mock, insets = { top: 62, bottom: 34 }, log = [] } = opts;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, locale: 'fr-FR', timezoneId: 'Asia/Dubai', colorScheme: 'dark', hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1' });
  // Seed storage before any app script runs.
  await ctx.addInitScript((s) => {
    try {
      if (!sessionStorage.getItem('__seeded')) {
        localStorage.clear();
        for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
        sessionStorage.setItem('__seeded', '1');
      }
    } catch (e) {}
    // Hide the demo-only badge (absent from the production app).
    const css = '[aria-label^="Demo"],[aria-label^="Démo"]{display:none!important}';
    const add = () => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  }, seed);
  await ctx.route(/alafrench7593-a11y\.github\.io\/irly\/photos\/(.+)$/, (route) => {
    const rel = route.request().url().split('/photos/')[1].split('?')[0];
    const override = opts.photoMap && opts.photoMap(rel);
    const f = override || `${REPO}/public-photos/${rel}`;
    if (fs.existsSync(f)) return route.fulfill({ path: f, contentType: f.endsWith('.png') ? 'image/png' : 'image/jpeg' });
    log.push(`MISSING photo ${rel}`);
    return route.abort();
  });
  await ctx.route(/getirly\.com\/video\/(.+)$/, (route) => {
    const rel = route.request().url().split('/video/')[1].split('?')[0];
    const f = `${REPO}/site/video/${rel}`;
    if (fs.existsSync(f)) return route.fulfill({ path: f, contentType: f.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg' });
    log.push(`MISSING video ${rel}`);
    return route.abort();
  });
  await ctx.route(/images\.unsplash\.com/, (route) => {
    const u = route.request().url();
    const alt = opts.unsplashMap && opts.unsplashMap(u);
    if (alt && fs.existsSync(alt)) return route.fulfill({ path: alt, contentType: 'image/jpeg' });
    log.push(`UNSPLASH ${u.split('?')[0]}`);
    return route.abort();
  });
  await ctx.route(/supabase\.co\//, async (route) => {
    if (mock) {
      const handled = await mock(route, route.request(), log);
      if (handled !== false) return;
    }
    log.push(`SUPABASE(unhandled) ${route.request().method()} ${route.request().url()}`);
    return route.abort();
  });
  await ctx.route(/openfreemap|maplibre|unpkg|fonts\.googleapis|fonts\.gstatic/, (route) => route.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log.push(`PAGEERROR ${e.message}`));
  // iPhone safe areas (status bar / home indicator) so the layout matches the device.
  try {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: insets.top, topMax: insets.top, bottom: insets.bottom, bottomMax: insets.bottom, left: 0, leftMax: 0, right: 0, rightMax: 0 } });
    log.push('safe-area override: ok');
  } catch (e) {
    log.push(`safe-area override: ${e.message.split('\n')[0]}`);
  }
  return { ctx, page };
}
