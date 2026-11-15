import { ThemeProvider, useTheme } from '@chess-open/ui';
import {
  DarkTheme,
  DefaultTheme,
  Tabs,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, type ColorValue } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { applyLanguage } from '@/i18n';
import { preloadSounds } from '@/services/feedback';
import { useSettings } from '@/store/settings';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useSettings((s) => s.theme);
  const animationSpeed = useSettings((s) => s.animationSpeed);
  const language = useSettings((s) => s.language);
  const soundSet = useSettings((s) => s.soundSet);

  useEffect(() => {
    // Web: settings are read after hydration so pre-rendered HTML matches.
    if (Platform.OS === 'web') void useSettings.persist.rehydrate();
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => applyLanguage(language), [language]);
  useEffect(() => preloadSounds(soundSet), [soundSet]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider preference={theme} animationSpeed={animationSpeed}>
        <ThemedNavigation />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/** Bridges our design tokens into React Navigation (headers, tab bar). */
function ThemedNavigation() {
  const t = useTheme();
  const { t: tr } = useTranslation();

  const navTheme = useMemo(() => {
    const base = t.name === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: t.colors.accent,
        background: t.colors.background,
        card: t.colors.surface,
        text: t.colors.text,
        border: t.colors.border,
        notification: t.colors.danger,
      },
    };
  }, [t]);

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={t.name === 'dark' ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: t.colors.accent,
          tabBarInactiveTintColor: t.colors.textMuted,
          animation: t.animationsDisabled ? 'none' : 'fade',
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: tr('tabs.home'),
            tabBarIcon: ({ color }) => <TabGlyph glyph="⌂" color={color} />,
          }}
        />
        <Tabs.Screen
          name="board"
          options={{
            title: tr('tabs.board'),
            tabBarIcon: ({ color }) => <TabGlyph glyph="♞" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: tr('tabs.settings'),
            tabBarIcon: ({ color }) => <TabGlyph glyph="⚙" color={color} />,
          }}
        />
      </Tabs>
    </NavigationThemeProvider>
  );
}

function TabGlyph({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 20, lineHeight: 24 }}>{glyph}</Text>;
}
