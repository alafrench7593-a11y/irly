// App Store compositions, app screens only: title, subtitle, a real IRLY screen (in an
// iPhone frame, or alone when visuals.json sets "device": "none"), optional zoomed callouts
// cut from the same screen, and an optional line at the bottom ("note").
// Usage: node compose.mjs [names] ; env SIZES=69,63 OUT=dir
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { FONT_CSS, PHONE_CSS, geometry, phoneHTML, screenGeometry, screenHTML } from './phone.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'irly-store-'));
const cfg = JSON.parse(fs.readFileSync(`${DIR}/visuals.json`, 'utf8'));
const only = process.argv[2] ? process.argv[2].split(',') : null;
const SIZES = (process.env.SIZES || '69,63').split(',');
const OUTDIR = process.env.OUT || path.resolve(DIR, '..');
const FOLDER = { 69: 'iphone-6.9', 63: 'iphone-6.3' };

const THEMES = {
  dark: { bg: '#050506', ink: '#FFFFFF', sub: 'rgba(255,255,255,0.72)', dots: 'rgba(255,255,255,0.11)', shadow: '0 80px 160px rgba(0,0,0,0.85), 0 0 0 1.5px rgba(255,255,255,0.07)', callShadow: '0 40px 90px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)', glow: 'radial-gradient(900px 1100px at 50% 64%, rgba(255,255,255,0.075), rgba(255,255,255,0) 70%)' },
  light: { bg: '#FFFFFF', ink: '#050506', sub: 'rgba(5,5,6,0.64)', dots: 'rgba(5,5,6,0.085)', shadow: '0 80px 140px rgba(18,18,26,0.22), 0 24px 50px rgba(18,18,26,0.14)', callShadow: '0 40px 80px rgba(18,18,26,0.22), 0 10px 26px rgba(18,18,26,0.12)', glow: 'radial-gradient(900px 1100px at 50% 64%, rgba(5,5,6,0.035), rgba(5,5,6,0) 70%)' },
};

function calloutHTML(v, g, c, th, idx) {
  // c.crop = [x0, y0, x1, y1] in capture pixels; c.zoom relative to the in-phone size.
  // c.src: crop from another capture of the same screen (e.g. scrolled so that a floating
  // button does not cover the card); c.at: where that card is on the screen shown (default: crop).
  const [x0, y0, x1, y1] = c.at ?? c.crop;
  const zoom = c.zoom ?? 1.3;
  const s = g.scale * zoom; // canvas px per capture px
  const w = (c.crop[2] - c.crop[0]) * s;
  const h = (c.crop[3] - c.crop[1]) * s;
  const inPhoneCx = g.screenLeft + ((x0 + x1) / 2) * g.scale;
  const inPhoneCy = g.screenTop + ((y0 + y1) / 2) * g.scale;
  const cx = c.cx ?? inPhoneCx + (c.dx ?? 0);
  const cy = inPhoneCy + (c.dy ?? 0);
  const r = (c.radius ?? 72) * s; // card radius in capture px
  const file = `${TMP}/callouts/${v.name}-${idx}.png`;
  return `<div class="callout" style="left:${cx - w / 2}px; top:${cy - h / 2}px; width:${w}px; height:${h}px; border-radius:${r}px; box-shadow:${th.callShadow};">
    <img src="file://${file}" style="width:${w}px; height:${h}px;" /></div>`;
}

// The screen alone: a soft shadow, and a hairline that keeps a light screen apart from a white canvas.
const SCREEN = {
  dark: { shadow: '0 70px 150px rgba(0,0,0,0.8), 0 0 0 1.5px rgba(255,255,255,0.09)', edge: null },
  light: { shadow: '0 60px 120px rgba(18,18,26,0.16), 0 18px 40px rgba(18,18,26,0.1)', edge: 'rgba(5,5,6,0.07)' },
};

