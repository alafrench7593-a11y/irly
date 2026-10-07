/**
 * Screens of the demonstration build for the website (site/shots/*.jpg)
 * and a real map of Dubai for the "Your city" chapter (site/shots/dubai-map.jpg).
 * Runs in CI where photos and map tiles are reachable. The server is mocked
 * only for the Networking screens, which need a signed-in member.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.argv[2] || 'dist-demo';
const OUT = 'site/shots';
fs.mkdirSync(OUT, { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.json': 'application/json' };
const srv = http
  .createServer((q, r) => {
    let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) f = fs.existsSync(`${f}.html`) ? `${f}.html` : path.join(ROOT, 'index.html');
    r.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream');
    fs.createReadStream(f).pipe(r);
  })
  .listen(8095);

const ME = '11111111-1111-1111-1111-111111111111';
const pro = (o) => ({ user_id: 'x', first_name: 'X', photo_path: null, role: 'founder', job_title: 'Founder', company: null, industries: ['tech'], skills: [], project: null, looking_for: null, can_offer: null, intents: [], city_id: 'dubai', area_id: null, lat: null, lng: null, connection: 'none', updated_at: new Date().toISOString(), ...o });
const me = pro({ user_id: ME, first_name: 'Sara', photo_path: 'n-sara.jpg', job_title: 'Founder & CEO', company: 'Clinicly', industries: ['ai', 'saas'], skills: ['Python', 'Sales'], project: 'AI assistant for clinics in Dubai', intents: ['partners', 'investors'], area_id: 'marina', lat: 25.08, lng: 55.14 });
const others = [
  pro({ user_id: '22222222-0000-0000-0000-000000000001', first_name: 'Lina', photo_path: 'n-lina.jpg', job_title: 'CTO', company: 'Medly', industries: ['ai', 'saas'], skills: ['Python', 'React', 'AI/ML'], project: 'Scheduling for clinics with AI', intents: ['partners', 'cofounder'], area_id: 'jlt', lat: 25.07, lng: 55.15 }),
  pro({ user_id: '22222222-0000-0000-0000-000000000002', first_name: 'Omar', photo_path: 'n-omar.jpg', role: 'investor', job_title: 'Angel investor', company: 'Falcon Angels', industries: ['fintech', 'ai'], skills: ['Fundraising'], can_offer: 'Fundraising advice and investor intros', intents: ['opportunities'], area_id: 'difc', lat: 25.21, lng: 55.28, connection: 'incoming' }),
  pro({ user_id: '22222222-0000-0000-0000-000000000003', first_name: 'Ana', photo_path: 'n-ana.jpg', role: 'freelancer', job_title: 'Product designer', industries: ['design', 'apps'], skills: ['UI/UX', 'Branding'], intents: ['clients'], city_id: 'sharjah', area_id: 'aljada', lat: 25.3, lng: 55.45, connection: 'requested' }),
  pro({ user_id: '22222222-0000-0000-0000-000000000004', first_name: 'Karim', photo_path: 'n-karim.jpg', role: 'entrepreneur', job_title: 'Founder', company: 'Spice Route', industries: ['trade', 'food'], skills: ['Supply chain'], intents: ['clients', 'meet'], city_id: 'abudhabi', connection: 'connected' }),
];

const browser = await chromium.launch();
const errors = [];

async function open(signedIn) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US', colorScheme: 'dark' });
  // Photos not deployed yet (new portraits) come from this checkout.
  await ctx.route(/alafrench7593-a11y\.github\.io\/irly\/photos\/(.+)$/, (route) => {
    const f = `public-photos/${route.request().url().split('/photos/')[1]}`;
    return fs.existsSync(f) ? route.fulfill({ path: f, contentType: 'image/jpeg' }) : route.continue();
  });
  await ctx.route(/supabase\.co\/(.*)$/, (route) => {
    const u = route.request().url();
    const j = (x) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
    if (!signedIn) return route.abort();
    const sign = u.match(/object\/sign\/profile-photos\/([^?]+)/);
    if (sign && route.request().method() === 'GET') return route.fulfill({ path: `public-photos/faces/${sign[1]}`, contentType: 'image/jpeg' });
    if (u.includes('object/sign/profile-photos')) {
      const paths = JSON.parse(route.request().postData() || '{}').paths || [];
      return j(paths.map((p) => ({ path: p, signedURL: `/object/sign/profile-photos/${p}?token=demo`, error: null })));
    }
    if (u.includes('/auth/v1/user')) return j({ id: ME, email: 'sara@example.com', aud: 'authenticated', role: 'authenticated' });
    if (u.includes('rpc/pro_discover')) return j(others);
    if (u.includes('rpc/pro_profile_of')) {
      const body = JSON.parse(route.request().postData() || '{}');
      return j([...others, me].filter((p) => p.user_id === body.p_user));
    }
    if (u.includes('/rest/v1/pro_profiles')) return j({ visible: true });
    return j([]);
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8095/');
  await page.evaluate(
    ([ME, signedIn]) => {
      localStorage.setItem('irly-v2', JSON.stringify({ state: { onboarded: true, destinationId: 'emirates', cityId: 'dubai', profile: { name: 'Sara', gender: 'woman', age: 29, types: [], interests: ['startups', 'food'], activities: ['padel'], languages: ['English'], lookingFor: [] } }, version: 1 }));
      localStorage.setItem('irly-lang', JSON.stringify({ state: { setting: 'en' }, version: 0 }));
      localStorage.setItem('irly-girl', JSON.stringify({ state: { onboarded: true, profile: { bio: 'x', photoUris: [], interests: [], sports: [], activities: [], goals: ['new_friends'], languages: ['en'], areas: [], availability: [], travel: [], lifestyle: {}, ageMin: 22, ageMax: 40, hiddenFields: [], visible: true, showActive: true }, decisions: {}, saved: {}, matches: [], blocked: {}, reports: [] }, version: 1 }));
      if (signedIn)
        localStorage.setItem('sb-yqutcmgslwxcmnsqmhvy-auth-token', JSON.stringify({ access_token: 'h.' + btoa(JSON.stringify({ sub: ME, exp: 4102444800, role: 'authenticated' })) + '.s', refresh_token: 'r', token_type: 'bearer', expires_in: 999999, expires_at: 4102444800, user: { id: ME, email: 'sara@example.com', aud: 'authenticated', role: 'authenticated' } }));
    },
    [ME, signedIn],
  );
  return { ctx, page };
}

// [file, route, signed in, wait ms, optional action]
const SHOTS = [
  ['home', '/', false, 6000],
  ['home-scroll', '/', false, 6000, (p) => p.mouse.wheel(0, 900)],
  ['discover', '/discover', false, 5000],
  ['people', '/social', false, 5000],
  ['match', '/match', false, 5000],
  ['category', '/category/sport', false, 5000],
  ['session', '/a/s-d1', false, 5000],
  ['map', '/map', false, 9000],
  ['communities', '/communities', false, 5000],
  ['community', '/c/c-d1', false, 5000],
  ['profile', '/person/p-layla', false, 5000],
  ['inbox', '/messages', false, 4000],
  ['chat', '/messages/cv-d1', false, 4000],
  ['girl', '/girl', false, 6000],
  ['network', '/network', true, 5000],
  ['create', '/category/sport', false, 5000, (p) => p.getByText(/create session/i).first().click()],
];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
for (const [name, url, signedIn, wait, act] of SHOTS) {
  if (only && !only.includes(name)) continue;
  const { ctx, page } = await open(signedIn);
  try {
    await page.goto(`http://localhost:8095${url}`);
    await page.waitForTimeout(wait);
    if (act) {
      await act(page);
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80 });
    console.log('shot', name);
  } catch (e) {
    console.log('failed', name, e.message);
  }
  await ctx.close();
}

// A real, quiet map of Dubai (OpenStreetMap via OpenFreeMap) for the website.
if (!only || only.includes('dubai-map')) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css"><script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
<style>html,body,#m{margin:0;height:100%;background:#000}.maplibregl-ctrl-attrib{display:none}</style></head><body><div id="m"></div><script>
const m=new maplibregl.Map({container:'m',style:'https://tiles.openfreemap.org/styles/dark',center:[55.2,25.13],zoom:10.6,bearing:-28,pitch:0,attributionControl:false,interactive:false,preserveDrawingBuffer:true});
m.on('idle',()=>{document.title='ready'});</script></body></html>`);
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 60000 }).catch(() => console.log('map: not idle'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/dubai-map.jpg`, type: 'jpeg', quality: 82 });
  console.log('shot dubai-map');
  await ctx.close();
}

await browser.close();
srv.close();
console.log(errors.length ? `page errors:\n${[...new Set(errors)].join('\n')}` : 'no page errors');
