import { create } from 'zustand';

type IntroState = { done: boolean; finish: () => void };

/**
 * The entrance of the app plays once per launch. Screens under it (the
 * Home hero) wait for `done` to start their own entrance, so the city
 * zooms in exactly as the curtain lifts.
 */
export const useIntro = create<IntroState>((set) => ({
  done: false,
  finish: () => set({ done: true }),
}));
