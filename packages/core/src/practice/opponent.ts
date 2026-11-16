import { winningChances, type Score } from '../engine/score';
import type { ExplorerNode, RatingGroup } from '../pack/schema';
import { gamesOf } from '../explorer/select';

/** How the opponent picks moves (ТЗ §5 «Режимы соперника»). */
export type OpponentMode = 'realistic' | 'hard' | 'weak-spots' | 'traps' | 'rare';

export interface OpponentContext {
  /** Evaluation (White POV) after the opponent's move, if known. */
  evalAfter?: (san: string) => Score | undefined;
  /** How weak the user is after this move (e.g. lapses of the next card), ≥ 0. */
  weakness?: (san: string) => number;
  /** The opponent's colour. */
  side: 'w' | 'b';
}

export interface WeightedMove {
  san: string;
  weight: number;
  /** Share of games in the chosen rating group (0..1). */
  share: number;
}

/** Games of a move in a rating group, falling back to all groups when the group has no data. */
function gamesIn(m: ExplorerNode['moves'][number], group: RatingGroup): number {
  const g = gamesOf(m.stats[group]);
  if (g > 0) return g;
  return gamesOf(m.stats.lt1400) + gamesOf(m.stats['1400-1800']) + gamesOf(m.stats.gt1800);
}

/** Opponent's winning chances (−1..1) after a move. */
function oppChances(score: Score | undefined, side: 'w' | 'b'): number | undefined {
  if (!score) return undefined;
  const wc = winningChances(score);
  return side === 'w' ? wc : -wc;
}

/** Weights of the opponent's moves for a mode (they need not sum to 1). */
export function opponentWeights(
  node: ExplorerNode,
  group: RatingGroup,
  mode: OpponentMode,
  ctx: OpponentContext,
): WeightedMove[] {
  const games = node.moves.map((m) => gamesIn(m, group));
  const total = games.reduce((a, b) => a + b, 0) || 1;
  return node.moves.map((m, i) => {
    const share = games[i]! / total;
    let weight = share;
    switch (mode) {
      case 'realistic':
        break;
      case 'hard': {
        // Favour moves that keep the opponent's chances high.
        const c = oppChances(ctx.evalAfter?.(m.san), ctx.side);
        weight = (share + 0.05) * (c === undefined ? 1 : Math.exp(4 * c));
        break;
      }
      case 'traps': {
        // Popular moves that are bad for the opponent: practise punishing them.
        const c = oppChances(ctx.evalAfter?.(m.san), ctx.side);
        weight = (share + 0.05) * (c === undefined ? 1 : Math.exp(-4 * c));
        break;
      }
      case 'weak-spots':
        weight = (share + 0.05) * (1 + 2 * Math.max(0, ctx.weakness?.(m.san) ?? 0));
        break;
      case 'rare':
        weight = 1 / (share + 0.02);
        break;
    }
    return { san: m.san, weight, share };
  });
}

/** Weighted random choice; `random` ∈ [0, 1). Returns null for an empty node. */
export function chooseOpponentMove(
  node: ExplorerNode,
  group: RatingGroup,
  mode: OpponentMode,
  ctx: OpponentContext,
  random: () => number = Math.random,
): string | null {
  const w = opponentWeights(node, group, mode, ctx);
  const sum = w.reduce((s, m) => s + m.weight, 0);
  if (w.length === 0 || sum <= 0) return null;
  let r = random() * sum;
  for (const m of w) {
    r -= m.weight;
    if (r < 0) return m.san;
  }
  return w[w.length - 1]!.san;
}

/** W/D/L shares (White POV) of a position for a rating group — «практические шансы» (ТЗ §7). */
export function practicalChances(
  node: ExplorerNode,
  group: RatingGroup,
): { white: number; draw: number; black: number; games: number } | null {
  let w = 0;
  let d = 0;
  let l = 0;
  for (const m of node.moves) {
    const s = m.stats[group];
    if (!s) continue;
    w += s.w;
    d += s.d;
    l += s.l;
  }
  const games = w + d + l;
  if (games === 0) return null;
  return { white: w / games, draw: d / games, black: l / games, games };
}
