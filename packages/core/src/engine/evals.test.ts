import { ChessGame } from '../chess/game';
import { samplePack } from '../pack/fixtures';
import { validatePack } from '../pack/validate';
import { buildEvals, packPositions, type Evaluator } from './evals';

function pack() {
  const v = validatePack(samplePack());
  if (!v.ok) throw new Error(v.errors.join('\n'));
  return v.pack;
}

describe('packPositions', () => {
  it('collects unique positions of the course (transpositions once)', () => {
    const positions = packPositions(pack());
    // start, d4, d4 d5, +Bf4, then Nf6/e3 branch (2) and c5/e3 branch (2)
    expect(positions.size).toBe(8);
    expect(positions.has(ChessGame.fromSan(['d4', 'd5', 'Bf4', 'c5', 'e3']).key)).toBe(true);
  });

  it('adds explorer positions and the positions after their moves', () => {
    const p = pack();
    const key = ChessGame.fromSan(['e4']).key;
    p.explorer = { [key]: { moves: [{ san: 'c5', stats: {} }] } };
    const positions = packPositions(p);
    expect(positions.has(key)).toBe(true);
    expect(positions.has(ChessGame.fromSan(['e4', 'c5']).key)).toBe(true);
  });
});

describe('buildEvals', () => {
  it('tries evaluators in order and reports the rest as missing', async () => {
    const positions = packPositions(pack());
    const keys = [...positions.keys()];
    const cloud: Evaluator = async (fen) => (fen.includes(' w ') ? { cp: 25, depth: 40 } : null);
    const local: Evaluator = async (fen) =>
      fen.startsWith('rnbqkbnr/ppp1pppp') ? { cp: -10, depth: 18 } : null;
    const existing = { [keys[0]!]: { cp: 1, depth: 99 } };
    const r = await buildEvals(positions, [cloud, local], existing);
    expect(r.evals[keys[0]!]).toEqual({ cp: 1, depth: 99 });
    expect(r.answered[0]).toBeGreaterThan(0);
    expect(r.answered[1]).toBeGreaterThan(0);
    expect(Object.keys(r.evals).length + r.missing.length).toBe(positions.size);
  });
});

describe('buildEvals time budget', () => {
  it('stops evaluating once shouldStop is true and reports the rest as missing', async () => {
    const positions = new Map([
      ['a', 'fa'],
      ['b', 'fb'],
      ['c', 'fc'],
    ]);
    let calls = 0;
    const r = await buildEvals(
      positions,
      [async () => (calls++, { cp: 10 })],
      {},
      undefined,
      () => calls >= 2,
    );
    expect(Object.keys(r.evals)).toEqual(['a', 'b']);
    expect(r.missing).toEqual(['c']);
  });
});
