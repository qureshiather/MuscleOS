/**
 * In-memory stand-in for @react-native-async-storage/async-storage, wired in via a Vitest alias
 * (see vitest.config.mts). Enough of the API for the app's storage layer; tests can reset it
 * between cases with `__resetAsyncStorage()`.
 */
const store = new Map<string, string>();

const AsyncStorageMock = {
  async getItem(key: string): Promise<string | null> {
    return store.has(key) ? (store.get(key) as string) : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    store.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    store.delete(key);
  },
  async clear(): Promise<void> {
    store.clear();
  },
  async getAllKeys(): Promise<string[]> {
    return [...store.keys()];
  },
  async multiRemove(keys: string[]): Promise<void> {
    for (const key of keys) store.delete(key);
  },
};

/** Test helper: wipe the in-memory store between cases. */
export function __resetAsyncStorage(): void {
  store.clear();
}

export default AsyncStorageMock;
