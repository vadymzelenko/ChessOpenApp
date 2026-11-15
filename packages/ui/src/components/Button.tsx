import type { ComponentType } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { ThemedText } from './ThemedText';

/** Any icon component with lucide-like props (lucide-react-native fits). */
export type IconComponent = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

export interface ButtonProps {
  label?: string;
  icon?: IconComponent;
  onPress: () => void;
  /** `inverse`: white button for coloured / gradient backgrounds. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse';
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
  compact?: boolean;
  /** Stretch to the available width (flex: 1). */
  grow?: boolean;
}

export function Button({
  label,
  icon: Icon,
  onPress,
  variant = 'secondary',
  disabled,
  accessibilityLabel,
  style,
  compact,
  grow,
}: ButtonProps) {
  const t = useTheme();
  const bg =
    variant === 'primary'
      ? t.colors.accent
      : variant === 'inverse'
        ? '#FFFFFF'
        : variant === 'secondary'
          ? t.colors.surfaceRaised
          : 'transparent';
  const fg =
    variant === 'primary'
      ? t.colors.onAccent
      : variant === 'inverse'
        ? '#14161C'
        : variant === 'danger'
          ? t.colors.danger
          : t.colors.text;
  const iconOnly = !label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={iconOnly ? 4 : undefined}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: t.spacing.sm,
          minHeight: compact ? 40 : 46,
          minWidth: iconOnly ? (compact ? 44 : 48) : undefined,
          paddingHorizontal: iconOnly ? t.spacing.sm : compact ? t.spacing.md : t.spacing.lg,
          borderRadius: t.radii.md,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: t.colors.border,
          opacity: disabled ? 0.35 : pressed ? 0.7 : hovered ? 0.88 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
        grow ? { flex: 1 } : null,
        style,
      ]}>
      {Icon ? (
        <View pointerEvents="none">
          <Icon color={fg} size={compact ? 20 : 22} strokeWidth={2.25} />
        </View>
      ) : null}
      {label ? (
        <ThemedText variant="label" style={{ color: fg }}>
          {label}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}
