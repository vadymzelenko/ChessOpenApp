import {
  DEFAULT_PIECE_SET,
  boardThemes,
  pieceSets,
  type AnimationSpeed,
  type BoardThemeId,
  type MoveInputMode,
  type PieceSetId,
  type ThemePreference,
} from '@chess-open/ui';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/services/kvStorage';

export type SoundSet = 'wood' | 'soft' | 'off';
export type LanguageSetting = 'auto' | 'ru' | 'uk' | 'pl' | 'en';
export type OpponentLevel = 'lt1400' | '1400-1800' | 'gt1800';

export interface Settings {
  theme: ThemePreference;
  animationSpeed: AnimationSpeed;
  boardTheme: BoardThemeId;
  pieceSet: PieceSetId;
  showCoordinates: boolean;
  showLegalMoves: boolean;
  moveInput: MoveInputMode;
  autoQueen: boolean;
  soundSet: SoundSet;
  haptics: boolean;
  language: LanguageSetting;
  /** Rating group of the «live» opponents (ТЗ §5). */
  opponentLevel: OpponentLevel;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  animationSpeed: 'normal',
  boardTheme: 'green',
  pieceSet: DEFAULT_PIECE_SET,
  showCoordinates: true,
  showLegalMoves: true,
  moveInput: 'both',
  autoQueen: false,
  soundSet: 'wood',
  haptics: true,
  language: 'auto',
  opponentLevel: '1400-1800',
};

interface SettingsState extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

/**
 * App settings (ТЗ §10 «Темы и настройки»), persisted locally.
 * On web the store hydrates after the first render (see RootLayout) so that
 * statically pre-rendered HTML matches the client markup.
 */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (key, value) => set({ [key]: value } as Pick<Settings, typeof key>),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'settings',
      version: 2,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ set: _set, reset: _reset, ...rest }) => rest,
      migrate: (persisted) => persisted as Settings,
      // Unknown / missing keys fall back to defaults; values that no longer exist are dropped.
      merge: (persisted, current) => {
        const p = { ...(persisted as Partial<Settings>) };
        if (p.pieceSet && !(p.pieceSet in pieceSets)) delete p.pieceSet;
        if (p.boardTheme && !(p.boardTheme in boardThemes)) delete p.boardTheme;
        return { ...current, ...p };
      },
      skipHydration: Platform.OS === 'web',
    },
  ),
);
