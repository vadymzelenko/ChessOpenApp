import {
  advantageFactors,
  formatScore,
  winningChances,
  type Eval,
  type Factor,
} from '@chess-open/core';
import { ThemedText, useTheme } from '@chess-open/ui';
import { Activity } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PanelCard } from '@/components/SessionLayout';

/**
 * Smart analysis (ТЗ §7): the engine score in words plus the reasons, computed
 * from the position (material, development, king, centre, pawns, activity).
 */
export function AnalysisCard({ fen, evaluation }: { fen: string; evaluation?: Eval }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const factors = useMemo(() => advantageFactors(fen), [fen]);

  const sideName = (s: 'w' | 'b') => (s === 'w' ? t('analysis.white') : t('analysis.black'));
  let verdict = t('analysis.balanced');
  if (evaluation) {
    const wc = winningChances(evaluation);
    const a = Math.abs(wc);
    verdict =
      a < 0.09
        ? t('analysis.equal')
        : t(a < 0.25 ? 'analysis.slight' : a < 0.5 ? 'analysis.clear' : 'analysis.winning', {
            side: sideName(wc >= 0 ? 'w' : 'b'),
          });
  }

  const bySide = (s: 'w' | 'b') => factors.filter((f) => f.side === s);
  const chip = (f: Factor) => (
    <View
      key={`${f.key}${f.side}`}
      style={{
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.colors.surfaceRaised,
      }}>
      <ThemedText variant="caption">{t(`analysis.f_${f.key}`, { amount: f.amount })}</ThemedText>
    </View>
  );

  return (
    <PanelCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Activity color={theme.colors.accent} size={20} />
        <ThemedText variant="label" tone="textMuted" style={{ flex: 1 }}>
          {t('analysis.title')}
        </ThemedText>
        {evaluation ? (
          <ThemedText variant="label" style={{ fontFamily: theme.typography.family.bold }}>
            {formatScore(evaluation)}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText variant="heading" style={{ fontSize: 17 }}>
        {verdict}
      </ThemedText>
      {(['w', 'b'] as const).map((s) =>
        bySide(s).length ? (
          <View
            key={s}
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <ThemedText variant="caption" tone="textMuted">
              {t('analysis.for', { side: sideName(s) })}
            </ThemedText>
            {bySide(s).map(chip)}
          </View>
        ) : null,
      )}
      {!evaluation ? (
        <ThemedText variant="caption" tone="generated">
          ⚙ {t('analysis.noEval')}
        </ThemedText>
      ) : null}
    </PanelCard>
  );
}
