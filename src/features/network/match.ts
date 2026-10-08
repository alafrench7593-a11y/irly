import { INDUSTRY, INTENT, type IndustryId, type IntentId, type RoleId } from './taxonomy';

/** A professional profile, as the app reads it (yours or someone else's). */
export type ProProfile = {
  userId: string;
  firstName: string;
  photoPath: string | null;
  role: RoleId;
  jobTitle: string;
  company: string | null;
  industries: IndustryId[];
  skills: string[];
  project: string | null;
  lookingFor: string | null;
  canOffer: string | null;
  intents: IntentId[];
  cityId: string;
  areaId: string | null;
  lat: number | null;
  lng: number | null;
  connection: 'none' | 'requested' | 'incoming' | 'connected';
};

/** One reason two people should meet, already phrased (English, translated on display). */
export type Reason = { kind: 'industry' | 'complement' | 'goal' | 'skills' | 'near' | 'project'; text: string; vars?: Record<string, string | number> };

export type ProMatch = { percent: number; reasons: Reason[]; distanceKm: number | null };

const lower = (s: string) => s.trim().toLowerCase();

export function distanceKm(a: { lat: number | null; lng: number | null }, b: { lat: number | null; lng: number | null }): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "≈ 2 km", "< 1 km", "≈ 30 km": approximate on purpose (neighbourhood centres, never a position). */
export function roundDistance(km: number): string {
  if (km < 1) return '< 1 km';
  if (km < 10) return `≈ ${Math.round(km)} km`;
  return `≈ ${Math.round(km / 5) * 5} km`;
}

const STOP = new Set(['with', 'from', 'that', 'this', 'your', 'their', 'for', 'and', 'the', 'into', 'about', 'building', 'build', 'platform', 'company', 'project', 'startup', 'pour', 'avec', 'dans', 'une', 'des', 'les']);
const words = (s: string | null) =>
  new Set(
    (s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOP.has(w)),
  );

const joinShort = (ids: IndustryId[]) => ids.slice(0, 2).map((i) => INDUSTRY[i].short).join(' & ');

/** What one side can bring to what the other looks for (the strongest pairing wins). */
function complement(me: ProProfile, other: ProProfile): { points: number; reason: Reason } | null {
  const want = (p: ProProfile, i: IntentId) => p.intents.includes(i);
  const name = other.firstName;
  const options: { points: number; reason: Reason }[] = [];
  if (want(me, 'investors') && other.role === 'investor') options.push({ points: 20, reason: { kind: 'complement', text: '{name} invests and you are looking for investors', vars: { name } } });
  if (want(other, 'investors') && me.role === 'investor') options.push({ points: 20, reason: { kind: 'complement', text: '{name} is raising and you invest', vars: { name } } });
  if (want(me, 'freelancers') && (other.role === 'freelancer' || want(other, 'clients'))) options.push({ points: 16, reason: { kind: 'complement', text: '{name} freelances and you need freelancers', vars: { name } } });
  if (want(other, 'freelancers') && (me.role === 'freelancer' || want(me, 'clients'))) options.push({ points: 16, reason: { kind: 'complement', text: '{name} needs freelancers and you are looking for clients', vars: { name } } });
  if (want(me, 'clients') && want(other, 'suppliers')) options.push({ points: 14, reason: { kind: 'complement', text: '{name} is looking for suppliers and you for clients', vars: { name } } });
  if (want(me, 'suppliers') && (want(other, 'clients') || other.industries.some((i) => i === 'trade' || i === 'retail' || i === 'food' || i === 'ecommerce')))
    options.push({ points: 12, reason: { kind: 'complement', text: '{name} could supply you', vars: { name } } });
  if (want(me, 'job') && (other.role === 'founder' || other.role === 'entrepreneur') && (want(other, 'freelancers') || want(other, 'grow')))
    options.push({ points: 12, reason: { kind: 'complement', text: '{name} is growing a team and you are looking for a job', vars: { name } } });
  if (want(other, 'job') && (me.role === 'founder' || me.role === 'entrepreneur'))
    options.push({ points: 10, reason: { kind: 'complement', text: '{name} is looking for a job and you are building', vars: { name } } });
  if (want(me, 'cofounder') && want(other, 'cofounder')) {
    const mine = new Set(me.skills.map(lower));
    const differ = other.skills.filter((s) => !mine.has(lower(s)));
    if (differ.length >= 2) options.push({ points: 18, reason: { kind: 'complement', text: 'you are both looking for a cofounder, and {name} brings {skills}', vars: { name, skills: differ.slice(0, 2).join(', ') } } });
  }
  // What I wrote I'm looking for, met by their skills or what they offer.
  const wish = words(me.lookingFor);
  const theirs = [...other.skills, ...(other.canOffer ? [other.canOffer] : [])];
  const hit = theirs.find((s) => [...words(s)].some((w) => wish.has(w)));
  if (hit) options.push({ points: 14, reason: { kind: 'complement', text: '{name} offers {what}, what you are looking for', vars: { name, what: hit.length > 40 ? `${hit.slice(0, 40)}…` : hit } } });
  return options.sort((a, b) => b.points - a.points)[0] ?? null;
}

