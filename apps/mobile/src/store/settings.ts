import type { AnimationSpeed, ThemePreference } from '@chess-open/ui';
import { create } from 'zustand';

/**
 * App settings. In-memory for now; persistence to local storage
 * arrives with module 8 («Настройки»).
 */
interface SettingsState {
  theme: ThemePreference;
  animationSpeed: AnimationSpeed;
  setTheme: (theme: ThemePreference) => void;
  setAnimationSpeed: (speed: AnimationSpeed) => void;
}

export const useSettings = create<SettingsState>()((set) => ({
  theme: 'dark',
  animationSpeed: 'normal',
  setTheme: (theme) => set({ theme }),
  setAnimationSpeed: (animationSpeed) => set({ animationSpeed }),
}));
