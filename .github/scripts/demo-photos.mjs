// Every Unsplash photo the app references, at 1600 px, for the investor demo captures
// (the capture sandbox cannot reach Unsplash). Writes demo-photos/<id>.jpg.
import fs from 'node:fs';

const src = fs.readFileSync('src/data/photos.ts', 'utf8');
const ids = [...new Set([...src.matchAll(/'(\d{10,13}-[0-9a-f]{6,14})'/g)].map((m) => m[1]))];
fs.mkdirSync('demo-photos', { recursive: true });
let ok = 0;
for (const id of ids) {
  const r = await fetch(`https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=82&fm=jpg`);
  if (r.ok) { fs.writeFileSync(`demo-photos/${id}.jpg`, Buffer.from(await r.arrayBuffer())); ok++; }
  else console.log('miss', id, r.status);
}
console.log(`${ok}/${ids.length} photos`);
