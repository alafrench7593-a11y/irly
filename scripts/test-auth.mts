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
  sinceFromArrival,
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
  // Chat messages not delivered yet (their text): cleared with the account's chats.
  'irly-chat-pending': /m\.clearChatCache\(\)/,
  'irly-space': /\bresetAppSpace\b/,
  // The community pages kept on the phone (posts, rights, header): cleared with the community cache.
  'irly-community-cache': /m\.clearCommunityCache\(\)/,
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

// Sign-up answers restored on a new phone: "How long have you been here?" comes back from the arrival date.
const DAY = 86_400_000;
const NOW = Date.parse('2026-10-27T12:00:00Z');
const ago = (days: number) => new Date(NOW - days * DAY).toISOString().slice(0, 10);
expect(sinceFromArrival(null, NOW) === 'local', 'restore: no arrival date is "I am from here"');
expect(sinceFromArrival(ago(0), NOW) === 'new', 'restore: just arrived stays a newcomer');
expect(sinceFromArrival(ago(120), NOW) === 'year', 'restore: less than a year');
expect(sinceFromArrival(ago(730), NOW) === 'years', 'restore: a few years');
expect(sinceFromArrival('not a date', NOW) === undefined, 'restore: an unreadable date guesses nothing');
// Every sign-up answer that shapes the app reaches the server (toRow) and comes back (readBack).
const toRow = account.slice(account.indexOf('function toRow'), account.indexOf('/** The fields a member can change'));
for (const col of ['first_name', 'birthdate', 'gender', 'city_id', 'country', 'languages', 'bio', 'faith', 'arrived_at', 'interests', 'activity_prefs', 'intentions', 'member_types'])
  expect(new RegExp(`\\b${col}\\b[:,]`).test(toRow), `publish: sign-up answer ${col} is sent to the server`);
const readBack = account.slice(account.indexOf('async function readBack'), account.indexOf('async function writeProfile'));
for (const field of ['name', 'gender', 'age', 'country', 'languages', 'bio', 'faith', 'arrivedAt', 'since', 'types', 'interests', 'activities', 'lookingFor'])
  expect(new RegExp(`\\b${field}:`).test(readBack), `restore: ${field} comes back from the server`);

// Module caches of server data that live outside the wipe (reported to their owners, not failed here).
const GAPS: [string, RegExp, string][] = [
  ['src/features/server/covers.ts', /export function clear\w*Cover/i, 'coverCache (community cover paths)'],
  ['src/features/network/api.ts', /export function clear\w*/i, 'signed (signed photo links)'],
  ['src/features/girl/api.ts', /export function clear\w*/i, 'linkToPath (signed Match photo links)'],
  ['src/features/girl/access.tsx', /export function clear\w*Access/i, 'last (cached IRLY Girl answer, keyed by account)'],
];
for (const [f, re, what] of GAPS) if (fs.existsSync(f) && !re.test(read(f))) console.log(`! known gap: ${f} keeps ${what} after log out (no clear function to call)`);

