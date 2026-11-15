/**
 * Opening puzzles from the Lichess puzzle database (CC0, ТЗ module 14).
 * Reads the CSV from stdin so the 1 GB+ file is streamed, never stored:
 *
 *   curl -sL https://database.lichess.org/lichess_db_puzzle.csv.zst | zstd -dc | \
 *     npm run pack:puzzles -- <id> [--limit 400] [--min-rating 600] [--max-rating 2200]
 *
 * Tags come from meta.puzzleTags (e.g. ["London_System"]). Writes packs/<id>/puzzles.json.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { acceptPuzzle, parsePuzzleCsvLine, selectPuzzles, type PuzzleRow } from '@chess-open/core';

import { PACKS, loadPack, numberArg } from './common';

async function main() {
  const id = process.argv[2];
  if (!id || id.startsWith('--')) {
    console.error('usage: … | pack:puzzles -- <id> [--limit 400]');
    process.exit(2);
  }
  const pack = loadPack(id);
  const tags = pack.meta.puzzleTags ?? [];
  if (tags.length === 0) {
    console.error(
      `✗ ${id}: meta.puzzleTags is empty — set Lichess opening tags, e.g. ["London_System"]`,
    );
    process.exit(1);
  }
  const opts = {
    tags,
    minRating: numberArg('min-rating', 600),
    maxRating: numberArg('max-rating', 2200),
    limit: numberArg('limit', 400),
  };
  const candidates: PuzzleRow[] = [];
  let lines = 0;
  for await (const line of createInterface({ input: process.stdin })) {
    lines++;
    const row = parsePuzzleCsvLine(line);
    if (row && acceptPuzzle(row, opts)) candidates.push(row);
    if (lines % 1_000_000 === 0)
      console.log(`  ${lines / 1_000_000}M rows, ${candidates.length} candidates`);
  }
  const puzzles = selectPuzzles(candidates, opts);
  const out = join(PACKS, id, 'puzzles.json');
  writeFileSync(out, JSON.stringify(puzzles));
  console.log(
    `✓ ${puzzles.length} puzzles from ${candidates.length} candidates (${lines} rows) → ${out}`,
  );
}

void main();
