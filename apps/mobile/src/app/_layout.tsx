import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { ThemeProvider, enableEntranceAnimations, useTheme } from '@chess-open/ui';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { applyLanguage } from '@/i18n';
import { preloadSounds } from '@/services/feedback';
import { useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useSettings((s) => s.theme);
  const animationSpeed = useSettings((s) => s.animationSpeed);
  const language = useSettings((s) => s.language);
  const soundSet = useSettings((s) => s.soundSet);
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  // Web renders immediately (static HTML) and is revealed once fonts are in.
  const ready = fontsLoaded || !!fontError || Platform.OS === 'web';
  // Web: the pre-rendered HTML is Russian; the user's language is applied only
  // after hydration has fully finished (otherwise React reports a text mismatch).
  const [settled, setSettled] = useState(Platform.OS !== 'web');
  const onSettled = useCallback(() => setSettled(true), []);
  const revealed = useWebReveal(fontsLoaded || !!fontError, onSettled);

  useEffect(() => {
    // Web: settings are read after hydration so pre-rendered HTML matches.
    if (Platform.OS === 'web') {
      void useSettings.persist.rehydrate();
      void useProgress.persist.rehydrate();
    }
  }, []);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  useEffect(() => {
    if (settled) applyLanguage(language);
  }, [language, settled]);
  useEffect(() => preloadSounds(soundSet), [soundSet]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0F1115' }}>
      <Animated.View style={{ flex: 1, opacity: revealed }}>
        <ThemeProvider preference={theme} animationSpeed={animationSpeed}>
          <ThemedNavigation />
        </ThemeProvider>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

/**
 * Web only: the statically pre-rendered page stays transparent until it has
 * hydrated, read the real window size and loaded the fonts (max 1.5 s), then
 * fades in once — no layout jumps or font swaps are visible. Native: always 1.
 */
function useWebReveal(fontsReady: boolean, onSettled: () => void): Animated.Value | number {
  const [opacity] = useState(() => new Animated.Value(Platform.OS === 'web' ? 0 : 1));
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = setTimeout(() => setTimedOut(true), 1500);
    return () => clearTimeout(id);
  }, []);
  const go = Platform.OS === 'web' && (fontsReady || timedOut);
  useEffect(() => {
    if (!go) return;
    // Boards and other measured views settle a few frames after hydration;
    // wait for that, then fade in once.
    // Hydration (incl. lazy Suspense boundaries) is over by now: switch to the
    // user's language while still hidden, then fade in.
    let fade: ReturnType<typeof setTimeout> | undefined;
    const id = setTimeout(() => {
      onSettled();
      fade = setTimeout(() => {
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: false }).start(() =>
          enableEntranceAnimations(),
        );
      }, 80);
    }, 300);
    return () => {
      clearTimeout(id);
      if (fade) clearTimeout(fade);
    };
  }, [go, opacity, onSettled]);
  return opacity;
}

/** Bridges our design tokens into React Navigation and hosts the root stack. */
function ThemedNavigation() {
  const t = useTheme();

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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.colors.background },
          animation: t.animationsDisabled ? 'none' : 'slide_from_right',
          animationDuration: t.durations.screenTransition,
        }}
      />
    </NavigationThemeProvider>
  );
}
