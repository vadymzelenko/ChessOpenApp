import { GameTree } from '@chess-open/core';
import {
  Board,
  Button,
  Card,
  Screen,
  ThemedText,
  boardThemes,
  useTheme,
  type IconComponent,
} from '@chess-open/ui';
import { router } from 'expo-router';
import { ChessKnight, ChessPawn, ChessQueen, ChessRook } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useScreenWidth } from '@/hooks/useScreenWidth';
import { useSettings } from '@/store/settings';

/** Typical London System set-up shown on the hero card. */
const LONDON = ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'c5', 'c3', 'Nc6', 'Nbd2', 'Bd6'];

interface CourseTile {
  key: 'london' | 'caroKann' | 'slav' | 'italian';
  side: 'w' | 'b';
  color: string;
  icon: IconComponent;
}

/** MVP catalogue from ТЗ §9; real packs replace this list with module 28. */
const COURSES: CourseTile[] = [
  { key: 'london', side: 'w', color: '#5B8CFF', icon: ChessRook },
  { key: 'caroKann', side: 'b', color: '#3FB97A', icon: ChessPawn },
  { key: 'slav', side: 'b', color: '#B57CF2', icon: ChessKnight },
  { key: 'italian', side: 'w', color: '#F2994A', icon: ChessQueen },
];

export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const width = useScreenWidth();
  const settings = useSettings();
  const wide = width >= 760;

  const position = useMemo(() => GameTree.fromSan(LONDON), []);
  const pieces = useMemo(() => position.pieces(), [position]);
  const last = position.lastMove!;

  const hero = (
    <Card style={{ padding: 0, overflow: 'hidden', flexDirection: wide ? 'row' : 'column' }}>
      <View style={{ width: wide ? 300 : '100%', maxWidth: wide ? 300 : undefined }}>
        <Board
          pieces={pieces}
          lastMove={{ from: last.from, to: last.to }}
          showCoordinates={false}
          boardTheme={boardThemes[settings.boardTheme]}
          pieceSet={settings.pieceSet}
          disabled
        />
      </View>
      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.sm,
          flex: wide ? 1 : undefined,
          justifyContent: 'center',
        }}>
        <ThemedText
          variant="caption"
          tone="accent"
          style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
          {t('home.white')} · D02
        </ThemedText>
        <ThemedText variant="heading">{t('home.heroTitle')}</ThemedText>
        <ThemedText tone="textMuted">{t('home.heroBody')}</ThemedText>
        <Button
          variant="primary"
          icon={ChessKnight}
          label={t('home.tryBoard')}
          onPress={() => router.navigate('/board')}
          style={{ alignSelf: 'flex-start', marginTop: theme.spacing.xs }}
        />
      </View>
    </Card>
  );

  const tile = (c: CourseTile) => {
    const Icon = c.icon;
    return (
      <View
        key={c.key}
        style={{
          flexBasis: wide ? '48%' : '100%',
          flexGrow: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: theme.radii.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${c.color}26`,
          }}>
          <Icon color={c.color} size={26} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="label" style={{ fontSize: 16 }}>
            {t(`home.${c.key}`)}
          </ThemedText>
          <ThemedText variant="caption" tone="textMuted" numberOfLines={1}>
            {c.side === 'w' ? t('home.white') : t('home.black')} · {t(`home.${c.key}Sub`)}
          </ThemedText>
        </View>
        <View
          style={{
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 3,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.surfaceRaised,
          }}>
          <ThemedText variant="caption" tone="textMuted">
            {t('home.soon')}
          </ThemedText>
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <View style={{ gap: theme.spacing.xs }}>
        <ThemedText variant="title">{t('app.name')}</ThemedText>
        <ThemedText tone="textMuted">{t('app.tagline')}</ThemedText>
      </View>

      {hero}

      <ThemedText variant="heading">{t('home.courses')}</ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {COURSES.map(tile)}
      </View>

      <Card>
        <ThemedText variant="label" tone="textMuted">
          {t('home.legendTitle')}
        </ThemedText>
        <ThemedText>
          <ThemedText tone="verified">★ </ThemedText>
          {t('home.legendVerified')}
        </ThemedText>
        <ThemedText>
          <ThemedText tone="generated">⚙ </ThemedText>
          {t('home.legendGenerated')}
        </ThemedText>
      </Card>
    </Screen>
  );
}
