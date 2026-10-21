// Every photo, film and image the app and the website point at exists in the
// repository (the website serves site/, the photo library serves public-photos/):
// IRLY's own photos in both sizes (and their HD original where declared, never
// enlarged), the library keys, the HD variants, the films, every key the app
// names in a `photo: '…'` / `photo="…"` / `{ photo: '…' }`, and every image the
// home page and the IRLY Girl page load.
// Run: node scripts/check-photo-files.mjs   (--sizes lists IRLY's own photos with their pixels)
import fs from 'node:fs';
import path from 'node:path';

let failed = 0;
const fail = (msg) => {
  failed++;
  console.error(`✗ ${msg}`);
};
const ok = (msg) => console.log(`✓ ${msg}`);
const exists = (f) => fs.existsSync(f) && fs.statSync(f).size > 0;

const photos = fs.readFileSync('src/data/photos.ts', 'utf8');
const listOf = (name) => {
  const start = photos.indexOf(`export const ${name} = [`);
  return [...photos.slice(start, photos.indexOf(']', start)).matchAll(/'(\w+)'/g)].map((m) => m[1]);
};
const setOf = (name) => {
  const start = photos.indexOf(`const ${name} = new Set<string>([`);
  return [...photos.slice(start, photos.indexOf('])', start)).matchAll(/'(\w+)'/g)].map((m) => m[1]);
};
const idsBlock = photos.slice(photos.indexOf('const ids = {'), photos.indexOf('};', photos.indexOf('const ids = {')));
const IDS = [...idsBlock.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
const OWN = listOf('OWN');
const OWN_HD = setOf('OWN_HD');
const LIBRARY = listOf('LIBRARY');
const DUBAI = [...fs.readFileSync('src/data/dubaiKeys.ts', 'utf8').matchAll(/"(\w+)"/g)].map((m) => m[1]);
const KNOWN = new Set([...IDS, ...OWN, ...LIBRARY, ...DUBAI]);

// JPEG / WebP pixel size, read from the file header.
function size(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8L') {
      const v = b.readUInt32LE(21);
      return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)];
    }
  }
  return null;
}

// 1. IRLY's own photos: both sizes, and the HD original where declared (larger than the -1200 file, at least 1080 px wide).
expect(OWN.length > 40, `IRLY's own photos listed (${OWN.length})`);
const sizes = [];
for (const k of OWN) {
  for (const v of ['480', '1200']) if (!exists(`site/img/own/${k}-${v}.jpg`)) fail(`site/img/own/${k}-${v}.jpg is missing`);
  const big = exists(`site/img/own/${k}-1200.jpg`) ? size(`site/img/own/${k}-1200.jpg`) : null;
  let best = big;
  if (OWN_HD.includes(k)) {
    const f = `site/img/own/${k}-hd.jpg`;
    if (!exists(f)) fail(`${f} is missing (the key is in OWN_HD)`);
    else {
      const hd = size(f);
      if (!hd || Math.max(...hd) < 1080) fail(`${f} is not HD (${hd?.join('×')})`);
      if (big && hd && hd[0] * hd[1] <= big[0] * big[1]) fail(`${f} is not larger than the -1200 file`);
      best = hd;
    }
  }
  if (best) sizes.push([k, best]);
}
ok(`${OWN.length} own photos have their -480 and -1200 files; ${OWN_HD.length} have an HD original`);
if (process.argv.includes('--sizes')) {
  for (const [k, [w, h]] of sizes.sort((a, b) => Math.min(...a[1]) - Math.min(...b[1])))
    console.log(`  ${k.padEnd(18)} ${w}×${h}${Math.min(w, h) < 1080 ? '  (below HD: a larger original is needed for full-screen use)' : ''}`);
}

// 2. Library and Dubai keys: both sizes in public-photos.
for (const k of new Set([...LIBRARY, ...DUBAI])) for (const v of ['480', '1200']) if (!exists(`public-photos/${k}-${v}.jpg`)) fail(`public-photos/${k}-${v}.jpg is missing`);
ok(`${new Set([...LIBRARY, ...DUBAI]).size} library keys have both sizes`);

