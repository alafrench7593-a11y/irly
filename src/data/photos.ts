import { PixelRatio } from 'react-native';
import { DUBAI_KEYS } from './dubaiKeys';
import { KEY_FILMS, VARIANTS } from './photoVariants';
/**
 * Photography registry: real photos only.
 *
 * Every image is an Unsplash photo (free for commercial use, no attribution
 * required). Each id has been checked to resolve. Screens never reference a
 * URL directly: they use a key, so swapping in IRLY's own photography (or a
 * paid stock licence) is a one-file change.
 */
const ids = {
  // Destinations
  emirates: '1607414851776-f2fcc379fb48',
  dubai: '1655309893829-407c54619f1f',
  dubaiNight: '1590264539175-39df72442833',
  dubaiMarina: '1527354711091-dfe0e5f699be',
  dubaiCreek: '1565677916056-dfb75e7aa408',
  jlt: '1677942937433-62270f06e480',
  abudhabi: '1512632578888-169bbbc64f33',
  abudhabiSkyline: '1734009775179-07f428483783',
  sharjah: '1627120697861-84c863582194',
  ajman: '1706413639793-1ad524e698ae',
  rak: '1542878447-e2b6df2526fa',
  fujairah: '1648814037760-1dd4d3169a26',
  fort: '1623680904963-5580d963e18e',
  uaq: '1714577419068-45189e7bda58',
  bali: '1555400038-63f5ba517a47',
  baliDawn: '1558005530-a7958896ec60',
  baliTemple: '1537996194471-e657df975ab4',
  baliRoad: '1711658450992-3c17ed5fd72b',
  tanahLot: '1518548419970-58e3b4079ab2',
  thailand: '1563492065599-3520f775eeed',
  singapore: '1525625293386-3f8f99389edd',
  london: '1543832923-44667a44c804',
  paris: '1502602898657-3e91760cbb34',
  // Activities (inherited from IRLY v1 sport module)
  football: '1431324155629-1a6deb1dec8d',
  padel: '1554068865-24cecd4e34b8',
  basketball: '1546519638-68e109498ffc',
  tennis: '1622279457486-62dcc4a431d6',
  running: '1552674605-db6ffd4facb5',
  gym: '1534438327276-14e5300c3a48',
  crossfit: '1534258936925-c58bed479fcb',
  cycling: '1541625602330-2277a4c46182',
  swimming: '1530549387789-4c1017266635',
  volleyball: '1612872087720-bb876e2e67d1',
  boxing: '1549719386-74dfcbf7dbed',
  yoga: '1506126613408-eca07ce68773',
  surf: '1527731149372-fae504a1185f',
  hikeDesert: '1707630729985-81442b80b39e',
  waterfall: '1554931670-4ebfabf6e7a9',
  dunes: '1553796661-17b7fa359f49',
  kayak: '1706724728271-a81750af4b8f',
  // Social & places
  dinner: '1688437307687-fe226bddfab1',
  dinnerGroup: '1688437310009-ed23b2188d38',
  rooftop: '1563138216-8ff2e182ccbd',
  rooftopNeon: '1758165532022-a68f291317ba',
  djSunset: '1783882509948-2f8cd8722a22',
  brunch: '1414235077428-338989a2e8c0',
  yacht: '1567899378494-47b22a2ae96a',
  coffee: '1567880905822-56f8e06fe630',
  coffeeBar: '1545418314-7ce0b9b53901',
  beachClub: '1571984405176-5958bd9ac31d',
  beachSunset: '1662950267280-0cdf5f7139b4',
  gallery: '1578855019520-af8101c056e2',
  nightMarket: '1616658589225-aa7e64e59c13',
  // Work
  coworking: '1604328727766-a151d1045ab4',
  founders: '1553028826-f4804a6dba3b',
  meeting: '1573164574572-cb89e39749b4',
  office: '1497366754035-f200968a6e72',
  accountant: '1626266061368-46a8f578ddd6',
  // Services
  apartment: '1682184805271-11671b7ecf4c',
  cleanHome: '1583847268964-b28dc8f51f92',
  villa: '1634671651144-adbeca8623cb',
  scooter: '1712213248719-aade0e02a591',
  car: '1519641471654-76ce0107ad1b',
  passport: '1581553673739-c4906b5d0de8',
  boxes: '1624137527136-66e631bdaa0e',
  newHome: '1730154838368-c37b1fdebcf6',
  tools: '1581783898377-1c85bf937427',
  laundry: '1582735689369-4fe89db7114c',
} as const;

