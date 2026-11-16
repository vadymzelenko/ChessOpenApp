import { ChessGame } from '../chess/game';
import { START_FEN } from '../chess/position';
import type { Eval, OpeningPack } from '../pack/schema';

/** Evaluates a FEN (White's point of view) or returns null if it cannot. */
export type Evaluator = (fen: string) => Promise<Eval | null>;

/**
 * Every position the app may need an evaluation for: course lines, traps,
 * auto lines and the explorer (its positions and the positions after each
 * stored move — needed to classify moves). Returns key → FEN.
 */
export function packPositions(
  pack: Pick<OpeningPack, 'meta' | 'course' | 'traps' | 'autoLines' | 'explorer'>,
): Map<string, string> {
  const out = new Map<string, string>();
  const start = pack.meta.startFen ?? START_FEN;
  const add = (g: ChessGame) => {
    if (!out.has(g.key)) out.set(g.key, g.fen);
  };
  const lines = [
    ...pack.course.chapters.flatMap((c) => c.lines.map((l) => l.moves)),
    ...pack.traps.map((t) => t.moves),
    ...pack.autoLines.map((a) => a.moves),
  ];
  for (const moves of lines) {
    const g = new ChessGame(start);
    add(g);
    for (const san of moves) {
      if (!g.play(san)) break;
      add(g);
    }
  }
  for (const [key, node] of Object.entries(pack.explorer)) {
    const fen = `${key} 0 1`;
    const g = new ChessGame(fen);
    add(g);
    for (const m of node.moves) {
      const c = new ChessGame(fen);
      if (c.play(m.san)) add(c);
    }
  }
  return out;
}

export interface EvalBuild {
  evals: Record<string, Eval>;
  /** Positions no evaluator could handle. */
  missing: string[];
  /** How many positions each evaluator answered (same order as passed). */
  answered: number[];
}

/**
 * Evaluate positions with a chain of evaluators (e.g. Lichess cloud eval,
 * then local Stockfish), skipping keys already present in `existing`.
 */
export async function buildEvals(
  positions: ReadonlyMap<string, string>,
  evaluators: readonly Evaluator[],
  existing: Readonly<Record<string, Eval>> = {},
  onProgress?: (done: number, total: number, evals: Readonly<Record<string, Eval>>) => void,
  /** Checked before each position: true stops early (time budget); the rest counts as missing. */
  shouldStop?: () => boolean,
): Promise<EvalBuild> {
  const evals: Record<string, Eval> = { ...existing };
  const missing: string[] = [];
  const answered = evaluators.map(() => 0);
  let done = 0;
  for (const [key, fen] of positions) {
    done++;
    if (evals[key]) continue;
    if (shouldStop?.()) {
      missing.push(key);
      continue;
    }
    let result: Eval | null = null;
    for (let i = 0; i < evaluators.length && !result; i++) {
      result = await evaluators[i]!(fen);
      if (result) answered[i]!++;
    }
    if (result) evals[key] = result;
    else missing.push(key);
    onProgress?.(done, positions.size, evals);
  }
  return { evals, missing, answered };
}
