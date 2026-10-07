import type { LifestyleKey } from './taxonomy';

/**
 * IRLY Match compatibility, the same maths as `private.match_score` in
 * supabase/migrations/20261005000100_irly_match.sql. The server is the
 * source of truth (its weights live in `irly_match_config`); this copy
 * scores locally when the app runs without a backend, and must stay in
 * step with the SQL.
 */

export type Lifestyle = Partial<Record<LifestyleKey, -1 | 0 | 1>>;

export type MatchProfile = {
  userId: string;
  firstName: string;
  age: number;
  cityId: string;
  bio?: string;
  interests: string[];
  sports: string[];
  activities: string[];
  goals: string[];
  languages: string[];
  areas: string[];
  availability: string[];
  travel: string[];
  lifestyle: Lifestyle;
  ageMin: number;
  ageMax: number;
  communities: string[];
  hiddenFields: string[];
  visible: boolean;
};

export type Facet =
  | 'interests'
  | 'activities'
  | 'sports'
  | 'goals'
  | 'lifestyle'
  | 'languages'
  | 'availability'
  | 'areas'
  | 'age'
  | 'communities'
  | 'travel';

export type Weights = Record<Facet, number>;

/** Mirrors the seed row of `irly_match_config`. */
export const DEFAULT_WEIGHTS: Weights = {
  interests: 3,
  activities: 2.5,
  sports: 2,
  goals: 2.5,
  lifestyle: 2,
  languages: 1.5,
  availability: 1.5,
  areas: 1,
  age: 1,
  communities: 1,
  travel: 1,
};

export type Reasons = {
  interests: string[];
  activities: string[];
  sports: string[];
  goals: string[];
  languages: string[];
  areas: string[];
  availability: string[];
  travel: string[];
  facets: Partial<Record<Facet, number>>;
};

/** Server reasons may omit lists (hidden fields): always give arrays. */
export function normalizeReasons(r: Partial<Reasons> | null | undefined): Reasons {
  const list = (x: unknown) => (Array.isArray(x) ? (x as string[]) : []);
  return {
    interests: list(r?.interests),
    activities: list(r?.activities),
    sports: list(r?.sports),
    goals: list(r?.goals),
    languages: list(r?.languages),
    areas: list(r?.areas),
    availability: list(r?.availability),
    travel: list(r?.travel),
    facets: r?.facets && typeof r.facets === 'object' ? r.facets : {},
  };
}

const shared = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).sort();

/** |A ∩ B| / √(|A|·|B|); null when either side is empty (facet ignored). */
export function setSimilarity(a: string[], b: string[]): number | null {
  if (!a.length || !b.length) return null;
  return shared(a, b).length / Math.sqrt(a.length * b.length);
}

export function lifestyleSimilarity(a: Lifestyle, b: Lifestyle): number | null {
  const keys = (Object.keys(a) as LifestyleKey[]).filter((k) => a[k] != null && b[k] != null);
  if (!keys.length) return null;
  return keys.reduce((s, k) => s + (1 - Math.abs(a[k]! - b[k]!) / 2), 0) / keys.length;
}

export function ageSimilarity(a: MatchProfile, b: MatchProfile): number {
  const miss = (age: number, min: number, max: number) => Math.min(1, Math.max(0, min - age, age - max) / 10);
  return Math.min(1 - miss(b.age, a.ageMin, a.ageMax), 1 - miss(a.age, b.ageMin, b.ageMax));
}

export function matchScore(a: MatchProfile, b: MatchProfile, weights: Weights = DEFAULT_WEIGHTS): { score: number; reasons: Reasons } {
  const langShared = shared(a.languages, b.languages);
  const facets: Partial<Record<Facet, number | null>> = {
    interests: setSimilarity(a.interests, b.interests),
    activities: setSimilarity(a.activities, b.activities),
    sports: setSimilarity(a.sports, b.sports),
    goals: setSimilarity(a.goals, b.goals),
    lifestyle: lifestyleSimilarity(a.lifestyle, b.lifestyle),
    languages: langShared.length ? 1 : a.languages.length && b.languages.length ? 0 : null,
    availability: setSimilarity(a.availability, b.availability),
    areas: setSimilarity(a.areas, b.areas),
    age: ageSimilarity(a, b),
    communities: setSimilarity(a.communities, b.communities),
    travel: setSimilarity(a.travel, b.travel),
  };
  let num = 0;
  let den = 0;
  const kept: Partial<Record<Facet, number>> = {};
  (Object.keys(facets) as Facet[]).forEach((k) => {
    const v = facets[k];
    if (v == null) return;
    kept[k] = v;
    num += v * weights[k];
    den += weights[k];
  });
  return {
    score: den ? Math.round((100 * num) / den) : 0,
    reasons: {
      interests: shared(a.interests, b.interests),
      activities: shared(a.activities, b.activities),
      sports: shared(a.sports, b.sports),
      goals: shared(a.goals, b.goals),
      languages: langShared,
      areas: shared(a.areas, b.areas),
      availability: shared(a.availability, b.availability),
      travel: shared(a.travel, b.travel),
      facets: kept,
    },
  };
}
