/**
 * Finds photo candidates on Unsplash for each subject and writes contact
 * sheets (one row per subject, four candidates) so a person can pick the
 * one that really shows the subject. Skips Unsplash+ (paid) photos.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const queries = JSON.parse(fs.readFileSync('.github/scripts/photo-queries.json', 'utf8'));
const out = 'photo-candidates';
fs.mkdirSync(`${out}/thumbs`, { recursive: true });
const found = {};
const UNSPLASH = process.env.UNSPLASH_ACCESS_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Unsplash (with an access key), else Openverse: public-domain / CC0 only, no attribution needed. */
async function search(q) {
  if (UNSPLASH) {
    const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape&content_filter=high`, { headers: { authorization: `Client-ID ${UNSPLASH}`, 'accept-version': 'v1' } });
    if (!r.ok) throw new Error(`unsplash ${r.status}`);
    const j = await r.json();
    return (j.results ?? []).map((p) => ({ source: 'unsplash', id: p.urls.raw.match(/photo-([^?]+)/)?.[1], thumb: `${p.urls.raw}&auto=format&fit=crop&w=300&h=200&q=60`, alt: p.alt_description ?? '' })).filter((p) => p.id);
  }
  const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&aspect_ratio=wide&mature=false&page_size=12`, { headers: { 'user-agent': 'IRLY photo picker (github actions)' } });
  if (!r.ok) throw new Error(`openverse ${r.status}`);
  const j = await r.json();
  return (j.results ?? []).filter((p) => (p.width ?? 0) >= 1000).map((p) => ({ source: 'openverse', id: p.id, url: p.url, thumb: p.thumbnail, alt: p.title ?? '', license: p.license, landing: p.foreign_landing_url }));
}

for (const [key, q] of Object.entries(queries)) {
  let list = [];
  try {
    list = await search(q);
  } catch (e) {
    console.log(key, 'search failed', e.message);
    await sleep(2000);
    continue;
  }
  found[key] = [];
  for (const p of list) {
    if (found[key].length >= 4) break;
    try {
      const img = await fetch(p.thumb, { headers: { 'user-agent': 'IRLY photo picker' } });
      if (!img.ok) continue;
      const file = `${out}/thumbs/${key}-${found[key].length}.jpg`;
      fs.writeFileSync(file, Buffer.from(await img.arrayBuffer()));
      found[key].push({ ...p, file });
    } catch {
      // skip unreachable thumbnails
    }
  }
  console.log(key, found[key].length);
  await sleep(UNSPLASH ? 100 : 1200);
}
fs.writeFileSync(`${out}/candidates.json`, JSON.stringify(found, null, 1));
// Contact sheets: 6 subjects per sheet, 4 candidates per row, labelled key#index.
const keys = Object.keys(found).filter((k) => found[k].length);
for (let i = 0; i < keys.length; i += 6) {
  const files = [];
  for (const k of keys.slice(i, i + 6)) for (let n = 0; n < 4; n += 1) {
    const f = found[k][n]?.file;
    files.push('-label', `${k} #${n}`, f ?? 'xc:white');
  }
  execFileSync('montage', [...files.map((f) => (f.endsWith('.jpg') ? `${f}[300x200^]` : f)), '-tile', '4x', '-geometry', '300x200+4+4', '-pointsize', '18', `${out}/sheet-${String(i / 6).padStart(2, '0')}.jpg`]);
}
console.log('sheets', Math.ceil(keys.length / 6));
