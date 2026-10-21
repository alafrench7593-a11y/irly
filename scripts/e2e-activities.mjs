// End-to-end: activities proposed in communities, shared into chats as live
// cards, and their own chats, against the LIVE IRLY Supabase project through
// the public API and row level security the app uses (publishable key, real
// sign-in). Throwaway members only, deleted at the end:
//   Alice (woman) organises, Bea (woman) joins, Carl (man) is the
//   unauthorised account (not in the community, no IRLY Girl access).
//
// Steps marked [20261028200000] read activity_cards / community_activity_cards
// or the deduplicated update notices: they pass only once that migration is
// deployed to production (merge to main → .github/workflows/supabase.yml).
//
// Env: SUPABASE_ACCESS_TOKEN (sbp_..., to create/confirm/delete the test
// accounts through the Management API), SUPABASE_PROJECT_REF.
// Run by .github/workflows/e2e.yml (the cloud dev box cannot reach Supabase).
import { createClient } from '@supabase/supabase-js';

const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
const URL = `https://${ref}.supabase.co`;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_hOfFpr32TkUPj0G880vNgw_fqz2CK0v';
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').match(/sbp_[^\s"'`]+/)?.[0];
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN missing');
  process.exit(1);
}

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

const run = Date.now().toString(36);
const PASSWORD = `E2e-${run}-pw!`;
const people = {
  alice: { email: `e2e-${run}-act-alice@irly.test`, name: 'Alice', gender: 'woman' },
  bea: { email: `e2e-${run}-act-bea@irly.test`, name: 'Bea', gender: 'woman' },
  carl: { email: `e2e-${run}-act-carl@irly.test`, name: 'Carl', gender: 'man' },
};

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
    console.log(`✗ ${label}: ${e instanceof Error ? e.message : e}`);
  }
}
const must = (r) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createUser(p) {
  const rows = await sql(`
    with u as (
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
      values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${p.email}',
        extensions.crypt('${PASSWORD}', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
      returning id
    )
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    select gen_random_uuid(), u.id, u.id::text, 'email', jsonb_build_object('sub', u.id::text, 'email', '${p.email}', 'email_verified', true), now(), now(), now()
    from u returning user_id`);
  p.id = rows[0].user_id;
  p.sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  must(await p.sb.auth.signInWithPassword({ email: p.email, password: PASSWORD }));
  must(await p.sb.from('profiles').insert({ id: p.id, first_name: p.name, birthdate: '1994-01-01', gender: p.gender, city_id: 'dubai', languages: ['en'], interests: ['sport', 'food'] }));
}

// Only this run's accounts: the other suites sweep abandoned e2e-* accounts themselves.
const cleanup = () => sql(`delete from auth.users where email like 'e2e-${run}-act-%@irly.test'`).catch((e) => console.log('cleanup:', e.message));

const { alice: A, bea: B, carl: C } = people;
const inDays = (d, h = 14) => {
  const x = new Date(Date.now() + d * 86400000);
  x.setUTCHours(h, 0, 0, 0);
  return x.toISOString();
};
const card = async (p, id) => (must(await p.sb.rpc('activity_cards', { p_ids: [id] })) ?? [])[0] ?? null;

try {
  await step('3 throwaway members sign in (Alice, Bea: women; Carl: man)', async () => {
    for (const p of Object.values(people)) await createUser(p);
    return true;
  });

  const ids = {};
  // ───── B. Proposed from a community → in its feed and in the central activities ─────
  await step('B: Alice creates a Mixte and an IRLY Girl community; Bea joins both', async () => {
    ids.mixte = must(await A.sb.rpc('create_community', { p_name: `E2E Padel ${run}`, p_city: 'dubai', p_tagline: null, p_description: null, p_category: 'sport', p_girl_only: false }));
    ids.girl = must(await A.sb.rpc('create_community', { p_name: `E2E Girls Yoga ${run}`, p_city: 'dubai', p_tagline: null, p_description: null, p_category: 'sport', p_girl_only: true }));
    must(await B.sb.rpc('join_community', { p_community: ids.mixte }));
    must(await B.sb.rpc('join_community', { p_community: ids.girl }));
    ids.mixteChat = must(await B.sb.from('conversations').select('id').eq('community_id', ids.mixte).single()).id;
    ids.girlChat = must(await B.sb.from('conversations').select('id').eq('community_id', ids.girl).single()).id;
    return Boolean(ids.mixte && ids.girl && ids.mixteChat && ids.girlChat);
  });
  await step('B: « + Propose an activity » in the community → one record linked to it (Dubai time)', async () => {
    const a = must(await A.sb.from('activities').insert({
      creator_id: A.id, title: `E2E padel doubles ${run}`, description: 'Two courts', category_id: 'sport', city_id: 'dubai', area_id: 'marina',
      place_name: 'Marina Padel Club', starts_at: inDays(3), ends_at: inDays(3, 16), price_minor: 5000, currency: 'AED', capacity: 2,
      privacy: 'community', community_id: ids.mixte,
    }).select('id, community_id, timezone').single());
    ids.act = a.id;
    return a.community_id === ids.mixte && a.timezone === 'Asia/Dubai';
  });
  await step('B: in the central activities for a member (one row, not a copy)', async () => {
    const rows = must(await B.sb.from('activities').select('id').eq('title', `E2E padel doubles ${run}`));
    return rows.length === 1 && rows[0].id === ids.act;
  });
  await step('B: in the community Activities tab', async () => must(await B.sb.rpc('community_activities', { p_community: ids.mixte })).some((r) => r.id === ids.act));
  await step('B [20261028200000]: in the community feed as an activity card (place, price, organiser, 1/2, open)', async () => {
    const r = must(await B.sb.rpc('community_activity_cards', { p_community: ids.mixte })).find((x) => x.id === ids.act);
    return Boolean(r) && r.place_name === 'Marina Padel Club' && r.price_minor === 5000 && r.creator_name === 'Alice' && r.going === 1 && r.capacity === 2 && r.status === 'upcoming';
  });
  await step('B: in Alice\'s calendar (another section)', async () => must(await A.sb.rpc('my_calendar', {})).some((r) => r.id === ids.act));

  // ───── C. A second account joins → count, chat access ─────
  await step('C: Bea joins (twice: still one participation)', async () => {
    const r1 = must(await B.sb.rpc('join_activity', { p_activity: ids.act, p_status: 'going' }));
    const r2 = must(await B.sb.rpc('join_activity', { p_activity: ids.act, p_status: 'going' }));
    const [n] = await sql(`select count(*)::int as n from public.activity_participants where activity_id = '${ids.act}' and user_id = '${B.id}'`);
    return r1 === 'going' && r2 === 'going' && n.n === 1;
  });
  await step('C: the page counts 2/2 and Bea has the activity chat', async () => {
    const d = must(await B.sb.rpc('activity_detail', { p_id: ids.act }))[0];
    ids.actChat = d.conversation_id;
    return d.going === 2 && d.my_status === 'going' && Boolean(d.conversation_id);
  });
  await step('C: full: a third member cannot join (capacity)', async () => {
    // Carl joins the Mixte community to try (he still is not going).
    must(await C.sb.rpc('join_community', { p_community: ids.mixte }));
    const r = must(await C.sb.rpc('join_activity', { p_activity: ids.act, p_status: 'going' }));
    const chat = must(await C.sb.from('conversations').select('id').eq('activity_id', ids.act));
    must(await C.sb.rpc('leave_community', { p_community: ids.mixte }));
    return r === 'full' && chat.length === 0;
  });
  await step('C: Alice is told once that Bea joined', async () => {
    const [n] = await sql(`select count(*)::int as n from public.notifications where user_id = '${A.id}' and kind = 'ACTIVITY_JOINED' and payload ->> 'activity_id' = '${ids.act}'`);
    return n.n === 1;
  });

  // ───── D. Share as a card → the other account opens the right activity; message in the activity chat ─────
  await step('D: Alice shares the activity in the community chat (structured message, no copy)', async () => {
    ids.share = must(await A.sb.rpc('share_to_chat', { p_conversation: ids.mixteChat, p_type: 'activity', p_id: ids.act, p_title: `E2E padel doubles ${run}` }));
    const m = must(await B.sb.from('messages').select('kind, ref_type, ref_id').eq('id', ids.share).single());
    return m.kind === 'share' && m.ref_type === 'activity' && m.ref_id === ids.act;
  });
  await step('D [20261028200000]: Bea\'s card resolves to that activity, live (title, place, 2/2)', async () => {
    const c = await card(B, ids.act);
    return Boolean(c) && c.id === ids.act && c.place_name === 'Marina Padel Club' && c.going === 2;
  });
  await step('D: a message in the activity chat reaches Bea (and is notified to her)', async () => {
    must(await A.sb.from('messages').insert({ conversation_id: ids.actChat, sender_id: A.id, kind: 'text', body: `See you at court 3 ${run}` }));
    const got = must(await B.sb.from('messages').select('body').eq('conversation_id', ids.actChat));
    const [n] = await sql(`select count(*)::int as n from public.notifications where user_id = '${B.id}' and kind = 'MESSAGE_CREATED' and payload ->> 'conversation_id' = '${ids.actChat}'`);
    return got.some((m) => m.body === `See you at court 3 ${run}`) && n.n >= 1;
  });

  // ───── E. Edit → everywhere; cancel → state + notification; history kept ─────
  await step('E: Bea (not the organiser) cannot edit or cancel', async () => {
    const e = must(await B.sb.from('activities').update({ place_name: 'Hijack' }).eq('id', ids.act).select('id'));
    const c = must(await B.sb.from('activities').update({ cancelled_at: new Date().toISOString() }).eq('id', ids.act).select('id'));
    return e.length === 0 && c.length === 0;
  });
  await step('E: Alice moves the date and the place → page, list and Activities tab read the new version', async () => {
    must(await A.sb.from('activities').update({ starts_at: inDays(4), ends_at: inDays(4, 16) }).eq('id', ids.act));
    must(await A.sb.from('activities').update({ place_name: 'JLT Padel, court 3' }).eq('id', ids.act));
    const d = must(await B.sb.rpc('activity_detail', { p_id: ids.act }))[0];
    const tab = must(await B.sb.rpc('community_activities', { p_community: ids.mixte })).find((r) => r.id === ids.act);
    return d.place_name === 'JLT Padel, court 3' && Date.parse(d.starts_at) === Date.parse(inDays(4)) && tab?.place_name === 'JLT Padel, court 3';
  });
  await step('E [20261028200000]: the chat card reads the new place too', async () => (await card(B, ids.act))?.place_name === 'JLT Padel, court 3');
  await step('E [20261028200000]: two quick changes → one update notice for Bea (deduplicated)', async () => {
    const [n] = await sql(`select count(*)::int as n from public.notifications where user_id = '${B.id}' and kind = 'ACTIVITY_UPDATED' and payload ->> 'activity_id' = '${ids.act}' and read_at is null`);
    return n.n === 1;
  });
  await step('E: Alice cancels → cancelled everywhere, Bea notified once, the chat keeps its history', async () => {
    must(await A.sb.from('activities').update({ cancelled_at: new Date().toISOString() }).eq('id', ids.act));
    await sleep(300);
    const d = must(await B.sb.rpc('activity_detail', { p_id: ids.act }))[0];
    const [n] = await sql(`select count(*)::int as n from public.notifications where user_id = '${B.id}' and kind = 'ACTIVITY_UPDATED' and payload ->> 'activity_id' = '${ids.act}' and payload ->> 'cancelled' = 'true'`);
    const msgs = must(await B.sb.from('messages').select('body').eq('conversation_id', ids.actChat));
    const share = must(await B.sb.from('messages').select('id').eq('id', ids.share));
    return d.cancelled === true && n.n === 1 && msgs.some((m) => m.body === `See you at court 3 ${run}`) && share.length === 1;
  });
  await step('E [20261028200000]: the card says cancelled', async () => (await card(B, ids.act))?.status === 'cancelled');

  // ───── F. The unauthorised account ─────
  await step('F: Carl (not in the community): direct link, API and card show nothing', async () => {
    const live = must(await A.sb.from('activities').insert({ creator_id: A.id, title: `E2E members only ${run}`, category_id: 'sport', city_id: 'dubai', area_id: 'marina', starts_at: inDays(5), privacy: 'community', community_id: ids.mixte }).select('id').single());
    ids.members = live.id;
    const row = must(await C.sb.from('activities').select('id').eq('id', ids.members));
    const detail = must(await C.sb.rpc('activity_detail', { p_id: ids.members }));
    const join = await C.sb.rpc('join_activity', { p_activity: ids.members, p_status: 'going' });
    return row.length === 0 && detail.length === 0 && Boolean(join.error);
  });
  await step('F [20261028200000]: Carl gets no card for it', async () => (await card(C, ids.members)) === null);
  await step('F: Carl cannot read or write the activity chat, nor add himself to it', async () => {
    const conv = must(await C.sb.from('conversations').select('id').eq('id', ids.actChat));
    const msgs = must(await C.sb.from('messages').select('id').eq('conversation_id', ids.actChat));
    const write = await C.sb.from('messages').insert({ conversation_id: ids.actChat, sender_id: C.id, kind: 'text', body: 'let me in' });
    const add = await C.sb.from('conversation_members').insert({ conversation_id: ids.actChat, user_id: C.id });
    return conv.length === 0 && msgs.length === 0 && Boolean(write.error) && Boolean(add.error);
  });
  await step('F: IRLY Girl: an activity of the Girl community is women-only and cannot be shared into the Mixte chat', async () => {
    const g = must(await A.sb.from('activities').insert({ creator_id: A.id, title: `E2E sunrise yoga ${run}`, category_id: 'sport', city_id: 'dubai', area_id: 'kitebeach', starts_at: inDays(2, 3), privacy: 'community', community_id: ids.girl }).select('id, girl_only').single());
    ids.girlAct = g.id;
    const share = await A.sb.rpc('share_to_chat', { p_conversation: ids.mixteChat, p_type: 'activity', p_id: g.id, p_title: 'x' });
    const ok = must(await A.sb.rpc('share_to_chat', { p_conversation: ids.girlChat, p_type: 'activity', p_id: g.id, p_title: `E2E sunrise yoga ${run}` }));
    return g.girl_only === true && Boolean(share.error) && Boolean(ok);
  });
  await step('F: IRLY Girl: Carl reads neither the plan, its page, nor the Girl chat', async () => {
    const row = must(await C.sb.from('activities').select('id').eq('id', ids.girlAct));
    const detail = must(await C.sb.rpc('activity_detail', { p_id: ids.girlAct }));
    const msgs = must(await C.sb.from('messages').select('id').eq('conversation_id', ids.girlChat));
    return row.length === 0 && detail.length === 0 && msgs.length === 0;
  });
  await step('F [20261028200000]: IRLY Girl: Carl gets no card, Bea does', async () => (await card(C, ids.girlAct)) === null && (await card(B, ids.girlAct))?.girl_only === true);
} finally {
  await cleanup();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('Failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
