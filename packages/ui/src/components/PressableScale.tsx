import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed (default 0.97). */
  pressedScale?: number;
}

/** Pressable with a springy press-in scale (transform only, UI thread). */
export function PressableScale({
  children,
  style,
  pressedScale = 0.97,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableScaleProps) {
  const t = useTheme();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const spring = { damping: 18, stiffness: 320, mass: 0.6 };
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!t.animationsDisabled) scale.set(withSpring(pressedScale, spring));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(t.animationsDisabled ? 1 : withSpring(1, spring));
        onPressOut?.(e);
      }}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}
