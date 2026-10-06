import { CITIES } from '../destinations';
import type { PhotoKey } from '../photos';
import type {
  ActivityKind,
  CityContent,
  CityId,
  Community,
  EventCategory,
  Interest,
  Intent,
  PlaceKind,
  UserType,
} from '../types';
import { community, event, person, place, session } from './build';
import { dubai } from './dubai';

/**
 * Content for the emirates beyond Dubai. Each emirate has its own places,
 * plans and editorial voice; shared UAE-wide pieces (services, guides,
 * professionals) are reused because they serve every emirate.
 */

type RegionalCityId = Exclude<CityId, 'dubai' | 'bali'>;

type PersonSeed = {
  name: string;
  age: number;
  types: UserType[];
  headline: string;
  bio: string;
  interests: Interest[];
  activities: ActivityKind[];
  intents: Intent[];
  languages: string[];
  origin: string | null;
  hue: number;
};

const POOL: PersonSeed[] = [
  { name: 'Rania', age: 30, types: ['local', 'professional'], headline: 'Museum educator', bio: 'I can tell you the story behind every fort and gallery in the emirate. Running at dawn, always.', interests: ['art', 'family', 'food'], activities: ['running', 'yoga'], intents: ['explore', 'friends'], languages: ['Arabic', 'English'], origin: null, hue: 12 },
  { name: 'Daniel', age: 35, types: ['expat', 'professional'], headline: 'Engineer · energy', bio: 'Weekends on the bike or in the mountains. Looking for people who like an early start.', interests: ['outdoors', 'sports', 'tech'], activities: ['cycling', 'running', 'hiking'], intents: ['sports', 'similar'], languages: ['English', 'Spanish'], origin: 'Bogotá', hue: 205 },
  { name: 'Aisha', age: 27, types: ['local', 'entrepreneur'], headline: 'Founder · modest fashion', bio: 'Running a small label and a padel habit. Happy to meet other founders.', interests: ['fashion', 'business', 'startups'], activities: ['padel', 'yoga'], intents: ['business', 'friends'], languages: ['Arabic', 'English'], origin: null, hue: 322 },
  { name: 'Kenji', age: 33, types: ['expat', 'professional'], headline: 'Teacher', bio: 'Kayak at sunrise, ramen experiments at night. Teaching Japanese on Saturdays.', interests: ['languages', 'outdoors', 'food'], activities: ['kayak', 'hiking', 'swimming'], intents: ['friends', 'explore'], languages: ['Japanese', 'English'], origin: 'Kyoto', hue: 168 },
  { name: 'Fatou', age: 29, types: ['expat', 'professional'], headline: 'Nurse', bio: 'Night shifts, so I live for morning yoga and long lunches with friends.', interests: ['wellness', 'music', 'food'], activities: ['yoga', 'running'], intents: ['friends', 'similar'], languages: ['French', 'English', 'Wolof'], origin: 'Dakar', hue: 28 },
  { name: 'Ivan', age: 40, types: ['expat', 'entrepreneur'], headline: 'Owner · dive centre', bio: 'Twelve years under this water. I take newcomers to the best reef I know.', interests: ['outdoors', 'sports', 'business'], activities: ['swimming', 'kayak', 'hiking'], intents: ['business', 'activities'], languages: ['Russian', 'English'], origin: 'Saint Petersburg', hue: 192 },
  { name: 'Mariam', age: 24, types: ['student', 'local'], headline: 'Engineering student', bio: 'Five-a-side captain and robotics nerd. Show me your side project.', interests: ['tech', 'art', 'sports'], activities: ['football', 'running'], intents: ['friends', 'explore'], languages: ['Arabic', 'English'], origin: null, hue: 280 },
  { name: 'Tomás', age: 31, types: ['nomad', 'professional'], headline: 'Remote UX designer', bio: 'Chose the quiet emirate on purpose. Yoga, cycling and a good desk with a view.', interests: ['art', 'travel', 'wellness'], activities: ['yoga', 'cycling', 'padel'], intents: ['similar', 'activities'], languages: ['Spanish', 'English'], origin: 'Buenos Aires', hue: 60 },
  { name: 'Grace', age: 37, types: ['expat', 'professional'], headline: 'Hotel manager', bio: 'I know every beach and every kitchen on this coast. Volleyball on Fridays.', interests: ['food', 'travel', 'family'], activities: ['running', 'swimming', 'volleyball'], intents: ['friends', 'explore'], languages: ['English', 'Tagalog'], origin: 'Manila', hue: 346 },
  { name: 'Hamad', age: 32, types: ['local', 'professional'], headline: 'Pilot', bio: 'Between flights: padel, mountains and introducing friends to my mother’s cooking.', interests: ['travel', 'sports', 'outdoors'], activities: ['padel', 'football', 'hiking'], intents: ['sports', 'explore'], languages: ['Arabic', 'English'], origin: null, hue: 140 },
  { name: 'Sara', age: 28, types: ['expat', 'entrepreneur'], headline: 'Founder · ceramics studio', bio: 'Teaching wheel classes in a converted villa. Come get your hands dirty.', interests: ['art', 'business', 'wellness'], activities: ['yoga', 'swimming'], intents: ['business', 'friends'], languages: ['Swedish', 'English'], origin: 'Gothenburg', hue: 240 },
  { name: 'Yousef', age: 45, types: ['local', 'entrepreneur'], headline: 'Fisherman turned restaurateur', bio: 'Three generations on these boats. Now I cook what my cousins catch.', interests: ['food', 'family', 'outdoors'], activities: ['kayak', 'swimming'], intents: ['explore', 'business'], languages: ['Arabic', 'English'], origin: null, hue: 100 },
];

