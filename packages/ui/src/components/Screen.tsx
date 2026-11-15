import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

/** Content never stretches wider than this on desktop web. */
const MAX_CONTENT_WIDTH = 960;

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  contentStyle?: ViewStyle;
}

export function Screen({ children, scroll = true, contentStyle }: ScreenProps) {
  const t = useTheme();
  const inner = [styles.content, { padding: t.spacing.lg, gap: t.spacing.lg }, contentStyle];
  return (
    <View style={[styles.root, { backgroundColor: t.colors.background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner}>{children}</ScrollView>
      ) : (
        <View style={[inner, styles.fill]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  content: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
});
