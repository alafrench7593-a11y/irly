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
  samuel: { id: uid(28), name: 'Samuel', face: 'p-samuel' },
  khalid: { id: uid(29), name: 'Khalid', face: 'p-khalid' },
  sofia: { id: uid(30), name: 'Sofia', face: 'p-sofia' },
};
const photoOf = (p) => media(`faces/${p.face}.jpg`);

// ───────── Match IRLY ─────────
const MATCHES = [
  ['layla', 'layla.k', 'dubai', ['startups', 'food'], ['padel'], ['friends']],
  ['kenji', 'kenji.runs', 'dubai', ['startups'], ['running'], ['friends']],
  ['nadia', 'nadia.builds', 'dubai', ['startups', 'business'], [], []],
  ['marco', 'marco.cooks', 'dubai', ['food', 'travel'], ['padel'], ['friends']],
  ['priya', 'priya.yoga', 'dubai', ['wellness', 'food'], ['yoga'], ['friends']],
  ['omar', 'omar.outdoors', 'abudhabi', ['outdoors', 'travel'], ['hiking'], ['activities']],
].map(([k, username, city, interests, activities, goals], i) => ({
  id: PEOPLE[k].id, first_name: PEOPLE[k].name, photo_path: photoOf(PEOPLE[k]), username, city_id: city, score: 90 - i * 6,
  shared_interests: interests, shared_activities: activities, shared_goals: goals, shared_languages: ['en'], friend_status: k === 'marco' ? 'outgoing' : 'none', i_follow: false,
}));

