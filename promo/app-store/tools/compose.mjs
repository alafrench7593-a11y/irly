// App Store compositions, app screens only: title, subtitle, iPhone with a real
// IRLY screen, optional zoomed callout cut from the same screen.
// Usage: node compose.mjs [names] ; env SIZES=69,63 OUT=dir
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(DIR, '../../..');
const FONTS = `${REPO}/node_modules/@expo-google-fonts/manrope`;
// The status bar time is set in Inter SemiBold when installed (closest to SF Pro), Manrope otherwise.
const INTER = ['/usr/share/fonts/opentype/inter/Inter-SemiBold.otf', '/Library/Fonts/Inter-SemiBold.otf', `${os.homedir()}/Library/Fonts/Inter-SemiBold.otf`].find((f) => fs.existsSync(f));
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

const icons = (c) => ({
  signal: `<svg viewBox="0 0 18 12" width="100%" height="100%"><rect x="0" y="8" width="3.2" height="4" rx="1" fill="${c}"/><rect x="4.9" y="5.6" width="3.2" height="6.4" rx="1" fill="${c}"/><rect x="9.8" y="3" width="3.2" height="9" rx="1" fill="${c}"/><rect x="14.7" y="0" width="3.2" height="12" rx="1" fill="${c}"/></svg>`,
  wifi: `<svg viewBox="0 0 16 12" width="100%" height="100%"><path d="M8 2.3c2.3 0 4.4.9 6 2.4l1.1-1.2C13.2 1.7 10.7.6 8 .6S2.8 1.7.9 3.5L2 4.7c1.6-1.5 3.7-2.4 6-2.4z" fill="${c}"/><path d="M8 5.6c1.4 0 2.6.5 3.6 1.4l1.1-1.2C11.4 4.6 9.8 3.9 8 3.9S4.6 4.6 3.3 5.8l1.1 1.2C5.4 6.1 6.6 5.6 8 5.6z" fill="${c}"/><path d="M8 8.8c.6 0 1.1.2 1.5.6L8 11.1 6.5 9.4c.4-.4.9-.6 1.5-.6z" fill="${c}"/></svg>`,
  battery: `<svg viewBox="0 0 27 13" width="100%" height="100%"><rect x="0.6" y="0.6" width="23" height="11.8" rx="3.6" fill="none" stroke="${c}" stroke-opacity="0.38" stroke-width="1.1"/><rect x="2.3" y="2.3" width="19.6" height="8.4" rx="2.2" fill="${c}"/><path d="M25 4.4v4.2c.9-.3 1.5-1.1 1.5-2.1s-.6-1.8-1.5-2.1z" fill="${c}" fill-opacity="0.45"/></svg>`,
});

function geometry(p) {
  const S = p.S;
  const k = S / 440;
  const H = (S * 2868) / 1320;
  const b = 12.5 * k;
  const rim = 2.2 * k;
  const W = S + 2 * b + 2 * rim;
  const HH = H + 2 * b + 2 * rim;
  const left = p.cx - W / 2;
  return { S, k, H, b, rim, W, HH, left, top: p.top, screenLeft: left + rim + b, screenTop: p.top + rim + b, scale: S / 1320, R: 55 * k };
}

