/**
 * « Seul à Dubaï ? » : carrousel Instagram de 10 slides, 3 images chacune.
 *   node marketing/instagram/02_solitude_dubai/render.mjs
 * Écrit FR/01.png … FR/10.png (1080×1350), TIKTOK/01.png … (1080×1920)
 * et apercu.png. Les images viennent du dépôt, sans copie ni retouche :
 * photos IRLY (site/img/own), banque Pixabay (public-photos/v), guides
 * (site/img/guides) et captures réelles du build démo (site/shots).
 * Le rendu échoue si un texte déborde ou si une slide n'a pas 3 images.
 */
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PW || 'playwright');

const dir = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(dir, '../../..');
const img = (p) => {
  const f = path.join(root, p);
  if (!fs.existsSync(f)) throw new Error(`image manquante : ${p}`);
  return `file://${f}`;
};
const fonts = path.join(root, 'node_modules/@expo-google-fonts/manrope');
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

const css = (W, H, pad) => `
${font(500, '500Medium')}${font(600, '600SemiBold')}${font(700, '700Bold')}${font(800, '800ExtraBold')}
*{margin:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;background:#08080a;overflow:hidden}
.s{position:relative;width:${W}px;height:${H}px;font-family:Manrope;color:#fff;overflow:hidden;display:flex;flex-direction:column;padding:${pad.top}px 72px ${pad.bottom}px;
  background:radial-gradient(90% 55% at 85% 0%,rgba(120,110,160,.22),rgba(0,0,0,0) 70%),radial-gradient(80% 50% at 0% 100%,rgba(190,140,110,.16),rgba(0,0,0,0) 70%),#08080a}
.s.warm{background:radial-gradient(90% 55% at 85% 0%,rgba(230,170,120,.22),rgba(0,0,0,0) 70%),radial-gradient(80% 50% at 0% 100%,rgba(200,120,150,.18),rgba(0,0,0,0) 70%),#0a0909}
.grain{position:absolute;inset:0;opacity:.07;mix-blend-mode:overlay;pointer-events:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.head{display:flex;align-items:center;justify-content:space-between;height:40px;flex:none}
.head .n{font-weight:700;font-size:24px;letter-spacing:4px;color:rgba(255,255,255,.55)}
.t{margin-top:44px;font-weight:800;font-size:var(--fs,68px);line-height:1.1;letter-spacing:-1.5px;text-transform:uppercase;flex:none}
.t i{font-style:normal;color:rgba(255,255,255,.5)}
.b{margin-top:26px;font-weight:500;font-size:31px;line-height:1.38;color:rgba(255,255,255,.8);max-width:900px;flex:none}
.g{margin-top:40px;flex:1;min-height:0;display:grid;gap:16px}
.g > *{min-height:0;min-width:0}
.ph{border-radius:30px;background-size:cover;background-position:var(--pos,center);box-shadow:0 24px 60px rgba(0,0,0,.45);position:relative;overflow:hidden}
.cold{filter:saturate(.7) contrast(1.05) brightness(.9)}
.mosaic{grid-template-columns:1.55fr 1fr;grid-template-rows:1fr 1fr}
.mosaic > :first-child{grid-row:1 / span 2}
.mosaicR{grid-template-columns:1fr 1.55fr;grid-template-rows:1fr 1fr}
.mosaicR > :last-child{grid-row:1 / span 2;grid-column:2;grid-row-start:1}
.trio{grid-template-columns:1fr 1fr 1fr}
.phones{display:flex;justify-content:center;align-items:center;gap:26px}
.phone{height:100%;aspect-ratio:600 / 1298;border-radius:46px;background:#0b0b0c;padding:10px;box-shadow:0 30px 70px rgba(0,0,0,.6),inset 0 0 0 2px rgba(255,255,255,.14);flex:none}
.phone > div{width:100%;height:100%;border-radius:37px;background-size:cover;background-position:top center}
.phones .phone{height:auto;width:calc((100% - 52px) / 3);max-height:100%}
.phones .phone:nth-child(1),.phones .phone:nth-child(3){transform:scale(.9)}
.mix{display:flex;gap:16px}
.mix .col{flex:1;display:flex;flex-direction:column;gap:16px}
.mix .col .ph{flex:1}
.mix .phone{height:100%}
.logo{border-radius:30px;background:#000;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 2px rgba(255,255,255,.12)}
.cap{margin-top:18px;font-weight:600;font-size:21px;letter-spacing:.2px;color:rgba(255,255,255,.5);flex:none;display:flex;justify-content:space-between;gap:20px}
.cap .sw{color:rgba(255,255,255,.85);white-space:nowrap}
.soon{display:inline-block;margin-left:14px;padding:6px 16px;border-radius:999px;background:#fff;color:#0a0a0b;font-weight:800;font-size:22px;letter-spacing:2px;vertical-align:middle}
.ctas{margin-top:26px;display:flex;flex-direction:column;gap:12px;flex:none}
.cta{display:flex;align-items:center;gap:18px;padding:18px 26px;border-radius:24px;background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.14);font-weight:800;font-size:26px;letter-spacing:.5px;line-height:1.25}
.cta.main{background:#fff;color:#0a0a0b;border-color:#fff}
.cta b{font-weight:800;opacity:.45;font-size:24px;width:30px;flex:none}
`;

