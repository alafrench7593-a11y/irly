import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { storageName } from '@/config/app';

/**
 * Which IRLY the member is using: the whole app (tabs, every page, every
 * flow) in its Mixte form, or the same app as IRLY Girl (Girl look, Girl
 * content). Only a preference for what to show: entering Girl is checked by
 * the server (features/girl/access) and every Girl row is guarded by RLS,
 * so setting this to 'girl' on a man's phone shows him closed doors, nothing more.
 */
export type AppSpace = 'mixte' | 'girl';

type SpaceState = {
  space: AppSpace;
  setSpace: (space: AppSpace) => void;
};

export const useSpaceStore = create<SpaceState>()(
  persist(
    (set) => ({
      space: 'mixte',
      setSpace: (space) => set({ space }),
    }),
    { name: storageName('irly-space'), storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);

/** The space the member is in. */
export const useAppSpace = (): AppSpace => useSpaceStore((s) => s.space);

export const setAppSpace = (space: AppSpace): void => useSpaceStore.getState().setSpace(space);

/** Back to Mixte: used on log out, account deletion and when Girl access is refused. */
export const resetAppSpace = (): void => useSpaceStore.getState().setSpace('mixte');
