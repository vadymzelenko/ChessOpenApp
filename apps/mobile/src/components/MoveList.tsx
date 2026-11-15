import type { MoveRecord } from '@chess-open/core';
import { ThemedText, useTheme } from '@chess-open/ui';
import { Pressable, View } from 'react-native';

interface MoveListProps {
  moves: readonly MoveRecord[];
  /** Ply currently shown on the board. */
  cursor: number;
  onSelect: (ply: number) => void;
}

/** Move list in pairs: "1. d4 d5 2. Bf4 …"; tap a move to jump to it. */
export function MoveList({ moves, cursor, onSelect }: MoveListProps) {
  const t = useTheme();
  const rows: { n: number; white?: MoveRecord; black?: MoveRecord }[] = [];
  for (const m of moves) {
    const n = Math.ceil(m.ply / 2);
    if (m.color === 'w' || rows.length === 0) rows.push({ n });
    const row = rows[rows.length - 1]!;
    if (m.color === 'w') row.white = m;
    else row.black = m;
  }

  const cell = (m: MoveRecord | undefined) => {
    if (!m) return <View style={{ flex: 1 }} />;
    const active = m.ply === cursor;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={m.san}
        onPress={() => onSelect(m.ply)}
        style={({ pressed }) => ({
          flex: 1,
          paddingVertical: t.spacing.xs,
          paddingHorizontal: t.spacing.sm,
          borderRadius: t.radii.sm,
          backgroundColor: active
            ? t.colors.accent
            : pressed
              ? t.colors.surfaceRaised
              : 'transparent',
        })}>
        <ThemedText variant="label" tone={active ? 'onAccent' : 'text'}>
          {m.san}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: t.spacing.xxs }}>
      {rows.map((r) => (
        <View key={r.n} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
          <ThemedText variant="label" tone="textMuted" style={{ width: 32 }}>
            {r.n}.
          </ThemedText>
          {cell(r.white)}
          {cell(r.black)}
        </View>
      ))}
    </View>
  );
}
