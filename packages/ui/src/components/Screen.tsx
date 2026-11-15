import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import { Appear } from './Appear';
import { ThemedText } from './ThemedText';

/** Content never stretches wider than this on desktop web. */
const MAX_CONTENT_WIDTH = 1040;

export interface ScreenProps {
  children: ReactNode;
  /** Large screen title (the navigator header is hidden in this design). */
  title?: string;
  subtitle?: string;
  /** Element on the right of the title (e.g. an icon button). */
  right?: ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  contentStyle?: ViewStyle;
}

export function Screen({
  children,
  title,
  subtitle,
  right,
  scroll = true,
  contentStyle,
}: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const inner = [
    styles.content,
    {
      paddingHorizontal: t.spacing.lg,
      paddingTop: insets.top + t.spacing.lg,
      paddingBottom: t.spacing.xxl,
      gap: t.spacing.md,
    },
    contentStyle,
  ];
  const header = title ? (
    <Appear index={0}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.md,
          marginBottom: t.spacing.xs,
        }}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText variant="title">{title}</ThemedText>
          {subtitle ? <ThemedText tone="textMuted">{subtitle}</ThemedText> : null}
        </View>
        {right}
      </View>
    </Appear>
  ) : null;
  return (
    <View style={[styles.root, { backgroundColor: t.colors.background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} showsVerticalScrollIndicator={false}>
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[inner, styles.fill]}>
          {header}
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  content: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
});