const own = (k) => img(`site/img/own/${k}-1200.jpg`);
const px = (k) => img(`public-photos/v/${k}-1600.jpg`);
const guide = (k) => img(`site/img/guides/${k}.jpg`);
const mixte = (k) => img(`site/shots/app/fr/${k}.jpg`);
const girl = (k) => img(`site/shots/fr/girl-${k}.jpg`);

const P = (src, pos = 'center', cls = '') => ({ kind: 'photo', src, pos, cls });
const S_ = (src) => ({ kind: 'shot', src });
const SHOTS = 'Captures réelles de l’app IRLY · version démo, profils d’exemple';

// Les textes sont ceux fournis, mot pour mot.
const SLIDES = [
  { t: 'Tu vis à Dubaï… <i>mais tu te sens seul&nbsp;?</i>', b: 'Tu es venu chercher une meilleure vie. Mais parfois, tu aimerais simplement avoir quelqu’un avec qui partager la tienne.', layout: 'mosaic',
    imgs: [P(own('newcomerGirl'), '50% 40%'), P(px('dubaiNight-1'), '50% 50%'), P(own('skylineGirl'), '50% 45%', 'cold')] },
  { t: 'Comment peut-on se sentir seul dans une ville <i>aussi peuplée&nbsp;?</i>', fs: 64, b: 'Des millions de personnes autour de toi. Des restaurants partout. Des soirées chaque semaine. Mais combien de personnes peux-tu réellement appeler quand tu as besoin de compagnie&nbsp;?', layout: 'mosaicR',
    imgs: [P(own('globalVillage'), '50% 50%'), P(px('dubaiMarina-1'), '50% 50%'), P(px('girlCoffee-1'), '40% 50%', 'cold')] },
  { t: 'Quand tu arrives à Dubaï, <i>tu dois reconstruire toute ta vie sociale.</i>', fs: 62, b: 'En France ou dans ton pays, tu avais tes amis, ta famille et tes habitudes. Ici, tu dois recommencer presque à zéro.', layout: 'mosaic',
    imgs: [P(px('apartment-1'), '50% 50%', 'cold'), P(px('passport-3'), '50% 50%'), P(px('coffeeBar-2'), '50% 40%', 'cold')] },
  { t: 'Tout le monde a l’air d’avoir <i>une vie incroyable.</i>', b: 'Entre le travail, le business, la salle de sport et les sorties, il devient difficile de trouver des personnes disponibles pour créer de vraies amitiés.', layout: 'mosaicR',
    imgs: [P(px('girlWork-2'), '50% 50%'), P(own('promenadeGirl'), '50% 50%', 'cold'), P(own('dinnerMix'), '50% 45%')] },
  { t: 'Tu veux rencontrer du monde… <i>mais tu ne sais pas par où commencer.</i>', fs: 62, b: 'Tu aimerais sortir, faire du sport ou découvrir de nouveaux endroits avec d’autres personnes. Mais proposer une sortie à des inconnus n’est pas toujours facile.', layout: 'mosaic',
    imgs: [P(px('photography-1'), '50% 50%', 'cold'), P(own('runGirl'), '50% 40%'), P(guide('volleyball'), '50% 50%')] },
  { t: 'Et petit à petit, <i>tu finis par t’habituer à faire les choses seul.</i>', fs: 62, b: 'Tu repousses certaines sorties. Tu passes davantage de temps chez toi. Tu regardes les autres partager des moments que tu aimerais aussi vivre.', layout: 'mosaicR',
    imgs: [P(px('girlChill-1'), '50% 50%', 'cold'), P(px('lounge-1'), '50% 50%', 'cold'), P(own('girlsOut'), '50% 45%')] },
  { t: 'Et si tu n’étais pas <i>le seul à ressentir ça&nbsp;?</i>', b: 'D’autres personnes vivent peut-être la même chose que toi. Elles aussi cherchent de nouveaux amis, des activités à partager et des connexions authentiques.', layout: 'mix', cap: SHOTS,
    imgs: [P(guide('dubaiCreek'), '35% 50%', 'cold'), P(own('runMix'), '50% 50%'), S_(mixte('people'))] },
  { t: 'Tu n’as pas forcément besoin de changer de vie. <i>Tu as peut-être besoin de rencontrer les bonnes personnes.</i>', fs: 52, warm: true, b: 'Imagine pouvoir découvrir des activités, trouver des personnes qui partagent tes centres d’intérêt et avoir davantage d’occasions de créer des liens.', layout: 'mix', cap: SHOTS,
    imgs: [S_(mixte('activities')), S_(mixte('categories')), P(own('footballMix'), '50% 50%')], mixShots: true },
  { t: 'C’est pour ça <i>qu’on crée IRLY.</i><span class="soon">BIENTÔT</span>', warm: true, b: 'Une application pensée pour t’aider à découvrir des personnes, des activités et des communautés à Dubaï. Parce que rencontrer de nouvelles personnes devrait pouvoir commencer plus simplement.', layout: 'phones', cap: 'IRLY Mixte · IRLY Girl · communauté New in Dubai — captures réelles, version démo, profils d’exemple',
    imgs: [S_(mixte('home')), S_(girl('home')), S_(girl('group'))] },
  { t: 'Et si ton histoire à Dubaï devenait <i>un peu moins solitaire&nbsp;?</i>', fs: 56, warm: true, b: 'Tu vis à Dubaï et tu veux élargir ton cercle social&nbsp;? Découvre IRLY et suis notre lancement.', layout: 'final', last: true,
    imgs: [{ kind: 'logo' }, S_(girl('invite')), P(px('dubaiNight-2'), '50% 50%')],
    ctas: ['Suis @irlyofficial', 'Clique sur le lien du profil', 'Partage ce post avec quelqu’un qui pourrait se reconnaître.'] },
];

