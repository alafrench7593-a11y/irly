/**
 * Bali: "Where should I live?", "Test Bali before you move" and opening
 * hours. Pure functions over the area profiles stored on the server
 * (area_profiles.traits, editorial 0–5 ratings), tested in
 * scripts/check-bali.mts. No prices and no invented facts: the score only
 * compares what the member asked for with the IRLY Guide ratings, and says why.
 */

export type Trait = 'beach' | 'surf' | 'nightlife' | 'coworking' | 'wellness' | 'family' | 'nature' | 'social' | 'quiet' | 'restaurants' | 'traffic' | 'airport';
export type Traits = Partial<Record<Trait, number>>;
export type AreaProfile = { areaId: string; name: string; tagline: string; vibe: string; bestFor: string[]; notIdealFor: string[]; traits: Traits; pros: string[]; cons: string[] };

export type Answer = 'yes' | 'some' | 'no';
export type QuizAnswers = Partial<{
  beach: Answer;
  surf: Answer;
  nightlife: Answer;
  remote: Answer;
  kids: Answer;
  social: Answer;
  nature: Answer;
  wellness: Answer;
  coworking: Answer;
  restaurants: Answer;
  /** How much traffic can you tolerate? yes = a lot. */
  traffic: Answer;
  stay: 'short' | 'long';
  pace: 'quiet' | 'social';
}>;

export type QuizQuestion = { id: keyof QuizAnswers; label: string; options: { value: string; label: string }[] };

const YN = [
  { value: 'yes', label: 'Yes' },
  { value: 'some', label: 'A bit' },
  { value: 'no', label: 'No' },
];

export const QUIZ: QuizQuestion[] = [
  { id: 'beach', label: 'Do you want to live near the beach?', options: YN },
  { id: 'surf', label: 'Do you surf?', options: YN },
  { id: 'nightlife', label: 'Do you want nightlife?', options: YN },
  { id: 'remote', label: 'Do you work remotely?', options: YN },
  { id: 'kids', label: 'Are you moving with children?', options: YN },
  { id: 'social', label: 'Do you want a strong social scene?', options: YN },
  { id: 'nature', label: 'Do you prefer nature?', options: YN },
  { id: 'wellness', label: 'Is wellness important to you?', options: YN },
  { id: 'coworking', label: 'Do you need coworking spaces?', options: YN },
  { id: 'restaurants', label: 'Do you want lots of restaurants nearby?', options: YN },
  { id: 'traffic', label: 'Can you tolerate traffic?', options: [{ value: 'yes', label: 'No problem' }, { value: 'some', label: 'Some' }, { value: 'no', label: 'Not at all' }] },
  { id: 'stay', label: 'Short stay or long stay?', options: [{ value: 'short', label: 'Short stay' }, { value: 'long', label: 'Long stay' }] },
  { id: 'pace', label: 'Quiet or social?', options: [{ value: 'quiet', label: 'Quiet' }, { value: 'social', label: 'Social' }] },
];

const W: Record<Answer, number> = { yes: 1, some: 0.5, no: 0 };

type Want = { trait: Trait; weight: number; label: string; invert?: boolean };

/** What each answer asks of an area. "No" to nightlife favours calm areas. */
function wants(a: QuizAnswers): Want[] {
  const out: Want[] = [];
  const add = (ans: Answer | undefined, trait: Trait, label: string, opposite?: { trait: Trait; label: string }) => {
    if (!ans) return;
    if (ans === 'no' && opposite) out.push({ trait: opposite.trait, weight: 0.6, label: opposite.label });
    else if (W[ans] > 0) out.push({ trait, weight: W[ans], label });
  };
  add(a.beach, 'beach', 'beach access');
  add(a.surf, 'surf', 'surf');
  add(a.nightlife, 'nightlife', 'nightlife', { trait: 'quiet', label: 'quiet evenings' });
  add(a.remote, 'coworking', 'remote work');
  add(a.coworking, 'coworking', 'coworking');
  add(a.kids, 'family', 'families');
  add(a.social, 'social', 'social scene', { trait: 'quiet', label: 'calm' });
  add(a.nature, 'nature', 'nature');
  add(a.wellness, 'wellness', 'wellness');
  add(a.restaurants, 'restaurants', 'restaurants');
  if (a.traffic === 'no') out.push({ trait: 'traffic', weight: 1.2, label: 'little traffic', invert: true });
  else if (a.traffic === 'some') out.push({ trait: 'traffic', weight: 0.5, label: 'manageable traffic', invert: true });
  if (a.pace === 'quiet') out.push({ trait: 'quiet', weight: 1, label: 'a quiet pace' });
  if (a.pace === 'social') out.push({ trait: 'social', weight: 1, label: 'a social pace' });
  if (a.stay === 'short') out.push({ trait: 'airport', weight: 0.4, label: 'airport access' });
  return out;
}

export type AreaFit = { area: AreaProfile; score: number; why: string[]; watch: string[] };

