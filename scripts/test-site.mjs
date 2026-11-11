/**
 * Builds the website into a temporary folder and checks what search engines and AI assistants read:
 * one title, description and h1 per page, the page's language, its canonical address, language versions that
 * point at each other, structured data that parses, internal links that open a page, and a sitemap that lists
 * every indexable page and nothing else.
 * Usage: node scripts/test-site.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SITE = 'https://www.getirly.com/';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'irly-site-'));
execFileSync('node', ['.github/scripts/site-build.mjs', OUT], { stdio: 'ignore' });

const errors = [];
const warnings = [];
let checks = 0;
const ok = (cond, where, what) => {
  checks += 1;
  if (!cond) errors.push(`${where}: ${what}`);
};

/** Every page of the website (the app and the demo are built elsewhere). */
function pages(dir, rel = '') {
  const out = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) out.push(...pages(path.join(dir, f.name), `${rel}${f.name}/`));
    else if (f.name === 'index.html') out.push(rel);
  }
  return out;
}
const all = pages(OUT).sort();
const html = Object.fromEntries(all.map((p) => [p, fs.readFileSync(path.join(OUT, p, 'index.html'), 'utf8')]));
const one = (s, re) => [...s.matchAll(re)].map((m) => m[1]);
const urlOf = (p) => SITE + p;
/** A page's address as written in links: legal pages and /girl have no trailing slash. */
const same = (a, b) => a.replace(/\/$/, '') === b.replace(/\/$/, '');
/** The page at this address (the home page is the empty path), or null. */
const pageAt = (url) => all.find((p) => same(urlOf(p), url)) ?? null;

const sitemap = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8');
const listed = one(sitemap, /<loc>([^<]+)<\/loc>/g).filter((u) => !/\.(webp|jpg|png)$/.test(u));
const seenTitles = new Map();
const seenDescriptions = new Map();

