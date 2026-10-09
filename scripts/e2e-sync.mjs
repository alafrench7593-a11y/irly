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
    localStorage.setItem('irly-v2', JSON.stringify({ state: { onboarded: true, storySeen: 99, communityIntroSeen: true, destinationId: 'bali', cityId: 'bali', profile: { name, types: [], interests: [], activities: [], languages: ['English'], lookingFor: [], gender: 'woman', age: 32 } }, version: 1 }));
    localStorage.setItem('irly-lang', JSON.stringify({ state: { setting: 'en' }, version: 0 }));
  }, who.name);
  await page.goto(`${BASE}/account`);
  await page.getByPlaceholder('you@email.com').fill(who.email);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.getByText('Signed in', { exact: true }).first().waitFor({ timeout: 20000 });
  return page;
}

const visible = (page, text, timeout = 15000) => page.getByText(text, { exact: false }).filter({ visible: true }).first().waitFor({ timeout });
const gone = (page, text, timeout = 20000) => page.getByText(text, { exact: false }).filter({ visible: true }).first().waitFor({ state: 'hidden', timeout });

async function main() {
  await cleanup();
  const uma = await createWoman('Uma');
  const vera = await createWoman('Vera');
  const veraSb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  must(await veraSb.auth.signInWithPassword({ email: vera.email, password: PASSWORD }));

  const browser = await chromium.launch();
  const page = await signedInPage(browser, uma);
  globalThis.__page = page;
  // "Delete…?" and "Cancel…?" confirmations: yes.
  page.on('dialog', (d) => d.accept().catch(() => undefined));
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
  // ───────── Motion: double tap to like, tap to open full screen ─────────
  let postId;
  await step('Vera posts a photo on IRL → Uma double-taps it: liked once, a second double tap keeps it liked', async () => {
    const file = `${vera.id}/e2e-${run}.jpg`;
    must(await veraSb.storage.from('irl-media').upload(file, fs.readFileSync('public-photos/padel-480.jpg'), { contentType: 'image/jpeg' }));
    postId = must(await veraSb.from('irl_posts').insert({ author_id: vera.id, city_id: 'bali', area_id: 'canggu', body: `Padel photo ${run}`, media_path: file, visibility: 'everyone' }).select('id').single()).id;
    await page.goto(`${BASE}/live`);
    await visible(page, `Padel photo ${run}`, 20000);
    const card = page.locator('div').filter({ hasText: `Padel photo ${run}` }).filter({ has: page.getByLabel('Open photo') }).last();
    const photo = card.getByLabel('Open photo');
    await photo.dblclick();
    await card.getByRole('button', { name: 'Unlike' }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(1200);
    await photo.dblclick();
    await page.waitForTimeout(2500);
    const n = (await sql(`select count(*)::int as n from public.likes where target_type = 'irl_post' and target_id = '${postId}'`))[0].n;
    if (n !== 1) throw new Error(`likes: ${n}`);
    return card.getByRole('button', { name: 'Unlike' }).isVisible();
  });
  await step('… a tap opens the photo full screen, Escape sends it back', async () => {
    const card = page.locator('div').filter({ hasText: `Padel photo ${run}` }).filter({ has: page.getByLabel('Open photo') }).last();
    await card.getByLabel('Open photo').click();
    await page.getByLabel('Close photo').last().waitFor({ timeout: 10000 });
    await shot('photo-open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    return (await page.getByLabel('Close photo').count()) === 0;
  });
  // ───────── Coming soon: "Tell me when it opens" is stored on the account ─────────
  await step('IRLY VISA (coming soon): Uma asks to be told, the request is on her account; tapping again withdraws it', async () => {
    await page.goto(`${BASE}/soon/visa`);
    await visible(page, 'IRLY is not a government service');
    await page.getByRole('button', { name: 'Tell me when it opens' }).click();
    await page.getByRole('button', { name: 'We’ll tell you when it opens' }).waitFor({ timeout: 15000 });
    const on = (await sql(`select count(*)::int as n from public.service_interest where user_id = '${uma.id}' and service = 'visa'`))[0].n;
    if (on !== 1) throw new Error(`interest rows: ${on}`);
    await page.getByRole('button', { name: 'We’ll tell you when it opens' }).click();
    await page.getByRole('button', { name: 'Tell me when it opens' }).waitFor({ timeout: 15000 });
    const off = (await sql(`select count(*)::int as n from public.service_interest where user_id = '${uma.id}' and service = 'visa'`))[0].n;
    return off === 0;
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
    await page.getByRole('button', { name: 'Send', exact: true }).click();
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
    await page.getByLabel('Manage your activity').click();
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

  // ───────── One living system: what Vera does reaches Uma's open screens, no reload ─────────
  const liveTitle = `Live plan ${run}`;
  let veraAct;
  await step('Vera creates a plan → it appears on Uma\'s open Home, no reload', async () => {
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(2500);
    veraAct = must(
      await veraSb
        .from('activities')
        .insert({ creator_id: vera.id, title: liveTitle, category_id: 'sport', city_id: 'bali', area_id: 'canggu', place_name: 'Batu Bolong', starts_at: new Date(Date.now() + 2 * 86400_000).toISOString() })
        .select('id')
        .single(),
    ).id;
    await visible(page, liveTitle, 20000);
    return true;
  });
  await step('… and in search', async () => (await page.goto(`${BASE}/discover?q=${encodeURIComponent(liveTitle)}`), await visible(page, liveTitle), true));
  await step('Uma joins it → the plan\'s chat is in her inbox, the count says 2 going', async () => {
    await page.goto(`${BASE}/a/${veraAct}`);
    await page.getByRole('button', { name: 'Join', exact: true }).click();
    await visible(page, '2 going', 20000);
    await page.goto(`${BASE}/messages`);
    await visible(page, liveTitle, 20000);
    return true;
  });
  await step('Vera renames it and changes the place → Uma\'s open page shows both, no reload', async () => {
    await page.goto(`${BASE}/a/${veraAct}`);
    await visible(page, liveTitle);
    must(await veraSb.from('activities').update({ title: `${liveTitle} night`, place_name: 'Pererenan beach' }).eq('id', veraAct));
    await visible(page, `${liveTitle} night`, 20000);
    await visible(page, 'Pererenan beach', 20000);
    return true;
  });
  await step('… the chat is renamed too', async () => (await page.goto(`${BASE}/messages`), await visible(page, `${liveTitle} night`, 20000), true));
  await step('Vera deletes it → it leaves Uma\'s open Home and her inbox, no reload', async () => {
    await page.goto(`${BASE}/`);
    await visible(page, `${liveTitle} night`, 20000);
    must(await veraSb.rpc('delete_activity', { p_activity: veraAct }));
    await gone(page, `${liveTitle} night`);
    await page.goto(`${BASE}/messages`);
    await page.waitForTimeout(2500);
    return (await page.getByText(`${liveTitle} night`).count()) === 0;
  });
  const clubName = `Sync club ${run}`;
  let clubId;
  await step('Vera creates a community → it appears in Uma\'s open Communities list, no reload', async () => {
    await page.goto(`${BASE}/communities`);
    await page.waitForTimeout(2500);
    clubId = must(await veraSb.rpc('create_community', { p_name: clubName, p_city: 'bali' }));
    await visible(page, clubName, 20000);
    return true;
  });
  await step('… a double tap made one community, with one chat', async () => {
    const again = must(await veraSb.rpc('create_community', { p_name: clubName, p_city: 'bali' }));
    const [{ n }] = await sql(`select count(*)::int as n from public.communities where name = '${clubName}'`);
    const [{ c }] = await sql(`select count(*)::int as c from public.conversations v join public.communities m on m.id = v.community_id where m.name = '${clubName}'`);
    return again === clubId && n === 1 && c === 1;
  });
  await step('Uma joins it → its chat is in her inbox; Vera deletes it → gone from her list and inbox', async () => {
    await page.goto(`${BASE}/c/${clubId}`);
    await page.getByRole('button', { name: 'Join the community' }).click();
    await visible(page, 'Open chat');
    await page.goto(`${BASE}/messages`);
    await visible(page, clubName, 20000);
    await page.goto(`${BASE}/communities`);
    await visible(page, clubName, 20000);
    must(await veraSb.rpc('delete_community', { p_community: clubId }));
    await gone(page, clubName);
    await page.goto(`${BASE}/messages`);
    await page.waitForTimeout(2500);
    return (await page.getByText(clubName).count()) === 0;
  });

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
  await step('IRLY Girl home: the women-only feed shows Vera\'s post (same post as the community page)', async () => {
    await page.goto(`${BASE}/girl`);
    await page.getByText('Recent posts').scrollIntoViewIfNeeded({ timeout: 30000 });
    await visible(page, `Live from Vera ${run}`, 20000);
    return true;
  });
  await step('… Vera posts again → it appears live in Uma\'s open IRLY Girl feed; Uma likes it there → one like on the server', async () => {
    await page.waitForTimeout(1500);
    const body = `Girl feed live ${run}`;
    const [{ id: postId }] = must(await veraSb.from('community_posts').insert({ community_id: girlsId, author_id: vera.id, body }).select('id'));
    await visible(page, body, 20000);
    const card = page.locator('div').filter({ hasText: body }).filter({ has: page.getByRole('button', { name: 'Like', exact: true }) }).last();
    await card.getByRole('button', { name: 'Like', exact: true }).click();
    for (let i = 0; i < 20; i++) {
      const [{ n }] = await sql(`select count(*)::int as n from public.likes where target_type = 'community_post' and target_id = '${postId}' and user_id = '${uma.id}'`);
      if (n === 1) return true;
      await page.waitForTimeout(500);
    }
    return false;
  });
  await step('IRLY Girl filters: "This weekend" and "Free" never show an error, and an empty result invites to plan', async () => {
    await page.getByText("Girls' plans coming up").scrollIntoViewIfNeeded();
    // The plan composer above has its own "This weekend": the filters are the last ones.
    await page.getByRole('button', { name: 'This weekend', exact: true }).last().click();
    await page.getByRole('button', { name: 'Free', exact: true }).last().click();
    const plans = await page.getByText('Nothing planned here yet').count();
    const rows = await page.getByText(/\d+(\/\d+)? going/).count();
    return plans + rows > 0;
  });
  // Back to the community page for the assistant steps.
  await page.goto(`${BASE}/c/${girlsId}`);
  await page.waitForTimeout(1500);
  await step('assistant: "Poll: Saturday or Sunday?" → poll posted, Uma votes', async () => {
    await page.getByPlaceholder('Ask: organise brunch Sunday 11am…').fill('Poll: Saturday or Sunday?');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await page.getByRole('button', { name: 'Post this poll' }).click();
    await visible(page, 'Saturday or Sunday?');
    await page.getByRole('button', { name: 'Vote: Sunday' }).first().click();
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
    const notes = must(await veraSb.from('notifications').select('kind, payload').eq('kind', 'PRO_CONNECT_REQUEST'));
    if (!notes.some((n) => n.payload?.from === uma.id)) throw new Error('Vera did not get a Networking request notification');
    must(await veraSb.rpc('pro_connect', { p_user: uma.id }));
    await page.getByRole('button', { name: 'Message', exact: true }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'Message', exact: true }).first().click();
    await page.waitForURL(/\/messages\/[0-9a-f-]{36}/, { timeout: 20000 });
    return true;
  });
  await step('Uma\'s notifications: "Vera accepted your request" opens her professional profile', async () => {
    await page.goto(`${BASE}/notifications`);
    await page.getByText('Vera accepted your request', { exact: true }).first().click();
    await page.waitForURL(new RegExp(`/network/${vera.id}`), { timeout: 15000 });
    return true;
  });
  await step('Vera\'s professional page: why they should meet', async () => {
    await page.goto(`${BASE}/network/${vera.id}`);
    await visible(page, 'Why you should meet');
    await visible(page, 'Backing AI tools for clinics');
    await shot('network-profile');
    return true;
  });

  // ───────── Two members chat: unread, history, typing, report, edit profile, block ─────────
  let dm;
  const veraSays = `Hi Uma ${run}`;
  await step('Vera writes while Uma is elsewhere → the Messages badge counts it', async () => {
    dm = must(await veraSb.rpc('open_direct', { p_user: uma.id }));
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(2000);
    must(await veraSb.from('messages').insert({ conversation_id: dm, sender_id: vera.id, body: veraSays }));
    await page.getByLabel(/Messages, \d+ unread/).first().waitFor({ timeout: 20000 });
    return true;
  });
  await step('Uma opens the chat: the message is there, and still there after a reload', async () => {
    await page.goto(`${BASE}/messages/${dm}`);
    await visible(page, veraSays, 20000);
    await page.reload();
    await visible(page, veraSays, 20000);
    return true;
  });
  await step('Uma replies → Vera receives it, unread for her until she reads', async () => {
    await page.getByPlaceholder('Message').fill(`Reply to Vera ${run}`);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    for (let i = 0; i < 20; i++) {
      const inbox = must(await veraSb.rpc('my_conversations'));
      const row = inbox.find((c) => c.conversation_id === dm);
      if (row?.last_body === `Reply to Vera ${run}` && row.unread >= 1) {
        must(await veraSb.rpc('mark_conversation_read', { p_conversation: dm }));
        const after = must(await veraSb.rpc('my_conversations')).find((c) => c.conversation_id === dm);
        return after.unread === 0;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  });
  await step('Vera is typing → Uma sees "Vera is typing…"', async () => {
    const ch = veraSb.channel(`typing:${dm}`, { config: { broadcast: { self: false } } });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('typing channel did not join')), 15000);
      ch.subscribe((st) => st === 'SUBSCRIBED' && (clearTimeout(t), resolve()));
    });
    let seen = false;
    for (let i = 0; i < 10 && !seen; i++) {
      await ch.send({ type: 'broadcast', event: 'typing', payload: { uid: vera.id } });
      seen = await page.getByText('Vera is typing…').first().isVisible().catch(() => false);
      if (!seen) await new Promise((r) => setTimeout(r, 800));
    }
    await veraSb.removeChannel(ch);
    return seen;
  });
  await step('Uma reports Vera’s message as a scam (long press → Report)', async () => {
    const bubble = page.getByText(veraSays, { exact: true }).first();
    await bubble.hover();
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    await page.getByRole('radio', { name: 'Scam' }).click();
    await page.getByRole('button', { name: 'Send report' }).click();
    for (let i = 0; i < 20; i++) {
      const rows = await sql(`select category, target_kind from public.reports where reporter_id = '${uma.id}' and target_kind = 'message'`);
      if (rows.some((r) => r.category === 'scam')) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  });
  await step('Edit profile → the new bio is on the server', async () => {
    await page.goto(`${BASE}/edit-profile`);
    await page.getByLabel('Bio', { exact: true }).fill(`Building things in Bali ${run}`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    for (let i = 0; i < 20; i++) {
      const [row] = await sql(`select bio from public.profiles where id = '${uma.id}'`);
      if (row?.bio === `Building things in Bali ${run}`) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  });
  await step('Uma blocks Vera from the chat → it leaves her inbox and Vera can no longer write', async () => {
    await page.goto(`${BASE}/messages/${dm}`);
    await page.getByLabel('Safety: report or block').click();
    // (Confirmations are accepted by the page-wide handler.)
    await page.getByRole('button', { name: 'Block', exact: true }).click();
    for (let i = 0; i < 20; i++) {
      const [b] = await sql(`select count(*)::int as n from public.blocks where blocker_id = '${uma.id}' and blocked_id = '${vera.id}'`);
      if (b.n === 1) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    const sent = await veraSb.from('messages').insert({ conversation_id: dm, sender_id: vera.id, body: 'still here?' });
    if (!sent.error) throw new Error('a blocked member could still write');
    await page.goto(`${BASE}/messages`);
    await page.waitForTimeout(2500);
    return !(await page.getByText(`Reply to Vera ${run}`).first().isVisible().catch(() => false));
  });
  await step('Blocked members → Unblock Vera', async () => {
    await page.goto(`${BASE}/blocked`);
    await visible(page, 'Vera');
    // (Confirmations are accepted by the page-wide handler.)
    await page.getByRole('button', { name: 'Unblock' }).first().click();
    for (let i = 0; i < 20; i++) {
      const [b] = await sql(`select count(*)::int as n from public.blocks where blocker_id = '${uma.id}'`);
      if (b.n === 0) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  });

  // ───────── Messaging & social: profiles, follows, photos, groups ─────────
  // Vera accepts messages from people she shares a community with.
  await sql(`insert into public.safety_settings (user_id, who_can_message) values ('${vera.id}', 'everyone') on conflict (user_id) do update set who_can_message = 'everyone'`);
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAG0lEQVR42mP8z8BQz0AEYBxVSFUAAApzAf/3Kt4wAAAAAElFTkSuQmCC', 'base64');
  await step('Vera\'s profile opens from the app (a real member, not example data)', async () => {
    await page.goto(`${BASE}/person/${vera.id}`);
    await visible(page, 'Followers', 20000);
    await visible(page, 'Vera');
    return true;
  });
  await step('Follow → recorded once on the server, the button says Following, Vera has 1 follower', async () => {
    await page.getByRole('button', { name: 'Follow', exact: true }).click();
    await visible(page, 'Following', 15000);
    const [f] = await sql(`select count(*)::int as n from public.follows where follower_id = '${uma.id}' and followee_id = '${vera.id}'`);
    const prof = must(await veraSb.rpc('public_profile', { p_user: vera.id }))[0];
    const [n] = await sql(`select count(*)::int as n from public.notifications where user_id = '${vera.id}' and kind = 'NEW_FOLLOWER'`);
    return f.n === 1 && prof.followers === 1 && n.n === 1;
  });
  await step('… still following after a reload; the followers list shows Uma', async () => {
    await page.reload();
    await visible(page, 'Following', 20000);
    await page.getByRole('button', { name: /Followers/ }).first().click();
    // Uma sees herself in Vera's followers, shown as "You".
    await visible(page, 'You', 15000);
    return true;
  });
  await step('Unfollow → no follow left, no duplicate', async () => {
    await page.goto(`${BASE}/person/${vera.id}`);
    await page.getByRole('button', { name: 'Following', exact: true }).first().click();
    for (let i = 0; i < 20; i++) {
      const [f] = await sql(`select count(*)::int as n from public.follows where follower_id = '${uma.id}' and followee_id = '${vera.id}'`);
      if (f.n === 0) return true;
      await page.waitForTimeout(500);
    }
    return false;
  });
  let dmId = null;
  await step('Message from the profile → the private chat opens with Vera\'s name in the header', async () => {
    await page.getByRole('button', { name: 'Message', exact: true }).click();
    await page.waitForURL(/\/messages\/[0-9a-f-]{36}/, { timeout: 20000 });
    dmId = page.url().split('/messages/')[1].split('?')[0];
    await visible(page, 'Private · see profile', 15000);
    return true;
  });
  await step('Uma sends a photo (pick, preview, send) → stored and on the server; still there after a reload', async () => {
    await page.getByRole('button', { name: 'Send a photo' }).click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), page.getByRole('button', { name: 'Choose from my photos' }).click()]);
    await chooser.setFiles({ name: 'court.png', mimeType: 'image/png', buffer: PNG });
    await page.getByRole('button', { name: 'Send the photo' }).click({ timeout: 15000 });
    let row = null;
    for (let i = 0; i < 40 && !row; i++) {
      [row] = await sql(`select id, media_path from public.messages where conversation_id = '${dmId}' and kind = 'photo' and sender_id = '${uma.id}' order by created_at desc limit 1`);
      if (!row) await page.waitForTimeout(500);
    }
    if (!row?.media_path) return false;
    await page.reload();
    await page.locator('img[aria-label="Photo"], [aria-label="Photo"] img, img').filter({ visible: true }).first().waitFor({ timeout: 20000 });
    globalThis.__dmPhoto = row.media_path;
    return true;
  });
  await step('… Vera (member of the chat) can open the photo; Vera receives it in her inbox as a photo', async () => {
    const { data, error } = await veraSb.storage.from('chat-media').createSignedUrl(globalThis.__dmPhoto, 60);
    const inbox = must(await veraSb.rpc('my_conversations'));
    const c = inbox.find((x) => x.conversation_id === dmId);
    return !error && Boolean(data?.signedUrl) && c?.last_kind === 'photo';
  });
  await step('Tap the header → Vera\'s profile; Back → the same chat with its history', async () => {
    await page.getByRole('button', { name: /Open Vera’s profile/ }).first().click();
    await visible(page, 'Followers', 15000);
    await page.goBack();
    await page.waitForURL(new RegExp(`/messages/${dmId}`), { timeout: 15000 });
    await visible(page, 'Private · see profile', 15000);
    return true;
  });
  await step('Network cut while sending a photo → "Not sent · Retry"; back online, Retry → exactly one photo message', async () => {
    await page.goto(`${BASE}/messages/${dmId}`);
    await visible(page, 'Private · see profile', 15000);
    const [{ n: before }] = await sql(`select count(*)::int as n from public.messages where conversation_id = '${dmId}' and kind = 'photo'`);
    await page.getByRole('button', { name: 'Send a photo' }).click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), page.getByRole('button', { name: 'Choose from my photos' }).click()]);
    await chooser.setFiles({ name: 'offline.png', mimeType: 'image/png', buffer: PNG });
    await page.context().setOffline(true);
    await page.getByRole('button', { name: 'Send the photo' }).click({ timeout: 15000 });
    await visible(page, 'Not sent · Retry', 20000);
    await page.context().setOffline(false);
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Not sent. Retry' }).first().click();
    for (let i = 0; i < 40; i++) {
      const [{ n }] = await sql(`select count(*)::int as n from public.messages where conversation_id = '${dmId}' and kind = 'photo'`);
      if (n === before + 1) {
        await page.waitForTimeout(2000);
        const [{ n: after }] = await sql(`select count(*)::int as n from public.messages where conversation_id = '${dmId}' and kind = 'photo'`);
        return after === before + 1;
      }
      await page.waitForTimeout(500);
    }
    return false;
  });
  let groupId = null;
  await step('New group with Vera (name, people) → its chat opens; Vera has it in her inbox as a group', async () => {
    await page.goto(`${BASE}/group/new`);
    await page.getByPlaceholder('Group name').fill(`Padel crew ${run}`);
    await page.getByRole('checkbox', { name: 'Vera' }).click({ timeout: 20000 });
    await page.getByRole('button', { name: 'Create the group' }).click();
    await page.waitForURL(/\/messages\/[0-9a-f-]{36}/, { timeout: 20000 });
    groupId = page.url().split('/messages/')[1].split('?')[0];
    const inbox = must(await veraSb.rpc('my_conversations'));
    const g = inbox.find((x) => x.conversation_id === groupId);
    return g?.kind === 'group' && g.members === 2;
  });
  await step('Vera writes in the group → it appears live in Uma\'s open group chat', async () => {
    await page.waitForTimeout(1500);
    must(await veraSb.from('messages').insert({ conversation_id: groupId, sender_id: vera.id, body: `Group hello ${run}` }));
    await visible(page, `Group hello ${run}`, 20000);
    return true;
  });
  await step('Messages tabs: the group is under Groups, the chat with Vera under Private, never both', async () => {
    await page.goto(`${BASE}/messages`);
    await page.getByRole('tab', { name: /^Groups/ }).click();
    await visible(page, `Padel crew ${run}`, 20000);
    const vInGroups = await page.getByText('Vera', { exact: true }).filter({ visible: true }).count();
    await page.getByRole('tab', { name: /^Private/ }).click();
    await visible(page, 'Vera', 15000);
    const gInPrivate = await page.getByText(`Padel crew ${run}`).filter({ visible: true }).count();
    return vInGroups === 0 && gInPrivate === 0;
  });
  await step('Search finds the group by name', async () => {
    await page.getByRole('tab', { name: /^All/ }).click();
    await page.getByPlaceholder('Search conversations').fill('Padel crew');
    await visible(page, `Padel crew ${run}`, 10000);
    await page.getByPlaceholder('Search conversations').fill('');
    return true;
  });
  // Uma accepts messages from people she shares a community with (Vera adds her to a group).
  await sql(`insert into public.safety_settings (user_id, who_can_message) values ('${uma.id}', 'everyone') on conflict (user_id) do update set who_can_message = 'everyone'`);
  let photoGroup = null;
  await step('Vera creates a group with its photo → Uma sees it under Groups with that photo', async () => {
    const path1 = `${vera.id}/g1-${run}.png`;
    must(await veraSb.storage.from('activity-photos').upload(path1, PNG, { contentType: 'image/png', upsert: true }));
    photoGroup = must(await veraSb.rpc('create_group', { p_title: `Photo group ${run}`, p_members: [uma.id], p_photo: path1 }));
    await page.goto(`${BASE}/messages`);
    await page.getByRole('tab', { name: /^Groups/ }).click();
    await visible(page, `Photo group ${run}`, 20000);
    await page.locator(`img[src*="g1-${run}"]`).first().waitFor({ timeout: 20000 });
    return true;
  });
  await step('… Vera changes the group photo → Uma\'s open list shows the new one, no reload', async () => {
    const path2 = `${vera.id}/g2-${run}.png`;
    must(await veraSb.storage.from('activity-photos').upload(path2, PNG, { contentType: 'image/png', upsert: true }));
    must(await veraSb.rpc('set_conversation_photo', { p_conversation: photoGroup, p_path: path2 }));
    await page.locator(`img[src*="g2-${run}"]`).first().waitFor({ timeout: 25000 });
    return true;
  });
  let photoClub = null;
  await step('Community: Vera creates one, Uma joins → its chat is under Communities with the community\'s photo', async () => {
    photoClub = must(await veraSb.rpc('create_community', { p_name: `Photo club ${run}`, p_city: 'bali' }));
    const cover = `${vera.id}/c1-${run}.png`;
    must(await veraSb.storage.from('activity-photos').upload(cover, PNG, { contentType: 'image/png', upsert: true }));
    must(await veraSb.rpc('set_community_cover', { p_community: photoClub, p_path: cover }));
    await page.goto(`${BASE}/c/${photoClub}`);
    await page.getByRole('button', { name: 'Join the community' }).click();
    await visible(page, 'Open chat', 20000);
    await page.goto(`${BASE}/messages`);
    await page.getByRole('tab', { name: /^Communities/ }).click();
    await visible(page, `Photo club ${run}`, 20000);
    await page.locator(`img[src*="c1-${run}"]`).first().waitFor({ timeout: 20000 });
    return true;
  });
  await step('… Vera renames the community → the chat\'s name follows in Uma\'s open list, no reload', async () => {
    must(await veraSb.from('communities').update({ name: `Photo club ${run} Bali` }).eq('id', photoClub));
    await visible(page, `Photo club ${run} Bali`, 25000);
    must(await veraSb.rpc('delete_community', { p_community: photoClub }));
    return true;
  });
  await step('Access: someone outside the group cannot read it, nor open its photos', async () => {
    // Vera leaves; she can no longer read the group or a photo sent in it.
    must(await veraSb.rpc('leave_group', { p_conversation: groupId }));
    const { data: msgs } = await veraSb.from('messages').select('id').eq('conversation_id', groupId);
    return (msgs ?? []).length === 0;
  });

  // ───────── 1. Paths: every screen opens ─────────
  const areas = (await sql(`select id from public.areas where city_id = 'bali' order by sort`)).map((r) => r.id);
  const sections = ['visa', 'housing', 'banking', 'sim', 'internet', 'transport', 'healthcare', 'insurance', 'schools', 'childcare', 'work', 'coworking', 'business', 'accounting', 'tax', 'legal', 'real_estate', 'moving', 'pets', 'services'];
  const categories = ['sport', 'networking', 'food', 'travel', 'outdoor', 'shopping', 'culture', 'entertainment', 'nightlife', 'wellness', 'animals', 'family', 'creative', 'learning', 'girl'];
  const kinds = ['padel', 'football', 'tennis', 'running', 'yoga', 'surf', 'hiking', 'wellness', 'beach', 'networking'];
  const places = (await sql(`select slug from public.places where city_id = 'bali' limit 8`)).map((r) => r.slug);
  const screens = [
    '/', '/discover', '/soon/pro', '/soon/bonplan', '/soon/visa', '/soon/location', '/live', '/map', '/messages', '/profile', '/social', '/account', '/assistant', '/business', '/calendar', '/communities',
    '/community/new', '/design-system', '/eat', '/events', '/match', '/notifications', '/saved', '/services', '/settings', '/activities',
    '/network', '/network/profile', `/network/${vera.id}`, '/group/new', `/follows/${vera.id}`, `/person/${vera.id}`, '/bali', '/bali/move', '/bali/quiz', '/bali/test', '/girl', '/girl/moving', `/a/${actId}`, `/messages/${conv}`, `/c/${girlsId}`,
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
  // ───────── Last: Uma deletes her account from the app ─────────
  await step('Delete account (Profile → Delete account): server data gone, back to the start', async () => {
    await page.goto(`${BASE}/profile`);
    await page.getByLabel('Delete account', { exact: true }).click();
    await page.getByRole('button', { name: 'Delete my account' }).click();
    await page.waitForURL(/welcome/, { timeout: 30000 });
    const [p] = await sql(`select count(*)::int as n from public.profiles where id = '${uma.id}'`);
    const [u] = await sql(`select count(*)::int as n from auth.users where id = '${uma.id}'`);
    const [m] = await sql(`select count(*)::int as n from public.messages where sender_id = '${uma.id}'`);
    const [f] = await sql(`select count(*)::int as n from storage.objects where (storage.foldername(name))[1] = '${uma.id}'`);
    if (p.n || u.n || m.n || f.n) throw new Error(`left behind: profile ${p.n}, user ${u.n}, messages ${m.n}, files ${f.n}`);
    // The old session no longer works.
    const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('auth-token')).length);
    return stored === 0;
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
