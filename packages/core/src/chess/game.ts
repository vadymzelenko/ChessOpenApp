import { Chess, type Move as ChessJsMove } from 'chess.js';

import {
  START_FEN,
  positionKey,
  type Color,
  type PieceType,
  type PlacedPiece,
  type PromotionPiece,
  type Square,
} from './position';

/** A move as entered on the board. */
export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
}

export interface LegalMove {
  from: Square;
  to: Square;
  san: string;
  promotion?: PromotionPiece;
  capture: boolean;
}

export interface MoveRecord {
  /** 1-based half-move index. */
  ply: number;
  color: Color;
  piece: PieceType;
  from: Square;
  to: Square;
  san: string;
  /** e.g. "e2e4", "e7e8q". */
  uci: string;
  promotion?: PromotionPiece;
  captured?: PieceType;
  /** Square of the captured piece (differs from `to` for en passant). */
  capturedSquare?: Square;
  castle?: 'k' | 'q';
  enPassant: boolean;
  check: boolean;
  checkmate: boolean;
  fenAfter: string;
  keyAfter: string;
}

export type GameStatus =
  | 'playing'
  | 'checkmate'
  | 'stalemate'
  | 'insufficient-material'
  | 'threefold-repetition'
  | 'fifty-moves';

export function toRecord(m: ChessJsMove, ply: number, after: Chess): MoveRecord {
  const promotion = m.promotion as PromotionPiece | undefined;
  const enPassant = m.isEnPassant();
  const record: MoveRecord = {
    ply,
    color: m.color,
    piece: m.piece,
    from: m.from,
    to: m.to,
    san: m.san,
    uci: m.lan,
    enPassant,
    check: after.inCheck(),
    checkmate: after.isCheckmate(),
    fenAfter: m.after,
    keyAfter: positionKey(m.after),
  };
  if (promotion) record.promotion = promotion;
  if (m.captured) {
    record.captured = m.captured;
    record.capturedSquare = enPassant ? (`${m.to[0]}${m.from[1]}` as Square) : m.to;
  }
  if (m.isKingsideCastle()) record.castle = 'k';
  if (m.isQueensideCastle()) record.castle = 'q';
  return record;
}

/**
 * Game with history and a browsing cursor (ТЗ §6 «Ход назад и навигация»).
 *
 * - `play()` only works at the end of the history; while browsing the past
 *   the board does not accept moves unless `truncateToCursor()` («играть
 *   отсюда») is called first.
 * - Never throws on illegal input: illegal moves return `null`.
 * - Mutable; `version` increments on every change so UI stores can subscribe.
 */
export class ChessGame {
  readonly startFen: string;
  private readonly records: MoveRecord[] = [];
  /** Number of half-moves applied in the displayed position (0..length). */
  private cursorPly = 0;
  /** Chess instance for the *last* position of the history. */
  private readonly end: Chess;
  /** Cached instance for the cursor position when browsing. */
  private cursorCache: { ply: number; chess: Chess } | null = null;
  private _version = 0;

  constructor(startFen: string = START_FEN) {
    this.end = new Chess(startFen);
    this.startFen = this.end.fen();
  }

  /** Build a game from SAN moves. Throws if a move is illegal. */
  static fromSan(moves: readonly string[], startFen: string = START_FEN): ChessGame {
    const g = new ChessGame(startFen);
    for (const san of moves) {
      if (!g.play(san)) throw new Error(`Illegal move "${san}" at ply ${g.length + 1}`);
    }
    return g;
  }

  /** Build a game from PGN (main line only). Throws on invalid PGN. */
  static fromPgn(pgn: string): ChessGame {
    const tmp = new Chess();
    tmp.loadPgn(pgn);
    const header = tmp.getHeaders();
    const start = header.FEN && header.SetUp === '1' ? header.FEN : START_FEN;
    return ChessGame.fromSan(tmp.history(), start);
  }

  get version(): number {
    return this._version;
  }

  get length(): number {
    return this.records.length;
  }

  get cursor(): number {
    return this.cursorPly;
  }

  get isAtEnd(): boolean {
    return this.cursorPly === this.records.length;
  }

  get history(): readonly MoveRecord[] {
    return this.records;
  }

  /** Move that led to the displayed position, if any. */
  get lastMove(): MoveRecord | null {
    return this.cursorPly > 0 ? (this.records[this.cursorPly - 1] ?? null) : null;
  }

  get fen(): string {
    return this.cursorPly === 0 ? this.startFen : this.records[this.cursorPly - 1]!.fenAfter;
  }

  get key(): string {
    return positionKey(this.fen);
  }

  get turn(): Color {
    return this.at().turn();
  }

  get inCheck(): boolean {
    return this.at().inCheck();
  }

