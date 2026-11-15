import { ChessGame } from './game';
import {
  START_FEN,
  isLightSquare,
  isSquare,
  isValidFen,
  positionHash,
  positionKey,
} from './position';

describe('positionKey', () => {
  it('drops the half-move clock and move number', () => {
    expect(positionKey(START_FEN)).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');
  });

  it('maps transpositions to the same key (London move orders)', () => {
    const a = ChessGame.fromSan(['d4', 'd5', 'Bf4', 'Nf6', 'e3']);
    const b = ChessGame.fromSan(['d4', 'Nf6', 'Bf4', 'd5', 'e3']);
    expect(a.key).toBe(b.key);
    // Bf4 must come before e3 (e3 shuts the c1 bishop in) — but Nf3/e6 can be in any order.
    const c = ChessGame.fromSan(['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3']);
    const d = ChessGame.fromSan(['d4', 'Nf6', 'Nf3', 'e6', 'Bf4', 'd5', 'e3']);
    expect(c.key).toBe(d.key);
    expect(c.fen).not.toBe(d.fen); // half-move clocks differ, the key does not
    // FENs differ only in counters — or not at all — but keys are identical.
    expect(positionHash(a.fen)).toBe(positionHash(b.fen));
  });

  it('ignores an en-passant square when no capture is possible', () => {
    const g = ChessGame.fromSan(['e4']);
    expect(g.key.endsWith(' -')).toBe(true);
    expect(positionKey('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')).toBe(g.key);
  });

  it('keeps the en-passant square when the capture is legal', () => {
    const g = ChessGame.fromSan(['e4', 'a6', 'e5', 'd5']);
    expect(g.key.endsWith(' d6')).toBe(true);
  });

  it('distinguishes side to move and castling rights', () => {
    const w = ChessGame.fromSan(['Nf3', 'Nf6', 'Ng1', 'Ng8']);
    expect(w.key).toBe(positionKey(START_FEN));
    const lostRights = ChessGame.fromSan(['e4', 'e5', 'Ke2', 'Ke7', 'Ke1', 'Ke8']);
    expect(lostRights.key).not.toBe(ChessGame.fromSan(['e4', 'e5']).key);
  });
});

describe('helpers', () => {
  it('validates FEN and squares', () => {
    expect(isValidFen(START_FEN)).toBe(true);
    expect(isValidFen('not a fen')).toBe(false);
    expect(isSquare('e4')).toBe(true);
    expect(isSquare('i9')).toBe(false);
  });

  it('knows square colours', () => {
    expect(isLightSquare('h1')).toBe(true);
    expect(isLightSquare('a1')).toBe(false);
    expect(isLightSquare('d1')).toBe(true);
    expect(isLightSquare('e1')).toBe(false);
  });
});
