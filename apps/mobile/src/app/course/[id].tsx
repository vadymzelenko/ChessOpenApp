import { mastery, type IndexedLine, type LineLevel } from '@chess-open/core';
import {
  Appear,
  Button,
  PressableScale,
  SectionHeader,
  ThemedText,
  shade,
  useTheme,
} from '@chess-open/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Play } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PACK_IDS, getPack } from '@/packs/registry';
import { cardId, lineKey, useProgress } from '@/store/progress';

const LEVEL_COLORS: Record<LineLevel, string> = {
  base: '#2FB574',
  advanced: '#F08A3C',
  deep: '#EF5A5A',
};

/** Static web export: pre-render a page for every shipped pack. */
export function generateStaticParams(): { id: string }[] {
  return PACK_IDS.map((id) => ({ id }));
}

/** Course screen: chapters and lines with progress (ТЗ §6, module 28 preview). */
export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const index = id ? getPack(id) : null;
  const cards = useProgress((s) => s.cards);
  const lineState = useProgress((s) => s.lines);

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
          <ThemedText variant="title" style={{ color: '#FFFFFF' }}>
            {meta.title.ru}
          </ThemedText>
          <ThemedText style={{ color: 'rgba(255,255,255,0.85)' }}>{meta.description.ru}</ThemedText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.lg, flexWrap: 'wrap' }}>
            {[
              [String(allLines.length), t('course.lines')],
              [String(index.ideas.size), t('course.ideas')],
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
            <Button
              variant="inverse"
              icon={Play}
              label={learned === 0 ? t('course.startCourse') : t('course.continue')}
              onPress={() => open(nextLine)}
              style={{ alignSelf: 'flex-start' }}
            />
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
        {isDraft ? (
          <ThemedText variant="caption" tone="generated">
            ⚙ {t('course.draftNote')}
          </ThemedText>
        ) : null}
        {index.pack.course.chapters.map((chapter) => (
          <View key={chapter.id} style={{ gap: theme.spacing.sm }}>
            <Appear index={i++}>
              <SectionHeader title={chapter.title.ru} />
              {chapter.description ? (
                <ThemedText variant="caption" tone="textMuted" style={{ marginTop: 2 }}>
                  {chapter.description.ru}
                </ThemedText>
              ) : null}
            </Appear>
            {chapter.lines.map((line) => {
              const il = index.lines.get(line.id)!;
              const m = lineMastery.get(line.id) ?? 0;
              const st = lineState[lineKey(meta.id, line.id)];
              return (
                <Appear key={line.id} index={i++}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={line.title.ru}
                    onPress={() => open(il)}
                    style={{
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
                      <ThemedText variant="label" style={{ fontSize: 15 }} numberOfLines={1}>
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
                          {t('course.positions', { count: il.steps.filter((s) => s.ours).length })}
                        </ThemedText>
                      </View>
                      <View
                        style={{
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: theme.colors.surfaceRaised,
                          overflow: 'hidden',
                        }}>
                        <View
                          style={{
                            width: `${Math.round(m * 100)}%`,
                            height: 4,
                            backgroundColor: accent,
                          }}
                        />
                      </View>
                    </View>
                    <ChevronRight color={theme.colors.textMuted} size={20} />
                  </PressableScale>
                </Appear>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