/**
 * IRLY's own photo library: one checked photo per subject (public domain /
 * CC0, sources in public-photos/CREDITS.md), cropped to 16:10 in two sizes
 * and served with the web app.
 */
export const LIBRARY = [
  // Provided by IRLY
  'marathon',
  // IRLY Girl and IRLY Moms
  'girlFriends',
  'girlSunset',
  'girlShopping',
  'girlSpa',
  'girlChill',
  'girlWaterfall',
  'girlClass',
  'girlBookClub',
  'momPlaydate',
  'momYoga',
  'girlCoffee',
  'girlCafe',
  'girlWork',
  'girlLaptop',
  'girlHike',
  'girlTravel',
  'girlFitness',
  'girlSurf',
  'girlDinner',
  'momBaby',
  'momBeach',
  'familyBeach',
  'arcade',
  'archery',
  'automotive',
  'badminton',
  'bakery',
  'bbq',
  'beauty',
  'bowling',
  'burger',
  'burjKhalifa',
  'camping',
  'cat',
  'cinema',
  'climbing',
  'comedy',
  'concert',
  'cooking',
  'cricket',
  'dance',
  'designWork',
  'dessert',
  'developer',
  'dhow',
  'diving',
  'dog',
  'dogPark',
  'education',
  'family',
  'fashion',
  'festival',
  'finance',
  'fineDining',
  'frenchFood',
  'glamping',
  'golf',
  'healthyFood',
  'homeDecor',
  'horse',
  'horseRiding',
  'indianFood',
  'islands',
  'italianFood',
  'japaneseFood',
  'jbr',
  'karaoke',
  'karting',
  'kids',
  'kitesurf',
  'koreanFood',
  'lake',
  'legal',
  'liveMusic',
  'logistics',
  'lounge',
  'luxury',
  'mall',
  'massage',
  'meditation',
  'mosque',
  'music',
  'nature',
  'petCafe',
  'photography',
  'picnic',
  'pizza',
  'playground',
  'realEstate',
  'roadtrip',
  'rollerblade',
  'sailing',
  'sauna',
  'skate',
  'sneakers',
  'snorkel',
  'souk',
  'spa',
  'startup',
  'steak',
  'streetFood',
  'sushi',
  'tableTennis',
  'theatre',
  'themePark',
  'vr',
  'waterPark',
  'writing',
] as const;
// Keys that now have a Dubai photo (Pixabay / Pexels) are served from the library too.
/** IRLY's own photos, taken in Dubai and used with permission; served with the website (site/img/own). */
export const OWN = ['globalVillage', 'safariPark', 'quadGirl', 'networkingGirl', 'dogWalk', 'girlsOut', 'pilatesGirl', 'desertGirl', 'drinksGirl', 'golfGirl', 'yachtGirl', 'padelGirl', 'tennisGirl', 'spaGirl', 'nightDinner', 'brunchGirl', 'strollerMom', 'mosqueGirl', 'readingGirl', 'beachClubGirl', 'kiteBeach', 'bikeGirl', 'dubaiPink', 'restaurantGirl', 'gymGirl', 'runGirl', 'girlTrip', 'footballMix', 'gymMix', 'dinnerMix', 'beachMix', 'buggyMix', 'waterParkMix', 'foodMix', 'meetingMix', 'vrMix', 'wadiMix', 'runMix', 'danceMix', 'swimMix', 'tennisMix', 'palmAerial', 'padelMix', 'newcomerGirl', 'dinnerView', 'burjArabSunset', 'skylineGirl', 'marinaYachtGirl', 'desertSelfieGirl', 'desertSunsetGirl', 'poolGirl', 'quadsGirl', 'burjNight'] as const;
const OWN_SET = new Set<string>(OWN);
/** Whether a key is one of IRLY's own photos (it is then shown as it is, before any other photo of its subject). */
export const isOwnPhoto = (key: string): boolean => OWN_SET.has(key);
/**
 * IRLY's own photos whose original is larger than their -1200 file (about
 * 1080 px wide or more): <key>-hd.jpg is that whole original (the -1200 file
 * is at most 1200 px on its long side), for full-screen backgrounds and covers on dense screens. The others
 * are only as large as the photo IRLY sent: never enlarged.
 */
const OWN_HD = new Set<string>(['burjArabSunset', 'newcomerGirl', 'yachtGirl', 'padelMix', 'poolGirl', 'quadsGirl']);

