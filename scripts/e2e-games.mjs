// IRLY Games end to end, against the LIVE IRLY Supabase project, through the
// public API and row level security the app uses (publishable key, real
// sign-in). Four throwaway TEST members play a whole game of Ludo together,
// then everything they made is deleted.
//
// Only private tables (with a code) are used: real members never see these
// test games in their lists or counts, and a test member never joins a real
// member's table.
//
// Env: SUPABASE_ACCESS_TOKEN (sbp_..., to create/confirm/delete the test
// accounts through the Management API), SUPABASE_PROJECT_REF.
// Run by .github/workflows/e2e.yml after the database is deployed.
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
  lina: { email: `e2e-${run}-games-lina@irly.test`, name: 'Lina', gender: 'woman' },
  omar: { email: `e2e-${run}-games-omar@irly.test`, name: 'Omar', gender: 'man' },
  sara: { email: `e2e-${run}-games-sara@irly.test`, name: 'Sara', gender: 'woman' },
  theo: { email: `e2e-${run}-games-theo@irly.test`, name: 'Theo', gender: 'man' },
};

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
  // The profile the app writes at sign-up (RLS: own row only).
  must(await p.sb.from('profiles').insert({ id: p.id, first_name: p.name, birthdate: '1994-04-04', gender: p.gender, city_id: 'dubai', languages: ['en', 'fr'], interests: ['sport'] }));
  // IRLY Girl needs an identity verified by IRLY: a test woman gets an approved selfie review.
  if (p.gender === 'woman') {
    await sql(`insert into public.verification_requests (user_id, gesture, status, submitted_at, decided_at) values ('${p.id}', 'peace', 'approved', now(), now())`);
  }
}

async function cleanup() {
  // This run's test members, and test members this script left behind over 2 hours ago:
  // their tables first (a table keeps its row when its host account goes).
  const mine = `select id from auth.users where email like 'e2e-${run}-games-%@irly.test' or (email like 'e2e-%-games-%@irly.test' and created_at < now() - interval '2 hours')`;
  await sql(`delete from public.game_rooms where id in (select room_id from public.game_participants where user_id in (${mine}));
    delete from auth.users where id in (${mine})`).catch((e) => console.log('cleanup:', e.message));
}

const { lina: L, omar: O, sara: S, theo: T } = people;
let room;
let code;

