// End-to-end test against the LIVE IRLY Supabase project, through the same
// public API and row level security the app uses (publishable key, real
// sign-in). Three throwaway members (two women, one man) walk every
// journey, then are deleted.
//
// Env: SUPABASE_ACCESS_TOKEN (sbp_..., to create/confirm/delete the test
// accounts through the Management API), SUPABASE_PROJECT_REF.
// Run by .github/workflows/e2e.yml (the cloud dev box cannot reach Supabase).
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

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
const timings = {};
const timed = async (label, fn) => {
  const t0 = performance.now();
  const r = await fn();
  timings[label] = Math.round(performance.now() - t0);
  return r;
};
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
  // Own run, or accounts this script left behind more than 2 hours ago. Never the
  // browser tests' accounts (e2e-sync-*, e2e-ui-*): they may be in use by a run
  // happening at the same time.
  await sql(`delete from public.communities where created_by in (select id from auth.users where email like 'e2e-${run}-%@irly.test'
    or (email like 'e2e-%@irly.test' and email not like 'e2e-sync-%' and email not like 'e2e-ui-%' and created_at < now() - interval '2 hours'));
    delete from auth.users where email like 'e2e-${run}-%@irly.test'
    or (email like 'e2e-%@irly.test' and email not like 'e2e-sync-%' and email not like 'e2e-ui-%' and created_at < now() - interval '2 hours')`)
    .catch((e) => console.log('cleanup:', e.message));
}

const { alice: A, bea: B, carl: C } = people;
const anon = createClient(URL, KEY, { auth: { persistSession: false } });

