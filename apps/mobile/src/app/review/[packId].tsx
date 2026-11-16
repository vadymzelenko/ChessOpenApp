import { ratingFromAttempt, reviewQueue, type ReviewItem } from '@chess-open/core';
import {
  Button,
  ThemedText,
  useTheme,
  type BoardArrow,
  type BoardHighlight,
  type BoardMove,
} from '@chess-open/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, HelpCircle, Lightbulb, Trophy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PanelCard, SessionLayout } from '@/components/SessionLayout';
import { TrainingBoard } from '@/components/TrainingBoard';
import { usePosition } from '@/hooks/usePosition';
import { usePack } from '@/hooks/usePack';
import { PACK_IDS } from '@/packs/registry';
import { moveFeedback, playSound, successFeedback, wrongFeedback } from '@/services/feedback';
import { packCards, useProgress, useProgressHydrated } from '@/store/progress';

export function generateStaticParams(): { packId: string }[] {
  return PACK_IDS.map((packId) => ({ packId }));
}

type Phase = 'replay' | 'answer' | 'reveal' | 'done';
type HintLevel = 0 | 1 | 2 | 3;

/**
 * Daily review (ТЗ §6 «Повторение (SRS)», module 21): each due position is
 * reached by replaying its line from the start; then the user must find the
 * course move. No takebacks; hints lower the rating.
 */
