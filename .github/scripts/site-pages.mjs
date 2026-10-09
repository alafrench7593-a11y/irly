/**
 * The website's other pages, written as real HTML so search engines read
 * them without running JavaScript:
 *  - the home page in French (/fr/) and Arabic (/ar/), translated from the
 *    page's own dictionary (no second copy of the texts to keep in sync);
 *  - the guides (site/guides/articles.mjs), in English and French;
 *  - sitemap.xml listing every page with its language versions.
 * Usage: node .github/scripts/site-pages.mjs <out dir>  (after site-build)
 */
import fs from 'node:fs';
import path from 'node:path';
import { ARTICLES, UPDATED, APP_URL } from '../../site/guides/articles.mjs';

const OUT = process.argv[2] || 'dist/site';
const SITE = 'https://getirly.com/';
const LANGS = ['en', 'fr', 'ar'];

/* ───────── The page's own dictionary ───────── */
const src = fs.readFileSync('site/index.html', 'utf8');
function objectLiteral(text, marker) {
  const start = text.indexOf('{', text.indexOf(marker));
  let depth = 0;
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error(`no object after ${marker}`);
}
const T = new Function(`return ${objectLiteral(src, 'const T = {')}`)();

/* ───────── Replace the content of every element with data-i="key" ───────── */
function translateElements(html, dict) {
  // Only outside <script>: scripts build their own elements at run time.
  const parts = html.split(/(<script[\s\S]*?<\/script>)/);
  return parts
    .map((part) => (part.startsWith('<script') ? part : translatePart(part, dict)))
    .join('');
}
function translatePart(html, dict) {
  const re = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?\sdata-i="([^"$]+)"[^>]*>/g;
  const hits = [];
  let m;
  while ((m = re.exec(html))) hits.push({ start: m.index, openEnd: m.index + m[0].length, tag: m[1].toLowerCase(), key: m[2] });
  // From the end, so earlier offsets stay valid.
  for (const h of hits.reverse()) {
    const value = dict[h.key];
    if (value === undefined) continue;
    const close = matchingClose(html, h.openEnd, h.tag);
    if (close < 0) continue;
    html = html.slice(0, h.openEnd) + value + html.slice(close);
  }
  return html;
}
function matchingClose(html, from, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = from;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) depth--;
    else if (!m[0].endsWith('/>')) depth++;
    if (depth === 0) return m.index;
  }
  return -1;
}
function translateAttributes(html, dict) {
  for (const [data, attr] of [['data-i-aria', 'aria-label'], ['data-i-ph', 'placeholder'], ['data-i-alt', 'alt']]) {
    html = html.replace(new RegExp(`<[^>]*\\s${data}="([^"]+)"[^>]*>`, 'g'), (tag, key) => {
      const v = dict[key];
      if (v === undefined) return tag;
      const esc = v.replace(/"/g, '&quot;');
      return new RegExp(`\\s${attr}="`).test(tag) ? tag.replace(new RegExp(`(\\s${attr}=")[^"]*"`), `$1${esc}"`) : tag.replace(/\s*\/?>$/, ` ${attr}="${esc}"$&`);
    });
  }
  return html;
}

/** Relative asset paths gain `../` in a page one level down. */
function deeper(html, prefix) {
  return html.replace(/(["'`(,]\s?)((?:img|shots|video|faces)\/|favicon\.png|apple-touch-icon\.png|lenis\.min\.js|og\.jpg|sitemap\.xml)/g, `$1${prefix}$2`);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const strip = (s) => s.replace(/<[^>]+>/g, '');

/* ───────── Home in French and Arabic ───────── */
const homeHref = (l) => SITE + (l === 'en' ? '' : `${l}/`);
const enHome = fs.readFileSync(`${OUT}/index.html`, 'utf8').replace('<html lang="en" dir="ltr">', '<html lang="en" dir="ltr" data-page="en" data-home="">');
fs.writeFileSync(`${OUT}/index.html`, enHome);

for (const l of ['fr', 'ar']) {
  const d = T[l];
  const title = `IRLY — ${strip(d.h1a)} ${strip(d.h1b)}`;
  const desc = strip(d.heroSub);
  let html = translateAttributes(translateElements(enHome, d), d);
  html = html
    .replace('<html lang="en" dir="ltr" data-page="en" data-home="">', `<html lang="${l}" dir="${l === 'ar' ? 'rtl' : 'ltr'}" data-page="${l}" data-home="../">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*"/, `$1${esc(desc)}"`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${esc(title)}"`)
    .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${esc(desc)}"`)
    .replace(/(<meta name="twitter:title" content=")[^"]*"/, `$1${esc(title)}"`)
    .replace(/(<meta name="twitter:description" content=")[^"]*"/, `$1${esc(desc)}"`)
    .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${homeHref(l)}"`)
    .replace(/(<meta property="og:locale" content=")[^"]*"/, `$1${l === 'fr' ? 'fr_FR' : 'ar_AE'}"`)
    .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${homeHref(l)}"`)
    // Guides: French ones from the French page, English ones (one level up) from the Arabic page.
    .replace(/<a href="([^"]+)" data-href-fr="([^"]+)"/g, (_m, en, fr) => (l === 'fr' ? `<a href="${fr}" data-href-fr="${fr}" data-href-en="../${en}"` : `<a href="../${en}" data-href-fr="../fr/${fr}" data-href-en="../${en}"`));
  html = deeper(html, '../');
  fs.mkdirSync(`${OUT}/${l}`, { recursive: true });
  fs.writeFileSync(`${OUT}/${l}/index.html`, html);
}

/* ───────── Guides ───────── */
const css = `:root{--ink:#050505;--paper:#f5f5f2;--g1:#c9c9c4;--g2:#8f8f8a;--line:rgba(255,255,255,.12)}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--ink);color:var(--paper);font:400 17px/1.7 Manrope,system-ui,-apple-system,Segoe UI,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--paper)}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;max-width:760px;margin:0 auto;padding:20px 20px 0}
.brand{font-weight:800;letter-spacing:.3em;text-decoration:none;font-size:15px}
.lang{font-size:13px;font-weight:700;color:var(--g1);text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:6px 12px}
main{max-width:760px;margin:0 auto;padding:24px 20px 64px}
.crumbs{font-size:13px;color:var(--g2);margin:24px 0 0}.crumbs a{color:var(--g2)}
h1{font-size:clamp(34px,7vw,52px);line-height:1.05;letter-spacing:-.02em;margin:14px 0 12px;font-weight:800}
.meta{font-size:13px;color:var(--g2);margin:0 0 28px}
.lead{font-size:20px;line-height:1.6;color:var(--paper);margin:0 0 8px}
h2{font-size:26px;line-height:1.2;letter-spacing:-.01em;margin:44px 0 12px;font-weight:800}
h3{font-size:19px;margin:24px 0 6px;font-weight:700}
p,li{color:var(--g1)}strong{color:var(--paper)}
ul,ol{padding-left:22px}li{margin:6px 0}
.cta{margin:52px 0 0;padding:28px;border:1px solid var(--line);border-radius:24px;background:rgba(255,255,255,.04)}
.cta h2{margin:0 0 8px}.cta p{margin:0 0 18px}
.btn{display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 22px;border-radius:999px;background:var(--paper);color:var(--ink);font-weight:800;text-decoration:none}
.related{margin:40px 0 0;font-size:15px}.related a{font-weight:700}
footer{max-width:760px;margin:0 auto;padding:0 20px 40px;font-size:13px;color:var(--g2)}footer a{color:var(--g2)}
@media (prefers-reduced-motion:no-preference){main>*{animation:rise .6s cubic-bezier(.05,.7,.1,1) both}main>*:nth-child(2){animation-delay:.05s}main>*:nth-child(3){animation-delay:.1s}main>*:nth-child(4){animation-delay:.15s}}
@keyframes rise{from{opacity:0;transform:translateY(14px)}}`;

const L = {
  en: { home: 'Home', guides: 'Guides', updated: 'Updated', by: 'By the IRLY team', read: 'Read also', other: 'Français', locale: 'en_US',
    hubTitle: 'Guides: making friends and settling in, in Dubai and Bali | IRLY',
    hubDesc: 'Practical guides for newcomers to Dubai and Bali: how to meet people, make friends and build a social life in a new city.',
    hubLead: 'Practical guides for newcomers: how to meet people, make friends and feel at home in a new city. No statistics, no sponsored lists: advice that works.',
    readGuide: 'Read the guide' },
  fr: { home: 'Accueil', guides: 'Guides', updated: 'Mis à jour le', by: 'Par l’équipe IRLY', read: 'À lire aussi', other: 'English', locale: 'fr_FR',
    hubTitle: 'Guides : se faire des amis et s’installer à Dubaï et à Bali | IRLY',
    hubDesc: 'Des guides pratiques pour les nouveaux arrivants à Dubaï et à Bali : rencontrer du monde, se faire des amis et construire sa vie sociale dans une nouvelle ville.',
    hubLead: 'Des guides pratiques pour les nouveaux arrivants : rencontrer du monde, se faire des amis et se sentir chez soi dans une nouvelle ville. Pas de statistiques, pas de listes sponsorisées : des conseils qui marchent.',
    readGuide: 'Lire le guide' },
};
/** The guides index of each language: /guides/ and /fr/guides/. */
const hubPath = (l) => (l === 'fr' ? 'fr/guides/' : 'guides/');
const dateFmt = (l, d = UPDATED) => new Date(`${d}T12:00:00Z`).toLocaleDateString(l === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

for (const a of ARTICLES) {
  // Each guide carries its own date when it has one (only the guides really changed move).
  const updated = a.updated ?? UPDATED;
  const depth = a.path.split('/').filter(Boolean).length;
  const up = '../'.repeat(depth);
  const url = SITE + a.path;
  const twin = ARTICLES.find((x) => x.pair === a.pair && x.lang !== a.lang);
  const t = L[a.lang];
  const homeRel = up + (a.lang === 'fr' ? 'fr/' : '');
  const homeAbs = SITE + (a.lang === 'fr' ? 'fr/' : '');
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: a.h1,
        description: a.description,
        inLanguage: a.lang,
        datePublished: a.published ?? updated,
        dateModified: updated,
        mainEntityOfPage: url,
        image: `${SITE}og.jpg`,
        author: { '@type': 'Organization', name: 'IRLY', url: SITE },
        publisher: { '@type': 'Organization', name: 'IRLY', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}apple-touch-icon.png` } },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.home, item: homeAbs },
          { '@type': 'ListItem', position: 2, name: t.guides, item: SITE + hubPath(a.lang) },
          { '@type': 'ListItem', position: 3, name: a.h1, item: url },
        ],
      },
    ],
  };
  const alternates = [a, twin].filter(Boolean).map((x) => `<link rel="alternate" hreflang="${x.lang}" href="${SITE + x.path}">`);
  alternates.push(`<link rel="alternate" hreflang="x-default" href="${SITE + (a.lang === 'en' ? a.path : twin?.path ?? a.path)}">`);
  const body = a.sections.map((s) => `<section><h2>${s.h2}</h2>\n${s.html}</section>`).join('\n');
  const html = `<!doctype html>
<html lang="${a.lang}" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(a.title)}</title>
<meta name="description" content="${esc(a.description)}">
<link rel="canonical" href="${url}">
${alternates.join('\n')}
<meta name="theme-color" content="#050505">
<meta name="color-scheme" content="dark">
<link rel="icon" href="${up}favicon.png" type="image/png">
<link rel="apple-touch-icon" href="${up}apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="IRLY">
<meta property="og:title" content="${esc(a.h1)}">
<meta property="og:description" content="${esc(a.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}og.jpg">
<meta property="og:locale" content="${t.locale}">
<meta property="article:modified_time" content="${updated}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap">
<style>${css}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<header class="top">
  <a class="brand" href="${homeRel}" aria-label="IRLY">IRLY</a>
  ${twin ? `<a class="lang" href="${up + twin.path}" hreflang="${twin.lang}" lang="${twin.lang}">${t.other}</a>` : ''}
</header>
<main>
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${homeRel}">${t.home}</a> › <a href="${up + hubPath(a.lang)}">${t.guides}</a> › ${a.city}</nav>
  <h1>${a.h1}</h1>
  <p class="meta">${t.by} · ${t.updated} <time datetime="${updated}">${dateFmt(a.lang, updated)}</time></p>
  <p class="lead">${a.lead}</p>
${body}
  <aside class="cta">
    <h2>${a.cta.title}</h2>
    <p>${a.cta.body}</p>
    <a class="btn" href="${APP_URL}" data-cta="guide">${a.cta.label} <span aria-hidden="true">→</span></a>
  </aside>
  <p class="related">${t.read}${a.lang === 'fr' ? ' : ' : ': '}${a.related.map((r) => `<a href="${up + r.path}">${r.label}</a>`).join(' · ')}</p>
</main>
<footer><a href="${homeRel}">IRLY</a> · © 2026 IRLY</footer>
</body>
</html>
`;
  fs.mkdirSync(path.join(OUT, a.path), { recursive: true });
  fs.writeFileSync(path.join(OUT, a.path, 'index.html'), html);
}

/* ───────── Guides index, one per language ───────── */
for (const l of ['en', 'fr']) {
  const t = L[l];
  const list = ARTICLES.filter((a) => a.lang === l);
  const url = SITE + hubPath(l);
  const up = '../'.repeat(hubPath(l).split('/').filter(Boolean).length);
  const other = l === 'fr' ? 'en' : 'fr';
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: t.hubTitle, description: t.hubDesc, url, inLanguage: l },
      { '@type': 'ItemList', itemListElement: list.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + a.path, name: a.h1 })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.home, item: SITE + (l === 'fr' ? 'fr/' : '') },
        { '@type': 'ListItem', position: 2, name: t.guides, item: url },
      ] },
    ],
  };
  const cards = list
    .map((a) => `  <article class="card"><h2><a href="${up + a.path}">${a.h1}</a></h2><p>${a.description}</p><p class="more"><a href="${up + a.path}">${t.readGuide} <span aria-hidden="true">→</span></a></p></article>`)
    .join('\n');
  const html = `<!doctype html>
<html lang="${l}" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(t.hubTitle)}</title>
<meta name="description" content="${esc(t.hubDesc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="${l}" href="${url}">
<link rel="alternate" hreflang="${other}" href="${SITE + hubPath(other)}">
<link rel="alternate" hreflang="x-default" href="${SITE + hubPath('en')}">
<meta name="theme-color" content="#050505">
<meta name="color-scheme" content="dark">
<link rel="icon" href="${up}favicon.png" type="image/png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="IRLY">
<meta property="og:title" content="${esc(t.hubTitle)}">
<meta property="og:description" content="${esc(t.hubDesc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}og.jpg">
<meta property="og:locale" content="${t.locale}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap">
<style>${css}
.card{padding:22px 0;border-bottom:1px solid var(--line)}.card h2{margin:0 0 8px;font-size:23px}.card h2 a{text-decoration:none}.card p{margin:0 0 8px}.more a{font-weight:700;font-size:15px}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<header class="top">
  <a class="brand" href="${up + (l === 'fr' ? 'fr/' : '')}" aria-label="IRLY">IRLY</a>
  <a class="lang" href="${up + hubPath(other)}" hreflang="${other}" lang="${other}">${L[l].other}</a>
</header>
<main>
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${up + (l === 'fr' ? 'fr/' : '')}">${t.home}</a> › ${t.guides}</nav>
  <h1>${t.guides}</h1>
  <p class="lead">${t.hubLead}</p>
${cards}
</main>
<footer><a href="${up + (l === 'fr' ? 'fr/' : '')}">IRLY</a> · © 2026 IRLY</footer>
</body>
</html>
`;
  fs.mkdirSync(path.join(OUT, hubPath(l)), { recursive: true });
  fs.writeFileSync(path.join(OUT, hubPath(l), 'index.html'), html);
}

/* ───────── FAQ as FAQPage data on each home page (same words as on the page) ───────── */
for (const l of LANGS) {
  const file = `${OUT}/${l === 'en' ? '' : `${l}/`}index.html`;
  let html = fs.readFileSync(file, 'utf8');
  const pairs = [];
  for (let i = 1; i <= 12; i++) {
    const q = html.match(new RegExp(`data-i="faqQ${i}">([\\s\\S]*?)</summary>`));
    const a = html.match(new RegExp(`data-i="faqA${i}">([\\s\\S]*?)</p>`));
    if (!q || !a) break;
    pairs.push({ '@type': 'Question', name: strip(q[1]).trim(), acceptedAnswer: { '@type': 'Answer', text: strip(a[1]).trim() } });
  }
  if (!pairs.length) continue;
  const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: l, mainEntity: pairs };
  html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(faq)}</script>\n</head>`);
  fs.writeFileSync(file, html);
}

/* ───────── llms.txt: what IRLY is and where to read more, for AI assistants ───────── */
const guideLines = ARTICLES.map((a) => `- [${a.h1}](${SITE + a.path}) (${a.lang}): ${a.description}`).join('\n');
fs.writeFileSync(
  `${OUT}/llms.txt`,
  `# IRLY

> IRLY is an app to meet people who share your interests and do things together in real life: communities, activities and group chats. It starts in Dubai, covers the other emirates of the UAE, and is also available in Bali. It is not a dating app. IRLY Girl is a space reserved for women.

- Website: ${SITE} (English), ${SITE}fr/ (French), ${SITE}ar/ (Arabic)
- Web app: ${APP_URL} (iOS and Android apps coming soon)
- Guides: ${SITE}guides/ and ${SITE}fr/guides/

## Guides

${guideLines}
`,
);

/* ───────── Sitemap ───────── */
const homeAlts = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${homeHref(l)}"/>`).concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}"/>`).join('\n');
const urls = LANGS.map((l) => `  <url>\n    <loc>${homeHref(l)}</loc>\n    <lastmod>${UPDATED}</lastmod>\n${homeAlts}\n  </url>`);
for (const a of ARTICLES) {
  const pair = ARTICLES.filter((x) => x.pair === a.pair);
  const alts = pair.map((x) => `    <xhtml:link rel="alternate" hreflang="${x.lang}" href="${SITE + x.path}"/>`).join('\n');
  urls.push(`  <url>\n    <loc>${SITE + a.path}</loc>\n    <lastmod>${a.updated ?? UPDATED}</lastmod>\n${alts}\n  </url>`);
}
const hubAlts = ['en', 'fr'].map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE + hubPath(l)}"/>`).join('\n');
for (const l of ['en', 'fr']) urls.push(`  <url>\n    <loc>${SITE + hubPath(l)}</loc>\n    <lastmod>${ARTICLES.map((a) => a.updated ?? UPDATED).sort().at(-1)}</lastmod>\n${hubAlts}\n  </url>`);
fs.writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
console.log('site pages: fr, ar,', ARTICLES.map((a) => a.path).join(', '), '+ guides index, FAQ data, llms.txt, sitemap');
