export type PieceCode =
  'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP' | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP';

/** SVG markup of every piece. */
export type PieceSvgs = Record<PieceCode, string>;

export interface PieceSet {
  id: string;
  name: string;
  author: string;
  /** SPDX licence id; attribution is shown on the «Лицензии» screen. */
  license: string;
  url: string;
  svgs: PieceSvgs;
}
