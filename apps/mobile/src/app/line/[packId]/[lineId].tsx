import {
  ChessGame,
  bestOf,
  courseLevels,
  decodeMoveScore,
  formatScore,
  judgeMove,
  positionKey,
  ratingFromAttempt,
  winningChances,
  type Idea,
  type LineStep,
  type MoveVerdict,
  type Score,
  type Square,
  type Stars,
} from '@chess-open/core';
import {
  Board,
  Button,
  EvalBar,
  PressableScale,
  SegmentedControl,
  ThemedText,
  boardThemes,
  useTheme,
  type BoardArrow,
  type BoardBadge,
  type BoardHighlight,
  type BoardMove,
} from '@chess-open/ui';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Eye,
  Lightbulb,
  RotateCcw,
  Star,
  Swords,
  Undo2,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IdeaSheet } from '@/components/IdeaSheet';
import { RichComment } from '@/components/RichComment';
import { StarResult } from '@/components/StarResult';
import { VerdictCard } from '@/components/VerdictCard';
import { useHotkeys } from '@/hooks/useHotkeys';
import { usePack } from '@/hooks/usePack';
import { useScreenSize } from '@/hooks/useScreenWidth';
import { PACK_IDS, getPack } from '@/packs/registry';
import { moveFeedback, playSound, successFeedback, wrongFeedback } from '@/services/feedback';
import { lineKey, lineStars, useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';

type Mode = 'study' | 'train';
type HintLevel = 0 | 1 | 2 | 3;

/** A move the user tried instead of the course move, with its judgement. */
interface Trial {
  uci: string;
  san: string;
  from: Square;
  to: Square;
  fen: string;
  verdict: MoveVerdict;
  bestSan?: string;
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const moveLabel = (s: LineStep) => {
  const n = Math.ceil(s.ply / 2);
  return s.ply % 2 === 1 ? `${n}. ${s.move.san}` : `${n}… ${s.move.san}`;
};

const uciToSan = (fen: string, uci: string | undefined) => {
  if (!uci) return undefined;
  const g = new ChessGame(fen);
  return (
    g.play({
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion: uci[4] as 'q',
    })?.san ?? undefined
  );
};

/** Static web export: pre-render a page for every line of every shipped pack. */
export function generateStaticParams(): { packId: string; lineId: string }[] {
  return PACK_IDS.flatMap((packId) =>
    [...(getPack(packId)?.lines.keys() ?? [])].map((lineId) => ({ packId, lineId })),
  );
}

/**
 * Level screen: Study (step through with explanations, try your own moves and
 * see why they are good or bad) and Training (play the line for stars) —
 * ТЗ §6–7, modules 19–20, 24.
 */
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
  const moveEvals = index?.pack.moveEvals;

  const best = useProgress((s) => lineStars(s.lines[lineKey(packId ?? '', lineId ?? '')]));
  const studiedBefore = useProgress((s) => !!s.lines[lineKey(packId ?? '', lineId ?? '')]?.studied);
  // A level already studied opens straight in training (for the stars).
  const [mode, setMode] = useState<Mode>(() => (studiedBefore ? 'train' : 'study'));
  const [hints, setHints] = useState(0);
  const [runStars, setRunStars] = useState<Stars | null>(null);
  const [ply, setPlyState] = useState(0);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [trial, setTrial] = useState<Trial | null>(null);
  const [found, setFound] = useState<ReadonlySet<number>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  // Training state
  const [mistakes, setMistakes] = useState(0);
  const [stepMistakes, setStepMistakes] = useState(0);
  const [hint, setHint] = useState<HintLevel>(0);
  const [wrong, setWrong] = useState<Trial | null>(null);
  const stepStart = useRef(0);

  const setPly = useCallback((p: number) => {
    setTrial(null);
    setPlyState(p);
  }, []);

  const startFen = index?.startFen ?? START;
  const fen = ply === 0 ? startFen : (steps[ply - 1]?.move.fenAfter ?? startFen);
  const shownFen = trial?.fen ?? fen;
  const game = useMemo(() => new ChessGame(shownFen), [shownFen]);
  const pieces = useMemo(() => game.pieces(), [game]);
  const last = ply > 0 ? steps[ply - 1]! : null;
  const current = steps[ply]; // the move to be made next
  const finished = mode === 'train' && steps.length > 0 && ply >= steps.length;
  const userTurn = mode === 'train' && !finished && !!current?.ours;
  // Study: on our move the board is live — find the move yourself or try another one.
  const tryTurn = mode === 'study' && !trial && !!current?.ours;

  const restart = useCallback(
    (m: Mode) => {
      setMode(m);
      setPly(0);
      setMistakes(0);
      setStepMistakes(0);
      setHint(0);
      setHints(0);
      setRunStars(null);
      setWrong(null);
      setFound(new Set());
      stepStart.current = Date.now();
    },
    [setPly],
  );

  /** Training: called when a move makes `nextPly`; finishing the line awards stars. */
  const advance = useCallback(
    (nextPly: number) => {
      setPly(nextPly);
      stepStart.current = Date.now();
      if (index && indexed && nextPly >= steps.length) {
        const stars = finishRun(index.pack.meta.id, indexed.line.id, mistakes, hints);
        setRunStars(stars);
        addXp(5 * stars);
        successFeedback();
      }
    },
    [index, indexed, steps.length, mistakes, hints, finishRun, addXp, setPly],
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

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(id);
  }, [toast]);

  const live = userTurn || tryTurn;
  const legalMoves = useCallback(
    (from: Square) => (live ? game.destinations(from) : []),
    [live, game],
  );
  const isPromotion = useCallback((from: Square, to: Square) => game.isPromotion(from, to), [game]);

  /** Judge a move tried in the current course position. */
  const judge = (m: BoardMove): Trial | null => {
    if (!current) return null;
    const uci = `${m.from}${m.to}${m.promotion ?? ''}`;
    const g = new ChessGame(current.fenBefore);
    const rec = g.play({ from: m.from, to: m.to, promotion: m.promotion });
    if (!rec) return null;
    const verdict = judgeMove({
      fenBefore: current.fenBefore,
      uci: rec.uci,
      courseUci: current.move.uci,
      scores: moveEvals?.[current.keyBefore],
    });
    return {
      uci,
      san: rec.san,
      from: m.from,
      to: m.to,
      fen: rec.fenAfter,
      verdict,
      bestSan: uciToSan(current.fenBefore, verdict.bestUci),
    };
  };

  const onMove = (m: BoardMove) => {
    if (!current || !index) return false;
    const exp = current.move;
    const ok =
      m.from === exp.from && m.to === exp.to && (m.promotion ?? 'q') === (exp.promotion ?? 'q');
    if (mode === 'study') {
      if (!tryTurn) return false;
      if (ok) {
        moveFeedback(exp);
        successFeedback();
        setFound((s) => new Set(s).add(current.ply));
        setPly(ply + 1);
        return true;
      }
      const tr = judge(m);
      if (!tr) return false;
      playSound('move');
      setTrial(tr);
      return true;
    }
    if (!userTurn) return false;
    if (!ok) {
      wrongFeedback();
      setMistakes((n) => n + 1);
      setStepMistakes((n) => n + 1);
      setWrong(judge(m));
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
    setWrong(null);
    advance(ply + 1);
    return true;
  };

  const next = () => {
    if (trial) {
      setTrial(null);
      return;
    }
    if (ply < steps.length) {
      moveFeedback(steps[ply]!.move);
      setPly(ply + 1);
    }
  };
  const prev = () => {
    if (trial) {
      setTrial(null);
      return;
    }
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
  const levels = courseLevels(index);
  const levelNo = levels.findIndex((l) => l.lineId === indexed.line.id);
  const nextLevel = levelNo >= 0 ? levels[levelNo + 1] : undefined;
  const annotation = mode === 'study' && !trial ? last?.annotation : undefined;
  const ourTotal = steps.filter((s) => s.ours).length;

  // --- evaluation of the shown position (pre-computed engine scores) -----------------
  const scoreAt = (): Score | undefined => {
    if (trial) return trial.verdict.score;
    const key = positionKey(fen);
    const turn = fen.split(' ')[1] === 'b' ? 'b' : 'w';
    if (turn === index.side) {
      const s = bestOf(moveEvals?.[key], turn);
      if (s) return s;
    } else if (last?.ours) {
      const v = moveEvals?.[last.keyBefore]?.[last.move.uci];
      if (v !== undefined) return decodeMoveScore(v);
    }
    return index.pack.evals[key];
  };
  const score = scoreAt();

  // --- board drawings ----------------------------------------------------------------
  const arrows: BoardArrow[] = [];
  const highlights: BoardHighlight[] = [];
  const badges: BoardBadge[] = [];
  if (annotation) {
    arrows.push(...(annotation.arrows ?? []));
    highlights.push(...(annotation.highlights ?? []));
  }
  if (trial) {
    badges.push({ square: trial.to, kind: trial.verdict.grade });
    if (current) arrows.push({ from: current.move.from, to: current.move.to, color: 'blue' });
  } else if (last?.ours) {
    badges.push({ square: last.move.to, kind: found.has(last.ply) ? 'best' : 'book' });
  } else if (last?.annotation?.trap && mode === 'study') {
    badges.push({ square: last.move.to, kind: 'blunder' });
  }
  if (mode === 'train' && current && userTurn) {
    if (hint >= 1) highlights.push({ square: current.move.from, color: 'green' });
    if (hint >= 3) arrows.push({ from: current.move.from, to: current.move.to, color: 'green' });
  }
  const shownLast = trial ? { from: trial.from, to: trial.to } : last ? last.move : null;

  // --- copy FEN / PGN -----------------------------------------------------------------
  const pgn = () => {
    const upto = mode === 'study' ? ply : steps.length;
    const moves = steps
      .slice(0, upto)
      .map((s) => (s.ply % 2 === 1 ? `${Math.ceil(s.ply / 2)}. ${s.move.san}` : s.move.san))
      .join(' ');
    const head = [
      `[Event "${index.pack.meta.title.ru}: ${indexed.line.title.ru}"]`,
      '[Site "Chess Open"]',
      ...(startFen !== START ? ['[SetUp "1"]', `[FEN "${startFen}"]`] : []),
    ].join('\n');
    return `${head}\n\n${moves} *\n`;
  };
  const copy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setToast(t('judge.copied'));
  };

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

  const card = (children: ReactNode, tone?: 'danger' | 'success') => (
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

  // --- controls: right under the board, they never move -------------------------------
  const controls =
    mode === 'study' ? (
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {trial ? (
          <>
            <Button grow icon={Undo2} label={t('judge.back')} onPress={() => setTrial(null)} />
            <Button
              grow
              variant="primary"
              icon={Eye}
              label={t('judge.showCourse')}
              onPress={() => {
                if (current) moveFeedback(current.move);
                setPly(ply + 1);
              }}
            />
          </>
        ) : (
          <>
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
                label={t('levels.playForStars')}
                onPress={() => restart('train')}
              />
            )}
          </>
        )}
      </View>
    ) : finished ? null : (
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
          onPress={() => {
            if (hint === 0) setHints((n) => n + 1);
            setHint((h) => Math.min(3, h + 1) as HintLevel);
          }}
          disabled={!userTurn || hint >= 3}
        />
        <Button
          icon={RotateCcw}
          accessibilityLabel={t('line.again')}
          onPress={() => restart('train')}
        />
      </View>
    );

  // --- explanation ---------------------------------------------------------------------
  const studyCard = trial ? (
    <VerdictCard
      verdict={trial.verdict}
      san={trial.san}
      courseSan={current?.move.san}
      bestSan={trial.bestSan}
    />
  ) : (
    card(
      <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <ThemedText variant="label" tone="textMuted" style={{ flex: 1 }}>
            {last ? moveLabel(last) : t('line.start')}
            {last?.annotation?.trap ? ` · ${t('line.trap')}` : ''}
          </ThemedText>
          {last && found.has(last.ply) ? (
            <ThemedText variant="label" tone="success">
              {t('judge.found')}
            </ThemedText>
          ) : null}
        </View>
        <RichComment
          text={
            last
              ? (last.annotation?.comment?.ru ?? (last.ours ? t('line.noComment') : ''))
              : (indexed.chapter.description?.ru ?? indexed.line.title.ru)
          }
        />
        {last?.annotation?.ideas?.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            {ideaChips(last.annotation.ideas)}
          </View>
        ) : null}
        {tryTurn ? (
          <ThemedText variant="label" tone="accent" style={{ marginTop: 2 }}>
            {t('judge.tryYourself')}
          </ThemedText>
        ) : null}
      </>,
    )
  );

  const trainCard = finished ? (
    <StarResult
      stars={runStars ?? 1}
      best={best}
      mistakes={mistakes}
      hints={hints}
      onAgain={() => restart('train')}
      onNext={
        nextLevel
          ? () => router.replace(`/line/${index.pack.meta.id}/${nextLevel.lineId}`)
          : undefined
      }
      onMap={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  ) : wrong ? (
    <VerdictCard
      verdict={wrong.verdict}
      san={wrong.san}
      courseSan={hint >= 3 ? current?.move.san : undefined}
      hideCourse={hint < 3}
    />
  ) : (
    card(
      <>
        <ThemedText variant="heading">
          {userTurn ? t('line.yourMove') : t('line.opponentMove')}
        </ThemedText>
        {userTurn && current && hint >= 2 && current.annotation?.comment ? (
          <RichComment text={current.annotation.comment.ru} />
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
        <ThemedText variant="caption" tone="textMuted">
          {t('line.mistakes', { count: mistakes })}
        </ThemedText>
      </>,
    )
  );

  // --- move strip and tools -------------------------------------------------------------
  const strip = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {steps.map((s) => {
        const on = s.ply === ply;
        const done = s.ply < ply || mode === 'study';
        return (
          <PressableScale
            key={s.ply}
            accessibilityRole="button"
            accessibilityLabel={moveLabel(s)}
            disabled={mode !== 'study'}
            onPress={() => setPly(s.ply)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: theme.radii.sm,
              backgroundColor: on ? accent : 'transparent',
            }}>
            <ThemedText
              variant="label"
              style={{
                color: on
                  ? '#FFFFFF'
                  : mode === 'train' && s.ply > ply
                    ? 'transparent'
                    : done && s.ply <= ply
                      ? theme.colors.text
                      : theme.colors.textMuted,
              }}>
              {s.ply % 2 === 1 ? moveLabel(s) : s.move.san}
              {found.has(s.ply) ? ' ✓' : ''}
            </ThemedText>
          </PressableScale>
        );
      })}
    </View>
  );
  const tools = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
      <Button
        compact
        variant="ghost"
        icon={ClipboardCopy}
        label="FEN"
        accessibilityLabel={t('judge.copyFen')}
        onPress={() => void copy(shownFen)}
      />
      <Button
        compact
        variant="ghost"
        icon={ClipboardCopy}
        label="PGN"
        accessibilityLabel={t('judge.copyPgn')}
        onPress={() => void copy(pgn())}
      />
      {mode === 'study' && found.size > 0 ? (
        <ThemedText variant="caption" tone="textMuted" style={{ marginLeft: 'auto' }}>
          {t('judge.foundCount', { found: found.size, total: ourTotal })}
        </ThemedText>
      ) : null}
    </View>
  );

  const board = (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      <EvalBar
        chances={score ? winningChances(score) : null}
        orientation={index.side}
        width={wide ? 20 : 16}
      />
      <View style={{ flex: 1 }}>
        <Board
          pieces={pieces}
          orientation={index.side}
          lastMove={shownLast ? { from: shownLast.from, to: shownLast.to } : null}
          check={game.checkedKingSquare ?? null}
          legalMoves={live ? legalMoves : undefined}
          isPromotion={isPromotion}
          onMove={live ? onMove : undefined}
          arrows={arrows}
          highlights={highlights}
          badges={badges}
          showCoordinates={settings.showCoordinates}
          showLegalMoves={settings.showLegalMoves}
          moveInput={settings.moveInput}
          autoQueen={settings.autoQueen}
          boardTheme={boardThemes[settings.boardTheme]}
          pieceSet={settings.pieceSet}
          disabled={!live}
        />
      </View>
    </View>
  );

  const header = (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
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
            backgroundColor: theme.colors.surface,
          }}>
          <ChevronLeft color={theme.colors.text} size={24} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <ThemedText variant="caption" tone="textMuted" numberOfLines={1}>
              {levelNo >= 0 ? `${t('levels.level', { n: levelNo + 1 })} · ` : ''}
              {indexed.chapter.title.ru}
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 1 }}>
              {[1, 2, 3].map((n) => (
                <Star
                  key={n}
                  size={12}
                  color={n <= best ? theme.colors.verified : theme.colors.border}
                  fill={n <= best ? theme.colors.verified : 'transparent'}
                />
              ))}
            </View>
          </View>
          <ThemedText variant="heading" numberOfLines={1}>
            {indexed.line.title.ru}
          </ThemedText>
        </View>
        <View
          accessibilityLabel={t('judge.eval')}
          style={{
            minWidth: 54,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 4,
            borderRadius: theme.radii.pill,
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
          }}>
          <ThemedText variant="label" style={{ fontFamily: theme.typography.family.bold }}>
            {score ? formatScore(score) : '—'}
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

  const panel = (
    <View style={{ gap: theme.spacing.md }}>
      {controls}
      {mode === 'study' ? studyCard : trainCard}
      {strip}
      {tools}
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
            <View style={{ width: Math.max(320, Math.min(740, width * 0.55, height - 80)) }}>
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
      {toast ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: theme.spacing.xl,
            alignItems: 'center',
          }}>
          <View
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.surfaceRaised,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}>
            <ThemedText variant="label">{toast}</ThemedText>
          </View>
        </View>
      ) : null}
      <IdeaSheet idea={idea} onClose={() => setIdea(null)} />
    </View>
  );
}
