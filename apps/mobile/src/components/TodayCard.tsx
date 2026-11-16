import { dueCount, streak, type PackIndex } from '@chess-open/core';
import { PressableScale, ThemedText, useTheme, type IconComponent } from '@chess-open/ui';
import { router } from 'expo-router';
import { BookOpen, ChevronRight, Repeat } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { lineKey, packCards, useProgress } from '@/store/progress';

/**
 * «Сегодня» (ТЗ §13 module 28): today's review and the next new line —
 * training is at most two taps away from app start.
 */
export function TodayCard({ index }: { index: PackIndex }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const cards = useProgress((s) => s.cards);
  const lines = useProgress((s) => s.lines);
  const [now] = useState(() => Date.now());
  const meta = index.pack.meta;
  const due = dueCount(packCards(cards, meta.id), now);
  const next = [...index.lines.values()].find((l) => !lines[lineKey(meta.id, l.line.id)]?.studied);

  const row = (
    icon: IconComponent,
    color: string,
    title: string,
    sub: string,
    onPress: (() => void) | null,
  ) => {
    const Icon = icon;
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={title}
        disabled={!onPress}
        onPress={onPress ?? undefined}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surfaceRaised,
          opacity: onPress ? 1 : 0.6,
        }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${color}26`,
          }}>
          <Icon color={color} size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText variant="label" style={{ fontSize: 15 }}>
            {title}
          </ThemedText>
          <ThemedText variant="caption" tone="textMuted" numberOfLines={1}>
            {sub}
          </ThemedText>
        </View>
        {onPress ? <ChevronRight color={theme.colors.textMuted} size={20} /> : null}
      </PressableScale>
    );
  };

  return (
    <View
      style={{
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}>
      <ThemedText variant="heading" style={{ marginLeft: 4 }}>
        {t('today.title')}
      </ThemedText>
      {row(
        Repeat,
        '#9B6BF2',
        t('today.review'),
        due > 0 ? t('today.reviewSub', { count: due }) : t('today.reviewDone'),
        due > 0 ? () => router.push(`/review/${meta.id}`) : null,
      )}
      {row(
        BookOpen,
        meta.accentColor,
        t('today.newLine'),
        next
          ? t('today.newLineSub', { title: `${meta.title.ru} · ${next.line.title.ru}` })
          : t('today.allStudied'),
        next ? () => router.push(`/line/${meta.id}/${next.line.id}`) : null,
      )}
    </View>
  );
}

/** Streak 🔥 and XP chips for screen headers. */
export function StatsChips() {
  const theme = useTheme();
  const xp = useProgress((s) => s.xp);
  const days = useProgress((s) => s.activeDays);
  const [now] = useState(() => Date.now());
  const chip = (text: string) => (
    <View
      style={{
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}>
      <ThemedText variant="label">{text}</ThemedText>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
      {chip(`🔥 ${streak(days, now)}`)}
      {chip(`⚡ ${xp}`)}
    </View>
  );
}
