import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

export interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.surface,
          borderColor: t.colors.border,
          borderWidth: 1,
          borderRadius: t.radii.lg,
          padding: t.spacing.lg,
          gap: t.spacing.sm,
        },
        style,
      ]}>
      {children}
    </View>
  );
}
