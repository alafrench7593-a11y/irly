import type { IconName } from '@/components/ui/Icon';
import type { PhotoKey } from '@/data/photos';
import type { CityId } from '@/data/types';

/**
 * IRLY activity catalog.
 *
 * CATEGORY → SUBCATEGORY → ACTIVITY → SESSION. Everything here is data: a
 * new sport, a new networking topic or a new place to visit is a new line,
 * never new code. Every entry can be discovered, searched, saved, turned
 * into a session, attached to a community and shown on the map. Later this
 * file is served by the backend so the IRLY team edits it without a
 * release (admin catalog).
 *
 * Destinations are a level above: a category lists what exists anywhere;
 * an activity may name a place and a city, and screens filter by the
 * destination the member is in (UAE today, Bali, then more).
 */

export type CategoryKey =
  | 'sport'
  | 'networking'
  | 'food'
  | 'travel'
  | 'outdoor'
  | 'shopping'
  | 'culture'
  | 'entertainment'
  | 'nightlife'
  | 'wellness'
  | 'animals'
  | 'family'
  | 'creative'
  | 'learning';

export type CatalogActivity = {
  id: string;
  label: string;
  /** A real place, when the activity is about one. */
  place?: string;
  cityId?: CityId;
  /** Practical or respectful guidance shown on the session (dress code, hours...). */
  note?: string;
};

export type CatalogSub = {
  id: string;
  label: string;
  /** Named activities. A subcategory without any is itself the activity ("Padel"). */
  activities?: CatalogActivity[];
};

export type CatalogCategory = {
  id: CategoryKey;
  label: string;
  /** "Who can I do this with?" in one line. */
  tagline: string;
  icon: IconName;
  color: string;
  photo: PhotoKey;
  subs: CatalogSub[];
};

const s = (id: string, label: string, activities?: CatalogActivity[]): CatalogSub => ({ id, label, activities });
const a = (id: string, label: string, place?: string, cityId?: CityId, note?: string): CatalogActivity => ({ id, label, place, cityId, note });
const list = (...labels: string[]) => labels.map((l) => s(l.toLowerCase().replace(/[^a-z0-9]+/g, '-'), l));

const MOSQUE_NOTE = 'A place of worship: modest clothing covering arms and legs, headscarf for women (provided at the entrance), quiet voices. Check visiting hours, closed to visitors during some prayer times.';

