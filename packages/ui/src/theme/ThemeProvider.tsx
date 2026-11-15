import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';

import {
  createTheme,
  resolveThemeName,
  type AnimationSpeed,
  type Theme,
  type ThemePreference,
} from './tokens';

const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  /** `system` follows the OS; changes apply instantly, without a restart. */
  preference: ThemePreference;
  animationSpeed: AnimationSpeed;
  children: ReactNode;
}

/** OS «reduce motion» flag, kept live. */
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduce(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

const noopSubscribe = () => () => undefined;

/** False during static (server) rendering and hydration, true on the client afterwards. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * On web the page is pre-rendered statically, where the OS scheme is unknown.
 * Read it only after hydration to avoid a markup mismatch.
 */
function useSystemScheme(): 'dark' | 'light' | null {
  const scheme = useColorScheme();
  const isClient = useIsClient();
  if (Platform.OS === 'web' && !isClient) return null;
  return scheme === 'light' || scheme === 'dark' ? scheme : null;
}

export function ThemeProvider({ preference, animationSpeed, children }: ThemeProviderProps) {
  const systemScheme = useSystemScheme();
  const reduceMotion = useReduceMotion();
  const name = resolveThemeName(preference, systemScheme);

  const theme = useMemo(
    () => createTheme(name, animationSpeed, reduceMotion),
    [name, animationSpeed, reduceMotion],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Current theme. Must be used inside <ThemeProvider>. */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme() must be used inside <ThemeProvider>');
  return theme;
}
