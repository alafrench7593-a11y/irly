// A fictional IRLY backend for screenshots: every person, message and activity
// below is invented example content. Photos come from the project's own
// example portraits (public-photos/faces) and photo library.
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from './harness.mjs';

export const HOST = 'https://irlymock.supabase.co';
const FACES = `${REPO}/public-photos/faces`;
const LIB = `${REPO}/public-photos`;

// Deterministic UUIDs.
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const ME = uid(1);

// "Now" for the fixtures (the page clock is fixed to the same instant).
export const NOW = Date.parse('2026-10-13T09:41:00+04:00');
const at = (mins) => new Date(NOW + mins * 60000).toISOString();
const day = (d, hh, mm = 0) => {
  const x = new Date(NOW);
  // Dubai local date arithmetic (UTC+4, no DST).
  const base = Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate() + d, hh - 4, mm);
  return new Date(base).toISOString();
};

const media = (file) => `${HOST}/media/${file}`;

export const PEOPLE = {
  me: { id: ME, name: 'Sara', face: 'p-lea' },
  layla: { id: uid(11), name: 'Layla', face: 'p-layla' },
  kenji: { id: uid(12), name: 'Kenji', face: 'p-kenji' },
  nadia: { id: uid(13), name: 'Nadia', face: 'p-nadia' },
  marco: { id: uid(14), name: 'Marco', face: 'p-marco' },
  priya: { id: uid(15), name: 'Priya', face: 'p-priya' },
  omar: { id: uid(16), name: 'Omar', face: 'p-omar' },
  chloe: { id: uid(17), name: 'Chloé', face: 'p-chloe' },
  lucas: { id: uid(18), name: 'Lucas', face: 'p-lucas' },
  mia: { id: uid(19), name: 'Mia', face: 'p-mia' },
  yusuf: { id: uid(20), name: 'Yusuf', face: 'p-yusuf' },
  tom: { id: uid(21), name: 'Tom', face: 'p-tom' },
  amira: { id: uid(22), name: 'Amira', face: 'p-amira' },
  daniel: { id: uid(23), name: 'Daniel', face: 'p-samuel' },
  james: { id: uid(24), name: 'James', face: 'p-james' },
  ayu: { id: uid(25), name: 'Ayu', face: 'p-ayu' },
  arjun: { id: uid(26), name: 'Arjun', face: 'p-arjun' },
  hana: { id: uid(27), name: 'Hana', face: 'p-hana' },
};
const photoOf = (p) => media(`faces/${p.face}.jpg`);

// ───────── Match IRLY ─────────
const MATCHES = [
  ['layla', 'layla.k', 'dubai', ['startups', 'food'], ['padel'], ['friends']],
  ['kenji', 'kenji.runs', 'dubai', ['tech', 'startups'], ['running'], ['friends', 'sport']],
  ['nadia', 'nadia.builds', 'dubai', ['startups', 'business'], [], ['networking']],
  ['marco', null, 'dubai', ['food', 'travel'], ['padel'], ['friends']],
  ['priya', 'priya.yoga', 'dubai', ['wellness', 'food'], ['yoga'], ['friends']],
  ['omar', 'omar.outdoors', 'abudhabi', ['outdoors', 'travel'], ['hiking'], ['activities']],
].map(([k, username, city, interests, activities, goals], i) => ({
  id: PEOPLE[k].id, first_name: PEOPLE[k].name, photo_path: photoOf(PEOPLE[k]), username, city_id: city, score: 90 - i * 6,
  shared_interests: interests, shared_activities: activities, shared_goals: goals, shared_languages: ['en'], friend_status: k === 'marco' ? 'outgoing' : 'none', i_follow: false,
}));

