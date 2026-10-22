// The editorial back office against the LIVE IRLY Supabase project, through
// the public API and the rules the app uses (publishable key, real sign-in).
// Run by .github/workflows/e2e.yml (api job), after the other live journeys.
//
// Three throwaway accounts (deleted at the end): Cora (content staff, role
// given and removed through the Management API), Wren (a woman: IRLY Girl)
// and Milo (a man). Journeys:
//   A  news: draft (invisible) → publish → right flavour → edit follows → unpublish gone
//   B  Home layout: move two sections, rename, hide, save draft (members
//      unchanged) → publish (order applied) → read again (kept)
//   C  IRLY vs IRLY Girl vs both (news and banners), signed out included
//   D  refusals: a photo that was not uploaded, a broken layout (the live one
//      untouched), a non-staff member; no stored file removed
// Production safety: every news item is titled « [E2E] », never notifies
// (notify off), and is deleted at the end; banners are created switched on
// for seconds and deleted; the Home layouts are put back exactly as they
// were (rows restored through the Management API, test versions removed).
//
// Env: SUPABASE_ACCESS_TOKEN (sbp_…), SUPABASE_PROJECT_REF.
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
  cora: { email: `e2e-cms-${run}-cora@irly.test`, name: 'Cora', gender: 'woman' },
  wren: { email: `e2e-cms-${run}-wren@irly.test`, name: 'Wren', gender: 'woman' },
  milo: { email: `e2e-cms-${run}-milo@irly.test`, name: 'Milo', gender: 'man' },
};
let passed = 0;
const failures = [];
async function step(label, fn) {
  try {
    const ok = await fn();
    if (ok === false) throw new Error('check returned false');
    passed++;
    console.log(`✓ ${label}`);
  } catch (e) {
    failures.push(label);
    console.log(`✗ ${label}: ${e instanceof Error ? e.message : e}`);
  }
}
const must = (r) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
const refused = async (p, msg) => {
  const r = await p;
  if (!r.error) throw new Error('expected a refusal, got success');
  if (msg && r.error.message !== msg) throw new Error(`refused with « ${r.error.message} », expected « ${msg} »`);
  return true;
};

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
  // The profile as onboarding writes it.
  await sql(`insert into public.profiles (id, first_name, birthdate, gender, city_id) values ('${p.id}', '${p.name}', '1993-03-03', '${p.gender}', 'dubai')
    on conflict (id) do update set first_name = excluded.first_name, gender = excluded.gender`);
}

const { cora: C, wren: W, milo: M } = people;
const anon = createClient(URL, KEY, { auth: { persistSession: false } });
const created = { news: [], banners: [] };
let layouts = null;
let files = null;
const feed = async (sb, space) => must(await sb.rpc('home_feed', { p_space: space }));
const titles = (f) => f.news.map((n) => n.title);
const keys = (f) => (f.layout?.sections ?? []).map((e) => e.key);

