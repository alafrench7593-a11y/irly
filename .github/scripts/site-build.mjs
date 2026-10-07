/**
 * Builds the website into dist/site (GitHub Pages) or the folder given
 * (getirly.com on Vercel): the page (its leading <title>/<meta>/<link>
 * lines go to <head> with site/head.html), its images, the app screens and
 * the example portraits.
 */
import fs from 'node:fs';

const OUT = process.argv[2] || 'dist/site';
fs.mkdirSync(OUT, { recursive: true });
const page = fs.readFileSync('site/index.html', 'utf8');
const lines = page.split('\n');
let i = 0;
while (i < lines.length && /^<(title|meta|link)\b/.test(lines[i])) i += 1;
const head = [fs.readFileSync('site/head.html', 'utf8').trim(), ...lines.slice(0, i)].join('\n');
const body = lines.slice(i).join('\n');
fs.writeFileSync(`${OUT}/index.html`, `<!doctype html>\n<html lang="en" dir="ltr">\n<head>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
for (const d of ['shots', 'img', 'video']) if (fs.existsSync(`site/${d}`)) fs.cpSync(`site/${d}`, `${OUT}/${d}`, { recursive: true });
fs.copyFileSync('assets/favicon.png', `${OUT}/favicon.png`);
for (const f of ['sitemap.xml', 'robots.txt', 'apple-touch-icon.png', 'og.jpg', 'lenis.min.js']) if (fs.existsSync(`site/${f}`)) fs.copyFileSync(`site/${f}`, `${OUT}/${f}`);
if (fs.existsSync('public-photos/faces')) {
  fs.mkdirSync(`${OUT}/faces`, { recursive: true });
  for (const f of fs.readdirSync('public-photos/faces')) if (f.endsWith('.jpg')) fs.copyFileSync(`public-photos/faces/${f}`, `${OUT}/faces/${f}`);
}
console.log('website built:', fs.readdirSync(OUT).join(', '));