// ───────── Activities ─────────
const ACT = {
  run: uid(101), padel: uid(102), volley: uid(103), football: uid(104), gym: uid(105), tennis: uid(106), climb: uid(107), boxing: uid(108),
};
const activityRows = [
  { id: ACT.padel, title: 'Padel social · mixed doubles', category_id: 'sport', sub_id: 'padel', area_id: 'alquoz', place_name: 'Al Quoz courts', starts_at: day(0, 19, 30), capacity: 8, going: 6, creator: 'layla' },
  { id: ACT.run, title: 'Sunrise run · 5K by the sea', category_id: 'sport', sub_id: 'running', area_id: 'kitebeach', place_name: 'Kite Beach', starts_at: day(1, 6, 30), capacity: 20, going: 12, creator: 'kenji' },
  { id: ACT.volley, title: 'Beach volleyball at sunset', category_id: 'sport', sub_id: 'volleyball', area_id: 'kitebeach', place_name: 'Kite Beach', starts_at: day(1, 17, 30), capacity: 12, going: 9, creator: 'marco' },
  { id: ACT.football, title: '5-a-side under the lights', category_id: 'sport', sub_id: 'football', area_id: 'barsha', place_name: 'Al Barsha pitches', starts_at: day(2, 20, 0), capacity: 10, going: 8, creator: 'omar' },
  { id: ACT.gym, title: 'Strength club · partner workout', category_id: 'sport', sub_id: 'gym', area_id: 'alquoz', place_name: 'Al Quoz', starts_at: day(3, 7, 0), capacity: 10, going: 5, creator: 'lucas' },
  { id: ACT.tennis, title: 'Tennis doubles · all levels', category_id: 'sport', sub_id: 'tennis', area_id: 'jlt', place_name: 'JLT', starts_at: day(4, 18, 0), capacity: 4, going: 3, creator: 'james' },
  { id: ACT.boxing, title: 'Boxing basics for beginners', category_id: 'sport', sub_id: 'boxing', area_id: 'difc', place_name: 'DIFC', starts_at: day(5, 19, 0), capacity: 12, going: 7, creator: 'tom' },
].map((a) => ({
  id: a.id, title: a.title, category_id: a.category_id, sub_id: a.sub_id, area_id: a.area_id, city_id: 'dubai', girl_only: false, audience: 'all',
  place_name: a.place_name, starts_at: a.starts_at, capacity: a.capacity, price_minor: 0, currency: 'AED', creator_id: PEOPLE[a.creator].id, going: a.going,
  cover_path: null, activity_participants: [], community_id: null,
}));

// ───────── Communities (IRLY's real official catalog, example member counts) ─────────
const COM = { newcomers: uid(201), running: uid(202), food: uid(203), network: uid(204), beach: uid(205), sport: uid(206), girls: uid(207), trip: uid(208), gym: uid(209), expats: uid(210) };
const officialRows = [
  ['newcomers', 'IRLY Newcomers', 'New to the city? Meet people who are discovering it too.', '👋', 486, true, 'lifestyle'],
  ['running', 'IRLY Running', 'Run together, from sunrise 5Ks to race days.', '🏃', 312, false, 'sport'],
  ['food', 'IRLY Food', 'New spots, brunches and dinners to share.', '🍽️', 428, false, 'food'],
  ['network', 'IRLY Network', 'Meet people interested in business and networking.', '🤝', 265, false, 'networking'],
  ['beach', 'IRLY Beach', 'Beach days, water sports and sunsets with good people.', '🏖️', 198, false, 'outdoor'],
  ['sport', 'IRLY Sport', 'Play, train and stay active together.', '🏅', 341, false, 'sport'],
  ['trip', 'IRLY Trip', 'Discover the city and travel with others.', '✈️', 233, false, 'travel'],
  ['gym', 'IRLY Gym', 'Find people who train and stay active.', '🏋️', 274, false, 'sport'],
].map(([topic, name, tagline, emoji, members, isMember, cat], i) => ({
  id: COM[topic], topic, name, tagline, emoji, girl_only: false, intro_first: topic === 'newcomers', members, is_member: isMember, score: 100 - i * 7, city_id: 'dubai',
  category_id: cat, posts_week: [18, 12, 15, 7, 6, 9, 5, 8][i], official: true, created_at: '2026-10-01T08:00:00Z',
}));

