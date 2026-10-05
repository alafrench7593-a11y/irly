// The assistant's command engine on the sentences from the IRLY brief.
import { dateFor, parseCommand, type GeoIndex } from '../src/features/ai/intent.ts';

const geo: GeoIndex = {
  cities: [
    { id: 'dubai', name: 'Dubai' },
    { id: 'abudhabi', name: 'Abu Dhabi' },
    { id: 'sharjah', name: 'Sharjah' },
  ],
  areas: [
    { id: 'marina', name: 'Dubai Marina', cityId: 'dubai' },
    { id: 'jlt', name: 'JLT', cityId: 'dubai' },
    { id: 'jvc', name: 'JVC', cityId: 'dubai' },
    { id: 'downtown', name: 'Downtown', cityId: 'dubai' },
    { id: 'yas', name: 'Yas Island', cityId: 'abudhabi' },
  ],
};

type Expect = Partial<Record<'intent' | 'activity' | 'day' | 'time' | 'areaId' | 'cityId' | 'budget' | 'placeKind' | 'dayPart', string | number>>;
const cases: [string, Expect][] = [
  ['I want to play padel tomorrow evening in Dubai Marina.', { intent: 'SEARCH', activity: 'padel', day: 'tomorrow', dayPart: 'evening', areaId: 'marina', cityId: 'dubai' }],
  ['Create a football session tomorrow at 8 PM in JVC.', { intent: 'CREATE_ACTIVITY', activity: 'football', day: 'tomorrow', time: '20:00', areaId: 'jvc' }],
  ['Find me a beach club this Saturday.', { intent: 'FIND_PLACE', placeKind: 'beach_club', day: 'sat' }],
  ['What can I do tonight for 100 dirhams?', { intent: 'FIND_SOMETHING_TO_DO', day: 'today', budget: 100, dayPart: 'evening' }],
  ['Find girls who like padel.', { intent: 'FIND_MATCH', activity: 'padel' }],
  ['Create a brunch activity.', { intent: 'CREATE_ACTIVITY', activity: 'brunch' }],
  ['Find me something to do tonight near Marina.', { intent: 'FIND_SOMETHING_TO_DO', day: 'today', areaId: 'marina' }],
  ['Create a padel session tomorrow at 7 PM in JLT.', { intent: 'CREATE_ACTIVITY', activity: 'padel', day: 'tomorrow', time: '19:00', areaId: 'jlt' }],
  ['Crée un match de foot demain à 20h à JVC', { intent: 'CREATE_ACTIVITY', activity: 'football', day: 'tomorrow', time: '20:00', areaId: 'jvc' }],
  ['Organise une soirée samedi à Downtown', { intent: 'CREATE_EVENT', day: 'sat', areaId: 'downtown' }],
  ['Switch to Abu Dhabi', { intent: 'CHANGE_DESTINATION', cityId: 'abudhabi' }],
  ['Create a community for runners', { intent: 'CREATE_COMMUNITY', activity: 'running' }],
  ['Show my calendar', { intent: 'OPEN_CALENDAR' }],
  ['Quoi faire ce soir ?', { intent: 'FIND_SOMETHING_TO_DO', day: 'today' }],
  ['malls in Dubai', { intent: 'FIND_PLACE', placeKind: 'mall', cityId: 'dubai' }],
  ['How do I extend my visa on arrival?', { intent: 'OPEN_VISA' }],
  ['Where should I live in Bali?', { intent: 'WHERE_TO_LIVE' }],
  ['Où habiter à Bali avec des enfants ?', { intent: 'WHERE_TO_LIVE' }],
  ['Find moms for a playdate', { intent: 'OPEN_MOMS' }],
  ['Restaurants in JLT', { intent: 'FIND_RESTAURANT', placeKind: 'restaurant', areaId: 'jlt' }],
  ['Où manger ce soir ?', { intent: 'FIND_RESTAURANT', day: 'today' }],
  // Regressions from the bug hunt.
  ['Any new events tonight?', { day: 'today' }],
  ['I need a plan for tonight', { intent: 'FIND_SOMETHING_TO_DO' }],
  ['which area has the best padel in Dubai?', { activity: 'padel', cityId: 'dubai' }],
  ['visa run from Dubai', { cityId: 'dubai' }],
  ['Créer un événement samedi', { intent: 'CREATE_EVENT', day: 'sat' }],
  ['Crée une communauté de padel', { intent: 'CREATE_COMMUNITY', activity: 'padel' }],
  ['un café demain', { activity: 'coffee', day: 'tomorrow' }],
  ['coffee at 7.30pm', { time: '19:30' }],
  ['Brunch at 11.30', { time: '11:30' }],
  ['Dinner at 8:30', { time: '20:30' }],
  ['padel monday 6pm', { day: 'mon', time: '18:00' }],
  ['Plan padel tomorrow at 7pm', { intent: 'CREATE_ACTIVITY', activity: 'padel', time: '19:00' }],
  ['Start padel at 6pm', { intent: 'CREATE_ACTIVITY', time: '18:00' }],
  ['make dinner plans for friday', { intent: 'CREATE_ACTIVITY', day: 'fri' }],
  ['Party tonight at 1:30', { time: '01:30' }],
  ['Padel for 5.50 aed tomorrow', { time: undefined as unknown as string }],
  ['Brunch on 10.12', { time: undefined as unknown as string }],
];
const never: [string, string][] = [
  ['Any new events tonight?', 'CREATE_ACTIVITY'],
  ['new restaurants in JLT', 'CREATE_ACTIVITY'],
  ['I m new in dubai, find friends', 'CREATE_ACTIVITY'],
  ['which area has the best padel in Dubai?', 'WHERE_TO_LIVE'],
  ['visa run from Dubai', 'OPEN_VISA'],
  ['What time does padel start?', 'CREATE_ACTIVITY'],
  ['When does the padel start at Marina?', 'CREATE_ACTIVITY'],
  ['Who can make padel at 7pm?', 'CREATE_ACTIVITY'],
  ['what is the plan for padel tonight?', 'CREATE_ACTIVITY'],
];

