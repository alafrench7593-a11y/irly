/**
 * Vercel build for getirly.com: the website at the root and the web app
 * under /app. GitHub Pages keeps serving the same app under /irly.
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const OUT = 'out';

// The web app, built for /app.
const config = JSON.parse(fs.readFileSync('app.json', 'utf8'));
config.expo.experiments = { ...(config.expo.experiments || {}), baseUrl: '/app' };
fs.writeFileSync('app.json', JSON.stringify(config, null, 2));
run('npx expo export --platform web');
run('node .github/scripts/pages-html.mjs /app');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
fs.renameSync('dist', `${OUT}/app`);

// The website at the root.
run(`node .github/scripts/site-build.mjs ${OUT}`);