try {
  await cleanup();
  await step('4 test members sign in', async () => {
    for (const p of Object.values(people)) await createUser(p);
    return true;
  });

  await step('IRLY Games counts are readable (online, rooms, free seats)', async () => {
    const o = must(await O.sb.rpc('games_overview', { p_space: 'mixte' }));
    return typeof o.online === 'number' && Array.isArray(o.games) && o.games.some((g) => g.game === 'ludo');
  });
  await step('a man reads no IRLY Girl counts', () => refused(O.sb.rpc('games_overview', { p_space: 'girl' }), 'IRLY Girl games are for IRLY Girl members'));
  await step('Loup-Garou is not open yet', () => refused(O.sb.rpc('game_create', { p_game: 'werewolf', p_space: 'mixte' }), 'Loup-Garou opens soon'));

  await step('Omar opens a private 3-player Ludo table (a code, not listed)', async () => {
    const r = must(await O.sb.rpc('game_create', { p_game: 'ludo', p_space: 'mixte', p_visibility: 'private', p_max: 3, p_title: 'E2E table', p_lang: 'fr' }));
    room = r.id;
    code = r.code;
    const open = must(await T.sb.rpc('game_rooms_open', { p_game: 'ludo', p_space: 'mixte' }));
    return /^[A-Z2-9]{6}$/.test(code) && !open.some((x) => x.id === room);
  });
  await step('a phone cannot write a table directly', () => refused(T.sb.from('game_rooms').insert({ game: 'ludo', space: 'irly', max_players: 4 })));
  await step('without the code, nobody joins', () => refused(T.sb.rpc('game_join', { p_room: room }), 'this game is private: ask for its code'));
  await step('Lina and Sara join with the code', async () => {
    must(await L.sb.rpc('game_join_code', { p_code: code }));
    must(await S.sb.rpc('game_join_code', { p_code: code.toLowerCase() }));
    const r = must(await O.sb.rpc('game_room', { p_room: room }));
    return r.players === 3 && r.people.length === 3;
  });
  await step('the table is full for Theo', () => refused(T.sb.rpc('game_join_code', { p_code: code }), 'this game is full'));
  await step('Theo, outside the table, reads neither the table nor its chat', async () => {
    const rows = must(await T.sb.from('game_rooms').select('id').eq('id', room));
    const msgs = must(await T.sb.from('game_messages').select('id').eq('room_id', room));
    return rows.length === 0 && msgs.length === 0;
  });

  await step('the chat is live: Lina hears Sara\'s message through Realtime', async () => {
    const heard = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no live message within 15 s')), 15_000);
      const ch = L.sb
        .channel(`e2e-games-${run}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_messages', filter: `room_id=eq.${room}` }, (p) => {
          if (p.new.body === 'Salut la table 👋') {
            clearTimeout(timer);
            L.sb.removeChannel(ch);
            resolve(true);
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') must(await S.sb.rpc('game_say', { p_room: room, p_body: 'Salut la table 👋' }));
        });
    });
    return heard;
  });

  await step('only the host starts; then three colours, a deadline', async () => {
    await refused(L.sb.rpc('game_start', { p_room: room }), 'only the host can do this');
    must(await O.sb.rpc('game_start', { p_room: room }));
    const r = must(await O.sb.rpc('game_room', { p_room: room }));
    return r.status === 'playing' && JSON.stringify(r.state.colors) === '[0,1,2]' && Boolean(r.deadline);
  });

  const who = { [O.id]: O, [L.id]: L, [S.id]: S };
  await step('only the player whose turn it is rolls', async () => {
    const r = must(await O.sb.rpc('game_room', { p_room: room }));
    const other = Object.values(who).find((p) => p.id !== r.state.players[r.state.turn]);
    return refused(other.sb.rpc('ludo_roll', { p_room: room }), 'not your turn');
  });

  await step('a whole game, played by the three of them, ends with a winner', async () => {
    let actions = 0;
    let rolls = 0;
    const seen = new Set();
    for (; actions < 1500; actions++) {
      const r = must(await O.sb.rpc('game_room', { p_room: room }));
      if (r.status !== 'playing') break;
      const s = r.state;
      const p = who[s.players[s.turn]];
      if (s.die == null) {
        const d = must(await p.sb.rpc('ludo_roll', { p_room: room }));
        if (!(d >= 1 && d <= 6)) throw new Error(`die out of range: ${d}`);
        seen.add(d);
        rolls++;
      } else {
        const toks = s.tokens[s.turn];
        const legal = toks.map((x, k) => (x === -1 ? (s.die === 6 ? k : -1) : x < 56 && x + s.die <= 56 ? k : -1)).filter((k) => k >= 0);
        const pick = legal.sort((a, b) => toks[b] - toks[a])[0];
        must(await p.sb.rpc('ludo_move', { p_room: room, p_token: pick }));
      }
    }
    const r = must(await O.sb.rpc('game_room', { p_room: room }));
    console.log(`    (${actions} actions, ${rolls} server rolls, faces seen: ${[...seen].sort().join(',')})`);
    if (r.status !== 'finished') throw new Error(`status ${r.status} after ${actions} actions`);
    const w = r.state.players.indexOf(r.winner_id);
    return w >= 0 && r.state.tokens[w].every((x) => x === 56) && r.people.find((x) => x.id === r.winner_id).place === 1;
  });
  await step('a finished game takes no move', () => refused(L.sb.rpc('ludo_roll', { p_room: room }), 'this game is not running'));
  await step('the chat says who won', async () => must(await S.sb.from('game_messages').select('body').eq('room_id', room).eq('kind', 'system')).some((m) => m.body === 'won'));
  await step('Sara finds the two others in her recent games (to stay in touch)', async () => {
    const g = must(await S.sb.rpc('games_recent', {}));
    const it = g.find((x) => x.id === room);
    return it && it.people.length === 2 && it.people.every((p) => p.id === O.id || p.id === L.id);
  });

  await step('IRLY Girl: Omar cannot open a table there', () => refused(O.sb.rpc('game_create', { p_game: 'ludo', p_space: 'girl' }), 'IRLY Girl games are for IRLY Girl members'));
  await step('IRLY Girl: Lina\'s private table refuses Omar even with its code, takes Sara', async () => {
    const g = must(await L.sb.rpc('game_create', { p_game: 'ludo', p_space: 'girl', p_visibility: 'private', p_max: 2, p_lang: 'fr' }));
    await refused(O.sb.rpc('game_join_code', { p_code: g.code }), 'IRLY Girl games are for IRLY Girl members');
    must(await S.sb.rpc('game_join_code', { p_code: g.code }));
    return must(await L.sb.rpc('game_room', { p_room: g.id })).players === 2;
  });
  await step('a blocked member cannot sit at the table of who blocked her', async () => {
    must(await L.sb.rpc('block_user', { p_target: T.id }));
    const g = must(await L.sb.rpc('game_create', { p_game: 'ludo', p_space: 'mixte', p_visibility: 'private', p_max: 2 }));
    return refused(T.sb.rpc('game_join_code', { p_code: g.code }), 'you cannot join this game');
  });
} finally {
  await cleanup();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('Failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