// ───────── Conversations ─────────
const CONV = { run: uid(301), layla: uid(302), newcomers: uid(303), brunch: uid(304), marco: uid(305), padel: uid(306) };
const inbox = [
  { conversation_id: CONV.run, kind: 'activity', title: 'Sunrise run · 5K by the sea', other_user_id: null, other_name: null, last_body: 'Count me in ☕️', last_sender: PEOPLE.nadia.id, last_at: at(-4), unread: 3, ref_id: ACT.run, other_photo: null, photo_path: null, members: 12, last_kind: 'text', last_sender_name: 'Nadia' },
  { conversation_id: CONV.layla, kind: 'direct', title: 'Layla', other_user_id: PEOPLE.layla.id, other_name: 'Layla', last_body: 'See you at the court tonight! 🎾', last_sender: PEOPLE.layla.id, last_at: at(-26), unread: 1, ref_id: null, other_photo: photoOf(PEOPLE.layla), photo_path: null, members: 2, last_kind: 'text', last_sender_name: 'Layla' },
  { conversation_id: CONV.newcomers, kind: 'community', title: 'IRLY Newcomers', other_user_id: null, other_name: null, last_body: 'Welcome to everyone who landed this week 👋', last_sender: PEOPLE.kenji.id, last_at: at(-75), unread: 0, ref_id: COM.newcomers, other_photo: null, photo_path: null, members: 486, last_kind: 'text', last_sender_name: 'Kenji' },
  { conversation_id: CONV.brunch, kind: 'group', title: 'Friday brunch crew', other_user_id: null, other_name: null, last_body: 'I booked a table for 6 at 12:30', last_sender: PEOPLE.priya.id, last_at: at(-140), unread: 0, ref_id: null, other_photo: null, photo_path: null, members: 6, last_kind: 'text', last_sender_name: 'Priya' },
  { conversation_id: CONV.marco, kind: 'direct', title: 'Marco', other_user_id: PEOPLE.marco.id, other_name: 'Marco', last_body: 'Great game yesterday, rematch soon?', last_sender: ME, last_at: at(-60 * 20), unread: 0, ref_id: null, other_photo: photoOf(PEOPLE.marco), photo_path: null, members: 2, last_kind: 'text', last_sender_name: 'Sara' },
];

// The activity chat shown in the conversation screen.
const runChat = [
  ['kenji', 'Kite Beach entrance, 6:20 🌅', -170],
  ['layla', 'My first run with you all 😊', -150],
  ['marco', 'Welcome Layla! Easy pace 💪', -142],
  ['kenji', '__photo__beachSunset.jpg', -120],
  ['chloe', 'Last week was so good 🔥', -118],
  ['me', 'I’ll be there! Coffee after?', -9],
  ['nadia', 'Count me in ☕️', -4],
];
const newcomersChat = [
  ['amira', 'Hi all! Just moved from Beirut', -90],
  ['chloe', '__photo__brunch.jpg', -70],
  ['chloe', 'Newcomers brunch last week 🥂', -69],
  ['me', 'Hi! I’m Sara, new in JLT 👋', -12],
  ['nadia', 'Welcome Sara! Coffee Thursday?', -7],
  ['omar', 'Count me in ☕️', -3],
];
const chats = { [CONV.run]: { lines: () => runChat, members: () => runMembers }, [CONV.newcomers]: { lines: () => newcomersChat, members: () => newcomerMembers } };
const messagesFor = (cid) => {
  if (!chats[cid]) return [];
  return chats[cid].lines()
    .map(([who, body, mins], i) => {
      const photo = body.startsWith('__photo__');
      return {
        id: uid((cid === CONV.run ? 400 : 450) + i), sender_id: who === 'me' ? ME : PEOPLE[who].id, kind: photo ? 'photo' : 'text', body: photo ? '' : body, created_at: at(mins), ref_type: null, ref_id: null,
        media_path: photo ? media(`lib/${body.slice(9)}`) : null,
      };
    })
    .reverse();
};
const runMembers = ['me', 'kenji', 'layla', 'marco', 'nadia', 'chloe', 'lucas', 'mia', 'tom', 'yusuf', 'priya', 'arjun'];
const newcomerMembers = ['me', 'kenji', 'layla', 'marco', 'chloe', 'nadia', 'omar', 'mia', 'tom', 'yusuf', 'priya', 'arjun', 'amira', 'hana'];

const newcomerPosts = [
  { id: uid(701), author_id: PEOPLE.kenji.id, first_name: 'Kenji', body: 'Welcome to everyone who landed this week 👋 Newcomers drinks on Thursday, come say hi!', activity_id: uid(109), activity_title: 'Newcomers drinks · Marina Walk', activity_starts_at: day(2, 19, 0), poll: null, poll_counts: [], my_vote: null, likes: 42, comments: 11, liked: true, created_at: at(-75) },
  { id: uid(702), author_id: PEOPLE.layla.id, first_name: 'Layla', body: 'Moved here two weeks ago and already found my running group. Thank you all! 🏃‍♀️', activity_id: null, activity_title: null, activity_starts_at: null, poll: null, poll_counts: [], my_vote: null, likes: 28, comments: 6, liked: false, created_at: at(-190) },
  { id: uid(703), author_id: PEOPLE.omar.id, first_name: 'Omar', body: 'Best area to live when you just arrive?', activity_id: null, activity_title: null, activity_starts_at: null, poll: { options: ['Dubai Marina', 'JLT', 'Downtown', 'Al Barsha'] }, poll_counts: [31, 24, 17, 9], my_vote: 1, likes: 15, comments: 22, liked: false, created_at: at(-60 * 9) },
];