try {
  await cleanup();

  // ───── Sign-up by email, as the app does it (real Supabase Auth) ─────
  await step('email sign-up: account, one profile, sign out, sign in again, no duplicate, then deletion', async () => {
    const email = `e2e-${run}-signup@irly.test`;
    const pw = `Signup-${run}-pw!`;
    const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const weak = await sb.auth.signUp({ email, password: 'short' });
    if (!weak.error) throw new Error('a 5-character password was accepted');
    const up = await timed('sign up (email)', () => sb.auth.signUp({ email, password: pw }));
    if (up.error) throw new Error(up.error.message);
    if (!up.data.session) {
      // Email confirmation is on: the account exists but needs the link. Remove it and say so.
      await sql(`delete from public.communities where created_by in (select id from auth.users where email = '${email}');
    delete from auth.users where email = '${email}'`);
      console.log('   (email confirmation required: the sign-in part needs the emailed link, not testable here)');
      return true;
    }
    const uid = up.data.user.id;
    must(await sb.from('profiles').insert({ id: uid, first_name: 'Sig', birthdate: '1994-01-01', gender: 'woman', city_id: 'dubai', languages: ['en'], interests: ['sport', 'food', 'art'] }));
    const dup = await sb.from('profiles').insert({ id: uid, first_name: 'Sig2', birthdate: '1994-01-01', gender: 'woman', city_id: 'dubai' });
    await sb.auth.signOut();
    const back = await timed('sign in (email)', () => sb.auth.signInWithPassword({ email, password: pw }));
    if (back.error) throw new Error(back.error.message);
    const wrong = await sb.auth.signInWithPassword({ email, password: 'Wrong-password-1' });
    const mine = must(await sb.from('profiles').select('id, first_name').eq('id', uid));
    must(await sb.rpc('delete_my_account'));
    const [left] = await sql(`select count(*)::int as n from auth.users where id = '${uid}'`);
    return Boolean(dup.error) && !back.error && Boolean(wrong.error) && mine.length === 1 && mine[0].first_name === 'Sig' && left.n === 0;
  });

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
  await step('anonymous visitors read no profiles', async () => {
    // Refused outright since migration 1300 (no column is granted to anon).
    const r = await anon.from('profiles').select('id');
    return Boolean(r.error) || (r.data ?? []).length === 0;
  });
  await step('others\' birthdate and faith are not readable', async () => {
    const r = await A.sb.from('profiles').select('birthdate, faith').neq('id', A.id);
    return Boolean(r.error);
  });

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
  // Speed: real round trips against the live project, measured.
  await step('Alice and Carl become friends (request, notification, accept, both sides agree)', async () => {
    const sent = must(await timed('add friend (request)', () => A.sb.rpc('add_friend', { p_user: C.id })));
    const notified = must(await C.sb.from('notifications').select('kind, payload')).some((n) => n.kind === 'FRIEND_REQUEST' && n.payload?.from === A.id);
    const asked = must(await A.sb.rpc('public_profile', { p_user: C.id }))[0]?.friend_status === 'outgoing';
    const accepted = must(await timed('add friend (accept)', () => C.sb.rpc('add_friend', { p_user: A.id }))) === 'accepted';
    const both = must(await A.sb.rpc('public_profile', { p_user: C.id }))[0]?.friend_status === 'friends' && must(await C.sb.rpc('public_profile', { p_user: A.id }))[0]?.friend_status === 'friends';
    const told = must(await A.sb.from('notifications').select('kind, payload')).some((n) => n.kind === 'FRIEND_ACCEPTED' && n.payload?.from === C.id);
    // A second tap changes nothing and never fails.
    const again = must(await A.sb.rpc('add_friend', { p_user: C.id }));
    return sent === 'pending' && notified && asked && accepted && both && told && again === 'accepted';
  });
  await step('a friend request cannot be sent in someone else\'s name', () => denied(A.sb.from('friendships').insert({ user_a: B.id < C.id ? B.id : C.id, user_b: B.id < C.id ? C.id : B.id, requested_by: B.id })));
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
  // Live with a video: stored, poster stored, seen by a friend, gone with the post.
  let videoPost;
  const videoPath = `${A.id}/e2e-${run}.mp4`;
  const posterPath = `${A.id}/e2e-${run}-poster.jpg`;
  await step('Alice posts a video on the Live (file, poster, then the post)', async () => {
    must(await timed('upload video (100 kB)', () => A.sb.storage.from('irl-media').upload(videoPath, new Uint8Array(100 * 1024), { contentType: 'video/mp4' })));
    must(await A.sb.storage.from('irl-media').upload(posterPath, new Uint8Array(2048), { contentType: 'image/jpeg' }));
    const d = must(await timed('publish a Live post', () => A.sb.from('irl_posts').insert({ author_id: A.id, city_id: 'bali', area_id: 'canggu', body: '', media_path: videoPath, media_kind: 'video', thumb_path: posterPath, media_seconds: 9, visibility: 'friends' }).select('id').single()));
    videoPost = d.id;
    return true;
  });
  await step('Carl (friend) gets it in the feed as a video with its poster, and can open both files', async () => {
    const row = must(await timed('open the Live feed', () => C.sb.rpc('irl_feed', { p_city: 'bali' }))).find((p) => p.id === videoPost);
    if (!row || row.media_kind !== 'video' || row.thumb_path !== posterPath || row.media_seconds !== 9) return false;
    const links = must(await C.sb.storage.from('irl-media').createSignedUrls([videoPath, posterPath], 60));
    return links.every((l) => l.signedUrl);
  });
  await step('Bea (not a friend) can open neither the post nor its files', async () => {
    const inFeed = must(await B.sb.rpc('irl_feed', { p_city: 'bali' })).some((p) => p.id === videoPost);
    const { data } = await B.sb.storage.from('irl-media').createSignedUrls([videoPath, posterPath], 60);
    return !inFeed && !(data ?? []).some((l) => l.signedUrl);
  });
  await step('Carl cannot post pointing at Alice\'s video', () => denied(C.sb.from('irl_posts').insert({ author_id: C.id, city_id: 'bali', area_id: 'canggu', body: 'mine', media_path: videoPath, media_kind: 'video' })));
  await step('Alice deletes the video post: the post and both files are gone', async () => {
    must(await A.sb.from('irl_posts').delete().eq('id', videoPost));
    must(await A.sb.storage.from('irl-media').remove([videoPath, posterPath]));
    const { data } = await A.sb.storage.from('irl-media').list(A.id, { search: `e2e-${run}` });
    return !(data ?? []).length;
  });

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
  // Match needs a verified profile (a selfie reviewed by an IRLY admin) once
  // that migration is live: test members are not verified, so Match must
  // refuse them, and the private chat below is opened directly instead.
  const verification = !(await A.sb.rpc('my_verification')).error;
  if (verification) {
    await step('Match refuses members whose profile is not verified', async () => {
      const r = await A.sb.rpc('irly_match_discover', { p_filters: {}, p_limit: 50, p_offset: 0 });
      const p = await A.sb.rpc('people_match', { p_city: 'dubai' });
      return /verify your profile/i.test(r.error?.message ?? '') && /verify your profile/i.test(p.error?.message ?? '');
    });
    await step('nobody can give themselves the verified badge', async () => {
      await A.sb.from('profiles').update({ verified_at: new Date().toISOString() }).eq('id', A.id);
      const v = must(await A.sb.rpc('my_verification'));
      return !v[0]?.verified_at;
    });
  } else {
    await step('Alice discovers Bea with a score', async () => {
      const list = must(await A.sb.rpc('irly_match_discover', { p_filters: {}, p_limit: 50, p_offset: 0 }));
      const bea = list.find((x) => x.user_id === B.id);
      return Boolean(bea) && bea.score > 0;
    });
  }
  let matchConv;
  if (verification) {
    await step('a private chat between Alice and Bea', async () => {
      // Without a match, a private chat needs the other member's consent: they become friends first.
      must(await A.sb.rpc('add_friend', { p_user: B.id }));
      must(await B.sb.rpc('add_friend', { p_user: A.id }));
      matchConv = must(await A.sb.rpc('open_direct', { p_user: B.id }));
      must(await A.sb.from('messages').insert({ conversation_id: matchConv, sender_id: A.id, body: 'Hi Bea!' }));
      return Boolean(matchConv);
    });
  } else {
    await step('mutual like → match → private chat', async () => {
      must(await A.sb.rpc('irly_match_act', { p_target: B.id, p_action: 'like' }));
      const r = must(await B.sb.rpc('irly_match_act', { p_target: A.id, p_action: 'like' }));
      matchConv = r[0]?.conversation_id;
      return Boolean(matchConv);
    });
  }
  await step('the private chat: both can write', async () => {
    must(await B.sb.from('messages').insert({ conversation_id: matchConv, sender_id: B.id, body: 'Brunch this weekend?' }));
    return must(await A.sb.from('messages').select('body').eq('conversation_id', matchConv)).length >= 2;
  });
  await step('a new message notifies Alice (unread), and reading the chat clears it: the bell badge follows', async () => {
    const unreadBefore = must(await A.sb.from('notifications').select('id').eq('kind', 'MESSAGE_CREATED').eq('payload->>conversation_id', matchConv).is('read_at', null)).length;
    must(await timed('open a conversation (mark read)', () => A.sb.rpc('mark_conversation_read', { p_conversation: matchConv })));
    const unreadAfter = must(await A.sb.from('notifications').select('id').eq('kind', 'MESSAGE_CREATED').eq('payload->>conversation_id', matchConv).is('read_at', null)).length;
    const inbox = must(await A.sb.rpc('my_conversations', {})).find((c) => c.conversation_id === matchConv);
    return unreadBefore >= 1 && unreadAfter === 0 && inbox?.unread === 0;
  });
  // Tidying a chat is personal: delete for me, archive, delete conversation.
  await step('delete for me: Alice no longer sees the message, Bea still does', async () => {
    const m = must(await B.sb.from('messages').select('id').eq('conversation_id', matchConv).eq('body', 'Brunch this weekend?').single());
    must(await A.sb.rpc('hide_message_for_me', { p_message: m.id }));
    const forA = must(await A.sb.from('messages').select('id').eq('id', m.id));
    const forB = must(await B.sb.from('messages').select('id').eq('id', m.id));
    return forA.length === 0 && forB.length === 1;
  });
  await step('a stranger cannot hide or archive in someone else\'s chat', async () => {
    await denied(C.sb.rpc('set_conversation_archived', { p_conversation: matchConv, p_archived: true }));
    return denied(C.sb.rpc('remove_conversation_for_me', { p_conversation: matchConv }));
  });
  await step('archive: the chat moves to Alice\'s Archived list only', async () => {
    must(await A.sb.rpc('set_conversation_archived', { p_conversation: matchConv, p_archived: true }));
    const a = must(await A.sb.rpc('my_conversations', {})).find((c) => c.conversation_id === matchConv);
    const b = must(await B.sb.rpc('my_conversations', {})).find((c) => c.conversation_id === matchConv);
    return a?.archived === true && b?.archived === false;
  });
  await step('unarchive brings it back', async () => {
    must(await A.sb.rpc('set_conversation_archived', { p_conversation: matchConv, p_archived: false }));
    return must(await A.sb.rpc('my_conversations', {})).find((c) => c.conversation_id === matchConv)?.archived === false;
  });
  await step('delete conversation: gone for Alice, kept for Bea; a new message brings it back alone', async () => {
    must(await A.sb.rpc('remove_conversation_for_me', { p_conversation: matchConv }));
    const goneForA = !must(await A.sb.rpc('my_conversations', {})).some((c) => c.conversation_id === matchConv);
    const oldForA = must(await A.sb.from('messages').select('id').eq('conversation_id', matchConv)).length;
    const keptForB = must(await B.sb.from('messages').select('id').eq('conversation_id', matchConv)).length;
    await new Promise((r) => setTimeout(r, 50));
    must(await B.sb.from('messages').insert({ conversation_id: matchConv, sender_id: B.id, body: 'Still on for brunch?' }));
    const back = must(await A.sb.from('messages').select('body').eq('conversation_id', matchConv));
    const row = must(await A.sb.rpc('my_conversations', {})).find((c) => c.conversation_id === matchConv);
    return goneForA && oldForA === 0 && keptForB >= 2 && back.length === 1 && back[0].body === 'Still on for brunch?' && row?.unread === 1;
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

  // ───── Community posts ─────
  let girlsId;
  await step('Alice posts in Bali Girls; Bea joins and sees it with its author', async () => {
    girlsId = must(await A.sb.from('communities').select('id').eq('city_id', 'bali').eq('name', 'Bali Girls').single()).id;
    must(await A.sb.from('community_posts').insert({ community_id: girlsId, author_id: A.id, body: `E2E brunch sunday, who's in? ${run}` }));
    must(await B.sb.rpc('join_community', { p_community: girlsId }));
    const feed = must(await B.sb.rpc('community_feed', { p_community: girlsId, p_limit: 50 }));
    return feed.some((p) => p.body.includes(run) && p.first_name === 'Alice');
  });
  await step('poll: Bea votes once, counts update', async () => {
    const d = must(await A.sb.from('community_posts').insert({ community_id: girlsId, author_id: A.id, body: `E2E poll ${run}?`, poll: { options: ['Sat', 'Sun'] } }).select('id').single());
    must(await B.sb.from('community_poll_votes').insert({ post_id: d.id, user_id: B.id, option: 1 }));
    const r = must(await A.sb.rpc('community_feed', { p_community: girlsId, p_limit: 50 })).find((p) => p.id === d.id);
    return r.poll_counts[1] === 1;
  });
  await step('Bea is notified of Alice\'s new post', async () => must(await B.sb.from('notifications').select('kind')).some((n) => n.kind === 'COMMUNITY_POST'));
  await step('Carl (man) cannot read or post in a girls community', async () => {
    const r = await C.sb.rpc('community_feed', { p_community: girlsId, p_limit: 5 });
    const ins = await C.sb.from('community_posts').insert({ community_id: girlsId, author_id: C.id, body: 'x' });
    return (r.data ?? []).length === 0 && Boolean(ins.error);
  });
  await step('community activity linked to the community, announced in the feed', async () => {
    const a = must(await A.sb.from('activities').insert({ creator_id: A.id, title: `E2E community brunch ${run}`, category_id: 'food', city_id: 'bali', area_id: 'canggu', starts_at: new Date(Date.now() + 3 * 86400000).toISOString(), community_id: girlsId, girl_only: true, privacy: 'community' }).select('id').single());
    must(await A.sb.from('community_posts').insert({ community_id: girlsId, author_id: A.id, body: 'New plan', activity_id: a.id }));
    const post = must(await B.sb.rpc('community_feed', { p_community: girlsId, p_limit: 50 })).find((p) => p.activity_id === a.id);
    return Boolean(post?.activity_title);
  });
  await step('digest summarises the week', async () => must(await A.sb.rpc('community_digest', { p_community: girlsId }))[0].posts_week >= 3);

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

  // ───── Attacks (security audit): a stranger, a visitor, the wrong owner ─────
  await step('a stranger reads none of a private chat', async () => (must(await C.sb.from('messages').select('id').eq('conversation_id', matchConv))).length === 0);
  await step('a stranger cannot write into a private chat', () => denied(C.sb.from('messages').insert({ conversation_id: matchConv, sender_id: C.id, body: 'let me in' })));
  await step('a stranger cannot add himself to a private chat', () => denied(C.sb.from('conversation_members').insert({ conversation_id: matchConv, user_id: C.id })));
  await step('a member cannot edit someone else\'s message', async () => (must(await A.sb.from('messages').update({ body: 'forged' }).eq('conversation_id', matchConv).neq('sender_id', A.id).select('id'))).length === 0);
  await step('a member cannot make herself an admin', () => denied(B.sb.from('profiles').update({ is_admin: true }).eq('id', B.id).select().single()));
  // Security audit (20261020001000): the profiles_public view was writable through Supabase's
  // default grants, so anyone could rename or delete another member. Local DB tests re-grant
  // tables after the migrations and cannot prove the revoke: checked here, on the live project.
  await step('nobody can rename another member through profiles_public', async () => {
    await C.sb.from('profiles_public').update({ first_name: 'Pwned' }).eq('id', A.id);
    const row = must(await A.sb.from('profiles').select('first_name').eq('id', A.id).single());
    return row.first_name !== 'Pwned';
  });
  await step('nobody can delete another member through profiles_public', async () => {
    await C.sb.from('profiles_public').delete().eq('id', A.id);
    return Boolean(must(await A.sb.from('profiles').select('id').eq('id', A.id).maybeSingle()));
  });
  await step('a visitor cannot read profiles_public', async () => ((await anon.from('profiles_public').select('id').limit(1)).data ?? []).length === 0);
  await step('a visitor cannot call signed-in-only functions (search_all)', async () => Boolean((await anon.rpc('search_all', { p_q: 'pa' })).error));
  await step('a member cannot send a message in someone else\'s name', () => denied(B.sb.from('messages').insert({ conversation_id: matchConv, sender_id: A.id, body: 'forged sender' })));
  const jpeg = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='), (c) => c.charCodeAt(0));
  const own = `${A.id}/sec-${run}.jpg`;
  await step('a member uploads a photo into her own folder', async () => (must(await A.sb.storage.from('chat-media').upload(own, jpeg, { contentType: 'image/jpeg' })), true));
  await step('nobody can upload into someone else\'s folder', () => denied(B.sb.storage.from('chat-media').upload(`${A.id}/intruder-${run}.jpg`, jpeg, { contentType: 'image/jpeg' })));
  await step('nobody can delete someone else\'s photo', async () => {
    await B.sb.storage.from('chat-media').remove([own]);
    return Boolean((await A.sb.storage.from('chat-media').download(own)).data);
  });
  await step('a stranger cannot download a chat photo', async () => Boolean((await C.sb.storage.from('chat-media').download(own)).error));
  await step('a stranger cannot get a link to a chat photo', async () => Boolean((await C.sb.storage.from('chat-media').createSignedUrl(own, 60)).error));
  await step('a visitor cannot download a chat photo', async () => Boolean((await anon.storage.from('chat-media').download(own)).error));
  await step('a file that is not an image is refused', () => denied(A.sb.storage.from('chat-media').upload(`${A.id}/page-${run}.html`, new TextEncoder().encode('<script>alert(1)</script>'), { contentType: 'text/html' })));
  await A.sb.storage.from('chat-media').remove([own]);
  // Avatars show a small copy ("-s.jpg") of the profile photo when it exists, else the photo itself.
  const face = `${A.id}/avatar-${run}.jpg`;
  const faceThumb = `${A.id}/avatar-${run}-s.jpg`;
  // Other members may only read the photos a profile shows (security audit): the app saves the
  // path in photo_paths when the photo is chosen, so the test does the same, and puts hers back after.
  const facesBefore = must(await A.sb.from('profiles').select('photo_paths').eq('id', A.id).single()).photo_paths ?? [];
  await step('a file in a member\'s folder that her profile does not show is not readable by others', async () => {
    must(await A.sb.storage.from('profile-photos').upload(face, jpeg, { contentType: 'image/jpeg' }));
    const links = (await B.sb.storage.from('profile-photos').createSignedUrls([face], 3600)).data ?? [];
    return !links.some((l) => l.path === face && l.signedUrl);
  });
  must(await A.sb.from('profiles').update({ photo_paths: [face] }).eq('id', A.id));
  await step('profile photo without a small copy: the app gets a link for the photo only', async () => {
    const links = must(await timed('sign 2 faces', () => B.sb.storage.from('profile-photos').createSignedUrls([faceThumb, face], 3600)));
    const byPath = Object.fromEntries(links.map((l) => [l.path, l.signedUrl]));
    if (byPath[faceThumb]) throw new Error('a missing small copy got a link');
    if (!byPath[face]) throw new Error('the photo got no link');
    return true;
  });
  await step('profile photo with its small copy: both get links, the small copy downloads', async () => {
    must(await A.sb.storage.from('profile-photos').upload(faceThumb, jpeg, { contentType: 'image/jpeg', upsert: true }));
    const links = must(await B.sb.storage.from('profile-photos').createSignedUrls([faceThumb, face], 3600));
    const small = links.find((l) => l.path === faceThumb)?.signedUrl;
    if (!small || !links.find((l) => l.path === face)?.signedUrl) throw new Error('missing link');
    const res = await timed('download a face (small copy)', () => fetch(small));
    return res.ok;
  });
  await A.sb.from('profiles').update({ photo_paths: facesBefore }).eq('id', A.id);
  await A.sb.storage.from('profile-photos').remove([face, faceThumb]);
  // Publications v2: a profile post with photos, readable by members, files follow the post.
  // Skipped (and said so) until its migration is on the live database.
  const postsV2 = !(await A.sb.from('community_posts').select('media_paths').limit(1)).error;
  if (!postsV2) console.log('○ publications v2: migration not deployed yet, steps skipped');
  const pm = [`${A.id}/post-${run}-0.jpg`, `${A.id}/post-${run}-1.jpg`];
  let profilePost;
  if (postsV2) await step('a profile post with two photos and no text is published', async () => {
    for (const p of pm) must(await A.sb.storage.from('post-media').upload(p, jpeg, { contentType: 'image/jpeg' }));
    profilePost = must(await timed('publish a post with 2 photos', () => A.sb.from('community_posts').insert({ author_id: A.id, body: '', media_paths: pm, media_kind: 'photo' }).select('id').single())).id;
    return Boolean(profilePost);
  });
  if (postsV2) await step('another member sees the post on the profile and opens its photos', async () => {
    const rows = must(await B.sb.from('community_posts').select('id, media_paths').eq('author_id', A.id).is('community_id', null));
    if (!rows.some((r) => r.id === profilePost)) throw new Error('post not visible');
    const links = must(await B.sb.storage.from('post-media').createSignedUrls(pm, 600));
    return links.every((l) => l.signedUrl);
  });
  if (postsV2) await step('the author edits the post; nobody else can', async () => {
    must(await A.sb.from('community_posts').update({ body: 'Sunset at JBR' }).eq('id', profilePost));
    await B.sb.from('community_posts').update({ body: 'hacked' }).eq('id', profilePost);
    // Bea reads it back (Alice blocked Carl earlier, so he sees none of her posts).
    const r = must(await B.sb.from('community_posts').select('body, edited_at').eq('id', profilePost).single());
    return r.body === 'Sunset at JBR' && Boolean(r.edited_at);
  });
  if (postsV2) await step('a deleted post\'s photos are no longer readable by others', async () => {
    must(await A.sb.from('community_posts').update({ deleted_at: new Date().toISOString() }).eq('id', profilePost));
    const links = (await B.sb.storage.from('post-media').createSignedUrls(pm, 600)).data ?? [];
    return links.every((l) => !l.signedUrl);
  });
  if (postsV2) await A.sb.storage.from('post-media').remove(pm);
  // Communities v2: groups inside communities, hosts-only announcements and pins.
  const groupsV2 = !(await A.sb.rpc('community_rights', { p_community: '00000000-0000-0000-0000-000000000000' })).error;
  if (!groupsV2) console.log('○ communities v2: migration not deployed yet, steps skipped');
  if (groupsV2) await step('a group (Padel) is joined from its community, and joining it joins the community', async () => {
    const sport = must(await A.sb.from('communities').select('id').eq('official', true).eq('topic', 'sport').eq('city_id', 'dubai').is('parent_id', null).single());
    const groups = must(await A.sb.rpc('community_subgroups', { p_parent: sport.id }));
    const padel = groups.find((g) => g.name === 'Padel');
    if (!padel) throw new Error('no Padel group');
    must(await timed('join a group', () => A.sb.rpc('join_community', { p_community: padel.id })));
    const both = must(await A.sb.from('community_members').select('community_id').eq('user_id', A.id).in('community_id', [sport.id, padel.id]));
    const notHost = (await A.sb.rpc('announce', { p_community: padel.id, p_body: 'Hello everyone' })).error;
    // The community page reads the parent and my chat mute setting in one round trip each.
    const withParent = must(await A.sb.from('communities').select('parent_id, parent:parent_id(id, name)').eq('id', padel.id).maybeSingle());
    const parent = Array.isArray(withParent?.parent) ? withParent.parent[0] : withParent?.parent;
    const mine = must(await A.sb.from('conversation_members').select('muted, conversations!inner(community_id)').eq('user_id', A.id).eq('conversations.community_id', sport.id).limit(1));
    await A.sb.rpc('leave_community', { p_community: sport.id });
    if (both.length !== 2) throw new Error(`member of ${both.length} of the community and its group (expected 2)`);
    if (!notHost) throw new Error('a member could announce in a group she does not host');
    if (parent?.id !== sport.id) throw new Error(`the group's parent read back as ${JSON.stringify(withParent)}`);
    if (mine.length !== 1 || typeof mine[0].muted !== 'boolean') throw new Error(`the community chat membership read back as ${JSON.stringify(mine)}`);
    return true;
  });
  const helpV = groupsV2 && !(await A.sb.rpc('help_groups', { p_city: 'dubai' })).error;
  if (helpV) await step('Help & Questions: ask in Visa, another member finds it by keywords and answers', async () => {
    const groups = must(await A.sb.rpc('help_groups', { p_city: 'dubai' }));
    const visa = groups.find((g) => g.category === 'visa');
    must(await A.sb.rpc('join_community', { p_community: visa.id }));
    const q = must(await A.sb.from('community_posts').insert({ community_id: visa.id, author_id: A.id, body: `E2E ${run}: how long is the Emirates ID renewal?`, kind: 'question' }).select('id').single());
    const found = must(await timed('search help', () => B.sb.rpc('help_feed', { p_city: 'dubai', p_category: 'visa', p_query: `${run} renewal` })));
    must(await B.sb.from('comments').insert({ target_type: 'community_post', target_id: q.id, author_id: B.id, body: 'About two weeks' }));
    const again = must(await A.sb.rpc('help_feed', { p_city: 'dubai', p_category: 'visa', p_query: `${run}` }));
    await A.sb.from('community_posts').update({ deleted_at: new Date().toISOString() }).eq('id', q.id);
    await A.sb.rpc('leave_community', { p_community: visa.id });
    return found.some((x) => x.id === q.id) && again.find((x) => x.id === q.id)?.answers === 1;
  });
  await step('opening a chat is one round trip: chat, messages, members with names and photos, my state', async () => {
    const [conv, msgs, members, mine] = await timed('open a chat', () =>
      Promise.all([
        A.sb.from('conversations').select('id, kind, title, community_id, activity_id').eq('id', matchConv).maybeSingle(),
        A.sb.from('messages').select('id, sender_id, kind, body, created_at, ref_type, ref_id, media_path').eq('conversation_id', matchConv).is('deleted_at', null).order('created_at', { ascending: false }).limit(50),
        A.sb.rpc('chat_members', { p_conversation: matchConv }),
        A.sb.from('conversation_members').select('archived_at').eq('conversation_id', matchConv).eq('user_id', A.id).maybeSingle(),
      ]),
    );
    for (const r of [conv, msgs, members, mine]) if (r.error) throw new Error(r.error.message);
    const ids = members.data.map((m) => m.user_id);
    return Boolean(conv.data) && msgs.data.length > 0 && ids.includes(A.id) && ids.includes(B.id) && members.data.every((m) => m.first_name && 'photo_path' in m);
  });
  await step('a stranger gets no members of a private chat', async () => (must(await C.sb.rpc('chat_members', { p_conversation: matchConv })) ?? []).length === 0);
  await step('Realtime: a stranger receives nothing from a private chat, a member does', async () => {
    const got = { a: 0, c: 0 };
    const sub = (who, key) =>
      new Promise((resolve) => {
        // SUBSCRIBED comes before the database listener is ready: wait for the server's own
        // "postgres_changes ok" (or 10 s), otherwise an insert right after can be missed.
        const ch = who.sb
          .channel(`sec-${key}-${run}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${matchConv}` }, () => got[key]++)
          .on('system', {}, (m) => m?.extension === 'postgres_changes' && m?.status === 'ok' && resolve(ch));
        ch.subscribe();
        setTimeout(() => resolve(ch), 10000);
      });
    for (const p of [A, C]) await p.sb.realtime.setAuth((await p.sb.auth.getSession()).data.session.access_token);
    const chans = [await sub(A, 'a'), await sub(C, 'c')];
    await new Promise((r) => setTimeout(r, 1500));
    must(await B.sb.from('messages').insert({ conversation_id: matchConv, sender_id: B.id, body: 'Realtime check' }));
    for (let i = 0; i < 20 && got.a === 0; i++) await new Promise((r) => setTimeout(r, 500));
    // Time for a wrongly delivered event to reach the stranger too.
    await new Promise((r) => setTimeout(r, 2000));
    for (const ch of chans) await ch.unsubscribe();
    if (got.c > 0) throw new Error(`the stranger received ${got.c} event(s)`);
    if (got.a === 0) throw new Error('the member received nothing (Realtime not working)');
    return true;
  });
  // What the app relies on (src/lib/supabase.ts liveChannel): with postgres_changes_options.wait,
  // SUBSCRIBED only comes once the server listens, so an insert made right after it is delivered.
  // Measured without wait too (times on this runner's clock, nothing personal printed).
  await step('Realtime: with wait, SUBSCRIBED means listening (an insert right after it is delivered)', async () => {
    await B.sb.realtime.setAuth((await B.sb.auth.getSession()).data.session.access_token);
    const probe = async (wait) => {
      const t0 = performance.now();
      const body = `probe-${wait ? 'wait' : 'nowait'}-${run}`;
      const got = [];
      let subscribed = null;
      let postgresOk = null;
      const ch = A.sb
        .channel(`probe-${wait ? 'w' : 'n'}-${run}`, wait ? { config: { postgres_changes_options: { wait: true } } } : undefined)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${matchConv}` }, (p) => got.push({ at: performance.now(), body: p.new?.body }))
        .on('system', {}, (m) => {
          if (postgresOk === null && m?.extension === 'postgres_changes' && m?.status === 'ok') postgresOk = Math.round(performance.now() - t0);
        });
      await new Promise((resolve) => {
        ch.subscribe((s) => {
          if (s === 'SUBSCRIBED') {
            subscribed = Math.round(performance.now() - t0);
            resolve();
          }
        });
        setTimeout(resolve, 25000);
      });
      must(await B.sb.from('messages').insert({ conversation_id: matchConv, sender_id: B.id, body }));
      const insertedAt = performance.now();
      for (let i = 0; i < 30 && !got.some((g) => g.body === body); i++) await new Promise((r) => setTimeout(r, 500));
      const hit = got.find((g) => g.body === body);
      await ch.unsubscribe();
      return { wait, subscribedMs: subscribed, postgresOkMs: postgresOk, delivered: Boolean(hit), deliveryMs: hit ? Math.round(hit.at - insertedAt) : null };
    };
    const results = [await probe(false), await probe(true)];
    console.log(`   realtime probe: ${JSON.stringify(results)}`);
    return results[1].delivered && results[1].subscribedMs !== null;
  });

  // ───── Account deletion ─────
  // ───── Push tokens (20261020001300): bound to the phone's install secret ─────
  // Made-up Expo tokens stand for phones. Each phone has its own install secret;
  // only its hash is on the server. Checked on the live project (local tests use
  // a shim): takeover, account switch, offline sign-out release, two devices.
  const pushTok = (n) => `ExponentPushToken[irly-e2e-sec${n}-${run}]`;
  const secret = () => randomBytes(32).toString('base64url');
  const tok1 = pushTok(1), tok2 = pushTok(2), tok3 = pushTok(3);
  const phone1 = secret(), intruder = secret();
  const owners = async (t) => (await sql(`select user_id from public.push_tokens where token = '${t}'`)).map((r) => r.user_id);
  const pushedTo = async (t) => (await sql(`select user_id from public.push_outbox where token = '${t}'`)).map((r) => r.user_id);
  const notifyFriendRequest = (to, from) => sql(`select private.notify('${to}', 'FRIEND_REQUEST', jsonb_build_object('from', '${from}'))`);
  try {
    await step('push: a phone registers its token, bound to its install', async () => {
      must(await A.sb.rpc('register_push_token', { p_token: tok1, p_platform: 'ios', p_lang: 'en', p_install: phone1 }));
      const o = await owners(tok1);
      return o.length === 1 && o[0] === A.id;
    });
    await step('push: another account cannot take that token (its own install secret, or none)', async () => {
      await denied(B.sb.rpc('register_push_token', { p_token: tok1, p_platform: 'ios', p_lang: 'en', p_install: intruder }));
      await denied(B.sb.rpc('register_push_token', { p_token: tok1, p_platform: 'ios', p_lang: 'en' }));
      const o = await owners(tok1);
      return o.length === 1 && o[0] === A.id;
    });
    await step('push: without the install secret, nobody can release a phone\'s token', async () => {
      must(await anon.rpc('release_push_token', { p_token: tok1, p_install: intruder }));
      must(await C.sb.rpc('release_push_token', { p_token: tok1, p_install: intruder }));
      const o = await owners(tok1);
      return o.length === 1 && o[0] === A.id;
    });
    await step('push: account switch on the same phone moves the token to the new account', async () => {
      must(await B.sb.rpc('register_push_token', { p_token: tok1, p_platform: 'ios', p_lang: 'en', p_install: phone1 }));
      const o = await owners(tok1);
      return o.length === 1 && o[0] === B.id;
    });
    await step('push: after the switch, the old account\'s notifications no longer reach that phone; the new account\'s do', async () => {
      await notifyFriendRequest(A.id, B.id);
      await notifyFriendRequest(B.id, C.id);
      const to = await pushedTo(tok1);
      return to.length >= 1 && to.every((u) => u === B.id);
    });
    await step('push: signed out offline, the phone releases its token with its install secret (no session)', async () => {
      must(await anon.rpc('release_push_token', { p_token: tok1, p_install: phone1 }));
      return (await owners(tok1)).length === 0;
    });
    await step('push: once released, that phone gets nothing more for the old account', async () => {
      const before = (await pushedTo(tok1)).length;
      await notifyFriendRequest(B.id, C.id);
      return (await pushedTo(tok1)).length === before;
    });
    await step('push: a released token still cannot be claimed by another install', async () => {
      await denied(C.sb.rpc('register_push_token', { p_token: tok1, p_platform: 'ios', p_lang: 'en', p_install: intruder }));
      return (await owners(tok1)).length === 0;
    });
    await step('push: two phones on one account both receive its notifications', async () => {
      must(await A.sb.rpc('register_push_token', { p_token: tok2, p_platform: 'ios', p_lang: 'en', p_install: secret() }));
      must(await A.sb.rpc('register_push_token', { p_token: tok3, p_platform: 'android', p_lang: 'fr', p_install: secret() }));
      await notifyFriendRequest(A.id, B.id);
      const [t2, t3] = [await pushedTo(tok2), await pushedTo(tok3)];
      return t2.length >= 1 && t3.length >= 1 && [...t2, ...t3].every((u) => u === A.id);
    });
  } finally {
    const list = [tok1, tok2, tok3].map((t) => `'${t}'`).join(',');
    await sql(`delete from public.push_tokens where token in (${list})`).catch(() => null);
    await sql(`delete from private.push_installs where token in (${list})`).catch(() => null);
  }

  await step('Carl deletes his account (everything goes with it)', async () => {
    must(await C.sb.rpc('delete_my_account'));
    const left = await sql(`select count(*)::int as n from public.profiles where id = '${C.id}'`);
    return left[0].n === 0;
  });
  await step('a deleted account\'s old session can no longer act', async () => {
    const r1 = await C.sb.from('irl_posts').insert({ author_id: C.id, city_id: 'bali', area_id: 'canggu', body: 'ghost', visibility: 'friends' });
    const r2 = await C.sb.rpc('open_direct', { p_user: B.id });
    return Boolean(r1.error) && Boolean(r2.error);
  });
} finally {
  await sql(`delete from public.reports where details = 'e2e'`).catch(() => undefined);
  await sql(`delete from public.analytics_events where name = 'IRLY_E_TO_E_RUN'`).catch(() => undefined);
  await cleanup();
}

console.log('\nSpeed (ms, real round trips to the live project):', JSON.stringify(timings));
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('Failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
