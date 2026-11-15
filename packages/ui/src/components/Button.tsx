import { Pressable, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { ThemedText } from './ThemedText';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
  compact?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled,
  accessibilityLabel,
  style,
  compact,
}: ButtonProps) {
  const t = useTheme();
  const bg =
    variant === 'primary'
      ? t.colors.accent
      : variant === 'secondary'
        ? t.colors.surfaceRaised
        : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: compact ? 40 : 44,
          minWidth: compact ? 44 : undefined,
          paddingHorizontal: compact ? t.spacing.md : t.spacing.lg,
          borderRadius: t.radii.md,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: t.colors.border,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}>
      <ThemedText variant="label" tone={variant === 'primary' ? 'onAccent' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