// 3. HD variants (public-photos/v) in the three widths served.
const variants = fs.readFileSync('src/data/photoVariants.ts', 'utf8');
const vfiles = [...variants.matchAll(/\/irly\/photos\/(v\/[\w-]+)-\{w\}\.jpg/g)].map((m) => m[1]);
for (const v of vfiles) for (const w of [800, 1600, 2400]) if (!exists(`public-photos/${v}-${w}.jpg`)) fail(`public-photos/${v}-${w}.jpg is missing`);
ok(`${vfiles.length} HD variants exist at 800, 1600 and 2400 px`);

// 4. Films: each key's own clip and the shared ones.
const films = [...variants.slice(variants.indexOf('KEY_FILMS')).matchAll(/"(\w+)"/g)].map((m) => m[1]);
for (const k of films) if (!exists(`site/video/k-${k}.mp4`)) fail(`site/video/k-${k}.mp4 is missing`);
const shared = [...photos.slice(photos.indexOf('const FILMS'), photos.indexOf('};', photos.indexOf('const FILMS'))).matchAll(/: '(\w+)'/g)].map((m) => m[1]);
for (const f of new Set(shared)) if (!exists(`site/video/${f}.mp4`)) fail(`site/video/${f}.mp4 is missing`);
ok(`${films.length} key films and ${new Set(shared).size} shared films exist`);

// 5. Every key the app names exists in the registry.
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(tsx?)$/.test(e.name) ? [path.join(dir, e.name)] : []));
let named = 0;
for (const f of walk('src')) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bphoto:\s*'(\w+)'|photo="(\w+)"|visual=\{\{\s*photo:\s*'(\w+)'/g)) {
    const k = m[1] ?? m[2] ?? m[3];
    named++;
    if (!KNOWN.has(k)) fail(`${f}: photo key '${k}' is not in the registry`);
  }
}
ok(`${named} photo keys named in the app all exist`);

// 6. The website: every image, film and screen the home page and the IRLY Girl page load.
const refs = (html, base) =>
  [...html.matchAll(/(?:src|href|poster|srcset|imagesrcset|data-p|data-set)="([^"]+)"/g)]
    .flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+/)[0]))
    .filter((u) => /^\/?(img|shots|video|faces)\//.test(u) && !u.includes('${'))
    // site-build.mjs copies public-photos/faces into the site.
    .map((u) => (/^\/?faces\//.test(u) ? path.join('public-photos', u.replace(/^\//, '')) : path.join(base, u.replace(/^\//, ''))));
const home = fs.readFileSync('site/index.html', 'utf8');
const girl = fs.readFileSync('.github/scripts/site-girl.mjs', 'utf8');
const siteRefs = [...new Set([...refs(home, 'site'), ...refs(girl, 'site'), ...[...girl.matchAll(/"(\/(?:img|shots)\/[\w./-]+\.(?:jpg|webp|png))"/g)].map((m) => path.join('site', m[1]))])];
for (const f of siteRefs) if (!exists(f)) fail(`website: ${f} is missing`);
// The IRLY Girl page names IRLY's own photos by key (own("brunchGirl", …)).
const girlOwn = [...new Set([...girl.matchAll(/\bown\("(\w+)"/g), ...girl.matchAll(/\["(\w+(?:Girl|Mix|Mom)|dinnerView|palmAerial|globalVillage|safariPark|dogWalk|kiteBeach|nightDinner|dubaiPink)",/g)].map((m) => m[1]))];
for (const k of girlOwn) if (!exists(`site/img/own/${k}-1200.jpg`)) fail(`IRLY Girl page: site/img/own/${k}-1200.jpg is missing`);
// The hero slides on both pages.
for (const k of [...girl.matchAll(/const HERO = \[([^\]]+)\]/g)].flatMap((m) => [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1])))
  for (const v of ['960', '1920', 'p']) if (!exists(`site/img/hero/${k}-${v}.webp`)) fail(`IRLY Girl hero: site/img/hero/${k}-${v}.webp is missing`);
ok(`${siteRefs.length} website images and films exist (home and IRLY Girl), ${girlOwn.length} own photos on the IRLY Girl page`);

function expect(cond, msg) {
  if (cond) ok(msg);
  else fail(msg);
}

if (failed) {
  console.error(`\n${failed} missing or broken photo file(s)`);
  process.exit(1);
}
console.log('\nEvery photo file the app and the website use is there.');