/** Score 0–100 per area, with the strongest reasons for and against. */
export function rankAreas(areas: AreaProfile[], answers: QuizAnswers): AreaFit[] {
  const ws = wants(answers);
  if (!ws.length) return areas.map((area) => ({ area, score: 50, why: [], watch: [] }));
  const total = ws.reduce((n, w) => n + w.weight, 0);
  return areas
    .map((area) => {
      let got = 0;
      const parts: { label: string; v: number; weight: number }[] = [];
      for (const w of ws) {
        const raw = area.traits[w.trait] ?? 0;
        const v = (w.invert ? 5 - raw : raw) / 5;
        got += v * w.weight;
        parts.push({ label: w.label, v, weight: w.weight });
      }
      const score = Math.round((got / total) * 100);
      const why = parts
        .filter((p) => p.v >= 0.7)
        .sort((x, y) => y.v * y.weight - x.v * x.weight)
        .slice(0, 3)
        .map((p) => `Strong for ${p.label}`);
      const watch = parts
        .filter((p) => p.v <= 0.3 && p.weight >= 0.5)
        .slice(0, 2)
        .map((p) => `Weaker for ${p.label}`);
      return { area, score, why, watch };
    })
    .sort((a, b) => b.score - a.score || a.area.name.localeCompare(b.area.name));
}

/* ───────── Test Bali before you move ───────── */

export type PlanLength = 7 | 14 | 30 | 60;
export type PlanTheme = 'arrive' | 'explore' | 'cowork' | 'community' | 'wellness' | 'food' | 'family' | 'housing' | 'healthcare' | 'social' | 'nature' | 'decide';
export type PlanDay = { day: number; areaId: string; theme: PlanTheme; title: string; search: string };

const THEME_TITLE: Record<PlanTheme, string> = {
  arrive: 'Arrive, settle in, get a SIM and take a first walk',
  explore: 'Explore the area on foot',
  cowork: 'Work a full day from a coworking space',
  community: 'Join a community meetup',
  wellness: 'Yoga or wellness morning',
  food: 'Try the local food scene',
  family: 'Family day: beach, park or kids activity',
  housing: 'Visit places to live',
  healthcare: 'Find the nearest clinic, hospital and pharmacy',
  social: 'Evening event with IRLY members',
  nature: 'Nature trip',
  decide: 'Review: would you live here?',
};
const THEME_SEARCH: Record<PlanTheme, string> = {
  arrive: 'cafe', explore: 'walk', cowork: 'coworking', community: 'community', wellness: 'yoga', food: 'restaurant',
  family: 'kids', housing: 'villa', healthcare: 'clinic', social: 'event', nature: 'hiking', decide: 'coffee',
};

/**
 * Days are shared between the top areas (more days for the best fit), and
 * each area gets a rhythm: explore, work, meet people, practicalities, then
 * a decision day. Every day links to real IRLY search results.
 */
export function buildTestPlan(top: AreaFit[], length: PlanLength, answers: QuizAnswers): PlanDay[] {
  const areas = top.slice(0, length <= 7 ? 2 : 3);
  if (!areas.length) return [];
  const weights = areas.map((a, i) => Math.max(1, a.score) * (i === 0 ? 1.3 : 1));
  const sum = weights.reduce((n, w) => n + w, 0);
  const days = weights.map((w) => Math.max(2, Math.round((w / sum) * length)));
  // Fix rounding so the plan has exactly `length` days.
  let diff = length - days.reduce((n, d) => n + d, 0);
  for (let i = 0; diff !== 0; i = (i + 1) % days.length) {
    if (diff > 0) {
      days[i]++;
      diff--;
    } else if (days[i] > 2) {
      days[i]--;
      diff++;
    }
  }
  // What the member cares about comes first, then the shared rhythm.
  const personal: PlanTheme[] = [];
  if (answers.kids && answers.kids !== 'no') personal.push('family');
  if (answers.wellness && answers.wellness !== 'no') personal.push('wellness');
  if (answers.nature && answers.nature !== 'no') personal.push('nature');
  const rhythm: PlanTheme[] = ['explore', ...personal, answers.remote === 'no' ? 'food' : 'cowork', 'community', 'food', 'social'];
  const practical: PlanTheme[] = length >= 14 ? ['housing', 'healthcare'] : ['housing'];

  const out: PlanDay[] = [];
  let day = 1;
  areas.forEach((fit, ai) => {
    const n = days[ai];
    const themes: PlanTheme[] = [];
    if (ai === 0) themes.push('arrive');
    for (let i = 0; themes.length < n - practical.length - 1; i++) themes.push(rhythm[i % rhythm.length]);
    themes.push(...practical, 'decide');
    themes.slice(0, n).forEach((theme) => {
      out.push({ day: day++, areaId: fit.area.areaId, theme, title: `${fit.area.name}: ${THEME_TITLE[theme]}`, search: THEME_SEARCH[theme] });
    });
  });
  return out.slice(0, length);
}

/* ───────── Opening hours (Google "regularOpeningHours") ───────── */

type Point = { day: number; hour: number; minute?: number };
export type OpeningHours = { periods?: { open: Point; close?: Point }[] } | null | undefined;

/** Open right now in the place's own time zone (utcOffset in hours). */
export function isOpenNow(hours: OpeningHours, utcOffset: number, now = new Date()): boolean | null {
  const periods = hours?.periods;
  if (!periods?.length) return null;
  const local = new Date(now.getTime() + utcOffset * 3600_000);
  const minutes = local.getUTCDay() * 1440 + local.getUTCHours() * 60 + local.getUTCMinutes();
  const week = 7 * 1440;
  for (const p of periods) {
    if (!p.close) return true; // Open 24/7.
    const start = p.open.day * 1440 + p.open.hour * 60 + (p.open.minute ?? 0);
    let end = p.close.day * 1440 + p.close.hour * 60 + (p.close.minute ?? 0);
    if (end <= start) end += week;
    if ((minutes >= start && minutes < end) || (minutes + week >= start && minutes + week < end)) return true;
  }
  return false;
}
