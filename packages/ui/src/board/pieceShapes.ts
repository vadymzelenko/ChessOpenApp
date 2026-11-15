/**
 * Our own chess piece set «Classic» (ТЗ §12: «Лучший вариант — свой набор»).
 * Pure data in a 45×45 viewBox, rendered by <PieceIcon/> with react-native-svg
 * and convertible to an SVG string for tests / web previews.
 */

export type PieceKind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

export type Shape =
  | { kind: 'path'; d: string }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  /** Interior detail stroke (drawn in the contrast colour, no fill). */
  | { kind: 'detail'; d: string };

const BASE: Shape = { kind: 'rect', x: 10.5, y: 34, w: 24, h: 5, rx: 2 };

export const pieceShapes: Record<PieceKind, Shape[]> = {
  p: [
    { kind: 'path', d: 'M18.5 22.5 C18.5 28 15.5 31 14 34 L31 34 C29.5 31 26.5 28 26.5 22.5 Z' },
    { kind: 'rect', x: 16.5, y: 19.5, w: 12, h: 3.5, rx: 1.75 },
    { kind: 'circle', cx: 22.5, cy: 14, r: 5.5 },
    { kind: 'rect', x: 12, y: 34, w: 21, h: 5, rx: 2 },
  ],
  r: [
    { kind: 'path', d: 'M13.5 34 L15 30.5 L15 18 L30 18 L30 30.5 L31.5 34 Z' },
    {
      kind: 'path',
      d: 'M12 18.5 L12 9.5 L16.5 9.5 L16.5 12.5 L20.5 12.5 L20.5 9.5 L24.5 9.5 L24.5 12.5 L28.5 12.5 L28.5 9.5 L33 9.5 L33 18.5 Z',
    },
    BASE,
    { kind: 'detail', d: 'M15 21 L30 21 M15 30.5 L30 30.5' },
  ],
  n: [
    {
      kind: 'path',
      d: 'M14 34 L31.5 34 C32 26 31 19.5 28 15 C26.5 12.5 24 10.8 22 10.2 L21 6.5 L18.6 10 C15.5 11.5 12.6 15 11.2 19.6 C10.6 21.8 11.6 23.6 13.4 23.2 C15.4 22.8 17.2 21.3 19.6 21 C19.2 25.5 15.5 28.5 14 34 Z',
    },
    BASE,
    { kind: 'detail', d: 'M17.6 14.4 L18.9 14.4 M24.5 14 C27 18 28 24 27.5 31' },
  ],
  b: [
    { kind: 'path', d: 'M15 34 C15 30.5 17 28.3 18.5 27 L26.5 27 C28 28.3 30 30.5 30 34 Z' },
    { kind: 'rect', x: 16.5, y: 23.5, w: 12, h: 3.5, rx: 1.75 },
    {
      kind: 'path',
      d: 'M22.5 8 C17 11.5 15.6 16.3 17.4 20.6 C18.4 22.6 20 23.5 22.5 23.5 C25 23.5 26.6 22.6 27.6 20.6 C29.4 16.3 28 11.5 22.5 8 Z',
    },
    { kind: 'circle', cx: 22.5, cy: 6.6, r: 2.3 },
    BASE,
    { kind: 'detail', d: 'M24.8 12.2 L21.2 17.6' },
  ],
  q: [
    { kind: 'path', d: 'M13 34 C14 29.5 15 27 15.5 24 L29.5 24 C30 27 31 29.5 32 34 Z' },
    {
      kind: 'path',
      d: 'M15.5 24 L10.5 13.5 L17 19 L16 10.5 L20.6 17.5 L22.5 8.5 L24.4 17.5 L29 10.5 L28 19 L34.5 13.5 L29.5 24 Z',
    },
    { kind: 'circle', cx: 10.5, cy: 12.5, r: 2 },
    { kind: 'circle', cx: 16, cy: 9.3, r: 2 },
    { kind: 'circle', cx: 22.5, cy: 7.3, r: 2 },
    { kind: 'circle', cx: 29, cy: 9.3, r: 2 },
    { kind: 'circle', cx: 34.5, cy: 12.5, r: 2 },
    BASE,
    { kind: 'detail', d: 'M15.5 24 L29.5 24 M14.5 29.5 L30.5 29.5' },
  ],
  k: [
    { kind: 'path', d: 'M13 34 C14 29.5 15 27 15.5 24 L29.5 24 C30 27 31 29.5 32 34 Z' },
    {
      kind: 'path',
      d: 'M15.5 24 C12.8 19.5 12.8 15.2 16.3 14.2 C19 13.5 21.4 15.4 22.5 18 C23.6 15.4 26 13.5 28.7 14.2 C32.2 15.2 32.2 19.5 29.5 24 Z',
    },
    {
      kind: 'path',
      d: 'M21.3 4.5 L23.7 4.5 L23.7 7.3 L26.5 7.3 L26.5 9.7 L23.7 9.7 L23.7 15 L21.3 15 L21.3 9.7 L18.5 9.7 L18.5 7.3 L21.3 7.3 Z',
    },
    BASE,
    { kind: 'detail', d: 'M15.5 24 L29.5 24 M14.5 29.5 L30.5 29.5' },
  ],
};

export interface PieceStyle {
  fill: string;
  stroke: string;
  detail: string;
}

export const pieceStyles: Record<PieceColor, PieceStyle> = {
  w: { fill: '#FAFAF7', stroke: '#1C1C21', detail: '#1C1C21' },
  b: { fill: '#2A2B31', stroke: '#0D0D10', detail: '#D9DAE0' },
};

export const PIECE_STROKE_WIDTH = 1.5;

/** Standalone SVG markup of a piece (for tests, previews and web favicons). */
export function pieceSvg(color: PieceColor, kind: PieceKind, size = 45): string {
  const s = pieceStyles[color];
  const body = `fill="${s.fill}" stroke="${s.stroke}" stroke-width="${PIECE_STROKE_WIDTH}" stroke-linejoin="round"`;
  const parts = pieceShapes[kind].map((sh) => {
    switch (sh.kind) {
      case 'path':
        return `<path d="${sh.d}" ${body}/>`;
      case 'circle':
        return `<circle cx="${sh.cx}" cy="${sh.cy}" r="${sh.r}" ${body}/>`;
      case 'rect':
        return `<rect x="${sh.x}" y="${sh.y}" width="${sh.w}" height="${sh.h}" rx="${sh.rx ?? 0}" ${body}/>`;
      case 'detail':
        return `<path d="${sh.d}" fill="none" stroke="${s.detail}" stroke-width="${PIECE_STROKE_WIDTH}" stroke-linecap="round"/>`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="${size}" height="${size}">${parts.join('')}</svg>`;
}
