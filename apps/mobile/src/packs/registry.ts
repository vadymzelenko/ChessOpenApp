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

/** Engine evaluation of a position from any shipped pack (White POV), if precomputed. */
export function evalFor(positionKey: string) {
  for (const id of PACK_IDS) {
    const e = getPack(id)?.pack.evals[positionKey];
    if (e) return e;
  }
  return undefined;
}

const personalCache = new WeakMap<object, PackIndex>();

/**
 * The pack with the user's own lines as an extra chapter «Мой репертуар»
 * (ТЗ §4), so they get training, review and exams like any course line.
 */
export function withPersonal(
  index: PackIndex,
  custom: readonly { id: string; moves: string[] }[] | undefined,
  chapterTitle: string,
): PackIndex {
  if (!custom || custom.length === 0) return index;
  const cached = personalCache.get(custom);
  if (cached) return cached;
  const chapter = {
    id: 'my-repertoire',
    title: { ru: chapterTitle },
    lines: custom.map((l) => ({
      id: l.id,
      title: { ru: `${chapterTitle}: …${l.moves.slice(-2).join(' ')}` },
      level: 'base' as const,
      moves: l.moves,
      status: 'draft' as const,
    })),
  };
  const result = indexPack({
    ...index.pack,
    course: { chapters: [...index.pack.course.chapters, chapter] },
  });
  personalCache.set(custom, result);
  return result;
}
