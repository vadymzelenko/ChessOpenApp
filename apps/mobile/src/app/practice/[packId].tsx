import {
  ChessGame,
  chooseOpponentMove,
  formatScore,
  practicalChances,
  type ExplorerNode,
  type OpponentMode,
  type Square,
} from '@chess-open/core';
import {
  Button,
  PressableScale,
  ThemedText,
  useTheme,
  type BoardArrow,
  type BoardMove,
} from '@chess-open/ui';
import { useLocalSearchParams } from 'expo-router';
import { Flag, RotateCcw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { PanelCard, SessionLayout } from '@/components/SessionLayout';
import { TrainingBoard } from '@/components/TrainingBoard';
import { usePosition } from '@/hooks/usePosition';
import { usePack } from '@/hooks/usePack';
import { PACK_IDS } from '@/packs/registry';
import { moveFeedback, playSound } from '@/services/feedback';
import { cardId, useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';

export function generateStaticParams(): { packId: string }[] {
  return PACK_IDS.map((packId) => ({ packId }));
}

const MODES: OpponentMode[] = ['realistic', 'hard', 'weak-spots', 'traps', 'rare'];

interface Played {
  san: string;
  ours: boolean;
  /** Our move differed from the course move (shown, not forbidden — ТЗ §6). */
  deviation?: string;
}

/**
 * Live practice (ТЗ §5–6, module 23): the opponent picks moves from Lichess
 * statistics of the chosen rating group and mode; leaving the repertoire is
 * allowed but marked. Without statistics, the opponent plays course moves.
 */
export default function PracticeScreen() {
  const { packId, line } = useLocalSearchParams<{ packId: string; line?: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const index = usePack(packId);
  const level = useSettings((s) => s.opponentLevel);
  const cards = useProgress((s) => s.cards);

  const [mode, setMode] = useState<OpponentMode>('realistic');
  // «Доиграть отсюда»: start from the end of a course line (ТЗ §4).
  const startLine = line && index ? index.lines.get(line) : undefined;
  const initialFen =
    startLine?.steps[startLine.steps.length - 1]?.move.fenAfter ?? index?.startFen ?? '';
  const initialPlayed: Played[] = (startLine?.steps ?? []).map((s) => ({
    san: s.move.san,
    ours: s.ours,
  }));
  const [fen, setFen] = useState(initialFen);
  const [played, setPlayed] = useState<Played[]>(initialPlayed);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  const side = index?.side ?? 'w';
  const game = fen ? new ChessGame(fen) : null;
  const key = game?.key ?? '';
  const ourTurn = !!game && game.turn === side && game.status === 'playing';

  /** The opponent's options here: Lichess statistics, or the course moves as a fallback. */
  const nodeFor = (k: string): { node: ExplorerNode; fromStats: boolean } | null => {
    if (!index) return null;
    const stats = index.pack.explorer[k];
    if (stats && stats.moves.length) return { node: stats, fromStats: true };
    const sans = new Set<string>();
    for (const lineId of index.linesByPosition.get(k) ?? []) {
      for (const s of index.lines.get(lineId)?.steps ?? [])
        if (s.keyBefore === k && !s.ours) sans.add(s.move.san);
    }
    if (sans.size === 0) return null;
    return {
      node: { moves: [...sans].map((san) => ({ san, stats: { [level]: { w: 1, d: 0, l: 0 } } })) },
      fromStats: false,
    };
  };

  const oppOptions = game && !ourTurn && game.status === 'playing' ? nodeFor(key) : null;
  const finished = !!game && (game.status !== 'playing' || (!ourTurn && !oppOptions));
  const { pieces, legalMoves, isPromotion } = usePosition(fen, ourTurn && !finished);

  // Opponent's move.
  useEffect(() => {
    if (!index || !game || ourTurn || finished || !oppOptions) return;
    const id = setTimeout(() => {
      const san = chooseOpponentMove(oppOptions.node, level, mode, {
        side: side === 'w' ? 'b' : 'w',
        evalAfter: (s) => {
          const g = new ChessGame(fen);
          return g.play(s) ? index.pack.evals[g.key] : undefined;
        },
        weakness: (s) => {
          const g = new ChessGame(fen);
          if (!g.play(s)) return 0;
          const c = cards[cardId(index.pack.meta.id, g.key)];
          return c ? c.lapses + (c.state === 'relearning' ? 2 : 0) : 0;
        },
      });
      const g = new ChessGame(fen);
      const rec = san ? g.play(san) : null;
      if (!rec) return;
      moveFeedback(rec);
      setFen(rec.fenAfter);
      setLastMove({ from: rec.from, to: rec.to });
      setPlayed((p) => [...p, { san: rec.san, ours: false }]);
    }, 650);
    return () => clearTimeout(id);
  });

  const onMove = (m: BoardMove) => {
    if (!index || !ourTurn) return false;
    const g = new ChessGame(fen);
    const expected = index.ourMoves.get(g.key);
    const rec = g.play(m);
    if (!rec) return false;
    moveFeedback(rec);
    setFen(rec.fenAfter);
    setLastMove({ from: rec.from, to: rec.to });
    setPlayed((p) => [
      ...p,
      {
        san: rec.san,
        ours: true,
        ...(expected && expected !== rec.san ? { deviation: expected } : {}),
      },
    ]);
    return true;
  };

  const restart = (m: OpponentMode = mode) => {
    setMode(m);
    setFen(initialFen);
    setPlayed(initialPlayed);
    setLastMove(null);
    playSound('move');
  };

  if (!index || !game) return null;
  const lastPlayed = played[played.length - 1];
  const deviations = played.filter((p) => p.deviation).length;
  const lastDeviation = [...played].reverse().find((p) => p.deviation)?.deviation;
  const evalHere = index.pack.evals[key];
  const statsNode = index.pack.explorer[key];
  const chances = statsNode ? practicalChances(statsNode, level) : null;
  const courseMove = index.ourMoves.get(key);
  const arrows: BoardArrow[] = [];

  const chancesBar = chances ? (
    <View style={{ gap: 6 }}>
      <ThemedText variant="caption" tone="textMuted">
        {t('practice.chances')} · {t('practice.statsFrom', { group: t(`settings.level_${level}`) })}
      </ThemedText>
      <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' }}>
        <View style={{ flex: chances.white, backgroundColor: '#F2F2EE' }} />
        <View style={{ flex: chances.draw, backgroundColor: theme.colors.generated }} />
        <View style={{ flex: chances.black, backgroundColor: '#2A2B31' }} />
      </View>
      <ThemedText variant="caption" tone="textMuted">
        {t('practice.white')} {Math.round(chances.white * 100)}% · {t('practice.draw')}{' '}
        {Math.round(chances.draw * 100)}% · {t('practice.black')} {Math.round(chances.black * 100)}%
      </ThemedText>
    </View>
  ) : null;

  const modeChips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.spacing.xs }}>
      {MODES.map((m) => (
        <PressableScale
          key={m}
          accessibilityRole="radio"
          accessibilityState={{ selected: m === mode }}
          accessibilityLabel={t(`practice.mode_${m}`)}
          onPress={() => restart(m)}
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: 7,
            borderRadius: theme.radii.pill,
            backgroundColor: m === mode ? index.pack.meta.accentColor : theme.colors.surface,
            borderWidth: 1,
            borderColor: m === mode ? index.pack.meta.accentColor : theme.colors.border,
          }}>
          <ThemedText variant="label" style={{ color: m === mode ? '#FFFFFF' : theme.colors.text }}>
            {t(`practice.mode_${m}`)}
          </ThemedText>
        </PressableScale>
      ))}
    </ScrollView>
  );

  const panel = (
    <>
      {modeChips}
      {finished ? (
        <PanelCard tone="success">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Flag color={theme.colors.success} size={22} />
            <ThemedText variant="heading">{t('practice.end')}</ThemedText>
          </View>
          <ThemedText tone="textMuted">{t('practice.endHint')}</ThemedText>
          {lastDeviation ? (
            <ThemedText variant="label" tone="danger">
              {t('practice.deviation')} · {t('practice.courseMove', { san: lastDeviation })}
            </ThemedText>
          ) : null}
          <ThemedText variant="label">
            {t('practice.deviations', { count: deviations })}
            {evalHere ? ` · ${t('practice.eval', { score: formatScore(evalHere) })}` : ''}
          </ThemedText>
          <Button
            variant="primary"
            icon={RotateCcw}
            label={t('practice.newGame')}
            onPress={() => restart()}
            style={{ alignSelf: 'flex-start' }}
          />
        </PanelCard>
      ) : (
        <PanelCard tone={lastPlayed?.deviation ? 'danger' : undefined}>
          <ThemedText variant="heading">
            {ourTurn ? t('practice.yourMove') : t('practice.thinking')}
          </ThemedText>
          {lastPlayed?.deviation ? (
            <ThemedText tone="textMuted">
              {t('practice.deviation')} · {t('practice.courseMove', { san: lastPlayed.deviation })}
            </ThemedText>
          ) : lastPlayed?.ours ? (
            <ThemedText variant="label" tone="success">
              ✓ {t('practice.inBook')}
            </ThemedText>
          ) : null}
          {ourTurn && !courseMove ? (
            <ThemedText tone="textMuted">{t('practice.outOfCourse')}</ThemedText>
          ) : null}
          {evalHere ? (
            <ThemedText variant="caption" tone="textMuted">
              {t('practice.eval', { score: formatScore(evalHere) })}
            </ThemedText>
          ) : null}
        </PanelCard>
      )}
      {chancesBar}
      {!statsNode && !finished && Object.keys(index.pack.explorer).length === 0 ? (
        <ThemedText variant="caption" tone="generated">
          ⚙ {t('practice.courseOnly')}
        </ThemedText>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {played.map((p, i) => (
          <ThemedText
            key={i}
            variant="label"
            style={{
              color: p.deviation
                ? theme.colors.danger
                : p.ours
                  ? theme.colors.text
                  : theme.colors.textMuted,
            }}>
            {i % 2 === 0 ? `${i / 2 + 1}. ` : ''}
            {p.san}
          </ThemedText>
        ))}
      </View>
    </>
  );

  return (
    <SessionLayout
      title={t('practice.title')}
      subtitle={index.pack.meta.title.ru}
      accent={index.pack.meta.accentColor}
      fallbackHref={`/course/${index.pack.meta.id}`}
      board={
        <TrainingBoard
          pieces={pieces}
          orientation={side}
          lastMove={lastMove}
          check={game.checkedKingSquare}
          interactive={ourTurn && !finished}
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
