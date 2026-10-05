import { ACTIVITIES, INTERESTS, USER_TYPES } from '@/data/catalog';
import { t as tx } from '@/i18n';
import type { Intent, Person, UserType } from '@/data/types';
import type { Profile } from '@/state/store';

/**
 * IRLY smart matching.
 *
 * Transparent and explainable on purpose: every match comes with the human
 * reasons behind it ("Also plays padel", "Local, knows Al Quoz"). Trust over
 * opaque algorithms is one of IRLY's moats, so the score is never shown,
 * only the reasons.
 *
 * Signals: intent, shared interests, shared activities, profile types
 * (similar or complementary), availability, verification and presence.
 */

/** Pairs that create value across profiles (from the IRLY model). */
const COMPLEMENTS: [UserType, UserType, Intent[], string][] = [
  ['expat', 'local', ['explore', 'friends', 'activities'], 'Local who knows the city'],
  ['tourist', 'local', ['explore', 'activities'], 'Local who can show you around'],
  ['entrepreneur', 'professional', ['business'], 'Could become a client or partner'],
  ['expat', 'entrepreneur', ['business', 'similar'], 'Been through the move, built here'],
  ['nomad', 'nomad', ['similar', 'friends', 'business'], 'Also working remotely'],
  ['student', 'professional', ['business', 'explore'], 'Could mentor your next step'],
];

export type Match = { person: Person; score: number; reasons: string[]; strength: 'Strong match' | 'Good match' | 'Worth meeting' };

function overlap<T>(a: T[], b: T[]): T[] {
  return a.filter((x) => b.includes(x));
}

function list(labels: string[]): string {
  const l = labels.map((x) => tx(x));
  if (l.length <= 1) return l[0] ?? '';
  return `${l.slice(0, -1).join(', ')} & ${l[l.length - 1]}`;
}

export function scoreMatch(me: Profile, other: Person, intent: Intent, areaName: (id: string) => string): Match {
  let score = 0;
  const reasons: { w: number; text: string }[] = [];

  if (other.intents.includes(intent)) {
    score += 22;
  }

  const sharedActivities = overlap(me.activities, other.activities);
  if (sharedActivities.length) {
    const w = sharedActivities.length * (intent === 'sports' || intent === 'activities' ? 16 : 9);
    score += Math.min(w, 40);
    reasons.push({ w, text: tx('Also into {x}', { x: list(sharedActivities.slice(0, 2).map((k) => ACTIVITIES[k].label.toLowerCase())) }) });
  }

  const sharedInterests = overlap(me.interests, other.interests);
  if (sharedInterests.length) {
    const w = sharedInterests.length * (intent === 'friends' || intent === 'similar' ? 9 : 6);
    score += Math.min(w, 30);
    reasons.push({ w, text: tx('Shares your love of {x}', { x: list(sharedInterests.slice(0, 2).map((i) => INTERESTS[i].label.toLowerCase())) }) });
  }

  if (intent === 'similar') {
    const same = overlap(me.types, other.types);
    if (same.length) {
      score += 18 * same.length;
      reasons.push({ w: 20, text: tx('{type} like you', { type: tx(USER_TYPES[same[0]].label) }) });
    }
  }

  for (const [a, b, intents, text] of COMPLEMENTS) {
    const pair = (me.types.includes(a) && other.types.includes(b)) || (me.types.includes(b) && other.types.includes(a));
    if (pair && intents.includes(intent)) {
      score += 16;
      const label = text === 'Local who knows the city' ? tx('Local, knows {area}', { area: areaName(other.areaId) }) : tx(text);
      reasons.push({ w: 18, text: label });
      break;
    }
  }

  if (intent === 'business' && (other.types.includes('entrepreneur') || other.types.includes('professional'))) {
    score += 10;
    reasons.push({ w: 12, text: other.headline });
  }

  if (other.availability.includes('flexible') || other.availability.includes('evenings') || other.availability.includes('weekends')) {
    score += 6;
  }
  if (other.verified) {
    score += 6;
    reasons.push({ w: 4, text: tx('Verified by IRLY') });
  }
  if (other.online) score += 4;

  reasons.sort((x, y) => y.w - x.w);
  const unique = Array.from(new Set(reasons.map((r) => r.text))).slice(0, 3);
  if (!unique.length) unique.push(`Lives in ${areaName(other.areaId)}`);

  const strength = score >= 60 ? 'Strong match' : score >= 35 ? 'Good match' : 'Worth meeting';
  return { person: other, score, reasons: unique, strength };
}

export function rankMatches(me: Profile, people: Person[], intent: Intent, areaName: (id: string) => string): Match[] {
  return people
    .map((p) => scoreMatch(me, p, intent, areaName))
    .sort((a, b) => b.score - a.score);
}
