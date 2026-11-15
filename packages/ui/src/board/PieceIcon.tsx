import { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import {
  PIECE_STROKE_WIDTH,
  pieceShapes,
  pieceStyles,
  type PieceColor,
  type PieceKind,
} from './pieceShapes';

export interface PieceIconProps {
  color: PieceColor;
  kind: PieceKind;
  size: number;
}

function PieceIconImpl({ color, kind, size }: PieceIconProps) {
  const s = pieceStyles[color];
  const body = {
    fill: s.fill,
    stroke: s.stroke,
    strokeWidth: PIECE_STROKE_WIDTH,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 45 45" pointerEvents="none">
      {pieceShapes[kind].map((sh, i) => {
        switch (sh.kind) {
          case 'path':
            return <Path key={i} d={sh.d} {...body} />;
          case 'circle':
            return <Circle key={i} cx={sh.cx} cy={sh.cy} r={sh.r} {...body} />;
          case 'rect':
            return (
              <Rect
                key={i}
                x={sh.x}
                y={sh.y}
                width={sh.w}
                height={sh.h}
                rx={sh.rx ?? 0}
                {...body}
              />
            );
          case 'detail':
            return (
              <Path
                key={i}
                d={sh.d}
                fill="none"
                stroke={s.detail}
                strokeWidth={PIECE_STROKE_WIDTH}
                strokeLinecap="round"
              />
            );
        }
      })}
    </Svg>
  );
}

export const PieceIcon = memo(PieceIconImpl);
