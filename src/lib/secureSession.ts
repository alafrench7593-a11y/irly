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

export const secureSessionStorage = {
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
    await clearSecure(key).catch(() => undefined);
    await AsyncStorage.removeItem(key);
  },
};
