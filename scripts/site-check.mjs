/**
 * Checks the live website (getirly.com), not a local build:
 *  1. every public page answers 200 over HTTPS, with its own title, one h1,
 *     a canonical address on getirly.com and no unfinished text;
 *  2. sitemap.xml and robots.txt list them;
 *  3. in a real browser, the contact form of /support is filled in and sent:
 *     the request must reach IRLY's server (support_requests). The check
 *     request is then deleted, so it never sits among real requests;
 *  4. prints whether phone-number sign-in is on (for the privacy policy).
 * Needs SUPABASE_ACCESS_TOKEN (Management API). Exit 1 on any failure.
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE_URL || 'https://getirly.com';
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is missing');
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers, body: JSON.stringify({ query }) });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

let failed = 0;
const ok = (label) => console.log(`  ✓ ${label}`);
const ko = (label, why) => (failed++, console.log(`  ✗ ${label}: ${why}`));

const PAGES = [
  ['/', /Less loneliness/],
  ['/fr/', /Moins de solitude/],
  ['/privacy', /Privacy Policy/],
  ['/fr/privacy', /Politique de confidentialité/],
  ['/terms', /Terms of Use/],
  ['/fr/terms', /Conditions d’utilisation/],
  ['/guidelines', /Community Guidelines/],
  ['/fr/guidelines', /Règles de la communauté/],
  ['/support', /Help &amp; support|Help & support/],
  ['/fr/support', /Aide et assistance/],
  ['/delete-account', /Delete your IRLY account/],
  ['/fr/delete-account', /Supprimer ton compte IRLY/],
  ['/legal-notice', /Legal notice/],
  ['/fr/legal-notice', /Mentions légales/],
  ['/app/', /<div id="root"|IRLY/],
];

console.log(`Pages on ${SITE}`);
for (const [p, h1] of PAGES) {
  try {
    const res = await fetch(SITE + p, { redirect: 'follow' });
    const html = await res.text();
    if (res.status !== 200) {
      ko(p, `HTTP ${res.status}`);
      continue;
    }
    if (p.startsWith('/app')) {
      ok(`${p} 200`);
      continue;
    }
    const problems = [];
    if (!h1.test(html)) problems.push('expected heading missing');
    if ((html.match(/<h1[\s>]/g) || []).length !== 1) problems.push('not exactly one h1');
    if (!/<title>[^<]{10,}<\/title>/.test(html)) problems.push('no title');
    if (!/<meta name="description" content="[^"]{50,}"/.test(html)) problems.push('no description');
    const canon = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? '';
    if (!canon.startsWith('https://getirly.com')) problems.push(`canonical ${canon || 'missing'}`);
    if (/lorem ipsum|\bTODO\b|\bTBD\b|https?:\/\/(localhost|127\.0\.0\.1)/.test(html)) problems.push('unfinished text or local address');
    const missing = (html.match(/INFORMATION REQUIRED|INFORMATION JURIDIQUE REQUISE/g) || []).length;
    problems.length ? ko(p, problems.join(', ')) : ok(`${p} 200${missing ? ` (legal information still required: ${missing})` : ''}`);
  } catch (e) {
    ko(p, e.message);
  }
}

console.log('Sitemap and robots');
const sitemap = await (await fetch(`${SITE}/sitemap.xml`)).text();
for (const p of ['/privacy', '/terms', '/support', '/delete-account', '/fr/privacy']) sitemap.includes(`<loc>https://getirly.com${p}</loc>`) ? ok(`sitemap lists ${p}`) : ko(`sitemap lists ${p}`, 'missing');
const robots = await (await fetch(`${SITE}/robots.txt`)).text();
/Sitemap: https:\/\/getirly\.com\/sitemap\.xml/.test(robots) && !/Disallow: \/\s*$/m.test(robots) ? ok('robots.txt allows crawling and names the sitemap') : ko('robots.txt', robots.slice(0, 120));

console.log('Contact form, in a real browser');
const mark = `Automated website check ${Date.now()} - please ignore`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${SITE}/support?topic=bug`, { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  overflow ? ko('no sideways scrolling on a phone', 'page wider than the screen') : ok('no sideways scrolling on a phone');
  // Empty form: the fields say what is missing, nothing is sent.
  await page.fill('#email', '');
  await page.click('#send');
  (await page.textContent('#emailErr'))?.trim() ? ok('an empty form is refused with a message') : ko('empty form', 'no error shown');
  await page.fill('#email', 'site-check@getirly.com');
  (await page.inputValue('#topic')) === 'bug' ? ok('a link can choose the topic') : ko('topic from the link', await page.inputValue('#topic'));
  await page.fill('#message', mark);
  await page.click('#send');
  await page.waitForSelector('#done.on', { timeout: 15000 });
  ok('the confirmation shows after sending');
  const rows = await sql(`select id, kind, subject, source, platform, lang from public.support_requests where body = '${mark}'`);
  rows.length === 1 && rows[0].source === 'web' && rows[0].subject === 'bug' && rows[0].platform === 'web'
    ? ok('the request reached IRLY’s server (support_requests, source web)')
    : ko('request stored on the server', JSON.stringify(rows));
  await sql(`delete from public.support_requests where body = '${mark}'`);
  const left = await sql(`select count(*)::int as n from public.support_requests where body = '${mark}'`);
  left[0].n === 0 ? ok('the check request was deleted') : ko('cleanup', 'row still there');
  errors.length ? ko('no errors in the browser console', errors.join(' | ').slice(0, 300)) : ok('no errors in the browser console');
} catch (e) {
  ko('contact form', e.message);
  await sql(`delete from public.support_requests where body = '${mark}'`).catch(() => undefined);
} finally {
  await browser.close();
}

console.log('Sign-in methods (for the privacy policy)');
try {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, { headers });
  const c = await res.json();
  // Only on/off and the provider's name: never a key.
  console.log(`  phone sign-in: ${c.external_phone_enabled ? 'on' : 'off'}${c.external_phone_enabled ? ` (SMS provider: ${c.sms_provider || 'unknown'})` : ''}`);
  console.log(`  Apple: ${c.external_apple_enabled ? 'on' : 'off'} · Google: ${c.external_google_enabled ? 'on' : 'off'}`);
} catch (e) {
  console.log(`  could not read: ${e.message}`);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll website checks passed');
process.exit(failed ? 1 : 0);
