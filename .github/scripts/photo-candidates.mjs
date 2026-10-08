/**
 * Candidate photos for one subject, to choose by eye: downloads the best
 * Pixabay matches (free licence) to photo-candidates/<slug>/ with a contact
 * sheet. Nothing is used until a candidate is copied by hand.
 *   QUERY="burj khalifa skyline" node .github/scripts/photo-candidates.mjs
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const KEY = process.env.PIXABAY_API_KEY;
const QUERY = process.env.QUERY || 'burj khalifa';
const slug = QUERY.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dir = `photo-candidates/${slug}`;
if (!KEY) throw new Error('PIXABAY_API_KEY missing');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const url = `https://pixabay.com/api/?key=${KEY}&q=${encodeURIComponent(QUERY)}&image_type=photo&orientation=horizontal&min_width=1920&safesearch=true&order=popular&per_page=40`;
const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
const { hits = [] } = await res.json();
const lines = [`# Candidates: ${QUERY}`, '', 'Pixabay Content License (free use, no attribution required).', ''];
let n = 0;
for (const h of hits) {
  if (n >= 16) break;
  try {
    const r = await fetch(h.largeImageURL, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) continue;
    n += 1;
    const f = `${dir}/${String(n).padStart(2, '0')}-pixabay-${h.id}.jpg`;
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    lines.push(`- ${f.split('/').pop()}: ${h.pageURL} (by ${h.user}, ${h.imageWidth}x${h.imageHeight}) tags: ${h.tags}`);
  } catch (e) {
    console.log('skip', h.id, e.message);
  }
}
fs.writeFileSync(`${dir}/SOURCES.md`, lines.join('\n') + '\n');
execFileSync('montage', ['-label', '%f', '-pointsize', '18', `${dir}/*.jpg`, '-geometry', '480x300+6+6', '-tile', '4x', `${dir}/_sheet.jpg`]);
console.log(`${n} candidates in ${dir}`);
