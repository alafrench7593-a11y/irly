// IRLY Girl, walked like a new member would, in a real browser against the
// live backend. Three throwaway accounts: Lea (a woman who just signed up,
// no IRLY Match profile), Mia (another woman) and Max (a man). They are
// deleted at the end; nothing else in the database is touched.
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

async function createMember(name, gender) {
  const email = `e2e-girl-${run}-${name.toLowerCase()}@irly.test`;
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
  // Only the IRLY profile a new member has after signing up: no IRLY Match onboarding, no Match profile.
  await sql(`insert into public.profiles (id, first_name, birthdate, gender, city_id, languages) values ('${id}', '${name}', '1995-04-04', '${gender}', 'dubai', '{en,fr}')`);
  const sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign in ${name}: ${error.message}`);
  return { id, email, name, gender, sb };
}

const cleanup = () =>
  sql(`delete from auth.users where email like 'e2e-girl-${run}-%@irly.test'
    or (email like 'e2e-girl-%@irly.test' and created_at < now() - interval '2 hours')`).catch(() => undefined);

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const server = http
  .createServer((req, res) => {
    let file = path.join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(8083);
const BASE = 'http://localhost:8083';

let passed = 0;
let failed = 0;
let shot = 0;
const failures = [];
let page = null;
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
    if (page) {
      const seen = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 600)).catch(() => '');
      console.log(`   url: ${page.url()}\n   screen: ${seen}`);
    }
  }
  if (page) await page.screenshot({ path: path.join(SHOTS, `girl-${String(++shot).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.png`) }).catch(() => undefined);
}
const must = (r) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
const pathOf = () => new URL(page.url()).pathname;
// IRLY Girl is a space of the same app (src/app/girl/index.tsx): /girl asks the server, switches the
// app to IRLY Girl and lands on Home (IRLY Girl's content, and the way back to IRLY Mixte).
const spaceOf = () => page.evaluate(() => JSON.parse(localStorage.getItem('irly-space') ?? '{}')?.state?.space ?? 'mixte');
async function inGirl() {
  for (let i = 0; i < 30 && (await spaceOf()) !== 'girl'; i++) await page.waitForTimeout(500);
  return (await spaceOf()) === 'girl';
}
// A plan made from the Create form in IRLY Girl: a category page, its kind, a neighbourhood, tomorrow at 20:30.
async function createInGirl({ category, kind, title, double = false }) {
  await page.goto(`${BASE}/category/${category}`);
  await page.getByText(kind, { exact: true }).first().click({ timeout: 25000 });
  await page.getByRole('button', { name: new RegExp(`^Create an? ${kind} session$`) }).first().click();
  await page.getByRole('button', { name: 'Choose a neighbourhood' }).click();
  await page.getByPlaceholder('Search a neighbourhood').fill('Dubai Marina');
  await page.getByRole('radio', { name: /^Dubai Marina/ }).first().click();
  await page.getByRole('button', { name: 'Pick a date and time' }).click();
  await page.getByRole('button').filter({ hasText: 'Tomorrow' }).first().click();
  await page.getByLabel('Hour', { exact: true }).getByText('20', { exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('Minutes', { exact: true }).getByText('30', { exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Tomorrow · 20:30' }).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Next', exact: true }).filter({ visible: true }).last().click();
  if (title) await page.getByLabel('Name of the activity').fill(title);
  // Create takes the place of Next: a tap on it within 450 ms is the same tap landing twice (PressableScale), dropped.
  await page.waitForTimeout(800);
  const create = page.getByRole('button', { name: /^Create (session|activity|sport session|event|meetup|trip)$/ }).last();
  await (double ? create.dblclick() : create.click());
  // On the plan, or the form's own message saying why it was not published.
  await page.waitForURL(/\/a\//, { timeout: 25000 }).catch(async (e) => {
    const why = await page.getByText(/^Not published: /).first().textContent({ timeout: 1000 }).catch(() => null);
    throw why ? new Error(why) : e;
  });
}

async function signIn(browser, who) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  await p.goto(BASE);
  await p.evaluate(
    ({ name, gender }) => {
      localStorage.setItem('irly-v2', JSON.stringify({ state: { onboarded: true, storySeen: 99, communityIntroSeen: true, destinationId: 'dubai', cityId: 'dubai', profile: { name, types: [], interests: [], activities: [], languages: ['English'], lookingFor: [], gender, age: 30 } }, version: 1 }));
      localStorage.setItem('irly-lang', JSON.stringify({ state: { setting: 'en' }, version: 0 }));
    },
    { name: who.name, gender: who.gender },
  );
  await p.goto(`${BASE}/account`);
  await p.getByPlaceholder('you@email.com').fill(who.email);
  await p.getByPlaceholder('Password').fill(PASSWORD);
  await p.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await p.getByText('Signed in', { exact: true }).first().waitFor({ timeout: 20000 });
  return p;
}

async function main() {
  await cleanup();
  const lea = await createMember('Lea', 'woman');
  const mia = await createMember('Mia', 'woman');
  const max = await createMember('Max', 'man');
  // When the run started (database clock): IRLY Maman must never make a community by itself.
  const [{ started }] = await sql('select now() as started');
  const browser = await chromium.launch();
  page = await signIn(browser, lea);

  // ───────── Opening IRLY Girl as a new member ─────────
  await step('Lea opens IRLY Girl: it opens directly, no IRLY Match sign-up first', async () => {
    await page.goto(`${BASE}/girl`);
    await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 25000 });
    if (!(await inGirl())) throw new Error('the app did not switch to IRLY Girl');
    // IRLY Girl's Home: the way back to IRLY Mixte is there.
    await page.getByText('IRLY Mixte', { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 25000 });
    await page.waitForTimeout(1500);
    return pathOf() === '/';
  });
  await step('… IRLY Match is announced as coming soon, and its old sign-up pages lead back to IRLY Girl', async () => {
    await page.goto(`${BASE}/discover?tab=people`);
    await page.getByText('IRLY Match is coming soon').filter({ visible: true }).first().waitFor({ timeout: 25000 });
    await page.goto(`${BASE}/girl/onboarding`);
    await page.waitForTimeout(3000);
    const a = pathOf();
    await page.goto(`${BASE}/girl/profile`);
    await page.waitForTimeout(3000);
    return a === '/' && pathOf() === '/' && (await spaceOf()) === 'girl';
  });
  await step('… nothing was created for IRLY Match on her account by opening IRLY Girl', async () => {
    const [{ n }] = await sql(`select (select count(*) from public.irly_match_profiles where user_id = '${lea.id}') + (select count(*) from public.irly_match_onboarding where user_id = '${lea.id}') as n`);
    return Number(n) === 0;
  });

  // ───────── Planning a girl trip ─────────
  let tripId = null;
  await step('Lea plans a girl trip to Oman at 20:30 from IRLY Girl\'s Create form → she lands on the plan', async () => {
    await createInGirl({ category: 'travel', kind: 'Oman', title: 'Girl trip · Oman' });
    tripId = pathOf().split('/').pop();
    return Boolean(tripId);
  });
  await step('… on the server: women only, girls audience, Oman, 20:30 Dubai time', async () => {
    if (!tripId) throw new Error('no plan was created');
    const [a] = await sql(`select girl_only, audience, title, to_char(starts_at at time zone 'Asia/Dubai', 'HH24:MI') as t from public.activities where id = '${tripId}'`);
    console.log(`   ${a?.title} · ${a?.t} · girl_only=${a?.girl_only} · ${a?.audience}`);
    return a?.girl_only === true && a.audience === 'girls' && /Oman/.test(a.title) && a.t === '20:30';
  });
  await step('A double tap on Create makes one pilates plan, not two', async () => {
    await createInGirl({ category: 'sport', kind: 'Pilates', double: true });
    await page.waitForTimeout(3000);
    const [{ n }] = await sql(`select count(*)::int as n from public.activities where creator_id = '${lea.id}' and title ilike '%pilates%'`);
    return n === 1;
  });

  // ───────── Another woman joins; a man cannot ─────────
  await step('Mia joins Lea’s girl trip → Lea’s open plan says 2 going', async () => {
    must(await mia.sb.rpc('join_activity', { p_activity: tripId, p_status: 'going' }));
    await page.goto(`${BASE}/a/${tripId}`);
    // A plan from the Create form has spots (« 2 / 6 going »).
    await page.getByText(/\b2( \/ \d+)? going/).first().waitFor({ timeout: 20000 });
    return true;
  });
  await step('Max (a man) cannot see the girl trip, nor join it, even through the API', async () => {
    const seen = must(await max.sb.from('activities').select('id').eq('id', tripId));
    const join = await max.sb.rpc('join_activity', { p_activity: tripId, p_status: 'going' });
    const people = must(await max.sb.from('activity_participants').select('user_id').eq('activity_id', tripId));
    return seen.length === 0 && Boolean(join.error) && people.length === 0;
  });
  await step('Mia comments on the trip; Lea reads it; Max reads nothing', async () => {
    must(await mia.sb.from('comments').insert({ author_id: mia.id, target_type: 'activity', target_id: tripId, body: `Oman, yes! ${run}` }));
    const forLea = must(await lea.sb.from('comments').select('id').eq('target_id', tripId));
    const forMax = must(await max.sb.from('comments').select('id').eq('target_id', tripId));
    return forLea.length === 1 && forMax.length === 0;
  });
  await step('Security fix live: a plan a man joined cannot be turned women-only afterwards', async () => {
    const [act] = must(await lea.sb.from('activities').insert({ creator_id: lea.id, title: `Open coffee ${run}`, category_id: 'food', city_id: 'dubai', area_id: 'marina', starts_at: new Date(Date.now() + 3 * 864e5).toISOString() }).select('id'));
    must(await max.sb.rpc('join_activity', { p_activity: act.id, p_status: 'going' }));
    const flip = await lea.sb.from('activities').update({ girl_only: true, audience: 'girls' }).eq('id', act.id);
    const [a] = await sql(`select girl_only from public.activities where id = '${act.id}'`);
    console.log(`   refused: ${flip.error?.message ?? 'no'}`);
    return Boolean(flip.error) && a.girl_only === false;
  });

  // ───────── A women-only community and its chat ─────────
  let clubId = null;
  await step('Mia creates a women-only community; Lea joins it from its page and opens its chat', async () => {
    clubId = must(await mia.sb.rpc('create_community', { p_name: `Girls Padel ${run}`, p_city: 'dubai', p_girl_only: true }));
    await page.goto(`${BASE}/c/${clubId}`);
    await page.getByRole('button', { name: 'Join the community' }).click({ timeout: 25000 });
    await page.getByText('Open chat', { exact: true }).first().click({ timeout: 20000 });
    await page.waitForURL(/\/messages\//, { timeout: 25000 });
    return true;
  });
  await step('… Lea writes in the community chat → Mia receives it; Max cannot read it', async () => {
    const body = `Who plays Saturday? ${run}`;
    const box = page.getByPlaceholder(/Message/).first();
    await box.fill(body);
    await box.press('Enter');
    const [{ conv }] = await sql(`select id as conv from public.conversations where community_id = '${clubId}'`);
    for (let i = 0; i < 20; i++) {
      const got = must(await mia.sb.from('messages').select('id').eq('conversation_id', conv).eq('body', body));
      if (got.length === 1) {
        const leak = must(await max.sb.from('messages').select('id').eq('conversation_id', conv));
        const join = await max.sb.rpc('join_community', { p_community: clubId });
        return leak.length === 0 && Boolean(join.error);
      }
      await page.waitForTimeout(500);
    }
    return false;
  });

  // ───────── Creating a community from IRLY Girl, end to end ─────────
  let circleId = null;
  const circleName = `Book & Matcha ${run}`;
  await step('Lea creates a community from IRLY Girl (name, line, about, city, women only) → it opens', async () => {
    await page.goto(`${BASE}/girl`);
    await page.locator('[aria-label="Create a community"]').first().click({ timeout: 25000 });
    await page.waitForURL(/\/girl\/new-community/, { timeout: 20000 });
    await page.locator('[aria-label="Community name"]').fill(circleName);
    await page.locator('[aria-label="Tagline"]').fill('One book a month');
    await page.locator('[aria-label="Description"]').fill('A café, a book, good conversations.');
    await page.getByRole('button', { name: 'Create the community' }).click();
    await page.waitForURL(/\/c\//, { timeout: 30000 });
    circleId = pathOf().split('/').pop();
    return Boolean(circleId);
  });
  await step('… on the server: women only, Lea owner, one member, its chat exists', async () => {
    const [c] = await sql(`select girl_only, created_by, members_count, (select role from public.community_members where community_id = c.id and user_id = '${lea.id}') as role,
      (select count(*)::int from public.conversations where community_id = c.id) as chats from public.communities c where id = '${circleId}'`);
    console.log(`   girl_only=${c?.girl_only} role=${c?.role} members=${c?.members_count} chats=${c?.chats}`);
    return c?.girl_only === true && c.created_by === lea.id && c.role === 'owner' && c.members_count === 1 && c.chats === 1;
  });
  await step('… back in IRLY Girl it is in the communities list, and still there after a reload', async () => {
    await page.goto(`${BASE}/girl`);
    await page.getByText(circleName).first().waitFor({ timeout: 25000 });
    await page.reload();
    await page.getByText(circleName).first().waitFor({ timeout: 25000 });
    return true;
  });
  await step('Mia sees it in her IRLY Girl list, joins → 2 members for both', async () => {
    const list = must(await mia.sb.from('communities').select('id').eq('girl_only', true).eq('id', circleId));
    must(await mia.sb.rpc('join_community', { p_community: circleId }));
    const [c] = await sql(`select members_count from public.communities where id = '${circleId}'`);
    const forLea = must(await lea.sb.from('communities').select('members_count').eq('id', circleId));
    return list.length === 1 && c.members_count === 2 && forLea[0]?.members_count === 2;
  });
  await step('Chat both ways: Mia writes → Lea sees it live in the community chat; Lea replies → Mia receives it', async () => {
    const [{ conv }] = await sql(`select id as conv from public.conversations where community_id = '${circleId}'`);
    await page.goto(`${BASE}/messages/${conv}`);
    await page.getByPlaceholder(/Message/).first().waitFor({ timeout: 25000 });
    const hello = `Hello from Mia ${run}`;
    must(await mia.sb.from('messages').insert({ conversation_id: conv, sender_id: mia.id, body: hello }));
    await page.getByText(hello).first().waitFor({ timeout: 20000 });
    const reply = `Welcome Mia ${run}`;
    const box = page.getByPlaceholder(/Message/).first();
    await box.fill(reply);
    await box.press('Enter');
    for (let i = 0; i < 20; i++) {
      const got = must(await mia.sb.from('messages').select('id').eq('conversation_id', conv).eq('body', reply));
      if (got.length === 1) return true;
      await page.waitForTimeout(500);
    }
    return false;
  });
  await step('Max cannot see the new community, its members or its chat', async () => {
    const seen = must(await max.sb.from('communities').select('id').eq('id', circleId));
    const [{ conv }] = await sql(`select id as conv from public.conversations where community_id = '${circleId}'`);
    const msgs = must(await max.sb.from('messages').select('id').eq('conversation_id', conv));
    return seen.length === 0 && msgs.length === 0;
  });
  await step('Messages are one tap away in IRLY Girl: the header button opens the same inbox as IRLY', async () => {
    await page.goto(`${BASE}/girl`);
    await page.locator('[aria-label^="Messages"]').first().click({ timeout: 25000 });
    await page.waitForURL(/\/messages$/, { timeout: 20000 });
    // The IRLY Girl screen stays mounted under the inbox (its own tile has the same name): look at what is on screen.
    await page.getByText(circleName).filter({ visible: true }).first().waitFor({ timeout: 20000 });
    return true;
  });
  // IRLY Girl has the same Home as IRLY now (no separate « Your messages » block): the inbox row opens the chat.
  await step('… and in that inbox the conversation opens the community chat', async () => {
    const [{ conv }] = await sql(`select id as conv from public.conversations where community_id = '${circleId}'`);
    await page.goto(`${BASE}/messages`);
    await page.getByRole('button', { name: new RegExp(`^${circleName}`) }).filter({ visible: true }).first().click({ timeout: 20000 });
    await page.waitForURL(new RegExp(`/messages/${conv}`), { timeout: 20000 });
    await page.getByText(`Welcome Mia ${run}`).filter({ visible: true }).first().waitFor({ timeout: 20000 });
    return true;
  });
  await step('Lea logs out and back in: her community and its conversation are still there', async () => {
    await page.context().close();
    page = await signIn(browser, lea);
    await page.goto(`${BASE}/girl`);
    await page.getByText(circleName).first().waitFor({ timeout: 25000 });
    await page.goto(`${BASE}/messages`);
    await page.getByText(circleName).first().waitFor({ timeout: 25000 });
    return true;
  });

  // ───────── Moms ─────────
  await step('Moms: a new member can turn Mom mode on (her IRLY Girl profile is created for it, and she can be found)', async () => {
    await page.goto(`${BASE}/girl?mode=moms`);
    await page.getByText('Mom mode', { exact: true }).first().waitFor({ timeout: 25000 });
    await page.getByRole('button', { name: 'Off', exact: true }).first().click();
    for (let i = 0; i < 20; i++) {
      const [p] = await sql(`select mom_mode, visible from public.irly_match_profiles where user_id = '${lea.id}'`);
      if (p?.mom_mode) return p.visible === true;
      await page.waitForTimeout(500);
    }
    return false;
  });

  await step('Maman: a child is an age group only (« Toddler » saved, no name, no birthday)', async () => {
    await page.getByRole('button', { name: 'Toddler', exact: true }).first().click({ timeout: 25000 });
    for (let i = 0; i < 20; i++) {
      const [p] = await sql(`select kids_age_groups from public.irly_match_profiles where user_id = '${lea.id}'`);
      if (p?.kids_age_groups?.includes('toddler')) return p.kids_age_groups.every((k) => ['baby', 'toddler', 'kid', 'teen'].includes(k));
      await page.waitForTimeout(500);
    }
    return false;
  });
  await step('Maman: the official community is « IRLY Maman », once, and opening Maman created no community', async () => {
    await page.getByText('Mom communities', { exact: true }).first().waitFor({ timeout: 25000 });
    await page.getByRole('button', { name: 'Open IRLY Maman', exact: true }).first().waitFor({ timeout: 25000 });
    const official = await sql(`select name from public.communities where official and topic = 'moms' and city_id = 'dubai' and parent_id is null and deleted_at is null`);
    const [{ made }] = await sql(`select count(*)::int as made from public.communities
      where created_at >= '${started}' and (official or created_by in ('${lea.id}', '${mia.id}', '${max.id}'))`);
    return official.length === 1 && official[0].name === 'IRLY Maman' && made === 0;
  });
  await step('Maman: Max (a man) gets no mom from the server, and so no child age group', async () => {
    const r = await max.sb.rpc('girl_circle', { p_destination: 'dubai', p_moms: true });
    return Boolean(r.error) || !(r.data ?? []).some((m) => m.user_id === lea.id || (m.kids_age_groups ?? []).length > 0);
  });

  // ───────── Changing account on the same browser ─────────
  await step('Lea logs out; Max signs in on the same browser: IRLY Girl is closed to him, nothing of Lea shows', async () => {
    await page.context().close();
    page = await signIn(browser, max);
    await page.goto(`${BASE}/girl`);
    await page.getByText(/reserved for women/i).first().waitFor({ timeout: 25000 });
    const text = await page.evaluate(() => document.body.innerText);
    return !text.includes('Girl trip · Oman') && !text.includes(`Girls Padel ${run}`);
  });
  await step('… and a direct link to Lea’s girl trip shows him nothing of it', async () => {
    await page.goto(`${BASE}/a/${tripId}`);
    await page.waitForTimeout(5000);
    const text = await page.evaluate(() => document.body.innerText);
    return !text.includes('Oman') && !text.includes('Mia');
  });

  console.log(`\nBrowser errors: ${(page.errors ?? []).length}`);
  await browser.close();
}

try {
  await main();
} catch (e) {
  failed++;
  console.log(`✗ setup: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await cleanup();
  server.close();
  console.log(`\n${passed} passed, ${failed} failed${failures.length ? `\nFailed: ${failures.join(' | ')}` : ''}`);
  process.exit(failed ? 1 : 0);
}
