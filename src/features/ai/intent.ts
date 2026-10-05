/**
 * IRLY command engine, step 1 and 2: intent detection and entity
 * extraction. Pure and deterministic (no network, no model), so the same
 * sentence always gives the same command, works offline, and is tested
 * (scripts/check-intent.mts). Typed text and voice go through the same path.
 *
 *   "Create a padel session tomorrow at 7 PM in JLT"
 *   → { intent: CREATE_ACTIVITY, activity: padel, day: tomorrow, time: 19:00, area: jlt }
 *
 * English and French.
 */

export type Intent =
  | 'SEARCH'
  | 'FIND_SOMETHING_TO_DO'
  | 'CREATE_ACTIVITY'
  | 'CREATE_EVENT'
  | 'CREATE_COMMUNITY'
  | 'JOIN_ACTIVITY'
  | 'FIND_PEOPLE'
  | 'FIND_MATCH'
  | 'FIND_PLACE'
  | 'CHANGE_DESTINATION'
  | 'OPEN_CALENDAR'
  | 'OPEN_SAVED'
  | 'OPEN_VISA'
  | 'WHERE_TO_LIVE'
  | 'OPEN_MOMS'
  | 'FIND_RESTAURANT';

export type Day = 'today' | 'tomorrow' | 'weekend' | 'next_week' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

export type Entities = {
  activity?: string;
  category?: string;
  day?: Day;
  time?: string;
  dayPart?: DayPart;
  areaId?: string;
  cityId?: string;
  budget?: number;
  placeKind?: string;
  spots?: number;
  query: string;
};

export type Command = { intent: Intent; entities: Entities; confidence: number; input: string };

export type GeoIndex = { areas: { id: string; name: string; cityId: string }[]; cities: { id: string; name: string }[] };

/** Activity words → catalog activity id and category. */
const ACTIVITIES: [RegExp, string, string][] = [
  [/\bpadel\b/, 'padel', 'sport'],
  [/\b(football|soccer|foot|5[- ]a[- ]side)\b/, 'football', 'sport'],
  [/\btennis\b/, 'tennis', 'sport'],
  [/\b(basket|basketball)\b/, 'basketball', 'sport'],
  [/\b(volley|volleyball|beach volley)\b/, 'volleyball', 'sport'],
  [/\b(run|runs|runners?|running|jog|jogging|course à pied|coureurs?|courir|footing)\b/, 'running', 'sport'],
  [/\b(gym|workout|muscu|fitness|crossfit)\b/, 'gym', 'sport'],
  [/\b(yoga|pilates|meditation|méditation)\b/, 'yoga', 'wellness'],
  [/\b(cycling|bike|vélo|velo)\b/, 'cycling', 'sport'],
  [/\b(surf|surfing|kitesurf|kite|paddle ?board|sup|kayak|snorkel(ing)?|diving|plongée|jet ?ski|wakeboard)\b/, 'water', 'outdoor'],
  [/\b(yacht|boat|bateau)\b/, 'yacht', 'outdoor'],
  [/\b(hike|hiking|randonnée|rando|camping|glamping|desert|désert|dune)\b/, 'hiking', 'outdoor'],
  [/\b(brunch)\b/, 'brunch', 'food'],
  [/\b(dinner|dîner|diner|restaurant|resto|lunch|déjeuner)\b/, 'dinner', 'food'],
  [/\b(coffee|café|cafe)\b/, 'coffee', 'food'],
  [/\b(beach ?club)\b/, 'beachclub', 'nightlife'],
  [/\b(beach|plage)\b/, 'beach', 'outdoor'],
  [/\b(party|soirée|club|clubbing|rooftop|bar|drinks|apéro|apero)\b/, 'nightlife', 'nightlife'],
  [/\b(shopping|mall|boutique|sneakers|vintage)\b/, 'shopping', 'shopping'],
  [/\b(networking|founders|business|entrepreneurs?)\b/, 'networking', 'networking'],
  [/\b(dog|chien|dog walk)\b/, 'dogwalk', 'animals'],
  [/\b(museum|musée|gallery|galerie|art|expo)\b/, 'culture', 'culture'],
  [/\b(spa|massage|wellness|bien-être)\b/, 'spa', 'wellness'],
  [/\b(cinema|cinéma|movie|film|concert|comedy)\b/, 'entertainment', 'entertainment'],
  [/\b(paint|painting|pottery|poterie|photo walk|workshop|atelier)\b/, 'creative', 'creative'],
];

const PLACE_KINDS: [RegExp, string][] = [
  [/\bbeach ?clubs?\b/, 'beach_club'],
  [/\b(malls?|centre commercial)\b/, 'mall'],
  [/\b(beach|beaches|plages?)\b/, 'beach'],
  [/\b(restaurants?|restos?)\b/, 'restaurant'],
  [/\b(cafés?|cafes?|coffee shops?)\b/, 'cafe'],
  [/\b(markets?|marchés?)\b/, 'market'],
];

