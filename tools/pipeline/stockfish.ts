import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

import {
  parseUciInfo,
  toWhitePov,
  type Eval,
  type Evaluator,
  type UciInfo,
} from '@chess-open/core';

/**
 * Minimal UCI client for a local Stockfish (GPL — used only in the data
 * pipeline / allowed in the app since it is GPL-3.0 too). One search at a time.
 */
export class Stockfish {
  private proc: ChildProcessWithoutNullStreams;
  private waiters: ((line: string) => boolean)[] = [];

  constructor(binary = process.env.STOCKFISH_PATH ?? 'stockfish') {
    this.proc = spawn(binary, [], { stdio: 'pipe' });
    const rl = createInterface({ input: this.proc.stdout });
    rl.on('line', (line) => {
      this.waiters = this.waiters.filter((w) => !w(line));
    });
  }

  private send(cmd: string) {
    this.proc.stdin.write(`${cmd}\n`);
  }

  private waitFor(
    match: (line: string) => boolean,
    onLine?: (line: string) => void,
  ): Promise<string> {
    return new Promise((resolve) => {
      this.waiters.push((line) => {
        onLine?.(line);
        if (match(line)) {
          resolve(line);
          return true;
        }
        return false;
      });
    });
  }

  async init(threads = 2, hashMb = 256): Promise<void> {
    this.send('uci');
    await this.waitFor((l) => l === 'uciok');
    this.send(`setoption name Threads value ${threads}`);
    this.send(`setoption name Hash value ${hashMb}`);
    this.send('isready');
    await this.waitFor((l) => l === 'readyok');
  }

  /** Evaluate a FEN to a fixed depth; score from White's point of view. */
  async evaluate(fen: string, depth: number): Promise<Eval | null> {
    let last: UciInfo | null = null;
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    const best = await this.waitFor(
      (l) => l.startsWith('bestmove'),
      (l) => {
        const info = parseUciInfo(l);
        if (info && info.multipv === 1) last = info;
      },
    );
    const info = last as UciInfo | null;
    if (!info) return null;
    const side = fen.split(' ')[1] === 'b' ? 'b' : 'w';
    const score = toWhitePov({ cp: info.cp, mate: info.mate }, side);
    const move = best.split(' ')[1];
    return {
      ...(score.cp !== undefined ? { cp: score.cp } : {}),
      ...(score.mate !== undefined ? { mate: score.mate } : {}),
      ...(move && move !== '(none)' ? { best: move } : {}),
      depth: info.depth,
    };
  }

  evaluator(depth: number): Evaluator {
    return (fen) => this.evaluate(fen, depth);
  }

  quit() {
    this.send('quit');
  }
}
