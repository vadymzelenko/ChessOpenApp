import { autoContinuation, type Idea, type IndexedLine, type PackIndex } from '@chess-open/core';
import { Button, PressableScale, ThemedText, useTheme } from '@chess-open/ui';
import { router } from 'expo-router';
import { BookmarkPlus, Flag, Lightbulb, Puzzle, Swords } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PanelCard } from '@/components/SessionLayout';
import { useProgress } from '@/store/progress';

interface TheoryEndCardProps {
  index: PackIndex;
  indexed: IndexedLine;
  onIdea: (idea: Idea) => void;
}

/**
 * «Теория здесь заканчивается» (ТЗ §4): plan for the middlegame, an
 * auto-continuation from statistics (⚙), «add to my repertoire», play on
 * from here, puzzles.
 */
export function TheoryEndCard({ index, indexed, onIdea }: TheoryEndCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const addCustomLine = useProgress((s) => s.addCustomLine);
  const [added, setAdded] = useState(false);
  const packId = index.pack.meta.id;
  const steps = indexed.steps;
  const finalFen = steps[steps.length - 1]?.move.fenAfter ?? index.startFen;

  const ideas = useMemo(() => {
    const ids = new Set<string>();
    for (const s of steps) for (const id of s.annotation?.ideas ?? []) ids.add(id);
    return [...ids].map((id) => index.ideas.get(id)).filter((i): i is Idea => !!i);
  }, [steps, index]);

  const further = useMemo(() => {
    const moves = autoContinuation(index.pack.explorer, finalFen, index.side, 10);
    // End on our move: the repertoire card should be our decision.
    const ourFirst = steps.length % 2 === (index.side === 'w' ? 0 : 1);
    const keep = moves.length - (moves.length % 2 === (ourFirst ? 0 : 1) ? 1 : 0);
    return moves.slice(0, Math.max(0, keep));
  }, [index, finalFen, steps.length]);

  const startNo = Math.floor(steps.length / 2) + 1;
  const furtherText = further
    .map((san, i) => {
      const ply = steps.length + i;
      return ply % 2 === 0
        ? `${Math.floor(ply / 2) + 1}. ${san}`
        : i === 0
          ? `${startNo}… ${san}`
          : san;
    })
    .join(' ');

  return (
    <PanelCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Flag color={index.pack.meta.accentColor} size={22} />
        <ThemedText variant="heading">{t('theory.endTitle')}</ThemedText>
      </View>

      {ideas.length ? (
        <View style={{ gap: theme.spacing.xs }}>
          <ThemedText variant="label" tone="textMuted">
            {t('theory.plan')}
          </ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            {ideas.map((i) => (
              <PressableScale
                key={i.id}
                accessibilityRole="button"
                accessibilityLabel={i.title.ru}
                onPress={() => onIdea(i)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: 6,
                  borderRadius: theme.radii.pill,
                  backgroundColor: `${theme.colors.verified}22`,
                }}>
                <Lightbulb color={theme.colors.verified} size={16} />
                <ThemedText variant="label" style={{ color: theme.colors.verified }}>
                  {i.title.ru}
                </ThemedText>
              </PressableScale>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.xs }}>
        <ThemedText variant="label" tone="textMuted">
          {t('theory.goFurther')}
        </ThemedText>
        {further.length ? (
          <>
            <ThemedText style={{ fontFamily: theme.typography.family.semibold }}>
              {furtherText}
            </ThemedText>
            <ThemedText variant="caption" tone="generated">
              ⚙ {t('theory.goFurtherHint')}
            </ThemedText>
            <Button
              icon={BookmarkPlus}
              label={added ? t('theory.added') : t('theory.addToMine')}
              disabled={added}
              onPress={() => {
                addCustomLine(packId, [...indexed.line.moves, ...further]);
                setAdded(true);
              }}
              style={{ alignSelf: 'flex-start' }}
            />
          </>
        ) : (
          <ThemedText variant="caption" tone="textMuted">
            {t('theory.noData')}
          </ThemedText>
        )}
      </View>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.xs,
        }}>
        <Button
          variant="primary"
          icon={Swords}
          label={t('theory.playFromHere')}
          onPress={() => router.push(`/practice/${packId}?line=${indexed.line.id}`)}
        />
        {index.pack.puzzles.length ? (
          <Button
            icon={Puzzle}
            label={t('theory.puzzles')}
            onPress={() => router.push(`/puzzles/${packId}`)}
          />
        ) : null}
      </View>
    </PanelCard>
  );
}