const WEEKDAYS: [RegExp, Day][] = [
  [/\b(monday|lundi)\b/, 'mon'],
  [/\b(tuesday|mardi)\b/, 'tue'],
  [/\b(wednesday|mercredi)\b/, 'wed'],
  [/\b(thursday|jeudi)\b/, 'thu'],
  [/\b(friday|vendredi)\b/, 'fri'],
  [/\b(saturday|samedi)\b/, 'sat'],
  [/\b(sunday|dimanche)\b/, 'sun'],
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Strip accents for area/city matching ("Abou Dhabi" ~ "abu dhabi" stays explicit below). */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const CITY_ALIASES: Record<string, string> = { 'abou dhabi': 'abudhabi', 'abu dhabi': 'abudhabi', rak: 'rak', 'ras al khaimah': 'rak', uaq: 'uaq', 'umm al quwain': 'uaq', charjah: 'sharjah', dubaï: 'dubai' };

export function parseCommand(input: string, geo: GeoIndex): Command {
  const text = norm(input);
  const t = plain(text);
  const e: Entities = { query: '' };

  // Activity and category.
  for (const [re, id, cat] of ACTIVITIES) {
    if (re.test(text)) {
      e.activity = id;
      e.category = cat;
      break;
    }
  }
  for (const [re, kind] of PLACE_KINDS) {
    if (re.test(text)) {
      e.placeKind = kind;
      break;
    }
  }

  // Day.
  if (/\b(tonight|ce soir|today|aujourd hui|now|maintenant|right now)\b/.test(text)) e.day = 'today';
  else if (/\b(tomorrow|demain)\b/.test(text)) e.day = 'tomorrow';
  else if (/\b(this weekend|weekend|ce week-?end)\b/.test(text)) e.day = 'weekend';
  else if (/\b(next week|la semaine prochaine)\b/.test(text)) e.day = 'next_week';
  else for (const [re, d] of WEEKDAYS) if (re.test(text)) e.day = d;

  // Time: "7 pm", "7pm", "19:30", "19h", "à 20h30", "8 PM".
  const ampm = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  const h24 = text.match(/\b(\d{1,2})(?::|h)(\d{2})?\b/);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (ampm[3] === 'pm') h += 12;
    e.time = `${String(h).padStart(2, '0')}:${ampm[2] ?? '00'}`;
  } else if (h24 && Number(h24[1]) < 24 && (text.includes(':') || /\d{1,2}h/.test(text))) {
    e.time = `${String(Number(h24[1])).padStart(2, '0')}:${h24[2] ?? '00'}`;
  }
  if (/\b(tonight|ce soir|evening|soir|soirée)\b/.test(text)) e.dayPart = 'evening';
  else if (/\b(morning|matin)\b/.test(text)) e.dayPart = 'morning';
  else if (/\b(afternoon|après-midi|apres-midi|aprem)\b/.test(text)) e.dayPart = 'afternoon';
  else if (/\b(night|nuit)\b/.test(text)) e.dayPart = 'night';
  if (!e.time && e.dayPart) e.time = { morning: '09:00', afternoon: '15:00', evening: '19:00', night: '22:00' }[e.dayPart];

  // City, then area (longest name first so "Dubai Marina" beats "Dubai").
  for (const [alias, id] of Object.entries(CITY_ALIASES)) if (t.includes(plain(alias))) e.cityId = id;
  if (!e.cityId) for (const c of geo.cities) if (new RegExp(`\\b${plain(c.name.toLowerCase())}\\b`).test(t)) e.cityId = c.id;
  const areas = [...geo.areas].sort((a, b) => b.name.length - a.name.length);
  for (const a of areas) {
    const names = [plain(a.name.toLowerCase()), a.id];
    if (names.some((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t))) {
      if (e.cityId && a.cityId !== e.cityId && !t.includes(plain(a.name.toLowerCase()))) continue;
      e.areaId = a.id;
      e.cityId = e.cityId ?? a.cityId;
      break;
    }
  }

  // Budget: "100 dirhams", "under 100 aed", "moins de 150".
  const budget = text.match(/(?:under|less than|max|moins de|pour|for)?\s*(\d{2,5})\s*(?:aed|dhs?|dirhams?|€|eur|euros?|\$|usd)/);
  if (budget) e.budget = Number(budget[1]);
  const spots = text.match(/\b(?:for|pour)\s+(\d{1,2})\s+(?:people|players|persons|personnes|joueurs)\b/);
  if (spots) e.spots = Number(spots[1]);

  // Intent.
  const create = /\b(create|créer|crée|cree|creer|organi[sz]e|organiser|host|set up|plan|planifie|start|lance|make|new)\b/.test(text);
  const event = /\b(event|événement|evenement|party|soirée|tournament|tournoi|workshop|concert)\b/.test(text);
  let intent: Intent;
  let confidence = 0.6;
  if (/\b(calendar|calendrier|agenda|my plans|mes plans)\b/.test(text)) intent = 'OPEN_CALENDAR';
  else if (/\b(saved|sauvegard|enregistr|favoris)\b/.test(text)) intent = 'OPEN_SAVED';
  else if (/\b(visa|visas|kitas|e-?voa|voa|immigration|overstay)\b/.test(text)) intent = 'OPEN_VISA';
  else if (/(where (should|to|can) i live|which area|quel quartier|où (vivre|habiter|m installer|s installer)|move to bali|m installer à bali)/.test(text)) intent = 'WHERE_TO_LIVE';
  else if (/\b(moms?|mums?|mamans?|playdates?|with (my )?kids|avec (mes |les )?enfants)\b/.test(text) && !create) intent = 'OPEN_MOMS';
  else if (!create && (e.placeKind === 'restaurant' || e.placeKind === 'cafe' || /\b(where to eat|où manger|eat|manger)\b/.test(text))) intent = 'FIND_RESTAURANT';
  else if (/\b(switch to|go to|change (?:city|destination) to|passe à|va à|change pour)\b/.test(text) && e.cityId) intent = 'CHANGE_DESTINATION';
  else if (create && /\b(community|communauté|communaute|group|groupe|club)\b/.test(text) && !/\bbeach ?club\b/.test(text)) intent = 'CREATE_COMMUNITY';
  else if (create && event) intent = 'CREATE_EVENT';
  else if (create) intent = 'CREATE_ACTIVITY';
  else if (/\b(join|rejoindre|rejoins|participer|i m in)\b/.test(text)) intent = 'JOIN_ACTIVITY';
  else if (/\b(girls?|filles?|women|femmes|copines?)\b/.test(text) && /\b(find|meet|trouve|rencontrer|who|qui)\b/.test(text)) intent = 'FIND_MATCH';
  else if (/\b(people|friends?|amis?|someone|quelqu un|partner|partenaire|buddy)\b/.test(text)) intent = 'FIND_PEOPLE';
  else if (/\b(what can i do|something to do|quoi faire|que faire|bored|ennuie|plans? for)\b/.test(text)) intent = 'FIND_SOMETHING_TO_DO';
  else if (e.placeKind && !e.activity) intent = 'FIND_PLACE';
  else if (e.placeKind === 'beach_club') intent = 'FIND_PLACE';
  else intent = 'SEARCH';
  if (intent !== 'SEARCH') confidence = 0.85;
  if (intent === 'SEARCH' && (e.activity || e.areaId)) confidence = 0.75;

  e.query = e.activity ?? e.placeKind?.replace('_', ' ') ?? stripFiller(text);
  return { intent, entities: e, confidence, input: input.trim() };
}

