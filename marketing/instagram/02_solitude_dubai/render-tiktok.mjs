/**
 * « Seul à Dubaï ? » version TikTok, texte sur photo : 10 slides 1080×1920.
 *   node marketing/instagram/02_solitude_dubai/render-tiktok.mjs
 * Écrit TIKTOK_TEXTE/01.png … 10.png ; avec --own, TIKTOK_PHOTOS_IRLY/ (photos IRLY seulement). Une photo plein écran par slide, le
 * titre en bandeaux blancs (l'outil texte de TikTok), le texte dessous.
 * Les slides 7 à 10 gardent les captures réelles de l'app dans un téléphone.
 * Le texte reste dans la zone sûre (onglets en haut, icônes à droite,
 * légende en bas) ; le rendu échoue sinon.
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
const ttf = path.join(root, 'marketing/tiktok/_tools/fonts');
const tt = (w) => ['latin', 'latin-ext'].map((sub) => `@font-face{font-family:'TikTok Sans';font-weight:${w};src:url(file://${ttf}/tiktok-sans-${sub}-${w}-normal.woff2)}`).join('');

const css = `
${tt(600)}${tt(700)}${tt(800)}
*{margin:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;background:#000;overflow:hidden}
.s{position:relative;width:1080px;height:1920px;overflow:hidden;font-family:'TikTok Sans',sans-serif;color:#fff}
.bg{position:absolute;inset:0;background-size:cover;background-position:var(--pos,center);filter:saturate(var(--sat,.8)) contrast(1.04) brightness(var(--b,.85))}
.shade{position:absolute;left:0;right:0;top:0;height:1250px;background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.35) 45%,rgba(0,0,0,0) 100%)}
.bot{position:absolute;left:0;right:0;bottom:0;height:520px;background:linear-gradient(0deg,rgba(0,0,0,.5),rgba(0,0,0,0))}
.tk{position:absolute;left:96px;right:150px;top:250px;text-align:center}
.t{font-weight:700;font-size:var(--fs,58px);line-height:1.52}
.t span{background:#fff;color:#111;padding:6px 20px;border-radius:14px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.b{margin-top:34px;font-weight:700;font-size:38px;line-height:1.36;text-shadow:0 0 4px rgba(0,0,0,.9),0 2px 14px rgba(0,0,0,.75)}
.soon{display:inline-block;margin-top:26px;padding:10px 26px;border-radius:999px;background:#fe2c55;color:#fff;font-weight:800;font-size:32px;letter-spacing:2px}
.phones{position:absolute;left:96px;right:150px;display:flex;justify-content:center;gap:28px}
.phone{height:100%;aspect-ratio:600 / 1298;border-radius:44px;background:#0b0b0c;padding:10px;box-shadow:0 30px 80px rgba(0,0,0,.65),inset 0 0 0 2px rgba(255,255,255,.16)}
.phone div{width:100%;height:100%;border-radius:35px;background-size:cover;background-position:top center}
.note{position:absolute;left:96px;right:150px;text-align:center;font-weight:600;font-size:24px;color:rgba(255,255,255,.8);text-shadow:0 0 4px rgba(0,0,0,.9)}
.ctas{position:absolute;left:96px;right:150px;display:flex;flex-direction:column;gap:16px;align-items:center}
.cta{font-weight:700;font-size:36px;line-height:1.35;text-align:center}
.cta span{background:#fff;color:#111;padding:6px 18px;border-radius:12px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.cta.main span{background:#fe2c55;color:#fff}
`;

const own = (k, v = '1200') => img(`site/img/own/${k}-${v}.jpg`);
const px = (k) => img(`public-photos/v/${k}-2400.jpg`);
const mixte = (k) => img(`site/shots/app/fr/${k}.jpg`);
const girl = (k) => img(`site/shots/fr/girl-${k}.jpg`);
const NOTE = 'Captures réelles de l’app · version démo, profils d’exemple';

// Textes fournis, mot pour mot.
const SLIDES = [
  { bg: own('newcomerGirl', 'hd'), pos: '50% 40%', t: 'TU VIS À DUBAÏ… MAIS TU TE SENS SEUL ?', b: 'Tu es venu chercher une meilleure vie. Mais parfois, tu aimerais simplement avoir quelqu’un avec qui partager la tienne.' },
  { bg: px('dubaiMarina-1'), pos: '50% 50%', t: 'COMMENT PEUT-ON SE SENTIR SEUL DANS UNE VILLE AUSSI PEUPLÉE ?', b: 'Des millions de personnes autour de toi. Des restaurants partout. Des soirées chaque semaine. Mais combien de personnes peux-tu réellement appeler quand tu as besoin de compagnie ?' },
  { bg: px('apartment-1'), pos: '30% 50%', t: 'QUAND TU ARRIVES À DUBAÏ, TU DOIS RECONSTRUIRE TOUTE TA VIE SOCIALE.', b: 'En France ou dans ton pays, tu avais tes amis, ta famille et tes habitudes. Ici, tu dois recommencer presque à zéro.' },
  { bg: px('girlWork-2'), pos: '55% 50%', t: 'TOUT LE MONDE A L’AIR D’AVOIR UNE VIE INCROYABLE.', b: 'Entre le travail, le business, la salle de sport et les sorties, il devient difficile de trouver des personnes disponibles pour créer de vraies amitiés.' },
  { bg: px('photography-1'), pos: '50% 50%', t: 'TU VEUX RENCONTRER DU MONDE… MAIS TU NE SAIS PAS PAR OÙ COMMENCER.', b: 'Tu aimerais sortir, faire du sport ou découvrir de nouveaux endroits avec d’autres personnes. Mais proposer une sortie à des inconnus n’est pas toujours facile.' },
  { bg: px('girlChill-1'), pos: '60% 50%', t: 'ET PETIT À PETIT, TU FINIS PAR T’HABITUER À FAIRE LES CHOSES SEUL.', b: 'Tu repousses certaines sorties. Tu passes davantage de temps chez toi. Tu regardes les autres partager des moments que tu aimerais aussi vivre.' },
  { bg: own('runMix'), pos: '50% 50%', t: 'ET SI TU N’ÉTAIS PAS LE SEUL À RESSENTIR ÇA ?', b: 'D’autres personnes vivent peut-être la même chose que toi. Elles aussi cherchent de nouveaux amis, des activités à partager et des connexions authentiques.', phones: [mixte('people')] },
  { bg: own('footballMix'), pos: '50% 50%', fs: 50, t: 'TU N’AS PAS FORCÉMENT BESOIN DE CHANGER DE VIE. TU AS PEUT-ÊTRE BESOIN DE RENCONTRER LES BONNES PERSONNES.', b: 'Imagine pouvoir découvrir des activités, trouver des personnes qui partagent tes centres d’intérêt et avoir davantage d’occasions de créer des liens.', phones: [mixte('activities'), mixte('categories')] },
  { bg: px('dubaiNight-1'), pos: '50% 50%', t: 'C’EST POUR ÇA QU’ON CRÉE IRLY.', soon: true, b: 'Une application pensée pour t’aider à découvrir des personnes, des activités et des communautés à Dubaï. Parce que rencontrer de nouvelles personnes devrait pouvoir commencer plus simplement.', phones: [mixte('home'), girl('home')] },
  { bg: px('dubaiNight-2'), pos: '50% 50%', t: 'ET SI TON HISTOIRE À DUBAÏ DEVENAIT UN PEU MOINS SOLITAIRE ?', b: 'Tu vis à Dubaï et tu veux élargir ton cercle social ? Découvre IRLY et suis notre lancement.',
    ctas: ['SUIS @IRLYOFFICIAL', 'CLIQUE SUR LE LIEN DU PROFIL', 'PARTAGE CE POST AVEC QUELQU’UN QUI POURRAIT SE RECONNAÎTRE.'] },
];

// Espace insécable avant ? et ! (typographie française, évite un « ? » seul en début de ligne).
const fr = (s) => s.replace(/ ([?!:;])/g, '&nbsp;$1').replace(/-(tu|on)\b/g, '&#8209;$1');

function html(s) {
  const text = `<div class="tk"><div class="t" style="--fs:${s.fs ?? 58}px"><span>${fr(s.t)}</span></div>${s.soon ? '<div class="soon">BIENTÔT</div>' : ''}<div class="b">${fr(s.b)}</div></div>`;
  const extra = [];
  if (s.phones) {
    extra.push(`<div class="phones" data-zone style="top:var(--py);height:var(--ph)">${s.phones.map((p) => `<div class="phone"><div style="background-image:url(${p})"></div></div>`).join('')}</div>`);
    extra.push(`<div class="note" data-zone style="top:calc(var(--py) + var(--ph) + 18px)">${NOTE}</div>`);
  }
  if (s.ctas) extra.push(`<div class="ctas" data-zone style="top:var(--py)">${s.ctas.map((c, k) => `<div class="cta${k ? '' : ' main'}"><span>${fr(c)}</span></div>`).join('')}</div>`);
  return `<div class="s"><div class="bg" style="background-image:url(${s.bg});--pos:${s.pos}${s.bri ? `;--b:${s.bri}` : ''}"></div><div class="shade"></div><div class="bot"></div>${text}${extra.join('')}</div>`;
}

// --own : uniquement les photos fournies par l'équipe IRLY (site/img/own).
const OWN = process.argv.includes('--own');
const OWN_BG = [
  ['newcomerGirl', '50% 40%', 'hd', 0.85], ['nightDinner', '50% 50%'], ['promenadeGirl', '40% 50%', '1200', 1.25], ['poolGirl', '50% 50%'], ['runGirl', '50% 40%'],
  ['readingGirl', '50% 50%'], ['runMix', '50% 50%'], ['footballMix', '50% 50%'], ['dinnerMix', '50% 50%'], ['yachtGirl', '50% 50%'],
];
// --envoyees : les 5 photos envoyées le 2026-10-27 (_src/), complétées par 5 photos IRLY.
const SENT = process.argv.includes('--envoyees');
const sent = (f) => img(`marketing/instagram/02_solitude_dubai/_src/${f}`);
const SENT_BG = [
  [sent('creek-arche.webp'), '50% 60%'], [sent('creek-foule.webp'), '50% 70%'], [sent('burj-nuit.webp'), '50% 50%'], [own('poolGirl'), '50% 50%'], [sent('creek-passerelle.webp'), '60% 50%'],
  [own('readingGirl'), '50% 50%'], [own('runMix'), '50% 50%'], [own('footballMix'), '50% 50%'], [own('dinnerMix'), '50% 50%'], [sent('creek-amies.webp'), '55% 50%'],
];
if (SENT) SLIDES.forEach((s, i) => Object.assign(s, { bg: SENT_BG[i][0], pos: SENT_BG[i][1], bri: 0.9 }));
// --sans-captures : aucune capture de l'app, seulement les photos.
const NO_SHOTS = process.argv.includes('--sans-captures');
if (NO_SHOTS) SLIDES.forEach((s) => delete s.phones);
if (OWN) SLIDES.forEach((s, i) => Object.assign(s, { bg: own(OWN_BG[i][0], OWN_BG[i][2]), pos: OWN_BG[i][1], bri: OWN_BG[i][3] }));
const out = path.join(dir, SENT ? 'TIKTOK_PHOTOS_ENVOYEES' : OWN ? (NO_SHOTS ? 'TIKTOK_PHOTOS_IRLY_SEULES' : 'TIKTOK_PHOTOS_IRLY') : 'TIKTOK_TEXTE');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const tmp = path.join(dir, '.slide.html');
const problems = [];
// Zone sûre TikTok : rien d'important sous 1600 px ni à droite de 930 px.
const SAFE_BOTTOM = 1600;
for (const [i, s] of SLIDES.entries()) {
  fs.writeFileSync(tmp, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${css}</style></head><body>${html(s)}</body></html>`);
  await page.goto(`file://${tmp}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // Place téléphones et boutons sous le texte, dans la place qui reste.
  const r = await page.evaluate((safe) => {
    const s = document.querySelector('.s');
    const textBottom = document.querySelector('.tk').getBoundingClientRect().bottom;
    const py = Math.round(textBottom + 50);
    const ph = Math.min(620, safe - py - 60);
    s.style.setProperty('--py', `${py}px`);
    s.style.setProperty('--ph', `${ph}px`);
    const zones = [...document.querySelectorAll('.tk,[data-zone]')].map((e) => e.getBoundingClientRect());
    return { textBottom, ph, bottom: Math.max(...zones.map((z) => z.bottom)), right: Math.max(...zones.map((z) => z.right)), fonts: document.fonts.check('700 40px "TikTok Sans"') };
  }, SAFE_BOTTOM);
  const name = String(i + 1).padStart(2, '0');
  if (r.bottom > SAFE_BOTTOM) problems.push(`${name}: déborde en bas (${Math.round(r.bottom)}px)`);
  if (r.right > 931) problems.push(`${name}: déborde à droite`);
  if (s.phones && r.ph < 420) problems.push(`${name}: téléphone trop petit (${r.ph}px)`);
  if (!r.fonts) problems.push(`${name}: police non chargée`);
  console.log(name, `texte→${Math.round(r.textBottom)}px`, `bas=${Math.round(r.bottom)}px`);
  await page.screenshot({ path: path.join(out, `${name}.png`), type: 'png' });
}
fs.rmSync(tmp, { force: true });
await browser.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('OK : 10 slides TikTok texte sur photo');
