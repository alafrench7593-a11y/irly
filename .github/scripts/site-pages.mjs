/**
 * The website's other pages, written as real HTML so search engines read
 * them without running JavaScript:
 *  - the home page in French (/fr/) and Arabic (/ar/), translated from the
 *    page's own dictionary (no second copy of the texts to keep in sync);
 *  - the guides (site/guides/articles.mjs) and the pages answering one precise search (site/guides/strategic.mjs),
 *    in English and French, with their questions and answers as FAQPage data when they have some;
 *  - the blog (site/guides/blog.mjs): short articles, newest first, at /blog/ and /fr/blog/;
 *  - sitemap.xml listing every page with its language versions.
 * Usage: node .github/scripts/site-pages.mjs <out dir>  (after site-build)
 */
import fs from 'node:fs';
import path from 'node:path';
import { ARTICLES, PHOTOS, UPDATED, APP_URL } from '../../site/guides/articles.mjs';
import { POSTS } from '../../site/guides/blog.mjs';
import { STRATEGIC } from '../../site/guides/strategic.mjs';

// Guides and blog posts share one page template; posts are marked `blog` and listed newest first.
const BLOG = POSTS.map((p) => ({ ...p, blog: true })).sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''));
// The guides index lists the long guides and the pages written for one precise search (site/guides/strategic.mjs).
const GUIDES = [...ARTICLES, ...STRATEGIC];
const PAGES = [...GUIDES, ...BLOG];

