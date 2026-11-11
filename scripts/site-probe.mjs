/**
 * Reads the live website the way a search engine does and prints what it answers: which of getirly.com and
 * www.getirly.com serves the pages and which one redirects, the status of the pages that matter, and whether the
 * host answers search crawlers as it answers a browser. It only reads: no form, no account, nothing written.
 * Usage: node scripts/site-probe.mjs   (run by the « Website probe » workflow, from GitHub's network)
 */
const HOSTS = ['https://getirly.com', 'https://www.getirly.com', 'http://getirly.com', 'http://www.getirly.com'];
const PATHS = ['/', '/fr/', '/robots.txt', '/sitemap.xml', '/llms.txt', '/guides/', '/fr/dubai/se-faire-des-amis/', '/dubai/make-friends', '/girl', '/app/', '/this-page-does-not-exist/'];
const AGENTS = {
  browser: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  Googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  Bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
};

async function head(url, agent) {
  try {
    const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': agent } });
    const text = res.status === 200 ? await res.text() : '';
    return { status: res.status, location: res.headers.get('location') ?? '', robots: res.headers.get('x-robots-tag') ?? '', type: res.headers.get('content-type') ?? '', text };
  } catch (e) {
    return { status: 0, location: '', robots: '', type: '', text: '', error: String(e.cause?.code ?? e.message) };
  }
}
const one = (s, re) => s.match(re)?.[1] ?? '';

console.log('== Which address answers');
for (const h of HOSTS) {
  const r = await head(`${h}/`, AGENTS.browser);
  console.log(`${h}/  →  ${r.status}${r.location ? `  to ${r.location}` : ''}${r.error ? `  (${r.error})` : ''}`);
}
const serving = [];
for (const h of HOSTS.slice(0, 2)) if ((await head(`${h}/`, AGENTS.browser)).status === 200) serving.push(h);
console.log(`serves pages itself: ${serving.join(', ') || 'none'}`);
const base = serving[0] ?? HOSTS[0];

console.log(`\n== Pages on ${base}`);
for (const p of PATHS) {
  const r = await head(base + p, AGENTS.browser);
  const canonical = one(r.text, /<link rel="canonical" href="([^"]+)"/);
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(r.text) || /noindex/.test(r.robots);
  console.log(`${p.padEnd(34)} ${r.status}${r.location ? ` to ${r.location}` : ''}${canonical ? `  canonical ${canonical}` : ''}${noindex ? '  noindex' : ''}`);
}

console.log('\n== The same page, asked by each crawler');
for (const [name, agent] of Object.entries(AGENTS)) {
  const r = await head(`${base}/dubai/make-friends/`, agent);
  console.log(`${name.padEnd(14)} ${r.status}${r.location ? ` to ${r.location}` : ''}  ${r.text.length} characters${r.text.includes('<h1') ? ', h1 present' : ''}`);
}

console.log('\n== robots.txt');
console.log((await head(`${base}/robots.txt`, AGENTS.browser)).text.trim() || '(none)');
const sm = (await head(`${base}/sitemap.xml`, AGENTS.browser)).text;
console.log(`\n== sitemap.xml: ${(sm.match(/<loc>/g) ?? []).length} entries (pages and pictures); first page address: ${one(sm, /<loc>([^<]+)<\/loc>/)}`);
