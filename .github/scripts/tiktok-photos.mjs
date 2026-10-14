/**
 * Vertical photos for the IRLY TikTok slideshows: the best Pixabay matches
 * (Pixabay Content License: free commercial use, no attribution required)
 * per mood, saved to marketing/tiktok/_photos/<slug>/ with their source page
 * and a contact sheet. Queries: marketing/tiktok/photo-queries.json.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const KEY = process.env.PIXABAY_API_KEY;
if (!KEY) throw new Error('PIXABAY_API_KEY missing');
const queries = JSON.parse(fs.readFileSync('marketing/tiktok/photo-queries.json', 'utf8'));
const root = 'marketing/tiktok/_photos';
const index = [];
for (const q of queries) {
  const slug = q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dir = `${root}/${slug}`;
  if (fs.existsSync(`${dir}/SOURCES.md`)) continue;
  fs.mkdirSync(dir, { recursive: true });
  const url = `https://pixabay.com/api/?key=${KEY}&q=${encodeURIComponent(q)}&image_type=photo&orientation=vertical&min_height=1200&safesearch=true&order=popular&per_page=30`;
  const { hits = [] } = await (await fetch(url, { signal: AbortSignal.timeout(30000) })).json();
  const lines = [`# ${q}`, '', 'Pixabay Content License: https://pixabay.com/service/license-summary/', ''];
  let n = 0;
  for (const h of hits) {
    if (n >= 6) break;
    try {
      const r = await fetch(h.largeImageURL, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) continue;
      n += 1;
      const name = `${String(n).padStart(2, '0')}-pixabay-${h.id}.jpg`;
      fs.writeFileSync(`${dir}/${name}`, Buffer.from(await r.arrayBuffer()));
      lines.push(`- ${name}: ${h.pageURL} (by ${h.user}) tags: ${h.tags}`);
      index.push({ query: q, file: `${slug}/${name}`, page: h.pageURL, user: h.user, tags: h.tags });
    } catch (e) {
      console.log('skip', h.id, e.message);
    }
  }
  fs.writeFileSync(`${dir}/SOURCES.md`, lines.join('\n') + '\n');
  if (n) execFileSync('montage', ['-label', '%f', '-pointsize', '16', `${dir}/*.jpg`, '-geometry', '270x480+4+4', '-tile', '6x', `${dir}/_sheet.jpg`]);
  console.log(q, n);
}
const prev = fs.existsSync(`${root}/index.json`) ? JSON.parse(fs.readFileSync(`${root}/index.json`, 'utf8')) : [];
fs.writeFileSync(`${root}/index.json`, JSON.stringify([...prev, ...index], null, 1));
