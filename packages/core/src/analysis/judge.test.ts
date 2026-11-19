import { bestOf, judgeMove, threatsAgainst } from './judge';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('threatsAgainst', () => {
  it('finds a piece left hanging', () => {
    // A knight on e5 attacked by the d6 pawn.
    const fen = 'rnbqkbnr/ppp2ppp/3p4/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3';
    const t = threatsAgainst(fen, 'w');
    expect(t[0]).toMatchObject({ square: 'e5', piece: 'n', by: 'p' });
  });

  it('is empty when it is the side itself to move', () => {
    expect(threatsAgainst(START, 'w')).toEqual([]);
  });
});

describe('judgeMove', () => {
  const scores = { d2d4: 30, e2e4: 35, g2g4: -90, b1c3: 20 };

  it('grades by the score drop against the best move', () => {
    expect(judgeMove({ fenBefore: START, uci: 'e2e4', courseUci: 'd2d4', scores }).grade).toBe(
      'best',
    );
    expect(judgeMove({ fenBefore: START, uci: 'd2d4', courseUci: 'd2d4', scores }).grade).toBe(
      'best',
    );
    expect(judgeMove({ fenBefore: START, uci: 'b1c3', courseUci: 'd2d4', scores }).grade).toBe(
      'good',
    );
    const bad = judgeMove({ fenBefore: START, uci: 'g2g4', courseUci: 'd2d4', scores });
    expect(['inaccuracy', 'mistake', 'blunder']).toContain(bad.grade);
    expect(bad.courseScore).toEqual({ cp: 30 });
    expect(bad.bestUci).toBe('e2e4');
  });

  it('works without scores (positional comparison only)', () => {
    const v = judgeMove({ fenBefore: START, uci: 'g2g4', courseUci: 'd2d4' });
    expect(v.score).toBeUndefined();
    expect(v.lost.some((f) => f.key === 'center')).toBe(true);
  });

  it('bestOf picks the best score for the side to move', () => {
    expect(bestOf(scores, 'w')).toEqual({ cp: 35 });
    expect(bestOf(scores, 'b')).toEqual({ cp: -90 });
    expect(bestOf(undefined, 'w')).toBeUndefined();
  });
});
