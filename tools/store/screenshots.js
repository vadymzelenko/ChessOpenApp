/**
 * Google Play screenshots (ТЗ module 32) from the static web build.
 *   npx expo export --platform web --output-dir dist   (in apps/mobile)
 *   serve dist with clean URLs on :8090, then: node tools/store/screenshots.js [baseUrl] [lang]
 * Run from the repo root; writes 1080×2160 PNGs to docs/store/screenshots/<lang>/.
 */
const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');

const base = process.argv[2] ?? 'http://localhost:8090';
const lang = process.argv[3] ?? 'ru';
const out = join(process.cwd(), 'docs', 'store', 'screenshots', lang);
const shots = [
  ['01-home', '/'],
  ['02-exam', '/exam/london/vs-d5-nf6'],
  ['03-line', '/line/london/bd6-main'],
  ['04-tree', '/tree'],
  ['05-review', '/review/london'],
  ['06-traps', '/traps/london'],
];

(async () => {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 360, height: 720 },
    deviceScaleFactor: 3,
    locale: { ru: 'ru-RU', uk: 'uk-UA', pl: 'pl-PL', en: 'en-US' }[lang],
    colorScheme: 'dark',
  });
  for (const [name, path] of shots) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(out, `${name}.png`) });
    console.log('✓', name);
  }
  await browser.close();
})();