// ───────── Activities ─────────
const ACT = {
  run: uid(101), padel: uid(102), volley: uid(103), football: uid(104), gym: uid(105), tennis: uid(106), climb: uid(107), boxing: uid(108),
  jbr: uid(112), kite: uid(113), desert: uid(114),
};
// Photos members added to their sessions (library photos) and what each session says.
const COVERS = {
  [ACT.padel]: 'lib/padel.jpg', [ACT.run]: 'lib/running.jpg', [ACT.volley]: 'lib/volleyball.jpg', [ACT.football]: 'lib/football.jpg',
  [ACT.gym]: 'lib/gym.jpg', [ACT.tennis]: 'lib/tennis.jpg', [ACT.boxing]: 'lib/boxing.jpg',
  [ACT.jbr]: 'lib/beachSunset.jpg', [ACT.kite]: 'lib/surf.jpg', [ACT.desert]: 'lib/dunes.jpg',
};
const DESCRIPTIONS = {
  [ACT.padel]: 'Mixed doubles, all levels. We rotate partners every set, so you play with everyone. Rackets to lend if you need one.',
  [ACT.run]: 'An easy 5K along the beach at sunrise, all paces welcome. Coffee together after the run.',
  [ACT.volley]: 'Friendly games on the sand until the sun goes down. Teams are made on the spot, so come alone or with friends. All levels: we explain the rules, and there is always a speaker and cold water. Last week we were 14, from 9 countries.',
  [ACT.football]: '5-a-side on the floodlit pitches. Bring a dark and a light shirt.',
  [ACT.tennis]: 'Doubles for every level: we mix the pairs after each set, so you meet everyone. Balls and water on us. Most of us stay for a juice at the café by the courts. New in Dubai? Half of us were too.',
  [ACT.desert]: 'We drive out to Al Qudra for the sunset, then tea and a small fire. Two cars, room for six.',
  [ACT.jbr]: 'A swim at golden hour, then a picnic on the sand. Bring something to share.',
  [ACT.kite]: 'Paddleboards from the rental at Kite Beach, calm water at 6:30. Beginners welcome.',
};
const activityRows = [
  { id: ACT.padel, title: 'Padel social · mixed doubles', category_id: 'sport', sub_id: 'padel', area_id: 'alquoz', place_name: 'Al Quoz courts', starts_at: day(0, 19, 30), capacity: 8, going: 6, creator: 'layla' },
  { id: ACT.run, title: 'Sunrise run · 5K by the sea', category_id: 'sport', sub_id: 'running', area_id: 'kitebeach', place_name: 'Kite Beach', starts_at: day(1, 6, 30), capacity: 20, going: 12, creator: 'kenji' },
  { id: ACT.volley, title: 'Beach volleyball at sunset', category_id: 'sport', sub_id: 'volleyball', area_id: 'kitebeach', place_name: 'By the lifeguard tower', starts_at: day(1, 17, 30), capacity: 12, going: 9, creator: 'marco' },
  { id: ACT.football, title: '5-a-side under the lights', category_id: 'sport', sub_id: 'football', area_id: 'barsha', place_name: 'Al Barsha pitches', starts_at: day(2, 20, 0), capacity: 10, going: 8, creator: 'omar' },
  { id: ACT.gym, title: 'Strength club · partner workout', category_id: 'sport', sub_id: 'gym', area_id: 'alquoz', place_name: 'Al Quoz', starts_at: day(3, 7, 0), capacity: 10, going: 5, creator: 'lucas' },
  { id: ACT.tennis, title: 'Tennis doubles · all levels', category_id: 'sport', sub_id: 'tennis', area_id: 'jlt', place_name: 'JLT Park courts', starts_at: day(4, 18, 0), capacity: 4, going: 3, creator: 'james' },
  { id: ACT.boxing, title: 'Boxing basics for beginners', category_id: 'sport', sub_id: 'boxing', area_id: 'difc', place_name: 'DIFC', starts_at: day(5, 19, 0), capacity: 12, going: 7, creator: 'tom' },
  // Beach & outdoor (search results image): Omar's desert drive is the one his post talks about.
  { id: ACT.jbr, title: 'Sunset swim and picnic', category_id: 'outdoor', sub_id: 'beach', area_id: 'jbr', place_name: 'JBR Beach', starts_at: day(1, 17, 0), capacity: 15, going: 9, creator: 'priya' },
  { id: ACT.kite, title: 'Paddleboard at sunrise', category_id: 'outdoor', sub_id: 'paddleboard', area_id: 'kitebeach', place_name: 'Kite Beach', starts_at: day(2, 6, 30), capacity: 10, going: 6, creator: 'marco' },
  { id: ACT.desert, title: 'Desert drive · dunes at sunset', category_id: 'outdoor', sub_id: 'desert', area_id: 'alqudra', place_name: 'Al Qudra Lakes', starts_at: day(3, 15, 30), capacity: 8, going: 6, creator: 'omar' },
].map((a) => ({
  id: a.id, title: a.title, category_id: a.category_id, sub_id: a.sub_id, area_id: a.area_id, city_id: 'dubai', girl_only: false, audience: 'all',
  place_name: a.place_name, starts_at: a.starts_at, capacity: a.capacity, price_minor: 0, currency: 'AED', creator_id: PEOPLE[a.creator].id, going: a.going,
  cover_path: COVERS[a.id] ?? null, activity_participants: [], community_id: null,
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
const CONV = { run: uid(301), layla: uid(302), newcomers: uid(303), brunch: uid(304), marco: uid(305), padel: uid(306), samuel: uid(307), desert: uid(308), chloe: uid(309) };
const inbox = [
  { conversation_id: CONV.run, kind: 'activity', title: 'Sunrise run · 5K by the sea', other_user_id: null, other_name: null, last_body: 'Yes! I know the best place ☕️', last_sender: PEOPLE.nadia.id, last_at: at(-4), unread: 3, ref_id: ACT.run, other_photo: null, photo_path: null, members: 12, last_kind: 'text', last_sender_name: 'Nadia' },
  { conversation_id: CONV.layla, kind: 'direct', title: 'Layla', other_user_id: PEOPLE.layla.id, other_name: 'Layla', last_body: 'See you at the court tonight! 🎾', last_sender: PEOPLE.layla.id, last_at: at(-26), unread: 1, ref_id: null, other_photo: photoOf(PEOPLE.layla), photo_path: null, members: 2, last_kind: 'text', last_sender_name: 'Layla' },
  { conversation_id: CONV.newcomers, kind: 'community', title: 'IRLY Newcomers', other_user_id: null, other_name: null, last_body: 'Count me in ☕️', last_sender: PEOPLE.omar.id, last_at: at(-3), unread: 0, ref_id: COM.newcomers, other_photo: null, photo_path: null, members: 486, last_kind: 'text', last_sender_name: 'Omar' },
  { conversation_id: CONV.brunch, kind: 'group', title: 'Friday brunch crew', other_user_id: null, other_name: null, last_body: 'I booked a table for 6 at 12:30', last_sender: PEOPLE.priya.id, last_at: at(-140), unread: 0, ref_id: null, other_photo: null, photo_path: 'lib/frenchFood.jpg', members: 6, last_kind: 'text', last_sender_name: 'Priya' },
  { conversation_id: CONV.samuel, kind: 'direct', title: 'Samuel', other_user_id: PEOPLE.samuel.id, other_name: 'Samuel', last_body: 'Come hungry and leave the pitch deck at home 😄', last_sender: PEOPLE.samuel.id, last_at: at(-190), unread: 0, ref_id: null, other_photo: photoOf(PEOPLE.samuel), photo_path: null, members: 2, last_kind: 'text', last_sender_name: 'Samuel' },
];

// The activity chat shown in the conversation screen.
const runChat = [
  ['kenji', 'Kite Beach entrance, 6:20 🌅', -170],
  ['layla', 'My first run with you all 😊', -150],
  ['marco', 'Welcome Layla! Easy pace 💪', -142],
  ['kenji', '__photo__beachSunset.jpg', -120],
  ['chloe', 'Last week was so good 🔥', -118],
  ['me', 'I’ll be there! Coffee after?', -9],
  ['nadia', 'Yes! I know the best place ☕️', -4],
];
const newcomersChat = [
  ['amira', 'Hi all! Just moved from Beirut', -90],
  ['chloe', '__photo__djSunset.jpg', -70],
  ['chloe', 'Our sunset walk yesterday 🌅', -69],
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

// Posts of IRLY Newcomers (Communities v2: a pinned announcement, photos, a question, a poll).
const post = (o) => ({ activity_id: null, activity_title: null, activity_starts_at: null, poll: null, poll_counts: [], my_vote: null, liked: false, media_paths: [], media_kind: null, thumb_path: null, media_seconds: null, edited_at: null, kind: 'post', category: null, pinned_at: null, ...o });
const newcomerPosts = [
  post({ id: uid(701), author_id: PEOPLE.kenji.id, first_name: 'Kenji', kind: 'announcement', pinned_at: at(-70), body: 'Newcomers meetup on Thursday at Marina Walk 👋 Come say hi, the first coffee is on the community.', activity_id: uid(109), activity_title: 'Newcomers meetup · Marina Walk', activity_starts_at: day(2, 19, 0), likes: 42, comments: 11, liked: true, created_at: at(-75) }),
  post({ id: uid(704), author_id: PEOPLE.chloe.id, first_name: 'Chloé', body: 'Concert night with the newcomers 🎶 14 of us!', media_paths: ['lib/concert.jpg', 'lib/girlSunset.jpg'], media_kind: 'photo', likes: 37, comments: 9, created_at: at(-60 * 4) }),
  post({ id: uid(702), author_id: PEOPLE.layla.id, first_name: 'Layla', body: 'Moved here two weeks ago and already found my running group. Thank you all! 🏃‍♀️', likes: 28, comments: 6, created_at: at(-60 * 7) }),
  post({ id: uid(705), author_id: PEOPLE.amira.id, first_name: 'Amira', kind: 'question', body: 'Just arrived from Beirut. Is there a running group for beginners?', likes: 9, comments: 14, created_at: at(-60 * 8) }),
  post({ id: uid(703), author_id: PEOPLE.omar.id, first_name: 'Omar', body: 'Best area to live when you just arrive?', poll: { options: ['Dubai Marina', 'JLT', 'Downtown', 'Al Barsha'] }, poll_counts: [31, 24, 17, 9], my_vote: 1, likes: 15, comments: 22, created_at: at(-60 * 9) }),
];
const newcomerActivities = [
  { id: uid(109), title: 'Newcomers meetup · Marina Walk', starts_at: day(2, 19, 0), area_id: 'marina', going: 23, status: 'upcoming', community_id: COM.newcomers, community_name: 'IRLY Newcomers', pinned_at: at(-70), on_map: true },
  { id: uid(115), title: 'Coffee and city tips · Jumeirah', starts_at: day(4, 10, 0), area_id: 'jumeirah', going: 11, status: 'upcoming', community_id: COM.newcomers, community_name: 'IRLY Newcomers', pinned_at: null, on_map: true },
  { id: uid(116), title: 'Old Dubai walk · Al Fahidi to the souks', starts_at: day(5, 16, 30), area_id: 'burdubai', going: 17, status: 'upcoming', community_id: COM.newcomers, community_name: 'IRLY Newcomers', pinned_at: null, on_map: true },
];

const irlFeed = [
  ['nadia', 'marina', 'Marina Walk', 'Coffee and laptop by the marina, anyone around? ☕️', 'lib/coffeeBar.jpg', -6, true],
  ['marco', 'jlt', 'JLT courts', 'Tennis doubles tonight, we need a 4th player 🎾', null, -14, false],
  ['omar', 'alqudra', 'Al Qudra', 'Desert drive on Friday, 2 spots left in the car', 'lib/dunes.jpg', -31, false],
  ['kenji', 'kitebeach', 'Kite Beach', 'Sunrise run done, coffee anyone? ☕️', 'lib/running.jpg', -48, false],
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

// ───────── Members as the latest app reads them (profile_faces, public_profile, verified_members) ─────────
const keyOf = (id) => Object.keys(PEOPLE).find((k) => PEOPLE[k].id === id);
const faceRow = (id) => ({ id, photo_path: keyOf(id) ? photoOf(PEOPLE[keyOf(id)]) : null });
// Verified: 3 photos and a selfie checked by IRLY (everyone in Match is).
const VERIFIED = new Set(['layla', 'kenji', 'nadia', 'marco', 'priya', 'omar', 'chloe', 'samuel', 'lucas', 'amira', 'arjun']);
const FRIENDS = new Set(['layla', 'chloe', 'kenji']);
// [username, bio, interests, languages, followers, following, friends]
const PROFILES = {
  layla: ['layla.k', 'Born in Dubai, still discovering it. Sunrise runs, gallery nights and the best karak in Satwa.', ['startups', 'food', 'sports', 'art'], ['العربية', 'English', 'Français'], 214, 180, 46],
  kenji: ['kenji.runs', 'Product engineer from Tokyo. Running club at Kite Beach on Thursdays, ramen hunter the rest of the week.', ['tech', 'startups', 'sports', 'food'], ['English'], 132, 141, 29],
  nadia: ['nadia.builds', 'Building a booking app for clinics. Always up for a coffee with other founders in DIFC.', ['startups', 'business', 'wellness'], ['English', 'Français', 'العربية'], 301, 220, 52],
  marco: [null, 'Italian chef turned brand designer. Padel at 7, dinner at 9.', ['food', 'travel', 'sports', 'art'], ['Italiano', 'English'], 96, 104, 23],
  priya: ['priya.yoga', 'Data scientist, yoga teacher on weekends. Safa Park at 7, chai after.', ['wellness', 'food', 'tech'], ['English', 'हिन्दी'], 157, 133, 31],
  omar: ['omar.outdoors', 'Weekends in the desert or up in Hatta. Two seats in the car, always.', ['outdoors', 'travel', 'sports'], ['العربية', 'English'], 188, 120, 38],
  chloe: [null, 'Event producer. I know every rooftop in Dubai and the best sunset spots.', ['music', 'nightlife', 'art'], ['Français', 'English'], 412, 260, 64],
  samuel: [null, 'Founder of a streetwear label. Football on Tuesdays, founders dinners on Thursdays.', ['fashion', 'startups', 'sports'], ['English', 'Français'], 233, 190, 44],
  lucas: [null, 'Angel investor, ex-banker. Coffee in DIFC before 9, padel after 7.', ['business', 'startups', 'sports'], ['English', 'Español'], 175, 98, 27],
};
const profileRow = (k) => {
  const [username, bio, interests, languages, followers, following, friends] = PROFILES[k] ?? [null, null, ['food', 'travel'], ['English'], 24, 30, 6];
  return {
    id: PEOPLE[k].id, first_name: PEOPLE[k].name, photo_path: photoOf(PEOPLE[k]), bio, city_id: 'dubai', interests, languages, visible: true,
    followers, following, i_follow: FRIENDS.has(k), follows_me: FRIENDS.has(k), can_message: FRIENDS.has(k), direct_id: k === 'layla' ? CONV.layla : null,
    is_me: false, friend_status: FRIENDS.has(k) ? 'friends' : 'none', username, friends,
  };
};
// Communities a member is in (their profile) and the posts they wrote there.
const MEMBER_COMMUNITIES = { me: ['newcomers', 'running', 'food'], layla: ['newcomers', 'running', 'food'], kenji: ['running', 'network'], nadia: ['network', 'newcomers'], omar: ['beach', 'trip'] };
const memberCommunities = (k) => (MEMBER_COMMUNITIES[k] ?? ['newcomers', 'food']).map((topic, i) => {
  const c = officialRows.find((x) => x.topic === topic);
  return { id: c.id, name: c.name, city_id: 'dubai', cover_path: null, members: c.members, tagline: c.tagline, role: k === 'kenji' && i === 0 ? 'created' : 'joined' };
});
const MEMBER_POSTS = {
  nadia: [
    ['network', 'Founders coffee in DIFC this morning: 12 of us, three new faces ☕️', ['lib/founders.jpg'], -60 * 2],
    ['newcomers', 'Moved from Paris last year. Happy to share what I learned about setting up a company here.', [], -60 * 26],
  ],
  layla: [
    ['running', 'Thursday 6:30 at Kite Beach, who is joining? Easy pace, coffee after 🏃‍♀️', ['lib/running.jpg'], -60 * 5],
    ['food', 'Found the best karak in Satwa. Taking anyone who wants to try it on Saturday ☕️', [], -60 * 30],
    ['newcomers', 'Moved here two weeks ago and already found my running group. Thank you all!', [], -60 * 54],
  ],
};
const memberPosts = (k) => (MEMBER_POSTS[k] ?? []).map(([topic, body, photos, mins], i) => {
  const c = officialRows.find((x) => x.topic === topic);
  return { id: uid(1700 + i), body, media_path: photos[0] ?? null, media_paths: photos, media_kind: photos.length ? 'photo' : null, thumb_path: null, media_seconds: null, edited_at: null, created_at: at(mins), community_id: c.id, communities: { name: c.name } };
});
const memberActivities = (k) => activityRows
  .filter((a) => a.creator_id === PEOPLE[k].id || (k === 'layla' && [ACT.run, ACT.desert].includes(a.id)))
  .map((a) => ({ id: a.id, title: a.title, category_id: a.category_id, city_id: 'dubai', area_id: a.area_id, place_name: a.place_name, starts_at: a.starts_at, ends_at: null, cover_path: a.cover_path, going: a.going, role: a.creator_id === PEOPLE[k].id ? 'created' : 'joined', state: 'upcoming' }));
// Likes and comments, stable for each item.
const hashOf = (id) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 7);
const engagementRow = (id) => ({ target_id: id, likes: 6 + (hashOf(id) % 48), comments: 1 + (hashOf(id) % 13), saves: hashOf(id) % 9, liked: hashOf(id) % 3 === 0, saved: false });

// ───────── IRLY Network (pro_discover) ─────────
// [person, role, job title, company, industries, skills, project, looking for, can offer, intents, area, connection]
const PROS = [
  ['nadia', 'founder', 'Founder & CEO', null, ['saas', 'startups'], ['Product', 'Fundraising', 'Sales'], 'A booking app for clinics in the UAE', 'A technical cofounder', 'Intros to clinic owners', ['cofounder', 'investors', 'meet'], 'difc', 'none'],
  ['lucas', 'investor', 'Angel investor', null, ['fintech', 'saas', 'startups'], ['Fundraising', 'Finance', 'Partnerships'], null, 'Pre-seed founders in the Gulf', 'First cheques and intros', ['opportunities', 'meet'], 'difc', 'requested'],
  ['samuel', 'founder', 'Founder', null, ['retail', 'ecommerce'], ['Branding', 'Supply chain', 'Social media'], 'A streetwear label made in Dubai', 'Retail partners in the UAE', 'Sourcing contacts in Asia', ['partners', 'suppliers', 'meet'], 'alquoz', 'none'],
  ['kenji', 'employee', 'Senior product engineer', null, ['tech', 'ai'], ['React', 'AI/ML', 'Product'], null, 'Side projects with founders', 'Code and product feedback', ['meet', 'ideas', 'opportunities'], 'jlt', 'none'],
  ['chloe', 'freelancer', 'Event producer', null, ['marketing', 'design'], ['Content', 'Video', 'Partnerships'], null, 'Brands launching in Dubai', 'Launch events from A to Z', ['clients', 'partners'], 'marina', 'none'],
  ['layla', 'employee', 'Product designer', null, ['fintech', 'design'], ['UI/UX', 'Product', 'Branding'], null, 'Designers to share work with', 'Portfolio reviews', ['meet', 'ideas'], 'jumeirah', 'connected'],
  ['arjun', 'entrepreneur', 'E-commerce founder', null, ['ecommerce', 'marketing'], ['Paid ads', 'SEO', 'Growth'], null, 'A growth freelancer', 'Ads that pay for themselves', ['freelancers', 'partners'], 'businessbay', 'none'],
  ['khalid', 'investor', 'Family office partner', null, ['realestate', 'fintech'], ['Finance', 'Legal', 'Partnerships'], null, 'Fintech teams raising a seed', 'Board experience', ['opportunities'], 'difc', 'none'],
].map(([k, role, job, company, industries, skills, project, looking, offer, intents, area, connection]) => ({
  user_id: PEOPLE[k].id, first_name: PEOPLE[k].name, photo_path: photoOf(PEOPLE[k]), role, job_title: job, company, industries, skills, project,
  looking_for: looking, can_offer: offer, intents, city_id: 'dubai', area_id: area, lat: null, lng: null, connection,
}));
const MY_PRO = {
  user_id: uid(1), first_name: 'Sara', photo_path: null, role: 'entrepreneur', job_title: 'Brand strategist', company: null, industries: ['marketing', 'startups'],
  skills: ['Branding', 'Growth', 'Content'], project: 'A studio for brands launching in the Gulf', looking_for: 'Founders who need a brand', can_offer: 'Brand strategy and naming',
  intents: ['meet', 'clients', 'partners'], city_id: 'dubai', area_id: 'jlt', lat: null, lng: null, connection: 'none',
};

// ───────── My profile ─────────
const myProfile = {
  first_name: 'Sara', birthdate: '1997-03-14', gender: 'woman', city_id: 'dubai', country: 'France', languages: ['fr', 'en'],
  bio: 'French in Dubai since this summer. Padel, brunch and sunrise runs.', faith: null, faith_visible: false, arrived_at: day(-30, 10), interests: ['startups', 'business', 'food', 'travel'],
  activity_prefs: ['padel', 'running'], intentions: ['friends', 'activities'], photo_paths: [photoOf(PEOPLE.me)],
};

// ───────── Request handling ─────────
const fileFor = (rel0) => {
  const rel = rel0.includes('/media/') ? rel0.slice(rel0.indexOf('/media/') + 7) : rel0;
  if (rel.startsWith('faces/')) {
    // Small variants (p-layla-s.jpg) are made when the site is deployed: the full portrait stands in.
    const name = rel.slice(6);
    for (const f of [path.join(FACES, name), path.join(FACES, name.replace(/-s\.jpg$/, '.jpg'))]) if (fs.existsSync(f)) return f;
    return null;
  }
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
        case 'public_profile': {
          const k = keyOf(args.p_user);
          return json(k && k !== 'me' ? [profileRow(k)] : []);
        }
        case 'member_communities': return json(memberCommunities(keyOf(args.p_user) ?? 'me'));
        case 'member_activities': return json(keyOf(args.p_user) ? memberActivities(keyOf(args.p_user)) : []);
        case 'member_lives': return json(keyOf(args.p_user) === 'layla' ? [{ id: uid(1800), body: 'Padel tonight at Al Quoz, we need a 4th 🎾', media_path: 'lib/padel.jpg', area_id: 'alquoz', place_name: 'Al Quoz courts', created_at: at(-25), expires_at: at(215), live: true, media_kind: 'photo', thumb_path: null }] : []);
        case 'profile_faces': return json((args.p_ids ?? []).map(faceRow));
        case 'verified_members': return json((args.p_ids ?? []).filter((id) => VERIFIED.has(keyOf(id))).map((id) => ({ id })));
        case 'my_verification': return json([{ photos: 3, verified_at: '2026-10-05T10:00:00Z', request_id: null, status: 'approved', gesture: null, reason: null, ready: true }]);
        case 'pro_discover': return json(PROS);
        case 'pro_profile_of': return json(args.p_user === ME ? [MY_PRO] : PROS.filter((x) => x.user_id === args.p_user));
        case 'today_activities': return json([]);
        case 'community_subgroups': return json([]);
        case 'community_activities': return json(args.p_community === COM.newcomers && !args.p_past ? newcomerActivities : []);
        case 'my_conversations': return json(inbox);
        case 'people_match': return json(args.p_offset ? [] : MATCHES);
        // Five recommendations for Sara's interests (the server ranks them; the list fits the screen).
        case 'community_recommend': return json(officialRows.slice(0, Math.min(args.p_limit || 6, 5)));
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
        case 'community_digest': return json([{ posts_week: 18, new_members_week: 37, members: 486, upcoming: 3, next_title: 'Newcomers meetup · Marina Walk', next_starts_at: day(2, 19, 0), top_post_body: null, top_post_likes: 0 }]);
        case 'activity_detail': {
          const a = activityRows.find((x) => x.id === args.p_id);
          return json(a ? [{ ...a, creator_name: Object.values(PEOPLE).find((x) => x.id === a.creator_id)?.name ?? null, format: 'activity', description: DESCRIPTIONS[a.id] ?? null, ends_at: null, community_id: null, cover_url: a.cover_path, my_status: null, conversation_id: null, cancelled: false }] : []);
        }
        case 'irl_feed': return json(irlFeed);
        case 'my_friends': return json([]);
        case 'mark_conversation_read': return json(null);
        case 'engagement': return json((args.p_ids ?? []).map(engagementRow));
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
          if ((q.id || '').startsWith('in.(')) {
            const ids = q.id.slice(4, -1).split(',');
            return rows(officialRows.filter((x) => ids.includes(x.id)).map((x) => ({ id: x.id, topic: x.topic, category_id: x.category_id })));
          }
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
          const com = r.kind === 'community' ? officialRows.find((x) => x.id === r.ref_id) : null;
          const act = r.kind === 'activity' ? activityRows.find((x) => x.id === r.ref_id) : null;
          return rows([{
            id, kind: r.kind, title: r.kind === 'direct' ? null : r.title, photo_path: r.photo_path ?? null,
            community_id: com ? com.id : null, activity_id: act ? act.id : null,
            communities: com ? { category_id: com.category_id, topic: com.topic, cover_path: null } : null,
            activities: act ? { category_id: act.category_id, title: act.title, sub_id: act.sub_id, place_name: act.place_name, cover_path: act.cover_path } : null,
          }]);
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
        case 'community_posts': {
          const k = keyOf((q.author_id || '').replace('eq.', ''));
          return rows(k ? memberPosts(k) : []);
        }
        case 'pro_profiles': return rows([{ visible: true }]);
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

export const IDS = { ACT, COM, CONV, P: Object.fromEntries(Object.entries(PEOPLE).map(([k, v]) => [k, v.id])) };
