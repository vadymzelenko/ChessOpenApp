import { ChessGame } from '../chess/game';
import { START_FEN } from '../chess/position';
import type { OpeningPack } from '../pack/schema';

export interface Repertoire {
  /** Our move (SAN) in each position where it is our turn, keyed by positionKey. */
  ours: Map<string, string>;
  /** Opponent moves the course shows, keyed by positionKey — always kept in the explorer. */
  forced: Map<string, Set<string>>;
}

/** Collect the course's repertoire (lines + traps) for the explorer pipeline. */
export function repertoireFromPack(
  pack: Pick<OpeningPack, 'meta' | 'course' | 'traps'>,
): Repertoire {
  const ours = new Map<string, string>();
  const forced = new Map<string, Set<string>>();
  const side = pack.meta.side;
  const start = pack.meta.startFen ?? START_FEN;
  const sequences = [
    ...pack.course.chapters.flatMap((c) => c.lines.map((l) => l.moves)),
    ...pack.traps.map((t) => t.moves),
  ];
  for (const moves of sequences) {
    const g = new ChessGame(start);
    for (const san of moves) {
      const key = g.key;
      const ourTurn = g.turn === side;
      const rec = g.play(san);
      if (!rec) break;
      if (ourTurn) {
        if (!ours.has(key)) ours.set(key, rec.san);
      } else {
        let set = forced.get(key);
        if (!set) forced.set(key, (set = new Set()));
        set.add(rec.san);
      }
    }
  }
  return { ours, forced };
}
