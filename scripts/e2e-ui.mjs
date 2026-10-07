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

async function main() {
  await sql(`delete from auth.users where email like 'e2e-ui-%@irly.test'`);
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
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource|images\.unsplash/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`);
  });

  // The on-device onboarding (destination, signup profile) is already done.
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem(
      'irly-v2',
      JSON.stringify({ state: { onboarded: true, destinationId: 'bali', cityId: 'bali', profile: { name: 'Uma', types: [], interests: [], activities: [], languages: ['English'], lookingFor: [], gender: 'woman', age: 32 } }, version: 1 }),
    );
    localStorage.setItem('irly-lang', JSON.stringify({ state: { setting: 'en' }, version: 0 }));
  });

  const check = async (label, route, texts, act, exact) => {
    try {
      if (route) await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
      if (act) await act();
      for (const t of texts) await page.getByText(t, { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 15000 });
      if (exact) await page.getByText(exact, { exact: true }).first().waitFor({ timeout: 15000 });
      passed++;
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

  await check('sign in through the app (email + password)', '/account', [], async () => {
    await click('Continue with email');
    await page.getByPlaceholder('you@email.com').fill(EMAIL);
    await page.getByPlaceholder('Password').fill(PASSWORD);
    const buttons = page.getByRole('button', { name: 'Sign in', exact: true });
    console.log(`   (${await buttons.count()} "Sign in" buttons)`);
    await buttons.last().click();
  }, 'Signed in');
  // The session must survive a full reload (stored by the app).
  await check('session persists after reload', '/account', [], null, 'Signed in');
  await check('Home shows Live Bali', '/', ['Live Bali']);
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
  await check('IRLY Girl opens for a woman', '/girl', ['IRLY', 'All girls', 'Moms']);
  await check('Moms tab', null, ['Meet moms. Find activities. Build your circle.', 'Mom communities'], async () => {
    await page.getByRole('tab', { name: 'Moms' }).click();
  });
  await check('Girls moving to Bali', '/girl/moving', ["don’t know anyone", 'Bali girl communities']);
  await check('Assistant routes "where should I live"', '/assistant?q=' + encodeURIComponent('Where should I live in Bali?'), ["Where you'd fit best"]);
  await check('IRL feed', '/live', ['IRL']);
  await check('Notifications', '/notifications', ['Notifications']);
  await check('Privacy & notifications settings', '/settings', ['Who can find my profile']);
  await check('Saved', '/saved', ['Saved']);
  await check('Messages inbox lists the playdate chat', '/messages', ['Playdate']);

  await browser.close();
}

try {
  await main();
} catch (e) {
  failed++;
  failures.push(`setup: ${e instanceof Error ? e.message : e}`);
  console.log('✗ setup', e);
} finally {
  await sql(`delete from auth.users where email like 'e2e-ui-%@irly.test'`).catch(() => undefined);
  server.close();
}

const real = errors.filter((e) => !/supabase\.co\/storage|ResizeObserver/.test(e));
console.log(`\nBrowser errors: ${real.length}`);
for (const e of [...new Set(real)].slice(0, 15)) console.log('  ' + e);
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('Failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
