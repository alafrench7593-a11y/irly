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
  // Category only (no catalog activity): kids, trips, classes, games.
  [/\b(kids?|children|enfants?|playdates?|family|famille|baby|babies|bebe|moms?|mamans?)\b/, '', 'family'],
  [/\b(trip|road ?trip|voyage|getaway|weekend away)\b/, '', 'travel'],
  [/\b(class|lesson|language|langue|cours|study|book club|club de lecture|reading)\b/, '', 'learning'],
  [/\b(karaoke|bowling|arcade|board games?|jeux|escape room|quiz)\b/, '', 'entertainment'],
  [/\b(eat|food|pizza|sushi|burger|bbq|picnic|pique-nique)\b/, '', 'food'],
];

/**
 * The category (and catalog activity) a free text belongs to: "Padel at
 * JLT" → sport/padel, "Playdate at the park" → family. Used when a session
 * is created without an explicit category (IRL « anyone want to join? »,
 * the assistant, community plans).
 */
export function guessCategory(input: string): { category?: string; activity?: string } {
  const t = plain(norm(input));
  // The subject usually comes first: « Coffee at Kite Beach » is coffee, « Book club » is not a club night.
  let best: { at: number; category: string; activity?: string } | null = null;
  for (const [re, id, cat] of ACTIVITIES) {
    const m = new RegExp(plain(re.source), re.flags).exec(t);
    if (m && (!best || m.index < best.at)) best = { at: m.index, category: cat, activity: id || undefined };
  }
  return best ? { category: best.category, activity: best.activity } : {};
}

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

const CITY_ALIASES: Record<string, string> = { bali: 'bali', 'abou dhabi': 'abudhabi', 'abu dhabi': 'abudhabi', rak: 'rak', 'ras al khaimah': 'rak', uaq: 'uaq', 'umm al quwain': 'uaq', charjah: 'sharjah', dubaï: 'dubai' };

