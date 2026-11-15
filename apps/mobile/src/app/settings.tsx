import {
  Appear,
  IconBadge,
  BOARD_THEME_IDS,
  PIECE_SET_IDS,
  PieceIcon,
  pieceSets,
  Button,
  Card,
  Screen,
  SegmentedControl,
  ThemedText,
  ToggleRow,
  boardThemes,
  useTheme,
  type AnimationSpeed,
  type IconComponent,
  type BoardThemeId,
  type MoveInputMode,
  type PieceSetId,
  type ThemePreference,
} from '@chess-open/ui';
import { LayoutGrid, Palette, Volume2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
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
    <Screen title={t('tabs.settings')}>
      <Group index={1} icon={Palette} color="#4C7DFF" title={t('settings.appearance')}>
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
      </Group>

      <Group index={2} icon={LayoutGrid} color="#2FB574" title={t('settings.board')}>
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
        {label(t('settings.pieceSet'))}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          {PIECE_SET_IDS.map((id) => (
            <PieceSetSwatch
              key={id}
              id={id}
              boardTheme={s.boardTheme}
              selected={s.pieceSet === id}
              onPress={() => s.set('pieceSet', id)}
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
      </Group>

      <Group index={3} icon={Volume2} color="#F08A3C" title={t('settings.soundAndHaptics')}>
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
      </Group>

      <Appear index={4}>
        <Button
          variant="ghost"
          label={t('settings.reset')}
          onPress={s.reset}
          style={{ alignSelf: 'flex-start' }}
        />
      </Appear>
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

function PieceSetSwatch({
  id,
  boardTheme,
  selected,
  onPress,
}: {
  id: PieceSetId;
  boardTheme: BoardThemeId;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const b = boardThemes[boardTheme];
  const cell = 34;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={pieceSets[id].name}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        padding: 3,
        borderRadius: theme.radii.md,
        borderWidth: 2,
        borderColor: selected ? theme.colors.accent : 'transparent',
        alignItems: 'center',
      }}>
      <View style={{ flexDirection: 'row', borderRadius: 6, overflow: 'hidden' }}>
        <View style={{ width: cell, height: cell, backgroundColor: b.light }}>
          <PieceIcon set={id} color="w" kind="n" size={cell} />
        </View>
        <View style={{ width: cell, height: cell, backgroundColor: b.dark }}>
          <PieceIcon set={id} color="b" kind="q" size={cell} />
        </View>
      </View>
      <ThemedText variant="caption" tone={selected ? 'text' : 'textMuted'} style={{ marginTop: 2 }}>
        {pieceSets[id].name}
      </ThemedText>
    </Pressable>
  );
}

function Group({
  index,
  icon,
  color,
  title,
  children,
}: {
  index: number;
  icon: IconComponent;
  color: string;
  title: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Appear index={index}>
      <Card
        style={{ borderRadius: theme.radii.xl, gap: theme.spacing.sm, padding: theme.spacing.lg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            marginBottom: theme.spacing.xs,
          }}>
          <IconBadge icon={icon} color={color} size={38} />
          <ThemedText variant="heading">{title}</ThemedText>
        </View>
        {children}
      </Card>
    </Appear>
  );
}
