import type { PhotoKey } from '@/data/photos';

/**
 * IRLY Girl and IRLY Moms photos (public domain / CC0, see
 * public-photos/CREDITS.md): one per kind of plan or community, chosen from
 * the words in its name.
 */
const RULES: [RegExp, PhotoKey][] = [
  [/\b(moms?|mums?|mamans?|mother|playdates?|kids?|children|enfants?)\b/i, 'momPlaydate'],
  [/\b(baby|babies|bébé|stroller|poussette)\b/i, 'momBaby'],
  [/\b(family|families|famille)\b/i, 'familyBeach'],
  [/\b(yoga|pilates|wellness|breathwork|meditat\w*)\b/i, 'girlClass'],
  [/\b(spa|beauty|massage|self.?care|nails?)\b/i, 'girlSpa'],
  [/\b(fitness|gym|run\w*|padel|tennis|sports?|workout)\b/i, 'girlFitness'],
  [/\b(surf\w*)\b/i, 'girlSurf'],
  [/\b(hik\w*|trek\w*|nature|waterfalls?)\b/i, 'girlHike'],
  [/\b(travel\w*|trips?|voyage\w*|explor\w*)\b/i, 'girlTravel'],
  [/\b(brunch\w*|dinner\w*|dîner|food\w*|eat\w*)\b/i, 'girlCafe'],
  [/\b(coffee|café|cafes?|matcha)\b/i, 'girlCoffee'],
  [/\b(entrepreneurs?|founders?|business|career|work\w*|cowork\w*|network\w*)\b/i, 'girlWork'],
  [/\b(books?|book club|reading|lecture)\b/i, 'girlBookClub'],
  [/\b(shopping|fashion|mode)\b/i, 'girlShopping'],
  [/\b(beach\w*|plage|sunset|coucher)\b/i, 'girlSunset'],
  [/\b(moving|new in|relocat\w*|expats?|arriv\w*)\b/i, 'girlTravel'],
];

/** A photo for a girls' plan or community, from its name; friends by default. */
export function girlPhotoFor(text: string, fallback: PhotoKey = 'girlFriends'): PhotoKey {
  for (const [re, key] of RULES) if (re.test(text)) return key;
  return fallback;
}
