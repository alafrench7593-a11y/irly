// Product page header and search results images for the App Store (iOS 27, iPadOS 27).
// Each image in headers.json is built from optional layers, back to front:
//   tiles   photos of the app's own library (public-photos/), rounded, edge to edge
//   shade   a dark veil over the tiles, so black stays the dominant colour
//   phones  real app captures (tools/screens/) in iPhone frames
//   glass   frosted panels in the iOS style, behind the text they carry
//   faces   member photos ringed like the app's "Live now" row
//   logo, title, capsule (a glass pill with one short line)
// Usage: node compose-header.mjs [names] ; env OUT=dir (default: promo/app-store)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { FONT_CSS, PHONE_CSS, geometry, phoneHTML } from './phone.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PHOTOS = path.resolve(DIR, '../../../public-photos');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'irly-header-'));
const cfg = JSON.parse(fs.readFileSync(`${DIR}/headers.json`, 'utf8'));
const only = process.argv[2] ? process.argv[2].split(',') : null;
const OUTDIR = process.env.OUT || path.resolve(DIR, '..');

const BG = '#050506';
const SHADOW = '0 90px 180px rgba(0,0,0,0.85), 0 0 0 1.5px rgba(255,255,255,0.07)';
const LIVE = '#FF3B30'; // the app's live colour (src/theme/tokens.ts)
const GLASS = 'background: rgba(24,24,27,0.46); backdrop-filter: blur(var(--blur)) saturate(150%); -webkit-backdrop-filter: blur(var(--blur)) saturate(150%); border: 2px solid rgba(255,255,255,0.16); box-shadow: inset 0 2px 0 rgba(255,255,255,0.16), 0 70px 180px rgba(0,0,0,0.6);';

// t.photo: a key of the app's photo library; t.src: an image under tools/ (e.g. photos/x.png).
// With t.crop ([x0, y0, x1, y1] in source pixels) the photo is cut and resized to the tile in
// Python (Lanczos, light sharpening, t.grain = film grain strength), not by the browser.
function tileSrc(t, key) {
  const src = t.src ? path.resolve(DIR, t.src) : `${PHOTOS}/${t.photo}-1200.jpg`;
  if (!t.crop) return src;
  const out = `${TMP}/${key}.png`;
  execFileSync('python3', ['-I', `${DIR}/prep_photo.py`, src, out, ...t.crop.map(String), String(t.w), String(t.h), String(t.grain ?? 0)]);
  return out;
}
const tileHTML = (t, i, h) =>
  `<div class="tile deco" style="left:${t.x}px; top:${t.y}px; width:${t.w}px; height:${t.h}px; border-radius:${t.r ?? 0}px; ${t.shadow ? `box-shadow:${t.shadow};` : ''}"><img src="file://${tileSrc(t, `${h.name}-tile${i}`)}" style="object-position:${t.pos ?? '50% 50%'}; filter:${t.filter ?? 'none'};" /></div>`;

const glassHTML = (g) =>
  `<div class="glass" style="left:${g.x}px; top:${g.y}px; width:${g.w}px; height:${g.h}px; border-radius:${g.r}px; --blur:${g.blur ?? 70}px; ${GLASS}"></div>`;

// A row of member photos with the red ring and dark gap of the app's "Live now" avatars.
function facesHTML(f, width) {
  const ring = Math.round(f.d * 0.035);
  const gap = Math.round(f.d * 0.045);
  const D = f.d + 2 * (ring + gap);
  const total = f.list.length * D + (f.list.length - 1) * f.gap;
  const x0 = (width - total) / 2;
  return f.list
    .map((name, i) => `<div class="av" style="left:${x0 + i * (D + f.gap)}px; top:${f.y}px; width:${D}px; height:${D}px; border:${ring}px solid ${LIVE}; padding:${gap}px;"><img src="file://${PHOTOS}/faces/${name}.jpg" /></div>`)
    .join('');
}

