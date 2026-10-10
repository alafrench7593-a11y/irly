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
  /** Who operates IRLY: an individual (sole operator), not a company. */
  operatorType: 'individual' as 'individual' | 'company',
  /** Full legal name of the person who operates IRLY. */
  legalEntity: 'Samuel Princivil',
  /** Postal address of the operator. */
  legalAddress: 'Dubai Digital Park, Dubai Silicon Oasis, Dubai, United Arab Emirates',
  /** Law that governs the Terms, and the competent courts. */
  governingLaw: 'the laws of the Emirate of Dubai and the applicable federal laws of the United Arab Emirates, and the courts of Dubai have jurisdiction',
  /** Data protection law that applies to the operator. */
  dataLaw: 'the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021)',
  /** Where the IRLY database and files are hosted. */
  hosting: 'the European Union (Ireland), with Supabase on Amazon Web Services',
  /** Help and account questions. */
  supportEmail: 'getirly@gmail.com',
  /** Privacy requests (access, deletion, objections). */
  privacyEmail: 'getirly@gmail.com',
  /** Safety reports that cannot wait (threats, minors, emergencies → local police first). */
  safetyEmail: 'getirly@gmail.com',
  /** IRLY's own accounts (Settings → Follow IRLY, the website footer). */
  instagram: 'https://www.instagram.com/irlyofficial/',
  tiktok: 'https://www.tiktok.com/@irlyofficial',
  /** Minimum age to use IRLY (checked at signup and on the server). */
  minimumAge: 18,
  /** Public web address of the app (links people share). */
  webUrl: 'https://alafrench7593-a11y.github.io/irly',
} as const;

/** Versions and dates of the legal texts shown in the app. */
export const LEGAL_VERSIONS = {
  privacy: { version: '0.3 (draft)', updated: '2026-10-09' },
  terms: { version: '0.3 (draft)', updated: '2026-10-09' },
  guidelines: { version: '0.2 (draft)', updated: '2026-10-07' },
} as const;

/**
 * Demonstration content (example people, sessions, events, places,
 * services, chats, notifications and lives) is for presentations only. It
 * is off unless the build sets EXPO_PUBLIC_DEMO=1: real members only ever
 * see real data.
 */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

/**
 * Storage name for something kept on the device. The demo is served from the
 * same site as the real app (getirly.com/demo and /app share one browser
 * storage), so it keeps everything under its own names and can never touch
 * a member's real data.
 */
export const storageName = (name: string) => (DEMO ? `${name}-demo` : name);

/** A link to a screen of the web app, for sharing. */
export const webLink = (path: string) => `${APP.webUrl}${path.startsWith('/') ? path : `/${path}`}`;

/** True when a value still needs real legal information. */
export const isMissing = (v: string) => v === LEGAL_REQUIRED;
