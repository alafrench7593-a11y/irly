// Captures production screens (mock backend, fictional data) or demo/onboarding screens.
// Usage: node shoot.mjs <outdir> <dpr> name=route[@wait][|prod|demo] ...
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, openPage, REPO } from './harness.mjs';
import { makeMock, ME, NOW, PEOPLE, IDS, HOST } from './mock.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Web builds (see README): production with a mock backend, and the demo build.
const DIST_PROD = process.env.DIST_PROD || `${REPO}/dist/app-store-prod`;
const DIST_DEMO = process.env.DIST_DEMO || `${REPO}/dist/app-store-demo`;
const [outDir, dprArg, ...specs] = process.argv.slice(2);
const OUT = outDir.startsWith('/') ? outDir : `${HERE}/${outDir}`;
fs.mkdirSync(OUT, { recursive: true });
const DPR = Number(dprArg || 1);
const LANG = process.env.LANG_UI || 'en';
const APPEAR = process.env.APPEAR || 'auto';
const VIEW = process.env.VIEW ? process.env.VIEW.split('x').map(Number) : [440, 956];

const prodSrv = serve(DIST_PROD, 8102);
const demoSrv = serve(DIST_DEMO, 8101);
const browser = await launch();

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600 * 24 * 300;
const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: 'sara@example.com', email_confirmed_at: '2026-10-01T10:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-09-10T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' };
const token = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: ME, role: 'authenticated', aud: 'authenticated', exp, iat: exp - 3600, email: user.email, session_id: 'b1e0c3c2-0d3c-4b1a-9f1e-1a2b3c4d5e6f', is_anonymous: false })}.c2lnbmF0dXJl`;
const session = { access_token: token, token_type: 'bearer', expires_in: 3600 * 24 * 300, expires_at: exp, refresh_token: 'mockrefresh', user };

const profile = {
  ownerId: ME, name: 'Sara', gender: 'woman', age: 29, country: 'France', types: ['expat', 'professional'], interests: ['startups', 'business', 'food', 'travel'], activities: ['padel', 'running'],
  languages: ['Français', 'English'], lookingFor: ['friends', 'activities'], since: 'new', arrivedAt: NOW - 30 * 86400000, bio: 'French in Dubai since this summer. Padel, brunch and sunrise runs.',
  photoUri: `${HOST}/media/faces/${PEOPLE.me.face}.jpg`,
};
const stateFor = (over = {}) => ({ onboarded: true, destinationId: 'emirates', cityId: 'dubai', storySeen: 2, communityIntroSeen: true, appearance: APPEAR, profile, ...over });
const seedFor = (kind, over) => {
  const sfx = kind === 'demo' ? '-demo' : '';
  const s = {
    [`irly-v2${sfx}`]: JSON.stringify({ version: 1, state: stateFor(over) }),
    [`irly-lang${sfx}`]: JSON.stringify({ version: 0, state: { setting: LANG } }),
  };
  if (kind === 'prod' && !(over && over.signedOut)) s['sb-irlymock-auth-token'] = JSON.stringify(session);
  if (over && over.girl) s[`irly-girl${sfx}`] = JSON.stringify({ version: 1, state: over.girl });
  return s;
};

const mock = makeMock({ user, session });
// Photos the app loads from Unsplash (unreachable here): the closest photo of the project's own library.
const LIBP = `${REPO}/public-photos`;
const UNSPLASH = { '1567880905822-56f8e06fe630': 'coffeeBar', '1688437307687-fe226bddfab1': 'founders', '1688437310009-ed23b2188d38': 'brunch', '1563138216-8ff2e182ccbd': 'lounge', '1578855019520-af8101c056e2': 'photography', '1714577419068-45189e7bda58': 'fort' };
const unsplashMap = (url) => {
  const id = Object.keys(UNSPLASH).find((k) => url.includes(k));
  if (process.env.LOG_UNSPLASH) console.log('UNSPLASH-REQUEST', url.split('?')[0]);
  return id ? `${LIBP}/${UNSPLASH[id]}-1200.jpg` : null;
};
const routes = { ...IDS };
for (const spec of specs) {
  // name=route@wait|kind|overJSON
  const [name, rest] = spec.split(/=(.*)/s);
  const [routeWait, kind = 'prod', overStr] = rest.split('|');
  const [routeRaw, waitScroll] = routeWait.split('@');
  const [waitStr, scrollStr] = (waitScroll || '').split('~');
  const route = routeRaw.replace(/\{(\w+)\.(\w+)\}/g, (_, a, b) => routes[a][b]);
  const over = overStr ? JSON.parse(overStr) : undefined;
  const log = [];
  const { ctx, page } = await openPage(browser, { port: kind === 'demo' ? 8101 : 8102, viewport: { width: VIEW[0], height: VIEW[1] }, dpr: DPR, seed: seedFor(kind, over), mock, log, unsplashMap });
  if (kind === 'demo') {
    // Example data of the demo build: no verification and no presence exist in IRLY, so none is shown.
    await ctx.route(/\/_expo\/static\/js\/web\/entry-[^/]+\.js$/, async (r) => {
      const f = `${DIST_DEMO}${new URL(r.request().url()).pathname}`;
      const body = fs.readFileSync(f, 'utf8').replaceAll('hostVerified:!0', 'hostVerified:!1').replaceAll('verified:!0', 'verified:!1').replace(/hue:(\d+),online:!0/g, 'hue:$1,online:!1');
      await r.fulfill({ status: 200, contentType: 'text/javascript', body });
    });
  }
  if (!process.env.NOCLOCK) await page.clock.setFixedTime(new Date(process.env.CLOCK ? Date.parse(process.env.CLOCK) : NOW));
  try {
    await page.goto(`http://localhost:${kind === 'demo' ? 8101 : 8102}${route}`);
    await page.waitForTimeout(Number(waitStr || 6000));
    const scroll = Number(scrollStr || process.env.SCROLL || 0);
    if (scroll) {
      await page.mouse.move(VIEW[0] / 2, VIEW[1] / 2);
      for (let left = scroll; left > 0; left -= 400) {
        await page.mouse.wheel(0, Math.min(400, left));
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(2200);
    }
    await page.screenshot({ path: `${OUT}/${name}.png` });
    if (process.env.MEASURE) {
      const boxes = await page.evaluate((anchors) => {
        const out = {};
        for (const text of anchors) {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node, el = null;
          while ((node = walker.nextNode())) {
            if (node.textContent.trim().startsWith(text)) {
              const r = node.parentElement.getBoundingClientRect();
              if (r.width && r.top >= 0 && r.top < window.innerHeight) { el = node.parentElement; break; }
            }
          }
          if (!el) { out[text] = null; continue; }
          let cur = el, found = null;
          while (cur && cur !== document.body) {
            const cs = getComputedStyle(cur);
            const bg = cs.backgroundColor;
            const rad = parseFloat(cs.borderTopLeftRadius) || 0;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && rad >= 10) { found = cur; break; }
            cur = cur.parentElement;
          }
          const r = (found || el).getBoundingClientRect();
          out[text] = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
        }
        return out;
      }, process.env.MEASURE.split(';'));
      console.log('MEASURE', name, JSON.stringify(boxes));
    }
    if (process.env.DUMP) {
      // Every text line and photo in view, top to bottom: to pick scroll positions where nothing is cut by the bars.
      const items = await page.evaluate((all) => {
        const out = [];
        const H = all ? 1e9 : window.innerHeight;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const t = node.textContent.trim();
          if (!t) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const r = range.getBoundingClientRect();
          if (!r.width || r.bottom < 0 || r.top > H) continue;
          const st = getComputedStyle(node.parentElement);
          if (st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
          out.push(['T', Math.round(r.top), Math.round(r.bottom), Math.round(r.left), Math.round(r.right), t.slice(0, 34)]);
        }
        for (const el of document.querySelectorAll('img, [style*="background-image"]')) {
          const r = el.getBoundingClientRect();
          if (r.width < 40 || r.height < 40 || r.bottom < 0 || r.top > H) continue;
          out.push(['P', Math.round(r.top), Math.round(r.bottom), Math.round(r.left), Math.round(r.right), '']);
        }
        return out.sort((a, b) => a[1] - b[1]);
      }, process.env.DUMP === 'all');
      console.log(`DUMP ${name}\n` + items.map((i) => `  ${i[0]} y ${i[1]}-${i[2]}  x ${i[3]}-${i[4]}  ${i[5]}`).join('\n'));
    }
    const notes = [...new Set(log)].filter((l) => !l.includes('safe-area override: ok'));
    console.log('shot', name, '->', page.url().replace(/http:\/\/localhost:\d+/, ''), notes.length ? '\n   ' + notes.slice(0, Number(process.env.NOTES || 12)).join('\n   ') : '');
  } catch (e) {
    console.log('failed', name, e.message.split('\n')[0]);
  }
  await ctx.close();
}
await browser.close();
prodSrv.close();
demoSrv.close();
