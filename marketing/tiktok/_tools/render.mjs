/**
 * Renders TikTok slideshows (1080×1920 JPEG) from a post spec:
 *   node marketing/tiktok/_tools/render.mjs marketing/tiktok/01_LA_SOLITUDE/01_personne_ne_te_previent
 * The folder holds post.json; slides are written to FR/01.jpg, EN/01.jpg, …
 * Text stays inside TikTok's safe zone (clear of the top tabs, the right
 * action column and the caption at the bottom).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
// PW: path to a playwright install when it is not in node_modules.
const { chromium } = await import(process.env.PW || 'playwright');

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '..');
const fonts = path.resolve(root, '../../node_modules/@expo-google-fonts/manrope');
const font = (w, n) => `@font-face{font-family:Manrope;font-weight:${w};src:url(file://${fonts}/${n}/Manrope_${n}.ttf)}`;
// TikTok's own typeface (TikTok Sans, SIL OFL), for the native text look.
const tt = (w) => ['latin', 'latin-ext'].map((sub, k) => `@font-face{font-family:'TikTok Sans${k ? ' Ext' : ''}';font-weight:${w};src:url(file://${here}/fonts/tiktok-sans-${sub}-${w}-normal.woff2)}`).join('');
const css = `
${tt(600)}${tt(700)}${tt(800)}
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
/* TikTok style: centred TikTok Sans, black text on white rounded boxes (the in-app text background), white captions. */
.tt{font-family:'TikTok Sans','TikTok Sans Ext',sans-serif}
.tt .txt{left:120px;right:120px;align-items:center;text-align:center;gap:34px}
.tt .top{top:430px}
.tt .t{font-weight:700;font-size:var(--size,58px);line-height:1.45;letter-spacing:0;text-shadow:none}
.tt .t .box{background:#fff;color:#111;padding:5px 22px;border-radius:14px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.tt .t em{color:inherit;font-style:normal}
.tt .sub{font-weight:700;font-size:44px;line-height:1.3;color:#fff;text-shadow:0 0 4px rgba(0,0,0,.95),0 2px 10px rgba(0,0,0,.8)}
.tt .mark{left:0;right:0;text-align:center;font-weight:800;font-size:48px;letter-spacing:12px;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.65)}
/* soft: the photo stays close to the original (no grey, lighter shade). */
.soft .shade{opacity:.45}.soft .grain{opacity:.06}
`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');

const dir = path.resolve(process.argv[2]);
const post = JSON.parse(fs.readFileSync(path.join(dir, 'post.json'), 'utf8'));
// Instagram carousels are 4:5 (1080×1350); TikTok slides are 9:16.
const H = post.format === 'ig' ? 1350 : 1920;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
// TT_HQ=1: rendered at twice the size, then reduced with a sharp filter (crisper text and photos).
const HQ = process.env.TT_HQ === '1';
// TT_PHOTOS: another photo folder with the same layout (e.g. upscaled copies).
const PHOTOS = process.env.TT_PHOTOS ? path.resolve(process.env.TT_PHOTOS) : path.resolve(root, '_photos');
const page = await browser.newPage({ viewport: { width: 1080, height: H }, deviceScaleFactor: HQ ? 2 : 1 });
for (const lang of post.langs ?? ['fr']) {
const out = path.join(dir, lang.toUpperCase());
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const [i, slide] of post.slides.entries()) {
  const s = { ...slide, ...(slide[lang] ?? {}) };
  const img = s.img ? `file://${path.isAbsolute(s.img) ? s.img : path.resolve(PHOTOS, s.img)}` : '';
  const ext = post.ext === 'png' ? 'png' : 'jpg';
  const vars = [s.pos && `--pos:${s.pos}`, s.size && `--size:${s.size}px`, s.bright && `--bright:${s.bright}`, s.gray != null && `--gray:${s.gray}`].filter(Boolean).join(';');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css.replaceAll('1920px', H + 'px')}${post.box ? `.tt .t .box{background:${post.box};color:${post.boxText ?? '#111'}}` : ''}${post.markColor ? `.tt .mark{color:${post.markColor}}` : ''}${post.format === 'ig' ? '.tt .top{top:150px}.mark{bottom:90px}' : ''}</style></head><body>
<div class="s ${img ? '' : 'plain'} ${s.warm ? 'warm' : ''} ${(post.style ?? 'tiktok') === 'tiktok' ? 'tt' : ''} ${post.soft ? 'soft' : ''}" style="${vars}">
<div class="bg" style="background-image:url('${img}')"></div><div class="shade"></div><div class="grain"></div>
<div class="txt ${s.at || 'mid'}"><div class="t"><span class="box">${esc(s.text)}</span></div>${s.sub ? `<div class="sub">${esc(s.sub)}</div>` : ''}</div>
${s.mark ? `<div class="mark">${typeof s.mark === 'string' ? esc(s.mark) : 'IRLY'}</div>` : ''}
</div></body></html>`;
  const tmp = path.join(dir, '.slide.html');
  fs.writeFileSync(tmp, html);
  await page.goto(`file://${tmp}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const file = path.join(out, `${String(i + 1).padStart(2, '0')}.${ext}`);
  if (HQ) {
    const big = path.join(dir, '.slide.png');
    await page.screenshot({ path: big, type: 'png' });
    execFileSync('convert', [big, '-filter', 'Lanczos', '-resize', `1080x${H}!`, ...(ext === 'png' ? [] : ['-sampling-factor', '4:4:4', '-quality', '96']), file]);
    fs.rmSync(big);
  } else await page.screenshot({ path: file, ...(ext === 'png' ? { type: 'png' } : { type: 'jpeg', quality: 95 }) });
  fs.rmSync(tmp);
}
}
await browser.close();
console.log(`${post.slides.length} slides × ${(post.langs ?? ['fr']).length} → ${dir}`);