/**
 * Photos the IRLY team put instead of the app's own, from the back office
 * (public.app_photo_overrides, loaded by src/features/photo/overrides.ts):
 * key → link. A replaced key shows that one photo everywhere, whatever the
 * seed; without an entry, the app's own photos as before.
 */
let overrides: Readonly<Record<string, string>> = {};
export function setPhotoOverrides(next: Readonly<Record<string, string>>): void {
  overrides = next;
}
/** The team's photo for this key, if there is one. */
export const photoOverride = (key: string): string | undefined => overrides[key];
const OWN_BASE = 'https://getirly.com/img/own';

const LIBRARY_SET = new Set<string>([...LIBRARY, ...DUBAI_KEYS]);
const LIBRARY_BASE = 'https://alafrench7593-a11y.github.io/irly/photos';

/**
 * Silent films (Pixabay / Pexels, fetched by .github/scripts/dubai-media.mjs
 * and served by the website). A photo key with a matching film plays it over
 * the photo: the Home hero and the header of an activity without its own photo.
 */
const FILM_BASE = 'https://getirly.com/video';
const FILMS: Partial<Record<string, string>> = {
  dubai: 'dubai',
  emirates: 'dubai',
  burjKhalifa: 'dubai',
  dubaiNight: 'night',
  rooftop: 'night',
  rooftopNeon: 'night',
  lounge: 'night',
  dubaiMarina: 'marina',
  yacht: 'marina',
  sailing: 'marina',
  jbr: 'beach',
  beachSunset: 'beach',
  beachClub: 'beach',
  surf: 'beach',
  kitesurf: 'beach',
  volleyball: 'beach',
  familyBeach: 'beach',
  dunes: 'desert',
  hikeDesert: 'desert',
  camping: 'desert',
  glamping: 'desert',
  abudhabi: 'abudhabi',
  abudhabiSkyline: 'abudhabi',
};

const OWN_FILM = new Set(KEY_FILMS);
/** The film for a photo key, if there is one: its own clip first, never one shared with another subject. */
export const filmFor = (key: string): string | undefined =>
  // A photo the IRLY team put instead (back office) is shown as it is, without the film.
  overrides[key] ? undefined : OWN_FILM.has(key) ? `${FILM_BASE}/k-${key}.mp4` : FILMS[key] ? `${FILM_BASE}/${FILMS[key]}.mp4` : undefined;

/** The Home hero film of a city: Dubai and Abu Dhabi have theirs, by day and by night. */
export const cityFilm = (cityId: string, heroKey: string): string | undefined => (cityId === 'dubai' || cityId === 'abudhabi' ? filmFor(heroKey) : undefined);

/**
 * Example portraits for the demonstration build only (CC0 stock photos,
 * fetched by the photo workflow into /irly/photos/faces/). Real members
 * always show their own photo or their initials.
 */
// Bumped when portraits are replaced, so phones fetch the new faces instead of their cached copy.
const FACES_VERSION = 2;
export const portrait = (id: string) => `${LIBRARY_BASE}/faces/${id}.jpg?v=${FACES_VERSION}`;

export type PhotoKey = keyof typeof ids | (typeof LIBRARY)[number] | (typeof OWN)[number];

export const PHOTO_IDS = ids;

/** Pixels to ask for: the layout width times the screen density, in steps (better caching), up to 2400. */
const pixels = (width: number) => Math.min(2400, Math.ceil((width * Math.min(3, PixelRatio.get())) / 400) * 400);

/** The key's first picture (the one chosen by hand). */
function primary(key: PhotoKey, px: number): string {
  if (OWN_SET.has(key)) return `${OWN_BASE}/${key}-${px <= 600 ? 480 : px > 1200 && OWN_HD.has(key) ? 'hd' : 1200}.jpg`;
  if (LIBRARY_SET.has(key)) return `${LIBRARY_BASE}/${key}-${px <= 600 ? 480 : 1200}.jpg`;
  return `https://images.unsplash.com/photo-${ids[key as keyof typeof ids]}?auto=format&fit=crop&w=${px}&q=80`;
}

/** A variant URL at the right size ({w}: any width on a CDN; our own files exist at 800, 1600 and 2400). */
const sized = (template: string, px: number) => template.replace('{w}', String(template.includes('/irly/photos/v/') ? (px <= 800 ? 800 : px <= 1600 ? 1600 : 2400) : px));

/**
 * Never the same picture twice: each thing shown with a key (an activity, a
 * community, a card) gets its own photo of that subject. With a seed (the
 * thing's id) the choice is a hash of the id: the same activity shows the
 * same photo on every screen, after a restart and on every phone, and
 * different activities spread over the subject's photos. Without one, each
 * new place showing the key takes the next photo.
 */
