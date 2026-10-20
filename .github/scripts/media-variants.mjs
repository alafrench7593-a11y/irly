/**
 * HD photo variants and one film per subject, so the app never shows the
 * same picture twice.
 *
 * For every photo key of src/data/photos.ts, finds several different HD
 * photos (at least 2400 px wide) of the same subject, as many as the app
 * uses the key (min 3, max 12), across every free-for-commercial-use bank we
 * have access to:
 *   Unsplash (UNSPLASH_ACCESS_KEY), Pexels (PEXELS_API_KEY),
 *   Pixabay (PIXABAY_API_KEY), and Openverse public domain / CC0 (no key,
 *   includes Wikimedia Commons, Flickr public domain, museums…).
 * No photo is used twice anywhere: same bank id, or the same picture found
 * on two banks (perceptual hash), is skipped.
 *
 * Unsplash and Pexels photos are served by their own CDN, resized to the
 * phone's screen (their licences ask for hotlinking). Pixabay and Openverse
 * photos are downloaded and served by IRLY (public-photos/v/<key>-<n>-<w>.jpg).
 *
 * Films: every film key of src/data/photos.ts (FILMS) gets its own clip
 * (Pexels or Pixabay, 1080p, no clip used twice) in site/video/<key>.mp4.
 *
 * Writes src/data/photoVariants.ts, public-photos/VARIANTS.md (sources) and a
 * contact sheet per key (public-photos/_variants/<key>.jpg) to check by eye.
 * Choices are frozen in media-variants-picks.json: a later run only adds.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const KEYS = {
  unsplash: process.env.UNSPLASH_ACCESS_KEY,
  pexels: process.env.PEXELS_API_KEY,
  pixabay: process.env.PIXABAY_API_KEY,
};
console.log(`Banks: ${Object.entries(KEYS).map(([k, v]) => `${k} ${v ? 'on' : 'off (no key)'}`).join(' · ')} · openverse on`);

const dir = '.github/scripts';
const read = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
const picksFile = `${dir}/media-variants-picks.json`;
const picks = read(picksFile, { photos: {}, films: {} });
// One link once per key. A file name is <key>-<n>, and n used to be the list's length + 1: after a pick was removed by
// hand, the next one reused a taken n, overwrote that file and the link was listed twice. Keep the last pick of a link
// (the picture now in the file, with its credit).
const dedupe = (list) => list.filter((p, i) => list.findLastIndex((q) => q.url === p.url) === i);
for (const key of Object.keys(picks.photos)) picks.photos[key] = dedupe(picks.photos[key]);
const exclude = new Set([...Object.values(read(`${dir}/dubai-exclude.json`, {})).flat().filter((x) => typeof x === 'string'), ...read(`${dir}/media-variants-exclude.json`, [])]);
const dubaiQueries = read(`${dir}/dubai-queries.json`, {});
const extraQueries = read(`${dir}/photo-queries.json`, {});
// Stricter searches (search, subject words, words to avoid) for the most used activities; they win over the others.
const strictQueries = read(`${dir}/media-variants-queries.json`, {});
delete strictQueries._note;
delete dubaiQueries._note;

// ── Keys, how often the app uses each, and the films ──
const photosTs = fs.readFileSync('src/data/photos.ts', 'utf8');
const idKeys = [...photosTs.slice(photosTs.indexOf('const ids = {'), photosTs.indexOf('};', photosTs.indexOf('const ids = {'))).matchAll(/^\s+(\w+): '/gm)].map((m) => m[1]);
const libBlock = photosTs.slice(photosTs.indexOf('export const LIBRARY = ['), photosTs.indexOf('] as const', photosTs.indexOf('export const LIBRARY = [')));
const libKeys = [...libBlock.matchAll(/'(\w+)'/g)].map((m) => m[1]);
const allKeys = [...new Set([...idKeys, ...libKeys])];
const filmKeys = [...photosTs.slice(photosTs.indexOf('const FILMS'), photosTs.indexOf('};', photosTs.indexOf('const FILMS'))).matchAll(/^\s+(\w+): '/gm)].map((m) => m[1]);

const src = execFileSync('grep', ['-rhoE', "photo: '[A-Za-z]+'|photo=\"[A-Za-z]+\"|'[A-Za-z]+' as PhotoKey", 'src'], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n');
const uses = {};
for (const l of src) {
  const k = l.match(/'([A-Za-z]+)'|"([A-Za-z]+)"/)?.slice(1).find(Boolean);
  if (k) uses[k] = (uses[k] ?? 0) + 1;
}
const wanted = (key) => Math.min(12, Math.max(strictQueries[key] ? 8 : 3, (uses[key] ?? 1) + 2));

/** Search words for a key: the Dubai query when there is one, else the key's own words. */
function queryFor(key) {
  if (strictQueries[key]) return { q: strictQueries[key][0], words: strictQueries[key][1], avoid: strictQueries[key][2] };
  if (dubaiQueries[key]) return { q: dubaiQueries[key][0], words: dubaiQueries[key][1] };
  if (extraQueries[key]) return { q: extraQueries[key] };
  return { q: key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() };
}
const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const subjectTest = (words, avoid = []) => {
  const groups = words ? (Array.isArray(words[0]) ? words : [words]).map((g) => new RegExp(`\\b(${g.map(escape).join('|')})\\b`, 'i')) : [];
  const off = avoid.length ? new RegExp(`\\b(${avoid.map(escape).join('|')})\\b`, 'i') : null;
  return (tags) => groups.every((re) => re.test(tags)) && !(off && off.test(tags));
};

