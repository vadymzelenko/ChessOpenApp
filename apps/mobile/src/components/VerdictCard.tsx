import { formatScore, type Factor, type MoveVerdict, type Threat } from '@chess-open/core';
import { Button, ThemedText, badgeStyles, useTheme, type BadgeKind } from '@chess-open/ui';
import { Eye, Undo2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

/** Board badge for an engine grade. */
export const gradeBadge = (grade: MoveVerdict['grade']): BadgeKind => grade;

/**
 * «Why is my move good or bad» (ТЗ §7): the grade, scores against the course
 * move, a hanging piece if any and what changes positionally.
 */
export function VerdictCard({
  verdict,
  san,
  courseSan,
  bestSan,
  onBack,
  onShowCourse,
  hideCourse,
}: {
  verdict: MoveVerdict;
  san: string;
  courseSan?: string;
  bestSan?: string;
  onBack?: () => void;
  onShowCourse?: () => void;
  /** Training: do not give the course move away. */
  hideCourse?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = badgeStyles[verdict.grade];
  const piece = (p: Threat['piece'] | Threat['by']) => t(`judge.piece_${p}`);
  const list = (fs: Factor[]) => fs.map((f) => t(`judge.f_${f.key}`)).join(', ');
  const threat = verdict.threats[0];
  return (
    <View
      style={{
        padding: theme.spacing.lg,
        gap: theme.spacing.sm,
        borderRadius: theme.radii.xl,
        backgroundColor: `${s.color}1F`,
        borderWidth: 1,
        borderColor: s.color,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: s.color,
          }}>
          <ThemedText style={{ color: '#FFFFFF', fontFamily: theme.typography.family.extrabold }}>
            {s.glyph}
          </ThemedText>
        </View>
        <ThemedText variant="heading" style={{ flex: 1, fontSize: 18 }}>
          {t(`judge.grade_${verdict.grade}`, { san })}
        </ThemedText>
      </View>
      {verdict.score && !hideCourse ? (
        <ThemedText tone="textMuted">
          {t('judge.scores', {
            mine: formatScore(verdict.score),
            course: verdict.courseScore ? formatScore(verdict.courseScore) : '—',
            courseSan: courseSan ?? '—',
          })}
        </ThemedText>
      ) : null}
      {threat ? (
        <ThemedText style={{ lineHeight: 24 }}>
          {t(threat.undefended ? 'judge.threatFree' : 'judge.threatCheap', {
            piece: piece(threat.piece),
            square: threat.square,
            by: piece(threat.by),
          })}
        </ThemedText>
      ) : null}
      {verdict.lost.length && !hideCourse ? (
        <ThemedText style={{ lineHeight: 24 }}>
          {t('judge.lost', { list: list(verdict.lost), courseSan: courseSan ?? '' })}
        </ThemedText>
      ) : null}
      {verdict.gave.length ? (
        <ThemedText style={{ lineHeight: 24 }}>
          {t('judge.gave', { list: list(verdict.gave) })}
        </ThemedText>
      ) : null}
      {!threat && (hideCourse || !verdict.lost.length) && !verdict.gave.length ? (
        <ThemedText style={{ lineHeight: 24 }}>
          {verdict.grade === 'best' || verdict.grade === 'good'
            ? hideCourse
              ? t('judge.alsoFineHidden')
              : t('judge.alsoFine', { courseSan: courseSan ?? '' })
            : t('judge.engineOnly')}
        </ThemedText>
      ) : null}
      {!hideCourse &&
      bestSan &&
      bestSan !== san &&
      bestSan !== courseSan &&
      verdict.grade !== 'good' ? (
        <ThemedText variant="caption" tone="textMuted">
          {t('judge.engineBest', { san: bestSan })}
        </ThemedText>
      ) : null}
      {onBack || onShowCourse ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          {onBack ? <Button compact icon={Undo2} label={t('judge.back')} onPress={onBack} /> : null}
          {onShowCourse ? (
            <Button
              compact
              variant="primary"
              icon={Eye}
              label={t('judge.showCourse')}
              onPress={onShowCourse}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
