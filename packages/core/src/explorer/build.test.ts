import { ChessGame } from '../chess/game';
import { positionKey } from '../chess/position';
import { samplePack } from '../pack/fixtures';
import { validatePack } from '../pack/validate';
import { buildExplorer, type FetchPosition } from './build';
import { coverage, coverageReport } from './coverage';
import { repertoireFromPack } from './repertoire';
import type { MoveStats } from './select';

const key = (...sans: string[]) => ChessGame.fromSan(sans).key;
const mv = (san: string, games: number, strong = 0): MoveStats => ({
  san,
  stats: {
    '1400-1800': { w: games, d: 0, l: 0 },
    ...(strong ? { gt1800: { w: strong, d: 0, l: 0 } } : {}),
  },
});

/** Fake database: position → move statistics. */
const DB = new Map<string, MoveStats[]>([
  [key(), [mv('d4', 1000), mv('e4', 800)]],
  [key('d4'), [mv('d5', 600), mv('Nf6', 300), mv('e6', 60), mv('g6', 40)]],
  [key('d4', 'd5'), [mv('Bf4', 500), mv('c4', 300, 200)]],
  [key('d4', 'Nf6'), [mv('Bf4', 200), mv('c4', 100)]],
  [key('d4', 'd5', 'Bf4'), [mv('Nf6', 300), mv('c5', 150), mv('e6', 50)]],
  [key('d4', 'd5', 'Bf4', 'Nf6'), [mv('e3', 280, 120), mv('Nf3', 20)]],
  [key('d4', 'd5', 'Bf4', 'c5'), [mv('e3', 140), mv('c3', 10)]],
  [key('d4', 'd5', 'Bf4', 'Nf6', 'e3'), [mv('e6', 30)]],
]);

function fakeSource() {
  const calls: string[] = [];
  const fetch: FetchPosition = async (fen) => {
    calls.push(positionKey(fen));
    return DB.get(positionKey(fen)) ?? [];
  };
  return { fetch, calls };
}

const OURS = new Map([
  [key(), 'd4'],
  [key('d4', 'd5'), 'Bf4'],
  [key('d4', 'Nf6'), 'Bf4'],
]);

