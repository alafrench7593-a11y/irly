/**
 * Renders TikTok slideshows (1080×1920 JPEG) from a post spec:
 *   node marketing/tiktok/_tools/render.mjs marketing/tiktok/01_LA_SOLITUDE/01_personne_ne_te_previent
 * The folder holds post.json; slides are written to FR/01.jpg, EN/01.jpg, …
 * Text stays inside TikTok's safe zone (clear of the top tabs, the right
 * action column and the caption at the bottom).
 */
import fs from 'node:fs';
import path from 'node:path';
// PW: path to a playwright install when it is not in node_modules.
const { chromium } = await import(process.env.PW || 'playwright');

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '..');
const fonts = path.resolve(root, '../../node_modules/@expo-google-fonts/manrope');
const font = (w, n) => `@font-face{font-family:Manrope;font-weight:${w};src:url(file://${fonts}/${n}/Manrope_${n}.ttf)}`;
const css = `
${font(500, '500Medium')}${font(700, '700Bold')}${font(800, '800ExtraBold')}
*{margin:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;background:#0b0b0c;overflow:hidden}
.s{position:relative;width:1080px;height:1920px;font-family:Manrope;color:#fff}
.bg{position:absolute;inset:0;background-size:cover;background-position:var(--pos,center);filter:grayscale(var(--gray,.55)) contrast(1.06) brightness(var(--bright,.72)) saturate(.9)}
.warm .bg{filter:grayscale(.15) contrast(1.05) brightness(var(--bright,.74)) sepia(.12)}
.shade{position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 45%,rgba(0,0,0,0) 30%,rgba(0,0,0,.55) 100%),linear-gradient(180deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.55) 30%,rgba(0,0,0,.08) 52%,rgba(0,0,0,0) 62%,rgba(0,0,0,.6) 100%)}
.grain{position:absolute;inset:0;opacity:.16;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.txt{position:absolute;left:84px;right:190px;display:flex;flex-direction:column;gap:28px}
.top{top:300px}.mid{top:50%;transform:translateY(-55%)}.low{bottom:560px}
.t{font-weight:800;font-size:var(--size,74px);line-height:1.12;letter-spacing:-.5px;text-shadow:0 2px 24px rgba(0,0,0,.55)}
.t em{font-style:normal;color:#f2c48d}
.sub{font-weight:500;font-size:40px;line-height:1.35;color:rgba(255,255,255,.86);text-shadow:0 2px 16px rgba(0,0,0,.6)}
.plain .bg{display:none}.plain{background:#0b0b0c}
.mark{position:absolute;left:84px;bottom:470px;font-weight:800;font-size:30px;letter-spacing:6px;color:rgba(255,255,255,.7)}
`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');

const dir = path.resolve(process.argv[2]);
const post = JSON.parse(fs.readFileSync(path.join(dir, 'post.json'), 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
for (const lang of post.langs ?? ['fr']) {
const out = path.join(dir, lang.toUpperCase());
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const [i, slide] of post.slides.entries()) {
  const s = { ...slide, ...(slide[lang] ?? {}) };
  const img = s.img ? `file://${path.resolve(root, '_photos', s.img)}` : '';
  const vars = [s.pos && `--pos:${s.pos}`, s.size && `--size:${s.size}px`, s.bright && `--bright:${s.bright}`, s.gray != null && `--gray:${s.gray}`].filter(Boolean).join(';');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="s ${img ? '' : 'plain'} ${s.warm ? 'warm' : ''}" style="${vars}">
<div class="bg" style="background-image:url('${img}')"></div><div class="shade"></div><div class="grain"></div>
<div class="txt ${s.at || 'mid'}"><div class="t">${esc(s.text)}</div>${s.sub ? `<div class="sub">${esc(s.sub)}</div>` : ''}</div>
${s.mark ? `<div class="mark">IRLY</div>` : ''}
</div></body></html>`;
  const tmp = path.join(dir, '.slide.html');
  fs.writeFileSync(tmp, html);
  await page.goto(`file://${tmp}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, `${String(i + 1).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 92 });
  fs.rmSync(tmp);
}
}
await browser.close();
console.log(`${post.slides.length} slides × ${(post.langs ?? ['fr']).length} → ${dir}`);
