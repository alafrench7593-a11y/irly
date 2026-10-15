/**
 * Publishing a Live, as states: draft → publishing → published | failed.
 *
 * The Live and its "anyone can join" activity are saved by the server in one
 * transaction (post_live): either both exist or neither does, so an activity
 * can no longer be left published by a Live that failed or was abandoned.
 *
 * What the phone still has to settle is a publish whose outcome it does not
 * know (the answer was lost: network gone, app killed): the request may have
 * landed. It is kept in a journal on the phone until it is settled, never
 * guessed. Settling asks the server to abandon it (abandon_live): the server
 * answers "published" when it did land (it stays), otherwise it records the
 * Live as abandoned so a late copy of the request can never publish it, and
 * the phone then removes the files uploaded for it. A slow request is never
 * abandoned on its own: only a closed composer, a discarded draft, a changed
 * post or the next start of the app settles it.
 *
 * Pure (no React Native): unit-tested from node (scripts/check-live.mts).
 */

export type LivePhase = 'draft' | 'publishing' | 'published' | 'failed';

/**
 * Why a publish failed. 'refused': the server answered no (or nothing was
 * sent): nothing of it exists. 'unknown': no answer: it may have landed.
 */
export type LiveOutcome = 'refused' | 'unknown';

export class LivePublishError extends Error {
  readonly outcome: LiveOutcome;
  constructor(message: string, outcome: LiveOutcome) {
    super(message);
    this.name = 'LivePublishError';
    this.outcome = outcome;
  }
}

/** Anything not known to be a refusal may have landed. */
export function outcomeOf(e: unknown): LiveOutcome {
  return e instanceof LivePublishError ? e.outcome : 'unknown';
}

/** A server error with a code is an answer (a refusal); none (network, timeout) is no answer. */
export function isAnswer(error: { code?: string | null } | null | undefined): boolean {
  return Boolean(error?.code);
}

/** The server does not have post_live / abandon_live yet (database not migrated): the older steps are used. */
export function isMissingFunction(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883' || /could not find the function/i.test(error?.message ?? '');
}

/** A publish whose outcome is not known yet, kept on the phone until it is settled. */
export type PendingLive = {
  postId: string;
  uid: string;
  /** Files uploaded (or being uploaded) for it, in the member's folder. */
  files: string[];
  /** The words, given back as a draft if it did not land. */
  body: string;
  activity: boolean;
  at: number;
  /** An earlier try of this same Live got no answer: it may already be saved, with these files. */
  prior?: boolean;
};

export type AbandonAnswer = 'published' | 'abandoned' | 'deleted' | 'cancelled' | 'not_mine';

export type Settled = 'published' | 'dropped' | 'later';

export type SettleDeps = {
  abandon: (postId: string) => Promise<AbandonAnswer>;
  removeFiles: (paths: string[]) => Promise<void>;
};

/**
 * Settles a publish that did not get its answer: 'published' (it landed and
 * stays), 'dropped' (it never will: its files are removed and an activity
 * made for it by an older app is rolled back by the server), or 'later'
 * (the server could not be asked: nothing is assumed, it is asked again).
 */
export async function settlePending(p: PendingLive, deps: SettleDeps): Promise<Settled> {
  let answer: AbandonAnswer;
  try {
    answer = await deps.abandon(p.postId);
  } catch {
    return 'later';
  }
  if (answer === 'published') return 'published';
  if (p.files.length) await deps.removeFiles(p.files).catch(() => undefined);
  return 'dropped';
}

export type PublishDeps<Row> = {
  /** Uploads every file (all or nothing). */
  upload: () => Promise<void>;
  /** Saves the Live (and its activity) in one request. */
  save: () => Promise<Row>;
  /** Removes the files uploaded for it (when nothing was saved). */
  removeFiles: () => Promise<void>;
  /** The phone's journal of publishes not settled yet. */
  journal: { put: (p: PendingLive) => void; drop: (postId: string) => void };
};

/**
 * One try of a publish. The journal holds it from the first byte sent: an app
 * killed at any point leaves it there, to be settled at the next start.
 * - upload fails: nothing was saved; its files go; error 'refused'. After an
 *   earlier try without answer the Live may be saved with these very files:
 *   they stay, and so does the journal; error 'unknown'.
 * - the server refuses the save (a code): nothing was saved (one transaction);
 *   its files go; error 'refused'.
 * - no answer to the save: it may have landed; the journal keeps it and the
 *   files stay; error 'unknown'. The same id tried again is safe (the server
 *   returns the Live already saved).
 */
export async function runPublish<Row>(pending: PendingLive, deps: PublishDeps<Row>): Promise<Row> {
  deps.journal.put(pending);
  try {
    await deps.upload();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    if (pending.prior) throw new LivePublishError(message, 'unknown');
    await deps.removeFiles().catch(() => undefined);
    deps.journal.drop(pending.postId);
    throw new LivePublishError(message, 'refused');
  }
  try {
    const row = await deps.save();
    deps.journal.drop(pending.postId);
    return row;
  } catch (e) {
    if (outcomeOf(e) === 'refused') {
      await deps.removeFiles().catch(() => undefined);
      deps.journal.drop(pending.postId);
      throw e;
    }
    throw e instanceof LivePublishError ? e : new LivePublishError(e instanceof Error ? e.message : 'Could not post', 'unknown');
  }
}