export const CATEGORIES: CatalogCategory[] = [
  {
    id: 'sport',
    label: 'Sport',
    tagline: 'Find people to play with',
    icon: 'trophy',
    color: '#34C759',
    photo: 'padel',
    subs: list(
      'Football', 'Padel', 'Tennis', 'Basketball', 'Volleyball', 'Beach volley', 'Running', 'Cycling', 'Gym', 'CrossFit',
      'Boxing', 'Kickboxing', 'MMA', 'Wrestling', 'Swimming', 'Diving', 'Snorkeling', 'Kayak', 'Paddleboard', 'Kitesurf',
      'Surf', 'Sailing', 'Golf', 'Cricket', 'Badminton', 'Table tennis', 'Horse riding', 'Yoga', 'Pilates', 'Martial arts',
      'Climbing', 'Skateboard', 'Rollerblading', 'Archery', 'Dance', 'Water sports',
    ),
  },
  {
    id: 'networking',
    label: 'Networking',
    tagline: 'Meet people building something',
    icon: 'handshake',
    color: '#5856D6',
    photo: 'founders',
    subs: [
      s('startups', 'Startups', [a('startup-coffee', 'Startup coffee'), a('pitch-night', 'Pitch night')]),
      s('entrepreneurs', 'Entrepreneurs', [a('founders-dinner', 'Founders dinner', 'DIFC', 'dubai')]),
      s('ai', 'AI', [a('ai-founders', 'AI founders session'), a('ai-builders', 'AI builders meetup'), a('ai-workshop', 'AI workshop')]),
      s('ecommerce', 'E-commerce', [a('ecom-dubai', 'E-commerce Dubai'), a('shopify-uae', 'Shopify sellers meetup'), a('amazon-uae', 'Amazon sellers UAE'), a('dtc-founders', 'DTC founders')]),
      s('crypto', 'Crypto', [a('crypto-meetup', 'Crypto meetup')]),
      s('web3', 'Web3 & blockchain'),
      s('finance', 'Finance'),
      s('investment', 'Investment', [a('investors-dinner', 'Investors dinner')]),
      s('realestate', 'Real estate', [a('re-networking', 'Real estate networking')]),
      s('fashion', 'Fashion', [a('fashion-founders', 'Fashion founders')]),
      s('marketing', 'Marketing'),
      s('sales', 'Sales'),
      s('creators', 'Creators', [a('dubai-creators', 'Dubai creators meetup')]),
      s('design', 'Design'),
      s('development', 'Development'),
      s('saas', 'SaaS'),
      s('mobile', 'Mobile apps'),
      s('legal', 'Legal'),
      s('accounting', 'Accounting'),
      s('consulting', 'Consulting'),
      s('media', 'Media & content'),
      s('photography', 'Photography & video'),
      s('architecture', 'Architecture'),
      s('engineering', 'Engineering'),
      s('healthcare', 'Healthcare'),
      s('education', 'Education'),
      s('recruitment', 'Recruitment & HR'),
      s('logistics', 'Logistics'),
      s('tourism', 'Tourism & hospitality'),
      s('luxury', 'Luxury'),
      s('automotive', 'Automotive'),
      s('tech', 'Tech', [a('tech-dinner', 'Tech dinner')]),
    ],
  },
  {
    id: 'food',
    label: 'Food & drink',
    tagline: 'Find people to eat with',
    icon: 'utensils',
    color: '#FF9500',
    photo: 'brunch',
    subs: [
      s('brunch', 'Brunch', [a('brunch-saturday', 'Saturday brunch')]),
      s('coffee', 'Coffee', [a('coffee-meetup', 'Coffee meetup')]),
      s('dinner', 'Dinner', [a('dinner-tonight', 'Dinner tonight'), a('new-restaurant', 'New restaurant'), a('food-tour', 'Food tour')]),
      ...list(
        'Restaurants', 'Desserts', 'Street food', 'Fine dining', 'Rooftops', 'Cafes', 'Bakeries', 'Steakhouses', 'Sushi', 'Burgers', 'Pizza',
        'Arabic food', 'Indian food', 'French food', 'Italian food', 'Japanese food', 'Korean food', 'Middle Eastern food', 'Healthy food',
      ),
    ],
  },
  {
    id: 'travel',
    label: 'Travel & trips',
    tagline: 'Explore the UAE together',
    icon: 'plane',
    color: '#007AFF',
    photo: 'abudhabi',
    subs: [
      s('abudhabi', 'Abu Dhabi', [
        a('abu-dhabi-day-trip', 'Abu Dhabi day trip', 'Dubai → Abu Dhabi', 'abudhabi'),
        a('grand-mosque', 'Sheikh Zayed Grand Mosque visit', 'Sheikh Zayed Grand Mosque', 'abudhabi', MOSQUE_NOTE),
        a('louvre', 'Museum day at Louvre Abu Dhabi', 'Louvre Abu Dhabi', 'abudhabi'),
        a('qasr-al-watan', 'Qasr Al Watan visit', 'Qasr Al Watan', 'abudhabi'),
        a('yas-day', 'Yas Island day', 'Yas Island', 'abudhabi'),
        a('ferrari-world', 'Ferrari World', 'Yas Island', 'abudhabi'),
        a('warner-bros', 'Warner Bros. World', 'Yas Island', 'abudhabi'),
        a('seaworld', 'SeaWorld Abu Dhabi', 'Yas Island', 'abudhabi'),
        a('yas-beach', 'Yas Beach day', 'Yas Beach', 'abudhabi'),
        a('corniche-walk', 'Corniche walk', 'Abu Dhabi Corniche', 'abudhabi'),
        a('saadiyat', 'Saadiyat beach and culture', 'Saadiyat Island', 'abudhabi'),
        a('mangroves', 'Mangrove kayak', 'Eastern Mangroves', 'abudhabi'),
      ]),
      s('dubai', 'Dubai', [
        a('burj-khalifa', 'Burj Khalifa at sunset', 'Burj Khalifa', 'dubai'),
        a('downtown-walk', 'Downtown walk', 'Downtown Dubai', 'dubai'),
        a('marina-walk', 'Marina walk', 'Dubai Marina', 'dubai'),
        a('creek', 'Old Dubai and the Creek', 'Dubai Creek · Al Seef', 'dubai'),
        a('global-village', 'Global Village night', 'Global Village', 'dubai', 'Seasonal: open roughly from autumn to spring. Check the dates of the current season.'),
        a('bluewaters', 'Bluewaters evening', 'Bluewaters', 'dubai'),
        a('madinat', 'Madinat Jumeirah evening', 'Madinat Jumeirah', 'dubai'),
      ]),
      s('sharjah', 'Sharjah', [a('sharjah-heritage', 'Heart of Sharjah heritage walk', 'Heart of Sharjah', 'sharjah'), a('sharjah-art', 'Sharjah art day', 'Al Mureijah', 'sharjah')]),
      s('ajman', 'Ajman', [a('ajman-beach', 'Ajman beach day', 'Ajman Corniche', 'ajman')]),
      s('rak', 'Ras Al Khaimah', [a('jebel-jais', 'Jebel Jais mountain day', 'Jebel Jais', 'rak'), a('rak-beach', 'Al Marjan beach weekend', 'Al Marjan Island', 'rak')]),
      s('fujairah', 'Fujairah', [a('fujairah-snorkel', 'Snorkeling at Snoopy Island', 'Snoopy Island', 'fujairah'), a('fujairah-mosque', 'Al Bidyah Mosque visit', 'Al Bidyah Mosque', 'fujairah', MOSQUE_NOTE)]),
      s('uaq', 'Umm Al Quwain', [a('uaq-mangroves', 'Mangrove kayak', 'Khor Al Beidah', 'uaq')]),
      s('oman', 'Oman', [a('oman-roadtrip', 'Oman road trip', 'Dubai → Musandam'), a('musandam-dhow', 'Musandam dhow cruise', 'Khasab, Musandam')]),
      s('hatta', 'Hatta', [a('hatta-day', 'Hatta day trip', 'Hatta', 'dubai'), a('hatta-kayak', 'Hatta dam kayak', 'Hatta Dam', 'dubai')]),
      ...list('Desert', 'Mountains', 'Beach trips', 'Road trips', 'Weekend trips', 'Day trips', 'Camping', 'Glamping', 'Boat trips', 'Yacht', 'Islands', 'Nature'),
    ],
  },
  {
    id: 'outdoor',
    label: 'Beach & outdoor',
    tagline: 'Sun, sea and sand, together',
    icon: 'palm',
    color: '#F2B600',
    photo: 'dunes',
    subs: [
      s('beach', 'Beach', [a('jbr-sunset', 'Sunset at JBR', 'JBR Beach', 'dubai'), a('kite-beach', 'Kite Beach morning', 'Kite Beach', 'dubai'), a('beach-picnic', 'Beach picnic')]),
      s('desert', 'Desert', [a('desert-sunset', 'Desert sunset'), a('desert-camp', 'Desert camp night')]),
      ...list('Sunset', 'Sunrise', 'Picnic', 'BBQ', 'Hiking', 'Camping', 'Boat', 'Yacht', 'Kayak', 'Paddleboard'),
    ],
  },
  {
    id: 'shopping',
    label: 'Shopping',
    tagline: 'Shop together',
    icon: 'shoppingBag',
    color: '#FF6482',
    photo: 'nightMarket',
    subs: [
      s('malls', 'Malls', [
        a('dubai-mall', 'Dubai Mall shopping', 'The Dubai Mall', 'dubai'),
        a('moe', 'Mall of the Emirates', 'Mall of the Emirates', 'dubai'),
        a('ibn-battuta', 'Ibn Battuta Mall', 'Ibn Battuta Mall', 'dubai'),
        a('outlet', 'Dubai Outlet Mall', 'Dubai Outlet Mall', 'dubai'),
        a('city-walk', 'City Walk afternoon', 'City Walk', 'dubai'),
      ]),
      s('souks', 'Souks', [a('gold-souk', 'Gold Souk walk', 'Gold Souk, Deira', 'dubai'), a('spice-souk', 'Spice Souk walk', 'Spice Souk, Deira', 'dubai')]),
      s('sneakers', 'Sneakers', [a('sneaker-hunt', 'Sneaker hunt')]),
      ...list('Fashion', 'Luxury', 'Streetwear', 'Vintage', 'Beauty', 'Electronics', 'Home', 'Design', 'Markets'),
    ],
  },
  {
    id: 'culture',
    label: 'Culture',
    tagline: 'Discover something new',
    icon: 'landmark',
    color: '#FF2D55',
    photo: 'gallery',
    subs: [
      s('museums', 'Museums', [a('museum-future', 'Museum of the Future', 'Museum of the Future', 'dubai'), a('etihad', 'Etihad Museum', 'Etihad Museum', 'dubai')]),
      s('art', 'Art', [a('alserkal', 'Alserkal Avenue art day', 'Alserkal Avenue', 'dubai'), a('d3-walk', 'd3 creative walk', 'Dubai Design District', 'dubai')]),
      s('mosques', 'Mosques', [a('jumeirah-mosque', 'Jumeirah Mosque visit', 'Jumeirah Mosque', 'dubai', MOSQUE_NOTE), a('grand-mosque-c', 'Sheikh Zayed Grand Mosque', 'Sheikh Zayed Grand Mosque', 'abudhabi', MOSQUE_NOTE)]),
      s('heritage', 'Heritage', [a('al-fahidi', 'Al Fahidi heritage walk', 'Al Fahidi', 'dubai')]),
      ...list('History', 'Architecture', 'Galleries', 'Exhibitions', 'Cultural centres', 'Local markets'),
    ],
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    tagline: 'Go out together',
    icon: 'popcorn',
    color: '#FF6B35',
    photo: 'dubaiNight',
    subs: list(
      'Cinema', 'Concerts', 'Comedy', 'Theatre', 'Arcade', 'Escape room', 'Karting', 'Bowling', 'VR', 'Theme parks', 'Water parks', 'Live shows', 'Festivals',
    ),
  },
  {
    id: 'nightlife',
    label: 'Nightlife',
    tagline: 'Your night, with people',
    icon: 'martini',
    color: '#AF52DE',
    photo: 'rooftopNeon',
    subs: [
      s('rooftops', 'Rooftops', [a('rooftop-night', 'Rooftop night')]),
      s('dinner-dj', 'Dinner & DJ', [a('dinner-dj', 'Dinner + DJ')]),
      ...list('Clubs', 'Lounges', 'Live music', 'Beach clubs', 'Night events'),
    ],
  },
  {
    id: 'wellness',
    label: 'Wellness',
    tagline: 'Feel better together',
    icon: 'leaf',
    color: '#30B0C7',
    photo: 'yoga',
    subs: [
      s('yoga', 'Yoga', [a('sunset-yoga', 'Sunset yoga')]),
      s('running', 'Running', [a('morning-run', 'Morning run')]),
      s('spa', 'Spa', [a('spa-day', 'Spa day')]),
      ...list('Gym', 'Massage', 'Pilates', 'Sauna', 'Cold plunge', 'Retreats', 'Meditation', 'Breathwork', 'Recovery'),
    ],
  },
  {
    id: 'animals',
    label: 'Animals',
    tagline: 'Walk together',
    icon: 'pawPrint',
    color: '#C69C6D',
    photo: 'beachSunset',
    subs: [
      s('dog-walk', 'Dog walk', [a('marina-dog-walk', 'Dog walk on the Marina', 'Dubai Marina', 'dubai'), a('dog-beach', 'Dog beach morning')]),
      s('dog-park', 'Dog park', [a('dog-playdate', 'Dog playdate')]),
      s('horse-riding', 'Horse riding', [a('desert-ride', 'Desert horse ride')]),
      ...list('Pet friends', 'Pet activities', 'Pet cafes', 'Pet services', 'Pet training', 'Animal shelters'),
    ],
  },
  {
    id: 'family',
    label: 'Family',
    tagline: 'Days out with the kids',
    icon: 'baby',
    color: '#34C7A5',
    photo: 'dubaiMarina',
    subs: list('Kids activities', 'Family days', 'Playgrounds', 'Family restaurants', 'Educational', 'Weekend activities'),
  },
  {
    id: 'creative',
    label: 'Creative',
    tagline: 'Make things with people',
    icon: 'brush',
    color: '#E65AA8',
    photo: 'coffeeBar',
    subs: [
      s('photography', 'Photography', [a('photo-walk', 'Photo walk'), a('palm-sunset-photo', 'Sunset photography at Palm Jumeirah', 'Palm Jumeirah', 'dubai')]),
      s('content', 'Content creation', [a('content-day', 'Content day')]),
      s('fashion', 'Fashion', [a('fashion-shoot', 'Fashion shoot')]),
      s('music', 'Music', [a('music-session', 'Music session')]),
      ...list('Videography', 'Design', 'Painting', 'Drawing', 'Dance', 'Writing'),
    ],
  },
  {
    id: 'learning',
    label: 'Learning',
    tagline: 'Learn something with others',
    icon: 'graduation',
    color: '#0FA3B1',
    photo: 'meeting',
    subs: [
      s('languages', 'Languages', [a('language-exchange', 'Language exchange')]),
      s('ai', 'AI', [a('ai-workshop-l', 'AI workshop')]),
      s('cooking', 'Cooking', [a('cooking-session', 'Cooking session')]),
      ...list('Business', 'Tech', 'Finance', 'Photography', 'Design', 'Fitness', 'Personal development'),
    ],
  },
];