let failed = 0;
for (const [input, want] of cases) {
  const c = parseCommand(input, geo);
  const got: Record<string, unknown> = { intent: c.intent, ...c.entities };
  const bad = Object.entries(want).filter(([k, v]) => got[k] !== v);
  if (bad.length) {
    failed++;
    console.error(`✗ ${input}\n   expected ${JSON.stringify(want)}\n   got      ${JSON.stringify(got)}`);
  } else console.log(`✓ ${input}`);
}

for (const [input, bad] of never) {
  const c = parseCommand(input, geo);
  if (c.intent === bad) {
    failed++;
    console.error(`✗ ${input} must not be ${bad}`);
  } else console.log(`✓ ${input} is not ${bad}`);
}

// City time: 19:00 in Bali (UTC+8), asked from anywhere, is 11:00 UTC.
const utcNoon = new Date(Date.UTC(2026, 9, 5, 4, 0)); // Monday 12:00 in Bali
const bali = dateFor('tomorrow', '19:00', utcNoon, 8);
if (bali.toISOString() !== '2026-10-06T11:00:00.000Z') {
  failed++;
  console.error('✗ dateFor in Bali time', bali.toISOString());
}
// Midnight stays midnight (not 19:00).
const late = dateFor('tomorrow', '00:30', utcNoon, 8);
if (late.toISOString() !== '2026-10-05T16:30:00.000Z') {
  failed++;
  console.error('✗ dateFor 00:30', late.toISOString());
}
// On Saturday morning, "this weekend 18:00" is today, and "saturday 18:00" too.
const satMorning = new Date(Date.UTC(2026, 9, 10, 6, 0)); // Saturday 10:00 in Dubai
for (const d of ['weekend', 'sat'] as const) {
  const x = dateFor(d, '18:00', satMorning, 4);
  if (x.toISOString() !== '2026-10-10T14:00:00.000Z') {
    failed++;
    console.error(`✗ dateFor ${d} on Saturday`, x.toISOString());
  }
}

// Dates: "tomorrow 19:00" from a Monday noon is Tuesday 19:00.
const monday = new Date(2026, 9, 5, 12, 0);
const d = dateFor('tomorrow', '19:00', monday);
if (d.getDate() !== 6 || d.getHours() !== 19) {
  failed++;
  console.error('✗ dateFor tomorrow', d);
}
const sat = dateFor('sat', '10:00', monday);
if (sat.getDay() !== 6 || sat.getDate() !== 10) {
  failed++;
  console.error('✗ dateFor saturday', sat);
}

if (failed) {
  console.error(`${failed} intent check(s) failed`);
  process.exit(1);
}
console.log('intent engine ok');
