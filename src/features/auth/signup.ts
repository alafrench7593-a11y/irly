/**
 * Sign-up and sign-in rules that need no app runtime (no React Native, no
 * network): what a valid email and password are, what each server error
 * means for the person, and where an interrupted sign-up continues.
 * Tested by scripts/test-auth.mts.
 */
import type { Profile } from '@/state/store';

export const MESSAGES = {
  existingAccount: 'An account already uses this email. Sign in instead',
  wrongCredentials: 'Wrong email or password',
  emailNotConfirmed: 'Confirm your email first: open the link we sent you',
  invalidEmail: 'Enter a valid email address',
  passwordTooShort: 'Use at least 8 characters for your password',
  passwordTooLong: 'Use at most 72 characters for your password',
  weakPassword: 'Choose a stronger password: mix letters, numbers and symbols',
  samePassword: 'Choose a password different from your current one',
  rateLimited: 'Too many attempts. Wait a minute and try again',
  network: 'No connection. Check your internet and try again',
  providerOff: 'This sign-in option is not switched on yet. Use email for now',
  phoneOff: 'Phone sign-in is not switched on yet. Use email for now',
  badCode: 'This code is wrong or has expired. Ask for a new one',
  badLink: 'This link is invalid or has expired. Ask for a new one',
  signInIncomplete: 'Sign-in did not complete. Try again.',
  signupsClosed: 'New accounts are paused for now. Try again later',
  sessionEnded: 'Your session has ended. Sign in again',
  serverDown: 'IRLY could not do this right now. Try again in a moment',
  unknown: 'Something went wrong. Try again',
} as const;

/** Supabase's bcrypt hashing reads at most 72 bytes of a password. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** A plausible email address (the server has the last word). */
export function isValidEmail(email: string): boolean {
  const e = email.trim();
  return e.length <= 254 && EMAIL.test(e);
}

/** What is wrong with a new password, or null when it can be sent. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return MESSAGES.passwordTooShort;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX) return MESSAGES.passwordTooLong;
  return null;
}

type ErrorLike = { message?: unknown; code?: unknown; status?: unknown; name?: unknown };

/** The request never reached IRLY or never came back (offline, timeout, DNS, captive portal). */
export function isNetworkError(e: unknown): boolean {
  const x = (e ?? {}) as ErrorLike;
  const text = `${typeof x.name === 'string' ? x.name : ''} ${typeof e === 'string' ? e : typeof x.message === 'string' ? x.message : ''}`;
  return /AuthRetryableFetchError|failed to fetch|network ?request failed|networkerror|load failed|fetch failed|network error|ERR_NETWORK|ECONNREFUSED|ENOTFOUND|timed? ?out|aborted/i.test(text);
}

/**
 * Plain-language errors for what people actually hit while signing up or in.
 * Codes are Supabase Auth's (`error.code`); messages cover older servers.
 * Our own messages (already written for people) pass through unchanged.
 */
