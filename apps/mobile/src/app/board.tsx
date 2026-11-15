import type { Square } from '@chess-open/core';
import {
  Board,
  Button,
  Card,
  ThemedText,
  boardThemes,
  useTheme,
  type BoardMove,
} from '@chess-open/ui';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, useWindowDimensions, View } from 'react-native';

import { MoveList } from '@/components/MoveList';
import { useChessGame } from '@/hooks/useChessGame';
import { useHotkeys } from '@/hooks/useHotkeys';
import { moveFeedback, playSound } from '@/services/feedback';
import { useSettings } from '@/store/settings';

/** Free board: play both sides, browse history, flip (ТЗ «Анализ / свободная доска»). */
export default function BoardScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const settings = useSettings();
  const { game, version, mutate, reset } = useChessGame();
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');

  // `version` changes on every move/navigation; the game object itself is stable.
  /* eslint-disable react-hooks/exhaustive-deps */
  const pieces = useMemo(() => game.pieces(), [game, version]);
  const legalMoves = useCallback(
    (from: Square) => (game.isAtEnd ? game.destinations(from) : []),
    [game, version],
  );
  const isPromotion = useCallback(
    (from: Square, to: Square) => game.isPromotion(from, to),
    [game, version],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const onMove = useCallback(
    (m: BoardMove) => {
      const record = mutate((g) => g.play(m));
      if (!record) return false;
      moveFeedback(record);
      return true;
    },
    [mutate],
  );

  const navigate = useCallback(
    (fn: () => void) => {
      const before = game.cursor;
      mutate(fn);
      if (game.cursor > before && game.lastMove) moveFeedback(game.lastMove);
      else if (game.cursor !== before) playSound('move');
    },
    [game, mutate],
  );

  const back = () => navigate(() => game.back());
  const forward = () => navigate(() => game.forward());
  const toStart = () => navigate(() => game.toStart());
  const toEnd = () => navigate(() => game.toEnd());
  const flip = () => setOrientation((o) => (o === 'w' ? 'b' : 'w'));
  const undo = () => {
    if (!game.isAtEnd) return;
    mutate((g) => g.undo());
  };

  useHotkeys({
    ArrowLeft: back,
    ArrowRight: forward,
    Home: toStart,
    End: toEnd,
    f: flip,
    z: undo,
  });

  const status = (() => {
    if (!game.isAtEnd) return t('board.browsing');
    switch (game.status) {
      case 'checkmate':
        return game.turn === 'w' ? t('board.checkmateBlack') : t('board.checkmateWhite');
      case 'stalemate':
        return t('board.stalemate');
      case 'playing':
        return game.inCheck
          ? t('board.check')
          : game.turn === 'w'
            ? t('board.whiteToMove')
            : t('board.blackToMove');
      default:
        return t('board.draw');
    }
  })();

  const last = game.lastMove;
  const boardEl = (
    <Board
      pieces={pieces}
      orientation={orientation}
      lastMove={last ? { from: last.from, to: last.to } : null}
      check={game.checkedKingSquare}
      legalMoves={legalMoves}
      isPromotion={isPromotion}
      onMove={onMove}
      showCoordinates={settings.showCoordinates}
      showLegalMoves={settings.showLegalMoves}
      moveInput={settings.moveInput}
      autoQueen={settings.autoQueen}
      boardTheme={boardThemes[settings.boardTheme]}
    />
  );

  const controls = (
    <View style={{ flexDirection: 'row', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
      <Button
        compact
        label="⏮"
        accessibilityLabel={t('board.start')}
        onPress={toStart}
        disabled={game.cursor === 0}
      />
      <Button
        compact
        label="◀"
        accessibilityLabel={t('board.back')}
        onPress={back}
        disabled={game.cursor === 0}
      />
      <Button
        compact
        label="▶"
        accessibilityLabel={t('board.forward')}
        onPress={forward}
        disabled={game.isAtEnd}
      />
      <Button
        compact
        label="⏭"
        accessibilityLabel={t('board.end')}
        onPress={toEnd}
        disabled={game.isAtEnd}
      />
      <Button compact label="⇅" accessibilityLabel={t('board.flip')} onPress={flip} />
      <Button
        compact
        label="↶"
        accessibilityLabel={t('board.undo')}
        onPress={undo}
        disabled={!game.isAtEnd || game.length === 0}
      />
    </View>
  );

  const panel = (
    <View style={{ gap: theme.spacing.md, flex: wide ? 1 : undefined }}>
      <ThemedText variant="heading" accessibilityLiveRegion="polite">
        {status}
      </ThemedText>
      {controls}
      {!game.isAtEnd && (
        <Button
          variant="primary"
          label={t('board.playFromHere')}
          onPress={() => mutate((g) => g.truncateToCursor())}
          style={{ alignSelf: 'flex-start' }}
        />
      )}
      <Card>
        <ThemedText variant="label" tone="textMuted">
          {t('board.moves')}
        </ThemedText>
        {game.length === 0 ? (
          <ThemedText tone="textMuted">{t('board.noMoves')}</ThemedText>
        ) : (
          <MoveList
            moves={game.history}
            cursor={game.cursor}
            onSelect={(ply) => navigate(() => game.goTo(ply))}
          />
        )}
      </Card>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Button label={t('board.reset')} onPress={reset} />
      </View>
      {Platform.OS === 'web' && (
        <ThemedText variant="caption" tone="textMuted">
          {t('board.hotkeys')}
        </ThemedText>
      )}
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        padding: wide ? theme.spacing.xl : theme.spacing.md,
        gap: theme.spacing.lg,
        flexDirection: wide ? 'row' : 'column',
        alignItems: 'flex-start',
        maxWidth: 1200,
        width: '100%',
        alignSelf: 'center',
      }}>
      <View
        style={{
          width: wide ? Math.min(640, width * 0.55) : '100%',
          maxWidth: 640,
          alignSelf: 'center',
        }}>
        {boardEl}
      </View>
      <View style={{ width: wide ? undefined : '100%', flex: wide ? 1 : undefined }}>{panel}</View>
    </ScrollView>
  );
}
