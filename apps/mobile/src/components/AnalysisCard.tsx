import {
  advantageFactors,
  formatScore,
  winningChances,
  type Eval,
  type Factor,
} from '@chess-open/core';
import { PressableScale, ThemedText, useTheme } from '@chess-open/ui';
import { Activity, Cpu } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PanelCard } from '@/components/SessionLayout';

/**
 * Smart analysis (ТЗ §7): the engine score in words plus the reasons, computed
 * from the position (material, development, king, centre, pawns, activity).
 */
export interface EngineControl {
  on: boolean;
  onToggle: () => void;
  /** Search depth reached (when running). */
  depth?: number;
  /** Best line in SAN, starting with the side to move. */
  line?: string[];
}

export function AnalysisCard({
  fen,
  evaluation,
  engine,
}: {
  fen: string;
  evaluation?: Eval;
  /** Live Stockfish switch; omitted where no engine is available. */
  engine?: EngineControl;
}) {
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
        {engine ? (
          <PressableScale
            accessibilityRole="switch"
            accessibilityState={{ checked: engine.on }}
            accessibilityLabel={`${t('analysis.engine')}: ${t('analysis.engineHint')}`}
            onPress={engine.onToggle}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 4,
              borderRadius: theme.radii.pill,
              backgroundColor: engine.on ? theme.colors.accent : theme.colors.surfaceRaised,
            }}>
            <Cpu color={engine.on ? theme.colors.onAccent : theme.colors.textMuted} size={14} />
            <ThemedText
              variant="caption"
              style={{ color: engine.on ? theme.colors.onAccent : theme.colors.textMuted }}>
              {t('analysis.engine')}
            </ThemedText>
          </PressableScale>
        ) : null}
      </View>
      {engine?.on ? (
        <View style={{ gap: 2 }}>
          {engine.line?.length ? (
            <ThemedText variant="caption" tone="textMuted">
              {t('analysis.bestLine')} · {t('analysis.depth', { depth: engine.depth ?? 0 })}
            </ThemedText>
          ) : null}
          <ThemedText style={{ fontFamily: theme.typography.family.semibold }}>
            {engine.line?.length ? formatLine(fen, engine.line) : t('analysis.thinking')}
          </ThemedText>
        </View>
      ) : null}
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
      {!evaluation && !engine?.on ? (
        <ThemedText variant="caption" tone="generated">
          ⚙ {t('analysis.noEval')}
        </ThemedText>
      ) : null}
    </PanelCard>
  );
}

/** «12. Nf3 Nc6 13. Bb5» from a SAN line starting at `fen`. */
function formatLine(fen: string, line: readonly string[]): string {
  const parts = fen.split(' ');
  let no = Number(parts[5] ?? 1);
  let white = parts[1] !== 'b';
  return line
    .map((san, i) => {
      const text = white ? `${no}. ${san}` : i === 0 ? `${no}… ${san}` : san;
      if (!white) no++;
      white = !white;
      return text;
    })
    .join(' ');
}
