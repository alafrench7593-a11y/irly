// node stills.mjs 0 1 2.5 ... → contact sheet of those beats (scratch/stills.jpg)
import { execSync } from 'node:child_process';
import path from 'node:path';
const pw = await import('/opt/node-tools/node_modules/playwright/index.mjs');
const dir = path.dirname(new URL(import.meta.url).pathname);
const out = process.env.OUT || '/tmp/claude-0/stills';
execSync(`rm -rf ${out} && mkdir -p ${out}`);
const beats = process.argv.slice(2).map(Number);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
const page = await b.newPage({ viewport: { width: 1440, height: 1500 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto('file://' + path.join(dir, 'irly-film.html') + '#render');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }).catch(() => {});
const files = [];
for (const beat of beats) {
  const t0 = Date.now();
  await page.evaluate((t) => window.seek(t), beat / 2);
  const f = `${out}/b${String(beat).padStart(5, '0')}.png`;
  await page.locator('#stage').screenshot({ path: f });
  files.push(f);
  process.stdout.write(`${beat}:${Date.now() - t0}ms `);
}
await b.close();
console.log('\n' + (errs.length ? errs.slice(0, 5).join('\n') : 'no errors'));
const sheet = process.env.SHEET || '/tmp/claude-0/-home-user/5c04fee2-2e49-58c7-9354-03ab6134443f/scratchpad/stills.jpg';
execSync(`montage ${files.map((f) => `-label "b${path.basename(f).slice(1, -4).replace(/^0+(?=\\d)/, '')}" ${f}`).join(' ')} -tile ${Math.min(4, files.length)}x -geometry 360x360+6+16 -pointsize 22 ${sheet}`);
console.log(sheet);
