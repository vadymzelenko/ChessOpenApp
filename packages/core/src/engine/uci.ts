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
