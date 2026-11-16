import { Chess } from 'chess.js';
import type { Square } from 'chess.js';

/** Parsed `info` line of a UCI engine (Stockfish). */
export interface UciInfo {
  depth: number;
  multipv: number;
  /** Score from the side to move's point of view. */
  cp?: number;
  mate?: number;
  /** Principal variation in UCI notation. */
  pv: string[];
}

/** Parse a UCI `info ... score ... pv ...` line; null for lines without a score. */
export function parseUciInfo(line: string): UciInfo | null {
  if (!line.startsWith('info ')) return null;
  const t = line.trim().split(/\s+/);
  const out: UciInfo = { depth: 0, multipv: 1, pv: [] };
  let hasScore = false;
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'depth':
        out.depth = Number(t[++i]);
        break;
      case 'multipv':
        out.multipv = Number(t[++i]);
        break;
      case 'score': {
        const kind = t[++i];
        const value = Number(t[++i]);
        if (kind === 'cp') out.cp = value;
        else if (kind === 'mate') out.mate = value;
        hasScore = true;
        // Skip "lowerbound"/"upperbound" markers: such scores are not final.
        if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') return null;
        break;
      }
      case 'pv':
        out.pv = t.slice(i + 1);
        i = t.length;
        break;
    }
  }
  return hasScore ? out : null;
}

/** Convert a side-to-move score to White's point of view. */
export function toWhitePov<T extends { cp?: number; mate?: number }>(
  score: T,
  sideToMove: 'w' | 'b',
): T {
  if (sideToMove === 'w') return score;
  return {
    ...score,
    ...(score.cp !== undefined ? { cp: -score.cp } : {}),
    ...(score.mate !== undefined ? { mate: -score.mate } : {}),
  };
}

/** Principal variation (UCI) → SAN, stopping at the first illegal move. */
export function pvToSan(fen: string, pv: readonly string[], max = 8): string[] {
  const g = new Chess(fen);
  const out: string[] = [];
  for (const uci of pv.slice(0, max)) {
    try {
      const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      out.push(m.san);
    } catch {
      break;
    }
  }
  return out;
}

/**
 * Lichess writes castling as «king takes own rook» (e1h1); standard UCI is
 * e1g1. Converts such moves when a king stands on the from-square.
 */
export function normalizeCastling(fen: string, uci: string): string {
  const fixes: Record<string, string> = { e1h1: 'e1g1', e1a1: 'e1c1', e8h8: 'e8g8', e8a8: 'e8c8' };
  const fixed = fixes[uci];
  if (!fixed) return uci;
  const piece = new Chess(fen).get(uci.slice(0, 2) as Square);
  return piece?.type === 'k' ? fixed : uci;
}
