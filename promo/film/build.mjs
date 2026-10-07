// Inlines fonts, photos and scripts into one HTML file: irly-film.html
import fs from 'node:fs';
import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const a = (f) => path.join(dir, 'assets', f);
const b64 = (f) => fs.readFileSync(a(f)).toString('base64');
const photos = ['jbr', 'jbr_gold', 'concert', 'festival', 'tableTennis', 'sailing', 'picnic', 'dhow', 'islands', 'kitesurf', 'climbing', 'burjKhalifa'];
const images = Object.fromEntries(photos.map((p) => [p, `data:image/jpeg;base64,${b64(p + '.jpg')}`]));
const scenes = ['A', 'B', 'C', 'E'].filter((s) => fs.existsSync(path.join(dir, 'src', `scene${s}.js`)));
const js = ['core.js', ...scenes.map((s) => `scene${s}.js`)].map((f) => fs.readFileSync(path.join(dir, 'src', f), 'utf8')).join('\n');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>IRLY · launch film</title>
<style>
@font-face{font-family:Archivo;src:url(data:font/woff2;base64,${b64('archivo.woff2')}) format('woff2');font-weight:100 900;font-stretch:62% 125%;font-display:block}
@font-face{font-family:Geist;src:url(data:font/woff2;base64,${b64('geist.woff2')}) format('woff2');font-weight:100 900;font-display:block}
html,body{margin:0;background:#1a1a1a}
#stage{position:relative;width:1440px;height:1440px;overflow:hidden;background:#F3F0EA;font-family:Geist}
.scene{position:absolute;inset:0;visibility:hidden;overflow:hidden}
svg{overflow:visible}
</style></head><body>
<div id="stage"></div>
<script>window.__IMAGES=${JSON.stringify(images)};</script>
<script>${js}
window.__SCENES=[${scenes.map((s) => `{build:build${s},seek:seek${s}}`).join(',')}];
${fs.readFileSync(path.join(dir, 'src', 'main.js'), 'utf8')}</script>
</body></html>`;
fs.writeFileSync(path.join(dir, 'irly-film.html'), html);
console.log('irly-film.html', (html.length / 1e6).toFixed(2), 'MB');
