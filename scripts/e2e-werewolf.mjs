// IRLY Loup-Garou end to end, against the LIVE IRLY Supabase project, through
// the public API and row level security the app uses. Seven throwaway TEST
// members: one plays a whole training game against AI players; six sit at a
// private online table (cards dealt, secrets kept, the pack's chat); one
// opens an in-person table. Everything they made is deleted.
//
// Only private tables (with a code): real members never see these test games.
// Env: SUPABASE_ACCESS_TOKEN (sbp_...), SUPABASE_PROJECT_REF. Run by .github/workflows/e2e.yml.
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
const names = ['Ava', 'Ben', 'Cleo', 'Dan', 'Eva', 'Finn', 'Gus'];
const people = names.map((name, i) => ({ email: `e2e-${run}-ww-${name.toLowerCase()}@irly.test`, name, gender: i % 2 ? 'man' : 'woman' }));

let passed = 0;
let failed = 0;
const failures = [];
async function step(label, fn) {
  try {
    const ok = await fn();
    if (ok === false) throw new Error('check returned false');
    passed++;
    console.log(`  ✓ ${label}`);
  } catch (e) {
    failed++;
    failures.push(`${label}: ${e.message}`);
    console.log(`  ✗ ${label}: ${e.message}`);
  }
}
const must = (r) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
const refused = async (p, message) => {
  const r = await p;
  if (!r.error) throw new Error('expected a refusal, got success');
  if (message && r.error.message !== message) throw new Error(`refused with « ${r.error.message} », expected « ${message} »`);
  return true;
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
  must(await p.sb.from('profiles').insert({ id: p.id, first_name: p.name, birthdate: '1994-04-04', gender: p.gender, city_id: 'dubai', languages: ['en', 'fr'], interests: ['sport'] }));
}

async function cleanup() {
  const mine = `select id from auth.users where email like 'e2e-${run}-ww-%@irly.test' or (email like 'e2e-%-ww-%@irly.test' and created_at < now() - interval '2 hours')`;
  await sql(`delete from public.game_rooms where id in (select room_id from public.game_participants where user_id in (${mine}))
      or host_id in (${mine});
    delete from auth.users where id in (${mine})`).catch((e) => console.log('cleanup:', e.message));
}

/** One move for a player from her own view: the first valid choice, or pass; « ready » by day. */
async function playOnce(p, room) {
  const v = must(await p.sb.rpc('ww_view', { p_room: room }));
  if (v.phase === 'ended' || !v.options?.length || v.mine?.length) return v;
  const o = v.options[0];
  if (o.kind === 'ready' || o.kind === 'hint') must(await p.sb.rpc('ww_act', { p_room: room, p_kind: o.kind }));
  else if (o.kind === 'steal') must(await p.sb.rpc('ww_act', { p_room: room, p_kind: 'steal', p_target: -1 }));
  else if (o.kind === 'link') must(await p.sb.rpc('ww_act', { p_room: room, p_kind: 'link', p_target: o.targets[0], p_target2: o.targets[1] }));
  else if (['vote', 'wolf', 'seer'].includes(o.kind) && o.targets.length) must(await p.sb.rpc('ww_act', { p_room: room, p_kind: o.kind, p_target: o.targets[0] }));
  else must(await p.sb.rpc('ww_act', { p_room: room, p_kind: 'pass' }));
  return v;
}

const [A, B, C, D, E, F, G] = people;
let training;
let table;
let code;

