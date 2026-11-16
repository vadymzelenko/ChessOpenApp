import { GameTree, dueCount } from '@chess-open/core';
import {
  Appear,
  Board,
  Button,
  Screen,
  SectionHeader,
  ThemedText,
  Tile,
  boardThemes,
  useTheme,
  type IconComponent,
} from '@chess-open/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ChessKnight,
  ChessPawn,
  ChessQueen,
  ChessRook,
  Puzzle,
  Repeat,
  Swords,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useScreenWidth } from '@/hooks/useScreenWidth';
import { packCards, useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';

/** Typical London System set-up shown on the hero tile. */
const LONDON = ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'c5', 'c3', 'Nc6', 'Nbd2', 'Bd6'];

/** Accent palette of the home tiles (course accents come from packs later). */
const ACCENTS = {
  blue: '#4C7DFF',
  green: '#2FB574',
  purple: '#9B6BF2',
  orange: '#F08A3C',
  red: '#EF5A5A',
} as const;

interface CourseTile {
  key: 'london' | 'caroKann' | 'slav' | 'italian';
  side: 'w' | 'b';
  color: string;
  icon: IconComponent;
  /** Pack id when the course is available in the app. */
  pack?: string;
}

/** MVP catalogue from ТЗ §9; real packs replace this list with module 28. */
const COURSES: CourseTile[] = [
  { key: 'london', side: 'w', color: ACCENTS.blue, icon: ChessRook, pack: 'london' },
  { key: 'caroKann', side: 'b', color: ACCENTS.green, icon: ChessPawn },
  { key: 'slav', side: 'b', color: ACCENTS.purple, icon: ChessKnight },
  { key: 'italian', side: 'w', color: ACCENTS.orange, icon: ChessQueen },
];

export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const width = useScreenWidth();
  const settings = useSettings();
  const wide = width >= 760;
  const cards = useProgress((s) => s.cards);
  const [now] = useState(() => Date.now());
  const due = dueCount(packCards(cards, 'london'), now);
  const columns = wide ? 4 : 2;

  const position = useMemo(() => GameTree.fromSan(LONDON), []);
  const pieces = useMemo(() => position.pieces(), [position]);
  const last = position.lastMove!;

  const hero = (
    <View style={{ borderRadius: theme.radii.xl, overflow: 'hidden' }}>
      <LinearGradient
        colors={[ACCENTS.blue, '#2A47B8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: wide ? 'row' : 'column-reverse',
          alignItems: wide ? 'center' : 'stretch',
          padding: theme.spacing.lg,
          gap: theme.spacing.lg,
        }}>
        <View style={{ flex: wide ? 1 : undefined, gap: theme.spacing.sm }}>
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 3,
              borderRadius: theme.radii.pill,
              backgroundColor: 'rgba(255,255,255,0.2)',
            }}>
            <ThemedText
              variant="caption"
              style={{ color: '#FFFFFF', fontFamily: theme.typography.family.bold }}>
              {t('home.heroBadge')}
            </ThemedText>
          </View>
          <ThemedText variant="title" style={{ color: '#FFFFFF', fontSize: 28, lineHeight: 34 }}>
            {t('home.heroTitle')}
          </ThemedText>
          <ThemedText style={{ color: 'rgba(255,255,255,0.85)' }}>{t('home.heroBody')}</ThemedText>
          <Button
            variant="inverse"
            icon={ChessRook}
            label={t('home.openCourse')}
            onPress={() => router.push('/course/london')}
            style={{
              alignSelf: 'flex-start',
              marginTop: theme.spacing.xs,
              backgroundColor: '#FFFFFF',
              borderWidth: 0,
            }}
          />
        </View>
        <View
          style={{
            width: wide ? 260 : '72%',
            maxWidth: 300,
            alignSelf: 'center',
            borderRadius: theme.radii.lg,
            overflow: 'hidden',
            borderWidth: 3,
            borderColor: 'rgba(255,255,255,0.25)',
          }}>
          <Board
            pieces={pieces}
            lastMove={{ from: last.from, to: last.to }}
            showCoordinates={false}
            boardTheme={boardThemes[settings.boardTheme]}
            pieceSet={settings.pieceSet}
            disabled
          />
        </View>
      </LinearGradient>
    </View>
  );

  const training: {
    key: string;
    icon: IconComponent;
    color: string;
    onPress?: () => void;
  }[] = [
    {
      key: 'freeBoard',
      icon: ChessKnight,
      color: ACCENTS.blue,
      onPress: () => router.navigate('/board'),
    },
    {
      key: 'review',
      icon: Repeat,
      color: ACCENTS.purple,
      onPress: () => router.push('/review/london'),
    },
    {
      key: 'practice',
      icon: Swords,
      color: ACCENTS.red,
      onPress: () => router.push('/practice/london'),
    },
    { key: 'puzzles', icon: Puzzle, color: ACCENTS.orange },
  ];

  const cell = { flexBasis: `${100 / columns - 2}%` as const, flexGrow: 1 };
  let i = 1;

  return (
    <Screen title={t('app.name')} subtitle={t('app.tagline')}>
      <Appear index={i++}>{hero}</Appear>

      <Appear index={i++}>
        <SectionHeader title={t('home.train')} />
      </Appear>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {training.map((tile) => (
          <Appear key={tile.key} index={i++} style={cell}>
            <Tile
              title={t(`home.${tile.key}`)}
              subtitle={
                tile.key === 'review'
                  ? due > 0
                    ? t('review.due', { count: due })
                    : t('review.noneDue')
                  : t(`home.${tile.key}Sub`)
              }
              icon={tile.icon}
              accent={tile.color}
              watermark={tile.icon}
              badge={tile.onPress ? undefined : t('home.soon')}
              onPress={tile.onPress}
              minHeight={132}
              style={{ flex: 1 }}
            />
          </Appear>
        ))}
      </View>

      <Appear index={i++}>
        <SectionHeader title={t('home.courses')} />
      </Appear>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {COURSES.map((c) => (
          <Appear key={c.key} index={i++} style={{ flexBasis: wide ? '48%' : '100%', flexGrow: 1 }}>
            <Tile
              title={t(`home.${c.key}`)}
              subtitle={`${c.side === 'w' ? t('home.white') : t('home.black')} · ${t(`home.${c.key}Sub`)}`}
              icon={c.icon}
              accent={c.color}
              watermark={c.icon}
              badge={c.pack ? undefined : t('home.soon')}
              onPress={c.pack ? () => router.push(`/course/${c.pack}`) : undefined}
            />
          </Appear>
        ))}
      </View>

      <Appear index={i++}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.lg,
            paddingHorizontal: theme.spacing.xs,
            marginTop: theme.spacing.sm,
          }}>
          <ThemedText variant="caption" tone="textMuted">
            <ThemedText variant="caption" tone="verified">
              ★{' '}
            </ThemedText>
            {t('home.legendVerified')}
          </ThemedText>
          <ThemedText variant="caption" tone="textMuted">
            <ThemedText variant="caption" tone="generated">
              ⚙{' '}
            </ThemedText>
            {t('home.legendGenerated')}
          </ThemedText>
        </View>
      </Appear>
    </Screen>
  );
}
