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

// Web: the page says which language it is in and asks browsers not to
// translate it. A browser translating the app rewrites its text under React,
// garbles both languages and can freeze the inputs.
if (typeof document !== 'undefined') {
  const mark = () => {
    document.documentElement.lang = resolveLang(useLangStore.getState().setting);
    document.documentElement.setAttribute('translate', 'no');
  };
  mark();
  useLangStore.subscribe(mark);
}

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

/** Singular forms, used when {n} is 1 (in both languages). */
const ONE: Record<string, string> = {
  '{n} members': '{n} member',
  '{n} votes': '{n} vote',
  '{n} results for “{q}” in the city guide': '{n} result for “{q}” in the city guide',
  '{n} more characters (minimum {min})': '{n} more character (minimum {min})',
  '{n} posts this week': '{n} post this week',
  '{n} sessions this week in {city}': '{n} session this week in {city}',
  '{n} plans here': '{n} plan here',
  '{n} people into {what}': '{n} person into {what}',
  '{n} groups': '{n} group',
  '{n} reviews': '{n} review',
  '{n} activities': '{n} activity',
  '{n} communities': '{n} community',
  '{n} people': '{n} person',
  '{n} places': '{n} place',
  '{n} posts this week.': '{n} post this week.',
  '{n} new members ({total} in total). Say hi!': '{n} new member ({total} in total). Say hi!',
  '{n} members.': '{n} member.',
};

export function translate(lang: Lang, rawText: string, vars?: Record<string, string | number>): string {
  // English uses the singular for 1 only; French for 0 and 1 (« 0 activité »).
  const n = vars ? Number(vars.n) : NaN;
  const singular = lang === 'fr' ? Math.abs(n) < 2 : n === 1;
  const text = singular && ONE[rawText] ? ONE[rawText] : rawText;
  const base = lang === 'fr' ? (fr[text] ?? byPattern(text) ?? text) : text;
  if (!vars) return base;
  return base.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? place(lang, String(vars[k])) : m));
}

/** City names that French spells differently ("Dubaï"); neighbourhoods such as "Dubai Marina" keep their name. */
const PLACES_FR: Record<string, string> = { Dubai: 'Dubaï' };
const place = (lang: Lang, v: string) => (lang === 'fr' ? (PLACES_FR[v] ?? v) : v);

const LABEL_SEP = /(, |\. |: | · )/;

/**
 * Screen-reader labels are often built from parts ("Padel, Tomorrow · 20:00",
 * "Sport. Find people to play with"): translated whole when the dictionary
 * has the sentence, otherwise part by part. Names and places pass through.
 */
export function localizeLabel(lang: Lang, label: string | undefined): string | undefined {
  if (!label || lang === 'en') return label;
  const whole = translate(lang, label);
  if (whole !== label) return whole;
  // Longest run of parts the dictionary knows, so "Sun, sea and sand" stays one phrase.
  const parts = label.split(LABEL_SEP);
  const out: string[] = [];
  for (let i = 0; i < parts.length; ) {
    if (i % 2 === 1) {
      out.push(parts[i++]); // a separator
      continue;
    }
    let j = parts.length - 1;
    for (; j > i; j -= 2) {
      const run = parts.slice(i, j + 1).join('');
      if (translate(lang, run) !== run) break;
    }
    out.push(translate(lang, parts.slice(i, j + 1).join('')));
    i = j + 1;
  }
  return out.join('');
}

/** Same, outside React (labels built in handlers or in non-component code). */
export function a11y(label: string | undefined): string | undefined {
  return localizeLabel(resolveLang(useLangStore.getState().setting), label);
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
