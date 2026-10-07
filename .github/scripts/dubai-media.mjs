/**
 * Dubai photos and videos for the app's photo library and the website, from
 * Pixabay (PIXABAY_API_KEY) or Pexels (PEXELS_API_KEY). Both licences allow
 * free commercial use without attribution; sources are listed anyway in
 * public-photos/DUBAI.md. Files are downloaded and served by IRLY, never
 * hot-linked.
 *
 * Photos: for every key of dubai-queries.json, search "Dubai …" and keep a
 * photo whose tags, description or page name both the place (Dubai, or the
 * emirate of the key) and the subject. Without such a photo the key keeps
 * the photo it has. Choices are frozen in dubai-picks.json; ids listed in
 * dubai-exclude.json (after looking at the contact sheets) are never used.
 *
 * Writes public-photos/<key>-1200.jpg and -480.jpg (16:10), site/img/<key>.webp
 * for the keys the website uses, src/data/dubaiKeys.ts (keys now in the
 * library), public-photos/DUBAI.md (sources), contact sheets
 * public-photos/_dubai-*.png, and the videos of dubai-videos.json into
 * site/video/.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const PIXABAY = process.env.PIXABAY_API_KEY;
const PEXELS = process.env.PEXELS_API_KEY;
if (!PIXABAY && !PEXELS) {
  console.error('Add PIXABAY_API_KEY (or PEXELS_API_KEY) in Settings → Secrets and variables → Actions.');
  process.exit(1);
}
const provider = PIXABAY ? 'pixabay' : 'pexels';

const dir = '.github/scripts';
const read = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
const queries = read(`${dir}/dubai-queries.json`, {});
const picks = read(`${dir}/dubai-picks.json`, {});
const exclude = read(`${dir}/dubai-exclude.json`, {});
const videos = read(`${dir}/dubai-videos.json`, {});
for (const o of [queries, exclude, videos]) delete o._note;

const PLACES = {
  dubai: /dubai|jumeirah|burj|deira|bur dubai|al quoz|palm jumeirah|al barsha|business bay|difc|marina/i,
  'abu dhabi': /abu dhabi|abudhabi|sheikh zayed|louvre abu/i,
  sharjah: /sharjah/i,
  ajman: /ajman/i,
  'ras al khaimah': /ras al khaimah|ras al-khaimah|jebel jais/i,
  fujairah: /fujairah/i,
  uae: /dubai|abu dhabi|abudhabi|\buae\b|emirates|sharjah|ajman|fujairah|ras al khaimah|umm al quwain|hatta|jebel jais/i,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, headers = {}) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers });
    if (r.status === 429) {
      await sleep(20000 * (i + 1));
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} ${url.replace(/key=[^&]+/, 'key=…')}`);
    return r.json();
  }
  throw new Error('rate limited');
}

/** One shape for both providers: { id, tags (what the photo shows), text (tags + page address), page, img, by, byUrl } */
async function searchPhotos(q) {
  if (provider === 'pixabay') {
    const j = await getJson(`https://pixabay.com/api/?key=${PIXABAY}&q=${encodeURIComponent(q)}&image_type=photo&orientation=horizontal&min_width=1200&safesearch=true&per_page=60`);
    return (j.hits ?? []).map((h) => ({ id: `pixabay-${h.id}`, tags: h.tags, text: `${h.tags} ${h.pageURL.replace(/[-/]/g, ' ')}`, page: h.pageURL, img: h.largeImageURL, by: h.user, byUrl: `https://pixabay.com/users/${h.user}-${h.user_id}/` }));
  }
  const j = await getJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=40&orientation=landscape`, { Authorization: PEXELS });
  return (j.photos ?? []).filter((p) => p.width >= 1200).map((p) => ({ id: `pexels-${p.id}`, tags: p.alt ?? '', text: `${p.alt ?? ''} ${decodeURIComponent(p.url ?? '').replace(/[-/]/g, ' ')}`, page: p.url, img: p.src.large2x ?? p.src.original, by: p.photographer, byUrl: p.photographer_url }));
}

/** { id, page, file, by, byUrl, duration } with a ~1280 px mp4. */
async function searchVideos(q) {
  if (provider === 'pixabay') {
    const j = await getJson(`https://pixabay.com/api/videos/?key=${PIXABAY}&q=${encodeURIComponent(q)}&safesearch=true&per_page=40`);
    return (j.hits ?? []).map((h) => ({ id: `pixabay-${h.id}`, text: `${h.tags} ${h.pageURL.replace(/[-/]/g, ' ')}`, page: h.pageURL, file: (h.videos.large?.width >= 1280 ? h.videos.large : h.videos.medium)?.url, by: h.user, byUrl: `https://pixabay.com/users/${h.user}-${h.user_id}/`, duration: h.duration }));
  }
  const j = await getJson(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=30&orientation=landscape`, { Authorization: PEXELS });
  return (j.videos ?? []).map((v) => {
    const f = [...v.video_files].filter((x) => x.file_type === 'video/mp4' && x.width >= 1280).sort((a, b) => a.width - b.width)[0] ?? v.video_files[0];
    return { id: `pexels-${v.id}`, text: decodeURIComponent(v.url ?? '').replace(/[-/]/g, ' '), page: v.url, file: f?.link, by: v.user?.name, byUrl: v.user?.url, duration: v.duration };
  });
}

const SITE_KEYS = new Set(fs.readdirSync('site/img').filter((f) => f.endsWith('.webp')).map((f) => f.replace('.webp', '')));
fs.mkdirSync('public-photos', { recursive: true });

function save(key, src) {
  for (const [w, h] of [[1200, 750], [480, 300]]) {
    execFileSync('convert', [`${src}[0]`, '-auto-orient', '-resize', `${w}x${h}^`, '-gravity', 'center', '-extent', `${w}x${h}`, '-strip', '-quality', '76', `public-photos/${key}-${w}.jpg`]);
  }
  if (SITE_KEYS.has(key)) {
    execFileSync('convert', [`${src}[0]`, '-auto-orient', '-resize', '960x600^', '-gravity', 'center', '-extent', '960x600', '-strip', '-quality', '72', `site/img/${key}.webp`]);
  }
}

async function download(url, to) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} download`);
  fs.writeFileSync(to, Buffer.from(await r.arrayBuffer()));
}

