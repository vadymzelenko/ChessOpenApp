import { ThemedText, useTheme } from '@chess-open/ui';
import type { ReactNode } from 'react';
import type { TextStyle } from 'react-native';

// Moves (with a piece letter, captures, castling, numbered) and squares.
const TOKEN =
  /((?:\d+\s*\.(?:\s*\.\.)?\s*|…\s*)?(?:O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h]x[a-h][1-8][+#]?|\d+\s*\.\s*[a-h][1-8]|…\s*[a-h][1-8]))|(\b[a-h][1-8](?:[–-][a-h][1-8])*\b)/g;

/**
 * Course comment with moves and squares picked out, so the eye finds them
 * quickly (larger type and line height for reading).
 */
export function RichComment({ text, style }: { text: string; style?: TextStyle }) {
  const theme = useTheme();
  const parts: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    if (m[1])
      parts.push(
        <ThemedText
          key={i++}
          style={{ color: theme.colors.accent, fontFamily: theme.typography.family.bold }}>
          {m[1]}
        </ThemedText>,
      );
    else
      parts.push(
        <ThemedText key={i++} style={{ fontFamily: theme.typography.family.bold }}>
          {m[2]}
        </ThemedText>,
      );
    last = at + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <ThemedText style={[{ fontSize: 17, lineHeight: 27, letterSpacing: 0.1 }, style]}>
      {parts}
    </ThemedText>
  );
}
