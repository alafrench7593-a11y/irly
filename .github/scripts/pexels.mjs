/**
 * Dubai photos and videos from Pexels (free to use, Pexels licence), for the
 * app's photo library and the website. Runs in GitHub Actions with the
 * PEXELS_API_KEY secret.
 *
 * Photos: for every key of pexels-queries.json, search "Dubai …" and keep a
 * photo whose description or page names the place (Dubai, or the emirate of
 * the key) and the subject. Without such a photo the key keeps the photo it
 * has. Choices are frozen in pexels-picks.json; ids listed in
 * pexels-exclude.json (after looking at the contact sheets) are never used.
 *
 * Writes public-photos/<key>-1200.jpg and -480.jpg (16:10), site/img/<key>.webp
 * for the keys the website uses, src/data/pexelsKeys.ts (keys now in the
 * library), public-photos/PEXELS.md (credits), contact sheets in
 * public-photos/_pexels-*.png, and the videos of pexels-videos.json into
 * site/video/.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const KEY = process.env.PEXELS_API_KEY;
if (!KEY) {
  console.error('PEXELS_API_KEY is missing: add it in Settings → Secrets and variables → Actions.');
  process.exit(1);
}

const dir = '.github/scripts';
const queries = JSON.parse(fs.readFileSync(`${dir}/pexels-queries.json`, 'utf8'));
delete queries._note;
const read = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
const picks = read(`${dir}/pexels-picks.json`, {});
const exclude = read(`${dir}/pexels-exclude.json`, {});
const videos = read(`${dir}/pexels-videos.json`, {});
delete exclude._note;
delete videos._note;

const PLACES = {
  dubai: /dubai|jumeirah|burj|deira|bur dubai|al quoz|downtown dubai|palm jumeirah|al barsha|business bay|difc/i,
  'abu dhabi': /abu dhabi|abudhabi|sheikh zayed/i,
  sharjah: /sharjah/i,
  ajman: /ajman/i,
  'ras al khaimah': /ras al khaimah|ras al-khaimah|jebel jais/i,
  fujairah: /fujairah/i,
  uae: /dubai|abu dhabi|abudhabi|\buae\b|emirates|sharjah|ajman|fujairah|ras al khaimah|umm al quwain|hatta|jebel jais/i,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(url) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { Authorization: KEY } });
    if (r.status === 429) {
      await sleep(20000 * (i + 1));
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }
  throw new Error(`rate limited ${url}`);
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
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  fs.writeFileSync(to, Buffer.from(await r.arrayBuffer()));
}

const used = new Set(Object.values(picks).map((p) => p.id));
const report = { kept: [], picked: [], none: [] };

for (const [key, [query, words, place = 'dubai']] of Object.entries(queries)) {
  const banned = new Set(exclude[key] ?? []);
  const old = picks[key];
  if (old && !banned.has(old.id) && fs.existsSync(`public-photos/${key}-1200.jpg`)) {
    report.kept.push(key);
    continue;
  }
  if (old) used.delete(old.id);
  delete picks[key];
  const res = await api(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=40&orientation=landscape`);
  const placeRe = PLACES[place] ?? PLACES.dubai;
  const subjectRe = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
  const scored = (res.photos ?? [])
    .filter((p) => !banned.has(p.id) && !used.has(p.id) && p.width >= 1200)
    .map((p) => {
      const text = `${p.alt ?? ''} ${decodeURIComponent(p.url ?? '').replace(/[-/]/g, ' ')}`;
      return { p, place: placeRe.test(text), subject: subjectRe.test(text) };
    })
    .filter((c) => c.place && c.subject);
  const best = scored[0];
  if (!best) {
    report.none.push(key);
    continue;
  }
  const p = best.p;
  const tmp = `/tmp/pexels-${key}.jpg`;
  await download(p.src.large2x ?? p.src.original, tmp);
  save(key, tmp);
  picks[key] = { id: p.id, alt: p.alt, url: p.url, photographer: p.photographer, photographerUrl: p.photographer_url };
  used.add(p.id);
  report.picked.push(key);
  await sleep(400);
}

// Videos for the website: the first Dubai video of each search, 720p, muted, short.
fs.mkdirSync('site/video', { recursive: true });
for (const [name, query] of Object.entries(videos)) {
  if (fs.existsSync(`site/video/${name}.mp4`) && picks[`video:${name}`] && !(exclude[`video:${name}`] ?? []).includes(picks[`video:${name}`].id)) continue;
  const banned = new Set(exclude[`video:${name}`] ?? []);
  const res = await api(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=30&orientation=landscape`);
  const v = (res.videos ?? []).find((x) => !banned.has(x.id) && /dubai/i.test(decodeURIComponent(x.url ?? '')) && x.duration >= 6);
  if (!v) {
    report.none.push(`video:${name}`);
    continue;
  }
  const file = [...v.video_files].filter((f) => f.file_type === 'video/mp4' && f.width >= 1280).sort((a, b) => a.width - b.width)[0] ?? v.video_files[0];
  const tmp = `/tmp/pexels-video-${name}.mp4`;
  await download(file.link, tmp);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-t', '12', '-an', '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `site/video/${name}.mp4`]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', `site/video/${name}.mp4`, '-frames:v', '1', '-q:v', '5', `site/video/${name}.jpg`]);
  picks[`video:${name}`] = { id: v.id, url: v.url, photographer: v.user?.name, photographerUrl: v.user?.url };
  report.picked.push(`video:${name}`);
}

fs.writeFileSync(`${dir}/pexels-picks.json`, JSON.stringify(picks, null, 1) + '\n');

const keys = Object.keys(picks).filter((k) => !k.startsWith('video:')).sort();
fs.writeFileSync(
  'src/data/pexelsKeys.ts',
  `// Generated by .github/scripts/pexels.mjs: photo keys whose picture is a Dubai photo from Pexels\n// (served from the photo library). Do not edit by hand.\nexport const PEXELS_KEYS: readonly string[] = ${JSON.stringify(keys)};\n`,
);

const credits = ['# Dubai photos and videos from Pexels', '', 'Free to use under the Pexels licence (https://www.pexels.com/license/). Credited with thanks.', ''];
for (const [k, p] of Object.entries(picks).sort()) credits.push(`- **${k}**: ${p.alt ? `${p.alt}, ` : ''}by [${p.photographer}](${p.photographerUrl}) on Pexels, ${p.url}`);
fs.writeFileSync('public-photos/PEXELS.md', credits.join('\n') + '\n');

// Contact sheets to check every choice by eye.
for (let i = 0; i < keys.length; i += 30) {
  const batch = keys.slice(i, i + 30).filter((k) => fs.existsSync(`public-photos/${k}-480.jpg`));
  if (!batch.length) continue;
  const args = [];
  for (const k of batch) args.push('-label', `${k} · ${picks[k].id}`, `public-photos/${k}-480.jpg`);
  execFileSync('montage', [...args, '-tile', '5x', '-geometry', '320x200+6+6', '-pointsize', '16', '-background', '#111', '-fill', '#fff', `public-photos/_pexels-${i / 30 + 1}.png`]);
}

console.log(`picked ${report.picked.length}: ${report.picked.join(' ')}`);
console.log(`kept ${report.kept.length}`);
console.log(`no Dubai photo found (keep their current photo) ${report.none.length}: ${report.none.join(' ')}`);