try {
  for (const p of Object.values(people)) await createUser(p);
  await sql(`insert into public.staff_roles (user_id, role) values ('${C.id}', 'content') on conflict (user_id) do update set role = 'content'`);
  // What must be the same at the end.
  layouts = await sql(`select flavour, draft, published, version, draft_updated_at, draft_updated_by, published_at, published_by from public.home_layouts`);
  files = (await sql(`select count(*)::int as n from storage.objects where bucket_id in ('cms-media', 'app-photos', 'activity-photos')`))[0].n;

  // Read only: is the minute job that puts scheduled news live there? Without
  // it, a scheduled item goes live when the team next opens the news list.
  const cronExt = (await sql(`select count(*)::int as n from pg_extension where extname = 'pg_cron'`))[0].n > 0;
  const cronJob = cronExt && (await sql(`select count(*)::int as n from cron.job where jobname = 'irly-news-live'`).catch(() => [{ n: 0 }]))[0].n > 0;
  console.log(`ℹ pg_cron ${cronExt ? 'installed' : 'not installed'}, job irly-news-live ${cronJob ? 'scheduled' : 'missing'}`);

  // ───────── A ─────────
  let both;
  await step('A: content staff create a draft', async () => {
    both = must(await C.sb.rpc('admin_news_save', { p_id: null, p_news: { title: `[E2E] ${run} both`, body: 'E2E test item: removed in seconds.', audience: 'both', notify: false } }));
    created.news.push(both);
    return typeof both === 'string';
  });
  await step('A: a draft is invisible to members, signed out and by its link', async () =>
    !titles(await feed(M.sb, 'mixte')).includes(`[E2E] ${run} both`) && !titles(await feed(anon, 'mixte')).includes(`[E2E] ${run} both`)
    && must(await M.sb.rpc('news_item', { p_id: both })) === null);
  await step('A: publish now', async () => must(await C.sb.rpc('admin_news_publish', { p_id: both, p_at: null })).state === 'published');
  await step('A: « both » is in IRLY (Milo, signed out) and IRLY Girl (Wren)', async () =>
    titles(await feed(M.sb, 'mixte')).includes(`[E2E] ${run} both`) && titles(await feed(anon, 'mixte')).includes(`[E2E] ${run} both`)
    && titles(await feed(W.sb, 'girl')).includes(`[E2E] ${run} both`));
  await step('A: an edit reaches members at once', async () => {
    must(await C.sb.rpc('admin_news_save', { p_id: both, p_news: { title: `[E2E] ${run} both edited` } }));
    return titles(await feed(M.sb, 'mixte')).includes(`[E2E] ${run} both edited`);
  });
  await step('A: notify off: nobody was notified', async () => (await sql(`select count(*)::int as n from public.notifications where kind = 'IRLY_NEWS' and payload ->> 'news_id' = '${both}'`))[0].n === 0);
  await step('A: unpublished, it is gone (feed and link)', async () => {
    must(await C.sb.rpc('admin_news_unpublish', { p_id: both }));
    return !titles(await feed(M.sb, 'mixte')).some((t) => t.startsWith(`[E2E] ${run}`)) && must(await M.sb.rpc('news_item', { p_id: both })) === null;
  });

  // ───────── C ─────────
  let girl;
  let mixte;
  await step('C: an IRLY Girl item reaches IRLY Girl members only', async () => {
    girl = must(await C.sb.rpc('admin_news_save', { p_id: null, p_news: { title: `[E2E] ${run} girl`, body: 'E2E test item.', audience: 'girl', notify: false } }));
    created.news.push(girl);
    must(await C.sb.rpc('admin_news_publish', { p_id: girl, p_at: null }));
    return titles(await feed(W.sb, 'girl')).includes(`[E2E] ${run} girl`) && !titles(await feed(W.sb, 'mixte')).includes(`[E2E] ${run} girl`)
      && !titles(await feed(M.sb, 'girl')).includes(`[E2E] ${run} girl`) && (await feed(M.sb, 'girl')).space === 'mixte'
      && !titles(await feed(anon, 'girl')).includes(`[E2E] ${run} girl`) && must(await M.sb.rpc('news_item', { p_id: girl })) === null;
  });
  await step('C: an IRLY item stays in IRLY', async () => {
    mixte = must(await C.sb.rpc('admin_news_save', { p_id: null, p_news: { title: `[E2E] ${run} mixte`, body: 'E2E test item.', audience: 'mixte', notify: false } }));
    created.news.push(mixte);
    must(await C.sb.rpc('admin_news_publish', { p_id: mixte, p_at: null }));
    return titles(await feed(M.sb, 'mixte')).includes(`[E2E] ${run} mixte`) && !titles(await feed(W.sb, 'girl')).includes(`[E2E] ${run} mixte`);
  });
  await step('C: banners follow the same audiences', async () => {
    const b1 = must(await C.sb.rpc('admin_banner_save', { p_id: null, p_banner: { title: `[E2E] ${run} girl banner`, audience: 'girl', active: true } }));
    created.banners.push(b1);
    const ids = (f) => f.banners.map((b) => b.id);
    const ok = ids(await feed(W.sb, 'girl')).includes(b1) && !ids(await feed(M.sb, 'girl')).includes(b1) && !ids(await feed(anon, 'mixte')).includes(b1);
    must(await C.sb.rpc('admin_banner_save', { p_id: b1, p_banner: { active: false } }));
    return ok && !ids(await feed(W.sb, 'girl')).includes(b1);
  });
  for (const id of [girl, mixte]) if (id) await C.sb.rpc('admin_news_unpublish', { p_id: id });

  // ───────── B ─────────
  await step('B: save a draft (two sections moved, one renamed, one hidden): members unchanged', async () => {
    const before = keys(await feed(M.sb, 'mixte'));
    const draft = [{ key: 'search' }, { key: 'eat' }, { key: 'banners' }, { key: 'today' }, { key: 'news', title_en: 'E2E news', title_fr: 'Actus E2E' }, { key: 'featured', enabled: false }];
    must(await C.sb.rpc('admin_home_layout_save_draft', { p_flavour: 'mixte', p_config: draft }));
    return JSON.stringify(keys(await feed(M.sb, 'mixte'))) === JSON.stringify(before);
  });
  await step('B: publish: the order, title and hidden section reach members', async () => {
    must(await C.sb.rpc('admin_home_layout_publish', { p_flavour: 'mixte' }));
    const s = (await feed(M.sb, 'mixte')).layout.sections;
    return s[1].key === 'eat' && s[2].key === 'banners' && s.find((e) => e.key === 'news').title_en === 'E2E news' && s.find((e) => e.key === 'featured').enabled === false;
  });
  await step('B: read again (another session): the layout is kept', async () => {
    const fresh = createClient(URL, KEY, { auth: { persistSession: false } });
    must(await fresh.auth.signInWithPassword({ email: M.email, password: PASSWORD }));
    return (await feed(fresh, 'mixte')).layout.sections[1].key === 'eat';
  });

  // ───────── D ─────────
  await step('D: a photo that was not uploaded is refused', async () =>
    refused(C.sb.rpc('admin_news_save', { p_id: null, p_news: { title: `[E2E] ${run} x`, cover_path: `${C.id}/missing.jpg` } }), 'the photo was not uploaded'));
  await step('D: a broken layout is refused and the live one stays', async () => {
    const live = JSON.stringify((await feed(M.sb, 'mixte')).layout.sections);
    await refused(C.sb.rpc('admin_home_layout_save_draft', { p_flavour: 'mixte', p_config: [{ key: 'casino' }] }), 'unknown section');
    return JSON.stringify((await feed(M.sb, 'mixte')).layout.sections) === live;
  });
  await step('D: a member cannot call the editorial back office', async () =>
    (await refused(M.sb.rpc('admin_news_save', { p_id: null, p_news: { title: 'Hack' } })))
    && (await refused(M.sb.rpc('admin_home_layout_publish', { p_flavour: 'mixte' })))
    && (await refused(anon.rpc('admin_banner_save', { p_id: null, p_banner: { title: 'Hack' } }))));
} finally {
  // Put production back as it was.
  for (const id of created.news) await sql(`delete from public.irly_news where id = '${id}'`).catch((e) => console.log('cleanup news:', e.message));
  for (const id of created.banners) await sql(`delete from public.irly_banners where id = '${id}'`).catch((e) => console.log('cleanup banner:', e.message));
  if (layouts) {
    for (const l of layouts) {
      const j = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
      const t = (v) => (v ? `'${v}'` : 'null');
      await sql(`update public.home_layouts set draft = ${j(l.draft)}, published = ${j(l.published)}, version = ${l.version},
        draft_updated_at = ${t(l.draft_updated_at)}, draft_updated_by = ${t(l.draft_updated_by)}, published_at = ${t(l.published_at)}, published_by = ${t(l.published_by)}
        where flavour = '${l.flavour}'; delete from public.home_layout_versions where flavour = '${l.flavour}' and version > ${l.version};`).catch((e) => console.log('cleanup layout:', e.message));
    }
  }
  await step('D: no stored file was removed', async () => files === null || (await sql(`select count(*)::int as n from storage.objects where bucket_id in ('cms-media', 'app-photos', 'activity-photos')`))[0].n >= files);
  await sql(`delete from public.staff_roles where user_id in (select id from auth.users where email like 'e2e-cms-${run}-%@irly.test')`).catch(() => undefined);
  await sql(`delete from auth.users where email like 'e2e-cms-${run}-%@irly.test' or (email like 'e2e-cms-%@irly.test' and created_at < now() - interval '2 hours')`)
    .catch((e) => console.log('cleanup:', e.message));
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('Failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