export const CATEGORY_BY_ID: Record<CategoryKey, CatalogCategory> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryKey,
  CatalogCategory
>;

/** Everything one can create, flattened for search ("padel", "mosque", "AI"...). */
export type CatalogEntry = { categoryId: CategoryKey; sub: CatalogSub; activity?: CatalogActivity; label: string };

export const CATALOG_ENTRIES: CatalogEntry[] = CATEGORIES.flatMap((c) =>
  c.subs.flatMap((sub) => [
    { categoryId: c.id, sub, label: sub.label },
    ...(sub.activities ?? []).map((act) => ({ categoryId: c.id, sub, activity: act, label: act.label })),
  ]),
);

export function searchCatalog(query: string, limit = 12): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return CATALOG_ENTRIES.filter(
    (e) => e.label.toLowerCase().includes(q) || e.sub.label.toLowerCase().includes(q) || e.activity?.place?.toLowerCase().includes(q),
  ).slice(0, limit);
}

/**
 * A custom activity typed by a member ("Sunset photography at Palm
 * Jumeirah"): IRLY guesses the category from keywords. The member can
 * change it before posting.
 */
const HINTS: [RegExp, CategoryKey][] = [
  [/padel|tennis|foot|run|gym|box|surf|kite|swim|golf|cricket|climb|cycl|bike|volley|basket|mma|yoga|pilates/i, 'sport'],
  [/founder|startup|network|ai\b|tech|crypto|invest|ecom|shopify|business|pitch/i, 'networking'],
  [/brunch|dinner|lunch|coffee|food|restaurant|sushi|burger|pizza|cafe|dessert/i, 'food'],
  [/trip|abu dhabi|oman|hatta|road|weekend|visit|day out|mosque|louvre/i, 'travel'],
  [/beach|desert|sunset|sunrise|picnic|bbq|camp|hike|boat|yacht|kayak/i, 'outdoor'],
  [/shop|mall|souk|sneaker|fashion|vintage|beauty/i, 'shopping'],
  [/museum|art|gallery|heritage|exhibition|history/i, 'culture'],
  [/cinema|movie|concert|comedy|karting|escape|bowling|arcade|show|festival/i, 'entertainment'],
  [/club|lounge|rooftop|dj|night|party/i, 'nightlife'],
  [/spa|massage|sauna|meditat|breath|wellness|plunge/i, 'wellness'],
  [/dog|cat|pet|horse|puppy|animal/i, 'animals'],
  [/kid|family|child|playground/i, 'family'],
  [/photo|video|content|paint|draw|music|design|creative|shoot/i, 'creative'],
  [/learn|language|workshop|course|class|cooking/i, 'learning'],
];

export function guessCategory(text: string): CategoryKey {
  for (const [re, cat] of HINTS) if (re.test(text)) return cat;
  return 'sport';
}

/**
 * IRLY Girl has its own catalog, shown only to members with access. Same
 * structure, so every entry becomes a session like anywhere else.
 */
export const GIRL_CATEGORY: Omit<CatalogCategory, 'id'> & { id: 'girl' } = {
  id: 'girl',
  label: 'IRLY Girl',
  tagline: 'Find your girls',
  icon: 'heart',
  color: '#D9A5A0',
  photo: 'brunch',
  subs: list(
    'Girls padel', 'Girls brunch', 'Girls shopping', 'Girls travel', 'Girls night', 'Girls wellness', 'Girls running',
    'Girls beach', 'Girls beauty', 'Girls networking', 'Women entrepreneurs', 'Girls coffee', 'Girls dinner',
  ),
};
