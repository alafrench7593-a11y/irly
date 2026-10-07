/**
 * Example portraits for the demonstration build (EXPO_PUBLIC_DEMO=1).
 * Picks CC0 portraits on Openverse (StockSnap), crops them square and writes
 * public-photos/faces/<id>.jpg. faces.json keeps each pick stable between
 * runs; ids listed in faces-exclude.json (rejected after review) are never
 * picked again. Real members never see these photos.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const DIR = '.github/scripts';
const people = JSON.parse(fs.readFileSync(`${DIR}/faces-people.json`, 'utf8'));
const picksPath = `${DIR}/faces.json`;
const picks = fs.existsSync(picksPath) ? JSON.parse(fs.readFileSync(picksPath, 'utf8')) : {};
const exclude = new Set(JSON.parse(fs.readFileSync(`${DIR}/faces-exclude.json`, 'utf8')));
const QUERIES = {
  f: ['woman portrait', 'smiling woman', 'young woman portrait', 'woman headshot', 'woman face', 'businesswoman', 'girl portrait smile'],
  m: ['man portrait', 'smiling man', 'young man portrait', 'man headshot', 'man face', 'businessman', 'guy portrait smile'],
};

async function candidates(g) {
  const out = [];
  for (const q of QUERIES[g]) {
    for (const page of [1, 2]) {
      const u = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0&source=stocksnap&page_size=40&page=${page}`;
      const r = await fetch(u, { headers: { 'user-agent': 'IRLY demo portraits (github actions)' } });
      if (!r.ok) { console.log('openverse', r.status, q); continue; }
      const j = await r.json();
      for (const x of j.results ?? []) if (!out.some((o) => o.id === x.id)) out.push(x);
    }
  }
  return out;
}

const used = new Set(Object.values(picks).filter((p) => !exclude.has(p.id)).map((p) => p.id));
const pools = {};
fs.mkdirSync('public-photos/faces', { recursive: true });
for (const p of people) {
  let pick = picks[p.id];
  if (!pick || exclude.has(pick.id)) {
    pools[p.g] ??= await candidates(p.g);
    const next = pools[p.g].find((c) => !used.has(c.id) && !exclude.has(c.id));
    if (!next) { console.log('no candidate for', p.id); continue; }
    pick = { id: next.id, url: next.url, title: next.title, landing: next.foreign_landing_url, license: next.license };
    picks[p.id] = pick;
    used.add(pick.id);
  }
  const out = `public-photos/faces/${p.id}.jpg`;
  if (fs.existsSync(out) && fs.readFileSync(`${out}.src`, 'utf8') === pick.id) continue;
  try {
    const r = await fetch(pick.url, { redirect: 'follow' });
    if (!r.ok) throw new Error(String(r.status));
    fs.writeFileSync('/tmp/face.orig', Buffer.from(await r.arrayBuffer()));
    // Square, keeping the top of tall portraits where the face usually is.
    execFileSync('convert', ['/tmp/face.orig[0]', '-auto-orient', '-resize', '400x400^', '-gravity', 'north', '-extent', '400x400', '-strip', '-quality', '80', out]);
    fs.writeFileSync(`${out}.src`, pick.id);
  } catch (e) {
    console.log(p.id, 'failed', e.message);
  }
}
fs.writeFileSync(picksPath, JSON.stringify(picks, null, 2) + '\n');
const credits = ['# Example portraits (demo build only)', '', 'CC0 photos from StockSnap via Openverse. Used only to illustrate the app with example content.', ''];
for (const p of people) if (picks[p.id]) credits.push(`- **${p.id}**: ${picks[p.id].title} (${picks[p.id].license}) ${picks[p.id].landing}`);
fs.writeFileSync('public-photos/faces/CREDITS.md', credits.join('\n') + '\n');