type Flavor = {
  people: number[];
  sessions: [ActivityKind, string, string, string, number][];
  events: { title: string; category: EventCategory; area: string; venue: string; photo: PhotoKey; price: number; description: string; highlights: string[] }[];
  places: [string, PlaceKind, string, string, 1 | 2 | 3 | 4, number, string[], PhotoKey | null][];
  communities: [string, string, Community['kind'], string, Interest[], PhotoKey][];
  editorials: [string, string, string, PhotoKey][];
};

const FLAVORS: Record<RegionalCityId, Flavor> = {
  abudhabi: {
    people: [0, 1, 2, 3, 9, 10],
    sessions: [
      ['padel', 'Padel night · Al Reem', 'reem', 'Reem Island courts', 70],
      ['running', 'Corniche sunset run', 'corniche', 'Corniche, lifeguard tower 4', 0],
      ['cycling', 'Yas circuit ride', 'yas', 'Yas Marina Circuit', 0],
      ['kayak', 'Mangrove kayak at sunrise', 'reem', 'Eastern Mangroves jetty', 120],
      ['yoga', 'Beach yoga · Saadiyat', 'saadiyat', 'Saadiyat public beach', 40],
    ],
    events: [
      { title: 'Museum late · art & talks', category: 'culture', area: 'saadiyat', venue: 'Saadiyat Cultural District', photo: 'gallery', price: 0, description: 'After-hours galleries, a curator talk and dinner on the waterfront.', highlights: ['Curator talk at 19:30', 'Waterfront dinner', 'Members’ entry'] },
      { title: 'Founders breakfast', category: 'business', area: 'maryah', venue: 'Al Maryah Island', photo: 'meeting', price: 0, description: 'Twenty founders, one long table, introductions made by the host.', highlights: ['Hosted introductions', 'Investors attending', 'Free for members'] },
      { title: 'Yas sunset social', category: 'party', area: 'yas', venue: 'Yas Bay waterfront', photo: 'rooftopNeon', price: 90, description: 'Sundowners on the bay with a DJ and the circuit lights coming on.', highlights: ['Bay terrace', 'DJ from 18:00', 'Guest list'] },
      { title: 'Corniche food walk', category: 'food', area: 'corniche', venue: 'Corniche promenade', photo: 'nightMarket', price: 120, description: 'Six stops, from Emirati breakfast to Levantine sweets, with a local host.', highlights: ['6 tastings', 'Local host', 'Small group'] },
    ],
    places: [
      ['Saadiyat Beach', 'nature', 'saadiyat', 'Soft sand, calm water and turtles nesting nearby.', 1, 4.8, ['Swim', 'Nature'], 'beachSunset'],
      ['Qahwa House', 'cafe', 'maryah', 'Arabic coffee and dates, laptop-friendly mornings.', 2, 4.6, ['Coffee', 'Wi-Fi'], 'coffee'],
      ['Mangrove Kitchen', 'restaurant', 'reem', 'Seafood on a deck over the mangroves.', 3, 4.7, ['Seafood', 'Terrace'], 'dinner'],
      ['Grand Mosque at dusk', 'nature', 'khalifa', 'The most beautiful hour to visit, respectfully dressed.', 1, 4.9, ['Culture', 'Free'], 'mosque'],
    ],
    communities: [
      ['Abu Dhabi Newcomers', 'Your first circle in the capital', 'interest', 'Welcome dinner · monthly', ['food', 'travel'], 'brunch'],
      ['Capital Cyclists', 'Circuit loops every week', 'sport', 'Tue & Thu · Yas circuit', ['sports', 'outdoors'], 'cycling'],
      ['Al Maryah Founders', 'Building in the capital', 'professional', 'Breakfast · fortnightly', ['startups', 'business'], 'founders'],
    ],
    editorials: [
      ['Culture', 'A weekend on Saadiyat', 'Museums in the morning, the beach after lunch, dinner by the water.', 'abudhabiSkyline'],
      ['Outdoors', 'Paddle the Eastern Mangroves', 'The quietest way to see the capital: by kayak, at sunrise.', 'kayak'],
    ],
  },
  sharjah: {
    people: [6, 0, 7, 4, 2, 11],
    sessions: [
      ['football', '5-a-side · Al Majaz', 'majaz', 'Al Majaz park pitch', 25],
      ['running', 'Waterfront run', 'majaz', 'Al Majaz Waterfront', 0],
      ['cycling', 'Heritage district ride', 'heritage', 'Heart of Sharjah', 0],
      ['padel', 'Padel at Aljada', 'aljada', 'Aljada courts', 60],
    ],
    events: [
      { title: 'Heritage walk & Emirati breakfast', category: 'culture', area: 'heritage', venue: 'Heart of Sharjah', photo: 'sharjah', price: 60, description: 'Restored courtyards, the old souq and breakfast with a family-run kitchen.', highlights: ['Local guide', 'Emirati breakfast', 'Small group'] },
      { title: 'Book club by the lagoon', category: 'culture', area: 'qasba', venue: 'Al Qasba', photo: 'coffee', price: 0, description: 'This month: a novel set in the Gulf. Arabic and English readers welcome.', highlights: ['Bilingual', 'Coffee included', 'Monthly'] },
      { title: 'Student founders meetup', category: 'business', area: 'unicity', venue: 'University City', photo: 'founders', price: 0, description: 'Students building their first company meet mentors who have done it twice.', highlights: ['Mentor tables', 'Demo corner', 'Free'] },
    ],
    places: [
      ['Al Noor Island', 'nature', 'majaz', 'Sculpture trails and a butterfly house on the lagoon.', 1, 4.7, ['Art', 'Walk'], 'sharjah'],
      ['Qasba Coffee', 'cafe', 'qasba', 'Canal-side coffee, quiet in the mornings.', 2, 4.5, ['Coffee'], 'coffeeBar'],
      ['Courtyard Kitchen', 'restaurant', 'heritage', 'Emirati and Levantine plates in a restored courtyard.', 2, 4.6, ['Heritage', 'Local'], 'dinnerGroup'],
    ],
    communities: [
      ['Sharjah Book Circle', 'Read, then talk', 'interest', 'Monthly · Al Qasba', ['art', 'languages'], 'coffee'],
      ['Al Majaz Runners', 'Lagoon loops after work', 'sport', 'Mon & Wed · 18:30', ['sports'], 'running'],
      ['Student Founders', 'First companies, real mentors', 'professional', 'Meetup · monthly', ['startups', 'tech'], 'founders'],
    ],
    editorials: [
      ['Heritage', 'The Heart of Sharjah, slowly', 'Restored courtyards, old souqs and the best breakfast in the emirate.', 'sharjah'],
      ['Art', 'A quiet art capital', 'Foundations, biennial venues and studios open all year.', 'gallery'],
    ],
  },
  ajman: {
    people: [8, 3, 6, 1, 10],
    sessions: [
      ['running', 'Corniche sunrise run', 'corniche', 'Ajman Corniche', 0],
      ['swimming', 'Open-water swim', 'corniche', 'Corniche beach', 0],
      ['volleyball', 'Beach volley at sunset', 'corniche', 'Corniche beach courts', 0],
      ['padel', 'Padel · Al Zorah', 'alzorah', 'Al Zorah courts', 60],
    ],
    events: [
      { title: 'Sunset beach meetup', category: 'party', area: 'corniche', venue: 'Ajman Corniche', photo: 'beachSunset', price: 0, description: 'Bring a blanket, we bring the music and the karak.', highlights: ['Free', 'Karak on us', 'All welcome'] },
      { title: 'Mangrove kayak & breakfast', category: 'sports', area: 'alzorah', venue: 'Al Zorah reserve', photo: 'kayak', price: 140, description: 'Paddle among flamingos, then breakfast on the deck.', highlights: ['Guided', 'Breakfast included', 'Beginner friendly'] },
    ],
    places: [
      ['Ajman Corniche', 'nature', 'corniche', 'Long, calm beach with the best sunsets north of Dubai.', 1, 4.6, ['Beach', 'Sunset'], 'ajman'],
      ['Al Zorah Mangroves', 'nature', 'alzorah', 'Flamingos and kayaks in a protected reserve.', 1, 4.7, ['Kayak', 'Wildlife'], 'kayak'],
      ['Dhow Café', 'cafe', 'corniche', 'Karak and pastries facing the water.', 1, 4.4, ['Karak', 'Views'], 'coffeeBar'],
    ],
    communities: [
      ['Ajman Newcomers', 'Small emirate, warm welcome', 'interest', 'Sunset meetup · Fridays', ['food', 'travel'], 'beachSunset'],
      ['Corniche Swimmers', 'Open water, every morning', 'sport', 'Daily · 6:30', ['sports', 'outdoors'], 'swimming'],
    ],
    editorials: [
      ['Weekend', 'Why Ajman sunsets win', 'West-facing beach, no towers in the way, and karak at every corner.', 'ajman'],
      ['Nature', 'Flamingos at Al Zorah', 'A protected lagoon twenty minutes from the corniche.', 'kayak'],
    ],
  },
  rak: {
    people: [5, 1, 7, 9, 2],
    sessions: [
      ['hiking', 'Jebel Jais summit hike', 'jebeljais', 'Jebel Jais viewing deck', 0],
      ['cycling', 'Jebel Jais climb · 20 km', 'jebeljais', 'Jebel Jais road', 0],
      ['kayak', 'Lagoon kayak', 'minaalarab', 'Mina Al Arab lagoon', 90],
      ['padel', 'Padel at Al Hamra', 'hamra', 'Al Hamra courts', 50],
    ],
    events: [
      { title: 'Mountain sunrise & breakfast', category: 'sports', area: 'jebeljais', venue: 'Jebel Jais', photo: 'rak', price: 80, description: 'Drive up at 5, watch the sun rise over the Hajar mountains, breakfast at the top.', highlights: ['Car-pool from RAK City', 'Breakfast included', 'Cool mountain air'] },
      { title: 'Beach bonfire', category: 'party', area: 'marjan', venue: 'Al Marjan Island beach', photo: 'beachSunset', price: 60, description: 'Acoustic sets, a bonfire and the Gulf at your feet.', highlights: ['Acoustic sets', 'Bonfire', 'Late finish'] },
      { title: 'Wellness weekend', category: 'wellness', area: 'hamra', venue: 'Al Hamra beach', photo: 'yoga', price: 350, description: 'Two days of yoga, breathwork and long swims.', highlights: ['4 practices', 'Healthy meals', 'Beachfront'] },
    ],
    places: [
      ['Jebel Jais', 'nature', 'jebeljais', 'The UAE’s highest mountain: cool air and long views.', 1, 4.9, ['Hike', 'Views'], 'rak'],
      ['Al Marjan Beach', 'nature', 'marjan', 'Calm water and white sand on the islands.', 1, 4.6, ['Beach', 'Swim'], 'beachSunset'],
      ['Harbour Grill', 'restaurant', 'hamra', 'Fresh catch on the marina, simple and good.', 2, 4.5, ['Seafood'], 'dinner'],
    ],
    communities: [
      ['RAK Outdoors', 'Mountains every weekend', 'sport', 'Hikes · Saturdays', ['outdoors', 'sports'], 'hikeDesert'],
      ['Al Hamra Neighbours', 'Know the people next door', 'neighbourhood', 'Potluck · monthly', ['family', 'food'], 'beachSunset'],
    ],
    editorials: [
      ['Outdoors', 'Jebel Jais in one day', 'Sunrise, a hike, a long lunch and back for the sunset on the beach.', 'rak'],
      ['Coast', 'Al Marjan, the calm weekend', 'Islands, water sports and quiet evenings an hour from Dubai.', 'beachSunset'],
    ],
  },
  fujairah: {
    people: [5, 3, 1, 8, 4, 11],
    sessions: [
      ['hiking', 'Wadi hike to the pools', 'wadi', 'Wadi Wurayah trailhead', 0],
      ['swimming', 'Snorkel swim · Al Aqah', 'alaqah', 'Al Aqah beach', 0],
      ['kayak', 'Sea kayak · Dibba', 'dibba', 'Dibba harbour', 110],
      ['running', 'Corniche run', 'fujcity', 'Fujairah Corniche', 0],
    ],
    events: [
      { title: 'Snorkel day', category: 'sports', area: 'alaqah', venue: 'Al Aqah beach', photo: 'snorkel', price: 180, description: 'Guided snorkel over the reef with a marine biologist, lunch on the beach.', highlights: ['Marine biologist guide', 'Gear included', 'Lunch'] },
      { title: 'Fort & mountains walk', category: 'culture', area: 'fujcity', venue: 'Fujairah Fort', photo: 'fujairah', price: 0, description: 'The oldest fort in the Emirates, the mountains behind it and the stories in between.', highlights: ['Local historian', 'Free', 'Sunset finish'] },
      { title: 'Dibba dhow trip', category: 'party', area: 'dibba', venue: 'Dibba harbour', photo: 'dhow', price: 220, description: 'A day on a dhow along the fjord-like coast, swim stops included.', highlights: ['2 swim stops', 'Lunch on board', 'Small group'] },
    ],
    places: [
      ['Al Aqah Beach', 'nature', 'alaqah', 'Clear water and coral a few strokes from the sand.', 1, 4.8, ['Snorkel', 'Beach'], 'fujairah'],
      ['Wadi Wurayah', 'nature', 'wadi', 'A protected wadi with a waterfall, rare in the UAE.', 1, 4.8, ['Hike', 'Waterfall'], 'waterfall'],
      ['Fisherman’s Table', 'restaurant', 'fujcity', 'Grilled hammour and lime juice by the harbour.', 2, 4.5, ['Seafood', 'Local'], 'dinnerGroup'],
    ],
    communities: [
      ['East Coast Divers', 'Reefs, wrecks, good people', 'sport', 'Dives · weekends', ['outdoors', 'sports'], 'swimming'],
      ['Fujairah Hikers', 'Wadis and peaks', 'sport', 'Hikes · Fridays', ['outdoors'], 'hikeDesert'],
    ],
    editorials: [
      ['Ocean', 'The other coast', 'Facing the Indian Ocean: mountains, reefs and a slower pace.', 'fujairah'],
      ['Outdoors', 'Wadi Wurayah’s waterfall', 'Go early, bring water, and keep the wadi clean.', 'waterfall'],
    ],
  },
  uaq: {
    people: [3, 8, 6, 0, 11],
    sessions: [
      ['kayak', 'Mangrove kayak at sunrise', 'mangroves', 'Mangrove Beach jetty', 100],
      ['running', 'Lagoon run', 'lagoon', 'Khor Al Beidah', 0],
      ['volleyball', 'Beach volley', 'mangroves', 'Mangrove Beach', 0],
      ['yoga', 'Lagoon yoga', 'oldtown', 'Old Town beach', 30],
    ],
    events: [
      { title: 'Mangrove clean-up & breakfast', category: 'culture', area: 'mangroves', venue: 'Mangrove Beach', photo: 'uaq', price: 0, description: 'Two hours of clean-up by kayak, then breakfast together on the sand.', highlights: ['Kayaks provided', 'Breakfast', 'Free'] },
      { title: 'Old Town food walk', category: 'food', area: 'oldtown', venue: 'UAQ Old Town', photo: 'nightMarket', price: 70, description: 'Fishermen’s cafés, sweet shops and the fort at golden hour.', highlights: ['5 tastings', 'Local host', 'Golden hour'] },
    ],
    places: [
      ['Mangrove Beach', 'nature', 'mangroves', 'Kayaks, flamingos and absolute quiet.', 1, 4.7, ['Kayak', 'Nature'], 'uaq'],
      ['Lagoon Café', 'cafe', 'lagoon', 'Breakfast on the water.', 1, 4.4, ['Breakfast'], 'coffeeBar'],
      ['Old Town Fort', 'gallery', 'oldtown', 'The emirate’s story in one restored fort.', 1, 4.5, ['Heritage'], null],
    ],
    communities: [
      ['UAQ Paddlers', 'Mangroves at dawn', 'sport', 'Paddles · weekends', ['outdoors', 'sports'], 'kayak'],
      ['Slow Weekends', 'No rush, good company', 'interest', 'Brunch · monthly', ['food', 'family'], 'brunch'],
    ],
    editorials: [
      ['Nature', 'Paddle the mangroves', 'Herons, flamingos and green channels, forty minutes from Dubai.', 'uaq'],
      ['Weekend', 'The slowest emirate', 'Lagoons, an old fort and nobody in a hurry.', 'kayak'],
    ],
  },
};

