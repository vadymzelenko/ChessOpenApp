import {
  BOARD_THEME_IDS,
  Button,
  Card,
  Screen,
  SegmentedControl,
  ThemedText,
  ToggleRow,
  boardThemes,
  useTheme,
  type AnimationSpeed,
  type BoardThemeId,
  type MoveInputMode,
  type ThemePreference,
} from '@chess-open/ui';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';

import { playSound } from '@/services/feedback';
import { useSettings, type LanguageSetting, type SoundSet } from '@/store/settings';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = useSettings();

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
  const inputOptions: { value: MoveInputMode; label: string }[] = [
    { value: 'drag', label: t('settings.moveInputDrag') },
    { value: 'tap', label: t('settings.moveInputTap') },
    { value: 'both', label: t('settings.moveInputBoth') },
  ];
  const soundOptions: { value: SoundSet; label: string }[] = [
    { value: 'wood', label: t('settings.soundWood') },
    { value: 'soft', label: t('settings.soundSoft') },
    { value: 'off', label: t('settings.soundOff') },
  ];
  const languageOptions: { value: LanguageSetting; label: string }[] = [
    { value: 'auto', label: t('settings.languageAuto') },
    { value: 'ru', label: 'Русский' },
    { value: 'en', label: 'English' },
  ];

  const label = (text: string) => (
    <ThemedText variant="label" tone="textMuted" style={{ marginTop: theme.spacing.xs }}>
      {text}
    </ThemedText>
  );

  return (
    <Screen>
      <Card>
        <ThemedText variant="heading">{t('settings.appearance')}</ThemedText>
        {label(t('settings.theme'))}
        <SegmentedControl
          accessibilityLabel={t('settings.theme')}
          options={themeOptions}
          value={s.theme}
          onChange={(v) => s.set('theme', v)}
        />
        {label(t('settings.animations'))}
        <SegmentedControl
          accessibilityLabel={t('settings.animations')}
          options={speedOptions}
          value={s.animationSpeed}
          onChange={(v) => s.set('animationSpeed', v)}
        />
        <ThemedText variant="caption" tone="textMuted">
          {t('settings.reduceMotionNote')}
        </ThemedText>
        {label(t('settings.language'))}
        <SegmentedControl
          accessibilityLabel={t('settings.language')}
          options={languageOptions}
          value={s.language}
          onChange={(v) => s.set('language', v)}
        />
      </Card>

      <Card>
        <ThemedText variant="heading">{t('settings.board')}</ThemedText>
        {label(t('settings.boardTheme'))}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          {BOARD_THEME_IDS.map((id) => (
            <BoardSwatch
              key={id}
              id={id}
              selected={s.boardTheme === id}
              onPress={() => s.set('boardTheme', id)}
            />
          ))}
        </View>
        {label(t('settings.moveInput'))}
        <SegmentedControl
          accessibilityLabel={t('settings.moveInput')}
          options={inputOptions}
          value={s.moveInput}
          onChange={(v) => s.set('moveInput', v)}
        />
        <ToggleRow
          label={t('settings.coordinates')}
          value={s.showCoordinates}
          onChange={(v) => s.set('showCoordinates', v)}
        />
        <ToggleRow
          label={t('settings.legalMoves')}
          value={s.showLegalMoves}
          onChange={(v) => s.set('showLegalMoves', v)}
        />
        <ToggleRow
          label={t('settings.autoQueen')}
          hint={t('settings.autoQueenHint')}
          value={s.autoQueen}
          onChange={(v) => s.set('autoQueen', v)}
        />
      </Card>

      <Card>
        <ThemedText variant="heading">{t('settings.soundAndHaptics')}</ThemedText>
        {label(t('settings.sound'))}
        <SegmentedControl
          accessibilityLabel={t('settings.sound')}
          options={soundOptions}
          value={s.soundSet}
          onChange={(v) => {
            s.set('soundSet', v);
            if (v !== 'off') setTimeout(() => playSound('move'), 0);
          }}
        />
        {Platform.OS !== 'web' && (
          <ToggleRow
            label={t('settings.haptics')}
            value={s.haptics}
            onChange={(v) => s.set('haptics', v)}
          />
        )}
      </Card>

      <Button label={t('settings.reset')} onPress={s.reset} style={{ alignSelf: 'flex-start' }} />
    </Screen>
  );
}

function BoardSwatch({
  id,
  selected,
  onPress,
}: {
  id: BoardThemeId;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const b = boardThemes[id];
  const cell = 18;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={id}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        padding: 3,
        borderRadius: theme.radii.md,
        borderWidth: 2,
        borderColor: selected ? theme.colors.accent : 'transparent',
      }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          width: cell * 2,
          borderRadius: 4,
          overflow: 'hidden',
        }}>
        {[b.light, b.dark, b.dark, b.light].map((c, i) => (
          <View key={i} style={{ width: cell, height: cell, backgroundColor: c }} />
        ))}
      </View>
    </Pressable>
  );
}
