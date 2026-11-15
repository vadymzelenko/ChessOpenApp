import { useTheme, type IconComponent } from '@chess-open/ui';
import { Tabs } from 'expo-router';
import { ChessKnight, House, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Animated, Dimensions, Easing, type ColorValue } from 'react-native';

import { TabBar } from '@/components/TabBar';

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

const tabIcon = (Icon: IconComponent) => {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon color={String(color)} size={24} strokeWidth={focused ? 2.4 : 2} />;
  }
  return TabIcon;
};

export default function TabsLayout() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        // Screens draw their own large titles (see <Screen title>).
        headerShown: false,
        // Mount all tabs up front so the slider never reveals an empty screen.
        lazy: false,
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
      <Tabs.Screen name="index" options={{ title: tr('tabs.home'), tabBarIcon: tabIcon(House) }} />
      <Tabs.Screen
        name="board"
        options={{ title: tr('tabs.board'), tabBarIcon: tabIcon(ChessKnight) }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: tr('tabs.settings'), tabBarIcon: tabIcon(Settings) }}
      />
    </Tabs>
  );
}
