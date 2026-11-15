import type { AnimationSpeed, BoardThemeId, MoveInputMode, ThemePreference } from '@chess-open/ui';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/services/kvStorage';

export type SoundSet = 'wood' | 'soft' | 'off';
export type LanguageSetting = 'auto' | 'ru' | 'en';

export interface Settings {
  theme: ThemePreference;
  animationSpeed: AnimationSpeed;
  boardTheme: BoardThemeId;
  showCoordinates: boolean;
  showLegalMoves: boolean;
  moveInput: MoveInputMode;
  autoQueen: boolean;
  soundSet: SoundSet;
  haptics: boolean;
  language: LanguageSetting;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  animationSpeed: 'normal',
  boardTheme: 'green',
  showCoordinates: true,
  showLegalMoves: true,
  moveInput: 'both',
  autoQueen: false,
  soundSet: 'wood',
  haptics: true,
  language: 'auto',
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
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ set: _set, reset: _reset, ...rest }) => rest,
      // Unknown / missing keys from older versions fall back to defaults.
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<Settings>) }),
      skipHydration: Platform.OS === 'web',
    },
  ),
);
