import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { ThemedText } from './ThemedText';

export interface SectionHeaderProps {
  title: string;
  hint?: string;
}

export function SectionHeader({ title, hint }: SectionHeaderProps) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: t.spacing.sm,
        marginTop: t.spacing.sm,
      }}>
      <ThemedText variant="heading" style={{ fontSize: 19 }}>
        {title}
      </ThemedText>
      {hint ? (
        <ThemedText variant="caption" tone="textMuted">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}
