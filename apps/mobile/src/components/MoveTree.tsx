import type { GameTree, TreeNode } from '@chess-open/core';
import { ThemedText, useTheme } from '@chess-open/ui';
import { Fragment, memo, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

interface MoveTreeProps {
  tree: GameTree;
  /** Changes whenever the tree changes (GameTree is mutable). */
  version: number;
  onSelect: (node: TreeNode) => void;
}

/**
 * Move tree (Lichess-style analysis view):
 * - the main line is a two-column table "1. d4 d5";
 * - variations appear right after the move they are alternatives to, as
 *   indented blocks with a connector line; nested variations nest further.
 */
function MoveTreeImpl({ tree, onSelect }: MoveTreeProps) {
  const t = useTheme();
  const current = tree.current;
  const startsBlack = tree.root.fen.split(' ')[1] === 'b';
  const moveNo = (ply: number) => Math.ceil((ply + (startsBlack ? 1 : 0)) / 2);
  const isWhite = (ply: number) => (ply + (startsBlack ? 1 : 0)) % 2 === 1;
  /** Variations hanging off `node` (its siblings), if `node` is the main continuation. */
  const variationsAfter = (node: TreeNode): TreeNode[] => {
    const siblings = node.parent?.children ?? [];
    return siblings[0] === node ? siblings.slice(1) : [];
  };

  // --- chips (variation text) -------------------------------------------------
  const chip = (node: TreeNode, withNumber: boolean) => {
    const active = node === current;
    const label = isWhite(node.ply)
      ? `${moveNo(node.ply)}. ${node.move!.san}`
      : withNumber
        ? `${moveNo(node.ply)}… ${node.move!.san}`
        : node.move!.san;
    return (
      <Pressable
        key={node.id}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={() => onSelect(node)}
        style={({ pressed }) => ({
          paddingHorizontal: t.spacing.xs + 2,
          paddingVertical: 3,
          borderRadius: t.radii.sm,
          backgroundColor: active
            ? t.colors.accent
            : pressed
              ? t.colors.surfaceRaised
              : 'transparent',
        })}>
        <ThemedText
          variant="label"
          style={{
            fontFamily: t.typography.family.semibold,
            color: active ? t.colors.onAccent : t.colors.textMuted,
          }}>
          {label}
        </ThemedText>
      </Pressable>
    );
  };

  /** A variation starting at `start`, with nested variations at its forks. */
  const variation = (start: TreeNode, depth: number): ReactNode => {
    const parts: ReactNode[] = [];
    let flow: ReactNode[] = [];
    let needNumber = true;
    const flush = () => {
      if (flow.length) {
        parts.push(
          <View
            key={`f${parts.length}`}
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
            {flow}
          </View>,
        );
        flow = [];
      }
    };
    for (let n: TreeNode | undefined = start; n; n = n.children[0]) {
      flow.push(chip(n, needNumber));
      needNumber = false;
      const alts = n === start ? [] : variationsAfter(n);
      if (alts.length) {
        flush();
        alts.forEach((alt) =>
          parts.push(<Fragment key={alt.id}>{variation(alt, depth + 1)}</Fragment>),
        );
        needNumber = true;
      }
    }
    flush();
    return (
      <View
        key={start.id}
        style={{
          marginLeft: depth === 0 ? t.spacing.xl : t.spacing.md,
          marginVertical: t.spacing.xxs,
          paddingLeft: t.spacing.sm,
          borderLeftWidth: 2,
          borderLeftColor: depth % 2 === 0 ? t.colors.accent : t.colors.generated,
          gap: t.spacing.xxs,
        }}>
        {parts}
      </View>
    );
  };

  // --- main line table ------------------------------------------------------------
  const cell = (node: TreeNode | null, placeholder = false) => {
    if (!node) {
      return (
        <View style={{ flex: 1, paddingHorizontal: t.spacing.sm, paddingVertical: 6 }}>
          {placeholder ? <ThemedText tone="textMuted">…</ThemedText> : null}
        </View>
      );
    }
    const active = node === current;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={node.move!.san}
        accessibilityState={{ selected: active }}
        onPress={() => onSelect(node)}
        style={({ pressed }) => ({
          flex: 1,
          paddingHorizontal: t.spacing.sm,
          paddingVertical: 6,
          borderRadius: t.radii.sm,
          backgroundColor: active
            ? t.colors.accent
            : pressed
              ? t.colors.surfaceRaised
              : 'transparent',
        })}>
        <ThemedText
          style={{
            fontFamily: t.typography.family.bold,
            color: active ? t.colors.onAccent : t.colors.text,
          }}>
          {node.move!.san}
        </ThemedText>
      </Pressable>
    );
  };

  const row = (no: number, white: TreeNode | null, black: TreeNode | null, key: string) => (
    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xxs }}>
      <ThemedText variant="label" tone="textMuted" style={{ width: 34 }}>
        {no}.
      </ThemedText>
      {cell(white, !white)}
      {cell(black)}
    </View>
  );

  const items: ReactNode[] = [];
  const main = tree.mainline();
  for (let i = 0; i < main.length; i++) {
    const node = main[i]!;
    const alts = variationsAfter(node);
    if (isWhite(node.ply)) {
      const next = main[i + 1];
      if (alts.length || !next) {
        items.push(row(moveNo(node.ply), node, null, node.id));
        alts.forEach((a) => items.push(variation(a, 0)));
      } else {
        // White and black on one row; black's variations follow the row.
        items.push(row(moveNo(node.ply), node, next, node.id));
        variationsAfter(next).forEach((a) => items.push(variation(a, 0)));
        i++;
      }
    } else {
      // Black move starting a row (game starts with black, or after white's variations).
      items.push(row(moveNo(node.ply), null, node, node.id));
      alts.forEach((a) => items.push(variation(a, 0)));
    }
  }
  return <View style={{ gap: 2 }}>{items}</View>;
}

/** Re-renders only when the tree version changes. */
export const MoveTree = memo(MoveTreeImpl, (a, b) => a.version === b.version && a.tree === b.tree);
