import { Pressable, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { ThemedText } from './ThemedText';

export interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Accessibility label for the whole group. */
  accessibilityLabel?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        backgroundColor: t.colors.background,
        borderRadius: t.radii.md,
        padding: t.spacing.xxs,
        gap: t.spacing.xxs,
      }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              paddingVertical: t.spacing.sm,
              paddingHorizontal: t.spacing.md,
              borderRadius: t.radii.sm,
              backgroundColor: selected ? t.colors.accent : 'transparent',
              opacity: pressed ? 0.75 : 1,
            })}>
            <ThemedText variant="label" tone={selected ? 'onAccent' : 'textMuted'}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
