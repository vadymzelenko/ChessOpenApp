import { indexPack, validatePack, type PackIndex } from '@chess-open/core';

import london from '@/assets/packs/london.json';

/**
 * Packs shipped inside the app (ТЗ §11: MVP packs are embedded; downloadable
 * packs come later). Each pack is validated and indexed once, on first use.
 */
const SOURCES: Record<string, unknown> = { london };

export const PACK_IDS = Object.keys(SOURCES);

const cache = new Map<string, PackIndex | null>();

export function getPack(id: string): PackIndex | null {
  if (cache.has(id)) return cache.get(id)!;
  const source = SOURCES[id];
  let result: PackIndex | null = null;
  if (source) {
    const v = validatePack(source);
    if (v.ok) result = indexPack(v.pack);
    else console.warn(`Pack ${id} is invalid:\n${v.errors.slice(0, 5).join('\n')}`);
  }
  cache.set(id, result);
  return result;
}
