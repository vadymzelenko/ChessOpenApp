import type { ExplorerNode } from '../pack/schema';
import { seededRandom } from '../sessions/exam';
import { chooseOpponentMove, opponentWeights, practicalChances } from './opponent';

const node: ExplorerNode = {
  moves: [
    { san: 'd5', stats: { '1400-1800': { w: 300, d: 100, l: 200 } } }, // 60 %
    { san: 'Nf6', stats: { '1400-1800': { w: 150, d: 50, l: 100 } } }, // 30 %
    { san: 'f6', stats: { '1400-1800': { w: 80, d: 5, l: 15 } } }, // 10 %, a blunder
  ],
};
const evals: Record<string, { cp: number }> = { d5: { cp: 30 }, Nf6: { cp: 20 }, f6: { cp: 250 } };
const ctx = { side: 'b' as const, evalAfter: (san: string) => evals[san] };

function frequencies(mode: Parameters<typeof chooseOpponentMove>[2], n = 4000, extra = {}) {
  const random = seededRandom(7);
  const count: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const m = chooseOpponentMove(node, '1400-1800', mode, { ...ctx, ...extra }, random)!;
    count[m] = (count[m] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(count).map(([k, v]) => [k, v / n]));
}

describe('chooseOpponentMove', () => {
  it('realistic: follows popularity (ТЗ: «распределение ходов совпадает со статистикой»)', () => {
    const f = frequencies('realistic');
    expect(f.d5).toBeCloseTo(0.6, 1);
    expect(f.Nf6).toBeCloseTo(0.3, 1);
    expect(f.f6).toBeCloseTo(0.1, 1);
  });

  it('hard: avoids the blunder', () => {
    expect(frequencies('hard').f6 ?? 0).toBeLessThan(0.05);
  });

  it('traps: plays the popular mistake more often', () => {
    expect(frequencies('traps').f6).toBeGreaterThan(0.3);
  });

  it('rare: prefers unpopular moves', () => {
    const f = frequencies('rare');
    expect(f.f6).toBeGreaterThan(f.d5!);
  });

  it('weak-spots: steers towards positions where the user is weak', () => {
    const f = frequencies('weak-spots', 4000, {
      weakness: (san: string) => (san === 'Nf6' ? 3 : 0),
    });
    expect(f.Nf6).toBeGreaterThan(f.d5!);
  });

  it('returns null for an empty node and falls back to other rating groups', () => {
    expect(chooseOpponentMove({ moves: [] }, 'lt1400', 'realistic', ctx)).toBeNull();
    const w = opponentWeights(node, 'gt1800', 'realistic', ctx);
    expect(w.map((m) => Math.round(m.share * 10))).toEqual([6, 3, 1]);
  });
});

describe('practicalChances', () => {
  it('sums W/D/L of the position for the group', () => {
    const c = practicalChances(node, '1400-1800')!;
    expect(c.games).toBe(1000);
    expect(c.white).toBeCloseTo(0.53);
    expect(c.draw).toBeCloseTo(0.155);
    expect(c.black).toBeCloseTo(0.315);
    expect(practicalChances(node, 'gt1800')).toBeNull();
  });
});
