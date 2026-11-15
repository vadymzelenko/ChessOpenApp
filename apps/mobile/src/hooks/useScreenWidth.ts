import { useSyncExternalStore } from 'react';
import { Dimensions } from 'react-native';

/** Size used while pre-rendering static web pages (phone layout). */
const SERVER_SIZE = '390x844';

function subscribe(onChange: () => void) {
  const sub = Dimensions.addEventListener('change', onChange);
  return () => sub.remove();
}

const snapshot = () => {
  const { width, height } = Dimensions.get('window');
  return `${Math.round(width)}x${Math.round(height)}`;
};

/**
 * Window size that is safe for statically pre-rendered web pages:
 * hydration uses the server value, then React re-renders with the real size.
 * (useWindowDimensions would leave the server layout in place on desktop.)
 */
export function useScreenSize(): { width: number; height: number } {
  const [w, h] = useSyncExternalStore(subscribe, snapshot, () => SERVER_SIZE)
    .split('x')
    .map(Number);
  return { width: w!, height: h! };
}

export function useScreenWidth(): number {
  return useScreenSize().width;
}
