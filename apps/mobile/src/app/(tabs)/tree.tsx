import {
  ChessGame,
  childrenAt,
  moveShares,
  courseLevels,
  levelOfPosition,
  repertoireTree,
  type Idea,
  type MoveAnnotation,
  type RepertoireNode,
  type SrsCard,
} from '@chess-open/core';
import {
  Board,
  Button,
  PressableScale,
  ThemedText,
  boardThemes,
  useTheme,
  type BoardArrow,
  type BoardHighlight,
} from '@chess-open/ui';
import { router } from 'expo-router';
import { ChevronLeft, GitBranch, Lightbulb, Play, RotateCcw, Swords } from 'lucide-react-native';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IdeaSheet } from '@/components/IdeaSheet';
import { useHotkeys } from '@/hooks/useHotkeys';
import { usePack } from '@/hooks/usePack';
import { useScreenSize } from '@/hooks/useScreenWidth';
import { moveFeedback, playSound } from '@/services/feedback';
import { cardId, useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';

const PACK = 'london';

type Tone = 'new' | 'learning' | 'learned' | 'forgotten';
const toneOf = (c: SrsCard | undefined): Tone =>
  !c || c.state === 'new'
    ? 'new'
    : c.state === 'review'
      ? 'learned'
      : c.state === 'relearning'
        ? 'forgotten'
        : 'learning';

const label = (ply: number, san: string, withNumber = true) => {
  const no = Math.ceil(ply / 2);
  if (ply % 2 === 1) return `${no}. ${san}`;
  return withNumber ? `${no}… ${san}` : san;
};

/**
 * Repertoire tree (the «what do I play against…» screen): walk the course as
 * one tree. On the opponent's turn every reply from the course is listed with
 * how often it is played and our answer; tap it to see the answer on the board
 * with its explanation. Below, the whole branch graph from the current position.
 */
export default function TreeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useScreenSize();
  const wide = width >= 860;
  const settings = useSettings();
  const cards = useProgress((s) => s.cards);
  const index = usePack(PACK);
  const roots = useMemo(() => (index ? repertoireTree(index) : []), [index]);
  const levels = useMemo(() => (index ? courseLevels(index) : []), [index]);
  const [path, setPath] = useState<string[]>([]);
  const [idea, setIdea] = useState<Idea | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );

  const game = useMemo(() => {
    const g = new ChessGame(index?.startFen);
    for (const san of path) g.play(san);
    return g;
  }, [index, path]);
  const pieces = useMemo(() => game.pieces(), [game]);

  const go = (next: string[]) => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
    setPath(next);
  };
  const back = () => {
    if (!path.length) return;
    playSound('move');
    // Step back over our answer and the reply together, to the opponent's choice.
    const n = path.length >= 2 && game.turn !== index?.side ? 2 : 1;
    go(path.slice(0, Math.max(0, path.length - n)));
  };
  useHotkeys({ ArrowLeft: back });

  if (!index) return null;
  const meta = index.pack.meta;
  const kids = childrenAt(roots, path) ?? [];
  const lastNode = path.length
    ? (childrenAt(roots, path.slice(0, -1)) ?? []).find((n) => n.san === path[path.length - 1])
    : undefined;
  const annotationOf = (n: RepertoireNode | undefined): MoveAnnotation | undefined =>
    n ? index.lines.get(n.lineIds[0]!)?.steps[n.ply - 1]?.annotation : undefined;
  const ourTurn = game.turn === index.side;
  const ourMove = ourTurn ? kids[0] : undefined;
  const shares = moveShares(index.pack.explorer[game.key]);
  const replies = ourTurn
    ? []
    : [...kids].sort((a, b) => (shares.get(b.san) ?? 0) - (shares.get(a.san) ?? 0));
  const last = game.lastMove;

  /** Play a move (and, for an opponent reply, our answer a moment later). */
  const play = (node: RepertoireNode) => {
    const g = new ChessGame(game.fen);
    const rec = g.play(node.san);
    if (rec) moveFeedback(rec);
    const next = [...path, node.san];
    go(next);
    const answer = node.ours ? undefined : node.children[0];
    if (!answer) return;
    const delay = theme.durations.move > 0 ? theme.durations.move + 450 : 0;
    const playAnswer = () => {
      const rec2 = g.play(answer.san);
      if (rec2) moveFeedback(rec2);
      setPath([...next, answer.san]);
      pending.current = null;
    };
    if (delay === 0) playAnswer();
    else pending.current = setTimeout(playAnswer, delay);
  };

  // Board drawings: the course arrows of the last move, and our answer in green.
  const arrows: BoardArrow[] = [...(annotationOf(lastNode)?.arrows ?? [])];
  const highlights: BoardHighlight[] = [...(annotationOf(lastNode)?.highlights ?? [])];
  if (ourMove) {
    const rec = new ChessGame(game.fen).play(ourMove.san);
    if (rec && !arrows.some((a) => a.from === rec.from && a.to === rec.to))
      arrows.push({ from: rec.from, to: rec.to, color: 'green' });
  }

  const toneColor: Record<Tone, string> = {
    new: theme.colors.textMuted,
    learning: theme.colors.warning,
    learned: theme.colors.success,
    forgotten: theme.colors.danger,
  };
  const dot = (n: RepertoireNode) =>
    n.ours ? (
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: toneColor[toneOf(cards[cardId(meta.id, n.keyBefore)])],
        }}
      />
    ) : null;

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
            paddingVertical: 5,
            borderRadius: theme.radii.pill,
            backgroundColor: `${theme.colors.verified}22`,
          }}>
          <Lightbulb color={theme.colors.verified} size={15} />
          <ThemedText variant="caption" style={{ color: theme.colors.verified }}>
            {i.title.ru}
          </ThemedText>
        </PressableScale>
      ));

  const card = (children: ReactNode, accent?: string) => (
    <View
      style={{
        padding: theme.spacing.lg,
        gap: theme.spacing.sm,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: accent ?? theme.colors.border,
      }}>
      {children}
    </View>
  );

  // --- the move the user is looking at -------------------------------------------------
  const lastAnnotation = annotationOf(lastNode);
  const current = card(
    <>
      <ThemedText variant="label" tone="textMuted">
        {lastNode ? label(lastNode.ply, lastNode.san) : t('tree.start')}
      </ThemedText>
      <ThemedText style={{ fontSize: 16, lineHeight: 24 }}>
        {lastNode ? (lastAnnotation?.comment?.ru ?? t('tree.noComment')) : t('tree.intro')}
      </ThemedText>
      {lastAnnotation?.ideas?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {ideaChips(lastAnnotation.ideas)}
        </View>
      ) : null}
    </>,
  );

  // --- what to do next ----------------------------------------------------------------
  const answerRow = (reply: RepertoireNode) => {
    const answer = reply.children[0];
    const share = shares.get(reply.san);
    const comment = annotationOf(answer)?.comment?.ru;
    return (
      <PressableScale
        key={reply.san}
        accessibilityRole="button"
        accessibilityLabel={`${label(reply.ply, reply.san)} → ${answer ? label(answer.ply, answer.san) : ''}`}
        onPress={() => play(reply)}
        style={{
          gap: 4,
          padding: theme.spacing.md,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surfaceRaised,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <ThemedText variant="label" style={{ fontSize: 16, minWidth: 64 }}>
            {label(reply.ply, reply.san)}
          </ThemedText>
          {share !== undefined ? (
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 1,
                borderRadius: theme.radii.pill,
                backgroundColor: theme.colors.surface,
              }}>
              <ThemedText variant="caption" tone="textMuted">
                {Math.round(share * 100)}%
              </ThemedText>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {answer ? (
            <>
              {dot(answer)}
              <ThemedText variant="label" tone="accent" style={{ fontSize: 16 }}>
                {label(answer.ply, answer.san)}
              </ThemedText>
            </>
          ) : (
            <ThemedText variant="caption" tone="textMuted">
              {t('tree.lineEnds')}
            </ThemedText>
          )}
        </View>
        {comment ? (
          <ThemedText variant="caption" tone="textMuted" numberOfLines={2}>
            {comment}
          </ThemedText>
        ) : null}
      </PressableScale>
    );
  };

  const lineId = (lastNode ?? kids[0])?.lineIds[0];
  // A move-order line ends where it joins another level: point there.
  const joined = kids.length === 0 ? levelOfPosition(index, levels, game.key) : undefined;
  const continues = joined && !lastNode?.lineIds.includes(joined.lineId) ? joined : undefined;
  const nextPanel =
    kids.length === 0
      ? card(
          <>
            <ThemedText variant="heading">{t('tree.endTitle')}</ThemedText>
            {continues ? (
              <>
                <ThemedText tone="textMuted">
                  {t('levels.continuesIn', { n: continues.n, title: continues.title.ru })}
                </ThemedText>
                <Button
                  variant="primary"
                  icon={Play}
                  label={t('levels.openLevel', { n: continues.n })}
                  onPress={() => router.push(`/line/${meta.id}/${continues.lineId}`)}
                  style={{ alignSelf: 'flex-start' }}
                />
              </>
            ) : (
              <ThemedText tone="textMuted">{t('tree.endText')}</ThemedText>
            )}
          </>,
        )
      : ourTurn && ourMove
        ? card(
            <>
              <ThemedText variant="label" tone="textMuted">
                {t('tree.ourMove')}
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                {dot(ourMove)}
                <ThemedText variant="heading" tone="accent">
                  {label(ourMove.ply, ourMove.san)}
                </ThemedText>
              </View>
              {annotationOf(ourMove)?.comment?.ru ? (
                <ThemedText style={{ lineHeight: 22 }}>
                  {annotationOf(ourMove)!.comment!.ru}
                </ThemedText>
              ) : null}
              <Button
                variant="primary"
                icon={Play}
                label={t('tree.playMove')}
                onPress={() => play(ourMove)}
                style={{ alignSelf: 'flex-start' }}
              />
            </>,
            theme.colors.accent,
          )
        : card(
            <>
              <ThemedText variant="label" tone="textMuted">
                {t('tree.opponentReplies', { count: replies.length })}
              </ThemedText>
              <View style={{ gap: theme.spacing.xs }}>{replies.map(answerRow)}</View>
            </>,
          );

  // --- move strip ---------------------------------------------------------------------
  const strip = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <Button
        icon={RotateCcw}
        accessibilityLabel={t('tree.toStart')}
        onPress={() => go([])}
        disabled={!path.length}
        compact
      />
      <Button
        icon={ChevronLeft}
        accessibilityLabel={t('line.prev')}
        onPress={back}
        disabled={!path.length}
        compact
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
          {path.length === 0 ? (
            <ThemedText variant="caption" tone="textMuted">
              {t('tree.tapReply')}
            </ThemedText>
          ) : (
            path.map((san, i) => (
              <PressableScale
                key={`${i}${san}`}
                accessibilityRole="button"
                accessibilityLabel={label(i + 1, san)}
                onPress={() => go(path.slice(0, i + 1))}
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: theme.radii.sm,
                  backgroundColor: i === path.length - 1 ? theme.colors.accent : 'transparent',
                }}>
                <ThemedText
                  variant="label"
                  style={{
                    color: i === path.length - 1 ? theme.colors.onAccent : theme.colors.text,
                  }}>
                  {label(i + 1, san, false)}
                </ThemedText>
              </PressableScale>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );

  // --- branch graph (Lichess-style: the main line flows, alternatives indent) ----------
  const chip = (n: RepertoireNode, nodePath: string[], withNumber: boolean) => (
    <PressableScale
      key={nodePath.join(' ')}
      accessibilityRole="button"
      accessibilityLabel={label(n.ply, n.san)}
      onPress={() => go(nodePath)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: theme.radii.sm,
        backgroundColor: n.ours ? theme.colors.surfaceRaised : 'transparent',
      }}>
      {dot(n)}
      <ThemedText
        variant="label"
        style={{
          color: n.ours ? theme.colors.text : theme.colors.textMuted,
          fontFamily: theme.typography.family.semibold,
        }}>
        {label(n.ply, n.san, withNumber)}
      </ThemedText>
    </PressableScale>
  );
  const branch = (start: RepertoireNode, startPath: string[], depth: number): ReactNode => {
    const parts: ReactNode[] = [];
    let flow: ReactNode[] = [];
    let n: RepertoireNode | undefined = start;
    let p = startPath;
    let withNumber = true;
    const flush = () => {
      if (flow.length) {
        parts.push(
          <View key={`f${parts.length}`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
            {flow}
          </View>,
        );
        flow = [];
      }
    };
    while (n) {
      flow.push(chip(n, p, withNumber));
      withNumber = false;
      const alts: RepertoireNode[] = n.children.slice(1);
      if (alts.length) {
        flush();
        for (const alt of alts)
          parts.push(
            <Fragment key={[...p, alt.san].join(' ')}>
              {branch(alt, [...p, alt.san], depth + 1)}
            </Fragment>,
          );
        withNumber = true;
      }
      const main: RepertoireNode | undefined = n.children[0];
      n = main;
      if (main) p = [...p, main.san];
    }
    flush();
    return (
      <View
        style={{
          marginLeft: depth === 0 ? 0 : theme.spacing.sm,
          paddingLeft: depth === 0 ? 0 : theme.spacing.sm,
          borderLeftWidth: depth === 0 ? 0 : 2,
          borderLeftColor: depth % 2 === 1 ? theme.colors.accent : theme.colors.generated,
          gap: 3,
          marginVertical: depth === 0 ? 0 : 2,
        }}>
        {parts}
      </View>
    );
  };
  const graph = kids.length
    ? card(
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <GitBranch color={theme.colors.accent} size={18} />
            <ThemedText variant="label" tone="textMuted" style={{ flex: 1 }}>
              {path.length ? t('tree.graphFromHere') : t('tree.graph')}
            </ThemedText>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
            {(['new', 'learning', 'learned', 'forgotten'] as const).map((tone) => (
              <View key={tone} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: toneColor[tone] }}
                />
                <ThemedText variant="caption" tone="textMuted">
                  {t(`tree.tone_${tone}`)}
                </ThemedText>
              </View>
            ))}
          </View>
          {kids.map((k) => (
            <Fragment key={k.san}>{branch(k, [...path, k.san], kids.length > 1 ? 1 : 0)}</Fragment>
          ))}
        </>,
      )
    : null;

  const train = lineId ? (
    <Button
      icon={Swords}
      label={t('tree.trainLine')}
      onPress={() => router.push(`/line/${meta.id}/${lineId}`)}
      style={{ alignSelf: 'flex-start' }}
    />
  ) : null;

  const board = (
    <Board
      pieces={pieces}
      orientation={index.side}
      lastMove={last ? { from: last.from, to: last.to } : null}
      check={game.checkedKingSquare}
      arrows={arrows}
      highlights={highlights}
      showCoordinates={settings.showCoordinates}
      boardTheme={boardThemes[settings.boardTheme]}
      pieceSet={settings.pieceSet}
      disabled
    />
  );
  const header = (
    <View style={{ gap: 2 }}>
      <ThemedText variant="title">{t('tree.title')}</ThemedText>
      <ThemedText tone="textMuted">{meta.title.ru}</ThemedText>
    </View>
  );
  const panel = (
    <View style={{ gap: theme.spacing.md }}>
      {strip}
      {current}
      {nextPanel}
      {train}
      {graph}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {wide ? (
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            gap: theme.spacing.xl,
            padding: theme.spacing.xl,
            paddingTop: insets.top + theme.spacing.xl,
            maxWidth: 1280,
            width: '100%',
            alignSelf: 'center',
          }}>
          {/* Board stays in place while the panel scrolls. */}
          <View style={{ width: Math.max(320, Math.min(680, width * 0.5, height - 150)) }}>
            {board}
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: theme.spacing.lg }}>
            {header}
            {panel}
          </ScrollView>
        </View>
      ) : (
        <>
          <View
            style={{
              paddingTop: insets.top + theme.spacing.md,
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.sm,
            }}>
            {header}
          </View>
          <ScrollView
            stickyHeaderIndices={[0]}
            contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}>
            {/* Sticky: the board stays visible while scrolling the replies and the graph. */}
            <View style={{ backgroundColor: theme.colors.background }}>
              <View style={{ width: '100%', maxWidth: 520, alignSelf: 'center' }}>{board}</View>
            </View>
            <View
              style={{
                padding: theme.spacing.lg,
                width: '100%',
                maxWidth: 640,
                alignSelf: 'center',
              }}>
              {panel}
            </View>
          </ScrollView>
        </>
      )}
      <IdeaSheet idea={idea} onClose={() => setIdea(null)} />
    </View>
  );
}
