import { ideaPhoto, type CategoryKey } from '@/data/catalog/categories';
import { photo, type PhotoKey } from '@/data/photos';
import { VARIANTS } from '@/data/photoVariants';

/**
 * THE IRLY PHOTO LIBRARY, for a new activity's photo. Every photo the app
 * already ships for a subject (IRLY's own Dubai photos, the photo library
 * and every variant of each key, see data/photos.ts), grouped by type of
 * activity: a football game can wear any of the football photos, a brunch
 * any brunch photo. The chosen one is saved on the activity (its URL, in
 * activities.cover_path), so the same photo shows everywhere, for everyone.
 *
 * Pure data and functions (no React): scripts/test-photos.mts checks every
 * type has photos, every URL comes from the project's photo sets, and no
 * photo appears twice in a type.
 */

export type LibraryKind =
  | 'football'
  | 'padel'
  | 'tennis'
  | 'running'
  | 'gym'
  | 'yoga'
  | 'swimming'
  | 'cycling'
  | 'golf'
  | 'watersports'
  | 'teamsports'
  | 'cafe'
  | 'brunch'
  | 'restaurant'
  | 'foodmore'
  | 'shopping'
  | 'beach'
  | 'desert'
  | 'yacht'
  | 'travel'
  | 'networking'
  | 'walk'
  | 'spa'
  | 'nightlife'
  | 'outings'
  | 'culture'
  | 'animals'
  | 'family'
  | 'creative'
  | 'learning'
  | 'girls';

/** The photo keys of each type of activity (every key expands to all of its photos). */
export const KIND_KEYS: Record<LibraryKind, PhotoKey[]> = {
  football: ['footballMix', 'football'],
  padel: ['padelMix', 'padelGirl', 'padel'],
  tennis: ['tennisMix', 'tennis', 'tennisGirl'],
  running: ['runMix', 'running', 'runGirl', 'marathon'],
  gym: ['gymMix', 'gym', 'gymGirl', 'crossfit', 'girlFitness', 'boxing'],
  yoga: ['yoga', 'pilatesGirl', 'momYoga', 'girlClass', 'meditation'],
  swimming: ['swimMix', 'swimming'],
  cycling: ['cycling', 'bikeGirl'],
  golf: ['golfGirl', 'golf'],
  watersports: ['surf', 'kitesurf', 'kiteBeach', 'girlSurf', 'diving', 'snorkel', 'kayak', 'sailing'],
  teamsports: ['basketball', 'volleyball', 'cricket', 'badminton', 'tableTennis', 'climbing', 'skate', 'rollerblade', 'archery', 'horseRiding'],
  cafe: ['drinksGirl', 'coffee', 'coffeeBar', 'girlCoffee', 'girlCafe', 'bakery'],
  brunch: ['brunchGirl', 'brunch', 'healthyFood', 'bakery'],
  restaurant: ['dinnerMix', 'dinnerView', 'foodMix', 'nightDinner', 'restaurantGirl', 'dinner', 'dinnerGroup', 'fineDining', 'girlDinner', 'sushi', 'italianFood', 'japaneseFood', 'pizza', 'burger', 'steak', 'indianFood', 'koreanFood', 'frenchFood', 'streetFood'],
  foodmore: ['dessert', 'bbq', 'cooking'],
  shopping: ['mall', 'souk', 'fashion', 'luxury', 'sneakers', 'girlShopping', 'nightMarket', 'beauty', 'homeDecor'],
  beach: ['beachMix', 'beachClub', 'beachClubGirl', 'beachSunset', 'jbr', 'kiteBeach', 'familyBeach', 'momBeach', 'girlSunset', 'picnic', 'palmAerial'],
  desert: ['buggyMix', 'desertGirl', 'desertSunsetGirl', 'desertSelfieGirl', 'quadGirl', 'dunes', 'camping', 'glamping', 'hikeDesert'],
  yacht: ['yachtGirl', 'marinaYachtGirl', 'yacht', 'dhow', 'sailing'],
  travel: ['girlTrip', 'girlTravel', 'roadtrip', 'emirates', 'abudhabi', 'abudhabiSkyline', 'fort', 'islands', 'sharjah', 'rak', 'fujairah', 'bali', 'baliDawn', 'baliTemple', 'baliRoad', 'tanahLot', 'thailand', 'singapore', 'london', 'paris'],
  networking: ['meetingMix', 'networkingGirl', 'meeting', 'founders', 'coworking', 'startup', 'girlWork', 'girlLaptop', 'office', 'developer', 'designWork', 'finance'],
  walk: ['nature', 'wadiMix', 'hikeDesert', 'waterfall', 'lake', 'dogWalk', 'picnic', 'girlHike', 'girlWaterfall', 'palmAerial'],
  spa: ['spa', 'spaGirl', 'massage', 'sauna', 'girlSpa', 'girlChill', 'meditation', 'yoga', 'pilatesGirl', 'beauty'],
  nightlife: ['nightDinner', 'drinksGirl', 'rooftop', 'rooftopNeon', 'lounge', 'djSunset', 'dubaiNight', 'karaoke'],
  outings: ['concert', 'liveMusic', 'festival', 'cinema', 'comedy', 'theatre', 'globalVillage', 'themePark', 'waterParkMix', 'waterPark', 'arcade', 'bowling', 'karting', 'vrMix', 'vr', 'dance'],
  culture: ['globalVillage', 'mosqueGirl', 'skylineGirl', 'burjArabSunset', 'gallery', 'mosque', 'burjKhalifa', 'dubaiCreek', 'souk', 'fort', 'photography'],
  animals: ['dog', 'dogPark', 'dogWalk', 'cat', 'petCafe', 'horse', 'horseRiding', 'safariPark'],
  family: ['family', 'kids', 'playground', 'familyBeach', 'momPlaydate', 'strollerMom', 'waterPark', 'themePark', 'momBaby', 'momBeach'],
  creative: ['photography', 'music', 'writing', 'designWork', 'girlBookClub', 'gallery', 'cooking', 'dance'],
  learning: ['education', 'readingGirl', 'girlBookClub', 'developer', 'writing', 'girlClass'],
  girls: ['girlsOut', 'dubaiPink', 'desertSunsetGirl', 'skylineGirl', 'girlFriends', 'girlSunset', 'girlChill'],
};

