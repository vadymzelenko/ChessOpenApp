import type { RatingGroup, Wdl } from '../pack/schema';

/** Statistics of one move in one position, per rating group (ТЗ §5). */
export interface MoveStats {
  san: string;
  stats: Partial<Record<RatingGroup, Wdl>>;
}

export const RATING_GROUPS: readonly RatingGroup[] = ['lt1400', '1400-1800', 'gt1800'];

export function gamesOf(wdl: Wdl | undefined): number {
  return wdl ? wdl.w + wdl.d + wdl.l : 0;
}

/** Games of a move in the given groups (all groups by default). */
export function moveGames(m: MoveStats, groups: readonly RatingGroup[] = RATING_GROUPS): number {
  return groups.reduce((sum, g) => sum + gamesOf(m.stats[g]), 0);
}

export interface SelectOptions {
  /** Take moves until their cumulative share reaches this (default 0.85). */
  cumulativeShare: number;
  /** At most this many moves (default 5). */
  maxMoves: number;
  /** Ignore moves below this share (default 0.03); the most popular move is always kept. */
  minShare: number;
}

export const DEFAULT_SELECT: SelectOptions = { cumulativeShare: 0.85, maxMoves: 5, minShare: 0.03 };

export interface SelectedMove extends MoveStats {
  /** Share of the position's games (0..1). */
  share: number;
  /** Kept because the course marks it (trap, important mistake), not for popularity. */
  forced: boolean;
}

/**
 * Opponent move selection (ТЗ §5 «Правило отбора ходов соперника»):
 * 1. sort by popularity, take until the cumulative share reaches 85 % (the first move always);
 * 2. but at most 5 moves, each ≥ 3 %;
 * 3. moves marked in the course are always kept, however rare.
 */
export function selectOpponentMoves(
  moves: readonly MoveStats[],
  forcedSans: ReadonlySet<string> = new Set(),
  opts: SelectOptions = DEFAULT_SELECT,
): SelectedMove[] {
  const total = moves.reduce((s, m) => s + moveGames(m), 0);
  if (total === 0) {
    return moves
      .filter((m) => forcedSans.has(m.san))
      .map((m) => ({ ...m, share: 0, forced: true }));
  }
  const sorted = [...moves]
    .map((m) => ({ ...m, share: moveGames(m) / total, forced: false }))
    .sort((a, b) => b.share - a.share || a.san.localeCompare(b.san));

  const out: SelectedMove[] = [];
  let cumulative = 0;
  for (const m of sorted) {
    if (out.length > 0 && (cumulative >= opts.cumulativeShare || out.length >= opts.maxMoves))
      break;
    if (out.length > 0 && m.share < opts.minShare) break;
    out.push(m);
    cumulative += m.share;
  }
  for (const m of sorted) {
    if (forcedSans.has(m.san) && !out.some((o) => o.san === m.san))
      out.push({ ...m, forced: true });
  }
  return out;
}

/** Most popular move among strong players (fallback for our side outside the course). */
export function mostPopularStrong(moves: readonly MoveStats[], minGames: number): MoveStats | null {
  let best: MoveStats | null = null;
  let bestGames = 0;
  for (const m of moves) {
    const g = moveGames(m, ['gt1800']);
    if (g >= minGames && g > bestGames) {
      best = m;
      bestGames = g;
    }
  }
  return best;
}

/**
 * Share of each move among all games in an explorer position (0–1), all rating
 * groups together. Uses the stored total when present (moves not stored count too).
 */
export function moveShares(
  node: { moves: readonly MoveStats[]; total?: number } | undefined,
): Map<string, number> {
  const out = new Map<string, number>();
  if (!node) return out;
  const sum = node.moves.reduce((a, m) => a + moveGames(m), 0);
  const total = Math.max(node.total ?? 0, sum);
  if (total === 0) return out;
  for (const m of node.moves) out.set(m.san, moveGames(m) / total);
  return out;
}
