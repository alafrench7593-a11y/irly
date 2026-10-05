import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useCallback } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { fr } from './fr';

/**
 * IRLY speaks English and French. Strings are written in English in the
 * code and looked up in the French dictionary (src/i18n/fr.ts) when French
 * is active: a missing translation falls back to English, never to a key.
 * `{name}` placeholders are filled from `vars`.
 *
 *   const t = useT();
 *   t('New in {city}', { city: 'Dubai' })  // "Nouvelle à Dubai"… per dictionary
 */
export type Lang = 'en' | 'fr';
export type LangSetting = Lang | 'auto';

export const LANGS: { id: LangSetting; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
];

function deviceLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === 'fr' ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

type LangState = { setting: LangSetting; set: (s: LangSetting) => void };

export const useLangStore = create<LangState>()(
  persist((set) => ({ setting: 'auto', set: (setting) => set({ setting }) }), {
    name: 'irly-lang',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

export const resolveLang = (s: LangSetting): Lang => (s === 'auto' ? deviceLang() : s);

/**
 * Sentences generated from data (regional seed content): matched by shape
 * when there is no exact key, their parts translated on their own.
 */
const PATTERNS: [RegExp, string, string[]][] = [
  [/^In (.+) since (\d{4})$/, 'In {city} since {year}', ['city', 'year']],
  [/^(.+)\. Members across (.+) meet in real life, then keep the conversation going here\.$/, '{tagline}. Members across {city} meet in real life, then keep the conversation going here.', ['tagline', 'city']],
  [/^Welcome to (.+)! Next meetup is on the calendar, see you there\?$/, 'Welcome to {city}! Next meetup is on the calendar, see you there?', ['city']],
];

function byPattern(text: string): string | undefined {
  for (const [re, key, names] of PATTERNS) {
    const m = re.exec(text);
    if (m && fr[key]) return fr[key].replace(/\{(\w+)\}/g, (_, k) => {
      const v = m[names.indexOf(k) + 1] ?? '';
      return fr[v] ?? v;
    });
  }
  return undefined;
}

export function translate(lang: Lang, text: string, vars?: Record<string, string | number>): string {
  const base = lang === 'fr' ? (fr[text] ?? byPattern(text) ?? text) : text;
  if (!vars) return base;
  return base.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Locale for dates and times in the current language. */
export function dateLocale(): string {
  return resolveLang(useLangStore.getState().setting) === 'fr' ? 'fr-FR' : 'en-GB';
}

export type T = (text: string, vars?: Record<string, string | number>) => string;

/** The current language. */
export function useLang(): Lang {
  return resolveLang(useLangStore((s) => s.setting));
}

/** Translate function for the current language; re-renders on change. */
export function useT(): T {
  const lang = useLang();
  return useCallback((text: string, vars?: Record<string, string | number>) => translate(lang, text, vars), [lang]);
}

/** Outside React (toasts fired from handlers, stores). */
export function t(text: string, vars?: Record<string, string | number>): string {
  return translate(resolveLang(useLangStore.getState().setting), text, vars);
}