const cache = new Map<RegionalCityId, CityContent>();

export function regionalContent(cityId: RegionalCityId): CityContent {
  const hit = cache.get(cityId);
  if (hit) return hit;

  const city = CITIES[cityId];
  const f = FLAVORS[cityId];
  const areaOf = (i: number) => city.areas[i % city.areas.length].id;

  const people = f.people.map((poolIndex, i) => {
    const seed = POOL[poolIndex];
    return person(cityId, {
      id: `p-${cityId}-${poolIndex}`,
      name: seed.name,
      age: seed.age,
      types: seed.types,
      headline: seed.headline,
      bio: seed.bio,
      area: areaOf(i),
      interests: seed.interests,
      activities: seed.activities,
      intents: seed.intents,
      languages: seed.languages,
      origin: seed.origin ?? city.name,
      since: seed.origin ? `In ${city.name} since ${2018 + (i % 6)}` : 'Local',
      verified: i % 2 === 0,
      hue: seed.hue,
      online: i === 1,
    });
  });
  const ids = people.map((p) => p.id);
  const pick = (start: number, count: number) =>
    Array.from({ length: count }, (_, k) => ids[(start + k) % ids.length]);

  const sessions = f.sessions.map(([kind, title, area, venue, price], i) =>
    session(
      cityId,
      `s-${cityId}-${i}`,
      kind,
      title,
      area,
      venue,
      [i % 3 === 0 ? 0 : i + 1, ['06:00', '18:30', '07:30', '19:00', '17:00'][i % 5], 90],
      i % 2 ? 'all' : 'beginner',
      10 + i * 2,
      pick(i, 2 + (i % 3)),
      i * 3,
      ids[i % ids.length],
      price,
    ),
  );

  const events = f.events.map((e, i) =>
    event(cityId, {
      id: `e-${cityId}-${i}`,
      title: e.title,
      category: e.category,
      area: e.area,
      venue: e.venue,
      when: [i + 1, ['19:00', '08:30', '18:00', '17:30'][i % 4], 150],
      price: e.price,
      capacity: 40 + i * 20,
      going: pick(i + 1, 3),
      extra: 8 + i * 6,
      host: `IRLY ${city.name}`,
      hostVerified: true,
      description: e.description,
      highlights: e.highlights,
      photo: e.photo,
      featured: i === 0,
    }),
  );

  const places = f.places.map(([name, kind, area, blurb, level, rating, tags, photoKey], i) =>
    place(
      cityId,
      `pl-${cityId}-${i}`,
      name,
      kind,
      area,
      blurb,
      level,
      rating,
      tags,
      { photo: photoKey ?? 'fort' },
      i === 0,
    ),
  );

  const communities = f.communities.map(([name, tagline, kind, rhythm, interests, photoKey], i) =>
    community(cityId, {
      id: `c-${cityId}-${i}`,
      name,
      tagline,
      description: `${tagline}. Members across ${city.name} meet in real life, then keep the conversation going here.`,
      members: Math.round(city.stats.communities * (9 - i * 2) + 40),
      memberIds: pick(i, 3),
      kind,
      rhythm,
      interests,
      photo: photoKey,
      verified: i === 0,
    }),
  );

  const content: CityContent = {
    people,
    sessions,
    events,
    places,
    communities,
    services: dubai.services.map((s) => ({ ...s, id: `${s.id}-${cityId}`, cityId, areaId: areaOf(0) })),
    guides: dubai.guides.map((g) => ({ ...g, id: `${g.id}-${cityId}`, cityId })),
    professionals: dubai.professionals
      .filter((p) => !p.personId)
      .map((p) => ({ ...p, id: `${p.id}-${cityId}`, cityId })),
    feed: [
      ...sessions.slice(0, 3).map((s, i) => ({
        id: `f-${cityId}-s${i}`,
        cityId,
        icon: 'activity' as const,
        ref: { type: 'session' as const, id: s.id },
        note: i === 0 ? 'Beginners welcome' : undefined,
        postedMinAgo: 15 + i * 40,
      })),
      ...events.slice(0, 2).map((e, i) => ({
        id: `f-${cityId}-e${i}`,
        cityId,
        icon: 'calendar' as const,
        ref: { type: 'event' as const, id: e.id },
        label: e.title,
        postedMinAgo: 60 + i * 50,
      })),
    ],
    editorials: f.editorials.map(([kicker, title, body, photoKey], i) => ({
      id: `ed-${cityId}-${i}`,
      cityId,
      kicker,
      title,
      body,
      visual: { photo: photoKey },
    })),
    conversations: [
      {
        id: `cv-${cityId}-0`,
        cityId,
        kind: 'community',
        title: communities[0].name,
        personIds: communities[0].memberIds,
        unread: 1,
        refId: communities[0].id,
        messages: [
          {
            id: 'm1',
            from: communities[0].memberIds[0],
            text: `Welcome to ${city.name}! The next meetup is on the calendar. See you there?`,
            minAgo: 45,
          },
        ],
      },
    ],
  };

  cache.set(cityId, content);
  return content;
}
