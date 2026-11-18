import type { Color, PlacedPiece, PromotionPiece, Square } from '@chess-open/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '../theme/ThemeProvider';
import { DRAG_SCALE } from '../theme/tokens';
import { AnimatedPiece, CapturedPiece, type DropHint } from './AnimatedPiece';
import {
  BoardArrows,
  BoardHints,
  BoardMarks,
  BoardSquares,
  type BoardArrow,
  type BoardHighlight,
} from './BoardLayers';
import { boardThemes, type BoardTheme } from './boardThemes';
import { squareToXY, xyToSquare } from './geometry';
import { PieceIcon } from './PieceIcon';
import { DEFAULT_PIECE_SET, type PieceSetId } from './pieceSets';
import { diffPieces, keyPieces, type KeyedPiece } from './pieceDiff';

export interface BoardMove {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
}

export type MoveInputMode = 'drag' | 'tap' | 'both';

export interface BoardProps {
  pieces: readonly PlacedPiece[];
  orientation?: Color;
  lastMove?: { from: Square; to: Square } | null;
  /** Square of a king in check. */
  check?: Square | null;
  /** Legal destinations of the piece on `from`. Without it the board is view-only. */
  legalMoves?: (from: Square) => Square[];
  isPromotion?: (from: Square, to: Square) => boolean;
  /**
   * Called for a legal move. Return `false` to reject it (e.g. not the
   * repertoire move): the board then plays the wrong-move feedback.
   */
  onMove?: (move: BoardMove) => boolean | void;
  arrows?: readonly BoardArrow[];
  highlights?: readonly BoardHighlight[];
  showCoordinates?: boolean;
  showLegalMoves?: boolean;
  moveInput?: MoveInputMode;
  /** Promote to a queen without asking. */
  autoQueen?: boolean;
  boardTheme?: BoardTheme;
  pieceSet?: PieceSetId;
  disabled?: boolean;
}

const EMPTY: readonly never[] = [];
const PROMOTION_PIECES: readonly PromotionPiece[] = ['q', 'n', 'r', 'b'];
/** Pixels a pointer must travel before a press turns into a drag. */
const DRAG_THRESHOLD = 4;

let pieceCounter = 0;
const newPieceId = () => `pc${++pieceCounter}`;

const signature = (pieces: readonly PlacedPiece[]) =>
  pieces.map((p) => p.color + p.type + p.square).join(',');

interface KeyedState {
  sig: string;
  keyed: KeyedPiece[];
  removed: KeyedPiece[];
}

/** Keys pieces with stable ids across positions (derived state, no effects). */
function useKeyedPieces(pieces: readonly PlacedPiece[]): KeyedState {
  const sig = signature(pieces);
  const [state, setState] = useState<KeyedState>(() => ({
    sig,
    keyed: keyPieces(pieces, newPieceId),
    removed: [],
  }));
  if (state.sig !== sig) {
    const d = diffPieces(state.keyed, pieces, newPieceId);
    const next = { sig, keyed: d.pieces, removed: d.removed };
    setState(next);
    return next;
  }
  return state;
}