const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole words only ("pool" must not match "Liverpool"); a list of lists needs one word of each list. */
const subjectTest = (words) => {
  const groups = (Array.isArray(words[0]) ? words : [words]).map((g) => new RegExp(`\\b(${g.map(escape).join('|')})\\b`, 'i'));
  return (tags) => groups.every((re) => re.test(tags));
};
/** A Dubai photo must not be another emirate's. */
const OTHER_THAN_DUBAI = /abu dhabi|abudhabi|sharjah|ajman|fujairah|ras al khaimah|oman|qatar|doha|saudi/i;

// The photo a key had before Dubai photos: kept aside so it comes back if no
// Dubai photo fits the subject.
const ORIG = 'public-photos/_orig';
fs.mkdirSync(ORIG, { recursive: true });
const keepOriginal = (key) => {
  for (const f of [`public-photos/${key}-1200.jpg`, `public-photos/${key}-480.jpg`, `site/img/${key}.webp`]) {
    const to = `${ORIG}/${f.split('/').pop()}`;
    if (fs.existsSync(f) && !fs.existsSync(to)) fs.copyFileSync(f, to);
  }
};
const restoreOriginal = (key) => {
  for (const f of [`public-photos/${key}-1200.jpg`, `public-photos/${key}-480.jpg`, `site/img/${key}.webp`]) {
    const from = `${ORIG}/${f.split('/').pop()}`;
    if (fs.existsSync(from)) fs.copyFileSync(from, f);
    else if (f.startsWith('public-photos/') && fs.existsSync(f)) fs.rmSync(f); // had no photo of its own: back to the default one
  }
};
const used = new Set(Object.values(picks).map((p) => p.id));
// A photo rejected for one subject is not used for another either.
const rejected = new Set(Object.values(exclude).flat());
const report = { picked: [], kept: [], none: [] };

