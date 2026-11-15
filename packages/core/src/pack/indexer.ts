import { ChessGame, type MoveRecord } from '../chess/game';
import { START_FEN, type Color } from '../chess/position';
import type { Chapter, Idea, Line, MoveAnnotation, OpeningPack } from './schema';

/** One move of a line, with everything a training screen needs. */
export interface LineStep {
  /** 1-based ply in the line. */
  ply: number;
  move: MoveRecord;
  fenBefore: string;
  keyBefore: string;
  /** True when this is our (the course side's) move — the user has to find it. */
  ours: boolean;
  annotation?: MoveAnnotation;
}

export interface IndexedLine {
  line: Line;
  chapter: Chapter;
  steps: LineStep[];
}

/** Lookup structures over a validated pack (ТЗ module 16: «индекс по хешу позиции»). */
export interface PackIndex {
  pack: OpeningPack;
  side: Color;
  startFen: string;
  lines: Map<string, IndexedLine>;
  ideas: Map<string, Idea>;
  /** Our repertoire move per position key (first line wins). */
  ourMoves: Map<string, string>;
  /** Lines passing through each position key. */
  linesByPosition: Map<string, string[]>;
}

export function lineSteps(line: Line, side: Color, startFen: string): LineStep[] {
  const g = new ChessGame(startFen);
  return line.moves.map((san, i) => {
    const fenBefore = g.fen;
    const keyBefore = g.key;
    const ours = g.turn === side;
    const move = g.play(san);
    if (!move) throw new Error(`Line ${line.id}: illegal move ${san} at ply ${i + 1}`);
    const annotation = line.annotations?.[String(i + 1)];
    return { ply: i + 1, move, fenBefore, keyBefore, ours, ...(annotation ? { annotation } : {}) };
  });
}

export function indexPack(pack: OpeningPack): PackIndex {
  const startFen = pack.meta.startFen ?? START_FEN;
  const side = pack.meta.side;
  const lines = new Map<string, IndexedLine>();
  const ourMoves = new Map<string, string>();
  const linesByPosition = new Map<string, string[]>();
  for (const chapter of pack.course.chapters) {
    for (const line of chapter.lines) {
      const steps = lineSteps(line, side, startFen);
      lines.set(line.id, { line, chapter, steps });
      for (const s of steps) {
        if (s.ours && !ourMoves.has(s.keyBefore)) ourMoves.set(s.keyBefore, s.move.san);
        const list = linesByPosition.get(s.keyBefore) ?? [];
        if (!list.includes(line.id)) list.push(line.id);
        linesByPosition.set(s.keyBefore, list);
      }
    }
  }
  return {
    pack,
    side,
    startFen,
    lines,
    ideas: new Map(pack.ideas.map((i) => [i.id, i])),
    ourMoves,
    linesByPosition,
  };
}

/** Training cards of a line: the positions where the user must find our move. */
export function lineCards(indexed: IndexedLine): LineStep[] {
  return indexed.steps.filter((s) => s.ours);
}
