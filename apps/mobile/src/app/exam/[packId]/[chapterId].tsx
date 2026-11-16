import { EXAM_PASS_SCORE, examResult, pickExamLines, type ExamLineResult } from '@chess-open/core';
import { Button, ThemedText, useTheme, type BoardArrow, type BoardMove } from '@chess-open/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { Medal, RotateCcw, XCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PanelCard, SessionLayout } from '@/components/SessionLayout';
import { TrainingBoard } from '@/components/TrainingBoard';
import { usePosition } from '@/hooks/usePosition';
import { usePack } from '@/hooks/usePack';
import { PACK_IDS, getPack } from '@/packs/registry';
import { moveFeedback, successFeedback, wrongFeedback } from '@/services/feedback';
import { useProgress } from '@/store/progress';

export function generateStaticParams(): { packId: string; chapterId: string }[] {
  return PACK_IDS.flatMap((packId) =>
    (getPack(packId)?.pack.course.chapters ?? []).map((c) => ({ packId, chapterId: c.id })),
  );
}

const EXAM_SIZE = 10;
type Phase = 'play' | 'between' | 'done';

/**
 * Exam (ТЗ §6, module 22): random lines of a chapter, no hints, no takebacks.
 * A mistake shows the course move (to continue) but the line is not counted.
 * ≥ 85 % clean lines → medal.
 */
