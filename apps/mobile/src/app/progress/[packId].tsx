import {
  coverageReport,
  repertoireTree,
  streak,
  type RepertoireNode,
  type SrsCard,
} from '@chess-open/core';
import { PressableScale, Screen, SectionHeader, ThemedText, useTheme } from '@chess-open/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Flame, Sparkles, Target, Trophy } from 'lucide-react-native';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PanelCard } from '@/components/SessionLayout';
import { usePack } from '@/hooks/usePack';
import { PACK_IDS } from '@/packs/registry';
import { packCards, useProgress } from '@/store/progress';

export function generateStaticParams(): { packId: string }[] {
  return PACK_IDS.map((packId) => ({ packId }));
}

type CardTone = 'new' | 'learning' | 'learned' | 'forgotten';
const toneOf = (c: SrsCard | undefined): CardTone =>
  !c || c.state === 'new'
    ? 'new'
    : c.state === 'review'
      ? 'learned'
      : c.state === 'relearning'
        ? 'forgotten'
        : 'learning';

/** Repertoire tree with mastery colours, coverage, streak, XP and the mistake map (ТЗ §6, module 27). */
export default function ProgressScreen() {
  const { packId } = useLocalSearchParams<{ packId: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const index = usePack(packId);
  const cards = useProgress((s) => s.cards);
  const xp = useProgress((s) => s.xp);
  const activeDays = useProgress((s) => s.activeDays);
  const [now] = useState(() => Date.now());

  const tree = useMemo(() => (index ? repertoireTree(index) : []), [index]);
  const coverage = useMemo(
    () =>
      index && Object.keys(index.pack.explorer).length
        ? coverageReport(
            index.pack.explorer,
            index.ourMoves,
            index.side,
            [6, 10, 15],
            index.startFen,
          )
        : null,
    [index],
  );
  if (!index) return null;
  const meta = index.pack.meta;
  const own = packCards(cards, meta.id);
  const positions = [...index.ourMoves.keys()];
  const learned = positions.filter((k) => own[k]?.state === 'review').length;
  const errors = Object.entries(own)
    .filter(([k, c]) => c.lapses > 0 && index.ourMoves.has(k))
    .sort((a, b) => b[1].lapses - a[1].lapses)
    .slice(0, 6);

  const toneColor: Record<CardTone, string> = {
    new: theme.colors.surfaceRaised,
    learning: theme.colors.warning,
    learned: theme.colors.success,
    forgotten: theme.colors.danger,
  };

  const openLine = (lineId: string) => router.push(`/line/${meta.id}/${lineId}`);
  const label = (n: RepertoireNode, withNumber: boolean) => {
    const no = Math.ceil(n.ply / 2);
    return n.ply % 2 === 1 ? `${no}. ${n.san}` : withNumber ? `${no}… ${n.san}` : n.san;
  };

  const chip = (n: RepertoireNode, withNumber: boolean) => {
    const tone = n.ours ? toneOf(own[n.keyBefore]) : null;
    return (
      <PressableScale
        key={`${n.keyBefore}${n.san}`}
        accessibilityRole="button"
        accessibilityLabel={label(n, true)}
        onPress={() => openLine(n.lineIds[0]!)}
        style={{
          paddingHorizontal: 7,
          paddingVertical: 3,
          borderRadius: theme.radii.sm,
          backgroundColor: tone
            ? tone === 'new'
              ? toneColor.new
              : `${toneColor[tone]}33`
            : 'transparent',
          borderWidth: tone && tone !== 'new' ? 1 : 0,
          borderColor: tone ? toneColor[tone] : 'transparent',
        }}>
        <ThemedText
          variant="label"
          style={{
            color: n.ours ? theme.colors.text : theme.colors.textMuted,
            fontFamily: theme.typography.family.semibold,
          }}>
          {label(n, withNumber)}
        </ThemedText>
      </PressableScale>
    );
  };

  /**
   * A branch, Lichess-style: moves flow in a row; at a fork the alternatives
   * are shown as indented blocks, then the main continuation goes on at the
   * same level (so the main line never drifts to the right).
   */
  const branch = (start: RepertoireNode, depth: number): ReactNode => {
    const parts: ReactNode[] = [];
    let flow: ReactNode[] = [];
    let n: RepertoireNode | undefined = start;
    let withNumber = true;
    const flush = () => {
      if (flow.length) {
        parts.push(
          <View key={`f${parts.length}`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
            {flow}
          </View>,
        );
        flow = [];
      }
    };
    while (n) {
      flow.push(chip(n, withNumber));
      withNumber = false;
      const main: RepertoireNode | undefined = n.children[0];
      const alts = n.children.slice(1);
      if (alts.length) {
        flush();
        for (const alt of alts)
          parts.push(
            <Fragment key={`${alt.keyBefore}${alt.san}`}>{branch(alt, depth + 1)}</Fragment>,
          );
        withNumber = true;
      }
      n = main;
    }
    flush();
    return (
      <View
        key={`${start.keyBefore}${start.san}`}
        style={{
          marginLeft: depth === 0 ? 0 : theme.spacing.sm,
          paddingLeft: depth === 0 ? 0 : theme.spacing.sm,
          borderLeftWidth: depth === 0 ? 0 : 2,
          borderLeftColor: depth % 2 === 1 ? theme.colors.accent : theme.colors.generated,
          gap: 4,
          marginVertical: depth === 0 ? 0 : 2,
        }}>
        {parts}
      </View>
    );
  };

  const stat = (icon: ReactNode, value: string, caption: string) => (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '45%',
        padding: theme.spacing.md,
        gap: 4,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}>
      {icon}
      <ThemedText variant="heading">{value}</ThemedText>
      <ThemedText variant="caption" tone="textMuted">
        {caption}
      </ThemedText>
    </View>
  );

  return (
    <Screen
      title={t('progress.title')}
      subtitle={meta.title.ru}
      right={
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('course.back')}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace(`/course/${meta.id}` as never)
          }
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surface,
          }}>
          <ChevronLeft color={theme.colors.text} size={24} />
        </PressableScale>
      }>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {stat(
          <Flame color={theme.colors.warning} size={22} />,
          String(streak(activeDays, now)),
          t('progress.streak'),
        )}
        {stat(<Sparkles color={theme.colors.verified} size={22} />, String(xp), t('progress.xp'))}
        {stat(
          <Trophy color={theme.colors.success} size={22} />,
          `${learned} / ${positions.length}`,
          t('progress.learned'),
        )}
        {stat(
          <Target color={theme.colors.accent} size={22} />,
          coverage ? `${Math.round((coverage[10] ?? 0) * 100)}%` : '—',
          t('progress.coverage'),
        )}
      </View>
      <PanelCard>
        {coverage ? (
          [6, 10, 15].map((n) => (
            <ThemedText key={n}>
              {t('progress.coverageText', { pct: Math.round((coverage[n] ?? 0) * 100), n })}
            </ThemedText>
          ))
        ) : (
          <ThemedText tone="textMuted">{t('progress.noCoverage')}</ThemedText>
        )}
      </PanelCard>

      <SectionHeader title={t('progress.errors')} />
      <PanelCard>
        {errors.length === 0 ? (
          <ThemedText tone="textMuted">{t('progress.noErrors')}</ThemedText>
        ) : (
          errors.map(([key, c]) => {
            const lineId = index.linesByPosition.get(key)?.[0];
            const step = lineId
              ? index.lines.get(lineId)?.steps.find((s) => s.keyBefore === key && s.ours)
              : undefined;
            return (
              <PressableScale
                key={key}
                accessibilityRole="button"
                onPress={() => lineId && openLine(lineId)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  paddingVertical: 4,
                }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: theme.colors.danger,
                  }}
                />
                <ThemedText style={{ flex: 1 }} numberOfLines={1}>
                  {step ? `${Math.ceil(step.ply / 2)}. ${step.move.san}` : key} ·{' '}
                  {lineId ? index.lines.get(lineId)?.line.title.ru : ''}
                </ThemedText>
                <ThemedText variant="caption" tone="danger">
                  {t('progress.lapses', { count: c.lapses })}
                </ThemedText>
              </PressableScale>
            );
          })
        )}
      </PanelCard>

      <SectionHeader title={t('progress.tree')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
        {(['new', 'learning', 'learned', 'forgotten'] as const).map((tone) => (
          <View key={tone} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: toneColor[tone] }}
            />
            <ThemedText variant="caption" tone="textMuted">
              {t(`progress.legend${tone[0]!.toUpperCase()}${tone.slice(1)}`)}
            </ThemedText>
          </View>
        ))}
      </View>
      <PanelCard>{tree.map((root) => branch(root, 0))}</PanelCard>
    </Screen>
  );
}
