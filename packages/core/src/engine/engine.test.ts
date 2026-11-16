import { classifyMove, formatScore, winProbability, winningChances } from './score';
import { parseUciInfo, pvToSan, toWhitePov } from './uci';

describe('parseUciInfo', () => {
  it('parses depth, multipv, score and pv', () => {
    const i = parseUciInfo(
      'info depth 20 seldepth 28 multipv 2 score cp -35 nodes 123 nps 1000 hashfull 5 tbhits 0 time 50 pv e7e5 g1f3 b8c6',
    );
    expect(i).toEqual({ depth: 20, multipv: 2, cp: -35, pv: ['e7e5', 'g1f3', 'b8c6'] });
  });

  it('parses mate scores', () => {
    expect(parseUciInfo('info depth 12 score mate -3 pv d8h4')?.mate).toBe(-3);
  });

  it('ignores lines without a score and bound scores', () => {
    expect(parseUciInfo('info string NNUE enabled')).toBeNull();
    expect(parseUciInfo('bestmove e2e4')).toBeNull();
    expect(parseUciInfo('info depth 10 score cp 20 lowerbound pv e2e4')).toBeNull();
  });

  it('converts to White point of view', () => {
    expect(toWhitePov({ cp: 30 }, 'b')).toEqual({ cp: -30 });
    expect(toWhitePov({ mate: 2 }, 'b')).toEqual({ mate: -2 });
    expect(toWhitePov({ cp: 30 }, 'w')).toEqual({ cp: 30 });
  });
});

describe('winning chances and classification', () => {
  it('maps scores to [-1, 1]', () => {
    expect(winningChances({ cp: 0 })).toBeCloseTo(0);
    expect(winningChances({ cp: 100 })).toBeCloseTo(0.182, 3);
    expect(winningChances({ cp: 5000 })).toBeCloseTo(winningChances({ cp: 1000 }));
    expect(winningChances({ mate: 3 })).toBe(1);
    expect(winningChances({ mate: -1 })).toBe(-1);
    expect(winProbability({ cp: 0 }, 'b')).toBeCloseTo(0.5);
  });

  it('classifies by the drop of the mover', () => {
    expect(classifyMove({ cp: 30 }, { cp: 20 }, 'w')).toBe('good');
    expect(classifyMove({ cp: 30 }, { cp: -60 }, 'w')).toBe('inaccuracy');
    expect(classifyMove({ cp: 30 }, { cp: -90 }, 'w')).toBe('mistake');
    expect(classifyMove({ cp: 30 }, { cp: -400 }, 'w')).toBe('blunder');
    // For Black a rising White score is bad.
    expect(classifyMove({ cp: 0 }, { cp: 400 }, 'b')).toBe('blunder');
    expect(classifyMove({ cp: 0 }, { cp: -300 }, 'b')).toBe('good');
    expect(classifyMove({ cp: 0 }, { cp: -300 }, 'w', true)).toBe('best');
  });

  it('formats scores', () => {
    expect(formatScore({ cp: 43 })).toBe('+0.4');
    expect(formatScore({ cp: -120 })).toBe('−1.2');
    expect(formatScore({ cp: 2 })).toBe('0.0');
    expect(formatScore({ mate: 3 })).toBe('#3');
    expect(formatScore({ mate: -2 })).toBe('#−2');
  });
});

describe('pvToSan', () => {
  it('converts a UCI line and stops at an illegal move', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(pvToSan(start, ['d2d4', 'd7d5', 'c1f4', 'e1e8', 'g8f6'])).toEqual(['d4', 'd5', 'Bf4']);
    expect(pvToSan('7k/P7/8/8/8/8/8/K7 w - - 0 1', ['a7a8q'])).toEqual(['a8=Q+']);
    expect(pvToSan(start, ['e2e4', 'e7e5', 'g1f3'], 2)).toEqual(['e4', 'e5']);
  });
});
