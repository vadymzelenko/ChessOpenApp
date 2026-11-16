/**
 * Localisation check (ТЗ module 30): every language has every RU key (plural
 * forms aside) and the same {{placeholders}}. Run: npm run i18n:check
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR = resolve(__dirname, '..', 'apps', 'mobile', 'src', 'i18n', 'locales');
type Tree = { [k: string]: string | Tree };

function flat(t: Tree, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(t)) {
    if (typeof v === 'string') out[prefix + k] = v;
    else flat(v, `${prefix}${k}.`, out);
  }
  return out;
}
const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, '');
const holes = (s: string) =>
  [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)]
    .map((m) => m[1])
    .sort()
    .join(',');

const load = (f: string) => flat(JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Tree);
const ru = load('ru.json');
const ruBase = new Map(Object.entries(ru).map(([k, v]) => [base(k), v]));
let problems = 0;
const report = (msg: string) => {
  problems++;
  console.error(msg);
};
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'ru.json')) {
  const d = load(file);
  const keys = new Set(Object.keys(d).map(base));
  for (const k of ruBase.keys()) if (!keys.has(k)) report(`✗ ${file}: missing ${k}`);
  for (const k of keys) if (!ruBase.has(k)) report(`✗ ${file}: unknown key ${k}`);
  for (const [k, v] of Object.entries(d)) {
    const src = ruBase.get(base(k));
    if (src !== undefined && holes(src) !== holes(v))
      report(`✗ ${file}: placeholders differ in ${k}`);
  }
  console.log(`${problems ? '…' : '✓'} ${file}: ${Object.keys(d).length} strings`);
}
process.exit(problems ? 1 : 0);