export function Board({
  pieces,
  orientation = 'w',
  lastMove = null,
  check = null,
  legalMoves,
  isPromotion,
  onMove,
  arrows = EMPTY,
  highlights = EMPTY,
  showCoordinates = true,
  showLegalMoves = true,
  moveInput = 'both',
  autoQueen = false,
  boardTheme = boardThemes.green,
  pieceSet = DEFAULT_PIECE_SET,
  disabled = false,
}: BoardProps) {
  const theme = useTheme();
  const { durations } = theme;
  const [size, setSize] = useState(0);
  const sq = size / 8;
  const interactive = !disabled && !!onMove && !!legalMoves;

  const { keyed, removed } = useKeyedPieces(pieces);
  const occupied = useMemo(() => new Set(keyed.map((p) => p.square)), [keyed]);

  const [selected, setSelected] = useState<Square | null>(null);
  const [dragFrom, setDragFrom] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
    drop: { x: number; y: number } | null;
  } | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const [wrongSquare, setWrongSquare] = useState<{ square: Square; nonce: number } | null>(null);
  const nonce = useRef(0);

  // Selection is meaningless once the position changes.
  const [prevPieces, setPrevPieces] = useState(pieces);
  if (prevPieces !== pieces) {
    setPrevPieces(pieces);
    if (selected && !legalMoves?.(selected).length) setSelected(null);
  }

  const targets = useMemo(
    () => (selected && legalMoves && showLegalMoves ? legalMoves(selected) : EMPTY),
    [selected, legalMoves, showLegalMoves],
  );

  // --- feedback animations -------------------------------------------------
  const shake = useSharedValue(0);
  const flash = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));

  const playWrong = useCallback(
    (square: Square) => {
      setWrongSquare({ square, nonce: ++nonce.current });
      const d = durations.wrongMove;
      if (d === 0) return;
      const step = d / 5;
      shake.set(
        withSequence(
          withTiming(-5, { duration: step }),
          withTiming(5, { duration: step }),
          withTiming(-3, { duration: step }),
          withTiming(3, { duration: step }),
          withTiming(0, { duration: step }),
        ),
      );
      flash.set(
        withSequence(withTiming(1, { duration: d * 0.3 }), withTiming(0, { duration: d * 0.7 })),
      );
    },
    [durations.wrongMove, flash, shake],
  );

  // --- move execution --------------------------------------------------------
  const finalize = useCallback(
    (
      from: Square,
      to: Square,
      promo: PromotionPiece | undefined,
      drop: { x: number; y: number } | null,
    ) => {
      setSelected(null);
      const move: BoardMove = promo ? { from, to, promotion: promo } : { from, to };
      const accepted = onMove?.(move) !== false;
      if (accepted) {
        if (drop) setDropHint({ square: to, ...drop, nonce: ++nonce.current, kind: 'settle' });
      } else {
        playWrong(to);
        if (drop) setDropHint({ square: from, ...drop, nonce: ++nonce.current, kind: 'bounce' });
      }
    },
    [onMove, playWrong],
  );

  const attemptMove = useCallback(
    (from: Square, to: Square, drop: { x: number; y: number } | null) => {
      if (isPromotion?.(from, to)) {
        if (autoQueen) finalize(from, to, 'q', drop);
        else {
          setSelected(null);
          setPromotion({ from, to, drop });
        }
        return;
      }
      finalize(from, to, undefined, drop);
    },
    [autoQueen, finalize, isPromotion],
  );

  // --- pointer handling (JS side) ---------------------------------------------
  const pointer = useRef({
    candidate: null as Square | null,
    wasSelected: false,
    consumed: false,
  });
  /** Dragged pieces float above the finger on touch screens. */
  const liftY = Platform.OS === 'web' ? 0 : -sq * 0.45;

  const handlers = {
    down(x: number, y: number) {
      const p = pointer.current;
      p.consumed = false;
      p.candidate = null;
      if (!interactive || promotion) return;
      const s = xyToSquare(x, y, orientation, sq);
      if (!s) return;
      if (selected && moveInput !== 'drag' && s !== selected && legalMoves!(selected).includes(s)) {
        attemptMove(selected, s, null);
        p.consumed = true;
        return;
      }
      if (legalMoves!(s).length > 0) {
        p.wasSelected = selected === s;
        p.candidate = s;
        setSelected(s);
      } else {
        setSelected(null);
      }
    },
    dragStart() {
      const p = pointer.current;
      if (p.consumed || !p.candidate || moveInput === 'tap') return;
      setDragFrom(p.candidate);
    },
    up(x: number, y: number, moved: boolean) {
      const p = pointer.current;
      const candidate = p.candidate;
      p.candidate = null;
      if (p.consumed) return;
      if (dragFrom) {
        const from = dragFrom;
        setDragFrom(null);
        const cy = y + liftY;
        const to = xyToSquare(x, cy, orientation, sq);
        const drop = { x: x - sq / 2, y: cy - sq / 2 };
        if (to && to !== from && legalMoves!(from).includes(to)) {
          attemptMove(from, to, drop);
        } else {
          setDropHint({ square: from, ...drop, nonce: ++nonce.current, kind: 'bounce' });
          if (to && to !== from) playWrong(to);
        }
        return;
      }
      // A plain second tap on the selected piece deselects it.
      if (candidate && !moved && p.wasSelected) setSelected(null);
    },
  };
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });
  const jsDown = useCallback((x: number, y: number) => handlersRef.current.down(x, y), []);
  const jsDragStart = useCallback(() => handlersRef.current.dragStart(), []);
  const jsUp = useCallback(
    (x: number, y: number, moved: boolean) => handlersRef.current.up(x, y, moved),
    [],
  );

  // --- gesture (UI thread) -------------------------------------------------------
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const moved = useSharedValue(false);

  // The builder only stores these callbacks; they run in gesture events, not during
  // render — react-hooks/refs cannot see that for shared values and ref-backed callbacks.
  /* eslint-disable react-hooks/refs */
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(interactive)
        .minDistance(0)
        .maxPointers(1)
        .shouldCancelWhenOutside(false)
        .onBegin((e) => {
          startX.set(e.x);
          startY.set(e.y);
          dragX.set(e.x);
          dragY.set(e.y);
          moved.set(false);
          scheduleOnRN(jsDown, e.x, e.y);
        })
        .onUpdate((e) => {
          dragX.set(e.x);
          dragY.set(e.y);
          if (!moved.get() && Math.hypot(e.x - startX.get(), e.y - startY.get()) > DRAG_THRESHOLD) {
            moved.set(true);
            scheduleOnRN(jsDragStart);
          }
        })
        .onFinalize((e) => {
          scheduleOnRN(jsUp, e.x, e.y, moved.get());
        }),
    [interactive, jsDown, jsDragStart, jsUp, dragX, dragY, startX, startY, moved],
  );
  /* eslint-enable react-hooks/refs */

  const ghostStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.get() - sq / 2 },
      { translateY: dragY.get() - sq / 2 + liftY },
      { scale: DRAG_SCALE },
    ],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w !== size) setSize(w);
  };

  const dragPiece = dragFrom ? keyed.find((p) => p.square === dragFrom) : undefined;
  const promoFile = promotion ? squareToXY(promotion.to, orientation, sq) : null;
  const promoColor: Color = promotion?.to[1] === '8' ? 'w' : 'b';
  const promoDown = promoFile ? promoFile.y === 0 : true;
  const wrongXY = wrongSquare ? squareToXY(wrongSquare.square, orientation, sq) : null;

  return (
    <View style={styles.outer} onLayout={onLayout}>
      {size > 0 && (
        <Animated.View style={[{ width: size, height: size }, shakeStyle]}>
          {/* touchAction/userSelect: no page scroll or text selection while dragging on web. */}
          <GestureDetector gesture={gesture} touchAction="none" userSelect="none">
            <View style={{ width: size, height: size }}>
              <BoardSquares
                size={size}
                orientation={orientation}
                theme={boardTheme}
                showCoordinates={showCoordinates}
              />
              <BoardMarks
                size={size}
                orientation={orientation}
                theme={boardTheme}
                lastMove={lastMove}
                selected={selected}
                check={check}
                highlights={highlights}
              />
              {wrongXY && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.abs,
                    {
                      left: wrongXY.x,
                      top: wrongXY.y,
                      width: sq,
                      height: sq,
                      backgroundColor: boardTheme.wrong,
                    },
                    flashStyle,
                  ]}
                />
              )}
              {removed.map((p) => (
                <CapturedPiece
                  key={p.id}
                  piece={p}
                  squareSize={sq}
                  orientation={orientation}
                  duration={durations.capture}
                  pieceSet={pieceSet}
                />
              ))}
              {keyed.map((p) => (
                <AnimatedPiece
                  key={p.id}
                  piece={p}
                  squareSize={sq}
                  orientation={orientation}
                  moveDuration={durations.move}
                  bounceDuration={durations.wrongMove}
                  hidden={p.square === dragFrom}
                  dropHint={dropHint}
                  pieceSet={pieceSet}
                />
              ))}
              <BoardHints
                size={size}
                orientation={orientation}
                color={boardTheme.hint}
                targets={targets}
                occupied={occupied}
              />
              {arrows.length > 0 && (
                <BoardArrows
                  size={size}
                  orientation={orientation}
                  arrows={arrows}
                  duration={durations.arrow}
                  delay={durations.move}
                />
              )}
              {dragPiece && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.abs,
                    styles.ghost,
                    { left: 0, top: 0, width: sq, height: sq },
                    ghostStyle,
                  ]}>
                  <PieceIcon
                    color={dragPiece.color}
                    kind={dragPiece.type}
                    size={sq}
                    set={pieceSet}
                  />
                </Animated.View>
              )}
            </View>
          </GestureDetector>

          {promotion && promoFile && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="cancel promotion"
              style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]}
              onPress={() => {
                const { from, drop } = promotion;
                setPromotion(null);
                if (drop)
                  setDropHint({ square: from, ...drop, nonce: ++nonce.current, kind: 'bounce' });
              }}>
              {PROMOTION_PIECES.map((kind, i) => (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  accessibilityLabel={`promote ${kind}`}
                  onPress={() => {
                    const { from, to, drop } = promotion;
                    setPromotion(null);
                    finalize(from, to, kind, drop);
                  }}
                  style={({ pressed }) => [
                    styles.abs,
                    {
                      left: promoFile.x,
                      top: promoDown ? i * sq : size - (i + 1) * sq,
                      width: sq,
                      height: sq,
                      borderRadius: sq / 2,
                      backgroundColor: pressed ? boardTheme.selected : theme.colors.surfaceRaised,
                    },
                  ]}>
                  <PieceIcon color={promoColor} kind={kind} size={sq} set={pieceSet} />
                </Pressable>
              ))}
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { width: '100%', aspectRatio: 1 },
  abs: { position: 'absolute' },
  // No shadow/elevation: on Android elevation draws a square box around the piece.
  ghost: { zIndex: 10 },
});
