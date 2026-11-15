import { Storage } from 'expo-sqlite/kv-store';

/** Synchronous key-value storage. Native: SQLite (expo-sqlite/kv-store). */
export const kvStorage = {
  getItem: (key: string): string | null => Storage.getItemSync(key),
  setItem: (key: string, value: string): void => Storage.setItemSync(key, value),
  removeItem: (key: string): void => {
    Storage.removeItemSync(key);
  },
};
