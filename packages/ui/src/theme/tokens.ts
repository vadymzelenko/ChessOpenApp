/**
 * Design tokens — the single source of truth for colours, spacing, radii,
 * typography and animation timings (ТЗ §10 «Дизайн-система на токенах»).
 *
 * This file is pure data + pure functions: no React / React Native imports,
 * so it is unit-testable and usable from anywhere.
 */

export type ThemeName = 'dark' | 'light';
/** User preference. `system` follows the OS setting. */
export type ThemePreference = ThemeName | 'system';
/** «Скорость анимаций: быстро / норма / выкл» (ТЗ §10). */
export type AnimationSpeed = 'fast' | 'normal' | 'off';

export interface ColorTokens {
  /** Screen background. */
  background: string;
  /** Cards, tiles, panels. */
  surface: string;
  /** Elevated elements on top of a surface (dialogs, pressed tiles). */
  surfaceRaised: string;
  border: string;
  text: string;
  /** Secondary text; must still pass WCAG AA on background and surface. */
  textMuted: string;
  accent: string;
  /** Text/icon colour placed on top of `accent`. */
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  /** ⭐ Content reviewed by a human (ТЗ §1 «Честность»). */
  verified: string;
  /** ⚙ Content generated from statistics. */
  generated: string;
  /** Translucent layer behind modals. */
  overlay: string;
}

export const palettes: Record<ThemeName, ColorTokens> = {
  dark: {
    background: '#0F1115',
    surface: '#171A21',
    surfaceRaised: '#1F232C',
    border: '#2A2F3A',
    text: '#F2F4F8',
    textMuted: '#A3ABBA',
    accent: '#5B8CFF',
    onAccent: '#0B0D12',
    success: '#3FB97A',
    warning: '#F2B441',
    danger: '#F0635B',
    verified: '#F5C451',
    generated: '#8A93A6',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
  light: {
    background: '#F6F7F9',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    border: '#E1E4EA',
    text: '#12151B',
    textMuted: '#555D6E',
    accent: '#2F62E0',
    onAccent: '#FFFFFF',
    success: '#1B7F4E',
    warning: '#94600A',
    danger: '#C3352D',
    verified: '#94700A',
    generated: '#5F6779',
    overlay: 'rgba(15, 17, 21, 0.45)',
  },
};

/** 4-pt spacing scale. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  /** Fonts must be OFL-licensed (ТЗ §12). `undefined` = platform system font for now. */
  family: {
    sans: undefined as string | undefined,
    mono: undefined as string | undefined,
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  lineHeight: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    xxl: 40,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

/**
 * Base animation durations in ms at «норма» speed (ТЗ §10, таблица анимаций).
 * Always read them through `theme.durations`, which applies the user's speed
 * setting and the OS «reduce motion» flag.
 */
export const baseDurations = {
  /** Piece slides to its square with easing (150–220 ms). */
  move: 180,
  /** Captured piece shrinks and fades. */
  capture: 150,
  /** Piece springs back, board shakes, square flashes red. */
  wrongMove: 250,
  /** Move-grade «stamp» pops in (scale 0 → 1.2 → 1). */
  stamp: 300,
  /** Red glow under the king in check. */
  checkPulse: 400,
  /** Confetti, progress bar fill, +XP. */
  lineComplete: 800,
  /** Evaluation bar height change. */
  evalBar: 300,
  /** Shared-element course tile → course screen. */
  screenTransition: 300,
  /** Generic small UI feedback (press, toggle). */
  ui: 150,
} as const;

export type DurationTokens = { -readonly [K in keyof typeof baseDurations]: number };

export const animationSpeedFactor: Record<AnimationSpeed, number> = {
  fast: 0.6,
  normal: 1,
  off: 0,
};

/** Board drag lift scale (ТЗ §10: «Фигура увеличивается (~1.15×)»). */
export const DRAG_SCALE = 1.15;

/**
 * Apply the animation-speed setting. «Reduce motion» on the OS forces `off`.
 * Returned values are integers; 0 means "jump to the end state immediately".
 */
export function scaleDurations(speed: AnimationSpeed, reduceMotion: boolean): DurationTokens {
  const factor = reduceMotion ? 0 : animationSpeedFactor[speed];
  const out = {} as DurationTokens;
  for (const key of Object.keys(baseDurations) as (keyof typeof baseDurations)[]) {
    out[key] = Math.round(baseDurations[key] * factor);
  }
  return out;
}

/** Which concrete theme to show. Dark is the default (ТЗ §10). */
export function resolveThemeName(
  preference: ThemePreference,
  systemScheme: 'dark' | 'light' | null | undefined,
): ThemeName {
  if (preference !== 'system') return preference;
  return systemScheme === 'light' ? 'light' : 'dark';
}

export interface Theme {
  name: ThemeName;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  durations: DurationTokens;
  animationSpeed: AnimationSpeed;
  /** True when durations are all 0 (speed «выкл» or OS reduce motion). */
  animationsDisabled: boolean;
}

export function createTheme(
  name: ThemeName,
  speed: AnimationSpeed = 'normal',
  reduceMotion = false,
): Theme {
  const durations = scaleDurations(speed, reduceMotion);
  return {
    name,
    colors: palettes[name],
    spacing,
    radii,
    typography,
    durations,
    animationSpeed: speed,
    animationsDisabled: durations.move === 0,
  };
}

// ---------------------------------------------------------------------------
// Colour helpers (used by tests and by components that need contrast checks).
// ---------------------------------------------------------------------------

/** Parse `#RGB` / `#RRGGBB` to [r, g, b] in 0..255. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m || !m[1]) throw new Error(`Not a hex colour: ${hex}`);
  let h = m[1];
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two opaque hex colours (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
