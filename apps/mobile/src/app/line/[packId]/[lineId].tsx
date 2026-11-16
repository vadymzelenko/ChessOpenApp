import {
  ChessGame,
  ratingFromAttempt,
  type Idea,
  type LineStep,
  type Square,
} from '@chess-open/core';
import {
  Board,
  Button,
  PressableScale,
  SegmentedControl,
  ThemedText,
  boardThemes,
  useTheme,
  type BoardArrow,
  type BoardHighlight,
  type BoardMove,
} from '@chess-open/ui';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  RotateCcw,
  Swords,
  Trophy,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IdeaSheet } from '@/components/IdeaSheet';
import { TheoryEndCard } from '@/components/TheoryEndCard';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useScreenSize } from '@/hooks/useScreenWidth';
import { usePack } from '@/hooks/usePack';
import { PACK_IDS, getPack } from '@/packs/registry';
import { moveFeedback, playSound, successFeedback, wrongFeedback } from '@/services/feedback';
import { useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';

type Mode = 'study' | 'train';
type HintLevel = 0 | 1 | 2 | 3;

const moveLabel = (s: LineStep) => {
  const n = Math.ceil(s.ply / 2);
  return s.ply % 2 === 1 ? `${n}. ${s.move.san}` : `${n}… ${s.move.san}`;
};

/** Static web export: pre-render a page for every line of every shipped pack. */
export function generateStaticParams(): { packId: string; lineId: string }[] {
  return PACK_IDS.flatMap((packId) =>
    [...(getPack(packId)?.lines.keys() ?? [])].map((lineId) => ({ packId, lineId })),
  );
}

/** Line screen: Study (step through with comments) and Training (play it yourself) — ТЗ §6, modules 19–20. */
export default function LineScreen() {
  const { packId, lineId } = useLocalSearchParams<{ packId: string; lineId: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useScreenSize();
  const wide = width >= 860;
  const settings = useSettings();
  // Select actions only: they are stable, so effects depending on them do not loop.
  const gradeCard = useProgress((s) => s.gradeCard);
  const markStudied = useProgress((s) => s.markStudied);
  const finishRun = useProgress((s) => s.finishRun);
  const addXp = useProgress((s) => s.addXp);

  const index = usePack(packId);
  const indexed = index && lineId ? index.lines.get(lineId) : undefined;
  const steps = useMemo(() => indexed?.steps ?? [], [indexed]);

  const [mode, setMode] = useState<Mode>('study');
  const [ply, setPly] = useState(0);
  const [idea, setIdea] = useState<Idea | null>(null);
  // Training state
  const [mistakes, setMistakes] = useState(0);
  const [stepMistakes, setStepMistakes] = useState(0);
  const [hint, setHint] = useState<HintLevel>(0);
  const [wrong, setWrong] = useState(false);
  const stepStart = useRef(0);

  const fen = ply === 0 ? (index?.startFen ?? '') : steps[ply - 1]!.move.fenAfter;
  const game = useMemo(() => (fen ? new ChessGame(fen) : null), [fen]);
  const pieces = useMemo(() => game?.pieces() ?? [], [game]);
  const last = ply > 0 ? steps[ply - 1]! : null;
  const current = steps[ply]; // the move to be made next
  const finished = mode === 'train' && steps.length > 0 && ply >= steps.length;
  const userTurn = mode === 'train' && !finished && !!current?.ours;

  const restart = useCallback((m: Mode) => {
    setMode(m);
    setPly(0);
    setMistakes(0);
    setStepMistakes(0);
    setHint(0);
    setWrong(false);
    stepStart.current = Date.now();
  }, []);

  /** Training: called when a move makes `nextPly`; finishing the line awards XP once. */
  const advance = useCallback(
    (nextPly: number) => {
      setPly(nextPly);
      stepStart.current = Date.now();
      if (index && indexed && nextPly >= steps.length) {
        finishRun(index.pack.meta.id, indexed.line.id, mistakes);
        addXp(10 + (mistakes === 0 ? 5 : 0));
        successFeedback();
      }
    },
    [index, indexed, steps.length, mistakes, finishRun, addXp],
  );

  // Training: the opponent's replies are played automatically.
  useEffect(() => {
    if (mode !== 'train' || finished || !current || current.ours) return;
    const id = setTimeout(
      () => {
        moveFeedback(current.move);
        advance(ply + 1);
      },
      Math.max(350, theme.durations.move + 250),
    );
    return () => clearTimeout(id);
  }, [mode, finished, current, ply, advance, theme.durations.move]);

  // Study: reaching the end marks the line as studied.
  useEffect(() => {
    if (mode === 'study' && index && indexed && ply === steps.length && steps.length > 0) {
      markStudied(index.pack.meta.id, indexed.line.id);
    }
  }, [mode, ply, steps.length, index, indexed, markStudied]);

  const legalMoves = useCallback(
    (from: Square) => (userTurn && game ? game.destinations(from) : []),
    [userTurn, game],
  );
  const isPromotion = useCallback(
    (from: Square, to: Square) => !!game?.isPromotion(from, to),
    [game],
  );

  const onMove = useCallback(
    (m: BoardMove) => {
      if (!userTurn || !current || !index) return false;
      const exp = current.move;
      const ok =
        m.from === exp.from && m.to === exp.to && (m.promotion ?? 'q') === (exp.promotion ?? 'q');
      if (!ok) {
        wrongFeedback();
        setMistakes((n) => n + 1);
        setStepMistakes((n) => n + 1);
        setWrong(true);
        // After a second miss, show the move (ТЗ: «Ошибка → объяснение + повтор»).
        if (stepMistakes >= 1) setHint(3);
        return false;
      }
      const rating = ratingFromAttempt({
        mistakes: stepMistakes,
        hintLevel: hint,
        fast: Date.now() - stepStart.current < 4000,
      });
      gradeCard(index.pack.meta.id, current.keyBefore, rating);
      moveFeedback(exp);
      setStepMistakes(0);
      setHint(0);
      setWrong(false);
      advance(ply + 1);
      return true;
    },
    [userTurn, current, index, stepMistakes, hint, gradeCard, advance, ply],
  );

  const next = () => {
    if (ply < steps.length) {
      moveFeedback(steps[ply]!.move);
      setPly(ply + 1);
    }
  };
  const prev = () => {
    if (ply > 0) {
      playSound('move');
      setPly(ply - 1);
    }
  };
  useHotkeys({
    ArrowRight: () => mode === 'study' && next(),
    ArrowLeft: () => mode === 'study' && prev(),
  });

  if (!index || !indexed) {
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

  const accent = index.pack.meta.accentColor;
  const annotation = mode === 'study' ? last?.annotation : undefined;

  // Board drawings: course arrows in study; hints in training.
  const arrows: BoardArrow[] = [];
  const highlights: BoardHighlight[] = [];
  if (annotation) {
    arrows.push(...(annotation.arrows ?? []));
    highlights.push(...(annotation.highlights ?? []));
  }
  if (mode === 'train' && current && userTurn) {
    if (hint >= 1) highlights.push({ square: current.move.from, color: 'green' });
    if (hint >= 3) arrows.push({ from: current.move.from, to: current.move.to, color: 'green' });
  }

  const ideaChips = (ids: readonly string[] | undefined) =>
    (ids ?? [])
      .map((id) => index.ideas.get(id))
      .filter((x): x is Idea => !!x)
      .map((i) => (
        <PressableScale
          key={i.id}
          accessibilityRole="button"
          accessibilityLabel={i.title.ru}
          onPress={() => setIdea(i)}
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
      ));

  const card = (children: React.ReactNode, tone?: 'danger' | 'success') => (
    <View
      style={{
        padding: theme.spacing.lg,
        gap: theme.spacing.sm,
        borderRadius: theme.radii.xl,
        backgroundColor: tone
          ? `${tone === 'danger' ? theme.colors.danger : theme.colors.success}1A`
          : theme.colors.surface,
        borderWidth: 1,
        borderColor: tone
          ? tone === 'danger'
            ? theme.colors.danger
            : theme.colors.success
          : theme.colors.border,
      }}>
      {children}
    </View>
  );

  // --- panels -------------------------------------------------------------------------
  const studyPanel = (
    <View style={{ gap: theme.spacing.md }}>
      {card(
        <>
          <ThemedText variant="label" tone="textMuted">
            {last ? moveLabel(last) : t('line.start')}
            {last?.annotation?.trap ? ` · ${t('line.trap')}` : ''}
          </ThemedText>
          <ThemedText style={{ fontSize: 17, lineHeight: 26 }}>
            {last
              ? (last.annotation?.comment?.ru ?? (last.ours ? t('line.noComment') : ''))
              : (indexed.chapter.description?.ru ?? indexed.line.title.ru)}
          </ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            {ideaChips(last?.annotation?.ideas)}
          </View>
        </>,
      )}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Button
          icon={ChevronLeft}
          accessibilityLabel={t('line.prev')}
          onPress={prev}
          disabled={ply === 0}
        />
        {ply < steps.length ? (
          <Button
            grow
            variant="primary"
            icon={ChevronRight}
            label={t('line.next')}
            onPress={next}
          />
        ) : (
          <Button
            grow
            variant="primary"
            icon={Swords}
            label={t('line.nowYou')}
            onPress={() => restart('train')}
          />
        )}
      </View>
      {/* Move strip: the whole line, current move highlighted. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {steps.map((s) => (
          <PressableScale
            key={s.ply}
            accessibilityRole="button"
            accessibilityLabel={moveLabel(s)}
            onPress={() => setPly(s.ply)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: theme.radii.sm,
              backgroundColor: s.ply === ply ? accent : 'transparent',
            }}>
            <ThemedText
              variant="label"
              style={{
                color:
                  s.ply === ply
                    ? '#FFFFFF'
                    : s.ply < ply
                      ? theme.colors.text
                      : theme.colors.textMuted,
              }}>
              {s.ply % 2 === 1 ? moveLabel(s) : s.move.san}
            </ThemedText>
          </PressableScale>
        ))}
      </View>
    </View>
  );

  const trainPanel = finished ? (
    card(
      <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Trophy color={theme.colors.verified} size={26} />
          <ThemedText variant="heading">
            {mistakes === 0 ? t('line.doneClean') : t('line.done')}
          </ThemedText>
        </View>
        <ThemedText tone="textMuted">
          {t('line.mistakes', { count: mistakes })} ·{' '}
          {t('line.xp', { count: 10 + (mistakes === 0 ? 5 : 0) })}
        </ThemedText>
        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
            marginTop: theme.spacing.xs,
          }}>
          <Button icon={RotateCcw} label={t('line.again')} onPress={() => restart('train')} />
          <Button
            variant="primary"
            label={t('line.toCourse')}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace(`/course/${index.pack.meta.id}`)
            }
          />
        </View>
      </>,
      'success',
    )
  ) : (
    <View style={{ gap: theme.spacing.md }}>
      {card(
        <>
          <ThemedText variant="heading">
            {wrong ? t('line.wrong') : userTurn ? t('line.yourMove') : t('line.opponentMove')}
          </ThemedText>
          {wrong ? <ThemedText tone="textMuted">{t('line.wrongHint')}</ThemedText> : null}
          {userTurn && current && (hint >= 2 || wrong) && current.annotation?.comment ? (
            <ThemedText style={{ lineHeight: 24 }}>{current.annotation.comment.ru}</ThemedText>
          ) : null}
          {userTurn && current && hint >= 3 ? (
            <ThemedText variant="label" tone="accent">
              {t('line.correctWas', { san: current.move.san })}
            </ThemedText>
          ) : null}
          {userTurn && current && hint >= 2 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              {ideaChips(current.annotation?.ideas)}
            </View>
          ) : null}
        </>,
        wrong ? 'danger' : undefined,
      )}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Button
          grow
          icon={Lightbulb}
          label={
            hint === 0
              ? t('line.hint')
              : hint === 1
                ? t('line.hint2')
                : hint === 2
                  ? t('line.hint3')
                  : t('line.hint')
          }
          onPress={() => setHint((h) => Math.min(3, h + 1) as HintLevel)}
          disabled={!userTurn || hint >= 3}
        />
        <Button
          icon={RotateCcw}
          accessibilityLabel={t('line.again')}
          onPress={() => restart('train')}
        />
      </View>
      <ThemedText variant="caption" tone="textMuted">
        {t('line.mistakes', { count: mistakes })}
      </ThemedText>
    </View>
  );

  const board = (
    <Board
      pieces={pieces}
      orientation={index.side}
      lastMove={last ? { from: last.move.from, to: last.move.to } : null}
      check={game?.checkedKingSquare ?? null}
      legalMoves={mode === 'train' ? legalMoves : undefined}
      isPromotion={isPromotion}
      onMove={mode === 'train' ? onMove : undefined}
      arrows={arrows}
      highlights={highlights}
      showCoordinates={settings.showCoordinates}
      showLegalMoves={settings.showLegalMoves}
      moveInput={settings.moveInput}
      autoQueen={settings.autoQueen}
      boardTheme={boardThemes[settings.boardTheme]}
      pieceSet={settings.pieceSet}
      disabled={mode === 'study' || !userTurn}
    />
  );

  const header = (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('course.back')}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace(`/course/${index.pack.meta.id}`)
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
        <View style={{ flex: 1 }}>
          <ThemedText variant="caption" tone="textMuted" numberOfLines={1}>
            {indexed.chapter.title.ru}
          </ThemedText>
          <ThemedText variant="heading" numberOfLines={1}>
            {indexed.line.title.ru}
          </ThemedText>
        </View>
      </View>
      <SegmentedControl
        accessibilityLabel="mode"
        options={[
          { value: 'study', label: t('line.study') },
          { value: 'train', label: t('line.train') },
        ]}
        value={mode}
        onChange={(m) => restart(m)}
      />
    </View>
  );

  const atEnd = mode === 'study' ? ply === steps.length && steps.length > 0 : finished;
  const panel = (
    <View style={{ gap: theme.spacing.md }}>
      {mode === 'study' ? studyPanel : trainPanel}
      {atEnd ? <TheoryEndCard index={index} indexed={indexed} onIdea={setIdea} /> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={
          wide
            ? {
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: theme.spacing.xl,
                padding: theme.spacing.xl,
                paddingTop: insets.top + theme.spacing.xl,
                maxWidth: 1280,
                width: '100%',
                alignSelf: 'center',
              }
            : { paddingBottom: theme.spacing.xxl }
        }>
        {wide ? (
          <>
            <View style={{ width: Math.max(320, Math.min(720, width * 0.55, height - 80)) }}>
              {board}
            </View>
            <View style={{ flex: 1, gap: theme.spacing.lg }}>
              {header}
              {panel}
            </View>
          </>
        ) : (
          <>
            <View
              style={{
                paddingTop: insets.top + theme.spacing.sm,
                paddingHorizontal: theme.spacing.lg,
                paddingBottom: theme.spacing.md,
              }}>
              {header}
            </View>
            <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center' }}>{board}</View>
            <View
              style={{
                padding: theme.spacing.lg,
                width: '100%',
                maxWidth: 640,
                alignSelf: 'center',
              }}>
              {panel}
            </View>
          </>
        )}
      </ScrollView>
      <IdeaSheet idea={idea} onClose={() => setIdea(null)} />
    </View>
  );
}
