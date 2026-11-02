import AsyncStorage from '@react-native-async-storage/async-storage';

/** The storage shape zustand's persist takes (StateStorage). No store of its own: each store that uses it is named with storageName() and wiped by its owner. */
type Storage = {
  getItem: (name: string) => Promise<string | null>;
  setItem: (name: string, value: string) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
};

/**
 * Storage that never throws: private browsing, sandboxed web views and
 * quota errors degrade to in-memory state instead of breaking the app.
 * Every persisted store the first frame waits for uses it (state/store,
 * state/appSpace, i18n): a storage that throws would leave the store
 * unhydrated and the splash screen up for good.
 *
 * Those stores all keep JSON: a value that no longer parses (cut short by a
 * crash, edited by hand) is dropped and removed here, so the store starts
 * from its defaults instead of failing to hydrate on every launch.
 */
const memory = new Map<string, string>();
const parses = (v: string): boolean => {
  try {
    JSON.parse(v);
    return true;
  } catch {
    return false;
  }
};
export const safeStorage: Storage = {
  getItem: async (name) => {
    let v: string | null;
    try {
      v = (await AsyncStorage.getItem(name)) ?? memory.get(name) ?? null;
    } catch {
      v = memory.get(name) ?? null;
    }
    if (v === null || parses(v)) return v;
    memory.delete(name);
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // ignore: the bad value is skipped either way
    }
    return null;
  },
  setItem: async (name, value) => {
    memory.set(name, value);
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      // keep the in-memory copy
    }
  },
  removeItem: async (name) => {
    memory.delete(name);
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};