// ── Banks ──
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, headers = {}) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(30000) }).catch(() => null);
    if (!r || r.status === 429 || r.status >= 500) {
      await sleep(15000 * (i + 1));
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} ${url.replace(/key=[^&]+/, 'key=…')}`);
    return r.json();
  }
  throw new Error('bank unavailable');
}

/** One shape for every bank: { id, tags, thumb, full, cdn?, page, by, license } */
const BANKS = [
  KEYS.unsplash && (async (q) => {
    const j = await getJson(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=30&orientation=landscape&content_filter=high`, { authorization: `Client-ID ${KEYS.unsplash}`, 'accept-version': 'v1' });
    return (j.results ?? []).filter((p) => p.width >= 2400 && !p.premium && !p.plus).map((p) => ({ id: `unsplash-${p.id}`, tags: `${p.alt_description ?? ''} ${p.description ?? ''} ${(p.tags ?? []).map((t) => t.title).join(' ')}`, thumb: `${p.urls.raw}&w=320&q=60`, cdn: `${p.urls.raw}&auto=format&fit=crop&q=80&w={w}`, page: p.links.html, by: p.user?.name, license: 'Unsplash licence' }));
  }),
  KEYS.pexels && (async (q) => {
    const j = await getJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=40&orientation=landscape`, { Authorization: KEYS.pexels });
    return (j.photos ?? []).filter((p) => p.width >= 2400).map((p) => ({ id: `pexels-${p.id}`, tags: `${p.alt ?? ''} ${decodeURIComponent(p.url ?? '').replace(/[-/]/g, ' ')}`, thumb: `${p.src.original}?auto=compress&w=320`, cdn: `${p.src.original}?auto=compress&cs=tinysrgb&fit=crop&w={w}`, page: p.url, by: p.photographer, license: 'Pexels licence' }));
  }),
  KEYS.pixabay && (async (q) => {
    const j = await getJson(`https://pixabay.com/api/?key=${KEYS.pixabay}&q=${encodeURIComponent(q)}&image_type=photo&orientation=horizontal&min_width=2400&safesearch=true&per_page=60`);
    return (j.hits ?? []).map((h) => ({ id: `pixabay-${h.id}`, tags: `${h.tags} ${h.pageURL.replace(/[-/]/g, ' ')}`, thumb: h.webformatURL, full: h.largeImageURL, page: h.pageURL, by: h.user, license: 'Pixabay licence' }));
  }),
  async (q) => {
    const j = await getJson(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&aspect_ratio=wide&mature=false&page_size=50`, { 'user-agent': 'IRLY photo picker (github actions)' });
    return (j.results ?? []).filter((p) => (p.width ?? 0) >= 2400).map((p) => ({ id: `openverse-${p.id}`, tags: [p.title ?? '', ...(p.tags ?? []).map((t) => t.name)].join(', '), thumb: p.thumbnail, full: p.url, page: p.foreign_landing_url ?? p.url, by: p.creator ?? 'unknown', license: `${p.license} ${p.license_version ?? ''}`.trim() }));
  },
].filter(Boolean);

// ── Never the same picture twice ──
const TMP = '/tmp/variants';
fs.mkdirSync(TMP, { recursive: true });
async function download(url, to) {
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error(`${r.status} download`);
  fs.writeFileSync(to, Buffer.from(await r.arrayBuffer()));
}
/** 64-bit difference hash: the same photo on two banks (or re-cropped) hashes within a few bits. */
function dhash(file) {
  const raw = execFileSync('convert', [`${file}[0]`, '-colorspace', 'gray', '-resize', '9x8!', '-depth', '8', 'gray:-']);
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += raw[y * 9 + x] > raw[y * 9 + x + 1] ? '1' : '0';
  return bits;
}
const near = (a, b) => [...a].filter((c, i) => c !== b[i]).length <= 8;
const usedIds = new Set();
const usedHashes = [];
for (const list of Object.values(picks.photos)) for (const p of list) {
  usedIds.add(p.id);
  if (p.hash) usedHashes.push(p.hash);
}
// The photo each key already shows stays its first picture: hash it so no
// variant repeats it, here or under another key.
const idOf = Object.fromEntries([...photosTs.slice(photosTs.indexOf('const ids = {'), photosTs.indexOf('};', photosTs.indexOf('const ids = {'))).matchAll(/^\s+(\w+): '([\w-]+)'/gm)].map((m) => [m[1], m[2]]));
const dubaiKeys = new Set(JSON.parse(fs.readFileSync('src/data/dubaiKeys.ts', 'utf8').match(/= (\[.*\])/)[1]));
const primaryUrl = (key) =>
  libKeys.includes(key) || dubaiKeys.has(key) ? `https://alafrench7593-a11y.github.io/irly/photos/${key}-480.jpg` : `https://images.unsplash.com/photo-${idOf[key]}?auto=format&fit=crop&w=320&q=60`;
for (const key of allKeys) {
  try {
    const f = `${TMP}/primary-${key}.jpg`;
    await download(primaryUrl(key), f);
    usedHashes.push(dhash(f));
  } catch (e) {
    console.log(`  primary ${key}: ${e.message}`);
  }
}

// ── Photos ──
fs.mkdirSync('public-photos/v', { recursive: true });
fs.mkdirSync('public-photos/_variants', { recursive: true });
const LIB = 'https://alafrench7593-a11y.github.io/irly/photos/v';
let added = 0;
for (const key of allKeys) {
  const list = (picks.photos[key] ??= []);
  // The key's current photo is the first picture; variants come after it.
  const need = wanted(key) - 1;
  if (list.length >= need) continue;
  const { q, words, avoid } = queryFor(key);
  const fits = subjectTest(words, avoid);
  for (const bank of BANKS) {
    if (list.length >= need) break;
    let found = [];
    try {
      found = await bank(q);
    } catch (e) {
      console.log(`  ${key}: ${e.message}`);
      continue;
    }
    for (const c of found) {
      if (list.length >= need) break;
      if (usedIds.has(c.id) || exclude.has(c.id) || !fits(c.tags)) continue;
      const thumb = `${TMP}/${c.id}.jpg`;
      try {
        await download(c.thumb, thumb);
        const hash = dhash(thumb);
        usedIds.add(c.id);
        if (usedHashes.some((h) => near(h, hash))) continue;
        // The first file number this key does not use yet (never one taken, even after a pick was removed).
        const taken = new Set(list.map((p) => p.url.match(/-(\d+)-\{w\}\.jpg$/)?.[1]).filter(Boolean).map(Number));
        let n = 1;
        while (taken.has(n)) n++;
        let url = c.cdn;
        if (!url) {
          const full = `${TMP}/${c.id}-full`;
          await download(c.full, full);
          for (const w of [800, 1600, 2400]) {
            execFileSync('convert', [`${full}[0]`, '-auto-orient', '-resize', `${w}x${Math.round(w * 0.625)}^`, '-gravity', 'center', '-extent', `${w}x${Math.round(w * 0.625)}`, '-strip', '-interlace', 'JPEG', '-quality', '82', `public-photos/v/${key}-${n}-${w}.jpg`]);
          }
          fs.rmSync(full, { force: true });
          url = `${LIB}/${key}-${n}-{w}.jpg`;
        }
        usedHashes.push(hash);
        list.push({ id: c.id, hash, url, page: c.page, by: c.by, license: c.license, thumb });
        added++;
      } catch (e) {
        console.log(`  ${key} ${c.id}: ${e.message}`);
      }
    }
    await sleep(400);
  }
  console.log(`${key}: ${list.length}/${need}`);
  // Contact sheet of the key's variants, to check by eye.
  const thumbs = list.map((p) => p.thumb).filter((t) => t && fs.existsSync(t));
  if (thumbs.length) execFileSync('montage', [...thumbs, '-geometry', '240x150+4+4', '-tile', '6x', `public-photos/_variants/${key}.jpg`]);
}

// ── Films: one clip per film key, never the same clip twice ──
const usedFilms = new Set(Object.values(picks.films).map((f) => f.id));
async function searchVideos(q) {
  const out = [];
  if (KEYS.pexels) {
    const j = await getJson(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=30&orientation=landscape`, { Authorization: KEYS.pexels }).catch(() => ({}));
    for (const v of j.videos ?? []) {
      const f = [...v.video_files].filter((x) => x.file_type === 'video/mp4' && x.width >= 1920).sort((a, b) => a.width - b.width)[0];
      if (f) out.push({ id: `pexels-${v.id}`, file: f.link, page: v.url, by: v.user?.name, duration: v.duration });
    }
  }
  if (KEYS.pixabay) {
    const j = await getJson(`https://pixabay.com/api/videos/?key=${KEYS.pixabay}&q=${encodeURIComponent(q)}&safesearch=true&per_page=40`).catch(() => ({}));
    for (const h of j.hits ?? []) {
      const f = h.videos.large?.width >= 1920 ? h.videos.large : null;
      if (f) out.push({ id: `pixabay-${h.id}`, file: f.url, page: h.pageURL, by: h.user, duration: h.duration });
    }
  }
  return out.filter((v) => v.duration >= 6 && v.duration <= 40);
}
fs.mkdirSync('site/video', { recursive: true });
for (const key of filmKeys) {
  if (picks.films[key]) continue;
  const { q } = queryFor(key);
  for (const v of await searchVideos(q)) {
    if (usedFilms.has(v.id) || exclude.has(v.id)) continue;
    try {
      const raw = `${TMP}/${key}.mp4`;
      await download(v.file, raw);
      // 1080p, silent, at most 15 s, small enough for a phone.
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-t', '15', '-an', '-vf', 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `site/video/k-${key}.mp4`]);
      fs.rmSync(raw, { force: true });
      usedFilms.add(v.id);
      picks.films[key] = { id: v.id, page: v.page, by: v.by };
      console.log(`film ${key}: ${v.id}`);
      break;
    } catch (e) {
      console.log(`  film ${key} ${v.id}: ${e.message}`);
    }
  }
}

// ── Write ──
for (const list of Object.values(picks.photos)) for (const p of list) delete p.thumb;
fs.writeFileSync(picksFile, `${JSON.stringify(picks, null, 1)}\n`);
const variants = Object.fromEntries(Object.entries(picks.photos).filter(([, l]) => l.length).map(([k, l]) => [k, [...new Set(dedupe(l).map((p) => p.url))]]));
const films = Object.keys(picks.films);
fs.writeFileSync(
  'src/data/photoVariants.ts',
  `// Generated by .github/scripts/media-variants.mjs. Do not edit by hand.\n// key → HD photos of that subject ({w} = width in px); no photo appears twice.\nexport const VARIANTS: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(variants, null, 1)};\n// Photo keys with a film of their own (site/video/k-<key>.mp4).\nexport const KEY_FILMS: readonly string[] = ${JSON.stringify(films)};\n`,
);
const md = ['# Photo and film sources', '', 'Free for commercial use (Unsplash, Pexels, Pixabay licences; public domain / CC0 from Openverse). Listed for credit.', ''];
for (const [k, l] of Object.entries(picks.photos)) for (const p of l) md.push(`- ${k}: [${p.id}](${p.page}) · ${p.by ?? ''} · ${p.license}`);
for (const [k, f] of Object.entries(picks.films)) md.push(`- film ${k}: [${f.id}](${f.page}) · ${f.by ?? ''}`);
fs.writeFileSync('public-photos/VARIANTS.md', `${md.join('\n')}\n`);
console.log(`\n${added} new photos · ${Object.values(variants).flat().length} in all · ${films.length} films`);