function html(h) {
  const t = h.title;
  const centred = t.align === 'center';
  const c = h.capsule;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONT_CSS}
    html, body { margin:0; padding:0; background:${BG}; overflow:hidden; }
    #stage { position:relative; width:${h.width}px; height:${h.height}px; background:${BG}; overflow:hidden; }
    #glow { position:absolute; inset:0; background: radial-gradient(${h.glow.rx}px ${h.glow.ry}px at ${h.glow.x}px ${h.glow.y}px, rgba(255,255,255,0.075), rgba(255,255,255,0) 70%); }
    #shade { position:absolute; inset:0; background:${h.shade ?? 'none'}; }
    ${PHONE_CSS}
    .tile { position:absolute; overflow:hidden; }
    .tile img { width:100%; height:100%; display:block; object-fit:cover; }
    .glass { position:absolute; }
    h1 { position:absolute; left:${centred ? '50%' : `${t.x}px`}; top:${t.y}px; ${centred ? 'transform:translateX(-50%); text-align:center;' : ''} margin:0; font-family: Manrope; font-weight:${t.weight ?? 800}; font-size:${t.size}px; line-height:${t.lh ?? 1.03}; letter-spacing:${t.ls ?? '-0.036em'}; color:${t.color ?? '#FFFFFF'}; white-space:nowrap; }
    .av { position:absolute; box-sizing:border-box; border-radius:50%; }
    .av img { width:100%; height:100%; display:block; border-radius:50%; object-fit:cover; }
    .capsule { position:absolute; left:50%; transform:translateX(-50%); display:flex; align-items:center; white-space:nowrap; border-radius:999px; --blur:40px; ${GLASS} font-family: Manrope; font-weight:600; letter-spacing:-0.01em; color:rgba(255,255,255,0.92); }
  </style></head><body><div id="stage"><div id="glow"></div>
    ${(h.tiles || []).map((t, i) => tileHTML(t, i, h)).join('')}
    <div id="shade" class="deco"></div>
    ${(h.phones || []).map((p) => phoneHTML(geometry(p), `file://${DIR}/screens/${p.screen}`, p.status, SHADOW)).join('')}
    ${(h.glass || []).map(glassHTML).join('')}
    ${h.faces ? facesHTML(h.faces, h.width) : ''}
    ${h.logo ? `<img class="logo" src="file://${DIR}/brand/logo-light.png" style="position:absolute; top:${h.logo.y}px; height:${h.logo.h}px; ${h.logo.x === 'center' ? 'left:50%; transform:translateX(-50%);' : `left:${h.logo.x}px;`}" />` : ''}
    ${t.text ? `<h1>${t.text}</h1>` : ''}
    ${c ? `<div class="capsule" style="top:${c.y}px; height:${c.h}px; padding:0 ${c.padX}px; font-size:${c.size}px;">${c.text}</div>` : ''}
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
  await page.waitForTimeout(600);
  // Key content (text, logo, glass, phones, faces) must sit inside the zone the placement keeps.
  // Photo tiles are decoration: they may run to the edges and be cropped.
  const box = await page.evaluate(() => {
    const r = [...document.querySelectorAll('.phone, .av, .glass, .capsule, .logo, h1')].map((el) => el.getBoundingClientRect());
    return [Math.min(...r.map((b) => b.left)), Math.min(...r.map((b) => b.top)), Math.max(...r.map((b) => b.right)), Math.max(...r.map((b) => b.bottom))].map(Math.round);
  });
  const [s0, s1, s2, s3] = h.safe;
  const inside = box[0] >= s0 && box[1] >= s1 && box[2] <= s2 && box[3] <= s3;
  const out = `${OUTDIR}/en-tete/${h.file}`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: 'png' });
  // RGB with an sRGB profile, no alpha; a JPEG copy too (both formats are accepted for these sizes).
  const jpg = out.replace(/\.png$/, '.jpg');
  execFileSync('python3', ['-I', '-c', `from PIL import Image, ImageCms
srgb = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
im = Image.open('${out}').convert('RGB')
im.save('${out}', optimize=True, icc_profile=srgb)
im.save('${jpg}', quality=92, optimize=True, subsampling=0, icc_profile=srgb)`]);
  console.log(h.name, `${h.width}x${h.height}`, 'content', JSON.stringify(box), inside ? 'inside the safe zone' : 'OUTSIDE the safe zone');
  await page.close();
}
await browser.close();
