// One language per screen: opens the exported demo web app and the built
// website in a real browser, in English and in French, and reports any
// screen whose visible text or labels (alt, aria-label, placeholder, title,
// meta description) carry words of the other language.
//
//   EXPO_PUBLIC_DEMO=1 npx expo export -p web --output-dir /tmp/web
//   node .github/scripts/site-build.mjs /tmp/site
//   node scripts/e2e-lang.mjs --app /tmp/web --site /tmp/site
//
// A word list cannot read a sentence: a hit is a lead, printed with its
// context, to be read before it is fixed. Names of places and brands that
// happen to be words are listed in ALLOW.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? path.resolve(process.argv[i + 1]) : undefined;
};
const APP = arg('--app');
const SITE = arg('--site');
const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

// Words that only one of the two languages uses (short function words and common UI verbs).
const EN = new Set('the and with your you for this that are from people friends join sign free download more about what how who when where near find meet our get read women only back next close open send thanks try again please here now will can have all out see just new members going tonight tomorrow today saved settings search profile cancel save edit delete share follow following followers loading nothing yet'.split(' '));
const FR = new Set('le la les des une avec pour vous tu ton ta tes nous est sont dans sur amis rejoindre gratuit télécharger qui quand où trouver rencontrer notre nos lire femmes seulement retour suivant fermer ouvrir envoyer merci réessayer ici maintenant être aussi mais très aujourd’hui demain ce soir enregistrer modifier supprimer partager suivre abonnés rechercher paramètres chargement rien encore semaine membres'.split(' '));
// Proper nouns and loan words that read as a word of the other language.
const ALLOW = new Set([]);
// --strict: every line with one word of the other language, for a full read.
const STRICT = process.argv.includes('--strict');
const PHRASES_OK = [
  /\bIRLY\b/g,
  /\bIN REAL LIFE\b/gi,
  /\bLa Mer\b/g, // Dubai beach
  /\bLe Méridien\b/g,
  /\bJumeirah Beach\b/g,
  /\bApp Store\b/g,
  /\bGoogle Play\b/g,
  /\bGet it on\b/g, // store badge artwork text
  /\bFree zone\b/g, // Dubai's legal term, said in English in French too
  // The demo's members, organisers and places wrote these in English: member
  // content stays in the language it was written in, whatever the app's.
  /\b(Women in Business UAE|Girls Who Travel|New in Dubai|Padel Open|The Overlook|The Greens & The Views|The Springs & Meadows)\b/g,
  /^Great, let’s meet in front of the bookshop 🤍$/g,
  /^Thinking about it\. First time, any tips\?$/g,
  /^Building a fashion brand between Paris and Dubai\..*$/g,
  /^Born here, still discovering it\..*$/g,
];

