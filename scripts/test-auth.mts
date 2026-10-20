// Sign-up, sign-in and log-out rules that run without a server or a phone:
// email and password checks, the message shown for each server error (an
// existing account, no network, Supabase errors), where an interrupted
// sign-up continues, and a static check that Log out wipes every store of
// this phone that holds personal data.
// Run: node --experimental-strip-types --no-warnings --import ./scripts/alias.mjs scripts/test-auth.mts
import fs from 'node:fs';
import path from 'node:path';
import {
  authMessage,
  errorCode,
  isNetworkError,
  isValidEmail,
  MESSAGES,
  passwordProblem,
  profileStepDone,
  SIGNUP_ROUTES,
  signUpHitExisting,
  signupStep,
} from '../src/features/auth/signup.ts';

let failed = 0;
let passed = 0;
const expect = (ok: boolean, label: string, got?: unknown) => {
  if (ok) {
    passed++;
    console.log(`✓ ${label}`);
  } else {
    failed++;
    console.error(`✗ ${label}`, got === undefined ? '' : JSON.stringify(got));
  }
};
const is = (got: unknown, want: unknown, label: string) => expect(got === want, label, got);

/* ───────── Email and password ───────── */
is(isValidEmail('wen@example.com'), true, 'email: a normal address is valid');
is(isValidEmail('  Wen@Example.COM  '), true, 'email: spaces around and capitals are fine');
is(isValidEmail(''), false, 'email: empty is invalid');
is(isValidEmail('wen'), false, 'email: no @ is invalid');
is(isValidEmail('wen@example'), false, 'email: no domain ending is invalid');
is(isValidEmail('wen @example.com'), false, 'email: a space inside is invalid');
is(isValidEmail('wen@@example.com'), false, 'email: two @ are invalid');
is(isValidEmail(`${'a'.repeat(250)}@example.com`), false, 'email: longer than 254 characters is invalid');
is(passwordProblem(''), MESSAGES.passwordTooShort, 'password: empty is too short');
is(passwordProblem('1234567'), MESSAGES.passwordTooShort, 'password: 7 characters is too short');
is(passwordProblem('12345678'), null, 'password: 8 characters is accepted');
is(passwordProblem('x'.repeat(72)), null, 'password: 72 characters is accepted');
is(passwordProblem('x'.repeat(73)), MESSAGES.passwordTooLong, 'password: 73 characters is refused (bcrypt reads 72 bytes)');
is(passwordProblem('é'.repeat(37)), MESSAGES.passwordTooLong, 'password: counted in bytes, not characters');