export default function ReviewScreen() {
  const { packId } = useLocalSearchParams<{ packId: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const index = usePack(packId);
  const hydrated = useProgressHydrated();
  const gradeCard = useProgress((s) => s.gradeCard);
  const addXp = useProgress((s) => s.addXp);

  // The queue is captured once, after stored progress has loaded.
  const [queue, setQueue] = useState<ReviewItem[] | null>(null);
  const [now] = useState(() => Date.now());
  if (queue === null && hydrated && index) {
    setQueue(reviewQueue(index, packCards(useProgress.getState().cards, index.pack.meta.id), now));
  }

  const [idx, setIdx] = useState(0);
  const [ply, setPly] = useState(0);
  const [phase, setPhase] = useState<Phase>('replay');
  const [mistakes, setMistakes] = useState(0);
  const [hint, setHint] = useState<HintLevel>(0);
  const [correct, setCorrect] = useState(0);
  const [lastOk, setLastOk] = useState(false);

  const item = queue?.[idx];
  const steps = item && index ? (index.lines.get(item.lineId)?.steps ?? []) : [];
  const target = item?.stepIndex ?? 0;
  const step = steps[target];
  const fen = ply === 0 ? (index?.startFen ?? '') : (steps[ply - 1]?.move.fenAfter ?? '');
  const answering = phase === 'answer' && !!step;
  const { game, pieces, legalMoves, isPromotion } = usePosition(fen, answering);
  const last = ply > 0 ? steps[ply - 1] : null;

  // Replay the line quickly up to the position to answer.
  useEffect(() => {
    if (phase !== 'replay' || !item) return;
    const id = setTimeout(
      () => {
        if (ply >= target) {
          setPhase('answer');
          return;
        }
        playSound('move');
        setPly(ply + 1);
        if (ply + 1 >= target) setPhase('answer');
      },
      ply === 0 ? 450 : Math.max(180, theme.durations.move + 60),
    );
    return () => clearTimeout(id);
  }, [phase, item, ply, target, theme.durations.move]);

  // After an answer, move on to the next card.
  useEffect(() => {
    if (phase !== 'reveal' || !queue) return;
    const id = setTimeout(() => {
      const next = idx + 1;
      setMistakes(0);
      setHint(0);
      setPly(0);
      if (next >= queue.length) {
        setPhase('done');
        successFeedback();
        return;
      }
      setIdx(next);
      setPhase(queue[next]!.stepIndex === 0 ? 'answer' : 'replay');
    }, 1100);
    return () => clearTimeout(id);
  }, [phase, idx, queue]);

  const finishCard = (ok: boolean) => {
    if (!item || !index || !step) return;
    gradeCard(
      index.pack.meta.id,
      item.key,
      ok ? ratingFromAttempt({ mistakes, hintLevel: hint }) : 1,
    );
    if (ok && mistakes === 0 && hint < 3) {
      setCorrect((c) => c + 1);
      addXp(2);
    }
    setLastOk(ok && mistakes === 0 && hint < 3);
    setPly(target + 1);
    setPhase('reveal');
  };

  const onMove = (m: BoardMove) => {
    if (!answering || !step) return false;
    const exp = step.move;
    if (m.from === exp.from && m.to === exp.to && (m.promotion ?? 'q') === (exp.promotion ?? 'q')) {
      moveFeedback(exp);
      finishCard(true);
      return true;
    }
    wrongFeedback();
    setMistakes((n) => n + 1);
    if (mistakes >= 1) setHint(3);
    return false;
  };

  if (!index) return null;
  const accent = index.pack.meta.accentColor;
  const total = queue?.length ?? 0;
  const fallback = `/course/${index.pack.meta.id}`;

  const arrows: BoardArrow[] = [];
  const highlights: BoardHighlight[] = [];
  if (answering && step) {
    if (hint >= 1) highlights.push({ square: step.move.from, color: 'green' });
    if (hint >= 3) arrows.push({ from: step.move.from, to: step.move.to, color: 'green' });
  }

  let panel: React.ReactNode;
  if (queue && total === 0) {
    panel = (
      <PanelCard>
        <ThemedText variant="heading">{t('review.nothing')}</ThemedText>
        <ThemedText tone="textMuted">{t('review.nothingHint')}</ThemedText>
        <Button
          variant="primary"
          label={t('line.toCourse')}
          onPress={() => router.replace(fallback as never)}
          style={{ alignSelf: 'flex-start' }}
        />
      </PanelCard>
    );
  } else if (phase === 'done') {
    panel = (
      <PanelCard tone="success">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Trophy color={theme.colors.verified} size={26} />
          <ThemedText variant="heading">{t('review.done')}</ThemedText>
        </View>
        <ThemedText tone="textMuted">
          {t('review.summary', { correct, total })} · {t('line.xp', { count: correct * 2 })}
        </ThemedText>
        <Button
          variant="primary"
          label={t('line.toCourse')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
          style={{ alignSelf: 'flex-start' }}
        />
      </PanelCard>
    );
  } else if (phase === 'reveal' && step) {
    panel = (
      <PanelCard tone={lastOk ? 'success' : 'danger'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          {lastOk ? (
            <CheckCircle2 color={theme.colors.success} size={24} />
          ) : (
            <HelpCircle color={theme.colors.danger} size={24} />
          )}
          <ThemedText variant="heading">
            {lastOk ? t('review.correct') : t('review.wasMove', { san: step.move.san })}
          </ThemedText>
        </View>
        {step.annotation?.comment ? (
          <ThemedText style={{ lineHeight: 24 }}>{step.annotation.comment.ru}</ThemedText>
        ) : null}
      </PanelCard>
    );
  } else {
    panel = (
      <>
        <PanelCard tone={mistakes > 0 ? 'danger' : undefined}>
          <ThemedText variant="heading">
            {phase === 'replay'
              ? t('review.replaying')
              : mistakes > 0
                ? t('line.wrong')
                : t('review.findMove')}
          </ThemedText>
          {answering && hint >= 2 && step?.annotation?.comment ? (
            <ThemedText style={{ lineHeight: 24 }}>{step.annotation.comment.ru}</ThemedText>
          ) : null}
          {answering && hint >= 3 && step ? (
            <ThemedText variant="label" tone="accent">
              {t('line.correctWas', { san: step.move.san })}
            </ThemedText>
          ) : null}
        </PanelCard>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            grow
            icon={Lightbulb}
            label={hint === 0 ? t('line.hint') : hint === 1 ? t('line.hint2') : t('line.hint3')}
            onPress={() => setHint((h) => Math.min(3, h + 1) as HintLevel)}
            disabled={!answering || hint >= 3}
          />
          <Button
            icon={HelpCircle}
            label={t('review.forgot')}
            onPress={() => finishCard(false)}
            disabled={!answering}
          />
        </View>
      </>
    );
  }

  return (
    <SessionLayout
      title={t('review.title')}
      subtitle={index.pack.meta.title.ru}
      progress={total ? (phase === 'done' ? 1 : idx / total) : undefined}
      accent={accent}
      fallbackHref={fallback}
      board={
        <TrainingBoard
          pieces={pieces}
          orientation={index.side}
          lastMove={last ? { from: last.move.from, to: last.move.to } : null}
          check={game?.checkedKingSquare ?? null}
          interactive={answering}
          legalMoves={legalMoves}
          isPromotion={isPromotion}
          onMove={onMove}
          arrows={arrows}
          highlights={highlights}
        />
      }
      panel={
        <>
          {total > 0 && phase !== 'done' ? (
            <ThemedText variant="caption" tone="textMuted">
              {t('review.progress', { done: idx + 1, total })}
            </ThemedText>
          ) : null}
          {panel}
        </>
      }
    />
  );
}
