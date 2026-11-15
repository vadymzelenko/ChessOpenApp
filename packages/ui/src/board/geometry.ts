import type { Color, Square } from '@chess-open/core';

/**
 * Board geometry. Functions carry the 'worklet' directive so gesture
 * callbacks can call them on the UI thread.
 */

/** Top-left corner of a square in board pixels. */
export function squareToXY(
  square: Square,
  orientation: Color,
  squareSize: number,
): { x: number; y: number } {
  'worklet';
  const file = square.charCodeAt(0) - 97; // 0..7
  const rank = square.charCodeAt(1) - 49; // 0..7
  const col = orientation === 'w' ? file : 7 - file;
  const row = orientation === 'w' ? 7 - rank : rank;
  return { x: col * squareSize, y: row * squareSize };
}

/** Square under a point in board pixels, or null when outside the board. */
export function xyToSquare(
  x: number,
  y: number,
  orientation: Color,
  squareSize: number,
): Square | null {
  'worklet';
  if (squareSize <= 0) return null;
  const col = Math.floor(x / squareSize);
  const row = Math.floor(y / squareSize);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  const file = orientation === 'w' ? col : 7 - col;
  const rank = orientation === 'w' ? 7 - row : row;
  return (String.fromCharCode(97 + file) + String.fromCharCode(49 + rank)) as Square;
}

/** All 64 squares, a8..h1 order. */
export const ALL_SQUARES: readonly Square[] = (() => {
  const out: Square[] = [];
  for (let r = 7; r >= 0; r--) {
    for (let f = 0; f < 8; f++) {
      out.push((String.fromCharCode(97 + f) + String.fromCharCode(49 + r)) as Square);
    }
  }
  return out;
})();
