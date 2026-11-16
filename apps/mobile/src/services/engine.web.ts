import { parseUciInfo, type UciInfo } from '@chess-open/core';

/**
 * Local Stockfish 19 (lite WASM, single thread — no special headers needed)
 * in a Web Worker (ТЗ module 33). One engine, one search at a time: a new
 * request stops the current search and starts once its `bestmove` arrives.
 */
export const engineAvailable =
  typeof window !== 'undefined' &&
  typeof Worker !== 'undefined' &&
  typeof WebAssembly !== 'undefined';

interface Job {
  fen: string;
  depth: number;
  onInfo: (info: UciInfo) => void;
}

let worker: Worker | null = null;
let running = false;
let active: Job | null = null;
let queued: Job | null = null;

/** Site base path, read from the bundle URL (works under GitHub Pages' /<repo>/). */
function basePath(): string {
  const src = [...document.scripts].map((s) => s.src).find((s) => s.includes('/_expo/'));
  return src ? new URL(src).pathname.split('/_expo/')[0]! : '';
}

function engine(): Worker {
  if (worker) return worker;
  worker = new Worker(`${basePath()}/engine/stockfish-19-lite-single.js`);
  worker.onmessage = (e: MessageEvent<string>) => {
    const line = String(e.data);
    if (line.startsWith('bestmove')) {
      running = false;
      active = null;
      const next = queued;
      queued = null;
      if (next) start(next);
      return;
    }
    if (!active) return;
    const info = parseUciInfo(line);
    if (info && info.multipv === 1 && info.pv.length) active.onInfo(info);
  };
  worker.postMessage('uci');
  worker.postMessage('setoption name Hash value 32');
  worker.postMessage('isready');
  return worker;
}

function start(job: Job) {
  const w = engine();
  running = true;
  active = job;
  w.postMessage(`position fen ${job.fen}`);
  w.postMessage(`go depth ${job.depth}`);
}

/** Analyse `fen` to `depth`; returns a function that cancels the search. */
export function analyse(fen: string, depth: number, onInfo: (info: UciInfo) => void): () => void {
  if (!engineAvailable) return () => {};
  const job: Job = { fen, depth, onInfo };
  if (running) {
    if (active) engine().postMessage('stop');
    active = null;
    queued = job;
  } else start(job);
  return () => {
    if (queued === job) queued = null;
    if (active === job) {
      active = null;
      engine().postMessage('stop');
    }
  };
}