export function parseCommand(input: string, geo: GeoIndex): Command {
  const text = norm(input);
  const t = plain(text);
  const e: Entities = { query: '' };
  // Patterns run accent-free on accent-free text: JS \b treats "é" as a
  // non-word character, so "créer", "événement" or "café" never matched.
  const has = (re: RegExp) => new RegExp(plain(re.source), re.flags).test(t);

  // Activity and category.
  for (const [re, id, cat] of ACTIVITIES) {
    if (has(re)) {
      if (id) e.activity = id;
      e.category = cat;
      break;
    }
  }
  for (const [re, kind] of PLACE_KINDS) {
    if (has(re)) {
      e.placeKind = kind;
      break;
    }
  }

  // Day.
  if (has(/\b(tonight|ce soir|today|aujourd hui|now|maintenant|right now)\b/)) e.day = 'today';
  else if (has(/\b(tomorrow|demain)\b/)) e.day = 'tomorrow';
  else if (has(/\b(this weekend|weekend|ce week-?end)\b/)) e.day = 'weekend';
  else if (has(/\b(next week|la semaine prochaine)\b/)) e.day = 'next_week';
  else for (const [re, d] of WEEKDAYS) if (has(re)) e.day = d;

  // Time: "7 pm", "7pm", "7.30pm", "19:30", "11.30", "19h", "à 20h30", "8 PM".
  const ampm = text.match(/\b(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm)\b/);
  // "11.30" counts only after "at/à/vers" and never before a currency ("5.50 aed", "on 10.12" are not times).
  const h24 =
    text.match(/\b(\d{1,2})(?::(\d{2})|h(\d{2})?)(?![\d.])/) ??
    text.match(/(?:\bat|à|\bvers|@)\s*(\d{1,2})\.(\d{2})\b(?!\s*(?:aed|dhs?|dirhams?|€|eur|euros?|\$|usd))/);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (ampm[3] === 'pm') h += 12;
    e.time = `${String(h).padStart(2, '0')}:${ampm[2] ?? '00'}`;
  } else if (h24 && Number(h24[1]) < 24 && Number(h24[2] ?? h24[3] ?? 0) < 60) {
    e.time = `${String(Number(h24[1])).padStart(2, '0')}:${h24[2] ?? h24[3] ?? '00'}`;
  }
  if (has(/\b(tonight|ce soir|evening|soir|soirée)\b/)) e.dayPart = 'evening';
  else if (has(/\b(morning|matin)\b/)) e.dayPart = 'morning';
  else if (has(/\b(afternoon|après-midi|apres-midi|aprem)\b/)) e.dayPart = 'afternoon';
  else if (has(/\b(night|nuit)\b/)) e.dayPart = 'night';
  // "Dinner at 8:30" is 20:30: a morning hour in an evening context is pm.
  if (e.time && !ampm) {
    const h = Number(e.time.slice(0, 2));
    // Only 5–11 shifts ("dinner at 8:30" → 20:30); "party at 1:30" stays 01:30.
    const evening = e.dayPart === 'evening' || e.dayPart === 'night' || e.activity === 'dinner' || e.activity === 'nightlife';
    if (h >= 5 && h <= 11 && evening) e.time = `${h + 12}:${e.time.slice(3)}`;
  }
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
  const explicitTime = Boolean(ampm || h24);
  const create =
    // Bare "plan/start/host/make" creates only with something to create ("plan padel tomorrow 7pm"),
    // not "I need a plan for tonight".
    // Only as a command at the start, never in a question ("what time does padel start?").
    (Boolean(e.activity || explicitTime) &&
      !has(/^\s*(what|when|who|where|how|why|is|are|does|do|quand|qui|ou|est ce|qu est ce)\b/) &&
      has(/^\s*(?:(?:hey|hi|hello|please|can you|could you|irly|salut|stp)[ ,]+)*(?:let s\s+|on\s+)?(plan|planifier|start|host|make)\b/)) ||
    has(/\b(create|créer|crée|cree|creer|organi[sz]e|organiser|host|set up|plan (?:a|an|un|une|my|some)|planifie|start (?:a|an|un|une)|lance|make (?:a|an|un|une))\b/);
  const event = has(/\b(event|événement|evenement|party|soirée|tournament|tournoi|workshop|concert)\b/);
  let intent: Intent;
  let confidence = 0.6;
  const notElsewhere = !e.cityId || e.cityId === 'bali';
  if (has(/\b(calendar|calendrier|agenda|my plans|mes plans)\b/)) intent = 'OPEN_CALENDAR';
  else if (has(/\b(saved|sauvegard|enregistr|favoris)\b/)) intent = 'OPEN_SAVED';
  // The visa guide and the quiz are Bali's: not for "visa run from Dubai".
  else if (notElsewhere && has(/\b(visa|visas|kitas|e-?voa|voa|immigration|overstay)\b/)) intent = 'OPEN_VISA';
  else if (notElsewhere && has(/(where (should|to|can) i live|which (area|neighbou?rhood) (should|to|do|for) (i )?(live|stay|move|rent)|which area to (live|stay|move)|quel quartier (pour )?(vivre|habiter|m installer|loger)|où (vivre|habiter|m installer|s installer)|move to bali|moving to bali|m installer à bali)/)) intent = 'WHERE_TO_LIVE';
  else if (has(/\b(moms?|mums?|mamans?|playdates?|with (my )?kids|avec (mes |les )?enfants)\b/) && !create) intent = 'OPEN_MOMS';
  else if (!create && (e.placeKind === 'restaurant' || e.placeKind === 'cafe' || has(/\b(where to eat|où manger|eat|manger)\b/))) intent = 'FIND_RESTAURANT';
  // "I'm in Bali", "je suis à Dubaï", "j'habite à Sharjah": say where you are, the app follows.
  else if (
    e.cityId &&
    has(/\b(switch to|go to|change (?:city|destination) to|passe a|passe à|va a|va à|change pour|i m (?:now )?in|i am (?:now )?in|i m (?:living|staying) in|i live in|i moved to|moved to|just landed in|je suis (?:a|à|en|au|aux|sur)|je vis (?:a|à|en)|j habite (?:a|à|en)|j ai demenage (?:a|à|en)|je viens d arriver (?:a|à|en)|je pars (?:a|à|en)|maintenant (?:a|à|en))\b/)
  )
    intent = 'CHANGE_DESTINATION';
  else if (create && has(/\b(community|communauté|communaute|group|groupe|club)\b/) && !has(/\bbeach ?club\b/)) intent = 'CREATE_COMMUNITY';
  else if (create && event) intent = 'CREATE_EVENT';
  else if (create) intent = 'CREATE_ACTIVITY';
  else if (has(/\b(join|rejoindre|rejoins|participer|i m in)\b/)) intent = 'JOIN_ACTIVITY';
  else if (has(/\b(girls?|filles?|women|femmes|copines?)\b/) && has(/\b(find|meet|trouve|rencontrer|who|qui)\b/)) intent = 'FIND_MATCH';
  else if (has(/\b(people|friends?|amis?|someone|quelqu un|partner|partenaire|buddy)\b/)) intent = 'FIND_PEOPLE';
  else if (has(/\b(what can i do|something to do|quoi faire|que faire|bored|ennuie|plans? for)\b/)) intent = 'FIND_SOMETHING_TO_DO';
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

