/**
 * The one place for who runs IRLY, how to reach them, where the legal texts
 * stand and whether demonstration content is shown. Every screen reads these
 * values from here; nothing is repeated elsewhere.
 *
 * Values marked LEGAL_REQUIRED are not known yet and must be filled in (and
 * the texts reviewed by a lawyer) before launch.
 */

export const LEGAL_REQUIRED = '[LEGAL INFORMATION REQUIRED]';

export const APP = {
  /** Trade name shown in the app. */
  name: 'IRLY',
  /** Registered company that operates IRLY. */
  legalEntity: LEGAL_REQUIRED,
  /** Registered address of that company. */
  legalAddress: LEGAL_REQUIRED,
  /** Country whose law governs the Terms, and the competent courts. */
  governingLaw: LEGAL_REQUIRED,
  /** Help and account questions. */
  supportEmail: LEGAL_REQUIRED,
  /** Privacy requests (access, deletion, objections). */
  privacyEmail: LEGAL_REQUIRED,
  /** Safety reports that cannot wait (threats, minors, emergencies → local police first). */
  safetyEmail: LEGAL_REQUIRED,
  /** Minimum age to use IRLY (checked at signup and on the server). */
  minimumAge: 18,
  /** Public web address of the app (links people share). */
  webUrl: 'https://alafrench7593-a11y.github.io/irly',
} as const;

/** Versions and dates of the legal texts shown in the app. */
export const LEGAL_VERSIONS = {
  privacy: { version: '0.1 (draft)', updated: '2026-10-07' },
  terms: { version: '0.1 (draft)', updated: '2026-10-07' },
  guidelines: { version: '0.1 (draft)', updated: '2026-10-07' },
} as const;

/**
 * Demonstration content (example people, sessions, events, places,
 * services, chats, notifications and lives) is for presentations only. It
 * is off unless the build sets EXPO_PUBLIC_DEMO=1: real members only ever
 * see real data.
 */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

/** A link to a screen of the web app, for sharing. */
export const webLink = (path: string) => `${APP.webUrl}${path.startsWith('/') ? path : `/${path}`}`;

/** True when a value still needs real legal information. */
export const isMissing = (v: string) => v === LEGAL_REQUIRED;
