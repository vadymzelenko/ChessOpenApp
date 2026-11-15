import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';

export interface AppearProps {
  children: ReactNode;
  /** Position in a list: each step delays the entrance a little (stagger). */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Entrance animation for tiles: fade + slight rise, staggered by `index`.
 * Disabled with the «выкл» animation setting or OS reduce motion.
 */
export function Appear({ children, index = 0, style }: AppearProps) {
  const t = useTheme();
  if (t.animationsDisabled) return <Animated.View style={style}>{children}</Animated.View>;
  const entering = FadeInDown.duration(Math.max(180, t.durations.screenTransition + 60))
    .delay(Math.min(index, 8) * 45)
    .withInitialValues({ transform: [{ translateY: 14 }] });
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
