import type { PackIndex } from '@chess-open/core';

import { getPack } from '@/packs/registry';

/** A shipped pack, validated and indexed. */
export function usePack(id: string | undefined): PackIndex | null {
  return id ? getPack(id) : null;
}
