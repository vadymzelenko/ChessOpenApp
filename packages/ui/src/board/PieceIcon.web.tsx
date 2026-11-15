import { createElement, memo } from 'react';

import { pieceSets, type PieceCode, type PieceSetId } from './pieceSets';

export type PieceColor = 'w' | 'b';
export type PieceKind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface PieceIconProps {
  color: PieceColor;
  kind: PieceKind;
  size: number;
  set: PieceSetId;
}

export function pieceCode(color: PieceColor, kind: PieceKind): PieceCode {
  return `${color}${kind.toUpperCase()}` as PieceCode;
}

const uriCache = new Map<string, string>();
function dataUri(set: PieceSetId, code: PieceCode): string {
  const key = `${set}/${code}`;
  let uri = uriCache.get(key);
  if (!uri) {
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pieceSets[set].svgs[code])}`;
    uriCache.set(key, uri);
  }
  return uri;
}

/** Web: a plain <img> with a data URI — cheaper for the browser than inline SVG trees. */
function PieceIconImpl({ color, kind, size, set }: PieceIconProps) {
  return createElement('img', {
    src: dataUri(set, pieceCode(color, kind)),
    width: size,
    height: size,
    alt: '',
    draggable: false,
    style: {
      display: 'block',
      width: size,
      height: size,
      pointerEvents: 'none',
      userSelect: 'none',
    },
  });
}

export const PieceIcon = memo(PieceIconImpl);
