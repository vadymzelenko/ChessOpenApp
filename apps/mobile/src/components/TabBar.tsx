import { PressableScale, ThemedText, useTheme } from '@chess-open/ui';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Platform, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const PILL_INSET = 8;

/** Props expo-router passes to a custom tab bar. */
export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * Tab bar with a pill that slides under the active tab (spring, UI thread).
 * Bottom padding follows the safe-area inset on phones.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: TabBarProps) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const itemWidth = width / Math.max(1, count);
  const x = useSharedValue(0);

  useEffect(() => {
    const target = state.index * itemWidth;
    x.set(
      t.animationsDisabled || itemWidth === 0
        ? target
        : withSpring(target, { damping: 20, stiffness: 260, mass: 0.7 }),
    );
  }, [state.index, itemWidth, t.animationsDisabled, x]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const bottom = Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 8);

  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderTopWidth: 1,
        borderTopColor: t.colors.border,
        paddingTop: 8,
        paddingBottom: bottom,
        paddingHorizontal: 8,
      }}>
      <View
        style={{ flexDirection: 'row', width: '100%', maxWidth: 560, alignSelf: 'center' }}
        onLayout={onLayout}
        accessibilityRole="tablist">
        {width > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: PILL_INSET,
                width: itemWidth - PILL_INSET * 2,
                borderRadius: t.radii.lg,
                backgroundColor: `${t.colors.accent}22`,
              },
              pillStyle,
            ]}
          />
        )}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!;
          const focused = index === state.index;
          const color = focused ? t.colors.accent : t.colors.textMuted;
          const label = typeof options.title === 'string' ? options.title : route.name;
          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              pressedScale={0.92}
              onPress={() => {
                const event = emitter.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 6,
                gap: 2,
              }}>
              {options.tabBarIcon?.({ focused, color, size: 24 })}
              <ThemedText
                variant="caption"
                numberOfLines={1}
                style={{
                  color,
                  fontFamily: focused ? t.typography.family.bold : t.typography.family.semibold,
                  fontSize: 11,
                }}>
                {label}
              </ThemedText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
