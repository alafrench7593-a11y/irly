/**
 * IRLY Girl « Tes prochaines copines » : carrousel TikTok de 6 slides (1080×1920 JPEG).
 *   node marketing/tiktok/08_GIRL_COPINES/render.mjs
 * Écrit FR/01.jpg … FR/06.jpg. Slides 1 à 5 : photos du propriétaire avec
 * l'écriture de TikTok (TikTok Sans, bandeaux blancs). Slide 6 : identité
 * IRLY Girl avec trois vrais écrans de l'app.
 */
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PW || 'playwright');

const dir = path.dirname(new URL(import.meta.url).pathname);
const src = (f) => `file://${dir}/_src/${f}`;
const tt = (w) => ['latin', 'latin-ext'].map((sub, k) => `@font-face{font-family:'TikTok Sans${k ? ' Ext' : ''}';font-weight:${w};src:url(file://${dir}/../_tools/fonts/tiktok-sans-${sub}-${w}-normal.woff2)}`).join('');
const manrope = path.resolve(dir, '../../../node_modules/@expo-google-fonts/manrope');
const mr = (w, n) => `@font-face{font-family:Manrope;font-weight:${w};src:url(file://${manrope}/${n}/Manrope_${n}.ttf)}`;

const css = `
${tt(600)}${tt(700)}${tt(800)}${mr(500, '500Medium')}${mr(700, '700Bold')}${mr(800, '800ExtraBold')}
@font-face{font-family:Serif;src:url(${src('InstrumentSerif_400Regular.ttf')})}
@font-face{font-family:Serif;font-style:italic;src:url(${src('InstrumentSerif_400Regular_Italic.ttf')})}
*{margin:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:#0b0b0c}
.s{position:relative;width:1080px;height:1920px;overflow:hidden;color:#fff}
.bg{position:absolute;inset:0;background-size:cover;background-position:var(--pos,center);filter:var(--f)}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.42) 0%,rgba(0,0,0,.12) 34%,rgba(0,0,0,0) 55%,rgba(0,0,0,.35) 100%)}
.grain{position:absolute;inset:0;opacity:.07;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.rose{position:absolute;inset:0;background:linear-gradient(180deg,rgba(244,200,214,.18),rgba(240,218,204,.08) 50%,rgba(185,43,105,.10))}
/* Écriture TikTok : texte noir sur bandeaux blancs arrondis, centré. */
.tk{position:absolute;left:110px;right:110px;top:var(--top,440px);text-align:center;font-family:'TikTok Sans','TikTok Sans Ext','Noto Color Emoji',sans-serif}
.tk .t{font-weight:700;font-size:60px;line-height:1.5}
.tk .t span{background:#fff;color:#111;padding:6px 22px;border-radius:14px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.tk .sub{margin-top:34px;font-weight:700;font-size:44px;line-height:1.3;color:#fff;text-shadow:0 0 4px rgba(0,0,0,.95),0 2px 12px rgba(0,0,0,.8)}
/* Slide 6 : IRLY Girl. */
.girl{background:linear-gradient(180deg,#FBF2F4 0%,#F6E3E8 46%,#EFD9CF 100%);color:#2B1520}
.glow{position:absolute;border-radius:50%;filter:blur(90px)}
.logo{position:absolute;left:0;right:0;top:250px;display:flex;justify-content:center;align-items:baseline;gap:18px}
.logo b{font-family:Manrope;font-weight:800;font-size:44px;letter-spacing:16px;color:#2B1520}
.logo i{width:16px;height:16px;border-radius:50%;background:#E0457B;align-self:center;display:block}
.logo em{font-family:Serif;font-style:italic;font-size:92px;color:#B92B69;line-height:1}
.head{position:absolute;left:60px;right:60px;top:390px;text-align:center;font-family:Serif;font-size:80px;line-height:1.04;letter-spacing:-.5px}
.head em{font-style:italic;color:#B92B69}
.head .emo{font-family:'Noto Color Emoji';font-size:66px}
.sub6{position:absolute;left:96px;right:96px;top:600px;text-align:center;font-family:Manrope;font-weight:600;font-size:36px;color:#5B3A48}
.phones{position:absolute;left:0;right:0;top:730px;height:760px}
.ph{position:absolute;width:330px;height:584px;border-radius:52px;background:#1a1216;padding:11px;box-shadow:0 40px 80px rgba(120,40,70,.28),inset 0 0 0 2px rgba(255,255,255,.18)}
.ph div{width:100%;height:100%;border-radius:42px;background-size:cover;background-position:top center}
.p1{left:52px;top:70px;transform:rotate(-7deg)}
.p2{left:375px;top:0;transform:none;z-index:2;width:340px;height:602px}
.p3{right:52px;top:70px;transform:rotate(7deg)}
.cta{position:absolute;left:0;right:0;top:1420px;display:flex;flex-direction:column;align-items:center;gap:22px}
.btn{font-family:Manrope;font-weight:800;font-size:38px;letter-spacing:3px;color:#fff;background:#B92B69;padding:30px 54px;border-radius:999px;box-shadow:0 18px 40px rgba(185,43,105,.35)}
.note{font-family:Manrope;font-weight:600;font-size:30px;color:#6E4A5A}
`;