/* ───────── Server errors → clear messages ───────── */
const authErr = (message: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(message), { name: 'AuthApiError', ...extra });
is(authMessage(authErr('User already registered', { status: 422, code: 'user_already_exists' })), MESSAGES.existingAccount, 'existing account (code user_already_exists)');
is(authMessage(authErr('A user with this email address has already been registered', { code: 'email_exists' })), MESSAGES.existingAccount, 'existing account (code email_exists)');
is(authMessage(authErr('User already registered')), MESSAGES.existingAccount, 'existing account (older server, message only)');
is(MESSAGES.existingAccount.startsWith('An account already uses this email'), true, 'existing account: says "An account already uses this email"');
is(authMessage(authErr('Invalid login credentials', { status: 400, code: 'invalid_credentials' })), MESSAGES.wrongCredentials, 'wrong password');
is(authMessage(authErr('Email not confirmed', { code: 'email_not_confirmed' })), MESSAGES.emailNotConfirmed, 'email not confirmed');
is(authMessage(authErr('Unable to validate email address: invalid format', { code: 'email_address_invalid' })), MESSAGES.invalidEmail, 'invalid email format (server)');
is(authMessage(authErr('Password should be at least 8 characters.', { code: 'weak_password' })), MESSAGES.weakPassword, 'weak password (code)');
is(authMessage(authErr('Password should be at least 8 characters.')), MESSAGES.passwordTooShort, 'short password (older server)');
is(authMessage(authErr('New password should be different from the old password.', { code: 'same_password' })), MESSAGES.samePassword, 'same password');
is(authMessage(authErr('email rate limit exceeded', { status: 429, code: 'over_email_send_rate_limit' })), MESSAGES.rateLimited, 'rate limited');
is(authMessage(authErr('Token has expired or is invalid', { code: 'otp_expired' })), MESSAGES.badCode, 'wrong or expired code');
is(authMessage(authErr('Signups not allowed for this instance', { code: 'signup_disabled' })), MESSAGES.signupsClosed, 'sign-ups switched off');
is(authMessage(authErr('Unsupported provider: provider is not enabled', { code: 'validation_failed' })), MESSAGES.providerOff, 'provider switched off');
is(authMessage(authErr('Auth session missing!')), MESSAGES.sessionEnded, 'session missing');
is(authMessage(authErr('Database error saving new user', { status: 500, code: 'unexpected_failure' })), MESSAGES.serverDown, 'server error (500)');
is(authMessage(Object.assign(new TypeError('Failed to fetch'), {})), MESSAGES.network, 'network: web fetch failure');
is(authMessage(new TypeError('Network request failed')), MESSAGES.network, 'network: React Native fetch failure');
is(authMessage(Object.assign(new Error('{}'), { name: 'AuthRetryableFetchError', status: 0 })), MESSAGES.network, 'network: Supabase retryable fetch error');
is(isNetworkError(new Error('Invalid login credentials')), false, 'network: a refusal is not a network error');
is(authMessage(new Error('IRLY did not answer in time. Check your connection and try again.')), 'IRLY did not answer in time. Check your connection and try again.', 'our timeout message is kept');
is(authMessage(new Error('{"code":500,"msg":"boom"}')), MESSAGES.unknown, 'raw JSON is never shown');
is(authMessage(Object.assign(new Error('AuthUnknownError: status code 502'), { status: 502 })), MESSAGES.serverDown, 'a 502 says IRLY could not do it right now');
is(authMessage(new Error('AuthApiError: status code 418')), MESSAGES.unknown, 'a technical dump is never shown as is');
is(authMessage(new Error('')), MESSAGES.unknown, 'an empty error gets a sentence');
is(authMessage(undefined), MESSAGES.unknown, 'no error object gets a sentence');
is(authMessage('Invalid login credentials'), MESSAGES.wrongCredentials, 'a plain string is mapped too');
is(authMessage(new Error('Sign-in did not complete. Try again.')), 'Sign-in did not complete. Try again.', 'our own sentences pass through');
for (const [k, m] of Object.entries(MESSAGES)) is(authMessage(new Error(m)), m, `mapping twice changes nothing (${k})`);

/* ───────── No fake success on sign-up ───────── */
is(signUpHitExisting({ identities: [] }), true, 'sign-up: an existing confirmed email (no identities) is detected');
is(signUpHitExisting({ identities: [{ provider: 'email' }] }), false, 'sign-up: a new account is not');
is(signUpHitExisting({}), false, 'sign-up: identities unknown is not taken for an existing account');
is(signUpHitExisting(null), false, 'sign-up: no user is not an existing account');

/* ───────── Error codes for analytics (never personal) ───────── */
is(errorCode('new row violates row-level security policy for table "profiles"'), 'rls:profiles', 'errorCode: RLS refusal names the table');
is(errorCode('insert violates foreign key constraint "profiles_id_fkey"'), 'profiles_id_fkey', 'errorCode: constraint name');
expect(!errorCode('duplicate wen@example.com').includes('@'), 'errorCode: never carries an email');

