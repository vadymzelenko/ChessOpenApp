/** Board colour themes (ТЗ §10: 6–8 тем доски; more are added with module 10). */
export interface BoardTheme {
  id: string;
  light: string;
  dark: string;
  /** Last move highlight (translucent, drawn over the square). */
  lastMove: string;
  /** Selected piece square. */
  selected: string;
  /** Legal move dots / capture rings. */
  hint: string;
  /** Square under a dragged piece. */
  hover: string;
  /** Glow under a king in check. */
  check: string;
  /** Wrong move flash. */
  wrong: string;
}

export const boardThemes = {
  green: {
    id: 'green',
    light: '#EBECD0',
    dark: '#739552',
    lastMove: 'rgba(255, 214, 51, 0.45)',
    selected: 'rgba(255, 214, 51, 0.6)',
    hint: 'rgba(20, 30, 20, 0.28)',
    hover: 'rgba(255, 255, 255, 0.35)',
    check: '#FF3B30',
    wrong: 'rgba(240, 60, 50, 0.6)',
  },
  wood: {
    id: 'wood',
    light: '#F0D9B5',
    dark: '#B58863',
    lastMove: 'rgba(155, 199, 0, 0.42)',
    selected: 'rgba(20, 85, 30, 0.5)',
    hint: 'rgba(20, 85, 30, 0.45)',
    hover: 'rgba(255, 255, 255, 0.35)',
    check: '#FF3B30',
    wrong: 'rgba(240, 60, 50, 0.6)',
  },
  blue: {
    id: 'blue',
    light: '#DEE3E6',
    dark: '#8CA2AD',
    lastMove: 'rgba(91, 140, 255, 0.4)',
    selected: 'rgba(91, 140, 255, 0.55)',
    hint: 'rgba(15, 30, 60, 0.3)',
    hover: 'rgba(255, 255, 255, 0.4)',
    check: '#FF3B30',
    wrong: 'rgba(240, 60, 50, 0.6)',
  },
  slate: {
    id: 'slate',
    light: '#9AA3B5',
    dark: '#596275',
    lastMove: 'rgba(245, 196, 81, 0.45)',
    selected: 'rgba(245, 196, 81, 0.6)',
    hint: 'rgba(10, 12, 20, 0.35)',
    hover: 'rgba(255, 255, 255, 0.3)',
    check: '#FF453A',
    wrong: 'rgba(255, 69, 58, 0.6)',
  },
} as const satisfies Record<string, BoardTheme>;

export type BoardThemeId = keyof typeof boardThemes;
export const BOARD_THEME_IDS = Object.keys(boardThemes) as BoardThemeId[];
