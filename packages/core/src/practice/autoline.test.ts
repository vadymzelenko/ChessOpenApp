import { ChessGame } from '../chess/game';
import { START_FEN } from '../chess/position';
import type { ExplorerNode } from '../pack/schema';
import { autoContinuation } from './autoline';

const key = (...m: string[]) => ChessGame.fromSan(m).key;
const mv = (san: string, n: number, repertoire = false) => ({
  san,
  stats: { '1400-1800': { w: n, d: 0, l: 0 } },
  ...(repertoire ? { repertoire: true } : {}),
});

const explorer: Record<string, ExplorerNode> = {
  [key()]: { moves: [mv('e4', 900), mv('d4', 100, true)] },
  [key('d4')]: { moves: [mv('d5', 600), mv('Nf6', 400)] },
  [key('d4', 'd5')]: { moves: [mv('c4', 500), mv('Bf4', 50, true)] },
  [key('d4', 'd5', 'Bf4')]: { moves: [mv('Nf6', 10)] },
};

describe('autoContinuation', () => {
  it('follows the repertoire for us and the most popular move for the opponent', () => {
    expect(autoContinuation(explorer, START_FEN, 'w')).toEqual(['d4', 'd5', 'Bf4', 'Nf6']);
  });

  it('stops at the end of the data or the ply limit', () => {
    expect(autoContinuation(explorer, START_FEN, 'w', 2)).toEqual(['d4', 'd5']);
    expect(autoContinuation({}, START_FEN, 'w')).toEqual([]);
  });

  it('falls back to the most played move when nothing is marked', () => {
    expect(autoContinuation(explorer, START_FEN, 'b')).toEqual(['e4']);
  });
});
