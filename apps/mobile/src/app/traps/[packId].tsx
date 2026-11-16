import { ChessGame, type Square } from '@chess-open/core';
import {
  Button,
  ThemedText,
  useTheme,
  type BoardArrow,
  type BoardHighlight,
  type BoardMove,
} from '@chess-open/ui';
import { useLocalSearchParams } from 'expo-router';
import { ChevronRight, RotateCcw, Skull } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { PanelCard, SessionLayout } from '@/components/SessionLayout';
import { TrainingBoard } from '@/components/TrainingBoard';
import { usePack } from '@/hooks/usePack';
import { usePosition } from '@/hooks/usePosition';
import { PACK_IDS } from '@/packs/registry';
import { moveFeedback, successFeedback, wrongFeedback } from '@/services/feedback';

export function generateStaticParams(): { packId: string }[] {
  return PACK_IDS.map((packId) => ({ packId }));
}

/**
 * Traps (ТЗ §6 «Ловушки», module 26): the line is played up to the
 * opponent's mistake; then the user must find the punishing move
 * (for «against» traps the scenario is shown with the explanation).
 */
export default function TrapsScreen() {
  const { packId } = useLocalSearchParams<{ packId: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const index = usePack(packId);
  const traps = index?.pack.traps ?? [];
  const [trapIdx, setTrapIdx] = useState(0);
  const [ply, setPly] = useState(0);
  const [wrong, setWrong] = useState(false);

  const trap = traps[trapIdx];
  const games = (n: number) =>
    trap ? ChessGame.fromSan(trap.moves.slice(0, n), index?.startFen) : null;
  const g = games(ply);
  const fen = g?.fen ?? '';
  // Punishing move: the move right after the mistake, when it is ours.
  const punishPly =
    trap && trap.kind === 'for' && trap.mistakePly < trap.moves.length ? trap.mistakePly : null;
  const autoUntil = punishPly ?? trap?.moves.length ?? 0;
  const userTurn = punishPly !== null && ply === punishPly;
  const done = !!trap && ply >= trap.moves.length;
  const { game, pieces, legalMoves, isPromotion } = usePosition(fen, userTurn);
  const last =
    ply > 0 && trap ? ChessGame.fromSan(trap.moves.slice(0, ply), index?.startFen).lastMove : null;

  useEffect(() => {
    if (!trap || ply >= autoUntil) return;
    const id = setTimeout(
      () => {
        const rec = games(ply + 1)?.lastMove;
        if (rec) moveFeedback(rec);
        setPly(ply + 1);
      },
      ply === 0 ? 500 : 650,
    );
    return () => clearTimeout(id);
  });

  const onMove = (m: BoardMove) => {
    if (!trap || !userTurn) return false;
    const expected = games(ply + 1)?.lastMove;
    if (!expected || m.from !== expected.from || m.to !== expected.to) {
      wrongFeedback();
      setWrong(true);
      return false;
    }
    moveFeedback(expected);
    setPly(ply + 1);
    successFeedback();
    return true;
  };

  const go = (i: number) => {
    setTrapIdx(i);
    setPly(0);
    setWrong(false);
  };

  if (!index) return null;
  const mistake = trap
    ? ChessGame.fromSan(trap.moves.slice(0, trap.mistakePly), index.startFen).lastMove
    : null;
  const highlights: BoardHighlight[] =
    mistake && ply >= trap!.mistakePly ? [{ square: mistake.to as Square, color: 'red' }] : [];
  const arrows: BoardArrow[] = [];

  const panel = !trap ? (
    <PanelCard>
      <ThemedText tone="textMuted">{t('traps.none')}</ThemedText>
    </PanelCard>
  ) : (
    <>
      <ThemedText variant="caption" tone="textMuted">
        {trapIdx + 1} / {traps.length} · {trap.kind === 'for' ? t('traps.for') : t('traps.against')}
      </ThemedText>
      <PanelCard tone={done ? 'success' : wrong ? 'danger' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Skull color={theme.colors.danger} size={22} />
          <ThemedText variant="heading" style={{ flex: 1 }}>
            {trap.title.ru}
          </ThemedText>
        </View>
        <ThemedText variant="label" tone={userTurn ? 'accent' : 'textMuted'}>
          {done ? t('traps.done') : userTurn ? t('traps.punish') : t('traps.watch')}
        </ThemedText>
        {mistake && ply >= trap.mistakePly ? (
          <ThemedText variant="caption" tone="danger">
            {t('traps.mistake')}: {mistake.san}
          </ThemedText>
        ) : null}
        {done || (wrong && userTurn) ? (
          <ThemedText style={{ lineHeight: 24 }}>{trap.explanation.ru}</ThemedText>
        ) : null}
      </PanelCard>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Button grow icon={RotateCcw} label={t('line.again')} onPress={() => go(trapIdx)} />
        <Button
          grow
          variant={done ? 'primary' : 'secondary'}
          icon={ChevronRight}
          label={t('traps.next')}
          onPress={() => go((trapIdx + 1) % traps.length)}
          disabled={traps.length < 2}
        />
      </View>
    </>
  );

  return (
    <SessionLayout
      title={t('traps.title')}
      subtitle={index.pack.meta.title.ru}
      accent={index.pack.meta.accentColor}
      fallbackHref={`/course/${index.pack.meta.id}`}
      board={
        <TrainingBoard
          pieces={pieces}
          orientation={index.side}
          lastMove={last ? { from: last.from, to: last.to } : null}
          check={game?.checkedKingSquare ?? null}
          interactive={userTurn}
          legalMoves={legalMoves}
          isPromotion={isPromotion}
          onMove={onMove}
          arrows={arrows}
          highlights={highlights}
        />
      }
      panel={panel}
    />
  );
}
