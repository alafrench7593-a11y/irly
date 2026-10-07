import type { PhotoKey } from '@/data/photos';
import type { Lifestyle, Reasons } from './compat';

/** Where the member is in IRLY Girl. Mirrors `irly_match_state()`. */
export type MatchState = 'ineligible' | 'onboarding' | 'profile' | 'ready';

export type MatchAction = 'like' | 'pass' | 'save' | 'unsave';

export type Section = 'for_you' | 'new' | 'active' | 'nearby' | 'interests' | 'sports' | 'travel' | 'saved';

export type Filters = {
  section?: Section;
  interests?: string[];
  sport?: string;
  language?: string;
  goal?: string;
  area?: string;
  availability?: string;
  travel?: boolean;
  ageMin?: number;
  ageMax?: number;
};

/** What the member fills in once, editable later. */
export type MatchProfileDraft = {
  bio: string;
  photoUris: string[];
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
  hiddenFields: string[];
  visible: boolean;
  showActive: boolean;
};

/** A profile in discovery: only what she chose to show. */
export type Candidate = {
  userId: string;
  firstName: string;
  age: number | null;
  cityId: string;
  bio?: string;
  /** Uploaded photos (signed URLs) or, in development, a cover photo key. */
  photoUrls: string[];
  cover?: PhotoKey;
  hue: number;
  interests: string[];
  sports: string[];
  activities: string[];
  goals: string[];
  languages: string[];
  areas: string[];
  travel: string[];
  activeNow: boolean;
  isNew: boolean;
  saved: boolean;
  score: number;
  reasons: Reasons;
};

export type MatchResult = {
  matchId: string;
  conversationId: string;
  score: number;
  reasons: Reasons;
};

export type MatchSummary = MatchResult & {
  userId: string;
  firstName: string;
  hue: number;
  cover?: PhotoKey;
  photoUrls: string[];
  createdAt: number;
};

export type ReportCategory = 'harassment' | 'inappropriate' | 'fake_profile' | 'spam' | 'unsafe' | 'impersonation' | 'other';

export const REPORT_CATEGORIES: { id: ReportCategory; label: string }[] = [
  { id: 'harassment', label: 'Harassment' },
  { id: 'inappropriate', label: 'Inappropriate behaviour' },
  { id: 'fake_profile', label: 'Fake profile' },
  { id: 'spam', label: 'Spam or scam' },
  { id: 'unsafe', label: 'Unsafe behaviour' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'other', label: 'Something else' },
];

export const EMPTY_DRAFT: MatchProfileDraft = {
  bio: '',
  photoUris: [],
  interests: [],
  sports: [],
  activities: [],
  goals: [],
  languages: [],
  areas: [],
  availability: [],
  travel: [],
  lifestyle: {},
  ageMin: 21,
  ageMax: 40,
  hiddenFields: [],
  visible: true,
  showActive: false,
};
