import { ChessGame } from '../chess/game';
import { START_FEN, type Color } from '../chess/position';
import type { ExplorerNode } from '../pack/schema';
import { moveGames } from './select';

/**
 * Coverage (ТЗ §4 «Ключевая идея»): the share of real games in which the
 * opponent stays inside our repertoire up to ply N. Our positions need a
 * repertoire move; at the opponent's positions each move counts with its
 * frequency, and moves the explorer does not keep count as "left the
 * repertoire".
 */
export function coverage(
  nodes: Readonly<Record<string, ExplorerNode>>,
  ours: ReadonlyMap<string, string>,
  side: Color,
  plies: number,
  startFen: string = START_FEN,
): number {
  const memo = new Map<string, number>();

  const walk = (fen: string, remaining: number): number => {
    if (remaining === 0) return 1;
    const g = new ChessGame(fen);
    const key = g.key;
    const memoKey = `${key}|${remaining}`;
    const cached = memo.get(memoKey);
    if (cached !== undefined) return cached;

    let result = 0;
    if (g.turn === side) {
      const san = ours.get(key);
      const rec = san ? g.play(san) : null;
      result = rec ? walk(rec.fenAfter, remaining - 1) : 0;
    } else {
      const node = nodes[key];
      if (node) {
        const total = node.total ?? node.moves.reduce((s, m) => s + moveGames(m), 0);
        if (total > 0) {
          for (const m of node.moves) {
            const share = moveGames(m) / total;
            if (share === 0) continue;
            const c = new ChessGame(fen);
            const rec = c.play(m.san);
            if (rec) result += share * walk(rec.fenAfter, remaining - 1);
          }
        }
      }
    }
    memo.set(memoKey, result);
    return result;
  };

  return walk(startFen, plies);
}

/** Coverage at move numbers (ТЗ: «до 6-го / 10-го / 15-го хода»). */
export function coverageReport(
  nodes: Readonly<Record<string, ExplorerNode>>,
  ours: ReadonlyMap<string, string>,
  side: Color,
  moveNumbers: readonly number[] = [6, 10, 15],
  startFen: string = START_FEN,
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const n of moveNumbers) {
    // "До N-го хода" = both sides have made N-1 full moves and we have answered move N.
    const plies = side === 'w' ? 2 * n - 1 : 2 * n;
    out[n] = coverage(nodes, ours, side, plies, startFen);
  }
  return out;
}
