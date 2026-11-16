import { Chess } from 'chess.js';

import { FILES, type Color, type Square } from '../chess/position';

type Side<T> = Record<Color, T>;

/** Countable features of a position (ТЗ §7 «Объяснение перевеса словами»). */
export interface PositionFeatures {
  /** Material in pawns (P1 N3 B3 R5 Q9). */
  material: Side<number>;
  /** Knights and bishops off their starting squares. */
  development: Side<number>;
  castled: Side<boolean>;
  /** King on d/e/f of its first two ranks, castling no longer possible, queens on the board. */
  kingStuck: Side<boolean>;
  /** Control of d4/e4/d5/e5: attacks + own pawns on them. */
  center: Side<number>;
  /** Doubled + isolated pawns. */
  weakPawns: Side<number>;
  /** Number of legal moves. */
  mobility: Side<number>;
}

const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const;
const CENTER: readonly Square[] = ['d4', 'e4', 'd5', 'e5'];
const MINOR_HOME: Side<readonly Square[]> = {
  w: ['b1', 'g1', 'c1', 'f1'],
  b: ['b8', 'g8', 'c8', 'f8'],
};
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

function withTurn(fen: string, turn: Color): Chess {
  const f = fen.split(' ');
  f[1] = turn;
  f[3] = '-';
  return new Chess(f.join(' '), { skipValidation: true });
}

export function positionFeatures(fen: string): PositionFeatures {
  const c = new Chess(fen);
  const board = c
    .board()
    .flat()
    .filter((x) => x !== null);
  const make = <T>(fn: (s: Color) => T): Side<T> => ({ w: fn('w'), b: fn('b') });
  const queens = board.some((p) => p.type === 'q');

  return {
    material: make((s) =>
      board.filter((p) => p.color === s).reduce((a, p) => a + VALUES[p.type], 0),
    ),
    development: make(
      (s) =>
        board.filter(
          (p) =>
            p.color === s &&
            (p.type === 'n' || p.type === 'b') &&
            !MINOR_HOME[s].includes(p.square),
        ).length,
    ),
    castled: make((s) => {
      const k = c.findPiece({ color: s, type: 'k' })[0];
      const rank = s === 'w' ? '1' : '8';
      return !!k && k[1] === rank && ['g', 'h', 'b', 'c'].includes(k[0]!);
    }),
    kingStuck: make((s) => {
      const k = c.findPiece({ color: s, type: 'k' })[0];
      const ranks = s === 'w' ? ['1', '2'] : ['7', '8'];
      const rights = c.getCastlingRights(s);
      return (
        !!k &&
        queens &&
        ranks.includes(k[1]!) &&
        ['d', 'e', 'f'].includes(k[0]!) &&
        !rights.k &&
        !rights.q
      );
    }),
    center: make(
      (s) =>
        CENTER.reduce((a, sq) => a + c.attackers(sq, s).length, 0) +
        CENTER.filter((sq) => {
          const p = c.get(sq);
          return p?.type === 'p' && p.color === s;
        }).length,
    ),
    weakPawns: make((s) => {
      const files = FILES.map(
        (f) => board.filter((p) => p.color === s && p.type === 'p' && p.square[0] === f).length,
      );
      let weak = 0;
      files.forEach((n, i) => {
        if (n > 1) weak += n - 1; // doubled
        if (n > 0 && !(files[i - 1] ?? 0) && !(files[i + 1] ?? 0)) weak += n; // isolated
      });
      return weak;
    }),
    mobility: make((s) => withTurn(fen, s).moves().length),
  };
}

export type FactorKey = 'material' | 'development' | 'king' | 'center' | 'pawns' | 'mobility';

/** One reason for an advantage: `side` is better by `amount` (units depend on the key). */
export interface Factor {
  key: FactorKey;
  side: Color;
  amount: number;
}

/**
 * Which features favour whom, most important first (material, then king
 * safety, development, centre, pawns, mobility). Thresholds keep the text
 * about things a beginner can see.
 */
export function advantageFactors(fen: string): Factor[] {
  const f = positionFeatures(fen);
  const out: (Factor & { weight: number })[] = [];
  const diff = (a: Side<number>) => a.w - a.b;
  const add = (key: FactorKey, d: number, threshold: number, weight: number) => {
    if (Math.abs(d) >= threshold)
      out.push({ key, side: d > 0 ? 'w' : 'b', amount: Math.abs(d), weight: weight * Math.abs(d) });
  };
  add('material', diff(f.material), 1, 3);
  // King: a stuck king is a factor for the other side.
  if (f.kingStuck.w !== f.kingStuck.b)
    out.push({ key: 'king', side: f.kingStuck.w ? 'b' : 'w', amount: 1, weight: 2.5 });
  else if (f.castled.w !== f.castled.b)
    out.push({ key: 'king', side: f.castled.w ? 'w' : 'b', amount: 1, weight: 1.2 });
  add('development', diff(f.development), 2, 1);
  add('center', diff(f.center), 2, 0.5);
  add('pawns', -diff(f.weakPawns), 1, 0.8);
  add('mobility', diff(f.mobility), 8, 0.1);
  return out
    .sort((a, b) => b.weight - a.weight)
    .map(({ key, side, amount }) => ({ key, side, amount }));
}

/** The side the factors favour overall, or null if balanced. */
export function factorsLeader(factors: readonly Factor[]): Color | null {
  let score = 0;
  for (const fct of factors) score += fct.side === 'w' ? 1 : -1;
  return score > 0 ? 'w' : score < 0 ? 'b' : null;
}

export { other as opposite };
