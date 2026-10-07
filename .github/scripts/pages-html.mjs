/**
 * Makes the GitHub Pages build installable from the phone's home screen
 * (full screen, IRLY icon) and lets deep links load the app (404.html).
 */
import fs from 'node:fs';

const base = process.argv[2] ?? '';
const file = 'dist/index.html';
let html = fs.readFileSync(file, 'utf8');
const head = `
<link rel="manifest" href="${base}/manifest.json">
<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="IRLY">
<meta name="theme-color" content="#000000">`;
html = html.replace('</head>', `${head}\n</head>`);
fs.writeFileSync(file, html);
fs.writeFileSync('dist/404.html', html);
fs.copyFileSync('assets/icon.png', 'dist/apple-touch-icon.png');
fs.copyFileSync('assets/icon.png', 'dist/icon-1024.png');
fs.writeFileSync(
  'dist/manifest.json',
  JSON.stringify({
    name: 'IRLY',
    short_name: 'IRLY',
    start_url: `${base}/`,
    scope: `${base}/`,
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [{ src: `${base}/icon-1024.png`, sizes: '1024x1024', type: 'image/png', purpose: 'any' }],
  }),
);
fs.writeFileSync('dist/.nojekyll', '');
console.log('pages html ready', base);
