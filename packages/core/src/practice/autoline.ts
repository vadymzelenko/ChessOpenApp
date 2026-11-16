import { ChessGame } from '../chess/game';
import type { Color } from '../chess/position';
import { moveGames } from '../explorer/select';
import type { ExplorerNode } from '../pack/schema';

/**
 * «Идти дальше ⚙» (ТЗ §4): continue a finished line with the explorer data —
 * our side plays the move marked as repertoire (or the most played), the
 * opponent the most popular move — until the data ends or `maxPlies`.
 * Returns the SAN moves after `fen` (empty if there is no data).
 */
export function autoContinuation(
  explorer: Readonly<Record<string, ExplorerNode>>,
  fen: string,
  side: Color,
  maxPlies = 10,
): string[] {
  const g = new ChessGame(fen);
  const out: string[] = [];
  const seen = new Set<string>();
  while (out.length < maxPlies) {
    const key = g.key;
    if (seen.has(key)) break;
    seen.add(key);
    const node = explorer[key];
    if (!node || node.moves.length === 0) break;
    const ours = g.turn === side;
    const pick = ours
      ? (node.moves.find((m) => m.repertoire) ??
        [...node.moves].sort((a, b) => moveGames(b) - moveGames(a))[0])
      : [...node.moves].sort((a, b) => moveGames(b) - moveGames(a))[0];
    if (!pick || !g.play(pick.san)) break;
    out.push(g.history[g.history.length - 1]!.san);
  }
  return out;
}
