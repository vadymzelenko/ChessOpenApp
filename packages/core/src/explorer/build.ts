import { ChessGame } from '../chess/game';
import { START_FEN, positionKey, type Color } from '../chess/position';
import type { ExplorerMove, ExplorerNode } from '../pack/schema';
import {
  DEFAULT_SELECT,
  moveGames,
  mostPopularStrong,
  selectOpponentMoves,
  type MoveStats,
  type SelectOptions,
} from './select';

/** Where move statistics come from (Lichess explorer API, a games dump, a test fake). */
export type FetchPosition = (fen: string) => Promise<MoveStats[]>;

export interface BuildExplorerOptions {
  /** Our side (the course side). */
  side: Color;
  startFen?: string;
  /** Our repertoire moves by position key. */
  ours: ReadonlyMap<string, string>;
  /** Opponent moves to keep however rare, by position key. */
  forced?: ReadonlyMap<string, ReadonlySet<string>>;
  /** Stop below this path probability (ТЗ §5: 0.1 %). */
  minProbability?: number;
  /** Stop in positions with fewer games (ТЗ §5: 50). */
  minGames?: number;
  /** Stop at this depth in plies (ТЗ §5: 20 moves = 40 plies). */
  maxPlies?: number;
  /**
   * Outside the course, continue with the most popular move of 1800+ players
   * (needs this many games), marked `auto`. `null` stops at the end of the course.
   */
  autoContinue?: { minGames: number } | null;
  select?: SelectOptions;
  /** Hard cap on fetched positions (protects API quotas). */
  maxPositions?: number;
}

/** A position where it is our turn but the course has no move («дыра», ТЗ §4). */
export interface Hole {
  key: string;
  fen: string;
  ply: number;
  probability: number;
  /** SAN moves from the start position. */
  path: string[];
}

export interface ExplorerBuild {
  nodes: Record<string, ExplorerNode>;
  holes: Hole[];
  fetched: number;
  maxPly: number;
}

interface QueueItem {
  fen: string;
  probability: number;
  ply: number;
  path: string[];
}

/** Max-heap by probability: the most likely positions are explored first. */
class Queue {
  private items: QueueItem[] = [];
  get size() {
    return this.items.length;
  }
  push(item: QueueItem) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.probability >= a[i]!.probability) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): QueueItem | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.probability > a[m]!.probability) m = l;
        if (r < a.length && a[r]!.probability > a[m]!.probability) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

function toExplorerMove(
  m: MoveStats,
  flags: { repertoire?: boolean; auto?: boolean } = {},
): ExplorerMove {
  return {
    san: m.san,
    stats: m.stats,
    ...(flags.repertoire ? { repertoire: true } : {}),
    ...(flags.auto ? { auto: true } : {}),
  };
}

/**
 * Build the «живые соперники» tree (ТЗ §5, module 11): opponent moves by the
 * selection rule, our moves from the repertoire; branches stop by path
 * probability, game count or depth. Positions are keyed by positionKey, so
 * transpositions are explored once.
 */
export async function buildExplorer(
  fetchPosition: FetchPosition,
  opts: BuildExplorerOptions,
): Promise<ExplorerBuild> {
  const minProbability = opts.minProbability ?? 0.001;
  const minGames = opts.minGames ?? 50;
  const maxPlies = opts.maxPlies ?? 40;
  const autoContinue = opts.autoContinue === undefined ? { minGames: 100 } : opts.autoContinue;
  const select = opts.select ?? DEFAULT_SELECT;
  const maxPositions = opts.maxPositions ?? Infinity;

  const nodes: Record<string, ExplorerNode> = {};
  const holes: Hole[] = [];
  const seen = new Set<string>();
  const queue = new Queue();
  queue.push({ fen: opts.startFen ?? START_FEN, probability: 1, ply: 0, path: [] });
  let fetched = 0;
  let maxPly = 0;

  const child = (fen: string, san: string) => {
    const g = new ChessGame(fen);
    const rec = g.play(san);
    return rec ? { fen: rec.fenAfter, san: rec.san } : null;
  };

  while (queue.size > 0 && fetched < maxPositions) {
    const item = queue.pop()!;
    const key = positionKey(item.fen);
    if (seen.has(key)) continue;
    seen.add(key);

    const moves = await fetchPosition(item.fen);
    fetched++;
    const total = moves.reduce((s, m) => s + moveGames(m), 0);
    const ourTurn = new ChessGame(item.fen).turn === opts.side;
    const expand = item.ply < maxPlies && total >= minGames;

    if (ourTurn) {
      const repSan = opts.ours.get(key);
      let chosen: { san: string; auto: boolean } | null = repSan
        ? { san: repSan, auto: false }
        : null;
      if (!chosen) {
        holes.push({
          key,
          fen: item.fen,
          ply: item.ply,
          probability: item.probability,
          path: item.path,
        });
        const fallback = autoContinue ? mostPopularStrong(moves, autoContinue.minGames) : null;
        if (fallback) chosen = { san: fallback.san, auto: true };
      }
      // Our move + top-3 alternatives with statistics («это тоже играют»).
      const alternatives = [...moves]
        .filter((m) => m.san !== chosen?.san)
        .sort((a, b) => moveGames(b) - moveGames(a))
        .slice(0, 3);
      const chosenStats =
        moves.find((m) => m.san === chosen?.san) ??
        (chosen ? { san: chosen.san, stats: {} } : null);
      const stored = [
        ...(chosenStats
          ? [toExplorerMove(chosenStats, { repertoire: true, auto: chosen!.auto })]
          : []),
        ...alternatives.map((m) => toExplorerMove(m)),
      ];
      if (stored.length) nodes[key] = { moves: stored, total };
      if (chosen && (expand || !chosen.auto)) {
        const next = child(item.fen, chosen.san);
        if (next && item.ply < maxPlies) {
          queue.push({
            fen: next.fen,
            probability: item.probability,
            ply: item.ply + 1,
            path: [...item.path, next.san],
          });
        }
      }
    } else {
      const forced = opts.forced?.get(key) ?? new Set<string>();
      const selected = selectOpponentMoves(moves, forced, select);
      if (selected.length) nodes[key] = { moves: selected.map((m) => toExplorerMove(m)), total };
      if (expand) {
        for (const m of selected) {
          const p = item.probability * m.share;
          if (p < minProbability && !m.forced) continue;
          const next = child(item.fen, m.san);
          if (next)
            queue.push({
              fen: next.fen,
              probability: p,
              ply: item.ply + 1,
              path: [...item.path, next.san],
            });
        }
      }
    }
    maxPly = Math.max(maxPly, item.ply);
  }

  holes.sort((a, b) => b.probability - a.probability);
  return { nodes, holes, fetched, maxPly };
}
