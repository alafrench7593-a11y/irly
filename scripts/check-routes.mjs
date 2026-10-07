// Every in-app link must open a screen that exists. Unknown URLs silently
// redirect to Home (+not-found.tsx), so a broken link would never show an
// error: this check finds them. Collects every path literal in src/ (router
// push/replace, href, Redirect, door/section lists) and matches it against
// the Expo Router file tree.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APP = path.join(ROOT, 'src', 'app');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

// Route patterns from files: (group) folders vanish, index is its folder,
// [param] matches one segment.
const routes = walk(APP)
  .filter((f) => /\.tsx?$/.test(f) && !/\/_layout\.tsx?$/.test(f) && !/\+not-found/.test(f))
  .map((f) => {
    const rel = path.relative(APP, f).replace(/\.tsx?$/, '');
    const segs = rel.split(path.sep).filter((s) => !/^\(.*\)$/.test(s));
    if (segs[segs.length - 1] === 'index') segs.pop();
    return { file: path.relative(ROOT, f), segs };
  });

function matches(urlPath) {
  const segs = urlPath.split('/').filter(Boolean).filter((s) => !/^\(.*\)$/.test(s));
  return routes.some((r) => r.segs.length === segs.length && r.segs.every((s, i) => /^\[.+\]$/.test(s) || s === segs[i] || segs[i] === ':param'));
}

const sources = walk(path.join(ROOT, 'src')).filter((f) => /\.tsx?$/.test(f));
const found = [];
for (const file of sources) {
  const text = fs.readFileSync(file, 'utf8');
  // '…' "…" `…` literals that look like app paths.
  const re = /(['"`])(\/[A-Za-z0-9_\-/()[\]$.{}:]*(?:\?[^'"`]*)?)\1/g;
  let m;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 80), m.index);
    // Only navigation contexts, not regexes, URLs or storage paths.
    if (!/(push|replace|href|Redirect|navigate|=>|route|link|go:|onPress)\s*[:=(]?\s*\(?\s*$|href:\s*$|href=\{?\s*$|=>\s*\(?\s*$/.test(before)) continue;
    const raw = m[2];
    const pathOnly = raw.split('?')[0].replace(/\$\{[^}]+\}/g, ':param');
    const line = text.slice(0, m.index).split('\n').length;
    found.push({ file: path.relative(ROOT, file), line, raw, pathOnly });
  }
}

const broken = found.filter((f) => !matches(f.pathOnly));
console.log(`${routes.length} screens, ${found.length} in-app links checked`);
for (const b of broken) console.error(`✗ ${b.file}:${b.line}  ${b.raw}  → no screen for ${b.pathOnly}`);
if (broken.length) process.exit(1);
console.log('routes ok: every link opens a real screen');
