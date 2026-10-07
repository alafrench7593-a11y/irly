import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { QuizAnswers } from './fit';

/** The member's quiz answers, kept on the device so results and test plans survive restarts. */
export const useBaliStore = create<{ answers: QuizAnswers; setAnswers: (a: QuizAnswers) => void }>()(
  persist((set) => ({ answers: {}, setAnswers: (answers) => set({ answers }) }), { name: 'irly-bali', storage: createJSONStorage(() => AsyncStorage) }),
);
