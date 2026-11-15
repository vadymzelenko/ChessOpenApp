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
  const { size, lineHeight, weight, family } = t.typography;
  const base: TextStyle = family.sans ? { fontFamily: family.sans } : {};
  switch (variant) {
    case 'title':
      return { ...base, fontSize: size.xxl, lineHeight: lineHeight.xxl, fontWeight: weight.bold };
    case 'heading':
      return { ...base, fontSize: size.lg, lineHeight: lineHeight.lg, fontWeight: weight.semibold };
    case 'label':
      return { ...base, fontSize: size.sm, lineHeight: lineHeight.sm, fontWeight: weight.semibold };
    case 'caption':
      return { ...base, fontSize: size.xs, lineHeight: lineHeight.xs, fontWeight: weight.regular };
    case 'body':
    default:
      return { ...base, fontSize: size.md, lineHeight: lineHeight.md, fontWeight: weight.regular };
  }
}

export function ThemedText({ variant = 'body', tone = 'text', style, ...rest }: ThemedTextProps) {
  const t = useTheme();
  return <Text style={[variantStyle(t, variant), { color: t.colors[tone] }, style]} {...rest} />;
}