/** A whole category: every type of activity it holds. */
export const CATEGORY_KINDS: Record<CategoryKey, LibraryKind[]> = {
  sport: ['football', 'padel', 'tennis', 'running', 'gym', 'swimming', 'cycling', 'golf', 'watersports', 'teamsports'],
  networking: ['networking'],
  food: ['restaurant', 'brunch', 'cafe', 'foodmore'],
  travel: ['travel', 'desert'],
  outdoor: ['walk', 'beach', 'desert', 'yacht', 'watersports'],
  shopping: ['shopping'],
  culture: ['culture'],
  entertainment: ['outings'],
  nightlife: ['nightlife'],
  wellness: ['spa', 'yoga'],
  animals: ['animals'],
  family: ['family'],
  creative: ['creative'],
  learning: ['learning'],
  outings: ['outings', 'walk'],
  cafes: ['cafe'],
  beach: ['beach', 'watersports', 'yacht'],
  games: ['outings'],
  experiences: ['travel', 'desert', 'culture'],
  communities: ['outings'],
};

/** The type of an activity read from its words, most specific first ("Beach yoga" is yoga). */
const KIND_RULES: [RegExp, LibraryKind][] = [
  [/\b(football|soccer|futsal)\b/i, 'football'],
  [/\b(padel|pickleball)\b/i, 'padel'],
  [/(?<!table )\b(tennis|squash)\b/i, 'tennis'],
  [/\b(run|running|runners?|jog\w*|marathon|10k|5k)\b/i, 'running'],
  [/\b(yoga|pilates|reformer|breathwork|meditat\w*)\b/i, 'yoga'],
  [/\b(gym|fitness|workout|hiit|bootcamp|crossfit|boxing|kickboxing|mma|calisthenics)\b/i, 'gym'],
  [/\b(swim\w*|open water|triathlon)\b/i, 'swimming'],
  [/\b(cycl\w*|bikes?|biking|spinning|vélo)\b/i, 'cycling'],
  [/\b(golf|topgolf|driving range)\b/i, 'golf'],
  [/\b(surf\w*|kite\w*|paddleboard|water sports?|jet ?ski|wakeboard\w*|diving|dive|scuba|snorkel\w*|kayak\w*|sailing)\b/i, 'watersports'],
  [/\b(yachts?|boats?|cruise|dhow)\b/i, 'yacht'],
  [/\b(basket\w*|volley\w*|cricket|badminton|table tennis|ping pong|climbing|bouldering|skate\w*|roller\w*|archery|horse\w*)\b/i, 'teamsports'],
  // A founders' breakfast is networking before it is a breakfast.
  [/\b(networking|founders?|entrepreneurs?|business|startups?|cowork\w*|meetups?|career|pitch)\b/i, 'networking'],
  [/\b(brunch|breakfast)\b/i, 'brunch'],
  [/\b(coffee|cafes?|cafés?|matcha|tea|bakery)\b/i, 'cafe'],
  [/\b(dinner|dîner|lunch|restaurants?|dining|sushi|pizza|burgers?|steak\w*|food|tasting)\b/i, 'restaurant'],
  [/\b(spa|massage|sauna|hammam|beauty|nails?|self.?care|wellness|retreats?)\b/i, 'spa'],
  [/\b(shopping|malls?|souks?|markets?|fashion|outlet|sneakers?|vintage)\b/i, 'shopping'],
  [/\b(desert|dunes?|safari|quad\w*|buggy|buggies|camping|glamping|camels?)\b/i, 'desert'],
  [/\b(beach\w*|plage|pool|sunset|picnic)\b/i, 'beach'],
  [/\b(walk\w*|hik\w*|trek\w*|wadi|nature|parks?|waterfalls?|lakes?)\b/i, 'walk'],
  [/\b(travel\w*|trips?|voyages?|getaway|weekend away|road trips?)\b/i, 'travel'],
  [/\b(night out|nightlife|party|rooftops?|bar|lounges?|cocktails?|karaoke|dj|club)\b/i, 'nightlife'],
  [/\b(concerts?|live music|festivals?|cinema|movies?|comedy|theatre|theater|shows?|bowling|karting|arcade|escape rooms?|theme parks?|water parks?|dance|dancing|salsa|events?|global village)\b/i, 'outings'],
  [/\b(museums?|galleries|gallery|exhibitions?|art|mosques?|culture|heritage|history)\b/i, 'culture'],
  [/\b(dogs?|puppy|cats?|pets?|horses?|zoo|animals?)\b/i, 'animals'],
  [/\b(kids|children|playdate|playground|family|families|moms?|mums?|baby|stroller)\b/i, 'family'],
  [/\b(photo\w*|music|writing|design|painting|pottery|crafts?|workshop|creative)\b/i, 'creative'],
  [/\b(books?|book club|reading|language\w*|learning|class|course)\b/i, 'learning'],
];