function hits(text, lang) {
  let clean = text;
  for (const re of PHRASES_OK) clean = clean.replace(re, ' ');
  const words = clean.toLowerCase().match(/[a-zàâäçéèêëîïôöùûüœ’']+/g) ?? [];
  const other = lang === 'fr' ? EN : FR;
  const own = lang === 'fr' ? FR : EN;
  const found = new Map();
  let ownCount = 0;
  for (const w of words) {
    if (own.has(w)) ownCount++;
    if (other.has(w) && !ALLOW.has(w)) found.set(w, (found.get(w) ?? 0) + 1);
  }
  return { found, ownCount, words: words.length };
}

/** The sentences (lines of text, labels) that hold a word of the other language. */
function evidence(chunks, lang) {
  const other = lang === 'fr' ? EN : FR;
  const out = [];
  for (const c of chunks) {
    let clean = c;
    for (const re of PHRASES_OK) clean = clean.replace(re, ' ');
    const words = clean.toLowerCase().match(/[a-zàâäçéèêëîïôöùûüœ’']+/g) ?? [];
    const bad = words.filter((w) => other.has(w));
    // One stray word in a long line is usually a name; two or more, or a short label, is text.
    if (bad.length >= 2 || (bad.length === 1 && (STRICT || words.length <= 4))) out.push(c.trim().slice(0, 140));
  }
  return [...new Set(out)];
}

function serve(root, port, spa) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.xml': 'application/xml', '.txt': 'text/plain' };
  return http
    .createServer((req, res) => {
      let file = path.join(root, decodeURIComponent((req.url ?? '/').split('?')[0]));
      if (file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!file.startsWith(root) || !fs.existsSync(file)) {
        if (!spa) {
          res.writeHead(404);
          return res.end();
        }
        file = path.join(root, 'index.html');
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    })
    .listen(port);
}

async function grab(page) {
  return page.evaluate(() => {
    const chunks = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('script,style,noscript,[translate="no"] [data-raw],[aria-hidden="true"]')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const s = n.textContent.replace(/\s+/g, ' ').trim();
      if (s) chunks.push(s);
    }
    for (const el of document.querySelectorAll('[alt],[aria-label],[placeholder],[title]')) {
      for (const a of ['alt', 'aria-label', 'placeholder', 'title']) {
        const v = el.getAttribute(a);
        if (v && /[a-z]{2}/i.test(v)) chunks.push(v);
      }
    }
    for (const m of document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]')) chunks.push(m.getAttribute('content') ?? '');
    chunks.push(document.title);
    return { chunks, lang: document.documentElement.lang };
  });
}

const report = [];
async function check(page, url, lang, label) {
  const res = await page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch((e) => ({ error: e }));
  if (res?.error) {
    report.push({ label, lang, url, error: String(res.error).slice(0, 120) });
    return;
  }
  await page.waitForTimeout(label.startsWith('app') ? 2500 : 600);
  const { chunks, lang: htmlLang } = await grab(page);
  const ev = evidence(chunks, lang);
  const h = hits(chunks.join('\n'), lang);
  report.push({ label, lang, url, htmlLang, words: h.words, ev });
}

const APP_ROUTES = ['/', '/discover', '/live', '/map', '/messages', '/profile', '/social', '/settings', '/notifications', '/search', '/communities', '/calendar', '/saved', '/events', '/categories', '/help', '/legal/privacy', '/legal/terms', '/preferences', '/account', '/edit-profile', '/verify', '/match', '/network', '/news', '/girl', '/girl/match', '/girl/moving', '/girl/profile', '/girl/onboarding', '/onboarding/you', '/onboarding/interests', '/onboarding/looking', '/eat', '/services', '/business', '/welcome', '/recap', '/blocked', '/assistant', '/community/new', '/post/new', '/support', '/person/p-samuel', '/person/p-layla', '/messages/cv-d1', '/messages/cv-d2', '/category/sport', '/category/food', '/network/p-arjun', '/legal/guidelines'];

async function main() {
  const browser = await chromium.launch({ executablePath });
  if (APP) {
    serve(APP, 8091, true);
    for (const lang of ['en', 'fr']) {
      for (const r of APP_ROUTES) {
        // A fresh browser per screen: nothing chosen yet, so ?lang= decides.
        const ctx = await browser.newContext({ locale: lang === 'fr' ? 'en-US' : 'fr-FR', viewport: { width: 400, height: 860 } });
        const page = await ctx.newPage();
        await check(page, `http://localhost:8091${r}?lang=${lang}`, lang, `app ${r}`);
        await ctx.close();
      }
    }
  }
  if (SITE) {
    serve(SITE, 8092, false);
    const pages = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name === 'index.html') pages.push('/' + path.relative(SITE, path.dirname(p)).split(path.sep).join('/'));
      }
    };
    walk(SITE);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    for (const p of pages.sort()) {
      const lang = p.startsWith('/fr') ? 'fr' : p.startsWith('/ar') ? null : 'en';
      if (!lang) continue;
      await check(page, `http://localhost:8092${p === '/' ? '/' : p + '/'}`, lang, `site ${p}`);
    }
    await ctx.close();
  }
  await browser.close();

  let bad = 0;
  for (const r of report) {
    const flag = r.error ? 'ERROR' : r.ev.length ? 'MIXED' : 'ok';
    if (flag !== 'ok') bad++;
    console.log(`${flag.padEnd(5)} ${r.lang} ${r.label}${r.htmlLang && r.htmlLang !== r.lang ? ` (html lang=${r.htmlLang})` : ''}${r.error ? ` ${r.error}` : ''}`);
    for (const e of r.ev ?? []) console.log(`        · ${e}`);
  }
  console.log(`\n${report.length} screens, ${bad} with text of the other language or errors`);
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
