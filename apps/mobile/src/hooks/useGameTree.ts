import { GameTree } from '@chess-open/core';
import { useCallback, useReducer, useState } from 'react';

/**
 * Holds a mutable GameTree and re-renders on every change.
 * `mutate(fn)` runs fn against the tree and refreshes the UI if it changed.
 */
export function useGameTree(startFen?: string) {
  const [tree, setTree] = useState(() => new GameTree(startFen));
  const [, refresh] = useReducer((n: number) => n + 1, 0);

  const mutate = useCallback(
    <T>(fn: (t: GameTree) => T): T => {
      const before = tree.version;
      const result = fn(tree);
      if (tree.version !== before) refresh();
      return result;
    },
    [tree],
  );

  const reset = useCallback(() => setTree(new GameTree(startFen)), [startFen]);

  return { tree, version: tree.version, mutate, reset };
}
