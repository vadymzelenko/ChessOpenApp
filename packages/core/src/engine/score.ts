/** An evaluation from White's point of view. */
export interface Score {
  cp?: number;
  mate?: number;
}

/**
 * Winning chances in [-1, 1] for White (Lichess formula):
 * 2 / (1 + e^(-0.00368208·cp)) − 1; mate = ±1. Centipawns are capped at ±1000.
 */
export function winningChances(score: Score): number {
  if (score.mate !== undefined) return score.mate > 0 ? 1 : score.mate < 0 ? -1 : 0;
  const cp = Math.max(-1000, Math.min(1000, score.cp ?? 0));
  return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;
}

/** Win probability (0..1) for the given side. */
export function winProbability(score: Score, side: 'w' | 'b'): number {
  const wc = winningChances(score);
  return (side === 'w' ? wc : -wc) / 2 + 0.5;
}

export type MoveGrade = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/**
 * Classify a move by how much it lowered the mover's winning chances
 * (ТЗ §7, Lichess thresholds on the [-1, 1] scale: 0.1 / 0.2 / 0.3).
 * `isBest`: the move equals the engine's best move.
 */
export function classifyMove(
  before: Score,
  after: Score,
  mover: 'w' | 'b',
  isBest = false,
): MoveGrade {
  if (isBest) return 'best';
  const sign = mover === 'w' ? 1 : -1;
  const drop = sign * (winningChances(before) - winningChances(after));
  if (drop >= 0.3) return 'blunder';
  if (drop >= 0.2) return 'mistake';
  if (drop >= 0.1) return 'inaccuracy';
  return 'good';
}

/** Human-readable score: "+0.4", "−1.2", "#3", "#−2". */
export function formatScore(score: Score): string {
  if (score.mate !== undefined) return score.mate >= 0 ? `#${score.mate}` : `#−${-score.mate}`;
  const v = (score.cp ?? 0) / 100;
  if (Math.abs(v) < 0.05) return '0.0';
  return v > 0 ? `+${v.toFixed(1)}` : `−${(-v).toFixed(1)}`;
}