function html(v) {
  const th = THEMES[v.canvas];
  const frameless = (v.device ?? cfg.device) === 'none';
  const g = frameless ? screenGeometry(v.phone) : geometry(v.phone);
  const note = v.note ?? cfg.note;
  const device = frameless
    ? screenHTML({ ...v.phone, status: v.status, edge: SCREEN[v.canvas].edge }, `file://${DIR}/screens/${v.screen}`, SCREEN[v.canvas].shadow, v.time ?? '9:41')
    : phoneHTML(g, `file://${DIR}/screens/${v.screen}`, v.status, th.shadow, v.time ?? '9:41');
  const t = v.text;
  const dots = !v.dots ? '' : `<div id="dots" style="background-image: radial-gradient(circle, ${th.dots} 2.1px, transparent 2.6px); background-size: 30px 30px; background-position: 15px 15px; -webkit-mask-image: radial-gradient(ellipse 760px 980px at 50% ${v.dotsY ?? 62}%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 78%);"></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONT_CSS}
    html, body { margin:0; padding:0; background:${th.bg}; overflow:hidden; }
    #stage { position:relative; width:1320px; height:2868px; background:${th.bg}; overflow:hidden; transform-origin: 0 0; }
    #glow { position:absolute; inset:0; background:${th.glow}; }
    #dots { position:absolute; inset:0; }
    ${PHONE_CSS}
    .callout { position:absolute; overflow:hidden; }
    .note { position:absolute; left:0; right:0; bottom:${cfg.noteBottom ?? 34}px; text-align:center; font-family: Manrope; font-weight:500; font-size:${cfg.noteSize ?? 26}px; letter-spacing:0; color:${th.sub}; opacity:0.75; }
    .callout img { display:block; }
    .copy { position:absolute; left:${v.copy?.x ?? 96}px; top:${v.copy?.y ?? 160}px; width:${v.copy?.w ?? 1128}px; text-align:${v.copy?.align ?? 'left'}; }
    h1 { margin:0; font-family: Manrope; font-weight:800; font-size:${t.size ?? 118}px; line-height:1.03; letter-spacing:-0.036em; color:${th.ink}; text-wrap: balance; }
    p.sub { margin:${t.gap ?? 34}px 0 0; font-family: Manrope; font-weight:500; font-size:${t.subSize ?? 50}px; line-height:1.3; letter-spacing:-0.012em; color:${th.sub}; text-wrap: balance; }
  </style></head><body><div id="stage"><div id="glow"></div>${dots}
    ${device}
    ${(v.callouts || []).map((c, i) => calloutHTML(v, g, c, th, i)).join('')}
    ${note ? `<div class="note">${note}</div>` : ''}
    ${v.logo ? `<img class="logo" src="file://${DIR}/brand/logo-${v.logo}.png" style="position:absolute; left:${(v.copy?.x ?? 96) + 2}px; top:${v.logoY ?? 150}px; height:${v.logoH ?? 62}px;" />` : ''}
    <div class="copy"><h1>${t.title}</h1>${t.sub ? `<p class="sub">${t.sub}</p>` : ''}</div>
  </div></body></html>`;
}

// Callout images: exact crops of the capture, no resampling here (the browser scales them down).
async function prepCallouts(v) {
  const { execFileSync } = await import('node:child_process');
  (v.callouts || []).forEach((c, i) => {
    const out = `${TMP}/callouts/${v.name}-${i}.png`;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    execFileSync('python3', ['-I', '-c', `from PIL import Image; im=Image.open('${DIR}/screens/${c.src ?? v.screen}'); im.crop(tuple(${JSON.stringify(c.crop)})).save('${out}')`]);
  });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--font-render-hinting=none', '--allow-file-access-from-files'] });
for (const v of cfg.visuals) {
  if (only && !only.includes(v.name)) continue;
  await prepCallouts(v);
  const file = `${TMP}/html/${v.name}.html`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html(v));
  for (const sz of SIZES) {
    const [W, H] = sz === '63' ? [1206, 2622] : [1320, 2868];
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.goto(`file://${file}`);
    // 1206 x 2622 is not exactly 1320 x 2868 scaled down (0.07 % taller): scaling each axis on
    // its own fills the canvas to the last row, with no band left at the bottom.
    await page.evaluate(([sx, sy]) => {
      document.getElementById('stage').style.transform = `scale(${sx}, ${sy})`;
    }, [W / 1320, H / 2868]);
    await page.evaluate(() => document.fonts.ready);
    // Titles stay on two lines at most: shrink if needed.
    const info = await page.evaluate(() => {
      const h = document.querySelector('h1');
      const lines = () => Math.round(h.getBoundingClientRect().height / (parseFloat(getComputedStyle(h).lineHeight) * (window.innerWidth / 1320)));
      let size = parseFloat(getComputedStyle(h).fontSize);
      while (lines() > 2 && size > 80) { size -= 4; h.style.fontSize = `${size}px`; }
      const s = document.querySelector('p.sub');
      const sl = s ? Math.round(s.getBoundingClientRect().height / (parseFloat(getComputedStyle(s).lineHeight) * (window.innerWidth / 1320))) : 0;
      return { title: lines(), size, sub: sl, copyBottom: Math.round(document.querySelector('.copy').getBoundingClientRect().bottom / (window.innerWidth / 1320)), phoneTop: Math.round(document.querySelector('.phone, .scr').getBoundingClientRect().top / (window.innerWidth / 1320)) };
    });
    await page.waitForTimeout(250);
    const out = `${OUTDIR}/${FOLDER[sz]}/${v.file}`;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, type: 'png' });
    // RGB without alpha, tagged sRGB (the colour space Chromium renders in).
    (await import('node:child_process')).execFileSync('python3', ['-I', '-c', `from PIL import Image, ImageCms; im=Image.open('${out}').convert('RGB'); im.save('${out}', optimize=True, icc_profile=ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes())`]);
    console.log(v.name, sz, `${W}x${H}`, JSON.stringify(info));
    await page.close();
  }
}
await browser.close();
