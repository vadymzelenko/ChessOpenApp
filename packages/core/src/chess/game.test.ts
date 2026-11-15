import { ChessGame } from './game';
import { START_FEN } from './position';

describe('ChessGame basics', () => {
  it('starts from the initial position', () => {
    const g = new ChessGame();
    expect(g.fen).toBe(START_FEN);
    expect(g.turn).toBe('w');
    expect(g.length).toBe(0);
    expect(g.pieces()).toHaveLength(32);
    expect(g.legalMoves()).toHaveLength(20);
  });

  it('plays moves by squares and by SAN', () => {
    const g = new ChessGame();
    const m1 = g.play({ from: 'e2', to: 'e4' });
    expect(m1?.san).toBe('e4');
    expect(m1?.uci).toBe('e2e4');
    expect(m1?.ply).toBe(1);
    expect(g.play('e5')?.from).toBe('e7');
    expect(g.sanMoves()).toEqual(['e4', 'e5']);
  });

  it('rejects illegal moves without throwing', () => {
    const g = new ChessGame();
    const v = g.version;
    expect(g.play({ from: 'e2', to: 'e5' })).toBeNull();
    expect(g.play('Ke2')).toBeNull();
    expect(g.play('nonsense')).toBeNull();
    expect(g.version).toBe(v);
    expect(g.isLegal({ from: 'g1', to: 'f3' })).toBe(true);
    expect(g.isLegal({ from: 'g1', to: 'g3' })).toBe(false);
  });

  it('lists destinations of a piece', () => {
    const g = new ChessGame();
    expect(g.destinations('g1').sort()).toEqual(['f3', 'h3']);
    expect(g.destinations('e1')).toEqual([]);
  });

  it('fromSan throws on an illegal sequence', () => {
    expect(() => ChessGame.fromSan(['e4', 'e4'])).toThrow(/Illegal move "e4" at ply 2/);
  });
});

