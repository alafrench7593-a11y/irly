import type { PhotoKey } from '@/data/photos';
import type { Conversation, Person } from '@/data/types';

/**
 * IRLY Girl demonstration content: example women, communities, posts,
 * comments and replies, plans, chats and notifications.
 *
 * DEMO ONLY. Read through `src/features/girl/demo.ts`, which returns nothing
 * unless the build sets EXPO_PUBLIC_DEMO=1 (getirly.com/demo and the website
 * captures). Nothing here is sent to or read from the IRLY server, every
 * screen of the demo says it is a demo, and none of these women is a member.
 * Portraits are the illustrative ones of the website (public-photos/faces,
 * Pixabay licence or CC0), with the same first names as on getirly.com/girl.
 *
 * Times are relative to now (minutes ago, hours ahead) so the demo never
 * looks stale.
 */

export type DemoGirl = { id: string; name: string; age: number; area: string; origin: string; headline: string; bio: string; langs: string[]; hue: number };

/** Women who only exist in this demo (the g-* ones come from girls.ts). */
export const DEMO_WOMEN: DemoGirl[] = [
  { id: 'w-salma', name: 'Salma', age: 29, area: 'jumeirah', origin: 'Morocco', headline: 'Ceramicist', bio: 'Pottery on Saturdays, coffee every other day. Always looking for a new café to try.', langs: ['Arabic', 'French', 'English'], hue: 18 },
  { id: 'w-naomi', name: 'Naomi', age: 32, area: 'downtown', origin: 'United States', headline: 'Product designer', bio: 'Moved from Atlanta last spring. Running club, jazz nights, and slow Sunday brunches.', langs: ['English'], hue: 280 },
  { id: 'w-aisha', name: 'Linh', age: 27, area: 'abudhabi', origin: 'Vietnam', headline: 'Museum educator', bio: 'Abu Dhabi on weekdays, Dubai on weekends. Museums, pho hunting and good conversations.', langs: ['English', 'Vietnamese'], hue: 150 },
  { id: 'w-lina', name: 'Lina', age: 26, area: 'jlt', origin: 'Philippines', headline: 'Marketing', bio: 'Dance classes, padel, and a very long list of restaurants to try. Join me?', langs: ['Filipino', 'English'], hue: 330 },
  { id: 'w-giulia', name: 'Emi', age: 30, area: 'palm', origin: 'Japan', headline: 'Chef', bio: 'Cooking for friends is my love language. Sunsets on the Palm when I finish early.', langs: ['Japanese', 'English'], hue: 40 },
  { id: 'w-ana', name: 'Ana', age: 28, area: 'kitebeach', origin: 'Brazil', headline: 'Interior designer', bio: 'Beach volleyball, design markets and anything near the sea.', langs: ['Portuguese', 'Spanish', 'English'], hue: 95 },
  { id: 'w-adaeze', name: 'Minji', age: 31, area: 'difc', origin: 'South Korea', headline: 'Investment analyst', bio: 'Gym before work, networking after. Weekends are for exploring.', langs: ['Korean', 'English'], hue: 210 },
  { id: 'w-noor', name: 'Yuna', age: 25, area: 'hills', origin: 'Japan', headline: 'Master’s student', bio: 'Books, desert drives and matcha. New in Dubai, still learning the metro.', langs: ['Japanese', 'English'], hue: 260 },
];

export const demoWomanPerson = (w: DemoGirl): Person => ({
  id: w.id,
  name: w.name,
  age: w.age,
  types: ['expat'],
  headline: w.headline,
  bio: w.bio,
  cityId: w.area === 'abudhabi' ? 'abudhabi' : 'dubai',
  areaId: w.area,
  interests: [],
  activities: [],
  intents: ['friends'],
  availability: ['weekends'],
  languages: w.langs,
  origin: w.origin,
  since: 'A while',
  verified: true,
  hue: w.hue,
});

/** The demo's own member (the visitor), as the comments and chats see her. */
export const ME = 'demo-me';

export type DemoCommunity = {
  id: string;
  name: string;
  tagline: string;
  about: string;
  cover: PhotoKey;
  members: number;
  /** Example members shown on the page (the count above is the demo's). */
  faces: string[];
  moms?: boolean;
  member?: boolean;
};