const irlFeed = [
  ['nadia', 'downtown', 'Downtown', 'Brunch table for 6, two seats left 🥂', 'lib/brunch.jpg', -6, true],
  ['marco', 'jlt', 'JLT courts', 'Tennis doubles tonight, we need a 4th player 🎾', 'lib/tennis.jpg', -14, false],
  ['omar', 'alqudra', 'Al Qudra', 'Desert drive on Friday, 2 spots left in the car', 'lib/dunes.jpg', -31, false],
  ['kenji', 'kitebeach', 'Kite Beach', 'Sunrise run done, coffee anyone? ☕️', 'lib/running.jpg', -48, true],
  ['priya', 'jumeirah', 'Safa Park', 'Yoga in the park tomorrow at 7, all levels', 'lib/girlFitness.jpg', -75, false],
].map(([k, area, place, body, media, mins, friend], i) => ({
  id: uid(800 + i), author_id: PEOPLE[k].id, first_name: PEOPLE[k].name, area_id: area, place_name: place, body, media_path: media, visibility: 'everyone',
  created_at: at(mins), friend, activity_id: null, activity_title: null, city_id: 'dubai',
}));

// ───────── IRLY Girl ─────────
const GIRLS = [
  ['g-ines', 'Inès', 27, 'French in Dubai, always up for brunch and a sunset walk.', ['brunch', 'travel'], ['padel'], ['brunch', 'beach'], true, true],
  ['g-zara', 'Zara', 30, 'Pilates in the morning, good food at night.', ['wellness', 'restaurants'], ['pilates'], ['dinner'], true, false],
  ['g-maya', 'Maya', 26, 'New in the Marina, looking for my girl gang.', ['coffee', 'culture'], ['running'], ['coffee', 'museums'], false, true],
  ['g-sofia', 'Sofia', 31, 'Designer, coffee lover, beach on weekends.', ['coffee', 'creative'], ['yoga'], ['beach'], false, false],
  ['g-lea', 'Léa', 28, 'Padel beginner, brunch expert.', ['brunch', 'fashion'], ['padel'], ['brunch'], true, false],
].map(([face, name, age, bio, interests, sports, activities, active, isNew], i) => ({
  user_id: uid(500 + i), first_name: name, age, city_id: 'dubai', bio, photo_paths: [`faces/${face}.jpg`], interests, sports, activities, goals: ['new_friends'], languages: ['en', 'fr'], areas: ['marina'], travel: [],
  active_now: active, is_new: isNew, saved: false, score: 92 - i * 5,
  reasons: { interests: interests.slice(0, 1), activities: activities.slice(0, 1), sports: sports.slice(0, 1), goals: ['new_friends'], languages: ['en'], areas: ['marina'], availability: [], travel: [], facets: {} },
}));
const GIRL_COMMS = [
  { id: COM.girls, name: 'IRLY Girls', tagline: 'Women meeting women: plans, advice and friendship.', city_id: 'dubai', community_members: Array.from({ length: 214 }, (_, i) => ({ user_id: uid(900 + i) })) },
];
const girlFeed = [
  { id: uid(601), community_id: COM.girls, community_name: 'IRLY Girls', author_id: uid(500), first_name: 'Inès', body: 'Sunset walk on JBR this Friday, who’s in? 🌅', activity_id: null, activity_title: null, activity_starts_at: null, created_at: at(-35), mine: false, is_member: true },
  { id: uid(602), community_id: COM.girls, community_name: 'IRLY Girls', author_id: uid(501), first_name: 'Zara', body: 'Looking for a pilates buddy in JLT, mornings before work 🧘‍♀️', activity_id: null, activity_title: null, activity_starts_at: null, created_at: at(-120), mine: false, is_member: true },
];

// ───────── My profile ─────────
const myProfile = {
  first_name: 'Sara', birthdate: '1997-03-14', gender: 'woman', city_id: 'dubai', country: 'France', languages: ['fr', 'en'],
  bio: 'French in Dubai since this summer. Padel, brunch and sunrise runs.', faith: null, faith_visible: false, arrived_at: day(-30, 10), interests: ['startups', 'food', 'travel'],
  activity_prefs: ['padel', 'running'], intentions: ['friends', 'activities'], photo_paths: [photoOf(PEOPLE.me)],
};

