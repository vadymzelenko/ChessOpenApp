import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Keyboard shortcuts on web (ТЗ §2: ← → по ходам, F — перевернуть доску…).
 * Keys are matched against KeyboardEvent.key, case-insensitive for letters.
 * No-op on native.
 */
export function useHotkeys(bindings: Record<string, () => void>, enabled = true): void {
  const ref = useRef(bindings);
  useEffect(() => {
    ref.current = bindings;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const fn = ref.current[key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}
