import type { Color, PlacedPiece, Square } from '@chess-open/core';
import {
  Board,
  boardThemes,
  type BoardArrow,
  type BoardHighlight,
  type BoardMove,
} from '@chess-open/ui';

import { useSettings } from '@/store/settings';

interface TrainingBoardProps {
  pieces: readonly PlacedPiece[];
  orientation: Color;
  lastMove: { from: Square; to: Square } | null;
  check: Square | null;
  interactive: boolean;
  legalMoves: (from: Square) => Square[];
  isPromotion: (from: Square, to: Square) => boolean;
  onMove: (m: BoardMove) => boolean;
  arrows?: readonly BoardArrow[];
  highlights?: readonly BoardHighlight[];
}

/** The board as used by training-like screens, with the user's settings applied. */
export function TrainingBoard({ interactive, ...p }: TrainingBoardProps) {
  const s = useSettings();
  return (
    <Board
      {...p}
      legalMoves={p.legalMoves}
      onMove={p.onMove}
      showCoordinates={s.showCoordinates}
      showLegalMoves={s.showLegalMoves}
      moveInput={s.moveInput}
      autoQueen={s.autoQueen}
      boardTheme={boardThemes[s.boardTheme]}
      pieceSet={s.pieceSet}
      disabled={!interactive}
    />
  );
}
