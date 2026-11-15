import { mostPopularStrong, selectOpponentMoves, type MoveStats } from './select';

const mv = (san: string, games: number, strong = 0): MoveStats => ({
  san,
  stats: {
    lt1400: { w: games, d: 0, l: 0 },
    ...(strong ? { gt1800: { w: strong, d: 0, l: 0 } } : {}),
  },
});

describe('selectOpponentMoves', () => {
  it('takes moves until 85 % is covered', () => {
    const r = selectOpponentMoves([mv('d5', 60), mv('Nf6', 30), mv('e6', 6), mv('c5', 4)]);
    expect(r.map((m) => m.san)).toEqual(['d5', 'Nf6']);
    expect(r[0]!.share).toBeCloseTo(0.6);
  });

  it('caps at 5 moves', () => {
    const moves = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => mv(s, 10));
    expect(selectOpponentMoves(moves)).toHaveLength(5);
  });

  it('drops moves under 3 % but always keeps the first', () => {
    const r = selectOpponentMoves([
      mv('d5', 50),
      mv('Nf6', 20),
      mv('x', 2),
      mv('y', 2),
      mv('z', 26),
    ]);
    expect(r.map((m) => m.san)).toEqual(['d5', 'z', 'Nf6']);
    const one = selectOpponentMoves([mv('d5', 90), mv('h6', 1)], new Set(), {
      cumulativeShare: 0.5,
      maxMoves: 5,
      minShare: 0.95,
    });
    expect(one.map((m) => m.san)).toEqual(['d5']);
  });

  it('always keeps moves marked in the course', () => {
    const r = selectOpponentMoves([mv('d5', 90), mv('Qb6', 1)], new Set(['Qb6']));
    expect(r.map((m) => [m.san, m.forced])).toEqual([
      ['d5', false],
      ['Qb6', true],
    ]);
  });

  it('handles a position without games', () => {
    expect(selectOpponentMoves([mv('d5', 0)])).toEqual([]);
  });
});

describe('mostPopularStrong', () => {
  it('picks the most played move among 1800+ with enough games', () => {
    const moves = [mv('Bf4', 100, 40), mv('c4', 10, 60), mv('Nf3', 500, 5)];
    expect(mostPopularStrong(moves, 20)?.san).toBe('c4');
    expect(mostPopularStrong(moves, 100)).toBeNull();
  });
});