for (const [key, [query, words, place = 'dubai']] of Object.entries(queries)) {
  const banned = new Set([...(exclude[key] ?? []), ...rejected]);
  const old = picks[key];
  if (old && !banned.has(old.id) && fs.existsSync(`public-photos/${key}-1200.jpg`)) {
    report.kept.push(key);
    continue;
  }
  if (old) used.delete(old.id);
  delete picks[key];
  const placeRe = PLACES[place] ?? PLACES.dubai;
  const fits = subjectTest(words);
  let found;
  try {
    found = (await searchPhotos(query)).find(
      (c) => !banned.has(c.id) && !used.has(c.id) && placeRe.test(c.text) && fits(c.tags) && !(place === 'dubai' && OTHER_THAN_DUBAI.test(c.tags)),
    );
  } catch (e) {
    console.log(key, e.message);
  }
  if (!found) {
    if (old) restoreOriginal(key);
    report.none.push(key);
    continue;
  }
  if (!old) keepOriginal(key); // only the photo it had before any Dubai photo
  const tmp = `/tmp/dubai-${key}.jpg`;
  await download(found.img, tmp);
  save(key, tmp);
  picks[key] = { id: found.id, tags: found.tags.slice(0, 160), page: found.page, by: found.by, byUrl: found.byUrl };
  used.add(found.id);
  report.picked.push(key);
  await sleep(provider === 'pixabay' ? 700 : 400);
}

// Films (website and app): a clip of each search that names its place, cut to 12 s, 1280 px, silent.
fs.mkdirSync('site/video', { recursive: true });
for (const [name, spec] of Object.entries(videos)) {
  const [query, place = 'dubai'] = Array.isArray(spec) ? spec : [spec];
  const k = `video:${name}`;
  const banned = new Set(exclude[k] ?? []);
  if (picks[k] && !banned.has(picks[k].id) && fs.existsSync(`site/video/${name}.mp4`)) continue;
  const v = (await searchVideos(query)).find((x) => !banned.has(x.id) && x.file && (PLACES[place] ?? PLACES.dubai).test(x.text) && x.duration >= 6);
  if (!v) {
    report.none.push(k);
    continue;
  }
  const tmp = `/tmp/dubai-video-${name}.mp4`;
  await download(v.file, tmp);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-t', '12', '-an', '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `site/video/${name}.mp4`]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', `site/video/${name}.mp4`, '-frames:v', '1', '-q:v', '5', `site/video/${name}.jpg`]);
  picks[k] = { id: v.id, tags: v.text.slice(0, 160), page: v.page, by: v.by, byUrl: v.byUrl };
  report.picked.push(k);
}

fs.writeFileSync(`${dir}/dubai-picks.json`, JSON.stringify(picks, null, 1) + '\n');

const keys = Object.keys(picks).filter((k) => !k.startsWith('video:')).sort();
fs.writeFileSync(
  'src/data/dubaiKeys.ts',
  `// Generated by .github/scripts/dubai-media.mjs: photo keys whose picture is now a Dubai photo\n// (Pixabay or Pexels, served from the photo library). Do not edit by hand.\nexport const DUBAI_KEYS: readonly string[] = ${JSON.stringify(keys)};\n`,
);

const credits = ['# Dubai photos and videos', '', 'From Pixabay (https://pixabay.com/service/license-summary/) and Pexels (https://www.pexels.com/license/): free for commercial use, no attribution required. Credited with thanks.', ''];
for (const [k, p] of Object.entries(picks).sort()) credits.push(`- **${k}**: by [${p.by}](${p.byUrl}), ${p.page}`);
fs.writeFileSync('public-photos/DUBAI.md', credits.join('\n') + '\n');

// Contact sheets, to check every choice by eye.
for (const f of fs.readdirSync('public-photos').filter((f) => f.startsWith('_dubai-'))) fs.rmSync(`public-photos/${f}`);
for (let i = 0; i < keys.length; i += 30) {
  const args = [];
  for (const k of keys.slice(i, i + 30)) if (fs.existsSync(`public-photos/${k}-480.jpg`)) args.push('-label', `${k} ${picks[k].id}`, `public-photos/${k}-480.jpg`);
  if (args.length) execFileSync('montage', [...args, '-tile', '5x', '-geometry', '320x200+6+6', '-pointsize', '15', '-background', '#111', '-fill', '#fff', `public-photos/_dubai-${i / 30 + 1}.png`]);
}

console.log(`provider ${provider}`);
console.log(`picked ${report.picked.length}: ${report.picked.join(' ')}`);
console.log(`kept ${report.kept.length}`);
console.log(`no Dubai match (current photo kept) ${report.none.length}: ${report.none.join(' ')}`);
