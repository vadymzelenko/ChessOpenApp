import { Platform } from 'react-native';

/**
 * Entrance animations are off while a statically pre-rendered web page loads
 * (the page fades in as a whole instead, see RootLayout); the app turns them
 * on once it is revealed. On native the first screen animates normally.
 */
let enabled = Platform.OS !== 'web';

export function enableEntranceAnimations(): void {
  enabled = true;
}

export function entranceAnimationsEnabled(): boolean {
  return enabled;
}