const S = [
  { img: 'u80.jpg', pos: '50% 55%', f: 'saturate(.7) brightness(.86)', t: 'Tu vis à Dubaï… mais tu n’as toujours pas trouvé tes copines ?' },
  { img: 'u82.jpg', pos: '50% 40%', f: 'saturate(.55) brightness(.78) contrast(1.04)', t: 'Tout le monde semble avoir ses copines… sauf toi.' },
  { img: 'u79.jpg', pos: '30% 50%', f: 'saturate(.6) brightness(.62) contrast(1.08)', t: 'Alors tu scrolles TikTok et Snap jusqu’à tard…', sub: 'Juste pour oublier que tu te sens seule.' },
  { img: 'brunch.jpg', pos: '50% 50%', f: 'saturate(.75) brightness(.84)', t: 'Le sport, les sorties, les brunchs… Tu aimerais, mais pas toute seule.' },
  { img: 'u83.jpg', pos: '50% 60%', f: 'saturate(1.08) brightness(.98)', rose: true, top: '380px', t: 'Et si tu rencontrais enfin des filles avec qui partager tout ça ?' },
  { final: true },
];

function html(s) {
  if (s.final) {
    return `<div class="s girl">
      <div class="glow" style="width:700px;height:700px;left:-200px;top:-120px;background:rgba(244,180,204,.6)"></div>
      <div class="glow" style="width:640px;height:640px;right:-220px;top:900px;background:rgba(232,200,182,.65)"></div>
      <div class="logo"><b>IRLY</b><i></i><em>Girl</em></div>
      <div class="head">Tes prochaines copines sont peut-être sur <em>IRLY&nbsp;Girl.</em>&nbsp;<span class="emo">💗</span></div>
      <div class="sub6">Rencontre des filles. Trouve tes activités.<br>Crée de vrais liens.</div>
      <div class="phones">
        <div class="ph p1"><div style="background-image:url(${src('girl-communities.jpg')})"></div></div>
        <div class="ph p3"><div style="background-image:url(${src('girl-notifications.jpg')})"></div></div>
        <div class="ph p2"><div style="background-image:url(${src('girl-chat.jpg')})"></div></div>
      </div>
      <div class="cta"><div class="btn">DÉCOUVRE IRLY GIRL →</div><div class="note">Bientôt sur iPhone et Android · @irlyofficial</div></div>
    </div>`;
  }
  return `<div class="s"><div class="bg" style="background-image:url(${src(s.img)});--pos:${s.pos};--f:${s.f}"></div><div class="shade"></div>${s.rose ? '<div class="rose"></div>' : ''}<div class="grain"></div>
    <div class="tk" style="--top:${s.top ?? '440px'}"><div class="t"><span>${s.t}</span></div>${s.sub ? `<div class="sub">${s.sub}</div>` : ''}</div></div>`;
}

const out = path.join(dir, 'FR');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const tmp = path.join(dir, '_src', '.slide.html');
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
for (const [i, s] of S.entries()) {
  // Une page fichier, pour que les photos et les polices (file://) se chargent.
  fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html(s)}</body></html>`);
  await page.goto(`file://${tmp}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, `${String(i + 1).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 92 });
}
fs.rmSync(tmp, { force: true });
await browser.close();
console.log('rendered', S.length, 'slides →', out);
