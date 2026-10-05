// End-to-end test against the LIVE IRLY Supabase project, through the same
// public API and row level security the app uses (publishable key, real
// sign-in). Three throwaway members (two women, one man) walk every
// journey, then are deleted.
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
  alice: { email: `e2e-${run}-alice@irly.test`, name: 'Alice', gender: 'woman' },
  bea: { email: `e2e-${run}-bea@irly.test`, name: 'Bea', gender: 'woman' },
  carl: { email: `e2e-${run}-carl@irly.test`, name: 'Carl', gender: 'man' },
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
const denied = async (p) => {
  const r = await p;
  if (!r.error) throw new Error('expected a refusal, got success');
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
}

async function cleanup() {
  await sql(`delete from auth.users where email like 'e2e-%@irly.test'`).catch((e) => console.log('cleanup:', e.message));
}

const { alice: A, bea: B, carl: C } = people;
const anon = createClient(URL, KEY, { auth: { persistSession: false } });

try {
  await cleanup();

  // ───── Accounts and profiles ─────
  await step('3 members sign in with email + password', async () => {
    for (const p of Object.values(people)) await createUser(p);
    return true;
  });
  await step('signup profiles are written (RLS: own row only)', async () => {
    for (const p of Object.values(people)) {
      must(await p.sb.from('profiles').insert({ id: p.id, first_name: p.name, birthdate: '1995-01-01', gender: p.gender, city_id: 'bali', languages: ['en', 'fr'], interests: ['sport', 'food'] }));
    }
    return true;
  });
  await step('gender is locked after signup', () => denied(C.sb.from('profiles').update({ gender: 'woman' }).eq('id', C.id).select().single()));
  await step('anonymous visitors read no profiles', async () => (must(await anon.from('profiles').select('id')) ?? []).length === 0);

  // ───── Activity: create, join, chat, calendar, search ─────
  let actId;
  await step('Alice creates a session (chat created with it)', async () => {
    const d = must(await A.sb.from('activities').insert({ creator_id: A.id, title: 'E2E Padel Canggu', category_id: 'sport', city_id: 'bali', area_id: 'canggu', starts_at: new Date(Date.now() + 86400000).toISOString(), capacity: 4 }).select('id').single());
    actId = d.id;
    const inbox = must(await A.sb.rpc('my_conversations'));
    return inbox.some((c) => c.kind === 'activity' && c.title === 'E2E Padel Canggu');
  });
  await step('it is in her calendar', async () => must(await A.sb.rpc('my_calendar', {})).some((x) => x.id === actId));
  await step('global search finds it', async () => must(await C.sb.rpc('search_all', { p_q: 'E2E Padel', p_city: 'bali' })).some((x) => x.id === actId));
  await step('Carl joins → going, in the activity chat', async () => (must(await C.sb.rpc('join_activity', { p_activity: actId, p_status: 'going' })) === 'going'));
  await step('Carl sends a message in the activity chat', async () => {
    const conv = must(await C.sb.rpc('activity_detail', { p_id: actId }))[0].conversation_id;
    must(await C.sb.from('messages').insert({ conversation_id: conv, sender_id: C.id, body: 'See you there!' }));
    const msgs = must(await A.sb.from('messages').select('body').eq('conversation_id', conv));
    return msgs.some((m) => m.body === 'See you there!');
  });
  await step('participant count updates (2 going)', async () => must(await A.sb.rpc('activity_detail', { p_id: actId }))[0].going === 2);
  await step('Alice is notified that Carl joined', async () => must(await A.sb.from('notifications').select('kind')).some((n) => n.kind === 'ACTIVITY_JOINED'));
  await step('Carl sees it in his calendar', async () => must(await C.sb.rpc('my_calendar', {})).some((x) => x.id === actId));

  // ───── Friends, IRL, likes, comments ─────
  let postId;
  await step('Alice and Carl become friends', async () => {
    must(await A.sb.rpc('add_friend', { p_user: C.id }));
    return must(await C.sb.rpc('add_friend', { p_user: A.id })) === 'accepted';
  });
  await step('Alice posts an IRL moment for friends', async () => {
    const d = must(await A.sb.from('irl_posts').insert({ author_id: A.id, city_id: 'bali', area_id: 'canggu', body: 'E2E coffee at Canggu, anyone?', visibility: 'friends' }).select('id').single());
    postId = d.id;
    return true;
  });
  await step('Carl (friend) sees it in the IRL feed', async () => must(await C.sb.rpc('irl_feed', { p_city: 'bali' })).some((p) => p.id === postId));
  await step('Bea (not a friend) does not', async () => !must(await B.sb.rpc('irl_feed', { p_city: 'bali' })).some((p) => p.id === postId));
  await step('Carl likes and comments', async () => {
    must(await C.sb.rpc('toggle_like', { p_type: 'irl_post', p_id: postId }));
    must(await C.sb.from('comments').insert({ target_type: 'irl_post', target_id: postId, author_id: C.id, body: 'On my way!' }));
    const e = must(await A.sb.rpc('engagement', { p_type: 'irl_post', p_ids: [postId] }))[0];
    return e.likes === 1 && e.comments === 1;
  });
  await step('Alice is notified of the like and the comment', async () => {
    const kinds = must(await A.sb.from('notifications').select('kind')).map((n) => n.kind);
    return kinds.includes('LIKE') && kinds.includes('COMMENT');
  });
  await step('Bea cannot like a post she cannot see', () => denied(B.sb.rpc('toggle_like', { p_type: 'irl_post', p_id: postId })));

  // ───── Share, save, private chat ─────
  await step('Carl shares the session to Alice in a private chat', async () => {
    const conv = must(await C.sb.rpc('open_direct', { p_user: A.id }));
    must(await C.sb.rpc('share_to_chat', { p_conversation: conv, p_type: 'activity', p_id: actId, p_title: 'E2E Padel Canggu' }));
    return must(await A.sb.from('messages').select('kind').eq('conversation_id', conv)).some((m) => m.kind === 'share');
  });
  await step('no private message to a stranger', () => denied(C.sb.rpc('open_direct', { p_user: B.id })));
  await step('Carl saves Echo Beach; saves stay private', async () => {
    must(await C.sb.rpc('toggle_save', { p_type: 'place', p_id: 'echo-beach' }));
    const mine = must(await C.sb.from('saves').select('target_id'));
    const hers = must(await A.sb.from('saves').select('target_id'));
    return mine.some((s) => s.target_id === 'echo-beach') && !hers.some((s) => s.target_id === 'echo-beach');
  });

  // ───── Bali content (public) ─────
  await step('Bali areas: Berawa in Badung and in Canggu', async () => {
    const a = must(await anon.from('areas').select('admin_area_id, parent_area_id').eq('city_id', 'bali').eq('id', 'berawa').single());
    return a.admin_area_id === 'id-bali-badung' && a.parent_area_id === 'canggu';
  });
  await step('area guide readable before sign-in (≥ 10 areas)', async () => must(await anon.from('area_profiles').select('area_id').eq('city_id', 'bali')).length >= 10);
  await step('visa: ≥ 10 official entries with government sources and dates', async () => {
    const g = must(await anon.from('guide_articles').select('kind, source_url, last_verified_at').eq('destination', 'bali').eq('section', 'visa').eq('kind', 'official'));
    return g.length >= 10 && g.every((x) => /imigrasi\.go\.id|baliprov\.go\.id/.test(x.source_url) && x.last_verified_at);
  });
  await step('places search works before sign-in', async () => must(await anon.rpc('places_search', { p_city: 'bali' })).length > 0);
  let echo;
  await step('a place page loads (Echo Beach)', async () => {
    echo = must(await anon.from('places').select('id, name').eq('slug', 'echo-beach').single());
    return echo.name === 'Echo Beach';
  });

  // ───── Move checklist ─────
  await step('Alice ticks Visa in her Bali move; private to her', async () => {
    must(await A.sb.from('relocation_progress').insert({ user_id: A.id, destination: 'bali', step_id: 'visa' }));
    return must(await A.sb.from('relocation_progress').select('step_id')).length === 1 && must(await B.sb.from('relocation_progress').select('step_id')).length === 0;
  });

  // ───── IRLY Girl: onboarding, profile, match, chat ─────
  await step('Carl (man) is refused IRLY Girl', () => denied(C.sb.rpc('irly_match_state')));
  await step('Alice and Bea onboard and create Match profiles', async () => {
    for (const p of [A, B]) {
      must(await p.sb.rpc('complete_irly_match_onboarding'));
      must(await p.sb.from('irly_match_profiles').insert({ user_id: p.id, goals: ['new_friends'], interests: ['brunch', 'travel'], sports: ['padel'], activities: ['coffee'], languages: ['fr', 'en'], areas: ['canggu'], availability: ['weekend_morning'], travel: ['bali'], lifestyle: { social: 1 } }));
    }
    return must(await A.sb.rpc('irly_match_state')) === 'ready';
  });
  await step('Alice discovers Bea with a score', async () => {
    const list = must(await A.sb.rpc('irly_match_discover', { p_filters: {}, p_limit: 50, p_offset: 0 }));
    const bea = list.find((x) => x.user_id === B.id);
    return Boolean(bea) && bea.score > 0;
  });
  let matchConv;
  await step('mutual like → match → private chat', async () => {
    must(await A.sb.rpc('irly_match_act', { p_target: B.id, p_action: 'like' }));
    const r = must(await B.sb.rpc('irly_match_act', { p_target: A.id, p_action: 'like' }));
    matchConv = r[0]?.conversation_id;
    return Boolean(matchConv);
  });
  await step('the match chat has conversation starters and both can write', async () => {
    must(await B.sb.from('messages').insert({ conversation_id: matchConv, sender_id: B.id, body: 'Brunch this weekend?' }));
    return must(await A.sb.from('messages').select('body').eq('conversation_id', matchConv)).length >= 2;
  });

  // ───── Moms and moving to Bali ─────
  await step('Bea turns on Mom mode, moving soon, looking for coworking', async () => {
    must(await B.sb.from('irly_match_profiles').update({ destination: 'bali', destination_status: 'moving_soon', mom_mode: true, kids_age_groups: ['toddler'], looking_for: ['coworking'] }).eq('user_id', B.id));
    return true;
  });
  await step('kids are age groups only (a name is refused)', () => denied(B.sb.from('irly_match_profiles').update({ kids_age_groups: ['Emma'] }).eq('user_id', B.id).select()));
  await step('Alice finds Bea in Girls moving to Bali, Moms, and by "coworking"', async () => {
    const moving = must(await A.sb.rpc('girl_circle', { p_destination: 'bali', p_status: 'moving_soon' }));
    const moms = must(await A.sb.rpc('girl_circle', { p_destination: 'bali', p_moms: true }));
    const cw = must(await A.sb.rpc('girl_circle', { p_destination: 'bali', p_looking: 'coworking' }));
    return [moving, moms, cw].every((l) => l.some((x) => x.user_id === B.id));
  });
  await step('Carl cannot browse women circles', () => denied(C.sb.rpc('girl_circle', { p_destination: 'bali' })));
  let momAct;
  await step('Bea creates a playdate at Echo Beach (moms audience)', async () => {
    const d = must(await B.sb.from('activities').insert({ creator_id: B.id, title: 'E2E Playdate · Echo Beach', category_id: 'family', city_id: 'bali', area_id: 'canggu', starts_at: new Date(Date.now() + 2 * 86400000).toISOString(), place_id: echo.id, activity_type: 'PLAYDATE', audience: 'moms', girl_only: true }).select('id').single());
    momAct = d.id;
    return true;
  });
  await step('Alice sees it under "Who\'s going" at Echo Beach; Carl does not', async () => {
    const a = must(await A.sb.rpc('place_activities', { p_slug: 'echo-beach' }));
    const c = must(await C.sb.rpc('place_activities', { p_slug: 'echo-beach' }));
    return a.some((x) => x.id === momAct) && !c.some((x) => x.id === momAct);
  });
  await step('Carl cannot join the moms playdate', () => denied(C.sb.rpc('join_activity', { p_activity: momAct, p_status: 'going' })));
  await step('Bali mom and girl communities: visible to women, hidden from men', async () => {
    const w = must(await A.sb.from('communities').select('name').eq('city_id', 'bali').ilike('name', '%Moms%'));
    const m = must(await C.sb.from('communities').select('name').eq('city_id', 'bali').ilike('name', '%Moms%'));
    return w.length >= 1 && m.length === 0;
  });
  await step('Alice joins Bali Girls → lands in its chat', async () => {
    const c = must(await A.sb.from('communities').select('id').eq('city_id', 'bali').eq('name', 'Bali Girls').single());
    return Boolean(must(await A.sb.rpc('join_community', { p_community: c.id })));
  });

  // ───── Recommendations, settings, analytics, assistant log ─────
  await step('recommendations run for Carl', async () => Array.isArray(must(await C.sb.rpc('recommend_activities', { p_city: 'bali', p_limit: 10 }))));
  await step('Carl mutes likes (notification preferences saved)', async () => {
    must(await C.sb.from('notification_prefs').upsert({ user_id: C.id, muted_kinds: ['LIKE'] }));
    return true;
  });
  await step('analytics event recorded; members cannot read analytics', async () => {
    must(await C.sb.from('analytics_events').insert({ user_id: C.id, name: 'IRLY_E_TO_E_RUN', props: { run } }));
    return must(await C.sb.from('analytics_events').select('id')).length === 0;
  });
  await step('assistant command logged for its owner', async () => {
    must(await C.sb.from('ai_commands').insert({ user_id: C.id, input: 'padel tomorrow in Canggu', intent: 'SEARCH', entities: { activity: 'padel' } }));
    return must(await C.sb.from('ai_commands').select('id')).length === 1;
  });

  // ───── Safety ─────
  await step('Bea reports Carl → a moderation case opens', async () => Boolean(must(await B.sb.rpc('report', { p_kind: 'profile', p_target_user: C.id, p_target_id: null, p_category: 'spam', p_details: 'e2e' }))));
  await step('Alice blocks Carl → he can no longer message her privately', async () => {
    must(await A.sb.rpc('block_user', { p_target: C.id }));
    const r = await C.sb.rpc('open_direct', { p_user: A.id });
    return Boolean(r.error);
  });

  // ───── Account deletion ─────
  await step('Carl deletes his account (everything goes with it)', async () => {
    must(await C.sb.rpc('delete_my_account'));
    const left = await sql(`select count(*)::int as n from public.profiles where id = '${C.id}'`);
    return left[0].n === 0;
  });
} finally {
  await sql(`delete from public.reports where details = 'e2e'`).catch(() => undefined);
  await sql(`delete from public.analytics_events where name = 'IRLY_E_TO_E_RUN'`).catch(() => undefined);
  await cleanup();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('Failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
