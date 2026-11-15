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
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CornerUpLeft,
  GitBranch,
  RotateCcw,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, useWindowDimensions, View } from 'react-native';

import { MoveTree } from '@/components/MoveTree';
import { useGameTree } from '@/hooks/useGameTree';
import { useHotkeys } from '@/hooks/useHotkeys';
import { moveFeedback, playSound } from '@/services/feedback';
import { useSettings } from '@/store/settings';

/** Free board with a move tree (ТЗ «Анализ / свободная доска»). */
export default function BoardScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const settings = useSettings();
  const { tree, version, mutate, reset } = useGameTree();
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');

  // `version` changes on every move/navigation; the tree object itself is stable.
  /* eslint-disable react-hooks/exhaustive-deps */
  const pieces = useMemo(() => tree.pieces(), [tree, version]);
  const legalMoves = useCallback((from: Square) => tree.destinations(from), [tree, version]);
  const isPromotion = useCallback(
    (from: Square, to: Square) => tree.isPromotion(from, to),
    [tree, version],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const onMove = useCallback(
    (m: BoardMove) => {
      const record = mutate((tr) => tr.play(m));
      if (!record) return false;
      moveFeedback(record);
      return true;
    },
    [mutate],
  );

  /** Navigation with sound: forward plays the move's sound, backward a soft tick. */
  const navigate = (fn: () => void) => {
    const before = tree.current;
    mutate(fn);
    const now = tree.current;
    if (now === before) return;
    if (now.parent === before && now.move) moveFeedback(now.move);
    else playSound('move');
  };

  const back = () => navigate(() => tree.back());
  const forward = () => navigate(() => tree.forward());
  const toStart = () => navigate(() => tree.toStart());
  const toEnd = () => navigate(() => tree.toEnd());
  const prevVariation = () => navigate(() => tree.switchSibling(-1));
  const nextVariation = () => navigate(() => tree.switchSibling(1));
  const flip = () => setOrientation((o) => (o === 'w' ? 'b' : 'w'));

  useHotkeys({
    ArrowLeft: back,
    ArrowRight: forward,
    ArrowUp: prevVariation,
    ArrowDown: nextVariation,
    Home: toStart,
    End: toEnd,
    f: flip,
  });

  const current = tree.current;
  const atStart = current === tree.root;
  const atEnd = current.children.length === 0;
  const varStart = tree.variationStart(current);

  const status = (() => {
    switch (tree.status) {
      case 'checkmate':
        return tree.turn === 'w' ? t('board.checkmateBlack') : t('board.checkmateWhite');
      case 'stalemate':
        return t('board.stalemate');
      case 'playing':
        return tree.inCheck
          ? t('board.check')
          : tree.turn === 'w'
            ? t('board.whiteToMove')
            : t('board.blackToMove');
      default:
        return t('board.draw');
    }
  })();

  const last = tree.lastMove;
  const board = (
    <Board
      pieces={pieces}
      orientation={orientation}
      lastMove={last ? { from: last.from, to: last.to } : null}
      check={tree.checkedKingSquare}
      legalMoves={legalMoves}
      isPromotion={isPromotion}
      onMove={onMove}
      showCoordinates={settings.showCoordinates}
      showLegalMoves={settings.showLegalMoves}
      moveInput={settings.moveInput}
      autoQueen={settings.autoQueen}
      boardTheme={boardThemes[settings.boardTheme]}
      pieceSet={settings.pieceSet}
    />
  );

  const controls = (
    <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
      <Button
        grow
        compact
        icon={ChevronsLeft}
        accessibilityLabel={t('board.start')}
        onPress={toStart}
        disabled={atStart}
      />
      <Button
        grow
        compact
        icon={ChevronLeft}
        accessibilityLabel={t('board.back')}
        onPress={back}
        disabled={atStart}
      />
      <Button
        grow
        compact
        icon={ChevronRight}
        accessibilityLabel={t('board.forward')}
        onPress={forward}
        disabled={atEnd}
      />
      <Button
        grow
        compact
        icon={ChevronsRight}
        accessibilityLabel={t('board.end')}
        onPress={toEnd}
        disabled={atEnd}
      />
      <Button grow compact icon={ArrowUpDown} accessibilityLabel={t('board.flip')} onPress={flip} />
    </View>
  );

  const branchBar = varStart ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.sm,
        paddingLeft: theme.spacing.md,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.surfaceRaised,
        borderLeftWidth: 3,
        borderLeftColor: theme.colors.accent,
      }}>
      <GitBranch color={theme.colors.accent} size={18} />
      <ThemedText variant="label" style={{ flex: 1 }}>
        {t('board.inVariation')}
      </ThemedText>
      <Button
        compact
        variant="ghost"
        icon={CornerUpLeft}
        accessibilityLabel={t('board.promote')}
        label={wide ? t('board.promote') : undefined}
        onPress={() => mutate((tr) => tr.promoteToMainline(tr.current))}
      />
      <Button
        compact
        variant="ghost"
        icon={Trash2}
        accessibilityLabel={t('board.deleteVariation')}
        onPress={() => mutate((tr) => tr.deleteBranch(varStart))}
      />
    </View>
  ) : null;

  const movesCard = (
    <Card style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ThemedText variant="label" tone="textMuted" style={{ flex: 1 }}>
          {t('board.moves')}
        </ThemedText>
        <Button compact variant="ghost" icon={RotateCcw} label={t('board.reset')} onPress={reset} />
      </View>
      {tree.root.children.length === 0 ? (
        <ThemedText tone="textMuted">{t('board.noMoves')}</ThemedText>
      ) : (
        <MoveTree
          tree={tree}
          version={version}
          onSelect={(node) => navigate(() => tree.goTo(node))}
        />
      )}
    </Card>
  );

  const statusRow = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: tree.turn === 'w' ? '#F4F4F2' : '#1E1F24',
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      />
      <ThemedText variant="heading" accessibilityLiveRegion="polite">
        {status}
      </ThemedText>
    </View>
  );

  if (wide) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{
          padding: theme.spacing.xl,
          gap: theme.spacing.xl,
          flexDirection: 'row',
          alignItems: 'flex-start',
          maxWidth: 1280,
          width: '100%',
          alignSelf: 'center',
        }}>
        <View style={{ width: Math.min(680, width * 0.55) }}>{board}</View>
        <View style={{ flex: 1, gap: theme.spacing.md }}>
          {statusRow}
          {controls}
          {branchBar}
          {movesCard}
          {Platform.OS === 'web' && (
            <ThemedText variant="caption" tone="textMuted">
              {t('board.hotkeys')}
            </ThemedText>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingBottom: theme.spacing.xl }}>
      {/* Edge-to-edge board on phones. */}
      <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center' }}>{board}</View>
      <View
        style={{
          padding: theme.spacing.md,
          gap: theme.spacing.md,
          width: '100%',
          maxWidth: 640,
          alignSelf: 'center',
        }}>
        {controls}
        {statusRow}
        {branchBar}
        {movesCard}
      </View>
    </ScrollView>
  );
}