function phoneHTML(g, screenSrc, statusColor, homeColor, th, time) {
  const { S, k, H, b, rim, W, HH, left, top, R } = g;
  const I = icons(statusColor);
  return `
  <div class="phone" style="left:${left}px; top:${top}px; width:${W}px; height:${HH}px; border-radius:${R + b + rim}px; box-shadow:${th.shadow};">
    <div class="rim" style="border-radius:${R + b + rim}px;"></div>
    <div class="body" style="left:${rim}px; top:${rim}px; right:${rim}px; bottom:${rim}px; border-radius:${R + b}px;"></div>
    <div class="screen" style="left:${rim + b}px; top:${rim + b}px; width:${S}px; height:${H}px; border-radius:${R}px;">
      <img src="${screenSrc}" style="width:${S}px; height:${H}px;" />
      <div class="island" style="width:${126 * k}px; height:${37 * k}px; top:${11 * k}px; left:${(S - 126 * k) / 2}px; border-radius:${18.5 * k}px;"></div>
      <div class="time" style="left:0; width:${157 * k}px; top:${11 * k}px; height:${37 * k}px; font-size:${17 * k}px; color:${statusColor};">${time}</div>
      <div class="sicons" style="left:${(440 - 157) * k}px; width:${157 * k}px; top:${11 * k}px; height:${37 * k}px; gap:${5.5 * k}px;">
        <span style="width:${18 * k}px; height:${12 * k}px;">${I.signal}</span>
        <span style="width:${16 * k}px; height:${12 * k}px;">${I.wifi}</span>
        <span style="width:${27 * k}px; height:${13 * k}px;">${I.battery}</span>
      </div>
      <div class="home" style="width:${144 * k}px; height:${5 * k}px; left:${(S - 144 * k) / 2}px; bottom:${8 * k}px; background:${homeColor}; border-radius:${2.5 * k}px;"></div>
    </div>
  </div>`;
}

function calloutHTML(v, g, c, th, idx) {
  // c.crop = [x0, y0, x1, y1] in capture pixels; c.zoom relative to the in-phone size.
  const [x0, y0, x1, y1] = c.crop;
  const zoom = c.zoom ?? 1.3;
  const s = g.scale * zoom; // canvas px per capture px
  const w = (x1 - x0) * s;
  const h = (y1 - y0) * s;
  const inPhoneCx = g.screenLeft + ((x0 + x1) / 2) * g.scale;
  const inPhoneCy = g.screenTop + ((y0 + y1) / 2) * g.scale;
  const cx = c.cx ?? inPhoneCx + (c.dx ?? 0);
  const cy = inPhoneCy + (c.dy ?? 0);
  const r = (c.radius ?? 72) * s; // card radius in capture px
  const file = `${TMP}/callouts/${v.name}-${idx}.png`;
  return `<div class="callout" style="left:${cx - w / 2}px; top:${cy - h / 2}px; width:${w}px; height:${h}px; border-radius:${r}px; box-shadow:${th.callShadow};">
    <img src="file://${file}" style="width:${w}px; height:${h}px;" /></div>`;
}

