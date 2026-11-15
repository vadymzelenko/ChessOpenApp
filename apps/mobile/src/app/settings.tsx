import {
  Card,
  Screen,
  SegmentedControl,
  ThemedText,
  useTheme,
  type AnimationSpeed,
  type ColorTokens,
  type ThemePreference,
} from '@chess-open/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useSettings } from '@/store/settings';

const SWATCHES: (keyof ColorTokens)[] = [
  'background',
  'surface',
  'surfaceRaised',
  'border',
  'text',
  'textMuted',
  'accent',
  'success',
  'warning',
  'danger',
  'verified',
  'generated',
];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { theme: themePref, animationSpeed, setTheme, setAnimationSpeed } = useSettings();

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t('settings.themeSystem') },
    { value: 'dark', label: t('settings.themeDark') },
    { value: 'light', label: t('settings.themeLight') },
  ];
  const speedOptions: { value: AnimationSpeed; label: string }[] = [
    { value: 'fast', label: t('settings.animationsFast') },
    { value: 'normal', label: t('settings.animationsNormal') },
    { value: 'off', label: t('settings.animationsOff') },
  ];

  return (
    <Screen>
      <Card>
        <ThemedText variant="heading">{t('settings.appearance')}</ThemedText>

        <ThemedText variant="label" tone="textMuted">
          {t('settings.theme')}
        </ThemedText>
        <SegmentedControl
          accessibilityLabel={t('settings.theme')}
          options={themeOptions}
          value={themePref}
          onChange={setTheme}
        />

        <ThemedText variant="label" tone="textMuted" style={{ marginTop: theme.spacing.sm }}>
          {t('settings.animations')}
        </ThemedText>
        <SegmentedControl
          accessibilityLabel={t('settings.animations')}
          options={speedOptions}
          value={animationSpeed}
          onChange={setAnimationSpeed}
        />
        <ThemedText variant="caption" tone="textMuted">
          {t('settings.reduceMotionNote')}
        </ThemedText>
      </Card>

      <Card>
        <ThemedText variant="label" tone="textMuted">
          {t('settings.palette')}
        </ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {SWATCHES.map((key) => (
            <View key={key} style={{ alignItems: 'center', width: 72, gap: theme.spacing.xs }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: theme.radii.md,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors[key],
                }}
              />
              <ThemedText variant="caption" tone="textMuted" numberOfLines={1}>
                {key}
              </ThemedText>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
