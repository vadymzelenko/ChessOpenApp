/**
 * Engine check of the repertoire (ТЗ §3 «проверка ходов репертуара движком»,
 * module 15): every move of our side in course lines is graded against the
 * engine; mistakes are reported, blunders fail the run.
 *
 *   npm run pack:engine-check -- <id> [--depth 16] [--verbose]
 *
 * `--verbose` also lists inaccuracies and the evaluation at the end of each line.
 *
 * Uses packs/<id>/evals.json where available, local Stockfish for the rest.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ChessGame, START_FEN, classifyMove, formatScore, type Eval } from '@chess-open/core';

import { PACKS, loadPack, numberArg, readJsonFile } from './common';
import { Stockfish } from './stockfish';

async function main() {
  const id = process.argv[2];
  if (!id || id.startsWith('--')) {
    console.error('usage: pack:engine-check -- <id> [--depth 16]');
    process.exit(2);
  }
  const pack = loadPack(id);
  const evalsFile = join(PACKS, id, 'evals.json');
  const cache: Record<string, Eval> = existsSync(evalsFile) ? readJsonFile(evalsFile) : {};
  const sf = new Stockfish();
  await sf.init();
  const depth = numberArg('depth', 16);
  const verbose = process.argv.includes('--verbose');
  const evalOf = async (g: ChessGame): Promise<Eval> => {
    const hit = cache[g.key];
    if (hit && (hit.depth ?? 0) >= depth) return hit;
    const e = (await sf.evaluate(g.fen, depth)) ?? { cp: 0 };
    cache[g.key] = e;
    return e;
  };

  const side = pack.meta.side;
  const start = pack.meta.startFen ?? START_FEN;
  let blunders = 0;
  let mistakes = 0;
  const seen = new Set<string>();
  for (const chapter of pack.course.chapters) {
    for (const line of chapter.lines) {
      const g = new ChessGame(start);
      for (const san of line.moves) {
        const ours = g.turn === side;
        const beforeKey = g.key;
        const before = ours ? await evalOf(g) : null;
        const rec = g.play(san)!;
        if (!ours || seen.has(`${beforeKey} ${rec.uci}`)) continue;
        seen.add(`${beforeKey} ${rec.uci}`);
        const after = await evalOf(g);
        const grade = classifyMove(before!, after, side, before!.best === rec.uci);
        if (grade === 'inaccuracy' && verbose)
          console.log(
            `  · ${chapter.id}/${line.id} ply ${rec.ply} ${rec.san}: inaccuracy (${formatScore(before!)} → ${formatScore(after)}, engine: ${before!.best ?? '?'})`,
          );
        if (grade === 'mistake' || grade === 'blunder') {
          if (grade === 'blunder') blunders++;
          else mistakes++;
          console.log(
            `  ${grade === 'blunder' ? '✗' : '⚠'} ${chapter.id}/${line.id} ply ${rec.ply} ${rec.san}: ${grade} ` +
              `(${formatScore(before!)} → ${formatScore(after)}, engine: ${before!.best ?? '?'})`,
          );
        }
      }
      if (verbose) console.log(`  = ${chapter.id}/${line.id}: ${formatScore(await evalOf(g))}`);
    }
  }
  sf.quit();
  console.log(
    `▶ ${id}: ${seen.size} repertoire moves checked — ${mistakes} mistakes, ${blunders} blunders`,
  );
  process.exit(blunders > 0 ? 1 : 0);
}

void main();
