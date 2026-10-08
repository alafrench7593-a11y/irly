/**
 * Example portraits for the demonstration build (EXPO_PUBLIC_DEMO=1) and the website.
 * Picks a portrait per person on Pixabay (PIXABAY_API_KEY: free licence, each person's
 * own search for a varied cast; colour, single adult, smiling), else CC0 photos on
 * Openverse (StockSnap, Rawpixel); crops them square and writes
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
  f: ['woman portrait', 'smiling woman', 'young woman portrait', 'woman headshot', 'businesswoman', 'woman smile face'],
  m: ['young man portrait', 'smiling man', 'man portrait', 'man headshot', 'guy smiling', 'man beard portrait', 'businessman portrait'],
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Anonymous Openverse: at most 20 results a page, and a gentle pace.
async function candidates(g) {
  const out = [];
  for (const q of QUERIES[g]) {
    for (const page of [1, 2]) {
      const u = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0&source=stocksnap,rawpixel&category=photograph&page_size=20&page=${page}`;
      let r;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await wait(1500 + attempt * 4000);
        r = await fetch(u, { headers: { 'user-agent': 'IRLY demo portraits (github actions)' } });
        if (r.status !== 429) break;
      }
      if (!r.ok) { console.log('openverse', r.status, q, (await r.text()).slice(0, 160)); continue; }
      const j = await r.json();
      for (const x of j.results ?? []) if (!out.some((o) => o.id === x.id)) out.push(x);
    }
  }
  return out;
}

const PIXABAY = process.env.PIXABAY_API_KEY;
// One person per photo, in colour, an adult of the right gender.
const GENDER = { f: /\b(woman|women|girl|female|lady)\b/i, m: /\b(man|men|guy|male|boy|businessman)\b/i };
const NOT = /\b(black and white|monochrome|b&w|grayscale|group|couple|family|child|children|kid|kids|baby|crowd|team|friends|wedding|mask|nude|lingerie|bikini)\b/i;
async function pixabay(person) {
  const u = `https://pixabay.com/api/?key=${PIXABAY}&q=${encodeURIComponent(person.q)}&image_type=photo&category=people&orientation=vertical&min_width=800&safesearch=true&order=popular&per_page=80`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const r = await fetch(u);
    if (r.status === 429) { await wait(20000 * (attempt + 1)); continue; }
    if (!r.ok) { console.log('pixabay', r.status, person.id); return []; }
    const j = await r.json();
    await wait(700);
    return (j.hits ?? [])
      .filter((h) => GENDER[person.g].test(h.tags) && !NOT.test(h.tags))
      .map((h) => ({ id: `pixabay-${h.id}`, url: h.largeImageURL, title: h.tags, foreign_landing_url: h.pageURL, license: 'pixabay' }));
  }
  return [];
}

const used = new Set(Object.values(picks).filter((p) => !exclude.has(p.id)).map((p) => p.id));
const pools = {};
fs.mkdirSync('public-photos/faces', { recursive: true });
for (const p of people) {
  let pick = picks[p.id];
  // Openverse picks are replaced once Pixabay is available (better portraits, a varied cast).
  if (!pick || exclude.has(pick.id) || (PIXABAY && p.q && !String(pick.id).startsWith('pixabay-'))) {
    let next;
    if (PIXABAY && p.q) next = (await pixabay(p)).find((c) => !used.has(c.id) && !exclude.has(c.id));
    if (!next) {
      pools[p.g] ??= await candidates(p.g);
      next = pools[p.g].find((c) => !used.has(c.id) && !exclude.has(c.id));
    }
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
const credits = ['# Example portraits (demo build and website)', '', 'Photos from Pixabay (free licence, https://pixabay.com/service/license-summary/) or CC0 photos from StockSnap and Rawpixel via Openverse. Used only to illustrate the app with example content.', ''];
for (const p of people) if (picks[p.id]) credits.push(`- **${p.id}**: ${picks[p.id].title} (${picks[p.id].license}) ${picks[p.id].landing}`);
fs.writeFileSync('public-photos/faces/CREDITS.md', credits.join('\n') + '\n');