const next = new Map<string, number>();
/** One thing, one seed: a list card ("srv-<id>"), its page ("a-<id>") and its thumb ("<id>-thumb") share the photo. */
const seedOf = (seed: string) => seed.replace(/^(srv|act|a|c)-/, '').replace(/-thumb$/, '');
/** FNV-1a then a final mix (murmur3 fmix32): close ids ("srv-1", "srv-2") land far apart. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
function pick(key: string, count: number, seed?: string): number {
  if (count <= 1) return 0;
  if (seed) return hash(`${key}|${seedOf(seed)}`) % count;
  const n = next.get(key) ?? 0;
  next.set(key, n + 1);
  return n % count;
}

/** Keys whose first picture is the same file as another key's (jbr = surf, roadtrip = hikeDesert, meeting = founders): only their own variants are shown. */
const SHARED_PRIMARY = new Set<string>(['jbr', 'roadtrip', 'meeting']);

/**
 * IRLY's own photos of a mixed group or of women ("footballMix", "padelGirl")
 * are one picture each: the most common activities would all wear it. They
 * also take the photos of the same subject (the plain key's variants), so a
 * football game shows IRLY's photo or one of the football photos. In IRLY
 * Girl, a key of women keeps IRLY's photo of women (no mixed stock photos).
 */
const COUNTERPART: Partial<Record<string, string>> = {
  footballMix: 'football',
  gymMix: 'gym',
  dinnerMix: 'dinner',
  beachMix: 'beachClub',
  buggyMix: 'dunes',
  waterParkMix: 'waterPark',
  foodMix: 'dinnerGroup',
  meetingMix: 'meeting',
  vrMix: 'vr',
  wadiMix: 'hikeDesert',
  runMix: 'running',
  // The photo IRLY sent as danceMix is an MMA sparring scene (the same picture as boxing).
  danceMix: 'boxing',
  swimMix: 'swimming',
  tennisMix: 'tennis',
  padelMix: 'padel',
  dinnerView: 'fineDining',
  padelGirl: 'padel',
  tennisGirl: 'tennis',
  gymGirl: 'gym',
  runGirl: 'running',
  brunchGirl: 'brunch',
  yachtGirl: 'yacht',
  golfGirl: 'golf',
  spaGirl: 'spa',
  desertGirl: 'dunes',
  quadGirl: 'dunes',
  pilatesGirl: 'yoga',
  restaurantGirl: 'dinner',
  beachClubGirl: 'beachClub',
  drinksGirl: 'coffeeBar',
  networkingGirl: 'meeting',
  bikeGirl: 'cycling',
  mosqueGirl: 'mosque',
  readingGirl: 'girlBookClub',
};

/** The other pictures of a key (its own variants, else its plain counterpart's), each once. */
export function variantsOf(key: string, girl = false): readonly string[] {
  const own = VARIANTS[key];
  if (own?.length) return own;
  const plain = COUNTERPART[key];
  if (!plain || (girl && key.endsWith('Girl'))) return [];
  return VARIANTS[plain] ?? [];
}


/**
 * With `pinned`, always the key's first picture: for Dubai keys, the photo taken in Dubai (variants may be from anywhere).
 * `girl`: shown in IRLY Girl, where a key of women keeps its own photo.
 */
export function photo(key: PhotoKey, width = 900, seed?: string, pinned = false, girl = false): string {
  const own = overrides[key];
  if (own) return own;
  const px = pixels(width);
  const variants = variantsOf(key, girl);
  if (pinned && !SHARED_PRIMARY.has(key)) return primary(key, px);
  if (SHARED_PRIMARY.has(key) && variants.length) return sized(variants[pick(key, variants.length, seed)], px);
  const i = pick(key, variants.length + 1, seed);
  return i === 0 ? primary(key, px) : sized(variants[i - 1], px);
}

/**
 * The sharpest picture of a key, always the same one, for a full-screen
 * background: the IRLY team's photo (back office) first, then IRLY's own
 * photo (its untouched original on dense screens), else the subject's first
 * HD photo (2400 px) rather than the 1200 px library file.
 */
export function bestPhoto(key: PhotoKey, width: number): string {
  const own = overrides[key];
  if (own) return own;
  const px = pixels(width);
  if (OWN_SET.has(key)) return primary(key, px);
  const hd = VARIANTS[key];
  return hd?.length ? sized(hd[0], px) : primary(key, px);
}