/* ───────── Sign-in links: PKCE, exact redirect URLs, no session from a link this device never asked for ───────── */
const supa = read('src/lib/supabase.ts');
expect(/flowType: 'pkce'/.test(supa), 'links: the Supabase client uses the PKCE flow');
expect(!/flowType: 'implicit'/.test(supa), 'links: the implicit flow (#access_token= links) is gone');
expect(/detectSessionInUrl: Platform\.OS === 'web'/.test(supa), 'links: only the web reads the session from its own URL');
// Both scripts that configure the live project: an exact list, set (never merged with the live one), without a wildcard host.
const WANTED_REDIRECTS = ['https://getirly.com/**', 'https://www.getirly.com/**', 'https://alafrench7593-a11y.github.io/irly/**', 'irly://**', 'http://localhost:8081/**', 'http://localhost:19006/**'];
for (const f of ['scripts/deploy-db.mjs', 'scripts/auth-config.mjs']) {
  const src = read(f);
  const list = src.match(/const REDIRECTS = \[([^\]]*)\]/);
  const urls = list ? [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  expect(urls.length > 0, `redirects: ${f} declares its redirect list`);
  is(JSON.stringify(urls), JSON.stringify(WANTED_REDIRECTS), `redirects: ${f} allows exactly the IRLY URLs`);
  for (const u of urls) expect(!/\*/.test(u.replace(/\/\*\*$/, '')), `redirects: ${f} has no wildcard host or scheme (${u})`, u);
  const code = src.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
  expect(!/\*\.vercel\.app|trycloudflare|'exp:\/\/\*\*'/.test(code), `redirects: ${f} never allows *.vercel.app, a tunnel or exp://** (outside comments)`);
  expect(!/new Set\(\[?\.\.\.String\(current\.uri_allow_list|wanted\.forEach|allow\.add\(/.test(src), `redirects: ${f} sets the list, never merges it with the live one`);
  expect(/uri_allow_list: allow\.join\(','\)/.test(src), `redirects: ${f} sends exactly its list`);
  expect(/IRLY_DEV_REDIRECTS/.test(src) && /bare\.includes\('\*'\)/.test(src), `redirects: ${f} accepts a dev URL only on request, never with a wildcard`);
}
const deploy = read('scripts/deploy-db.mjs');
expect(/mailer_autoconfirm: !ownSmtp/.test(deploy) && /ownSmtp === null \? \{\}/.test(deploy), 'email confirmation: auto-confirm only without a custom SMTP, untouched when the config is unreadable');
expect(/WARNING: no custom SMTP/.test(deploy), 'email confirmation: auto-confirm is announced loudly');
expect(!/mailer_autoconfirm: true/.test(read('scripts/auth-config.mjs')), 'email confirmation: auth-config never switches auto-confirm on');
expect(/password_min_length: Math\.max\(8,/.test(read('scripts/auth-config.mjs')), 'passwords: 8 characters at least on the server');
// The app side: every sign-in that ends on a link marks this device first; completeFromUrl checks it before any session.
const fnBody = (name: string) => {
  const start = account.indexOf(`function ${name}(`);
  return start < 0 ? '' : account.slice(start, account.indexOf('\n}\n', start));
};
for (const [fn, kind] of [['sendCode', 'magiclink'], ['signUpWithPassword', 'signup'], ['sendPasswordReset', 'recovery'], ['signInWithProvider', 'oauth']]) {
  const body = fnBody(fn);
  const mark = body.indexOf(`markPending('${kind}')`);
  const call = body.search(/auth\.(signInWithOtp|signUp|resetPasswordForEmail|signInWithOAuth)\(/);
  expect(mark > 0 && call > mark, `links: ${fn} marks a pending ${kind} sign-in before asking the server`);
}
const complete = fnBody('completeFromUrl');
const readsPending = complete.indexOf('const started = await readPending();');
const guard = readsPending < 0 ? -1 : complete.indexOf('if (!started) return false;', readsPending);
expect(guard > 0, 'links: completeFromUrl refuses a link when this device started no sign-in');
for (const call of ['exchangeCodeForSession(', 'getSession(']) {
  const at = complete.indexOf(call);
  expect(guard > 0 && at > guard, `links: completeFromUrl checks the pending sign-in before ${call.slice(0, -1)}`);
}
expect(/exchangeCodeForSession\(link\.code, link\.flowId \? \{ flowId: link\.flowId \}/.test(complete), 'links: a ?code= is exchanged with its flow id (PKCE)');
expect(!/setSession\(/.test(complete) && /if \(!link\.code\) return false;/.test(complete), 'links: a session is never set from #access_token= (PKCE codes only, web and phones)');
expect(/auth\.initialize\(\)/.test(complete) && /signedInSince\(data\.session\.user\.last_sign_in_at, started\.at\)/.test(complete), 'links (web): a failed exchange with an older session is not reported as signed in');
// The pending sign-in ends with the sign-in: finished another way, cancelled, or logged out.
for (const fn of ['verifyCode', 'signInWithPassword', 'verifyPhoneCode', 'signInWithAppleNative', 'endSession'])
  expect(/await clearPending\(\);/.test(fnBody(fn)), `links: ${fn} ends the pending sign-in`);
expect(/res\.type !== 'success' \|\| !res\.url\) \{[^}]*await clearPending\(\);/.test(fnBody('signInWithProvider')), 'links: closing the Apple / Google sheet ends the pending sign-in');
expect(/event === 'SIGNED_OUT'\) \{[^}]*clearPending\(\)/.test(account), 'links: signed out elsewhere ends the pending sign-in');
expect(/await clearPending\(\);\s*return recovery/.test(complete), 'links: the pending sign-in is used once');
expect(/event === 'PASSWORD_RECOVERY'/.test(account), 'links: a password reset session restores the profile like a sign-in');
expect(/signInWithIdToken\(\{ provider: 'apple', token: cred\.identityToken, nonce: raw \}\)/.test(account), 'links: Apple on iPhone still signs in with its token, no link');
const screen = read('src/app/account.tsx');
expect(/how === 'recovery'\) setMode\('reset'\)/.test(screen), 'links: a password reset link opens the new-password form');
expect(!/url\.includes\('access_token'\)/.test(screen), 'links: the Account screen no longer waits for #access_token= only');
// The pure rules, run here (taken from account.ts as written, its types removed).
const { stripTypeScriptTypes } = await import('node:module');
const pure = ['export const PENDING_MS', 'export function pendingFresh(', 'export function readAuthLink(', 'const CLOCK_SKEW_MS', 'export function signedInSince(', 'const INVISIBLE', 'export function clip(', 'export function cleanName(']
  .map((head) => {
    const start = account.indexOf(head);
    if (start < 0) return '';
    return account.slice(start, head.includes('const') ? account.indexOf(';\n', start) + 2 : account.indexOf('\n}\n', start) + 3);
  })
  .join('\n')
  .replace(/^export /gm, '');
let made: unknown = null;
try {
  made = new Function(`${(stripTypeScriptTypes as (code: string) => string)(pure)}\nreturn { PENDING_MS, pendingFresh, readAuthLink, signedInSince, clip, cleanName };`)();
} catch (e) {
  expect(false, 'pending: the link rules of account.ts can be read and run', String(e));
}
const fallback = {
  PENDING_MS: 0,
  pendingFresh: () => true,
  readAuthLink: () => ({ code: 'x', flowId: null, accessToken: 'x', refreshToken: 'x', recovery: true }),
  signedInSince: () => true,
  clip: (s: string) => s,
  cleanName: (s: string) => s,
};
const rules = (made ?? fallback) as {
  PENDING_MS: number;
  pendingFresh: (at: unknown, now: number) => boolean;
  readAuthLink: (url: string) => { code: string | null; flowId: string | null; accessToken: string | null; refreshToken: string | null; recovery: boolean };
  signedInSince: (lastSignInAt: string | null | undefined, startedAt: number) => boolean;
  clip: (text: string, max: number) => string;
  cleanName: (name: string) => string;
};
is(rules.PENDING_MS, 3_600_000, 'pending: a sign-in waits for its link one hour');
is(rules.pendingFresh(null, NOW), false, 'pending: no sign-in started here → the link is refused');
is(rules.pendingFresh(undefined, NOW), false, 'pending: nothing stored → refused');
is(rules.pendingFresh('1700000000000', NOW), false, 'pending: a stored value that is not a time → refused');
is(rules.pendingFresh(NOW - 5 * 60_000, NOW), true, 'pending: started 5 minutes ago → accepted');
is(rules.pendingFresh(NOW - 3_600_000, NOW), false, 'pending: started an hour ago → refused');
is(rules.pendingFresh(NOW + 60_000, NOW), false, 'pending: started "in the future" (a tampered value) → refused');
const pkce = rules.readAuthLink('irly://account?reset=1&sb_flow_id=abcdef0123456789&code=4f2c-11');
expect(pkce.code === '4f2c-11' && pkce.flowId === 'abcdef0123456789' && pkce.recovery && !pkce.accessToken, 'link: a PKCE reset link gives its code, flow id and "recovery"', pkce);
const legacy = rules.readAuthLink('irly://account#access_token=AT&refresh_token=RT&type=recovery');
expect(legacy.accessToken === 'AT' && legacy.refreshToken === 'RT' && legacy.recovery && !legacy.code, 'link: an older fragment link is read, for the pending check to decide', legacy);
const inQuery = rules.readAuthLink('irly://account?access_token=AT&refresh_token=RT');
expect(!inQuery.accessToken && !inQuery.refreshToken, 'link: tokens in the query are never taken for a session', inQuery);
expect(!rules.readAuthLink('irly://account').code && !rules.readAuthLink('irly://account?code=x').recovery, 'link: no code without one, no reset without reset=1');
is(rules.signedInSince(new Date(NOW + 1000).toISOString(), NOW), true, 'web link: a sign-in after the start is this one');
is(rules.signedInSince(new Date(NOW - 5 * 60_000).toISOString(), NOW), true, 'web link: a few minutes of clock difference are allowed');
is(rules.signedInSince(new Date(NOW - 2 * 86_400_000).toISOString(), NOW), false, 'web link: an older session is not this sign-in');
is(rules.signedInSince(undefined, NOW), false, 'web link: no sign-in time → not this sign-in');

/* ───────── Names and bios: cut as the server counts, no invisible characters ───────── */
const emoji = 'A' + '\u{1F600}'.repeat(45);
is(Array.from(rules.cleanName(emoji)).length, 40, 'names: 40 characters as the server counts them (emoji whole)');
expect(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(rules.cleanName('A' + '\u{1F600}'.repeat(30))), 'names: never a half emoji at the end');
is(rules.clip('\u{1F600}'.repeat(301), 300), '\u{1F600}'.repeat(300), 'bios: 300 emoji kept whole');
is(rules.cleanName('\u202Eevil\u202C'), 'evil', 'names: bidi overrides removed');
is(rules.cleanName(' Wen\nAdmin\u200B '), 'WenAdmin', 'names: line breaks and zero-width spaces removed');
is(rules.cleanName('\u0645\u0647\u0631\u200C\u0646\u0627\u0632'), '\u0645\u0647\u0631\u200C\u0646\u0627\u0632', 'names: a ZWNJ inside a Persian name stays');
is(rules.cleanName('\u200B \u200B'), '', 'names: invisible only → empty (refused as "Add your first name")');
for (const slice of ['.slice(0, 40)', '.slice(0, 300)']) expect(!account.includes(slice), `names: no UTF-16 ${slice} left in account.ts`);

/* ───────── Push taps open app screens only ───────── */
const push = read('src/features/push/push.ts');
const pushRule = push.match(/data\?\.url === 'string' && (\/.+?\/)\.test\(data\.url\)/);
expect(Boolean(pushRule), 'push: the tapped url is checked with one rule');
if (pushRule) {
  const re = new Function(`return ${pushRule[1]}`)() as RegExp;
  for (const ok of ['/a/123', '/notifications', '/c/abc?x=1']) expect(re.test(ok), `push: ${ok} opens in the app`);
  for (const bad of ['//evil.example/x', '/\\evil.example', 'https://evil.example', 'evil']) expect(!re.test(bad), `push: ${bad} is refused`);
}

/* ───────── Sign in with Apple: token revoked at deletion (IOS-01) ───────── */
expect(/keepAppleToken\(cred\.authorizationCode\)/.test(account), 'apple: the authorization code goes to the server after a native sign-in');
const del = account.slice(account.indexOf('export async function deleteServerAccount'), account.indexOf('/** Download my data'));
expect(del.indexOf("invoke('apple-revoke'") > 0 && del.indexOf("invoke('apple-revoke'") < del.indexOf("rpc('delete_my_account')"), 'apple: the token is revoked before the account is deleted');
const fn = read('supabase/functions/apple-revoke/index.ts');
expect(/Deno\.env\.get/.test(fn) && !/BEGIN PRIVATE KEY-----[A-Za-z0-9+/]/.test(fn), 'apple: the Apple key comes from the function environment only');
expect(!/service_role|SERVICE_ROLE/i.test(account), 'apple: no service role in the app');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
