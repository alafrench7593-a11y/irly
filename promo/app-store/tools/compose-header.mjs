// Product page header and search results images for the App Store (iOS 27, iPadOS 27):
// the IRLY logo, one short phrase and real app screens in iPhone frames, on a wide canvas.
// Usage: node compose-header.mjs [names] ; env OUT=dir (default: promo/app-store)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { FONT_CSS, PHONE_CSS, geometry, phoneHTML } from './phone.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'irly-header-'));
const cfg = JSON.parse(fs.readFileSync(`${DIR}/headers.json`, 'utf8'));
const only = process.argv[2] ? process.argv[2].split(',') : null;
const OUTDIR = process.env.OUT || path.resolve(DIR, '..');

const BG = '#050506';
const SHADOW = '0 90px 180px rgba(0,0,0,0.85), 0 0 0 1.5px rgba(255,255,255,0.07)';

function html(h) {
  // Phones are listed back to front: the last one is drawn on top.
  const phones = h.phones
    .map((p) => phoneHTML(geometry(p), `file://${DIR}/screens/${p.screen}`, p.status, SHADOW))
    .join('');
  const t = h.title;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONT_CSS}
    html, body { margin:0; padding:0; background:${BG}; overflow:hidden; }
    #stage { position:relative; width:${h.width}px; height:${h.height}px; background:${BG}; overflow:hidden; }
    #glow { position:absolute; inset:0; background: radial-gradient(${h.glow.rx}px ${h.glow.ry}px at ${h.glow.x}px ${h.glow.y}px, rgba(255,255,255,0.075), rgba(255,255,255,0) 70%); }
    ${PHONE_CSS}
    h1 { position:absolute; left:${t.x}px; top:${t.y}px; margin:0; font-family: Manrope; font-weight:800; font-size:${t.size}px; line-height:1.03; letter-spacing:-0.036em; color:#FFFFFF; white-space:nowrap; }
  </style></head><body><div id="stage"><div id="glow"></div>
    ${phones}
    <img src="file://${DIR}/brand/logo-light.png" style="position:absolute; left:${h.logo.x}px; top:${h.logo.y}px; height:${h.logo.h}px;" />
    <h1>${t.text}</h1>
  </div></body></html>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--font-render-hinting=none', '--allow-file-access-from-files'] });
for (const h of cfg.headers) {
  if (only && !only.includes(h.name)) continue;
  const file = `${TMP}/${h.name}.html`;
  fs.writeFileSync(file, html(h));
  const page = await browser.newPage({ viewport: { width: h.width, height: h.height }, deviceScaleFactor: 1 });
  await page.goto(`file://${file}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  // Everything that matters must sit inside the zone kept by every crop of this image.
  const box = await page.evaluate(() => {
    const r = [...document.querySelectorAll('.phone, h1, img')].map((el) => el.getBoundingClientRect());
    return [Math.min(...r.map((b) => b.left)), Math.min(...r.map((b) => b.top)), Math.max(...r.map((b) => b.right)), Math.max(...r.map((b) => b.bottom))].map(Math.round);
  });
  const [s0, s1, s2, s3] = h.safe;
  const inside = box[0] >= s0 && box[1] >= s1 && box[2] <= s2 && box[3] <= s3;
  const out = `${OUTDIR}/en-tete/${h.file}`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: 'png' });
  execFileSync('python3', ['-I', '-c', `from PIL import Image; im=Image.open('${out}').convert('RGB'); im.save('${out}', optimize=True)`]);
  console.log(h.name, `${h.width}x${h.height}`, 'content', JSON.stringify(box), inside ? 'inside the safe zone' : 'OUTSIDE the safe zone');
  await page.close();
}
await browser.close();
