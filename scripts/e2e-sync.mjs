// Browser tests against the live backend, part 2:
//  1. Paths: every screen of the app opens (static and dynamic routes with
//     real ids), without being bounced to Home and without a crash.
//  2. Errors: with the IRLY server unreachable, screens say so (no crash,
//     no misleading "nothing here"); a refused like rolls back.
//  3. Synchronisation: what another member does appears live, without
//     reloading (join count, chat message, comment), and one activity shows
//     up on every screen that should list it; cancelling reaches the others.
// Two throwaway members (Uma in the browser, Vera through the API), deleted
// at the end.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
const URL_ = `https://${ref}.supabase.co`;
const KEY = 'sb_publishable_hOfFpr32TkUPj0G880vNgw_fqz2CK0v';
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').match(/sbp_[^\s"'`]+/)?.[0];
const run = Date.now().toString(36);
const PASSWORD = `E2e-${run}-pw!`;
const DIST = path.resolve('dist');
const SHOTS = path.resolve('e2e-shots');
fs.mkdirSync(SHOTS, { recursive: true });

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}

async function createWoman(name) {
  const email = `e2e-sync-${run}-${name.toLowerCase()}@irly.test`;
  const [{ user_id: id }] = await sql(`
    with u as (
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}',
        extensions.crypt('${PASSWORD}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
      returning id
    )
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    select gen_random_uuid(), u.id, u.id::text, 'email', jsonb_build_object('sub', u.id::text, 'email', '${email}', 'email_verified', true), now(), now(), now()
    from u returning user_id`);
  await sql(`
    insert into public.profiles (id, first_name, birthdate, gender, city_id, languages) values ('${id}', '${name}', '1993-03-03', 'woman', 'bali', '{en}');
    insert into public.irly_match_onboarding (user_id) values ('${id}');
    insert into public.irly_match_profiles (user_id, goals, interests, areas, destination) values ('${id}', '{new_friends}', '{brunch}', '{canggu}', 'bali');`);
  return { id, email, name };
}

const cleanup = () => sql(`delete from auth.users where email like 'e2e-sync-%@irly.test'`).catch(() => undefined);

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const server = http
  .createServer((req, res) => {
    let file = path.join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(8082);
const BASE = 'http://localhost:8082';

let passed = 0;
let failed = 0;
const failures = [];
async function step(label, fn) {
  try {
    const ok = await fn();
    if (ok === false) throw new Error('check returned false');
    passed++;
    console.log(`✓ ${label}`);
  } catch (e) {
    failed++;
    failures.push(label);
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`✗ ${label}: ${msg.split('\n')[0]}`);
    // Which locator, and what the screen said: enough to tell a race from a bug.
    const waiting = msg.match(/waiting for (.+)/);
    if (waiting) console.log(`   waiting for: ${waiting[1].slice(0, 200)}`);
    if (globalThis.__page) {
      const seen = await globalThis.__page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 700)).catch(() => '');
      console.log(`   url: ${globalThis.__page.url()}\n   screen: ${seen}`);
    }
  }
}
const must = (r) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

async function signedInPage(browser, who) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(BASE);
  await page.evaluate((name) => {
    localStorage.setItem('irly-v2', JSON.stringify({ state: { onboarded: true, destinationId: 'bali', cityId: 'bali', profile: { name, types: [], interests: [], activities: [], languages: ['English'], lookingFor: [], gender: 'woman', age: 32 } }, version: 1 }));
    localStorage.setItem('irly-lang', JSON.stringify({ state: { setting: 'en' }, version: 0 }));
  }, who.name);
  await page.goto(`${BASE}/account`);
  await page.getByText('Continue with email', { exact: true }).click();
  await page.getByPlaceholder('you@email.com').fill(who.email);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.getByText('Signed in', { exact: true }).first().waitFor({ timeout: 20000 });
  return page;
}

const visible = (page, text, timeout = 15000) => page.getByText(text, { exact: false }).filter({ visible: true }).first().waitFor({ timeout });

async function main() {
  await cleanup();
  const uma = await createWoman('Uma');
  const vera = await createWoman('Vera');
  const veraSb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  must(await veraSb.auth.signInWithPassword({ email: vera.email, password: PASSWORD }));

  const browser = await chromium.launch();
  const page = await signedInPage(browser, uma);
  globalThis.__page = page;
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, `sync-${String(passed + failed).padStart(2, '0')}-${name}.png`) }).catch(() => undefined);

  // ───────── 3. Synchronisation (first: it creates the activity used below) ─────────
  let actId;
  await step('Uma plans a playdate at Echo Beach from the place page', async () => {
    await page.goto(`${BASE}/place/echo-beach`);
    await page.getByRole('button', { name: /^Create: / }).first().click();
    await page.waitForURL(/\/a\/[0-9a-f-]{36}/, { timeout: 20000 });
    actId = page.url().split('/a/')[1].split(/[?#]/)[0];
    await visible(page, '1 going');
    return true;
  });
  await shot('created');
  await step('Vera joins → Uma sees "2 going" live, without reloading', async () => {
    must(await veraSb.rpc('join_activity', { p_activity: actId, p_status: 'going' }));
    await visible(page, '2 going', 20000);
    return true;
  });
  let conv;
  await step('Vera writes in the activity chat → it appears live in Uma\'s open chat', async () => {
    conv = must(await veraSb.rpc('activity_detail', { p_id: actId }))[0].conversation_id;
    await page.goto(`${BASE}/messages/${conv}`);
    await page.waitForTimeout(2500);
    must(await veraSb.from('messages').insert({ conversation_id: conv, sender_id: vera.id, body: `Sync check ${run}` }));
    await visible(page, `Sync check ${run}`, 20000);
    return true;
  });
  await step('Uma replies from the app → Vera receives it', async () => {
    await page.getByPlaceholder('Message').fill(`Reply ${run}`);
    await page.getByRole('button', { name: 'Send' }).click();
    for (let i = 0; i < 20; i++) {
      const rows = must(await veraSb.from('messages').select('body').eq('conversation_id', conv));
      if (rows.some((r) => r.body === `Reply ${run}`)) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  });
  await step('Vera comments → it appears live in Uma\'s open comments', async () => {
    await page.goto(`${BASE}/comments?type=activity&id=${actId}&title=Playdate`);
    await page.waitForTimeout(2500);
    must(await veraSb.from('comments').insert({ target_type: 'activity', target_id: actId, author_id: vera.id, body: `Comment ${run}` }));
    await visible(page, `Comment ${run}`, 20000);
    return true;
  });
  await step('the same activity is on every screen: calendar', async () => (await page.goto(`${BASE}/calendar`), await visible(page, 'Playdate'), true));
  await step('… the area page of Canggu', async () => (await page.goto(`${BASE}/bali/area/canggu`), await visible(page, 'Playdate'), true));
  await step('… the place page (who\'s going)', async () => (await page.goto(`${BASE}/place/echo-beach`), await visible(page, 'Playdate'), true));
  await step('… the messages inbox', async () => (await page.goto(`${BASE}/messages`), await visible(page, 'Playdate'), true));
  await step('… its category page (Family)', async () => (await page.goto(`${BASE}/category/family`), await visible(page, 'Playdate'), true));
  await step('… IRLY Girl (a moms plan)', async () => (await page.goto(`${BASE}/category/girl`), await visible(page, 'Playdate'), true));
  await step('… Discover search', async () => (await page.goto(`${BASE}/discover?q=Playdate`), await visible(page, 'On IRLY now'), await visible(page, 'Playdate'), true));
  await step('… and Vera\'s calendar (other member)', async () => must(await veraSb.rpc('my_calendar', {})).some((x) => x.id === actId));
  await step('Uma cancels in the app → Vera is notified and it leaves her calendar', async () => {
    await page.goto(`${BASE}/a/${actId}`);
    await page.getByRole('button', { name: 'Cancel activity' }).click();
    await visible(page, 'This activity was cancelled');
    for (let i = 0; i < 20; i++) {
      const n = must(await veraSb.from('notifications').select('kind, payload')).some((x) => x.kind === 'ACTIVITY_UPDATED' && x.payload?.activity_id === actId);
      const cal = must(await veraSb.rpc('my_calendar', {})).some((x) => x.id === actId);
      if (n && !cal) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  });
  await shot('cancelled');

  // ───────── Community: post, live feed, assistant ─────────
  const girlsId = (await sql(`select id from public.communities where city_id = 'bali' and name = 'Bali Girls'`))[0].id;
  await step('Uma joins Bali Girls from its page', async () => {
    await page.goto(`${BASE}/c/${girlsId}`);
    await page.getByRole('button', { name: 'Join the community' }).click();
    await visible(page, 'Open chat');
    return true;
  });
  await step('Uma posts → Vera (other member) receives it', async () => {
    must(await veraSb.rpc('join_community', { p_community: girlsId }));
    await page.getByPlaceholder('Write to the community…').fill(`Hello girls ${run}`);
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    for (let i = 0; i < 20; i++) {
      const feed = must(await veraSb.rpc('community_feed', { p_community: girlsId, p_limit: 50 }));
      if (feed.some((p) => p.body === `Hello girls ${run}`)) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  });
  await step('Vera posts → it appears live in Uma\'s open community page', async () => {
    await page.waitForTimeout(1500);
    must(await veraSb.from('community_posts').insert({ community_id: girlsId, author_id: vera.id, body: `Live from Vera ${run}` }));
    await visible(page, `Live from Vera ${run}`, 20000);
    return true;
  });
  await step('assistant: "Poll: Saturday or Sunday?" → poll posted, Uma votes', async () => {
    await page.getByPlaceholder('Ask: organise brunch Sunday 11am…').fill('Poll: Saturday or Sunday?');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await page.getByRole('button', { name: 'Post this poll' }).click();
    await visible(page, 'Saturday or Sunday?');
    await page.getByRole('button', { name: 'Vote Sunday' }).first().click();
    await visible(page, '1 vote');
    return true;
  });
  await step('assistant: "Organise padel Saturday 9am" → activity created and announced', async () => {
    await page.getByPlaceholder('Ask: organise brunch Sunday 11am…').fill('Organise padel Saturday 9am');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await page.getByRole('button', { name: 'Create it for the community' }).click();
    await visible(page, 'New plan: Padel', 20000);
    const acts = must(await veraSb.from('activities').select('title').eq('community_id', girlsId));
    return acts.some((a) => a.title.startsWith('Padel'));
  });
  await step('assistant: weekly digest from real data', async () => {
    await page.getByPlaceholder('Ask: organise brunch Sunday 11am…').fill("What's new this week?");
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await visible(page, 'posts this week');
    return true;
  });

  // ───────── Networking, professional side ─────────
  await step('Vera has a professional profile (investor, AI & SaaS, Canggu)', async () => {
    must(await veraSb.from('pro_profiles').insert({ user_id: vera.id, role: 'investor', job_title: 'Angel investor', company: `Vera Capital ${run}`, industries: ['ai', 'saas'], skills: ['Fundraising', 'Product'], intents: ['partners', 'opportunities'], city_id: 'bali', area_id: 'canggu', project: 'Backing AI tools for clinics' }));
    return true;
  });
  await step('Uma creates her professional profile in the app', async () => {
    await page.goto(`${BASE}/network/profile`);
    await page.getByPlaceholder('Founder & CEO, Product designer…').fill('Founder');
    await page.getByRole('button', { name: '🤖 AI & Artificial Intelligence', exact: true }).click();
    await page.getByRole('button', { name: '🚀 SaaS', exact: true }).click();
    await page.getByRole('button', { name: '💰 Find investors', exact: true }).click();
    await page.getByRole('button', { name: '🤝 Find business partners', exact: true }).click();
    await page.getByPlaceholder('Add a skill and press enter').fill('Python');
    await page.getByPlaceholder('Add a skill and press enter').press('Enter');
    await page.getByPlaceholder('An AI assistant for clinics in Dubai…').fill('AI assistant for clinics');
    await page.getByRole('button', { name: 'Create my professional profile', exact: true }).click();
    for (let i = 0; i < 20; i++) {
      const rows = await sql(`select industries, intents, skills from public.pro_profiles where user_id = '${uma.id}'`);
      if (rows[0]?.industries?.includes('saas') && rows[0].intents.includes('investors') && rows[0].skills.includes('Python')) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  });
  await step('Networking lists Vera with a match and the reason', async () => {
    await page.goto(`${BASE}/network`);
    await visible(page, `Angel investor · Vera Capital ${run}`, 20000);
    await visible(page, '% match — You both work in AI & SaaS');
    await shot('network-discover');
    return true;
  });
  await step('… a domain filter hides her, "All domains" brings her back', async () => {
    await page.getByRole('button', { name: '🛒 E-commerce', exact: true }).click();
    await visible(page, 'No one matches these filters yet');
    await page.getByRole('button', { name: 'All domains', exact: true }).click();
    await visible(page, `Vera Capital ${run}`);
    return true;
  });
  await step('… the filters sheet: Investor + City', async () => {
    await page.getByLabel('Filters', { exact: true }).click();
    await page.getByRole('button', { name: 'Investor', exact: true }).click();
    await page.getByRole('button', { name: /^Show \d+ results$/ }).click();
    await visible(page, `Vera Capital ${run}`);
    await page.getByLabel('Filters', { exact: true }).click();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('button', { name: /^Show \d+ results$/ }).click();
    return true;
  });
  await step('Connect → Vera gets the request, accepts → Message opens the chat', async () => {
    await page.getByRole('button', { name: 'Connect', exact: true }).first().click();
    await visible(page, 'Requested');
    let state;
    for (let i = 0; i < 20 && state !== 'incoming'; i++) {
      state = must(await veraSb.rpc('pro_profile_of', { p_user: uma.id }))[0]?.connection;
      if (state !== 'incoming') await new Promise((r) => setTimeout(r, 500));
    }
    if (state !== 'incoming') return false;
    must(await veraSb.rpc('add_friend', { p_user: uma.id }));
    await page.getByRole('button', { name: 'Message', exact: true }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'Message', exact: true }).first().click();
    await page.waitForURL(/\/messages\/[0-9a-f-]{36}/, { timeout: 20000 });
    return true;
  });
  await step('Vera\'s professional page: why they should meet', async () => {
    await page.goto(`${BASE}/network/${vera.id}`);
    await visible(page, 'Why you should meet');
    await visible(page, 'Backing AI tools for clinics');
    await shot('network-profile');
    return true;
  });

  // ───────── 1. Paths: every screen opens ─────────
  const areas = (await sql(`select id from public.areas where city_id = 'bali' order by sort`)).map((r) => r.id);
  const sections = ['visa', 'housing', 'banking', 'sim', 'internet', 'transport', 'healthcare', 'insurance', 'schools', 'childcare', 'work', 'coworking', 'business', 'accounting', 'tax', 'legal', 'real_estate', 'moving', 'pets', 'services'];
  const categories = ['sport', 'networking', 'food', 'travel', 'outdoor', 'shopping', 'culture', 'entertainment', 'nightlife', 'wellness', 'animals', 'family', 'creative', 'learning', 'girl'];
  const kinds = ['padel', 'football', 'tennis', 'running', 'yoga', 'surf', 'hiking', 'wellness', 'beach', 'networking'];
  const places = (await sql(`select slug from public.places where city_id = 'bali' limit 8`)).map((r) => r.slug);
  const screens = [
    '/', '/discover', '/live', '/map', '/messages', '/profile', '/social', '/account', '/assistant', '/business', '/calendar', '/communities',
    '/community/new', '/design-system', '/eat', '/events', '/match', '/notifications', '/saved', '/services', '/settings', '/activities',
    '/network', '/network/profile', `/network/${vera.id}`, '/bali', '/bali/move', '/bali/quiz', '/bali/test', '/girl', '/girl/moving', `/a/${actId}`, `/messages/${conv}`, `/c/${girlsId}`,
    `/comments?type=activity&id=${actId}`, `/share?type=activity&id=${actId}&title=x`, '/person/p-kadek',
    ...areas.map((a) => `/bali/area/${a}`),
    ...sections.map((s) => `/bali/guide/${s}`),
    ...categories.map((c) => `/category/${c}`),
    ...kinds.map((k) => `/activities/${k}`),
    ...places.map((p) => `/place/${p}`),
  ];
  const bounced = [];
  const crashed = [];
  const blank = [];
  for (const route of screens) {
    const before = page.errors.length;
    await page.goto(BASE + route);
    await page.waitForTimeout(900);
    const want = route.split('?')[0];
    const got = new URL(page.url()).pathname;
    if (want !== '/' && got === '/') bounced.push(`${route} → ${got}`);
    if (page.errors.length > before) crashed.push(`${route}: ${page.errors.slice(before).join(' | ').slice(0, 160)}`);
    const text = await page.evaluate(() => document.body.innerText.trim().length);
    if (text < 20) blank.push(route);
  }
  await step(`all ${screens.length} screens open on their own path (no bounce to Home)`, async () => {
    if (bounced.length) throw new Error(bounced.join(', '));
    return true;
  });
  await step('no screen crashes', async () => {
    if (crashed.length) throw new Error(crashed.join(' ; '));
    return true;
  });
  await step('no blank screen', async () => {
    if (blank.length) throw new Error(blank.join(', '));
    return true;
  });

  // ───────── 2. Errors: server unreachable ─────────
  const before = page.errors.length;
  await page.route(/supabase\.co\/(rest|realtime)/, (r) => r.abort('internetdisconnected'));
  await step('offline: restaurants say they could not load', async () => (await page.goto(`${BASE}/eat`), await visible(page, 'Could not load restaurants'), true));
  await step('offline: visa guide says it could not load', async () => (await page.goto(`${BASE}/bali/guide/visa`), await visible(page, 'Could not load this guide'), true));
  await step('offline: Bali hub says the area guide could not load', async () => (await page.goto(`${BASE}/bali`), await visible(page, 'Could not load the area guide'), true));
  await step('offline: calendar says IRLY is unreachable (not "nothing planned")', async () => (await page.goto(`${BASE}/calendar`), await visible(page, 'reach IRLY right now'), true));
  await step('offline: activity page says IRLY is unreachable (not "no longer available")', async () => (await page.goto(`${BASE}/a/${actId}`), await visible(page, 'reach IRLY right now'), true));
  await step('offline: Try again works once back online', async () => {
    await page.unroute(/supabase\.co\/(rest|realtime)/);
    await page.getByRole('button', { name: 'Try again' }).click();
    await visible(page, 'This activity was cancelled');
    return true;
  });
  await step('offline: no crash while the server was unreachable', async () => {
    const errs = page.errors.slice(before);
    if (errs.length) throw new Error(errs.join(' | ').slice(0, 300));
    return true;
  });
  await step('a refused like rolls back (heart off again) with a message', async () => {
    await page.route(/rest\/v1\/rpc\/toggle_like/, (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"server down"}' }));
    await page.goto(`${BASE}/a/${actId}`);
    await page.getByRole('button', { name: 'Like' }).first().click();
    await visible(page, 'server down', 10000);
    await page.getByRole('button', { name: 'Like' }).first().waitFor({ timeout: 5000 });
    await page.unroute(/rest\/v1\/rpc\/toggle_like/);
    return true;
  });
  await shot('end');
  await browser.close();
}

try {
  await main();
} catch (e) {
  failed++;
  failures.push(`setup: ${e instanceof Error ? e.message : e}`);
  console.log('✗ setup', e);
} finally {
  await cleanup();
  server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('Failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
