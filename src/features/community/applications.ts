import { DEMO } from '@/config/app';
import { changed } from '@/features/server/sync';
import { isMissingFunction } from '@/features/live/livePublish';
import { friendlyError, supabase } from '@/lib/supabase';
import { useServerRead } from './governance';

/**
 * Private communities joined by application, on the client: how a community
 * is joined (open, or by application with its questions), my own request,
 * and for the team in charge the requests waiting and their answer.
 *
 * Every call is one server function (migration 20261123000000): the server
 * decides who reads and who answers, and that one answer only counts. A
 * server not updated yet reads as an open community: nothing changes there.
 */

export type CommunityAccessMode = 'open' | 'application';
export type ApplicationStatus = 'pending' | 'accepted' | 'refused' | 'withdrawn';
export type Answer = { q: string; a: string };

export type MyApplication = { id: string; status: ApplicationStatus; message: string; answers: Answer[]; createdAt: number | null; decidedAt: number | null };

export type CommunityAccess = {
  access: CommunityAccessMode;
  /** By application, itself or through the community it is a group of. */
  isPrivate: boolean;
  questions: string[];
  /** May I read what members share there (a member, or anyone in an open community). */
  canRead: boolean;
  application: MyApplication | null;
  /** I answer the applications of this community. */
  canReview: boolean;
  /** Requests waiting; null when I do not answer them. */
  pending: number | null;
};

export const OPEN_ACCESS: CommunityAccess = { access: 'open', isPrivate: false, questions: [], canRead: true, application: null, canReview: false, pending: null };

export type Application = {
  id: string;
  userId: string;
  name: string;
  message: string;
  answers: Answer[];
  status: ApplicationStatus;
  createdAt: number | null;
  decidedAt: number | null;
  decidedByName: string | null;
};

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 600;
export const ANSWER_MAX = 400;
export const QUESTION_MIN = 3;
export const QUESTION_MAX = 200;
export const QUESTIONS_MAX = 3;

type Row = Record<string, unknown>;

function sb() {
  if (!supabase) throw new Error(DEMO ? 'Not available in the demo' : 'The IRLY server is not configured');
  return supabase;
}

function fail(error: { code?: string | null; message: string }): never {
  if (isMissingFunction(error)) throw new Error('This needs the latest version of IRLY’s server. Try again later.');
  throw new Error(friendlyError(error.message));
}

const time = (v: unknown): number | null => {
  if (typeof v !== 'string' || !v) return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
};
const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const asStatus = (v: unknown): ApplicationStatus => (v === 'accepted' || v === 'refused' || v === 'withdrawn' ? v : 'pending');
const answersOf = (v: unknown): Answer[] => (Array.isArray(v) ? (v as Row[]).filter((x) => x && typeof x === 'object').map((x) => ({ q: text(x.q), a: text(x.a) })) : []);

function toAccess(r: Row | null): CommunityAccess {
  if (!r) return OPEN_ACCESS;
  const app = r.application && typeof r.application === 'object' ? (r.application as Row) : null;
  return {
    access: r.access === 'application' ? 'application' : 'open',
    isPrivate: Boolean(r.private),
    questions: Array.isArray(r.questions) ? (r.questions as unknown[]).filter((q): q is string => typeof q === 'string') : [],
    canRead: r.can_read !== false,
    application: app
      ? { id: text(app.id), status: asStatus(app.status), message: text(app.message), answers: answersOf(app.answers), createdAt: time(app.created_at), decidedAt: time(app.decided_at) }
      : null,
    canReview: Boolean(r.can_review),
    pending: typeof r.pending === 'number' ? r.pending : null,
  };
}

export async function fetchAccess(communityId: string): Promise<CommunityAccess> {
  if (!supabase || !communityId) return OPEN_ACCESS;
  const { data, error } = await supabase.rpc('community_access', { p_community: communityId });
  if (error) {
    // A server not updated yet has open communities only.
    if (isMissingFunction(error)) return OPEN_ACCESS;
    fail(error);
  }
  return toAccess((Array.isArray(data) ? data[0] : data) as Row | null);
}

/** How this community is joined and where my request stands; reloaded with every community change. */
export function useCommunityAccess(communityId: string) {
  const r = useServerRead<CommunityAccess | null>(communityId, null, () => fetchAccess(communityId), 'access');
  return { access: r.value, loading: r.loading, error: r.error, reload: r.reload };
}

export async function fetchApplications(communityId: string, status: 'pending' | 'answered'): Promise<Application[]> {
  if (!supabase || !communityId) return [];
  const { data, error } = await supabase.rpc('community_applications', { p_community: communityId, p_status: status, p_limit: 100 });
  if (error) fail(error);
  return ((data as Row[] | null) ?? []).map((a) => ({
    id: text(a.id),
    userId: text(a.user_id),
    name: text(a.name),
    message: text(a.message),
    answers: answersOf(a.answers),
    status: asStatus(a.status),
    createdAt: time(a.created_at),
    decidedAt: time(a.decided_at),
    decidedByName: text(a.decided_by_name) || null,
  }));
}

const NONE: Application[] = [];
export function useApplications(communityId: string, status: 'pending' | 'answered', enabled = true) {
  const r = useServerRead(enabled && communityId ? `${communityId}|${status}` : '', NONE, () => fetchApplications(communityId, status));
  return { applications: r.value, loading: r.loading, error: r.error, reload: r.reload };
}

/** Sends my request (the server keeps one pending request per community: a second send gets the first). */
export async function applyToCommunity(communityId: string, message: string, answers: string[]): Promise<void> {
  const { error } = await sb().rpc('community_apply', { p_community: communityId, p_message: message.trim(), p_answers: answers.map((a) => a.trim()) });
  if (error) fail(error);
  changed('communities');
}

export async function withdrawApplication(communityId: string): Promise<void> {
  const { error } = await sb().rpc('community_withdraw_application', { p_community: communityId });
  if (error) fail(error);
  changed('communities');
}

/**
 * Accepts or refuses. `decided` false: someone answered first (or she
 * withdrew), and `status` is what was decided.
 */
export async function decideApplication(applicationId: string, accept: boolean): Promise<{ decided: boolean; status: ApplicationStatus }> {
  const { data, error } = await sb().rpc('community_decide_application', { p_application: applicationId, p_accept: accept });
  if (error) fail(error);
  const r = ((Array.isArray(data) ? data[0] : data) ?? {}) as Row;
  changed('communities');
  return { decided: r.decided !== false, status: asStatus(r.status) };
}

/** Open, or by application with up to three questions (`questions` undefined: kept as they are). */
export async function setCommunityAccess(communityId: string, access: CommunityAccessMode, questions?: string[]): Promise<void> {
  const { error } = await sb().rpc('community_set_access', { p_community: communityId, p_access: access, p_questions: questions ? questions.map((q) => q.trim()).filter(Boolean) : null });
  if (error) fail(error);
  changed('communities');
}

/** The server's « joined by application » refusal, in any wording the app shows it with. */
export const isApplicationRequired = (message: string) => /joined by application|sur candidature/i.test(message);