export function authMessage(e: unknown): string {
  const x = (e ?? {}) as ErrorLike;
  const m = typeof e === 'string' ? e : typeof x.message === 'string' ? x.message : '';
  const code = typeof x.code === 'string' ? x.code : '';
  const status = typeof x.status === 'number' ? x.status : 0;
  if (/^(user_already_exists|email_exists|identity_already_exists)$/.test(code) || /already (been )?registered|already exists|already in use/i.test(m)) return MESSAGES.existingAccount;
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(m)) return MESSAGES.wrongCredentials;
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(m)) return MESSAGES.emailNotConfirmed;
  if (code === 'email_address_invalid' || /unable to validate email|invalid format|email address .*invalid|invalid email/i.test(m)) return MESSAGES.invalidEmail;
  if (code === 'weak_password' || /weak password|password should contain|password is known|pwned|leaked/i.test(m)) return MESSAGES.weakPassword;
  if (/password should be at least/i.test(m)) return MESSAGES.passwordTooShort;
  if (code === 'same_password' || /should be different from the old password/i.test(m)) return MESSAGES.samePassword;
  if (/rate[_ ]limit|too many/i.test(`${code} ${m}`) || status === 429) return MESSAGES.rateLimited;
  if (/link is invalid or has expired/i.test(m)) return MESSAGES.badLink;
  if (code === 'otp_expired' || /token has expired|otp.*(expired|invalid)|invalid otp/i.test(m)) return MESSAGES.badCode;
  if (/^(signup_disabled|email_provider_disabled)$/.test(code) || /signups? not allowed|signup(s)? (are|is) disabled/i.test(m)) return MESSAGES.signupsClosed;
  if (code === 'provider_disabled' || /provider is not enabled|unsupported provider/i.test(m)) return MESSAGES.providerOff;
  if (code === 'phone_provider_disabled' || /phone.*(provider|sms)|sms provider/i.test(m)) return MESSAGES.phoneOff;
  if (/^(session_not_found|session_expired|refresh_token_not_found|refresh_token_already_used)$/.test(code) || /auth session missing/i.test(m)) return MESSAGES.sessionEnded;
  if (/IRLY did not answer/i.test(m)) return m;
  if (isNetworkError(e)) return MESSAGES.network;
  if (status >= 500 || code === 'unexpected_failure' || /database error|internal server error|unexpected_failure/i.test(m)) return MESSAGES.serverDown;
  if (!m.trim()) return MESSAGES.unknown;
  // A raw technical answer (JSON, a stack, an HTTP dump) is never shown as is.
  if (/^[{[]|\bat .+\(.+:\d+:\d+\)|status code \d{3}|AuthApiError|AuthUnknownError|PGRST\d+|SQLSTATE/i.test(m)) return MESSAGES.unknown;
  return m;
}

/**
 * A sign-in return link (email link, Apple, Google) that carries an error
 * (`#error=…&error_code=…&error_description=…`): the sentence to show, or
 * null when the link has no error. The provider's own text is never shown as
 * is (it is English, technical, sometimes a provider dump): a known case gets
 * its sentence, anything else "Sign-in did not complete".
 */
export function returnLinkError(url: string): string | null {
  const params = new URLSearchParams((url.split('#')[1] ?? url.split('?')[1] ?? '').replace(/\+/g, '%20'));
  const description = params.get('error_description');
  const code = params.get('error_code') ?? '';
  if (!description && !params.get('error')) return null;
  // An email link already used or too old comes back as otp_expired: it is a link here, not a typed code.
  if (code === 'otp_expired' || /link is invalid or has expired/i.test(description ?? '')) return MESSAGES.badLink;
  const said = authMessage({ code, message: description ?? '' });
  return (Object.values(MESSAGES) as string[]).includes(said) ? said : MESSAGES.signInIncomplete;
}

/**
 * Supabase answers a sign-up for an email that already has a confirmed
 * account with a user that has no identities and no error (so nobody can
 * probe which emails are registered). Shown as "check your inbox" it would be
 * a fake success: the person waits for an email that never comes.
 */
export function signUpHitExisting(user: { identities?: unknown[] | null } | null | undefined): boolean {
  return Boolean(user && Array.isArray(user.identities) && user.identities.length === 0);
}

/** A short, non-personal label for a server error (a constraint, a rule): enough to find the cause, never the user's data. */
export function errorCode(message: string): string {
  const named = /(?:constraint|policy) "([a-z0-9_]{3,60})"/i.exec(message)?.[1];
  if (named) return named;
  if (/row-level security/i.test(message)) return `rls:${/table "([a-z_]{3,40})"/i.exec(message)?.[1] ?? 'unknown'}`;
  const first = message.toLowerCase().replace(/[^a-z_ ]/g, ' ').trim().split(/\s+/).slice(0, 5).join('_');
  return first.slice(0, 60) || 'unknown';
}

/* ───────── Interrupted sign-up ───────── */

export type SignupStep = 'you' | 'interests' | 'profile' | 'looking' | 'ready';

/** The sign-up steps, in order, and their screens. */
export const SIGNUP_ROUTES: Record<SignupStep, string> = {
  you: '/onboarding/you',
  interests: '/onboarding/interests',
  profile: '/onboarding/profile',
  looking: '/onboarding/looking',
  ready: '/onboarding/ready',
};

type SignupProfile = Pick<Profile, 'name' | 'types' | 'interests' | 'photoUri' | 'age' | 'bio' | 'country' | 'languages' | 'gender' | 'lookingFor'>;

/** Step 3: a face, an adult age, a bio, a country, a language and the gender (which decides IRLY Girl, locked after sign-up). */
export function profileStepDone(p: Partial<SignupProfile>): boolean {
  return (
    Boolean(p.photoUri) &&
    (p.age ?? 0) >= 18 &&
    (p.bio ?? '').trim().length >= 10 &&
    Boolean(p.country?.trim()) &&
    (p.languages ?? []).length > 0 &&
    Boolean(p.gender)
  );
}

/**
 * Where a sign-up continues: the first step whose answers are missing. The
 * answers are kept on the phone as they are given, so a person who left
 * (app closed, phone restarted) picks up where they stopped instead of
 * starting again; the earlier steps stay reachable with Back.
 */
export function signupStep(p: Partial<SignupProfile>): SignupStep {
  if (!p.name?.trim() || !(p.types ?? []).length) return 'you';
  if ((p.interests ?? []).length < 3) return 'interests';
  if (!profileStepDone(p)) return 'profile';
  if (!(p.lookingFor ?? []).length) return 'looking';
  return 'ready';
}

const DAY_MS = 86_400_000;

/**
 * "How long have you been here?" as answered at sign-up, read back from the
 * arrival date the server keeps (looking.tsx turns the answer into that date;
 * "I'm from here" stores none). Newcomer communities depend on it.
 */
export function sinceFromArrival(arrivedAt: string | null | undefined, now = Date.now()): Profile['since'] {
  if (!arrivedAt) return 'local';
  const days = (now - Date.parse(arrivedAt)) / DAY_MS;
  if (!Number.isFinite(days)) return undefined;
  return days < 60 ? 'new' : days < 365 ? 'year' : 'years';
}
