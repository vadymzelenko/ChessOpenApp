import type { Color, Square } from '@chess-open/core';
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { fontFamilies } from '../theme/tokens';
import { squareToXY } from './geometry';

/** Move marks shown in the corner of a square (like annotation glyphs). */
export type BadgeKind = 'book' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface BoardBadge {
  square: Square;
  kind: BadgeKind;
}

export const badgeStyles: Record<BadgeKind, { color: string; glyph: string }> = {
  book: { color: '#A57A4B', glyph: '✓' },
  best: { color: '#58A62A', glyph: '★' },
  good: { color: '#6E9E52', glyph: '✓' },
  inaccuracy: { color: '#E2B33C', glyph: '?!' },
  mistake: { color: '#E58A2E', glyph: '?' },
  blunder: { color: '#D8433A', glyph: '??' },
};

function BadgeImpl({
  badge,
  size,
  orientation,
  duration,
  delay,
}: {
  badge: BoardBadge;
  size: number;
  orientation: Color;
  duration: number;
  delay: number;
}) {
  const sq = size / 8;
  const d = Math.round(sq * 0.46);
  const { x, y } = squareToXY(badge.square, orientation, sq);
  const p = useSharedValue(duration > 0 ? 0 : 1);
  useEffect(() => {
    if (duration <= 0) {
      p.set(1);
      return;
    }
    p.set(0);
    p.set(
      withDelay(
        delay,
        withSequence(
          withTiming(1.25, { duration: duration * 0.6, easing: Easing.out(Easing.back(2)) }),
          withTiming(1, { duration: duration * 0.4 }),
        ),
      ),
    );
  }, [p, duration, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.get()),
    transform: [{ scale: p.get() }],
  }));
  const s = badgeStyles[badge.kind];
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.badge,
        {
          left: x + sq - d * 0.8,
          top: y - d * 0.2,
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: s.color,
        },
        style,
      ]}>
      <Text
        style={{
          color: '#FFFFFF',
          fontFamily: fontFamilies.extrabold,
          fontSize: s.glyph.length > 1 ? d * 0.42 : d * 0.58,
          lineHeight: d * 0.9,
        }}>
        {s.glyph}
      </Text>
    </Animated.View>
  );
}

function BadgesImpl({
  badges,
  size,
  orientation,
  duration,
  delay,
}: {
  badges: readonly BoardBadge[];
  size: number;
  orientation: Color;
  duration: number;
  delay: number;
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {badges.map((b) => (
        <BadgeImpl
          key={`${b.square}${b.kind}`}
          badge={b}
          size={size}
          orientation={orientation}
          duration={duration}
          delay={delay}
        />
      ))}
    </View>
  );
}

export const BoardBadges = memo(BadgesImpl);

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
