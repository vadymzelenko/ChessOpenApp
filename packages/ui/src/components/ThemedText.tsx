import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { ColorTokens, Theme } from '../theme/tokens';

type Variant = 'title' | 'heading' | 'body' | 'label' | 'caption';
type Tone = keyof Pick<
  ColorTokens,
  | 'text'
  | 'textMuted'
  | 'accent'
  | 'onAccent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'verified'
  | 'generated'
>;

export interface ThemedTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
}

function variantStyle(t: Theme, variant: Variant): TextStyle {
  const { size, lineHeight, family } = t.typography;
  switch (variant) {
    case 'title':
      return {
        fontFamily: family.extrabold,
        fontSize: size.xxl,
        lineHeight: lineHeight.xxl,
        letterSpacing: -0.5,
      };
    case 'heading':
      return {
        fontFamily: family.bold,
        fontSize: size.lg,
        lineHeight: lineHeight.lg,
        letterSpacing: -0.2,
      };
    case 'label':
      return { fontFamily: family.semibold, fontSize: size.sm, lineHeight: lineHeight.sm };
    case 'caption':
      return { fontFamily: family.medium, fontSize: size.xs, lineHeight: lineHeight.xs };
    case 'body':
    default:
      return { fontFamily: family.regular, fontSize: size.md, lineHeight: lineHeight.md };
  }
}

export function ThemedText({ variant = 'body', tone = 'text', style, ...rest }: ThemedTextProps) {
  const t = useTheme();
  return <Text style={[variantStyle(t, variant), { color: t.colors[tone] }, style]} {...rest} />;
}
