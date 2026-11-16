/**
 * Evaluations for every pack position (ТЗ §3 `evals`, module 12):
 * Lichess cloud eval first (cached, free), local Stockfish for the rest.
 *
 *   npm run pack:evals -- <id> [--depth 18] [--minutes 240] [--no-cloud] [--no-stockfish]
 *
 * `--minutes` is a time budget: the run stops in time and keeps what it has
 * (progress is also saved every 100 positions), so a later run continues.
 *
 * Writes packs/<id>/evals.json (merged into the pack by pack:build).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildEvals, packPositions, type Eval, type Evaluator } from '@chess-open/core';

import { PACKS, ROOT, loadPack, numberArg, readJsonFile, sleep } from './common';
import { Stockfish } from './stockfish';

const CACHE = join(ROOT, '.cache', 'cloud-eval');

const cloudEval: Evaluator = async (fen) => {
  const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}`;
  const cacheFile = join(CACHE, `${createHash('sha1').update(url).digest('hex')}.json`);
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8')) as Eval | null;
  for (;;) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.status === 429) {
      console.log('  … rate limited, waiting 60 s');
      await sleep(60_000);
      continue;
    }
    let result: Eval | null = null;
    if (res.ok) {
      // Cloud evals are from White's point of view.
      const body = (await res.json()) as {
        depth: number;
        pvs: { cp?: number; mate?: number; moves: string }[];
      };
      const pv = body.pvs[0];
      if (pv) {
        result = {
          ...(pv.cp !== undefined ? { cp: pv.cp } : {}),
          ...(pv.mate !== undefined ? { mate: pv.mate } : {}),
          best: pv.moves.split(' ')[0]!,
          depth: body.depth,
        };
      }
    }
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(cacheFile, JSON.stringify(result));
    await sleep(250);
    return result;
  }
};

async function main() {
  const id = process.argv[2];
  if (!id || id.startsWith('--')) {
    console.error('usage: pack:evals -- <id> [--depth 18] [--no-cloud] [--no-stockfish]');
    process.exit(2);
  }
  const pack = loadPack(id);
  const positions = packPositions(pack);
  const out = join(PACKS, id, 'evals.json');
  const existing = existsSync(out) ? readJsonFile<Record<string, Eval>>(out) : {};

  const evaluators: Evaluator[] = [];
  const names: string[] = [];
  if (!process.argv.includes('--no-cloud')) {
    evaluators.push(cloudEval);
    names.push('cloud');
  }
  let sf: Stockfish | null = null;
  if (!process.argv.includes('--no-stockfish')) {
    sf = new Stockfish();
    await sf.init();
    evaluators.push(sf.evaluator(numberArg('depth', 18)));
    names.push('stockfish');
  }

  console.log(
    `▶ ${id}: ${positions.size} positions, ${Object.keys(existing).length} already evaluated`,
  );
  const deadline = Date.now() + numberArg('minutes', 1e6) * 60_000;
  const result = await buildEvals(
    positions,
    evaluators,
    existing,
    (done, total, evals) => {
      if (done % 100 === 0) {
        console.log(`  ${done}/${total}`);
        writeFileSync(out, JSON.stringify(evals));
      }
    },
    () => Date.now() > deadline,
  );
  sf?.quit();
  writeFileSync(out, JSON.stringify(result.evals));
  console.log(
    `✓ ${Object.keys(result.evals).length} evals (${names.map((n, i) => `${n} ${result.answered[i]}`).join(', ')}), missing ${result.missing.length}`,
  );
  console.log(`→ ${out}`);
}

void main();
