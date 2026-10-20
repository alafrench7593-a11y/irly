import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { storageName } from '@/config/app';

/**
 * The library photo used for the last activity created on this phone, per
 * type of activity: « Surprise me » never hands it back the next time while
 * another photo of that type exists. Only a convenience: lost, the next
 * draw is simply random.
 */
type LastPhotoState = {
  last: Record<string, string>;
  remember: (kind: string, url: string) => void;
};

const useLastPhotoStore = create<LastPhotoState>()(
  persist(
    (set) => ({
      last: {},
      remember: (kind, url) => set((s) => ({ last: { ...s.last, [kind]: url } })),
    }),
    { name: storageName('irly-last-photo'), storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);

/** The library photo last published for this type of activity (null: none yet). */
export const lastLibraryPhoto = (kind: string): string | null => useLastPhotoStore.getState().last[kind] ?? null;

/** Kept once an activity is published with this library photo. */
export const rememberLibraryPhoto = (kind: string, url: string): void => useLastPhotoStore.getState().remember(kind, url);