for (const p of all) {
  const s = html[p];
  const where = `/${p}`;
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(s);
  const titles = one(s, /<title>([^<]*)<\/title>/g);
  const descs = one(s, /<meta name="description" content="([^"]*)"/g);
  const canon = one(s, /<link rel="canonical" href="([^"]*)"/g);
  const lang = one(s, /<html[^>]* lang="([^"]+)"/g)[0];
  const body = s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  ok(titles.length === 1 && titles[0].trim().length >= 10, where, `needs exactly one title (found ${titles.length})`);
  ok(descs.length === 1 && descs[0].trim().length >= 50, where, `needs exactly one description (found ${descs.length})`);
  ok(one(body, /<h1[\s>]([\s\S]*?)<\/h1>/g).length === 1, where, 'needs exactly one h1');
  ok(Boolean(lang), where, 'the page says no language');
  ok(canon.length === 1 && canon[0].startsWith(SITE), where, 'needs one canonical address on getirly.com');
  ok(/<meta name="viewport"/.test(s), where, 'no viewport');
  if (titles[0] && titles[0].length > 70) warnings.push(`${where}: title of ${titles[0].length} characters`);
  if (descs[0] && descs[0].length > 165) warnings.push(`${where}: description of ${descs[0].length} characters`);
  if (noindex) {
    ok(!listed.some((u) => same(u, urlOf(p))), where, 'a page kept out of search engines is in the sitemap');
    continue;
  }
  ok(same(canon[0] ?? '', urlOf(p)), where, `canonical ${canon[0]} is not this page`);
  ok(listed.some((u) => same(u, urlOf(p))), where, 'missing from the sitemap');
  ok(p.startsWith('fr/') ? lang === 'fr' : lang === 'en', where, `language ${lang} does not match the address`);
  if (titles[0]) {
    ok(!seenTitles.has(titles[0]), where, `same title as ${seenTitles.get(titles[0])}`);
    seenTitles.set(titles[0], where);
  }
  if (descs[0]) {
    ok(!seenDescriptions.has(descs[0]), where, `same description as ${seenDescriptions.get(descs[0])}`);
    seenDescriptions.set(descs[0], where);
  }
  // Language versions: each names itself, and the other one names it back.
  const alts = [...s.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => ({ lang: m[1], href: m[2] }));
  ok(alts.some((a) => a.lang === lang && same(a.href, urlOf(p))), where, 'does not name itself among its language versions');
  ok(alts.some((a) => a.lang === 'x-default'), where, 'no default language version');
  for (const a of alts.filter((x) => x.lang !== 'x-default' && x.lang !== lang)) {
    const twin = pageAt(a.href);
    ok(twin !== null, where, `its ${a.lang} version ${a.href} does not exist`);
    if (twin !== null) ok(new RegExp(`<link rel="alternate" hreflang="${lang}" href="${urlOf(p).replace(/\/$/, '')}/?"`).test(html[twin]), where, `its ${a.lang} version does not point back`);
  }
  // Structured data parses, and says nothing we cannot show.
  for (const block of one(s, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data = null;
    try {
      data = JSON.parse(block);
    } catch {
      /* reported below */
    }
    ok(data !== null, where, 'structured data does not parse');
    ok(!/aggregateRating|"review"|ratingValue|reviewCount/.test(block), where, 'structured data carries a rating or a review');
    const nodes = data ? (data['@graph'] ?? [data]) : [];
    for (const n of nodes) {
      if (n['@type'] === 'BlogPosting' || n['@type'] === 'Article') {
        ok(Boolean(n.headline && n.datePublished && n.dateModified && n.image?.length), where, 'article data is incomplete');
        ok(n.dateModified >= n.datePublished, where, `modified ${n.dateModified} before published ${n.datePublished}`);
      }
      if (n['@type'] === 'FAQPage') {
        for (const q of n.mainEntity) ok(body.replace(/&[a-z]+;/g, ' ').replace(/<[^>]+>/g, '').includes(q.name.replace(/[&"<]/g, ' ').slice(0, 30)) || body.includes(q.name.slice(0, 30)), where, `the question « ${q.name.slice(0, 40)} » is not on the page`);
      }
    }
  }
  // Images say what they show (an empty alt marks a decorative one).
  for (const img of one(body, /(<img\b[^>]*>)/g)) ok(/\salt="/.test(img), where, `image without alt: ${img.slice(0, 80)}`);
  // Internal links open a page of the site.
  for (const href of one(body, /<a\b[^>]*\shref="([^"]+)"/g)) {
    if (/^(https?:|mailto:|tel:|#|javascript:)/.test(href) && !href.startsWith(SITE)) continue;
    const target = new URL(href.split('#')[0].split('?')[0] || '.', urlOf(p)).href;
    if (!target.startsWith(SITE) || /^https:\/\/www\.getirly\.com\/(app|demo)(\/|$)/.test(target)) continue;
    const file = target.slice(SITE.length);
    ok(pageAt(target) !== null || (file !== '' && fs.existsSync(path.join(OUT, file))), where, `link to ${href} opens nothing`);
  }
}
// The sitemap lists only pages that exist and may be indexed.
for (const u of listed) {
  const p = pageAt(u);
  ok(p !== null, 'sitemap', `${u} is not a page of the site`);
}
ok(new Set(listed).size === listed.length, 'sitemap', 'an address is listed twice');
// robots.txt and llms.txt.
const robots = fs.readFileSync(path.join(OUT, 'robots.txt'), 'utf8');
ok(/Sitemap: https:\/\/www\.getirly\.com\/sitemap\.xml/.test(robots), 'robots.txt', 'does not name the sitemap');
ok(!/^Disallow: \/\s*$/m.test(robots), 'robots.txt', 'closes the whole site');
const llms = fs.readFileSync(path.join(OUT, 'llms.txt'), 'utf8');
for (const u of one(llms, /\((https:\/\/www\.getirly\.com\/[^)\s]*)\)/g)) ok(pageAt(u) !== null, 'llms.txt', `${u} is not a page of the site`);

fs.rmSync(OUT, { recursive: true, force: true });
for (const w of warnings) console.log(`warning  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} failed of ${checks} checks on ${all.length} pages`);
  process.exit(1);
}
console.log(`${checks} checks passed on ${all.length} pages, ${listed.length} addresses in the sitemap`);