export const DEMO_COMMUNITIES: DemoCommunity[] = [
  { id: 'gc-girls-dubai', name: 'Girls in Dubai', tagline: 'The everyday circle: plans, tips and new friends.', about: 'Women living in Dubai, whatever the neighbourhood. Ask anything, share a plan, say hello.', cover: 'girlsOut', members: 48, faces: ['g-ines', 'w-naomi', 'g-nour', 'w-lina', 'g-hana'], member: true },
  { id: 'gc-new-dubai', name: 'New in Dubai', tagline: 'Just landed? Start here.', about: 'For the first months: visas, neighbourhoods, metro, and girls who also just arrived.', cover: 'dubaiPink', members: 31, faces: ['w-noor', 'g-priya', 'w-ana', 'g-zara'], member: true },
  { id: 'gc-brunch', name: 'Girls Brunch Club', tagline: 'One brunch a weekend, a new place each time.', about: 'We pick a spot, book a table, and whoever wants comes. No pressure to stay all afternoon.', cover: 'brunchGirl', members: 26, faces: ['g-sofia', 'g-chloe', 'w-salma', 'g-zara'], member: true },
  { id: 'gc-coffee', name: 'Coffee & Besties', tagline: 'Specialty coffee, slow mornings.', about: 'Café hopping from Al Quoz to Jumeirah. Matcha people welcome too.', cover: 'girlCoffee', members: 22, faces: ['w-salma', 'g-hana', 'w-noor'] },
  { id: 'gc-fitness', name: 'Fitness Girls', tagline: 'Pilates, runs, padel, gym buddies.', about: 'Find someone to train with. All levels, from first class to marathon.', cover: 'pilatesGirl', members: 37, faces: ['g-lea', 'w-adaeze', 'g-elena', 'g-priya'] },
  { id: 'gc-travel', name: 'Girls Who Travel', tagline: 'Weekend trips and travel buddies.', about: 'Oman road trips, Georgia long weekends, desert camps. Share a plan or find a buddy.', cover: 'girlTrip', members: 19, faces: ['g-olga', 'g-ines', 'w-ana'] },
  { id: 'gc-fashion', name: 'Fashion & Beauty', tagline: 'Shopping spots, salons, swaps.', about: 'Where to get your nails done, which mall for what, and a clothes swap every month.', cover: 'beachClubGirl', members: 24, faces: ['g-zara', 'g-amira', 'w-lina'] },
  { id: 'gc-solo', name: 'Solo Girls', tagline: 'Going alone? Not anymore.', about: 'For the girls who go to the concert, the beach or the museum alone, and would rather meet someone there.', cover: 'readingGirl', members: 17, faces: ['w-noor', 'w-aisha', 'g-hana'] },
  { id: 'gc-irly-girl', name: 'IRLY Girl Community', tagline: 'Ideas, feedback and hellos.', about: 'The place to tell us what you want from IRLY Girl, and to meet the women building it with us.', cover: 'dubaiPink', members: 44, faces: ['g-maya', 'w-naomi', 'w-giulia'] },
  { id: 'gc-moms', name: 'Moms in Dubai', tagline: 'Playdates, schools and coffee while they nap.', about: 'Moms of little ones and big ones: tips, playdates and a coffee when you need one.', cover: 'strollerMom', members: 21, faces: ['g-elena', 'w-salma'], moms: true },
];

export type DemoReply = { by: string; text: string; ago: number; likes?: number };
export type DemoComment = { id: string; by: string; text: string; ago: number; likes?: number; replies?: DemoReply[] };
export type DemoPost = {
  id: string;
  community: string;
  by: string;
  text: string;
  /** Minutes ago. */
  ago: number;
  photo?: PhotoKey;
  likes: number;
  saves?: number;
  /** The plan it is about. */
  activity?: string;
  comments: DemoComment[];
};

