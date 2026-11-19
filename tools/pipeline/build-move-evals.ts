/**
 * Scores of every legal move in the positions where the course side moves
 * (pack field `moveEvals`): lets the app judge any move the user tries and
 * draw the evaluation bar for every position of the course.
 *
 *   npm run pack:move-evals -- <id> [--depth 12]
 *
 * Writes packs/<id>/moveEvals.json (merged into the pack by pack:build).
 */
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { MATE_SCORE, indexPack, validatePack } from '@chess-open/core';

import { PACKS, loadPack, numberArg, readJsonFile } from './common';
import { Stockfish } from './stockfish';

async function main() {
  const id = process.argv[2];
  if (!id || id.startsWith('--')) {
    console.error('usage: pack:move-evals -- <id> [--depth 12]');
    process.exit(2);
  }
  const v = validatePack(loadPack(id));
  if (!v.ok) throw new Error(v.errors.join('\n'));
  const index = indexPack(v.pack);
  const depth = numberArg('depth', 12);
  const out = join(PACKS, id, 'moveEvals.json');
  const result: Record<string, Record<string, number>> = existsSync(out) ? readJsonFile(out) : {};

  const positions = new Map<string, string>();
  for (const il of index.lines.values())
    for (const s of il.steps) if (s.ours) positions.set(s.keyBefore, s.fenBefore);
  console.log(`▶ ${id}: ${positions.size} positions, depth ${depth}`);

  const sf = new Stockfish();
  await sf.init(4, 256);
  let done = 0;
  for (const [key, fen] of positions) {
    done++;
    if (result[key]) continue;
    const scores = await sf.scoreAllMoves(fen, depth);
    const moves: Record<string, number> = {};
    for (const [uci, s] of scores)
      moves[uci] =
        s.mate !== undefined ? Math.sign(s.mate) * (MATE_SCORE - Math.abs(s.mate)) : (s.cp ?? 0);
    result[key] = moves;
    if (done % 25 === 0) {
      console.log(`  ${done}/${positions.size}`);
      writeFileSync(out, JSON.stringify(result));
    }
  }
  sf.quit();
  writeFileSync(out, JSON.stringify(result));
  console.log(`✓ ${Object.keys(result).length} positions → ${out}`);
}

void main();
