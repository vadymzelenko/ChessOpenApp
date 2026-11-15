import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { IconComponent } from './Button';

export interface IconBadgeProps {
  icon: IconComponent;
  color: string;
  size?: number;
  /** Solid badge (white icon on colour) instead of a tinted one. */
  solid?: boolean;
}

/** Rounded square with an icon — the visual anchor of a tile. */
export function IconBadge({ icon: Icon, color, size = 44, solid }: IconBadgeProps) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: t.radii.md + 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: solid ? color : `${color}24`,
      }}>
      <Icon color={solid ? '#FFFFFF' : color} size={Math.round(size * 0.52)} strokeWidth={2.2} />
    </View>
  );
}
