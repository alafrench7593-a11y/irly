/**
 * Typing check on iPhone Safari's engine (WebKit, iPhone 13 profile): every
 * field of the sign-up flow must take what is typed, also once the keyboard
 * shrinks the view. Prints one line per field; exits 1 if one fails.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { webkit, devices } from 'playwright';

const ROOT = process.argv[2] || 'dist-check';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.json': 'application/json', '.png': 'image/png' };
http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) f = path.join(ROOT, 'index.html');
  r.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(r);
}).listen(8098);

const browser = await webkit.launch();
let failed = 0;
for (const route of ['/onboarding/you', '/onboarding/profile', '/account']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'fr-FR' });
  await ctx.route(/supabase\.co\//, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:8098${route}`);
  await page.waitForTimeout(6000);
  const fields = page.locator('input, textarea');
  const n = await fields.count();
  console.log(route, 'fields', n);
  for (let i = 0; i < n; i++) {
    const el = fields.nth(i);
    if (!(await el.isVisible())) continue;
    const label = await el.getAttribute('aria-label');
    try {
      await el.tap({ timeout: 4000 });
    } catch (e) {
      console.log('  FAIL tap', label, e.message.split('\n')[0]);
      failed++;
      continue;
    }
    await page.keyboard.type('Ab', { delay: 60 });
    await page.setViewportSize({ width: 390, height: 420 });
    await page.waitForTimeout(500);
    await page.keyboard.type('c12', { delay: 60 });
    const value = await el.inputValue().catch(() => '(field gone)');
    const focused = await el.evaluate((e) => e === document.activeElement).catch(() => false);
    const ok = value.length >= 2;
    if (!ok) failed++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}: "${value}" focused=${focused}`);
    await page.setViewportSize({ width: 390, height: 664 });
  }
  if (errors.length) console.log('  page errors:', errors.slice(0, 3).join(' | '));
  await page.screenshot({ path: `ios-${route.replace(/\//g, '_')}.png` });
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
