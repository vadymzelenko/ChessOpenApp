import { memo } from 'react';
import { SvgXml } from 'react-native-svg';

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

/** Native: render the set's SVG markup with react-native-svg. */
function PieceIconImpl({ color, kind, size, set }: PieceIconProps) {
  return (
    <SvgXml
      xml={pieceSets[set].svgs[pieceCode(color, kind)]}
      width={size}
      height={size}
      pointerEvents="none"
    />
  );
}

export const PieceIcon = memo(PieceIconImpl);