const OUT = process.argv[2] || 'dist/site';
const SITE = 'https://getirly.com/';
const LANGS = ['en', 'fr', 'ar'];
// The app speaks English and French: only those two are offered to search engines and in the language switch.
// The Arabic home stays reachable at /ar/ (older links) but is not indexed.
const INDEXED = ['en', 'fr'];

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
  return html.replace(/(["'`(,]\s?)((?:img|shots|video|faces)\/|favicon\.png|favicon\.ico|apple-touch-icon\.png|lenis\.min\.js|og\.jpg|sitemap\.xml)/g, `$1${prefix}$2`);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const strip = (s) => s.replace(/<[^>]+>/g, '');

/* ───────── Home in French and Arabic ───────── */
const homeHref = (l) => SITE + (l === 'en' ? '' : `${l}/`);
const enHome = fs.readFileSync(`${OUT}/index.html`, 'utf8').replace('<html lang="en" dir="ltr">', '<html lang="en" dir="ltr" data-page="en" data-home="">');
fs.writeFileSync(`${OUT}/index.html`, enHome);

for (const l of ['fr', 'ar']) {
  const d = T[l];
  // What Google shows for "IRLY": the brand first, then what it is for, in each language.
  const META = {
    fr: ['IRLY — Se faire des amis à Dubaï : activités et communautés', 'Se faire des amis à Dubaï, dans la vraie vie : rencontre des gens qui partagent tes passions, rejoins des communautés et des activités. Gratuit, dans ton navigateur.'],
    ar: ['IRLY — وحدة أقل. حياة أكثر. تعرّف على أشخاص في دبي', 'IRLY هو التطبيق للتعرّف على أشخاص في دبي: انضم إلى مجتمعات، واكتشف ما تفعله مع الآخرين، وكوّن صداقات حقيقية. التسجيل مجاني.'],
  };
  const [title, desc] = META[l];
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
    // The live app opens in the page's language (French on /fr/), with no first load in English.
    .replace(/(\/app\/[^"?\s]*)\?lang=en/g, `$1?lang=${l === 'fr' ? 'fr' : 'en'}`)
    // The app screens of the French page are the French app.
    .replace(/shots\/app\/en\//g, l === 'fr' ? 'shots/app/fr/' : 'shots/app/en/')
    .replace(/(<meta property="og:locale" content=")[^"]*"/, `$1${l === 'fr' ? 'fr_FR' : 'ar_AE'}"`)
    .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${INDEXED.includes(l) ? homeHref(l) : SITE}"`)
    .replace('<meta charset="utf-8">', INDEXED.includes(l) ? '<meta charset="utf-8">' : '<meta charset="utf-8">\n<meta name="robots" content="noindex, follow">')
    // Guides: French ones from the French page, English ones (one level up) from the Arabic page.
    .replace(/<a href="([^"]+)" data-href-fr="([^"]+)"/g, (_m, en, fr) => {
      // Site-wide pages (/privacy, /support…) have absolute addresses: nothing to adjust.
      if (en.startsWith('/')) return `<a href="${l === 'fr' ? fr : en}" data-href-fr="${fr}" data-href-en="${en}"`;
      return l === 'fr' ? `<a href="${fr}" data-href-fr="${fr}" data-href-en="../${en}"` : `<a href="../${en}" data-href-fr="../fr/${fr}" data-href-en="../${en}"`;
    });
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
.ph{margin:28px 0 8px}.ph img{display:block;width:100%;height:auto;aspect-ratio:40/21;object-fit:cover;border-radius:18px;background:#141414}.ph figcaption{font-size:12px;color:var(--g2);margin-top:8px}.ph figcaption a{color:var(--g2)}
h2{font-size:26px;line-height:1.2;letter-spacing:-.01em;margin:44px 0 12px;font-weight:800}
h3{font-size:19px;margin:24px 0 6px;font-weight:700}
p,li{color:var(--g1)}strong{color:var(--paper)}
ul,ol{padding-left:22px}li{margin:6px 0}
table{width:100%;border-collapse:collapse;margin:18px 0;font-size:15px;line-height:1.5}th,td{text-align:left;padding:10px 10px 10px 0;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--paper);font-weight:700}td{color:var(--g1)}.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.cta{margin:52px 0 0;padding:28px;border:1px solid var(--line);border-radius:24px;background:rgba(255,255,255,.04)}
.cta h2{margin:0 0 8px}.cta p{margin:0 0 18px}
.btn{display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 22px;border-radius:999px;background:var(--paper);color:var(--ink);font-weight:800;text-decoration:none}
.related{margin:40px 0 0;font-size:15px}.related a{font-weight:700}
footer{max-width:760px;margin:0 auto;padding:0 20px 40px;font-size:13px;color:var(--g2)}footer a{color:var(--g2)}
@media (prefers-reduced-motion:no-preference){main>*{animation:rise .6s cubic-bezier(.05,.7,.1,1) both}main>*:nth-child(2){animation-delay:.05s}main>*:nth-child(3){animation-delay:.1s}main>*:nth-child(4){animation-delay:.15s}}
@keyframes rise{from{opacity:0;transform:translateY(14px)}}`;

const L = {
  en: { home: 'Home', guides: 'Guides', updated: 'Updated', published: 'Published', faq: 'Questions and answers', by: 'By the IRLY team', read: 'Read also', other: 'Français', locale: 'en_US',
    hubTitle: 'Guides: making friends and settling in, in Dubai and Bali | IRLY',
    hubDesc: 'Practical guides for newcomers to Dubai and Bali: how to meet people, make friends and build a social life in a new city.',
    hubLead: 'Practical guides for newcomers: how to meet people, make friends and feel at home in a new city. No statistics, no sponsored lists: advice that works.',
    readGuide: 'Read the guide',
    blog: 'Blog', blogTitle: 'Blog: loneliness, friendship and social life in Dubai | IRLY',
    blogDesc: 'Short articles on feeling lonely, making friends and building a social life in Dubai: one idea you can use this week.',
    blogLead: 'Short articles on loneliness, friendship and social life in Dubai. One idea per article, something you can try this week.',
    readPost: 'Read' },
  fr: { home: 'Accueil', guides: 'Guides', updated: 'Mis à jour le', published: 'Publié le', faq: 'Questions et réponses', by: 'Par l’équipe IRLY', read: 'À lire aussi', other: 'English', locale: 'fr_FR',
    hubTitle: 'Guides : se faire des amis et s’installer à Dubaï et à Bali | IRLY',
    hubDesc: 'Des guides pratiques pour les nouveaux arrivants à Dubaï et à Bali : rencontrer du monde, se faire des amis et construire sa vie sociale dans une nouvelle ville.',
    hubLead: 'Des guides pratiques pour les nouveaux arrivants : rencontrer du monde, se faire des amis et se sentir chez soi dans une nouvelle ville. Pas de statistiques, pas de listes sponsorisées : des conseils qui marchent.',
    readGuide: 'Lire le guide',
    blog: 'Blog', blogTitle: 'Blog : solitude, amitié et vie sociale à Dubaï | IRLY',
    blogDesc: 'De courts articles sur la solitude, se faire des amis et construire sa vie sociale à Dubaï : une idée à essayer cette semaine.',
    blogLead: 'De courts articles sur la solitude, l’amitié et la vie sociale à Dubaï. Une idée par article, à essayer cette semaine.',
    readPost: 'Lire' },
};
/** The guides index of each language: /guides/ and /fr/guides/. */
const hubPath = (l) => (l === 'fr' ? 'fr/guides/' : 'guides/');
/** The blog index of each language: /blog/ and /fr/blog/. */
const blogPath = (l) => (l === 'fr' ? 'fr/blog/' : 'blog/');
/** Where a page belongs: its index path and name. */
const parentOf = (a) => (a.blog ? { path: blogPath(a.lang), name: L[a.lang].blog } : { path: hubPath(a.lang), name: L[a.lang].guides });
const dateFmt = (l, d = UPDATED) => new Date(`${d}T12:00:00Z`).toLocaleDateString(l === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** A guide photo: WebP for browsers that take it, the 1200x630 JPEG otherwise (also the share card). */
const photoUrl = (key) => `${SITE}img/guides/${key}.jpg`;
function figure(key, lang, up, first) {
  const p = PHOTOS[key];
  const credit = p.page ? `<a href="${p.page}" rel="nofollow noopener">${p.by}</a>` : p.by;
  return `<figure class="ph"><picture><source type="image/webp" srcset="${up}img/guides/${key}-800.webp 800w, ${up}img/guides/${key}.webp 1200w" sizes="(max-width: 800px) 100vw, 720px"><img src="${up}img/guides/${key}.jpg" width="1200" height="630" alt="${esc(p[lang])}" ${first ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture><figcaption>Photo${lang === 'fr' ? ' : ' : ': '}${credit}</figcaption></figure>`;
}
const imageLd = (key, lang) => ({ '@type': 'ImageObject', url: photoUrl(key), contentUrl: photoUrl(key), width: 1200, height: 630, caption: PHOTOS[key][lang], creditText: PHOTOS[key].by });

for (const a of PAGES) {
  // A page says when it was published; a later date shows only when it was really changed since.
  const published = a.published ?? a.updated ?? UPDATED;
  const updated = a.updated ?? a.published ?? UPDATED;
  const changed = Boolean(a.updated) || !a.published;
  const depth = a.path.split('/').filter(Boolean).length;
  const up = '../'.repeat(depth);
  const url = SITE + a.path;
  const twin = PAGES.find((x) => x.pair === a.pair && x.lang !== a.lang);
  const t = L[a.lang];
  const parent = parentOf(a);
  const homeRel = up + (a.lang === 'fr' ? 'fr/' : '');
  const homeAbs = SITE + (a.lang === 'fr' ? 'fr/' : '');
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': a.blog ? 'BlogPosting' : 'Article',
        headline: a.h1,
        description: a.description,
        inLanguage: a.lang,
        datePublished: published,
        dateModified: updated,
        mainEntityOfPage: url,
        // A page without its own photo is shown with the site's share picture, as its share card is.
        image: a.cover ? [a.cover, a.figure?.photo].filter(Boolean).map((k) => imageLd(k, a.lang)) : [{ '@type': 'ImageObject', url: `${SITE}og.jpg`, width: 1200, height: 630 }],
        author: { '@type': 'Organization', '@id': `${SITE}#org`, name: 'IRLY', url: SITE },
        publisher: { '@type': 'Organization', '@id': `${SITE}#org`, name: 'IRLY', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}logo-512.png`, width: 512, height: 512 } },
        isPartOf: { '@id': `${SITE}#website` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t.home, item: homeAbs },
          { '@type': 'ListItem', position: 2, name: parent.name, item: SITE + parent.path },
          { '@type': 'ListItem', position: 3, name: a.h1, item: url },
        ],
      },
    ],
  };
  // Questions and answers shown on the page, in the same words, as FAQPage data.
  if (a.faq?.length) {
    ld['@graph'].push({ '@type': 'FAQPage', inLanguage: a.lang, mainEntity: a.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  }
  const faq = a.faq?.length ? `\n<section class="faq"><h2>${t.faq}</h2>\n${a.faq.map((f) => `<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`).join('\n')}</section>` : '';
  const alternates = [a, twin].filter(Boolean).map((x) => `<link rel="alternate" hreflang="${x.lang}" href="${SITE + x.path}">`);
  alternates.push(`<link rel="alternate" hreflang="x-default" href="${SITE + (a.lang === 'en' ? a.path : twin?.path ?? a.path)}">`);
  const body = a.sections.map((s, i) => `<section><h2>${s.h2}</h2>\n${s.html}</section>${a.figure && a.figure.after === i ? `\n${figure(a.figure.photo, a.lang, up, false)}` : ''}`).join('\n');
  const share = a.cover ? photoUrl(a.cover) : `${SITE}og.jpg`;
  // The button opens the app in the page's language, and says which page sent the visitor (read by any audience tool, ignored by the app).
  const appLink = `${APP_URL}?lang=${a.lang}&amp;utm_source=getirly&amp;utm_medium=${a.blog ? 'blog' : 'guide'}&amp;utm_campaign=${a.path.split('/').filter(Boolean).at(-1)}`;
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
<link rel="icon" href="${up}favicon.ico" sizes="48x48">
<link rel="icon" href="${up}favicon.png" type="image/png" sizes="96x96">
<link rel="apple-touch-icon" href="${up}apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="IRLY">
<meta property="og:title" content="${esc(a.h1)}">
<meta property="og:description" content="${esc(a.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${share}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
${a.cover ? `<meta property="og:image:alt" content="${esc(PHOTOS[a.cover][a.lang])}">` : ''}
<meta property="og:locale" content="${t.locale}">
<meta property="og:locale:alternate" content="${a.lang === 'fr' ? 'en_US' : 'fr_FR'}">
<meta property="article:published_time" content="${published}">
<meta property="article:modified_time" content="${updated}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(a.h1)}">
<meta name="twitter:description" content="${esc(a.description)}">
<meta name="twitter:image" content="${share}">
${a.cover ? `<link rel="preload" as="image" href="${up}img/guides/${a.cover}-800.webp" type="image/webp">` : ''}
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
  <nav class="crumbs" aria-label="${a.lang === 'fr' ? 'Fil d’Ariane' : 'Breadcrumb'}"><a href="${homeRel}">${t.home}</a> › <a href="${up + parent.path}">${parent.name}</a> › ${a.city}</nav>
  <h1>${a.h1}</h1>
  <p class="meta">${t.by} · ${changed ? t.updated : t.published} <time datetime="${changed ? updated : published}">${dateFmt(a.lang, changed ? updated : published)}</time></p>
  <p class="lead">${a.lead}</p>
${a.cover ? figure(a.cover, a.lang, up, true) : ''}
${body}${faq}
  <aside class="cta">
    <h2>${a.cta.title}</h2>
    <p>${a.cta.body}</p>
    <a class="btn" href="${a.cta.href ?? appLink}" data-cta="guide">${a.cta.label} <span aria-hidden="true">→</span></a>
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

/* ───────── Guides index and blog index, one per language ───────── */
const HUBS = [
  { pages: GUIDES, at: hubPath, name: (t) => t.guides, title: (t) => t.hubTitle, desc: (t) => t.hubDesc, lead: (t) => t.hubLead, read: (t) => t.readGuide },
  { pages: BLOG, at: blogPath, name: (t) => t.blog, title: (t) => t.blogTitle, desc: (t) => t.blogDesc, lead: (t) => t.blogLead, read: (t) => t.readPost },
];
for (const hub of HUBS) for (const l of ['en', 'fr']) {
  const hubPath = hub.at;
  const L0 = L[l];
  const t = { ...L0, guides: hub.name(L0), hubTitle: hub.title(L0), hubDesc: hub.desc(L0), hubLead: hub.lead(L0), readGuide: hub.read(L0) };
  const list = hub.pages.filter((a) => a.lang === l);
  if (!list.length) continue;
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
    .map((a) => `  <article class="card">${a.cover ? `<a class="thumb" href="${up + a.path}" tabindex="-1" aria-hidden="true"><img src="${up}img/guides/${a.cover}-800.webp" width="800" height="420" alt="" loading="lazy" decoding="async"></a>` : ''}<h2><a href="${up + a.path}">${a.h1}</a></h2><p>${a.description}</p><p class="more"><a href="${up + a.path}">${t.readGuide} <span aria-hidden="true">→</span></a></p></article>`)
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
<link rel="icon" href="${up}favicon.ico" sizes="48x48">
<link rel="icon" href="${up}favicon.png" type="image/png" sizes="96x96">
<meta property="og:type" content="website">
<meta property="og:site_name" content="IRLY">
<meta property="og:title" content="${esc(t.hubTitle)}">
<meta property="og:description" content="${esc(t.hubDesc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${list[0]?.cover ? photoUrl(list[0].cover) : `${SITE}og.jpg`}">
<meta property="og:locale" content="${t.locale}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap">
<style>${css}
.card{padding:22px 0;border-bottom:1px solid var(--line)}.thumb img{display:block;width:100%;height:auto;aspect-ratio:40/21;object-fit:cover;border-radius:16px;margin-bottom:14px;background:#141414}.card h2{margin:0 0 8px;font-size:23px}.card h2 a{text-decoration:none}.card p{margin:0 0 8px}.more a{font-weight:700;font-size:15px}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<header class="top">
  <a class="brand" href="${up + (l === 'fr' ? 'fr/' : '')}" aria-label="IRLY">IRLY</a>
  <a class="lang" href="${up + hubPath(other)}" hreflang="${other}" lang="${other}">${L[l].other}</a>
</header>
<main>
  <nav class="crumbs" aria-label="${l === 'fr' ? 'Fil d’Ariane' : 'Breadcrumb'}"><a href="${up + (l === 'fr' ? 'fr/' : '')}">${t.home}</a> › ${t.guides}</nav>
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

/* ───────── The page shown for an address that does not exist (kept out of search engines) ───────── */
fs.writeFileSync(
  `${OUT}/404.html`,
  `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Page not found | IRLY</title>
<meta name="theme-color" content="#050505">
<meta name="color-scheme" content="dark">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<style>${css}</style>
</head>
<body>
<header class="top"><a class="brand" href="/" aria-label="IRLY">IRLY</a></header>
<main>
  <h1>This page does not exist</h1>
  <p class="lead">The address may have changed. Here is where to go next.</p>
  <p><a href="/">Home</a> · <a href="/guides/">Guides</a> · <a href="/blog/">Blog</a> · <a href="/girl">IRLY Girl</a> · <a href="${APP_URL}">Open IRLY</a></p>
  <h2 lang="fr">Cette page n’existe pas</h2>
  <p lang="fr">L’adresse a peut-être changé. <a href="/fr/">Accueil</a> · <a href="/fr/guides/">Guides</a> · <a href="/fr/blog/">Blog</a> · <a href="/fr/girl">IRLY Girl</a> · <a href="${APP_URL}">Ouvrir IRLY</a></p>
</main>
<footer><a href="/">IRLY</a> · © 2026 IRLY</footer>
</body>
</html>
`,
);

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
const lines = (list) => list.map((a) => `- [${a.h1}](${SITE + a.path}) (${a.lang}): ${a.description}`).join('\n');
fs.writeFileSync(
  `${OUT}/llms.txt`,
  `# IRLY

> IRLY (app name: IRLY — Make Friends IRL) is an app to meet people who share your interests and do things together in real life: communities, activities and group chats. It starts in Dubai and covers the other emirates of the UAE; Bali is announced and coming soon. It is in English and French. It is not a dating app. IRLY Girl is a space reserved for women.

## Facts

- Official website: ${SITE}
- Main city: Dubai, United Arab Emirates
- What it does: discover activities, create an activity, join communities built around an interest, a language or a neighbourhood, and talk in group chats before meeting in person
- Who it is for: newcomers and expatriates, French speakers in Dubai, the international community, women looking for women-only communities, people who do sport, entrepreneurs and professionals, anyone who wants a wider circle of friends
- IRLY Girl: communities and activities reserved for women
- IRLY Network: meeting other professionals and entrepreneurs around activities and communities
- IRLY Games: a social game members play together in the app
- Price: free
- Availability: in the browser today at ${APP_URL} ; iOS and Android apps are coming soon
- Languages: English and French
- Not a dating app: IRLY is for friendship and group activities
- Publisher: ALF FASHION BRAND FZCO · Contact: getirly@gmail.com

## Links

- Website: ${SITE} (English), ${SITE}fr/ (French)
- IRLY Girl (women only): ${SITE}girl (English), ${SITE}fr/girl (French)
- Web app: ${APP_URL}
- Guides: ${SITE}guides/ and ${SITE}fr/guides/
- Blog: ${SITE}blog/ and ${SITE}fr/blog/
- Privacy: ${SITE}privacy · Terms: ${SITE}terms · Community guidelines: ${SITE}guidelines · Support: ${SITE}support

## Guides

${lines(GUIDES)}

## Blog

${lines(BLOG)}
`,
);

/* ───────── Sitemap ───────── */
const homeAlts = INDEXED.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${homeHref(l)}"/>`).concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}"/>`).join('\n');
// The home page's own photos (Google Images): the hero and the Dubai pictures.
const homeImgs = ['img/heroBurj.webp', 'img/heroPortrait-lg.webp', 'img/hero/sunset-p-lg.webp', 'img/hero/skyline-1920.webp', 'img/hero/marina-1920.webp', 'img/hero/arab-1920.webp', 'img/hero/creek-1920.webp', 'img/hero/desert-1920.webp', 'img/jbr.webp', 'img/burjKhalifa.webp', 'img/dhow.webp', 'img/dubaiMarina.webp', 'img/day10Crowd.webp', 'video/hero.jpg']
  .filter((f) => fs.existsSync(`site/${f}`))
  .map((f) => `    <image:image><image:loc>${SITE}${f}</image:loc></image:image>`)
  .join('\n');
const urls = INDEXED.map((l) => `  <url>\n    <loc>${homeHref(l)}</loc>\n    <lastmod>${UPDATED}</lastmod>\n${homeAlts}\n${homeImgs}\n  </url>`);
for (const a of PAGES) {
  const pair = PAGES.filter((x) => x.pair === a.pair);
  const alts = pair.map((x) => `    <xhtml:link rel="alternate" hreflang="${x.lang}" href="${SITE + x.path}"/>`).join('\n');
  const imgs = [a.cover, a.figure?.photo].filter(Boolean).map((k) => `    <image:image><image:loc>${photoUrl(k)}</image:loc></image:image>`).join('\n');
  urls.push(`  <url>\n    <loc>${SITE + a.path}</loc>\n    <lastmod>${a.updated ?? a.published ?? UPDATED}</lastmod>\n${alts}${imgs ? `\n${imgs}` : ''}\n  </url>`);
}
const hubAlts = ['en', 'fr'].map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE + hubPath(l)}"/>`).join('\n');
for (const l of ['en', 'fr']) urls.push(`  <url>\n    <loc>${SITE + hubPath(l)}</loc>\n    <lastmod>${GUIDES.map((a) => a.updated ?? a.published ?? UPDATED).sort().at(-1)}</lastmod>\n${hubAlts}\n  </url>`);
if (BLOG.length) {
  const blogAlts = ['en', 'fr'].map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE + blogPath(l)}"/>`).join('\n');
  for (const l of ['en', 'fr']) urls.push(`  <url>\n    <loc>${SITE + blogPath(l)}</loc>\n    <lastmod>${BLOG.map((a) => a.updated ?? a.published).sort().at(-1)}</lastmod>\n${blogAlts}\n  </url>`);
}
fs.writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`);
console.log('site pages: fr, ar,', PAGES.map((a) => a.path).join(', '), '+ guides index, FAQ data, llms.txt, sitemap');
