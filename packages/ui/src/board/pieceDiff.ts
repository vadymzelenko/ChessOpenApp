import type { Color, PieceType, PlacedPiece, Square } from '@chess-open/core';

/** A piece with a stable identity, so React can animate it between squares. */
export interface KeyedPiece extends PlacedPiece {
  id: string;
}

export interface PieceDiff {
  /** Next position, each piece keyed (ids reused where a piece "moved"). */
  pieces: KeyedPiece[];
  /** Pieces that disappeared (captured / taken back) — for fade-out animations. */
  removed: KeyedPiece[];
}

function distance(a: Square, b: Square): number {
  const df = Math.abs(a.charCodeAt(0) - b.charCodeAt(0));
  const dr = Math.abs(a.charCodeAt(1) - b.charCodeAt(1));
  return Math.max(df, dr);
}

/**
 * Match pieces of the previous position to the next one:
 * 1. same square + same piece keeps its id;
 * 2. remaining pieces of the same colour+type are paired by shortest distance
 *    (that is the piece that moved);
 * 3. a promoted pawn keeps its id when a pawn vanished and a new piece of the
 *    same colour appeared on the last rank;
 * 4. everything else is new (fresh id) or removed.
 */
export function diffPieces(
  prev: readonly KeyedPiece[],
  next: readonly PlacedPiece[],
  newId: () => string,
): PieceDiff {
  const result: (KeyedPiece | null)[] = next.map(() => null);
  const unmatchedPrev = new Set(prev);

  // 1. unchanged squares
  const prevBySquare = new Map(prev.map((p) => [p.square, p]));
  next.forEach((n, i) => {
    const p = prevBySquare.get(n.square);
    if (p && p.color === n.color && p.type === n.type && unmatchedPrev.has(p)) {
      result[i] = { ...n, id: p.id };
      unmatchedPrev.delete(p);
    }
  });

  // 2. moved pieces of the same kind (greedy by distance)
  const pairs: { pi: KeyedPiece; ni: number; d: number }[] = [];
  next.forEach((n, i) => {
    if (result[i]) return;
    for (const p of unmatchedPrev) {
      if (p.color === n.color && p.type === n.type)
        pairs.push({ pi: p, ni: i, d: distance(p.square, n.square) });
    }
  });
  pairs.sort((a, b) => a.d - b.d);
  for (const { pi, ni } of pairs) {
    if (result[ni] || !unmatchedPrev.has(pi)) continue;
    result[ni] = { ...next[ni]!, id: pi.id };
    unmatchedPrev.delete(pi);
  }

  // 3. promotion: a pawn disappeared, a non-pawn of the same colour appeared on the last rank
  next.forEach((n, i) => {
    if (result[i] || n.type === 'p') return;
    const lastRank = n.color === 'w' ? '8' : '1';
    if (n.square[1] !== lastRank) return;
    let best: KeyedPiece | null = null;
    for (const p of unmatchedPrev) {
      if (p.type === 'p' && p.color === n.color && distance(p.square, n.square) === 1) best = p;
    }
    if (best) {
      result[i] = { ...n, id: best.id };
      unmatchedPrev.delete(best);
    }
  });

  // 4. new pieces
  const pieces = next.map((n, i) => result[i] ?? { ...n, id: newId() });
  return { pieces, removed: [...unmatchedPrev] };
}

/** Initial keying of a position. */
export function keyPieces(pieces: readonly PlacedPiece[], newId: () => string): KeyedPiece[] {
  return pieces.map((p) => ({ ...p, id: newId() }));
}

export type { Color, PieceType };
