import { Chess, type Square as ChessSquare } from 'chess.js';

import type { Color, Square } from '../chess/position';
import { classifyMove, decodeMoveScore, type MoveGrade, type Score } from '../engine/score';
import { advantageFactors, type Factor } from './explain';

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/** A piece of `side` the opponent can win right away. */
export interface Threat {
  square: Square;
  piece: 'p' | 'n' | 'b' | 'r' | 'q';
  /** The capturing piece. */
  by: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  /** Nobody defends the piece (otherwise it is attacked by a cheaper piece). */
  undefended: boolean;
}

/**
 * Pieces of `side` that the side to move in `fen` can win at once: undefended
 * ones, or ones attacked by a cheaper piece. Most valuable first.
 */
export function threatsAgainst(fen: string, side: Color): Threat[] {
  const c = new Chess(fen);
  if (c.turn() === side) return [];
  const out = new Map<string, Threat>();
  for (const m of c.moves({ verbose: true })) {
    if (!m.captured || m.captured === 'k') continue;
    const undefended = !c.isAttacked(m.to as ChessSquare, side);
    const cheaper = VALUE[m.piece]! < VALUE[m.captured]!;
    if (!undefended && !cheaper) continue;
    const prev = out.get(m.to);
    if (!prev || VALUE[m.piece]! < VALUE[prev.by]!)
      out.set(m.to, {
        square: m.to as Square,
        piece: m.captured as Threat['piece'],
        by: m.piece as Threat['by'],
        undefended,
      });
  }
  return [...out.values()].sort((a, b) => VALUE[b.piece]! - VALUE[a.piece]!);
}

export interface MoveVerdict {
  grade: MoveGrade;
  /** Score after the move (White's view), when known. */
  score?: Score;
  /** Score of the best move (White's view). */
  bestScore?: Score;
  bestUci?: string;
  /** Score after the course move (White's view). */
  courseScore?: Score;
  /** Pieces the opponent can now win. */
  threats: Threat[];
  /** Advantages we would have after the course move but not after this one. */
  lost: Factor[];
  /** Advantages the opponent gets compared with the course move. */
  gave: Factor[];
}

const factorId = (f: Factor) => `${f.key}${f.side}`;

/**
 * Judge a move the user tried in a course position (ТЗ §7 «почему плохо /
 * почему хорошо»): engine grade from the pre-computed scores of every move,
 * pieces left hanging, and the positional differences against the course move.
 */
export function judgeMove({
  fenBefore,
  uci,
  courseUci,
  scores,
}: {
  fenBefore: string;
  uci: string;
  courseUci?: string;
  /** UCI → stored score (pack `moveEvals` of this position). */
  scores?: Readonly<Record<string, number>>;
}): MoveVerdict {
  const side: Color = fenBefore.split(' ')[1] === 'b' ? 'b' : 'w';
  const sign = side === 'w' ? 1 : -1;
  const play = (u: string) => {
    const c = new Chess(fenBefore);
    try {
      c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      return c.fen();
    } catch {
      return null;
    }
  };
  const after = play(uci);

  let grade: MoveGrade = uci === courseUci ? 'best' : 'good';
  let score: Score | undefined;
  let bestScore: Score | undefined;
  let bestUci: string | undefined;
  let courseScore: Score | undefined;
  if (scores && scores[uci] !== undefined) {
    const entries = Object.entries(scores);
    const [bu, bv] = entries.reduce((a, b) => (sign * b[1] > sign * a[1] ? b : a));
    bestUci = bu;
    bestScore = decodeMoveScore(bv);
    score = decodeMoveScore(scores[uci]!);
    if (courseUci && scores[courseUci] !== undefined)
      courseScore = decodeMoveScore(scores[courseUci]!);
    grade = classifyMove(bestScore, score, side, uci === bu || uci === courseUci);
  }

  const threats = after ? threatsAgainst(after, side) : [];
  let lost: Factor[] = [];
  let gave: Factor[] = [];
  const courseAfter = courseUci && courseUci !== uci ? play(courseUci) : null;
  if (after && courseAfter) {
    const mine = advantageFactors(after);
    const course = advantageFactors(courseAfter);
    const mineIds = new Set(mine.map(factorId));
    const courseIds = new Set(course.map(factorId));
    lost = course.filter((f) => f.side === side && !mineIds.has(factorId(f)));
    gave = mine.filter((f) => f.side !== side && !courseIds.has(factorId(f)));
  }
  return { grade, score, bestScore, bestUci, courseScore, threats, lost, gave };
}

/** Best score in a position from its move scores (White's view). */
export function bestOf(
  scores: Readonly<Record<string, number>> | undefined,
  side: Color,
): Score | undefined {
  if (!scores) return undefined;
  const vals = Object.values(scores);
  if (!vals.length) return undefined;
  return decodeMoveScore(side === 'w' ? Math.max(...vals) : Math.min(...vals));
}
