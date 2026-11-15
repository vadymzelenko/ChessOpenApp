import type { Color } from '@chess-open/core';
import { memo, useEffect, useRef } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { squareToXY } from './geometry';
import { PieceIcon } from './PieceIcon';
import type { KeyedPiece } from './pieceDiff';

/** Where a piece should start its next animation from (a drop point). */
export interface DropHint {
  square: string;
  x: number;
  y: number;
  nonce: number;
  kind: 'settle' | 'bounce';
}

interface AnimatedPieceProps {
  piece: KeyedPiece;
  squareSize: number;
  orientation: Color;
  moveDuration: number;
  bounceDuration: number;
  hidden: boolean;
  dropHint: DropHint | null;
}

function AnimatedPieceImpl({
  piece,
  squareSize,
  orientation,
  moveDuration,
  bounceDuration,
  hidden,
  dropHint,
}: AnimatedPieceProps) {
  const target = squareToXY(piece.square, orientation, squareSize);
  const x = useSharedValue(target.x);
  const y = useSharedValue(target.y);
  const geometry = useRef({ squareSize, orientation });

  const hint = dropHint && dropHint.square === piece.square ? dropHint : null;

  useEffect(() => {
    const geometryChanged =
      geometry.current.squareSize !== squareSize || geometry.current.orientation !== orientation;
    geometry.current = { squareSize, orientation };

    // Resizes and board flips jump instantly; moves animate.
    if (geometryChanged || (moveDuration === 0 && !hint)) {
      x.set(target.x);
      y.set(target.y);
      return;
    }
    if (hint) {
      x.set(hint.x);
      y.set(hint.y);
      if (hint.kind === 'bounce' && bounceDuration > 0) {
        const spring = { damping: 14, stiffness: 220, mass: 0.6 };
        x.set(withSpring(target.x, spring));
        y.set(withSpring(target.y, spring));
        return;
      }
      const d = Math.min(moveDuration, 90);
      x.set(withTiming(target.x, { duration: d }));
      y.set(withTiming(target.y, { duration: d }));
      return;
    }
    const cfg = { duration: moveDuration, easing: Easing.out(Easing.cubic) };
    x.set(withTiming(target.x, cfg));
    y.set(withTiming(target.y, cfg));
    // `hint?.nonce` re-triggers a bounce while the square stays the same.
  }, [target.x, target.y, hint?.nonce, squareSize, orientation, moveDuration, bounceDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, top: 0, width: squareSize, height: squareSize },
        { opacity: hidden ? 0 : 1 },
        style,
      ]}>
      <PieceIcon color={piece.color} kind={piece.type} size={squareSize} />
    </Animated.View>
  );
}

export const AnimatedPiece = memo(AnimatedPieceImpl);

interface CapturedPieceProps {
  piece: KeyedPiece;
  squareSize: number;
  orientation: Color;
  duration: number;
}

/** A captured piece shrinking and fading out (ТЗ §10: 150 ms). */
function CapturedPieceImpl({ piece, squareSize, orientation, duration }: CapturedPieceProps) {
  const { x, y } = squareToXY(piece.square, orientation, squareSize);
  const progress = useSharedValue(duration > 0 ? 0 : 1);

  useEffect(() => {
    if (duration > 0) progress.set(withTiming(1, { duration }));
  }, [duration, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
    transform: [{ translateX: x }, { translateY: y }, { scale: 1 - 0.4 * progress.get() }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, top: 0, width: squareSize, height: squareSize },
        style,
      ]}>
      <PieceIcon color={piece.color} kind={piece.type} size={squareSize} />
    </Animated.View>
  );
}

export const CapturedPiece = memo(CapturedPieceImpl);
