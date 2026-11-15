import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { ThemeProvider, useTheme, type IconComponent } from '@chess-open/ui';
import {
  DarkTheme,
  DefaultTheme,
  Tabs,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ChessKnight, House, Settings } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Dimensions, Easing, Platform, type ColorValue } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { TabBar } from '@/components/TabBar';
import { applyLanguage } from '@/i18n';
import { preloadSounds } from '@/services/feedback';
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
  // Web renders immediately (static HTML) and swaps the font in when it arrives.
  const ready = fontsLoaded || !!fontError || Platform.OS === 'web';

  useEffect(() => {
    // Web: settings are read after hydration so pre-rendered HTML matches.
    if (Platform.OS === 'web') void useSettings.persist.rehydrate();
  }, []);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  useEffect(() => applyLanguage(language), [language]);
  useEffect(() => preloadSounds(soundSet), [soundSet]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider preference={theme} animationSpeed={animationSpeed}>
        <ThemedNavigation />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Tab transition: a full-width slider. Neighbouring tabs slide in from the side
 * they are on; nothing fades to transparent, so there is no flash between screens.
 */
function slideInterpolator({ current }: { current: { progress: Animated.Value } }) {
  const width = Dimensions.get('window').width;
  return {
    sceneStyle: {
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-width, 0, width],
          }),
        },
      ],
    },
  };
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

  const tabIcon = (Icon: IconComponent) => {
    function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
      return <Icon color={String(color)} size={24} strokeWidth={focused ? 2.4 : 2} />;
    }
    return TabIcon;
  };

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={t.name === 'dark' ? 'light' : 'dark'} />
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          // Screens draw their own large titles (see <Screen title>).
          headerShown: false,
          headerStyle: { backgroundColor: t.colors.surface },
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: t.typography.family.bold, fontSize: 18 },
          sceneStyle: { backgroundColor: t.colors.background },
          ...(t.animationsDisabled
            ? { animation: 'none' as const }
            : {
                sceneStyleInterpolator: slideInterpolator,
                transitionSpec: {
                  animation: 'timing' as const,
                  config: {
                    duration: t.durations.screenTransition,
                    easing: Easing.out(Easing.cubic),
                  },
                },
              }),
        }}>
        <Tabs.Screen
          name="index"
          options={{ title: tr('tabs.home'), tabBarIcon: tabIcon(House) }}
        />
        <Tabs.Screen
          name="board"
          options={{ title: tr('tabs.board'), tabBarIcon: tabIcon(ChessKnight) }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: tr('tabs.settings'), tabBarIcon: tabIcon(Settings) }}
        />
      </Tabs>
    </NavigationThemeProvider>
  );
}