const WEEKDAY: Partial<Record<Day, number>> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const WEEKDAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "tomorrow" → the CreateHost day vocabulary ('Today' | 'Tomorrow' | 'This weekend' | 'Next week'), or the weekday's name. */
export function planDay(d?: Day): string {
  if (!d || d === 'today') return 'Today';
  if (d === 'tomorrow') return 'Tomorrow';
  if (d === 'next_week') return 'Next week';
  if (d === 'weekend') return 'This weekend';
  return WEEKDAY_NAME[WEEKDAY[d] as number];
}

/** The reverse of planDay: 'This weekend' → 'weekend', 'Monday' → 'mon'. */
export function dayOf(label: string): Day {
  const l = label.toLowerCase();
  if (l === 'tomorrow') return 'tomorrow';
  if (l === 'this weekend') return 'weekend';
  if (l === 'next week') return 'next_week';
  const i = WEEKDAY_NAME.findIndex((n) => n.toLowerCase() === l);
  return i >= 0 ? ((Object.keys(WEEKDAY) as Day[]).find((k) => WEEKDAY[k] === i) as Day) : 'today';
}

const HOUR = 3600 * 1000;

/**
 * Concrete instant for a parsed day and "HH:MM", read as the CITY's wall
 * clock (utcOffset in hours; UAE +4, Bali +8, no DST). A member planning
 * Bali from Paris gets 19:00 in Bali, not 19:00 in Paris.
 * Weekday → its next occurrence (today if the time is still ahead);
 * weekend → Saturday, or Sunday once Saturday's time has passed.
 */
export function dateFor(d: Day | undefined, time: string | undefined, now = new Date(), utcOffset = -now.getTimezoneOffset() / 60): Date {
  const local = new Date(now.getTime() + utcOffset * HOUR); // UTC fields = city wall clock
  const [hh, mm] = (time ?? '19:00').split(':').map(Number);
  const h = Number.isFinite(hh) ? hh : 19;
  const m = Number.isFinite(mm) ? mm : 0;
  const at = (days: number) => {
    const x = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days, h, m));
    return new Date(x.getTime() - utcOffset * HOUR);
  };
  const dow = local.getUTCDay();
  let out: Date;
  if (d === 'tomorrow') out = at(1);
  else if (d === 'next_week') out = at(7);
  else if (d === 'weekend') {
    out = at(dow === 0 ? 0 : 6 - dow);
    if (out.getTime() < now.getTime()) out = at(dow === 6 ? 1 : 6); // Saturday passed → Sunday; Sunday passed → next Saturday
  } else if (d && WEEKDAY[d] !== undefined) {
    out = at(((WEEKDAY[d] as number) - dow + 7) % 7);
    if (out.getTime() < now.getTime()) out = at((((WEEKDAY[d] as number) - dow + 7) % 7) + 7);
  } else {
    out = at(0);
    if (out.getTime() < now.getTime()) out = at(1);
  }
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
