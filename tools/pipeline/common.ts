import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { PackBuildError, buildPackFromPgn, validatePack, type OpeningPack } from '@chess-open/core';

export const ROOT = resolve(__dirname, '..', '..');
export const PACKS = join(ROOT, 'packs');

export function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** Build and validate a pack from packs/<id> (PGN + JSON side files). Exits on errors. */
export function loadPack(id: string): OpeningPack {
  const dir = join(PACKS, id);
  try {
    const meta = readJsonFile<Parameters<typeof buildPackFromPgn>[0]['meta']>(
      join(dir, 'meta.json'),
    );
    const ideasPath = join(dir, 'ideas.json');
    const ideas = existsSync(ideasPath)
      ? readJsonFile<Parameters<typeof buildPackFromPgn>[0]['ideas']>(ideasPath)
      : [];
    const pgn = readdirSync(dir)
      .filter((f) => f.endsWith('.pgn'))
      .sort()
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n\n');
    const { pack } = buildPackFromPgn({ meta, ideas, pgn });
    for (const part of ['explorer', 'evals', 'puzzles'] as const) {
      const file = join(dir, `${part}.json`);
      if (existsSync(file)) (pack as Record<string, unknown>)[part] = readJsonFile(file);
    }
    const v = validatePack(pack);
    if (!v.ok) throw new PackBuildError(v.errors);
    return v.pack;
  } catch (e) {
    if (e instanceof PackBuildError) {
      e.errors.forEach((x) => console.error(`✗ ${x}`));
      process.exit(1);
    }
    throw e;
  }
}

export function numberArg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

export function stringArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