try {
  await cleanup();
  await step('7 test members sign in', async () => {
    for (const p of people) await createUser(p);
    return true;
  });

  // ───── Training against AI players ─────
  await step('training: starts at once, the chosen Seer, 7 AI players, unranked', async () => {
    training = must(await A.sb.rpc('ww_training', { p_space: 'mixte', p_size: 8, p_role: 'seer', p_difficulty: 'intermediate' }));
    const v = must(await A.sb.rpc('ww_view', { p_room: training }));
    return v.me.card === 'seer' && v.players.filter((x) => x.bot).length === 7 && v.ranked === false && v.kind === 'training';
  });
  await step('training: not counted, not listed for others', async () => {
    const open = must(await B.sb.rpc('game_rooms_open', { p_game: 'werewolf', p_space: 'mixte' }));
    const rows = must(await B.sb.from('game_rooms').select('id').eq('id', training));
    return !open.some((r) => r.id === training) && rows.length === 0;
  });
  await step('training: the AI players see no card in her view; her view shows none of theirs', async () => {
    const v = must(await A.sb.rpc('ww_view', { p_room: training }));
    return v.players.every((x) => !('card' in x)) && v.me.pack === null;
  });
  await step('training: a whole game against the AI players ends, unranked', async () => {
    let v;
    for (let i = 0; i < 1600; i++) {
      v = await playOnce(A, training);
      if (v.phase === 'ended') break;
      await sleep(250);
    }
    v = must(await A.sb.rpc('ww_view', { p_room: training }));
    console.log(`    (${v.result?.winner} won after ${v.night} nights; the Seer ${v.result?.seats.includes(v.me.seat) ? 'won' : 'lost'})`);
    return v.phase === 'ended' && v.result.ranked === false && ['village', 'wolves', 'lovers', 'draw'].includes(v.result.winner);
  });
  await step('training stats apart from real games', async () => {
    const s = must(await A.sb.rpc('ww_stats', {}));
    return s.training_played === 1 && s.played === 0;
  });
  await step('the AI players talked from what they saw (no card named that they could not know)', async () => {
    const msgs = must(await A.sb.from('game_messages').select('kind, body, data').eq('room_id', training).eq('kind', 'bot'));
    const keys = new Set(['accuse', 'doubt', 'watch', 'vote_for', 'unsure', 'claim_seer_wolf', 'why_me', 'defend', 'calm', 'pack_plan']);
    return msgs.every((m) => keys.has(m.body) && !JSON.stringify(m.data ?? {}).includes('card'));
  });

  // ───── The seven V3 modes: a training game in each starts with a card of the mode, and one is played to its end ─────
  await step('V3 modes: training starts in each of the seven, with the chosen card', async () => {
    const picks = { chaos: 'scammer', nightmare: 'vampire', manipulation: 'lawyer', nightmare_chaos: 'reaper', manipulation_chaos: 'dictator', nightmare_manipulation: 'possessed', apocalypse: 'bounty_hunter' };
    for (const [mode, role] of Object.entries(picks)) {
      const room = must(await A.sb.rpc('ww_training', { p_space: 'mixte', p_size: 10, p_role: role, p_difficulty: 'intermediate', p_mode: mode }));
      const v = must(await A.sb.rpc('ww_view', { p_room: room }));
      if (v.mode !== mode || v.me.card !== role || v.players.length !== 10 || !v.composition[role]) throw new Error(`${mode}: got ${v.me.card} in ${v.mode}`);
      if (v.players.some((x) => 'card' in x || 'camp' in x)) throw new Error(`${mode}: a card is shown`);
    }
    return true;
  });
  await step('V3: a card of another family is refused; an unknown mode too', async () => {
    await refused(A.sb.rpc('ww_training', { p_space: 'mixte', p_size: 8, p_role: 'vampire', p_difficulty: 'intermediate', p_mode: 'chaos' }), 'composition: unknown card');
    return refused(A.sb.rpc('ww_training', { p_space: 'mixte', p_size: 8, p_role: null, p_difficulty: 'intermediate', p_mode: 'no_such_mode' }), 'this mode is not available yet');
  });
  await step('Apocalypse: a whole training game against the AI players ends, unranked', async () => {
    const room = must(await A.sb.rpc('ww_training', { p_space: 'mixte', p_size: 12, p_role: null, p_difficulty: 'intermediate', p_mode: 'apocalypse' }));
    let v;
    for (let i = 0; i < 1600; i++) {
      v = await playOnce(A, room);
      if (v.phase === 'ended') break;
      await sleep(250);
    }
    v = must(await A.sb.rpc('ww_view', { p_room: room }));
    console.log(`    (${v.result?.winner} won after ${v.night} nights; personal victories: ${(v.result?.solo ?? []).length})`);
    return v.phase === 'ended' && v.result.ranked === false && ['village', 'wolves', 'lovers', 'draw'].includes(v.result.winner);
  });
  await step('training does not rush: the phase is still there right after every AI player has acted', async () => {
    const r = must(await A.sb.rpc('ww_training', { p_space: 'mixte', p_size: 8, p_role: 'villager', p_difficulty: 'intermediate', p_mode: 'classic' }));
    const a = must(await A.sb.rpc('ww_view', { p_room: r }));
    const b = must(await A.sb.rpc('ww_view', { p_room: r }));
    return a.phase === 'night' && a.night === 1 && b.phase === 'night' && b.night === 1;
  });

  // ───── A private online table of six ─────
  await step('online: a private table of six, joined with its code', async () => {
    const t = must(await A.sb.rpc('ww_create', { p_space: 'mixte', p_visibility: 'private', p_size: 8, p_kind: 'online', p_composition: null, p_title: 'E2E village', p_lang: 'fr' }));
    table = t.id;
    code = t.code;
    for (const p of [B, C, D, E, F]) must(await p.sb.rpc('game_join_code', { p_code: code }));
    return must(await A.sb.rpc('game_room', { p_room: table })).players === 6;
  });
  await step('online: only the host starts', () => refused(B.sb.rpc('game_start', { p_room: table }), 'only the host can do this'));
  await step('online: the host starts; each sees only her own card', async () => {
    must(await A.sb.rpc('game_start', { p_room: table }));
    const views = [];
    for (const p of [A, B, C, D, E, F]) views.push(must(await p.sb.rpc('ww_view', { p_room: table })));
    const wolves = views.filter((v) => v.me.camp === 'wolves');
    const ok = views.every((v) => v.me.card && v.players.every((x) => !('card' in x)));
    // 6 players: 1 werewolf (V3 table); only the pack sees the pack.
    return ok && wolves.length === 1 && views.filter((v) => v.me.pack).length === 1 && views.every((v) => v.phase === 'night');
  });
  await step('online: the pack talks at night; no villager reads it, nor talks at night', async () => {
    const views = [];
    for (const p of [A, B, C, D, E, F]) views.push({ p, v: must(await p.sb.rpc('ww_view', { p_room: table })) });
    const wolf = views.find((x) => x.v.me.pack);
    const villager = views.find((x) => !x.v.me.pack);
    must(await wolf.p.sb.rpc('ww_say', { p_room: table, p_body: 'on prend qui ?', p_channel: 'wolves' }));
    await refused(villager.p.sb.rpc('ww_say', { p_room: table, p_body: 'psst', p_channel: 'all' }), 'the village sleeps: no talking at night');
    await refused(villager.p.sb.rpc('ww_say', { p_room: table, p_body: 'psst', p_channel: 'wolves' }), 'you cannot talk here now');
    const seen = must(await villager.p.sb.from('game_messages').select('id').eq('room_id', table).eq('channel', 'wolves'));
    const own = must(await wolf.p.sb.from('game_messages').select('id').eq('room_id', table).eq('channel', 'wolves'));
    return seen.length === 0 && own.length === 1;
  });
  await step('online: once everyone acted at night, the morning comes (no waiting for the clock)', async () => {
    for (const p of [A, B, C, D, E, F]) await playOnce(p, table);
    let v;
    for (let i = 0; i < 20; i++) {
      v = must(await A.sb.rpc('ww_view', { p_room: table }));
      if (v.phase === 'day' || v.phase === 'ended') break;
      for (const p of [A, B, C, D, E, F]) await playOnce(p, table);
      await sleep(300);
    }
    return v.phase === 'day' || v.phase === 'ended';
  });
  await step('online: someone outside the table reads nothing of it', async () => {
    const r = await G.sb.rpc('ww_view', { p_room: table });
    const msgs = must(await G.sb.from('game_messages').select('id').eq('room_id', table));
    return Boolean(r.error) && msgs.length === 0;
  });
  await step('online: leaving takes a player out, without showing her card', async () => {
    must(await F.sb.rpc('game_leave', { p_room: table }));
    const v = must(await A.sb.rpc('ww_view', { p_room: table }));
    const left = v.log.find((e) => e.kind === 'left_game');
    return (v.phase === 'ended' || !v.players.find((x) => x.user_id === F.id).alive) && (!left || !('card' in left.data));
  });

  // ───── In person ─────
  await step('in person: a table with a code (QR), no chat (talk around the table)', async () => {
    const t = must(await G.sb.rpc('ww_create', { p_space: 'mixte', p_visibility: 'public', p_size: 10, p_kind: 'irl', p_composition: null, p_title: null, p_lang: 'fr' }));
    const r = must(await G.sb.rpc('game_room', { p_room: t.id }));
    // An in-person table is always private: it never shows in public lists.
    await refused(G.sb.rpc('ww_say', { p_room: t.id, p_body: 'salut', p_channel: 'all' }), 'in person, talk around the table');
    return /^[A-Z2-9]{6}$/.test(t.code) && r.visibility === 'private' && r.kind === 'irl';
  });
  await step('a phone cannot write the game or rank itself', async () => {
    await refused(A.sb.from('game_rooms').update({ status: 'finished' }).eq('id', table).select().single());
    return true;
  });
} finally {
  await cleanup();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('Failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