export default function ExamScreen() {
  const { packId, chapterId } = useLocalSearchParams<{ packId: string; chapterId: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const index = usePack(packId);
  const chapter = index?.pack.course.chapters.find((c) => c.id === chapterId);
  const gradeCard = useProgress((s) => s.gradeCard);
  const saveExam = useProgress((s) => s.saveExam);
  const addXp = useProgress((s) => s.addXp);

  const [lineIds, setLineIds] = useState(() =>
    chapter
      ? pickExamLines(
          chapter.lines.map((l) => l.id),
          EXAM_SIZE,
        )
      : [],
  );
  const [lineIdx, setLineIdx] = useState(0);
  const [ply, setPly] = useState(0);
  const [phase, setPhase] = useState<Phase>('play');
  const [lineMistakes, setLineMistakes] = useState(0);
  const [showMove, setShowMove] = useState(false);
  const [results, setResults] = useState<ExamLineResult[]>([]);

  const indexed = index ? index.lines.get(lineIds[lineIdx] ?? '') : undefined;
  const steps = indexed?.steps ?? [];
  const current = steps[ply];
  const userTurn = phase === 'play' && !!current?.ours;
  const fen = ply === 0 ? (index?.startFen ?? '') : (steps[ply - 1]?.move.fenAfter ?? '');
  const { game, pieces, legalMoves, isPromotion } = usePosition(fen, userTurn);
  const last = ply > 0 ? steps[ply - 1] : null;

  const advance = (nextPly: number) => {
    setPly(nextPly);
    setShowMove(false);
    if (indexed && nextPly >= steps.length) {
      setResults((r) => [...r, { lineId: indexed.line.id, mistakes: lineMistakes }]);
      setPhase('between');
    }
  };

  // Opponent replies.
  useEffect(() => {
    if (phase !== 'play' || !current || current.ours) return;
    const id = setTimeout(
      () => {
        moveFeedback(current.move);
        advance(ply + 1);
      },
      Math.max(350, theme.durations.move + 250),
    );
    return () => clearTimeout(id);
  });

  // Next line, or the result.
  useEffect(() => {
    if (phase !== 'between') return;
    const id = setTimeout(() => {
      const next = lineIdx + 1;
      setPly(0);
      setLineMistakes(0);
      if (next >= lineIds.length) {
        const r = examResult(results);
        if (index && chapter) saveExam(index.pack.meta.id, chapter.id, r.score, r.passed);
        addXp(Math.round(r.score * 30));
        if (r.passed) successFeedback();
        setPhase('done');
        return;
      }
      setLineIdx(next);
      setPhase('play');
    }, 900);
    return () => clearTimeout(id);
  }, [phase, lineIdx, lineIds.length, results, index, chapter, saveExam, addXp]);

  const onMove = (m: BoardMove) => {
    if (!userTurn || !current || !index) return false;
    const exp = current.move;
    if (m.from === exp.from && m.to === exp.to && (m.promotion ?? 'q') === (exp.promotion ?? 'q')) {
      gradeCard(index.pack.meta.id, current.keyBefore, showMove ? 1 : 3);
      moveFeedback(exp);
      advance(ply + 1);
      return true;
    }
    wrongFeedback();
    if (!showMove) setLineMistakes((n) => n + 1);
    setShowMove(true);
    return false;
  };

  const restart = () => {
    if (!chapter) return;
    setLineIds(
      pickExamLines(
        chapter.lines.map((l) => l.id),
        EXAM_SIZE,
      ),
    );
    setLineIdx(0);
    setPly(0);
    setLineMistakes(0);
    setShowMove(false);
    setResults([]);
    setPhase('play');
  };

  if (!index || !chapter) return null;
  const fallback = `/course/${index.pack.meta.id}`;
  const total = lineIds.length;
  const arrows: BoardArrow[] =
    showMove && current ? [{ from: current.move.from, to: current.move.to, color: 'red' }] : [];
  const r = examResult(results);

  let panel: React.ReactNode;
  if (phase === 'done') {
    panel = (
      <PanelCard tone={r.passed ? 'success' : 'danger'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          {r.passed ? (
            <Medal color={theme.colors.verified} size={30} />
          ) : (
            <XCircle color={theme.colors.danger} size={28} />
          )}
          <View style={{ flex: 1 }}>
            <ThemedText variant="heading">
              {t('exam.result', { score: Math.round(r.score * 100) })}
            </ThemedText>
            <ThemedText tone="textMuted">
              {r.passed
                ? t('exam.passed')
                : t('exam.notPassed', { pct: Math.round(EXAM_PASS_SCORE * 100) })}
            </ThemedText>
          </View>
        </View>
        {r.failed.length ? (
          <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
            <ThemedText variant="label" tone="textMuted">
              {t('exam.failedLines')}
            </ThemedText>
            {r.failed.map((id) => (
              <Button
                key={id}
                variant="ghost"
                label={index.lines.get(id)?.line.title.ru ?? id}
                onPress={() => router.push(`/line/${index.pack.meta.id}/${id}`)}
                style={{ alignSelf: 'flex-start' }}
              />
            ))}
          </View>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
            marginTop: theme.spacing.xs,
          }}>
          <Button icon={RotateCcw} label={t('exam.retry')} onPress={restart} />
          <Button
            variant="primary"
            label={t('line.toCourse')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
          />
        </View>
      </PanelCard>
    );
  } else {
    panel = (
      <PanelCard tone={showMove ? 'danger' : undefined}>
        <ThemedText variant="caption" tone="textMuted">
          {t('exam.lineOf', { n: lineIdx + 1, total })}
        </ThemedText>
        <ThemedText variant="heading">
          {showMove ? t('exam.failedLine') : userTurn ? t('line.yourMove') : t('line.opponentMove')}
        </ThemedText>
        {showMove && current ? (
          <ThemedText variant="label" tone="accent">
            {t('line.correctWas', { san: current.move.san })}
          </ThemedText>
        ) : null}
      </PanelCard>
    );
  }

  return (
    <SessionLayout
      title={t('exam.title')}
      subtitle={`${index.pack.meta.title.ru} · ${chapter.title.ru}`}
      progress={
        phase === 'done'
          ? 1
          : (lineIdx + (steps.length ? ply / steps.length : 0)) / Math.max(1, total)
      }
      accent={index.pack.meta.accentColor}
      fallbackHref={fallback}
      board={
        <TrainingBoard
          pieces={pieces}
          orientation={index.side}
          lastMove={last ? { from: last.move.from, to: last.move.to } : null}
          check={game?.checkedKingSquare ?? null}
          interactive={userTurn}
          legalMoves={legalMoves}
          isPromotion={isPromotion}
          onMove={onMove}
          arrows={arrows}
        />
      }
      panel={panel}
    />
  );
}
