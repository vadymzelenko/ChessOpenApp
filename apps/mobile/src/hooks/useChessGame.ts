import { ChessGame } from '@chess-open/core';
import { useCallback, useReducer, useState } from 'react';

/**
 * Holds a mutable ChessGame and re-renders on every change.
 * `mutate(fn)` runs fn against the game and refreshes the UI.
 */
export function useChessGame(startFen?: string) {
  const [game, setGame] = useState(() => new ChessGame(startFen));
  const [, refresh] = useReducer((n: number) => n + 1, 0);

  const mutate = useCallback(
    <T>(fn: (g: ChessGame) => T): T => {
      const before = game.version;
      const result = fn(game);
      if (game.version !== before) refresh();
      return result;
    },
    [game],
  );

  const reset = useCallback(() => setGame(new ChessGame(startFen)), [startFen]);

  return { game, version: game.version, mutate, reset };
}