function stripFiller(text: string): string {
  return text
    .replace(/\b(find me|find|search|show me|show|look for|i want to|i d like to|can you|please|trouve-moi|trouve|cherche|montre-moi|je veux|a|an|the|un|une|des|le|la|les|some|in|at|à|dans|for|pour)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/** "tomorrow" → the CreateHost day vocabulary ('Today' | 'Tomorrow' | 'This weekend' | 'Next week'). */
export function planDay(d?: Day): string {
  if (!d || d === 'today') return 'Today';
  if (d === 'tomorrow') return 'Tomorrow';
  if (d === 'next_week') return 'Next week';
  return 'This weekend';
}

/** Concrete date for a parsed day (weekday → next occurrence). */
export function dateFor(d: Day | undefined, time: string | undefined, now = new Date()): Date {
  const out = new Date(now);
  out.setSeconds(0, 0);
  const idx: Partial<Record<Day, number>> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  if (d === 'tomorrow') out.setDate(out.getDate() + 1);
  else if (d === 'next_week') out.setDate(out.getDate() + 7);
  else if (d === 'weekend') out.setDate(out.getDate() + ((6 - out.getDay() + 7) % 7));
  else if (d && idx[d] !== undefined) out.setDate(out.getDate() + (((idx[d] as number) - out.getDay() + 7) % 7 || 7));
  const [h, m] = (time ?? '19:00').split(':').map(Number);
  out.setHours(h, m);
  if (out.getTime() < now.getTime()) out.setDate(out.getDate() + 1);
  return out;
}

export const INTENT_LABEL: Record<Intent, string> = {
  SEARCH: 'Search',
  FIND_SOMETHING_TO_DO: 'Find something to do',
  CREATE_ACTIVITY: 'Create an activity',
  CREATE_EVENT: 'Create an event',
  CREATE_COMMUNITY: 'Create a community',
  JOIN_ACTIVITY: 'Join an activity',
  FIND_PEOPLE: 'Find people',
  FIND_MATCH: 'IRLY Girl match',
  FIND_PLACE: 'Find a place',
  CHANGE_DESTINATION: 'Change destination',
  OPEN_CALENDAR: 'Open your calendar',
  OPEN_SAVED: 'Open saved',
  OPEN_VISA: 'Visa & stay',
  WHERE_TO_LIVE: 'Where should I live?',
  OPEN_MOMS: 'IRLY Moms',
  FIND_RESTAURANT: 'Where to eat',
};
