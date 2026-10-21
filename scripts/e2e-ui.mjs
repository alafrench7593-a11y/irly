// The web app in a real browser against the live backend: sign in through
// the UI, then open every main screen and check what a member sees. A test
// member is created for the run and deleted at the end. Screenshots go to
// e2e-shots/ (uploaded as a workflow artifact).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').match(/sbp_[^\s"'`]+/)?.[0];
const run = Date.now().toString(36);
const EMAIL = `e2e-ui-${run}@irly.test`;
const PASSWORD = `E2e-${run}-pw!`;
const DIST = path.resolve('dist');
// The app's public (publishable) key, as in src/lib/supabase.ts: only used to try signing in.
const PUBLISHABLE = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_hOfFpr32TkUPj0G880vNgw_fqz2CK0v';
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

// Static server with SPA fallback.
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const server = http
  .createServer((req, res) => {
    let file = path.join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(8081);
const BASE = 'http://localhost:8081';

let passed = 0;
let failed = 0;
const failures = [];
const errors = [];
const apiRequests = [];
const timings = [];
// Home's first content, loaded cold in a real browser against the live backend (a slow CI runner included).
const HOME_FIRST_CONTENT_MS = 12_000;

async function main() {
  await sql(`delete from auth.users where email = '${EMAIL}' or (email like 'e2e-ui-%@irly.test' and created_at < now() - interval '2 hours')`);
  const [{ user_id: uid }] = await sql(`
    with u as (
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${EMAIL}',
        extensions.crypt('${PASSWORD}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
      returning id
    )
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    select gen_random_uuid(), u.id, u.id::text, 'email', jsonb_build_object('sub', u.id::text, 'email', '${EMAIL}', 'email_verified', true), now(), now(), now()
    from u returning user_id`);
  // A woman with an IRLY Match profile, so IRLY Girl and Moms open directly.
  await sql(`
    insert into public.profiles (id, first_name, birthdate, gender, city_id, languages) values ('${uid}', 'Uma', '1994-05-05', 'woman', 'bali', '{en,fr}');
    insert into public.irly_match_onboarding (user_id) values ('${uid}');
    insert into public.irly_match_profiles (user_id, goals, interests, sports, areas, destination, destination_status, mom_mode, kids_age_groups)
    values ('${uid}', '{new_friends}', '{brunch}', '{surf}', '{canggu}', 'bali', 'just_arrived', true, '{kid}');`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // Every request to the IRLY backend (REST, RPC, storage, auth), for the per-step counts.
  page.on('request', (r) => {
    if (r.url().includes('.supabase.co/')) apiRequests.push(r.url().replace(/^https:\/\/[^/]+/, '').split('?')[0]);
  });
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource|images\.unsplash/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`);
  });

  // The on-device onboarding (destination, signup profile) is already done.
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem(
      'irly-v2',
      JSON.stringify({ state: { onboarded: true, storySeen: 99, destinationId: 'bali', cityId: 'bali', profile: { name: 'Uma', types: ['nomad'], interests: [], activities: [], languages: ['English'], lookingFor: ['friends'], gender: 'woman', age: 32, since: 'new' } }, version: 1 }),
    );
    // Bali is coming soon for people; the tests preview it (its screens stay covered).
    localStorage.setItem('irly-preview', 'bali');
    localStorage.setItem('irly-lang', JSON.stringify({ state: { setting: 'en' }, version: 0 }));
  });

  const check = async (label, route, texts, act, exact) => {
    // Timing and backend requests of each step (logged in the job output, see the table at the end).
    const t0 = Date.now();
    const r0 = apiRequests.length;
    try {
      if (route) await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
      if (act) await act();
      for (const t of texts) await page.getByText(t, { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 15000 });
      if (exact) await page.getByText(exact, { exact: true }).first().waitFor({ timeout: 15000 });
      passed++;
      timings.push({ label, ms: Date.now() - t0, requests: apiRequests.length - r0, cold: Boolean(route) });
      console.log(`✓ ${label}`);
    } catch (e) {
      failed++;
      failures.push(label);
      console.log(`✗ ${label}: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
      const seen = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400)).catch(() => '');
      console.log(`   url: ${page.url()}\n   screen: ${seen}`);
    }
    await page.screenshot({ path: path.join(SHOTS, `${String(passed + failed).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.png`) });
  };
  const click = (text) => page.getByText(text, { exact: true }).first().click();
  // Home, loaded cold (a full page load, signed in): its first content within HOME_FIRST_CONTENT_MS,
  // and what it asks the backend as it opens and in the next 5 s (logged).
  const verifyHomeSpeed = async () => {
    const label = `Home first content in under ${HOME_FIRST_CONTENT_MS / 1000} s (cold load)`;
    try {
      const r0 = apiRequests.length;
      const t0 = Date.now();
      await page.goto(BASE + '/', { waitUntil: 'commit' });
      await page.getByText('Live Bali', { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 30000 });
      const ms = Date.now() - t0;
      const atContent = apiRequests.length - r0;
      await page.waitForTimeout(5000);
      const asked = apiRequests.slice(r0);
      const by = {};
      for (const u of asked) by[u] = (by[u] ?? 0) + 1;
      console.log(`   home: first content ${ms} ms, ${atContent} backend requests by then, ${asked.length} within 5 s more`);
      for (const [u, n] of Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`     ${n}× ${u}`);
      timings.push({ label: 'Home cold load (first content)', ms, requests: asked.length, cold: true });
      if (ms > HOME_FIRST_CONTENT_MS) throw new Error(`first content after ${ms} ms`);
      passed++;
      console.log(`✓ ${label} (${ms} ms)`);
    } catch (e) {
      failed++;
      failures.push(label);
      console.log(`✗ ${label}: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
    }
  };

  await check('sign in through the app (email + password)', '/account', [], async () => {
    // Email and password are on the first screen.
    await page.getByPlaceholder('you@email.com').fill(EMAIL);
    await page.getByPlaceholder('Password').fill(PASSWORD);
    const buttons = page.getByRole('button', { name: 'Sign in', exact: true });
    console.log(`   (${await buttons.count()} "Sign in" buttons)`);
    await buttons.last().click();
  }, 'Signed in');
  // The session must survive a full reload (stored by the app).
  await check('session persists after reload', '/account', [], null, 'Signed in');
  // IRLY Community, once after signing in: intro, then recommendations from the answers.
  // Nothing is joined here: a join would post "Uma just joined" in a real community chat.
  await check('IRLY Community intro', '/onboarding/communities', ['Meet people. Find your community.']);
  await check('Your communities: newcomers recommended, join or skip', null, ['Your communities', 'IRLY Newcomers', 'Join all', 'Choose my communities', 'Skip for now'], async () => {
    await click('Skip');
  });
  await check('Skip for now goes Home', null, ['Live Bali'], async () => {
    await click('Skip for now');
  });
  await check('Communities: For you recommends IRLY Newcomers (not joined)', '/communities', ['For you', 'IRLY Newcomers', 'Join']);
  await check('Communities: All lists the IRLY catalogue; search finds IRLY Expats (not joined)', '/communities?tab=all', ['Sports', 'IRLY Expats'], async () => {
    await page.getByPlaceholder('Search by name or theme').fill('expats');
  });
  // Match IRLY is not open yet (src/lib/features.ts): the bar button (« Soon » while it is
  // closed) must lead to its coming-soon page, which says so, not to a list of people.
  await check('Match IRLY in the bar opens its coming-soon page', '/', ['Match IRLY is not open yet', 'Tell me when it opens'], async () => {
    await page.getByRole('button', { name: /^(Match IRLY|Soon: IRLY Match, coming soon)$/ }).first().click();
  });
  await check('Home shows Live Bali', '/', ['Live Bali']);
  // Speed: Home's first content, from a full page load (the bundle, the session, the first reads).
  await verifyHomeSpeed();
  await check('Discover shows Bali and restaurants doors', '/discover?tab=places', ['Discover', 'Live Bali', 'Where to eat']);
  await check('Bali hub', '/bali', ["Don't just visit", 'Where should I live?', 'Areas, explained']);
  await check('Area page Canggu (guide + IRLY data)', '/bali/area/canggu', ['Canggu', 'IRLY Guide', 'Happening in Canggu']);
  await check('Neighbourhood Berawa shows its area', '/bali/area/berawa', ['Berawa', 'Badung']);
  await check('Quiz: 13 answers → top 3 with %', '/bali/quiz', ["Where you'd fit best", '%'], async () => {
    for (let i = 0; i < 13; i++) {
      await page.getByText(/Question \d+ of 13/).first().waitFor({ timeout: 10000 });
      await page.getByRole('button').filter({ hasText: /^(Yes|No problem|Long stay|Social)$/ }).first().click();
    }
  });
  await check('Test Bali plan (14 days)', '/bali/test', ['Live it before you move', 'Arrive, settle in']);
  await check('Visa & stay: official, verified', '/bali/guide/visa', ['Official information', 'Visa on Arrival and e-VOA: 30 days', 'Last verified by IRLY']);
  await check('My Bali move: tick Visa', '/bali/move', ['1 of 12 done'], async () => {
    await page.getByRole('checkbox', { name: 'Visa' }).click();
  });
  await check('Where to eat (ranked list or honest empty state)', '/eat', ['Where to eat']);
  await check('Place page: Echo Beach, who is going, plan', '/place/echo-beach', ['Echo Beach', "Who's going?", 'Plan something here']);
  await check('Plan a playdate at Echo Beach → activity page with chat', null, ['Open chat'], async () => {
    await page.getByRole('button', { name: /^Create: / }).first().click();
  });
  await check('It is in the calendar', '/calendar', ['Echo Beach']);
  // IRLY Girl is the same app in another space (src/app/girl/index.tsx): /girl asks the server,
  // switches the app to IRLY Girl and lands on its Home (Girl content, the way back to IRLY Mixte).
  const space = () => page.evaluate(() => JSON.parse(localStorage.getItem('irly-space') ?? '{}')?.state?.space ?? 'mixte');
  await check('IRLY Girl opens for a woman', '/girl', ['Girls moving to Bali.', 'IRLY Mixte'], async () => {
    await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 });
    for (let i = 0; i < 20 && (await space()) !== 'girl'; i++) await page.waitForTimeout(500);
    if ((await space()) !== 'girl') throw new Error('the app did not switch to IRLY Girl');
  });
  // IRLY Moms lives in IRLY Girl, under Discover › People.
  await check('Moms tab', '/girl?mode=moms', ['Moms in Bali, plans with children', 'Mom communities'], async () => {
    await page.waitForURL(/\/discover\?tab=people&moms=1/, { timeout: 20000 });
  });
  await check('Girls moving to Bali', '/girl/moving', ["don’t know anyone", 'Bali girl communities']);
  // Back to IRLY Mixte (Settings › IRLY): the rest of this walk is the Mixte app.
  await check('Settings → IRLY Mixte brings the app back to IRLY', '/preferences', [], async () => {
    await page.getByText('IRLY Mixte', { exact: true }).filter({ visible: true }).first().click();
    for (let i = 0; i < 20 && (await space()) !== 'mixte'; i++) await page.waitForTimeout(500);
    if ((await space()) !== 'mixte') throw new Error('still in IRLY Girl');
  });
  await check('Assistant routes "where should I live"', '/assistant?q=' + encodeURIComponent('Where should I live in Bali?'), ["Where you'd fit best"]);
  await check('IRL feed', '/live', ['IRL']);
  await check('Notifications', '/notifications', ['Notifications']);
  await check('Privacy & notifications settings', '/settings', ['Who can find my profile']);
  await check('Saved', '/saved', ['Saved']);
  await check('Messages inbox lists the playdate chat', '/messages', ['Playdate']);

  // ── A server fact, checked like a screen.
  const verify = async (label, fn) => {
    try {
      const note = await fn();
      passed++;
      console.log(`✓ ${label}${note ? ` (${note})` : ''}`);
    } catch (e) {
      failed++;
      failures.push(label);
      console.log(`✗ ${label}: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`);
    }
  };
  const sessions = async () => (await sql(`select count(*)::int as n from auth.sessions where user_id = '${uid}'`))[0].n;
  const signIn = async () => {
    await page.goto(BASE + '/account', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('you@email.com').fill(EMAIL);
    await page.getByPlaceholder('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  };

  // ── Notifications: a second test member (Zoe) sends Uma a real friend request through the server.
  const EMAIL2 = `e2e-ui2-${run}@irly.test`;
  const [{ user_id: zoe }] = await sql(`
    with u as (
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${EMAIL2}',
        extensions.crypt('${PASSWORD}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
      returning id
    )
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    select gen_random_uuid(), u.id, u.id::text, 'email', jsonb_build_object('sub', u.id::text, 'email', '${EMAIL2}', 'email_verified', true), now(), now(), now()
    from u returning user_id`);
  await sql(`insert into public.profiles (id, first_name, birthdate, gender, city_id, languages) values ('${zoe}', 'Zoe', '1995-03-03', 'woman', 'bali', '{en}')`);
  // Older unread notices on Uma's account, enough to fill more than the screen under Zoe's request:
  // the last ones start below the fold (src/features/notifications/seen.ts: only rows seen count).
  const EARLIER = 18;
  await sql(`insert into public.notifications (user_id, kind, payload, created_at)
    select '${uid}', 'ACTIVITY_UPDATED', jsonb_build_object('change', 'deleted', 'title', 'Earlier plan ' || i), now() - make_interval(hours => i)
    from generate_series(1, ${EARLIER}) i`);
  const earlierUnread = async () => (await sql(`select count(*)::int as n from public.notifications where user_id = '${uid}' and kind = 'ACTIVITY_UPDATED' and payload->>'title' like 'Earlier plan %' and read_at is null`))[0].n;
  const lastUnread = async () => (await sql(`select read_at from public.notifications where user_id = '${uid}' and payload->>'title' = 'Earlier plan ${EARLIER}'`))[0];
  const zoeToken = await (async () => {
    const r = await fetch(`https://${ref}.supabase.co/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL2, password: PASSWORD }) });
    return (await r.json()).access_token;
  })();
  await verify('Zoe sends Uma a friend request (as Zoe, through the API)', async () => {
    const r = await fetch(`https://${ref}.supabase.co/rest/v1/rpc/add_friend`, { method: 'POST', headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${zoeToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_user: uid }) });
    if (!r.ok) throw new Error(`add_friend ${r.status}: ${(await r.text()).slice(0, 200)}`);
  });
  const notifRow = async () => (await sql(`select id, read_at from public.notifications where user_id = '${uid}' and kind = 'FRIEND_REQUEST' and payload->>'from' = '${zoe}' order by created_at desc limit 1`))[0];
  await check('the bell counts it, without a reload', null, [], async () => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^Notifications, \d+ new$/ }).first().waitFor({ timeout: 20000 });
  });
  await check('Notifications lists it as unread', '/notifications', ['Zoe wants to be friends'], async () => {
    await page.getByRole('button', { name: /Zoe wants to be friends, unread/ }).first().waitFor({ timeout: 15000 });
  });
  // Read means seen: a row on screen for 600 ms is read (seen.ts); a row below the fold is not.
  await verify('seen on screen, it is read on the server without a tap', async () => {
    let n;
    for (let i = 0; i < 20 && !(n = await notifRow())?.read_at; i++) await page.waitForTimeout(500);
    if (!n) throw new Error('no notification on the server');
    if (!n.read_at) throw new Error('still unread after being on screen');
  });
  await verify('opening the list does not mark the rows below the fold read', async () => {
    await page.waitForTimeout(3000);
    const last = await lastUnread();
    if (!last) throw new Error('the earlier notices are missing');
    if (last.read_at) throw new Error('a notice never shown on screen was marked read');
    const left = await earlierUnread();
    if (left === 0) throw new Error('every earlier notice was marked read, none was below the fold');
    return `${left} of ${EARLIER} still unread`;
  });
  await verify('scrolling down shows them: each one is read once seen', async () => {
    await page.mouse.move(195, 420);
    for (let i = 0; i < 30 && (await earlierUnread()) > 0; i++) {
      await page.mouse.wheel(0, 280);
      await page.waitForTimeout(900);
    }
    const left = await earlierUnread();
    if (left) throw new Error(`${left} still unread after scrolling past them`);
  });
  await check('tapping it opens Zoe’s profile', null, ['Zoe'], async () => {
    await page.getByText('Zoe wants to be friends', { exact: true }).first().click();
    await page.waitForURL(new RegExp(`/person/${zoe}`), { timeout: 15000 });
  });
  await verify('that notification is still read on the server', async () => {
    let n;
    for (let i = 0; i < 10 && !(n = await notifRow())?.read_at; i++) await page.waitForTimeout(500);
    if (!n?.read_at) throw new Error('unread on the server');
  });
  await check('the bell no longer counts it', '/', [], async () => {
    await page.getByRole('button', { name: 'Notifications', exact: true }).first().waitFor({ timeout: 15000 });
  });
  await check('after a reload it is still read', '/notifications', ['Zoe wants to be friends'], async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Zoe wants to be friends', { exact: true }).first().waitFor({ timeout: 15000 });
    if (await page.getByRole('button', { name: /Zoe wants to be friends, unread/ }).count()) throw new Error('shown unread again');
  });

  // ── Activity: no start time is chosen for the member; the one they pick is saved in the city's time.
  // The neighbourhood is chosen too (none is picked for the member), so only the time is missing here.
  await check('Create an activity: no start time imposed, Next waits for one', '/category/sport', ['Pick a date and a start time (Bali time)'], async () => {
    await page.getByText('Padel', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Create a Padel session' }).click();
    await page.getByRole('button', { name: 'Choose a neighbourhood' }).click();
    await page.getByPlaceholder('Search a neighbourhood').fill('Canggu');
    await page.getByRole('radio', { name: /^Canggu/ }).first().click();
    const next = page.getByRole('button', { name: 'Next', exact: true }).filter({ visible: true }).last();
    await page.waitForTimeout(500);
    if (await next.isEnabled()) throw new Error('Next is enabled before a time is picked');
  });
  await check('pick tomorrow 20:30 in the date and time picker, publish, land on the activity', null, ['Open chat'], async () => {
    await page.getByRole('button', { name: 'Pick a date and time' }).click();
    await page.getByRole('button').filter({ hasText: 'Tomorrow' }).first().click();
    await page.getByLabel('Hour', { exact: true }).getByText('20', { exact: true }).click();
    await page.waitForTimeout(500);
    await page.getByLabel('Minutes', { exact: true }).getByText('30', { exact: true }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByRole('button', { name: 'Tomorrow · 20:30' }).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Next', exact: true }).filter({ visible: true }).last().click();
    // Create takes the place of Next: a tap on it within 450 ms is the same tap landing twice (PressableScale), dropped.
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /^Create (session|activity|sport session|event|meetup|trip)$/ }).last().click();
    await page.waitForURL(/\/a\//, { timeout: 30000 }).catch(async (e) => {
      const why = await page.getByText(/^Not published: /).first().textContent({ timeout: 1000 }).catch(() => null);
      throw why ? new Error(why) : e;
    });
  });
  await verify('the activity starts tomorrow at 20:30, Bali time', async () => {
    const [a] = await sql(`select to_char(starts_at at time zone 'Asia/Makassar', 'HH24:MI') as hm, (starts_at at time zone 'Asia/Makassar')::date - (now() at time zone 'Asia/Makassar')::date as days, timezone from public.activities where creator_id = '${uid}' and title ilike '%padel%' order by created_at desc limit 1`);
    if (!a) throw new Error('no activity saved');
    if (a.hm !== '20:30' || a.days !== 1) throw new Error(`saved ${a.hm}, ${a.days} day(s) ahead, ${a.timezone}`);
    return `${a.hm} ${a.timezone}`;
  });

  // ── Communities: the form, a double click, one community, its owner, listed under Mine.
  const COMM = `E2E Padel ${run}`;
  await check('Create a community: a double click lands in its chat', '/community/new', [COMM], async () => {
    await page.getByLabel('Community name').fill(COMM);
    await page.getByRole('button', { name: 'Create community' }).dblclick();
  });
  let commId = null;
  await verify('the double click made one community, its creator is the owner', async () => {
    const rows = await sql(`select c.id, m.role from public.communities c left join public.community_members m on m.community_id = c.id and m.user_id = c.created_by where c.name = '${COMM}'`);
    if (rows.length !== 1) throw new Error(`${rows.length} communities named ${COMM}`);
    if (rows[0].role !== 'owner') throw new Error(`creator role ${rows[0].role}`);
    commId = rows[0].id;
  });
  // Lists never show a test run stamp as part of a title (src/features/community/name.ts):
  // the row is found by the community itself, and its title is the name without the stamp.
  const mineRow = () => page.locator(`[data-testid="community-${commId}"]`).filter({ visible: true }).first();
  await check('the new community is under Communities → Mine', '/communities?tab=mine', ['E2E Padel'], async () => {
    await mineRow().waitFor({ timeout: 15000 });
  });

  // ── Log out: timed, the session ends on the server, nothing private stays on this browser.
  let outMs = 0;
  await check('Log out goes to Welcome', '/preferences', [], async () => {
    await page.getByText('Log out', { exact: true }).first().waitFor({ timeout: 15000 });
    const t0 = Date.now();
    await page.getByText('Log out', { exact: true }).first().click();
    await page.waitForURL(/\/welcome/, { timeout: 60000 });
    outMs = Date.now() - t0;
  });
  console.log(`   log out took ${outMs} ms`);
  fs.appendFileSync(path.join(SHOTS, 'timings.txt'), `logout_ms=${outMs}\n`);
  await verify('log out ended the session on the server and on this browser', async () => {
    const left = await sessions();
    if (left !== 0) throw new Error(`${left} session(s) still on the server`);
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sb-') || k === 'irly-v2'));
    const leftLocal = await page.evaluate(() => Object.entries(localStorage).filter(([k, v]) => k.startsWith('sb-') && v && v !== 'null').map(([k]) => k));
    if (leftLocal.length) throw new Error(`session still stored: ${leftLocal.join(', ')}`);
    return `local keys now: ${keys.join(', ') || 'none'}`;
  });
  await verify('after log out, private screens show nothing of the account', async () => {
    for (const route of ['/messages', '/communities?tab=mine', '/calendar']) {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const text = await page.evaluate(() => document.body.innerText);
      // The community's row too (its title is shown without the run stamp).
      const row = await page.locator(`[data-testid="community-${commId}"]`).count();
      if (text.includes(COMM) || text.includes('E2E Padel') || row || text.includes('Playdate')) throw new Error(`${route} still shows the account's data`);
    }
  });
  // Same browser, another account: nothing of Uma's (her notifications, her badge) shows for Zoe.
  await check('Zoe signs in on the same browser', '/account', [], async () => {
    await page.getByPlaceholder('you@email.com').fill(EMAIL2);
    await page.getByPlaceholder('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  }, 'Signed in');
  await verify('Zoe sees none of Uma’s notifications or communities', async () => {
    for (const route of ['/notifications', '/communities?tab=mine', '/messages']) {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      const text = await page.evaluate(() => document.body.innerText);
      const row = await page.locator(`[data-testid="community-${commId}"]`).count();
      if (text.includes('Zoe wants to be friends') || text.includes(COMM) || text.includes('E2E Padel') || row || text.includes('Playdate')) throw new Error(`${route} shows Uma's data to Zoe`);
    }
  });
  await check('Zoe logs out', '/preferences', [], async () => {
    await page.getByText('Log out', { exact: true }).first().click();
    await page.waitForURL(/\/welcome/, { timeout: 60000 });
  });
  await check('sign in again', null, [], signIn, 'Signed in');
  await check('signed in again: the account data comes back', '/communities?tab=mine', ['E2E Padel'], async () => {
    await mineRow().waitFor({ timeout: 15000 });
  });
  await check('… and her read notification is still read', '/notifications', ['Zoe wants to be friends'], async () => {
    await page.getByText('Zoe wants to be friends', { exact: true }).first().waitFor({ timeout: 15000 });
    if (await page.getByRole('button', { name: /Zoe wants to be friends, unread/ }).count()) throw new Error('unread again after signing in');
  });

  // ── Delete the account through Settings: timed, gone on the server, signed out, cannot sign in again.
  let delMs = 0;
  await check('Delete account goes to Welcome', '/preferences', [], async () => {
    await page.getByText('Delete account', { exact: true }).first().click();
    await page.getByText('Delete your IRLY account?').first().waitFor({ timeout: 10000 });
    const t0 = Date.now();
    await page.getByRole('button', { name: 'Delete my account' }).click();
    await page.waitForURL(/\/welcome/, { timeout: 90000 });
    delMs = Date.now() - t0;
  });
  console.log(`   delete account took ${delMs} ms`);
  fs.appendFileSync(path.join(SHOTS, 'timings.txt'), `delete_ms=${delMs}\n`);
  await verify('the account is gone on the server; its community left the lists', async () => {
    const [{ users, profiles }] = await sql(`select (select count(*)::int from auth.users where id = '${uid}') as users, (select count(*)::int from public.profiles where id = '${uid}') as profiles`);
    if (users || profiles) throw new Error(`users=${users} profiles=${profiles}`);
    const [c] = await sql(`select deleted_at is not null as gone from public.communities where name = '${COMM}'`);
    if (!c?.gone) throw new Error('the community nobody else is in is still listed');
  });
  await verify('the deleted account cannot sign in again', async () => {
    const res = await fetch(`https://${ref}.supabase.co/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    if (res.ok) throw new Error('sign-in accepted');
    return `HTTP ${res.status}`;
  });
  await verify('nothing of the deleted account stays in this browser', async () => {
    const leftLocal = await page.evaluate(() => Object.entries(localStorage).filter(([k, v]) => k.startsWith('sb-') && v && v !== 'null').map(([k]) => k));
    if (leftLocal.length) throw new Error(`session still stored: ${leftLocal.join(', ')}`);
  });

  await browser.close();
}

// Regression guard: an account deleted while the app is still signed in to it makes the sign-in profile
// write fail on profiles_id_fkey (another run's cleanup did that when E2E runs overlapped). None may be
// recorded while this run's app was open.
async function noProfileFkey(since) {
  const [{ n }] = await sql(`select count(*)::int as n from public.analytics_events where name = 'SERVER_ERROR' and props->>'code' = 'profiles_id_fkey' and platform = 'web' and created_at >= '${since}'`);
  if (n === 0) {
    passed++;
    console.log('✓ no sign-in profile write refused by profiles_id_fkey during this run');
  } else {
    failed++;
    failures.push(`${n} sign-in profile write(s) refused by profiles_id_fkey during this run`);
    console.log(`✗ ${n} sign-in profile write(s) refused by profiles_id_fkey during this run`);
  }
}

const [{ started }] = await sql(`select now()::text as started`);
try {
  await main();
} catch (e) {
  failed++;
  failures.push(`setup: ${e instanceof Error ? e.message : e}`);
  console.log('✗ setup', e);
} finally {
  // Checked even when the run failed (a run whose accounts were deleted under it fails in setup).
  // The app flushes analytics every 4 s: let the last batch land.
  await new Promise((r) => setTimeout(r, 6000));
  await noProfileFkey(started).catch((e) => {
    failed++;
    failures.push(`profiles_id_fkey check: ${e instanceof Error ? e.message : e}`);
  });
  await sql(`delete from auth.users where email in ('${EMAIL}', 'e2e-ui2-${run}@irly.test') or ((email like 'e2e-ui-%@irly.test' or email like 'e2e-ui2-%@irly.test') and created_at < now() - interval '2 hours')`).catch(() => undefined);
  server.close();
}

const real = errors.filter((e) => !/supabase\.co\/storage|ResizeObserver/.test(e));
// Speed: time to the step's content and requests to the backend, per step (a page load when the step opens a route).
console.log('\n── Timings (ms to content · backend requests) ──');
for (const x of timings) console.log(`${String(x.ms).padStart(6)} ms ${String(x.requests).padStart(4)} req  ${x.cold ? 'load ' : 'in-app'}  ${x.label}`);
const loads = timings.filter((x) => x.cold);
if (loads.length) {
  const sorted = loads.map((x) => x.ms).sort((a, b) => a - b);
  console.log(`page loads: ${loads.length}, median ${sorted[Math.floor(sorted.length / 2)]} ms, slowest ${sorted[sorted.length - 1]} ms; requests per load: median ${loads.map((x) => x.requests).sort((a, b) => a - b)[Math.floor(loads.length / 2)]}`);
}
console.log(`\nBrowser errors: ${real.length}`);
for (const e of [...new Set(real)].slice(0, 15)) console.log('  ' + e);
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('Failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
