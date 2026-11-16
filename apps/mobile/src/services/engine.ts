import type { UciInfo } from '@chess-open/core';

/**
 * Local Stockfish (ТЗ module 33). Native builds have no engine yet: the app
 * uses the pack's pre-computed evaluations there.
 */
export const engineAvailable = false;

export function analyse(
  _fen: string,
  _depth: number,
  _onInfo: (info: UciInfo) => void,
): () => void {
  return () => {};
}
