import { winningChances, type Square } from '@chess-open/core';
import {
  Board,
  Button,
  EvalBar,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, ScrollView, View } from 'react-native';

import { AnalysisCard, type EngineControl } from '@/components/AnalysisCard';
import { useEngine, useEngineAvailable } from '@/hooks/useEngine';
import { MoveTree } from '@/components/MoveTree';
import { useGameTree } from '@/hooks/useGameTree';
import { useHotkeys } from '@/hooks/useHotkeys';
import { moveFeedback, playSound } from '@/services/feedback';
import { useScreenSize } from '@/hooks/useScreenWidth';
import { evalFor } from '@/packs/registry';
import { useSettings } from '@/store/settings';

/** Free board with a move tree (ТЗ «Анализ / свободная доска»). */
export default function BoardScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width, height } = useScreenSize();
  const insets = useSafeAreaInsets();
  const wide = width >= 820;
  const settings = useSettings();
  const engineOn = settings.engineOn;
  const setSetting = settings.set;
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
  const canAnalyse = useEngineAvailable();
  const live = useEngine(tree.fen, engineOn && tree.status === 'playing');
  const evaluation = live?.evaluation ?? evalFor(tree.key);
  const engine: EngineControl | undefined = canAnalyse
    ? {
        on: engineOn,
        onToggle: () => setSetting('engineOn', !engineOn),
        depth: live?.depth,
        line: live?.line,
      }
    : undefined;
  const board = (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      <EvalBar chances={evaluation ? winningChances(evaluation) : null} orientation={orientation} />
      <View style={{ flex: 1 }}>
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
      </View>
    </View>
  );

  const controls = (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing.xxs,
        padding: theme.spacing.xxs + 2,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}>
      <Button
        grow
        compact
        variant="ghost"
        icon={ChevronsLeft}
        accessibilityLabel={t('board.start')}
        onPress={toStart}
        disabled={atStart}
      />
      <Button
        grow
        compact
        variant="ghost"
        icon={ChevronLeft}
        accessibilityLabel={t('board.back')}
        onPress={back}
        disabled={atStart}
      />
      <Button
        grow
        compact
        variant="ghost"
        icon={ChevronRight}
        accessibilityLabel={t('board.forward')}
        onPress={forward}
        disabled={atEnd}
      />
      <Button
        grow
        compact
        variant="ghost"
        icon={ChevronsRight}
        accessibilityLabel={t('board.end')}
        onPress={toEnd}
        disabled={atEnd}
      />
      <Button
        grow
        compact
        variant="ghost"
        icon={ArrowUpDown}
        accessibilityLabel={t('board.flip')}
        onPress={flip}
      />
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
    <Card style={{ gap: theme.spacing.sm, borderRadius: theme.radii.xl }}>
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
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs + 2,
        borderRadius: theme.radii.pill,
        backgroundColor:
          tree.inCheck || tree.status !== 'playing'
            ? `${theme.colors.danger}22`
            : theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: tree.turn === 'w' ? '#F4F4F2' : '#1E1F24',
          borderWidth: 1,
          borderColor: theme.colors.textMuted,
        }}
      />
      <ThemedText variant="label" accessibilityLiveRegion="polite">
        {status}
      </ThemedText>
    </View>
  );

  const titleRow = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <ThemedText variant="title" style={{ flex: 1, fontSize: 26, lineHeight: 32 }}>
        {t('tabs.board')}
      </ThemedText>
      {statusRow}
    </View>
  );

  if (wide) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{
          padding: theme.spacing.xl,
          paddingTop: insets.top + theme.spacing.xl,
          gap: theme.spacing.xl,
          flexDirection: 'row',
          alignItems: 'flex-start',
          maxWidth: 1280,
          width: '100%',
          alignSelf: 'center',
        }}>
        {/* Fit the board into the window: tab bar + paddings ≈ 150 px. */}
        <View style={{ width: Math.max(320, Math.min(760, width * 0.55, height - 150)) }}>
          {board}
        </View>
        <View style={{ flex: 1, gap: theme.spacing.md }}>
          {titleRow}
          {controls}
          {branchBar}
          <AnalysisCard fen={tree.fen} evaluation={evaluation} engine={engine} />
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
      <View
        style={{
          paddingTop: insets.top + theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
          width: '100%',
          maxWidth: 640,
          alignSelf: 'center',
        }}>
        {titleRow}
      </View>
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
        {branchBar}
        <AnalysisCard fen={tree.fen} evaluation={evaluation} engine={engine} />
        {movesCard}
      </View>
    </ScrollView>
  );
}
