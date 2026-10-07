/**
 * Draws the IRLY app icons (dot-matrix "i" + accent on the halftone field)
 * and writes them to assets/. Run: node scripts/make-icons.mjs
 * Needs Playwright with Chromium (PLAYWRIGHT_BROWSERS_PATH or /opt/pw-browsers).
 */
import fs from 'node:fs';
import path from 'node:path';

const pw = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright').catch(() => import('/opt/node-tools/node_modules/playwright/index.mjs'));
const out = path.resolve('assets');

/** Stem: 6 dots; accent: 2×2 above right (same grid as src/brand/dots.ts). */
function mark({ size, pitch, x0, y0, stem, accent }) {
  const r = (pitch * 0.88) / 2;
  let s = '';
  for (let row = 2; row < 8; row += 1) s += `<circle cx="${x0 + pitch / 2}" cy="${y0 + (row + 0.4) * pitch + pitch / 2}" r="${r}" fill="${stem}"/>`;
  for (const [c, rr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) s += `<circle cx="${x0 + (1.6 + c) * pitch + pitch / 2}" cy="${y0 + rr * pitch + pitch / 2}" r="${r}" fill="${accent}"/>`;
  return s;
}

function field({ size, pitch, color, light }) {
  let s = '';
  for (let y = pitch / 2; y < size; y += pitch)
    for (let x = pitch / 2; x < size; x += pitch) {
      const d = Math.hypot(x - size * 0.75, y - size * 0.1) / size;
      const a = Math.max(0.06, light * (1 - d));
      s += `<circle cx="${x}" cy="${y}" r="${pitch * 0.32}" fill="${color}" fill-opacity="${a.toFixed(3)}"/>`;
    }
  return s;
}

function svg(size, body, bg = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="bg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#050608"/><stop offset="0.55" stop-color="#11151C"/><stop offset="1" stop-color="#3A4A60"/></linearGradient></defs>
  ${bg}${body}</svg>`;
}

const S = 1024;
const P = 74; // mark pitch: the "i" is about 8.4 dots tall
const mx = (S - 3.6 * P) / 2;
const my = (S - 8.4 * P) / 2;
const icons = {
  'icon.png': svg(S, field({ size: S, pitch: 37, color: '#FFFFFF', light: 0.32 }) + mark({ size: S, pitch: P, x0: mx, y0: my, stem: '#FFFFFF', accent: '#FFFFFF' }), `<rect width="${S}" height="${S}" fill="url(#bg)"/>`),
  'android-icon-background.png': svg(S, field({ size: S, pitch: 37, color: '#FFFFFF', light: 0.32 }), `<rect width="${S}" height="${S}" fill="url(#bg)"/>`),
  // Adaptive icons crop to the centre ~66%: a smaller mark.
  'android-icon-foreground.png': svg(S, mark({ size: S, pitch: 54, x0: (S - 3.6 * 54) / 2, y0: (S - 8.4 * 54) / 2, stem: '#FFFFFF', accent: '#FFFFFF' })),
  'android-icon-monochrome.png': svg(S, mark({ size: S, pitch: 54, x0: (S - 3.6 * 54) / 2, y0: (S - 8.4 * 54) / 2, stem: '#FFFFFF', accent: '#FFFFFF' })),
  'splash-icon.png': svg(S, mark({ size: S, pitch: 96, x0: (S - 3.6 * 96) / 2, y0: (S - 8.4 * 96) / 2, stem: '#FFFFFF', accent: '#FFFFFF' })),
  'favicon.png': svg(S, mark({ size: S, pitch: 104, x0: (S - 3.6 * 104) / 2, y0: (S - 8.4 * 104) / 2, stem: '#FFFFFF', accent: '#FFFFFF' }), `<rect width="${S}" height="${S}" rx="220" fill="url(#bg)"/>`),
};

const browser = await pw.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await browser.newPage({ viewport: { width: S, height: S } });
for (const [name, markup] of Object.entries(icons)) {
  const target = name === 'favicon.png' ? 96 : S;
  await page.setViewportSize({ width: target, height: target });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace(`width="${S}" height="${S}" viewBox`, `width="${target}" height="${target}" viewBox`)}</body></html>`);
  await page.locator('svg').screenshot({ path: path.join(out, name), omitBackground: true });
  console.log('wrote', name);
}
await browser.close();