export const DEMO_POSTS: DemoPost[] = [
  {
    id: 'gp-arrived',
    community: 'gc-new-dubai',
    by: 'w-noor',
    text: 'Girls, I just landed in Dubai last week and I’m looking for girls to discover the city with 🩷 I live near Dubai Hills, still figuring out the metro haha',
    ago: 95,
    likes: 23,
    comments: [
      { id: 'c1', by: 'g-nour', text: 'Welcome girl!! 🥹 Dubai Hills is lovely, the park at sunset is a must', ago: 88, likes: 4, replies: [{ by: 'w-noor', text: 'Noted!! Thank you 🤍', ago: 80 }] },
      { id: 'c2', by: 'g-sofia', text: 'We should organise a girls brunch this weekend!', ago: 76, likes: 9, replies: [
        { by: 'g-chloe', text: 'I’m in. Saturday?', ago: 70 },
        { by: 'g-sofia', text: 'Saturday 11 works, I’ll post it in Girls Brunch Club', ago: 64, likes: 2 },
      ] },
      { id: 'c3', by: 'w-ana', text: 'I’m new here too, let’s go together!', ago: 60, likes: 3 },
      { id: 'c4', by: 'g-ines', text: 'Girls, we should really start a little group for everyone who just arrived', ago: 52, likes: 6 },
      { id: 'c5', by: 'w-salma', text: 'Welcome to Dubai! You’re going to love it here 💕', ago: 40 },
      { id: 'c6', by: 'g-hana', text: 'Count me in 🤍', ago: 31 },
    ],
  },
  {
    id: 'gp-cafe',
    community: 'gc-coffee',
    by: 'w-salma',
    text: 'Found the cutest little café in Al Quoz, the pistachio latte is unreal. Going back Thursday morning if anyone wants to join ☕',
    ago: 210,
    photo: 'girlCoffee',
    likes: 31,
    saves: 12,
    comments: [
      { id: 'c1', by: 'g-zara', text: 'Wait girl, where is this place? 😭', ago: 200, likes: 5, replies: [{ by: 'w-salma', text: 'Alserkal Avenue, next to the bookshop. I’ll send you the pin', ago: 195 }] },
      { id: 'c2', by: 'w-noor', text: 'Okay but this café looks SO cute.', ago: 180, likes: 2 },
      { id: 'c3', by: 'g-ines', text: 'I’m so in, shall we go together on Thursday?', ago: 150, likes: 3, replies: [{ by: 'w-salma', text: 'With pleasure! 9:30?', ago: 140 }, { by: 'g-ines', text: 'Perfect 🤍', ago: 133 }] },
    ],
  },
  {
    id: 'gp-sunrise-yoga',
    community: 'gc-fitness',
    by: 'g-lea',
    text: 'Sunrise yoga at Kite Beach this Friday, 6:30. Bring a mat and water, I bring the playlist. All levels, first-timers very welcome.',
    ago: 330,
    photo: 'kiteBeach',
    likes: 42,
    activity: 'ga-yoga',
    comments: [
      { id: 'c1', by: 'w-adaeze', text: 'Just moved here last month, I need this!', ago: 320, likes: 3 },
      { id: 'c2', by: 'g-elena', text: 'Is there parking close by?', ago: 300, replies: [{ by: 'g-lea', text: 'Yes, the free one behind the café. Fills up after 7 though', ago: 290, likes: 2 }] },
      { id: 'c3', by: 'w-aisha', text: 'Anyone else going alone? We can meet there!', ago: 260, likes: 4, replies: [{ by: 'w-noor', text: 'Me! Let’s meet at the entrance', ago: 255 }] },
    ],
  },
  {
    id: 'gp-brunch-sat',
    community: 'gc-brunch',
    by: 'g-sofia',
    text: 'As promised: brunch Saturday 11:00, a little terrace in Jumeirah with the best eggs I know. 8 seats, join from the plan below so I can book the table 🍳',
    ago: 55,
    photo: 'brunchGirl',
    likes: 18,
    activity: 'ga-brunch',
    comments: [
      { id: 'c1', by: 'g-chloe', text: 'Joined ✨', ago: 50 },
      { id: 'c2', by: 'w-noor', text: 'I’m in if someone organises it this weekend 🤍 oh wait, you did', ago: 44, likes: 7 },
      { id: 'c3', by: 'w-ana', text: 'Can I bring my flatmate? She’s new too', ago: 30, replies: [{ by: 'g-sofia', text: 'Of course! Tell her to join the plan so we count her', ago: 26 }] },
    ],
  },
  {
    id: 'gp-oman',
    community: 'gc-travel',
    by: 'g-olga',
    text: 'Thinking of a Musandam trip in two weeks: dhow cruise, snorkelling, back the same evening. Who’s in? Looking for 3-4 girls to share the car.',
    ago: 600,
    photo: 'girlTrip',
    likes: 27,
    saves: 15,
    comments: [
      { id: 'c1', by: 'g-ines', text: 'Me!! I’ve been dreaming of it since I arrived', ago: 580, likes: 2 },
      { id: 'c2', by: 'w-ana', text: 'Do we need a visa for that part of Oman?', ago: 540, replies: [{ by: 'g-olga', text: 'Depends on your passport, most get it at the border. Check before though', ago: 530, likes: 3 }] },
      { id: 'c3', by: 'g-maya', text: 'I did it last year, bring motion sickness tablets lol', ago: 500, likes: 8 },
    ],
  },
  {
    id: 'gp-first-month',
    community: 'gc-girls-dubai',
    by: 'w-naomi',
    text: 'Small win: one month in Dubai today and I finally have a running buddy, a brunch spot and someone to text when I see a cute cat. Thank you girls 🤍',
    ago: 1300,
    likes: 64,
    comments: [
      { id: 'c1', by: 'g-nour', text: 'This made my day', ago: 1290, likes: 5 },
      { id: 'c2', by: 'w-lina', text: 'The cat updates are essential tbh', ago: 1250, likes: 11 },
      { id: 'c3', by: 'g-priya', text: 'One month for me next week. Still at the "where do I buy a kettle" stage 😅', ago: 1200, replies: [{ by: 'w-naomi', text: 'Carrefour in MOE! And IKEA Festival City for the rest', ago: 1180, likes: 2 }] },
    ],
  },
  {
    id: 'gp-nails',
    community: 'gc-fashion',
    by: 'g-zara',
    text: 'Okay I need a nail salon recommendation near Downtown that won’t take 3 hours. Go 💅',
    ago: 420,
    likes: 15,
    comments: [
      { id: 'c1', by: 'g-amira', text: 'There’s a small one in Boulevard Plaza, ask for Joy. Fast and so neat', ago: 410, likes: 6 },
      { id: 'c2', by: 'w-lina', text: 'Saving this post', ago: 395 },
      { id: 'c3', by: 'g-amira', text: 'Swap next Sunday btw, bring 3 pieces you don’t wear anymore!', ago: 380, likes: 4 },
    ],
  },
  {
    id: 'gp-concert',
    community: 'gc-solo',
    by: 'w-aisha',
    text: 'Going to the jazz night at Alserkal on Thursday alone. If anyone else is going solo, let’s sit together?',
    ago: 760,
    likes: 21,
    comments: [
      { id: 'c1', by: 'w-naomi', text: 'Yes!! I was going to skip it because none of my friends like jazz', ago: 740, likes: 3 },
      { id: 'c2', by: 'g-hana', text: 'I’ll be there around 8', ago: 700 },
    ],
  },
  {
    id: 'gp-desert',
    community: 'gc-girls-dubai',
    by: 'g-hana',
    text: 'Desert sunset last night with girls I met here two weeks ago. Still can’t believe how quiet it gets out there.',
    ago: 1500,
    photo: 'desertGirl',
    likes: 88,
    saves: 9,
    comments: [
      { id: 'c1', by: 'g-elena', text: 'Where did you go? Not the tourist camps I hope 😄', ago: 1490, replies: [{ by: 'g-hana', text: 'Al Qudra, we drove ourselves. Way calmer', ago: 1480, likes: 4 }] },
      { id: 'c2', by: 'w-giulia', text: 'Beautiful. Next time I bring onigiri for everyone', ago: 1420, likes: 9 },
    ],
  },
  {
    id: 'gp-question-metro',
    community: 'gc-new-dubai',
    by: 'g-priya',
    text: 'Quick question: is the women & children cabin on the metro only at the front? I always end up in the wrong one 🙈',
    ago: 140,
    likes: 9,
    comments: [
      { id: 'c1', by: 'g-nour', text: 'Front of the train, look for the pink signs on the platform', ago: 132, likes: 6 },
      { id: 'c2', by: 'w-adaeze', text: 'And Gold Class is right next to it, don’t sit there by mistake like I did 😂', ago: 120, likes: 5 },
    ],
  },
  {
    id: 'gp-padel',
    community: 'gc-fitness',
    by: 'w-lina',
    text: 'Need a 4th for padel tomorrow 7pm in JLT, intermediate level. Court is booked!',
    ago: 35,
    photo: 'padelGirl',
    likes: 6,
    activity: 'ga-padel',
    comments: [{ id: 'c1', by: 'g-elena', text: 'I can! Joining the plan', ago: 20, likes: 1 }],
  },
  {
    id: 'gp-feedback',
    community: 'gc-irly-girl',
    by: 'g-maya',
    text: 'Idea for IRLY Girl: a "going alone" tag on plans so you know someone else is also coming solo. What do you think?',
    ago: 2000,
    likes: 39,
    comments: [
      { id: 'c1', by: 'w-aisha', text: 'Yes please. That’s exactly why I post in Solo Girls', ago: 1980, likes: 7 },
      { id: 'c2', by: 'w-ana', text: 'Love it. Maybe also "new in town"?', ago: 1900, likes: 3 },
    ],
  },
  {
    id: 'gp-playdate',
    community: 'gc-moms',
    by: 'g-elena',
    text: 'Playdate at the Dubai Hills playground Saturday 9:30 before it gets too hot. Coffee for us, sand for them.',
    ago: 300,
    photo: 'strollerMom',
    likes: 14,
    comments: [{ id: 'c1', by: 'w-salma', text: 'We’ll come! My son is 3, is that ok?', ago: 280, replies: [{ by: 'g-elena', text: 'Perfect, mine is 4', ago: 270 }] }],
  },
];

