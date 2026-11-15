import { Chess, DEFAULT_POSITION, validateFen } from 'chess.js';

export const START_FEN = DEFAULT_POSITION;

export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';
export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type Square = `${File}${Rank}`;

export const FILES: readonly File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS: readonly Rank[] = ['1', '2', '3', '4', '5', '6', '7', '8'];

export interface PlacedPiece {
  square: Square;
  color: Color;
  type: PieceType;
}

export function isSquare(s: string): s is Square {
  return /^[a-h][1-8]$/.test(s);
}

export function isValidFen(fen: string): boolean {
  return validateFen(fen).ok;
}

/**
 * Position key (ТЗ §3 «Данные внутри приложения»): FEN without the half-move
 * clock and move number, with the en-passant square kept only when an
 * en-passant capture is actually legal. Transpositions therefore map to the
 * same key regardless of move order.
 */
export function positionKey(fen: string): string {
  // chess.js normalises the en-passant field to legal captures only.
  const normalized = new Chess(fen).fen();
  return normalized.split(' ').slice(0, 4).join(' ');
}

/** 64-bit Zobrist hash (hex) of the position — a compact alternative key. */
export function positionHash(fen: string): string {
  return new Chess(fen).hash();
}

/** Square colour: true for light squares (h1 is light). */
export function isLightSquare(square: Square): boolean {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return (file + rank) % 2 === 1;
}
