import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Reasons } from './compat';
import type { MatchProfileDraft, ReportCategory } from './types';

/**
 * On-device IRLY Match state, used only when the app runs without a
 * backend. With Supabase configured and a session, the same information
 * lives server-side (irly_match_* tables) and this store is not used.
 */
export type LocalMatch = { id: string; userId: string; conversationId: string; score: number; reasons: Reasons; createdAt: number };

type GirlState = {
  onboarded: boolean;
  profile: MatchProfileDraft | null;
  decisions: Record<string, 'like' | 'pass'>;
  saved: Record<string, true>;
  matches: LocalMatch[];
  blocked: Record<string, true>;
  reports: { userId: string; category: ReportCategory; details?: string; at: number }[];
};

type GirlActions = {
  setOnboarded: () => void;
  setProfile: (p: MatchProfileDraft) => void;
  decide: (userId: string, d: 'like' | 'pass') => void;
  toggleSaved: (userId: string, on: boolean) => void;
  addMatch: (m: LocalMatch) => void;
  removeMatch: (matchId: string) => void;
  block: (userId: string) => void;
  report: (userId: string, category: ReportCategory, details?: string) => void;
  reset: () => void;
};

const initial: GirlState = { onboarded: false, profile: null, decisions: {}, saved: {}, matches: [], blocked: {}, reports: [] };

export const useGirlStore = create<GirlState & GirlActions>()(
  persist(
    (set, get) => ({
      ...initial,
      setOnboarded: () => set({ onboarded: true }),
      setProfile: (profile) => set({ profile }),
      decide: (userId, d) => set({ decisions: { ...get().decisions, [userId]: d } }),
      toggleSaved: (userId, on) => {
        const saved = { ...get().saved };
        if (on) saved[userId] = true;
        else delete saved[userId];
        set({ saved });
      },
      addMatch: (m) => {
        // One match per person, like the unique (user_a, user_b) constraint.
        if (get().matches.some((x) => x.userId === m.userId)) return;
        set({ matches: [m, ...get().matches] });
      },
      removeMatch: (matchId) => {
        const m = get().matches.find((x) => x.id === matchId);
        const decisions = { ...get().decisions };
        if (m) delete decisions[m.userId];
        set({ matches: get().matches.filter((x) => x.id !== matchId), decisions });
      },
      block: (userId) => {
        const decisions = { ...get().decisions };
        delete decisions[userId];
        set({
          blocked: { ...get().blocked, [userId]: true },
          matches: get().matches.filter((x) => x.userId !== userId),
          decisions,
        });
      },
      report: (userId, category, details) => set({ reports: [...get().reports, { userId, category, details, at: Date.now() }] }),
      reset: () => set(initial),
    }),
    { name: 'irly-girl', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);
