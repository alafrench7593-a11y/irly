import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Where the sign-in session lives on a phone: the iOS Keychain / Android
 * Keystore (encrypted by the system, readable by IRLY only, after the
 * phone's first unlock so background refresh still works), instead of plain
 * app storage. A session is a few kilobytes, so it is split in parts. A
 * session saved by an older version is moved here on first read, so nobody
 * is signed out by the update. If the secure store ever fails, plain
 * storage is used rather than losing the session.
 */
const PART = 1800;
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
const safe = (key: string) => key.replace(/[^\w.-]/g, '_');

async function readSecure(key: string): Promise<string | null> {
  const n = Number(await SecureStore.getItemAsync(`${safe(key)}.n`, OPTS));
  if (!n) return null;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = await SecureStore.getItemAsync(`${safe(key)}.${i}`, OPTS);
    if (p === null) return null;
    parts.push(p);
  }
  return parts.join('');
}

async function clearSecure(key: string): Promise<void> {
  const n = Number(await SecureStore.getItemAsync(`${safe(key)}.n`, OPTS)) || 0;
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${safe(key)}.${i}`, OPTS);
  await SecureStore.deleteItemAsync(`${safe(key)}.n`, OPTS);
}

async function writeSecure(key: string, value: string): Promise<void> {
  await clearSecure(key);
  const n = Math.ceil(value.length / PART) || 1;
  for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${safe(key)}.${i}`, value.slice(i * PART, (i + 1) * PART), OPTS);
  await SecureStore.setItemAsync(`${safe(key)}.n`, String(n), OPTS);
}

/**
 * Supabase reads the session before every request. The Keychain is slow
 * (several calls per read), so the session is kept in memory after the first
 * read and written through: one Keychain read per launch, not one per request.
 * Writes are queued so two refreshes never interleave their parts.
 */
const memory = new Map<string, string | null>();
let writes: Promise<unknown> = Promise.resolve();
const queue = <T>(job: () => Promise<T>): Promise<T> => {
  const run = writes.then(job, job);
  writes = run.catch(() => undefined);
  return run;
};

const stored = {
  async getItem(key: string): Promise<string | null> {
    try {
      const v = await readSecure(key);
      if (v !== null) return v;
      // Saved by an older version: move it to the secure store.
      const old = await AsyncStorage.getItem(key);
      if (old !== null) {
        await writeSecure(key, old);
        await AsyncStorage.removeItem(key);
      }
      return old;
    } catch {
      return AsyncStorage.getItem(key);
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await writeSecure(key, value);
      await AsyncStorage.removeItem(key);
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    // One retry, then the failure is reported: a session left in the Keychain would sign the person back in at next launch.
    await clearSecure(key).catch(() => clearSecure(key));
    await AsyncStorage.removeItem(key);
  },
};

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (memory.has(key)) return memory.get(key)!;
    const v = await queue(() => stored.getItem(key));
    memory.set(key, v);
    return v;
  },
  async setItem(key: string, value: string): Promise<void> {
    memory.set(key, value);
    await queue(() => stored.setItem(key, value));
  },
  async removeItem(key: string): Promise<void> {
    memory.set(key, null);
    try {
      await queue(() => stored.removeItem(key));
    } catch (e) {
      // Not removed: forget the memory copy so the next read asks the Keychain again (and log out can tell).
      memory.delete(key);
      throw e;
    }
  },
};