/**
 * How well two professionals fit, out of 100, with the reasons in order of
 * weight: location 15, domain 25, skills 15, shared goals 15,
 * complementarity 20, similar projects 10. Shown as a percentage from 40
 * (barely anything in common) up to the mid 90s, on a curve that rewards the
 * first things in common most.
 */
export function scorePro(me: ProProfile, other: ProProfile): ProMatch {
  const reasons: { points: number; reason: Reason }[] = [];
  let raw = 0;

  const km = distanceKm(me, other);
  const near = km == null ? (me.cityId === other.cityId ? 10 : 5) : km <= 3 ? 15 : km <= 8 ? 12 : km <= 20 ? 9 : km <= 60 ? 6 : 3;
  raw += near;
  if (km != null && km <= 8) reasons.push({ points: near - 6, reason: { kind: 'near', text: 'you are {km} apart', vars: { km: roundDistance(km) } } });

  const industries = other.industries.filter((i) => me.industries.includes(i));
  if (industries.length) {
    const p = industries.length >= 2 ? 25 : 18;
    raw += p;
    reasons.push({ points: p, reason: { kind: 'industry', text: 'you both work in {what}', vars: { what: joinShort(industries) } } });
  }

  const mine = new Set(me.skills.map(lower));
  const skills = other.skills.filter((s) => mine.has(lower(s)));
  if (skills.length) {
    const p = skills.length >= 3 ? 15 : skills.length === 2 ? 12 : 8;
    raw += p;
    reasons.push({ points: p - 2, reason: { kind: 'skills', text: 'you share {skills}', vars: { skills: skills.slice(0, 2).join(' & ') } } });
  }

  const goals = other.intents.filter((i) => me.intents.includes(i));
  if (goals.length) {
    const p = goals.length >= 2 ? 15 : 10;
    raw += p;
    const top = goals.find((g) => g !== 'meet') ?? goals[0];
    reasons.push({
      points: p + 1,
      reason: top === 'meet' ? { kind: 'goal', text: 'you both want to meet people' } : { kind: 'goal', text: 'you are both looking for {what}', vars: { what: INTENT[top].both } },
    });
  }

  const c = complement(me, other);
  if (c) {
    raw += c.points;
    reasons.push({ points: c.points + 2, reason: c.reason });
  }

  const a = words(me.project);
  const shared = [...words(other.project)].filter((w) => a.has(w));
  if (shared.length) {
    const p = shared.length >= 2 ? 10 : 6;
    raw += p;
    reasons.push({ points: p, reason: { kind: 'project', text: 'your projects are similar ({what})', vars: { what: shared.slice(0, 2).join(', ') } } });
  }

  return {
    percent: Math.min(99, Math.round(40 + 59 * (1 - Math.exp(-Math.min(100, raw) / 40)))),
    reasons: reasons.sort((x, y) => y.points - x.points).map((r) => r.reason),
    distanceKm: km,
  };
}

type Tr = (s: string, vars?: Record<string, string | number>) => string;

/** One reason in the reader's language ("AI & SaaS" → "IA & SaaS"). */
export function reasonText(r: Reason, tr: Tr): string {
  const vars = r.vars && Object.fromEntries(Object.entries(r.vars).map(([k, v]) => [k, typeof v === 'string' && k === 'what' ? v.split(' & ').map((x) => tr(x)).join(' & ') : v]));
  return tr(r.text, vars);
}

/** "92% match — You both work in AI & SaaS and you're both looking for business partners." */
export function matchSentence(m: ProMatch, tr: Tr): string {
  const parts = m.reasons.slice(0, 2).map((r) => reasonText(r, tr));
  if (!parts.length) return tr('New on IRLY Networking');
  const s = parts.join(tr(' and '));
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}
