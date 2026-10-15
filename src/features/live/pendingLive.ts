import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { storageName } from '@/config/app';
import type { PendingLive } from './livePublish';

/**
 * Lives being published whose outcome is not known yet, kept on the phone
 * (they survive the app being killed). Settled by the composer when the member
 * gives up on one, or at the next start of the app (settlePending).
 */
type Journal = { byId: Record<string, PendingLive> };

export const usePendingLives = create<Journal>()(
  persist(() => ({ byId: {} }) as Journal, {
    name: storageName('irly-live-pending'),
    storage: createJSONStorage(() => AsyncStorage),
    // A publish started before the stored journal was read is kept alongside it.
    merge: (stored, current) => ({ byId: { ...((stored as Journal | undefined)?.byId ?? {}), ...current.byId } }),
  }),
);

/** Started in this run of the app: settled by the composer, never by the start-up sweep. */
const startedHere = new Set<string>();

export const pendingJournal = {
  put(p: PendingLive): void {
    startedHere.add(p.postId);
    usePendingLives.setState((s) => ({ byId: { ...s.byId, [p.postId]: p } }));
  },
  drop(postId: string): void {
    if (!usePendingLives.getState().byId[postId]) return;
    usePendingLives.setState((s) => {
      const next = { ...s.byId };
      delete next[postId];
      return { byId: next };
    });
  },
  get(postId: string): PendingLive | undefined {
    return usePendingLives.getState().byId[postId];
  },
  /** Left by an earlier run of the app (killed or closed mid-publish), for this member. */
  leftOver(uid: string): PendingLive[] {
    return Object.values(usePendingLives.getState().byId).filter((p) => p.uid === uid && !startedHere.has(p.postId));
  },
  /** Signed out or account deleted: nothing of the previous member is kept. */
  clear(): void {
    startedHere.clear();
    usePendingLives.setState({ byId: {} });
  },
};
