import { Switch, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { ThemedText } from './ThemedText';

export interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}

export function ToggleRow({ label, value, onChange, hint }: ToggleRowProps) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
      <View style={{ flex: 1 }}>
        <ThemedText>{label}</ThemedText>
        {hint ? (
          <ThemedText variant="caption" tone="textMuted">
            {hint}
          </ThemedText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: t.colors.border, true: t.colors.accent }}
        thumbColor={t.colors.surface}
      />
    </View>
  );
}