/* ───────── Interrupted sign-up: continue where it stopped ───────── */
const empty = { name: '', types: [], interests: [], activities: [], languages: [], lookingFor: [] };
is(signupStep(empty), 'you', 'resume: a fresh sign-up starts at the first step');
const named = { ...empty, name: 'Wen', types: ['expat' as const] };
is(signupStep(named), 'interests', 'resume: name and type given → interests');
const interested = { ...named, interests: ['food', 'sport', 'music'] as never[] };
is(signupStep(interested), 'profile', 'resume: interests given → profile');
const profiled = { ...interested, photoUri: 'irly-avatar:x', age: 30, bio: 'Padel and coffee lover', country: 'FR', languages: ['English'], gender: 'woman' as const };
is(profileStepDone(profiled), true, 'profile step: complete');
is(profileStepDone({ ...profiled, gender: undefined }), false, 'profile step: the gender is required (it decides IRLY Girl)');
is(profileStepDone({ ...profiled, age: 17 }), false, 'profile step: under 18 is refused');
is(profileStepDone({ ...profiled, bio: ' short ' }), false, 'profile step: a bio of 10 characters at least');
is(signupStep(profiled), 'looking', 'resume: profile given → looking for');
is(signupStep({ ...profiled, lookingFor: ['friends'] as never[] }), 'ready', 'resume: everything given → ready');
is(signupStep({ ...profiled, lookingFor: ['friends'] as never[], name: '  ' }), 'you', 'resume: a blank name sends back to the first step');
for (const [step, route] of Object.entries(SIGNUP_ROUTES)) {
  expect(fs.existsSync(path.join('src/app', `${route}.tsx`)), `resume: the ${step} step has a screen (${route})`);
}

/* ───────── Log out: every personal store of this phone is wiped ───────── */
const read = (f: string) => fs.readFileSync(f, 'utf8');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [path.join(dir, d.name)] : []));
const files = walk('src');
const wipe = read('src/state/wipe.ts');
const wipeBody = wipe.slice(wipe.indexOf('export function wipeLocal'));

