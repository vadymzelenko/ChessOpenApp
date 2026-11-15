import type { Color, Square } from '@chess-open/core';
import { memo } from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text,
} from 'react-native-svg';

import { fontFamilies } from '../theme/tokens';
import type { BoardTheme } from './boardThemes';
import { ALL_SQUARES, squareToXY } from './geometry';

/** Annotation colours, matching Lichess study letters (%csl / %cal: G R B Y). */
export const annotationColors = {
  green: 'rgba(21, 120, 27, 0.8)',
  red: 'rgba(200, 40, 40, 0.8)',
  blue: 'rgba(0, 48, 136, 0.8)',
  yellow: 'rgba(230, 160, 0, 0.85)',
} as const;
export type AnnotationColor = keyof typeof annotationColors;

export interface BoardArrow {
  from: Square;
  to: Square;
  color?: AnnotationColor;
}

export interface BoardHighlight {
  square: Square;
  color?: AnnotationColor;
}

// ---------------------------------------------------------------------------

interface SquaresProps {
  size: number;
  orientation: Color;
  theme: BoardTheme;
  showCoordinates: boolean;
}

function SquaresImpl({ size, orientation, theme, showCoordinates }: SquaresProps) {
  const sq = size / 8;
  const font = Math.max(8, sq * 0.2);
  return (
    <Svg width={size} height={size} pointerEvents="none">
      {ALL_SQUARES.map((s) => {
        const { x, y } = squareToXY(s, orientation, sq);
        const light = (s.charCodeAt(0) - 97 + (s.charCodeAt(1) - 49)) % 2 === 1;
        return (
          <Rect
            key={s}
            x={x}
            y={y}
            width={sq}
            height={sq}
            fill={light ? theme.light : theme.dark}
          />
        );
      })}
      {showCoordinates &&
        ALL_SQUARES.map((s) => {
          const { x, y } = squareToXY(s, orientation, sq);
          const light = (s.charCodeAt(0) - 97 + (s.charCodeAt(1) - 49)) % 2 === 1;
          const color = light ? theme.dark : theme.light;
          const leftCol = x === 0;
          const bottomRow = Math.round(y) === Math.round(sq * 7);
          return (
            <G key={`c${s}`}>
              {leftCol && (
                <Text
                  x={x + sq * 0.06}
                  y={y + font * 1.05}
                  fontSize={font}
                  fontFamily={fontFamilies.bold}
                  fill={color}>
                  {s[1]}
                </Text>
              )}
              {bottomRow && (
                <Text
                  x={x + sq * 0.94}
                  y={y + sq - sq * 0.06}
                  fontSize={font}
                  fontFamily={fontFamilies.bold}
                  fill={color}
                  textAnchor="end">
                  {s[0]}
                </Text>
              )}
            </G>
          );
        })}
    </Svg>
  );
}

export const BoardSquares = memo(SquaresImpl);

// ---------------------------------------------------------------------------

interface MarksProps {
  size: number;
  orientation: Color;
  theme: BoardTheme;
  lastMove: { from: Square; to: Square } | null;
  selected: Square | null;
  check: Square | null;
  highlights: readonly BoardHighlight[];
}

