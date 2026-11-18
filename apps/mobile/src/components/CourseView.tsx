import { dueCount, mastery, type IndexedLine, type LineLevel } from '@chess-open/core';
import { Appear, Button, PressableScale, ThemedText, Tile, shade, useTheme } from '@chess-open/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Medal,
  Play,
  Repeat,
  Skull,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePack } from '@/hooks/usePack';
import { cardId, lineKey, packCards, useProgress } from '@/store/progress';

const LEVEL_COLORS: Record<LineLevel, string> = {
  base: '#2FB574',
  advanced: '#F08A3C',
  deep: '#EF5A5A',
};

/**
 * The course: progress, «continue» / review, then chapters that fold open into
 * their lines (ТЗ §6). Used as the home tab and for /course/<id>.
 */
export function CourseView({ packId, showBack }: { packId: string; showBack?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const index = usePack(packId);
  const cards = useProgress((s) => s.cards);
  const lineState = useProgress((s) => s.lines);
  const medals = useProgress((s) => s.medals);
  const [now] = useState(() => Date.now());
  const [openChapter, setOpenChapter] = useState<string | null | undefined>(undefined);

  const lineMastery = useMemo(() => {
    const out = new Map<string, number>();
    if (!index) return out;
    for (const [lineId, il] of index.lines) {
      out.set(
        lineId,
        mastery(
          il.steps.filter((s) => s.ours).map((s) => cards[cardId(index.pack.meta.id, s.keyBefore)]),
        ),
      );
    }
    return out;
  }, [index, cards]);

  if (!index) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}>
        <ThemedText>{t('course.notFound')}</ThemedText>
      </View>
    );
  }

  const { meta } = index.pack;
  const accent = meta.accentColor;
  const allLines = [...index.lines.values()];
  // Unique positions where we must find a move = the size of the repertoire.
  const repertoire = [...index.ourMoves.keys()];
  const learned = repertoire.filter((k) => cards[cardId(meta.id, k)]?.state === 'review').length;
  const pct = repertoire.length ? Math.round((learned / repertoire.length) * 100) : 0;
  const nextLine = allLines.find((l) => !lineState[lineKey(meta.id, l.line.id)]?.studied) ?? null;
  const open = (l: IndexedLine) => router.push(`/line/${meta.id}/${l.line.id}`);
  const isDraft = allLines.some((l) => l.line.status !== 'reviewed');
  const due = dueCount(packCards(cards, meta.id), now);
  // By default the chapter with the next line to study is unfolded.
  const expanded = openChapter === undefined ? (nextLine?.chapter.id ?? null) : openChapter;

  let i = 0;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
      showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={[accent, shade(accent, -0.45)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.xl,
        }}>
        <View style={{ maxWidth: 1040, width: '100%', alignSelf: 'center', gap: theme.spacing.md }}>
          {showBack ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('course.back')}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.18)',
              }}>
              <ChevronLeft color="#FFFFFF" size={24} />
            </PressableScale>
          ) : null}
          <ThemedText variant="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {t('home.heroBadge')}
          </ThemedText>
          <ThemedText variant="title" style={{ color: '#FFFFFF' }}>
            {meta.title.ru}
          </ThemedText>
          <ThemedText style={{ color: 'rgba(255,255,255,0.85)' }}>{meta.description.ru}</ThemedText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.lg, flexWrap: 'wrap' }}>
            {[
              [String(allLines.length), t('course.lines')],
              [String(learned), t('course.positionsLearned', { total: repertoire.length })],
              [`${pct}%`, t('course.learned')],
            ].map(([value, label]) => (
              <View key={label}>
                <ThemedText variant="heading" style={{ color: '#FFFFFF' }}>
                  {value}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {label}
                </ThemedText>
              </View>
            ))}
          </View>
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(255,255,255,0.25)',
              overflow: 'hidden',
            }}>
            <View style={{ width: `${pct}%`, height: 6, backgroundColor: '#FFFFFF' }} />
          </View>
          {nextLine ? (
            <View style={{ gap: 4 }}>
              <Button
                variant="inverse"
                icon={Play}
                label={learned === 0 ? t('course.startCourse') : t('course.continue')}
                onPress={() => open(nextLine)}
                style={{ alignSelf: 'flex-start' }}
              />
              <ThemedText variant="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {nextLine.chapter.title.ru} · {nextLine.line.title.ru}
              </ThemedText>
            </View>
          ) : (
            <ThemedText variant="label" style={{ color: '#FFFFFF' }}>
              {t('course.allDone')}
            </ThemedText>
          )}
        </View>
      </LinearGradient>

      <View
        style={{
          maxWidth: 1040,
          width: '100%',
          alignSelf: 'center',
          padding: theme.spacing.lg,
          gap: theme.spacing.sm,
        }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Appear index={i++} style={{ flex: 1 }}>
            <Tile
              title={t('review.title')}
              subtitle={due > 0 ? t('review.due', { count: due }) : t('review.noneDue')}
              icon={Repeat}
              accent="#9B6BF2"
              badge={due > 0 ? String(due) : undefined}
              onPress={() => router.push(`/review/${meta.id}`)}
              minHeight={0}
              style={{ flex: 1 }}
            />
          </Appear>
          {index.pack.traps.length ? (
            <Appear index={i++} style={{ flex: 1 }}>
              <Tile
                title={t('traps.title')}
                subtitle={t('traps.count', { count: index.pack.traps.length })}
                icon={Skull}
                accent="#F08A3C"
                onPress={() => router.push(`/traps/${meta.id}`)}
                minHeight={0}
                style={{ flex: 1 }}
              />
            </Appear>
          ) : null}
        </View>
        {isDraft ? (
          <ThemedText variant="caption" tone="generated">
            ⚙ {t('course.draftNote')}
          </ThemedText>
        ) : null}

        {index.pack.course.chapters.map((chapter) => {
          const isOpen = expanded === chapter.id;
          const ms = chapter.lines.map((l) => lineMastery.get(l.id) ?? 0);
          const chapterPct = ms.length
            ? Math.round((ms.reduce((a, b) => a + b, 0) / ms.length) * 100)
            : 0;
          const studied = chapter.lines.filter(
            (l) => lineState[lineKey(meta.id, l.id)]?.studied,
          ).length;
          return (
            <View key={chapter.id} style={{ gap: theme.spacing.sm }}>
              <Appear index={i++}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={chapter.title.ru}
                  onPress={() => setOpenChapter(isOpen ? null : chapter.id)}
                  style={{
                    padding: theme.spacing.md,
                    gap: theme.spacing.sm,
                    borderRadius: theme.radii.lg,
                    backgroundColor: isOpen ? `${accent}1F` : theme.colors.surface,
                    borderWidth: 1,
                    borderColor: isOpen ? accent : theme.colors.border,
                  }}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText variant="heading" style={{ fontSize: 18 }}>
                        {chapter.title.ru}
                      </ThemedText>
                      <ThemedText variant="caption" tone="textMuted">
                        {t('course.chapterLines', { done: studied, count: chapter.lines.length })}
                      </ThemedText>
                    </View>
                    {medals[lineKey(meta.id, chapter.id)] ? (
                      <Medal
                        color={theme.colors.verified}
                        size={22}
                        accessibilityLabel={t('exam.medal')}
                      />
                    ) : null}
                    <View style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>
                      <ChevronDown color={theme.colors.textMuted} size={22} />
                    </View>
                  </View>
                  <View
                    style={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: theme.colors.surfaceRaised,
                      overflow: 'hidden',
                    }}>
                    <View style={{ width: `${chapterPct}%`, height: 4, backgroundColor: accent }} />
                  </View>
                </PressableScale>
              </Appear>
              {isOpen ? (
                <>
                  {chapter.description ? (
                    <ThemedText tone="textMuted" style={{ paddingHorizontal: theme.spacing.xs }}>
                      {chapter.description.ru}
                    </ThemedText>
                  ) : null}
                  {chapter.lines.map((line, n) => {
                    const il = index.lines.get(line.id)!;
                    const m = lineMastery.get(line.id) ?? 0;
                    const st = lineState[lineKey(meta.id, line.id)];
                    return (
                      <Appear key={line.id} index={n}>
                        <PressableScale
                          accessibilityRole="button"
                          accessibilityLabel={line.title.ru}
                          onPress={() => open(il)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: theme.spacing.md,
                            padding: theme.spacing.md,
                            marginLeft: theme.spacing.md,
                            borderRadius: theme.radii.lg,
                            backgroundColor: theme.colors.surface,
                            borderWidth: 1,
                            borderColor: theme.colors.border,
                          }}>
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: st?.cleanRun ? accent : `${accent}22`,
                            }}>
                            {st?.cleanRun ? (
                              <Check color="#FFFFFF" size={20} strokeWidth={3} />
                            ) : (
                              <ThemedText variant="label" style={{ color: accent }}>
                                {Math.round(m * 100)}%
                              </ThemedText>
                            )}
                          </View>
                          <View style={{ flex: 1, gap: 4 }}>
                            <ThemedText variant="label" style={{ fontSize: 15 }} numberOfLines={2}>
                              {line.title.ru}
                            </ThemedText>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: theme.spacing.sm,
                              }}>
                              <View
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 1,
                                  borderRadius: theme.radii.pill,
                                  backgroundColor: `${LEVEL_COLORS[line.level]}22`,
                                }}>
                                <ThemedText
                                  variant="caption"
                                  style={{
                                    color: LEVEL_COLORS[line.level],
                                    fontFamily: theme.typography.family.bold,
                                  }}>
                                  {t(`course.level_${line.level}`)}
                                </ThemedText>
                              </View>
                              <ThemedText variant="caption" tone="textMuted">
                                {t('course.moves', { count: Math.ceil(il.steps.length / 2) })}
                              </ThemedText>
                            </View>
                          </View>
                          <ChevronRight color={theme.colors.textMuted} size={20} />
                        </PressableScale>
                      </Appear>
                    );
                  })}
                  <Button
                    variant="ghost"
                    icon={GraduationCap}
                    label={t('exam.startChapter')}
                    onPress={() => router.push(`/exam/${meta.id}/${chapter.id}`)}
                    style={{ alignSelf: 'flex-start', marginLeft: theme.spacing.md }}
                  />
                </>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