export type DemoPlan = {
  id: string;
  title: string;
  kind: string;
  community?: string;
  by: string;
  place: string;
  area: string;
  /** Days from today and the local time in Dubai (always ahead of now). */
  day: number;
  at: string;
  capacity: number;
  going: string[];
  cover: PhotoKey;
  moms?: boolean;
  joined?: boolean;
};

export const DEMO_PLANS: DemoPlan[] = [
  { id: 'ga-padel', title: 'Padel 2v2, intermediate', kind: 'padel', community: 'gc-fitness', by: 'w-lina', place: 'JLT Padel Courts', area: 'jlt', day: 1, at: '19:00', capacity: 4, going: ['w-lina', 'g-elena', 'g-priya'], cover: 'padelGirl' },
  { id: 'ga-yoga', title: 'Sunrise yoga at Kite Beach', kind: 'yoga', community: 'gc-fitness', by: 'g-lea', place: 'Kite Beach', area: 'kitebeach', day: 2, at: '06:30', capacity: 12, going: ['g-lea', 'w-adaeze', 'w-aisha', 'w-noor', 'g-ines'], cover: 'kiteBeach', joined: true },
  { id: 'ga-brunch', title: 'Girls brunch in Jumeirah', kind: 'brunch', community: 'gc-brunch', by: 'g-sofia', place: 'A terrace on Jumeirah Beach Road', area: 'jumeirah', day: 3, at: '11:00', capacity: 8, going: ['g-sofia', 'g-chloe', 'w-noor', 'w-ana', 'g-zara'], cover: 'brunchGirl' },
  { id: 'ga-coffee', title: 'Coffee morning in Al Quoz', kind: 'coffee', community: 'gc-coffee', by: 'w-salma', place: 'Alserkal Avenue', area: 'alquoz', day: 1, at: '09:30', capacity: 6, going: ['w-salma', 'g-ines'], cover: 'girlCoffee' },
  { id: 'ga-shopping', title: 'Shopping afternoon & matcha', kind: 'shopping', community: 'gc-fashion', by: 'g-zara', place: 'Dubai Mall', area: 'downtown', day: 3, at: '16:00', capacity: 5, going: ['g-zara', 'w-lina'], cover: 'dubaiPink' },
  { id: 'ga-walk', title: 'Old Dubai walk & karak', kind: 'walk', community: 'gc-girls-dubai', by: 'g-nour', place: 'Al Fahidi', area: 'bur-dubai', day: 4, at: '17:30', capacity: 10, going: ['g-nour', 'w-naomi', 'g-hana', 'w-giulia'], cover: 'mosqueGirl' },
  { id: 'ga-beach', title: 'Beach day & volleyball', kind: 'beach', community: 'gc-girls-dubai', by: 'w-ana', place: 'Kite Beach', area: 'kitebeach', day: 5, at: '10:00', capacity: 10, going: ['w-ana', 'g-lea', 'g-chloe'], cover: 'beachClubGirl' },
  { id: 'ga-playdate', title: 'Playdate & coffee', kind: 'playdate', community: 'gc-moms', by: 'g-elena', place: 'Dubai Hills Park', area: 'hills', day: 3, at: '09:30', capacity: 8, going: ['g-elena', 'w-salma'], cover: 'strollerMom', moms: true },
];

