import { PressableScale, ThemedText, useTheme } from '@chess-open/ui';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScreenSize } from '@/hooks/useScreenWidth';

interface SessionLayoutProps {
  title: string;
  subtitle?: string;
  /** 0..1, shown as a bar under the title. */
  progress?: number;
  accent: string;
  /** Where «back» goes when there is no history (deep link). */
  fallbackHref: string;
  board: ReactNode;
  panel: ReactNode;
  overlay?: ReactNode;
}

/** Shared layout of board sessions (review, exam): header, board, panel. */
export function SessionLayout({
  title,
  subtitle,
  progress,
  accent,
  fallbackHref,
  board,
  panel,
  overlay,
}: SessionLayoutProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useScreenSize();
  const wide = width >= 860;

  const header = (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="back"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace(fallbackHref as never)
          }
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surface,
          }}>
          <ChevronLeft color={theme.colors.text} size={24} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          {subtitle ? (
            <ThemedText variant="caption" tone="textMuted" numberOfLines={1}>
              {subtitle}
            </ThemedText>
          ) : null}
          <ThemedText variant="heading" numberOfLines={1}>
            {title}
          </ThemedText>
        </View>
      </View>
      {progress !== undefined ? (
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.colors.surfaceRaised,
            overflow: 'hidden',
          }}>
          <View
            style={{
              width: `${Math.round(Math.min(1, progress) * 100)}%`,
              height: 6,
              backgroundColor: accent,
            }}
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerStyle={
          wide
            ? {
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: theme.spacing.xl,
                padding: theme.spacing.xl,
                paddingTop: insets.top + theme.spacing.xl,
                maxWidth: 1280,
                width: '100%',
                alignSelf: 'center',
              }
            : { paddingBottom: theme.spacing.xxl }
        }>
        {wide ? (
          <>
            <View style={{ width: Math.max(320, Math.min(720, width * 0.55, height - 80)) }}>
              {board}
            </View>
            <View style={{ flex: 1, gap: theme.spacing.lg }}>
              {header}
              {panel}
            </View>
          </>
        ) : (
          <>
            <View
              style={{
                paddingTop: insets.top + theme.spacing.sm,
                paddingHorizontal: theme.spacing.lg,
                paddingBottom: theme.spacing.md,
              }}>
              {header}
            </View>
            <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center' }}>{board}</View>
            <View
              style={{
                padding: theme.spacing.lg,
                gap: theme.spacing.md,
                width: '100%',
                maxWidth: 640,
                alignSelf: 'center',
              }}>
              {panel}
            </View>
          </>
        )}
      </ScrollView>
      {overlay}
    </View>
  );
}

/** Rounded panel card; `tone` tints it for success / error states. */
export function PanelCard({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'danger' | 'success';
}) {
  const theme = useTheme();
  const c =
    tone === 'danger' ? theme.colors.danger : tone === 'success' ? theme.colors.success : null;
  return (
    <View
      style={{
        padding: theme.spacing.lg,
        gap: theme.spacing.sm,
        borderRadius: theme.radii.xl,
        backgroundColor: c ? `${c}1A` : theme.colors.surface,
        borderWidth: 1,
        borderColor: c ?? theme.colors.border,
      }}>
      {children}
    </View>
  );
}
