/**
 * « Seul à Dubaï » : carrousel TikTok de 5 slides (1080×1920 JPEG).
 *   node marketing/tiktok/07_SEUL_A_DUBAI/render.mjs
 * Écrit FR/01.jpg … FR/05.jpg. Les textes restent dans la zone sûre de
 * TikTok (loin des onglets en haut, de la colonne d'icônes à droite et de
 * la légende en bas).
 */
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PW || 'playwright');

const dir = path.dirname(new URL(import.meta.url).pathname);
const src = (f) => `file://${dir}/_src/${f}`;
const fonts = path.resolve(dir, '../../../node_modules/@expo-google-fonts/manrope');
const tt = (w) => ['latin', 'latin-ext'].map((sub, k) => `@font-face{font-family:'TikTok Sans${k ? ' Ext' : ''}';font-weight:${w};src:url(file://${dir}/../_tools/fonts/tiktok-sans-${sub}-${w}-normal.woff2)}`).join('');
const font = (w, n) => `@font-face{font-family:Manrope;font-weight:${w};src:url(file://${fonts}/${n}/Manrope_${n}.ttf)}`;

// Le logo IRLY en points (mêmes lettres que src/brand/dots.ts).
const GLYPHS = {
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  L: ['#...', '#...', '#...', '#...', '#...', '#...', '####'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
};
function logo(step, color = '#fff') {
  const dots = [];
  let x = 0;
  for (const ch of 'IRLY') {
    const g = GLYPHS[ch];
    g.forEach((line, row) => [...line].forEach((c, col) => c === '#' && dots.push([x + col, row + 2.2])));
    x += g[0].length + 1;
  }
  for (const [c, r] of [[0, 0], [1, 0], [0, 1], [1, 1]]) dots.push([x - 0.4 + c, r]);
  const w = (x + 1.6) * step;
  const h = 9.2 * step;
  const r = step * 0.36;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${dots.map(([c, rw]) => `<circle cx="${(c + 0.5) * step}" cy="${(rw + 0.5) * step}" r="${r}" fill="${color}"/>`).join('')}</svg>`;
}

const css = `
${tt(600)}${tt(700)}${tt(800)}
${font(500, '500Medium')}${font(600, '600SemiBold')}${font(700, '700Bold')}${font(800, '800ExtraBold')}
*{margin:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;background:#050506;overflow:hidden}
.s{position:relative;width:1080px;height:1920px;font-family:Manrope;color:#fff;overflow:hidden}
.bg{position:absolute;inset:0;background-size:cover;background-position:var(--pos,center)}
.cold .bg{filter:saturate(.62) contrast(1.06) brightness(var(--b,.8))}
.warm .bg{filter:saturate(1.05) contrast(1.04) brightness(var(--b,.92))}
.top-shade{position:absolute;left:0;right:0;top:0;height:1100px;background:linear-gradient(180deg,rgba(0,0,0,.78) 0%,rgba(0,0,0,.5) 38%,rgba(0,0,0,0) 100%)}
.bot-shade{position:absolute;left:0;right:0;bottom:0;height:700px;background:linear-gradient(0deg,rgba(0,0,0,.6),rgba(0,0,0,0))}
.vig{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 50%,rgba(0,0,0,0) 55%,rgba(0,0,0,.45) 100%)}
.grain{position:absolute;inset:0;opacity:.09;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.txt{position:absolute;left:92px;right:150px;top:330px}
.k{font-weight:700;font-size:28px;letter-spacing:7px;text-transform:uppercase;color:rgba(255,255,255,.66);margin-bottom:34px}
.t{font-weight:800;font-size:86px;line-height:1.06;letter-spacing:-2px;text-shadow:0 2px 30px rgba(0,0,0,.45)}
.t i{font-style:normal;color:rgba(255,255,255,.55)}
.swipe{position:absolute;right:150px;top:1260px;font-weight:600;font-size:30px;letter-spacing:2px;color:rgba(255,255,255,.75)}
/* Écriture TikTok : TikTok Sans centrée, texte noir sur bandeaux blancs arrondis (le fond de texte de l'app). */
.tk{position:absolute;left:110px;right:110px;top:440px;text-align:center;font-family:'TikTok Sans','TikTok Sans Ext',sans-serif}
.tk .t{font-weight:700;font-size:60px;line-height:1.5;letter-spacing:0;text-shadow:none}
.tk .t span{background:#fff;color:#111;padding:6px 22px;border-radius:14px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.tk .sw{margin-top:40px;font-weight:700;font-size:40px;color:#fff;text-shadow:0 0 4px rgba(0,0,0,.95),0 2px 10px rgba(0,0,0,.8)}
.light .top-shade{opacity:.35}.light .bot-shade{opacity:.5}
/* Slide 2 : la photo paysage en bande nette, sur son propre flou. */
.blur{position:absolute;inset:-60px;background-size:cover;background-position:center;filter:blur(40px) saturate(.5) brightness(.45)}
.band{position:absolute;left:0;top:820px;width:1080px;height:675px;background-size:cover;background-position:center;filter:saturate(.62) contrast(1.06) brightness(.86);box-shadow:0 30px 80px rgba(0,0,0,.55)}
/* Slide 5 */
.card{position:absolute;left:64px;right:64px;top:930px;height:540px;border-radius:44px;background:rgba(14,14,16,.58);backdrop-filter:blur(26px) saturate(1.2);-webkit-backdrop-filter:blur(26px) saturate(1.2);border:1.5px solid rgba(255,255,255,.16);box-shadow:0 30px 90px rgba(0,0,0,.45)}
.card .in{position:absolute;left:56px;top:58px;width:600px}
.card .tag{font-weight:600;font-size:36px;line-height:1.38;color:rgba(255,255,255,.92);margin-top:34px}
.card .cta{display:inline-block;margin-top:40px;padding:20px 30px;border-radius:999px;background:#fff;color:#0a0a0b;font-weight:700;font-size:28px;letter-spacing:-.2px;white-space:nowrap}
.card .cta b{font-weight:800}
.phone{position:absolute;right:26px;top:-150px;width:300px;height:649px;border-radius:52px;background:#0b0b0c;padding:12px;transform:rotate(6deg);box-shadow:0 40px 90px rgba(0,0,0,.6),inset 0 0 0 2px rgba(255,255,255,.12)}
.phone div{width:100%;height:100%;border-radius:42px;background-size:cover;background-position:top center}
`;

const S = [
  { cls: 'cold', img: 'u79.jpg', pos: '50% 40%', b: 0.82, k: 'Dubaï', t: 'Tu es venu à Dubaï pour réussir…', swipe: true },
  { band: 'laptop.jpg', k: 'Dubaï', t: '…mais tu galères à te créer un vrai réseau.' },
  { cls: 'cold', img: 'u80.jpg', pos: '50% 55%', b: 0.8, k: 'Dubaï', t: 'Et malgré tout ce monde, tu te retrouves seul.' },
  { cls: 'warm', img: 'u83.jpg', pos: '50% 60%', b: 0.9, k: 'Dubaï', t: 'Tu n’es pas venu ici pour tout vivre tout seul.' },
  { cls: 'warm', img: 'u82.jpg', pos: '50% 30%', b: 0.9, final: true, t: 'Dubaï est plus belle quand tu ne la vis pas seul.' },
];

// Le texte en bandeaux blancs, comme l'outil texte de TikTok.
const tk = (t, extra = '') => `<div class="tk"><div class="t"><span>${t}</span></div>${extra}</div>`;

function html(s) {
  if (s.band) {
    return `<div class="s light"><div class="blur" style="background-image:url(${src(s.band)})"></div><div class="band" style="background-image:url(${src(s.band)})"></div><div class="grain"></div>${tk(s.t)}</div>`;
  }
  const head = `<div class="s ${s.cls} light"><div class="bg" style="background-image:url(${src(s.img)});--pos:${s.pos};--b:${s.b}"></div><div class="top-shade"></div><div class="bot-shade"></div><div class="vig"></div><div class="grain"></div>`;
  if (s.final) {
    return `${head}<div class="tk" style="top:330px"><div class="t"><span>${s.t}</span></div></div>
      <div class="card"><div class="phone"><div style="background-image:url(${src('app-home.jpg')})"></div></div>
        <div class="in">${logo(15)}<div class="tag">Fais des rencontres.<br>Développe ton réseau.<br>Vis de vrais moments.</div>
        <div class="cta">Bientôt à Dubaï · Suis <b>@irlyofficial</b></div></div></div></div>`;
  }
  return `${head}${tk(s.t)}</div>`;
}

const out = path.join(dir, 'FR');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
for (const [i, s] of S.entries()) {
  // A file page, so the photos and fonts (file:// URLs) can load.
  const tmp = path.join(dir, '_src', '.slide.html');
  fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html(s)}</body></html>`);
  await page.goto(`file://${tmp}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, `${String(i + 1).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 92 });
}
fs.rmSync(path.join(dir, '_src', '.slide.html'), { force: true });
await browser.close();
console.log('rendered', S.length, 'slides →', out);