/** Square marks drawn *under* the pieces. */
function MarksImpl({
  size,
  orientation,
  theme,
  lastMove,
  selected,
  check,
  highlights,
}: MarksProps) {
  const sq = size / 8;
  const rect = (s: Square, fill: string, key: string) => {
    const { x, y } = squareToXY(s, orientation, sq);
    return <Rect key={key} x={x} y={y} width={sq} height={sq} fill={fill} />;
  };
  return (
    <Svg width={size} height={size} pointerEvents="none" style={{ position: 'absolute' }}>
      <Defs>
        <RadialGradient id="check" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={theme.check} stopOpacity={1} />
          <Stop offset="0.45" stopColor={theme.check} stopOpacity={0.75} />
          <Stop offset="1" stopColor={theme.check} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {lastMove && rect(lastMove.from, theme.lastMove, 'lmf')}
      {lastMove && rect(lastMove.to, theme.lastMove, 'lmt')}
      {selected && rect(selected, theme.selected, 'sel')}
      {highlights.map((h, i) => {
        const { x, y } = squareToXY(h.square, orientation, sq);
        const sw = sq * 0.07;
        return (
          <Circle
            key={`h${i}`}
            cx={x + sq / 2}
            cy={y + sq / 2}
            r={sq / 2 - sw / 2 - 1}
            fill="none"
            stroke={annotationColors[h.color ?? 'green']}
            strokeWidth={sw}
          />
        );
      })}
      {check &&
        (() => {
          const { x, y } = squareToXY(check, orientation, sq);
          return <Rect x={x} y={y} width={sq} height={sq} fill="url(#check)" />;
        })()}
    </Svg>
  );
}

export const BoardMarks = memo(MarksImpl);

// ---------------------------------------------------------------------------

interface HintsProps {
  size: number;
  orientation: Color;
  color: string;
  targets: readonly Square[];
  occupied: ReadonlySet<Square>;
}

/** Legal move dots (empty squares) and rings (captures), drawn over pieces. */
function HintsImpl({ size, orientation, color, targets, occupied }: HintsProps) {
  const sq = size / 8;
  return (
    <Svg width={size} height={size} pointerEvents="none" style={{ position: 'absolute' }}>
      {targets.map((t) => {
        const { x, y } = squareToXY(t, orientation, sq);
        const cx = x + sq / 2;
        const cy = y + sq / 2;
        return occupied.has(t) ? (
          <Circle
            key={t}
            cx={cx}
            cy={cy}
            r={sq * 0.44}
            fill="none"
            stroke={color}
            strokeWidth={sq * 0.09}
          />
        ) : (
          <Circle key={t} cx={cx} cy={cy} r={sq * 0.16} fill={color} />
        );
      })}
    </Svg>
  );
}

export const BoardHints = memo(HintsImpl);

// ---------------------------------------------------------------------------

interface ArrowsProps {
  size: number;
  orientation: Color;
  arrows: readonly BoardArrow[];
}

function ArrowsImpl({ size, orientation, arrows }: ArrowsProps) {
  const sq = size / 8;
  const width = sq * 0.16;
  const head = sq * 0.42;
  return (
    <Svg width={size} height={size} pointerEvents="none" style={{ position: 'absolute' }}>
      {arrows.map((a, i) => {
        const f = squareToXY(a.from, orientation, sq);
        const t = squareToXY(a.to, orientation, sq);
        const x1 = f.x + sq / 2;
        const y1 = f.y + sq / 2;
        const x2 = t.x + sq / 2;
        const y2 = t.y + sq / 2;
        const len = Math.hypot(x2 - x1, y2 - y1);
        if (len === 0) return null;
        const ux = (x2 - x1) / len;
        const uy = (y2 - y1) / len;
        // Shaft stops where the head begins; the head tip stops a bit before the centre.
        const tipX = x2 - ux * sq * 0.12;
        const tipY = y2 - uy * sq * 0.12;
        const baseX = tipX - ux * head;
        const baseY = tipY - uy * head;
        const px = -uy * head * 0.55;
        const py = ux * head * 0.55;
        const color = annotationColors[a.color ?? 'green'];
        return (
          <G key={i} opacity={0.85}>
            <Line
              x1={x1 + ux * sq * 0.18}
              y1={y1 + uy * sq * 0.18}
              x2={baseX}
              y2={baseY}
              stroke={color}
              strokeWidth={width}
              strokeLinecap="round"
            />
            <Polygon
              points={`${tipX},${tipY} ${baseX + px},${baseY + py} ${baseX - px},${baseY - py}`}
              fill={color}
            />
          </G>
        );
      })}
    </Svg>
  );
}

export const BoardArrows = memo(ArrowsImpl);