describe('buildExplorer', () => {
  it('expands opponent moves by the selection rule and our moves from the repertoire', async () => {
    const { fetch } = fakeSource();
    const r = await buildExplorer(fetch, { side: 'w', ours: OURS, autoContinue: null });
    expect(r.nodes[key()]!.moves.map((m) => [m.san, !!m.repertoire])).toEqual([
      ['d4', true],
      ['e4', false],
    ]);
    // 1…d5 (60 %) + 1…Nf6 (30 %) reach 85 %; e6/g6 are not stored.
    expect(r.nodes[key('d4')]!.moves.map((m) => m.san)).toEqual(['d5', 'Nf6']);
    expect(r.nodes[key('d4')]!.total).toBe(1000);
  });

  it('reports holes ordered by probability', async () => {
    const { fetch } = fakeSource();
    const r = await buildExplorer(fetch, { side: 'w', ours: OURS, autoContinue: null });
    expect(r.holes.map((h) => [h.path.join(' '), Number(h.probability.toFixed(2))])).toEqual([
      ['d4 d5 Bf4 Nf6', 0.36],
      ['d4 d5 Bf4 c5', 0.18],
    ]);
  });

  it('continues with the most popular strong move outside the course, marked auto', async () => {
    const { fetch } = fakeSource();
    const r = await buildExplorer(fetch, {
      side: 'w',
      ours: OURS,
      autoContinue: { minGames: 100 },
    });
    const node = r.nodes[key('d4', 'd5', 'Bf4', 'Nf6')]!;
    expect(node.moves[0]).toMatchObject({ san: 'e3', repertoire: true, auto: true });
    expect(r.nodes[key('d4', 'd5', 'Bf4', 'Nf6', 'e3')]).toBeDefined();
  });

  it('stops on probability, game count and depth', async () => {
    const { fetch, calls } = fakeSource();
    await buildExplorer(fetch, { side: 'w', ours: OURS, autoContinue: null, minProbability: 0.5 });
    // Only 1…d5 (60 %) passes 50 %; 1…Nf6 (30 %) is cut.
    expect(calls).not.toContain(key('d4', 'Nf6'));

    const few = fakeSource();
    await buildExplorer(few.fetch, { side: 'w', ours: OURS, autoContinue: null, minGames: 2000 });
    // Our course move is always followed; the opponent's sparse position is not expanded.
    expect(few.calls).toEqual([key(), key('d4')]);

    const shallow = fakeSource();
    const r = await buildExplorer(shallow.fetch, {
      side: 'w',
      ours: OURS,
      autoContinue: null,
      maxPlies: 1,
    });
    expect(r.maxPly).toBe(1);
  });

  it('keeps rare opponent moves marked in the course', async () => {
    const { fetch } = fakeSource();
    const forced = new Map([[key('d4'), new Set(['g6'])]]);
    const r = await buildExplorer(fetch, { side: 'w', ours: OURS, forced, autoContinue: null });
    expect(r.nodes[key('d4')]!.moves.map((m) => m.san)).toEqual(['d5', 'Nf6', 'g6']);
  });

  it('respects the position cap', async () => {
    const { fetch, calls } = fakeSource();
    await buildExplorer(fetch, { side: 'w', ours: OURS, maxPositions: 3 });
    expect(calls).toHaveLength(3);
  });

  it('produces nodes that pass pack validation', async () => {
    const { fetch } = fakeSource();
    const r = await buildExplorer(fetch, { side: 'w', ours: OURS });
    const pack = { ...samplePack(), explorer: r.nodes };
    const v = validatePack(pack);
    if (!v.ok) throw new Error(v.errors.join('\n'));
  });
});

describe('coverage', () => {
  it('computes the share of games staying in the repertoire', async () => {
    const { fetch } = fakeSource();
    const { nodes } = await buildExplorer(fetch, { side: 'w', ours: OURS, autoContinue: null });
    expect(coverage(nodes, OURS, 'w', 1)).toBe(1); // we always play 1.d4
    expect(coverage(nodes, OURS, 'w', 2)).toBeCloseTo(0.9); // 1…d5 + 1…Nf6
    expect(coverage(nodes, OURS, 'w', 3)).toBeCloseTo(0.9); // both answered with Bf4
    // After 2.Bf4: the d5 branch keeps 90 % (Nf6 + c5), the Nf6 branch has no data.
    expect(coverage(nodes, OURS, 'w', 4)).toBeCloseTo(0.54);
    expect(coverage(nodes, OURS, 'w', 5)).toBe(0); // no repertoire move after 2…Nf6 / 2…c5
  });

  it('reports coverage by move number', async () => {
    const { fetch } = fakeSource();
    const { nodes } = await buildExplorer(fetch, { side: 'w', ours: OURS, autoContinue: null });
    const r = coverageReport(nodes, OURS, 'w', [1, 2, 3]);
    expect(r[1]).toBe(1);
    expect(r[2]).toBeCloseTo(0.9);
    expect(r[3]).toBe(0);
  });
});

describe('repertoireFromPack', () => {
  it('collects our moves and the opponent moves shown by the course', () => {
    const v = validatePack(samplePack());
    if (!v.ok) throw new Error(v.errors.join('\n'));
    const rep = repertoireFromPack(v.pack);
    expect(rep.ours.get(key())).toBe('d4');
    expect(rep.ours.get(key('d4', 'd5'))).toBe('Bf4');
    expect([...rep.forced.get(key('d4', 'd5', 'Bf4'))!].sort()).toEqual(['Nf6', 'c5']);
  });
});