describe('special moves', () => {
  it('castles kingside and queenside', () => {
    const g = ChessGame.fromSan(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
    const oo = g.play({ from: 'e1', to: 'g1' });
    expect(oo?.san).toBe('O-O');
    expect(oo?.castle).toBe('k');
    expect(g.pieceAt('f1')).toEqual({ square: 'f1', color: 'w', type: 'r' });

    const q = ChessGame.fromSan(['d4', 'd5', 'Nc3', 'Nc6', 'Bf4', 'Bf5', 'Qd2', 'Qd7']);
    const ooo = q.play({ from: 'e1', to: 'c1' });
    expect(ooo?.san).toBe('O-O-O');
    expect(ooo?.castle).toBe('q');
    expect(q.pieceAt('d1')?.type).toBe('r');
  });

  it('forbids castling through check', () => {
    // Black bishop on c5 controls g1? No — use a rook on the f-file instead.
    const g = new ChessGame('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
    expect(g.isLegal({ from: 'e1', to: 'g1' })).toBe(true);
    const blocked = new ChessGame('4kr2/8/8/8/8/8/8/4K2R w K - 0 1');
    expect(blocked.isLegal({ from: 'e1', to: 'g1' })).toBe(false);
  });

  it('captures en passant and reports the captured square', () => {
    const g = ChessGame.fromSan(['e4', 'a6', 'e5', 'd5']);
    const ep = g.play({ from: 'e5', to: 'd6' });
    expect(ep?.enPassant).toBe(true);
    expect(ep?.captured).toBe('p');
    expect(ep?.capturedSquare).toBe('d5');
    expect(g.pieceAt('d5')).toBeNull();
  });

  it('en passant is only available immediately', () => {
    const g = ChessGame.fromSan(['e4', 'a6', 'e5', 'd5', 'Nf3', 'a5']);
    expect(g.isLegal({ from: 'e5', to: 'd6' })).toBe(false);
  });

  it('promotes, defaulting to a queen, and supports underpromotion', () => {
    const fen = '8/P6k/8/8/8/8/8/K7 w - - 0 1';
    const g = new ChessGame(fen);
    expect(g.isPromotion('a7', 'a8')).toBe(true);
    expect(g.destinations('a7')).toEqual(['a8']);
    const q = g.play({ from: 'a7', to: 'a8' });
    expect(q?.promotion).toBe('q');
    expect(q?.uci).toBe('a7a8q');

    const n = new ChessGame(fen).play({ from: 'a7', to: 'a8', promotion: 'n' });
    expect(n?.san).toBe('a8=N');
    expect(new ChessGame(fen).isPromotion('a1', 'a2')).toBe(false);
  });

  it('detects check, checkmate and the checked king square', () => {
    const g = ChessGame.fromSan(['f3', 'e5', 'g4']);
    const mate = g.play('Qh4#');
    expect(mate?.check).toBe(true);
    expect(mate?.checkmate).toBe(true);
    expect(g.status).toBe('checkmate');
    expect(g.inCheck).toBe(true);
    expect(g.checkedKingSquare).toBe('e1');
  });

  it('detects stalemate', () => {
    const g = new ChessGame('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
    g.play({ from: 'f7', to: 'f6' });
    expect(g.status).not.toBe('checkmate');
    const s = new ChessGame('7k/8/6QK/8/8/8/8/8 b - - 0 1');
    expect(s.status).toBe('stalemate');
  });

  it('detects threefold repetition', () => {
    const g = ChessGame.fromSan(['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']);
    expect(g.status).toBe('threefold-repetition');
  });
});

describe('undo and navigation', () => {
  it('undo restores the previous position', () => {
    const g = ChessGame.fromSan(['d4', 'd5']);
    const before = g.fen;
    g.play('Bf4');
    expect(g.undo()?.san).toBe('Bf4');
    expect(g.fen).toBe(before);
    expect(g.length).toBe(2);
    expect(new ChessGame().undo()).toBeNull();
  });

  it('browses history and refuses moves while not at the end', () => {
    const g = ChessGame.fromSan(['d4', 'd5', 'Bf4', 'Nf6']);
    g.back();
    expect(g.cursor).toBe(3);
    expect(g.isAtEnd).toBe(false);
    expect(g.lastMove?.san).toBe('Bf4');
    expect(g.turn).toBe('b');
    expect(g.play('Nf6')).toBeNull();
    expect(g.length).toBe(4);

    g.toStart();
    expect(g.fen).toBe(START_FEN);
    expect(g.lastMove).toBeNull();
    g.goTo(100);
    expect(g.cursor).toBe(4);
    g.goTo(-5);
    expect(g.cursor).toBe(0);
    g.forward();
    expect(g.lastMove?.san).toBe('d4');
  });

  it('«play from here» truncates the future', () => {
    const g = ChessGame.fromSan(['d4', 'd5', 'Bf4', 'Nf6']);
    g.goTo(2);
    g.truncateToCursor();
    expect(g.length).toBe(2);
    expect(g.isAtEnd).toBe(true);
    expect(g.play('c4')?.san).toBe('c4');
    expect(g.sanMoves()).toEqual(['d4', 'd5', 'c4']);
  });

  it('pieces() reflects the cursor position', () => {
    const g = ChessGame.fromSan(['e4', 'd5', 'exd5']);
    expect(g.pieces()).toHaveLength(31);
    g.goTo(2);
    expect(g.pieces()).toHaveLength(32);
  });
});

describe('PGN', () => {
  it('round-trips a PGN', () => {
    const g = ChessGame.fromSan(['d4', 'd5', 'Bf4', 'Nf6', 'e3']);
    const copy = ChessGame.fromPgn(g.pgn());
    expect(copy.sanMoves()).toEqual(g.sanMoves());
    expect(copy.key).toBe(g.key);
  });

  it('loads PGN with a custom start position', () => {
    const pgn = '[SetUp "1"]\n[FEN "8/P6k/8/8/8/8/8/K7 w - - 0 1"]\n\n1. a8=Q *';
    const g = ChessGame.fromPgn(pgn);
    expect(g.pieceAt('a8')?.type).toBe('q');
  });
});
