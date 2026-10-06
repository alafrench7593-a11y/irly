// Renders 240 sub-frames per second (4 per 60 fps frame) with Playwright, in
// parallel workers, then blends them with ffmpeg tmix into a 60 fps MP4.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const pw = await import('/opt/node-tools/node_modules/playwright/index.mjs');
const dir = path.dirname(new URL(import.meta.url).pathname);
const FR = process.env.FRAMES || '/tmp/claude-0/film-frames';
const SUB = 4, FPS = 60, DUR = 27;
const N = DUR * FPS * SUB;
const workers = +(process.env.WORKERS || 3);
fs.mkdirSync(FR, { recursive: true });
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let done = 0;
const t0 = Date.now();
await Promise.all([...Array(workers)].map(async (_, w) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1440 } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto('file://' + path.join(dir, 'irly-film.html') + '#render');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  for (let i = w; i < N; i += workers) {
    const f = path.join(FR, `f${String(i).padStart(5, '0')}.jpg`);
    if (fs.existsSync(f)) { done++; continue; }
    // sub-frame i sits inside 60 fps frame floor(i/4): centred sub-samples
    const t = i / (FPS * SUB);
    await page.evaluate((tt) => window.seek(tt), Math.max(0, t));
    await page.locator('#stage').screenshot({ path: f + '.tmp.jpg', type: 'jpeg', quality: 94 });
    fs.renameSync(f + '.tmp.jpg', f);
    done++;
    if (done % 240 === 0) console.log(`${done}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}));
await browser.close();
console.log('frames done', ((Date.now() - t0) / 1000).toFixed(0), 's');
execSync(`ffmpeg -y -loglevel error -framerate ${FPS * SUB} -i ${FR}/f%05d.jpg -vf "tmix=frames=${SUB},framestep=${SUB},format=yuv420p" -r ${FPS} -c:v libx264 -preset slow -crf 16 -movflags +faststart ${path.join(dir, 'irly-film-silent.mp4')}`, { stdio: 'inherit' });
console.log('wrote irly-film-silent.mp4');
