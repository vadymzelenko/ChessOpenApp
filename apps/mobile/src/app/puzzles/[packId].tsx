import { ChessGame, type Puzzle, type Square } from '@chess-open/core';
import { Button, ThemedText, useTheme, type BoardArrow, type BoardMove } from '@chess-open/ui';
import { useLocalSearchParams } from 'expo-router';
import { CheckCircle2, ChevronRight, Eye } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PanelCard, SessionLayout } from '@/components/SessionLayout';
import { TrainingBoard } from '@/components/TrainingBoard';
import { usePack } from '@/hooks/usePack';
import { usePosition } from '@/hooks/usePosition';
import { PACK_IDS } from '@/packs/registry';
import { moveFeedback, successFeedback, wrongFeedback } from '@/services/feedback';
import { lineKey, useProgress } from '@/store/progress';

export function generateStaticParams(): { packId: string }[] {
  return PACK_IDS.map((packId) => ({ packId }));
}

const uciMove = (uci: string) => ({
  from: uci.slice(0, 2) as Square,
  to: uci.slice(2, 4) as Square,
  promotion: (uci[4] as 'q' | 'r' | 'b' | 'n' | undefined) ?? undefined,
});

/**
 * Opening puzzles (ТЗ §6 «Пазлы дебюта», module 26) from the Lichess puzzle
 * database: the opponent's move is played first, then the user finds the
 * continuation. Any mating move is accepted, as on Lichess.
 */
export default function PuzzlesScreen() {
  const { packId } = useLocalSearchParams<{ packId: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const index = usePack(packId);
  const results = useProgress((s) => s.puzzles);
  const savePuzzle = useProgress((s) => s.savePuzzle);
  const addXp = useProgress((s) => s.addXp);

  const all: Puzzle[] = index?.pack.puzzles ?? [];
  const pickNext = (after?: string): Puzzle | undefined => {
    const fresh = all.filter((p) => !results[lineKey(packId ?? '', p.id)] && p.id !== after);
    return fresh[0] ?? all.find((p) => p.id !== after) ?? all[0];
  };
  const [puzzle, setPuzzle] = useState<Puzzle | undefined>(() => pickNext());
  const [step, setStep] = useState(0); // index into puzzle.moves of the next move
  const [failed, setFailed] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  const fenAt = (p: Puzzle, n: number) => {
    const g = new ChessGame(p.fen);
    for (const uci of p.moves.slice(0, n)) g.play(uciMove(uci));
    return g.fen;
  };
  const fen = puzzle ? fenAt(puzzle, step) : '';
  const done = !!puzzle && step >= puzzle.moves.length;
  const solverTurn = !!puzzle && !done && step % 2 === 1;
  const { game, pieces, legalMoves, isPromotion } = usePosition(fen, solverTurn);
  const solverColor = puzzle ? (new ChessGame(puzzle.fen).turn === 'w' ? 'b' : 'w') : 'w';

  // Opponent moves (even indices) play themselves.
  useEffect(() => {
    if (!puzzle || done || step % 2 !== 0) return;
    const id = setTimeout(
      () => {
        const g = new ChessGame(fenAt(puzzle, step));
        const rec = g.play(uciMove(puzzle.moves[step]!));
        if (rec) {
          moveFeedback(rec);
          setLastMove({ from: rec.from, to: rec.to });
        }
        setStep(step + 1);
      },
      step === 0 ? 700 : 450,
    );
    return () => clearTimeout(id);
  });

  const onMove = (m: BoardMove) => {
    if (!puzzle || !solverTurn) return false;
    const expected = uciMove(puzzle.moves[step]!);
    const g = new ChessGame(fen);
    const rec = g.play(m);
    const right =
      (m.from === expected.from && m.to === expected.to) ||
      // Lichess accepts any mate on the last move.
      (!!rec && rec.checkmate && step === puzzle.moves.length - 1);
    if (!right || !rec) {
      wrongFeedback();
      setFailed(true);
      return false;
    }
    moveFeedback(rec);
    setLastMove({ from: rec.from, to: rec.to });
    const next = step + 1;
    setStep(next);
    if (next >= puzzle.moves.length && index) {
      savePuzzle(index.pack.meta.id, puzzle.id, !failed && !showSolution);
      if (!failed && !showSolution) addXp(5);
      successFeedback();
    }
    return true;
  };

  const next = () => {
    const p = pickNext(puzzle?.id);
    setPuzzle(p);
    setStep(0);
    setFailed(false);
    setShowSolution(false);
    setLastMove(null);
  };

  if (!index) return null;
  const solved = all.filter((p) => results[lineKey(index.pack.meta.id, p.id)]?.ok).length;
  const arrows: BoardArrow[] =
    showSolution && solverTurn && puzzle
      ? [{ ...uciMove(puzzle.moves[step]!), color: 'green' }]
      : [];

  const panel = !puzzle ? (
    <PanelCard>
      <ThemedText tone="textMuted">{t('puzzles.none')}</ThemedText>
    </PanelCard>
  ) : (
    <>
      <ThemedText variant="caption" tone="textMuted">
        {t('puzzles.count', { solved, total: all.length })} ·{' '}
        {t('puzzles.rating', { rating: puzzle.rating })}
      </ThemedText>
      <PanelCard tone={done ? 'success' : failed ? 'danger' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          {done ? <CheckCircle2 color={theme.colors.success} size={24} /> : null}
          <ThemedText variant="heading">
            {done
              ? t('puzzles.solved')
              : !solverTurn
                ? t('puzzles.opponent')
                : failed
                  ? t('puzzles.wrong')
                  : t('puzzles.findBest')}
          </ThemedText>
        </View>
      </PanelCard>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Button
          grow
          icon={Eye}
          label={t('puzzles.solution')}
          onPress={() => setShowSolution(true)}
          disabled={done || !solverTurn || showSolution}
        />
        <Button
          grow
          variant={done ? 'primary' : 'secondary'}
          icon={ChevronRight}
          label={t('puzzles.next')}
          onPress={next}
        />
      </View>
    </>
  );

  return (
    <SessionLayout
      title={t('puzzles.title')}
      subtitle={index.pack.meta.title.ru}
      progress={all.length ? solved / all.length : undefined}
      accent={index.pack.meta.accentColor}
      fallbackHref={`/course/${index.pack.meta.id}`}
      board={
        <TrainingBoard
          pieces={pieces}
          orientation={solverColor}
          lastMove={lastMove}
          check={game?.checkedKingSquare ?? null}
          interactive={solverTurn}
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
