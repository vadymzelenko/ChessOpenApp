import { ChessGame } from '../chess/game';
import { START_FEN } from '../chess/position';
import { advantageFactors, factorsLeader, positionFeatures } from './explain';

describe('positionFeatures', () => {
  it('is symmetric in the start position', () => {
    const f = positionFeatures(START_FEN);
    expect(f.material).toEqual({ w: 39, b: 39 });
    expect(f.development).toEqual({ w: 0, b: 0 });
    expect(f.mobility).toEqual({ w: 20, b: 20 });
    expect(f.castled).toEqual({ w: false, b: false });
    expect(f.weakPawns).toEqual({ w: 0, b: 0 });
    expect(advantageFactors(START_FEN)).toEqual([]);
  });

  it('counts development, castling and the centre', () => {
    const g = ChessGame.fromSan(['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Be7', 'Bd3', 'O-O']);
    const f = positionFeatures(g.fen);
    expect(f.development).toEqual({ w: 3, b: 2 });
    expect(f.castled).toEqual({ w: false, b: true });
  });

  it('detects doubled and isolated pawns', () => {
    // White: pawns a2, c2, c3 (c-pawns doubled; a2 isolated, c-pawns isolated).
    const f = positionFeatures('4k3/pppp4/8/8/8/2P5/P1P5/4K3 w - - 0 1');
    expect(f.weakPawns.w).toBe(4); // 1 doubled + a2 isolated + 2 isolated c-pawns
    expect(f.weakPawns.b).toBe(0);
  });

  it('flags a king stuck in the centre with queens on', () => {
    const f = positionFeatures('r1bq1bnr/pppp1kpp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQ - 0 5');
    expect(f.kingStuck.b).toBe(true);
    expect(f.kingStuck.w).toBe(false);
  });
});

describe('advantageFactors', () => {
  it('ranks material first and names the side', () => {
    // White is a knight up.
    const factors = advantageFactors('rnbqkb1r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(factors[0]).toEqual({ key: 'material', side: 'w', amount: 3 });
    expect(factorsLeader(factors)).toBe('w');
  });

  it('explains a development lead and an uncastled king', () => {
    const g = ChessGame.fromSan(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O', 'd6', 'Nc3', 'h6']);
    const keys = advantageFactors(g.fen).map((f) => `${f.key}:${f.side}`);
    expect(keys).toContain('king:w');
  });
});