const cell = (m) => {
  if (m.kind === 'photo') return `<div class="ph ${m.cls}" data-img style="background-image:url(${m.src});--pos:${m.pos}"></div>`;
  if (m.kind === 'shot') return `<div class="phone" data-img><div style="background-image:url(${m.src})"></div></div>`;
  return `<div class="logo" data-img>${logo(16)}</div>`;
};

function grid(s) {
  const [a, b, c] = s.imgs;
  if (s.layout === 'phones') return `<div class="g phones">${cell(a)}${cell(b)}${cell(c)}</div>`;
  if (s.layout === 'mix' && s.mixShots) return `<div class="g mix">${cell(a)}${cell(b)}<div class="col">${cell(c)}</div></div>`;
  if (s.layout === 'mix') return `<div class="g mix"><div class="col">${cell(a)}${cell(b)}</div>${cell(c)}</div>`;
  if (s.layout === 'final') return `<div class="g mix"><div class="col">${cell(a)}${cell(c)}</div>${cell(b)}</div>`;
  if (s.layout === 'mosaicR') return `<div class="g mosaicR">${cell(b)}${cell(c)}${cell(a)}</div>`;
  return `<div class="g ${s.layout}">${cell(a)}${cell(b)}${cell(c)}</div>`;
}

function html(s, i, tall) {
  const fs_ = tall ? Math.round((s.fs ?? 68) * 1.08) : s.fs ?? 68;
  const cap = s.last
    ? ''
    : `<div class="cap"><span>${s.cap ?? ''}</span><span class="sw">${i === 0 ? 'Glisse →' : '→'}</span></div>`;
  const ctas = s.ctas
    ? `<div class="ctas">${s.ctas.map((c, k) => `<div class="cta${k === 0 ? ' main' : ''}"><b>${k + 1}</b>${c}</div>`).join('')}</div>`
    : '';
  return `<div class="s${s.warm ? ' warm' : ''}"><div class="head">${logo(4.2)}<span class="n">${String(i + 1).padStart(2, '0')} / ${SLIDES.length}</span></div>
    <div class="t" style="--fs:${fs_}px">${s.t}</div><div class="b">${s.b}</div>${grid(s)}${ctas}${cap}<div class="grain"></div></div>`;
}

