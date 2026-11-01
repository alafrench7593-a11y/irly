/**
 * « 4 apps à Dubaï » : 4 carrousels de 5 slides (Touriste, Network, Activités, Communauté).
 *   node marketing/instagram/03_4_apps_dubai/render.mjs
 * Écrit <VERSION>/INSTAGRAM/01.png … 05.png (1080×1350) et <VERSION>/TIKTOK/01.png … (1080×1920).
 * Style TikTok : texte blanc centré avec ombre, sur la photo envoyée (_src/), floutée à partir de la slide 2.
 * IRLY est montré avec les captures réelles du build démo. Les autres apps sont nommées en texte :
 * aucun logo officiel n'était téléchargeable ici, et on n'en dessine pas de faux.
 * Le rendu échoue si un texte sort de la zone sûre.
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
const src = (f) => img(`marketing/instagram/03_4_apps_dubai/_src/${f}`);
const mixte = (k) => img(`site/shots/app/fr/${k}.jpg`);
const girl = (k) => img(`site/shots/fr/girl-${k}.jpg`);
const NOTE = 'Captures réelles de l’app · version démo, profils d’exemple';

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

const CTA = (share) => ({
  kind: 'cta',
  t: 'IRLY ARRIVE À DUBAÏ',
  b: 'Gratuit au lancement.',
  ctas: ['SUIS @IRLYOFFICIAL', 'LIEN DANS LA BIO', share],
});

const VERSIONS = [
  {
    key: 'V1_TOURISTE', photo: 'touriste-burj-balcon.webp', pos: '50% 35%',
    slides: [
      { kind: 'hook', t: 'TU PARS À DUBAÏ ?', b: '4 apps à avoir dans ton téléphone avant de partir' },
      { kind: 'irly', n: 1, name: 'IRLY', b: 'Pour ne pas visiter Dubaï seul·e : des activités et des gens avec qui sortir.', phones: [mixte('activities'), mixte('people')] },
      { kind: 'apps', apps: [
        { n: 2, name: 'Careem', b: 'Taxis, livraison de repas et courses dans une seule app.' },
        { n: 3, name: 'Visit Dubai', b: 'L’app officielle du tourisme de Dubaï : lieux, événements, idées de visites.' },
      ] },
      { kind: 'apps', apps: [{ n: 4, name: 'Google Maps', b: 'Itinéraires à pied, en métro ou en taxi, et les lieux autour de toi.' }],
        diff: 'Les autres t’aident à visiter. IRLY t’aide à rencontrer du monde, en vrai.' },
      CTA('ENVOIE-LE À LA PERSONNE QUI PART AVEC TOI'),
    ],
  },
  {
    key: 'V2_NETWORK', photo: 'network-rooftop.webp', pos: '50% 45%',
    slides: [
      { kind: 'hook', t: 'NOUVEAU À DUBAÏ ?', b: '4 apps utiles pour développer ton réseau' },
      { kind: 'irly', n: 1, name: 'IRLY Network', b: 'Rencontre des gens qui lancent des projets, autour d’un café ou d’une activité.', phones: [mixte('network')] },
      { kind: 'apps', apps: [
        { n: 2, name: 'LinkedIn', b: 'Garde le contact après une rencontre et suis les entreprises de Dubaï.' },
        { n: 3, name: 'Meetup', b: 'Des groupes par thème : tech, entrepreneuriat, langues, sport.' },
      ] },
      { kind: 'apps', apps: [{ n: 4, name: 'Eventbrite', b: 'Conférences, ateliers et soirées networking, avec billet.' }],
        diff: 'Pas besoin d’attendre un événement : rencontre en vrai des gens qui ont les mêmes projets que toi.' },
      CTA('ENVOIE-LE À UN AMI QUI LANCE SON PROJET'),
    ],
  },
  {
    key: 'V3_ACTIVITES', photo: 'activites-anniversaire.webp', pos: '50% 40%',
    slides: [
      { kind: 'hook', t: '« ON FAIT QUOI CE WEEK&#8209;END ? »', b: '4 apps pour ne plus jamais manquer d’idées de sorties à Dubaï' },
      { kind: 'irly', n: 1, name: 'IRLY', b: 'Des activités proposées près de toi, et des gens avec qui y aller.', phones: [mixte('activities'), mixte('categories')] },
      { kind: 'apps', apps: [
        { n: 2, name: 'ClassPass', b: 'Réserve des cours de sport et de bien-être dans différents studios.' },
        { n: 3, name: 'Fever', b: 'Expositions, concerts à la bougie, expériences : tout se réserve dans l’app.' },
      ] },
      { kind: 'apps', apps: [{ n: 4, name: 'Eventbrite', b: 'Ateliers, soirées et événements, avec billet.' }],
        diff: 'Les autres te vendent un billet. IRLY te trouve quelqu’un avec qui y aller.' },
      CTA('ENVOIE-LE À TA PERSONNE DE SORTIE'),
    ],
  },
  {
    key: 'V4_COMMUNAUTE', photo: 'communaute-marina.webp', pos: '50% 40%',
    slides: [
      { kind: 'hook', t: 'COMMENT SE FAIRE DES AMIS À DUBAÏ ?', b: '4 apps pour trouver ta communauté' },
      { kind: 'irly', n: 1, name: 'IRLY', b: 'Rejoins des communautés par passion, avec un espace IRLY Girl entre femmes.', phones: [mixte('discover'), girl('communities')] },
      { kind: 'apps', apps: [
        { n: 2, name: 'Meetup', b: 'Des groupes qui se retrouvent régulièrement : randos, langues, jeux.' },
        { n: 3, name: 'Facebook', b: 'Les groupes d’expats et de quartier pour poser toutes tes questions.' },
      ] },
      { kind: 'apps', apps: [{ n: 4, name: 'Bumble For Friends', b: 'Pour trouver des amis en tête-à-tête. Selon la disponibilité dans ta région.' }],
        diff: 'Une communauté, ça se vit en vrai. IRLY est pensé pour passer de l’écran à la rencontre.' },
      CTA('ENVOIE-LE À QUELQU’UN QUI VIENT D’ARRIVER'),
    ],
  },
];

const FORMATS = [
  // Instagram 4:5 : marges égales. TikTok 9:16 : onglets en haut, icônes à droite, légende en bas.
  { dir: 'INSTAGRAM', W: 1080, H: 1350, box: { top: 90, left: 80, right: 80, bottom: 1270 }, phone: 520 },
  { dir: 'TIKTOK', W: 1080, H: 1920, box: { top: 230, left: 96, right: 150, bottom: 1600 }, phone: 700 },
];

const css = (f) => `
${tt(600)}${tt(700)}${tt(800)}
*{margin:0;box-sizing:border-box}
.t,.b,.cta{text-wrap:balance}
html,body{width:${f.W}px;height:${f.H}px;background:#000;overflow:hidden}
.s{position:relative;width:${f.W}px;height:${f.H}px;overflow:hidden;font-family:'TikTok Sans',sans-serif;color:#fff}
.bg{position:absolute;inset:0;background-size:cover;background-position:var(--pos,center);filter:saturate(.95) contrast(1.04) brightness(.9)}
.bg.blur{inset:-40px;filter:blur(26px) saturate(1.05) brightness(.55)}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.28) 0%,rgba(0,0,0,.08) 40%,rgba(0,0,0,.08) 60%,rgba(0,0,0,.35) 100%)}
.box{position:absolute;top:${f.box.top}px;left:${f.box.left}px;width:${f.W - f.box.left - f.box.right}px;height:${f.box.bottom - f.box.top}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:30px}
.box.hook{justify-content:flex-start;padding-top:${f.H > 1500 ? 90 : 40}px}
.sh{text-shadow:0 0 4px rgba(0,0,0,.85),0 2px 16px rgba(0,0,0,.7)}
.t{font-weight:800;font-size:var(--fs,78px);line-height:1.12;letter-spacing:-.5px}
.b{font-weight:700;font-size:var(--bs,44px);line-height:1.3}
.app{display:flex;flex-direction:column;align-items:center;gap:12px}
.app .name{font-weight:800;font-size:84px;line-height:1.1}
.app .name i{font-style:normal;opacity:.75;margin-right:14px}
.app .b{font-size:46px;font-weight:700;max-width:840px}
.sep{width:120px;height:4px;border-radius:2px;background:rgba(255,255,255,.55)}
.diff{margin-top:10px;padding:26px 34px;border-radius:30px;background:rgba(255,255,255,.14);border:1.5px solid rgba(255,255,255,.28);backdrop-filter:blur(12px);display:flex;flex-direction:column;align-items:center;gap:14px}
.diff .k{display:flex;align-items:center;gap:14px;font-weight:800;font-size:28px;letter-spacing:3px;text-transform:uppercase}
.diff .b{font-size:42px;font-weight:700}
.phones{display:flex;justify-content:center;gap:26px;height:var(--ph)}
.phone{height:100%;aspect-ratio:600 / 1298;border-radius:42px;background:#0b0b0c;padding:9px;box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 0 0 2px rgba(255,255,255,.16)}
.phone div{width:100%;height:100%;border-radius:34px;background-size:cover;background-position:top center}
.note{font-weight:600;font-size:22px;color:rgba(255,255,255,.85)}
.ctas{display:flex;flex-direction:column;gap:16px;align-items:center}
.cta{font-weight:800;font-size:34px;line-height:1.45;max-width:760px}
.cta span{background:#fff;color:#111;padding:8px 22px;border-radius:14px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.cta.main span{background:#fe2c55;color:#fff}
.free{display:inline-block;padding:12px 30px;border-radius:999px;background:#fff;color:#111;font-weight:800;font-size:34px;letter-spacing:1px}
`;

// Espace insécable avant ? ! : ; (typographie française).
const fr = (s) => s.replace(/ ([?!:;»])/g, '&nbsp;$1').replace(/« /g, '«&nbsp;');

function body(s) {
  if (s.kind === 'hook') return `<div class="box hook sh"><div class="t" style="--fs:92px">${fr(s.t)}</div><div class="b" style="--bs:50px">${fr(s.b)}</div></div>`;
  if (s.kind === 'irly') {
    return `<div class="box sh"><div class="app"><div class="name"><i>${s.n}.</i>${s.name}</div><div class="b">${fr(s.b)}</div></div>
<div class="phones" data-fit>${s.phones.map((p) => `<div class="phone"><div style="background-image:url(${p})"></div></div>`).join('')}</div><div class="note">${NOTE}</div></div>`;
  }
  if (s.kind === 'apps') {
    const apps = s.apps.map((a) => `<div class="app"><div class="name"><i>${a.n}.</i>${a.name}</div><div class="b">${fr(a.b)}</div></div>`).join('<div class="sep"></div>');
    const diff = s.diff ? `<div class="diff"><div class="k"><span>La différence</span>${logo(4)}</div><div class="b">${fr(s.diff)}</div></div>` : '';
    return `<div class="box sh">${apps}${diff}</div>`;
  }
  return `<div class="box sh">${logo(11)}<div class="t" style="--fs:76px">${fr(s.t)}</div><div class="free">${fr(s.b)}</div>
<div class="ctas">${s.ctas.map((c, k) => `<div class="cta${k ? '' : ' main'}"><span>${fr(c)}</span></div>`).join('')}</div></div>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const problems = [];
const tmp = path.join(dir, '.slide.html');
for (const f of FORMATS) {
  const page = await browser.newPage({ viewport: { width: f.W, height: f.H }, deviceScaleFactor: 1 });
  for (const v of VERSIONS) {
    const out = path.join(dir, v.key, f.dir);
    fs.mkdirSync(out, { recursive: true });
    for (const [i, s] of v.slides.entries()) {
      const bg = `<div class="bg${i ? ' blur' : ''}" style="background-image:url(${src(v.photo)});--pos:${v.pos}"></div><div class="shade"></div>`;
      fs.writeFileSync(tmp, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${css(f)}</style></head><body><div class="s">${bg}${body(s)}</div></body></html>`);
      await page.goto(`file://${tmp}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      // Les téléphones prennent la place qui reste dans la zone sûre.
      const r = await page.evaluate((max) => {
        const box = document.querySelector('.box');
        const ph = document.querySelector('[data-fit]');
        if (ph) {
          ph.style.setProperty('--ph', '0px');
          const kids = [...box.children];
          const used = kids.reduce((n, k) => n + k.offsetHeight, 0) + parseFloat(getComputedStyle(box).rowGap) * (kids.length - 1);
          const free = box.clientHeight - used;
          ph.style.setProperty('--ph', `${Math.min(max, free)}px`);
        }
        const b = box.getBoundingClientRect();
        const kids = [...box.querySelectorAll('*')].map((e) => e.getBoundingClientRect());
        return {
          top: Math.min(...kids.map((k) => k.top)), bottom: Math.max(...kids.map((k) => k.bottom)),
          left: Math.min(...kids.map((k) => k.left)), right: Math.max(...kids.map((k) => k.right)),
          box: { top: b.top, bottom: b.bottom, left: b.left, right: b.right },
          ph: ph ? ph.getBoundingClientRect().height : null,
          fonts: document.fonts.check('800 40px "TikTok Sans"'),
        };
      }, f.phone);
      const name = `${v.key}/${f.dir}/${String(i + 1).padStart(2, '0')}`;
      if (r.top < r.box.top - 1 || r.bottom > r.box.bottom + 1) problems.push(`${name}: déborde en hauteur (${Math.round(r.top)}–${Math.round(r.bottom)})`);
      if (r.left < r.box.left - 1 || r.right > r.box.right + 1) problems.push(`${name}: déborde en largeur`);
      if (r.ph !== null && r.ph < 380) problems.push(`${name}: téléphones trop petits (${Math.round(r.ph)}px)`);
      if (!r.fonts) problems.push(`${name}: police non chargée`);
      await page.screenshot({ path: path.join(out, `${String(i + 1).padStart(2, '0')}.png`), type: 'png' });
    }
  }
  await page.close();
}
fs.rmSync(tmp, { force: true });
await browser.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('OK : 4 carrousels × 5 slides, 1080×1350 et 1080×1920');
