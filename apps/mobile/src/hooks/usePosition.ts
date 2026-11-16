import { ChessGame, type Square } from '@chess-open/core';
import { useCallback, useMemo } from 'react';

/** Board helpers for a FEN: pieces, legal destinations, promotion check. */
export function usePosition(fen: string, interactive: boolean) {
  const game = useMemo(() => (fen ? new ChessGame(fen) : null), [fen]);
  const pieces = useMemo(() => game?.pieces() ?? [], [game]);
  const legalMoves = useCallback(
    (from: Square) => (interactive && game ? game.destinations(from) : []),
    [interactive, game],
  );
  const isPromotion = useCallback(
    (from: Square, to: Square) => !!game?.isPromotion(from, to),
    [game],
  );
  return { game, pieces, legalMoves, isPromotion };
}
