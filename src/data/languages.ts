import { dateLocale, t as tx } from '@/i18n';

/** Languages a member can say they speak (signup and Edit profile). Stored as written here, in their own language. */
export const LANGUAGES = ['English', 'Français', 'العربية', 'हिन्दी', 'Русский', 'Español', 'Italiano', 'Deutsch', 'Filipino', 'اردو', 'Português', 'Bahasa'];

/**
 * A language's name in English (the key the dictionary translates), from
 * the way it was stored: its own name (signup), its English name (the
 * example members) or its code (IRLY Girl).
 */
const ENGLISH_NAME: Record<string, string> = {
  Français: 'French',
  العربية: 'Arabic',
  हिन्दी: 'Hindi',
  Русский: 'Russian',
  Español: 'Spanish',
  Italiano: 'Italian',
  Deutsch: 'German',
  اردو: 'Urdu',
  Português: 'Portuguese',
  en: 'English',
  fr: 'French',
  ar: 'Arabic',
  es: 'Spanish',
  ru: 'Russian',
  it: 'Italian',
  de: 'German',
  hi: 'Hindi',
  id: 'Indonesian',
};

/** A language as the app language names it: « Anglais » in French for "English" or "en", "French" in English for « Français ». */
export function languageName(stored: string): string {
  return tx(ENGLISH_NAME[stored] ?? stored);
}

/**
 * The languages someone speaks, in the app language: « Français, Anglais ».
 * `inSentence`: French writes language names in lower case inside a
 * sentence (« Parle français, anglais »).
 */
export function languageList(stored: readonly string[], inSentence = false): string {
  const names = stored.map(languageName);
  return (inSentence && dateLocale() === 'fr-FR' ? names.map((n) => n.toLocaleLowerCase('fr-FR')) : names).join(', ');
}
