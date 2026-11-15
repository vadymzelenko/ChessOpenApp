import { ChessGame } from '@chess-open/core';

import { diffPieces, keyPieces, type KeyedPiece } from './pieceDiff';

function ids() {
  let n = 0;
  return () => `p${++n}`;
}

function idAt(pieces: KeyedPiece[], square: string): string | undefined {
  return pieces.find((p) => p.square === square)?.id;
}

describe('diffPieces', () => {
  it('keeps the id of a moving piece', () => {
    const newId = ids();
    const g = new ChessGame();
    const start = keyPieces(g.pieces(), newId);
    g.play('Nf3');
    const { pieces, removed } = diffPieces(start, g.pieces(), newId);
    expect(idAt(pieces, 'f3')).toBe(idAt(start, 'g1'));
    expect(removed).toEqual([]);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(32);
  });

  it('reports captured pieces as removed', () => {
    const newId = ids();
    const g = ChessGame.fromSan(['e4', 'd5']);
    const before = keyPieces(g.pieces(), newId);
    g.play('exd5');
    const { pieces, removed } = diffPieces(before, g.pieces(), newId);
    expect(idAt(pieces, 'd5')).toBe(idAt(before, 'e4'));
    expect(removed.map((r) => r.square)).toEqual(['d5']);
  });

  it('moves both king and rook when castling', () => {
    const newId = ids();
    const g = ChessGame.fromSan(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
    const before = keyPieces(g.pieces(), newId);
    g.play('O-O');
    const { pieces } = diffPieces(before, g.pieces(), newId);
    expect(idAt(pieces, 'g1')).toBe(idAt(before, 'e1'));
    expect(idAt(pieces, 'f1')).toBe(idAt(before, 'h1'));
  });

  it('removes the pawn captured en passant from its own square', () => {
    const newId = ids();
    const g = ChessGame.fromSan(['e4', 'a6', 'e5', 'd5']);
    const before = keyPieces(g.pieces(), newId);
    g.play('exd6');
    const { removed } = diffPieces(before, g.pieces(), newId);
    expect(removed.map((r) => r.square)).toEqual(['d5']);
  });

  it('keeps the pawn id through promotion', () => {
    const newId = ids();
    const g = new ChessGame('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    const before = keyPieces(g.pieces(), newId);
    g.play({ from: 'a7', to: 'a8', promotion: 'n' });
    const { pieces, removed } = diffPieces(before, g.pieces(), newId);
    expect(idAt(pieces, 'a8')).toBe(idAt(before, 'a7'));
    expect(removed).toEqual([]);
  });

  it('handles undo (piece returns, captured piece reappears with a new id)', () => {
    const newId = ids();
    const g = ChessGame.fromSan(['e4', 'd5', 'exd5']);
    const before = keyPieces(g.pieces(), newId);
    g.undo();
    const { pieces } = diffPieces(before, g.pieces(), newId);
    expect(idAt(pieces, 'e4')).toBe(idAt(before, 'd5'));
    expect(pieces).toHaveLength(32);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(32);
  });
});
