import type { Stars } from '@chess-open/core';
import { Button, ThemedText, useTheme } from '@chess-open/ui';
import { ChevronRight, Map as MapIcon, RotateCcw, Star } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/** Level result: up to three stars popping in one after another (transform + opacity). */
export function StarResult({
  stars,
  best,
  mistakes,
  hints,
  onAgain,
  onNext,
  onMap,
}: {
  stars: Stars;
  best: Stars;
  mistakes: number;
  hints: number;
  onAgain: () => void;
  onNext?: () => void;
  onMap: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      style={{
        padding: theme.spacing.xl,
        gap: theme.spacing.md,
        alignItems: 'center',
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.verified,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
        {[1, 2, 3].map((n) => (
          <PopStar key={n} on={n <= stars} index={n - 1} big={n === 2} />
        ))}
      </View>
      <ThemedText variant="heading" style={{ textAlign: 'center' }}>
        {t(`levels.result${stars}`)}
      </ThemedText>
      <ThemedText tone="textMuted" style={{ textAlign: 'center' }}>
        {t('levels.summary', { mistakes, hints })}
      </ThemedText>
      {stars < 3 ? (
        <ThemedText variant="caption" tone="textMuted" style={{ textAlign: 'center' }}>
          {t('levels.howTo3')}
        </ThemedText>
      ) : null}
      {best > stars ? (
        <ThemedText variant="caption" tone="verified">
          {t('levels.bestKept', { count: best })}
        </ThemedText>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.xs,
        }}>
        <Button icon={RotateCcw} label={t('line.again')} onPress={onAgain} />
        <Button icon={MapIcon} label={t('levels.toMap')} onPress={onMap} />
        {onNext ? (
          <Button variant="primary" icon={ChevronRight} label={t('levels.next')} onPress={onNext} />
        ) : null}
      </View>
    </View>
  );
}

function PopStar({ on, index, big }: { on: boolean; index: number; big: boolean }) {
  const theme = useTheme();
  const d = theme.durations.stamp;
  const p = useSharedValue(d > 0 && on ? 0 : 1);
  useEffect(() => {
    if (d <= 0 || !on) return;
    p.set(
      withDelay(
        200 + index * d,
        withSequence(
          withTiming(1.25, { duration: d * 0.6, easing: Easing.out(Easing.back(2)) }),
          withTiming(1, { duration: d * 0.4 }),
        ),
      ),
    );
  }, [p, d, on, index]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.get()),
    transform: [{ scale: p.get() }, { rotate: `${(1 - Math.min(1, p.get())) * -30}deg` }],
  }));
  const size = big ? 64 : 48;
  return (
    <Animated.View style={style}>
      <Star
        size={size}
        color={on ? theme.colors.verified : theme.colors.border}
        fill={on ? theme.colors.verified : theme.colors.surfaceRaised}
      />
    </Animated.View>
  );
}
