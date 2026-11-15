/** Synchronous key-value storage. Web: localStorage (may be unavailable, e.g. private mode). */
export const kvStorage = {
  getItem(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Storage full or blocked: settings simply won't persist.
    }
  },
  removeItem(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
  },
};
