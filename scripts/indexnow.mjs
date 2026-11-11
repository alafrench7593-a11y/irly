/**
 * Announces the website's pages to the search engines that take part in IndexNow (Bing, which also feeds
 * ChatGPT search and Copilot, and others): it reads the live sitemap and sends its addresses in one request.
 * The key is public by design: it is the name of a text file at the root of the site (site/<key>.txt).
 * Google does not take part: its sitemap is submitted in Search Console.
 * Usage: node scripts/indexnow.mjs   (run by the « Announce pages » workflow, after a deployment)
 */
import fs from 'node:fs';

const HOST = 'www.getirly.com';
const key = fs.readdirSync('site').map((f) => f.match(/^([a-f0-9]{32})\.txt$/)?.[1]).find(Boolean);
if (!key) throw new Error('no IndexNow key file in site/');

const keyUrl = `https://${HOST}/${key}.txt`;
const live = await fetch(keyUrl);
if (live.status !== 200 || (await live.text()).trim() !== key) {
  console.log(`The key file is not live yet at its address (status ${live.status}): nothing sent. Run again after the deployment.`);
  process.exit(1);
}
const sitemap = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith(`https://${HOST}/`) && !/\.(webp|jpg|png)$/.test(u));
if (!urls.length) throw new Error('the live sitemap lists no page');

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: keyUrl, urlList: urls }),
});
console.log(`${urls.length} addresses announced; IndexNow answered ${res.status} ${res.statusText}`);
// 200: received. 202: received, the key is still being checked. Anything else is a refusal.
if (res.status !== 200 && res.status !== 202) {
  console.log((await res.text()).slice(0, 400));
  process.exit(1);
}