function html(v) {
  const th = THEMES[v.canvas];
  const statusColor = v.status === 'dark' ? '#000000' : '#FFFFFF';
  const homeColor = v.status === 'dark' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
  const g = geometry(v.phone);
  const t = v.text;
  const dots = !v.dots ? '' : `<div id="dots" style="background-image: radial-gradient(circle, ${th.dots} 2.1px, transparent 2.6px); background-size: 30px 30px; background-position: 15px 15px; -webkit-mask-image: radial-gradient(ellipse 760px 980px at 50% ${v.dotsY ?? 62}%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 78%);"></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: Manrope; font-weight: 500; src: url(file://${FONTS}/500Medium/Manrope_500Medium.ttf); }
    @font-face { font-family: Manrope; font-weight: 600; src: url(file://${FONTS}/600SemiBold/Manrope_600SemiBold.ttf); }
    @font-face { font-family: Manrope; font-weight: 700; src: url(file://${FONTS}/700Bold/Manrope_700Bold.ttf); }
    @font-face { font-family: Manrope; font-weight: 800; src: url(file://${FONTS}/800ExtraBold/Manrope_800ExtraBold.ttf); }
    ${INTER ? `@font-face { font-family: InterSB; font-weight: 600; src: url(file://${INTER}); }` : ''}
    html, body { margin:0; padding:0; background:${th.bg}; overflow:hidden; }
    #stage { position:relative; width:1320px; height:2868px; background:${th.bg}; overflow:hidden; transform-origin: 0 0; }
    #glow { position:absolute; inset:0; background:${th.glow}; }
    #dots { position:absolute; inset:0; }
    .phone { position:absolute; }
    .rim { position:absolute; inset:0; background: linear-gradient(140deg, #7d7d84 0%, #26262a 16%, #46464c 50%, #18181b 84%, #8a8a91 100%); }
    .body { position:absolute; background:#0a0a0b; }
    .screen { position:absolute; overflow:hidden; background:#000; }
    .screen img { position:absolute; left:0; top:0; display:block; }
    .island { position:absolute; background:#000; }
    .time { position:absolute; display:flex; align-items:center; justify-content:center; font-family: InterSB, Manrope; font-weight:600; letter-spacing:-0.01em; }
    .sicons { position:absolute; display:flex; align-items:center; justify-content:center; }
    .sicons span { display:block; }
    .home { position:absolute; }
    .callout { position:absolute; overflow:hidden; }
    .callout img { display:block; }
    .copy { position:absolute; left:${v.copy?.x ?? 96}px; top:${v.copy?.y ?? 160}px; width:${v.copy?.w ?? 1128}px; text-align:${v.copy?.align ?? 'left'}; }
    h1 { margin:0; font-family: Manrope; font-weight:800; font-size:${t.size ?? 118}px; line-height:1.03; letter-spacing:-0.036em; color:${th.ink}; text-wrap: balance; }
    p.sub { margin:${t.gap ?? 34}px 0 0; font-family: Manrope; font-weight:500; font-size:${t.subSize ?? 50}px; line-height:1.3; letter-spacing:-0.012em; color:${th.sub}; text-wrap: balance; }
  </style></head><body><div id="stage"><div id="glow"></div>${dots}
    ${phoneHTML(g, `file://${DIR}/screens/${v.screen}`, statusColor, homeColor, th, v.time ?? '9:41')}
    ${(v.callouts || []).map((c, i) => calloutHTML(v, g, c, th, i)).join('')}
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
    execFileSync('python3', ['-I', '-c', `from PIL import Image; im=Image.open('${DIR}/screens/${v.screen}'); im.crop(tuple(${JSON.stringify(c.crop)})).save('${out}')`]);
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
    await page.evaluate((s) => {
      document.getElementById('stage').style.transform = `scale(${s})`;
    }, W / 1320);
    await page.evaluate(() => document.fonts.ready);
    // Titles stay on two lines at most: shrink if needed.
    const info = await page.evaluate(() => {
      const h = document.querySelector('h1');
      const lines = () => Math.round(h.getBoundingClientRect().height / (parseFloat(getComputedStyle(h).lineHeight) * (window.innerWidth / 1320)));
      let size = parseFloat(getComputedStyle(h).fontSize);
      while (lines() > 2 && size > 80) { size -= 4; h.style.fontSize = `${size}px`; }
      const s = document.querySelector('p.sub');
      const sl = s ? Math.round(s.getBoundingClientRect().height / (parseFloat(getComputedStyle(s).lineHeight) * (window.innerWidth / 1320))) : 0;
      return { title: lines(), size, sub: sl, copyBottom: Math.round(document.querySelector('.copy').getBoundingClientRect().bottom / (window.innerWidth / 1320)), phoneTop: Math.round(document.querySelector('.phone').getBoundingClientRect().top / (window.innerWidth / 1320)) };
    });
    await page.waitForTimeout(250);
    const out = `${OUTDIR}/${FOLDER[sz]}/${v.file}`;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, type: 'png' });
    (await import('node:child_process')).execFileSync('python3', ['-I', '-c', `from PIL import Image; im=Image.open('${out}').convert('RGB'); im.save('${out}', optimize=True)`]);
    console.log(v.name, sz, `${W}x${H}`, JSON.stringify(info));
    await page.close();
  }
}
await browser.close();