  get status(): GameStatus {
    const c = this.at();
    if (c.isCheckmate()) return 'checkmate';
    if (c.isStalemate()) return 'stalemate';
    if (c.isInsufficientMaterial()) return 'insufficient-material';
    if (c.isDrawByFiftyMoves()) return 'fifty-moves';
    // Repetition needs the full history, which only `end` has.
    if (this.isAtEnd && this.end.isThreefoldRepetition()) return 'threefold-repetition';
    return 'playing';
  }

  /** King square of the side to move when it is in check (for highlighting). */
  get checkedKingSquare(): Square | null {
    const c = this.at();
    if (!c.inCheck()) return null;
    return c.findPiece({ color: c.turn(), type: 'k' })[0] ?? null;
  }

  pieces(): PlacedPiece[] {
    const out: PlacedPiece[] = [];
    for (const row of this.at().board()) {
      for (const cell of row) {
        if (cell) out.push({ square: cell.square, color: cell.color, type: cell.type });
      }
    }
    return out;
  }

  pieceAt(square: Square): PlacedPiece | null {
    const p = this.at().get(square);
    return p ? { square, color: p.color, type: p.type } : null;
  }

  /** Legal moves in the displayed position, optionally from one square. */
  legalMoves(from?: Square): LegalMove[] {
    const c = this.at();
    const moves = from ? c.moves({ square: from, verbose: true }) : c.moves({ verbose: true });
    return moves.map((m) => {
      const lm: LegalMove = { from: m.from, to: m.to, san: m.san, capture: m.isCapture() };
      if (m.promotion) lm.promotion = m.promotion as PromotionPiece;
      return lm;
    });
  }

  /** Destination squares for a piece (deduplicated over promotion choices). */
  destinations(from: Square): Square[] {
    return [...new Set(this.legalMoves(from).map((m) => m.to))];
  }

  /** True if moving from→to is a legal pawn promotion (UI should ask for the piece). */
  isPromotion(from: Square, to: Square): boolean {
    return this.legalMoves(from).some((m) => m.to === to && m.promotion !== undefined);
  }

  isLegal(input: MoveInput): boolean {
    return this.legalMoves(input.from).some(
      (m) =>
        m.to === input.to &&
        (m.promotion === undefined || m.promotion === (input.promotion ?? 'q')),
    );
  }

  /**
   * Play a move at the end of the history. Accepts SAN ("Nf3") or
   * {from, to, promotion}. Promotion defaults to queen when omitted.
   * Returns null if the move is illegal or the cursor is not at the end.
   */
  play(input: MoveInput | string): MoveRecord | null {
    if (!this.isAtEnd) return null;
    let m: ChessJsMove;
    try {
      m =
        typeof input === 'string'
          ? this.end.move(input)
          : this.end.move({ from: input.from, to: input.to, promotion: input.promotion ?? 'q' });
    } catch {
      return null;
    }
    const record = toRecord(m, this.records.length + 1, this.end);
    this.records.push(record);
    this.cursorPly = this.records.length;
    this.touch();
    return record;
  }

  /** Take back the last move («взять ход назад»). Returns it, or null. */
  undo(): MoveRecord | null {
    const last = this.records.pop();
    if (!last) return null;
    this.end.undo();
    this.cursorPly = this.records.length;
    this.touch();
    return last;
  }

  /** Move the browsing cursor. Clamped to [0, length]. */
  goTo(ply: number): void {
    const next = Math.max(0, Math.min(this.records.length, Math.trunc(ply)));
    if (next === this.cursorPly) return;
    this.cursorPly = next;
    this.touch();
  }

  back(): void {
    this.goTo(this.cursorPly - 1);
  }

  forward(): void {
    this.goTo(this.cursorPly + 1);
  }

  toStart(): void {
    this.goTo(0);
  }

  toEnd(): void {
    this.goTo(this.records.length);
  }

  /** «Играть отсюда»: drop every move after the cursor. */
  truncateToCursor(): void {
    if (this.isAtEnd) return;
    while (this.records.length > this.cursorPly) {
      this.records.pop();
      this.end.undo();
    }
    this.touch();
  }

  /** SAN of the moves up to the end of the history. */
  sanMoves(): string[] {
    return this.records.map((r) => r.san);
  }

  pgn(): string {
    return this.end.pgn();
  }

  private at(): Chess {
    if (this.isAtEnd) return this.end;
    if (this.cursorCache?.ply !== this.cursorPly) {
      this.cursorCache = { ply: this.cursorPly, chess: new Chess(this.fen) };
    }
    return this.cursorCache.chess;
  }

  private touch(): void {
    this.cursorCache = null;
    this._version++;
  }
}
