import type { PhotoKey } from '@/data/photos';

/**
 * IRLY Girl and IRLY Moms photos (public domain / CC0, see
 * public-photos/CREDITS.md): one per kind of plan or community, chosen from
 * the words in its name.
 */
const RULES: [RegExp, PhotoKey][] = [
  [/\b(moms?|mums?|mamans?|mother|playdates?|kids?|children|enfants?)\b/i, 'momPlaydate'],
  [/\b(baby|babies|bébé|stroller|poussette)\b/i, 'strollerMom'],
  [/\b(family|families|famille)\b/i, 'familyBeach'],
  [/\b(pilates|reformer)\b/i, 'pilatesGirl'],
  [/\b(yoga|wellness|breathwork|meditat\w*)\b/i, 'girlClass'],
  [/\b(spa|beauty|massage|self.?care|nails?)\b/i, 'spaGirl'],
  [/\b(run\w*|jog\w*|marathon)\b/i, 'runGirl'],
  [/\b(girl trips?)\b/i, 'girlTrip'],
  [/\b(padel)\b/i, 'padelGirl'],
  [/\b(bikes?|cycl\w*|vélo)\b/i, 'bikeGirl'],
  [/(?<!table )\btennis\b/i, 'tennisGirl'],
  [/\b(golf|topgolf)\b/i, 'golfGirl'],
  [/\b(yachts?|boats?|cruise|sailing)\b/i, 'yachtGirl'],
  [/\b(global village)\b/i, 'globalVillage'],
  [/\b(fitness|gym|workout)\b|(?<!water )\bsports?\b(?! bars?)/i, 'gymGirl'],
  [/\b(surf\w*|water sports?)\b/i, 'girlSurf'],
  [/\b(hik\w*|trek\w*|nature|waterfalls?)\b/i, 'hikeDesert'],
  [/\b(travel\w*|trips?|voyage\w*|explor\w*)\b/i, 'girlTrip'],
  [/\b(brunch\w*)\b/i, 'brunchGirl'],
  [/\b(dinner\w*|dîner|food\w*|eat\w*)\b/i, 'girlCafe'],
  [/\b(coffee|café|cafes?|matcha|drinks?)\b/i, 'drinksGirl'],
  [/\b(desert|camels?|dunes?)\b/i, 'desertGirl'],
  [/\b(night out|rooftop|soirée|sorties?|party)\b/i, 'nightDinner'],
  [/\b(entrepreneurs?|founders?|business|career|work\w*|cowork\w*|network\w*)\b/i, 'girlWork'],
  [/\b(books?|book club|reading|lecture)\b/i, 'readingGirl'],
  [/\b(mosques?)\b/i, 'mosqueGirl'],
  [/\b(shopping|fashion|mode)\b/i, 'girlShopping'],
  [/\b(beach\w*|plage|sunset|coucher)\b/i, 'beachClubGirl'],
  [/\b(moving|new in|relocat\w*|expats?|arriv\w*)\b/i, 'girlTravel'],
];

/** A photo for a girls' plan or community, from its name; friends by default. */
export function girlPhotoFor(text: string, fallback: PhotoKey = 'girlsOut'): PhotoKey {
  for (const [re, key] of RULES) if (re.test(text)) return key;
  return fallback;
}

/** IRLY Girl and IRLY Moms communities: always a photo taken in Dubai, matched on the words in the name. */
const COMMUNITY_RULES: [RegExp, PhotoKey][] = [
  [/\b(baby|babies|bébé|stroller|poussette)\b/i, 'strollerMom'],
  [/\b(moms?|mums?|mamans?|mother|playdates?|kids?|children|enfants?)\b/i, 'kids'],
  [/\b(family|families|famille)\b/i, 'waterPark'],
  [/\b(pilates|reformer)\b/i, 'pilatesGirl'],
  [/\b(yoga|breathwork|meditat\w*)\b/i, 'yoga'],
  [/\b(spa|beauty|massage|self.?care|nails?|wellness)\b/i, 'spaGirl'],
  [/\b(run\w*|jog\w*|marathon)\b/i, 'runGirl'],
  [/\b(girl trips?)\b/i, 'girlTrip'],
  [/\b(padel)\b/i, 'padelGirl'],
  [/\b(bikes?|cycl\w*|vélo)\b/i, 'bikeGirl'],
  [/(?<!table )\btennis\b/i, 'tennisGirl'],
  [/\b(golf|topgolf)\b/i, 'golfGirl'],
  [/\b(yachts?|boats?|cruise|sailing)\b/i, 'yachtGirl'],
  [/\b(global village)\b/i, 'globalVillage'],
  [/\b(fitness|gym|workout)\b|(?<!water )\bsports?\b(?! bars?)/i, 'gymGirl'],
  [/\b(surf\w*|water sports?|beach\w*|plage|sunset|coucher)\b/i, 'beachClubGirl'],
  [/\b(hik\w*|trek\w*|nature|waterfalls?)\b/i, 'hikeDesert'],
  [/\b(travel\w*|trips?|voyage\w*|explor\w*)\b/i, 'girlTrip'],
  [/\b(coffee|café|cafes?|matcha|drinks?)\b/i, 'drinksGirl'],
  [/\b(desert|camels?|dunes?)\b/i, 'desertGirl'],
  [/\b(night out|rooftop|soirée|sorties?|party|nights?)\b/i, 'nightDinner'],
  [/\b(brunch\w*)\b/i, 'brunchGirl'],
  [/\b(dinner\w*|dîner|food\w*|eat\w*|restaurants?)\b/i, 'restaurantGirl'],
  [/\b(entrepreneurs?|founders?|business|career|work\w*|cowork\w*|network\w*)\b/i, 'networkingGirl'],
  [/\b(books?|book club|reading|lecture)\b/i, 'readingGirl'],
  [/\b(mosques?)\b/i, 'mosqueGirl'],
  [/\b(art|culture)\b/i, 'souk'],
  [/\b(shopping|fashion|mode)\b/i, 'mall'],
  [/\b(moving|new in|relocat\w*|expats?|arriv\w*)\b/i, 'emirates'],
];

export function girlCommunityPhoto(text: string, fallback: PhotoKey = 'girlsOut'): PhotoKey {
  for (const [re, key] of COMMUNITY_RULES) if (re.test(text)) return key;
  return fallback;
}
