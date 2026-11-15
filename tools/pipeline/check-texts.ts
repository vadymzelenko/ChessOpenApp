/**
 * Engine-checked status helper (ТЗ §8, module 15): every move mentioned in a
 * comment must be legal at that point of the line. Exit code 1 on problems.
 *
 *   npm run pack:check-texts -- <id> | --all
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { checkPackTexts } from '@chess-open/core';

import { PACKS, loadPack } from './common';

const ids = process.argv.includes('--all')
  ? readdirSync(PACKS).filter((d) => statSync(join(PACKS, d)).isDirectory())
  : process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (ids.length === 0) {
  console.error('usage: pack:check-texts -- <id> | --all');
  process.exit(2);
}
let failed = false;
for (const id of ids) {
  const issues = checkPackTexts(loadPack(id));
  console.log(
    `▶ ${id}: ${issues.length === 0 ? '✓ all mentioned moves are legal' : `${issues.length} issue(s)`}`,
  );
  for (const i of issues) console.log(`  ✗ ${i.where}: ${i.message}`);
  failed ||= issues.length > 0;
}
process.exit(failed ? 1 : 0);