const FORMATS = [
  { dir: 'FR', W: 1080, H: 1350, pad: { top: 64, bottom: 56 } },
  // TikTok : marges hautes et basses pour les onglets et la légende.
  { dir: 'TIKTOK', W: 1080, H: 1920, pad: { top: 200, bottom: 330 } },
];

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const tmp = path.join(dir, '.slide.html');
const problems = [];
for (const f of FORMATS) {
  const out = path.join(dir, f.dir);
  fs.mkdirSync(out, { recursive: true });
  const page = await browser.newPage({ viewport: { width: f.W, height: f.H }, deviceScaleFactor: 1 });
  for (const [i, s] of SLIDES.entries()) {
    fs.writeFileSync(tmp, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${css(f.W, f.H, f.pad)}</style></head><body>${html(s, i, f.H > 1500)}</body></html>`);
    await page.goto(`file://${tmp}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const check = await page.evaluate(() => {
      const s = document.querySelector('.s');
      const g = document.querySelector('.g').getBoundingClientRect();
      const over = [...s.children].filter((e) => !e.classList.contains('grain')).some((e) => e.getBoundingClientRect().bottom > s.clientHeight + 0.5);
      const wide = [...document.querySelectorAll('[data-img]')].some((e) => { const r = e.getBoundingClientRect(); return r.left < 71 || r.right > s.clientWidth - 71; });
      return { wide, n: document.querySelectorAll('[data-img]').length, gridH: Math.round(g.height), over, fonts: document.fonts.check('800 40px Manrope') };
    });
    const name = `${f.dir}/${String(i + 1).padStart(2, '0')}`;
    if (check.n !== 3) problems.push(`${name}: ${check.n} images`);
    if (check.wide) problems.push(`${name}: image hors marge`);
    if (check.over) problems.push(`${name}: déborde`);
    if (check.gridH < 380) problems.push(`${name}: images trop petites (${check.gridH}px)`);
    if (!check.fonts) problems.push(`${name}: police non chargée`);
    console.log(name, `images=${check.n}`, `grille=${check.gridH}px`);
    await page.screenshot({ path: path.join(out, `${String(i + 1).padStart(2, '0')}.png`), type: 'png' });
  }
  await page.close();
}

// Aperçu : les 10 slides Instagram en planche.
const thumbs = SLIDES.map((_, i) => `<img src="file://${dir}/FR/${String(i + 1).padStart(2, '0')}.png">`).join('');
fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#1a1a1d;padding:40px;display:grid;grid-template-columns:repeat(5,360px);gap:24px;width:1976px}img{width:360px;height:450px;border-radius:12px;display:block}</style></head><body>${thumbs}</body></html>`);
const page = await browser.newPage({ viewport: { width: 1976, height: 1100 } });
await page.goto(`file://${tmp}`, { waitUntil: 'load' });
await page.screenshot({ path: path.join(dir, 'apercu.png'), fullPage: true });
fs.rmSync(tmp, { force: true });
await browser.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('OK : 10 slides × 2 formats + apercu.png');
