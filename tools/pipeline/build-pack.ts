/**
 * Build Opening Packs from author sources (ТЗ §3, module 10).
 *
 *   npm run pack:build -- <id> [--out <file>] [--check]
 *   npm run pack:build -- --all [--check]
 *   npm run pack:schema
 *
 * Sources: packs/<id>/meta.json, packs/<id>/ideas.json, packs/<id>/*.pgn
 * (Lichess study exports, see packs/README.md).
 * Output:  apps/mobile/assets/packs/<id>.json (minified), unless --check.
 * Folders starting with "_" (e.g. packs/_example) are built with --all but never shipped.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { PackBuildError, buildPackFromPgn, packJsonSchema, validatePack } from '@chess-open/core';

const ROOT = resolve(__dirname, '..', '..');
const PACKS = join(ROOT, 'packs');
const APP_PACKS = join(ROOT, 'apps', 'mobile', 'assets', 'packs');

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new PackBuildError([`${path}: ${(e as Error).message}`]);
  }
}

function build(id: string, opts: { check: boolean; out?: string }): boolean {
  const dir = join(PACKS, id);
  console.log(`\n▶ ${id}`);
  try {
    if (!existsSync(dir)) throw new PackBuildError([`no such pack folder: ${dir}`]);
    const pgnFiles = readdirSync(dir)
      .filter((f) => f.endsWith('.pgn'))
      .sort();
    if (pgnFiles.length === 0) throw new PackBuildError([`${dir}: no .pgn files`]);
    const meta = readJson(join(dir, 'meta.json')) as Parameters<typeof buildPackFromPgn>[0]['meta'];
    const ideasPath = join(dir, 'ideas.json');
    const ideas = (existsSync(ideasPath) ? readJson(ideasPath) : []) as Parameters<
      typeof buildPackFromPgn
    >[0]['ideas'];
    const pgn = pgnFiles.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n\n');

    const { pack, warnings: buildWarnings } = buildPackFromPgn({ meta, ideas, pgn });
    const result = validatePack(pack);
    const warnings = [...buildWarnings, ...result.warnings];
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    if (!result.ok) throw new PackBuildError(result.errors);

    const p = result.pack;
    const lines = p.course.chapters.flatMap((c) => c.lines);
    const byLevel = (lvl: string) => lines.filter((l) => l.level === lvl).length;
    const reviewed = lines.filter((l) => l.status === 'reviewed').length;
    console.log(
      `  ✓ ${p.course.chapters.length} chapters, ${lines.length} lines ` +
        `(base ${byLevel('base')} / advanced ${byLevel('advanced')} / deep ${byLevel('deep')}), ` +
        `${reviewed} reviewed ⭐, ${p.ideas.length} ideas, ${p.traps.length} traps, ${p.modelGames.length} model games`,
    );

    if (!opts.check) {
      const out = opts.out ?? join(APP_PACKS, `${id}.json`);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify(p));
      console.log(`  → ${out} (${(statSync(out).size / 1024).toFixed(1)} KB)`);
    }
    return true;
  } catch (e) {
    if (e instanceof PackBuildError) {
      e.errors.forEach((err) => console.error(`  ✗ ${err}`));
      return false;
    }
    throw e;
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'schema') {
    const out = join(PACKS, 'opening-pack.schema.json');
    writeFileSync(out, `${JSON.stringify(packJsonSchema(), null, 2)}\n`);
    console.log(`→ ${out}`);
    return;
  }
  const check = args.includes('--check');
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : undefined;
  const ids = args.includes('--all')
    ? readdirSync(PACKS).filter((d) => statSync(join(PACKS, d)).isDirectory())
    : args.filter((a, i) => !a.startsWith('--') && !(outIdx >= 0 && i === outIdx + 1));
  if (ids.length === 0) {
    console.error('usage: pack:build -- <id> [--out file] [--check] | --all [--check]');
    process.exit(2);
  }
  // "_"-prefixed packs are examples: validated, never written into the app.
  const ok = ids.map((id) => build(id, { check: check || id.startsWith('_'), out })).every(Boolean);
  process.exit(ok ? 0 : 1);
}

main();