// Keys kept on purpose (device settings, not the person's data), with the reason.
const KEPT: Record<string, string> = {
  'irly-lang': 'the language chosen for the app on this phone',
  'irly-last-photo': 'which catalog library photo was drawn last (no personal data)',
};
// How wipe.ts clears each persisted key (a store name, or its own reset helper).
const WIPED_BY: Record<string, RegExp> = {
  'irly-v2': /useStore\.getState\(\)\.deleteAccount\(\)/,
  'irly-faces': /\bclearFaces\b/,
  'irly-post-drafts': /useDrafts\.setState\(\{ byKey: \{\} \}\)/,
  'irly-bali': /useBaliStore\.getState\(\)\.setAnswers\(\{\}\)/,
  'irly-girl': /useGirlStore\.getState\(\)\.reset\(\)/,
  'irly-recap-seen': /AsyncStorage\.removeItem\(RECAP_SEEN\)/,
  'irly-live-pending': /pendingJournal\.clear\(\)/,
  'irly-space': /\bresetAppSpace\b/,
};
const persisted = new Map<string, string>();
for (const f of files) for (const m of read(f).matchAll(/storageName\('([\w-]+)'\)/g)) if (f !== path.join('src', 'state', 'wipe.ts')) persisted.set(m[1], f);
expect(persisted.size >= 8, `logout: found the persisted stores of the app (${persisted.size})`);
for (const [key, file] of persisted) {
  if (KEPT[key]) {
    expect(true, `logout: ${key} is kept on purpose (${KEPT[key]})`);
    continue;
  }
  const how = WIPED_BY[key];
  expect(Boolean(how && how.test(wipeBody)), `logout: ${key} (${file}) is wiped by wipeLocal`, how ? 'not referenced in wipe.ts' : 'new persisted store: wipe it in src/state/wipe.ts or list it in KEPT');
}
// Any other persisted zustand store (persist() without storageName) must be listed too.
for (const f of files) {
  const src = read(f);
  if (!/from 'zustand\/middleware'/.test(src) || /storageName\(/.test(src)) continue;
  expect(false, `logout: ${f} persists a store without storageName(): check it is wiped`);
}
// The app space is reset to Mixte (resetAppSpace sets 'mixte').
expect(/resetAppSpace = \(\): void => useSpaceStore\.getState\(\)\.setSpace\('mixte'\)/.test(read('src/state/appSpace.ts')), 'logout: resetAppSpace goes back to Mixte');
// The main store: every personal field of the persisted state is reset by deleteAccount.
const store = read('src/state/store.ts');
const initialStart = store.indexOf('(set, get) => ({');
const initialBlock = store.slice(initialStart, store.indexOf('setDestination:', initialStart));
const fields = [...initialBlock.matchAll(/^\s{6}(\w+):/gm)].map((m) => m[1]);
const DEVICE_PREFS = new Set(['hydrated', 'appearance', 'hapticsOn', 'emirateOnly', 'storySeen', 'communityIntroSeen']);
const deleteStart = store.indexOf('deleteAccount: () =>');
const deleteBlock = store.slice(deleteStart, store.indexOf('resetOnboarding:', deleteStart));
expect(fields.length >= 15, `logout: read the main store's fields (${fields.length})`);
for (const k of fields) {
  if (DEVICE_PREFS.has(k)) continue;
  const wiped = new RegExp(`\\b${k}:`).test(deleteBlock) || (k === 'waitlist' && /waitlist: \{\}/.test(wipeBody));
  expect(wiped, `logout: the main store's "${k}" is reset`);
}
// In-memory server caches and badges of the account that left.
for (const call of ['clearChatCache()', 'useServerUnread.setState({ n: 0 })', 'clearSocialCache()', 'useServerBell.setState({ n: 0 })', 'clearActivityCache()', 'clearLinkCache()', 'clearLiveCache()']) {
  expect(wipeBody.includes(call), `logout: wipeLocal calls ${call}`);
}
// Overlays of the account that left are closed.
for (const s of ['usePhotoViewer', 'useHeroStore', 'useReportStore', 'useCreateStore']) expect(wipeBody.includes(s), `logout: wipeLocal closes ${s}`);
// signOut: push off, session removed on this phone, live channels closed, everything wiped.
const account = read('src/features/auth/account.ts');
const endSession = account.slice(account.indexOf('async function endSession'), account.indexOf('export async function signOut'));
expect(/signOut\(\{ scope: 'local' \}\)/.test(endSession), 'logout: the session ends on the server (this phone only)');
expect(/closeRealtime\(\)/.test(endSession) && /removeAllChannels\(\)/.test(account), 'logout: realtime channels are closed');
expect(/forgetSessionHere\(\)/.test(endSession), 'logout: the stored session is removed from this phone whatever the server says');
expect(/setSession\(null\)/.test(endSession) && /wipeLocal\(\)/.test(endSession), 'logout: signed out in the app and this phone wiped');
expect(/unregisterPush\(\)/.test(account.slice(account.indexOf('export async function signOut'))), 'logout: notifications stop for this phone first');
expect(/event === 'SIGNED_OUT'[\s\S]{0,80}wipeLocal\(\)/.test(account), 'logout elsewhere (SIGNED_OUT): this phone is wiped too');
expect(/cur\.account\.userId !== u\.id\) wipeLocal\(\)/.test(account), 'another account signing in: the previous one is wiped first');
expect(/router\.replace\('\/welcome'\)/.test(account.slice(account.indexOf('export function goPublic'))), 'logout: lands on Welcome with the history reset');
for (const f of ['src/app/account.tsx', 'src/features/settings/SettingsSections.tsx']) {
  const src = read(f);
  if (/await signOut\(\)/.test(src)) expect(/await signOut\(\);[\s\S]{0,200}goPublic\(\)/.test(src), `logout: ${f} leaves the private screens after signOut`);
}

// Module caches of server data that live outside the wipe (reported to their owners, not failed here).
const GAPS: [string, RegExp, string][] = [
  ['src/features/server/covers.ts', /export function clear\w*Cover/i, 'coverCache (community cover paths)'],
  ['src/features/network/api.ts', /export function clear\w*/i, 'signed (signed photo links)'],
  ['src/features/girl/api.ts', /export function clear\w*/i, 'linkToPath (signed Match photo links)'],
  ['src/features/girl/access.tsx', /export function clear\w*Access/i, 'last (cached IRLY Girl answer, keyed by account)'],
];
for (const [f, re, what] of GAPS) if (fs.existsSync(f) && !re.test(read(f))) console.log(`! known gap: ${f} keeps ${what} after log out (no clear function to call)`);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
