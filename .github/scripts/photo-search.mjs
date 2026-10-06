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
for (const [key, q] of Object.entries(queries)) {
  const r = await fetch(`https://unsplash.com/napi/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape`, { headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' } });
  if (!r.ok) { console.log(key, 'search failed', r.status); continue; }
  const j = await r.json();
  const free = (j.results ?? []).filter((p) => !p.premium && !p.plus && /images\.unsplash\.com\/photo-/.test(p.urls?.raw ?? ''));
  found[key] = [];
  for (const p of free.slice(0, 4)) {
    const id = p.urls.raw.match(/photo-([^?]+)/)[1];
    const img = await fetch(`https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=300&h=200&q=60`);
    if (!img.ok) continue;
    const file = `${out}/thumbs/${key}-${found[key].length}.jpg`;
    fs.writeFileSync(file, Buffer.from(await img.arrayBuffer()));
    found[key].push({ id, alt: p.alt_description ?? p.description ?? '', file });
  }
  console.log(key, found[key].length);
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
  execFileSync('montage', [...files, '-tile', '4x', '-geometry', '300x200+4+4', '-pointsize', '18', `${out}/sheet-${String(i / 6).padStart(2, '0')}.jpg`]);
}
console.log('sheets', Math.ceil(keys.length / 6));
