/**
 * Downloads the chosen public-domain photos (photo-picks.json), crops them
 * to the app's 16:10 cards in two sizes and writes public-photos/, which the
 * web build serves at /irly/photos/. CREDITS.md lists every source.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const picks = JSON.parse(fs.readFileSync('.github/scripts/photo-picks.json', 'utf8'));
fs.mkdirSync('public-photos', { recursive: true });
const credits = ['# Photo sources', '', 'Public domain or CC0 (no attribution required). Listed for reference.', ''];
let ok = 0;
for (const [key, p] of Object.entries(picks)) {
  try {
    const r = await fetch(p.url, { headers: { 'user-agent': 'IRLY photo fetch (github actions)' }, redirect: 'follow' });
    if (!r.ok) throw new Error(String(r.status));
    const src = `/tmp/${key}.orig`;
    fs.writeFileSync(src, Buffer.from(await r.arrayBuffer()));
    for (const [w, h] of [[1200, 750], [480, 300]]) {
      execFileSync('convert', [`${src}[0]`, '-auto-orient', '-resize', `${w}x${h}^`, '-gravity', 'center', '-extent', `${w}x${h}`, '-strip', '-quality', '74', `public-photos/${key}-${w}.jpg`]);
    }
    credits.push(`- **${key}**: ${p.alt || ''} (${p.license}) ${p.landing || p.url}`);
    ok += 1;
  } catch (e) {
    console.log(key, 'failed', e.message);
  }
}
fs.writeFileSync('public-photos/CREDITS.md', credits.join('\n') + '\n');
console.log('fetched', ok, 'of', Object.keys(picks).length);
