import type { Color } from '@chess-open/core';
import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';

export interface EvalBarProps {
  /** White's winning chances in [-1, 1], or null when unknown (bar shows 50 %). */
  chances: number | null;
  orientation?: Color;
  width?: number;
}

/**
 * Vertical evaluation bar (ТЗ §7): the white part grows from White's side.
 * Animated with a transform only (ТЗ §10: 300 ms, from theme durations).
 */
export function EvalBar({ chances, orientation = 'w', width = 12 }: EvalBarProps) {
  const t = useTheme();
  const [height, setHeight] = useState(0);
  const share = chances === null ? 0.5 : (chances + 1) / 2; // white share 0..1
  const offset = useSharedValue(height * (1 - share));

  useEffect(() => {
    const target = height * (1 - share);
    offset.set(
      t.durations.evalBar
        ? withTiming(target, { duration: t.durations.evalBar, easing: Easing.out(Easing.cubic) })
        : target,
    );
  }, [height, share, offset, t.durations.evalBar]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: orientation === 'w' ? offset.get() : -offset.get() }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);
  return (
    <View
      onLayout={onLayout}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}
      style={{
        width,
        alignSelf: 'stretch',
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: '#2A2B31',
        opacity: chances === null ? 0.5 : 1,
      }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: '#F2F2EE',
          },
          style,
        ]}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: 1,
          backgroundColor: t.colors.accent,
          opacity: 0.6,
        }}
      />
    </View>
  );
}