// ───────── Request handling ─────────
const fileFor = (rel0) => {
  const rel = rel0.includes('/media/') ? rel0.slice(rel0.indexOf('/media/') + 7) : rel0;
  if (rel.startsWith('faces/')) return path.join(FACES, rel.slice(6));
  if (rel.startsWith('lib/')) {
    const name = rel.slice(4);
    for (const f of [path.join(LIB, name), path.join(LIB, name.replace('.jpg', '-1200.jpg'))]) if (fs.existsSync(f)) return f;
  }
  return null;
};

export function makeMock(opts = {}) {
  const extra = opts.extra || {};
  return async (route, req, log = []) => {
    const u = new URL(req.url());
    const p = u.pathname;
    const method = req.method();
    const accept = req.headers()['accept'] || '';
    const json = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': '*', 'content-range': '0-0/*' }, body: data === undefined ? '' : JSON.stringify(data) });
    const rows = (list) => (accept.includes('vnd.pgrst.object') ? json(list[0] ?? null, list[0] ? 200 : 406) : json(list));
    if (method === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });

    // Media files.
    const mediaRel = p.startsWith('/media/') ? p.slice(7) : p.match(/^\/storage\/v1\/object\/(?:sign|public)\/[^/]+\/(.+)$/)?.[1];
    if (mediaRel && method === 'GET') {
      const f = fileFor(decodeURIComponent(mediaRel));
      if (f) return route.fulfill({ path: f, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' } });
      log.push(`MEDIA missing ${mediaRel}`);
      return route.abort();
    }
    // Storage signing.
    const signMany = p.match(/^\/storage\/v1\/object\/sign\/([^/]+)$/);
    if (signMany && method === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      return json((body.paths || []).map((x) => ({ path: x, signedURL: `/object/sign/${signMany[1]}/${x}?token=mock`, error: null })));
    }
    const signOne = p.match(/^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/);
    if (signOne && method === 'POST') return json({ signedURL: `/object/sign/${signOne[1]}/${signOne[2]}?token=mock` });

    // Auth.
    if (p.startsWith('/auth/v1/user')) return json(opts.user);
    if (p.startsWith('/auth/v1/settings')) return json({ external: { email: true, apple: true, google: true, phone: false } });
    if (p.startsWith('/auth/v1/token')) return json(opts.session);
    if (p.startsWith('/auth/v1/logout')) return json({}, 204);

    // RPCs.
    const rpc = p.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)?.[1];
    if (rpc) {
      const args = JSON.parse(req.postData() || '{}');
      if (extra[rpc]) return json(extra[rpc](args));
      switch (rpc) {
        case 'my_profile': return json([myProfile]);
        case 'public_profile': return json([]);
        case 'member_communities': return json([]);
        case 'my_conversations': return json(inbox);
        case 'people_match': return json(args.p_offset ? [] : MATCHES);
        case 'community_recommend': return json(officialRows.slice(0, args.p_limit || 6));
        case 'community_list': return json(officialRows);
        case 'recommend_activities': return json([]);
        case 'irly_match_state': return json('ready');
        case 'irly_match_discover': return json(args.p_offset ? [] : GIRLS);
        case 'irly_my_matches': return json([]);
        case 'girl_feed': return json(girlFeed);
        case 'my_girl_status': return json(null);
        case 'chat_members': {
          const named = (chats[args.p_conversation]?.members() ?? runMembers).map((k) => ({ user_id: k === 'me' ? ME : PEOPLE[k].id, first_name: k === 'me' ? 'Sara' : PEOPLE[k].name, photo_path: photoOf(k === 'me' ? PEOPLE.me : PEOPLE[k]), role: k === 'kenji' ? 'admin' : 'member' }));
          // The community chat counts every member of the community (486 in the examples).
          const total = args.p_conversation === CONV.newcomers ? 486 : named.length;
          const extra = Array.from({ length: total - named.length }, (_, i) => ({ user_id: uid(5000 + i), first_name: 'Member', photo_path: null, role: 'member' }));
          return json([...named, ...extra]);
        }
        case 'community_detail': {
          const c = officialRows.find((x) => x.id === args.p_id);
          return json(c ? [{ id: c.id, name: c.name, tagline: c.tagline, description: 'IRLY Newcomers is where people who just arrived meet the city together: coffees, walks, tips and first friends. Say hello in the chat, join a plan, or start one.', category_id: c.category_id, city_id: 'dubai', girl_only: false, members: c.members, is_member: true, my_role: 'member', conversation_id: CONV.newcomers }] : []);
        }
        case 'community_feed': return json(args.p_community === COM.newcomers ? newcomerPosts : []);
        case 'community_digest': return json([{ posts_week: 18, new_members_week: 37, members: 486, upcoming: 3, next_title: 'Newcomers drinks · Marina Walk', next_starts_at: day(2, 19, 0), top_post_body: null, top_post_likes: 0 }]);
        case 'activity_detail': {
          const a = activityRows.find((x) => x.id === args.p_id);
          return json(a ? [{ ...a, creator_name: Object.values(PEOPLE).find((x) => x.id === a.creator_id)?.name ?? null, format: 'activity', description: 'An easy 5K along the beach at sunrise, all paces welcome. Coffee together after the run.', ends_at: null, community_id: null, cover_url: null, my_status: null, conversation_id: null, cancelled: false }] : []);
        }
        case 'irl_feed': return json(irlFeed);
        case 'my_friends': return json([]);
        case 'mark_conversation_read': return json(null);
        case 'engagement': return json([]);
        default:
          log.push(`RPC(default null) ${rpc} ${JSON.stringify(args).slice(0, 120)}`);
          return json(null);
      }
    }

    // Tables.
    const table = p.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
    if (table) {
      const q = Object.fromEntries(u.searchParams.entries());
      if (method === 'POST') return json(undefined, 201);
      if (method === 'PATCH' || method === 'DELETE') return json(undefined, 204);
      switch (table) {
        case 'profiles': return rows([{ id: ME }]);
        case 'notifications': return rows([]);
        case 'activities': {
          let list = activityRows;
          if (q.category_id) list = list.filter((a) => `eq.${a.category_id}` === q.category_id);
          if (q.girl_only === 'eq.true') list = [];
          if (q.community_id) list = list.slice(0, 2);
          if (q.id) list = list.filter((a) => `eq.${a.id}` === q.id);
          return rows(list);
        }
        case 'communities': {
          if (q.girl_only === 'eq.true') return rows(GIRL_COMMS);
          if (q.id) {
            const c = officialRows.find((x) => `eq.${x.id}` === q.id);
            return rows(c ? [{ cover_path: null, official: true, topic: c.topic, community_topics: { emoji: c.emoji, intro_first: c.intro_first } }] : []);
          }
          return rows([]);
        }
        case 'conversations': {
          const id = (q.id || '').replace('eq.', '');
          const r = inbox.find((x) => x.conversation_id === id);
          if (!r) return rows([]);
          return rows([{ id, kind: r.kind, title: r.kind === 'direct' ? null : r.title, community_id: r.kind === 'community' ? r.ref_id : null, activity_id: r.kind === 'activity' ? r.ref_id : null }]);
        }
        case 'messages': {
          const cid = (q.conversation_id || '').replace('eq.', '');
          return rows(messagesFor(cid));
        }
        case 'conversation_members': {
          if ((q.select || '').includes('muted')) return rows([{ muted: false }]);
          const cidm = (q.conversation_id || '').replace('eq.', '');
          return rows((chats[cidm]?.members() ?? runMembers).map((k) => ({ user_id: k === 'me' ? ME : PEOPLE[k].id, profiles: { first_name: k === 'me' ? 'Sara' : PEOPLE[k].name } })));
        }
        case 'irly_match_config': return rows([]);
        case 'irly_match_profiles':
          return rows([{ bio: 'French in Dubai since this summer.', photo_paths: [`faces/${PEOPLE.me.face}.jpg`], interests: ['brunch', 'travel'], sports: ['padel'], activities: ['brunch', 'beach'], goals: ['new_friends'], languages: ['fr', 'en'], areas: ['marina'], availability: ['weekend_morning'], travel: [], lifestyle: {}, age_min: 24, age_max: 38, hidden_fields: [], visible: true }]);
        case 'safety_settings': return rows([{ show_active: false }]);
        default:
          log.push(`TABLE(default []) ${table} ${u.search.slice(0, 160)}`);
          return rows([]);
      }
    }
    log.push(`UNHANDLED ${method} ${p}`);
    return route.abort();
  };
}

export const IDS = { ACT, COM, CONV };