export type DemoMessage = { by: string; text: string; ago: number };
export type DemoChat = { id: string; kind: 'direct' | 'group'; with?: string; title: string; members?: string[]; unread: number; messages: DemoMessage[] };

/** Conversations of the visitor (`ME`): oldest message first. */
export const DEMO_CHATS: DemoChat[] = [
  {
    id: 'gcv-noor',
    kind: 'direct',
    with: 'w-noor',
    title: 'Yuna',
    unread: 2,
    messages: [
      { by: 'w-noor', text: 'Hi! I saw you joined the sunrise yoga too', ago: 70 },
      { by: ME, text: 'Yes! First time doing it on the beach', ago: 66 },
      { by: 'w-noor', text: 'Same 😅 want to meet at the entrance at 6:15 so we don’t arrive alone?', ago: 61 },
      { by: ME, text: 'Deal. I’ll be the one with the green mat', ago: 58 },
      { by: 'w-noor', text: 'Haha perfect', ago: 12 },
      { by: 'w-noor', text: 'Also, brunch Saturday? Sofía posted it', ago: 11 },
    ],
  },
  {
    id: 'gcv-brunch',
    kind: 'group',
    title: 'Girls Brunch Club',
    members: ['g-sofia', 'g-chloe', 'w-ana', 'g-zara', 'w-noor'],
    unread: 4,
    messages: [
      { by: 'g-sofia', text: 'Table booked for Saturday 11:00 ✨', ago: 48 },
      { by: 'g-chloe', text: 'Yay. Is it the place with the pink chairs?', ago: 45 },
      { by: 'g-sofia', text: 'Same one!', ago: 44 },
      { by: 'w-ana', text: 'My flatmate is coming too, she joined the plan', ago: 29 },
      { by: 'g-zara', text: 'Who wants to share a taxi from Downtown?', ago: 9 },
      { by: 'w-noor', text: 'Me! 🙋‍♀️', ago: 7 },
    ],
  },
  {
    id: 'gcv-ines',
    kind: 'direct',
    with: 'g-ines',
    title: 'Inès',
    unread: 0,
    messages: [
      { by: 'g-ines', text: 'Hey! Are you coming to the café on Thursday with Salma?', ago: 180 },
      { by: ME, text: 'Yes! 9:30 works for me', ago: 170 },
      { by: 'g-ines', text: 'Great, let’s meet in front of the bookshop 🤍', ago: 165 },
    ],
  },
];