/** Keys never shown first: their first picture is the same file as another key's (data/photos.ts SHARED_PRIMARY). */
const SHARED_PRIMARY = new Set<string>(['jbr', 'roadtrip', 'meeting']);

/** Every library photo of one key: its first picture, then each variant (HD, 1600 px), each once. */
export function photosOfKey(key: PhotoKey): string[] {
  const out: string[] = [];
  // A width far above any screen: the large file of IRLY's own photos, a large Unsplash crop.
  if (!SHARED_PRIMARY.has(key)) out.push(photo(key, 4000, undefined, true).replace(/([?&])w=\d+/, '$1w=1600'));
  for (const v of VARIANTS[key] ?? []) out.push(v.replace('{w}', '1600'));
  return [...new Set(out)];
}

const isKind = (k: string): k is LibraryKind => k in KIND_KEYS;

/**
 * The type of library photos for an activity: from its words (title, catalog
 * subcategory, place), else from its photo key, else its whole category.
 */
export function libraryKindOf(categoryId: CategoryKey, label = '', place?: string, subLabel?: string): LibraryKind | CategoryKey {
  const own = `${label} ${subLabel ?? ''}`;
  for (const text of [own, `${own} ${place ?? ''}`]) for (const [re, kind] of KIND_RULES) if (re.test(text)) return kind;
  const key = ideaPhoto(categoryId, label, place);
  const inCategory = CATEGORY_KINDS[categoryId] ?? [];
  const found = inCategory.find((k) => KIND_KEYS[k].includes(key)) ?? (Object.keys(KIND_KEYS) as LibraryKind[]).find((k) => KIND_KEYS[k].includes(key));
  return found ?? categoryId;
}

/** Photos of mixed groups: not the look of IRLY Girl, where every plan is for women. */
const MIXED = /Mix$/;

/**
 * ALL the library photos for a type of activity (or a whole category), each
 * once. In IRLY Girl the photos of mixed groups are left out, unless the
 * type would have none without them.
 */
export function libraryFor(kind: LibraryKind | CategoryKey, opts: { girl?: boolean } = {}): string[] {
  const kinds = isKind(kind) ? [kind] : (CATEGORY_KINDS[kind] ?? []);
  const keys = [...new Set(kinds.flatMap((k) => KIND_KEYS[k]))];
  const shown = opts.girl ? keys.filter((k) => !MIXED.test(k)) : keys;
  const urls = [...new Set((shown.length ? shown : keys).flatMap(photosOfKey))];
  return urls.length ? urls : photosOfKey('girlsOut');
}

/** The same photo, small: for the grid (480 px files, 800 px variants, a 480 px Unsplash crop). */
export function libraryThumb(url: string): string {
  return url
    .replace(/-1200\.jpg$/, '-480.jpg')
    .replace(/-1600\.jpg$/, '-800.jpg')
    .replace(/([?&])w=\d+/, '$1w=480');
}

/** Only photos of the IRLY library can be saved as a link (the server checks the same). */
export const LIBRARY_URL = /^https:\/\/(alafrench7593-a11y\.github\.io\/irly\/photos\/|getirly\.com\/img\/own\/|images\.unsplash\.com\/photo-)[A-Za-z0-9._~\/?&=%-]+$/;
export const isLibraryUrl = (url: string | null | undefined): url is string => Boolean(url && url.length <= 400 && !url.includes('..') && LIBRARY_URL.test(url));

/**
 * SURPRISE ME: one photo picked uniformly at random among the type's photos,
 * never `avoid` (the photo shown now, or the last one used for this type)
 * while another one exists.
 */
export function surprise(urls: readonly string[], avoid: readonly (string | null | undefined)[] = [], random: () => number = Math.random): string | null {
  if (!urls.length) return null;
  const skip = new Set(avoid.filter(Boolean));
  const pool = urls.filter((u) => !skip.has(u));
  const from = pool.length ? pool : urls;
  return from[Math.min(from.length - 1, Math.floor(random() * from.length))];
}
