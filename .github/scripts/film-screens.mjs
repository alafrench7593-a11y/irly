// Real captures of the IRLY web app for the launch film: the exported app,
// real photos (Unsplash + the photo library), a seeded member in Dubai.
// Run after the web export, with .github/scripts/web-serve.mjs on 8083.
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = 'http://localhost:8083';
const OUT = 'film-screens';
fs.mkdirSync(OUT, { recursive: true });

const now = Date.now();
const state = (appearance = 'auto') => ({
  state: {
    onboarded: true,
    destinationId: 'emirates',
    cityId: 'dubai',
    profile: {
      name: 'Sarah',
      types: ['expat'],
      interests: ['sports', 'food', 'outdoors'],
      activities: ['padel', 'running', 'beach'],
      languages: ['English', 'French'],
      lookingFor: ['friends', 'sports', 'activities'],
      gender: 'woman',
      age: 29,
      bio: 'New in Dubai. Padel, brunch and sunsets.',
      country: 'France',
      arrivedAt: now - 12 * 86400000,
    },
    appearance,
    hapticsOn: true,
    joined: {}, rsvp: {}, saved: {}, memberOf: {}, connections: {},
    bookings: [], sent: {}, read: {}, waitlist: {}, lastIntent: null, myPlans: [],
  },
  version: 1,
});

// Each shot: route, then optional steps. Waits leave time for the app
// entrance, photos (blur to sharp) and springs to settle.
const SHOTS = [
  { name: 'home', path: '/', steps: [['wait', 4200]] },
  { name: 'home_day', path: '/', appearance: 'day', steps: [['wait', 4200]] },
  { name: 'home_live', path: '/', steps: [['wait', 3800], ['scroll', 430], ['wait', 1600]] },
  { name: 'home_people', path: '/', steps: [['wait', 3800], ['scroll', 1150], ['wait', 1800]] },
  { name: 'home_rails', path: '/', steps: [['wait', 3800], ['scroll', 2100], ['wait', 1800]] },
  { name: 'home_doors', path: '/', steps: [['wait', 3800], ['scroll', 4200], ['wait', 1800]] },
  { name: 'irl_menu', path: '/', steps: [['wait', 3800], ['click', '[aria-label^="IRL:"]'], ['wait', 1400]] },
  { name: 'discover', path: '/discover', steps: [['wait', 2600]] },
  { name: 'discover_activities', path: '/discover', steps: [['wait', 2400], ['click', '[role="tab"][aria-label="Activities"]'], ['wait', 1500]] },
  { name: 'discover_places', path: '/discover', steps: [['wait', 2400], ['click', '[role="tab"][aria-label="Places"]'], ['wait', 1500]] },
  { name: 'discover_events', path: '/discover', steps: [['wait', 2400], ['click', '[role="tab"][aria-label="Events"]'], ['wait', 1500]] },
  { name: 'live', path: '/live', steps: [['wait', 2600]] },
  { name: 'map', path: '/map', steps: [['wait', 3200]] },
  { name: 'profile', path: '/profile', steps: [['wait', 2600]] },
  { name: 'match', path: '/match', steps: [['wait', 2400]] },
  { name: 'match_moment', path: '/match', steps: [['wait', 2200], ['click', '[aria-label="Connect"]'], ['wait', 4600]] },
  { name: 'event', path: '/events', steps: [['wait', 2400], ['click', '[aria-label^="Founders"]'], ['wait', 1900]] },
  { name: 'event_going', path: '/events', steps: [['wait', 2400], ['click', '[aria-label^="Founders"]'], ['wait', 1900], ['click', '[aria-label="Going"]'], ['wait', 1300]] },
  { name: 'person', path: '/person/p-layla', steps: [['wait', 2200]] },
  { name: 'person_requested', path: '/person/p-layla', steps: [['wait', 2200], ['click', '[aria-label="Connect"]'], ['wait', 650]] },
  { name: 'create', path: '/', steps: [['wait', 3800], ['click', '[aria-label^="IRL:"]'], ['wait', 1000], ['click', '[aria-label="Create activity"]'], ['wait', 1700]] },
  { name: 'chat', path: '/messages/cv-d1', steps: [['wait', 2200]] },
  { name: 'story', path: '/story', steps: [['shot', 1700, 'story_people'], ['shot', 4700, 'story_places'], ['shot', 7800, 'story_activities'], ['shot', 11000, 'story_real'], ['shot', 14300, 'story_irly']] },
];

const browser = await chromium.launch();
const errors = [];

async function phone(appearance) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => { try { localStorage.setItem('irly-v2', s); } catch {} }, JSON.stringify(state(appearance)));
  return ctx;
}

for (const shot of SHOTS) {
  const ctx = await phone(shot.appearance);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${shot.name}: ${e.message}`));
  await page.goto(BASE + shot.path, { waitUntil: 'networkidle', timeout: 90000 });
  const t0 = Date.now();
  for (const [kind, a, b] of shot.steps) {
    if (kind === 'wait') await page.waitForTimeout(a);
    else if (kind === 'click') await page.locator(a).first().click({ timeout: 15000 }).catch((e) => errors.push(`${shot.name}: ${e.message.split('\n')[0]}`));
    else if (kind === 'scroll') { await page.mouse.move(195, 430); await page.mouse.wheel(0, a); }
    else if (kind === 'shot') {
      const wait = a - (Date.now() - t0);
      if (wait > 0) await page.waitForTimeout(wait);
      await page.screenshot({ path: `${OUT}/${b}.jpg`, type: 'jpeg', quality: 92 });
    }
  }
  if (!shot.steps.some(([k]) => k === 'shot')) await page.screenshot({ path: `${OUT}/${shot.name}.jpg`, type: 'jpeg', quality: 92 });
  await ctx.close();
  console.log('shot', shot.name);
}

// The web version on a desktop: the phone column on the city's blurred light.
for (const [name, route, click] of [['desktop', '/', null], ['desktop_person', '/person/p-layla', null], ['desktop_person_requested', '/person/p-layla', '[aria-label="Connect"]']]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => { try { localStorage.setItem('irly-v2', s); } catch {} }, JSON.stringify(state()));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(route === '/' ? 4200 : 2600);
  if (click) { await page.locator(click).first().click({ timeout: 15000 }).catch((e) => errors.push(`${name}: ${e.message.split('\n')[0]}`)); await page.waitForTimeout(650); }
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 92 });
  await ctx.close();
  console.log('shot', name);
}

// The source photographs behind two screens, full size (the app loads them from Unsplash):
// Layla's cover (running at dusk) and Dubai at night.
for (const [k, id] of Object.entries({ running: '1552674605-db6ffd4facb5', dubaiNight: '1590264539175-39df72442833' })) {
  const r = await fetch(`https://images.unsplash.com/photo-${id}?w=2400&q=88&fm=jpg`);
  if (r.ok) fs.writeFileSync(`${OUT}/photo_${k}.jpg`, Buffer.from(await r.arrayBuffer()));
  else errors.push(`photo ${k}: HTTP ${r.status}`);
  console.log('photo', k, r.status);
}

await browser.close();
fs.writeFileSync(`${OUT}/errors.txt`, errors.join('\n') || 'none');
console.log(errors.length ? errors.join('\n') : 'no page errors');