export type DemoNotification = { id: string; by: string; kind: 'like' | 'comment' | 'reply' | 'invite' | 'joined' | 'follow' | 'message'; text: string; ago: number; target: string; unread?: boolean };

export const DEMO_NOTIFICATIONS: DemoNotification[] = [
  { id: 'gn1', by: 'w-noor', kind: 'message', text: 'sent you a message', ago: 11, target: '/messages/gcv-noor', unread: true },
  { id: 'gn2', by: 'g-sofia', kind: 'invite', text: 'invited you to Girls brunch in Jumeirah', ago: 50, target: '/a/ga-brunch', unread: true },
  { id: 'gn3', by: 'g-chloe', kind: 'joined', text: 'joined Girls brunch in Jumeirah', ago: 50, target: '/a/ga-brunch', unread: true },
  { id: 'gn4', by: 'g-hana', kind: 'reply', text: 'replied to your comment: “Count me in 🤍”', ago: 31, target: 'gp-arrived' },
  { id: 'gn5', by: 'w-aisha', kind: 'follow', text: 'started following you', ago: 260, target: '/person/w-aisha' },
  { id: 'gn6', by: 'g-lea', kind: 'like', text: 'liked your post in Fitness Girls', ago: 400, target: 'gp-sunrise-yoga' },
];

/** The chats above in the app's Conversation shape (the local inbox and threads read these). */
export const girlConversations = (): Conversation[] =>
  DEMO_CHATS.map((c) => ({
    id: c.id,
    cityId: 'dubai',
    kind: c.kind,
    title: c.title,
    personIds: c.kind === 'direct' && c.with ? [c.with] : (c.members ?? []),
    unread: c.unread,
    messages: c.messages.map((m, i) => ({ id: `${c.id}-${i}`, from: m.by === ME ? 'me' : m.by, text: m.text, minAgo: m.ago })),
  }));
