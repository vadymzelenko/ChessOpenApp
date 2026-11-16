import { pvToSan, toWhitePov, type Eval } from '@chess-open/core';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { analyse, engineAvailable } from '@/services/engine';

export interface EngineLine {
  fen: string;
  evaluation: Eval;
  depth: number;
  /** Best line in SAN. */
  line: string[];
}

const noop = () => () => {};
/** Hydration-safe: false in the pre-rendered HTML, real value on the client. */
export function useEngineAvailable(): boolean {
  return useSyncExternalStore(
    noop,
    () => engineAvailable,
    () => false,
  );
}

/** Live Stockfish evaluation of `fen` while `enabled` (web only for now). */
export function useEngine(fen: string, enabled: boolean, depth = 18): EngineLine | null {
  const [result, setResult] = useState<EngineLine | null>(null);
  useEffect(() => {
    if (!enabled || !engineAvailable) return;
    const turn = fen.split(' ')[1] === 'b' ? 'b' : 'w';
    return analyse(fen, depth, (info) => {
      const score = toWhitePov({ cp: info.cp, mate: info.mate }, turn);
      setResult({
        fen,
        depth: info.depth,
        evaluation: {
          ...(score.mate !== undefined ? { mate: score.mate } : { cp: score.cp ?? 0 }),
          best: info.pv[0],
          depth: info.depth,
        },
        line: pvToSan(fen, info.pv, 8),
      });
    });
  }, [fen, enabled, depth]);
  // A result for another position is stale.
  return enabled && result?.fen === fen ? result : null;
}
