import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { IconComponent } from './Button';
import { IconBadge } from './IconBadge';
import { PressableScale } from './PressableScale';
import { ThemedText } from './ThemedText';

export interface TileProps {
  title: string;
  subtitle?: string;
  icon?: IconComponent;
  /** Accent colour: icon badge, gradient and watermark. */
  accent?: string;
  /** Filled gradient tile (hero / highlighted) instead of a plain surface. */
  gradient?: boolean;
  /** Small pill in the top-right corner, e.g. «Скоро». */
  badge?: string;
  /** Large faded icon in the corner. */
  watermark?: IconComponent;
  onPress?: () => void;
  disabled?: boolean;
  /** Extra content under the text. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  minHeight?: number;
  accessibilityLabel?: string;
}

/** Tile — the main building block of the app's screens. */
export function Tile({
  title,
  subtitle,
  icon,
  accent,
  gradient,
  badge,
  watermark: Watermark,
  onPress,
  disabled,
  children,
  style,
  minHeight = 92,
  accessibilityLabel,
}: TileProps) {
  const t = useTheme();
  const color = accent ?? t.colors.accent;
  const onColor = gradient ? '#FFFFFF' : undefined;

  const body = (
    <View style={[styles.inner, { padding: t.spacing.lg, gap: t.spacing.md, minHeight }]}>
      {Watermark ? (
        <View pointerEvents="none" style={[styles.watermark, { opacity: gradient ? 0.18 : 0.1 }]}>
          <Watermark color={gradient ? '#FFFFFF' : color} size={110} strokeWidth={1.4} />
        </View>
      ) : null}
      {/* Top row: icon on the left, badge on the right — the title gets the full width. */}
      {icon || badge ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}>
          {icon ? <IconBadge icon={icon} color={gradient ? '#FFFFFF' : color} /> : <View />}
          {badge ? (
            <View
              style={{
                paddingHorizontal: t.spacing.sm,
                paddingVertical: 3,
                borderRadius: t.radii.pill,
                backgroundColor: gradient ? 'rgba(255,255,255,0.22)' : t.colors.surfaceRaised,
              }}>
              <ThemedText
                variant="caption"
                style={{
                  color: onColor ?? t.colors.textMuted,
                  fontFamily: t.typography.family.bold,
                }}>
                {badge}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={{ gap: 2 }}>
        <ThemedText
          variant="heading"
          numberOfLines={2}
          style={[{ fontSize: 17, lineHeight: 22 }, onColor ? { color: onColor } : null]}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText
            variant="caption"
            tone="textMuted"
            numberOfLines={2}
            style={[
              { fontSize: 13, lineHeight: 18 },
              onColor ? { color: 'rgba(255,255,255,0.82)' } : null,
            ]}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );

  const container = [
    styles.tile,
    {
      borderRadius: t.radii.xl,
      backgroundColor: gradient ? color : t.colors.surface,
      borderColor: gradient ? 'transparent' : t.colors.border,
    },
    style,
  ];

  const content = gradient ? (
    <LinearGradient
      colors={[`${color}`, shade(color, -0.35)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  ) : null;

  if (!onPress) {
    return (
      <View style={container} accessibilityLabel={accessibilityLabel}>
        {content}
        {body}
      </View>
    );
  }
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={container}>
      {content}
      {body}
    </PressableScale>
  );
}

/** Darken (amount < 0) or lighten a #RRGGBB colour. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const f = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const styles = StyleSheet.create({
  tile: { overflow: 'hidden', borderWidth: 1 },
  inner: { justifyContent: 'space-between' },
  watermark: { position: 'absolute', right: -18, bottom: -22 },
});
